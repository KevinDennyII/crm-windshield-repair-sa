import fs from "fs";
import path from "path";
import crypto from "crypto";

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const AUDIO_DIR = "/tmp/elevenlabs-audio";

const ELEVENLABS_VOICES: Record<string, { id: string; name: string }> = {
  "ElevenLabs.Ivanna": { id: "bMxLr8fP6hzNRRi9nJxU", name: "Ivanna - Young & Casual" },
};

if (!fs.existsSync(AUDIO_DIR)) {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function cleanOldFiles() {
  try {
    const files = fs.readdirSync(AUDIO_DIR);
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;
    for (const file of files) {
      const filePath = path.join(AUDIO_DIR, file);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    }
  } catch {}
}

export function isElevenLabsVoice(voiceName: string): boolean {
  return voiceName.startsWith("ElevenLabs.");
}

export function isElevenLabsConfigured(): boolean {
  return !!process.env.ELEVENLABS_API_KEY;
}

export function getElevenLabsVoiceId(voiceName: string): string | null {
  return ELEVENLABS_VOICES[voiceName]?.id || null;
}

export async function generateElevenLabsAudio(text: string, voiceName: string): Promise<string | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error("ELEVENLABS_API_KEY not configured");
    return null;
  }

  const voiceId = getElevenLabsVoiceId(voiceName);
  if (!voiceId) {
    console.error(`Unknown ElevenLabs voice: ${voiceName}`);
    return null;
  }

  try {
    cleanOldFiles();

    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ElevenLabs API error (${response.status}):`, errorText);
      return null;
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    const filename = `${crypto.randomUUID()}.mp3`;
    const filePath = path.join(AUDIO_DIR, filename);
    fs.writeFileSync(filePath, audioBuffer);

    return filename;
  } catch (error: any) {
    console.error("ElevenLabs TTS error:", error.message);
    return null;
  }
}

export { AUDIO_DIR };
