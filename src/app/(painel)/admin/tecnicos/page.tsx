import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/session";
import { toggleTecnicoActiveAction } from "@/actions/tecnicos";
import { NovoTecnicoForm } from "./NovoTecnicoForm";

const ROLE_LABEL: Record<string, string> = { TECNICO: "Técnico", COORDENADOR: "Coordenador", ADMIN: "Administrador" };

export default async function TecnicosPage() {
  await requireAdmin();
  const usuarios = await db.user.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Técnicos e coordenadores</h1>
        <p className="text-sm text-muted">Contas usadas no site e no app Android. Desativar aqui derruba a sessão e o app na hora.</p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-ink">Novo cadastro</h2>
        <NovoTecnicoForm />
      </div>

      <div className="card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-xs font-semibold text-muted">
              <th className="pb-2 pr-4">Nome</th>
              <th className="pb-2 pr-4">E-mail</th>
              <th className="pb-2 pr-4">Perfil</th>
              <th className="pb-2 pr-4">Status</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody>
            {usuarios.map((u) => (
              <tr key={u.id} className="border-b border-black/5 last:border-0">
                <td className="py-2.5 pr-4 font-medium text-ink">{u.name}</td>
                <td className="py-2.5 pr-4 text-muted">{u.email}</td>
                <td className="py-2.5 pr-4 text-muted">{ROLE_LABEL[u.role]}</td>
                <td className="py-2.5 pr-4">
                  <span className={u.active ? "chip-green" : "chip-red"}>{u.active ? "Ativo" : "Inativo"}</span>
                </td>
                <td className="py-2.5 text-right">
                  <form action={toggleTecnicoActiveAction}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="active" value={(!u.active).toString()} />
                    <button type="submit" className="btn-secondary py-1 text-xs">
                      {u.active ? "Desativar" : "Reativar"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
