import { getSummary } from "@/lib/stats";
import { dbEnvName, pingDb, store } from "@/lib/store";

const clean = (e: unknown) =>
  String((e as Error)?.stack ?? e)
    .replace(/postgres(ql)?:\/\/\S+/g, "[adresse masquée]")
    .split("\n")
    .slice(0, 4)
    .join(" | ")
    .slice(0, 400);

// Diagnostic page: runs each building block and reports which one fails, without revealing secrets.
export async function GET() {
  const checks: Record<string, string> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      checks[name] = "OK";
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
  const s = await store.getSettings().catch(() => null);
  return Response.json({
    jarvis: "en ligne",
    variable_utilisee: dbEnvName(),
    code_cree: s ? Boolean(s.passwordHash) : null,
    checks,
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
}
