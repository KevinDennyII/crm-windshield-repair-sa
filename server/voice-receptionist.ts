import type { Express, Request, Response } from "express";
import type { Server } from "http";
import OpenAI from "openai";
import { WebSocketServer, WebSocket } from "ws";
import { db } from "./db";
import { aiReceptionistSettings, aiReceptionistCalls, jobs } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const DEFAULT_GREETING = "Hello! Thank you for calling Windshield Repair SA. How can I help you today?";

const DEFAULT_SYSTEM_PROMPT = `You are a friendly, professional AI receptionist for Windshield Repair SA, an auto glass repair and replacement company in San Antonio, Texas.

Your goals during the call:
1. Greet the customer warmly
2. Find out what type of glass service they need (windshield replacement, door glass, back glass, chip repair, calibration)
3. Get their vehicle information (year, make, model)
4. Get their name and contact information
5. Let them know someone will follow up with a quote shortly

Important guidelines:
- Be conversational and natural, not robotic
- Keep responses brief (2-3 sentences max) since this is a phone call
- If the caller asks about pricing, let them know you'll have a specialist follow up with an exact quote
- If they have an emergency (broken glass, safety concern), express urgency and assure quick follow-up
- If the caller speaks Spanish, respond in Spanish
- Always be polite and end by thanking them for calling`;

const DEFAULT_BUSINESS_CONTEXT = `Business: Windshield Repair SA
Location: San Antonio, TX
Services: Windshield replacement, door glass, back glass, quarter glass, vent glass, sunroof, calibration, chip repair
Mobile service: Available for additional fee based on distance
Payment: Cash, credit card, check, insurance
Hours: Monday-Saturday
Phone: Available for questions`;

async function getSettings() {
  const [settings] = await db.select().from(aiReceptionistSettings).limit(1);
  return settings;
}

async function generateAIResponse(transcript: Array<{ role: string; content: string }>, settings: any): Promise<string> {
  const systemPrompt = (settings?.systemPrompt || DEFAULT_SYSTEM_PROMPT) +
    "\n\n" + (settings?.businessContext || DEFAULT_BUSINESS_CONTEXT) +
    "\n\nIMPORTANT: Keep your responses SHORT (1-3 sentences). This is a phone conversation. Do not use bullet points, lists, or formatting. Speak naturally.";

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  for (const entry of transcript) {
    if (entry.role === "caller") {
      messages.push({ role: "user", content: entry.content });
    } else if (entry.role === "assistant") {
      messages.push({ role: "assistant", content: entry.content });
    }
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    max_completion_tokens: 150,
  });

  return completion.choices[0]?.message?.content || "I'm sorry, I didn't catch that. Could you please repeat?";
}

