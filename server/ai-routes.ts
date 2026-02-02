import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { conversations, messages, jobs, type Conversation, type Message, type Job } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// CRM System prompt for context
const CRM_SYSTEM_PROMPT = `You are an AI assistant for AutoGlass Pro CRM, a customer relationship management system for an auto glass repair business called Windshield Repair SA based in San Antonio, Texas.

You help staff with:
- Understanding job details and customer information
- Writing professional emails and SMS messages to customers
- Generating quotes and estimates
- Suggesting follow-ups for leads
- Summarizing job information
- Helping with insurance claim descriptions
- Answering questions about the auto glass business

Always be professional, helpful, and concise. When drafting messages to customers, use a friendly but professional tone.

Important business details:
- Company: Windshield Repair SA
- Location: San Antonio, TX
- Services: Windshield replacement, door glass, back glass, quarter glass, calibration, chip repair
- Payment methods: Cash, credit card, check
- Mobile service available for an additional fee based on distance
`;

// Helper to get CRM context
async function getCRMContext(): Promise<string> {
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(20);
  
  const jobSummaries = allJobs.map((job) => {
    const vehicles = (job.vehicles as any[]) || [];
    const vehicleInfo = vehicles.map((v: any) => `${v.year || ''} ${v.make || ''} ${v.model || ''}`).join(', ');
    return `- Job #${job.jobNumber}: ${job.firstName} ${job.lastName}, ${job.phone}, Stage: ${job.pipelineStage}, Total: $${job.totalDue || 0}, Vehicles: ${vehicleInfo || 'N/A'}`;
  }).join('\n');
  
  return `\n\nCurrent CRM Data (Recent 20 Jobs):\n${jobSummaries || 'No jobs found.'}`;
}

