import { headers } from "next/headers";
import { db } from "@/lib/db";

export async function getClientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] || h.get("x-real-ip") || "local").trim();
}

/**
 * Rate limiting persistido no banco (funciona com várias instâncias / serverless).
 * Retorna { ok: false } quando o limite da janela foi excedido.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; retryAfter: number }> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number; resetAt: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt")
    VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", "resetAt"`;
  const row = rows[0];
  if (!row) throw new Error("Falha inesperada no rate limit (INSERT ... RETURNING não devolveu linha).");
  if (Math.random() < 0.02) {
    void db.rateLimit.deleteMany({ where: { resetAt: { lt: now } } }).catch(() => {});
  }
  return {
    ok: row.count <= limit,
    retryAfter: Math.max(1, Math.ceil((new Date(row.resetAt).getTime() - now.getTime()) / 1000)),
  };
}

/** Atalho: limita por IP + ação. Retorna mensagem de erro ou null se liberado. */
export async function limitByIp(action: string, limit: number, windowSeconds: number, extra = ""): Promise<string | null> {
  const ip = await getClientIp();
  const res = await rateLimit(`${action}:${ip}${extra ? ":" + extra : ""}`, limit, windowSeconds);
  if (res.ok) return null;
  const min = Math.ceil(res.retryAfter / 60);
  return `Muitas tentativas. Tente novamente em ${min <= 1 ? "1 minuto" : `${min} minutos`}.`;
}

/** Atalho: limita por uma chave arbitrária (ex.: e-mail), sem depender do IP. */
export async function limitByKey(action: string, key: string, limit: number, windowSeconds: number): Promise<string | null> {
  const res = await rateLimit(`${action}:${key}`, limit, windowSeconds);
  if (res.ok) return null;
  const min = Math.ceil(res.retryAfter / 60);
  return `Muitas tentativas. Tente novamente em ${min <= 1 ? "1 minuto" : `${min} minutos`}.`;
}
