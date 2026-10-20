"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { COOKIE, checkCode, hashCode, isAuthed, newSession } from "@/lib/auth";
import { store } from "@/lib/store";
import { parisDay } from "@/lib/time";

async function guard() {
  if (!(await isAuthed())) redirect("/login");
}

function refresh() {
  revalidatePath("/", "layout");
}

const num = (v: FormDataEntryValue | null, min: number, max: number) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null;
};

// ---------- Access code ----------

export async function enter(_: unknown, form: FormData): Promise<{ error?: string }> {
  const code = String(form.get("code") ?? "");
  const s = await store.getSettings();
  if (!s.passwordHash) {
    if (code.length < 4) return { error: "Choisissez un code d'au moins 4 caractères." };
    if (code !== String(form.get("confirm") ?? "")) return { error: "Les deux codes ne correspondent pas." };
    s.passwordHash = hashCode(code);
    await store.saveSettings(s);
  } else if (!checkCode(code, s.passwordHash)) {
    return { error: "Code incorrect, Monsieur." };
  }
  const token = await newSession();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const s = await store.getSettings();
  s.sessionTokens = s.sessionTokens.filter((t) => t !== token);
  await store.saveSettings(s);
  jar.delete(COOKIE);
  redirect("/login");
}

// ---------- Work ----------

export async function startTimer(subject: string) {
  await guard();
  const s = await store.getSettings();
  if (s.timer) await saveRunning(s.timer);
  s.timer = { subject, startedAt: new Date().toISOString() };
  await store.saveSettings(s);
  refresh();
}

async function saveRunning(timer: { subject: string; startedAt: string }) {
  const minutes = Math.round((Date.now() - new Date(timer.startedAt).getTime()) / 60000);
  if (minutes >= 1) await store.addWork({ subject: timer.subject, start: timer.startedAt, minutes });
}

export async function stopTimer() {
  await guard();
  const s = await store.getSettings();
  if (s.timer) await saveRunning(s.timer);
  s.timer = null;
  await store.saveSettings(s);
  refresh();
}

export async function addWork(form: FormData) {
  await guard();
  const subject = String(form.get("subject") ?? "Autre");
  const minutes = (num(form.get("hours"), 0, 16) ?? 0) * 60 + (num(form.get("minutes"), 0, 59) ?? 0);
  if (minutes < 1) return;
  const start = new Date(Date.now() - minutes * 60000).toISOString();
  await store.addWork({ subject, start, minutes: Math.round(minutes) });
  refresh();
}

export async function deleteWork(id: string) {
  await guard();
  await store.deleteWork(id);
  refresh();
}

// ---------- Sleep ----------

export async function goToBed() {
  await guard();
  await store.addSleep({ bed: new Date().toISOString(), wake: null });
  refresh();
}

export async function wakeUp() {
  await guard();
  const recent = await store.listSleep(new Date(Date.now() - 20 * 3_600_000).toISOString());
  const open = [...recent].reverse().find((s) => !s.wake);
  if (open) await store.setWake(open.id, new Date().toISOString());
  refresh();
}

