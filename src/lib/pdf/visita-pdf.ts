import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import type { VisitaWithRelations } from "@/lib/visita-response";
import { readPrivateFileBuffer } from "@/lib/storage";
import { formatCPF } from "@/lib/cpf";

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
const C = {
  text: hex("#1a1a1a"),
  muted: hex("#6b6b6b"),
  line: hex("#9a9a9a"),
  box: hex("#000000"),
  white: rgb(1, 1, 1),
};

// As fontes padrão do PDF usam WinAnsi: troca caracteres fora do alfabeto latino.
const MAP: Record<string, string> = {
  "–": "-",
  "—": "-",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "…": "...",
  "→": "->",
  "•": "-",
};
const safe = (s: string) =>
  Array.from(s ?? "")
    .map((ch) => MAP[ch] ?? (ch.charCodeAt(0) > 255 ? "?" : ch))
    .join("");

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of safe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else {
        if (line) lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
const fmtDateTime = (d: Date) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

type VisitaPdfInput = VisitaWithRelations & {
  tecnico: { name: string; email: string; matricula: string | null };
  finalizadaPor: { name: string } | null;
  purposeLabels: { label: string; selected: boolean; isOutro: boolean }[];
};

/**
 * Layout deliberadamente parecido com o formulário em papel da Tabôa (mesma
 * numeração 1-15, mesmas seções, checklist de finalidades em 3 colunas) —
 * pedido explícito para que o PDF gerado saia "idêntico" ao modelo oficial.
 */
export async function renderVisitaPdf(visita: VisitaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Visita Pós-Crédito ${visita.numeroDocumento ?? visita.id}`);
  pdf.setAuthor("Tabôa - Fortalecimento Comunitário");
  pdf.setProducer("Tabôa - Fortalecimento Comunitário");

  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);

  // TODO(multi-empresa): usar `visita.empresa.logoFileKey` quando cada empresa
  // puder subir o próprio logo pelo painel — por ora usa o logo oficial da Tabôa.
  let logo: PDFImage | null = null;
  try {
    const logoBytes = await readFile(path.join(process.cwd(), "src/lib/pdf/assets/logo.png"));
    logo = await pdf.embedPng(logoBytes);
  } catch {
    logo = null;
  }

  const M = 50;
  const PAGE: [number, number] = [595.28, 841.89];

  let page = pdf.addPage(PAGE);
  let { width, height } = page.getSize();
  let y = height - 40;

  function newPage() {
    page = pdf.addPage(PAGE);
    ({ width, height } = page.getSize());
    y = height - 40;
  }

  function ensureSpace(needed: number) {
    if (y - needed < 60) newPage();
  }

  function coverPage() {
    if (logo) {
      const targetW = 90;
      const scale = targetW / logo.width;
      const w = logo.width * scale;
      const h = logo.height * scale;
      page.drawImage(logo, { x: (width - w) / 2, y: y - h, width: w, height: h });
      y -= h + 10;
    }
    const title = "FORMULÁRIO DE VISITA PÓS CRÉDITO";
    page.drawText(title, { x: (width - bold.widthOfTextAtSize(title, 13)) / 2, y, size: 13, font: bold, color: C.text });
    y -= 28;
  }

  function sectionTitle(title: string) {
    ensureSpace(24);
    page.drawText(safe(title), { x: M, y, size: 11, font: bold, color: C.text });
    y -= 18;
  }

  /** Campo estilo "N - Rótulo: valor" numerado, igual ao formulário original. */
  function numbered(n: number, label: string, value: string, opts: { boldLabel?: boolean } = {}) {
    const prefix = `${n} - ${label}: `;
    const prefixWidth = bold.widthOfTextAtSize(prefix, 10.5);
    const maxWidth = width - 2 * M - prefixWidth;
    const lines = wrap(value || "", reg, 10.5, Math.max(maxWidth, 120));
    ensureSpace(14 * lines.length + 6);
    page.drawText(safe(prefix), { x: M, y, size: 10.5, font: opts.boldLabel ? bold : reg, color: C.text });
    page.drawText(lines[0] ?? "", { x: M + prefixWidth, y, size: 10.5, font: reg, color: C.text });
    if (!value) {
      // linha em branco (campo não preenchido)
      page.drawLine({ start: { x: M + prefixWidth, y: y - 2 }, end: { x: width - M, y: y - 2 }, thickness: 0.7, color: C.line });
    }
    y -= 14;
    for (const extra of lines.slice(1)) {
      page.drawText(extra, { x: M, y, size: 10.5, font: reg, color: C.text });
      y -= 14;
    }
    y -= 6;
  }

  function longField(n: number, label: string, value: string) {
    ensureSpace(20);
    page.drawText(safe(`${n} - ${label}:`), { x: M, y, size: 10.5, font: reg, color: C.text });
    y -= 15;
    const lines = wrap(value || "—", reg, 10.5, width - 2 * M);
    ensureSpace(14 * lines.length + 10);
    for (const l of lines) {
      page.drawText(l, { x: M, y, size: 10.5, font: reg, color: C.text });
      y -= 14;
    }
    y -= 6;
  }

  function checkbox(x: number, rowY: number, checked: boolean): number {
    const s = checked ? "(X)" : "( )";
    page.drawText(s, { x, y: rowY, size: 10, font: reg, color: C.text });
    return x + reg.widthOfTextAtSize(s, 10) + 4;
  }

  function simNao(n: number, label: string, sim: boolean, justificarSeNao?: string) {
    ensureSpace(18);
    page.drawText(safe(`${n} - ${label}`), { x: M, y, size: 10.5, font: reg, color: C.text });
    y -= 16;
    let x = M;
    x = checkbox(x, y, sim);
    page.drawText("Sim", { x, y, size: 10, font: reg, color: C.text });
    x += reg.widthOfTextAtSize("Sim", 10) + 24;
    x = checkbox(x, y, !sim);
    page.drawText("Não", { x, y, size: 10, font: reg, color: C.text });
    y -= 16;
    if (justificarSeNao !== undefined) {
      const prefix = 'Se "Não", justificar: ';
      const prefixW = reg.widthOfTextAtSize(prefix, 10);
      const lines = wrap(justificarSeNao || "", reg, 10, width - 2 * M - prefixW);
      page.drawText(safe(prefix), { x: M, y, size: 10, font: reg, color: C.text });
      page.drawText(lines[0] ?? "", { x: M + prefixW, y, size: 10, font: reg, color: C.text });
      if (!justificarSeNao) page.drawLine({ start: { x: M + prefixW, y: y - 2 }, end: { x: width - M, y: y - 2 }, thickness: 0.7, color: C.line });
      y -= 14;
      for (const extra of lines.slice(1)) {
        page.drawText(extra, { x: M, y, size: 10, font: reg, color: C.text });
        y -= 14;
      }
    }
    y -= 6;
  }

  // ─── Página 1 ───────────────────────────────────────────────────────────
  coverPage();

  sectionTitle("Dados Existentes");
  numbered(1, "Nome do cliente", visita.beneficiarioNomeSnapshot);
  numbered(2, "CPF", formatCPF(visita.beneficiarioCpfSnapshot));
  numbered(3, "Endereço", visita.beneficiarioEnderecoSnapshot);
  numbered(4, "Município", visita.municipio);
  longField(5, "Finalidade do crédito (itens detalhados da proposta)", visita.finalidadeDetalhada);

  y -= 6;
  sectionTitle("Dados da Visita");
  numbered(6, "Data", fmtDate(visita.dataVisita));
  y -= 4;
  simNao(7, 'Está aplicando o recurso conforme finalidade da proposta?', visita.aplicandoConforme, visita.aplicandoConformeJustificativa ?? "");

  ensureSpace(30);
  page.drawText(safe("8 - Até a data da visita assinale quais das finalidades propostas já foram aplicadas:"), {
    x: M,
    y,
    size: 10.5,
    font: reg,
    color: C.text,
  });
  y -= 18;

  const cols = 3;
  const colWidth = (width - 2 * M) / cols;
  const rowsPerCol = Math.ceil(visita.purposeLabels.length / cols);
  const gridTop = y;
  const rowHeight = 15;
  ensureSpace(rowsPerCol * rowHeight + 10);
  for (const [i, p] of visita.purposeLabels.entries()) {
    const col = Math.floor(i / rowsPerCol);
    const row = i % rowsPerCol;
    const x = M + col * colWidth;
    const rowY = gridTop - row * rowHeight;
    let cx = x;
    cx = checkbox(cx, rowY, p.selected);
    const label = p.isOutro ? "Outro" : p.label;
    page.drawText(safe(label), { x: cx, y: rowY, size: 9.5, font: reg, color: C.text, maxWidth: colWidth - (cx - x) - 6 });
  }
  y = gridTop - rowsPerCol * rowHeight - 10;
  if (visita.outroFinalidadeDescricao) {
    ensureSpace(20);
    const prefix = "Outro: ";
    const prefixW = bold.widthOfTextAtSize(prefix, 10);
    page.drawText(prefix, { x: M, y, size: 10, font: bold, color: C.text });
    page.drawText(safe(visita.outroFinalidadeDescricao), { x: M + prefixW, y, size: 10, font: reg, color: C.text, maxWidth: width - 2 * M - prefixW });
    y -= 20;
  }

  // ─── Página 2 ───────────────────────────────────────────────────────────
  newPage();

  simNao(9, "Teve algum desafio na aplicação do recurso? Se sim, favor descrever.", visita.teveDesafio);
  {
    const lines = wrap(visita.desafioDescricao || "—", reg, 10, width - 2 * M);
    ensureSpace(14 * lines.length + 6);
    for (const l of lines) {
      page.drawText(l, { x: M, y, size: 10, font: reg, color: C.text });
      y -= 14;
    }
    y -= 8;
  }

  ensureSpace(50);
  page.drawText(
    safe("10 - Está recebendo assistência técnica após acessar o crédito? Se sim, informar a periodicidade"),
    { x: M, y, size: 10.5, font: reg, color: C.text },
  );
  y -= 13;
  page.drawText(safe("(Ex.: semanal, mensal, bimensal, trimestral, semestral...)"), { x: M, y, size: 9, font: italic, color: C.muted });
  y -= 18;
  {
    let x = M;
    x = checkbox(x, y, visita.assistenciaTecnica);
    const periodText = visita.assistenciaTecnica ? `Sim. Periodicidade: ${visita.assistenciaPeriodicidade ?? ""}` : "Sim. Periodicidade: ___________________";
    page.drawText(safe(periodText), { x, y, size: 10, font: reg, color: C.text });
    y -= 16;
    x = M;
    x = checkbox(x, y, !visita.assistenciaTecnica);
    page.drawText("Não", { x, y, size: 10, font: reg, color: C.text });
    y -= 16;
  }

  longField(11, 'Caso a resposta da questão anterior seja negativa (Não), favor informar o motivo', visita.assistenciaMotivoNegativa ?? (visita.assistenciaTecnica ? "—" : ""));

  numbered(12, "Nome e contato telefônico do técnico que acompanha", visita.tecnicoNomeContato);

  simNao(13, "Já tem ponto de referência da área financiada?", visita.pontoReferencia);

  ensureSpace(24);
  page.drawText(safe("14 - Registro de fotos da área financiada e da visita:"), { x: M, y, size: 10.5, font: reg, color: C.text });
  y -= 16;

  if (visita.fotos.length === 0) {
    page.drawText("Nenhuma foto anexada.", { x: M, y, size: 10, font: italic, color: C.muted });
    y -= 20;
  } else {
    const thumbCols = 3;
    const gap = 10;
    const thumbW = (width - 2 * M - gap * (thumbCols - 1)) / thumbCols;
    const thumbH = thumbW * 0.75;
    for (let i = 0; i < visita.fotos.length; i += thumbCols) {
      ensureSpace(thumbH + 10);
      const rowFotos = visita.fotos.slice(i, i + thumbCols);
      for (const [idx, foto] of rowFotos.entries()) {
        const x = M + idx * (thumbW + gap);
        await drawThumb(pdf, page, foto.fileKey, x, y - thumbH, thumbW, thumbH);
      }
      y -= thumbH + 10;
    }
  }

  ensureSpace(80);
  page.drawText(safe("15 - Observações:"), { x: M, y, size: 10.5, font: reg, color: C.text });
  y -= 16;
  const obsBoxH = 70;
  ensureSpace(obsBoxH + 10);
  page.drawRectangle({ x: M, y: y - obsBoxH, width: width - 2 * M, height: obsBoxH, borderColor: C.line, borderWidth: 0.8 });
  if (visita.observacoes) {
    const lines = wrap(visita.observacoes, reg, 9.5, width - 2 * M - 16);
    let ly = y - 14;
    for (const l of lines.slice(0, 6)) {
      page.drawText(l, { x: M + 8, y: ly, size: 9.5, font: reg, color: C.text });
      ly -= 12;
    }
  }
  y -= obsBoxH + 30;

  // ─── Assinaturas ───────────────────────────────────────────────────────
  const tecnicoAssinatura = visita.assinaturas.find((a) => a.tipo === "TECNICO");
  const beneficiarioAssinatura = visita.assinaturas.find((a) => a.tipo === "BENEFICIARIO_DESENHO" || a.tipo === "BENEFICIARIO_DIGITAL");

  ensureSpace(180);
  await signatureLine(pdf, page, "Assinatura do Técnico", tecnicoAssinatura?.fileKey, width / 2 - 110, y, 220);
  y -= 90;
  await signatureLine(pdf, page, "Assinatura do Agricultor", beneficiarioAssinatura?.fileKey, width / 2 - 110, y, 220);
  if (beneficiarioAssinatura?.tipo === "BENEFICIARIO_DIGITAL") {
    y -= 30;
    page.drawText(
      safe(`Impressão digital fotografada — testemunha: ${beneficiarioAssinatura.testemunhaNome ?? "—"}${beneficiarioAssinatura.testemunhaCpf ? ` (CPF ${formatCPF(beneficiarioAssinatura.testemunhaCpf)})` : ""}`),
      { x: M, y, size: 8.5, font: italic, color: C.muted },
    );
  }

  // Rodapé discreto de rastreabilidade (não faz parte do modelo em papel).
  const footNote = `${visita.numeroDocumento ?? "RASCUNHO"} · gerado em ${fmtDateTime(new Date())} · sistema Tabôa`;
  page.drawText(safe(footNote), { x: M, y: 24, size: 7, font: reg, color: C.muted });

  return pdf.save();
}

async function drawThumb(pdf: PDFDocument, page: PDFPage, fileKey: string, x: number, y: number, w: number, h: number) {
  page.drawRectangle({ x, y, width: w, height: h, borderColor: C.line, borderWidth: 0.6, color: C.white });
  const buf = await readPrivateFileBuffer(fileKey);
  if (!buf) return;
  try {
    const img = fileKey.endsWith(".png") ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
    const scale = Math.min(w / img.width, h / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
  } catch {
    // ignora foto corrompida — mantém a moldura vazia
  }
}

async function signatureLine(pdf: PDFDocument, page: PDFPage, label: string, fileKey: string | undefined, x: number, yTop: number, w: number) {
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  if (fileKey) {
    const buf = await readPrivateFileBuffer(fileKey);
    if (buf) {
      try {
        const img = fileKey.endsWith(".png") ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
        const maxH = 50;
        const scale = Math.min(w / img.width, maxH / img.height, 1);
        const iw = img.width * scale;
        const ih = img.height * scale;
        page.drawImage(img, { x: x + (w - iw) / 2, y: yTop - ih, width: iw, height: ih });
      } catch {
        /* segue sem a imagem */
      }
    }
  }
  page.drawLine({ start: { x, y: yTop - 55 }, end: { x: x + w, y: yTop - 55 }, thickness: 0.8, color: C.box });
  const labelW = font.widthOfTextAtSize(label, 9.5);
  page.drawText(label, { x: x + (w - labelW) / 2, y: yTop - 68, size: 9.5, font, color: C.text });
}
