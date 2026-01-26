// Gmail integration - using Replit's Google Mail connector
import { google } from 'googleapis';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-mail',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Gmail not connected');
  }
  return accessToken;
}

// WARNING: Never cache this client.
// Access tokens expire, so a new client must be created each time.
// Always call this function again to get a fresh client.
export async function getUncachableGmailClient() {
  const accessToken = await getAccessToken();

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({
    access_token: accessToken
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const gmail = await getUncachableGmailClient();
  
  // Create the email message in RFC 2822 format
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ];
  
  const email = emailLines.join('\r\n');
  
  // Base64url encode the email
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail
    }
  });
}

export async function sendReply(threadId: string, to: string, subject: string, body: string): Promise<void> {
  const gmail = await getUncachableGmailClient();
  
  const emailLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/html; charset=utf-8',
    '',
    body
  ];
  
  const email = emailLines.join('\r\n');
  
  const encodedEmail = Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedEmail,
      threadId: threadId
    }
  });
}

interface EmailThread {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messages: EmailMessage[];
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isFromMe: boolean;
}

function parseEmailAddress(headerValue: string): { name: string; email: string } {
  const match = headerValue.match(/^(.+?)\s*<(.+)>$/);
  if (match) {
    return { name: match[1].replace(/"/g, '').trim(), email: match[2] };
  }
  return { name: headerValue, email: headerValue };
}

function getHeader(headers: any[], name: string): string {
  const header = headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase());
  return header?.value || '';
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractBody(payload: any): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/html' && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return `<pre>${decodeBase64Url(part.body.data)}</pre>`;
      }
    }
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }
  
  return '';
}

export async function getInboxThreads(maxResults: number = 20): Promise<EmailThread[]> {
  const gmail = await getUncachableGmailClient();
  
  const threadsResponse = await gmail.users.threads.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX'],
  });
  
  const threads = threadsResponse.data.threads || [];
  const result: EmailThread[] = [];
  
  for (const thread of threads.slice(0, 15)) {
    try {
      const threadDetail = await gmail.users.threads.get({
        userId: 'me',
        id: thread.id!,
        format: 'full',
      });
      
      const messages = threadDetail.data.messages || [];
      if (messages.length === 0) continue;
      
      const firstMessage = messages[0];
      const lastMessage = messages[messages.length - 1];
      
      const headers = firstMessage.payload?.headers || [];
      const fromHeader = getHeader(headers, 'From');
      const { name: fromName, email: fromEmail } = parseEmailAddress(fromHeader);
      const subject = getHeader(headers, 'Subject');
      
      const parsedMessages: EmailMessage[] = messages.map((msg: any) => {
        const msgHeaders = msg.payload?.headers || [];
        const msgFrom = getHeader(msgHeaders, 'From');
        const { email: senderEmail } = parseEmailAddress(msgFrom);
        const isFromMe = msg.labelIds?.includes('SENT') || false;
        
        return {
          id: msg.id!,
          from: msgFrom,
          to: getHeader(msgHeaders, 'To'),
          subject: getHeader(msgHeaders, 'Subject'),
          body: extractBody(msg.payload),
          date: new Date(parseInt(msg.internalDate || '0')).toISOString(),
          isFromMe,
        };
      });
      
      const isUnread = lastMessage.labelIds?.includes('UNREAD') || false;
      
      result.push({
        id: thread.id!,
        threadId: thread.id!,
        from: fromName || fromEmail,
        fromEmail,
        subject,
        snippet: lastMessage.snippet || '',
        date: new Date(parseInt(lastMessage.internalDate || '0')).toISOString(),
        isUnread,
        messages: parsedMessages,
      });
    } catch (error) {
      console.error(`Error fetching thread ${thread.id}:`, error);
    }
  }
  
  return result;
}
