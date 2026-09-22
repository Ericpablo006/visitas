// Autenticação do app Android: par access-token (curta duração) + refresh-token
// (longa duração, rotacionado a cada uso). Usa um segredo PRÓPRIO
// (MOBILE_AUTH_SECRET), separado do cookie de sessão do site — assim revogar
// um não afeta o outro, e um token de um tipo nunca pode ser usado como o outro
// (claim `typ` verificada nos dois lados).
import { randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import { getAuthSecret, getMobileAuthSecret } from "@/lib/env";
import { sha256 } from "@/lib/security";
import { verifySession, SESSION_COOKIE, type Role, ROLES } from "./token";
import type { SessionUser } from "./session";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutos
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 dias

export type MobilePayload = { sub: string; role: Role; tv: number };

const key = (secret: string) => new TextEncoder().encode(secret);

async function signAccessToken(payload: MobilePayload): Promise<string> {
  return new SignJWT({ role: payload.role, tv: payload.tv, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key(getMobileAuthSecret()));
}

async function signRefreshToken(payload: MobilePayload): Promise<{ token: string; jti: string }> {
  const jti = randomUUID();
  const token = await new SignJWT({ role: payload.role, tv: payload.tv, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_SECONDS}s`)
    .sign(key(getMobileAuthSecret()));
  return { token, jti };
}

export async function verifyAccessToken(token: string | undefined): Promise<MobilePayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(getMobileAuthSecret()), { algorithms: ["HS256"] });
    if (payload.typ !== "access") return null;
    if (!payload.sub || !ROLES.includes(payload.role as Role)) return null;
    return { sub: payload.sub, role: payload.role as Role, tv: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

async function verifyRefreshTokenSignature(token: string): Promise<MobilePayload | null> {
  try {
    const { payload } = await jwtVerify(token, key(getMobileAuthSecret()), { algorithms: ["HS256"] });
    if (payload.typ !== "refresh") return null;
    if (!payload.sub || !ROLES.includes(payload.role as Role)) return null;
    return { sub: payload.sub, role: payload.role as Role, tv: Number(payload.tv ?? 0) };
  } catch {
    return null;
  }
}

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
};

/** Emite um novo par de tokens e grava o refresh token (hash) no banco. */
export async function issueTokenPair(
  user: { id: string; role: Role; tokenVersion: number },
  deviceId: string | null,
): Promise<TokenPair> {
  const accessToken = await signAccessToken({ sub: user.id, role: user.role, tv: user.tokenVersion });
  const { token: refreshToken } = await signRefreshToken({ sub: user.id, role: user.role, tv: user.tokenVersion });
  await db.mobileRefreshToken.create({
    data: {
      userId: user.id,
      tokenHash: sha256(refreshToken),
      deviceId: deviceId || null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresIn: REFRESH_TOKEN_TTL_SECONDS,
  };
}

export class RefreshTokenError extends Error {
  constructor(public code: "INVALID" | "EXPIRED" | "REVOGADO" | "USUARIO_INATIVO") {
    super(code);
  }
}

/**
 * Troca um refresh token válido por um novo par (rotação). Se o token
 * apresentado já havia sido revogado (reenvio de um token roubado/antigo),
 * trata como possível roubo: revoga TODOS os refresh tokens do usuário e
 * incrementa tokenVersion — derruba toda sessão (web e mobile) na hora.
 */
export async function rotateRefreshToken(rawRefreshToken: string, deviceId: string | null): Promise<TokenPair> {
  const payload = await verifyRefreshTokenSignature(rawRefreshToken);
  if (!payload) throw new RefreshTokenError("INVALID");

  const hash = sha256(rawRefreshToken);
  const stored = await db.mobileRefreshToken.findUnique({ where: { tokenHash: hash } });
  if (!stored) throw new RefreshTokenError("INVALID");

  if (stored.revokedAt) {
    await revokeAllRefreshTokens(stored.userId);
    await db.user.update({ where: { id: stored.userId }, data: { tokenVersion: { increment: 1 } } });
    throw new RefreshTokenError("REVOGADO");
  }
  if (stored.expiresAt < new Date()) throw new RefreshTokenError("EXPIRED");

  const user = await db.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.active) throw new RefreshTokenError("USUARIO_INATIVO");
  if (user.tokenVersion !== payload.tv) throw new RefreshTokenError("REVOGADO");

  await db.mobileRefreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issueTokenPair(user, deviceId ?? stored.deviceId);
}

export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await db.mobileRefreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeRefreshTokenByRawValue(rawRefreshToken: string): Promise<void> {
  const hash = sha256(rawRefreshToken);
  await db.mobileRefreshToken.updateMany({ where: { tokenHash: hash, revokedAt: null }, data: { revokedAt: new Date() } });
}

// ─── Autenticação unificada para rotas de API (cookie OU Bearer) ─────────

function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) return null;
  return auth.slice("Bearer ".length).trim() || null;
}

/**
 * Usuário autenticado para uma rota de API: tenta o header Authorization
 * (app Android) primeiro, depois o cookie de sessão (site). Faz a checagem
 * definitiva no banco (conta ativa + tokenVersion) nos dois casos — é aqui
 * (não no middleware) que a desativação de um usuário realmente passa a valer.
 */
export async function requireApiUser(req: Request): Promise<SessionUser | null> {
  const bearer = extractBearerToken(req);
  if (bearer) {
    const payload = await verifyAccessToken(bearer);
    if (!payload) return null;
    const user = await db.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active || user.tokenVersion !== payload.tv) return null;
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = await verifySession(token, getAuthSecret());
  if (!payload) return null;
  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.active || user.tokenVersion !== payload.tv) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function getRequestDeviceId(): Promise<string | null> {
  const h = await headers();
  return h.get("x-device-id");
}
