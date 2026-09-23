// Cria o administrador, um técnico de exemplo e a lista de finalidades do
// crédito. Idempotente: pode ser rodado de novo sem duplicar nada.
//
// Lista oficial da Tabôa ("Modelo formulário visita pós crédito") — ordem
// preservada de propósito (é a mesma ordem impressa no formulário em papel,
// em 3 colunas), para que o PDF gerado bata visualmente com o original.
// "Outro" é o único item com campo de texto livre (ver Visita.outroFinalidadeDescricao).
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

const FINALIDADES: string[] = [
  "Adubação",
  "Aipim",
  "Análise de solo",
  "Aquisição Micro trator",
  "Área nova de cacau",
  "Avicultura",
  "Balizamento",
  "Bomba d'água",
  "Calcário",
  "Cerca",
  "Clonagem",
  "Cocho",
  "Construção barcaça",
  "Construção Viveiro",
  "Criação de peixes",
  "Desbrota",
  "Desidratador",
  "Energia solar",
  "Enxertia",
  "Esterco",
  "Estufa Cacau",
  "Gesso",
  "Hortaliças",
  "Irrigação",
  "Limpeza",
  "Mão-de-obra",
  "Maracujá",
  "Meliponicultura",
  "Motor foliar",
  "Motor Serra",
  "Mudas banana",
  "Mudas cacau",
  "Ovino",
  "Pó de rocha",
  "Poda",
  "Pulverizador a motor",
  "Pulverizador manual",
  "Ração",
  "Raleamento",
  "Reforma barcaça",
  "Replantio",
  "Roçadeira",
  "Roçagem",
  "SAF",
  "Secador",
  "Suíno",
  "Trator (hora)",
];
const OUTRO_LABEL = "Outro";

// Por padrão o seed NUNCA sobrescreve o admin/técnico já criados (evita apagar uma senha
// que alguém já trocou em "Meu perfil"). Defina SEED_RESET_PASSWORDS=true temporariamente
// (variável de ambiente) só quando precisar forçar a senha destes dois usuários de volta
// para ADMIN_PASSWORD/TECNICO_PASSWORD — remova a variável depois de rodar.
const resetPasswords = process.env.SEED_RESET_PASSWORDS?.trim() === "true";

// CLIs/terminais às vezes gravam a variável com uma quebra de linha grudada no valor
// (ex.: `"senha" | vercel env add ...` no PowerShell) — isso faria o hash bater com
// "senha\n" e nenhum login com a senha "limpa" funcionaria nunca. Sempre `.trim()`.
const env = (key: string, fallback: string) => (process.env[key]?.trim() || fallback);

async function main() {
  // SUPER_ADMIN não pertence a empresa nenhuma — é quem cadastra as empresas em Admin → Empresas.
  const superAdminEmail = env("SUPER_ADMIN_EMAIL", "super@localhost.dev").toLowerCase();
  const superAdminPassword = env("SUPER_ADMIN_PASSWORD", "TrocarSenha!123");
  await db.user.upsert({
    where: { email: superAdminEmail },
    update: resetPasswords ? { passwordHash: await hashPassword(superAdminPassword) } : {},
    create: { name: "Super Admin", email: superAdminEmail, passwordHash: await hashPassword(superAdminPassword), role: "SUPER_ADMIN" },
  });
  console.log(`✔ Super admin: ${superAdminEmail}${resetPasswords ? " (senha redefinida)" : ""}`);

  // Empresa padrão (a própria Tabôa) — os dados já existentes no banco antes do multi-empresa
  // foram migrados para cá. `update: {}` preserva nome/logo se alguém já ajustou pelo painel.
  const empresaTaboa = await db.empresa.upsert({
    where: { id: "empresa-taboa" },
    update: {},
    create: { id: "empresa-taboa", nome: "Tabôa – Fortalecimento Comunitário" },
  });

  const adminName = env("ADMIN_NAME", "Administrador Tabôa");
  const adminEmail = env("ADMIN_EMAIL", "admin@localhost.dev").toLowerCase();
  const adminPassword = env("ADMIN_PASSWORD", "TrocarSenha!123");

  const tecnicoName = env("TECNICO_NAME", "Técnico de Campo");
  const tecnicoEmail = env("TECNICO_EMAIL", "tecnico@localhost.dev").toLowerCase();
  const tecnicoPassword = env("TECNICO_PASSWORD", "TrocarSenha!123");

  await db.user.upsert({
    where: { email: adminEmail },
    update: resetPasswords ? { passwordHash: await hashPassword(adminPassword) } : {},
    create: { empresaId: empresaTaboa.id, name: adminName, email: adminEmail, passwordHash: await hashPassword(adminPassword), role: "ADMIN" },
  });
  console.log(`✔ Administrador: ${adminEmail}${resetPasswords ? " (senha redefinida)" : ""}`);

  await db.user.upsert({
    where: { email: tecnicoEmail },
    update: resetPasswords ? { passwordHash: await hashPassword(tecnicoPassword) } : {},
    create: { empresaId: empresaTaboa.id, name: tecnicoName, email: tecnicoEmail, passwordHash: await hashPassword(tecnicoPassword), role: "TECNICO", matricula: "T-0001" },
  });
  console.log(`✔ Técnico de exemplo: ${tecnicoEmail}${resetPasswords ? " (senha redefinida)" : ""}`);

  for (const [i, label] of FINALIDADES.entries()) {
    await db.purpose.upsert({
      where: { id: `finalidade-${i + 1}` },
      update: { label, sortOrder: i },
      create: { id: `finalidade-${i + 1}`, empresaId: empresaTaboa.id, label, sortOrder: i },
    });
  }
  const outroId = `finalidade-${FINALIDADES.length + 1}`;
  await db.purpose.upsert({
    where: { id: outroId },
    update: { label: OUTRO_LABEL, sortOrder: FINALIDADES.length, isOutro: true },
    create: { id: outroId, empresaId: empresaTaboa.id, label: OUTRO_LABEL, sortOrder: FINALIDADES.length, isOutro: true },
  });
  console.log(`✔ ${FINALIDADES.length + 1} finalidades de crédito cadastradas (incl. "Outro").`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
