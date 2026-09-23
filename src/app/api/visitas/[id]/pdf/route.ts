import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { renderVisitaPdf } from "@/lib/pdf/visita-pdf";
import { savePrivatePdf, openPrivateFile } from "@/lib/storage";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const visita = await db.visita.findUnique({
    where: { id },
    include: {
      tecnico: { select: { name: true, email: true, matricula: true } },
      finalizadaPor: { select: { name: true } },
      purposes: { include: { purpose: { select: { label: true } } } },
      fotos: { orderBy: { ordem: "asc" } },
      assinaturas: true,
    },
  });
  if (!visita || visita.empresaId !== user.empresaId) return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  if (!isStaff && visita.tecnicoId !== user.id) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  if (visita.status !== "FINALIZADA") {
    return NextResponse.json({ error: "O PDF só fica disponível depois que a visita é finalizada." }, { status: 409 });
  }

  let fileKey = visita.pdfFileKey;
  if (!fileKey) {
    const bytes = await renderVisitaPdf({
      ...visita,
      purposeLabels: visita.purposes.map((p) => p.purpose.label),
    });
    const saved = await savePrivatePdf(visita.id, bytes);
    fileKey = saved.key;
    await db.visita.update({ where: { id: visita.id }, data: { pdfFileKey: fileKey } });
  }

  const file = await openPrivateFile(fileKey);
  if (!file) return NextResponse.json({ error: "Arquivo do PDF não encontrado no servidor." }, { status: 500 });

  return new Response(file.stream, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(file.size),
      "Content-Disposition": `inline; filename="visita-${visita.numeroDocumento}.pdf"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
