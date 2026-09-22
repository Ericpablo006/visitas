// Sobe um PostgreSQL 100% local para DESENVOLVIMENTO, sem instalar nada.
// Uso: npm run db:local   (deixe rodando em um terminal)
// Os dados ficam em ~/.taboa-db (fora do projeto, para não disparar o hot-reload do Next
// nem ir parar no git). Para mudar: LOCAL_DB_DIR=/outro/caminho npm run db:local
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const dir = path.resolve(process.env.LOCAL_DB_DIR || path.join(os.homedir(), ".taboa-db"));
const port = Number(process.env.LOCAL_DB_PORT || 5488);
const user = "taboa";
const password = "taboa_dev_password";
const database = "taboa";

const pg = new EmbeddedPostgres({
  databaseDir: dir,
  user,
  password,
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
});

const fresh = !existsSync(path.join(dir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase(database);

console.log(`\nPostgreSQL local pronto na porta ${port}.`);
console.log(`DATABASE_URL="postgresql://${user}:${password}@127.0.0.1:${port}/${database}?schema=public"\n`);
console.log("Deixe esta janela aberta. Ctrl+C para parar.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
