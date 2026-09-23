"use client";

import { excluirVisitaAction } from "@/actions/visitas";

export function DeleteVisitaButton({ visitaId }: { visitaId: string }) {
  return (
    <form
      action={excluirVisitaAction}
      onSubmit={(e) => {
        if (!confirm("Excluir esta visita definitivamente? Essa ação não pode ser desfeita.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="visitaId" value={visitaId} />
      <button type="submit" className="btn-secondary text-red-700">
        Excluir
      </button>
    </form>
  );
}
