import { getBluehostEmails, BluehostEmail, sendBluehostEmail } from './bluehost';
import { sendEmail } from './gmail';
import { sendSms, isTwilioConfigured } from './twilio';
import { storage } from './storage';
import type { InsertJob, Vehicle, Part, ServiceType, GlassType } from '@shared/schema';

export interface ParsedLead {
  customerName: string;
  phone: string;
  email: string;
  glassType: string;
  doorOption?: string;
  ventOption?: string;
  zipCode: string;
  vehicleYear: string;
  vehicleMake: string;
  licensePlate: string;
  vin: string;
  additionalInfo?: string;
  originalEmailId: string;
  originalEmailDate: string;
}

const processedLeadIds = new Set<string>();

export function isLeadEmail(email: BluehostEmail): boolean {
  return email.subject.includes('New WRSA Quote Request');
}

export function parseLeadEmail(email: BluehostEmail): ParsedLead | null {
  if (!isLeadEmail(email)) {
    return null;
  }

  const body = email.body;
  const lines = body.split('\n').map(l => l.trim()).filter(l => l);

  let customerName = '';
  let phone = '';
  let customerEmail = '';
  let glassType = '';
  let doorOption = '';
  let ventOption = '';
  let zipCode = '';
  let vehicleYear = '';
  let vehicleMake = '';
  let licensePlate = '';
  let vin = '';
  let additionalInfo = '';

  const nameMatch = email.subject.match(/New WRSA Quote Request:\s*(.+)/i);
  if (nameMatch) {
    customerName = nameMatch[1].trim();
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^\d{10}$/) || line.match(/^\d{3}[-.\s]?\d{3}[-.\s]?\d{4}$/)) {
      phone = line.replace(/[-.\s]/g, '');
      continue;
    }

    if (line.includes('@') && line.includes('.') && !line.includes('Type of Glass')) {
      customerEmail = line.toUpperCase();
      continue;
    }

    if (line.startsWith('Type of Glass:')) {
      glassType = line.replace('Type of Glass:', '').trim();
      continue;
    }

    if (line.includes('(Door Glass Option)')) {
      const match = line.match(/Which Door:\s*(.*)/i);
      if (match) doorOption = match[1].trim();
      continue;
    }

    if (line.includes('(Vent Glass Option)')) {
      const match = line.match(/Which Vent:\s*(.*)/i);
      if (match) ventOption = match[1].trim();
      continue;
    }

    if (line.startsWith('Zip Code:')) {
      zipCode = line.replace('Zip Code:', '').trim();
      continue;
    }

    if (line.startsWith('Year:')) {
      vehicleYear = line.replace('Year:', '').trim();
      continue;
    }

    if (line.startsWith('Make:')) {
      vehicleMake = line.replace('Make:', '').trim();
      continue;
    }

    if (line.startsWith('Model:')) {
      licensePlate = line.replace('Model:', '').trim();
      continue;
    }

    if (line.match(/^[A-HJ-NPR-Z0-9]{17}$/i)) {
      vin = line.toUpperCase();
      continue;
    }

    if (line.startsWith('Additional information:')) {
      additionalInfo = line.replace('Additional information:', '').trim();
      for (let j = i + 1; j < lines.length; j++) {
        if (!lines[j].startsWith('--') && !lines[j].includes('Windshield Repair SA')) {
          additionalInfo += ' ' + lines[j];
        } else {
          break;
        }
      }
      additionalInfo = additionalInfo.trim();
      break;
    }
  }

  if (!customerName && lines.length > 0) {
    const firstLine = lines[0];
    if (!firstLine.includes('@') && !firstLine.match(/^\d+$/) && !firstLine.includes(':')) {
      customerName = firstLine;
    }
  }

  if (!customerName || !phone) {
    console.log('Could not parse lead email - missing required fields');
    return null;
  }

  return {
    customerName,
    phone,
    email: customerEmail,
    glassType,
    doorOption,
    ventOption,
    zipCode,
    vehicleYear,
    vehicleMake,
    licensePlate,
    vin,
    additionalInfo,
    originalEmailId: email.id,
    originalEmailDate: email.date,
  };
}

