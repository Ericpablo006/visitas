import { NextResponse } from "next/server";
import { z } from "zod";
import { revokeRefreshTokenByRawValue, requireApiUser } from "@/lib/auth/mobile";
import { writeAudit, requestMeta } from "@/lib/audit";
import { db } from "@/lib/db";

const logoutSchema = z.object({ refreshToken: z.string().min(10) });

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = logoutSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Token inválido." }, { status: 422 });

  await revokeRefreshTokenByRawValue(parsed.data.refreshToken);

  const user = await requireApiUser(req);
  if (user) {
    await db.$transaction(async (tx) => {
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: user.id, acao: "LOGOUT", entidade: "User", entidadeId: user.id, ip: meta.ip, userAgent: meta.userAgent });
    });
  }

  return NextResponse.json({ ok: true });
}
