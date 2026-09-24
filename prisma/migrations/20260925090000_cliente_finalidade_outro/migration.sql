-- Permite escrever uma descrição livre pra finalidade do crédito do cliente
-- quando a opção selecionada for "Outro" (mesma ideia do
-- Visita.outroFinalidadeDescricao).

ALTER TABLE "Beneficiario" ADD COLUMN "finalidadeCreditoOutro" TEXT;
