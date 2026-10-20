"use client";

import { useActionState } from "react";
import { enter } from "@/app/actions";

export function LoginForm({ setup }: { setup: boolean }) {
  const [state, action, pending] = useActionState(enter, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs text-muted">
        Code d&apos;accès
        <input name="code" type="password" autoComplete={setup ? "new-password" : "current-password"} required className="field" autoFocus />
      </label>
      {setup && (
        <label className="flex flex-col gap-1 text-xs text-muted">
          Confirmez le code
          <input name="confirm" type="password" autoComplete="new-password" required className="field" />
        </label>
      )}
      {state?.error && (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn btn-primary mt-2 min-h-12" disabled={pending}>
        {setup ? "Créer mon code" : "Entrer"}
      </button>
    </form>
  );
}
