import { isAuthed } from "@/lib/auth";
import { store } from "@/lib/store";
import type { PushSub } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await isAuthed())) return Response.json({ error: "non autorisé" }, { status: 401 });
  const sub = (await req.json()) as PushSub;
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) {
    return Response.json({ error: "abonnement invalide" }, { status: 400 });
  }
  await store.savePush({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAuthed())) return Response.json({ error: "non autorisé" }, { status: 401 });
  const { endpoint } = (await req.json()) as { endpoint?: string };
  if (endpoint) await store.deletePush(endpoint);
  return Response.json({ ok: true });
}
