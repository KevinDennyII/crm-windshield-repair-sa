import type { Express, Request, Response } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { jobs } from "@shared/schema";
import { sql, desc, eq, and, isNotNull } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const AI_CMO_SYSTEM_PROMPT = `Role: You are the Chief Marketing Officer (CMO) for Windshield Repair SA (www.windshieldrepairsa.com), a premier mobile auto glass company in San Antonio, TX. Your goal is to maximize high-intent leads and dominate the local market.

Business Core:
- Services: Rock chip repairs (under 15 mins) starting at $85; full windshield replacements starting at $100 + parts.
- Service Area: All of San Antonio, including Shavano Park, Alamo Heights, Helotes, Stone Oak, Leon Valley, Schertz, and surrounding areas.
- Unique Value Prop (UVP): Mobile service (we come to you), Lifetime Warranty on replacements, and same-day service availability.
- Phone: (210) 940-8021
- Website: www.windshieldrepairsa.com

Your Strategic Objectives:
1. Local SEO Dominance: Ensure the Google Business Profile is 100% optimized with high-quality photos, updated hours, and "Service Area" tags for San Antonio zip codes.
2. High-Intent Ad Management: Monitor Google Ads for keywords like "windshield repair San Antonio" or "emergency mobile glass".
3. Reputation Management: Drive a 5-star review culture by drafting SMS/Email follow-ups for every completed job in the CRM.
4. B2B Fleet Growth: Identify local San Antonio businesses with fleets (HVAC, Plumbing, Delivery) and draft tailored partnership proposals.

Operational Guidelines:
- Tone: Professional, urgent, and local. You understand that a broken windshield is an emergency for our customers.
- Data-Driven: When asked for a report, prioritize Customer Acquisition Cost (CAC) (target below $85) and Average Revenue Per Job (ARPJ).
- Content Strategy: Create platform-specific content (TikTok "satisfying" chip repairs, X/Twitter real-time mobile unit updates, Facebook local community safety tips).
- Always provide actionable, copy-paste-ready content when generating ads, social posts, emails, or SMS.
- Format responses clearly with headers, bullet points, and sections for easy reading.
- When writing Google Ads copy, always respect character limits (headlines: 30 chars, descriptions: 90 chars).
- When drafting SMS, keep messages under 160 characters.
- Always include a clear call-to-action in marketing content.

San Antonio Market Knowledge:
- Key zip codes: 78201-78266, covering all major San Antonio areas
- Major neighborhoods: Stone Oak, Alamo Heights, Shavano Park, Helotes, Leon Valley, Medical Center, Downtown, Southtown, Pearl District
- Competitor landscape: Safelite, local shops on Bandera Rd and Fredericksburg Rd
- Peak seasons: Hail season (spring), highway construction periods
- Insurance partners: State Farm, USAA (headquartered in SA), Geico, Progressive`;

async function getMarketingCRMContext(): Promise<string> {
  try {
    const totalJobsResult = await db.select({ count: sql<number>`count(*)` }).from(jobs);
    const totalJobs = Number(totalJobsResult[0]?.count || 0);

    const completedJobsResult = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.pipelineStage, "paid_completed"));
    const completedJobs = Number(completedJobsResult[0]?.count || 0);

    const revenueResult = await db.select({ total: sql<number>`coalesce(sum(cast(total_due as numeric)), 0)` }).from(jobs).where(eq(jobs.pipelineStage, "paid_completed"));
    const totalRevenue = Number(revenueResult[0]?.total || 0);

    const leadSourceResult = await db.select({
      source: jobs.leadSource,
      count: sql<number>`count(*)`,
    }).from(jobs).where(isNotNull(jobs.leadSource)).groupBy(jobs.leadSource);

    const leadSourceBreakdown = leadSourceResult.map(
      (r: { source: string | null; count: number }) => `  - ${r.source}: ${r.count} jobs`
    ).join("\n");

    const recentJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10);
    const recentJobsSummary = recentJobs.map((job: any) => {
      const vehicles = (job.vehicles as any[]) || [];
      const vehicleInfo = vehicles.map((v: any) => `${v.year || ""} ${v.make || ""} ${v.model || ""}`).join(", ");
      return `  - Job #${job.jobNumber}: ${job.firstName} ${job.lastName}, Stage: ${job.pipelineStage}, Total: $${job.totalDue || 0}, Source: ${job.leadSource || "untagged"}, Vehicle: ${vehicleInfo || "N/A"}`;
    }).join("\n");

    const avgJobValue = completedJobs > 0 ? (totalRevenue / completedJobs).toFixed(2) : "0";
    const conversionRate = totalJobs > 0 ? ((completedJobs / totalJobs) * 100).toFixed(1) : "0";

    return `

LIVE CRM DATA:
- Total Jobs: ${totalJobs}
- Completed Jobs: ${completedJobs}
- Total Revenue: $${totalRevenue.toLocaleString()}
- Average Job Value: $${avgJobValue}
- Conversion Rate: ${conversionRate}%

Lead Source Breakdown:
${leadSourceBreakdown || "  No lead source data tagged yet."}

Recent Jobs (Last 10):
${recentJobsSummary || "  No recent jobs."}`;
  } catch (error) {
    console.error("[Marketing] Error fetching CRM context:", error);
    return "\n\nCRM Data: Unable to fetch at this time.";
  }
}

