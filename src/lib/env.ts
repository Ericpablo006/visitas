// Acesso centralizado às variáveis de ambiente (somente servidor).
// Os valores são lidos de forma preguiçosa para não quebrar o `next build` sem .env.

export const isProd = () => process.env.NODE_ENV === "production";

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres). Veja o .env.example.");
  }
  return secret;
}

export function getMobileAuthSecret(): string {
  const secret = process.env.MOBILE_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("MOBILE_AUTH_SECRET ausente ou curto demais (mínimo 32 caracteres). Veja o .env.example.");
  }
  return secret;
}

export const appUrl = () => (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

export const useSecureCookies = () => appUrl().startsWith("https://");

export const uploadDir = () => process.env.UPLOAD_DIR || "./storage";
