export const SUBJECTS = [
  "Maths",
  "Physique",
  "Chimie",
  "SI",
  "Informatique",
  "Français-philo",
  "Anglais",
  "Autre",
] as const;
export type Subject = (typeof SUBJECTS)[number];

export type WorkSession = {
  id: string;
  subject: string;
  start: string; // ISO instant
  minutes: number;
};

export type SleepLog = {
  id: string;
  bed: string; // ISO instant
  wake: string | null; // ISO instant, null while asleep
};

export type SportSession = {
  id: string;
  day: string; // YYYY-MM-DD (Paris)
  activity: string;
  minutes: number;
};

export type Targets = {
  workSchool: number; // hours per day during term
  workHoliday: number; // hours per day during holidays
  sleepHours: number; // hours per night
  sportPerWeek: number; // sessions per week
};

export type Timer = { subject: string; startedAt: string } | null;

export type Settings = {
  targets: Targets;
  holidayMode: boolean;
  timer: Timer;
  passwordHash: string | null;
  sessionTokens: string[];
  cronSecret: string | null;
  vapid: { publicKey: string; privateKey: string } | null;
};

export const DEFAULT_SETTINGS: Settings = {
  targets: { workSchool: 4, workHoliday: 8, sleepHours: 7.5, sportPerWeek: 3 },
  holidayMode: false,
  timer: null,
  passwordHash: null,
  sessionTokens: [],
  cronSecret: null,
  vapid: null,
};

export type PushSub = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};
