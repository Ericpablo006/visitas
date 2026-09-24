-- Agenda de visitas: ADMIN/COORDENADOR agenda uma visita pra um técnico com
-- antecedência (produtor, propriedade, localização no mapa). O status
-- "pendente"/"atendido" é derivado de existir ou não uma Visita vinculada.

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "nomePropriedade" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "dataAgendada" TIMESTAMP(3),
    "observacoes" TEXT,
    "tecnicoId" TEXT NOT NULL,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Agendamento_empresaId_tecnicoId_idx" ON "Agendamento"("empresaId", "tecnicoId");

ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Visita ↔ Agendamento ───────────────────────────────────────────────
ALTER TABLE "Visita" ADD COLUMN "agendamentoId" TEXT;
CREATE UNIQUE INDEX "Visita_agendamentoId_key" ON "Visita"("agendamentoId");
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;
