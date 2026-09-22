import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";

export async function GET(req: Request) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const purposes = await db.purpose.findMany({
    where: { ativo: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, sortOrder: true, updatedAt: true },
  });

  return NextResponse.json({ purposes: purposes.map((p) => ({ ...p, updatedAt: p.updatedAt.toISOString() })) });
}
