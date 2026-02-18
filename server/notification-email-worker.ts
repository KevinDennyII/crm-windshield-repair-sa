import { db } from "./db";
import { jobs, phoneCalls, activityLogs, scheduledTasks } from "@shared/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { getUncachableGmailClient, sendReply, invalidateGmailTokenCache } from "./gmail";

const NOTIFICATION_EMAIL = "wrsanotifications@gmail.com";
const SUMMARY_INTERVAL_MS = 20 * 60 * 1000;
const FOLLOWUP_INTERVAL_MS = 5 * 60 * 1000;
const BUSINESS_HOUR_START = 8;
const BUSINESS_HOUR_END = 20;
const TIMEZONE = "America/Chicago";

let lastSummaryThreadId: string | null = null;
let lastSummarySentAt: Date | null = null;
let awaitingReply = false;
let followUpTimer: ReturnType<typeof setInterval> | null = null;
let lastNotificationSnapshot: string = "";
let consecutiveAuthFailures = 0;
const MAX_AUTH_FAILURES = 3;

function getCTHour(): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour: "numeric",
    hour12: false,
  });
  return parseInt(formatter.format(new Date()), 10);
}

function isBusinessHours(): boolean {
  const hour = getCTHour();
  return hour >= BUSINESS_HOUR_START && hour < BUSINESS_HOUR_END;
}

