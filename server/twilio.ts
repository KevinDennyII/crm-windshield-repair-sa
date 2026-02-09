import twilio from "twilio";

const { AccessToken } = twilio.jwt;
const { VoiceGrant } = AccessToken;

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const twimlAppSidEnv = process.env.TWILIO_TWIML_APP_SID;
const twimlAppSid = twimlAppSidEnv && twimlAppSidEnv.startsWith("AP") ? twimlAppSidEnv : "AP36418fd9f43692836d496e6a0bb6aa3d";
const apiKeySid = process.env.TWILIO_API_KEY_SID;
const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;

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

export function isVoiceConfigured(): boolean {
  return !!(accountSid && apiKeySid && apiKeySecret && twimlAppSid);
}

export function getTwilioPhoneNumber(): string | null {
  return twilioPhoneNumber || null;
}

// Shared identity for all CSR agents so calls ring on all connected browsers
const SHARED_AGENT_IDENTITY = "crm_agent";

export function generateVoiceToken(identity: string): string {
  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error("Twilio Voice not fully configured. Need TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, and TWILIO_TWIML_APP_SID.");
  }

  // Use shared identity so calls ring on all connected CSR browsers
  const accessToken = new AccessToken(
    accountSid,
    apiKeySid,
    apiKeySecret,
    { identity: SHARED_AGENT_IDENTITY, ttl: 3600 }
  );

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: true,
  });

  accessToken.addGrant(voiceGrant);
  return accessToken.toJwt();
}

export interface CallForwardingConfig {
  forwardingNumber: string;
  isEnabled: boolean;
  timeoutSeconds: number;
  whisperMessage: string;
}

export function generateIncomingCallTwiml(contactName: string, forwarding?: CallForwardingConfig, baseUrl?: string): string {
  const response = new twilio.twiml.VoiceResponse();
  
  if (forwarding?.isEnabled && forwarding.forwardingNumber) {
    const actionUrl = baseUrl ? `${baseUrl}/api/voice/dial-action` : "/api/voice/dial-action";
    const dial = response.dial({
      callerId: twilioPhoneNumber || undefined,
      timeout: forwarding.timeoutSeconds || 5,
      action: actionUrl,
      method: "POST",
    });
    
    const clientEl = dial.client({});
    clientEl.identity(SHARED_AGENT_IDENTITY);
    clientEl.parameter({ name: "contactName", value: contactName });
  } else {
    const dial = response.dial({
      callerId: twilioPhoneNumber || undefined,
    });
    
    const clientEl = dial.client({});
    clientEl.identity(SHARED_AGENT_IDENTITY);
    clientEl.parameter({ name: "contactName", value: contactName });
  }
  
  return response.toString();
}

export function generateForwardTwiml(forwardingNumber: string, whisperMessage: string, baseUrl?: string): string {
  const response = new twilio.twiml.VoiceResponse();
  
  let formattedNumber = forwardingNumber.replace(/\D/g, "");
  if (formattedNumber.length === 10) {
    formattedNumber = "+1" + formattedNumber;
  } else if (!formattedNumber.startsWith("+")) {
    formattedNumber = "+" + formattedNumber;
  }
  
  const whisperUrl = baseUrl ? `${baseUrl}/api/voice/whisper` : "/api/voice/whisper";
  const dial = response.dial({
    callerId: twilioPhoneNumber || undefined,
  });
  dial.number({
    url: whisperUrl,
    method: "POST",
  }, formattedNumber);
  
  return response.toString();
}

export function validateTwilioSignature(url: string, params: Record<string, string>, signature: string): boolean {
  if (!authToken) return false;
  return twilio.validateRequest(authToken, signature, url, params);
}

export function generateOutboundCallTwiml(toNumber: string): string {
  const response = new twilio.twiml.VoiceResponse();
  
  // Dial the customer's phone number
  const dial = response.dial({
    callerId: twilioPhoneNumber || undefined,
    answerOnBridge: true,
  });
  
  dial.number(toNumber);
  
  return response.toString();
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
