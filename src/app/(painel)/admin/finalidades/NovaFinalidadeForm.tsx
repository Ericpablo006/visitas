"use client";

import { useActionState, useRef, useEffect } from "react";
import { createFinalidadeAction } from "@/actions/finalidades";

export function NovaFinalidadeForm() {
  const [state, formAction, pending] = useActionState(createFinalidadeAction, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input className="input" name="label" placeholder="Nova finalidade do crédito" required />
        {state?.errors?.label && <p className="field-error">{state.errors.label}</p>}
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Adicionando…" : "Adicionar"}
      </button>
    </form>
  );
}
