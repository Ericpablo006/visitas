import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatCPF } from "@/lib/cpf";

const RESPOSTA_LABEL: Record<string, string> = { SIM: "Sim", NAO: "Não", PARCIAL: "Parcialmente", NAO_SE_APLICA: "Não se aplica" };
const fmtDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);

export default async function VisitaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";

  const visita = await db.visita.findUnique({
    where: { id },
    include: {
      tecnico: { select: { name: true, matricula: true } },
      purposes: { include: { purpose: { select: { label: true } } } },
      fotos: { orderBy: { ordem: "asc" } },
      assinaturas: true,
    },
  });
  if (!visita || visita.empresaId !== user.empresaId || (!isStaff && visita.tecnicoId !== user.id)) notFound();

  const tecnicoAssinatura = visita.assinaturas.find((a) => a.tipo === "TECNICO");
  const beneficiarioAssinatura = visita.assinaturas.find((a) => a.tipo !== "TECNICO");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">{visita.beneficiarioNomeSnapshot}</h1>
          <p className="text-sm text-muted">
            {formatCPF(visita.beneficiarioCpfSnapshot)} · {visita.municipio} · {fmtDate(visita.dataVisita)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={visita.status === "FINALIZADA" ? "chip-green" : "chip-gray"}>
            {visita.status === "FINALIZADA" ? visita.numeroDocumento : "Rascunho"}
          </span>
          {visita.status === "FINALIZADA" && (
            <a href={`/api/visitas/${visita.id}/pdf`} target="_blank" className="btn-secondary" rel="noreferrer">
              Baixar PDF
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-ink">Identificação</h2>
          <p>
            <span className="text-muted">Endereço:</span> {visita.beneficiarioEnderecoSnapshot}
          </p>
          <p>
            <span className="text-muted">Técnico:</span> {visita.tecnico.name} {visita.tecnico.matricula ? `(${visita.tecnico.matricula})` : ""}
          </p>
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-ink">Finalidades do crédito</h2>
          <ul className="list-inside list-disc text-muted">
            {visita.purposes.map((p) => (
              <li key={p.id}>{p.purpose.label}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card space-y-4 text-sm">
        <h2 className="font-semibold text-ink">Acompanhamento pós-crédito</h2>
        <Pergunta n={7} texto="O crédito foi aplicado conforme o planejado?" resposta={visita.pergunta7Resposta} extra={visita.pergunta7Justificativa} />
        <Pergunta n={8} texto="O beneficiário recebeu a orientação técnica necessária?" resposta={visita.pergunta8Resposta} />
        <Pergunta
          n={9}
          texto="A atividade gerou emprego/renda adicional?"
          resposta={visita.pergunta9Resposta}
          extra={visita.pergunta9QuantidadeEmpregos != null ? `${visita.pergunta9QuantidadeEmpregos} empregos gerados` : undefined}
        />
        <Pergunta n={10} texto="A atividade financiada está em funcionamento?" resposta={visita.pergunta10Resposta} extra={visita.pergunta10MotivoParalisacao} />
        <Pergunta
          n={11}
          texto="Há parcelas do crédito em atraso?"
          resposta={visita.pergunta11Resposta}
          extra={visita.pergunta11ParcelasAtrasadas != null ? `${visita.pergunta11ParcelasAtrasadas} parcela(s) em atraso` : undefined}
        />
        <Pergunta n={12} texto="O beneficiário enfrentou dificuldades na execução?" resposta={visita.pergunta12Resposta} extra={visita.pergunta12Dificuldades} />
        <Pergunta n={13} texto="O beneficiário recomendaria o programa a outros?" resposta={visita.pergunta13Resposta} extra={visita.pergunta13Motivo} />
        {visita.observacoes && (
          <div>
            <p className="label">Observações</p>
            <p>{visita.observacoes}</p>
          </div>
        )}
      </div>

      <div className="card space-y-3 text-sm">
        <h2 className="font-semibold text-ink">Fotos ({visita.fotos.length})</h2>
        {visita.fotos.length === 0 ? (
          <p className="text-muted">Nenhuma foto enviada.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {visita.fotos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f.id} src={`/api/arquivos/${f.fileKey}`} alt={f.legenda ?? "Foto da visita"} className="aspect-square w-full rounded-lg object-cover" />
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AssinaturaCard titulo="Técnico responsável" assinatura={tecnicoAssinatura} />
        <AssinaturaCard titulo="Beneficiário" assinatura={beneficiarioAssinatura} />
      </div>
    </div>
  );
}

function Pergunta({ n, texto, resposta, extra }: { n: number; texto: string; resposta: string; extra?: string | null }) {
  return (
    <div className="border-b border-black/5 pb-3 last:border-0 last:pb-0">
      <p className="text-muted">
        {n}. {texto}
      </p>
      <p className="font-medium text-ink">
        {RESPOSTA_LABEL[resposta] ?? resposta}
        {extra ? ` — ${extra}` : ""}
      </p>
    </div>
  );
}

function AssinaturaCard({
  titulo,
  assinatura,
}: {
  titulo: string;
  assinatura?: { fileKey: string; tipo: string; testemunhaNome: string | null } | undefined;
}) {
  return (
    <div className="card text-sm">
      <h2 className="mb-3 font-semibold text-ink">{titulo}</h2>
      {assinatura ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/arquivos/${assinatura.fileKey}`} alt={`Assinatura — ${titulo}`} className="h-32 w-full rounded-lg border border-black/5 object-contain bg-white" />
          {assinatura.tipo === "BENEFICIARIO_DIGITAL" && (
            <p className="mt-2 text-xs text-muted">Impressão digital fotografada · Testemunha: {assinatura.testemunhaNome}</p>
          )}
        </div>
      ) : (
        <p className="text-muted">Não enviada.</p>
      )}
    </div>
  );
}
