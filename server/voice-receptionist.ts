import type { Express, Request, Response } from "express";
import twilio from "twilio";
import OpenAI from "openai";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { aiReceptionistSettings, aiReceptionistCalls, jobs } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { isTwilioConfigured, getTwilioPhoneNumber } from "./twilio";
import { isElevenLabsVoice, isElevenLabsConfigured, generateElevenLabsAudio, AUDIO_DIR } from "./elevenlabs";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

function getSayAttributes(voiceName: string): { voice: string; language?: string } {
  if (voiceName.startsWith("Google.")) {
    const langMatch = voiceName.match(/Google\.([\w-]+)-/);
    const lang = langMatch ? langMatch[1] : "en-US";
    return { voice: voiceName, language: lang };
  }
  return { voice: voiceName };
}

function getBaseUrl(): string {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return process.env.REPLIT_DEPLOYMENT_URL;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const replSlug = process.env.REPL_SLUG;
  const replOwner = process.env.REPL_OWNER;
  if (replSlug && replOwner) {
    return `https://${replSlug}.${replOwner}.repl.co`;
  }
  return "https://localhost:5000";
}

async function speakText(
  target: any,
  text: string,
  voiceName: string
): Promise<void> {
  if (isElevenLabsVoice(voiceName) && isElevenLabsConfigured()) {
    const filename = await generateElevenLabsAudio(text, voiceName);
    if (filename) {
      const audioUrl = `${getBaseUrl()}/api/elevenlabs-audio/${filename}`;
      target.play(audioUrl);
      return;
    }
  }
  const sayAttrs = getSayAttributes(voiceName);
  target.say(sayAttrs as any, text);
}

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

async function getOrCreateCallRecord(callSid: string, callerNumber: string) {
  const [existing] = await db.select().from(aiReceptionistCalls).where(eq(aiReceptionistCalls.callSid, callSid));
  if (existing) return existing;

  const [created] = await db.insert(aiReceptionistCalls).values({
    callSid,
    callerNumber,
    transcript: [],
    status: "in_progress",
  }).returning();
  return created;
}

