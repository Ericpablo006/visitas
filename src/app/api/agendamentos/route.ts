import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";

export async function GET(req: Request) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!user.empresaId) return NextResponse.json({ agendamentos: [] });

  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const agendamentos = await db.agendamento.findMany({
    where: { empresaId: user.empresaId, tecnicoId: isStaff ? undefined : user.id },
    include: { beneficiario: { select: { nome: true } }, visita: { select: { id: true } } },
    orderBy: [{ dataAgendada: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({
    agendamentos: agendamentos.map((a) => ({
      id: a.id,
      nomeProdutor: a.beneficiario.nome,
      nomePropriedade: a.nomePropriedade,
      latitude: a.latitude,
      longitude: a.longitude,
      dataAgendada: a.dataAgendada ? a.dataAgendada.toISOString() : null,
      observacoes: a.observacoes,
      atendida: a.visita != null,
      updatedAt: a.updatedAt.toISOString(),
    })),
  });
}
