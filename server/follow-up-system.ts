import { storage } from "./storage";
import { type Job, type InsertScheduledTask } from "@shared/schema";
import { sendSms, isTwilioConfigured } from "./twilio";
import { sendEmail } from "./gmail";

const SHOP_NAME = "Windshield Repair SA";
const SHOP_PHONE = "(210) 555-1234";

interface SequenceTemplate {
  sequenceNumber: number;
  hoursDelay: number;
  label: string;
  generateSms: (data: TemplateData) => string;
  generateEmailSubject: (data: TemplateData) => string;
  generateEmailBody: (data: TemplateData) => string;
}

interface TemplateData {
  name: string;
  vehicle: string;
  vehicleYear: string;
  vehicleMake: string;
  price: string;
  city: string;
  glassType: string;
}

function getJobTemplateData(job: Job): TemplateData {
  const vehicles = (job.vehicles as any[]) || [];
  const firstVehicle = vehicles[0] || {};
  const parts = firstVehicle.parts || [];
  const firstPart = parts[0] || {};
  
  const glassTypeMap: Record<string, string> = {
    windshield: "Windshield",
    door_glass: "Door Glass",
    back_glass: "Back Glass",
    back_glass_powerslide: "Back Glass",
    quarter_glass: "Quarter Glass",
    sunroof: "Sunroof",
    side_mirror: "Side Mirror",
  };

  return {
    name: job.firstName,
    vehicle: `${firstVehicle.vehicleYear || ""} ${firstVehicle.vehicleMake || ""} ${firstVehicle.vehicleModel || ""}`.trim() || "your vehicle",
    vehicleYear: firstVehicle.vehicleYear || "",
    vehicleMake: firstVehicle.vehicleMake || "",
    price: String(job.totalDue || "0"),
    city: job.city || "your area",
    glassType: glassTypeMap[firstPart.glassType] || "Windshield",
  };
}

