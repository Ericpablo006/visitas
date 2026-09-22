import { z } from "zod";

/** Resultado padrão das Server Actions (consumido pelos formulários do painel). */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  redirectTo?: string;
} | null;

export const ok = (message?: string, extra?: { redirectTo?: string }): ActionState => ({ ok: true, message, ...extra });
export const fail = (message: string, errors?: Record<string, string>): ActionState => ({ ok: false, message, errors });

/** FormData → objeto simples (só strings; chaves repetidas viram array). */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of fd.entries()) {
    if (typeof value !== "string") continue;
    if (key.startsWith("$ACTION")) continue;
    if (key in out) {
      const prev = out[key];
      out[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else out[key] = value;
  }
  return out;
}

export function parseForm<T extends z.ZodTypeAny>(
  schema: T,
  fd: FormData,
): { success: true; data: z.output<T> } | { success: false; state: ActionState } {
  const result = schema.safeParse(formDataToObject(fd));
  if (result.success) return { success: true, data: result.data };
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "_";
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, state: fail("Confira os campos destacados.", errors) };
}

function isControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK") || digest === "NEXT_NOT_FOUND");
}

/** Envolve uma action: erros inesperados viram mensagem amigável (sem vazar detalhes internos). */
export async function safely(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    if (isControlFlowError(err)) throw err;
    console.error("[action]", err);
    return fail("Ocorreu um erro inesperado. Tente novamente em instantes.");
  }
}
