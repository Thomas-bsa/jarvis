import { redirect } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { isAuthed } from "@/lib/auth";
import { store } from "@/lib/store";

export default async function Login() {
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
