import { requireUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { VisitaWizard } from "../VisitaWizard";

export default async function NovaVisitaPage() {
  const user = await requireUser();
  const clientesRaw = user.empresaId
    ? await db.beneficiario.findMany({
        where: { empresaId: user.empresaId },
        orderBy: { nome: "asc" },
        select: {
          id: true,
          nome: true,
          cpf: true,
          endereco: true,
          municipio: true,
          telefone: true,
          latitude: true,
          longitude: true,
          finalidadeCreditoId: true,
          finalidadeCreditoOutro: true,
          finalidadeCredito: { select: { isOutro: true } },
        },
      })
    : [];
  const clientes = clientesRaw.map((c) => ({ ...c, finalidadeCreditoIsOutro: c.finalidadeCredito?.isOutro ?? false }));
  return <VisitaWizard tecnicoNomeSugerido={user.name} clientes={clientes} />;
}