export const FOLLOW_UP_SEQUENCES: SequenceTemplate[] = [
  {
    sequenceNumber: 1,
    hoursDelay: 0,
    label: "Quick Quote Receipt",
    generateSms: (d) =>
      `Hi ${d.name}! Thanks for reaching out to ${SHOP_NAME}. We've received your request for your ${d.vehicle}. Check your email for your personalized quote or reply BOOK to schedule now!`,
    generateEmailSubject: (d) =>
      `Your ${d.vehicle} Auto Glass Quote from ${SHOP_NAME}`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, thanks for the opportunity to earn your business. Based on the info provided, your quote for a ${d.glassType} replacement is $${d.price}. This includes our lifetime warranty on workmanship. Ready to get it fixed? Just reply to this email or call us at ${SHOP_PHONE} to schedule!`,
  },
  {
    sequenceNumber: 2,
    hoursDelay: 2,
    label: "Value Proposition",
    generateSms: (d) =>
      `Still looking to fix that glass, ${d.name}? At ${SHOP_NAME}, we use OEM-quality glass and offer mobile service to your home or work. Want to see if we have an opening tomorrow?`,
    generateEmailSubject: (d) =>
      `Why ${SHOP_NAME} is the right choice for your ${d.vehicle}`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, we know you have choices. Just a reminder that we offer Free Mobile Service, ADAS Calibration, and a Lifetime Warranty. We can often have you back on the road in under 2 hours. Reply to this email if you have any questions about the quote!`,
  },
  {
    sequenceNumber: 3,
    hoursDelay: 4,
    label: "Availability Alert",
    generateSms: (d) =>
      `Hey ${d.name}, I just had a technician opening for tomorrow morning near ${d.city}. Would you like me to grab that spot for your ${d.vehicle} before it fills up?`,
    generateEmailSubject: (d) =>
      `Quick Question: Need that ${d.vehicle} glass fixed tomorrow?`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, our schedule for tomorrow is filling up fast, but I noticed we still have a gap that fits your location. I'd love to get your ${d.glassType} taken care of for you. Reply "I want to book" to get on the schedule.`,
  },
  {
    sequenceNumber: 4,
    hoursDelay: 6,
    label: "Transparent Pricing",
    generateSms: (d) =>
      `${d.name}, we know price matters. Our quote for your ${d.vehicle} is the total out-of-pocket price—no hidden shop fees or surprise taxes. We keep it simple and affordable. Want to lock in your price for this week? Reply YES.`,
    generateEmailSubject: (d) =>
      `No surprises, just honest pricing for your ${d.vehicle}`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, we noticed you haven't booked yet and wanted to clear up any confusion on cost. Since we specialize in direct-pay service, we've cut out the middleman to keep your price as low as possible.\n\nThe $${d.price} we quoted is exactly what you'll pay. No hidden "disposal fees" or "installation surcharges." We accept Cash, Card, and Zelle right at your driveway.\n\nReady to get that ${d.glassType} fixed without the headache? Reply "I want to book" to get on the schedule.`,
  },
  {
    sequenceNumber: 5,
    hoursDelay: 8,
    label: "Safety & ADAS Education",
    generateSms: (d) =>
      `Quick safety tip, ${d.name}: Since your ${d.vehicle} has cameras/sensors, it requires ADAS calibration after a windshield swap. We handle that in-house! Stay safe— reply "I want to book" to get on the schedule.`,
    generateEmailSubject: (d) =>
      `Important Safety Note for your ${d.vehicle}`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, modern windshields are more than just glass—they are safety devices. Your ${d.vehicle} likely features Advanced Driver Assistance Systems (ADAS) that need precise calibration. We are one of the few shops in ${d.city} equipped to handle this correctly. Don't settle for a partial fix!`,
  },
  {
    sequenceNumber: 6,
    hoursDelay: 10,
    label: "Special Offer Nudge",
    generateSms: (d) =>
      `Hi ${d.name}, I really want to help get that ${d.vehicle} back in shape. If you book in the next 2 hours, I can take $20 off your quote or include a free wiper blade upgrade! Reply YES.`,
    generateEmailSubject: (d) =>
      `A little something extra for your ${d.vehicle} repair...`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, I'm checking back in one last time today. If you book your appointment now for later this week, I'll include a $20 Discount or Free Wipers. Just mention this email when you book.`,
  },
  {
    sequenceNumber: 7,
    hoursDelay: 12,
    label: "Final Call",
    generateSms: (d) =>
      `${d.name}, it looks like we haven't been able to connect yet. I'll leave your quote open for 24 more hours. If you're still interested, give us a call at ${SHOP_PHONE}!`,
    generateEmailSubject: (d) =>
      `Still need that glass fixed? (Final Check-in)`,
    generateEmailBody: (d) =>
      `Hi ${d.name}, I haven't heard back, so I'll assume you may have already found a solution or changed your mind. If you still need that ${d.glassType} replaced, our quote is valid for 24 more hours. We'd love to help whenever you're ready!`,
  },
];

export async function createFollowUpTasksForJob(job: Job): Promise<void> {
  const templateData = getJobTemplateData(job);
  const now = new Date();
  const vehicleInfo = templateData.vehicle;

  for (const seq of FOLLOW_UP_SEQUENCES) {
    const scheduledAt = new Date(now.getTime() + seq.hoursDelay * 60 * 60 * 1000);
    
    const task: InsertScheduledTask = {
      jobId: job.id,
      sequenceNumber: seq.sequenceNumber,
      taskType: seq.sequenceNumber <= 6 ? "sms_email" : "manual_task",
      followUpMode: job.followUpMode || "manual",
      status: "pending",
      scheduledAt,
      smsContent: seq.generateSms(templateData),
      emailSubject: seq.generateEmailSubject(templateData),
      emailBody: seq.generateEmailBody(templateData),
      customerName: `${job.firstName} ${job.lastName}`,
      customerPhone: job.phone,
      customerEmail: job.email || null,
      vehicleInfo,
      jobNumber: job.jobNumber,
    };

    await storage.createScheduledTask(task);
  }

  await storage.createFollowUpLog({
    jobId: job.id,
    jobNumber: job.jobNumber,
    action: "tasks_created",
    details: `7 follow-up tasks created (mode: ${job.followUpMode || "manual"})`,
    performedBy: "system",
  });
}

