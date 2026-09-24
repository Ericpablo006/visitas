"use client";

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { updateClienteAction } from "@/actions/clientes";
import { formatCPF } from "@/lib/cpf";

const PropertyMapPicker = dynamic(() => import("@/components/PropertyMapPicker").then((m) => m.PropertyMapPicker), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-black/5" />,
});

type Cliente = {
  id: string;
  nome: string;
  cpf: string;
  endereco: string;
  municipio: string;
  telefone: string | null;
  finalidadeCreditoId: string | null;
  finalidadeCreditoOutro: string | null;
  latitude: number | null;
  longitude: number | null;
};

type Finalidade = { id: string; label: string; isOutro: boolean };

export function EditarClienteForm({ cliente, finalidades }: { cliente: Cliente; finalidades: Finalidade[] }) {
  const [state, formAction, pending] = useActionState(updateClienteAction, null);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    cliente.latitude != null && cliente.longitude != null ? { lat: cliente.latitude, lng: cliente.longitude } : null,
  );
  const [finalidadeId, setFinalidadeId] = useState(cliente.finalidadeCreditoId ?? "");
  const outroSelecionado = finalidades.some((f) => f.id === finalidadeId && f.isOutro);

  useEffect(() => {
    if (state?.ok) router.push("/admin/clientes");
  }, [state, router]);

  return (
    <form ref={ref} action={formAction} className="space-y-3">
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
        <div>
          <label className="label">Finalidade do crédito (opcional)</label>
          <select className="input" name="finalidadeCreditoId" value={finalidadeId} onChange={(e) => setFinalidadeId(e.target.value)}>
            <option value="">Não informada</option>
            {finalidades.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          {state?.errors?.finalidadeCreditoId && <p className="field-error">{state.errors.finalidadeCreditoId}</p>}
        </div>
        {outroSelecionado && (
          <div className="sm:col-span-2">
            <label className="label">Descreva a finalidade</label>
            <input className="input" name="finalidadeCreditoOutro" defaultValue={cliente.finalidadeCreditoOutro ?? ""} placeholder="Escreva a finalidade do crédito" required />
            {state?.errors?.finalidadeCreditoOutro && <p className="field-error">{state.errors.finalidadeCreditoOutro}</p>}
          </div>
        )}
      </div>

      <div>
        <label className="label">Localização da propriedade (opcional)</label>
        <PropertyMapPicker latitude={coords?.lat ?? null} longitude={coords?.lng ?? null} onChange={(lat, lng) => setCoords({ lat, lng })} />
        {coords && (
          <>
            <input type="hidden" name="latitude" value={coords.lat} />
            <input type="hidden" name="longitude" value={coords.lng} />
          </>
        )}
        {state?.errors?.latitude && <p className="field-error">{state.errors.latitude}</p>}
      </div>

      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar alterações"}
      </button>
    </form>
  );
}
