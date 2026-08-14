// O que colide quando o dono do projeto vira o escritório.
//
//   node scripts/diagnostico-de-centros-de-custo.ts   (== npm run diag:cc)
//
// POR QUE ISTO VEM ANTES DO BACKFILL
//
// O schema declarava `code String @default("")` com @@unique([ownerEmail, code]).
// Isso permite UM projeto sem código POR DONO. Juntando todos os donos numa
// organização, o unique novo (@@unique([organizationId, code])) admite um
// projeto sem código NA PROSUL INTEIRA — e todos os outros quebram a migration.
// O mesmo vale para dois donos que cadastraram "099-25" cada um.
//
// Não é hipótese: é a consequência aritmética de juntar donos. Quantos são, só o
// banco diz. Este script diz ANTES, com os nomes na tela — e não pelo erro do
// Postgres às três da manhã, no meio de um deploy.
//
// Não altera nada. Sai com código 1 quando há colisão, para que rodá-lo dentro
// de um `&&` impeça o passo seguinte por conta própria.
// `@next/env` é CommonJS, e o import nomeado quebra fora do empacotador. Import
// padrão e desestruturação depois é o que atravessa os dois mundos — o mesmo
// motivo pelo qual `lib/db.ts` só é carregado DEPOIS de o `.env` estar lido:
// ele resolve a URL do banco no momento em que é importado.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const prisma = getPrisma();
const projetos = await prisma.project.findMany({
  where: { deletedAt: null },
  select: { id: true, code: true, name: true, ownerEmail: true },
  orderBy: { code: "asc" },
});

const semCodigo = projetos.filter((p) => !p.code.trim());

const porCodigo = new Map<string, typeof projetos>();
for (const p of projetos) {
  const chave = p.code.trim().toLocaleUpperCase("pt-BR");
  if (!chave) continue;
  porCodigo.set(chave, [...(porCodigo.get(chave) ?? []), p]);
}
const repetidos = [...porCodigo.entries()].filter(([, lista]) => lista.length > 1);

console.log(`projetos vivos: ${projetos.length}`);
console.log(`sem centro de custo: ${semCodigo.length}`);
for (const p of semCodigo) console.log(`  · ${p.name} — ${p.ownerEmail} (${p.id})`);

console.log(`centros de custo repetidos entre donos: ${repetidos.length}`);
for (const [codigo, lista] of repetidos) {
  console.log(`  · ${codigo}`);
  for (const p of lista) console.log(`      ${p.name} — ${p.ownerEmail} (${p.id})`);
}

/*
 * UM projeto sem código passa: o unique novo comporta exatamente um. Dois já
 * quebram, e é por isso que o limite é `> 1` e não `> 0`.
 */
const bloqueia = semCodigo.length > 1 || repetidos.length > 0;
console.log(
  bloqueia
    ? "\nBLOQUEIA: resolva antes do passo 2. Nada foi alterado."
    : "\nLIVRE: o backfill pode rodar.",
);
process.exit(bloqueia ? 1 : 0);
