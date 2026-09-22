import { describe, expect, it } from "vitest";
import { visitaSchema } from "@/lib/schemas/visita";

function baseVisita(overrides: Record<string, unknown> = {}) {
  return {
    clientLocalId: "5f1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a",
    beneficiarioNome: "Maria da Silva",
    beneficiarioCpf: "529.982.247-25",
    beneficiarioEndereco: "Sítio Boa Esperança, s/n",
    municipio: "Bom Jesus",
    dataVisita: "2026-03-10",
    purposeIds: ["ckv1x0000000000000000000"],
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
  };
}

describe("visitaSchema", () => {
  it("aceita uma visita completa e válida", () => {
    const result = visitaSchema.safeParse(baseVisita());
    expect(result.success).toBe(true);
  });

  it("rejeita CPF inválido", () => {
    const result = visitaSchema.safeParse(baseVisita({ beneficiarioCpf: "111.111.111-11" }));
    expect(result.success).toBe(false);
  });

  it("exige justificativa quando pergunta7 não é SIM", () => {
    const result = visitaSchema.safeParse(baseVisita({ pergunta7Resposta: "NAO", pergunta7Justificativa: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "pergunta7Justificativa")).toBe(true);
    }
  });

  it("aceita pergunta7 != SIM quando a justificativa é informada", () => {
    const result = visitaSchema.safeParse(baseVisita({ pergunta7Resposta: "NAO", pergunta7Justificativa: "Beneficiário mudou de atividade." }));
    expect(result.success).toBe(true);
  });

  it("exige motivo de paralisação quando pergunta10 é NAO", () => {
    const result = visitaSchema.safeParse(baseVisita({ pergunta10Resposta: "NAO", pergunta10MotivoParalisacao: null }));
    expect(result.success).toBe(false);
  });

  it("exige quantidade de empregos quando pergunta9 é SIM", () => {
    const result = visitaSchema.safeParse(baseVisita({ pergunta9Resposta: "SIM", pergunta9QuantidadeEmpregos: null }));
    expect(result.success).toBe(false);
  });

  it("exige ao menos uma finalidade selecionada", () => {
    const result = visitaSchema.safeParse(baseVisita({ purposeIds: [] }));
    expect(result.success).toBe(false);
  });
});
