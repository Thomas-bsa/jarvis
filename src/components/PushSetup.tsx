"use client";

import { useEffect, useState } from "react";

function toKey(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "install" | "off" | "on" | "denied";

export function PushSetup() {
  const [status, setStatus] = useState<Status>("loading");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        setStatus(ios && !standalone ? "install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  const enable = async () => {
    setBusy(true);
    setNote("");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { publicKey } = await (await fetch("/api/push/key")).json();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setStatus("on");
      setNote("Notifications activées.");
    } catch (e) {
      setNote(`Échec : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    setBusy(true);
    const r = await (await fetch("/api/push/test", { method: "POST" })).json();
    setNote(r.sent ? "Notification envoyée : regardez votre écran." : "Aucun appareil abonné.");
    setBusy(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {status === "install" && (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-ink-2">
          <li>Ouvrez ce site dans <b>Safari</b> sur votre iPhone.</li>
          <li>Touchez le bouton <b>Partager</b> (le carré avec une flèche vers le haut).</li>
          <li>Choisissez <b>« Sur l&apos;écran d&apos;accueil »</b>, puis <b>Ajouter</b>.</li>
          <li>Ouvrez Jarvis depuis sa nouvelle icône et revenez ici.</li>
        </ol>
      )}
      {status === "unsupported" && <p className="text-sm text-muted">Ce navigateur ne gère pas les notifications.</p>}
      {status === "denied" && (
        <p className="text-sm text-muted">
          Notifications refusées. Sur iPhone : Réglages › Notifications › Jarvis › Autoriser.
        </p>
      )}
      {status === "off" && (
        <button className="btn btn-primary w-full" onClick={enable} disabled={busy}>
          Activer les notifications
        </button>
      )}
      {status === "on" && (
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm text-mint">
            <span className="h-2 w-2 rounded-full bg-mint" /> Activées sur cet appareil
          </span>
          <button className="btn btn-ghost" onClick={test} disabled={busy}>
            Tester
          </button>
        </div>
      )}
      {note && <p className="text-sm text-muted" role="status">{note}</p>}
    </div>
  );
}
