import { PrismaClient } from "@prisma/client";

// A integração Supabase da Vercel injeta a connection string com um prefixo
// próprio (ex.: ARMAZENAr_POSTGRES_PRISMA_URL) em vez de DATABASE_URL — e,
// como é um valor "Secret", não dá pra copiar o valor de volta pela CLI/dashboard.
// Em vez de copiar, preferimos a variável da integração quando ela existir,
// sem mexer no valor de DATABASE_URL usado em desenvolvimento local.
const prismaUrlFromIntegration = Object.entries(process.env).find(
  ([key, value]) => key.endsWith("_POSTGRES_PRISMA_URL") && value,
)?.[1];
if (prismaUrlFromIntegration) {
  process.env.DATABASE_URL = prismaUrlFromIntegration;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma usa consultas parametrizadas: protege contra SQL Injection.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
