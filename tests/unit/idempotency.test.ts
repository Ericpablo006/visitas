import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createVisitaIdempotent } from "@/lib/visita-service";
import type { VisitaInput } from "@/lib/schemas/visita";

// Teste de integração: precisa de um Postgres acessível via DATABASE_URL
// (rode `npm run db:local` em outro terminal antes de `npm test`).

let empresaId: string;
let tecnicoId: string;
let outroTecnicoId: string;
let purposeId: string;

function baseInput(overrides: Partial<VisitaInput> = {}): VisitaInput {
  return {
    clientLocalId: randomUUID(),
    beneficiarioNome: "Beneficiário de Teste",
    beneficiarioCpf: "52998224725",
    beneficiarioEndereco: "Sítio Teste, s/n",
    municipio: "Município Teste",
    dataVisita: "2026-03-10",
    purposeIds: [purposeId],
    pergunta7Resposta: "SIM",
    pergunta7Justificativa: null,
    pergunta8Resposta: "SIM",
    pergunta9Resposta: "NAO",
    pergunta9QuantidadeEmpregos: null,
    pergunta9RendaEstimadaCents: null,
    pergunta10Resposta: "SIM",
    pergunta10MotivoParalisacao: null,
    pergunta11Resposta: "NAO",
    pergunta11ParcelasAtrasadas: null,
    pergunta12Resposta: "NAO",
    pergunta12Dificuldades: null,
    pergunta13Resposta: "SIM",
    pergunta13Motivo: null,
    observacoes: null,
    ...overrides,
  } as VisitaInput;
}

beforeAll(async () => {
  const suffix = randomUUID().slice(0, 8);
  const empresa = await db.empresa.create({ data: { nome: `Empresa Teste ${suffix}` } });
  const tecnico = await db.user.create({ data: { empresaId: empresa.id, name: "Técnico Teste", email: `tecnico-${suffix}@teste.local`, passwordHash: "x", role: "TECNICO" } });
  const outro = await db.user.create({ data: { empresaId: empresa.id, name: "Outro Técnico", email: `outro-${suffix}@teste.local`, passwordHash: "x", role: "TECNICO" } });
  const purpose = await db.purpose.create({ data: { empresaId: empresa.id, label: `Finalidade teste ${suffix}` } });
  empresaId = empresa.id;
  tecnicoId = tecnico.id;
  outroTecnicoId = outro.id;
  purposeId = purpose.id;
});

afterAll(async () => {
  await db.visita.deleteMany({ where: { tecnicoId: { in: [tecnicoId, outroTecnicoId] } } });
  await db.purpose.delete({ where: { id: purposeId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [tecnicoId, outroTecnicoId] } } });
  await db.beneficiario.deleteMany({ where: { empresaId } });
  await db.empresa.delete({ where: { id: empresaId } }).catch(() => {});
  await db.$disconnect();
});

describe("createVisitaIdempotent", () => {
  it("cria a visita na primeira chamada", async () => {
    const input = baseInput();
    const result = await createVisitaIdempotent(tecnicoId, empresaId, input);
    expect("conflict" in result).toBe(false);
    if ("conflict" in result) return;
    expect(result.created).toBe(true);
    expect(result.visita.clientLocalId).toBe(input.clientLocalId);
  });

  it("reenvio com o mesmo clientLocalId devolve a MESMA visita, sem duplicar", async () => {
    const input = baseInput();
    const first = await createVisitaIdempotent(tecnicoId, empresaId, input);
    const second = await createVisitaIdempotent(tecnicoId, empresaId, input);
    if ("conflict" in first || "conflict" in second) throw new Error("não deveria haver conflito");

    expect(first.visita.id).toBe(second.visita.id);
    expect(second.created).toBe(false);

    const count = await db.visita.count({ where: { clientLocalId: input.clientLocalId } });
    expect(count).toBe(1);
  });

  it("duas chamadas concorrentes com o mesmo clientLocalId ainda assim criam só uma visita", async () => {
    const input = baseInput();
    const [a, b] = await Promise.all([createVisitaIdempotent(tecnicoId, empresaId, input), createVisitaIdempotent(tecnicoId, empresaId, input)]);
    if ("conflict" in a || "conflict" in b) throw new Error("não deveria haver conflito");
    expect(a.visita.id).toBe(b.visita.id);

    const count = await db.visita.count({ where: { clientLocalId: input.clientLocalId } });
    expect(count).toBe(1);
  });

  it("o mesmo clientLocalId usado por outro técnico gera conflito (409)", async () => {
    const input = baseInput();
    await createVisitaIdempotent(tecnicoId, empresaId, input);
    const result = await createVisitaIdempotent(outroTecnicoId, empresaId, input);
    expect("conflict" in result).toBe(true);
  });
});
