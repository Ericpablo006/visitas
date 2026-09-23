-- Substitui o questionário inventado (perguntas 7-13 genéricas) pelos campos
-- do formulário oficial da Tabôa ("Modelo formulário visita pós crédito").
-- Visitas já existentes recebem valores padrão neutros nos campos novos —
-- ficam editáveis depois pela nova tela de edição.

-- ─── Purpose.isOutro ──────────────────────────────────────────────────────
ALTER TABLE "Purpose" ADD COLUMN "isOutro" BOOLEAN NOT NULL DEFAULT false;

-- ─── Visita: novas colunas (nullable por enquanto, para poder popular) ────
ALTER TABLE "Visita" ADD COLUMN "finalidadeDetalhada" TEXT;
ALTER TABLE "Visita" ADD COLUMN "aplicandoConforme" BOOLEAN;
ALTER TABLE "Visita" ADD COLUMN "aplicandoConformeJustificativa" TEXT;
ALTER TABLE "Visita" ADD COLUMN "outroFinalidadeDescricao" TEXT;
ALTER TABLE "Visita" ADD COLUMN "teveDesafio" BOOLEAN;
ALTER TABLE "Visita" ADD COLUMN "desafioDescricao" TEXT;
ALTER TABLE "Visita" ADD COLUMN "assistenciaTecnica" BOOLEAN;
ALTER TABLE "Visita" ADD COLUMN "assistenciaPeriodicidade" TEXT;
ALTER TABLE "Visita" ADD COLUMN "assistenciaMotivoNegativa" TEXT;
ALTER TABLE "Visita" ADD COLUMN "tecnicoNomeContato" TEXT;
ALTER TABLE "Visita" ADD COLUMN "pontoReferencia" BOOLEAN;

-- ─── Backfill de linhas existentes com valores neutros ────────────────────
UPDATE "Visita" SET
  "finalidadeDetalhada" = '',
  "aplicandoConforme" = true,
  "teveDesafio" = false,
  "assistenciaTecnica" = false,
  "pontoReferencia" = false;

UPDATE "Visita" v SET "tecnicoNomeContato" = u."name"
FROM "User" u WHERE u.id = v."tecnicoId" AND v."tecnicoNomeContato" IS NULL;

-- ─── Agora sim, NOT NULL ───────────────────────────────────────────────────
ALTER TABLE "Visita" ALTER COLUMN "finalidadeDetalhada" SET NOT NULL;
ALTER TABLE "Visita" ALTER COLUMN "aplicandoConforme" SET NOT NULL;
ALTER TABLE "Visita" ALTER COLUMN "teveDesafio" SET NOT NULL;
ALTER TABLE "Visita" ALTER COLUMN "assistenciaTecnica" SET NOT NULL;
ALTER TABLE "Visita" ALTER COLUMN "tecnicoNomeContato" SET NOT NULL;
ALTER TABLE "Visita" ALTER COLUMN "pontoReferencia" SET NOT NULL;

-- ─── Remove as colunas antigas do questionário genérico ───────────────────
ALTER TABLE "Visita" DROP COLUMN "pergunta7Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta7Justificativa";
ALTER TABLE "Visita" DROP COLUMN "pergunta8Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta9Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta9QuantidadeEmpregos";
ALTER TABLE "Visita" DROP COLUMN "pergunta9RendaEstimadaCents";
ALTER TABLE "Visita" DROP COLUMN "pergunta10Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta10MotivoParalisacao";
ALTER TABLE "Visita" DROP COLUMN "pergunta11Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta11ParcelasAtrasadas";
ALTER TABLE "Visita" DROP COLUMN "pergunta12Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta12Dificuldades";
ALTER TABLE "Visita" DROP COLUMN "pergunta13Resposta";
ALTER TABLE "Visita" DROP COLUMN "pergunta13Motivo";

-- ─── O enum RespostaSimNao não é mais usado por nenhuma coluna ────────────
DROP TYPE "RespostaSimNao";
