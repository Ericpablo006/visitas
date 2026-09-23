"use client";

import { useActionState, useRef, useEffect } from "react";
import { createEmpresaAction } from "@/actions/empresas";

export function NovaEmpresaForm() {
  const [state, formAction, pending] = useActionState(createEmpresaAction, null);
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
          <label className="label">Nome da empresa</label>
          <input className="input" name="nome" required />
          {state?.errors?.nome && <p className="field-error">{state.errors.nome}</p>}
        </div>
        <div>
          <label className="label">CNPJ (opcional)</label>
          <input className="input" name="cnpj" />
          {state?.errors?.cnpj && <p className="field-error">{state.errors.cnpj}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Endereço (opcional)</label>
          <input className="input" name="endereco" />
        </div>
        <div>
          <label className="label">Telefone (opcional)</label>
          <input className="input" name="telefone" />
        </div>
      </div>

      <div className="border-t border-black/5 pt-3">
        <p className="mb-2 text-sm font-medium text-ink">Primeira conta administradora da empresa</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Nome</label>
            <input className="input" name="adminName" required />
            {state?.errors?.adminName && <p className="field-error">{state.errors.adminName}</p>}
          </div>
          <div>
            <label className="label">E-mail</label>
            <input className="input" name="adminEmail" type="email" required />
            {state?.errors?.adminEmail && <p className="field-error">{state.errors.adminEmail}</p>}
          </div>
          <div className="sm:col-span-2">
            <label className="label">Senha inicial</label>
            <input className="input" name="adminPassword" type="text" required />
            {state?.errors?.adminPassword && <p className="field-error">{state.errors.adminPassword}</p>}
          </div>
        </div>
      </div>

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar empresa"}
      </button>
    </form>
  );
}
