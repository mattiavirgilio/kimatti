import Groq from "groq-sdk";
import { headers } from "next/headers";
import { z } from "zod";
import { zfd } from "zod-form-data";

// Hilfsfunktion: Groq-Client nur bei Bedarf erstellen
function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "The GROQ_API_KEY environment variable is missing or empty; set it in your environment."
    );
  }
  return new Groq({ apiKey });
}

const schema = zfd.formData({
  input: z.union([zfd.text(), zfd.file()]),
  message: zfd.repeatableOfType(
    zfd.json(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
  ),
});

export async function POST(request: Request) {
  try {
    const parsed = await schema.safeParse(await request.formData());
    if (!parsed.success) {
      return new Response("Invalid request", { status: 400 });
    }
    const { data } = parsed;

    const transcript = await getTranscript(data.input as any);
    if (!transcript) {
      return new Response("Invalid audio", { status: 400 });
    }

    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      model: "llama3-8b-8192",
      messages: [
        { role: "system", content: `...` }, // Dein System-Prompt hier
        ...data.message,
        { role: "user", content: transcript },
      ],
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      return new Response("Invalid response from LLM", { status: 500 });
    }

    const VOICE_ID = "c46FXHKyrgHrLKKtjiy2";

    const voiceResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        },
        body: JSON.stringify({
          model_id: "eleven_multilingual_v2",
          text: response,
          // ÄNDERUNG HIER: Wir fordern jetzt MP3 an
          output_format: "mp3_44100_128",
        }),
      }
    );

    const contentType = voiceResponse.headers.get("Content-Type");
    if (contentType === "application/json") {
      const errorData = await voiceResponse.json();
      console.error(
        "Fehler von ElevenLabs API (als JSON empfangen):",
        errorData
      );
      return new Response(
        JSON.stringify({
          error: "ElevenLabs API returned an error",
          details: errorData,
        }),
        { status: 500 }
      );
    }

    if (!voiceResponse.ok || !voiceResponse.body) {
      const errorText = await voiceResponse.text();
      console.error("Unbekannter Fehler von ElevenLabs API:", errorText);
      return new Response(
        JSON.stringify({
          error: "ElevenLabs API request failed",
          details: errorText,
        }),
        { status: 500 }
      );
    }

    return new Response(voiceResponse.body, {
      headers: {
        // ÄNDERUNG HIER: Der korrekte Content-Type für MP3
        "Content-Type": "audio/mpeg",
        "X-Transcript": encodeURIComponent(transcript),
        "X-Response": encodeURIComponent(response),
      },
    });
  } catch (error) {
    console.error("Ein unerwarteter Fehler ist im POST-Handler aufgetreten:", error);
    return new Response("Ein interner Serverfehler ist aufgetreten.", {
      status: 500,
    });
  }
}

async function location() {
  const headersList = await headers();
  const city = headersList.get("x-vercel-ip-city");
  return city || "unbekannt";
}

async function time() {
  const headersList = await headers();
  const timeZone = headersList.get("x-vercel-ip-timezone") || undefined;
  return new Date().toLocaleString("de-DE", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function getTranscript(input: string | File) {
  if (typeof input === "string") return input;

  try {
    const groq = getGroqClient();
    const { text } = await groq.audio.transcriptions.create({
      file: input,
      model: "whisper-large-v3",
    });
    return text.trim() || null;
  } catch (error) {
    console.error(
      "----------- FEHLER BEI GROQ TRANSCRIPTION -----------"
    );
    console.error(error);
    console.error("----------------------------------------------------");
    return null;
  }
}