import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export default async function PainelPage() {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const where = { empresaId: user.empresaId!, tecnicoId: isStaff ? undefined : user.id };

  const [rascunhos, finalizadas, recentes] = await Promise.all([
    db.visita.count({ where: { ...where, status: "RASCUNHO" } }),
    db.visita.count({ where: { ...where, status: "FINALIZADA" } }),
    db.visita.findMany({ where, orderBy: { updatedAt: "desc" }, take: 8, include: { tecnico: { select: { name: true } } } }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Olá, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-muted">Acompanhamento de visitas pós-crédito.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <div className="card">
          <p className="text-xs font-semibold text-muted">RASCUNHOS</p>
          <p className="mt-1 text-3xl font-bold text-ink">{rascunhos}</p>
        </div>
        <div className="card">
          <p className="text-xs font-semibold text-muted">FINALIZADAS</p>
          <p className="mt-1 text-3xl font-bold text-brand-700">{finalizadas}</p>
        </div>
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-ink">Visitas recentes</h2>
          <Link href="/visitas" className="text-sm font-medium text-brand-700 hover:underline">
            Ver todas
          </Link>
        </div>
        {recentes.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma visita registrada ainda.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {recentes.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-3">
                <div>
                  <Link href={`/visitas/${v.id}`} className="font-medium text-ink hover:text-brand-700">
                    {v.beneficiarioNomeSnapshot}
                  </Link>
                  <p className="text-xs text-muted">
                    {v.municipio} · {isStaff ? v.tecnico.name : "você"}
                  </p>
                </div>
                <span className={v.status === "FINALIZADA" ? "chip-green" : "chip-gray"}>
                  {v.status === "FINALIZADA" ? v.numeroDocumento ?? "Finalizada" : "Rascunho"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
