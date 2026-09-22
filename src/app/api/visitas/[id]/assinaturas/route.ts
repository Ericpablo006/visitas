import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { assinaturaMetaSchema } from "@/lib/schemas/visita";
import { savePrivateImage, UploadError } from "@/lib/storage";
import { writeAudit, requestMeta } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const visita = await db.visita.findUnique({ where: { id } });
  if (!visita) return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  if (visita.tecnicoId !== user.id && user.role === "TECNICO") {
    return NextResponse.json({ error: "Sem permissão para editar esta visita." }, { status: 403 });
  }
  if (visita.status === "FINALIZADA") return NextResponse.json({ error: "Visita já finalizada." }, { status: 409 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });

  const imagem = form.get("imagem");
  if (!(imagem instanceof File)) return NextResponse.json({ error: "Envie o arquivo no campo 'imagem'." }, { status: 400 });

  const parsed = assinaturaMetaSchema.safeParse({
    clientLocalId: form.get("clientLocalId"),
    tipo: form.get("tipo"),
    testemunhaNome: form.get("testemunhaNome") || undefined,
    testemunhaCpf: form.get("testemunhaCpf") || undefined,
  });
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
  const meta = parsed.data;

  const existingByClientId = await db.visitaAssinatura.findFirst({ where: { visitaId: id, tipo: meta.tipo } });
  if (existingByClientId) {
    return NextResponse.json(
      { assinatura: { id: existingByClientId.id, tipo: existingByClientId.tipo, url: `/api/arquivos/${existingByClientId.fileKey}` } },
      { status: 200 },
    );
  }

  let saved: { key: string };
  try {
    saved = await savePrivateImage(id, imagem, imagem.name);
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const row = await tx.visitaAssinatura.create({
        data: {
          visitaId: id,
          tipo: meta.tipo,
          fileKey: saved.key,
          testemunhaNome: meta.testemunhaNome,
          testemunhaCpf: meta.testemunhaCpf,
          criadoPorId: user.id,
        },
      });
      const rm = await requestMeta();
      await writeAudit(tx, { actorId: user.id, acao: "UPLOAD_ASSINATURA", entidade: "Visita", entidadeId: id, ip: rm.ip, userAgent: rm.userAgent, detalhes: { assinaturaId: row.id, tipo: meta.tipo } });
      return row;
    });
    return NextResponse.json({ assinatura: { id: created.id, tipo: created.tipo, url: `/api/arquivos/${created.fileKey}` } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const race = await db.visitaAssinatura.findFirst({ where: { visitaId: id, tipo: meta.tipo } });
      if (race) return NextResponse.json({ assinatura: { id: race.id, tipo: race.tipo, url: `/api/arquivos/${race.fileKey}` } }, { status: 200 });
    }
    throw err;
  }
}
