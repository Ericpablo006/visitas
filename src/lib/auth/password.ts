import bcrypt from "bcryptjs";

const COST = 12;

/** Hash com bcrypt (salt embutido). Senhas nunca são armazenadas em texto puro. */
export const hashPassword = (plain: string) => bcrypt.hash(plain, COST);

export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

// Hash de fachada (gerado uma vez) para equalizar o tempo de resposta quando o e-mail não existe,
// dificultando a descoberta de e-mails cadastrados.
let dummy: Promise<string> | undefined;
export const burnPasswordCheck = async (plain: string) => {
  dummy ??= bcrypt.hash("dummy-password-for-timing", COST);
  await bcrypt.compare(plain, await dummy);
};
