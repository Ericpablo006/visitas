import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { logoutAction } from "@/actions/auth";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const isSuperAdmin = user.role === "SUPER_ADMIN";

  return (
    <div className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={isSuperAdmin ? "/admin/empresas" : "/painel"} className="flex items-center gap-2 text-lg font-bold text-brand-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.webp" alt="VisitaTech" className="h-8 w-8 rounded-md object-cover" />
              VisitaTech
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium text-muted">
              {isSuperAdmin ? (
                <Link href="/admin/empresas" className="hover:text-brand-700">
                  Empresas
                </Link>
              ) : (
                <>
                  <Link href="/painel" className="hover:text-brand-700">
                    Painel
                  </Link>
                  <Link href="/visitas" className="hover:text-brand-700">
                    Visitas
                  </Link>
                  {isStaff && (
                    <>
                      <Link href="/admin/clientes" className="hover:text-brand-700">
                        Clientes
                      </Link>
                      <Link href="/admin/agenda" className="hover:text-brand-700">
                        Agenda
                      </Link>
                      <Link href="/admin/tecnicos" className="hover:text-brand-700">
                        Técnicos
                      </Link>
                      <Link href="/admin/finalidades" className="hover:text-brand-700">
                        Finalidades
                      </Link>
                      <Link href="/admin/auditoria" className="hover:text-brand-700">
                        Auditoria
                      </Link>
                    </>
                  )}
                </>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/perfil" className="text-muted hover:text-brand-700">
              {user.name}
            </Link>
            <form action={logoutAction}>
              <button className="btn-secondary py-1.5" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
