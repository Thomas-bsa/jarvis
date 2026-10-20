import { isAuthed } from "@/lib/auth";
import { sendToAll } from "@/lib/push";

export async function POST() {
  if (!(await isAuthed())) return Response.json({ error: "non autorisé" }, { status: 401 });
  const r = await sendToAll({
    title: "Jarvis",
    body: "Test réussi, Monsieur. Je vous écrirai ce soir à 23 h.",
    url: "/",
  });
  return Response.json(r);
}
