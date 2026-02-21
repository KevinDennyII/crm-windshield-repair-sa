import { db } from "./db";
import { jobs, phoneCalls, activityLogs, scheduledTasks } from "@shared/schema";
import { eq, desc, gte, and, or } from "drizzle-orm";
import { getUncachableGmailClient, sendReply, invalidateGmailTokenCache } from "./gmail";

const NOTIFICATION_EMAIL = "wrsanotifications@gmail.com";
const SUMMARY_INTERVAL_MS = 20 * 60 * 1000;
const FOLLOWUP_INTERVAL_MS = 5 * 60 * 1000;
const BUSINESS_HOUR_START = 8;
const BUSINESS_HOUR_END = 20;
const TIMEZONE = "America/Chicago";

const SEQUENCE_LABELS: Record<number, string> = {
  1: "Quick Quote Receipt",
  2: "Value Proposition",
  3: "Availability Alert",
  4: "Transparent Pricing",
  5: "Safety & ADAS",
  6: "Special Offer",
  7: "Final Call",
};

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

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

interface FollowUpTask {
  id: string;
  jobId: string;
  jobNumber: string | null;
  customerName: string | null;
  customerPhone: string | null;
  vehicleInfo: string | null;
  sequenceNumber: number;
  taskType: string;
  status: string;
  scheduledAt: Date | null;
}

interface MissedCall {
  id: string;
  fromNumber: string;
  contactName: string | null;
  startedAt: Date | null;
}

interface NewLead {
  id: string;
  jobNumber: string;
  firstName: string;
  lastName: string;
  phone: string;
  createdAt: Date | null;
}

interface RecentActivity {
  id: string;
  details: any;
  jobNumber: string | null;
  createdAt: Date | null;
}

interface NotificationData {
  followUpTasks: FollowUpTask[];
  missedCalls: MissedCall[];
  newLeads: NewLead[];
  recentSms: RecentActivity[];
  recentEmails: RecentActivity[];
  totalCount: number;
}

