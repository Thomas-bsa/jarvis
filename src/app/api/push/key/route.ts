import { isAuthed } from "@/lib/auth";
import { getVapid } from "@/lib/push";

export async function GET() {
  if (!(await isAuthed())) return Response.json({ error: "non autorisé" }, { status: 401 });
  const { publicKey } = await getVapid();
  return Response.json({ publicKey });
}
