// Carrega .env para os testes que precisam de DATABASE_URL (idempotência,
// sequência de finalização). Evita depender do pacote `dotenv` — parser mínimo.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const envPath = path.resolve(__dirname, "../.env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!match) continue;
    const key = match[1];
    const rawValue = match[2];
    if (!key || rawValue === undefined || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^"(.*)"$/, "$1");
  }
}
