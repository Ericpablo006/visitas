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
    const secret = (process.env.AUTH_SECRET || "").trim();
    const session = await verifySession(token, secret);
    if (!session) {
      const url = new URL("/entrar", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    // SUPER_ADMIN só cuida do cadastro de empresas — não pertence a nenhuma, então
    // não pode entrar nas telas por-empresa (painel, visitas, técnicos, finalidades, auditoria).
    if (session.role === "SUPER_ADMIN" && pathname !== "/admin/empresas" && !pathname.startsWith("/admin/empresas/")) {
      return NextResponse.redirect(new URL("/admin/empresas", req.url));
    }
    if (pathname.startsWith("/admin/empresas") && session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/painel", req.url));
    }
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/empresas") && session.role !== "ADMIN" && session.role !== "COORDENADOR") {
      return NextResponse.redirect(new URL("/painel", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/painel/:path*", "/admin/:path*", "/visitas/:path*", "/perfil/:path*"],
};
