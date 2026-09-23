"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { deleteStoredFile } from "@/lib/storage";
import { writeAudit, requestMeta } from "@/lib/audit";
import { parseForm } from "@/lib/action";

const excluirSchema = z.object({ visitaId: z.string().min(1) });

/**
 * Exclusão definitiva — usada para corrigir cadastros de teste/engano.
 * Restrita a ADMIN da própria empresa da visita; some com a visita, fotos,
 * assinaturas e PDF (se já gerado). O número do documento (se já atribuído)
 * fica com um "buraco" na sequência — isso é esperado e inofensivo.
 */
export async function excluirVisitaAction(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseForm(excluirSchema, fd);
  if (!parsed.success) return;

  const visita = await db.visita.findUnique({
    where: { id: parsed.data.visitaId },
    include: { fotos: true, assinaturas: true },
  });
  if (!visita || visita.empresaId !== admin.empresaId) return;

  await Promise.all([
    ...visita.fotos.map((f) => deleteStoredFile(f.fileKey)),
    ...visita.assinaturas.map((a) => deleteStoredFile(a.fileKey)),
    deleteStoredFile(visita.pdfFileKey),
  ]);

  await db.$transaction(async (tx) => {
    const meta = await requestMeta();
    await writeAudit(tx, {
      actorId: admin.id,
      acao: "EXCLUSAO",
      entidade: "Visita",
      entidadeId: visita.id,
      detalhes: { beneficiario: visita.beneficiarioNomeSnapshot, numeroDocumento: visita.numeroDocumento },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await tx.visita.delete({ where: { id: visita.id } });
  });

  redirect("/visitas");
}
