// Armazenamento de arquivos — SOMENTE privado. Fotos de visita, assinaturas
// e PDFs contêm CPF e imagens de pessoas (dado sensível, LGPD), então nunca
// ficam em uma pasta pública: só saem por api/arquivos/[...key], que exige
// usuário autenticado e autorizado (o técnico da visita ou coordenador/admin).
//
// Dois backends por trás da MESMA assinatura de função:
//   - Disco local (VPS/Docker com volume persistente) — padrão.
//   - Vercel Blob, com `access: "private"` (a rota api/arquivos continua sendo o
//     único jeito de baixar — o blob nunca é exposto direto ao cliente) — usado
//     automaticamente quando BLOB_READ_WRITE_TOKEN existe (Vercel injeta essa
//     variável sozinho quando você adiciona o Blob Storage ao projeto).
// Disco local não é persistente na Vercel (funções são efêmeras) — por isso o
// storage muda de comportamento sozinho conforme o ambiente, sem precisar de
// código diferente nas rotas que chamam estas funções.
import { randomUUID } from "node:crypto";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { uploadDir } from "@/lib/env";

const root = () => path.resolve(uploadDir());
const privateDir = () => path.join(root(), "private");

// O Blob Storage da Vercel pode estar conectado de duas formas: um token estático
// (BLOB_READ_WRITE_TOKEN, jeito antigo) ou OIDC (BLOB_STORE_ID + VERCEL_OIDC_TOKEN,
// injetado automaticamente pela plataforma em runtime — não precisa gerenciar segredo).
const usingBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 8 * MB;

const IMAGE_TYPES: { ext: string; mime: string; test: (b: Buffer) => boolean }[] = [
  { ext: "png", mime: "image/png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: "jpg", mime: "image/jpeg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
];

export class UploadError extends Error {}

/** Chave: visitas/<visitaId>/<uuid>.<ext> — validada por regex antes de tocar disco/blob. */
const KEY_PATTERN = /^visitas\/[a-z0-9]{20,40}\/[a-f0-9-]{36}\.(jpg|jpeg|png|pdf)$/;

async function writeFile(key: string, buf: Buffer | Uint8Array, contentType: string): Promise<void> {
  if (usingBlob()) {
    const { put } = await import("@vercel/blob");
    await put(key, Buffer.from(buf), { access: "private", contentType, addRandomSuffix: false });
    return;
  }
  const full = path.join(privateDir(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf);
}

export async function savePrivateImage(visitaId: string, file: File | Buffer, declaredName?: string): Promise<{ key: string }> {
  const buf = Buffer.isBuffer(file) ? file : Buffer.from(await file.arrayBuffer());
  if (buf.length === 0) throw new UploadError("Arquivo vazio.");
  if (buf.length > MAX_IMAGE_BYTES) throw new UploadError("Imagem muito grande (máximo 8 MB).");
  const type = IMAGE_TYPES.find((t) => t.test(buf));
  if (!type) throw new UploadError(`Formato inválido${declaredName ? ` (${declaredName})` : ""}. Envie PNG ou JPG.`);
  const key = `visitas/${visitaId}/${randomUUID()}.${type.ext}`;
  await writeFile(key, buf, type.mime);
  return { key };
}

export async function savePrivatePdf(visitaId: string, bytes: Uint8Array): Promise<{ key: string }> {
  const key = `visitas/${visitaId}/${randomUUID()}.pdf`;
  await writeFile(key, bytes, "application/pdf");
  return { key };
}

export function privateMime(key: string): string | null {
  if (key.endsWith(".pdf")) return "application/pdf";
  return IMAGE_TYPES.find((t) => key.endsWith("." + t.ext))?.mime ?? null;
}

export async function openPrivateFile(key: string): Promise<{ stream: ReadableStream; size: number } | null> {
  if (!KEY_PATTERN.test(key)) return null; // bloqueia path traversal / chaves forjadas

  if (usingBlob()) {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private" }).catch(() => null);
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, size: result.blob.size };
  }

  const full = path.join(privateDir(), key);
  try {
    const stat = await fs.stat(full);
    return { stream: Readable.toWeb(createReadStream(full)) as ReadableStream, size: stat.size };
  } catch {
    return null;
  }
}

/** Lê o arquivo inteiro em memória — usado ao montar o PDF (embutir imagens). */
export async function readPrivateFileBuffer(key: string): Promise<Buffer | null> {
  if (!KEY_PATTERN.test(key)) return null;

  if (usingBlob()) {
    const { get } = await import("@vercel/blob");
    const result = await get(key, { access: "private" }).catch(() => null);
    if (!result || result.statusCode !== 200) return null;
    const chunks: Uint8Array[] = [];
    for await (const chunk of result.stream as unknown as AsyncIterable<Uint8Array>) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  try {
    return await fs.readFile(path.join(privateDir(), key));
  } catch {
    return null;
  }
}

export async function deleteStoredFile(key: string | null | undefined) {
  if (!key || !KEY_PATTERN.test(key)) return;

  if (usingBlob()) {
    const { del } = await import("@vercel/blob");
    await del(key).catch(() => {});
    return;
  }

  try {
    await fs.unlink(path.join(privateDir(), key));
  } catch {
    /* arquivo já removido */
  }
}
