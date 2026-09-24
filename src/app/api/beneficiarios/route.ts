import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";

/** Lista de clientes cadastrados pelo admin/coordenador — usada pelo app pra "puxar" o
 * cadastro (nome/endereço/município) ao invés do técnico redigitar tudo em campo. */
export async function GET(req: Request) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!user.empresaId) return NextResponse.json({ clientes: [] });

  const clientes = await db.beneficiario.findMany({
    where: { empresaId: user.empresaId },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, cpf: true, endereco: true, municipio: true, updatedAt: true },
  });

  return NextResponse.json({ clientes: clientes.map((c) => ({ ...c, updatedAt: c.updatedAt.toISOString() })) });
}