export async function archiveFollowUpsForJob(jobId: string, jobNumber?: string): Promise<number> {
  const archived = await storage.archiveTasksByJob(jobId);
  
  if (archived > 0) {
    await storage.createFollowUpLog({
      jobId,
      jobNumber: jobNumber || null,
      action: "tasks_archived",
      details: `${archived} pending follow-up tasks archived (job booked/scheduled)`,
      performedBy: "system",
    });
  }
  
  return archived;
}

async function executeAutoTask(task: any): Promise<void> {
  let smsSent = false;
  let emailSent = false;

  if (task.customerPhone && task.smsContent) {
    try {
      if (isTwilioConfigured()) {
        await sendSms(task.customerPhone, task.smsContent);
        smsSent = true;
      } else {
        console.log(`[FollowUp] SMS would be sent to ${task.customerPhone}: ${task.smsContent.substring(0, 50)}...`);
        smsSent = true;
      }
    } catch (err: any) {
      console.error(`[FollowUp] SMS failed for task ${task.id}:`, err.message);
    }
  }

  if (task.customerEmail && task.emailSubject && task.emailBody) {
    try {
      await sendEmail(task.customerEmail, task.emailSubject, task.emailBody);
      emailSent = true;
    } catch (err: any) {
      console.error(`[FollowUp] Email failed for task ${task.id}:`, err.message);
    }
  }

  const status = (smsSent || emailSent) ? "sent" : "failed";
  await storage.updateScheduledTaskStatus(task.id, status, new Date());

  if (smsSent || emailSent) {
    const actions: string[] = [];
    if (smsSent) actions.push("SMS");
    if (emailSent) actions.push("Email");
    
    await storage.createFollowUpLog({
      jobId: task.jobId,
      jobNumber: task.jobNumber,
      action: smsSent ? "sms_sent" : "email_sent",
      sequenceNumber: task.sequenceNumber,
      details: `Sequence ${task.sequenceNumber}: Auto-sent ${actions.join(" & ")} to ${task.customerName}`,
      performedBy: "system",
    });
  }
}

async function executeManualTask(task: any): Promise<void> {
  await storage.updateScheduledTaskStatus(task.id, "notified");
  
  await storage.createFollowUpLog({
    jobId: task.jobId,
    jobNumber: task.jobNumber,
    action: "task_notified",
    sequenceNumber: task.sequenceNumber,
    details: `Sequence ${task.sequenceNumber}: "${FOLLOW_UP_SEQUENCES[task.sequenceNumber - 1]?.label}" ready for manual send`,
    performedBy: "system",
  });
}

let workerInterval: ReturnType<typeof setInterval> | null = null;

export function startFollowUpWorker(): void {
  if (workerInterval) return;
  
  console.log("[FollowUp] Background worker started (checking every 60 seconds)");
  
  workerInterval = setInterval(async () => {
    try {
      const dueTasks = await storage.getDueTasks();
      
      if (dueTasks.length === 0) return;
      
      console.log(`[FollowUp] Processing ${dueTasks.length} due tasks`);
      
      for (const task of dueTasks) {
        try {
          if (task.followUpMode === "auto") {
            await executeAutoTask(task);
          } else {
            await executeManualTask(task);
          }
        } catch (err: any) {
          console.error(`[FollowUp] Error processing task ${task.id}:`, err.message);
          await storage.updateScheduledTaskStatus(task.id, "failed");
        }
      }
    } catch (err: any) {
      console.error("[FollowUp] Worker error:", err.message);
    }
  }, 60 * 1000);
}

export function stopFollowUpWorker(): void {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log("[FollowUp] Background worker stopped");
  }
}
