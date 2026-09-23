"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, burnPasswordCheck } from "@/lib/auth/password";
import { createSession, destroySession, safeNext } from "@/lib/auth/session";
import { limitByIp, limitByKey } from "@/lib/rate-limit";
import { writeAudit, requestMeta } from "@/lib/audit";
import { zEmail, zPassword } from "@/lib/validation";
import { ok, fail, parseForm, safely, type ActionState } from "@/lib/action";

const loginSchema = z.object({
  email: zEmail,
  password: z.string().min(1, "Informe a senha."),
  next: z.string().optional(),
});

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const parsed = parseForm(loginSchema, fd);
    if (!parsed.success) return parsed.state;
    const { email, password, next } = parsed.data;

    const limitedIp = await limitByIp("login-web", 20, 60);
    if (limitedIp) return fail(limitedIp);
    const limitedEmail = await limitByKey("login-web-email", email, 10, 60);
    if (limitedEmail) return fail(limitedEmail);

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      await burnPasswordCheck(password);
      return fail("E-mail ou senha incorretos.");
    }
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid || !user.active) {
      const meta = await requestMeta();
      await db.auditLog.create({ data: { actorId: user.id, acao: "LOGIN_FALHOU", entidade: "User", entidadeId: user.id, ip: meta.ip, userAgent: meta.userAgent } });
      return fail(user.active ? "E-mail ou senha incorretos." : "Conta desativada. Fale com a coordenação.");
    }

    await createSession({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });
    await db.$transaction(async (tx) => {
      const meta = await requestMeta();
      await writeAudit(tx, { actorId: user.id, acao: "LOGIN", entidade: "User", entidadeId: user.id, ip: meta.ip, userAgent: meta.userAgent });
    });

    redirect(safeNext(next, user.role === "SUPER_ADMIN" ? "/admin/empresas" : "/painel"));
  });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/entrar");
}

const changePasswordSchema = z
  .object({ senhaAtual: z.string().min(1), novaSenha: zPassword, confirmarSenha: z.string().min(1) })
  .refine((d) => d.novaSenha === d.confirmarSenha, { path: ["confirmarSenha"], message: "As senhas não conferem." });

export async function changeOwnPasswordAction(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  return safely(async () => {
    const parsed = parseForm(changePasswordSchema, fd);
    if (!parsed.success) return parsed.state;

    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await verifyPassword(parsed.data.senhaAtual, user.passwordHash);
    if (!valid) return fail("Senha atual incorreta.", { senhaAtual: "Senha atual incorreta." });

    await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.novaSenha) } });
    return ok("Senha atualizada.");
  });
}
