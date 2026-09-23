"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "./nova/SignaturePad";

type Purpose = { id: string; label: string; isOutro?: boolean };
type FotoLocal = { clientLocalId: string; file?: File; previewUrl: string; jaEnviada?: boolean };

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

export type VisitaWizardInitialData = {
  id: string;
  clientLocalId: string;
  beneficiario: { nome: string; cpf: string; endereco: string };
  municipio: string;
  dataVisita: string;
  purposeIds: string[];
  finalidadeDetalhada: string;
  aplicandoConforme: boolean;
  aplicandoConformeJustificativa: string | null;
  outroFinalidadeDescricao: string | null;
  teveDesafio: boolean;
  desafioDescricao: string | null;
  assistenciaTecnica: boolean;
  assistenciaPeriodicidade: string | null;
  assistenciaMotivoNegativa: string | null;
  tecnicoNomeContato: string;
  pontoReferencia: boolean;
  observacoes: string | null;
  fotos: { id: string; clientLocalId: string; url: string }[];
};

export function VisitaWizard({ initial, tecnicoNomeSugerido }: { initial?: VisitaWizardInitialData; tecnicoNomeSugerido?: string }) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [clientLocalId] = useState(() => initial?.clientLocalId ?? uuid());
  const [step, setStep] = useState(0);
  const [purposes, setPurposes] = useState<Purpose[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visitaId, setVisitaId] = useState<string | null>(initial?.id ?? null);

  const [form, setForm] = useState({
    beneficiarioNome: initial?.beneficiario.nome ?? "",
    beneficiarioCpf: initial?.beneficiario.cpf ?? "",
    beneficiarioEndereco: initial?.beneficiario.endereco ?? "",
    municipio: initial?.municipio ?? "",
    dataVisita: initial?.dataVisita.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    finalidadeDetalhada: initial?.finalidadeDetalhada ?? "",
    purposeIds: initial?.purposeIds ?? ([] as string[]),
    outroFinalidadeDescricao: initial?.outroFinalidadeDescricao ?? "",
    aplicandoConforme: initial?.aplicandoConforme ?? true,
    aplicandoConformeJustificativa: initial?.aplicandoConformeJustificativa ?? "",
    teveDesafio: initial?.teveDesafio ?? false,
    desafioDescricao: initial?.desafioDescricao ?? "",
    assistenciaTecnica: initial?.assistenciaTecnica ?? false,
    assistenciaPeriodicidade: initial?.assistenciaPeriodicidade ?? "",
    assistenciaMotivoNegativa: initial?.assistenciaMotivoNegativa ?? "",
    tecnicoNomeContato: initial?.tecnicoNomeContato ?? tecnicoNomeSugerido ?? "",
    pontoReferencia: initial?.pontoReferencia ?? false,
    observacoes: initial?.observacoes ?? "",
  });

  const [fotos, setFotos] = useState<FotoLocal[]>(
    () => initial?.fotos.map((f) => ({ clientLocalId: f.clientLocalId, previewUrl: f.url, jaEnviada: true })) ?? [],
  );
  const [uploadedFotoIds, setUploadedFotoIds] = useState<Set<string>>(new Set(initial?.fotos.map((f) => f.clientLocalId) ?? []));

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

  const outroSelecionado = purposes.some((p) => p.isOutro && form.purposeIds.includes(p.id));

  const canLeaveStep0 =
    form.beneficiarioNome.trim().length > 1 &&
    form.beneficiarioCpf.trim().length >= 11 &&
    form.beneficiarioEndereco.trim().length > 2 &&
    form.municipio.trim().length > 1 &&
    form.finalidadeDetalhada.trim().length > 2;
  const canLeaveStep1 = form.purposeIds.length > 0 && (!outroSelecionado || form.outroFinalidadeDescricao.trim().length > 0);
  const canLeaveStep2 =
    (form.aplicandoConforme || form.aplicandoConformeJustificativa.trim().length > 0) &&
    (!form.teveDesafio || form.desafioDescricao.trim().length > 0) &&
    (!form.assistenciaTecnica || form.assistenciaPeriodicidade.trim().length > 0) &&
    (form.assistenciaTecnica || form.assistenciaMotivoNegativa.trim().length > 0) &&
    form.tecnicoNomeContato.trim().length > 1;

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
        finalidadeDetalhada: form.finalidadeDetalhada,
        purposeIds: form.purposeIds,
        outroFinalidadeDescricao: form.outroFinalidadeDescricao || null,
        aplicandoConforme: form.aplicandoConforme,
        aplicandoConformeJustificativa: form.aplicandoConformeJustificativa || null,
        teveDesafio: form.teveDesafio,
        desafioDescricao: form.desafioDescricao || null,
        assistenciaTecnica: form.assistenciaTecnica,
        assistenciaPeriodicidade: form.assistenciaPeriodicidade || null,
        assistenciaMotivoNegativa: form.assistenciaMotivoNegativa || null,
        tecnicoNomeContato: form.tecnicoNomeContato,
        pontoReferencia: form.pontoReferencia,
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
    if (!visitaId || foto.jaEnviada || uploadedFotoIds.has(foto.clientLocalId) || !foto.file) return;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{isEdit ? "Editar visita" : "Nova visita"}</h1>
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
            <Field label="Nome do cliente">
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
            <Field label="Finalidade do crédito (itens detalhados da proposta)">
              <textarea className="input" rows={3} value={form.finalidadeDetalhada} onChange={(e) => set("finalidadeDetalhada", e.target.value)} />
            </Field>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="mb-3 text-sm text-muted">Até a data da visita, assinale quais das finalidades propostas já foram aplicadas.</p>
            <div className="grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-3">
              {purposes.map((p) => (
                <label key={p.id} className="flex items-center gap-2 rounded-lg border border-black/5 px-3 py-2 text-sm hover:bg-brand-50">
                  <input type="checkbox" checked={form.purposeIds.includes(p.id)} onChange={() => togglePurpose(p.id)} />
                  {p.label}
                </label>
              ))}
            </div>
            {outroSelecionado && (
              <div className="mt-4">
                <Field label="Descreva a finalidade em 'Outro'">
                  <input className="input" value={form.outroFinalidadeDescricao} onChange={(e) => set("outroFinalidadeDescricao", e.target.value)} />
                </Field>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <SimNao
              n={7}
              texto="Está aplicando o recurso conforme finalidade da proposta?"
              value={form.aplicandoConforme}
              onChange={(v) => set("aplicandoConforme", v)}
            >
              {!form.aplicandoConforme && (
                <Field label="Justificativa">
                  <textarea className="input" rows={2} value={form.aplicandoConformeJustificativa} onChange={(e) => set("aplicandoConformeJustificativa", e.target.value)} />
                </Field>
              )}
            </SimNao>

            <SimNao n={9} texto="Teve algum desafio na aplicação do recurso? Se sim, favor descrever." value={form.teveDesafio} onChange={(v) => set("teveDesafio", v)}>
              {form.teveDesafio && (
                <Field label="Descreva o desafio">
                  <textarea className="input" rows={2} value={form.desafioDescricao} onChange={(e) => set("desafioDescricao", e.target.value)} />
                </Field>
              )}
            </SimNao>

            <SimNao
              n={10}
              texto="Está recebendo assistência técnica após acessar o crédito?"
              value={form.assistenciaTecnica}
              onChange={(v) => set("assistenciaTecnica", v)}
            >
              {form.assistenciaTecnica ? (
                <Field label="Periodicidade (ex.: semanal, mensal, bimensal, trimestral, semestral)">
                  <input className="input" value={form.assistenciaPeriodicidade} onChange={(e) => set("assistenciaPeriodicidade", e.target.value)} />
                </Field>
              ) : (
                <Field label="11. Motivo (assistência negativa)">
                  <textarea className="input" rows={2} value={form.assistenciaMotivoNegativa} onChange={(e) => set("assistenciaMotivoNegativa", e.target.value)} />
                </Field>
              )}
            </SimNao>

            <div className="border-b border-black/5 pb-5">
              <Field label="12. Nome e contato telefônico do técnico que acompanha">
                <input className="input" value={form.tecnicoNomeContato} onChange={(e) => set("tecnicoNomeContato", e.target.value)} />
              </Field>
            </div>

            <SimNao n={13} texto="Já tem ponto de referência da área financiada?" value={form.pontoReferencia} onChange={(v) => set("pontoReferencia", v)} />
          </div>
        )}

        {step === 3 && (
          <Field label="15. Observações">
            <textarea className="input" rows={6} value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </Field>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted">14. Registro de fotos da área financiada e da visita (opcional).</p>
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
              <h3 className="mb-2 text-sm font-semibold text-ink">Assinatura do Técnico</h3>
              <SignaturePad onChange={setTecnicoAssinatura} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-ink">Assinatura do Agricultor</h3>
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
                <span className="text-muted">Cliente:</span> {form.beneficiarioNome}
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
                <span className="text-muted">Assinatura do agricultor:</span> {beneficiarioAssinatura ? "Capturada" : "Faltando"}
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
            disabled={busy || (step === 0 && !canLeaveStep0) || (step === 1 && !canLeaveStep1) || (step === 2 && !canLeaveStep2)}
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

function SimNao({
  n,
  texto,
  value,
  onChange,
  children,
}: {
  n: number;
  texto: string;
  value: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-black/5 pb-5 last:border-0">
      <p className="mb-2 text-sm font-medium text-ink">
        {n}. {texto}
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <button type="button" className={value ? "chip-green" : "chip-gray"} onClick={() => onChange(true)}>
          Sim
        </button>
        <button type="button" className={!value ? "chip-green" : "chip-gray"} onClick={() => onChange(false)}>
          Não
        </button>
      </div>
      {children}
    </div>
  );
}
