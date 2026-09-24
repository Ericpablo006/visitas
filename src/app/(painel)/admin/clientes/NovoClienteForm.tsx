"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClienteAction } from "@/actions/clientes";

const PropertyMapPicker = dynamic(() => import("@/components/PropertyMapPicker").then((m) => m.PropertyMapPicker), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-black/5" />,
});

type Finalidade = { id: string; label: string };

export function NovoClienteForm({ finalidades }: { finalidades: Finalidade[] }) {
  const [state, formAction, pending] = useActionState(createClienteAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setCoords(null);
    }
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
        <div>
          <label className="label">Finalidade do crédito (opcional)</label>
          <select className="input" name="finalidadeCreditoId" defaultValue="">
            <option value="">Não informada</option>
            {finalidades.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          {state?.errors?.finalidadeCreditoId && <p className="field-error">{state.errors.finalidadeCreditoId}</p>}
        </div>
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
        {pending ? "Cadastrando…" : "Cadastrar cliente"}
      </button>
    </form>
  );
}
