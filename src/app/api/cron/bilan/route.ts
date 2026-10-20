import { timingSafeEqual } from "node:crypto";
import { getCronSecret, sendToAll } from "@/lib/push";

// Called every evening at 23:00 (Paris) by cron-job.org:
//   GET /api/cron/bilan?key=<secret shown in Réglages>
export async function GET(req: Request) {
  const given = Buffer.from(new URL(req.url).searchParams.get("key") ?? "");
  const secret = Buffer.from(await getCronSecret());
  if (given.length !== secret.length || !timingSafeEqual(given, secret)) {
    return Response.json({ error: "clé invalide" }, { status: 401 });
  }
  const r = await sendToAll({
    title: "Bilan du soir",
    body: "Monsieur, votre journée est terminée. On fait le bilan ?",
    url: "/bilan",
  });
  return Response.json(r);
}
