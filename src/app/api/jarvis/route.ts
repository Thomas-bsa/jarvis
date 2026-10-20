import { isAuthed } from "@/lib/auth";
import { talk, type ChatMsg } from "@/lib/jarvis";

export async function POST(req: Request) {
  if (!(await isAuthed())) return Response.json({ error: "non autorisé" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { messages?: ChatMsg[]; mode?: string };
  const messages = (body.messages ?? [])
    .filter((m) => (m.role === "jarvis" || m.role === "user") && typeof m.text === "string")
    .slice(-30)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
  const result = await talk(messages, body.mode === "libre" ? "libre" : "bilan");
  return Response.json(result);
}
