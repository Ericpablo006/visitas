"use client";

import { useActionState } from "react";
import { loginAction } from "@/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, null);

  return (
    <form action={formAction} className="card space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      {state && !state.ok && state.message && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      )}
      <div>
        <label className="label" htmlFor="email">
          E-mail
        </label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" required />
        {state?.errors?.email && <p className="field-error">{state.errors.email}</p>}
      </div>
      <div>
        <label className="label" htmlFor="password">
          Senha
        </label>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        {state?.errors?.password && <p className="field-error">{state.errors.password}</p>}
      </div>
      <button className="btn-primary w-full" type="submit" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
