import type { Prisma, AuditAction } from "@prisma/client";
import { headers } from "next/headers";

type Tx = Prisma.TransactionClient;

export async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return {
    ip: (fwd?.split(",")[0] || h.get("x-real-ip") || "local").trim(),
    userAgent: h.get("user-agent") || "",
  };
}

export async function writeAudit(
  tx: Tx,
  entry: {
    actorId: string | null;
    acao: AuditAction;
    entidade: string;
    entidadeId: string;
    detalhes?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
  },
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      acao: entry.acao,
      entidade: entry.entidade,
      entidadeId: entry.entidadeId,
      detalhes: (entry.detalhes as Prisma.InputJsonValue | undefined) ?? undefined,
      ip: entry.ip,
      userAgent: entry.userAgent,
    },
  });
}