async function extractLeadData(transcript: Array<{ role: string; content: string }>): Promise<any> {
  const conversationText = transcript.map(t => `${t.role === "caller" ? "Customer" : "Receptionist"}: ${t.content}`).join("\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `Extract customer information from this phone call transcript. Return a JSON object with these fields (use null for any missing info):
{
  "firstName": string or null,
  "lastName": string or null,
  "phone": string or null,
  "email": string or null,
  "vehicleYear": string or null,
  "vehicleMake": string or null,
  "vehicleModel": string or null,
  "glassType": string or null (windshield, door_glass, back_glass, quarter_glass, vent_glass, sunroof, chip_repair, calibration),
  "serviceType": string or null (replace or repair),
  "notes": string or null (brief summary of what customer needs),
  "isInsurance": boolean,
  "urgency": string (normal, urgent, emergency)
}
Only return the JSON object, no other text.`
      },
      { role: "user", content: conversationText }
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 300,
  });

  try {
    return JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch {
    return {};
  }
}

const ELEVENLABS_AGENT_ID = "agent_5201khahhwpefx9vjweqgpacqbrj";

export async function isAIReceptionistEnabled(): Promise<boolean> {
  const settings = await getSettings();
  return settings?.isEnabled ?? false;
}

export function setupElevenLabsWebSocket(httpServer: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
    if (pathname === "/media-stream") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", (twilioWs) => {
    console.log("[ElevenLabs Bridge] Twilio media stream connected");

    let streamSid: string | null = null;
    let callSid: string | null = null;
    let callerNumber: string = "Unknown";
    let elevenLabsWs: WebSocket | null = null;
    let conversationId: string | null = null;
    const callStartTime = Date.now();
    const transcriptEntries: Array<{ role: string; content: string }> = [];

    const connectToElevenLabs = () => {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      const wsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${ELEVENLABS_AGENT_ID}`;

      elevenLabsWs = new WebSocket(wsUrl, {
        headers: apiKey ? { "xi-api-key": apiKey } : undefined,
      });

      elevenLabsWs.on("open", () => {
        console.log("[ElevenLabs Bridge] Connected to ElevenLabs agent");
        elevenLabsWs!.send(JSON.stringify({
          type: "conversation_initiation_client_data",
          conversation_config_override: {
            agent: {
              prompt: {
                prompt: "You are speaking with a caller on the phone. Be conversational and brief.",
              },
            },
          },
        }));
      });

      elevenLabsWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());

          switch (msg.type) {
            case "conversation_initiation_metadata":
              conversationId = msg.conversation_id;
              console.log(`[ElevenLabs Bridge] Conversation ID: ${conversationId}`);
              break;

            case "audio":
              if (msg.audio?.chunk && streamSid && twilioWs.readyState === WebSocket.OPEN) {
                twilioWs.send(JSON.stringify({
                  event: "media",
                  streamSid,
                  media: { payload: msg.audio.chunk },
                }));
              }
              break;

            case "user_transcript":
              if (msg.user_transcription_event?.user_transcript) {
                transcriptEntries.push({
                  role: "caller",
                  content: msg.user_transcription_event.user_transcript,
                });
              } else if (msg.text) {
                transcriptEntries.push({ role: "caller", content: msg.text });
              }
              break;

            case "agent_response":
              if (msg.agent_response_event?.agent_response) {
                transcriptEntries.push({
                  role: "assistant",
                  content: msg.agent_response_event.agent_response,
                });
              } else if (msg.text) {
                transcriptEntries.push({ role: "assistant", content: msg.text });
              }
              break;
          }
        } catch (err) {
          console.error("[ElevenLabs Bridge] Error parsing ElevenLabs message:", err);
        }
      });

      elevenLabsWs.on("close", () => {
        console.log("[ElevenLabs Bridge] ElevenLabs connection closed");
        saveCallRecord();
      });

      elevenLabsWs.on("error", (err) => {
        console.error("[ElevenLabs Bridge] ElevenLabs WebSocket error:", err);
      });
    };

    let callRecordSaved = false;

    async function saveCallRecord() {
      if (callRecordSaved) return;
      callRecordSaved = true;

      const duration = Math.round((Date.now() - callStartTime) / 1000);
      const callRecordId = callSid || `call-${Date.now()}`;

      console.log(`[ElevenLabs Bridge] Saving call record: ${callRecordId}, caller: ${callerNumber}, duration: ${duration}s, transcript entries: ${transcriptEntries.length}, conversationId: ${conversationId}`);

      try {
        const [existing] = await db.select().from(aiReceptionistCalls)
          .where(eq(aiReceptionistCalls.callSid, callRecordId));

        if (existing) {
          await db.update(aiReceptionistCalls)
            .set({
              transcript: transcriptEntries.length > 0 ? transcriptEntries : existing.transcript,
              duration,
              status: "completed",
              callerNumber: callerNumber !== "Unknown" ? callerNumber : existing.callerNumber,
              elevenlabsConversationId: conversationId,
            })
            .where(eq(aiReceptionistCalls.callSid, callRecordId));
        } else {
          await db.insert(aiReceptionistCalls).values({
            callSid: callRecordId,
            callerNumber,
            transcript: transcriptEntries,
            duration,
            status: "completed",
            elevenlabsConversationId: conversationId,
          });
        }

        if (transcriptEntries.length >= 2) {
          console.log(`[ElevenLabs Bridge] Running GPT-4o extraction on ${transcriptEntries.length} transcript entries`);
          try {
            const extracted = await extractLeadData(transcriptEntries);

            let summary: string | null = null;
            try {
              const conversationText = transcriptEntries.map(t => `${t.role === "caller" ? "Customer" : "AI Receptionist"}: ${t.content}`).join("\n");
              const summaryResp = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                  { role: "system", content: "Summarize this phone call for an auto glass business in 2-3 sentences. Include the caller's name, what they need, and vehicle info if mentioned. Be concise." },
                  { role: "user", content: conversationText },
                ],
                max_completion_tokens: 150,
              });
              summary = summaryResp.choices[0]?.message?.content || null;
            } catch (sumErr) {
              console.error("[ElevenLabs Bridge] Summary generation failed:", sumErr);
              summary = transcriptEntries.filter(t => t.role === "caller").map(t => t.content).join(" ").slice(0, 200);
            }

            await db.update(aiReceptionistCalls)
              .set({
                extractedData: extracted,
                transcriptSummary: summary,
                callType: "ai",
              })
              .where(eq(aiReceptionistCalls.callSid, callRecordId));

            const cleanedNumber = (extracted.phone || callerNumber || "").replace(/\D/g, "");

            let existingJobId: string | null = null;
            if (cleanedNumber && cleanedNumber.length >= 10) {
              const allJobs = await db.select().from(jobs);
              const match = allJobs.find((j: any) => {
                const jobPhone = (j.phone || "").replace(/\D/g, "");
                return jobPhone && (jobPhone === cleanedNumber || jobPhone.endsWith(cleanedNumber.slice(-10)) || cleanedNumber.endsWith(jobPhone.slice(-10)));
              });
              if (match) existingJobId = match.id;
            }

            const [currentRecord] = await db.select().from(aiReceptionistCalls)
              .where(eq(aiReceptionistCalls.callSid, callRecordId));
            if (currentRecord?.leadCreated) {
              console.log(`[ElevenLabs Bridge] Lead already created for ${callRecordId} - skipping`);
              return;
            }

            if (existingJobId) {
              console.log(`[ElevenLabs Bridge] Matched existing customer, job: ${existingJobId}`);
              await db.update(aiReceptionistCalls)
                .set({ jobId: existingJobId })
                .where(eq(aiReceptionistCalls.callSid, callRecordId));
            } else if (extracted.firstName || extracted.phone) {
              console.log(`[ElevenLabs Bridge] Creating new lead: ${extracted.firstName} ${extracted.lastName || ""}`);

              const maxResult = await db.select({ maxNum: sql<string>`MAX(job_number)` }).from(jobs);
              const maxNum = maxResult[0]?.maxNum;
              const nextNum = maxNum ? parseInt(maxNum, 10) + 1 : 1;
              const jobNumber = String(nextNum).padStart(6, "0");
              const jobId = crypto.randomUUID();

              const newJob: any = {
                id: jobId,
                jobNumber,
                firstName: extracted.firstName || "Unknown",
                lastName: extracted.lastName || "Caller",
                phone: extracted.phone || callerNumber,
                email: extracted.email || "",
                customerType: extracted.isInsurance ? "insurance" : "retail",
                isBusiness: false,
                pipelineStage: "new_lead",
                leadSource: "phone_call",
                repairLocation: "mobile",
                address: extracted.address || "",
                vehicles: (extracted.vehicleYear || extracted.vehicleMake) ? [{
                  id: crypto.randomUUID(),
                  year: extracted.vehicleYear || "",
                  make: extracted.vehicleMake || "",
                  model: extracted.vehicleModel || "",
                  parts: extracted.glassType ? [{
                    id: crypto.randomUUID(),
                    glassType: extracted.glassType,
                    serviceType: extracted.serviceType || "replace",
                    quantity: 1,
                    partNumber: "",
                    retailPrice: 0,
                    cost: 0,
                    laborCost: 0,
                  }] : [],
                }] : [],
                installNotes: `[AI Receptionist Lead] ${extracted.notes || ""}`.trim(),
                subtotal: 0,
                taxAmount: 0,
                totalDue: 0,
                deductible: 0,
                rebate: 0,
                amountPaid: 0,
                balanceDue: 0,
                paymentStatus: "pending",
                paymentMethod: [],
                paymentHistory: [],
                followUpMode: "auto",
              };

              await db.insert(jobs).values(newJob);
              await db.update(aiReceptionistCalls)
                .set({ leadCreated: true, jobId: jobId })
                .where(eq(aiReceptionistCalls.callSid, callRecordId));

              console.log(`[ElevenLabs Bridge] Created job #${jobNumber} from AI call`);
            }
          } catch (extractErr) {
            console.error("[ElevenLabs Bridge] GPT-4o extraction failed:", extractErr);
          }
        } else {
          console.log(`[ElevenLabs Bridge] Too few transcript entries (${transcriptEntries.length}) - skipping extraction`);
        }
      } catch (err) {
        console.error("[ElevenLabs Bridge] Failed to save call record:", err);
      }
    }

    twilioWs.on("message", (message) => {
      try {
        const msg = JSON.parse(message.toString());

        switch (msg.event) {
          case "start":
            streamSid = msg.start.streamSid;
            callSid = msg.start.callSid;
            if (msg.start.customParameters?.caller) {
              callerNumber = msg.start.customParameters.caller;
            }
            console.log(`[ElevenLabs Bridge] Stream started - SID: ${streamSid}, Call: ${callSid}, Caller: ${callerNumber}`);
            connectToElevenLabs();
            break;

          case "media":
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              elevenLabsWs.send(JSON.stringify({
                user_audio_chunk: msg.media.payload,
              }));
            }
            break;

          case "stop":
            console.log("[ElevenLabs Bridge] Stream stopped");
            if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
              elevenLabsWs.close();
            }
            break;
        }
      } catch (err) {
        console.error("[ElevenLabs Bridge] Error handling Twilio message:", err);
      }
    });

    twilioWs.on("close", () => {
      console.log("[ElevenLabs Bridge] Twilio connection closed");
      if (elevenLabsWs && elevenLabsWs.readyState === WebSocket.OPEN) {
        elevenLabsWs.close();
      } else {
        saveCallRecord();
      }
    });

    twilioWs.on("error", (err) => {
      console.error("[ElevenLabs Bridge] Twilio WebSocket error:", err);
    });
  });

  console.log("[ElevenLabs Bridge] WebSocket server ready on /media-stream");
}

