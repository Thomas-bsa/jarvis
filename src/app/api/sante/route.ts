import { dbEnvName, pingDb } from "@/lib/store";

// Diagnostic page: says whether the database is reachable, without revealing any secret.
export async function GET() {
  const envName = dbEnvName();
  const dbVars = Object.keys(process.env).filter((k) => /POSTGRES|DATABASE|SUPABASE/.test(k));
  let base = "non configurée";
  let erreur: string | null = null;
  if (envName) {
    try {
      await pingDb();
      base = "OK";
    } catch (e) {
      base = "erreur";
      erreur = String((e as Error).message ?? e).replace(/postgres(ql)?:\/\/\S+/g, "[adresse masquée]").slice(0, 300);
    }
  }
  return Response.json({
    jarvis: "en ligne",
    base,
    variable_utilisee: envName,
    variables_trouvees: dbVars,
    erreur,
    gemini: Boolean(process.env.GEMINI_API_KEY),
  });
}
