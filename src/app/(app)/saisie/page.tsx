import { addNight, addSport, addWork, deleteSleep, deleteSport, deleteWork, goToBed, wakeUp } from "@/app/actions";
import { TimerPanel } from "@/components/TimerPanel";
import { store } from "@/lib/store";
import { addDays, fmtMinutes, parisDay, parisTime } from "@/lib/time";
import { SUBJECTS } from "@/lib/types";

export default async function Saisie() {
  const today = parisDay();
  const since = new Date(addDays(today, -1) + "T00:00:00Z").toISOString();
  const [settings, work, sleep, sport] = await Promise.all([
    store.getSettings(),
    store.listWork(since),
    store.listSleep(new Date(addDays(today, -2) + "T00:00:00Z").toISOString()),
    store.listSport(today),
  ]);
  const todayWork = work.filter((w) => parisDay(w.start) === today).reverse();
  const open = [...sleep].reverse().find((s) => !s.wake);
  const nights = sleep.filter((s) => s.wake).slice(-2).reverse();

  return (
    <>
      <header className="pt-6">
        <div className="label text-cyan">Saisie</div>
        <h1 className="mt-1.5 text-[28px] font-medium tracking-tight">Votre journée, Monsieur.</h1>
      </header>

      <TimerPanel timer={settings.timer} />

      <section aria-label="Ajouter du travail" className="panel flex flex-col gap-3 p-4">
        <h2 className="text-[15px] font-medium">Ajouter du travail fait sans minuteur</h2>
        <form action={addWork} className="grid grid-cols-[1fr_72px_72px] gap-2">
          <label className="sr-only" htmlFor="w-subject">Matière</label>
          <select id="w-subject" name="subject" className="field">
            {SUBJECTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="w-h">Heures</label>
          <input id="w-h" name="hours" type="number" inputMode="numeric" min="0" max="16" placeholder="h" className="field text-center" />
          <label className="sr-only" htmlFor="w-m">Minutes</label>
          <input id="w-m" name="minutes" type="number" inputMode="numeric" min="0" max="59" placeholder="min" className="field text-center" />
          <button className="btn btn-primary col-span-3">Ajouter</button>
        </form>
      </section>

      <section aria-label="Sommeil" className="panel flex flex-col gap-3 border-violet/25 p-4">
        <h2 className="text-[15px] font-medium">Sommeil</h2>
        {open ? (
          <form action={wakeUp} className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Couché à {parisTime(open.bed)}</span>
            <button className="btn btn-primary border-violet/70 bg-violet/15">Je suis réveillé</button>
          </form>
        ) : (
          <form action={goToBed}>
            <button className="btn btn-ghost w-full">Je vais me coucher maintenant</button>
          </form>
        )}
        <details className="group">
          <summary className="cursor-pointer text-sm text-muted hover:text-ink-2">Saisir une nuit après coup</summary>
          <form action={addNight} className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Couché à
              <input name="bed" type="time" defaultValue="23:15" className="field" />
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              Réveillé à
              <input name="wake" type="time" defaultValue="06:45" className="field" />
            </label>
            <button className="btn btn-primary col-span-2">Enregistrer la nuit</button>
          </form>
        </details>
        {nights.map((n) => (
          <div key={n.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-2">
              {parisTime(n.bed)} → {parisTime(n.wake!)}
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-violet-soft">
                {fmtMinutes((new Date(n.wake!).getTime() - new Date(n.bed).getTime()) / 60000)}
              </span>
              <form action={deleteSleep.bind(null, n.id)}>
                <button aria-label="Supprimer cette nuit" className="flex h-11 w-11 items-center justify-center text-faint hover:text-danger">
                  ×
                </button>
              </form>
            </span>
          </div>
        ))}
      </section>

      <section aria-label="Sport" className="panel flex flex-col gap-3 border-mint/25 p-4">
        <h2 className="text-[15px] font-medium">Sport</h2>
        <form action={addSport} className="grid grid-cols-[1fr_88px] gap-2">
          <label className="sr-only" htmlFor="s-act">Activité</label>
          <input id="s-act" name="activity" placeholder="Course, muscu, foot…" className="field" />
          <label className="sr-only" htmlFor="s-min">Minutes</label>
          <input id="s-min" name="minutes" type="number" inputMode="numeric" min="0" placeholder="min" className="field text-center" />
          <button className="btn btn-primary col-span-2 border-mint/70 bg-mint/10">Ajouter la séance</button>
        </form>
        {sport.map((x) => (
          <div key={x.id} className="flex items-center justify-between text-sm">
            <span className="text-ink-2">{x.activity}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs text-mint">{x.minutes ? fmtMinutes(x.minutes) : ""}</span>
              <form action={deleteSport.bind(null, x.id)}>
                <button aria-label="Supprimer cette séance" className="flex h-11 w-11 items-center justify-center text-faint hover:text-danger">
                  ×
                </button>
              </form>
            </span>
          </div>
        ))}
      </section>

      {todayWork.length > 0 && (
        <section aria-label="Travail du jour" className="panel flex flex-col gap-1 p-4">
          <h2 className="mb-1 text-[15px] font-medium">Travail du jour</h2>
          {todayWork.map((w) => (
            <div key={w.id} className="flex items-center justify-between text-sm">
              <span className="text-ink-2">
                <span className="font-mono text-xs text-muted">{parisTime(w.start)}</span> · {w.subject}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-cyan">{fmtMinutes(w.minutes)}</span>
                <form action={deleteWork.bind(null, w.id)}>
                  <button aria-label="Supprimer cette session" className="flex h-11 w-11 items-center justify-center text-faint hover:text-danger">
                    ×
                  </button>
                </form>
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
