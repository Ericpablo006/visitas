"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllRefreshTokens } from "@/lib/auth/mobile";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zEmail, zName, zPassword } from "@/lib/validation";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const createTecnicoSchema = z.object({
  name: zName,
  email: zEmail,
  matricula: z.string().trim().max(40).optional(),
  password: zPassword,
  role: z.enum(["TECNICO", "COORDENADOR"]),
});

export async function createTecnicoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const admin = await requireAdmin();
    const parsed = parseForm(createTecnicoSchema, fd);
    if (!parsed.success) return parsed.state;

    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return fail("Já existe um usuário com este e-mail.", { email: "E-mail já cadastrado." });

    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          matricula: parsed.data.matricula || null,
          passwordHash: await hashPassword(parsed.data.password),
          role: parsed.data.role,
        },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: admin.id, acao: "CRIACAO", entidade: "User", entidadeId: created.id, ip: meta.ip, userAgent: meta.userAgent });
      return created;
    });

    revalidatePath("/admin/tecnicos");
    return ok(`Técnico ${user.name} cadastrado.`);
  });
}

const toggleSchema = z.object({ userId: z.string().cuid(), active: z.enum(["true", "false"]) });

/**
 * Ligada diretamente a um <form action={...}> (sem useActionState). Desativar
 * revoga IMEDIATAMENTE toda sessão web e todo refresh token mobile do usuário.
 */
export async function toggleTecnicoActiveAction(fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const parsed = parseForm(toggleSchema, fd);
  if (!parsed.success) return;
  const active = parsed.data.active === "true";

  if (parsed.data.userId === admin.id && !active) return;

  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: parsed.data.userId },
      data: { active, tokenVersion: { increment: 1 } },
    });
    const meta = await requestMeta();
    await writeAudit(tx, { actorId: admin.id, acao: active ? "ATIVACAO" : "DESATIVACAO", entidade: "User", entidadeId: updated.id, ip: meta.ip, userAgent: meta.userAgent });
    return updated;
  });
  if (!active) await revokeAllRefreshTokens(user.id);

  revalidatePath("/admin/tecnicos");
}

const resetPasswordSchema = z.object({ userId: z.string().cuid(), novaSenha: zPassword });

export async function resetTecnicoPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const admin = await requireAdmin();
    const parsed = parseForm(resetPasswordSchema, fd);
    if (!parsed.success) return parsed.state;

    const user = await db.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: parsed.data.userId },
        data: { passwordHash: await hashPassword(parsed.data.novaSenha), tokenVersion: { increment: 1 } },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: admin.id, acao: "EDICAO", entidade: "User", entidadeId: updated.id, detalhes: { redefiniuSenha: true }, ip: meta.ip, userAgent: meta.userAgent });
      return updated;
    });
    await revokeAllRefreshTokens(user.id);

    revalidatePath("/admin/tecnicos");
    return ok(`Senha de ${user.name} redefinida.`);
  });
}
