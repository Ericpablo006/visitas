import { db } from "@/lib/db";
import { requireCoordenadorOuAdmin } from "@/lib/auth/session";
import { AgendamentoForm } from "./AgendamentoForm";

export default async function AgendaPage() {
  const staff = await requireCoordenadorOuAdmin();

  const [agendamentos, clientes, tecnicos] = await Promise.all([
    db.agendamento.findMany({
      where: { empresaId: staff.empresaId! },
      include: { beneficiario: { select: { nome: true } }, tecnico: { select: { name: true } }, visita: { select: { id: true, numeroDocumento: true } } },
      orderBy: [{ dataAgendada: "asc" }, { createdAt: "desc" }],
    }),
    db.beneficiario.findMany({ where: { empresaId: staff.empresaId! }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.user.findMany({
      where: { empresaId: staff.empresaId!, active: true, role: { in: ["TECNICO", "COORDENADOR"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Agenda de visitas</h1>
        <p className="text-sm text-muted">Agende visitas para os técnicos — aparece na agenda do app assim que criada.</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-ink">Nova visita agendada</h2>
        <AgendamentoForm clientes={clientes} tecnicos={tecnicos} />
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
              <th className="pb-2 pr-4">Produtor</th>
              <th className="pb-2 pr-4">Propriedade</th>
              <th className="pb-2 pr-4">Técnico</th>
              <th className="pb-2 pr-4">Data</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {agendamentos.map((a) => (
              <tr key={a.id} className="border-b border-black/5 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-ink">{a.beneficiario.nome}</td>
                <td className="py-2.5 pr-4 text-muted">{a.nomePropriedade}</td>
                <td className="py-2.5 pr-4 text-muted">{a.tecnico.name}</td>
                <td className="py-2.5 pr-4 text-muted">
                  {a.dataAgendada ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(a.dataAgendada) : "—"}
                </td>
                <td className="py-2.5 pr-4">
                  <span className={a.visita ? "chip-green" : "chip-gray"}>{a.visita ? "Atendido" : "Pendente"}</span>
                </td>
                <td className="py-2.5 text-right">
                  {a.latitude != null && a.longitude != null && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${a.latitude}&mlon=${a.longitude}#map=16/${a.latitude}/${a.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary py-1 text-xs"
                    >
                      Ver no mapa
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {agendamentos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  Nenhuma visita agendada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
