import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import {
  DEFAULT_SETTINGS,
  type ClassSlot,
  type Homework,
  type PushSub,
  type Settings,
  type SleepLog,
  type SportSession,
  type Todo,
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
  listSlots(): Promise<ClassSlot[]>;
  addSlot(x: Omit<ClassSlot, "id">): Promise<void>;
  deleteSlot(id: string): Promise<void>;
  listTodos(): Promise<Todo[]>;
  addTodo(x: Omit<Todo, "id">): Promise<void>;
  setTodoDone(id: string, done: boolean): Promise<void>;
  deleteTodo(id: string): Promise<void>;
  listHomework(sinceDay: string): Promise<Homework[]>;
  addHomework(x: Omit<Homework, "id">): Promise<void>;
  setHomeworkDone(id: string, done: boolean): Promise<void>;
  deleteHomework(id: string): Promise<void>;
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

/** Database sessions that are busy or waiting (for the diagnostic page). */
export async function busySessions(): Promise<string[]> {
  const rows = await q(
    (s) => s`select pid, state, wait_event_type as w, now() - query_start as age, left(query, 70) as query
      from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid()
        and state is not null and state <> 'idle'`
  );
  return rows.map((r) => `${r.pid} ${r.state} ${r.w ?? ""} ${String(r.age)} ${r.query}`);
}

/** Runs a trivial query; used by the diagnostic page. */
export async function pingDb(): Promise<void> {
  await q((s) => s`select 1`);
}

// ---------- Postgres ----------

// On Vercel the function can be frozen between visits, which silently kills open
// database sockets. So each operation opens its own short connection and closes it.
function client(): postgres.Sql {
  // Hosted URLs carry extra query flags (e.g. "supa=…") that Postgres would reject.
  const url = new URL(dbUrl());
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  url.search = "";
  // prepare: false keeps it compatible with Supabase's connection pooler.
  return postgres(url.toString(), {
    prepare: false,
    max: 1,
    connect_timeout: 10,
    onnotice: () => {},
    ssl: local ? false : "require",
  });
}

// Shared by parallel queries, so the tables are only checked once per process.
let schemaReady: Promise<void> | null = null;

async function q<T>(fn: (s: postgres.Sql) => Promise<T>): Promise<T> {
  const s = client();
  try {
    schemaReady ??= ensureSchema(s).catch((e) => {
      schemaReady = null;
      throw e;
    });
    await schemaReady;
    return await fn(s);
  } finally {
    s.end({ timeout: 2 }).catch(() => {});
  }
}

// Tables are created automatically on first use: nothing to paste in Supabase.
const TABLES: Record<string, string> = {
  work_sessions:
    "create table if not exists work_sessions (id text primary key, subject text not null, start timestamptz not null, minutes integer not null)",
  sleep_logs: "create table if not exists sleep_logs (id text primary key, bed timestamptz not null, wake timestamptz)",
  sport_sessions:
    "create table if not exists sport_sessions (id text primary key, day date not null, activity text not null, minutes integer not null)",
  app_settings: "create table if not exists app_settings (id integer primary key, data jsonb not null)",
  push_subscriptions: "create table if not exists push_subscriptions (endpoint text primary key, data jsonb not null)",
  class_slots:
    "create table if not exists class_slots (id text primary key, weekday integer not null, start text not null, \"end\" text not null, subject text not null, kind text not null, room text not null default '')",
  todos: "create table if not exists todos (id text primary key, title text not null, done boolean not null default false, created timestamptz not null)",
  homework:
    "create table if not exists homework (id text primary key, subject text not null, title text not null, due date not null, done boolean not null default false)",
};

async function ensureSchema(s: postgres.Sql) {
  const names = Object.keys(TABLES);
  // Which tables exist, and is row level security already on?
  const rows = await s`select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname in ${s(names)}`;
  const have = new Map(rows.map((r) => [r.name as string, r.rls as boolean]));
  const missing = names.filter((n) => !have.has(n));
  const noRls = names.filter((n) => have.get(n) !== true);
  if (!missing.length && !noRls.length) return;

  // DDL takes locks: never wait more than a few seconds for them.
  // Another server instance may create the same table at the same moment: that is fine.
  for (const n of missing) {
    try {
      await s.begin(async (t) => {
        await t`set local lock_timeout = '5s'`;
        await t.unsafe(TABLES[n]);
      });
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "23505" && code !== "42P07") throw e;
    }
  }
  try {
    // Only the server talks to the database: lock tables against Supabase's public API.
    await s.begin(async (t) => {
      await t`set local lock_timeout = '5s'`;
      for (const n of noRls) await t.unsafe(`alter table ${n} enable row level security`);
    });
  } catch (e) {
    console.error("RLS not enabled yet", e);
  }
}

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));
const day = (v: unknown) =>
  v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);

