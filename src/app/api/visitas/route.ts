import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { visitaSchema } from "@/lib/schemas/visita";
import { limitByIp } from "@/lib/rate-limit";
import { requestMeta } from "@/lib/audit";
import { serializeVisita, VISITA_INCLUDE } from "@/lib/visita-response";
import { createVisitaIdempotent } from "@/lib/visita-service";

export async function POST(req: Request) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const limited = await limitByIp("criar-visita", 60, 60);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });

  const parsed = visitaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
  }
  const data = parsed.data;

  const purposes = await db.purpose.findMany({ where: { id: { in: data.purposeIds }, ativo: true }, select: { id: true } });
  if (purposes.length !== data.purposeIds.length) {
    return NextResponse.json({ error: "Uma ou mais finalidades selecionadas não existem mais." }, { status: 422 });
  }

  const meta = await requestMeta();
  const result = await createVisitaIdempotent(user.id, data, meta);
  if ("conflict" in result) {
    return NextResponse.json({ error: "Esta visita pertence a outro técnico." }, { status: 409 });
  }

  return NextResponse.json({ visita: serializeVisita(result.visita) }, { status: result.created ? 201 : 200 });
}

export async function GET(req: Request) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";

  const visitas = await db.visita.findMany({
    where: {
      tecnicoId: isStaff ? undefined : user.id,
      status: status === "RASCUNHO" || status === "FINALIZADA" ? status : undefined,
    },
    include: VISITA_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ visitas: visitas.map(serializeVisita) });
}
