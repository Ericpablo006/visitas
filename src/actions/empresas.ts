"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllRefreshTokens } from "@/lib/auth/mobile";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zEmail, zName, zPassword } from "@/lib/validation";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const createEmpresaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da empresa.").max(200),
  cnpj: z.string().trim().max(20).optional(),
  endereco: z.string().trim().max(300).optional(),
  telefone: z.string().trim().max(30).optional(),
  adminName: zName,
  adminEmail: zEmail,
  adminPassword: zPassword,
});

/** Cadastra a empresa e já cria a primeira conta ADMIN dela — sem isso a empresa fica sem ninguém que consiga entrar. */
export async function createEmpresaAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const superAdmin = await requireSuperAdmin();
    const parsed = parseForm(createEmpresaSchema, fd);
    if (!parsed.success) return parsed.state;

    const existingEmail = await db.user.findUnique({ where: { email: parsed.data.adminEmail } });
    if (existingEmail) return fail("Já existe um usuário com este e-mail.", { adminEmail: "E-mail já cadastrado." });

    if (parsed.data.cnpj) {
      const existingCnpj = await db.empresa.findUnique({ where: { cnpj: parsed.data.cnpj } });
      if (existingCnpj) return fail("Já existe uma empresa com este CNPJ.", { cnpj: "CNPJ já cadastrado." });
    }

    const empresa = await db.$transaction(async (tx) => {
      const created = await tx.empresa.create({
        data: {
          nome: parsed.data.nome,
          cnpj: parsed.data.cnpj || null,
          endereco: parsed.data.endereco || null,
          telefone: parsed.data.telefone || null,
        },
      });
      const admin = await tx.user.create({
        data: {
          empresaId: created.id,
          name: parsed.data.adminName,
          email: parsed.data.adminEmail,
          passwordHash: await hashPassword(parsed.data.adminPassword),
          role: "ADMIN",
        },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: superAdmin.id, acao: "CRIACAO", entidade: "Empresa", entidadeId: created.id, ip: meta.ip, userAgent: meta.userAgent });
      await writeAudit(tx, { actorId: superAdmin.id, acao: "CRIACAO", entidade: "User", entidadeId: admin.id, ip: meta.ip, userAgent: meta.userAgent });
      return created;
    });

    revalidatePath("/admin/empresas");
    return ok(`Empresa ${empresa.nome} cadastrada.`);
  });
}

const toggleSchema = z.object({ empresaId: z.string().min(1), ativa: z.enum(["true", "false"]) });

/**
 * Ligada diretamente a um <form action={...}> (sem useActionState). Desativar a empresa
 * desativa TODOS os usuários dela e derruba toda sessão web/app na hora (mesma lógica de
 * desativar um técnico, aplicada em lote).
 */
export async function toggleEmpresaAtivaAction(fd: FormData): Promise<void> {
  const superAdmin = await requireSuperAdmin();
  const parsed = parseForm(toggleSchema, fd);
  if (!parsed.success) return;
  const ativa = parsed.data.ativa === "true";

  const usuarios = await db.$transaction(async (tx) => {
    await tx.empresa.update({ where: { id: parsed.data.empresaId }, data: { ativa } });
    const affected = ativa
      ? []
      : await tx.user.findMany({ where: { empresaId: parsed.data.empresaId, active: true }, select: { id: true } });
    if (!ativa && affected.length > 0) {
      await tx.user.updateMany({ where: { empresaId: parsed.data.empresaId }, data: { active: false, tokenVersion: { increment: 1 } } });
    }
    const meta = await requestMeta();
    await writeAudit(tx, {
      actorId: superAdmin.id,
      acao: ativa ? "ATIVACAO" : "DESATIVACAO",
      entidade: "Empresa",
      entidadeId: parsed.data.empresaId,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return affected;
  });
  await Promise.all(usuarios.map((u) => revokeAllRefreshTokens(u.id)));

  revalidatePath("/admin/empresas");
}