const pgStore: Store = {
  listWork: (since) =>
    q(async (s) => {
      const rows = await s`select * from work_sessions where start >= ${since} order by start`;
      return rows.map((r) => ({ id: r.id, subject: r.subject, start: iso(r.start), minutes: r.minutes }));
    }),
  addWork: (w) => q(async (s) => void (await s`insert into work_sessions ${s({ id: randomUUID(), ...w })}`)),
  deleteWork: (id) => q(async (s) => void (await s`delete from work_sessions where id = ${id}`)),
  listSleep: (since) =>
    q(async (s) => {
      const rows = await s`select * from sleep_logs where bed >= ${since} order by bed`;
      return rows.map((r) => ({ id: r.id, bed: iso(r.bed), wake: r.wake ? iso(r.wake) : null }));
    }),
  addSleep: (x) =>
    q(async (s) => void (await s`insert into sleep_logs ${s({ id: randomUUID(), bed: x.bed, wake: x.wake })}`)),
  setWake: (id, wake) => q(async (s) => void (await s`update sleep_logs set wake = ${wake} where id = ${id}`)),
  deleteSleep: (id) => q(async (s) => void (await s`delete from sleep_logs where id = ${id}`)),
  listSport: (since) =>
    q(async (s) => {
      const rows = await s`select * from sport_sessions where day >= ${since} order by day`;
      return rows.map((r) => ({ id: r.id, day: day(r.day), activity: r.activity, minutes: r.minutes }));
    }),
  addSport: (x) => q(async (s) => void (await s`insert into sport_sessions ${s({ id: randomUUID(), ...x })}`)),
  deleteSport: (id) => q(async (s) => void (await s`delete from sport_sessions where id = ${id}`)),
  getSettings: () =>
    q(async (s) => {
      const rows = await s`select data from app_settings where id = 1`;
      return { ...DEFAULT_SETTINGS, ...(rows[0]?.data ?? {}) };
    }),
  saveSettings: (x) =>
    q(
      async (s) =>
        void (await s`insert into app_settings (id, data) values (1, ${s.json(x as never)})
          on conflict (id) do update set data = excluded.data`)
    ),
  listPush: () =>
    q(async (s) => {
      const rows = await s`select data from push_subscriptions`;
      return rows.map((r) => r.data as PushSub);
    }),
  savePush: (x) =>
    q(
      async (s) =>
        void (await s`insert into push_subscriptions (endpoint, data) values (${x.endpoint}, ${s.json(x as never)})
          on conflict (endpoint) do update set data = excluded.data`)
    ),
  deletePush: (endpoint) => q(async (s) => void (await s`delete from push_subscriptions where endpoint = ${endpoint}`)),
  listSlots: () =>
    q(async (s) => {
      const rows = await s`select * from class_slots order by weekday, start`;
      return rows.map((r) => ({
        id: r.id,
        weekday: r.weekday,
        start: r.start,
        end: r.end,
        subject: r.subject,
        kind: r.kind,
        room: r.room,
      }));
    }),
  addSlot: (x) => q(async (s) => void (await s`insert into class_slots ${s({ id: randomUUID(), ...x })}`)),
  deleteSlot: (id) => q(async (s) => void (await s`delete from class_slots where id = ${id}`)),
  listTodos: () =>
    q(async (s) => {
      const rows = await s`select * from todos order by created`;
      return rows.map((r) => ({ id: r.id, title: r.title, done: r.done, created: iso(r.created) }));
    }),
  addTodo: (x) => q(async (s) => void (await s`insert into todos ${s({ id: randomUUID(), ...x })}`)),
  setTodoDone: (id, done) => q(async (s) => void (await s`update todos set done = ${done} where id = ${id}`)),
  deleteTodo: (id) => q(async (s) => void (await s`delete from todos where id = ${id}`)),
  listHomework: (since) =>
    q(async (s) => {
      // Undone homework stays visible even when it is late.
      const rows = await s`select * from homework where due >= ${since} or not done order by due`;
      return rows.map((r) => ({ id: r.id, subject: r.subject, title: r.title, due: day(r.due), done: r.done }));
    }),
  addHomework: (x) => q(async (s) => void (await s`insert into homework ${s({ id: randomUUID(), ...x })}`)),
  setHomeworkDone: (id, done) => q(async (s) => void (await s`update homework set done = ${done} where id = ${id}`)),
  deleteHomework: (id) => q(async (s) => void (await s`delete from homework where id = ${id}`)),
};