export function registerVoiceReceptionistRoutes(app: Express): void {

  app.get("/api/ai-receptionist/settings", async (_req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      if (!settings) {
        return res.json({
          isEnabled: false,
          greeting: DEFAULT_GREETING,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          businessContext: DEFAULT_BUSINESS_CONTEXT,
          voiceName: "ElevenLabs",
          maxTurns: 10,
        });
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-receptionist/settings", async (req: Request, res: Response) => {
    try {
      const { isEnabled, greeting, systemPrompt, businessContext, voiceName, maxTurns } = req.body;
      const existing = await getSettings();

      if (existing) {
        const [updated] = await db.update(aiReceptionistSettings)
          .set({
            isEnabled: isEnabled ?? existing.isEnabled,
            greeting: greeting ?? existing.greeting,
            systemPrompt: systemPrompt ?? existing.systemPrompt,
            businessContext: businessContext ?? existing.businessContext,
            voiceName: voiceName ?? existing.voiceName,
            maxTurns: maxTurns ?? existing.maxTurns,
            updatedAt: new Date(),
          })
          .where(eq(aiReceptionistSettings.id, existing.id))
          .returning();
        return res.json(updated);
      }

      const [created] = await db.insert(aiReceptionistSettings).values({
        isEnabled: isEnabled ?? false,
        greeting: greeting || DEFAULT_GREETING,
        systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        businessContext: businessContext || DEFAULT_BUSINESS_CONTEXT,
        voiceName: voiceName || "ElevenLabs",
        maxTurns: maxTurns || 10,
      }).returning();
      res.json(created);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai-receptionist/calls", async (_req: Request, res: Response) => {
    try {
      const calls = await db.select().from(aiReceptionistCalls).orderBy(desc(aiReceptionistCalls.createdAt)).limit(100);
      res.json(calls);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/ai-receptionist/calls/:id", async (req: Request, res: Response) => {
    try {
      const [call] = await db.select().from(aiReceptionistCalls).where(eq(aiReceptionistCalls.id, req.params.id as string));
      if (!call) return res.status(404).json({ message: "Call not found" });
      res.json(call);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-receptionist/calls/:id/create-lead", async (req: Request, res: Response) => {
    try {
      const [call] = await db.select().from(aiReceptionistCalls).where(eq(aiReceptionistCalls.id, req.params.id as string));
      if (!call) return res.status(404).json({ message: "Call not found" });

      const extracted = (call.extractedData as any) || {};
      if (!extracted.firstName && !extracted.phone) {
        return res.status(400).json({ message: "Not enough information to create a lead. Need at least a name or phone number." });
      }

      const allJobs = await db.select().from(jobs);
      const maxJobNumber = allJobs.reduce((max: number, j: any) => {
        const num = parseInt(j.jobNumber || "0");
        return num > max ? num : max;
      }, 0);

      const vehicles = [];
      if (extracted.vehicleYear || extracted.vehicleMake || extracted.vehicleModel) {
        vehicles.push({
          year: extracted.vehicleYear || "",
          make: extracted.vehicleMake || "",
          model: extracted.vehicleModel || "",
          parts: extracted.glassType ? [{
            glassType: extracted.glassType,
            serviceType: extracted.serviceType || "replace",
            quantity: 1,
            partPrice: 0,
            laborPrice: 0,
            totalPrice: 0,
          }] : [],
        });
      }

      const [newJob] = await db.insert(jobs).values({
        jobNumber: String(maxJobNumber + 1),
        firstName: extracted.firstName || "Unknown",
        lastName: extracted.lastName || "",
        phone: extracted.phone || call.callerNumber,
        email: extracted.email || "",
        pipelineStage: "quote",
        leadSource: "phone_call",
        customerType: extracted.isInsurance ? "insurance" : "retail",
        vehicles: vehicles,
        notes: `[AI Receptionist Lead]\n${extracted.notes || "Caller contacted via phone."}\nUrgency: ${extracted.urgency || "normal"}`,
        totalDue: 0,
        amountPaid: 0,
        balanceDue: 0,
        paymentStatus: "unpaid",
        followUpMode: "auto",
      } as any).returning();

      await db.update(aiReceptionistCalls)
        .set({ leadCreated: true, jobId: newJob.id })
        .where(eq(aiReceptionistCalls.id, call.id));

      res.json({ message: "Lead created successfully", job: newJob });
    } catch (error: any) {
      console.error("Create lead error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-receptionist/simulate", async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory } = req.body;
      const settings = await getSettings();

      const transcript: Array<{ role: string; content: string }> = [];

      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const entry of conversationHistory) {
          transcript.push({ role: entry.role, content: entry.content });
        }
      }

      if (message) {
        transcript.push({ role: "caller", content: message });
      }

      const aiText = await generateAIResponse(transcript, settings);

      res.json({
        response: aiText,
      });
    } catch (error: any) {
      console.error("Simulate error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ai-receptionist/simulate/greeting", async (_req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      const greeting = settings?.greeting || DEFAULT_GREETING;

      res.json({
        greeting,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/elevenlabs-webhook", async (req: Request, res: Response) => {
    try {
      console.log("[ElevenLabs Webhook] Received data:", JSON.stringify(req.body).slice(0, 500));

      const { conversation_id, transcript, metadata, agent_id } = req.body;

      if (agent_id && agent_id !== ELEVENLABS_AGENT_ID) {
        console.warn(`[ElevenLabs Webhook] Rejected unknown agent_id: ${agent_id}`);
        return res.status(403).json({ success: false, error: "Unknown agent" });
      }

      const transcriptEntries: Array<{ role: string; content: string }> = [];
      if (Array.isArray(transcript)) {
        for (const entry of transcript) {
          transcriptEntries.push({
            role: entry.role === "agent" ? "assistant" : "caller",
            content: entry.message || entry.text || entry.content || "",
          });
        }
      }

      const callId = conversation_id || `elevenlabs-${Date.now()}`;

      const [existingCall] = await db.select().from(aiReceptionistCalls)
        .where(eq(aiReceptionistCalls.callSid, callId));

      if (existingCall && existingCall.leadCreated) {
        console.log(`[ElevenLabs Webhook] Duplicate webhook for ${callId}, lead already created - skipping`);
        return res.json({ success: true, conversationId: callId, duplicate: true });
      }

      if (!existingCall) {
        await db.insert(aiReceptionistCalls).values({
          callSid: callId,
          callerNumber: metadata?.caller_number || metadata?.phone || "ElevenLabs Widget",
          transcript: transcriptEntries,
          status: "completed",
        });
      } else {
        await db.update(aiReceptionistCalls)
          .set({ transcript: transcriptEntries, status: "completed" })
          .where(eq(aiReceptionistCalls.callSid, callId));
      }

      const settings = await getSettings();
      const autoCreateLeads = settings?.isEnabled ?? true;

      if (transcriptEntries.length >= 2) {
        const extracted = await extractLeadData(transcriptEntries);
        await db.update(aiReceptionistCalls)
          .set({ extractedData: extracted })
          .where(eq(aiReceptionistCalls.callSid, callId));

        if (autoCreateLeads && (extracted.firstName || extracted.phone)) {
          console.log(`[ElevenLabs Webhook] Extracted lead data from conversation ${callId}:`, extracted);

          const jobId = crypto.randomUUID();
          const maxResult = await db.select({ maxNum: sql<string>`MAX(job_number)` }).from(jobs);
          const maxNum = maxResult[0]?.maxNum;
          const nextNum = maxNum ? parseInt(maxNum, 10) + 1 : 1;
          const jobNumber = String(nextNum).padStart(6, '0');

          const newJob: any = {
            id: jobId,
            jobNumber,
            firstName: extracted.firstName || "Unknown",
            lastName: extracted.lastName || "Caller",
            phone: extracted.phone || "",
            email: extracted.email || "",
            customerType: "retail",
            isBusiness: false,
            pipelineStage: "new_lead",
            repairLocation: "mobile",
            vehicles: extracted.vehicleYear ? [{
              id: crypto.randomUUID(),
              year: extracted.vehicleYear || "",
              make: extracted.vehicleMake || "",
              model: extracted.vehicleModel || "",
              parts: extracted.glassType ? [{
                id: crypto.randomUUID(),
                glassType: extracted.glassType,
                serviceType: extracted.serviceType || "replace",
                quantity: 1,
                partNumber: "",
                retailPrice: 0,
                cost: 0,
                laborCost: 0,
              }] : [],
            }] : [],
            installNotes: `[ElevenLabs AI Lead] ${extracted.notes || ""}`.trim(),
            subtotal: 0,
            taxAmount: 0,
            totalDue: 0,
            deductible: 0,
            rebate: 0,
            amountPaid: 0,
            balanceDue: 0,
            paymentStatus: "pending",
            paymentMethod: [],
            paymentHistory: [],
            followUpMode: "auto",
          };

          await db.insert(jobs).values(newJob);
          await db.update(aiReceptionistCalls)
            .set({ leadCreated: true, jobId: jobId })
            .where(eq(aiReceptionistCalls.callSid, callId));

          console.log(`[ElevenLabs Webhook] Created new lead job ${jobNumber} from ElevenLabs conversation`);
        }
      }

      res.json({ success: true, conversationId: callId });
    } catch (error: any) {
      console.error("[ElevenLabs Webhook] Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });
}
