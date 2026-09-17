// A DATA RENDERIZADA NO SERVIDOR SAI EM BRASÍLIA MESMO COM O SERVIDOR EM UTC.
//
//   TZ=UTC npm run dev                     (noutro terminal — o fuso da Render)
//   node scripts/prova-horario-de-brasilia.mjs
//   (== npm run prova:horario)
//
// 17/09/2026: o banco guarda UTC e o servidor da Render roda em UTC; toda data
// formatada lá saía 3 horas adiantada. A página do projeto é Server Component e
// mostra a data de cada evento — é o lugar onde o defeito aparecia.
//
// A prova pega um evento de projeto real do banco de dev, calcula a data em
// Brasília com o fuso EXPLÍCITO e exige esse texto na página. E exige também que
// a versão em UTC — o defeito — NÃO esteja lá, quando as duas diferem.
import { chromium } from "playwright";
import pg from "pg";
import { readFileSync } from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

const env = readFileSync(".env.local", "utf8");
const url = process.env.DATABASE_URL ?? env.match(/^DATABASE_URL=(.*)$/m)[1].trim();
const db = new pg.Client({ connectionString: url });
await db.connect();
// `::text` e `AT TIME ZONE 'UTC'`: sem isso o `pg` lê `timestamp without time
// zone` no fuso DESTA máquina — foi assim que um "3 horas no futuro" falso
// apareceu na investigação.
const { rows } = await db.query(`
  select e."projectId", (e."createdAt" at time zone 'UTC') as quando
  from "ProjectEvent" e
  order by e."createdAt" desc limit 1`);
await db.end();
check("há evento de projeto no banco de dev", rows.length === 1, "rode npm run seed:dev");
if (rows.length === 0) process.exit(1);

const { projectId, quando } = rows[0];
const opcoes = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };
const emBrasilia = new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: "America/Sao_Paulo" }).format(quando);
const emUtc = new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: "UTC" }).format(quando);
console.log(`  evento em ${quando.toISOString()} → Brasília "${emBrasilia}" · UTC "${emUtc}"`);

const navegador = await chromium.launch();
try {
  const pgn = await (await navegador.newContext({ baseURL: BASE })).newPage();
  await pularTourGuiado(pgn);
  await pgn.goto("/login");
  await pgn.getByRole("button", { name: /Entrar como dev/i }).click();
  await pgn.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 });

  const resposta = await pgn.goto(`/projetos/${projectId}`, { waitUntil: "networkidle" });
  check("a página do projeto abre", resposta?.ok() === true, String(resposta?.status()));
  const texto = await pgn.locator("body").innerText();
  check("a data do evento aparece em Brasília", texto.includes(emBrasilia), emBrasilia);
  if (emBrasilia !== emUtc) {
    check("e NÃO aparece em UTC", !texto.includes(emUtc), emUtc);
  }
} finally {
  await navegador.close();
}
console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
