import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { requestMeta } from "@/lib/audit";
import { serializeVisita, VISITA_INCLUDE } from "@/lib/visita-response";
import { finalizeVisitaIdempotent } from "@/lib/visita-service";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const visita = await db.visita.findUnique({ where: { id }, include: { assinaturas: true } });
  if (!visita) return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  if (visita.tecnicoId !== user.id && user.role === "TECNICO") {
    return NextResponse.json({ error: "Sem permissão para finalizar esta visita." }, { status: 403 });
  }

  if (visita.status !== "FINALIZADA") {
    const temAssinaturaTecnico = visita.assinaturas.some((a) => a.tipo === "TECNICO");
    const temAssinaturaBeneficiario = visita.assinaturas.some((a) => a.tipo === "BENEFICIARIO_DESENHO" || a.tipo === "BENEFICIARIO_DIGITAL");
    if (!temAssinaturaTecnico || !temAssinaturaBeneficiario) {
      return NextResponse.json({ error: "É necessário enviar a assinatura do técnico e do beneficiário antes de finalizar." }, { status: 422 });
    }
  }

  const meta = await requestMeta();
  await finalizeVisitaIdempotent(id, user.id, meta);

  const full = await db.visita.findUniqueOrThrow({ where: { id }, include: VISITA_INCLUDE });
  return NextResponse.json({ visita: serializeVisita(full) }, { status: 200 });
}
