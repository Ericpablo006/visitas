import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { toggleFinalidadeAction } from "@/actions/finalidades";
import { NovaFinalidadeForm } from "./NovaFinalidadeForm";

export default async function FinalidadesPage() {
  await requireCoordenadorOuAdmin();
  const finalidades = await db.purpose.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Finalidades do crédito</h1>
        <p className="text-sm text-muted">Lista usada na etapa 2 do formulário de visita (site e app). Editável sem precisar de novo deploy.</p>
      </div>

      <div className="card">
        <NovaFinalidadeForm />
      </div>

      <div className="card">
        <ul className="divide-y divide-black/5">
          {finalidades.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className={f.ativo ? "text-ink" : "text-muted line-through"}>{f.label}</span>
              <form action={toggleFinalidadeAction}>
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="ativo" value={(!f.ativo).toString()} />
                <button type="submit" className={f.ativo ? "chip-green" : "chip-gray"}>
                  {f.ativo ? "Ativa" : "Inativa"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
