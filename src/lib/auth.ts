import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { store } from "./store";

// One person, one access code. The code is chosen on first visit and stored hashed.

export const COOKIE = "jarvis_session";
const MAX_TOKENS = 10;

export function hashCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(code, salt, 32).toString("hex")}`;
}

export function checkCode(code: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const a = Buffer.from(hash, "hex");
  const b = scryptSync(code, salt, 32);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function newSession(): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const s = await store.getSettings();
  s.sessionTokens = [token, ...s.sessionTokens].slice(0, MAX_TOKENS);
  await store.saveSettings(s);
  return token;
}

export async function isAuthed(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return false;
  const s = await store.getSettings();
  return s.sessionTokens.includes(token);
}

export async function requireAuth() {
  if (!(await isAuthed())) redirect("/login");
}
