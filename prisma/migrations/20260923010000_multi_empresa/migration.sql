-- Multi-empresa: cada usuário/visita/finalidade/beneficiário passa a pertencer
-- a uma Empresa. Dados existentes são migrados para uma empresa padrão
-- ("empresa-taboa") criada nesta própria migração, para não perder nada.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT,
    "endereco" TEXT,
    "telefone" TEXT,
    "logoFileKey" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_cnpj_key" ON "Empresa"("cnpj");

-- Empresa padrão para receber todos os dados já existentes.
INSERT INTO "Empresa" ("id", "nome", "ativa", "createdAt", "updatedAt")
VALUES ('empresa-taboa', 'Tabôa – Fortalecimento Comunitário', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- ─── User ───────────────────────────────────────────────────────────────
-- empresaId fica NULLABLE (só é nulo para SUPER_ADMIN).
ALTER TABLE "User" ADD COLUMN "empresaId" TEXT;
UPDATE "User" SET "empresaId" = 'empresa-taboa';
ALTER TABLE "User" ADD CONSTRAINT "User_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "User_empresaId_idx" ON "User"("empresaId");

-- ─── Purpose ────────────────────────────────────────────────────────────
ALTER TABLE "Purpose" ADD COLUMN "empresaId" TEXT;
UPDATE "Purpose" SET "empresaId" = 'empresa-taboa';
ALTER TABLE "Purpose" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Purpose" ADD CONSTRAINT "Purpose_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "Purpose_ativo_sortOrder_idx";
CREATE INDEX "Purpose_empresaId_ativo_sortOrder_idx" ON "Purpose"("empresaId", "ativo", "sortOrder");

-- ─── Beneficiario ───────────────────────────────────────────────────────
ALTER TABLE "Beneficiario" ADD COLUMN "empresaId" TEXT;
UPDATE "Beneficiario" SET "empresaId" = 'empresa-taboa';
ALTER TABLE "Beneficiario" ALTER COLUMN "empresaId" SET NOT NULL;
DROP INDEX "Beneficiario_cpf_key";
ALTER TABLE "Beneficiario" ADD CONSTRAINT "Beneficiario_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Beneficiario_empresaId_cpf_key" ON "Beneficiario"("empresaId", "cpf");

-- ─── Visita ─────────────────────────────────────────────────────────────
ALTER TABLE "Visita" ADD COLUMN "empresaId" TEXT;
UPDATE "Visita" SET "empresaId" = 'empresa-taboa';
ALTER TABLE "Visita" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Visita_empresaId_dataVisita_idx" ON "Visita"("empresaId", "dataVisita");

-- ─── DocumentSequence (troca a PK de "ano" para ("empresaId","ano")) ─────
ALTER TABLE "DocumentSequence" ADD COLUMN "empresaId" TEXT;
UPDATE "DocumentSequence" SET "empresaId" = 'empresa-taboa';
ALTER TABLE "DocumentSequence" ALTER COLUMN "empresaId" SET NOT NULL;
ALTER TABLE "DocumentSequence" DROP CONSTRAINT "DocumentSequence_pkey";
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("empresaId", "ano");
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
