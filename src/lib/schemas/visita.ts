import { z } from "zod";
import { RespostaSimNao } from "@prisma/client";
import { zCpf, zDateInput, zInt, zIntOptional, zMoneyOptional, zName, zOptText } from "@/lib/validation";

const zResposta = z.nativeEnum(RespostaSimNao);

/**
 * Schema único das 6 etapas do formulário (o wizard web e o app Android
 * enviam o mesmo formato ao finalizar cada etapa localmente — o servidor
 * só valida a visita completa na criação/edição).
 */
export const visitaSchema = z
  .object({
    clientLocalId: z.string().uuid("Identificador local inválido."),

    // Etapa 1 — identificação
    beneficiarioNome: zName,
    beneficiarioCpf: zCpf,
    beneficiarioEndereco: z.string().trim().min(3, "Informe o endereço.").max(300),
    municipio: z.string().trim().min(2, "Informe o município.").max(120),
    dataVisita: zDateInput,

    // Etapa 2 — finalidades do crédito (o id não precisa ser cuid — a
    // existência/atividade real é conferida contra o banco na rota).
    purposeIds: z.array(z.string().min(1)).min(1, "Selecione ao menos uma finalidade."),

    // Etapa 3 — perguntas 7 a 13
    pergunta7Resposta: zResposta,
    pergunta7Justificativa: zOptText(1000),

    pergunta8Resposta: zResposta,

    pergunta9Resposta: zResposta,
    pergunta9QuantidadeEmpregos: zIntOptional(0, 999),
    pergunta9RendaEstimadaCents: zMoneyOptional,

    pergunta10Resposta: zResposta,
    pergunta10MotivoParalisacao: zOptText(1000),

    pergunta11Resposta: zResposta,
    pergunta11ParcelasAtrasadas: zIntOptional(0, 999),

    pergunta12Resposta: zResposta,
    pergunta12Dificuldades: zOptText(1000),

    pergunta13Resposta: zResposta,
    pergunta13Motivo: zOptText(1000),

    // Etapa 4 — observações
    observacoes: zOptText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.pergunta7Resposta !== "SIM" && !v.pergunta7Justificativa) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta7Justificativa"], message: "Justifique a resposta." });
    }
    if (v.pergunta9Resposta === "SIM" && v.pergunta9QuantidadeEmpregos === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta9QuantidadeEmpregos"], message: "Informe a quantidade de empregos gerados." });
    }
    if (v.pergunta10Resposta === "NAO" && !v.pergunta10MotivoParalisacao) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta10MotivoParalisacao"], message: "Informe o motivo da paralisação." });
    }
    if (v.pergunta11Resposta !== "NAO" && v.pergunta11ParcelasAtrasadas === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta11ParcelasAtrasadas"], message: "Informe quantas parcelas estão em atraso." });
    }
    if ((v.pergunta12Resposta === "SIM" || v.pergunta12Resposta === "PARCIAL") && !v.pergunta12Dificuldades) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta12Dificuldades"], message: "Descreva as dificuldades enfrentadas." });
    }
    if (v.pergunta13Resposta === "NAO" && !v.pergunta13Motivo) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta13Motivo"], message: "Informe o motivo." });
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