export function registerAIRoutes(app: Express): void {
  // Get all AI conversations
  app.get("/api/ai/conversations", async (_req: Request, res: Response) => {
    try {
      const allConversations = await db.select().from(conversations).orderBy(desc(conversations.createdAt));
      res.json(allConversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  // Get single conversation with messages
  app.get("/api/ai/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      const [conversation] = await db.select().from(conversations).where(eq(conversations.id, id));
      if (!conversation) {
        res.status(404).json({ error: "Conversation not found" });
        return;
      }
      const conversationMessages = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(messages.createdAt);
      res.json({ ...conversation, messages: conversationMessages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  // Create new conversation
  app.post("/api/ai/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const [conversation] = await db.insert(conversations).values({ title: title || "New Chat" }).returning();
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  // Delete conversation
  app.delete("/api/ai/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id as string;
      await db.delete(messages).where(eq(messages.conversationId, id));
      await db.delete(conversations).where(eq(conversations.id, id));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  // Send message and get AI response (streaming)
  app.post("/api/ai/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = req.params.id as string;
      const { content, includeCRMContext } = req.body;

      // Save user message
      await db.insert(messages).values({ conversationId, role: "user", content });

      // Get conversation history for context
      const conversationMessages = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
      
      // Build system prompt with optional CRM context
      let systemPrompt = CRM_SYSTEM_PROMPT;
      if (includeCRMContext) {
        systemPrompt += await getCRMContext();
      }
      
      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ];

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        stream: true,
        max_tokens: 2048,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const chunkContent = chunk.choices[0]?.delta?.content || "";
        if (chunkContent) {
          fullResponse += chunkContent;
          res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
        }
      }

      // Save assistant message
      await db.insert(messages).values({ conversationId, role: "assistant", content: fullResponse });

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to send message" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  // AI Tool: Generate Email/SMS
  app.post("/api/ai/generate-message", async (req: Request, res: Response) => {
    try {
      const { messageType, customerName, purpose, tone, jobContext } = req.body;

      const prompt = `Generate a professional ${messageType} message for a customer.

Customer Name: ${customerName || "Customer"}
Purpose: ${purpose}
Tone: ${tone || "professional and friendly"}
${jobContext ? `Job Context: ${jobContext}` : ""}

Write only the message content, ready to send. Keep it concise and appropriate for ${messageType === "sms" ? "SMS (under 160 characters if possible)" : "email"}.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      const messageContent = response.choices[0]?.message?.content || "";
      res.json({ message: messageContent });
    } catch (error) {
      console.error("Error generating message:", error);
      res.status(500).json({ error: "Failed to generate message" });
    }
  });

  // AI Tool: Generate Quote Description
  app.post("/api/ai/generate-quote", async (req: Request, res: Response) => {
    try {
      const { vehicleInfo, glassType, serviceType, additionalNotes } = req.body;

      const prompt = `Generate a professional quote description for auto glass work.

Vehicle: ${vehicleInfo || "Not specified"}
Glass Type: ${glassType || "Windshield"}
Service Type: ${serviceType || "Replacement"}
Additional Notes: ${additionalNotes || "None"}

Provide a clear, professional description of the work to be performed that can be included in a quote or invoice.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      });

      const description = response.choices[0]?.message?.content || "";
      res.json({ description });
    } catch (error) {
      console.error("Error generating quote:", error);
      res.status(500).json({ error: "Failed to generate quote" });
    }
  });

  // AI Tool: Generate Insurance Claim Description
  app.post("/api/ai/generate-claim-description", async (req: Request, res: Response) => {
    try {
      const { vehicleInfo, glassType, causeOfLoss, dateOfLoss, additionalDetails } = req.body;

      const prompt = `Generate a professional insurance claim description for auto glass damage.

Vehicle: ${vehicleInfo || "Not specified"}
Glass Type: ${glassType || "Windshield"}
Cause of Loss: ${causeOfLoss || "Not specified"}
Date of Loss: ${dateOfLoss || "Not specified"}
Additional Details: ${additionalDetails || "None"}

Write a clear, factual description suitable for an insurance claim. Include relevant details about the damage and circumstances.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
      });

      const description = response.choices[0]?.message?.content || "";
      res.json({ description });
    } catch (error) {
      console.error("Error generating claim description:", error);
      res.status(500).json({ error: "Failed to generate claim description" });
    }
  });

  // AI Tool: Get Follow-up Suggestions
  app.post("/api/ai/suggest-followups", async (req: Request, res: Response) => {
    try {
      const crmContext = await getCRMContext();
      
      const prompt = `Based on the current CRM data, identify jobs that need follow-up attention.

Look for:
1. Leads that haven't been contacted in 24+ hours
2. Quotes that haven't been converted
3. Scheduled jobs approaching their date
4. Jobs with pending payments

${crmContext}

Provide a prioritized list of follow-up actions with brief explanations. Format each suggestion clearly.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      });

      const suggestions = response.choices[0]?.message?.content || "";
      res.json({ suggestions });
    } catch (error) {
      console.error("Error generating follow-up suggestions:", error);
      res.status(500).json({ error: "Failed to generate suggestions" });
    }
  });

  // AI Tool: Generate Job Summary
  app.post("/api/ai/summarize-job", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.body;
      
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      if (!job) {
        res.status(404).json({ error: "Job not found" });
        return;
      }

      const vehicles = (job.vehicles as any[]) || [];
      const vehicleDetails = vehicles.map((v: any) => {
        const parts = (v.parts || []).map((p: any) => `${p.glassType} (${p.serviceType}): $${p.partPrice || 0}`).join(', ');
        return `${v.year || ''} ${v.make || ''} ${v.model || ''} - ${parts || 'No parts'}`;
      }).join('\n');

      const prompt = `Summarize this auto glass job in a clear, concise format:

Job Number: ${job.jobNumber}
Customer: ${job.firstName} ${job.lastName}
Phone: ${job.phone}
Email: ${job.email || 'N/A'}
Address: ${job.streetAddress || ''} ${job.city || ''} ${job.state || ''} ${job.zipCode || ''}
Pipeline Stage: ${job.pipelineStage}
Vehicles & Parts:
${vehicleDetails}

Total Due: $${job.totalDue || 0}
Amount Paid: $${job.amountPaid || 0}
Balance Due: $${job.balanceDue || 0}
Payment Status: ${job.paymentStatus || 'pending'}

Install Date: ${job.installDate || 'Not scheduled'}
Install Notes: ${job.installNotes || 'None'}

Provide a brief executive summary highlighting key information and any items needing attention.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
      });

      const summary = response.choices[0]?.message?.content || "";
      res.json({ summary });
    } catch (error) {
      console.error("Error generating job summary:", error);
      res.status(500).json({ error: "Failed to generate summary" });
    }
  });
}
