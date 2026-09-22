import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { VisitaWithRelations } from "@/lib/visita-response";
import { readPrivateFileBuffer } from "@/lib/storage";
import { formatCPF } from "@/lib/cpf";

const RESPOSTA_LABEL: Record<string, string> = {
  SIM: "Sim",
  NAO: "Não",
  PARCIAL: "Parcialmente",
  NAO_SE_APLICA: "Não se aplica",
};

const hex = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
// Verde institucional da Tabôa (#2f6749) + paleta neutra de apoio.
const C = {
  ink: hex("#0f2417"),
  brand: hex("#2f6749"),
  brandDark: hex("#204a35"),
  text: hex("#101828"),
  muted: hex("#5b6577"),
  line: hex("#dfe5ef"),
  soft: hex("#eef4f0"),
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
const fmtBRL = (cents: number) => `R$ ${(cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

type VisitaPdfInput = VisitaWithRelations & {
  tecnico: { name: string; email: string; matricula: string | null };
  finalizadaPor: { name: string } | null;
  purposeLabels: string[];
};

export async function renderVisitaPdf(visita: VisitaPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Visita Pós-Crédito ${visita.numeroDocumento ?? visita.id}`);
  pdf.setAuthor("Tabôa - Fortalecimento Comunitário");
  pdf.setProducer("Tabôa - Fortalecimento Comunitário");

  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 48;
  const PAGE: [number, number] = [595.28, 841.89];

  let page = pdf.addPage(PAGE);
  let { width, height } = page.getSize();
  let y = 0;

  function newPage() {
    page = pdf.addPage(PAGE);
    ({ width, height } = page.getSize());
    y = height - 40;
  }

  function header(title: string) {
    page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: C.brand });
    page.drawRectangle({ x: 0, y: height - 99, width, height: 3, color: C.brandDark });
    page.drawText("TABÔA", { x: M, y: height - 42, size: 20, font: bold, color: C.white });
    page.drawText("Fortalecimento Comunitário", { x: M, y: height - 60, size: 10, font: reg, color: C.white });
    const num = visita.numeroDocumento ?? "RASCUNHO";
    page.drawText(title, { x: width - M - bold.widthOfTextAtSize(title, 14), y: height - 42, size: 14, font: bold, color: C.white });
    page.drawText(num, { x: width - M - reg.widthOfTextAtSize(num, 11), y: height - 60, size: 11, font: reg, color: C.white });
    y = height - 130;
  }

  function ensureSpace(needed: number) {
    if (y - needed < 70) {
      footer();
      newPage();
      header("VISITA PÓS-CRÉDITO (continuação)");
    }
  }

  function sectionTitle(title: string) {
    ensureSpace(28);
    page.drawText(safe(title.toUpperCase()), { x: M, y, size: 11, font: bold, color: C.brandDark });
    y -= 6;
    page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 1, color: C.line });
    y -= 16;
  }

  function field(label: string, value: string, width2 = width - 2 * M) {
    const lines = wrap(value || "—", reg, 10.5, width2);
    ensureSpace(14 + lines.length * 13);
    page.drawText(safe(label.toUpperCase()), { x: M, y, size: 8, font: bold, color: C.muted });
    y -= 13;
    for (const l of lines) {
      page.drawText(l, { x: M, y, size: 10.5, font: reg, color: C.text });
      y -= 13;
    }
    y -= 6;
  }

  function twoCols(a: [string, string], b: [string, string]) {
    const colWidth = (width - 2 * M - 20) / 2;
    ensureSpace(28);
    page.drawText(safe(a[0].toUpperCase()), { x: M, y, size: 8, font: bold, color: C.muted });
    page.drawText(safe(b[0].toUpperCase()), { x: M + colWidth + 20, y, size: 8, font: bold, color: C.muted });
    y -= 13;
    page.drawText(safe(a[1] || "—"), { x: M, y, size: 10.5, font: reg, color: C.text });
    page.drawText(safe(b[1] || "—"), { x: M + colWidth + 20, y, size: 10.5, font: reg, color: C.text });
    y -= 19;
  }

  function footer() {
    page.drawRectangle({ x: 0, y: 0, width, height: 34, color: C.soft });
    page.drawText(safe(`Documento gerado em ${fmtDateTime(new Date())} pelo sistema Tabôa - Visita Pós-Crédito.`), {
      x: M,
      y: 13,
      size: 7.5,
      font: reg,
      color: C.muted,
    });
  }

  header("VISITA PÓS-CRÉDITO");

  sectionTitle("Identificação");
  twoCols(["Beneficiário", visita.beneficiarioNomeSnapshot], ["CPF", formatCPF(visita.beneficiarioCpfSnapshot)]);
  twoCols(["Município", visita.municipio], ["Data da visita", fmtDate(visita.dataVisita)]);
  field("Endereço", visita.beneficiarioEnderecoSnapshot);
  twoCols(["Técnico responsável", visita.tecnico.name], ["Matrícula", visita.tecnico.matricula ?? "—"]);

  sectionTitle("Finalidades do crédito");
  field("Selecionadas", visita.purposeLabels.length ? visita.purposeLabels.join("; ") : "Nenhuma informada");

  sectionTitle("Acompanhamento pós-crédito");
  field("7. O crédito foi aplicado conforme o planejado?", RESPOSTA_LABEL[visita.pergunta7Resposta] ?? visita.pergunta7Resposta);
  if (visita.pergunta7Justificativa) field("Justificativa", visita.pergunta7Justificativa);
  field("8. O beneficiário recebeu a orientação técnica necessária?", RESPOSTA_LABEL[visita.pergunta8Resposta] ?? visita.pergunta8Resposta);
  field("9. A atividade gerou emprego/renda adicional?", RESPOSTA_LABEL[visita.pergunta9Resposta] ?? visita.pergunta9Resposta);
  if (visita.pergunta9QuantidadeEmpregos != null) field("Quantidade de empregos gerados", String(visita.pergunta9QuantidadeEmpregos));
  if (visita.pergunta9RendaEstimadaCents != null) field("Renda estimada gerada", fmtBRL(visita.pergunta9RendaEstimadaCents));
  field("10. A atividade financiada está em funcionamento?", RESPOSTA_LABEL[visita.pergunta10Resposta] ?? visita.pergunta10Resposta);
  if (visita.pergunta10MotivoParalisacao) field("Motivo da paralisação", visita.pergunta10MotivoParalisacao);
  field("11. Há parcelas do crédito em atraso?", RESPOSTA_LABEL[visita.pergunta11Resposta] ?? visita.pergunta11Resposta);
  if (visita.pergunta11ParcelasAtrasadas != null) field("Parcelas em atraso", String(visita.pergunta11ParcelasAtrasadas));
  field("12. O beneficiário enfrentou dificuldades na execução?", RESPOSTA_LABEL[visita.pergunta12Resposta] ?? visita.pergunta12Resposta);
  if (visita.pergunta12Dificuldades) field("Dificuldades relatadas", visita.pergunta12Dificuldades);
  field("13. O beneficiário recomendaria o programa a outros?", RESPOSTA_LABEL[visita.pergunta13Resposta] ?? visita.pergunta13Resposta);
  if (visita.pergunta13Motivo) field("Motivo", visita.pergunta13Motivo);

  if (visita.observacoes) {
    sectionTitle("Observações do técnico");
    field("Observações", visita.observacoes);
  }

  sectionTitle("Registro fotográfico");
  field("Fotos anexadas ao registro digital desta visita", `${visita.fotos.length} foto(s) — disponíveis no sistema Tabôa.`);

  // ─── Assinaturas ───
  ensureSpace(220);
  sectionTitle("Assinaturas");
  const tecnicoAssinatura = visita.assinaturas.find((a) => a.tipo === "TECNICO");
  const beneficiarioAssinatura = visita.assinaturas.find((a) => a.tipo === "BENEFICIARIO_DESENHO" || a.tipo === "BENEFICIARIO_DIGITAL");

  const boxW = (width - 2 * M - 20) / 2;
  const boxH = 150;
  ensureSpace(boxH + 30);
  const boxY = y - boxH;

  async function drawSignatureBox(x: number, label: string, sub: string, fileKey: string | undefined) {
    page.drawRectangle({ x, y: boxY, width: boxW, height: boxH, borderColor: C.line, borderWidth: 1, color: C.white });
    page.drawText(safe(label.toUpperCase()), { x: x + 10, y: boxY + boxH - 16, size: 8, font: bold, color: C.muted });
    if (fileKey) {
      const buf = await readPrivateFileBuffer(fileKey);
      if (buf) {
        try {
          const img = fileKey.endsWith(".png") ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
          const maxW = boxW - 20;
          const maxH = boxH - 46;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: x + (boxW - w) / 2, y: boxY + 30 + (maxH - h) / 2, width: w, height: h });
        } catch {
          page.drawText("(não foi possível carregar a imagem)", { x: x + 10, y: boxY + boxH / 2, size: 8, font: reg, color: C.muted });
        }
      }
    } else {
      page.drawText("Não enviada", { x: x + 10, y: boxY + boxH / 2, size: 9, font: reg, color: C.muted });
    }
    page.drawLine({ start: { x: x + 10, y: boxY + 24 }, end: { x: x + boxW - 10, y: boxY + 24 }, thickness: 0.6, color: C.line });
    page.drawText(safe(sub), { x: x + 10, y: boxY + 10, size: 8, font: reg, color: C.muted });
  }

  await drawSignatureBox(M, "Técnico responsável", visita.tecnico.name, tecnicoAssinatura?.fileKey);
  await drawSignatureBox(M + boxW + 20, "Beneficiário", beneficiarioAssinatura?.testemunhaNome ? `Testemunha: ${beneficiarioAssinatura.testemunhaNome}` : visita.beneficiarioNomeSnapshot, beneficiarioAssinatura?.fileKey);
  y = boxY - 20;

  if (beneficiarioAssinatura?.tipo === "BENEFICIARIO_DIGITAL") {
    field(
      "Modo de assinatura do beneficiário",
      `Impressão digital fotografada, com testemunha ${beneficiarioAssinatura.testemunhaNome ?? "—"}${beneficiarioAssinatura.testemunhaCpf ? ` (CPF ${formatCPF(beneficiarioAssinatura.testemunhaCpf)})` : ""}.`,
    );
  }

  ensureSpace(40);
  field("Situação", visita.status === "FINALIZADA" ? `Finalizada em ${visita.finalizadaEm ? fmtDateTime(visita.finalizadaEm) : "—"} por ${visita.finalizadaPor?.name ?? "—"}` : "Rascunho");

  footer();

  return pdf.save();
}
