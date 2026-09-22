"use client";

import { useActionState, useRef, useEffect } from "react";
import { createTecnicoAction } from "@/actions/tecnicos";

export function NovoTecnicoForm() {
  const [state, formAction, pending] = useActionState(createTecnicoAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {state && (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"}`}>{state.message}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nome</label>
          <input className="input" name="name" required />
          {state?.errors?.name && <p className="field-error">{state.errors.name}</p>}
        </div>
        <div>
          <label className="label">E-mail</label>
          <input className="input" name="email" type="email" required />
          {state?.errors?.email && <p className="field-error">{state.errors.email}</p>}
        </div>
        <div>
          <label className="label">Matrícula (opcional)</label>
          <input className="input" name="matricula" />
        </div>
        <div>
          <label className="label">Perfil</label>
          <select className="input" name="role" defaultValue="TECNICO">
            <option value="TECNICO">Técnico</option>
            <option value="COORDENADOR">Coordenador</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">Senha inicial</label>
          <input className="input" name="password" type="text" required />
          {state?.errors?.password && <p className="field-error">{state.errors.password}</p>}
        </div>
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar técnico"}
      </button>
    </form>
  );
}