/** Log a night after the fact: "HH:MM" bed (previous evening) and wake (today). */
export async function addNight(form: FormData) {
  await guard();
  const bed = String(form.get("bed") ?? "");
  const wake = String(form.get("wake") ?? "");
  if (!/^\d\d:\d\d$/.test(bed) || !/^\d\d:\d\d$/.test(wake)) return;
  const today = parisDay();
  const toIso = (day: string, hm: string) => {
    // Interpret HH:MM in Paris time.
    const guess = new Date(`${day}T${hm}:00Z`);
    const paris = new Date(guess.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
    const offset = paris.getTime() - new Date(guess.toLocaleString("en-US", { timeZone: "UTC" })).getTime();
    return new Date(guess.getTime() - offset).toISOString();
  };
  const wakeIso = toIso(today, wake);
  let bedIso = toIso(today, bed);
  if (bedIso >= wakeIso) bedIso = new Date(new Date(bedIso).getTime() - 86_400_000).toISOString();
  await store.addSleep({ bed: bedIso, wake: wakeIso });
  refresh();
}

export async function deleteSleep(id: string) {
  await guard();
  await store.deleteSleep(id);
  refresh();
}

// ---------- Sport ----------

export async function addSport(form: FormData) {
  await guard();
  const activity = String(form.get("activity") ?? "").trim() || "Sport";
  const minutes = num(form.get("minutes"), 0, 600) ?? 0;
  await store.addSport({ day: parisDay(), activity, minutes: Math.round(minutes) });
  refresh();
}

export async function deleteSport(id: string) {
  await guard();
  await store.deleteSport(id);
  refresh();
}

// ---------- Settings ----------

export async function saveTargets(form: FormData) {
  await guard();
  const s = await store.getSettings();
  s.targets = {
    workSchool: num(form.get("workSchool"), 0, 16) ?? s.targets.workSchool,
    workHoliday: num(form.get("workHoliday"), 0, 16) ?? s.targets.workHoliday,
    sleepHours: num(form.get("sleepHours"), 4, 12) ?? s.targets.sleepHours,
    sportPerWeek: num(form.get("sportPerWeek"), 0, 14) ?? s.targets.sportPerWeek,
  };
  await store.saveSettings(s);
  refresh();
}

export async function setHolidayMode(on: boolean) {
  await guard();
  const s = await store.getSettings();
  s.holidayMode = on;
  await store.saveSettings(s);
  refresh();
}

// ---------- Organisation ----------

const hm = (v: FormDataEntryValue | null) => {
  const t = String(v ?? "");
  return /^\d\d:\d\d$/.test(t) ? t : null;
};

export async function addSlot(form: FormData) {
  await guard();
  const weekday = num(form.get("weekday"), 0, 6);
  const start = hm(form.get("start"));
  const end = hm(form.get("end"));
  const subject = String(form.get("subject") ?? "").trim();
  if (weekday == null || !start || !end || !subject || end <= start) return;
  await store.addSlot({
    weekday: Math.round(weekday),
    start,
    end,
    subject: subject.slice(0, 60),
    kind: String(form.get("kind") ?? "Cours").slice(0, 20),
    room: String(form.get("room") ?? "").trim().slice(0, 30),
  });
  refresh();
}

export async function deleteSlot(id: string) {
  await guard();
  await store.deleteSlot(id);
  refresh();
}

export async function addTodo(form: FormData) {
  await guard();
  const title = String(form.get("title") ?? "").trim();
  if (!title) return;
  await store.addTodo({ title: title.slice(0, 200), done: false, created: new Date().toISOString() });
  refresh();
}

export async function toggleTodo(id: string, done: boolean) {
  await guard();
  await store.setTodoDone(id, done);
  refresh();
}

export async function deleteTodo(id: string) {
  await guard();
  await store.deleteTodo(id);
  refresh();
}

export async function clearDoneTodos() {
  await guard();
  const done = (await store.listTodos()).filter((t) => t.done);
  for (const t of done) await store.deleteTodo(t.id);
  refresh();
}

export async function addHomework(form: FormData) {
  await guard();
  const title = String(form.get("title") ?? "").trim();
  const due = String(form.get("due") ?? "");
  if (!title || !/^\d{4}-\d\d-\d\d$/.test(due)) return;
  await store.addHomework({
    subject: String(form.get("subject") ?? "Autre").slice(0, 40),
    title: title.slice(0, 200),
    due,
    done: false,
  });
  refresh();
}

export async function toggleHomework(id: string, done: boolean) {
  await guard();
  await store.setHomeworkDone(id, done);
  refresh();
}

export async function deleteHomework(id: string) {
  await guard();
  await store.deleteHomework(id);
  refresh();
}
