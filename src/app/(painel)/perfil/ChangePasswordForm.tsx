"use client";

import { useActionState } from "react";
import { changeOwnPasswordFormAction } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changeOwnPasswordFormAction, null);

  return (
    <form action={formAction} className="space-y-3">
      {state && <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"}`}>{state.message}</p>}
      <div>
        <label className="label">Senha atual</label>
        <input className="input" name="senhaAtual" type="password" required />
        {state?.errors?.senhaAtual && <p className="field-error">{state.errors.senhaAtual}</p>}
      </div>
      <div>
        <label className="label">Nova senha</label>
        <input className="input" name="novaSenha" type="password" required />
        {state?.errors?.novaSenha && <p className="field-error">{state.errors.novaSenha}</p>}
      </div>
      <div>
        <label className="label">Confirmar nova senha</label>
        <input className="input" name="confirmarSenha" type="password" required />
        {state?.errors?.confirmarSenha && <p className="field-error">{state.errors.confirmarSenha}</p>}
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Atualizar senha"}
      </button>
    </form>
  );
}
