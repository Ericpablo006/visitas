import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { VisitaWizard } from "../VisitaWizard";

export default async function NovaVisitaPage() {
  const user = await requireUser();
  const clientes = user.empresaId
    ? await db.beneficiario.findMany({
        where: { empresaId: user.empresaId },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, cpf: true, endereco: true, municipio: true },
      })
    : [];
  return <VisitaWizard tecnicoNomeSugerido={user.name} clientes={clientes} />;
}