// ---------- Local JSON file ----------

type FileDb = {
  work: WorkSession[];
  sleep: SleepLog[];
  sport: SportSession[];
  settings: Settings;
  push: PushSub[];
  slots?: ClassSlot[];
  todos?: Todo[];
  homework?: Homework[];
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
  async listSlots() {
    return [...((await load()).slots ?? [])].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  },
  addSlot: (x) => edit((db) => void (db.slots = [...(db.slots ?? []), { id: randomUUID(), ...x }])),
  deleteSlot: (id) => edit((db) => void (db.slots = (db.slots ?? []).filter((x) => x.id !== id))),
  async listTodos() {
    return [...((await load()).todos ?? [])].sort((a, b) => a.created.localeCompare(b.created));
  },
  addTodo: (x) => edit((db) => void (db.todos = [...(db.todos ?? []), { id: randomUUID(), ...x }])),
  setTodoDone: (id, done) =>
    edit((db) => {
      const t = db.todos?.find((x) => x.id === id);
      if (t) t.done = done;
    }),
  deleteTodo: (id) => edit((db) => void (db.todos = (db.todos ?? []).filter((x) => x.id !== id))),
  async listHomework(since) {
    return ((await load()).homework ?? [])
      .filter((h) => h.due >= since || !h.done)
      .sort((a, b) => a.due.localeCompare(b.due));
  },
  addHomework: (x) => edit((db) => void (db.homework = [...(db.homework ?? []), { id: randomUUID(), ...x }])),
  setHomeworkDone: (id, done) =>
    edit((db) => {
      const h = db.homework?.find((x) => x.id === id);
      if (h) h.done = done;
    }),
  deleteHomework: (id) => edit((db) => void (db.homework = (db.homework ?? []).filter((x) => x.id !== id))),
};

// Never hang forever on the database: fail after 15 s with a clear message.
function withTimeout(st: Store): Store {
  const out = {} as Record<string, unknown>;
  for (const [name, fn] of Object.entries(st)) {
    out[name] = (...args: unknown[]) =>
      Promise.race([
        (fn as (...a: unknown[]) => Promise<unknown>)(...args),
        new Promise((_, rej) => setTimeout(() => rej(new Error(`Base de données : ${name} bloqué plus de 15 s`)), 15000)),
      ]);
  }
  return out as unknown as Store;
}

export const store: Store = dbUrl() ? withTimeout(pgStore) : fileStore;
export const hasDatabase = () => Boolean(dbUrl());
