// Build usado na Vercel: resolve a DATABASE_URL certa (integrações tipo Supabase
// injetam algo como ARMAZENAr_POSTGRES_PRISMA_URL em vez de DATABASE_URL — e por
// ser "Secret" não dá pra copiar o valor manualmente), aplica as migrations
// pendentes no banco e só então builda o Next.js. Local (`npm run dev`/`npm run
// build` na sua máquina) usa a DATABASE_URL do .env normalmente — este script
// só entra em ação quando existe uma variável de integração para preferir.
import { execSync } from "node:child_process";

const pooledKey = Object.keys(process.env).find((k) => k.endsWith("_POSTGRES_PRISMA_URL") && process.env[k]);
if (pooledKey) {
  console.log(`[vercel-build] Usando DATABASE_URL de ${pooledKey} (integração de storage).`);
  process.env.DATABASE_URL = process.env[pooledKey];
}

// Migrations precisam de conexão DIRETA (sem PgBouncer) — Supabase expõe as duas.
// Sem uma variável "non pooling", cai de volta para DATABASE_URL (funciona em
// desenvolvimento local, onde não existe pooler).
const directKey = Object.keys(process.env).find((k) => k.endsWith("_POSTGRES_URL_NON_POOLING") && process.env[k]);
if (directKey) {
  console.log(`[vercel-build] Usando DIRECT_URL de ${directKey} (conexão direta para migrations).`);
  process.env.DIRECT_URL = process.env[directKey];
} else if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

function run(cmd) {
  console.log(`[vercel-build] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

run("prisma generate");
run("prisma migrate deploy");
run("next build");
