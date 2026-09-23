// Assinatura/verificação do JWT de sessão (cookie, web). Compatível com o runtime Edge (middleware).
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "taboa_session";
export const SESSION_MAX_AGE = 60 * 60 * 8; // 8 horas — painel administrativo, sessão mais curta que um e-commerce

export type Role = "SUPER_ADMIN" | "TECNICO" | "COORDENADOR" | "ADMIN";
export const ROLES: readonly Role[] = ["SUPER_ADMIN", "TECNICO", "COORDENADOR", "ADMIN"];

export type SessionPayload = { sub: string; role: Role; tv: number };

const key = (secret: string) => new TextEncoder().encode(secret);

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  return new SignJWT({ role: payload.role, tv: payload.tv, typ: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key(secret));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    if (payload.typ !== "session") return null;
    if (!payload.sub || !ROLES.includes(payload.role as Role)) return null;
    return { sub: payload.sub, role: payload.role as Role, tv: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}