export function registerMarketingRoutes(app: Express): void {
  app.post("/api/marketing/chat", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { message, history = [] } = req.body;

      if (!message || typeof message !== "string") {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const crmContext = await getMarketingCRMContext();
      const systemPrompt = AI_CMO_SYSTEM_PROMPT + crmContext;

      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: chatMessages,
        stream: true,
        max_tokens: 4096,
      });

      let fullResponse = "";

      for await (const chunk of stream) {
        const chunkContent = chunk.choices[0]?.delta?.content || "";
        if (chunkContent) {
          fullResponse += chunkContent;
          res.write(`data: ${JSON.stringify({ content: chunkContent })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error("[Marketing] Chat error:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ error: "Failed to generate response" });
      }
    }
  });

  app.get("/api/marketing/lead-stats", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const LEAD_SOURCE_LABELS: Record<string, string> = {
        google_ads: "Google Ads",
        referral: "Referral",
        dealer: "Dealer",
        repeat: "Repeat Customer",
        subcontractor: "Subcontractor",
        facebook: "Facebook",
        website: "Website",
        phone: "Phone Call",
        walk_in: "Walk-in",
        insurance: "Insurance",
        fleet: "Fleet",
      };

      const result = await db.select({
        source: jobs.leadSource,
        count: sql<number>`count(*)`,
      }).from(jobs).where(isNotNull(jobs.leadSource)).groupBy(jobs.leadSource).orderBy(sql`count(*) desc`);

      const stats = result.map((r: { source: string | null; count: number }) => ({
        source: r.source || "unknown",
        count: Number(r.count),
        label: LEAD_SOURCE_LABELS[r.source || ""] || r.source || "Unknown",
      }));

      res.json(stats);
    } catch (error) {
      console.error("[Marketing] Lead stats error:", error);
      res.status(500).json({ error: "Failed to fetch lead stats" });
    }
  });

  app.get("/api/marketing/stats", isAuthenticated, async (_req: Request, res: Response) => {
    try {
      const totalJobsResult = await db.select({ count: sql<number>`count(*)` }).from(jobs);
      const totalJobs = Number(totalJobsResult[0]?.count || 0);

      const completedJobsResult = await db.select({ count: sql<number>`count(*)` }).from(jobs).where(eq(jobs.pipelineStage, "paid_completed"));
      const completedJobs = Number(completedJobsResult[0]?.count || 0);

      const revenueResult = await db.select({ total: sql<number>`coalesce(sum(cast(total_due as numeric)), 0)` }).from(jobs).where(eq(jobs.pipelineStage, "paid_completed"));
      const totalRevenue = Number(revenueResult[0]?.total || 0);

      const avgJobValue = completedJobs > 0 ? totalRevenue / completedJobs : 0;
      const conversionRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

      res.json({
        totalJobs,
        totalRevenue,
        avgJobValue,
        conversionRate,
      });
    } catch (error) {
      console.error("[Marketing] Stats error:", error);
      res.status(500).json({ error: "Failed to fetch marketing stats" });
    }
  });
}
