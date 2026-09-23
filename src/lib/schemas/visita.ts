import { z } from "zod";
import { zCpf, zDateInput, zInt, zName, zOptText } from "@/lib/validation";

/**
 * Schema único das etapas do formulário — segue exatamente a numeração do
 * documento oficial da Tabôa ("Modelo formulário visita pós crédito"). O
 * wizard web e o app Android enviam o mesmo formato; o servidor só valida a
 * visita completa na criação/edição.
 */
export const visitaSchema = z
  .object({
    clientLocalId: z.string().uuid("Identificador local inválido."),

    // 1-4 — identificação
    beneficiarioNome: zName,
    beneficiarioCpf: zCpf,
    beneficiarioEndereco: z.string().trim().min(3, "Informe o endereço.").max(300),
    municipio: z.string().trim().min(2, "Informe o município.").max(120),

    // 5 — finalidade do crédito (itens detalhados da proposta)
    finalidadeDetalhada: z.string().trim().min(3, "Descreva a finalidade do crédito.").max(2000),

    // 6 — data
    dataVisita: zDateInput,

    // 7 — está aplicando o recurso conforme a proposta?
    aplicandoConforme: z.boolean(),
    aplicandoConformeJustificativa: zOptText(1000),

    // 8 — finalidades já aplicadas (checklist) + "Outro" com descrição livre
    purposeIds: z.array(z.string().min(1)).min(1, "Selecione ao menos uma finalidade."),
    outroFinalidadeDescricao: zOptText(300),

    // 9 — desafio na aplicação do recurso?
    teveDesafio: z.boolean(),
    desafioDescricao: zOptText(1000),

    // 10/11 — assistência técnica após o crédito
    assistenciaTecnica: z.boolean(),
    assistenciaPeriodicidade: zOptText(200),
    assistenciaMotivoNegativa: zOptText(1000),

    // 12 — nome e contato telefônico do técnico que acompanha
    tecnicoNomeContato: z.string().trim().min(2, "Informe o nome e contato do técnico.").max(200),

    // 13 — já tem ponto de referência da área financiada?
    pontoReferencia: z.boolean(),

    // 15 — observações
    observacoes: zOptText(2000),
  })
  .superRefine((v, ctx) => {
    if (!v.aplicandoConforme && !v.aplicandoConformeJustificativa) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["aplicandoConformeJustificativa"], message: "Justifique a resposta." });
    }
    if (v.teveDesafio && !v.desafioDescricao) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["desafioDescricao"], message: "Descreva o desafio enfrentado." });
    }
    if (v.assistenciaTecnica && !v.assistenciaPeriodicidade) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assistenciaPeriodicidade"], message: "Informe a periodicidade." });
    }
    if (!v.assistenciaTecnica && !v.assistenciaMotivoNegativa) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["assistenciaMotivoNegativa"], message: "Informe o motivo." });
    }
  });

export type VisitaInput = z.infer<typeof visitaSchema>;

export const fotoMetaSchema = z.object({
  clientLocalId: z.string().uuid(),
  legenda: zOptText(200),
  ordem: zInt(0, 999).default(0),
});

export const assinaturaMetaSchema = z
  .object({
    clientLocalId: z.string().uuid(),
    tipo: z.enum(["TECNICO", "BENEFICIARIO_DESENHO", "BENEFICIARIO_DIGITAL"]),
    testemunhaNome: zOptText(120),
    testemunhaCpf: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.replace(/\D/g, "") : null)),
  })
  .superRefine((v, ctx) => {
    if (v.tipo === "BENEFICIARIO_DIGITAL" && !v.testemunhaNome) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["testemunhaNome"], message: "Informe o nome da testemunha." });
    }
  });
