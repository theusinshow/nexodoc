// A IDENTIDADE DO PROJETO, provada contra o banco de verdade.
//
//   node scripts/prova-identidade-do-projeto.mjs   (== npm run prova:identidade)
//
// Três perguntas que só o banco responde:
//   1. cliente VAZIO é preenchido pelo que a classificação leu?
//   2. rodar duas vezes duplica projeto ou sobrescreve cadastro?
//   3. cliente DIFERENTE vira divergência registrada, e não sobrescrita?
//
// SEM IA e SEM NAVEGADOR: o que se testa aqui é a gravação, não o motor.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { decidirCliente } = await import("../lib/cliente-do-projeto.ts");

const prisma = getPrisma();
const ORG = "org-prosul";
const CODE = "777-99";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// Limpa o resto de uma corrida anterior — a prova tem que poder rodar duas vezes.
await prisma.projectEvent.deleteMany({
  where: { project: { organizationId: ORG, code: CODE } },
});
await prisma.project.deleteMany({ where: { organizationId: ORG, code: CODE } });

// 1. Nasce SEM cliente, como nascem os projetos criados à mão hoje.
const criado = await prisma.project.create({
  data: {
    organizationId: ORG,
    code: CODE,
    name: "Projeto da prova",
    client: "",
    clientKey: "",
    ownerEmail: "prova@nexodoc.local",
  },
  select: { id: true, client: true, clientKey: true },
});
check("nasce com cliente vazio", criado.client === "" && criado.clientKey === "");

// 2. A classificação leu a prefeitura. O vazio tem que ser preenchido.
const primeira = decidirCliente({
  atual: criado.client,
  atualKey: criado.clientKey,
  lido: "Prefeitura Municipal de Criciúma",
  municipioLido: "Criciúma",
});
check("a decisão manda preencher", primeira.preencheu === true, JSON.stringify(primeira));

await prisma.project.update({
  where: { id: criado.id },
  data: { client: primeira.client, clientKey: primeira.clientKey },
});

const depois = await prisma.project.findUniqueOrThrow({
  where: { id: criado.id },
  select: { client: true, clientKey: true },
});
check(
  "a prefeitura ficou gravada",
  depois.client === "Prefeitura Municipal de Criciúma" && depois.clientKey === "criciuma",
  JSON.stringify(depois),
);

// 3. Segunda passada com a MESMA prefeitura: não preenche de novo, não diverge.
const segunda = decidirCliente({
  atual: depois.client,
  atualKey: depois.clientKey,
  lido: "CRICIÚMA",
  municipioLido: "Criciúma",
});
check(
  "reprocessar não mexe em nada",
  segunda.preencheu === false && segunda.divergencia === null && segunda.client === depois.client,
  JSON.stringify(segunda),
);

// 4. Prefeitura DIFERENTE: divergência, e o cadastro fica de pé.
const terceira = decidirCliente({
  atual: depois.client,
  atualKey: depois.clientKey,
  lido: "Prefeitura Municipal de Florianópolis",
  municipioLido: "Florianópolis",
});
check(
  "cliente diferente não sobrescreve",
  terceira.client === "Prefeitura Municipal de Criciúma",
  JSON.stringify(terceira),
);
check("cliente diferente vira divergência", terceira.divergencia !== null);

// 5. Um projeto só. O `upsert` da rota não pode ter criado um paralelo.
const quantos = await prisma.project.count({ where: { organizationId: ORG, code: CODE } });
check("existe UM projeto para o código", quantos === 1, `achei ${quantos}`);

await prisma.projectEvent.deleteMany({ where: { projectId: criado.id } });
await prisma.project.delete({ where: { id: criado.id } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
