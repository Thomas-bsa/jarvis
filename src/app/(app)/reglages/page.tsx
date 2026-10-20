import { headers } from "next/headers";
import { logout, saveTargets, setHolidayMode } from "@/app/actions";
import { PushSetup } from "@/components/PushSetup";
import { getCronSecret } from "@/lib/push";
import { hasDatabase, store } from "@/lib/store";

export default async function Reglages() {
  const s = await store.getSettings();
  const t = s.targets;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const cronUrl = `${origin}/api/cron/bilan?key=${await getCronSecret()}`;
  const brain = Boolean(process.env.GEMINI_API_KEY);

  return (
    <>
      <header className="pt-6">
        <div className="label text-cyan">Réglages</div>
        <h1 className="mt-1.5 text-[28px] font-medium tracking-tight">Vos objectifs.</h1>
      </header>

      <section aria-label="Période" className="panel flex items-center justify-between gap-4 p-4">
        <div>
          <h2 className="text-[15px] font-medium">Mode vacances</h2>
          <p className="text-sm text-muted">
            Objectif de travail : {s.holidayMode ? `${t.workHoliday} h` : `${t.workSchool} h`} par jour
          </p>
        </div>
        <form action={setHolidayMode.bind(null, !s.holidayMode)}>
          <button
            role="switch"
            aria-checked={s.holidayMode}
            aria-label="Mode vacances"
            className={`relative h-8 w-14 rounded-full border transition ${s.holidayMode ? "border-cyan bg-cyan/25" : "border-white/15 bg-[#0E1620]"}`}
          >
            <span className={`absolute top-1 h-6 w-6 rounded-full transition-all ${s.holidayMode ? "left-7 bg-cyan" : "left-1 bg-muted"}`} />
          </button>
        </form>
      </section>

      <section aria-label="Objectifs" className="panel p-4">
        <form action={saveTargets} className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Travail, cours (h/jour)
            <input name="workSchool" type="number" step="0.5" min="0" max="16" defaultValue={t.workSchool} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Travail, vacances (h/jour)
            <input name="workHoliday" type="number" step="0.5" min="0" max="16" defaultValue={t.workHoliday} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Sommeil (h/nuit)
            <input name="sleepHours" type="number" step="0.25" min="4" max="12" defaultValue={t.sleepHours} className="field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Sport (séances/sem.)
            <input name="sportPerWeek" type="number" step="1" min="0" max="14" defaultValue={t.sportPerWeek} className="field" />
          </label>
          <button className="btn btn-primary col-span-2">Enregistrer les objectifs</button>
        </form>
      </section>

      <section aria-label="Notifications" className="panel flex flex-col gap-3 p-4">
        <h2 className="text-[15px] font-medium">Notification de 23 h</h2>
        <PushSetup />
        <details>
          <summary className="cursor-pointer text-sm text-muted hover:text-ink-2">Adresse du réveil de 23 h (pour cron-job.org)</summary>
          <p className="mt-2 break-all rounded-xl bg-[#0E1620] p-3 font-mono text-xs text-ink-2">{cronUrl}</p>
        </details>
      </section>

      <section aria-label="Système" className="panel flex flex-col gap-2 p-4 text-sm">
        <h2 className="text-[15px] font-medium">Système</h2>
        <div className="flex justify-between gap-3">
          <span className="text-muted">Données</span>
          <span className={hasDatabase() ? "text-mint" : "text-amber"}>{hasDatabase() ? "Base Supabase" : "Fichier local (temporaire)"}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">Cerveau de Jarvis</span>
          <span className={brain ? "text-mint" : "text-amber"}>{brain ? "Gemini connecté" : "Bilan guidé (sans IA)"}</span>
        </div>
        <form action={logout} className="mt-2">
          <button className="btn btn-ghost w-full">Se déconnecter</button>
        </form>
      </section>
    </>
  );
}
