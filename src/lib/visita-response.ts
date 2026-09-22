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
    numeroDocumento: v.numeroDocumento,
    status: v.status,
    tecnicoId: v.tecnicoId,
    beneficiario: {
      nome: v.beneficiarioNomeSnapshot,
      cpf: v.beneficiarioCpfSnapshot,
      endereco: v.beneficiarioEnderecoSnapshot,
    },
    municipio: v.municipio,
    dataVisita: v.dataVisita.toISOString(),
    purposeIds: v.purposes.map((p) => p.purposeId),
    pergunta7Resposta: v.pergunta7Resposta,
    pergunta7Justificativa: v.pergunta7Justificativa,
    pergunta8Resposta: v.pergunta8Resposta,
    pergunta9Resposta: v.pergunta9Resposta,
    pergunta9QuantidadeEmpregos: v.pergunta9QuantidadeEmpregos,
    pergunta9RendaEstimadaCents: v.pergunta9RendaEstimadaCents,
    pergunta10Resposta: v.pergunta10Resposta,
    pergunta10MotivoParalisacao: v.pergunta10MotivoParalisacao,
    pergunta11Resposta: v.pergunta11Resposta,
    pergunta11ParcelasAtrasadas: v.pergunta11ParcelasAtrasadas,
    pergunta12Resposta: v.pergunta12Resposta,
    pergunta12Dificuldades: v.pergunta12Dificuldades,
    pergunta13Resposta: v.pergunta13Resposta,
    pergunta13Motivo: v.pergunta13Motivo,
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
