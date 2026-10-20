"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="safe-top mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <div className="label text-amber">Jarvis</div>
      <h1 className="text-[24px] font-medium tracking-tight">Un circuit a sauté, Monsieur.</h1>
      <p className="text-sm text-muted">
        Ouvrez <a href="/api/sante" className="text-cyan underline">la page de diagnostic</a> et envoyez-la à Claude.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Réessayer
      </button>
    </main>
  );
}
