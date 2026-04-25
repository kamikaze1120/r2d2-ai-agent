import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TTSInput = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(64).default("JBFqnCBsd6RMkjVDRZzb"), // George
  /** Optional user-supplied ElevenLabs key. Overrides the platform secret. */
  userKey: z.string().min(20).max(200).optional(),
});

/**
 * ElevenLabs TTS server function.
 * Returns base64-encoded MP3 audio so it can be sent over JSON safely.
 *
 * Key resolution order:
 *   1. user-supplied key from the browser (BYOK), if present
 *   2. ELEVENLABS_API_KEY env var (platform secret)
 *
 * The user key never gets logged or persisted server-side — it's used once
 * per request and discarded. Lovable Cloud handles HTTPS in transit.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TTSInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = data.userKey || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return {
        audio: null,
        error:
          "No ElevenLabs key configured. Add your API key in Settings → Voice.",
      };
    }

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${data.voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: data.text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.55,
            similarity_boost: 0.8,
            style: 0.35,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs TTS error", res.status, err.slice(0, 200));
      return {
        audio: null,
        error:
          res.status === 401
            ? "ElevenLabs rejected the key. Check it in Settings."
            : `TTS failed (${res.status})`,
      };
    }

    const buf = await res.arrayBuffer();
    const audio = Buffer.from(buf).toString("base64");
    return { audio, error: null as string | null };
  });
