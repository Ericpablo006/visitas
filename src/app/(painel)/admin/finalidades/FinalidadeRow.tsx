"use client";

import { useActionState, useState, useEffect } from "react";
import { toggleFinalidadeAction, editFinalidadeAction, deleteFinalidadeAction } from "@/actions/finalidades";

type Finalidade = { id: string; label: string; ativo: boolean };

export function FinalidadeRow({ finalidade }: { finalidade: Finalidade }) {
  const [editando, setEditando] = useState(false);
  const [state, formAction, pending] = useActionState(editFinalidadeAction, null);

  useEffect(() => {
    if (state?.ok) setEditando(false);
  }, [state]);

  if (editando) {
    return (
      <li className="py-2.5">
        <form action={formAction} className="flex items-start gap-2">
          <input type="hidden" name="id" value={finalidade.id} />
          <div className="flex-1">
            <input className="input" name="label" defaultValue={finalidade.label} required autoFocus />
            {state?.errors?.label && <p className="field-error">{state.errors.label}</p>}
          </div>
          <button type="submit" className="btn-primary py-1 text-xs" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </button>
          <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setEditando(false)}>
            Cancelar
          </button>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-2 py-2.5 text-sm">
      <span className={finalidade.ativo ? "text-ink" : "text-muted line-through"}>{finalidade.label}</span>
      <div className="flex items-center gap-2">
        <form action={toggleFinalidadeAction}>
          <input type="hidden" name="id" value={finalidade.id} />
          <input type="hidden" name="ativo" value={(!finalidade.ativo).toString()} />
          <button type="submit" className={finalidade.ativo ? "chip-green" : "chip-gray"}>
            {finalidade.ativo ? "Ativa" : "Inativa"}
          </button>
        </form>
        <button type="button" className="btn-secondary py-1 text-xs" onClick={() => setEditando(true)}>
          Editar
        </button>
        <form
          action={deleteFinalidadeAction}
          onSubmit={(e) => {
            if (!confirm("Excluir esta finalidade definitivamente? Essa ação não pode ser desfeita.")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={finalidade.id} />
          <button type="submit" className="btn-secondary py-1 text-xs text-red-700">
            Excluir
          </button>
        </form>
      </div>
    </li>
  );
}
