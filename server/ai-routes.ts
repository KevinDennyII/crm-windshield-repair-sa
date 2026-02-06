import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { conversations, messages, jobs, activityLogs, type Conversation, type Message } from "@shared/schema";
import { eq, desc, sql, gte, and, lte, count } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
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

  // ========== COMMUNICATION INTELLIGENCE ==========

  // Smart Reply Suggestions
  app.post("/api/ai/smart-reply", async (req: Request, res: Response) => {
    try {
      const { originalMessage, context } = req.body;

      const prompt = `Generate 3 professional reply suggestions for this customer message.

Original Message from Customer:
"${originalMessage}"

${context ? `Context: ${context}` : ""}

Provide 3 different reply options:
1. A friendly, conversational response
2. A formal, professional response
3. A brief, efficient response

Format each suggestion clearly numbered.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      });

      res.json({ suggestions: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error generating smart replies:", error);
      res.status(500).json({ error: "Failed to generate reply suggestions" });
    }
  });

  // Conversation Summary
  app.post("/api/ai/summarize-conversation", async (req: Request, res: Response) => {
    try {
      const { messages: conversationMessages } = req.body;

      const prompt = `Summarize this email/SMS conversation thread concisely.

Conversation:
${conversationMessages}

Provide:
1. A brief summary (2-3 sentences)
2. Key points discussed
3. Any action items or follow-ups needed
4. Customer sentiment (positive/neutral/negative)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      res.json({ summary: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error summarizing conversation:", error);
      res.status(500).json({ error: "Failed to summarize conversation" });
    }
  });

  // Sentiment Analysis
  app.post("/api/ai/analyze-sentiment", async (req: Request, res: Response) => {
    try {
      const { text } = req.body;

      const prompt = `Analyze the sentiment and urgency of this customer message.

Message:
"${text}"

Provide analysis in this exact JSON format:
{
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "urgency": "low" | "medium" | "high" | "critical",
  "emotions": ["list", "of", "detected", "emotions"],
  "recommendedAction": "brief suggestion for how to respond",
  "summary": "one sentence summary of customer's mood and intent"
}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a sentiment analysis expert. Respond only with valid JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      });

      const content = response.choices[0]?.message?.content || "{}";
      try {
        const analysis = JSON.parse(content.replace(/```json\n?|\n?```/g, ""));
        res.json(analysis);
      } catch {
        res.json({ sentiment: "neutral", urgency: "medium", summary: content });
      }
    } catch (error) {
      console.error("Error analyzing sentiment:", error);
      res.status(500).json({ error: "Failed to analyze sentiment" });
    }
  });

  // Spanish Translation
  app.post("/api/ai/translate", async (req: Request, res: Response) => {
    try {
      const { text, targetLanguage } = req.body;
      const target = targetLanguage || "Spanish";

      const prompt = `Translate this message to ${target}. Maintain the professional but friendly tone appropriate for customer communication in an auto glass business.

Original Message:
"${text}"

Provide only the translation, nothing else.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are a professional translator specializing in business communications." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      res.json({ translation: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error translating:", error);
      res.status(500).json({ error: "Failed to translate" });
    }
  });

  // ========== TECHNICIAN TOOLS ==========

  // Photo Damage Assessment (Vision AI)
  app.post("/api/ai/assess-damage", async (req: Request, res: Response) => {
    try {
      const { imageBase64, imageUrl } = req.body;

      const imageContent: OpenAI.ChatCompletionContentPart = imageUrl
        ? { type: "image_url", image_url: { url: imageUrl } }
        : { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert auto glass damage assessor. Analyze photos to identify:
- Type of damage (chip, crack, bullseye, star break, combination, etc.)
- Location on the glass
- Size estimate
- Repair recommendation (repair vs. replace)
- Urgency level`
          },
          {
            role: "user",
            content: [
              imageContent,
              {
                type: "text",
                text: `Analyze this auto glass damage photo. Provide:
1. Damage Type
2. Location (driver's side, passenger's side, center, edge)
3. Estimated Size
4. Recommendation: Repair or Replace
5. Urgency: Low/Medium/High
6. Additional Notes

Format your response clearly for a technician.`
              }
            ]
          }
        ],
        max_tokens: 500,
      });

      res.json({ assessment: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error assessing damage:", error);
      res.status(500).json({ error: "Failed to assess damage from photo" });
    }
  });

  // Installation Guide Lookup
  app.post("/api/ai/installation-guide", async (req: Request, res: Response) => {
    try {
      const { year, make, model, glassType } = req.body;

      const prompt = `Provide installation guidance for:

Vehicle: ${year} ${make} ${model}
Glass Type: ${glassType}

Include:
1. Pre-installation checklist
2. Special tools or materials needed
3. Key installation steps
4. Common challenges for this vehicle
5. ADAS calibration requirements (if applicable)
6. Cure time recommendations
7. Post-installation verification steps

Note: This is general guidance. Always refer to manufacturer specifications and use proper safety equipment.`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an experienced auto glass installation expert with knowledge of various vehicle makes and models." },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
      });

      res.json({ guide: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error getting installation guide:", error);
      res.status(500).json({ error: "Failed to get installation guide" });
    }
  });

  // Safety Checklist Verification (Vision AI)
  app.post("/api/ai/verify-completion", async (req: Request, res: Response) => {
    try {
      const { imageBase64, imageUrl, jobType } = req.body;

      const imageContent: OpenAI.ChatCompletionContentPart = imageUrl
        ? { type: "image_url", image_url: { url: imageUrl } }
        : { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a quality control inspector for auto glass installations. Evaluate completion photos for:
- Proper seal and adhesive application
- Clean installation (no debris, fingerprints)
- Correct glass positioning
- Molding/trim properly installed
- No visible gaps or issues`
          },
          {
            role: "user",
            content: [
              imageContent,
              {
                type: "text",
                text: `Review this ${jobType || "auto glass installation"} completion photo.

Verify Quality Checklist:
✓ Glass properly seated
✓ Adhesive/seal not visible
✓ Trim/moldings in place
✓ No visible damage or debris
✓ Proper alignment

Provide:
1. Overall Quality Score (1-10)
2. Checklist Items Passed/Failed
3. Any Issues Detected
4. Recommendations (if any)`
              }
            ]
          }
        ],
        max_tokens: 500,
      });

      res.json({ verification: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error verifying completion:", error);
      res.status(500).json({ error: "Failed to verify completion photo" });
    }
  });

  // Photo Analysis - Repair vs Replace
  app.post("/api/ai/analyze-photo", async (req: Request, res: Response) => {
    try {
      const { imageBase64, imageUrl } = req.body;

      const imageContent: OpenAI.ChatCompletionContentPart = imageUrl
        ? { type: "image_url", image_url: { url: imageUrl } }
        : { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } };

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are an auto glass repair expert. Analyze damage photos to determine if repair is possible or replacement is needed."
          },
          {
            role: "user",
            content: [
              imageContent,
              {
                type: "text",
                text: `Analyze this windshield/glass damage and determine:

1. REPAIR or REPLACE recommendation
2. Confidence level (High/Medium/Low)
3. Reasoning for your decision
4. If repairable:
   - Estimated repair time
   - Success rate expectation
5. If replacement needed:
   - Why repair isn't viable
   - Any special considerations

Consider: damage size, location, crack pattern, and visibility impact.`
              }
            ]
          }
        ],
        max_tokens: 500,
      });

      res.json({ analysis: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error analyzing photo:", error);
      res.status(500).json({ error: "Failed to analyze photo" });
    }
  });

  // ========== BUSINESS INTELLIGENCE ==========

  // Win/Loss Analysis
  app.post("/api/ai/win-loss-analysis", async (req: Request, res: Response) => {
    try {
      const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(100);
      
      const wonJobs = allJobs.filter(j => j.pipelineStage === "paid_completed");
      const lostJobs = allJobs.filter(j => j.pipelineStage === "lost_opportunity");
      const quoteJobs = allJobs.filter(j => j.pipelineStage === "quote");

      const jobData = allJobs.map(j => ({
        stage: j.pipelineStage,
        total: j.totalDue,
        customerType: j.customerType,
        source: j.leadSource,
        city: j.city,
      }));

      const prompt = `Analyze this auto glass business win/loss data and provide insights.

Total Jobs Analyzed: ${allJobs.length}
Won (Paid/Completed): ${wonJobs.length}
Lost: ${lostJobs.length}
Still in Quote Stage: ${quoteJobs.length}
Conversion Rate: ${allJobs.length > 0 ? ((wonJobs.length / allJobs.length) * 100).toFixed(1) : 0}%

Job Data Sample:
${JSON.stringify(jobData.slice(0, 20), null, 2)}

Provide:
1. Win/Loss Summary
2. Key patterns in won vs lost jobs
3. Customer type analysis
4. Geographic insights
5. Recommendations to improve conversion
6. Common reasons for lost opportunities (inferred from data patterns)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 800,
      });

      res.json({ 
        analysis: response.choices[0]?.message?.content || "",
        stats: {
          total: allJobs.length,
          won: wonJobs.length,
          lost: lostJobs.length,
          inQuote: quoteJobs.length,
          conversionRate: allJobs.length > 0 ? ((wonJobs.length / allJobs.length) * 100).toFixed(1) : "0"
        }
      });
    } catch (error) {
      console.error("Error analyzing win/loss:", error);
      res.status(500).json({ error: "Failed to analyze win/loss data" });
    }
  });

  // Revenue Forecasting
  app.post("/api/ai/revenue-forecast", async (req: Request, res: Response) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentJobs = await db.select().from(jobs)
        .where(gte(jobs.createdAt, thirtyDaysAgo))
        .orderBy(desc(jobs.createdAt));

      const completedJobs = recentJobs.filter(j => j.pipelineStage === "paid_completed");
      const scheduledJobs = recentJobs.filter(j => j.pipelineStage === "scheduled");
      const quoteJobs = recentJobs.filter(j => j.pipelineStage === "quote");

      const totalCompleted = completedJobs.reduce((sum, j) => sum + (Number(j.totalDue) || 0), 0);
      const scheduledValue = scheduledJobs.reduce((sum, j) => sum + (Number(j.totalDue) || 0), 0);
      const quoteValue = quoteJobs.reduce((sum, j) => sum + (Number(j.totalDue) || 0), 0);

      const prompt = `Analyze this revenue data and provide a forecast.

Last 30 Days Performance:
- Completed Jobs: ${completedJobs.length} ($${totalCompleted.toFixed(2)})
- Scheduled Jobs: ${scheduledJobs.length} ($${scheduledValue.toFixed(2)})
- In Quote Stage: ${quoteJobs.length} ($${quoteValue.toFixed(2)})
- Total Pipeline Value: $${(scheduledValue + quoteValue).toFixed(2)}

Daily Average: $${(totalCompleted / 30).toFixed(2)}
Weekly Average: $${(totalCompleted / 4.3).toFixed(2)}

Provide:
1. Weekly Revenue Forecast (next 4 weeks)
2. Monthly Revenue Projection
3. Pipeline Conversion Estimate (assuming 60% quote conversion, 95% scheduled completion)
4. Trend Analysis
5. Recommendations to increase revenue`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      });

      res.json({ 
        forecast: response.choices[0]?.message?.content || "",
        data: {
          completedRevenue: totalCompleted,
          scheduledValue,
          quoteValue,
          pipelineTotal: scheduledValue + quoteValue,
          dailyAverage: totalCompleted / 30,
          weeklyAverage: totalCompleted / 4.3
        }
      });
    } catch (error) {
      console.error("Error forecasting revenue:", error);
      res.status(500).json({ error: "Failed to generate revenue forecast" });
    }
  });

  // Customer Churn Prediction
  app.post("/api/ai/churn-prediction", async (req: Request, res: Response) => {
    try {
      const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt));
      
      // Group jobs by customer (phone or email)
      const customerMap = new Map<string, any[]>();
      allJobs.forEach(job => {
        const key = job.phone || job.email || "";
        if (key) {
          if (!customerMap.has(key)) customerMap.set(key, []);
          customerMap.get(key)!.push(job);
        }
      });

      // Analyze repeat customers
      const customers = Array.from(customerMap.entries()).map(([key, customerJobs]) => {
        const sorted = customerJobs.sort((a, b) => 
          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
        );
        const lastJob = sorted[0];
        const daysSinceLastJob = Math.floor(
          (Date.now() - new Date(lastJob.createdAt!).getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          identifier: key.slice(0, 6) + "***",
          name: `${lastJob.firstName} ${lastJob.lastName}`,
          totalJobs: customerJobs.length,
          totalSpent: customerJobs.reduce((sum, j) => sum + (Number(j.totalDue) || 0), 0),
          daysSinceLastJob,
          lastStage: lastJob.pipelineStage,
        };
      });

      const prompt = `Analyze customer data to predict churn risk.

Customer Summary (${customers.length} unique customers):
${JSON.stringify(customers.slice(0, 30), null, 2)}

Identify:
1. High-risk churn customers (haven't returned in 6+ months)
2. At-risk customers (3-6 months since last job)
3. Loyal customers (repeat within 3 months)
4. Win-back opportunities
5. Recommended retention actions for each risk level`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 700,
      });

      res.json({ 
        prediction: response.choices[0]?.message?.content || "",
        stats: {
          totalCustomers: customers.length,
          repeatCustomers: customers.filter(c => c.totalJobs > 1).length,
        }
      });
    } catch (error) {
      console.error("Error predicting churn:", error);
      res.status(500).json({ error: "Failed to predict customer churn" });
    }
  });

  // Best Time to Contact
  app.post("/api/ai/best-contact-time", async (req: Request, res: Response) => {
    try {
      const { customerId, phone, email } = req.body;
      
      // Get customer's job history and activity
      let customerJobs: any[] = [];
      if (phone) {
        customerJobs = await db.select().from(jobs).where(eq(jobs.phone, phone));
      } else if (email) {
        customerJobs = await db.select().from(jobs).where(eq(jobs.email, email));
      }

      const prompt = `Based on this customer's history, suggest the best time to contact them.

Customer Jobs: ${customerJobs.length}
Job Creation Times: ${customerJobs.map(j => new Date(j.createdAt!).toLocaleString()).join(', ')}

General Best Practices for San Antonio, TX auto glass customers:
- Most responsive: Weekday mornings (9-11 AM)
- Avoid: Monday mornings (busy), Friday afternoons
- Working professionals: Lunch hours (12-1 PM) or after 5 PM
- Commercial/Fleet: Early morning (7-8 AM)

Provide:
1. Recommended contact time
2. Day of week preference
3. Communication method preference (call vs text)
4. Reasoning based on patterns`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      });

      res.json({ recommendation: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error determining best contact time:", error);
      res.status(500).json({ error: "Failed to determine best contact time" });
    }
  });

  // Competitor Price Monitoring (Manual Input Analysis)
  app.post("/api/ai/competitor-analysis", async (req: Request, res: Response) => {
    try {
      const { competitorData } = req.body;

      // Get our pricing data
      const recentJobs = await db.select().from(jobs)
        .where(eq(jobs.pipelineStage, "paid_completed"))
        .limit(50);

      const avgPrices: Record<string, number[]> = {};
      recentJobs.forEach(job => {
        const vehicles = (job.vehicles as any[]) || [];
        vehicles.forEach((v: any) => {
          (v.parts || []).forEach((p: any) => {
            const key = `${p.glassType}-${p.serviceType}`;
            if (!avgPrices[key]) avgPrices[key] = [];
            if (p.partPrice) avgPrices[key].push(Number(p.partPrice));
          });
        });
      });

      const ourPricing = Object.entries(avgPrices).map(([key, prices]) => ({
        type: key,
        avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
        count: prices.length,
      }));

      const prompt = `Analyze competitor pricing vs our pricing.

Our Average Pricing:
${JSON.stringify(ourPricing, null, 2)}

Competitor Data Provided:
${competitorData || "No competitor data provided. Please analyze general market positioning."}

Provide:
1. Price comparison summary
2. Our competitive position (higher/lower/comparable)
3. Services where we're competitive
4. Services where we might be losing business on price
5. Pricing strategy recommendations`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      });

      res.json({ 
        analysis: response.choices[0]?.message?.content || "",
        ourPricing
      });
    } catch (error) {
      console.error("Error analyzing competitors:", error);
      res.status(500).json({ error: "Failed to analyze competitor data" });
    }
  });

  // ========== OPERATIONS ==========

  // Smart Scheduling Suggestions
  app.post("/api/ai/smart-schedule", async (req: Request, res: Response) => {
    try {
      const { jobId, technicianLocation, customerAddress, jobComplexity } = req.body;

      const scheduledJobs = await db.select().from(jobs)
        .where(eq(jobs.pipelineStage, "scheduled"))
        .orderBy(jobs.installDate);

      const prompt = `Suggest optimal scheduling for this job.

Job Details:
- Job ID: ${jobId || "New Job"}
- Customer Address: ${customerAddress || "Not specified"}
- Job Complexity: ${jobComplexity || "Standard"}
- Technician Current Location: ${technicianLocation || "San Antonio downtown"}

Currently Scheduled Jobs:
${scheduledJobs.slice(0, 10).map(j => 
  `- ${j.installDate}: ${j.firstName} ${j.lastName} at ${j.streetAddress}, ${j.city}`
).join('\n')}

Consider:
1. Travel time between jobs
2. Job complexity/duration
3. Customer preferences (morning/afternoon)
4. Avoid back-to-back complex jobs
5. Group jobs by geographic area

Suggest:
1. Best appointment slots (3 options)
2. Reasoning for each option
3. Travel time estimates
4. Any scheduling conflicts to avoid`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      res.json({ suggestions: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error generating schedule suggestions:", error);
      res.status(500).json({ error: "Failed to generate scheduling suggestions" });
    }
  });

  // Parts Prediction
  app.post("/api/ai/predict-parts", async (req: Request, res: Response) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const recentJobs = await db.select().from(jobs)
        .where(and(
          gte(jobs.createdAt, thirtyDaysAgo),
          eq(jobs.pipelineStage, "paid_completed")
        ));

      // Count parts used
      const partCounts: Record<string, number> = {};
      const vehicleParts: Record<string, number> = {};

      recentJobs.forEach(job => {
        const vehicles = (job.vehicles as any[]) || [];
        vehicles.forEach((v: any) => {
          const vehicleKey = `${v.year} ${v.make} ${v.model}`;
          (v.parts || []).forEach((p: any) => {
            const partKey = `${p.glassType}-${p.serviceType}`;
            partCounts[partKey] = (partCounts[partKey] || 0) + 1;
            
            const fullKey = `${vehicleKey}|${p.glassType}`;
            vehicleParts[fullKey] = (vehicleParts[fullKey] || 0) + 1;
          });
        });
      });

      const prompt = `Predict parts inventory needs based on recent job history.

Last 30 Days Parts Usage:
${Object.entries(partCounts).map(([part, count]) => `- ${part}: ${count} jobs`).join('\n')}

Top Vehicle/Part Combinations:
${Object.entries(vehicleParts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .map(([combo, count]) => `- ${combo}: ${count}`)
  .join('\n')}

Provide:
1. Recommended stock levels for next 30 days
2. Fast-moving parts to prioritize
3. Seasonal considerations
4. Common vehicle models to stock for
5. Low-demand parts to reduce inventory`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      });

      res.json({ 
        predictions: response.choices[0]?.message?.content || "",
        usageData: partCounts
      });
    } catch (error) {
      console.error("Error predicting parts:", error);
      res.status(500).json({ error: "Failed to predict parts needs" });
    }
  });

  // Job Time Estimation
  app.post("/api/ai/estimate-time", async (req: Request, res: Response) => {
    try {
      const { year, make, model, glassType, serviceType, additionalFactors } = req.body;

      const prompt = `Estimate job completion time for this auto glass work.

Vehicle: ${year} ${make} ${model}
Glass Type: ${glassType}
Service Type: ${serviceType}
Additional Factors: ${additionalFactors || "None"}

Consider:
- Glass removal difficulty
- ADAS calibration needs
- Adhesive cure time
- Vehicle access complexity
- Weather/temperature impact
- Common issues with this vehicle

Provide:
1. Estimated Active Work Time
2. Total Time Including Cure (if applicable)
3. Complexity Rating (Simple/Moderate/Complex)
4. Factors that could add time
5. Recommended technician skill level`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: "You are an experienced auto glass installation manager with knowledge of job time requirements." },
          { role: "user", content: prompt },
        ],
        max_tokens: 400,
      });

      res.json({ estimate: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error estimating time:", error);
      res.status(500).json({ error: "Failed to estimate job time" });
    }
  });

  // ========== SALES & MARKETING ==========

  // Upsell Suggestions
  app.post("/api/ai/upsell-suggestions", async (req: Request, res: Response) => {
    try {
      const { jobId, currentServices } = req.body;

      let jobContext = "";
      if (jobId) {
        const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
        if (job) {
          const vehicles = (job.vehicles as any[]) || [];
          jobContext = `Current Job: ${job.firstName} ${job.lastName}
Vehicles: ${vehicles.map((v: any) => `${v.year} ${v.make} ${v.model}`).join(', ')}
Current Services: ${vehicles.flatMap((v: any) => 
  (v.parts || []).map((p: any) => `${p.glassType} ${p.serviceType}`)
).join(', ')}`;
        }
      }

      const prompt = `Suggest relevant upsell opportunities for this auto glass customer.

${jobContext || `Current Services: ${currentServices || "Windshield replacement"}`}

Consider these upsell options:
1. Chip repair for other small damages
2. ADAS camera calibration (if applicable)
3. Rain sensor replacement
4. Wiper blade replacement
5. Windshield treatment (water repellent)
6. Interior cleaning service
7. Molding/trim upgrades
8. Extended warranty

Provide:
1. Top 3 relevant upsell recommendations
2. Suggested pricing range
3. How to present each option to customer
4. Estimated additional revenue`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      res.json({ suggestions: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error generating upsell suggestions:", error);
      res.status(500).json({ error: "Failed to generate upsell suggestions" });
    }
  });

  // Review Response Generator
  app.post("/api/ai/generate-review-response", async (req: Request, res: Response) => {
    try {
      const { reviewText, starRating, platform, customerName } = req.body;

      const prompt = `Generate a professional response to this customer review.

Platform: ${platform || "Google"}
Star Rating: ${starRating || "N/A"}/5
Customer Name: ${customerName || "Valued Customer"}
Review Text:
"${reviewText}"

Guidelines:
- Thank the customer personally
- Address specific points they mentioned
- If negative, apologize and offer to make it right
- If positive, express genuine appreciation
- Keep professional but warm tone
- Include invitation to return
- Mention Windshield Repair SA by name

Provide a ready-to-post response (150-200 words max).`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      });

      res.json({ response: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error generating review response:", error);
      res.status(500).json({ error: "Failed to generate review response" });
    }
  });

  // ========== QUALITY & TRAINING ==========

  // Customer Satisfaction Prediction
  app.post("/api/ai/predict-satisfaction", async (req: Request, res: Response) => {
    try {
      const { jobId } = req.body;

      let jobData = "";
      if (jobId) {
        const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
        if (job) {
          jobData = `
Job Number: ${job.jobNumber}
Customer: ${job.firstName} ${job.lastName}
Stage: ${job.pipelineStage}
Total: $${job.totalDue}
Payment Status: ${job.paymentStatus}
Install Date: ${job.installDate}
Notes: ${job.installNotes || "None"}`;
        }
      }

      const prompt = `Predict customer satisfaction for this job and identify risks.

${jobData || "No specific job data provided."}

Analyze satisfaction risk factors:
1. Price sensitivity
2. Communication frequency
3. Wait time for appointment
4. Complexity of work
5. Payment method concerns
6. Previous issues (if any)

Provide:
1. Predicted Satisfaction Score (1-10)
2. Risk Level (Low/Medium/High)
3. Key risk factors identified
4. Proactive actions to ensure satisfaction
5. Post-job follow-up recommendations`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
      });

      res.json({ prediction: response.choices[0]?.message?.content || "" });
    } catch (error) {
      console.error("Error predicting satisfaction:", error);
      res.status(500).json({ error: "Failed to predict satisfaction" });
    }
  });

  // CSR Performance Coaching
  app.post("/api/ai/csr-coaching", async (req: Request, res: Response) => {
    try {
      const { csrId, dateRange } = req.body;
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (dateRange || 7));

      // Get activity logs for the CSR
      let activityQuery = db.select().from(activityLogs)
        .where(and(
          gte(activityLogs.createdAt, startDate),
          lte(activityLogs.createdAt, endDate)
        ));
      
      if (csrId) {
        activityQuery = db.select().from(activityLogs)
          .where(and(
            eq(activityLogs.userId, csrId),
            gte(activityLogs.createdAt, startDate),
            lte(activityLogs.createdAt, endDate)
          ));
      }

      const activities = await activityQuery;

      // Summarize activities
      const activitySummary: Record<string, number> = {};
      activities.forEach(a => {
        activitySummary[a.actionType] = (activitySummary[a.actionType] || 0) + 1;
      });

      const prompt = `Provide performance coaching insights for this CSR based on their activity.

Activity Summary (Last ${dateRange || 7} Days):
${Object.entries(activitySummary).map(([action, count]) => `- ${action}: ${count}`).join('\n')}

Total Activities: ${activities.length}

Analyze:
1. Activity Level (Above/At/Below expectations)
2. Communication balance (emails vs SMS vs calls)
3. Job conversion performance
4. Response time patterns
5. Areas of strength
6. Areas for improvement

Provide:
1. Overall Performance Rating
2. Top 3 strengths
3. Top 3 areas for improvement
4. Specific coaching recommendations
5. Training suggestions`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: CRM_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 600,
      });

      res.json({ 
        coaching: response.choices[0]?.message?.content || "",
        activitySummary,
        totalActivities: activities.length
      });
    } catch (error) {
      console.error("Error generating coaching:", error);
      res.status(500).json({ error: "Failed to generate coaching insights" });
    }
  });

  // ========== CALL TRANSCRIPTION ==========

  // Transcribe Phone Call (placeholder - would need Twilio voice recording)
  app.post("/api/ai/transcribe-call", async (req: Request, res: Response) => {
    try {
      const { audioUrl, audioBase64 } = req.body;

      if (!audioUrl && !audioBase64) {
        res.status(400).json({ 
          error: "Audio required",
          note: "Call transcription requires Twilio voice recording integration. Please provide audio URL or base64 data."
        });
        return;
      }

      // For now, return a placeholder until Twilio voice recording is set up
      res.json({ 
        transcription: "Call transcription feature requires Twilio voice recording to be configured.",
        summary: "Once configured, this will automatically transcribe and summarize customer calls.",
        status: "pending_configuration"
      });
    } catch (error) {
      console.error("Error transcribing call:", error);
      res.status(500).json({ error: "Failed to transcribe call" });
    }
  });
}
