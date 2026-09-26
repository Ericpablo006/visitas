import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { IconAlertTriangle, IconCalendar, IconCheckCircle, IconClipboard, IconMapPin, IconSprout } from "@/components/icons";

const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export default async function PainelPage() {
  const user = await requireUser();
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const where = { empresaId: user.empresaId!, tecnicoId: isStaff ? undefined : user.id };

  const agora = new Date();

  const [rascunhos, finalizadas, desafios, agendamentos, recentes] = await Promise.all([
    db.visita.count({ where: { ...where, status: "RASCUNHO" } }),
    db.visita.count({ where: { ...where, status: "FINALIZADA" } }),
    db.visita.count({ where: { ...where, status: "FINALIZADA", teveDesafio: true } }),
    db.agendamento.findMany({
      where: { empresaId: user.empresaId!, tecnicoId: isStaff ? undefined : user.id },
      include: { beneficiario: { select: { nome: true } }, visita: { select: { id: true } } },
      orderBy: { dataAgendada: "asc" },
    }),
    db.visita.findMany({ where, orderBy: { updatedAt: "desc" }, take: 8, include: { tecnico: { select: { name: true } } } }),
  ]);

  const agendamentosPendentes = agendamentos.filter((a) => !a.visita);
  const agendamentosSemana = agendamentosPendentes.filter(
    (a) => a.dataAgendada && a.dataAgendada.getTime() - agora.getTime() <= SETE_DIAS_MS && a.dataAgendada.getTime() - agora.getTime() >= -SETE_DIAS_MS,
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <IconSprout className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">Olá, {user.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted">Acompanhamento de visitas pós-crédito.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Rascunhos" value={rascunhos} icon={<IconClipboard className="h-5 w-5" />} tone="gray" />
        <StatCard label="Finalizadas" value={finalizadas} icon={<IconCheckCircle className="h-5 w-5" />} tone="brand" />
        <StatCard label="Agenda pendente" value={agendamentosPendentes.length} icon={<IconCalendar className="h-5 w-5" />} tone="blue" />
        <StatCard label="Com desafio relatado" value={desafios} icon={<IconAlertTriangle className="h-5 w-5" />} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-ink">Próximos agendamentos</h2>
            <Link href="/admin/agenda" className="text-sm font-medium text-brand-700 hover:underline">
              Ver agenda
            </Link>
          </div>
          {agendamentosSemana.length === 0 ? (
            <p className="text-sm text-muted">Nenhum agendamento pendente para os próximos 7 dias.</p>
          ) : (
            <ul className="divide-y divide-black/5">
              {agendamentosSemana.slice(0, 6).map((a) => (
                <li key={a.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <IconMapPin className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-medium text-ink">{a.beneficiario.nome}</p>
                      <p className="text-xs text-muted">{a.nomePropriedade}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted">
                    {a.dataAgendada
                      ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(a.dataAgendada)
                      : "Sem data"}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
    </div>
  );
}

const TONE_CLASSES: Record<string, string> = {
  gray: "bg-gray-100 text-gray-700",
  brand: "bg-brand-50 text-brand-600",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
};

function StatCard({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: keyof typeof TONE_CLASSES }) {
  return (
    <div className="card">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}>{icon}</span>
      <p className="mt-3 text-2xl font-bold text-ink">{value}</p>
      <p className="text-xs font-medium text-muted">{label}</p>
    </div>
  );
}
