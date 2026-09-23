import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { visitaSchema } from "@/lib/schemas/visita";
import { writeAudit, requestMeta } from "@/lib/audit";
import { serializeVisita, VISITA_INCLUDE } from "@/lib/visita-response";
import { deleteStoredFile } from "@/lib/storage";

async function loadAuthorized(id: string, userId: string, empresaId: string | null, isStaff: boolean) {
  const visita = await db.visita.findUnique({ where: { id }, include: VISITA_INCLUDE });
  // 404 (não 403) quando a empresa não bate — não revela nem a existência da visita de outra empresa.
  if (!visita || visita.empresaId !== empresaId) return { error: NextResponse.json({ error: "Visita não encontrada." }, { status: 404 }) } as const;
  if (!isStaff && visita.tecnicoId !== userId) {
    return { error: NextResponse.json({ error: "Sem permissão para acessar esta visita." }, { status: 403 }) } as const;
  }
  return { visita } as const;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const isStaff = user.role === "ADMIN" || user.role === "COORDENADOR";
  const { visita, error } = await loadAuthorized(id, user.id, user.empresaId, isStaff);
  if (error) return error;
  return NextResponse.json({ visita: serializeVisita(visita) });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;
  const { visita, error } = await loadAuthorized(id, user.id, user.empresaId, user.role === "ADMIN" || user.role === "COORDENADOR");
  if (error) return error;
  // Visita finalizada só pode ser corrigida por ADMIN (documento oficial já emitido — COORDENADOR
  // e o próprio técnico continuam travados, como antes; só a exceção do ADMIN é nova).
  if (visita.status === "FINALIZADA" && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Visita já finalizada não pode mais ser editada." }, { status: 409 });
  }

  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Corpo da requisição inválido." }, { status: 400 });
  const parsed = visitaSchema.safeParse({ ...json, clientLocalId: visita.clientLocalId });
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
  const data = parsed.data;

  const purposes = await db.purpose.findMany({ where: { id: { in: data.purposeIds }, ativo: true, empresaId: visita.empresaId }, select: { id: true, isOutro: true } });
  if (purposes.length !== data.purposeIds.length) {
    return NextResponse.json({ error: "Uma ou mais finalidades selecionadas não existem mais." }, { status: 422 });
  }
  if (purposes.some((p) => p.isOutro) && !data.outroFinalidadeDescricao) {
    return NextResponse.json({ error: "Descreva a finalidade em 'Outro'.", issues: [{ path: ["outroFinalidadeDescricao"], message: "Descreva a finalidade em 'Outro'." }] }, { status: 422 });
  }

  const oldPdfFileKey = visita.pdfFileKey;
  const updated = await db.$transaction(async (tx) => {
    await tx.beneficiario.update({
      where: { id: visita.beneficiarioId },
      data: { nome: data.beneficiarioNome, endereco: data.beneficiarioEndereco, municipio: data.municipio },
    });
    await tx.visitaPurpose.deleteMany({ where: { visitaId: visita.id } });
    const result = await tx.visita.update({
      where: { id: visita.id },
      data: {
        beneficiarioNomeSnapshot: data.beneficiarioNome,
        beneficiarioCpfSnapshot: data.beneficiarioCpf,
        beneficiarioEnderecoSnapshot: data.beneficiarioEndereco,
        municipio: data.municipio,
        dataVisita: new Date(`${data.dataVisita}T12:00:00-03:00`),
        purposes: { create: data.purposeIds.map((purposeId) => ({ purposeId })) },
        finalidadeDetalhada: data.finalidadeDetalhada,
        aplicandoConforme: data.aplicandoConforme,
        aplicandoConformeJustificativa: data.aplicandoConformeJustificativa,
        outroFinalidadeDescricao: data.outroFinalidadeDescricao,
        teveDesafio: data.teveDesafio,
        desafioDescricao: data.desafioDescricao,
        assistenciaTecnica: data.assistenciaTecnica,
        assistenciaPeriodicidade: data.assistenciaPeriodicidade,
        assistenciaMotivoNegativa: data.assistenciaMotivoNegativa,
        tecnicoNomeContato: data.tecnicoNomeContato,
        pontoReferencia: data.pontoReferencia,
        observacoes: data.observacoes,
        // Se já existia um PDF gerado (visita finalizada sendo corrigida), descarta — o próximo
        // "Baixar PDF" gera um novo, já com os dados corrigidos.
        pdfFileKey: oldPdfFileKey ? null : undefined,
      },
      include: VISITA_INCLUDE,
    });
    const meta = await requestMeta();
    await writeAudit(tx, {
      actorId: user.id,
      acao: "EDICAO",
      entidade: "Visita",
      entidadeId: visita.id,
      detalhes: visita.status === "FINALIZADA" ? { correcaoPosFinalizacao: true } : undefined,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return result;
  });

  if (oldPdfFileKey) await deleteStoredFile(oldPdfFileKey);

  return NextResponse.json({ visita: serializeVisita(updated) });
}
