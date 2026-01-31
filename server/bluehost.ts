import Imap from 'imap';
import type { Box } from 'imap';
import { simpleParser, ParsedMail } from 'mailparser';
import nodemailer from 'nodemailer';
import type { Readable } from 'stream';

const email = process.env.BLUEHOST_EMAIL;
const password = process.env.BLUEHOST_PASSWORD;
const imapServer = process.env.BLUEHOST_IMAP_SERVER;
const smtpServer = process.env.BLUEHOST_SMTP_SERVER;

export function isBluehostConfigured(): boolean {
  return !!(email && password && imapServer && smtpServer);
}

export function getBluehostEmail(): string | null {
  return email || null;
}

export interface BluehostEmail {
  id: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isFromMe: boolean;
}

export interface BluehostThread {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  messages: BluehostEmail[];
}

function parseEmailAddress(header: string): { name: string; email: string } {
  const match = header.match(/^(?:"?([^"]*)"?\s*)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return { name: match[1] || '', email: match[2] };
  }
  return { name: '', email: header };
}

async function fetchFolder(folderName: string): Promise<BluehostEmail[]> {
  return new Promise((resolve, reject) => {
    if (!email || !password || !imapServer) {
      return reject(new Error('Bluehost email not configured'));
    }

    const rejectUnauthorized = process.env.BLUEHOST_TLS_STRICT !== 'false';
    
    const imap = new Imap({
      user: email,
      password: password,
      host: imapServer,
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized },
    });

    const emails: BluehostEmail[] = [];
    const parsePromises: Promise<void>[] = [];

    imap.once('ready', () => {
      imap.openBox(folderName, true, (err: Error | null, box: Box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        if (!box.messages.total) {
          imap.end();
          return resolve([]);
        }

        const fetchCount = Math.min(box.messages.total, 50);
        const start = Math.max(1, box.messages.total - fetchCount + 1);
        const range = `${start}:${box.messages.total}`;

        const fetch = imap.seq.fetch(range, {
          bodies: '',
          struct: true,
        });

        fetch.on('message', (msg: Imap.ImapMessage, seqno: number) => {
          let buffer = '';

          msg.on('body', (stream: Readable) => {
            stream.on('data', (chunk: Buffer) => {
              buffer += chunk.toString('utf8');
            });
          });

          const parsePromise = new Promise<void>((resolveMsg) => {
            msg.once('end', async () => {
              try {
                const parsed: ParsedMail = await simpleParser(buffer);
                const fromHeader = parsed.from?.text || '';
                const { name, email: fromEmail } = parseEmailAddress(fromHeader);
                const isFromMe = folderName.toLowerCase().includes('sent') || 
                                 fromEmail.toLowerCase() === (process.env.BLUEHOST_EMAIL || '').toLowerCase();

                const toField = parsed.to;
                const toText = Array.isArray(toField) ? toField.map(t => t.text).join(', ') : toField?.text || '';
                const htmlContent = parsed.html;
                const bodyText = parsed.text || (typeof htmlContent === 'string' ? htmlContent.replace(/<[^>]*>/g, '') : '') || '';
                
                emails.push({
                  id: `bluehost-${folderName}-${seqno}`,
                  from: name || fromEmail,
                  fromEmail,
                  to: toText,
                  subject: parsed.subject || '(No Subject)',
                  body: bodyText,
                  date: parsed.date?.toISOString() || new Date().toISOString(),
                  isFromMe,
                });
              } catch (parseErr) {
                console.error('Error parsing email:', parseErr);
              }
              resolveMsg();
            });
          });
          parsePromises.push(parsePromise);
        });

        fetch.once('error', (err) => {
          imap.end();
          reject(err);
        });

        fetch.once('end', async () => {
          await Promise.all(parsePromises);
          imap.end();
          resolve(emails);
        });
      });
    });

    imap.once('error', (err: Error) => {
      reject(err);
    });

    imap.connect();
  });
}

export async function getBluehostEmails(maxResults: number = 30): Promise<BluehostThread[]> {
  if (!isBluehostConfigured()) {
    throw new Error('Bluehost email not configured');
  }

  try {
    const [inboxEmails, sentEmails] = await Promise.all([
      fetchFolder('INBOX').catch(() => []),
      fetchFolder('Sent').catch(() => fetchFolder('INBOX.Sent').catch(() => [])),
    ]);

    const allEmails = [...inboxEmails, ...sentEmails];
    
    const threadMap = new Map<string, BluehostEmail[]>();
    
    for (const email of allEmails) {
      const threadKey = email.subject.replace(/^(Re:|Fwd:)\s*/gi, '').toLowerCase().trim();
      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, []);
      }
      threadMap.get(threadKey)!.push(email);
    }

    const threads: BluehostThread[] = [];
    
    threadMap.forEach((messages, subject) => {
      messages.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      const firstMsg = messages[0];
      const lastMsg = messages[messages.length - 1];
      
      const externalMsg = messages.find(m => !m.isFromMe) || firstMsg;
      
      threads.push({
        id: `bluehost-thread-${subject.replace(/\s+/g, '-').substring(0, 50)}`,
        from: externalMsg.from || externalMsg.fromEmail,
        fromEmail: externalMsg.fromEmail,
        subject: firstMsg.subject,
        snippet: lastMsg.body.substring(0, 150),
        date: lastMsg.date,
        isUnread: false,
        messages,
      });
    });

    threads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return threads.slice(0, maxResults);
  } catch (error) {
    console.error('Error fetching Bluehost emails:', error);
    throw error;
  }
}

export async function sendBluehostEmail(to: string, subject: string, body: string): Promise<void> {
  if (!isBluehostConfigured()) {
    throw new Error('Bluehost email not configured');
  }

  const transporter = nodemailer.createTransport({
    host: smtpServer,
    port: 465,
    secure: true,
    auth: {
      user: email,
      pass: password,
    },
  });

  await transporter.sendMail({
    from: email,
    to,
    subject,
    text: body,
    html: body.replace(/\n/g, '<br>'),
  });
}

export async function replyToBluehostEmail(to: string, subject: string, body: string): Promise<void> {
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  await sendBluehostEmail(to, replySubject, body);
}
