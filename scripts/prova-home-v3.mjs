// A HOME, MEDIDA — e não olhada.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-home-v3.mjs
//   (== npm run prova:home)
//
// A queixa era "a home está bagunçada". Isto a transforma em números: quantos
// px de instrução antes do primeiro trabalho, quantos cartões nascem
// expandidos, e se a cidade aparece.
//
// SEMEIA O ESTADO que a home precisa ter para ser medida: um achado PARA o
// Victor e dois que ele mandou. Sem isso a medição depende do que sobrou de
// outras provas, e um número que muda sozinho não mede nada.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { atribuirAchados } = await import("../lib/fila-de-achados.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const ORG = "org-prosul";
const prisma = getPrisma();

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: ORG }, report: { not: null } },
  select: { id: true, report: true },
});
check("existe auditoria com parecer", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const ids = audit.report.incongruencias.slice(0, 3).map((x) => x.id);
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id } });

await atribuirAchados({
  auditId: audit.id,
  findingIds: [ids[0]],
  assigneeEmail: "victor@prosul.com",
  assigneeNome: "Victor",
  organizationId: ORG,
  atribuidoPor: { id: null, email: "milton@prosul.com" },
});
await atribuirAchados({
  auditId: audit.id,
  findingIds: ids.slice(1),
  assigneeEmail: "milton@prosul.com",
  assigneeNome: "Milton",
  organizationId: ORG,
  atribuidoPor: { id: null, email: "victor@prosul.com" },
});

const navegador = await chromium.launch();
const ctx = await navegador.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 1000 },
});
const pg = await ctx.newPage();
await entrarComo(pg, "victor@prosul.com");
await pg.goto("/", { waitUntil: "networkidle" });
await pg.waitForTimeout(4000);

/*
 * A MEDIDA QUE VIROU A QUEIXA EM NÚMERO: do topo da página até o primeiro
 * cartão de projeto.
 *
 * O ANTES É 473px, MEDIDO — e não estimado. A primeira versão desta prova
 * afirmava "~290px", que era um palpite meu olhando uma captura: eu tinha
 * contado o orbe, a legenda e o parágrafo, e esquecido o cartão de retomada e o
 * título da seção. A prova reprovava a melhora por comparar com um número que
 * ninguém mediu.
 *
 * O teto abaixo é 473 menos uma folga: se algum dia a dobra voltar a crescer
 * até lá, é regressão.
 */
const ANTES_MEDIDO = 473;
const topoDoTrabalho = await pg.evaluate(() => {
  const cartao = document.querySelector("[data-cartao-de-projeto]");
  return cartao ? Math.round(cartao.getBoundingClientRect().top) : -1;
});
console.log(`\n  px de instrução antes do primeiro projeto: ${topoDoTrabalho}\n`);
check("há um cartão de projeto na tela", topoDoTrabalho > 0, `medi ${topoDoTrabalho}`);
check(
  `o trabalho começa mais alto do que os ${ANTES_MEDIDO}px medidos antes`,
  topoDoTrabalho > 0 && topoDoTrabalho < ANTES_MEDIDO,
  `${topoDoTrabalho}px contra ${ANTES_MEDIDO}px`,
);

const expandidos = await pg.evaluate(
  () => document.querySelectorAll('[data-cartao-de-projeto] [aria-expanded="true"]').length,
);
/*
 * EXATAMENTE UM, e não "no máximo um".
 *
 * A semeadura acima deu ao Victor um achado PARA ele, então o desenho manda o
 * cartão do topo nascer aberto. `<= 1` passaria com ZERO — e zero é o defeito
 * oposto, em que a regra de abertura parou de funcionar sem ninguém notar.
 */
check("EXATAMENTE um cartão nasce expandido, e é o que espera você", expandidos === 1, `achei ${expandidos}`);

const marcas = await pg.evaluate(
  () => document.querySelectorAll('[data-marca-de-prefeitura="selo"]').length,
);
check("a marca da cidade aparece nos cartões", marcas > 0, `achei ${marcas}`);

const legendaVazia = await pg
  .getByText("As outras pastas em que você mexer aparecem aqui")
  .count();
check(
  "não há coluna reservada só para dizer que está vazia",
  legendaVazia === 0,
  `achei ${legendaVazia}`,
);

// O resumo diz COM QUEM, e não "com outros"?
const comOutros = await pg.getByText("com outros").count();
check("o resumo não diz mais 'com outros'", comOutros === 0, `achei ${comOutros}`);

const cabecalho = pg.locator("[data-cartao-de-projeto] button[aria-expanded]").first();
const antes = await cabecalho.getAttribute("aria-expanded");
await cabecalho.click();
await pg.waitForTimeout(500);
const depois = await cabecalho.getAttribute("aria-expanded");
check("o cartão continua abrindo e fechando", antes !== depois, `${antes} → ${depois}`);

await pg.screenshot({ path: "prova-home-v3.png" });
console.log("\nprova-home-v3.png");

await navegador.close();
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
