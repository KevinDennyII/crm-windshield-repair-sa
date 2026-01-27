import { google } from 'googleapis';
import type { Job, Vehicle, Part } from '@shared/schema';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-calendar',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Calendar not connected');
  }
  return accessToken;
}

async function getUncachableGoogleCalendarClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

export async function isCalendarConfigured(): Promise<boolean> {
  try {
    await getAccessToken();
    return true;
  } catch {
    return false;
  }
}

function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}

function formatTimeForTitle(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'pm' : 'am';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')}${ampm}`;
}

function getServiceType(jobType: string): string {
  switch (jobType) {
    case 'windshield_replacement': return 'Replacement';
    case 'windshield_repair': return 'Repair';
    case 'door_glass': return 'Door Glass';
    case 'back_glass': return 'Back Glass';
    case 'quarter_glass': return 'Quarter Glass';
    case 'sunroof': return 'Sunroof';
    case 'side_mirror': return 'Side Mirror';
    default: return 'Service';
  }
}

function getGlassType(jobType: string): string {
  switch (jobType) {
    case 'windshield_replacement': return 'Windshield';
    case 'windshield_repair': return 'Windshield';
    case 'door_glass': return 'Door glass';
    case 'back_glass': return 'Back glass';
    case 'quarter_glass': return 'Quarter glass';
    case 'sunroof': return 'Sunroof';
    case 'side_mirror': return 'Side mirror';
    default: return 'Glass';
  }
}

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

export function buildCalendarEventTitle(job: Job, vehicle: Vehicle, startTime: string, endTime: string): string {
  const timeRange = `${formatTimeForTitle(startTime)}-${formatTimeForTitle(endTime)}`;
  return `${job.jobNumber} ${timeRange} ${vehicle.vehicleYear} ${vehicle.vehicleMake} ${vehicle.vehicleModel}`;
}

export function buildCalendarEventDescription(job: Job, vehicle: Vehicle, part: Part): string {
  const lines: string[] = [];
  
  lines.push(`Lead Source: ${job.leadSource || 'Direct'}`);
  lines.push('');
  lines.push(`Name: ${job.firstName} ${job.lastName}`);
  lines.push(`Phone: ${formatPhoneDisplay(job.phone)}`);
  lines.push(`Email: ${job.email || ''}`);
  lines.push('');
  lines.push(`VIN: ${vehicle.vin || ''}`);
  lines.push('');
  lines.push(`Service: ${getServiceType(part.jobType)}`);
  lines.push(`Glass: ${getGlassType(part.jobType)}`);
  lines.push(`Part#: ${part.glassPartNumber || ''}`);
  lines.push(`Cost: ${formatCurrency(part.partPrice)}`);
  lines.push(`${part.distributor || ''}/${job.installer || ''}`);
  lines.push('');
  lines.push(`Total: ${formatCurrency(job.totalDue)}`);
  
  const hasRcr = job.vehicles.some(v => 
    v.parts.some(p => p.jobType === 'windshield_repair')
  );
  lines.push(`Free RCR included: ${hasRcr ? 'Y' : 'N'}`);
  
  const paymentMethodLabels: Record<string, string> = {
    cash: 'Cash',
    card: 'Card',
    check: 'Check',
    zelle: 'Zelle'
  };
  lines.push(`Payment Method: ${job.paymentMethod ? paymentMethodLabels[job.paymentMethod] : 'Not specified'}`);
  lines.push('');
  
  const paymentNotes = job.paymentHistory.map(p => 
    `${p.source === 'cash' ? 'Cash' : p.source === 'credit_card' ? 'Card' : p.source}: ${formatCurrency(p.amount)}${p.notes ? ` (${p.notes})` : ''}`
  ).join(', ');
  lines.push(paymentNotes || '');
  lines.push('');
  lines.push(`Booked by: ${job.bookedBy || ''}`);
  lines.push(`Installed by: ${job.installedBy || ''}`);

  return lines.join('\n');
}

export function buildFullAddress(job: Job): string {
  const parts = [
    job.streetAddress,
    job.city,
    job.state,
    job.zipCode
  ].filter(Boolean);
  
  if (parts.length >= 3) {
    return `${job.streetAddress}, ${job.city}, ${job.state} ${job.zipCode}, USA`;
  }
  return parts.join(', ');
}

export async function createCalendarEvent(job: Job): Promise<string | null> {
  if (!job.installDate || !job.installTime) {
    throw new Error('Job must have install date and time to create calendar event');
  }

  const calendar = await getUncachableGoogleCalendarClient();
  
  const vehicle = job.vehicles[0];
  if (!vehicle) {
    throw new Error('Job must have at least one vehicle');
  }
  
  const part = vehicle.parts[0] || {
    id: '',
    jobType: 'windshield_replacement' as const,
    partPrice: 0,
    glassPartNumber: '',
    distributor: ''
  };

  const startTime = job.installTime;
  const endTime = job.installEndTime || calculateEndTime(job.installTime, job.jobDuration || '2');
  
  const title = buildCalendarEventTitle(job, vehicle, startTime, endTime);
  const description = buildCalendarEventDescription(job, vehicle, part);
  const location = buildFullAddress(job);

  const startDateTime = `${job.installDate}T${startTime}:00`;
  const endDateTime = `${job.installDate}T${endTime}:00`;

  const event = {
    summary: title,
    location: location,
    description: description,
    start: {
      dateTime: startDateTime,
      timeZone: 'America/Chicago',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'America/Chicago',
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data.id || null;
}

export async function updateCalendarEvent(eventId: string, job: Job): Promise<void> {
  if (!job.installDate || !job.installTime) {
    throw new Error('Job must have install date and time to update calendar event');
  }

  const calendar = await getUncachableGoogleCalendarClient();
  
  const vehicle = job.vehicles[0];
  if (!vehicle) {
    throw new Error('Job must have at least one vehicle');
  }
  
  const part = vehicle.parts[0] || {
    id: '',
    jobType: 'windshield_replacement' as const,
    partPrice: 0,
    glassPartNumber: '',
    distributor: ''
  };

  const startTime = job.installTime;
  const endTime = job.installEndTime || calculateEndTime(job.installTime, job.jobDuration || '2');
  
  const title = buildCalendarEventTitle(job, vehicle, startTime, endTime);
  const description = buildCalendarEventDescription(job, vehicle, part);
  const location = buildFullAddress(job);

  const startDateTime = `${job.installDate}T${startTime}:00`;
  const endDateTime = `${job.installDate}T${endTime}:00`;

  const event = {
    summary: title,
    location: location,
    description: description,
    start: {
      dateTime: startDateTime,
      timeZone: 'America/Chicago',
    },
    end: {
      dateTime: endDateTime,
      timeZone: 'America/Chicago',
    },
  };

  await calendar.events.update({
    calendarId: 'primary',
    eventId: eventId,
    requestBody: event,
  });
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const calendar = await getUncachableGoogleCalendarClient();
  
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
}

export async function getCalendarEvents(timeMin: string, timeMax: string): Promise<any[]> {
  const calendar = await getUncachableGoogleCalendarClient();
  
  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: true,
    orderBy: 'startTime',
  });

  return response.data.items || [];
}

function calculateEndTime(startTime: string, duration: string): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const durationHours = parseFloat(duration) || 2;
  
  const totalMinutes = hours * 60 + minutes + durationHours * 60;
  const endHours = Math.floor(totalMinutes / 60) % 24;
  const endMinutes = Math.floor(totalMinutes % 60);
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}
