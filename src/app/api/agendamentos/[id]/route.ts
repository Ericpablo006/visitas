import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { z } from "zod";
import { zDateInput } from "@/lib/validation";
import { writeAudit, requestMeta } from "@/lib/audit";

const patchSchema = z.object({
  nomePropriedade: z.string().trim().min(2).max(150),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  dataAgendada: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || zDateInput.safeParse(v).success, "Data inválida."),
  observacoes: z.string().trim().max(1000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const agendamento = await db.agendamento.findUnique({ where: { id } });
  if (!agendamento || agendamento.empresaId !== user.empresaId) return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });

  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  if (!isStaff && agendamento.tecnicoId !== user.id) {
    return NextResponse.json({ error: "Sem permissão para editar este agendamento." }, { status: 403 });
  }

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
  const data = parsed.data;

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.agendamento.update({
      where: { id },
      data: {
        nomePropriedade: data.nomePropriedade,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        dataAgendada: data.dataAgendada ? new Date(`${data.dataAgendada}T12:00:00-03:00`) : null,
        observacoes: data.observacoes || null,
      },
    });
    const meta = await requestMeta();
    await writeAudit(tx, { actorId: user.id, acao: "EDICAO", entidade: "Agendamento", entidadeId: result.id, ip: meta.ip, userAgent: meta.userAgent });
    return result;
  });

  return NextResponse.json({
    agendamento: {
      id: updated.id,
      nomePropriedade: updated.nomePropriedade,
      latitude: updated.latitude,
      longitude: updated.longitude,
      dataAgendada: updated.dataAgendada ? updated.dataAgendada.toISOString() : null,
      observacoes: updated.observacoes,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
