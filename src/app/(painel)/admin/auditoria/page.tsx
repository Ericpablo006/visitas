import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";

const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

export default async function AuditoriaPage() {
  await requireCoordenadorOuAdmin();
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 300, include: { actor: { select: { name: true, email: true } } } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Auditoria</h1>
        <p className="text-sm text-muted">Últimas 300 ações registradas no sistema.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
              <th className="pb-2 pr-4">Quando</th>
              <th className="pb-2 pr-4">Quem</th>
              <th className="pb-2 pr-4">Ação</th>
              <th className="pb-2 pr-4">Entidade</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-black/5 last:border-0">
                <td className="py-2 pr-4 whitespace-nowrap text-muted">{fmtDateTime(l.createdAt)}</td>
                <td className="py-2 pr-4">{l.actor?.name ?? "—"}</td>
                <td className="py-2 pr-4">{l.acao}</td>
                <td className="py-2 pr-4 text-muted">
                  {l.entidade} · {l.entidadeId.slice(0, 10)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
