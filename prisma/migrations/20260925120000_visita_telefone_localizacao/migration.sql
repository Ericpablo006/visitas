-- Telefone do beneficiário (snapshot, igual nome/cpf/endereço) e localização da
-- propriedade na própria Visita — capturada pelo GPS em campo ou herdada do
-- cadastro do cliente ao selecioná-lo no formulário.

ALTER TABLE "Visita" ADD COLUMN "beneficiarioTelefoneSnapshot" TEXT;
ALTER TABLE "Visita" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Visita" ADD COLUMN "longitude" DOUBLE PRECISION;