async function collectNotifications(): Promise<NotificationData> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const sinceTime = lastSummarySentAt || new Date(Date.now() - SUMMARY_INTERVAL_MS);

  const followUpTasks = await db.select({
    id: scheduledTasks.id,
    jobId: scheduledTasks.jobId,
    jobNumber: scheduledTasks.jobNumber,
    customerName: scheduledTasks.customerName,
    customerPhone: scheduledTasks.customerPhone,
    vehicleInfo: scheduledTasks.vehicleInfo,
    sequenceNumber: scheduledTasks.sequenceNumber,
    taskType: scheduledTasks.taskType,
    status: scheduledTasks.status,
    scheduledAt: scheduledTasks.scheduledAt,
  })
    .from(scheduledTasks)
    .where(
      or(
        eq(scheduledTasks.status, "notified"),
        eq(scheduledTasks.status, "sent")
      )
    )
    .orderBy(desc(scheduledTasks.scheduledAt));

  const missedCalls = await db.select({
    id: phoneCalls.id,
    fromNumber: phoneCalls.fromNumber,
    contactName: phoneCalls.contactName,
    startedAt: phoneCalls.startedAt,
  })
    .from(phoneCalls)
    .where(eq(phoneCalls.status, "ringing"))
    .orderBy(desc(phoneCalls.startedAt))
    .limit(20);

  const newLeads = await db.select({
    id: jobs.id,
    jobNumber: jobs.jobNumber,
    firstName: jobs.firstName,
    lastName: jobs.lastName,
    phone: jobs.phone,
    createdAt: jobs.createdAt,
  })
    .from(jobs)
    .where(and(
      eq(jobs.pipelineStage, "new_lead"),
      gte(jobs.createdAt, sevenDaysAgo),
    ))
    .orderBy(desc(jobs.createdAt))
    .limit(20);

  const recentSms = await db.select({
    id: activityLogs.id,
    details: activityLogs.details,
    jobNumber: activityLogs.jobNumber,
    createdAt: activityLogs.createdAt,
  })
    .from(activityLogs)
    .where(and(eq(activityLogs.actionType, "sms_sent"), gte(activityLogs.createdAt, sinceTime)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(20);

  const recentEmails = await db.select({
    id: activityLogs.id,
    details: activityLogs.details,
    jobNumber: activityLogs.jobNumber,
    createdAt: activityLogs.createdAt,
  })
    .from(activityLogs)
    .where(and(eq(activityLogs.actionType, "email_sent"), gte(activityLogs.createdAt, sinceTime)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(20);

  const totalCount =
    followUpTasks.length + missedCalls.length + newLeads.length + recentSms.length + recentEmails.length;

  return { followUpTasks, missedCalls, newLeads, recentSms, recentEmails, totalCount };
}

function buildEmailHtml(data: NotificationData, isFollowUp: boolean): string {
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

  if (data.followUpTasks.length > 0) {
    html += `
      <h3 style="color: #b7791f; border-bottom: 2px solid #d69e2e; padding-bottom: 6px; margin-bottom: 12px;">
        FOLLOW-UP TASKS (${data.followUpTasks.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #fffbeb; text-align: left;">
            <th style="padding: 8px 6px; border-bottom: 2px solid #d69e2e; font-size: 12px; color: #92400e;">Job</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #d69e2e; font-size: 12px; color: #92400e;">Customer</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #d69e2e; font-size: 12px; color: #92400e;">Phone</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #d69e2e; font-size: 12px; color: #92400e;">Vehicle</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #d69e2e; font-size: 12px; color: #92400e;">Sequence</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const task of data.followUpTasks) {
      const seqLabel = SEQUENCE_LABELS[task.sequenceNumber] || `Step ${task.sequenceNumber}`;
      const seqBgColor = task.sequenceNumber >= 6 ? "#fed7d7" : task.sequenceNumber >= 4 ? "#fefcbf" : "#e2e8f0";
      const seqTextColor = task.sequenceNumber >= 6 ? "#c53030" : task.sequenceNumber >= 4 ? "#92400e" : "#4a5568";
      html += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 6px; font-weight: bold; color: #2b6cb0;">#${task.jobNumber || "—"}</td>
          <td style="padding: 8px 6px;">${task.customerName || "—"}</td>
          <td style="padding: 8px 6px; color: #4a5568;">${task.customerPhone || "—"}</td>
          <td style="padding: 8px 6px; color: #4a5568; font-size: 12px;">${task.vehicleInfo || "—"}</td>
          <td style="padding: 8px 6px;">
            <span style="background: ${seqBgColor}; color: ${seqTextColor}; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: bold; white-space: nowrap;">
              Seq ${task.sequenceNumber}: ${seqLabel}
            </span>
          </td>
        </tr>
      `;
    }
    html += `</tbody></table>`;
  }

  if (data.missedCalls.length > 0) {
    html += `
      <h3 style="color: #c53030; border-bottom: 2px solid #c53030; padding-bottom: 6px; margin-bottom: 12px;">
        MISSED CALLS (${data.missedCalls.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #fff5f5; text-align: left;">
            <th style="padding: 8px 6px; border-bottom: 2px solid #c53030; font-size: 12px; color: #c53030;">Caller</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #c53030; font-size: 12px; color: #c53030;">Phone</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #c53030; font-size: 12px; color: #c53030;">Time</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const call of data.missedCalls) {
      html += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 6px; font-weight: bold;">${call.contactName || "Unknown Caller"}</td>
          <td style="padding: 8px 6px; color: #4a5568;">${call.fromNumber}</td>
          <td style="padding: 8px 6px; color: #718096;">${formatTimeAgo(call.startedAt)}</td>
        </tr>
      `;
    }
    html += `</tbody></table>`;
  }

  if (data.newLeads.length > 0) {
    html += `
      <h3 style="color: #2b6cb0; border-bottom: 2px solid #2b6cb0; padding-bottom: 6px; margin-bottom: 12px;">
        NEW LEADS (${data.newLeads.length})
      </h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #ebf8ff; text-align: left;">
            <th style="padding: 8px 6px; border-bottom: 2px solid #2b6cb0; font-size: 12px; color: #2b6cb0;">Job</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #2b6cb0; font-size: 12px; color: #2b6cb0;">Customer</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #2b6cb0; font-size: 12px; color: #2b6cb0;">Phone</th>
            <th style="padding: 8px 6px; border-bottom: 2px solid #2b6cb0; font-size: 12px; color: #2b6cb0;">Time</th>
          </tr>
        </thead>
        <tbody>
    `;
    for (const lead of data.newLeads) {
      html += `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 6px; font-weight: bold; color: #2b6cb0;">#${lead.jobNumber}</td>
          <td style="padding: 8px 6px; font-weight: bold;">${lead.firstName} ${lead.lastName}</td>
          <td style="padding: 8px 6px; color: #4a5568;">${lead.phone || "No phone"}</td>
          <td style="padding: 8px 6px; color: #718096;">${formatTimeAgo(lead.createdAt)}</td>
        </tr>
      `;
    }
    html += `</tbody></table>`;
  }

  if (data.recentSms.length > 0) {
    html += `
      <h3 style="color: #38a169; border-bottom: 2px solid #38a169; padding-bottom: 6px; margin-bottom: 12px;">
        SMS SENT (${data.recentSms.length})
      </h3>
      <ul style="padding-left: 16px; margin-bottom: 20px;">
    `;
    for (const sms of data.recentSms) {
      html += `<li style="margin-bottom: 6px; color: #4a5568;">Job #${sms.jobNumber} - ${formatTime(sms.createdAt)}</li>`;
    }
    html += `</ul>`;
  }

  if (data.recentEmails.length > 0) {
    html += `
      <h3 style="color: #805ad5; border-bottom: 2px solid #805ad5; padding-bottom: 6px; margin-bottom: 12px;">
        EMAILS SENT (${data.recentEmails.length})
      </h3>
      <ul style="padding-left: 16px; margin-bottom: 20px;">
    `;
    for (const email of data.recentEmails) {
      html += `<li style="margin-bottom: 6px; color: #4a5568;">Job #${email.jobNumber} - ${formatTime(email.createdAt)}</li>`;
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
      ft: data.followUpTasks.map((t) => t.id),
      mc: data.missedCalls.map((c) => c.id),
      nl: data.newLeads.map((l) => l.id),
    });

    if (data.totalCount === 0 && lastNotificationSnapshot === snapshot) {
      console.log("[NotificationEmail] No new activity, skipping email.");
      return;
    }

    if (lastNotificationSnapshot === snapshot) {
      console.log("[NotificationEmail] No changes since last summary, skipping.");
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
      `[NotificationEmail] Summary sent (${data.totalCount} items: ${data.followUpTasks.length} follow-ups, ${data.missedCalls.length} missed calls, ${data.newLeads.length} new leads). Thread: ${lastSummaryThreadId}`
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
