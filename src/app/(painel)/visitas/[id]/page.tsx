import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { formatCPF } from "@/lib/cpf";
import { DeleteVisitaButton } from "./DeleteVisitaButton";

const fmtDate = (d: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
const simNao = (v: boolean) => (v ? "Sim" : "Não");

export default async function VisitaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";

  const visita = await db.visita.findUnique({
    where: { id },
    include: {
      tecnico: { select: { name: true, matricula: true } },
      purposes: { include: { purpose: { select: { label: true, isOutro: true } } } },
      fotos: { orderBy: { ordem: "asc" } },
      assinaturas: true,
    },
  });
  if (!visita || visita.empresaId !== user.empresaId || (!isStaff && visita.tecnicoId !== user.id)) notFound();

  const tecnicoAssinatura = visita.assinaturas.find((a) => a.tipo === "TECNICO");
  const beneficiarioAssinatura = visita.assinaturas.find((a) => a.tipo !== "TECNICO");
  const podeEditar =
    (visita.status === "RASCUNHO" && (isStaff || visita.tecnicoId === user.id)) ||
    (visita.status === "FINALIZADA" && (user.role === "ADMIN" || (user.role === "TECNICO" && visita.tecnicoId === user.id)));

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
          {podeEditar && (
            <Link href={`/visitas/${visita.id}/editar`} className="btn-secondary">
              {visita.status === "FINALIZADA" ? "Corrigir" : "Editar"}
            </Link>
          )}
          {user.role === "ADMIN" && <DeleteVisitaButton visitaId={visita.id} />}
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
          <p>
            <span className="text-muted">5. Finalidade do crédito:</span> {visita.finalidadeDetalhada}
          </p>
        </div>
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold text-ink">8. Finalidades já aplicadas</h2>
          <ul className="list-inside list-disc text-muted">
            {visita.purposes.map((p) => (
              <li key={p.id}>{p.purpose.isOutro ? `Outro: ${visita.outroFinalidadeDescricao ?? ""}` : p.purpose.label}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card space-y-4 text-sm">
        <h2 className="font-semibold text-ink">Acompanhamento pós-crédito</h2>
        <Pergunta n={7} texto="Está aplicando o recurso conforme finalidade da proposta?" resposta={simNao(visita.aplicandoConforme)} extra={visita.aplicandoConformeJustificativa} />
        <Pergunta n={9} texto="Teve algum desafio na aplicação do recurso?" resposta={simNao(visita.teveDesafio)} extra={visita.desafioDescricao} />
        <Pergunta
          n={10}
          texto="Está recebendo assistência técnica após acessar o crédito?"
          resposta={simNao(visita.assistenciaTecnica)}
          extra={visita.assistenciaTecnica ? (visita.assistenciaPeriodicidade ? `Periodicidade: ${visita.assistenciaPeriodicidade}` : undefined) : visita.assistenciaMotivoNegativa}
        />
        <Pergunta n={12} texto="Nome e contato do técnico que acompanha" resposta={visita.tecnicoNomeContato} />
        <Pergunta n={13} texto="Já tem ponto de referência da área financiada?" resposta={simNao(visita.pontoReferencia)} />
        {visita.observacoes && (
          <div>
            <p className="label">15. Observações</p>
            <p>{visita.observacoes}</p>
          </div>
        )}
      </div>

      <div className="card space-y-3 text-sm">
        <h2 className="font-semibold text-ink">14. Registro de fotos ({visita.fotos.length})</h2>
        {visita.fotos.length === 0 ? (
          <p className="text-muted">Nenhuma foto enviada.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {visita.fotos.map((f) => (
              <a key={f.id} href={`/api/arquivos/${f.fileKey}`} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/arquivos/${f.fileKey}`} alt={f.legenda ?? "Foto da visita"} className="aspect-square w-full rounded-lg object-cover hover:opacity-90" />
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <AssinaturaCard titulo="Assinatura do Técnico" assinatura={tecnicoAssinatura} />
        <AssinaturaCard titulo="Assinatura do Agricultor" assinatura={beneficiarioAssinatura} />
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
        {resposta}
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
          <img src={`/api/arquivos/${assinatura.fileKey}`} alt={titulo} className="h-32 w-full rounded-lg border border-black/5 object-contain bg-white" />
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