function determineGlassTypeFromLead(lead: ParsedLead): { serviceType: ServiceType; glassType: GlassType } {
  const glassTypeLower = lead.glassType.toLowerCase();
  
  if (glassTypeLower.includes('windshield')) {
    return { serviceType: 'replace', glassType: 'windshield' };
  }
  if (glassTypeLower.includes('door')) {
    return { serviceType: 'replace', glassType: 'door_glass' };
  }
  if (glassTypeLower.includes('back') || glassTypeLower.includes('rear')) {
    return { serviceType: 'replace', glassType: 'back_glass' };
  }
  if (glassTypeLower.includes('quarter')) {
    return { serviceType: 'replace', glassType: 'quarter_glass' };
  }
  if (glassTypeLower.includes('vent')) {
    return { serviceType: 'replace', glassType: 'quarter_glass' };
  }
  if (glassTypeLower.includes('sunroof')) {
    return { serviceType: 'replace', glassType: 'sunroof' };
  }
  if (glassTypeLower.includes('mirror')) {
    return { serviceType: 'replace', glassType: 'side_mirror' };
  }
  if (glassTypeLower.includes('repair') || glassTypeLower.includes('chip')) {
    return { serviceType: 'repair', glassType: 'windshield' };
  }
  
  return { serviceType: 'replace', glassType: 'windshield' };
}

export async function createJobFromLead(lead: ParsedLead): Promise<string> {
  const nameParts = lead.customerName.split(' ');
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  const { serviceType, glassType } = determineGlassTypeFromLead(lead);

  const part: Part = {
    id: crypto.randomUUID(),
    serviceType,
    glassType,
    jobType: serviceType === 'repair' ? 'windshield_repair' : 'windshield_replacement',
    calibrationType: 'none',
    isAftermarket: true,
    glassPartNumber: '',
    distributor: '',
    accessories: lead.doorOption || lead.ventOption || '',
    partPrice: 0,
    markup: 0,
    accessoriesPrice: 0,
    urethanePrice: 15,
    salesTaxPercent: 8.25,
    laborPrice: 0,
    calibrationPrice: 0,
    mobileFee: 0,
    materialCost: 0,
    subcontractorCost: 0,
    partsSubtotal: 0,
    partTotal: 0,
  };

  const vehicle: Vehicle = {
    id: crypto.randomUUID(),
    vehicleYear: lead.vehicleYear,
    vehicleMake: lead.vehicleMake,
    vehicleModel: lead.licensePlate,
    vin: lead.vin,
    licensePlate: lead.licensePlate,
    parts: [part],
  };

  const jobData: InsertJob = {
    firstName,
    lastName,
    phone: lead.phone,
    email: lead.email,
    zipCode: lead.zipCode,
    streetAddress: '',
    city: '',
    state: 'TX',
    isBusiness: false,
    businessName: '',
    customerType: 'retail',
    leadSource: 'website',
    pipelineStage: 'new_lead',
    paymentStatus: 'pending',
    totalDue: 0,
    amountPaid: 0,
    balanceDue: 0,
    vehicles: [vehicle],
    paymentHistory: [],
    installNotes: `Lead from website: ${lead.glassType}\n${lead.additionalInfo || ''}`.trim(),
    repairLocation: 'mobile',
    subtotal: 0,
    taxAmount: 0,
    deductible: 0,
    rebate: 0,
    paymentMethod: [],
    calibrationDeclined: false,
  };

  const job = await storage.createJob(jobData);
  return job.id;
}

