import Link from "next/link";
import { wakeUp } from "@/app/actions";
import { Ring } from "@/components/Ring";
import { WeekBars } from "@/components/WeekBars";
import { getOrgaToday, KIND_COLOR, minutesBetween } from "@/lib/orga";
import { getSummary } from "@/lib/stats";
import { fmtHours, fmtMinutes, greeting, longDate, parisTime } from "@/lib/time";

export default async function Home() {
  const [s, o] = await Promise.all([getSummary(), getOrgaToday()]);
  const slot = o.current ?? o.next;
  const now = parisTime();
  const t = s.settings.targets;
  const sleepNow = s.lastNightH ?? s.avgSleepH;
  const sportLeft = Math.max(0, t.sportPerWeek - s.sportThisWeek);
  const sleepGap = s.avgSleepH == null ? null : Math.round((s.avgSleepH - t.sleepHours) * 60);

  return (
    <>
      <header className="flex items-start justify-between gap-4 pt-6">
        <div className="flex flex-col gap-1.5">
          <div className="label text-cyan">Jarvis · {longDate()}</div>
          <h1 className="text-[30px] font-medium leading-tight tracking-tight">{greeting()}, Monsieur.</h1>
          <div className="text-sm text-muted">
            {s.settings.holidayMode ? "Vacances" : "Période de cours"} · objectif {fmtHours(s.workTargetH)} par jour
          </div>
        </div>
        <Link
          href="/bilan"
          aria-label="Parler à Jarvis"
          className="orb-pulse flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan/60 bg-[#0B1A24]"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5CE1FF" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </Link>
      </header>

      {s.sleeping && (
        <form action={wakeUp} className="panel fade-up flex items-center justify-between gap-3 border-violet/30 p-4">
          <div>
            <div className="text-sm text-muted">Couché à {parisTime(s.sleeping.bed)}</div>
            <div className="text-base">Bien dormi, Monsieur ?</div>
          </div>
          <button className="btn btn-primary border-violet/70 bg-violet/15">Je suis réveillé</button>
        </form>
      )}

      {s.settings.timer && (
        <Link href="/saisie" className="panel fade-up flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan shadow-[0_0_10px_#5CE1FF]" />
            <span>{s.settings.timer.subject} en cours</span>
          </div>
          <span className="whitespace-nowrap font-mono text-sm text-cyan">depuis {parisTime(s.settings.timer.startedAt)}</span>
        </Link>
      )}

      <section aria-label="Objectifs" className="panel grid grid-cols-3 gap-1 px-3 pb-4 pt-5">
        <Ring label="Travail" value={fmtMinutes(s.todayWorkMin)} target={fmtHours(s.workTargetH)} pct={s.todayWorkMin / 60 / s.workTargetH} color="#5CE1FF" />
        <Ring
          label="Sommeil"
          value={sleepNow == null ? "—" : fmtHours(sleepNow)}
          target={fmtHours(t.sleepHours)}
          pct={sleepNow == null ? 0 : sleepNow / t.sleepHours}
          color="#9D8CFF"
        />
        <Ring label="Sport" value={String(s.sportThisWeek)} target={`${t.sportPerWeek} / sem.`} pct={s.sportThisWeek / Math.max(1, t.sportPerWeek)} color="#4BE3A6" />
      </section>

      <Link href="/orga" aria-label="Organisation" className="panel flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium">Organisation</h2>
          <span className="font-mono text-xs text-muted">
            {o.slotsToday.length} cours · {o.openTodos} à faire
          </span>
        </div>
        {slot ? (
          <div className="flex items-center gap-3">
            <span
              className="h-9 w-1 shrink-0 rounded-full"
              style={{ background: KIND_COLOR[slot.kind] ?? KIND_COLOR.Autre, boxShadow: `0 0 10px ${KIND_COLOR[slot.kind] ?? KIND_COLOR.Autre}` }}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate">
                {slot.subject} <span className="text-sm text-muted">· {slot.kind}{slot.room ? ` · ${slot.room}` : ""}</span>
              </div>
              <div className="font-mono text-xs text-muted">
                {slot.start} → {slot.end} ·{" "}
                {o.current ? <span className="text-cyan">en cours</span> : `dans ${fmtMinutes(minutesBetween(now, slot.start))}`}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">{o.slotsToday.length ? "Plus de cours aujourd'hui." : "Pas de cours prévu aujourd'hui."}</div>
        )}
        {(o.dueTomorrow.length > 0 || o.late.length > 0) && (
          <div className="flex flex-col gap-1 border-t border-white/[0.06] pt-3 text-sm">
            {o.late.length > 0 && <div className="text-danger">{o.late.length} devoir{o.late.length > 1 ? "s" : ""} en retard</div>}
            {o.dueTomorrow.map((h) => (
              <div key={h.id} className="truncate text-ink-2">
                <span className="font-mono text-[11px] uppercase tracking-wider text-amber">Demain · {h.subject}</span> {h.title}
              </div>
            ))}
          </div>
        )}
      </Link>

      <section aria-label="Travail sur 7 jours" className="panel flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium">Travail · 7 derniers jours</h2>
          <div className="font-mono text-xs text-cyan">{fmtHours(s.weekWorkH)}</div>
        </div>
        <WeekBars bars={s.week} targetH={s.workTargetH} />
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section aria-label="Sommeil" className="panel flex flex-col gap-1.5 border-violet/25 p-3.5">
          <div className="text-[13px] text-muted">Sommeil moyen</div>
          <div className="text-2xl font-semibold tracking-tight">{s.avgSleepH == null ? "—" : fmtHours(s.avgSleepH)}</div>
          <div className="text-xs text-violet-soft">
            {sleepGap == null ? "Pas encore de nuit enregistrée" : sleepGap >= 0 ? "Objectif tenu" : `− ${fmtMinutes(-sleepGap)} sur l'objectif`}
          </div>
        </section>
        <section aria-label="Sport" className="panel flex flex-col gap-1.5 border-mint/25 p-3.5">
          <div className="text-[13px] text-muted">Sport cette semaine</div>
          <div className="text-2xl font-semibold tracking-tight">
            {s.sportThisWeek} séance{s.sportThisWeek > 1 ? "s" : ""}
          </div>
          <div className="text-xs text-mint">{sportLeft === 0 ? "Objectif atteint" : `Encore ${sportLeft} d'ici dimanche`}</div>
        </section>
      </div>

      {s.todayBySubject.length > 0 && (
        <section aria-label="Aujourd'hui par matière" className="panel flex flex-col gap-2 p-4">
          <h2 className="text-[15px] font-medium">Aujourd&apos;hui par matière</h2>
          {s.todayBySubject.map((x) => (
            <div key={x.subject} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-sm text-ink-2">{x.subject}</div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#18222E]">
                <div className="h-full rounded-full bg-cyan" style={{ width: `${Math.min(100, (x.minutes / s.todayWorkMin) * 100)}%` }} />
              </div>
              <div className="w-16 text-right font-mono text-xs text-muted">{fmtMinutes(x.minutes)}</div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
