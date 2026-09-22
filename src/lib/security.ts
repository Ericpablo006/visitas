import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Verifica que a requisição (rota de API com cookie) veio do próprio site — proteção CSRF extra. */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // GET/navegação direta; POSTs de navegadores sempre enviam Origin
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
