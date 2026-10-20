import "server-only";
import { store } from "./store";
import { addDays, mondayOf, parisDay, shortWeekday } from "./time";
import type { Settings, SleepLog } from "./types";

export type DayBar = { day: string; label: string; hours: number; isToday: boolean };

export type Summary = {
  today: string;
  settings: Settings;
  workTargetH: number;
  todayWorkMin: number;
  todayBySubject: { subject: string; minutes: number }[];
  week: DayBar[]; // last 7 days, oldest first
  weekWorkH: number;
  lastNightH: number | null;
  avgSleepH: number | null; // last 7 completed nights
  sleeping: SleepLog | null; // a night started but not ended
  sportThisWeek: number;
  sportToday: { activity: string; minutes: number }[];
};

const hoursBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;

export async function getSummary(now = new Date()): Promise<Summary> {
  const today = parisDay(now);
  const from = addDays(today, -7);
  const sinceIso = new Date(from + "T00:00:00Z").toISOString();

  const [settings, work, sleep, sport] = await Promise.all([
    store.getSettings(),
    store.listWork(sinceIso),
    store.listSleep(new Date(addDays(today, -10) + "T00:00:00Z").toISOString()),
    store.listSport(addDays(mondayOf(today), -7)),
  ]);

  // Work per Paris day, with the running timer counted for today.
  const perDay = new Map<string, number>();
  const bySubject = new Map<string, number>();
  for (const w of work) {
    const d = parisDay(w.start);
    perDay.set(d, (perDay.get(d) ?? 0) + w.minutes);
    if (d === today) bySubject.set(w.subject, (bySubject.get(w.subject) ?? 0) + w.minutes);
  }
  if (settings.timer) {
    const running = Math.max(0, (now.getTime() - new Date(settings.timer.startedAt).getTime()) / 60000);
    perDay.set(today, (perDay.get(today) ?? 0) + running);
    bySubject.set(settings.timer.subject, (bySubject.get(settings.timer.subject) ?? 0) + running);
  }

  const week: DayBar[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(today, -i);
    week.push({ day: d, label: shortWeekday(d), hours: (perDay.get(d) ?? 0) / 60, isToday: i === 0 });
  }

  // Sleep: a night belongs to the day you wake up.
  const done = sleep.filter((s) => s.wake);
  const lastNight = [...done].reverse().find((s) => parisDay(s.wake!) === today);
  const recent = done.filter((s) => parisDay(s.wake!) > addDays(today, -7));
  const avg = recent.length
    ? recent.reduce((t, s) => t + hoursBetween(s.bed, s.wake!), 0) / recent.length
    : null;
  const open = [...sleep].reverse().find((s) => !s.wake) ?? null;

  const monday = mondayOf(today);
  return {
    today,
    settings,
    workTargetH: settings.holidayMode ? settings.targets.workHoliday : settings.targets.workSchool,
    todayWorkMin: perDay.get(today) ?? 0,
    todayBySubject: [...bySubject].map(([subject, minutes]) => ({ subject, minutes })).sort((a, b) => b.minutes - a.minutes),
    week,
    weekWorkH: week.reduce((t, b) => t + b.hours, 0),
    lastNightH: lastNight ? hoursBetween(lastNight.bed, lastNight.wake!) : null,
    avgSleepH: avg,
    sleeping: open,
    sportThisWeek: sport.filter((s) => s.day >= monday).length,
    sportToday: sport.filter((s) => s.day === today).map((s) => ({ activity: s.activity, minutes: s.minutes })),
  };
}
