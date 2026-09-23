import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";

export default async function VisitasPage() {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const where = isStaff ? {} : { tecnicoId: user.id };

  const visitas = await db.visita.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 200,
    include: { tecnico: { select: { name: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">Visitas</h1>
        <Link href="/visitas/nova" className="btn-primary">
          + Nova visita
        </Link>
      </div>

      <div className="card overflow-x-auto">
        {visitas.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma visita registrada ainda. Use "Nova visita" para começar.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
                <th className="pb-2 pr-4">Beneficiário</th>
                <th className="pb-2 pr-4">Município</th>
                {isStaff && <th className="pb-2 pr-4">Técnico</th>}
                <th className="pb-2 pr-4">Data</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">PDF</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map((v) => (
                <tr key={v.id} className="border-b border-black/5 last:border-0">
                  <td className="py-3 pr-4">
                    <Link href={`/visitas/${v.id}`} className="font-medium text-ink hover:text-brand-700">
                      {v.beneficiarioNomeSnapshot}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-muted">{v.municipio}</td>
                  {isStaff && <td className="py-3 pr-4 text-muted">{v.tecnico.name}</td>}
                  <td className="py-3 pr-4 text-muted">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(v.dataVisita)}</td>
                  <td className="py-3 pr-4">
                    <span className={v.status === "FINALIZADA" ? "chip-green" : "chip-gray"}>
                      {v.status === "FINALIZADA" ? v.numeroDocumento ?? "Finalizada" : "Rascunho"}
                    </span>
                  </td>
                  <td className="py-3">
                    {v.status === "FINALIZADA" ? (
                      <a href={`/api/visitas/${v.id}/pdf`} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
                        Baixar
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
