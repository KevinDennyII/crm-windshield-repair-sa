import { db } from "./db";
import { aiReceptionistCalls, jobs } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import OpenAI from "openai";
import crypto from "crypto";

const ELEVENLABS_AGENT_ID = "agent_5201khahhwpefx9vjweqgpacqbrj";
const POLL_INTERVAL_MS = 60_000;

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface ElevenLabsConversation {
  conversation_id: string;
  agent_id: string;
  start_time_unix_secs: number;
  call_duration_secs: number;
  message_count: number;
  status: string;
  call_successful: string;
  call_summary_title: string | null;
  transcript_summary: string | null;
  conversation_initiation_source: string;
  direction: string | null;
}

interface ElevenLabsTranscriptEntry {
  role: string;
  message: string;
  time_in_call_secs: number;
}

interface ElevenLabsConversationDetail {
  conversation_id: string;
  agent_id: string;
  status: string;
  transcript: ElevenLabsTranscriptEntry[];
  metadata: {
    start_time_unix_secs: number;
    call_duration_secs: number;
    cost: number;
    from_number?: string;
    to_number?: string;
    phone_number?: string;
    termination_reason?: string;
  };
  analysis: {
    call_successful?: string;
    transcript_summary?: string;
    data_collection_results?: Record<string, { value: string }>;
  };
}

async function fetchConversations(pageSize: number = 10): Promise<ElevenLabsConversation[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.log("[ElevenLabs Poller] No API key configured, skipping poll");
    return [];
  }

  const url = `https://api.elevenlabs.io/v1/convai/conversations?agent_id=${ELEVENLABS_AGENT_ID}&page_size=${pageSize}&include_summaries=true`;
  const res = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error("[ElevenLabs Poller] API error:", res.status, errorText);
    return [];
  }

  const data = await res.json();
  return data.conversations || [];
}

async function fetchConversationDetail(conversationId: string): Promise<ElevenLabsConversationDetail | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const url = `https://api.elevenlabs.io/v1/convai/conversations/${conversationId}`;
  const res = await fetch(url, {
    headers: { "xi-api-key": apiKey },
  });

  if (!res.ok) {
    console.error(`[ElevenLabs Poller] Failed to fetch conversation ${conversationId}:`, res.status);
    return null;
  }

  return res.json();
}

async function extractLeadData(transcript: Array<{ role: string; content: string }>): Promise<any> {
  const conversationText = transcript.map(t => `${t.role === "caller" ? "Customer" : "Receptionist"}: ${t.content}`).join("\n");

  try {
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
  "address": string or null,
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

    return JSON.parse(completion.choices[0]?.message?.content || "{}");
  } catch (err) {
    console.error("[ElevenLabs Poller] Failed to extract lead data:", err);
    return {};
  }
}

async function processConversation(conv: ElevenLabsConversation): Promise<void> {
  const [existing] = await db.select()
    .from(aiReceptionistCalls)
    .where(eq(aiReceptionistCalls.elevenlabsConversationId, conv.conversation_id))
    .limit(1);

  if (existing) {
    return;
  }

  if (conv.message_count < 2) {
    console.log(`[ElevenLabs Poller] Skipping conversation ${conv.conversation_id} - only ${conv.message_count} messages (likely hangup)`);
    const callId = crypto.randomUUID();
    await db.insert(aiReceptionistCalls).values({
      id: callId,
      elevenlabsConversationId: conv.conversation_id,
      callerNumber: "Unknown",
      status: "completed",
      duration: conv.call_duration_secs,
      callSource: conv.conversation_initiation_source || "twilio",
      transcriptSummary: conv.call_summary_title || "Caller hung up quickly",
    }).onConflictDoNothing();
    return;
  }

  console.log(`[ElevenLabs Poller] Processing new conversation: ${conv.conversation_id} - "${conv.call_summary_title}"`);

  const detail = await fetchConversationDetail(conv.conversation_id);
  if (!detail) return;

  const transcriptEntries = (detail.transcript || []).map(t => ({
    role: t.role === "agent" ? "assistant" : "caller",
    content: t.message,
  }));

  const callerNumber = detail.metadata?.from_number || detail.metadata?.phone_number || "Unknown";
  const calledNumber = detail.metadata?.to_number || "";
  const summary = detail.analysis?.transcript_summary || conv.call_summary_title || "";

  const extracted = await extractLeadData(transcriptEntries);

  if (extracted.phone === null && callerNumber !== "Unknown") {
    extracted.phone = callerNumber;
  }

  const callId = crypto.randomUUID();
  await db.insert(aiReceptionistCalls).values({
    id: callId,
    elevenlabsConversationId: conv.conversation_id,
    callerNumber: callerNumber,
    calledNumber: calledNumber,
    transcript: transcriptEntries,
    transcriptSummary: summary,
    extractedData: extracted,
    status: "completed",
    duration: detail.metadata?.call_duration_secs || conv.call_duration_secs,
    callSource: conv.conversation_initiation_source || "twilio",
  }).onConflictDoNothing();

  let existingCustomerJobId: string | null = null;
  if (callerNumber && callerNumber !== "Unknown") {
    const cleanedNumber = callerNumber.replace(/\D/g, "");
    const allJobs = await db.select().from(jobs);
    const matchingJob = allJobs.find((j: any) => {
      const jobPhone = (j.phone || "").replace(/\D/g, "");
      return jobPhone && (jobPhone === cleanedNumber || jobPhone.endsWith(cleanedNumber.slice(-10)) || cleanedNumber.endsWith(jobPhone.slice(-10)));
    });
    if (matchingJob) {
      existingCustomerJobId = matchingJob.id;
    }
  }

  if (existingCustomerJobId) {
    console.log(`[ElevenLabs Poller] Existing customer found for ${callerNumber}, job: ${existingCustomerJobId}`);

    await db.update(aiReceptionistCalls)
      .set({ jobId: existingCustomerJobId })
      .where(eq(aiReceptionistCalls.id, callId));
  } else if (extracted.firstName || extracted.phone) {
    console.log(`[ElevenLabs Poller] Creating new lead from AI call: ${extracted.firstName} ${extracted.lastName || ""}`);

    const maxResult = await db.select({ maxNum: sql<string>`MAX(job_number)` }).from(jobs);
    const maxNum = maxResult[0]?.maxNum;
    const nextNum = maxNum ? parseInt(maxNum, 10) + 1 : 1;
    const jobNumber = String(nextNum).padStart(6, '0');
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
      .where(eq(aiReceptionistCalls.id, callId));

    console.log(`[ElevenLabs Poller] Created job #${jobNumber} from AI call`);
  } else {
    console.log(`[ElevenLabs Poller] Call from ${callerNumber} - not enough info to create lead`);
  }
}

export function startElevenLabsPoller(): void {
  console.log("[ElevenLabs Poller] Starting background worker (checking every 60 seconds)");

  const poll = async () => {
    try {
      const conversations = await fetchConversations(10);
      if (conversations.length === 0) return;

      for (const conv of conversations) {
        try {
          await processConversation(conv);
        } catch (err) {
          console.error(`[ElevenLabs Poller] Error processing conversation ${conv.conversation_id}:`, err);
        }
      }
    } catch (err) {
      console.error("[ElevenLabs Poller] Poll error:", err);
    }
  };

  poll();
  setInterval(poll, POLL_INTERVAL_MS);
}
