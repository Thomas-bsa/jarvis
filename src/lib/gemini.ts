import "server-only";

// Google retires model names from time to time: try the configured one, then safe fallbacks.
const MODELS = () =>
  [...new Set([process.env.GEMINI_MODEL, "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean) as string[])];

export const hasGemini = () => Boolean(process.env.GEMINI_API_KEY);

/** Calls Gemini generateContent and returns the parsed JSON response. */
export async function generate(body: unknown): Promise<{ candidates?: { content?: { parts?: unknown[] } }[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY manquante");
  let last = "";
  for (const model of MODELS()) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    });
    if (res.ok) return res.json();
    last = `Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 300)}`;
    if (res.status !== 404) break; // only an unknown model is worth another try
  }
  throw new Error(last);
}

/** Speech to text: a short French WAV recording → what was said. */
export async function transcribe(wavBase64: string): Promise<string> {
  const data = await generate({
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "audio/wav", data: wavBase64 } },
          {
            text: "Transcris exactement ce que dit la personne, en français, avec la ponctuation. Réponds uniquement par la transcription, sans guillemets. S'il n'y a pas de parole, réponds par une chaîne vide.",
          },
        ],
      },
    ],
    generationConfig: { temperature: 0, maxOutputTokens: 1500 },
  });
  const parts = (data.candidates?.[0]?.content?.parts ?? []) as { text?: string }[];
  return parts.map((p) => p.text ?? "").join("").trim();
}
