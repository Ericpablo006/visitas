import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { NovaFinalidadeForm } from "./NovaFinalidadeForm";
import { FinalidadeRow } from "./FinalidadeRow";

export default async function FinalidadesPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  const admin = await requireCoordenadorOuAdmin();
  const finalidades = await db.purpose.findMany({ where: { empresaId: admin.empresaId! }, orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Finalidades do crédito</h1>
        <p className="text-sm text-muted">Lista usada na etapa 2 do formulário de visita (site e app). Editável sem precisar de novo deploy.</p>
      </div>

      {erro && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

      <div className="card">
        <NovaFinalidadeForm />
      </div>

      <div className="card">
        <ul className="divide-y divide-black/5">
          {finalidades.map((f) => (
            <FinalidadeRow key={f.id} finalidade={f} />
          ))}
        </ul>
      </div>
    </div>
  );
}
