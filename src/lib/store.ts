import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import {
  DEFAULT_SETTINGS,
  type PushSub,
  type Settings,
  type SleepLog,
  type SportSession,
  type WorkSession,
} from "./types";

// Jarvis stores its data in Postgres (Supabase) when a database URL is set,
// and in a local JSON file otherwise (handy on a computer, for development).

export interface Store {
  listWork(sinceIso: string): Promise<WorkSession[]>;
  addWork(w: Omit<WorkSession, "id">): Promise<void>;
  deleteWork(id: string): Promise<void>;
  listSleep(sinceIso: string): Promise<SleepLog[]>;
  addSleep(s: Omit<SleepLog, "id">): Promise<void>;
  setWake(id: string, wakeIso: string): Promise<void>;
  deleteSleep(id: string): Promise<void>;
  listSport(sinceDay: string): Promise<SportSession[]>;
  addSport(s: Omit<SportSession, "id">): Promise<void>;
  deleteSport(id: string): Promise<void>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  listPush(): Promise<PushSub[]>;
  savePush(p: PushSub): Promise<void>;
  deletePush(endpoint: string): Promise<void>;
}

// Integrations may add a prefix (e.g. STORAGE_POSTGRES_URL), so look for any matching name.
export function dbEnvName(): string | null {
  const keys = Object.keys(process.env).filter((k) => process.env[k]);
  const pick = (re: RegExp) => keys.filter((k) => re.test(k)).sort((a, b) => a.length - b.length)[0];
  return (
    pick(/(^|_)POSTGRES_URL$/) ??
    pick(/(^|_)DATABASE_URL$/) ??
    pick(/(^|_)SUPABASE_DB_URL$/) ??
    pick(/(^|_)POSTGRES_URL_NON_POOLING$/) ??
    null
  );
}

export const dbUrl = () => {
  const name = dbEnvName();
  return name ? process.env[name]! : "";
};

/** Runs a trivial query; used by the diagnostic page. */
export async function pingDb(): Promise<void> {
  await ensureSchema();
  await pg()`select 1`;
}

// ---------- Postgres ----------

let sql: postgres.Sql | null = null;
let ready: Promise<void> | null = null;

function pg(): postgres.Sql {
  if (!sql) {
    // prepare: false keeps it compatible with Supabase's connection pooler.
    // Hosted URLs carry extra query flags (e.g. "supa=…") that Postgres would reject.
    const url = new URL(dbUrl());
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    url.search = "";
    sql = postgres(url.toString(), { prepare: false, max: 3, idle_timeout: 20, onnotice: () => {}, ssl: local ? false : "require" });
  }
  return sql;
}

