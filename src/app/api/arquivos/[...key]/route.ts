import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { openPrivateFile, privateMime } from "@/lib/storage";

// Serve fotos, assinaturas e PDFs privados. Chave: visitas/<visitaId>/<uuid>.<ext>.
// Só o técnico dono da visita ou um coordenador/admin pode baixar — dados
// sensíveis (CPF, imagem de pessoas) nunca ficam acessíveis por URL direta sem sessão.
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { key: keyParts } = await params;
  const key = keyParts.join("/");

  const [prefix, visitaId] = key.split("/");
  if (prefix !== "visitas" || !visitaId) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const visita = await db.visita.findUnique({ where: { id: visitaId }, select: { tecnicoId: true, empresaId: true } });
  if (!visita || visita.empresaId !== user.empresaId) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });
  if (!isStaff && visita.tecnicoId !== user.id) return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const file = await openPrivateFile(key);
  if (!file) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 });

  return new Response(file.stream, {
    headers: {
      "Content-Type": privateMime(key) || "application/octet-stream",
      "Content-Length": String(file.size),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
