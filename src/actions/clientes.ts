"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zCpf, zName } from "@/lib/validation";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const clienteSchema = z.object({
  nome: zName,
  cpf: zCpf,
  endereco: z.string().trim().min(3, "Informe o endereço.").max(300),
  municipio: z.string().trim().min(2, "Informe o município.").max(120),
  telefone: z.string().trim().max(30).optional(),
});

export async function createClienteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const staff = await requireCoordenadorOuAdmin();
    const parsed = parseForm(clienteSchema, fd);
    if (!parsed.success) return parsed.state;

    const existing = await db.beneficiario.findUnique({
      where: { empresaId_cpf: { empresaId: staff.empresaId!, cpf: parsed.data.cpf } },
    });
    if (existing) return fail("Já existe um cliente com este CPF.", { cpf: "CPF já cadastrado." });

    const cliente = await db.$transaction(async (tx) => {
      const created = await tx.beneficiario.create({
        data: {
          empresaId: staff.empresaId!,
          cpf: parsed.data.cpf,
          nome: parsed.data.nome,
          endereco: parsed.data.endereco,
          municipio: parsed.data.municipio,
          telefone: parsed.data.telefone || null,
        },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: staff.id, acao: "CRIACAO", entidade: "Beneficiario", entidadeId: created.id, ip: meta.ip, userAgent: meta.userAgent });
      return created;
    });

    revalidatePath("/admin/clientes");
    return ok(`Cliente ${cliente.nome} cadastrado.`);
  });
}

const updateSchema = clienteSchema.extend({ id: z.string().cuid() });

export async function updateClienteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const staff = await requireCoordenadorOuAdmin();
    const parsed = parseForm(updateSchema, fd);
    if (!parsed.success) return parsed.state;

    const target = await db.beneficiario.findUnique({ where: { id: parsed.data.id } });
    if (!target || target.empresaId !== staff.empresaId) return fail("Cliente não encontrado.");

    if (parsed.data.cpf !== target.cpf) {
      const clash = await db.beneficiario.findUnique({
        where: { empresaId_cpf: { empresaId: staff.empresaId!, cpf: parsed.data.cpf } },
      });
      if (clash) return fail("Já existe um cliente com este CPF.", { cpf: "CPF já cadastrado." });
    }

    const cliente = await db.$transaction(async (tx) => {
      const updated = await tx.beneficiario.update({
        where: { id: parsed.data.id },
        data: {
          cpf: parsed.data.cpf,
          nome: parsed.data.nome,
          endereco: parsed.data.endereco,
          municipio: parsed.data.municipio,
          telefone: parsed.data.telefone || null,
        },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: staff.id, acao: "EDICAO", entidade: "Beneficiario", entidadeId: updated.id, ip: meta.ip, userAgent: meta.userAgent });
      return updated;
    });

    revalidatePath("/admin/clientes");
    return ok(`Cliente ${cliente.nome} atualizado.`);
  });
}
