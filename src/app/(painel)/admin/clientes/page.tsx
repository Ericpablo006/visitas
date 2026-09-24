import Link from "next/link";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { formatCPF } from "@/lib/cpf";
import { NovoClienteForm } from "./NovoClienteForm";

export default async function ClientesPage() {
  const staff = await requireCoordenadorOuAdmin();
  const clientes = await db.beneficiario.findMany({ where: { empresaId: staff.empresaId! }, orderBy: { nome: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Clientes</h1>
        <p className="text-sm text-muted">Produtores cadastrados — use essa lista para agendar visitas sem precisar redigitar os dados em campo.</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-ink">Novo cliente</h2>
        <NovoClienteForm />
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
              <th className="pb-2 pr-4">Nome</th>
              <th className="pb-2 pr-4">CPF</th>
              <th className="pb-2 pr-4">Município</th>
              <th className="pb-2 pr-4">Telefone</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => (
              <tr key={c.id} className="border-b border-black/5 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-ink">{c.nome}</td>
                <td className="py-2.5 pr-4 text-muted">{formatCPF(c.cpf)}</td>
                <td className="py-2.5 pr-4 text-muted">{c.municipio}</td>
                <td className="py-2.5 pr-4 text-muted">{c.telefone || "—"}</td>
                <td className="py-2.5 text-right">
                  <Link href={`/admin/clientes/${c.id}/editar`} className="btn-secondary py-1 text-xs">
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-muted">
                  Nenhum cliente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
