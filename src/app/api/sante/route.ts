import { connection } from "next/server";
import { getSummary } from "@/lib/stats";
import { busySessions, dbEnvName, pingDb, store } from "@/lib/store";

const clean = (e: unknown) =>
  String((e as Error)?.stack ?? e)
    .replace(/postgres(ql)?:\/\/\S+/g, "[adresse masquée]")
    .split("\n")
    .slice(0, 4)
    .join(" | ")
    .slice(0, 400);

// Diagnostic page: runs each building block and reports which one fails, without revealing secrets.
export async function GET() {
  await connection(); // always run at request time, never at build time
  const checks: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now();
    try {
      await Promise.race([
        fn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error("bloqué plus de 8 s")), 8000)),
      ]);
      checks[name] = `OK (${Date.now() - t0} ms)`;
    } catch (e) {
      checks[name] = clean(e);
    }
  };
  if (dbEnvName()) {
    await run("base", pingDb);
    await run("reglages", () => store.getSettings());
    await run("travail", () => store.listWork(new Date(Date.now() - 7 * 864e5).toISOString()));
    await run("sommeil", () => store.listSleep(new Date(Date.now() - 7 * 864e5).toISOString()));
    await run("sport", () => store.listSport("2020-01-01"));
    await run("resume", () => getSummary());
  } else {
    checks.base = "non configurée";
  }
  const sessions = dbEnvName() ? await busySessions().catch((e) => [clean(e)]) : [];
  const s = await store.getSettings().catch(() => null);
  return Response.json({
    jarvis: "en ligne",
    variable_utilisee: dbEnvName(),
    code_cree: s ? Boolean(s.passwordHash) : null,
    checks,
    sessions_actives: sessions,
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
}
