"use client";

import { deleteClienteAction } from "@/actions/clientes";

export function DeleteClienteButton({ clienteId }: { clienteId: string }) {
  return (
    <form
      action={deleteClienteAction}
      onSubmit={(e) => {
        if (!confirm("Excluir este cliente definitivamente? Essa ação não pode ser desfeita.")) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={clienteId} />
      <button type="submit" className="btn-secondary py-1 text-xs text-red-700">
        Excluir
      </button>
    </form>
  );
}
