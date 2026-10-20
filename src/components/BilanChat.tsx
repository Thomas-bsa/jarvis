"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Orb, type OrbState } from "./Orb";

type Msg = { role: "jarvis" | "user"; text: string };
type Mode = "bilan" | "libre";

// Minimal typing for the browser speech recognition API (prefixed in Safari).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
};

function getRecognition(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr"));
  // Deep male French voices first ("Thomas" is the iPhone's French male voice).
  const prefs = [/thomas/i, /daniel/i, /nicolas/i, /henri/i, /paul/i, /google français/i, /male|homme/i];
  for (const p of prefs) {
    const v = voices.find((x) => p.test(x.name));
    if (v) return v;
  }
  return voices.find((v) => v.lang === "fr-FR") ?? voices[0] ?? null;
}

export function BilanChat({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [started, setStarted] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [state, setState] = useState<OrbState>("idle");
  const [interim, setInterim] = useState("");
  const [draft, setDraft] = useState("");
  const [logged, setLogged] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [canListen, setCanListen] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, interim]);

  const speak = useCallback(
    (text: string) =>
      new Promise<void>((resolve) => {
        if (!voiceOn || typeof speechSynthesis === "undefined") return resolve();
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        const v = pickVoice();
        if (v) u.voice = v;
        u.lang = v?.lang ?? "fr-FR";
        u.rate = 1.0;
        u.pitch = 0.85;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        setState("speaking");
        speechSynthesis.speak(u);
      }),
    [voiceOn]
  );

  const send = useCallback(
    async (history: Msg[]) => {
      setState("thinking");
      try {
        const res = await fetch("/api/jarvis", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history, mode }),
        });
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = (await res.json()) as { reply: string; done: boolean; logged: string[] };
        setMsgs([...history, { role: "jarvis", text: data.reply }]);
        if (data.logged?.length) {
          setLogged((l) => [...l, ...data.logged]);
          router.refresh();
        }
        if (data.done) setDone(true);
        await speak(data.reply);
      } catch {
        setMsgs([...history, { role: "jarvis", text: "Connexion perdue, Monsieur. Réessayez dans un instant." }]);
      }
      setState("idle");
    },
    [mode, router, speak]
  );

  const begin = (m: Mode) => {
    setMode(m);
    setStarted(true);
    setCanListen(Boolean(getRecognition()));
    // Unlock speech on iPhone: it must start from a tap.
    if (typeof speechSynthesis !== "undefined") speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    if (m === "bilan") void send([]);
    else setMsgs([{ role: "jarvis", text: "À votre service, Monsieur. Que puis-je faire ?" }]);
  };

  const submit = (text: string) => {
    const t = text.trim();
    if (!t || state === "thinking") return;
    setDraft("");
    setInterim("");
    const history = [...msgs, { role: "user" as const, text: t }];
    setMsgs(history);
    void send(history);
  };

  const listen = () => {
    if (state === "listening") {
      recRef.current?.stop();
      return;
    }
    speechSynthesis?.cancel();
    const rec = getRecognition();
    if (!rec) return;
    recRef.current = rec;
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let live = "";
      finalText = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else live += r[0].transcript;
      }
      setInterim(finalText + live);
    };
    rec.onerror = () => setState("idle");
    rec.onend = () => {
      setState("idle");
      const said = finalText || "";
      if (said.trim()) submit(said);
      else setInterim("");
    };
    setState("listening");
    rec.start();
  };

  const status =
    state === "listening" ? "Je vous écoute" : state === "thinking" ? "Analyse" : state === "speaking" ? "Jarvis parle" : done ? "Bilan enregistré" : "En attente";

  if (!started) {
    return (
      <div className="flex flex-col items-center gap-8 pt-10">
        <Orb state="idle" />
        <div className="text-center">
          <div className="label text-cyan">Jarvis</div>
          <h1 className="mt-2 text-[26px] font-medium tracking-tight">À votre service, Monsieur.</h1>
        </div>
        <div className="flex w-full flex-col gap-3">
          <button className="btn btn-primary min-h-14 w-full text-base" onClick={() => begin("bilan")}>
            Commencer le bilan du soir
          </button>
          <button className="btn btn-ghost min-h-12 w-full" onClick={() => begin("libre")}>
            Parler librement à Jarvis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-140px)] flex-col gap-4">
      <header className="flex min-h-11 items-center justify-between pt-4">
        <div className="label text-cyan">{mode === "bilan" ? "Bilan du soir" : "Conversation"}</div>
        <button
          onClick={() => {
            setVoiceOn((v) => !v);
            speechSynthesis?.cancel();
          }}
          className="flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink-2"
          aria-pressed={voiceOn}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9z" />
            {voiceOn ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </svg>
          Voix {voiceOn ? "activée" : "coupée"}
        </button>
      </header>

      <div className="flex flex-col items-center gap-2">
        <Orb state={state} />
        <div className="label text-muted" aria-live="polite">
          {status}
        </div>
      </div>

      {logged.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {logged.map((l, i) => (
            <span key={i} className="fade-up rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs text-mint">
              ✓ {l}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-1 flex-col justify-end gap-3" aria-live="polite">
        {msgs.map((m, i) =>
          m.role === "jarvis" ? (
            <div key={i} className="fade-up max-w-[92%] self-start">
              <div className="label mb-1 text-[10.5px] text-cyan">Jarvis</div>
              <div className="text-[15px] leading-relaxed">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="fade-up max-w-[80%] self-end text-right">
              <div className="label mb-1 text-[10.5px] text-muted">Vous</div>
              <div className="inline-block rounded-2xl rounded-br-sm border border-white/10 bg-[#121C27] px-3 py-2.5 text-left text-sm">{m.text}</div>
            </div>
          )
        )}
        {interim && <div className="self-end text-right text-sm italic text-muted">{interim}</div>}
        <div ref={bottomRef} />
      </div>

      {done ? (
        <Link href="/" className="btn btn-primary w-full">
          Retour à l&apos;accueil
        </Link>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {canListen && (
            <>
              <button
                onClick={listen}
                disabled={state === "thinking"}
                aria-label={state === "listening" ? "Arrêter l'écoute" : "Parler à Jarvis"}
                className="flex h-[72px] w-[72px] items-center justify-center rounded-full border bg-[#0B1A24] transition"
                style={{
                  borderColor: state === "listening" ? "#4BE3A6" : "#5CE1FF",
                  boxShadow: state === "listening" ? "0 0 26px rgb(75 227 166 / .55)" : "0 0 22px rgb(92 225 255 / .45)",
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={state === "listening" ? "#4BE3A6" : "#5CE1FF"} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <rect x="9" y="3" width="6" height="12" rx="3" />
                  <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </svg>
              </button>
              <div className="text-[13px] text-muted">{state === "listening" ? "Touchez pour terminer" : "Touchez pour répondre"}</div>
            </>
          )}
          <form
            className="flex w-full gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <label className="sr-only" htmlFor="jv-input">Écrire à Jarvis</label>
            <input
              id="jv-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={canListen ? "…ou écrivez ici" : "Écrivez à Jarvis"}
              className="field"
              autoComplete="off"
            />
            <button className="btn btn-ghost" disabled={!draft.trim() || state === "thinking"}>
              Envoyer
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
