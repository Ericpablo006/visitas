"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zDateInput } from "@/lib/validation";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const agendamentoSchema = z
  .object({
    beneficiarioId: z.string().cuid("Selecione um cliente."),
    nomePropriedade: z.string().trim().min(2, "Informe o nome da propriedade.").max(150),
    tecnicoId: z.string().cuid("Selecione um técnico."),
    dataAgendada: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null))
      .refine((v) => v === null || zDateInput.safeParse(v).success, "Data inválida."),
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
    observacoes: z.string().trim().max(1000).optional(),
  })
  .refine((v) => (v.latitude == null) === (v.longitude == null), {
    message: "Marque a localização no mapa.",
    path: ["latitude"],
  });

export async function createAgendamentoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const staff = await requireCoordenadorOuAdmin();
    const parsed = parseForm(agendamentoSchema, fd);
    if (!parsed.success) return parsed.state;
    const data = parsed.data;

    const beneficiario = await db.beneficiario.findUnique({ where: { id: data.beneficiarioId } });
    if (!beneficiario || beneficiario.empresaId !== staff.empresaId) return fail("Cliente não encontrado.");

    const tecnico = await db.user.findUnique({ where: { id: data.tecnicoId } });
    if (!tecnico || tecnico.empresaId !== staff.empresaId || !tecnico.active || (tecnico.role !== "TECNICO" && tecnico.role !== "COORDENADOR")) {
      return fail("Técnico inválido.");
    }

    const agendamento = await db.$transaction(async (tx) => {
      const created = await tx.agendamento.create({
        data: {
          empresaId: staff.empresaId!,
          beneficiarioId: data.beneficiarioId,
          nomePropriedade: data.nomePropriedade,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          dataAgendada: data.dataAgendada ? new Date(`${data.dataAgendada}T12:00:00-03:00`) : null,
          observacoes: data.observacoes || null,
          tecnicoId: data.tecnicoId,
          criadoPorId: staff.id,
        },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: staff.id, acao: "CRIACAO", entidade: "Agendamento", entidadeId: created.id, ip: meta.ip, userAgent: meta.userAgent });
      return created;
    });

    revalidatePath("/admin/agenda");
    return ok(`Visita agendada para ${beneficiario.nome} (${tecnico.name}).`);
  });
}

const updateSchema = agendamentoSchema.and(z.object({ id: z.string().cuid() }));

export async function updateAgendamentoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const staff = await requireCoordenadorOuAdmin();
    const parsed = parseForm(updateSchema, fd);
    if (!parsed.success) return parsed.state;
    const data = parsed.data;

    const target = await db.agendamento.findUnique({ where: { id: data.id } });
    if (!target || target.empresaId !== staff.empresaId) return fail("Agendamento não encontrado.");

    const tecnico = await db.user.findUnique({ where: { id: data.tecnicoId } });
    if (!tecnico || tecnico.empresaId !== staff.empresaId || !tecnico.active) return fail("Técnico inválido.");

    const agendamento = await db.$transaction(async (tx) => {
      const updated = await tx.agendamento.update({
        where: { id: data.id },
        data: {
          nomePropriedade: data.nomePropriedade,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          dataAgendada: data.dataAgendada ? new Date(`${data.dataAgendada}T12:00:00-03:00`) : null,
          observacoes: data.observacoes || null,
          tecnicoId: data.tecnicoId,
        },
      });
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: staff.id, acao: "EDICAO", entidade: "Agendamento", entidadeId: updated.id, ip: meta.ip, userAgent: meta.userAgent });
      return updated;
    });

    revalidatePath("/admin/agenda");
    return ok("Agendamento atualizado.");
  });
}
