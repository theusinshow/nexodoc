/**
 * A PLANILHA QUE MEDE PRECISÃO — a metade que nenhum script julga sozinho.
 *
 * Recall já é número (`recall-vs-benchmark.ts`). Precisão não: dizer se um
 * achado é verdadeiro exige ler o memorial, e isso é trabalho de engenheiro.
 * Este script prepara o julgamento — separa o que o benchmark externo confirma
 * (já sabido verdadeiro) do que é SÓ nosso, e imprime cada exclusivo com
 * evidência, página e disciplina, em Markdown com coluna para marcar.
 *
 *   node scripts/planilha-de-precisao.mjs <parecer.json> <benchmark.md> > planilha.md
 *
 * Por que importa: o critério de parada do projeto é "parar de somar camadas
 * quando o falso positivo subir — precisão perdida custa mais que recall ganho
 * num produto que sustenta emissão de projeto". 57 achados contra 15 do
 * concorrente só é vantagem depois desta conta.
 */
import fs from "node:fs";

const [parecerPath, benchPath] = process.argv.slice(2);
if (!parecerPath || !benchPath) {
  console.error("Uso: node scripts/planilha-de-precisao.mjs <parecer.json> <benchmark.md>");
  process.exit(1);
}

function parsePaginas(raw) {
  const out = new Set();
  const txt = String(raw ?? "").replace(/[–—]/g, "-");
  for (const m of txt.matchAll(/(\d{1,4})\s*-\s*(\d{1,4})/g)) {
    const a = Number(m[1]), b = Number(m[2]);
    if (b >= a && b - a < 30) for (let p = a; p <= b; p++) out.add(p);
  }
  for (const m of txt.matchAll(/\d{1,4}/g)) out.add(Number(m[0]));
  return [...out].filter((n) => n > 0 && n < 5000);
}

/* As páginas que o benchmark externo já cobre. Achado nosso que cai numa delas
 * tem uma segunda opinião independente e vai para o fim da fila de conferência. */
const paginasDoBenchmark = new Set();
for (const linha of fs.readFileSync(benchPath, "utf8").split(/\r?\n/)) {
  if (!linha.trim().startsWith("|")) continue;
  const cols = linha.split("|").map((c) => c.trim());
  if (!/^AUD-\d+/i.test(cols[1] ?? "")) continue;
  for (const p of parsePaginas(cols[3] ?? "")) paginasDoBenchmark.add(p);
}

const r = JSON.parse(fs.readFileSync(parecerPath, "utf8")).report;
const achados = r.incongruencias ?? [];

const exclusivos = [];
const corroborados = [];
for (const f of achados) {
  const paginas = parsePaginas(f.pagina);
  (paginas.some((p) => paginasDoBenchmark.has(p)) ? corroborados : exclusivos).push(f);
}

const porDisciplina = new Map();
for (const f of exclusivos) {
  const d = f.disciplina ?? "(sem disciplina)";
  if (!porDisciplina.has(d)) porDisciplina.set(d, []);
  porDisciplina.get(d).push(f);
}

const lim = (s, n) => String(s ?? "").replace(/\s+/g, " ").replace(/\|/g, "\|").slice(0, n);

console.log(`# Planilha de precisão — ${r.arquivo}\n`);
console.log(`Parecer com **${achados.length} achados**. Destes, **${corroborados.length}** caem em página`);
console.log(`que a auditoria externa também apontou (segunda opinião independente) e`);
console.log(`**${exclusivos.length}** são exclusivamente nossos — é a lista abaixo.\n`);
console.log(`Marque a coluna **V/?/F**: verdadeiro, duvidoso, falso.`);
console.log(`Precisão = V / (V + F), contando o duvidoso à parte.\n`);
console.log(`> Regra de leitura: a evidência é transcrição literal do memorial.`);
console.log(`> Se a transcrição não existir no documento, é falso positivo grave —`);
console.log(`> marque F e me avise, porque isso é defeito de extração, não de julgamento.\n`);
console.log(`---\n`);

for (const [d, lista] of [...porDisciplina].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`## ${d} — ${lista.length} achado(s)\n`);
  console.log(`| V/?/F | ID | Pág. | Prio | Achado | Evidência transcrita |`);
  console.log(`|:-:|---|---:|---|---|---|`);
  for (const f of lista) {
    console.log(
      `|  | ${f.id} | ${lim(f.pagina, 12)} | ${lim(f.prioridade, 10)} | **${lim(f.tipo, 60)}** — ${lim(f.descricao, 130)} | ${lim(f.evidencia, 150)} |`,
    );
  }
  console.log();
}

console.log(`---\n`);
console.log(`## Corroborados pela auditoria externa (${corroborados.length}) — conferência opcional\n`);
for (const f of corroborados) {
  console.log(`- ${f.id} p.${lim(f.pagina, 12)} [${f.origem}] ${lim(f.tipo, 70)}`);
}
