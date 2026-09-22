import { NextResponse } from "next/server";
import { z } from "zod";
import { rotateRefreshToken, RefreshTokenError } from "@/lib/auth/mobile";
import { limitByIp } from "@/lib/rate-limit";

const refreshSchema = z.object({
  refreshToken: z.string().min(10, "Token inválido."),
  deviceId: z.string().trim().max(200).optional(),
});

const ERROR_MESSAGE: Record<RefreshTokenError["code"], string> = {
  INVALID: "Sessão inválida. Faça login novamente.",
  EXPIRED: "Sessão expirada. Faça login novamente.",
  REVOGADO: "Sessão revogada. Faça login novamente.",
  USUARIO_INATIVO: "Conta desativada. Fale com a coordenação.",
};

export async function POST(req: Request) {
  const limited = await limitByIp("refresh-mobile", 60, 60);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  const parsed = refreshSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Token inválido." }, { status: 422 });

  try {
    const tokens = await rotateRefreshToken(parsed.data.refreshToken, parsed.data.deviceId ?? null);
    return NextResponse.json(tokens);
  } catch (err) {
    if (err instanceof RefreshTokenError) {
      return NextResponse.json({ error: ERROR_MESSAGE[err.code] }, { status: 401 });
    }
    throw err;
  }
}
