import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { EditarClienteForm } from "./EditarClienteForm";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await requireCoordenadorOuAdmin();
  const { id } = await params;
  const [cliente, finalidades] = await Promise.all([
    db.beneficiario.findUnique({ where: { id } }),
    db.purpose.findMany({ where: { empresaId: staff.empresaId!, ativo: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (!cliente || cliente.empresaId !== staff.empresaId) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Editar cliente</h1>
        <p className="text-sm text-muted">Corrigir dados do produtor {cliente.nome}. Visitas já registradas mantêm o snapshot dos dados no momento em que foram feitas.</p>
      </div>
      <div className="card">
        <EditarClienteForm cliente={cliente} finalidades={finalidades} />
      </div>
    </div>
  );
}