async function appendTranscript(callSid: string, role: string, content: string) {
  await db.execute(sql`
    UPDATE ai_receptionist_calls 
    SET transcript = transcript || ${JSON.stringify([{ role, content, timestamp: new Date().toISOString() }])}::jsonb
    WHERE call_sid = ${callSid}
  `);
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

export function registerVoiceReceptionistRoutes(app: Express): void {
  app.get("/api/elevenlabs-audio/:filename", (req: Request, res: Response) => {
    const filename = req.params.filename as string;
    if (!filename || filename.includes("..") || !filename.endsWith(".mp3")) {
      return res.status(400).send("Invalid filename");
    }
    const filePath = path.join(AUDIO_DIR, filename as string);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send("Audio not found");
    }
    res.set("Content-Type", "audio/mpeg");
    res.sendFile(filePath);
  });

  app.get("/api/ai-receptionist/settings", async (_req: Request, res: Response) => {
    try {
      const settings = await getSettings();
      if (!settings) {
        return res.json({
          isEnabled: false,
          greeting: DEFAULT_GREETING,
          systemPrompt: DEFAULT_SYSTEM_PROMPT,
          businessContext: DEFAULT_BUSINESS_CONTEXT,
          voiceName: "Polly.Joanna",
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
        voiceName: voiceName || "Polly.Joanna",
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

  app.post("/api/voice/ai-receptionist", async (req: Request, res: Response) => {
    res.set("Content-Type", "text/xml");
    try {
      const settings = await getSettings();
      const isEnabled = settings?.isEnabled ?? false;

      if (!isEnabled) {
        const response = new twilio.twiml.VoiceResponse();
        response.say("Our AI receptionist is currently offline. Please hold while we connect you to an agent.");
        response.dial().client("crm_agent");
        return res.send(response.toString());
      }

      const { CallSid, From } = req.body;
      const voiceName = settings?.voiceName || "Polly.Joanna";
      const greeting = settings?.greeting || DEFAULT_GREETING;

      await getOrCreateCallRecord(CallSid, From);
      await appendTranscript(CallSid, "assistant", greeting);

      const response = new twilio.twiml.VoiceResponse();
      const gather = response.gather({
        input: ["speech"],
        speechTimeout: "auto",
        action: "/api/voice/ai-receptionist/respond",
        method: "POST",
        language: "en-US",
        speechModel: "experimental_conversations",
      });
      await speakText(gather, greeting, voiceName);

      await speakText(response, "I'm sorry, I didn't hear anything. Goodbye!", voiceName);
      response.hangup();

      res.send(response.toString());
    } catch (error: any) {
      console.error("AI Receptionist error:", error);
      const response = new twilio.twiml.VoiceResponse();
      response.say("We're experiencing technical difficulties. Please try again later.");
      response.hangup();
      res.send(response.toString());
    }
  });

  app.post("/api/voice/ai-receptionist/respond", async (req: Request, res: Response) => {
    res.set("Content-Type", "text/xml");
    try {
      const { CallSid, SpeechResult, From } = req.body;
      const settings = await getSettings();
      const voiceName = settings?.voiceName || "Polly.Joanna";
      const maxTurns = settings?.maxTurns || 10;

      const callRecord = await getOrCreateCallRecord(CallSid, From || "unknown");

      await appendTranscript(CallSid, "caller", SpeechResult || "(silence)");

      const [updatedCall] = await db.select().from(aiReceptionistCalls).where(eq(aiReceptionistCalls.callSid, CallSid));
      const transcript = (updatedCall?.transcript as Array<{ role: string; content: string }>) || [];
      const turnCount = transcript.filter(t => t.role === "caller").length;

      if (turnCount >= maxTurns) {
        const farewell = "Thank you so much for calling Windshield Repair SA! We have all your information and someone will be reaching out to you shortly with a quote. Have a great day!";
        await appendTranscript(CallSid, "assistant", farewell);

        const response = new twilio.twiml.VoiceResponse();
        await speakText(response, farewell, voiceName);
        response.hangup();

        processCallEnd(CallSid).catch(err => console.error("Post-call processing error:", err));

        return res.send(response.toString());
      }

      const aiResponse = await generateAIResponse(transcript, settings);
      await appendTranscript(CallSid, "assistant", aiResponse);

      const response = new twilio.twiml.VoiceResponse();
      const gather = response.gather({
        input: ["speech"],
        speechTimeout: "auto",
        action: "/api/voice/ai-receptionist/respond",
        method: "POST",
        language: "en-US",
        speechModel: "experimental_conversations",
      });
      await speakText(gather, aiResponse, voiceName);

      await speakText(response, "Thank you for calling. Goodbye!", voiceName);
      response.hangup();

      res.send(response.toString());
    } catch (error: any) {
      console.error("AI Receptionist respond error:", error);
      const response = new twilio.twiml.VoiceResponse();
      response.say("I'm having trouble processing your request. Let me connect you to someone who can help.");
      response.dial().client("crm_agent");
      res.send(response.toString());
    }
  });

  app.post("/api/voice/ai-receptionist/status", async (req: Request, res: Response) => {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;
      console.log("AI Receptionist call status:", { CallSid, CallStatus, CallDuration });

      if (["completed", "failed", "busy", "no-answer"].includes(CallStatus)) {
        await db.update(aiReceptionistCalls)
          .set({
            status: CallStatus,
            duration: CallDuration ? parseInt(CallDuration) : undefined,
          })
          .where(eq(aiReceptionistCalls.callSid, CallSid));

        if (CallStatus === "completed") {
          processCallEnd(CallSid).catch(err => console.error("Post-call processing error:", err));
        }
      }
      res.status(204).end();
    } catch (error: any) {
      console.error("AI Receptionist status error:", error);
      res.status(204).end();
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

  app.post("/api/ai-receptionist/test-prompt", async (req: Request, res: Response) => {
    try {
      const { message, systemPrompt, businessContext } = req.body;

      const testSettings = {
        systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPT,
        businessContext: businessContext || DEFAULT_BUSINESS_CONTEXT,
      };

      const transcript = [{ role: "caller", content: message }];
      const response = await generateAIResponse(transcript, testSettings);
      res.json({ response });
    } catch (error: any) {
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
        voiceName: settings?.voiceName || "Polly.Joanna",
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
        voiceName: settings?.voiceName || "Polly.Joanna",
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
}

async function processCallEnd(callSid: string) {
  try {
    const [call] = await db.select().from(aiReceptionistCalls).where(eq(aiReceptionistCalls.callSid, callSid));
    if (!call || call.leadCreated) return;

    const transcript = (call.transcript as Array<{ role: string; content: string }>) || [];
    if (transcript.length < 2) return;

    const extracted = await extractLeadData(transcript);
    await db.update(aiReceptionistCalls)
      .set({ extractedData: extracted })
      .where(eq(aiReceptionistCalls.callSid, callSid));

    if (extracted.firstName || extracted.phone) {
      console.log(`[AI Receptionist] Extracted lead data from call ${callSid}:`, extracted);
    }
  } catch (error) {
    console.error("Process call end error:", error);
  }
}
