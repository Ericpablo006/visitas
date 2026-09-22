"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "./SignaturePad";

type Resposta = "SIM" | "NAO" | "PARCIAL" | "NAO_SE_APLICA";
type Purpose = { id: string; label: string };
type FotoLocal = { clientLocalId: string; file: File; previewUrl: string };

const STEP_LABELS = ["Identificação", "Finalidades", "Perguntas", "Observações", "Fotos", "Assinaturas", "Revisão"];

function uuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const meta = parts[0] ?? "";
  const base64 = parts[1] ?? "";
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function parseMoneyToCents(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const normalized = t.replace(/\./g, "").replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export default function NovaVisitaPage() {
  const router = useRouter();
  const [clientLocalId] = useState(uuid);
  const [step, setStep] = useState(0);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitaId, setVisitaId] = useState<string | null>(null);

  const [form, setForm] = useState({
    beneficiarioNome: "",
    beneficiarioCpf: "",
    beneficiarioEndereco: "",
    municipio: "",
    dataVisita: new Date().toISOString().slice(0, 10),
    purposeIds: [] as string[],
    pergunta7Resposta: "SIM" as Resposta,
    pergunta7Justificativa: "",
    pergunta8Resposta: "SIM" as Resposta,
    pergunta9Resposta: "NAO" as Resposta,
    pergunta9QuantidadeEmpregos: "",
    pergunta9RendaEstimada: "",
    pergunta10Resposta: "SIM" as Resposta,
    pergunta10MotivoParalisacao: "",
    pergunta11Resposta: "NAO" as Resposta,
    pergunta11ParcelasAtrasadas: "",
    pergunta12Resposta: "NAO" as Resposta,
    pergunta12Dificuldades: "",
    pergunta13Resposta: "SIM" as Resposta,
    pergunta13Motivo: "",
    observacoes: "",
  });

  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [uploadedFotoIds, setUploadedFotoIds] = useState<Set<string>>(new Set());

  const [tecnicoAssinatura, setTecnicoAssinatura] = useState<string | null>(null);
  const [beneficiarioModo, setBeneficiarioModo] = useState<"DESENHO" | "DIGITAL">("DESENHO");
  const [beneficiarioAssinatura, setBeneficiarioAssinatura] = useState<string | null>(null);
  const [testemunhaNome, setTestemunhaNome] = useState("");
  const [testemunhaCpf, setTestemunhaCpf] = useState("");
  const [assinaturasEnviadas, setAssinaturasEnviadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/purposes")
      .then((r) => r.json())
      .then((d) => setPurposes(d.purposes ?? []))
      .catch(() => setError("Não foi possível carregar as finalidades. Verifique a conexão."));
  }, []);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  function togglePurpose(id: string) {
    set("purposeIds", form.purposeIds.includes(id) ? form.purposeIds.filter((p) => p !== id) : [...form.purposeIds, id]);
  }

  const canLeaveStep0 = form.beneficiarioNome.trim().length > 1 && form.beneficiarioCpf.trim().length >= 11 && form.beneficiarioEndereco.trim().length > 2 && form.municipio.trim().length > 1;
  const canLeaveStep1 = form.purposeIds.length > 0;

  async function createOrUpdateVisita(): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        clientLocalId,
        beneficiarioNome: form.beneficiarioNome,
        beneficiarioCpf: form.beneficiarioCpf,
        beneficiarioEndereco: form.beneficiarioEndereco,
        municipio: form.municipio,
        dataVisita: form.dataVisita,
        purposeIds: form.purposeIds,
        pergunta7Resposta: form.pergunta7Resposta,
        pergunta7Justificativa: form.pergunta7Justificativa || null,
        pergunta8Resposta: form.pergunta8Resposta,
        pergunta9Resposta: form.pergunta9Resposta,
        pergunta9QuantidadeEmpregos: form.pergunta9QuantidadeEmpregos ? Number(form.pergunta9QuantidadeEmpregos) : null,
        pergunta9RendaEstimadaCents: parseMoneyToCents(form.pergunta9RendaEstimada),
        pergunta10Resposta: form.pergunta10Resposta,
        pergunta10MotivoParalisacao: form.pergunta10MotivoParalisacao || null,
        pergunta11Resposta: form.pergunta11Resposta,
        pergunta11ParcelasAtrasadas: form.pergunta11ParcelasAtrasadas ? Number(form.pergunta11ParcelasAtrasadas) : null,
        pergunta12Resposta: form.pergunta12Resposta,
        pergunta12Dificuldades: form.pergunta12Dificuldades || null,
        pergunta13Resposta: form.pergunta13Resposta,
        pergunta13Motivo: form.pergunta13Motivo || null,
        observacoes: form.observacoes || null,
      };
      const url = visitaId ? `/api/visitas/${visitaId}` : "/api/visitas";
      const method = visitaId ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível salvar a visita. Confira os campos.");
        return false;
      }
      setVisitaId(body.visita.id);
      return true;
    } catch {
      setError("Falha de conexão ao salvar a visita.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function goNext() {
    if (step === 3) {
      const okSaved = await createOrUpdateVisita();
      if (!okSaved) return;
    }
    setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function addFotos(files: FileList | null) {
    if (!files) return;
    const novas = Array.from(files).map((file) => ({ clientLocalId: uuid(), file, previewUrl: URL.createObjectURL(file) }));
    setFotos((f) => [...f, ...novas]);
  }

  async function uploadFoto(foto: FotoLocal) {
    if (!visitaId || uploadedFotoIds.has(foto.clientLocalId)) return;
    const fd = new FormData();
    fd.append("foto", foto.file);
    fd.append("clientLocalId", foto.clientLocalId);
    const res = await fetch(`/api/visitas/${visitaId}/fotos`, { method: "POST", body: fd });
    if (res.ok) setUploadedFotoIds((s) => new Set(s).add(foto.clientLocalId));
  }

  async function uploadAssinatura(tipo: "TECNICO" | "BENEFICIARIO_DESENHO" | "BENEFICIARIO_DIGITAL", dataUrl: string) {
    if (!visitaId) return false;
    const fd = new FormData();
    fd.append("imagem", dataUrlToBlob(dataUrl), `${tipo}.png`);
    fd.append("clientLocalId", uuid());
    fd.append("tipo", tipo);
    if (tipo === "BENEFICIARIO_DIGITAL") {
      fd.append("testemunhaNome", testemunhaNome);
      fd.append("testemunhaCpf", testemunhaCpf);
    }
    const res = await fetch(`/api/visitas/${visitaId}/assinaturas`, { method: "POST", body: fd });
    if (res.ok) {
      setAssinaturasEnviadas((s) => new Set(s).add(tipo));
      return true;
    }
    return false;
  }

  async function finalizar() {
    if (!visitaId) return;
    setBusy(true);
    setError(null);
    try {
      for (const foto of fotos) await uploadFoto(foto);
      if (tecnicoAssinatura && !assinaturasEnviadas.has("TECNICO")) await uploadAssinatura("TECNICO", tecnicoAssinatura);
      if (beneficiarioAssinatura) {
        const tipo = beneficiarioModo === "DESENHO" ? "BENEFICIARIO_DESENHO" : "BENEFICIARIO_DIGITAL";
        if (!assinaturasEnviadas.has(tipo)) await uploadAssinatura(tipo, beneficiarioAssinatura);
      }
      const res = await fetch(`/api/visitas/${visitaId}/finalizar`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Não foi possível finalizar a visita.");
        return;
      }
      router.push(`/visitas/${visitaId}`);
    } catch {
      setError("Falha de conexão ao finalizar a visita.");
    } finally {
      setBusy(false);
    }
  }

  const respostaOptions: { value: Resposta; label: string }[] = useMemo(
    () => [
      { value: "SIM", label: "Sim" },
      { value: "NAO", label: "Não" },
      { value: "PARCIAL", label: "Parcialmente" },
      { value: "NAO_SE_APLICA", label: "Não se aplica" },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Nova visita</h1>
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {STEP_LABELS.map((label, i) => (
            <span key={label} className={i === step ? "chip-green" : i < step ? "chip-gray bg-brand-100 text-brand-700" : "chip-gray"}>
              {i + 1}. {label}
            </span>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="card">
        {step === 0 && (
          <div className="space-y-4">
            <Field label="Nome do beneficiário">
              <input className="input" value={form.beneficiarioNome} onChange={(e) => set("beneficiarioNome", e.target.value)} />
            </Field>
            <Field label="CPF">
              <input className="input" value={form.beneficiarioCpf} onChange={(e) => set("beneficiarioCpf", e.target.value)} placeholder="000.000.000-00" />
            </Field>
            <Field label="Endereço">
              <input className="input" value={form.beneficiarioEndereco} onChange={(e) => set("beneficiarioEndereco", e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Município">
                <input className="input" value={form.municipio} onChange={(e) => set("municipio", e.target.value)} />
              </Field>
              <Field label="Data da visita">
                <input type="date" className="input" value={form.dataVisita} onChange={(e) => set("dataVisita", e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-sm text-muted">Selecione ao menos uma finalidade do crédito.</p>
            <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
              {purposes.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm hover:bg-brand-50">
                  <input type="checkbox" checked={form.purposeIds.includes(p.id)} onChange={() => togglePurpose(p.id)} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Pergunta n={7} texto="O crédito foi aplicado conforme o planejado?" value={form.pergunta7Resposta} onChange={(v) => set("pergunta7Resposta", v)} options={respostaOptions}>
              {form.pergunta7Resposta !== "SIM" && (
                <Field label="Justificativa">
                  <textarea className="input" rows={2} value={form.pergunta7Justificativa} onChange={(e) => set("pergunta7Justificativa", e.target.value)} />
                </Field>
              )}
            </Pergunta>
            <Pergunta n={8} texto="O beneficiário recebeu a orientação técnica necessária?" value={form.pergunta8Resposta} onChange={(v) => set("pergunta8Resposta", v)} options={respostaOptions} />
            <Pergunta n={9} texto="A atividade gerou emprego/renda adicional?" value={form.pergunta9Resposta} onChange={(v) => set("pergunta9Resposta", v)} options={respostaOptions}>
              {form.pergunta9Resposta === "SIM" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Empregos gerados">
                    <input type="number" min={0} className="input" value={form.pergunta9QuantidadeEmpregos} onChange={(e) => set("pergunta9QuantidadeEmpregos", e.target.value)} />
                  </Field>
                  <Field label="Renda estimada (R$)">
                    <input className="input" value={form.pergunta9RendaEstimada} onChange={(e) => set("pergunta9RendaEstimada", e.target.value)} placeholder="0,00" />
                  </Field>
                </div>
              )}
            </Pergunta>
            <Pergunta n={10} texto="A atividade financiada está em funcionamento?" value={form.pergunta10Resposta} onChange={(v) => set("pergunta10Resposta", v)} options={respostaOptions}>
              {form.pergunta10Resposta === "NAO" && (
                <Field label="Motivo da paralisação">
                  <textarea className="input" rows={2} value={form.pergunta10MotivoParalisacao} onChange={(e) => set("pergunta10MotivoParalisacao", e.target.value)} />
                </Field>
              )}
            </Pergunta>
            <Pergunta n={11} texto="Há parcelas do crédito em atraso?" value={form.pergunta11Resposta} onChange={(v) => set("pergunta11Resposta", v)} options={respostaOptions}>
              {form.pergunta11Resposta !== "NAO" && (
                <Field label="Parcelas em atraso">
                  <input type="number" min={0} className="input" value={form.pergunta11ParcelasAtrasadas} onChange={(e) => set("pergunta11ParcelasAtrasadas", e.target.value)} />
                </Field>
              )}
            </Pergunta>
            <Pergunta n={12} texto="O beneficiário enfrentou dificuldades na execução?" value={form.pergunta12Resposta} onChange={(v) => set("pergunta12Resposta", v)} options={respostaOptions}>
              {(form.pergunta12Resposta === "SIM" || form.pergunta12Resposta === "PARCIAL") && (
                <Field label="Dificuldades enfrentadas">
                  <textarea className="input" rows={2} value={form.pergunta12Dificuldades} onChange={(e) => set("pergunta12Dificuldades", e.target.value)} />
                </Field>
              )}
            </Pergunta>
            <Pergunta n={13} texto="O beneficiário recomendaria o programa a outros?" value={form.pergunta13Resposta} onChange={(v) => set("pergunta13Resposta", v)} options={respostaOptions}>
              {form.pergunta13Resposta === "NAO" && (
                <Field label="Motivo">
                  <textarea className="input" rows={2} value={form.pergunta13Motivo} onChange={(e) => set("pergunta13Motivo", e.target.value)} />
                </Field>
              )}
            </Pergunta>
          </div>
        )}

        {step === 3 && (
          <Field label="Observações do técnico">
            <textarea className="input" rows={6} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">Adicione fotos da visita (opcional).</p>
            <input type="file" accept="image/*" multiple onChange={(e) => addFotos(e.target.files)} />
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {fotos.map((f) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={f.clientLocalId} src={f.previewUrl} alt="" className="aspect-square w-full rounded-lg border border-black/10 object-cover" />
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-8">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Assinatura do técnico</h3>
              <SignaturePad onChange={setTecnicoAssinatura} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Assinatura do beneficiário</h3>
              <div className="mb-3 flex gap-2 text-xs">
                <button type="button" className={beneficiarioModo === "DESENHO" ? "chip-green" : "chip-gray"} onClick={() => setBeneficiarioModo("DESENHO")}>
                  Desenhar assinatura
                </button>
                <button type="button" className={beneficiarioModo === "DIGITAL" ? "chip-green" : "chip-gray"} onClick={() => setBeneficiarioModo("DIGITAL")}>
                  Impressão digital + testemunha
                </button>
              </div>
              {beneficiarioModo === "DESENHO" ? (
                <SignaturePad onChange={setBeneficiarioAssinatura} />
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome da testemunha">
                      <input className="input" value={testemunhaNome} onChange={(e) => setTestemunhaNome(e.target.value)} />
                    </Field>
                    <Field label="CPF da testemunha (opcional)">
                      <input className="input" value={testemunhaCpf} onChange={(e) => setTestemunhaCpf(e.target.value)} />
                    </Field>
                  </div>
                  <label className="btn-secondary inline-flex cursor-pointer">
                    Foto da impressão digital
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => setBeneficiarioAssinatura(reader.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                  </label>
                  {beneficiarioAssinatura && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={beneficiarioAssinatura} alt="Impressão digital" className="h-32 rounded-lg border border-black/10 object-contain" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 6 && (
          <div className="space-y-4 text-sm">
            <p className="text-muted">Confira os dados antes de finalizar. Depois de finalizada, a visita não pode mais ser editada.</p>
            <ul className="space-y-1">
              <li>
                <span className="text-muted">Beneficiário:</span> {form.beneficiarioNome}
              </li>
              <li>
                <span className="text-muted">Município:</span> {form.municipio}
              </li>
              <li>
                <span className="text-muted">Finalidades:</span> {form.purposeIds.length}
              </li>
              <li>
                <span className="text-muted">Fotos:</span> {fotos.length}
              </li>
              <li>
                <span className="text-muted">Assinatura do técnico:</span> {tecnicoAssinatura ? "Capturada" : "Faltando"}
              </li>
              <li>
                <span className="text-muted">Assinatura do beneficiário:</span> {beneficiarioAssinatura ? "Capturada" : "Faltando"}
              </li>
            </ul>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <button type="button" className="btn-secondary" disabled={step === 0 || busy} onClick={() => setStep((s) => s - 1)}>
          Voltar
        </button>
        {step < STEP_LABELS.length - 1 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={busy || (step === 0 && !canLeaveStep0) || (step === 1 && !canLeaveStep1)}
            onClick={goNext}
          >
            {busy ? "Salvando…" : "Avançar"}
          </button>
        ) : (
          <button type="button" className="btn-primary" disabled={busy || !tecnicoAssinatura || !beneficiarioAssinatura} onClick={finalizar}>
            {busy ? "Finalizando…" : "Finalizar e enviar"}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="label">{label}</p>
      {children}
    </div>
  );
}

function Pergunta({
  n,
  texto,
  value,
  onChange,
  options,
  children,
}: {
  n: number;
  texto: string;
  value: Resposta;
  onChange: (v: Resposta) => void;
  options: { value: Resposta; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-black/5 pb-5 last:border-0">
      <p className="mb-2 text-sm font-medium text-ink">
        {n}. {texto}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" className={value === o.value ? "chip-green" : "chip-gray"} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
