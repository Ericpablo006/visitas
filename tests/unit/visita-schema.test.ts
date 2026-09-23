import { describe, expect, it } from "vitest";
import { visitaSchema } from "@/lib/schemas/visita";

function baseVisita(overrides: Record<string, unknown> = {}) {
  return {
    clientLocalId: "5f1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a",
    beneficiarioNome: "Maria da Silva",
    beneficiarioCpf: "529.982.247-25",
    beneficiarioEndereco: "Sítio Boa Esperança, s/n",
    municipio: "Bom Jesus",
    finalidadeDetalhada: "Compra de insumos agrícolas conforme proposta.",
    dataVisita: "2026-03-10",
    purposeIds: ["ckv1x0000000000000000000"],
    outroFinalidadeDescricao: null,
    aplicandoConforme: true,
    aplicandoConformeJustificativa: null,
    teveDesafio: false,
    desafioDescricao: null,
    assistenciaTecnica: false,
    assistenciaPeriodicidade: null,
    assistenciaMotivoNegativa: "Não solicitou acompanhamento.",
    tecnicoNomeContato: "João Técnico - (11) 99999-0000",
    pontoReferencia: false,
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

  it("exige justificativa quando não está aplicando conforme a proposta", () => {
    const result = visitaSchema.safeParse(baseVisita({ aplicandoConforme: false, aplicandoConformeJustificativa: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "aplicandoConformeJustificativa")).toBe(true);
    }
  });

  it("aceita aplicandoConforme=false quando a justificativa é informada", () => {
    const result = visitaSchema.safeParse(baseVisita({ aplicandoConforme: false, aplicandoConformeJustificativa: "Mudou de atividade." }));
    expect(result.success).toBe(true);
  });

  it("exige descrição do desafio quando teveDesafio é true", () => {
    const result = visitaSchema.safeParse(baseVisita({ teveDesafio: true, desafioDescricao: null }));
    expect(result.success).toBe(false);
  });

  it("exige periodicidade quando assistenciaTecnica é true", () => {
    const result = visitaSchema.safeParse(baseVisita({ assistenciaTecnica: true, assistenciaPeriodicidade: null }));
    expect(result.success).toBe(false);
  });

  it("exige motivo quando assistenciaTecnica é false", () => {
    const result = visitaSchema.safeParse(baseVisita({ assistenciaTecnica: false, assistenciaMotivoNegativa: null }));
    expect(result.success).toBe(false);
  });

  it("exige ao menos uma finalidade selecionada", () => {
    const result = visitaSchema.safeParse(baseVisita({ purposeIds: [] }));
    expect(result.success).toBe(false);
  });

  it("exige nome e contato do técnico", () => {
    const result = visitaSchema.safeParse(baseVisita({ tecnicoNomeContato: "" }));
    expect(result.success).toBe(false);
  });
});
