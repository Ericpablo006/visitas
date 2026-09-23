"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
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
