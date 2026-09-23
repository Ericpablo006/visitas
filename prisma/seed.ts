// Cria o administrador, um técnico de exemplo e a lista de finalidades do
// crédito. Idempotente: pode ser rodado de novo sem duplicar nada.
//
// IMPORTANTE: a wording abaixo das ~46 finalidades é um PLACEHOLDER — a
// Tabôa deve revisar/ajustar em Admin → Finalidades (ou editando este
// array) com a lista oficial usada pelo programa de crédito. A tabela é
// editável pelo painel justamente para não depender de um novo deploy.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();

const FINALIDADES: string[] = [
  "Aquisição de sementes",
  "Aquisição de mudas",
  "Aquisição de insumos agrícolas (adubo, calcário)",
  "Aquisição de ferramentas manuais",
  "Aquisição de equipamentos agrícolas de pequeno porte",
  "Aquisição de irrigação (mangueiras, aspersores, bombas)",
  "Construção de cisterna",
  "Construção/reforma de curral",
  "Construção/reforma de galinheiro",
  "Construção/reforma de chiqueiro",
  "Aquisição de animais de pequeno porte (aves, suínos)",
  "Aquisição de animais de médio porte (caprinos, ovinos)",
  "Aquisição de bovinos de leite",
  "Aquisição de bovinos de corte",
  "Ração e suplementação animal",
  "Vacinas e insumos veterinários",
  "Cerca e arame para pastagem",
  "Recuperação de pastagem",
  "Produção de mel (apicultura)",
  "Produção de artesanato",
  "Compra de matéria-prima para artesanato",
  "Máquina de costura",
  "Compra de insumos para padaria/confeitaria",
  "Equipamento de cozinha comunitária",
  "Compra de freezer/geladeira para comércio",
  "Reforma de ponto comercial",
  "Compra de mercadoria para revenda",
  "Capital de giro para pequeno comércio",
  "Compra de carrinho/banca para feira",
  "Compra de bicicleta de carga",
  "Compra de motocicleta para trabalho",
  "Reforma de veículo de trabalho",
  "Compra de painel solar / energia alternativa",
  "Poço artesiano / captação de água",
  "Sistema de irrigação por gotejamento",
  "Produção de hortaliças",
  "Produção de frutas",
  "Beneficiamento de produtos agrícolas",
  "Compra de embalagens para venda de produtos",
  "Participação em feiras e eventos",
  "Transporte da produção até o ponto de venda",
  "Reforma de residência (melhoria habitacional produtiva)",
  "Instalação de banheiro/saneamento básico",
  "Compra de computador/celular para o negócio",
  "Capacitação/curso técnico",
  "Regularização documental do negócio (MEI, licenças)",
  "Outros investimentos produtivos",
];

// Por padrão o seed NUNCA sobrescreve o admin/técnico já criados (evita apagar uma senha
// que alguém já trocou em "Meu perfil"). Defina SEED_RESET_PASSWORDS=true temporariamente
// (variável de ambiente) só quando precisar forçar a senha destes dois usuários de volta
// para ADMIN_PASSWORD/TECNICO_PASSWORD — remova a variável depois de rodar.
const resetPasswords = process.env.SEED_RESET_PASSWORDS === "true";

async function main() {
  const adminName = process.env.ADMIN_NAME || "Administrador Tabôa";
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@localhost.dev").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "TrocarSenha!123";

  const tecnicoName = process.env.TECNICO_NAME || "Técnico de Campo";
  const tecnicoEmail = (process.env.TECNICO_EMAIL || "tecnico@localhost.dev").toLowerCase();
  const tecnicoPassword = process.env.TECNICO_PASSWORD || "TrocarSenha!123";

  await db.user.upsert({
    where: { email: adminEmail },
    update: resetPasswords ? { passwordHash: await hashPassword(adminPassword) } : {},
    create: { name: adminName, email: adminEmail, passwordHash: await hashPassword(adminPassword), role: "ADMIN" },
  });
  console.log(`✔ Administrador: ${adminEmail}${resetPasswords ? " (senha redefinida)" : ""}`);

  await db.user.upsert({
    where: { email: tecnicoEmail },
    update: resetPasswords ? { passwordHash: await hashPassword(tecnicoPassword) } : {},
    create: { name: tecnicoName, email: tecnicoEmail, passwordHash: await hashPassword(tecnicoPassword), role: "TECNICO", matricula: "T-0001" },
  });
  console.log(`✔ Técnico de exemplo: ${tecnicoEmail}${resetPasswords ? " (senha redefinida)" : ""}`);

  for (const [i, label] of FINALIDADES.entries()) {
    await db.purpose.upsert({
      where: { id: `finalidade-${i + 1}` },
      update: { label, sortOrder: i },
      create: { id: `finalidade-${i + 1}`, label, sortOrder: i },
    });
  }
  console.log(`✔ ${FINALIDADES.length} finalidades de crédito cadastradas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
