import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireApiUser } from "@/lib/auth/mobile";
import { fotoMetaSchema } from "@/lib/schemas/visita";
import { savePrivateImage, UploadError } from "@/lib/storage";
import { writeAudit, requestMeta } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireApiUser(req);
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const { id } = await params;

  const visita = await db.visita.findUnique({ where: { id } });
  if (!visita || visita.empresaId !== user.empresaId) return NextResponse.json({ error: "Visita não encontrada." }, { status: 404 });
  if (visita.tecnicoId !== user.id && user.role === "TECNICO") {
    return NextResponse.json({ error: "Sem permissão para editar esta visita." }, { status: 403 });
  }
  if (visita.status === "FINALIZADA") return NextResponse.json({ error: "Visita já finalizada." }, { status: 409 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Formulário inválido." }, { status: 400 });

  const foto = form.get("foto");
  if (!(foto instanceof File)) return NextResponse.json({ error: "Envie o arquivo no campo 'foto'." }, { status: 400 });

  const parsed = fotoMetaSchema.safeParse({
    clientLocalId: form.get("clientLocalId"),
    legenda: form.get("legenda") || undefined,
    ordem: form.get("ordem") ?? 0,
  });
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos.", issues: parsed.error.issues }, { status: 422 });
  const meta = parsed.data;

  // Idempotência: mesma foto (clientLocalId) reenviada -> devolve a existente.
  const existing = await db.visitaFoto.findUnique({ where: { visitaId_clientLocalId: { visitaId: id, clientLocalId: meta.clientLocalId } } });
  if (existing) {
    return NextResponse.json({ foto: { id: existing.id, clientLocalId: existing.clientLocalId, url: `/api/arquivos/${existing.fileKey}` } }, { status: 200 });
  }

  let saved: { key: string };
  try {
    saved = await savePrivateImage(id, foto, foto.name);
  } catch (err) {
    if (err instanceof UploadError) return NextResponse.json({ error: err.message }, { status: 422 });
    throw err;
  }

  try {
    const created = await db.$transaction(async (tx) => {
      const row = await tx.visitaFoto.create({
        data: { visitaId: id, clientLocalId: meta.clientLocalId, fileKey: saved.key, legenda: meta.legenda, ordem: meta.ordem, uploadedById: user.id },
      });
      const rm = await requestMeta();
      await writeAudit(tx, { actorId: user.id, acao: "UPLOAD_FOTO", entidade: "Visita", entidadeId: id, ip: rm.ip, userAgent: rm.userAgent, detalhes: { fotoId: row.id } });
      return row;
    });
    return NextResponse.json({ foto: { id: created.id, clientLocalId: created.clientLocalId, url: `/api/arquivos/${created.fileKey}` } }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const race = await db.visitaFoto.findUnique({ where: { visitaId_clientLocalId: { visitaId: id, clientLocalId: meta.clientLocalId } } });
      if (race) return NextResponse.json({ foto: { id: race.id, clientLocalId: race.clientLocalId, url: `/api/arquivos/${race.fileKey}` } }, { status: 200 });
    }
    throw err;
  }
}
