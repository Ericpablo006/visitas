"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { updateClienteAction } from "@/actions/clientes";
import { formatCPF } from "@/lib/cpf";

type Cliente = {
  id: string;
  nome: string;
  cpf: string;
  endereco: string;
  municipio: string;
  telefone: string | null;
};

export function EditarClienteForm({ cliente }: { cliente: Cliente }) {
  const [state, formAction, pending] = useActionState(updateClienteAction, null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.push("/admin/clientes");
  }, [state, router]);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="id" value={cliente.id} />
      {state && !state.ok && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nome do produtor</label>
          <input className="input" name="nome" defaultValue={cliente.nome} required />
          {state?.errors?.nome && <p className="field-error">{state.errors.nome}</p>}
        </div>
        <div>
          <label className="label">CPF</label>
          <input className="input" name="cpf" defaultValue={formatCPF(cliente.cpf)} required />
          {state?.errors?.cpf && <p className="field-error">{state.errors.cpf}</p>}
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input" name="endereco" defaultValue={cliente.endereco} required />
          {state?.errors?.endereco && <p className="field-error">{state.errors.endereco}</p>}
        </div>
        <div>
          <label className="label">Município</label>
          <input className="input" name="municipio" defaultValue={cliente.municipio} required />
          {state?.errors?.municipio && <p className="field-error">{state.errors.municipio}</p>}
        </div>
        <div>
          <label className="label">Telefone (opcional)</label>
          <input className="input" name="telefone" defaultValue={cliente.telefone ?? ""} />
        </div>
      </div>
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
