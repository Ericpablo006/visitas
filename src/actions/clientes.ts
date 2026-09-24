"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zCpf, zName } from "@/lib/validation";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const clienteSchema = z
  .object({
    nome: zName,
    cpf: zCpf,
    endereco: z.string().trim().min(3, "Informe o endereço.").max(300),
    municipio: z.string().trim().min(2, "Informe o município.").max(120),
    telefone: z.string().trim().max(30).optional(),
    // Ids das finalidades seedadas são slugs fixos ("finalidade-1", ...), não cuid() —
    // não dá pra validar o formato aqui; a existência é conferida contra o banco abaixo.
    finalidadeCreditoId: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
    finalidadeCreditoOutro: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v ? v : null)),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((v) => (v.latitude == null) === (v.longitude == null), {
    message: "Marque a localização no mapa.",
    path: ["latitude"],
  });

/** Confere que a finalidade existe/pertence à empresa e, se for "Outro", que veio com o texto livre. */
async function validarFinalidade(
  empresaId: string,
  finalidadeCreditoId: string | null,
  finalidadeCreditoOutro: string | null,
): Promise<{ ok: true } | { ok: false; message: string; errors?: Record<string, string> }> {
  if (!finalidadeCreditoId) return { ok: true };
  const finalidade = await db.purpose.findUnique({ where: { id: finalidadeCreditoId } });
  if (!finalidade || finalidade.empresaId !== empresaId) {
    return { ok: false, message: "Finalidade inválida.", errors: { finalidadeCreditoId: "Selecione uma finalidade válida." } };
  }
  if (finalidade.isOutro && !finalidadeCreditoOutro) {
    return { ok: false, message: "Descreva a finalidade em 'Outro'.", errors: { finalidadeCreditoOutro: "Descreva a finalidade." } };
  }
  return { ok: true };
}

export async function createClienteAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const staff = await requireCoordenadorOuAdmin();
    const parsed = parseForm(clienteSchema, fd);
    if (!parsed.success) return parsed.state;

    const existing = await db.beneficiario.findUnique({
      where: { empresaId_cpf: { empresaId: staff.empresaId!, cpf: parsed.data.cpf } },
    });
    if (existing) return fail("Já existe um cliente com este CPF.", { cpf: "CPF já cadastrado." });

    const validacao = await validarFinalidade(staff.empresaId!, parsed.data.finalidadeCreditoId, parsed.data.finalidadeCreditoOutro);
    if (!validacao.ok) return fail(validacao.message, validacao.errors);

    const cliente = await db.$transaction(async (tx) => {
      const created = await tx.beneficiario.create({
        data: {
          empresaId: staff.empresaId!,
          cpf: parsed.data.cpf,
          nome: parsed.data.nome,
          endereco: parsed.data.endereco,
          municipio: parsed.data.municipio,
          telefone: parsed.data.telefone || null,
          finalidadeCreditoId: parsed.data.finalidadeCreditoId,
          finalidadeCreditoOutro: parsed.data.finalidadeCreditoId ? parsed.data.finalidadeCreditoOutro : null,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
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

const updateSchema = clienteSchema.and(z.object({ id: z.string().cuid() }));

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

    const validacao = await validarFinalidade(staff.empresaId!, parsed.data.finalidadeCreditoId, parsed.data.finalidadeCreditoOutro);
    if (!validacao.ok) return fail(validacao.message, validacao.errors);

    const cliente = await db.$transaction(async (tx) => {
      const updated = await tx.beneficiario.update({
        where: { id: parsed.data.id },
        data: {
          cpf: parsed.data.cpf,
          nome: parsed.data.nome,
          endereco: parsed.data.endereco,
          municipio: parsed.data.municipio,
          telefone: parsed.data.telefone || null,
          finalidadeCreditoId: parsed.data.finalidadeCreditoId,
          finalidadeCreditoOutro: parsed.data.finalidadeCreditoId ? parsed.data.finalidadeCreditoOutro : null,
          latitude: parsed.data.latitude ?? null,
          longitude: parsed.data.longitude ?? null,
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

const deleteSchema = z.object({ id: z.string().cuid() });

/**
 * Exclusão definitiva do cadastro do cliente. Bloqueada se já existir visita ou
 * agendamento vinculado (o cadastro fica preservado nesses casos — as visitas já
 * feitas guardam um snapshot próprio dos dados e não dependem do Beneficiario
 * continuar existindo, mas a constraint do banco é RESTRICT, então tratamos aqui
 * com uma mensagem amigável em vez de deixar estourar erro de FK).
 */
export async function deleteClienteAction(fd: FormData): Promise<void> {
  const staff = await requireCoordenadorOuAdmin();
  const parsed = parseForm(deleteSchema, fd);
  if (!parsed.success) return;

  const target = await db.beneficiario.findUnique({ where: { id: parsed.data.id } });
  if (!target || target.empresaId !== staff.empresaId) return;

  const [visitasCount, agendamentosCount] = await Promise.all([
    db.visita.count({ where: { beneficiarioId: target.id } }),
    db.agendamento.count({ where: { beneficiarioId: target.id } }),
  ]);
  if (visitasCount > 0 || agendamentosCount > 0) {
    redirect(`/admin/clientes?erro=${encodeURIComponent("Não é possível excluir: este cliente já tem visitas ou agendamentos vinculados.")}`);
  }

  await db.$transaction(async (tx) => {
    const meta = await requestMeta();
    await writeAudit(tx, {
      actorId: staff.id,
      acao: "EXCLUSAO",
      entidade: "Beneficiario",
      entidadeId: target.id,
      detalhes: { nome: target.nome, cpf: target.cpf },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await tx.beneficiario.delete({ where: { id: target.id } });
  });

  revalidatePath("/admin/clientes");
}
