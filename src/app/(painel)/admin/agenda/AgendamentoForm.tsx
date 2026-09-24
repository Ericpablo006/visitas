"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { createAgendamentoAction } from "@/actions/agendamentos";

const PropertyMapPicker = dynamic(() => import("@/components/PropertyMapPicker").then((m) => m.PropertyMapPicker), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-lg bg-black/5" />,
});

type Cliente = { id: string; nome: string };
type Tecnico = { id: string; name: string };

export function AgendamentoForm({ clientes, tecnicos }: { clientes: Cliente[]; tecnicos: Tecnico[] }) {
  const [state, formAction, pending] = useActionState(createAgendamentoAction, null);
  const ref = useRef<HTMLFormElement>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setCoords(null);
    }
  }, [state]);

  if (clientes.length === 0) {
    return (
      <p className="text-sm text-muted">
        Cadastre pelo menos um cliente antes de agendar uma visita —{" "}
        <Link href="/admin/clientes" className="font-medium text-brand-700 hover:underline">
          ir para Clientes
        </Link>
        .
      </p>
    );
  }

  return (
    <form ref={ref} action={formAction} className="space-y-3">
      {state && (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"}`}>{state.message}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Cliente (produtor)</label>
          <select className="input" name="beneficiarioId" required defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          {state?.errors?.beneficiarioId && <p className="field-error">{state.errors.beneficiarioId}</p>}
        </div>
        <div>
          <label className="label">Nome da propriedade</label>
          <input className="input" name="nomePropriedade" required />
          {state?.errors?.nomePropriedade && <p className="field-error">{state.errors.nomePropriedade}</p>}
        </div>
        <div>
          <label className="label">Técnico responsável</label>
          <select className="input" name="tecnicoId" required defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {state?.errors?.tecnicoId && <p className="field-error">{state.errors.tecnicoId}</p>}
        </div>
        <div>
          <label className="label">Data agendada (opcional)</label>
          <input className="input" name="dataAgendada" type="date" />
          {state?.errors?.dataAgendada && <p className="field-error">{state.errors.dataAgendada}</p>}
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observações (opcional)</label>
          <textarea className="input" name="observacoes" rows={2} />
        </div>
      </div>

      <div>
        <label className="label">Localização da propriedade</label>
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
        {pending ? "Agendando…" : "Agendar visita"}
      </button>
    </form>
  );
}
