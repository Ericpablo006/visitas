import { NextResponse, type NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/auth/token";

// Middleware roda no Edge runtime: não pode acessar o Prisma/banco. É apenas
// a PRIMEIRA barreira, rápida (assinatura + validade do JWT). A checagem
// definitiva (conta ativa, tokenVersion) acontece em requireUser()/requireApiUser()
// dentro de cada página/rota, que já rodam no runtime Node com acesso ao banco.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/painel") || pathname.startsWith("/admin") || pathname.startsWith("/visitas") || pathname.startsWith("/perfil")) {
    const token = req.cookies.get(SESSION_COOKIE)?.value;
    const secret = process.env.AUTH_SECRET || "";
    const session = await verifySession(token, secret);
    if (!session) {
      const url = new URL("/entrar", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (pathname.startsWith("/admin") && session.role !== "ADMIN" && session.role !== "COORDENADOR") {
      return NextResponse.redirect(new URL("/painel", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/admin/:path*", "/visitas/:path*", "/perfil/:path*"],
};
