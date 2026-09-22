import { requireUser } from "@/lib/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

const ROLE_LABEL: Record<string, string> = { TECNICO: "Técnico", COORDENADOR: "Coordenador", ADMIN: "Administrador" };

export default async function PerfilPage() {
  const user = await requireUser();

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Meu perfil</h1>
        <p className="text-sm text-muted">
          {user.name} · {user.email} · {ROLE_LABEL[user.role]}
        </p>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold text-ink">Trocar senha</h2>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
