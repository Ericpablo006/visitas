-- Cliente (Beneficiario): localização da propriedade (mesmo pino usado no
-- Agendamento) e finalidade de crédito original (reaproveita a lista de
-- Purpose já usada no formulário de visita).

ALTER TABLE "Beneficiario" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Beneficiario" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Beneficiario" ADD COLUMN "finalidadeCreditoId" TEXT;

CREATE INDEX "Beneficiario_finalidadeCreditoId_idx" ON "Beneficiario"("finalidadeCreditoId");

ALTER TABLE "Beneficiario" ADD CONSTRAINT "Beneficiario_finalidadeCreditoId_fkey" FOREIGN KEY ("finalidadeCreditoId") REFERENCES "Purpose"("id") ON DELETE SET NULL ON UPDATE CASCADE;
