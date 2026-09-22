import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, burnPasswordCheck } from "@/lib/auth/password";
import { issueTokenPair } from "@/lib/auth/mobile";
import { limitByIp, limitByKey } from "@/lib/rate-limit";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zEmail } from "@/lib/validation";

const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, "Informe a senha."),
  deviceId: z.string().trim().max(200).optional(),
});

export async function POST(req: Request) {
  const limitedIp = await limitByIp("login-mobile", 20, 60);
  if (limitedIp) return NextResponse.json({ error: limitedIp }, { status: 429 });

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  const parsed = loginSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "E-mail ou senha inválidos." }, { status: 422 });
  const { email, password, deviceId } = parsed.data;

  const limitedEmail = await limitByKey("login-mobile-email", email, 10, 60);
  if (limitedEmail) return NextResponse.json({ error: limitedEmail }, { status: 429 });

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await burnPasswordCheck(password); // equaliza o tempo de resposta (dificulta enumerar e-mails)
    return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid || !user.active) {
    const meta = await requestMeta();
    await db.auditLog.create({
      data: { actorId: user.id, acao: "LOGIN_FALHOU", entidade: "User", entidadeId: user.id, ip: meta.ip, userAgent: meta.userAgent },
    });
    return NextResponse.json({ error: user.active ? "E-mail ou senha incorretos." : "Conta desativada. Fale com a coordenação." }, { status: 401 });
  }

  const tokens = await issueTokenPair(user, deviceId ?? null);

  await db.$transaction(async (tx) => {
    const meta = await requestMeta();
    await writeAudit(tx, { actorId: user.id, acao: "LOGIN_MOBILE", entidade: "User", entidadeId: user.id, ip: meta.ip, userAgent: meta.userAgent, detalhes: { deviceId } });
  });

  return NextResponse.json({
    ...tokens,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, matricula: user.matricula },
  });
}
