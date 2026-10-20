import "server-only";
import { randomBytes } from "node:crypto";
import webpush from "web-push";
import { store } from "./store";

// Push keys and the cron secret are generated on first use and kept in the database,
// so there is nothing to configure by hand.

export async function getVapid() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  const s = await store.getSettings();
  if (!s.vapid) {
    s.vapid = webpush.generateVAPIDKeys();
    await store.saveSettings(s);
  }
  return s.vapid;
}

export async function getCronSecret(): Promise<string> {
  if (process.env.CRON_SECRET) return process.env.CRON_SECRET;
  const s = await store.getSettings();
  if (!s.cronSecret) {
    s.cronSecret = randomBytes(18).toString("hex");
    await store.saveSettings(s);
  }
  return s.cronSecret;
}

export async function sendToAll(payload: { title: string; body: string; url: string }) {
  const { publicKey, privateKey } = await getVapid();
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:jarvis@example.com", publicKey, privateKey);
  const subs = await store.listPush();
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      // Gone or not found: the phone dropped this subscription.
      if (code === 404 || code === 410) await store.deletePush(sub.endpoint);
      else console.error("push failed", code, e);
    }
  }
  return { sent, total: subs.length };
}
