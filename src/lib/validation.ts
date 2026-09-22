import { z } from "zod";
import { isValidCPF, onlyDigits } from "@/lib/cpf";

// Mensagens de erro em português para todo o sistema.
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" || issue.received === "null" ? "Campo obrigatório." : "Valor inválido." };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string")
        return { message: issue.minimum === 1 ? "Campo obrigatório." : `Use pelo menos ${issue.minimum} caracteres.` };
      if (issue.type === "array") return { message: `Informe pelo menos ${issue.minimum}.` };
      return { message: `O valor mínimo é ${issue.minimum}.` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") return { message: `Use no máximo ${issue.maximum} caracteres.` };
      return { message: `O valor máximo é ${issue.maximum}.` };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") return { message: "E-mail inválido." };
      if (issue.validation === "uuid") return { message: "Identificador inválido." };
      return { message: "Formato inválido." };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Opção inválida." };
    default:
      return { message: ctx.defaultError };
  }
});

export const zEmail = z.string().trim().toLowerCase().min(1).max(190).email();

export const zPassword = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Use letras e números na senha.");

export const zName = z.string().trim().min(2, "Informe o nome.").max(120);

export const zCpf = z
  .string()
  .trim()
  .refine(isValidCPF, "CPF inválido.")
  .transform(onlyDigits);

/** Texto opcional: aceita string, null ou ausente (undefined) — vazio vira null. */
export const zOptText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const zInt = (min: number, max: number) => z.coerce.number().int().min(min).max(max);
export const zIntOptional = (min: number, max: number) =>
  z.coerce
    .number()
    .int()
    .min(min)
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v === undefined ? null : v));

/** Campo de dinheiro digitado ("1.500,00") → centavos. Opcional: vazio → null. */
export const zMoneyOptional = z
  .union([z.string(), z.number()])
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (v === undefined || v === null || v === "") return null;
    const asString = typeof v === "number" ? String(v) : v;
    const normalized = asString.trim().replace(/\./g, "").replace(",", ".");
    const cents = Math.round(Number(normalized) * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor inválido." });
      return z.NEVER;
    }
    return cents;
  });

export const zDateInput = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");
