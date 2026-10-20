import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAuthed } from "@/lib/auth";
import { hasDatabase, store } from "@/lib/store";

export default async function Login() {
  if (process.env.VERCEL && !hasDatabase()) {
    return (
      <main className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <div className="label text-amber">Jarvis</div>
        <h1 className="text-[24px] font-medium tracking-tight">Base de données non connectée.</h1>
        <p className="text-sm text-muted">
          Reliez Supabase au projet sur Vercel, puis redéployez. Diagnostic : /api/sante
        </p>
      </main>
    );
  }
  if (await isAuthed()) redirect("/");
  const s = await store.getSettings();
  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="orb-pulse h-16 w-16 rounded-full border-2 border-cyan bg-[#0B1A24]" aria-hidden="true" />
        <div>
          <div className="label text-cyan">Jarvis</div>
          <h1 className="mt-2 text-[26px] font-medium tracking-tight">
            {s.passwordHash ? "Identification, Monsieur." : "Enchanté, Monsieur."}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {s.passwordHash ? "Entrez votre code d'accès." : "Choisissez un code d'accès. Il protégera vos données."}
          </p>
        </div>
      </div>
      <LoginForm setup={!s.passwordHash} />
    </main>
  );
}
