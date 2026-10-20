"use client";

import { useEffect, useState, useTransition } from "react";
import { startTimer, stopTimer } from "@/app/actions";
import { SUBJECTS, type Timer } from "@/lib/types";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function TimerPanel({ timer }: { timer: Timer }) {
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);

  return (
    <section aria-label="Minuteur" className="panel flex flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-medium">Minuteur de travail</h2>
        <div className="label text-muted">{timer ? "En cours" : "Choisissez une matière"}</div>
      </div>

      {timer ? (
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="label text-cyan">{timer.subject}</div>
          <div className="font-mono text-5xl font-medium tracking-tight tabular-nums" aria-live="off">
            {clock(now - new Date(timer.startedAt).getTime())}
          </div>
          <button
            className="btn btn-primary w-full"
            disabled={pending}
            onClick={() => start(() => stopTimer())}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
            Arrêter et enregistrer
          </button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {SUBJECTS.map((subj) => {
          const active = timer?.subject === subj;
          return (
            <button
              key={subj}
              disabled={pending || active}
              onClick={() => start(() => startTimer(subj))}
              className={`btn justify-start text-left ${active ? "btn-primary" : "btn-ghost"}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-cyan">
                <path d="M7 5l12 7-12 7z" />
              </svg>
              {subj}
            </button>
          );
        })}
      </div>
    </section>
  );
}
