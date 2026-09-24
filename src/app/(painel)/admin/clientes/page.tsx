import Link from "next/link";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { formatCPF } from "@/lib/cpf";
import { NovoClienteForm } from "./NovoClienteForm";
import { DeleteClienteButton } from "./DeleteClienteButton";

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const staff = await requireCoordenadorOuAdmin();
  const [clientes, finalidades] = await Promise.all([
    db.beneficiario.findMany({ where: { empresaId: staff.empresaId! }, orderBy: { nome: "asc" }, include: { finalidadeCredito: true } }),
    db.purpose.findMany({ where: { empresaId: staff.empresaId!, ativo: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Clientes</h1>
        <p className="text-sm text-muted">Produtores cadastrados — use essa lista para agendar visitas sem precisar redigitar os dados em campo.</p>
      </div>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="card">
        <h2 className="mb-3 font-semibold text-ink">Novo cliente</h2>
        <NovoClienteForm finalidades={finalidades} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
              <th className="pb-2 pr-4">Nome</th>
              <th className="pb-2 pr-4">CPF</th>
              <th className="pb-2 pr-4">Município</th>
              <th className="pb-2 pr-4">Telefone</th>
              <th className="pb-2 pr-4">Finalidade do crédito</th>
              <th className="pb-2 pr-4">Localização</th>
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
                <td className="py-2.5 pr-4 text-muted">{c.finalidadeCredito?.label || "—"}</td>
                <td className="py-2.5 pr-4 text-muted">
                  {c.latitude != null && c.longitude != null ? (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${c.latitude}&mlon=${c.longitude}#map=16/${c.latitude}/${c.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-700 hover:underline"
                    >
                      Ver no mapa
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Link href={`/admin/clientes/${c.id}/editar`} className="btn-secondary py-1 text-xs">
                      Editar
                    </Link>
                    <DeleteClienteButton clienteId={c.id} />
                  </div>
                </td>
              </tr>
            ))}
            {clientes.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-center text-muted">
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
