// Lógica de negócio compartilhada entre as rotas de API e os testes —
// mantém a criação/finalização idempotente testável sem depender do
// contexto de requisição do Next.js (cookies()/headers()).
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { VisitaInput } from "@/lib/schemas/visita";
import { writeAudit } from "@/lib/audit";
import { VISITA_INCLUDE, type VisitaWithRelations } from "@/lib/visita-response";

export type RequestMeta = { ip?: string; userAgent?: string };

/**
 * Cria a visita se `data.clientLocalId` ainda não existir; caso já exista
 * (reenvio de rede do app), devolve a mesma visita sem duplicar. `created`
 * diz se esta chamada foi quem criou o registro (útil só para testes/telemetria).
 */
export async function createVisitaIdempotent(
  tecnicoId: string,
  empresaId: string,
  data: VisitaInput,
  meta: RequestMeta = {},
): Promise<{ visita: VisitaWithRelations; created: boolean } | { conflict: true }> {
  const existing = await db.visita.findUnique({ where: { clientLocalId: data.clientLocalId }, include: VISITA_INCLUDE });
  if (existing) {
    if (existing.tecnicoId !== tecnicoId || existing.empresaId !== empresaId) return { conflict: true };
    return { visita: existing, created: false };
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const beneficiario = await tx.beneficiario.upsert({
        where: { empresaId_cpf: { empresaId, cpf: data.beneficiarioCpf } },
        update: { nome: data.beneficiarioNome, endereco: data.beneficiarioEndereco, municipio: data.municipio },
        create: { empresaId, cpf: data.beneficiarioCpf, nome: data.beneficiarioNome, endereco: data.beneficiarioEndereco, municipio: data.municipio },
      });

      const visita = await tx.visita.create({
        data: {
          clientLocalId: data.clientLocalId,
          empresaId,
          tecnicoId,
          beneficiarioId: beneficiario.id,
          beneficiarioNomeSnapshot: data.beneficiarioNome,
          beneficiarioCpfSnapshot: data.beneficiarioCpf,
          beneficiarioEnderecoSnapshot: data.beneficiarioEndereco,
          municipio: data.municipio,
          dataVisita: new Date(`${data.dataVisita}T12:00:00-03:00`),
          purposes: { create: data.purposeIds.map((purposeId) => ({ purposeId })) },
          pergunta7Resposta: data.pergunta7Resposta,
          pergunta7Justificativa: data.pergunta7Justificativa,
          pergunta8Resposta: data.pergunta8Resposta,
          pergunta9Resposta: data.pergunta9Resposta,
          pergunta9QuantidadeEmpregos: data.pergunta9QuantidadeEmpregos,
          pergunta9RendaEstimadaCents: data.pergunta9RendaEstimadaCents,
          pergunta10Resposta: data.pergunta10Resposta,
          pergunta10MotivoParalisacao: data.pergunta10MotivoParalisacao,
          pergunta11Resposta: data.pergunta11Resposta,
          pergunta11ParcelasAtrasadas: data.pergunta11ParcelasAtrasadas,
          pergunta12Resposta: data.pergunta12Resposta,
          pergunta12Dificuldades: data.pergunta12Dificuldades,
          pergunta13Resposta: data.pergunta13Resposta,
          pergunta13Motivo: data.pergunta13Motivo,
          observacoes: data.observacoes,
        },
        include: VISITA_INCLUDE,
      });

      await writeAudit(tx, { actorId: tecnicoId, acao: "CRIACAO", entidade: "Visita", entidadeId: visita.id, ip: meta.ip, userAgent: meta.userAgent });
      return visita;
    });
    return { visita: created, created: true };
  } catch (err) {
    // Corrida: duas requisições com o mesmo clientLocalId quase ao mesmo tempo.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const race = await db.visita.findUniqueOrThrow({ where: { clientLocalId: data.clientLocalId }, include: VISITA_INCLUDE });
      return { visita: race, created: false };
    }
    throw err;
  }
}

function documentNumber(ano: number, numero: number): string {
  return `VP-${ano}-${String(numero).padStart(6, "0")}`;
}

/**
 * Finaliza a visita, atribuindo o número oficial do documento. Se chamada de
 * novo para uma visita já finalizada (reenvio), devolve o MESMO número — o
 * contador (`DocumentSequence`) nunca é incrementado duas vezes para a mesma visita.
 */
export async function finalizeVisitaIdempotent(visitaId: string, userId: string, meta: RequestMeta = {}) {
  return db.$transaction(async (tx) => {
    const current = await tx.visita.findUniqueOrThrow({ where: { id: visitaId } });
    if (current.status === "FINALIZADA") return current;

    const ano = current.dataVisita.getFullYear();
    const seq = await tx.documentSequence.upsert({
      where: { empresaId_ano: { empresaId: current.empresaId, ano } },
      update: { ultimo: { increment: 1 } },
      create: { empresaId: current.empresaId, ano, ultimo: 1 },
    });

    const result = await tx.visita.update({
      where: { id: visitaId },
      data: { status: "FINALIZADA", numeroDocumento: documentNumber(ano, seq.ultimo), finalizadaEm: new Date(), finalizadaPorId: userId },
    });

    await writeAudit(tx, {
      actorId: userId,
      acao: "FINALIZACAO",
      entidade: "Visita",
      entidadeId: visitaId,
      ip: meta.ip,
      userAgent: meta.userAgent,
      detalhes: { numeroDocumento: result.numeroDocumento },
    });
    return result;
  });
}
