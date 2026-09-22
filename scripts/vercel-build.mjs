// Build usado na Vercel: resolve a DATABASE_URL certa (integrações tipo Supabase
// injetam algo como ARMAZENAr_POSTGRES_PRISMA_URL em vez de DATABASE_URL — e por
// ser "Secret" não dá pra copiar o valor manualmente), aplica as migrations
// pendentes no banco e só então builda o Next.js. Local (`npm run dev`/`npm run
// build` na sua máquina) usa a DATABASE_URL do .env normalmente — este script
// só entra em ação quando existe uma variável de integração para preferir.
import { execSync } from "node:child_process";

const integrationUrlKey = Object.keys(process.env).find((k) => k.endsWith("_POSTGRES_PRISMA_URL") && process.env[k]);
if (integrationUrlKey) {
  console.log(`[vercel-build] Usando DATABASE_URL de ${integrationUrlKey} (integração de storage).`);
  process.env.DATABASE_URL = process.env[integrationUrlKey];
}

function run(cmd) {
  console.log(`[vercel-build] $ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

run("prisma generate");
run("prisma migrate deploy");
run("next build");
