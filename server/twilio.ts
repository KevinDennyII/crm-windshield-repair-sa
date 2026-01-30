import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
  }
  if (!client) {
    client = twilio(accountSid, authToken);
  }
  return client;
}

export function isTwilioConfigured(): boolean {
  return !!(accountSid && authToken && twilioPhoneNumber);
}

export function getTwilioPhoneNumber(): string | null {
  return twilioPhoneNumber || null;
}

export interface SmsMessage {
  sid: string;
  to: string;
  from: string;
  body: string;
  status: string;
  direction: "inbound" | "outbound-api" | "outbound-call" | "outbound-reply";
  dateSent: Date | null;
  dateCreated: Date;
}

export interface SmsConversation {
  phoneNumber: string;
  messages: SmsMessage[];
  lastMessage: SmsMessage;
}

export async function sendSms(to: string, body: string): Promise<SmsMessage> {
  if (!twilioPhoneNumber) {
    throw new Error("Twilio phone number not configured. Please set TWILIO_PHONE_NUMBER.");
  }
  
  const twilioClient = getClient();
  
  const formattedTo = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;
  
  const message = await twilioClient.messages.create({
    body,
    from: twilioPhoneNumber,
    to: formattedTo,
  });

  return {
    sid: message.sid,
    to: message.to,
    from: message.from,
    body: message.body || body,
    status: message.status,
    direction: message.direction as SmsMessage["direction"],
    dateSent: message.dateSent,
    dateCreated: message.dateCreated,
  };
}

export async function getSmsConversations(limit: number = 50): Promise<SmsConversation[]> {
  const twilioClient = getClient();
  
  const messages = await twilioClient.messages.list({ limit: limit * 2 });
  
  const conversationMap = new Map<string, SmsMessage[]>();
  
  for (const msg of messages) {
    const otherParty = msg.direction === "inbound" ? msg.from : msg.to;
    
    if (!conversationMap.has(otherParty)) {
      conversationMap.set(otherParty, []);
    }
    
    conversationMap.get(otherParty)!.push({
      sid: msg.sid,
      to: msg.to,
      from: msg.from,
      body: msg.body || "",
      status: msg.status,
      direction: msg.direction as SmsMessage["direction"],
      dateSent: msg.dateSent,
      dateCreated: msg.dateCreated,
    });
  }
  
  const conversations: SmsConversation[] = [];
  
  conversationMap.forEach((msgs, phoneNumber) => {
    msgs.sort((a: SmsMessage, b: SmsMessage) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
    
    conversations.push({
      phoneNumber,
      messages: msgs,
      lastMessage: msgs[msgs.length - 1],
    });
  });
  
  conversations.sort((a: SmsConversation, b: SmsConversation) => 
    new Date(b.lastMessage.dateCreated).getTime() - new Date(a.lastMessage.dateCreated).getTime()
  );
  
  return conversations.slice(0, limit);
}

export async function getMessagesWithNumber(phoneNumber: string, limit: number = 50): Promise<SmsMessage[]> {
  const twilioClient = getClient();
  
  const formattedNumber = phoneNumber.startsWith("+") ? phoneNumber : `+1${phoneNumber.replace(/\D/g, "")}`;
  
  const [sentMessages, receivedMessages] = await Promise.all([
    twilioClient.messages.list({ to: formattedNumber, limit }),
    twilioClient.messages.list({ from: formattedNumber, limit }),
  ]);
  
  const allMessages = [...sentMessages, ...receivedMessages];
  
  const messageMap = new Map<string, SmsMessage>();
  for (const msg of allMessages) {
    if (!messageMap.has(msg.sid)) {
      messageMap.set(msg.sid, {
        sid: msg.sid,
        to: msg.to,
        from: msg.from,
        body: msg.body || "",
        status: msg.status,
        direction: msg.direction as SmsMessage["direction"],
        dateSent: msg.dateSent,
        dateCreated: msg.dateCreated,
      });
    }
  }
  
  const messages = Array.from(messageMap.values());
  messages.sort((a, b) => new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime());
  
  return messages;
}
