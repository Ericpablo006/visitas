import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createVisitaIdempotent, finalizeVisitaIdempotent } from "@/lib/visita-service";
import type { VisitaInput } from "@/lib/schemas/visita";

let empresaId: string;
let tecnicoId: string;
let purposeId: string;
const ano = new Date().getFullYear();

function baseInput(cpf: string): VisitaInput {
  return {
    clientLocalId: randomUUID(),
    beneficiarioNome: "Beneficiário Sequência",
    beneficiarioCpf: cpf,
    beneficiarioEndereco: "Sítio Sequência, s/n",
    municipio: "Município Teste",
    dataVisita: `${ano}-03-10`,
    finalidadeDetalhada: "Compra de insumos",
    purposeIds: [purposeId],
    outroFinalidadeDescricao: null,
    aplicandoConforme: true,
    aplicandoConformeJustificativa: null,
    teveDesafio: false,
    desafioDescricao: null,
    assistenciaTecnica: false,
    assistenciaPeriodicidade: null,
    assistenciaMotivoNegativa: "Não solicitou",
    tecnicoNomeContato: "Técnico Sequência - (11) 99999-0000",
    pontoReferencia: false,
    observacoes: null,
  } as VisitaInput;
}

const CPFS_VALIDOS = ["52998224725", "11144477735", "93541134780", "71428793860", "26362192090"];

async function novaVisitaRascunho(indice: string) {
  const cpf = CPFS_VALIDOS[Number(indice) % CPFS_VALIDOS.length] ?? CPFS_VALIDOS[0]!;
  const result = await createVisitaIdempotent(tecnicoId, empresaId, baseInput(cpf));
  if ("conflict" in result) throw new Error("conflito inesperado");
  return result.visita;
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const empresa = await db.empresa.create({ data: { nome: `Empresa Sequência ${suffix}` } });
  const tecnico = await db.user.create({ data: { empresaId: empresa.id, name: "Técnico Sequência", email: `seq-${suffix}@teste.local`, passwordHash: "x", role: "TECNICO" } });
  const purpose = await db.purpose.create({ data: { empresaId: empresa.id, label: `Finalidade sequência ${suffix}` } });
  empresaId = empresa.id;
  tecnicoId = tecnico.id;
  purposeId = purpose.id;
});

afterAll(async () => {
  await db.visita.deleteMany({ where: { tecnicoId } });
  await db.purpose.delete({ where: { id: purposeId } }).catch(() => {});
  await db.user.delete({ where: { id: tecnicoId } }).catch(() => {});
  await db.beneficiario.deleteMany({ where: { empresaId } });
  await db.documentSequence.deleteMany({ where: { empresaId } });
  await db.empresa.delete({ where: { id: empresaId } }).catch(() => {});
  await db.$disconnect();
});

describe("finalizeVisitaIdempotent", () => {
  it("atribui um número de documento sequencial ao finalizar", async () => {
    const visita = await novaVisitaRascunho("1");
    const finalizada = await finalizeVisitaIdempotent(visita.id, tecnicoId);
    expect(finalizada.status).toBe("FINALIZADA");
    expect(finalizada.numeroDocumento).toMatch(new RegExp(`^VP-${ano}-\\d{6}$`));
  });

  it("finalizar de novo (reenvio) devolve o MESMO número — não incrementa duas vezes", async () => {
    const visita = await novaVisitaRascunho("2");
    const first = await finalizeVisitaIdempotent(visita.id, tecnicoId);
    const second = await finalizeVisitaIdempotent(visita.id, tecnicoId);
    expect(second.numeroDocumento).toBe(first.numeroDocumento);
  });

  it("duas finalizações concorrentes da MESMA visita não geram dois números", async () => {
    const visita = await novaVisitaRascunho("3");
    const [a, b] = await Promise.all([finalizeVisitaIdempotent(visita.id, tecnicoId), finalizeVisitaIdempotent(visita.id, tecnicoId)]);
    expect(a.numeroDocumento).toBe(b.numeroDocumento);
  });

  it("visitas diferentes recebem números distintos e crescentes", async () => {
    const v1 = await novaVisitaRascunho("4");
    const v2 = await novaVisitaRascunho("5");
    const f1 = await finalizeVisitaIdempotent(v1.id, tecnicoId);
    const f2 = await finalizeVisitaIdempotent(v2.id, tecnicoId);
    expect(f1.numeroDocumento).not.toBe(f2.numeroDocumento);
    const n1 = Number(f1.numeroDocumento?.split("-").pop());
    const n2 = Number(f2.numeroDocumento?.split("-").pop());
    expect(n2).toBeGreaterThan(n1);
  });
});