export async function sendLeadConfirmationEmail(lead: ParsedLead): Promise<void> {
  const firstName = lead.customerName.split(' ')[0] || 'Valued Customer';
  
  const subject = 'Thank You for Your Quote Request - Windshield Repair SA';
  
  const body = `Hi ${firstName},

Thank you for reaching out to Windshield Repair SA! We have received your quote request for your ${lead.vehicleYear} ${lead.vehicleMake}.

Our team is reviewing your information and will contact you shortly with a personalized quote.

In the meantime, if you have any questions, feel free to reply to this email or call us at (210) 890-0210.

We appreciate your business and look forward to serving you!

Best regards,
Windshield Repair SA
(210) 890-0210
windshieldrepairsa@gmail.com`;

  try {
    await sendEmail(lead.email, subject, body);
    console.log(`Confirmation email sent to ${lead.email}`);
  } catch (error) {
    console.error('Failed to send confirmation email:', error);
  }
}

export async function sendLeadConfirmationSms(lead: ParsedLead): Promise<void> {
  if (!isTwilioConfigured()) {
    console.log('Twilio not configured, skipping SMS');
    return;
  }

  const firstName = lead.customerName.split(' ')[0] || '';
  
  let formattedPhone = lead.phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '+1' + formattedPhone;
  } else if (!formattedPhone.startsWith('+')) {
    formattedPhone = '+' + formattedPhone;
  }

  const message = `Hi ${firstName}! Thank you for your quote request. Windshield Repair SA has received your inquiry for your ${lead.vehicleYear} ${lead.vehicleMake} and will contact you shortly with a quote.`;

  try {
    await sendSms(formattedPhone, message);
    console.log(`Confirmation SMS sent to ${formattedPhone}`);
  } catch (error) {
    console.error('Failed to send confirmation SMS:', error);
  }
}

export async function processNewLeads(): Promise<{ processed: number; errors: string[] }> {
  const results = {
    processed: 0,
    errors: [] as string[],
  };

  try {
    const threads = await getBluehostEmails(50);
    
    for (const thread of threads) {
      for (const email of thread.messages) {
        if (processedLeadIds.has(email.id)) {
          continue;
        }

        if (!isLeadEmail(email)) {
          continue;
        }

        const lead = parseLeadEmail(email);
        if (!lead) {
          processedLeadIds.add(email.id);
          results.errors.push(`Failed to parse lead from email: ${email.subject}`);
          continue;
        }

        const existingJobs = await storage.getAllJobs();
        const alreadyExists = existingJobs.some(job => 
          job.phone === lead.phone && 
          job.pipelineStage === 'new_lead' &&
          new Date(job.createdAt || '').getTime() > Date.now() - 24 * 60 * 60 * 1000
        );

        if (alreadyExists) {
          processedLeadIds.add(email.id);
          continue;
        }

        try {
          const jobId = await createJobFromLead(lead);
          console.log(`Created job ${jobId} from lead: ${lead.customerName}`);

          await Promise.all([
            sendLeadConfirmationEmail(lead),
            sendLeadConfirmationSms(lead),
          ]);

          processedLeadIds.add(email.id);
          results.processed++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push(`Failed to process lead ${lead.customerName}: ${errorMsg}`);
        }
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    results.errors.push(`Failed to fetch emails: ${errorMsg}`);
  }

  return results;
}

let pollingInterval: NodeJS.Timeout | null = null;

export function startLeadPolling(intervalMs: number = 60000): void {
  if (pollingInterval) {
    console.log('Lead polling already running');
    return;
  }

  console.log(`Starting lead polling every ${intervalMs / 1000} seconds`);
  
  processNewLeads().then(result => {
    if (result.processed > 0) {
      console.log(`Initial lead check: processed ${result.processed} leads`);
    }
  }).catch(console.error);

  pollingInterval = setInterval(async () => {
    try {
      const result = await processNewLeads();
      if (result.processed > 0 || result.errors.length > 0) {
        console.log(`Lead polling: processed ${result.processed}, errors: ${result.errors.length}`);
      }
    } catch (error) {
      console.error('Lead polling error:', error);
    }
  }, intervalMs);
}

export function stopLeadPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('Lead polling stopped');
  }
}

export function clearProcessedLeads(): void {
  processedLeadIds.clear();
}