// Tables are created automatically on first use: nothing to paste in Supabase.
async function ensureSchema() {
  if (!ready) {
    const s = pg();
    ready = (async () => {
      await s`create table if not exists work_sessions (
        id text primary key, subject text not null,
        start timestamptz not null, minutes integer not null)`;
      await s`create table if not exists sleep_logs (
        id text primary key, bed timestamptz not null, wake timestamptz)`;
      await s`create table if not exists sport_sessions (
        id text primary key, day date not null,
        activity text not null, minutes integer not null)`;
      await s`create table if not exists app_settings (
        id integer primary key, data jsonb not null)`;
      await s`create table if not exists push_subscriptions (
        endpoint text primary key, data jsonb not null)`;
      // Only the server talks to the database: lock tables against the public API.
      for (const t of ["work_sessions", "sleep_logs", "sport_sessions", "app_settings", "push_subscriptions"]) {
        await s.unsafe(`alter table ${t} enable row level security`);
      }
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const day = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

const pgStore: Store = {
  async listWork(since) {
    await ensureSchema();
    const rows = await pg()`select * from work_sessions where start >= ${since} order by start`;
    return rows.map((r) => ({ id: r.id, subject: r.subject, start: iso(r.start), minutes: r.minutes }));
  },
  async addWork(w) {
    await ensureSchema();
    await pg()`insert into work_sessions ${pg()({ id: randomUUID(), ...w })}`;
  },
  async deleteWork(id) {
    await ensureSchema();
    await pg()`delete from work_sessions where id = ${id}`;
  },
  async listSleep(since) {
    await ensureSchema();
    const rows = await pg()`select * from sleep_logs where bed >= ${since} order by bed`;
    return rows.map((r) => ({ id: r.id, bed: iso(r.bed), wake: r.wake ? iso(r.wake) : null }));
  },
  async addSleep(s) {
    await ensureSchema();
    await pg()`insert into sleep_logs ${pg()({ id: randomUUID(), bed: s.bed, wake: s.wake })}`;
  },
  async setWake(id, wake) {
    await ensureSchema();
    await pg()`update sleep_logs set wake = ${wake} where id = ${id}`;
  },
  async deleteSleep(id) {
    await ensureSchema();
    await pg()`delete from sleep_logs where id = ${id}`;
  },
  async listSport(since) {
    await ensureSchema();
    const rows = await pg()`select * from sport_sessions where day >= ${since} order by day`;
    return rows.map((r) => ({ id: r.id, day: day(r.day), activity: r.activity, minutes: r.minutes }));
  },
  async addSport(s) {
    await ensureSchema();
    await pg()`insert into sport_sessions ${pg()({ id: randomUUID(), ...s })}`;
  },
  async deleteSport(id) {
    await ensureSchema();
    await pg()`delete from sport_sessions where id = ${id}`;
  },
  async getSettings() {
    await ensureSchema();
    const rows = await pg()`select data from app_settings where id = 1`;
    return { ...DEFAULT_SETTINGS, ...(rows[0]?.data ?? {}) };
  },
  async saveSettings(s) {
    await ensureSchema();
    await pg()`insert into app_settings (id, data) values (1, ${pg().json(s as never)})
      on conflict (id) do update set data = excluded.data`;
  },
  async listPush() {
    await ensureSchema();
    const rows = await pg()`select data from push_subscriptions`;
    return rows.map((r) => r.data as PushSub);
  },
  async savePush(p) {
    await ensureSchema();
    await pg()`insert into push_subscriptions (endpoint, data) values (${p.endpoint}, ${pg().json(p as never)})
      on conflict (endpoint) do update set data = excluded.data`;
  },
  async deletePush(endpoint) {
    await ensureSchema();
    await pg()`delete from push_subscriptions where endpoint = ${endpoint}`;
  },
};

// ---------- Local JSON file ----------

type FileDb = {
  work: WorkSession[];
  sleep: SleepLog[];
  sport: SportSession[];
  settings: Settings;
  push: PushSub[];
};

const FILE = path.join(process.cwd(), ".data", "jarvis.json");

async function load(): Promise<FileDb> {
  try {
    const db = JSON.parse(await fs.readFile(FILE, "utf8")) as FileDb;
    return { ...db, settings: { ...DEFAULT_SETTINGS, ...db.settings } };
  } catch {
    return { work: [], sleep: [], sport: [], settings: DEFAULT_SETTINGS, push: [] };
  }
}

async function save(db: FileDb) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db, null, 2));
}

async function edit(fn: (db: FileDb) => void) {
  const db = await load();
  fn(db);
  await save(db);
}

const fileStore: Store = {
  async listWork(since) {
    return (await load()).work.filter((w) => w.start >= since).sort((a, b) => a.start.localeCompare(b.start));
  },
  addWork: (w) => edit((db) => void db.work.push({ id: randomUUID(), ...w })),
  deleteWork: (id) => edit((db) => void (db.work = db.work.filter((w) => w.id !== id))),
  async listSleep(since) {
    return (await load()).sleep.filter((s) => s.bed >= since).sort((a, b) => a.bed.localeCompare(b.bed));
  },
  addSleep: (s) => edit((db) => void db.sleep.push({ id: randomUUID(), ...s })),
  setWake: (id, wake) =>
    edit((db) => {
      const s = db.sleep.find((x) => x.id === id);
      if (s) s.wake = wake;
    }),
  deleteSleep: (id) => edit((db) => void (db.sleep = db.sleep.filter((s) => s.id !== id))),
  async listSport(since) {
    return (await load()).sport.filter((s) => s.day >= since).sort((a, b) => a.day.localeCompare(b.day));
  },
  addSport: (s) => edit((db) => void db.sport.push({ id: randomUUID(), ...s })),
  deleteSport: (id) => edit((db) => void (db.sport = db.sport.filter((s) => s.id !== id))),
  async getSettings() {
    return (await load()).settings;
  },
  saveSettings: (s) => edit((db) => void (db.settings = s)),
  async listPush() {
    return (await load()).push;
  },
  savePush: (p) =>
    edit((db) => {
      db.push = db.push.filter((x) => x.endpoint !== p.endpoint);
      db.push.push(p);
    }),
  deletePush: (endpoint) => edit((db) => void (db.push = db.push.filter((x) => x.endpoint !== endpoint))),
};

export const store: Store = dbUrl() ? pgStore : fileStore;
export const hasDatabase = () => Boolean(dbUrl());
