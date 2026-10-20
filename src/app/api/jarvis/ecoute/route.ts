import { isAuthed } from "@/lib/auth";
import { hasGemini, transcribe } from "@/lib/gemini";

// Voice input for the iPhone home-screen app, where Safari's own speech recognition is blocked:
// the app records a short WAV and Jarvis transcribes it with Gemini.
export async function POST(req: Request) {
  if (!(await isAuthed())) return Response.json({ error: "non autorisé" }, { status: 401 });
  if (!hasGemini()) return Response.json({ error: "cle" }, { status: 503 });
  const body = (await req.json().catch(() => ({}))) as { audio?: string };
  const audio = typeof body.audio === "string" ? body.audio : "";
  if (!audio || audio.length > 4_000_000) return Response.json({ error: "audio invalide" }, { status: 400 });
  try {
    return Response.json({ text: await transcribe(audio) });
  } catch (e) {
    console.error(e);
    return Response.json({ error: "transcription" }, { status: 502 });
  }
}
