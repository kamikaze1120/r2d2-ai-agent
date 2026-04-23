import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TTSInput = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1).max(64).default("JBFqnCBsd6RMkjVDRZzb"), // George
});

/**
 * ElevenLabs TTS server function.
 * Returns base64-encoded MP3 audio so it can be sent over JSON safely.
 * The API key never leaves the server.
 */
export const synthesizeSpeech = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TTSInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY is not configured");
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
      console.error("ElevenLabs TTS error", res.status, err);
      return { audio: null, error: `TTS failed (${res.status})` };
    }

    const buf = await res.arrayBuffer();
    const audio = Buffer.from(buf).toString("base64");
    return { audio, error: null as string | null };
  });
