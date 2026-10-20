import Link from "next/link";
import {
  addHomework,
  addSlot,
  addTodo,
  clearDoneTodos,
  deleteHomework,
  deleteSlot,
  deleteTodo,
  toggleHomework,
  toggleTodo,
} from "@/app/actions";
import { KIND_COLOR, minutesBetween } from "@/lib/orga";
import { store } from "@/lib/store";
import { addDays, fmtMinutes, mondayOf, parisDay, parisTime, weekdayIndex } from "@/lib/time";
import { SLOT_KINDS, SUBJECTS, type Homework } from "@/lib/types";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const VIEWS = [
  { key: "edt", label: "Planning" },
  { key: "todo", label: "À faire" },
  { key: "devoirs", label: "Devoirs" },
] as const;
type View = (typeof VIEWS)[number]["key"];

export default async function Orga({ searchParams }: PageProps<"/orga">) {
  const sp = await searchParams;
  const view: View = VIEWS.some((v) => v.key === sp.vue) ? (sp.vue as View) : "edt";
  const today = parisDay();
  const [slots, todos, homework] = await Promise.all([store.listSlots(), store.listTodos(), store.listHomework(today)]);
  const openTodos = todos.filter((t) => !t.done).length;
  const openHomework = homework.filter((h) => !h.done).length;
  const counts: Record<View, number | null> = { edt: null, todo: openTodos, devoirs: openHomework };

  return (
    <>
      <header className="pt-6">
        <div className="label text-cyan">Organisation</div>
        <h1 className="mt-1.5 text-[28px] font-medium tracking-tight">Votre semaine, Monsieur.</h1>
      </header>

      <nav aria-label="Vues" className="panel grid grid-cols-3 gap-1 p-1">
        {VIEWS.map((v) => {
          const active = v.key === view;
          return (
            <Link
              key={v.key}
              href={`/orga?vue=${v.key}`}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] px-1 text-center text-[13px] leading-tight transition-colors ${
                active ? "bg-cyan/12 text-ink shadow-[inset_0_0_0_1px_rgb(92_225_255/0.55)]" : "text-muted hover:text-ink-2"
              }`}
            >
              {v.label}
              {counts[v.key] ? (
                <span className={`font-mono text-[11px] ${active ? "text-cyan" : "text-faint"}`}>{counts[v.key]}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {view === "edt" && <Timetable slots={slots} today={today} day={sp.jour} />}
      {view === "todo" && <Todos todos={todos} />}
      {view === "devoirs" && <Devoirs homework={homework} today={today} />}
    </>
  );
}

// ---------- Emploi du temps ----------

function Timetable({
  slots,
  today,
  day,
}: {
  slots: Awaited<ReturnType<typeof store.listSlots>>;
  today: string;
  day: string | string[] | undefined;
}) {
  const todayIdx = weekdayIndex(today);
  const n = Number(day);
  const sel = Number.isInteger(n) && n >= 0 && n <= 6 ? n : todayIdx;
  const isToday = sel === todayIdx;
  const now = parisTime();
  const list = slots.filter((s) => s.weekday === sel);
  const monday = mondayOf(today);
  const total = list.reduce((a, s) => a + minutesBetween(s.start, s.end), 0);

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5" role="tablist" aria-label="Jour">
        {DAYS.map((d, i) => {
          const active = i === sel;
          const has = slots.some((s) => s.weekday === i);
          const date = Number(addDays(monday, i).slice(8, 10));
          return (
            <Link
              key={d}
              href={`/orga?vue=edt&jour=${i}`}
              role="tab"
              aria-selected={active}
              aria-label={d}
              className={`flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl border transition-colors ${
                active ? "border-cyan/70 bg-cyan/10 text-ink" : "border-white/[0.07] bg-panel text-muted hover:text-ink-2"
              }`}
            >
              <span className="font-mono text-[10px] tracking-widest">{d.slice(0, 3).toUpperCase()}</span>
              <span className={`text-[15px] font-medium ${i === todayIdx ? "text-cyan" : ""}`}>{date}</span>
              <span className={`h-1 w-1 rounded-full ${has ? (active ? "bg-cyan" : "bg-faint") : "bg-transparent"}`} />
            </Link>
          );
        })}
      </div>

      <section aria-label={`Cours du ${DAYS[sel].toLowerCase()}`} className="panel flex flex-col p-4">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium">{isToday ? "Aujourd'hui" : DAYS[sel]}</h2>
          {list.length > 0 && <span className="font-mono text-xs text-muted">{fmtMinutes(total)} de cours</span>}
        </div>

        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Aucun cours ce jour, Monsieur.</p>
        ) : (
          <ol className="flex flex-col">
            {list.map((s, i) => {
              const color = KIND_COLOR[s.kind] ?? KIND_COLOR.Autre;
              const live = isToday && s.start <= now && now < s.end;
              const past = isToday && s.end <= now;
              const isNext = isToday && !live && s.start > now && !list.slice(0, i).some((x) => x.start > now);
              return (
                <li key={s.id} className={`flex items-stretch gap-3 ${past ? "opacity-45" : ""}`}>
                  <div className="flex w-12 shrink-0 flex-col pt-2.5 font-mono text-[12px] leading-5">
                    <span className="text-ink-2">{s.start}</span>
                    <span className="text-faint">{s.end}</span>
                  </div>
                  <div className="relative flex w-3 shrink-0 justify-center">
                    <span className="absolute inset-y-0 w-px bg-white/[0.08]" />
                    <span
                      className="relative mt-3.5 h-2.5 w-2.5 rounded-full border-2"
                      style={{ borderColor: color, background: live ? color : "#05080D", boxShadow: live ? `0 0 12px ${color}` : undefined }}
                    />
                  </div>
                  <div
                    className="my-1 flex flex-1 items-center justify-between gap-2 rounded-2xl border px-3 py-2"
                    style={{ borderColor: live ? `${color}88` : "rgb(255 255 255 / 0.06)", background: live ? `${color}14` : "#0E1620" }}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[15px]">{s.subject}</div>
                      <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span style={{ color }}>{s.kind}</span>
                        {s.room && <span>· {s.room}</span>}
                        {live && <span className="text-ink-2">· en cours</span>}
                        {isNext && <span className="text-ink-2">· dans {fmtMinutes(minutesBetween(now, s.start))}</span>}
                      </div>
                    </div>
                    <form action={deleteSlot.bind(null, s.id)}>
                      <button aria-label={`Supprimer ${s.subject} ${s.start}`} className="flex h-11 w-9 items-center justify-center text-faint hover:text-danger">
                        ×
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <details className="panel group p-4" open={slots.length === 0}>
        <summary className="cursor-pointer list-none text-[15px] font-medium">
          <span className="text-cyan">+</span> Ajouter un créneau
        </summary>
        <p className="mt-1 text-xs text-muted">Il revient chaque semaine, le même jour.</p>
        <form action={addSlot} className="mt-3 grid grid-cols-2 gap-2">
          <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
            Jour
            <select name="weekday" defaultValue={sel} className="field">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Début
            <input name="start" type="time" defaultValue="08:00" required className="field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Fin
            <input name="end" type="time" defaultValue="10:00" required className="field" />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
            Matière
            <input name="subject" list="orga-subjects" required placeholder="Maths, Physique…" className="field" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Type
            <select name="kind" className="field">
              {SLOT_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Salle
            <input name="room" placeholder="facultatif" className="field" />
          </label>
          <button className="btn btn-primary col-span-2 mt-1">Ajouter au planning</button>
          <datalist id="orga-subjects">
            {SUBJECTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </form>
      </details>
    </>
  );
}

// ---------- À faire ----------

function Check({ done, action, label, color = "#5CE1FF" }: { done: boolean; action: () => Promise<void>; label: string; color?: string }) {
  return (
    <form action={action}>
      <button
        aria-label={label}
        aria-pressed={done}
        className="flex h-11 w-9 shrink-0 items-center justify-center"
      >
        <span
          className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] transition-colors"
          style={{ borderColor: done ? color : "rgb(255 255 255 / 0.25)", background: done ? `${color}26` : "transparent" }}
        >
          {done && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          )}
        </span>
      </button>
    </form>
  );
}

function Todos({ todos }: { todos: Awaited<ReturnType<typeof store.listTodos>> }) {
  const open = todos.filter((t) => !t.done);
  const done = todos.filter((t) => t.done).reverse();
  return (
    <>
      <form action={addTodo} className="panel flex gap-2 p-2 pl-3">
        <label className="sr-only" htmlFor="todo-title">Nouvelle tâche</label>
        <input id="todo-title" name="title" required placeholder="Nouvelle tâche…" autoComplete="off" className="field border-transparent bg-transparent px-1" />
        <button className="btn btn-primary shrink-0">Ajouter</button>
      </form>

      <section aria-label="Tâches à faire" className="panel flex flex-col p-2">
        {open.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Rien en attente, Monsieur. Impeccable.</p>
        ) : (
          open.map((t) => (
            <div key={t.id} className="fade-up flex items-center gap-1 border-b border-white/[0.05] last:border-0">
              <Check done={false} action={toggleTodo.bind(null, t.id, true)} label={`Marquer « ${t.title} » comme fait`} />
              <span className="flex-1 py-2 text-[15px] leading-snug">{t.title}</span>
              <form action={deleteTodo.bind(null, t.id)}>
                <button aria-label={`Supprimer « ${t.title} »`} className="flex h-11 w-9 items-center justify-center text-faint hover:text-danger">
                  ×
                </button>
              </form>
            </div>
          ))
        )}
      </section>

      {done.length > 0 && (
        <details className="panel p-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-2 text-sm text-muted">
            <span>Terminées · {done.length}</span>
            <span className="text-faint">afficher</span>
          </summary>
          {done.map((t) => (
            <div key={t.id} className="flex items-center gap-1">
              <Check done action={toggleTodo.bind(null, t.id, false)} label={`Remettre « ${t.title} » à faire`} color="#4BE3A6" />
              <span className="flex-1 py-2 text-[15px] text-faint line-through">{t.title}</span>
            </div>
          ))}
          <form action={clearDoneTodos} className="px-2 pb-1 pt-2">
            <button className="btn btn-ghost w-full text-sm">Effacer les tâches terminées</button>
          </form>
        </details>
      )}
    </>
  );
}

// ---------- Devoirs ----------

function dueLabel(due: string, today: string): string {
  if (due < today) return "En retard";
  if (due === today) return "Pour aujourd'hui";
  if (due === addDays(today, 1)) return "Pour demain";
  const d = new Date(due + "T12:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  return `Pour ${d}`;
}

function Devoirs({ homework, today }: { homework: Homework[]; today: string }) {
  const sunday = addDays(mondayOf(today), 6);
  const week = homework.filter((h) => h.due >= today && h.due <= sunday);
  const weekDone = week.filter((h) => h.done).length;
  const pct = week.length ? weekDone / week.length : 0;

  // Group: late ones together, then one group per due day.
  const groups = new Map<string, Homework[]>();
  for (const h of homework) {
    const key = h.due < today ? "late" : h.due;
    groups.set(key, [...(groups.get(key) ?? []), h]);
  }

  return (
    <>
      <section aria-label="Cette semaine" className="panel flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[15px] font-medium">Cette semaine</h2>
          <span className="font-mono text-xs text-cyan">
            {weekDone} / {week.length} faits
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#18222E]">
          <div className="h-full rounded-full bg-cyan shadow-[0_0_10px_#5CE1FF]" style={{ width: `${pct * 100}%` }} />
        </div>
        <p className="text-xs text-muted">
          {week.length === 0
            ? "Aucun devoir à rendre d'ici dimanche."
            : weekDone === week.length
              ? "Tout est prêt pour la semaine, Monsieur."
              : `Encore ${week.length - weekDone} à boucler d'ici dimanche.`}
        </p>
      </section>

      <details className="panel group p-4" open={homework.length === 0}>
        <summary className="cursor-pointer list-none text-[15px] font-medium">
          <span className="text-cyan">+</span> Ajouter un devoir
        </summary>
        <form action={addHomework} className="mt-3 grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            Matière
            <select name="subject" className="field">
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Pour le
            <input name="due" type="date" required defaultValue={addDays(today, 1)} className="field" />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-xs text-muted">
            Travail à faire
            <input name="title" required placeholder="DM n°4, exercices 3 à 7…" autoComplete="off" className="field" />
          </label>
          <button className="btn btn-primary col-span-2 mt-1">Ajouter le devoir</button>
        </form>
      </details>

      {[...groups.entries()].map(([key, list]) => {
        const late = key === "late";
        return (
          <section key={key} aria-label={dueLabel(list[0].due, today)} className={`panel flex flex-col p-2 ${late ? "border-danger/40" : ""}`}>
            <h2 className={`label px-2 pb-1 pt-2 ${late ? "text-danger" : key === today ? "text-amber" : "text-muted"}`}>
              {dueLabel(list[0].due, today)}
            </h2>
            {list.map((h) => (
              <div key={h.id} className="flex items-center gap-1 border-b border-white/[0.05] last:border-0">
                <Check
                  done={h.done}
                  action={toggleHomework.bind(null, h.id, !h.done)}
                  label={h.done ? `Remettre « ${h.title} » à faire` : `Marquer « ${h.title} » comme fait`}
                  color="#4BE3A6"
                />
                <div className={`min-w-0 flex-1 py-2 ${h.done ? "opacity-50" : ""}`}>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-cyan-soft">
                    {h.subject}
                    {late && <span className="text-danger"> · {new Date(h.due + "T12:00:00Z").toLocaleDateString("fr-FR", { timeZone: "UTC", day: "numeric", month: "short" })}</span>}
                  </div>
                  <div className={`text-[15px] leading-snug ${h.done ? "text-faint line-through" : ""}`}>{h.title}</div>
                </div>
                <form action={deleteHomework.bind(null, h.id)}>
                  <button aria-label={`Supprimer « ${h.title} »`} className="flex h-11 w-9 items-center justify-center text-faint hover:text-danger">
                    ×
                  </button>
                </form>
              </div>
            ))}
          </section>
        );
      })}
    </>
  );
}
