import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth/session";
import { toggleEmpresaAtivaAction } from "@/actions/empresas";
import { NovaEmpresaForm } from "./NovaEmpresaForm";

export default async function EmpresasPage() {
  await requireSuperAdmin();
  const empresas = await db.empresa.findMany({
    orderBy: { nome: "asc" },
    include: { _count: { select: { usuarios: true, visitas: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Empresas</h1>
        <p className="text-sm text-muted">Cada empresa tem seus próprios técnicos, visitas e finalidades — completamente isolados das demais.</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-ink">Nova empresa</h2>
        <NovaEmpresaForm />
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
              <th className="pb-2 pr-4">Nome</th>
              <th className="pb-2 pr-4">CNPJ</th>
              <th className="pb-2 pr-4">Usuários</th>
              <th className="pb-2 pr-4">Visitas</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {empresas.map((e) => (
              <tr key={e.id} className="border-b border-black/5 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-ink">{e.nome}</td>
                <td className="py-2.5 pr-4 text-muted">{e.cnpj ?? "—"}</td>
                <td className="py-2.5 pr-4 text-muted">{e._count.usuarios}</td>
                <td className="py-2.5 pr-4 text-muted">{e._count.visitas}</td>
                <td className="py-2.5 pr-4">
                  <span className={e.ativa ? "chip-green" : "chip-red"}>{e.ativa ? "Ativa" : "Inativa"}</span>
                </td>
                <td className="py-2.5 text-right">
                  <form action={toggleEmpresaAtivaAction}>
                    <input type="hidden" name="empresaId" value={e.id} />
                    <input type="hidden" name="ativa" value={(!e.ativa).toString()} />
                    <button type="submit" className="btn-secondary py-1 text-xs">
                      {e.ativa ? "Desativar" : "Reativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