function formatTime(date: Date | string | null): string {
  if (!date) return "N/A";
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function collectNotifications(): Promise<{
  missedCalls: any[];
  newLeads: any[];
  recentSms: any[];
  recentEmails: any[];
  pendingFollowUps: any[];
  totalCount: number;
}> {
  const sinceTime = lastSummarySentAt || new Date(Date.now() - SUMMARY_INTERVAL_MS);

  const missedCalls = await db
    .select({
      id: phoneCalls.id,
      fromNumber: phoneCalls.fromNumber,
      contactName: phoneCalls.contactName,
      startedAt: phoneCalls.startedAt,
    })
    .from(phoneCalls)
    .where(and(eq(phoneCalls.status, "ringing"), gte(phoneCalls.startedAt, sinceTime)))
    .orderBy(desc(phoneCalls.startedAt))
    .limit(20);

  const newLeads = await db
    .select({
      id: jobs.id,
      jobNumber: jobs.jobNumber,
      firstName: jobs.firstName,
      lastName: jobs.lastName,
      phone: jobs.phone,
      createdAt: jobs.createdAt,
    })
    .from(jobs)
    .where(and(eq(jobs.pipelineStage, "new_lead"), gte(jobs.createdAt, sinceTime)))
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  const recentSms = await db
    .select({
      id: activityLogs.id,
      details: activityLogs.details,
      jobNumber: activityLogs.jobNumber,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(and(eq(activityLogs.actionType, "sms_sent"), gte(activityLogs.createdAt, sinceTime)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(20);

  const recentEmails = await db
    .select({
      id: activityLogs.id,
      details: activityLogs.details,
      jobNumber: activityLogs.jobNumber,
      createdAt: activityLogs.createdAt,
    })
    .from(activityLogs)
    .where(and(eq(activityLogs.actionType, "email_sent"), gte(activityLogs.createdAt, sinceTime)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(20);

  const pendingFollowUps = await db
    .select({
      id: scheduledTasks.id,
      jobId: scheduledTasks.jobId,
      customerName: scheduledTasks.customerName,
      customerPhone: scheduledTasks.customerPhone,
      taskType: scheduledTasks.taskType,
      scheduledAt: scheduledTasks.scheduledAt,
    })
    .from(scheduledTasks)
    .where(eq(scheduledTasks.status, "pending"))
    .orderBy(desc(scheduledTasks.scheduledAt))
    .limit(20);

  const totalCount =
    missedCalls.length + newLeads.length + recentSms.length + recentEmails.length + pendingFollowUps.length;

  return { missedCalls, newLeads, recentSms, recentEmails, pendingFollowUps, totalCount };
}

function buildEmailHtml(data: Awaited<ReturnType<typeof collectNotifications>>, isFollowUp: boolean): string {
  const now = new Date();
  const timeStr = now.toLocaleString("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  let html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a365d; color: white; padding: 16px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">AutoGlass Pro CRM${isFollowUp ? " - Reminder" : ""}</h2>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.85;">${timeStr} CT</p>
      </div>
      <div style="border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 8px 8px; padding: 20px;">
  `;

  if (isFollowUp) {
    html += `<p style="color: #c53030; font-weight: bold; margin-top: 0;">This is a follow-up reminder. Please reply to acknowledge.</p>`;
  }

  if (data.totalCount === 0) {
    html += `<p style="color: #718096;">No new activity since the last summary.</p>`;
  }

  if (data.missedCalls.length > 0) {
    html += `<h3 style="color: #c53030; border-bottom: 2px solid #c53030; padding-bottom: 4px;">Missed Calls (${data.missedCalls.length})</h3><ul style="padding-left: 16px;">`;
    for (const call of data.missedCalls) {
      html += `<li style="margin-bottom: 6px;"><strong>${call.contactName || call.fromNumber}</strong> - ${formatTime(call.startedAt)}</li>`;
    }
    html += `</ul>`;
  }

  if (data.newLeads.length > 0) {
    html += `<h3 style="color: #2b6cb0; border-bottom: 2px solid #2b6cb0; padding-bottom: 4px;">New Leads (${data.newLeads.length})</h3><ul style="padding-left: 16px;">`;
    for (const lead of data.newLeads) {
      html += `<li style="margin-bottom: 6px;"><strong>${lead.firstName} ${lead.lastName}</strong> - ${lead.phone || "No phone"} - Job #${lead.jobNumber} - ${formatTime(lead.createdAt)}</li>`;
    }
    html += `</ul>`;
  }

  if (data.pendingFollowUps.length > 0) {
    html += `<h3 style="color: #d69e2e; border-bottom: 2px solid #d69e2e; padding-bottom: 4px;">Pending Follow-Ups (${data.pendingFollowUps.length})</h3><ul style="padding-left: 16px;">`;
    for (const fu of data.pendingFollowUps) {
      html += `<li style="margin-bottom: 6px;"><strong>${fu.customerName}</strong> - ${fu.taskType} - Scheduled: ${formatTime(fu.scheduledAt)}</li>`;
    }
    html += `</ul>`;
  }

  if (data.recentSms.length > 0) {
    html += `<h3 style="color: #38a169; border-bottom: 2px solid #38a169; padding-bottom: 4px;">SMS Sent (${data.recentSms.length})</h3><ul style="padding-left: 16px;">`;
    for (const sms of data.recentSms) {
      html += `<li style="margin-bottom: 6px;">Job #${sms.jobNumber} - ${formatTime(sms.createdAt)}</li>`;
    }
    html += `</ul>`;
  }

  if (data.recentEmails.length > 0) {
    html += `<h3 style="color: #805ad5; border-bottom: 2px solid #805ad5; padding-bottom: 4px;">Emails Sent (${data.recentEmails.length})</h3><ul style="padding-left: 16px;">`;
    for (const email of data.recentEmails) {
      html += `<li style="margin-bottom: 6px;">Job #${email.jobNumber} - ${formatTime(email.createdAt)}</li>`;
    }
    html += `</ul>`;
  }

  html += `
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
        <p style="color: #718096; font-size: 12px; margin: 0;">Reply to this email to stop follow-up reminders. Next summary in 20 minutes.</p>
      </div>
    </div>
  `;

  return html;
}

async function checkForReply(): Promise<boolean> {
  if (!lastSummaryThreadId) return false;

  try {
    const gmail = await getUncachableGmailClient();
    const thread = await gmail.users.threads.get({
      userId: "me",
      id: lastSummaryThreadId,
      format: "metadata",
      metadataHeaders: ["From"],
    });

    consecutiveAuthFailures = 0;
    const messages = thread.data.messages || [];
    if (messages.length <= 1) return false;

    for (let i = 1; i < messages.length; i++) {
      const msg = messages[i];
      const labelIds = msg.labelIds || [];
      if (!labelIds.includes("SENT")) {
        return true;
      }
    }
  } catch (err: any) {
    console.error("[NotificationEmail] Error checking reply:", err.message);
    if (err.message?.includes("access token") || err.message?.includes("401") || err.message?.includes("not connected")) {
      invalidateGmailTokenCache();
      consecutiveAuthFailures++;
      if (consecutiveAuthFailures >= MAX_AUTH_FAILURES) {
        console.error("[NotificationEmail] Too many auth failures, pausing follow-ups until next summary cycle.");
        clearFollowUpTimer();
        awaitingReply = false;
      }
    }
  }
  return false;
}

function clearFollowUpTimer() {
  if (followUpTimer) {
    clearInterval(followUpTimer);
    followUpTimer = null;
  }
}

function markReplied() {
  clearFollowUpTimer();
  awaitingReply = false;
  console.log("[NotificationEmail] Reply detected, follow-up reminders stopped.");
}

async function sendFollowUpReminder(): Promise<void> {
  if (!isBusinessHours()) {
    console.log("[NotificationEmail] Outside business hours, skipping follow-up.");
    return;
  }

  if (!awaitingReply || !lastSummaryThreadId) {
    clearFollowUpTimer();
    return;
  }

  const replied = await checkForReply();
  if (replied) {
    markReplied();
    return;
  }

  try {
    const data = await collectNotifications();
    const html = buildEmailHtml(data, true);
    await sendReply(
      lastSummaryThreadId,
      NOTIFICATION_EMAIL,
      "Re: AutoGlass Pro CRM Activity Summary",
      html
    );
    consecutiveAuthFailures = 0;
    console.log("[NotificationEmail] Follow-up reminder sent.");
  } catch (err: any) {
    console.error("[NotificationEmail] Error sending follow-up:", err.message);
    if (err.message?.includes("access token") || err.message?.includes("401") || err.message?.includes("not connected")) {
      invalidateGmailTokenCache();
      consecutiveAuthFailures++;
      if (consecutiveAuthFailures >= MAX_AUTH_FAILURES) {
        console.error("[NotificationEmail] Too many auth failures, pausing follow-ups until next summary cycle.");
        clearFollowUpTimer();
        awaitingReply = false;
      }
    }
  }
}

function startFollowUpCycle() {
  clearFollowUpTimer();
  followUpTimer = setInterval(sendFollowUpReminder, FOLLOWUP_INTERVAL_MS);
}

async function sendNewSummary(): Promise<void> {
  if (!isBusinessHours()) {
    console.log("[NotificationEmail] Outside business hours (8 AM - 8 PM CT), skipping.");
    return;
  }

  if (awaitingReply && lastSummaryThreadId) {
    const replied = await checkForReply();
    if (replied) {
      markReplied();
    } else {
      console.log("[NotificationEmail] Still awaiting reply on current thread, skipping new summary.");
      return;
    }
  }

  try {
    const data = await collectNotifications();
    const snapshot = JSON.stringify({
      mc: data.missedCalls.map((c) => c.id),
      nl: data.newLeads.map((l) => l.id),
      pf: data.pendingFollowUps.map((f) => f.id),
    });

    if (data.totalCount === 0 && lastNotificationSnapshot === snapshot) {
      console.log("[NotificationEmail] No new activity, skipping email.");
      return;
    }

    const gmail = await getUncachableGmailClient();
    const html = buildEmailHtml(data, false);
    const emailLines = [
      `To: ${NOTIFICATION_EMAIL}`,
      `Subject: AutoGlass Pro CRM Activity Summary`,
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
    ];
    const raw = Buffer.from(emailLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    lastSummaryThreadId = response.data.threadId || null;
    lastSummarySentAt = new Date();
    lastNotificationSnapshot = snapshot;
    awaitingReply = true;
    consecutiveAuthFailures = 0;

    console.log(
      `[NotificationEmail] Summary sent (${data.totalCount} items). Thread: ${lastSummaryThreadId}`
    );

    startFollowUpCycle();
  } catch (err: any) {
    console.error("[NotificationEmail] Error sending summary:", err.message);
    if (err.message?.includes("access token") || err.message?.includes("401") || err.message?.includes("not connected")) {
      invalidateGmailTokenCache();
    }
  }
}

export async function sendTestSummaryNow(): Promise<void> {
  console.log("[NotificationEmail] Sending test summary (bypassing business hours check)...");
  try {
    const data = await collectNotifications();
    const gmail = await getUncachableGmailClient();
    const html = buildEmailHtml(data, false);
    const emailLines = [
      `To: ${NOTIFICATION_EMAIL}`,
      `Subject: [TEST] AutoGlass Pro CRM Activity Summary`,
      "Content-Type: text/html; charset=utf-8",
      "",
      html,
    ];
    const raw = Buffer.from(emailLines.join("\r\n"))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    console.log(`[NotificationEmail] Test summary sent successfully. Thread: ${response.data.threadId}`);
  } catch (err: any) {
    console.error("[NotificationEmail] Error sending test summary:", err.message);
    throw err;
  }
}

export function startNotificationEmailWorker() {
  console.log("[NotificationEmail] Worker started - summaries every 20min, follow-ups every 5min (8 AM - 8 PM CT)");

  setInterval(sendNewSummary, SUMMARY_INTERVAL_MS);

  setTimeout(async () => {
    if (isBusinessHours()) {
      await sendNewSummary();
    }
  }, 10000);
}
