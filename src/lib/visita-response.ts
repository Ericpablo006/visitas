import type { Prisma } from "@prisma/client";

const visitaWithRelations = {
  include: {
    purposes: { select: { purposeId: true } },
    fotos: { orderBy: { ordem: "asc" as const } },
    assinaturas: true,
  },
} satisfies Prisma.VisitaDefaultArgs;

export type VisitaWithRelations = Prisma.VisitaGetPayload<typeof visitaWithRelations>;
export const VISITA_INCLUDE = visitaWithRelations.include;

/** Formato JSON devolvido pela API tanto para o wizard web quanto para o app Android. */
export function serializeVisita(v: VisitaWithRelations) {
  return {
    id: v.id,
    clientLocalId: v.clientLocalId,
    agendamentoId: v.agendamentoId,
    numeroDocumento: v.numeroDocumento,
    status: v.status,
    tecnicoId: v.tecnicoId,
    beneficiario: {
      nome: v.beneficiarioNomeSnapshot,
      cpf: v.beneficiarioCpfSnapshot,
      endereco: v.beneficiarioEnderecoSnapshot,
      telefone: v.beneficiarioTelefoneSnapshot,
    },
    municipio: v.municipio,
    latitude: v.latitude,
    longitude: v.longitude,
    dataVisita: v.dataVisita.toISOString(),
    purposeIds: v.purposes.map((p) => p.purposeId),
    finalidadeDetalhada: v.finalidadeDetalhada,
    aplicandoConforme: v.aplicandoConforme,
    aplicandoConformeJustificativa: v.aplicandoConformeJustificativa,
    outroFinalidadeDescricao: v.outroFinalidadeDescricao,
    teveDesafio: v.teveDesafio,
    desafioDescricao: v.desafioDescricao,
    assistenciaTecnica: v.assistenciaTecnica,
    assistenciaPeriodicidade: v.assistenciaPeriodicidade,
    assistenciaMotivoNegativa: v.assistenciaMotivoNegativa,
    tecnicoNomeContato: v.tecnicoNomeContato,
    pontoReferencia: v.pontoReferencia,
    observacoes: v.observacoes,
    fotos: v.fotos.map((f) => ({
      id: f.id,
      clientLocalId: f.clientLocalId,
      legenda: f.legenda,
      ordem: f.ordem,
      url: `/api/arquivos/${f.fileKey}`,
    })),
    assinaturas: v.assinaturas.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      testemunhaNome: a.testemunhaNome,
      testemunhaCpf: a.testemunhaCpf,
      url: `/api/arquivos/${a.fileKey}`,
    })),
    finalizadaEm: v.finalizadaEm ? v.finalizadaEm.toISOString() : null,
    pdfDisponivel: v.status === "FINALIZADA",
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}
