import "server-only";
import { store } from "./store";
import { addDays, parisDay, parisTime, weekdayIndex } from "./time";
import type { ClassSlot, Homework } from "./types";

/** Accent colour for each kind of class. */
export const KIND_COLOR: Record<string, string> = {
  Cours: "#5CE1FF",
  TD: "#9D8CFF",
  TP: "#4BE3A6",
  Colle: "#FFB547",
  DS: "#FF7A7A",
  Autre: "#8A97A8",
};

export type OrgaToday = {
  today: string;
  slotsToday: ClassSlot[];
  current: ClassSlot | null;
  next: ClassSlot | null;
  dueTomorrow: Homework[]; // not done yet
  late: Homework[]; // past due, not done
  openTodos: number;
};

export async function getOrgaToday(now = new Date()): Promise<OrgaToday> {
  const today = parisDay(now);
  const time = parisTime(now);
  const [slots, homework, todos] = await Promise.all([store.listSlots(), store.listHomework(today), store.listTodos()]);
  const slotsToday = slots.filter((s) => s.weekday === weekdayIndex(today));
  const tomorrow = addDays(today, 1);
  return {
    today,
    slotsToday,
    current: slotsToday.find((s) => s.start <= time && time < s.end) ?? null,
    next: slotsToday.find((s) => s.start > time) ?? null,
    dueTomorrow: homework.filter((h) => !h.done && h.due === tomorrow),
    late: homework.filter((h) => !h.done && h.due < today),
    openTodos: todos.filter((t) => !t.done).length,
  };
}

/** Minutes from "HH:MM" a to "HH:MM" b. */
export function minutesBetween(a: string, b: string): number {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return m(b) - m(a);
}
