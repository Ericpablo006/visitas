"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const createSchema = z.object({ label: z.string().trim().min(2, "Informe o texto da finalidade.").max(200) });

export async function createFinalidadeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const admin = await requireCoordenadorOuAdmin();
    const parsed = parseForm(createSchema, fd);
    if (!parsed.success) return parsed.state;

    const max = await db.purpose.aggregate({ where: { empresaId: admin.empresaId! }, _max: { sortOrder: true } });
    await db.purpose.create({ data: { empresaId: admin.empresaId!, label: parsed.data.label, sortOrder: (max._max.sortOrder ?? 0) + 1 } });

    revalidatePath("/admin/finalidades");
    return ok("Finalidade adicionada.");
  });
}

const toggleSchema = z.object({ id: z.string().min(1), ativo: z.enum(["true", "false"]) });

/** Ligada diretamente a um <form action={...}> (sem useActionState) — não precisa de estado anterior. */
export async function toggleFinalidadeAction(fd: FormData): Promise<void> {
  const admin = await requireCoordenadorOuAdmin();
  const parsed = parseForm(toggleSchema, fd);
  if (!parsed.success) return;

  await db.purpose.updateMany({ where: { id: parsed.data.id, empresaId: admin.empresaId! }, data: { ativo: parsed.data.ativo === "true" } });
  revalidatePath("/admin/finalidades");
}

const editSchema = z.object({ id: z.string().min(1), label: z.string().trim().min(2, "Informe o texto da finalidade.").max(200) });

export async function editFinalidadeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const admin = await requireCoordenadorOuAdmin();
    const parsed = parseForm(editSchema, fd);
    if (!parsed.success) return parsed.state;

    const result = await db.purpose.updateMany({ where: { id: parsed.data.id, empresaId: admin.empresaId! }, data: { label: parsed.data.label } });
    if (result.count === 0) return fail("Finalidade não encontrada.");
    revalidatePath("/admin/finalidades");
    return ok("Finalidade atualizada.");
  });
}

const deleteSchema = z.object({ id: z.string().min(1) });

/**
 * Exclusão definitiva. Bloqueada se a finalidade já foi usada em alguma visita
 * (constraint RESTRICT no banco) — nesse caso a orientação é desativar em vez de
 * excluir, pra não perder o histórico de visitas já registradas.
 */
export async function deleteFinalidadeAction(fd: FormData): Promise<void> {
  const admin = await requireCoordenadorOuAdmin();
  const parsed = parseForm(deleteSchema, fd);
  if (!parsed.success) return;

  const target = await db.purpose.findUnique({ where: { id: parsed.data.id } });
  if (!target || target.empresaId !== admin.empresaId) return;

  const usoCount = await db.visitaPurpose.count({ where: { purposeId: target.id } });
  if (usoCount > 0) {
    redirect(`/admin/finalidades?erro=${encodeURIComponent("Não é possível excluir: esta finalidade já foi usada em visitas. Desative-a em vez de excluir.")}`);
  }

  await db.purpose.delete({ where: { id: target.id } });
  revalidatePath("/admin/finalidades");
}
