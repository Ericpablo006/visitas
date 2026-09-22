-- CreateEnum
CREATE TYPE "Role" AS ENUM ('TECNICO', 'COORDENADOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VisitaStatus" AS ENUM ('RASCUNHO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "RespostaSimNao" AS ENUM ('SIM', 'NAO', 'PARCIAL', 'NAO_SE_APLICA');

-- CreateEnum
CREATE TYPE "SignatureType" AS ENUM ('TECNICO', 'BENEFICIARIO_DESENHO', 'BENEFICIARIO_DIGITAL');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGIN_FALHOU', 'LOGIN_MOBILE', 'REFRESH_TOKEN', 'LOGOUT', 'CRIACAO', 'EDICAO', 'UPLOAD_FOTO', 'UPLOAD_ASSINATURA', 'FINALIZACAO', 'REVOGACAO', 'ATIVACAO', 'DESATIVACAO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "matricula" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'TECNICO',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileRefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "deviceId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MobileRefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beneficiario" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "telefone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beneficiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purpose" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaPurpose" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "purposeId" TEXT NOT NULL,

    CONSTRAINT "VisitaPurpose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "ano" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("ano")
);

-- CreateTable
CREATE TABLE "Visita" (
    "id" TEXT NOT NULL,
    "clientLocalId" TEXT NOT NULL,
    "numeroDocumento" TEXT,
    "status" "VisitaStatus" NOT NULL DEFAULT 'RASCUNHO',
    "tecnicoId" TEXT NOT NULL,
    "beneficiarioId" TEXT NOT NULL,
    "beneficiarioNomeSnapshot" TEXT NOT NULL,
    "beneficiarioCpfSnapshot" TEXT NOT NULL,
    "beneficiarioEnderecoSnapshot" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "dataVisita" TIMESTAMP(3) NOT NULL,
    "pergunta7Resposta" "RespostaSimNao" NOT NULL,
    "pergunta7Justificativa" TEXT,
    "pergunta8Resposta" "RespostaSimNao" NOT NULL,
    "pergunta9Resposta" "RespostaSimNao" NOT NULL,
    "pergunta9QuantidadeEmpregos" INTEGER,
    "pergunta9RendaEstimadaCents" INTEGER,
    "pergunta10Resposta" "RespostaSimNao" NOT NULL,
    "pergunta10MotivoParalisacao" TEXT,
    "pergunta11Resposta" "RespostaSimNao" NOT NULL,
    "pergunta11ParcelasAtrasadas" INTEGER,
    "pergunta12Resposta" "RespostaSimNao" NOT NULL,
    "pergunta12Dificuldades" TEXT,
    "pergunta13Resposta" "RespostaSimNao" NOT NULL,
    "pergunta13Motivo" TEXT,
    "observacoes" TEXT,
    "finalizadaEm" TIMESTAMP(3),
    "finalizadaPorId" TEXT,
    "pdfFileKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaFoto" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "clientLocalId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "legenda" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaFoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaAssinatura" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "tipo" "SignatureType" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "testemunhaNome" TEXT,
    "testemunhaCpf" TEXT,
    "criadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaAssinatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "acao" "AuditAction" NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "detalhes" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "MobileRefreshToken_tokenHash_key" ON "MobileRefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "MobileRefreshToken_userId_idx" ON "MobileRefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Beneficiario_cpf_key" ON "Beneficiario"("cpf");

-- CreateIndex
CREATE INDEX "Purpose_ativo_sortOrder_idx" ON "Purpose"("ativo", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VisitaPurpose_visitaId_purposeId_key" ON "VisitaPurpose"("visitaId", "purposeId");

-- CreateIndex
CREATE UNIQUE INDEX "Visita_clientLocalId_key" ON "Visita"("clientLocalId");

-- CreateIndex
CREATE UNIQUE INDEX "Visita_numeroDocumento_key" ON "Visita"("numeroDocumento");

-- CreateIndex
CREATE INDEX "Visita_tecnicoId_dataVisita_idx" ON "Visita"("tecnicoId", "dataVisita");

-- CreateIndex
CREATE INDEX "Visita_municipio_idx" ON "Visita"("municipio");

-- CreateIndex
CREATE INDEX "Visita_status_idx" ON "Visita"("status");

-- CreateIndex
CREATE INDEX "VisitaFoto_visitaId_idx" ON "VisitaFoto"("visitaId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitaFoto_visitaId_clientLocalId_key" ON "VisitaFoto"("visitaId", "clientLocalId");

-- CreateIndex
CREATE INDEX "VisitaAssinatura_visitaId_idx" ON "VisitaAssinatura"("visitaId");

-- CreateIndex
CREATE UNIQUE INDEX "VisitaAssinatura_visitaId_tipo_key" ON "VisitaAssinatura"("visitaId", "tipo");

-- CreateIndex
CREATE INDEX "AuditLog_entidade_entidadeId_idx" ON "AuditLog"("entidade", "entidadeId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");

-- AddForeignKey
ALTER TABLE "MobileRefreshToken" ADD CONSTRAINT "MobileRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaPurpose" ADD CONSTRAINT "VisitaPurpose_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaPurpose" ADD CONSTRAINT "VisitaPurpose_purposeId_fkey" FOREIGN KEY ("purposeId") REFERENCES "Purpose"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_tecnicoId_fkey" FOREIGN KEY ("tecnicoId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_beneficiarioId_fkey" FOREIGN KEY ("beneficiarioId") REFERENCES "Beneficiario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_finalizadaPorId_fkey" FOREIGN KEY ("finalizadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaFoto" ADD CONSTRAINT "VisitaFoto_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaFoto" ADD CONSTRAINT "VisitaFoto_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaAssinatura" ADD CONSTRAINT "VisitaAssinatura_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaAssinatura" ADD CONSTRAINT "VisitaAssinatura_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
