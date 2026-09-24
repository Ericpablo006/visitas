"use client";

import { useActionState, useRef, useEffect } from "react";
import { createClienteAction } from "@/actions/clientes";

export function NovoClienteForm() {
  const [state, formAction, pending] = useActionState(createClienteAction, null);
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
          <label className="label">Nome do produtor</label>
          <input className="input" name="nome" required />
          {state?.errors?.nome && <p className="field-error">{state.errors.nome}</p>}
        </div>
        <div>
          <label className="label">CPF</label>
          <input className="input" name="cpf" required />
          {state?.errors?.cpf && <p className="field-error">{state.errors.cpf}</p>}
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input" name="endereco" required />
          {state?.errors?.endereco && <p className="field-error">{state.errors.endereco}</p>}
        </div>
        <div>
          <label className="label">Município</label>
          <input className="input" name="municipio" required />
          {state?.errors?.municipio && <p className="field-error">{state.errors.municipio}</p>}
        </div>
        <div>
          <label className="label">Telefone (opcional)</label>
          <input className="input" name="telefone" />
        </div>
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Cadastrando…" : "Cadastrar cliente"}
      </button>
    </form>
  );
}
