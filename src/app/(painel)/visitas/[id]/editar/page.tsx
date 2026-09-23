import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { VisitaWizard, type VisitaWizardInitialData } from "../../VisitaWizard";

export default async function EditarVisitaPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";

  const visita = await db.visita.findUnique({
    where: { id },
    include: { purposes: { select: { purposeId: true } }, fotos: { orderBy: { ordem: "asc" } } },
  });
  if (!visita || visita.empresaId !== user.empresaId || (!isStaff && visita.tecnicoId !== user.id)) notFound();
  // Rascunho: dono ou staff da empresa pode editar. Finalizada: só ADMIN (correção pós-emissão).
  if (visita.status === "FINALIZADA" && user.role !== "ADMIN") notFound();

  const initial: VisitaWizardInitialData = {
    id: visita.id,
    clientLocalId: visita.clientLocalId,
    status: visita.status,
    beneficiario: { nome: visita.beneficiarioNomeSnapshot, cpf: visita.beneficiarioCpfSnapshot, endereco: visita.beneficiarioEnderecoSnapshot },
    municipio: visita.municipio,
    dataVisita: visita.dataVisita.toISOString(),
    purposeIds: visita.purposes.map((p) => p.purposeId),
    finalidadeDetalhada: visita.finalidadeDetalhada,
    aplicandoConforme: visita.aplicandoConforme,
    aplicandoConformeJustificativa: visita.aplicandoConformeJustificativa,
    outroFinalidadeDescricao: visita.outroFinalidadeDescricao,
    teveDesafio: visita.teveDesafio,
    desafioDescricao: visita.desafioDescricao,
    assistenciaTecnica: visita.assistenciaTecnica,
    assistenciaPeriodicidade: visita.assistenciaPeriodicidade,
    assistenciaMotivoNegativa: visita.assistenciaMotivoNegativa,
    tecnicoNomeContato: visita.tecnicoNomeContato,
    pontoReferencia: visita.pontoReferencia,
    observacoes: visita.observacoes,
    fotos: visita.fotos.map((f) => ({ id: f.id, clientLocalId: f.clientLocalId, url: `/api/arquivos/${f.fileKey}` })),
  };

  return <VisitaWizard initial={initial} />;
}
