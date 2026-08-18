/**
 * RECALL DO PARECER CONTRA UM BENCHMARK EXTERNO.
 *
 * Era a peça que faltava (§8 de `docs/analise-arquitetura-auditoria-2026-08-17.md`):
 * `audit-precision-recall.ts` mede só os motores determinísticos contra fixture.
 * Este mede o PARECER COMPLETO — regra + IA — contra a auditoria de um humano ou
 * de outro modelo, que é a pergunta do produto: "somos melhores que o ChatGPT?"
 *
 *   node scripts/recall-vs-benchmark.ts <benchmark.md> <parecer.json>
 *
 * O benchmark é a tabela markdown de achados:
 *   | AUD-001 | CRÍTICA | 37 | Categoria | texto do achado |
 *
 * CASAMENTO: página em comum É OBRIGATÓRIA, e mais uma evidência independente
 * (um número idêntico ou dois termos fortes compartilhados). Página sozinha
 * casaria dois achados distintos que por acaso moram na mesma folha; número
 * sozinho casaria "450" em qualquer lugar do documento. Exigir os dois é o que
 * torna o placar honesto — e ele erra para MENOS, nunca para mais.
 *
 * O que ele NÃO faz: julgar se o achado do benchmark é verdadeiro. Ele mede
 * concordância, não verdade. Achado nosso que não casa vai para "só o NexoDoc",
 * e ali pode estar tanto o ganho quanto o falso positivo — a leitura é humana.
 */
import { readFileSync } from "node:fs";

const [benchPath, parecerPath] = process.argv.slice(2);
if (!benchPath || !parecerPath) {
  console.error("Uso: node scripts/recall-vs-benchmark.ts <benchmark.md> <parecer.json>");
  process.exit(1);
}

/** "21-22", "17 e 21", "99, 100", "207-210" -> [21,22] etc. */
function parsePaginas(raw: string): number[] {
  const out = new Set<number>();
  const txt = String(raw ?? "").replace(/[–—]/g, "-");
  for (const m of txt.matchAll(/(\d{1,4})\s*-\s*(\d{1,4})/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b >= a && b - a < 30) for (let p = a; p <= b; p++) out.add(p);
  }
  for (const m of txt.matchAll(/\d{1,4}/g)) out.add(Number(m[0]));
  return [...out].filter((n) => n > 0 && n < 5000);
}

/**
 * Números "de engenharia": 4.448,91 · 455,81 · 21,08 · 9574 · 2008.
 *
 * Os três ramos são necessários e nenhum cobre o outro:
 *   \d{1,3}(\.\d{3})+(,\d+)?  milhar separado — 4.530,98
 *   \d+,\d+                   decimal puro — 21,08
 *   \d{4,}                    corrida longa sem separador — 9574, 2008
 *
 * O terceiro ramo faltava, e o primeiro comia o começo do número: sobre
 * "NBR 9574:2008" o casador via `957 | 4 | 200 | 8`, descartava os quatro como
 * inteiro curto, e perdia o achado inteiro. Toda edição de norma, ano e cota
 * de 4 dígitos era invisível — silenciosamente, e justo na classe de achado
 * (referência normativa) em que o número É a evidência.
 *
 * Inteiro curto sem decimal continua sendo ruído: numeração de item e página.
 */
function numerosFortes(texto: string): Set<string> {
  const out = new Set<string>();
  for (const m of String(texto).matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+|\d{4,}/g)) {
    const cru = m[0];
    const canon = cru.replace(/\./g, "").replace(",", ".");
    const valor = Number(canon);
    if (!Number.isFinite(valor)) continue;
    if (!cru.includes(",") && valor < 1000) continue;
    out.add(canon);
  }
  return out;
}

const STOP = new Set(
  (
    "de da do das dos e ou em no na nos nas um uma uns umas para por com sem sob sobre entre que qual quais " +
    "o a os as ao aos se seu sua seus suas este esta isso aquele mesmo mesma ser sao foi ter tem " +
    "nao mas como quando onde pagina paginas item itens texto tabela projeto memorial " +
    "achado categoria criticidade alta media baixa critica documento documental"
  ).split(/\s+/),
);

function termosFortes(texto: string): Set<string> {
  const out = new Set<string>();
  const limpo = String(texto)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
  for (const w of limpo.split(/\s+/)) {
    if (w.length < 5 || STOP.has(w)) continue;
    out.add(w);
  }
  return out;
}

function intersecta<T>(a: Set<T>, b: Set<T>) {
  for (const x of a) if (b.has(x)) return true;
  return false;
}
function nInterseccao<T>(a: Set<T>, b: Set<T>) {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

// ---------------------------------------------------------------- benchmark
type Alvo = {
  id: string;
  criticidade: string;
  categoria: string;
  texto: string;
  paginas: number[];
  numeros: Set<string>;
  termos: Set<string>;
};

const bench = readFileSync(benchPath, "utf8");
const alvos: Alvo[] = [];
/*
 * VALE A PRIMEIRA OCORRÊNCIA DE CADA ID.
 *
 * Estes relatórios costumam trazer o mesmo AUD-xxx duas vezes: a tabela-resumo
 * (com página e categoria) e, mais abaixo, uma tabela-checklist de conferência
 * com OUTRAS colunas e as células vazias. Sem esta guarda a segunda sobrescreve
 * a primeira, a coluna de página passa a conter texto, e o recall zera —
 * silenciosamente, que é o pior jeito de uma métrica errar.
 */
/*
 * O CABEÇALHO MANDA, NÃO A POSIÇÃO.
 *
 * Cada relatório monta a tabela como quer: o do 084_25 traz
 * `ID | Criticidade | Página | Categoria | Achado`, o do 117_25 traz
 * `ID | Criticidade | Página | Achado | Confiança` — sem categoria e com o
 * texto uma coluna antes. Ler por índice fixo faz a coluna errada virar o texto
 * do achado, e o recall despenca sem que nada acuse. Lendo o cabeçalho, o
 * harness serve a qualquer relatório que nomeie suas colunas.
 */
type Mapa = { id: number; crit: number; pag: number; cat: number; texto: number };
let mapa: Mapa | null = null;

function acharColunas(cols: string[]): Mapa | null {
  const norm = cols.map((c) =>
    c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(),
  );
  const acha = (...termos: string[]) =>
    norm.findIndex((c) => termos.some((t) => c.includes(t)));
  const id = acha("id", "referencia");
  const pag = acha("pagina");
  if (id < 0 || pag < 0) return null;
  // "achado"/"descricao" é o texto; "categoria"/"natureza" é a classe.
  const cat = acha("categoria", "natureza", "tipo");
  let texto = acha("achado", "descricao", "problema", "incongruencia");
  if (texto === cat) texto = -1;
  if (texto < 0) texto = cols.length - 1;
  return { id, crit: acha("criticidade", "severidade", "gravidade"), pag, cat, texto };
}

const vistos = new Set<string>();
for (const linha of bench.split(/\r?\n/)) {
  if (!linha.trim().startsWith("|")) continue;
  const cols = linha.split("|").map((c) => c.trim());
  const talvez = acharColunas(cols);
  if (talvez) {
    mapa = talvez;
    continue;
  }
  if (!mapa) continue;
  const id = cols[mapa.id] ?? "";
  if (!/^(AUD|BM)[-–]?\d+/i.test(id)) continue;
  if (vistos.has(id)) continue;
  // a coluna de página precisa parecer página: sem isso não é a tabela-resumo
  if (!/\d/.test(cols[mapa.pag] ?? "")) continue;
  vistos.add(id);
  const texto = cols.slice(mapa.texto).join(" ");
  const categoria = mapa.cat >= 0 ? (cols[mapa.cat] ?? "") : "";
  alvos.push({
    id,
    criticidade: mapa.crit >= 0 ? (cols[mapa.crit] ?? "") : "",
    categoria,
    texto,
    paginas: parsePaginas(cols[mapa.pag] ?? ""),
    numeros: numerosFortes(texto),
    termos: termosFortes(`${categoria} ${texto}`),
  });
}

if (!alvos.length) {
  console.error(`Nenhuma linha AUD-xxx encontrada em ${benchPath}. Confira o formato da tabela.`);
  process.exit(1);
}

// ------------------------------------------------------------------ parecer
const raw = JSON.parse(readFileSync(parecerPath, "utf8"));
const report = raw.report ?? raw.audit?.report ?? raw;
const nossos = (report.incongruencias ?? report.achados ?? []) as Record<string, unknown>[];

type Nosso = {
  i: number;
  id: string;
  origem: string;
  prioridade: string;
  tipo: string;
  paginas: number[];
  numeros: Set<string>;
  termos: Set<string>;
};

const meus: Nosso[] = nossos.map((f, i) => {
  const texto = [f.tipo, f.descricao, f.conflito, f.evidencia, f.local, f.capitulo]
    .filter(Boolean)
    .join(" - ");
  return {
    i,
    id: String(f.id ?? `#${i + 1}`),
    origem: String(f.origem ?? "?"),
    prioridade: String(f.prioridade ?? "?"),
    tipo: String(f.tipo ?? ""),
    paginas: parsePaginas(String(f.pagina ?? "")),
    numeros: numerosFortes(texto),
    termos: termosFortes(texto),
  };
});

// ----------------------------------------------------------------- casamento
const casadoPor = new Map<string, Nosso[]>();
const usados = new Set<number>();

for (const alvo of alvos) {
  const hits: Nosso[] = [];
  for (const meu of meus) {
    if (!intersecta(new Set(alvo.paginas), new Set(meu.paginas))) continue;
    const numeroIgual = intersecta(alvo.numeros, meu.numeros);
    const termosEmComum = nInterseccao(alvo.termos, meu.termos);
    if (numeroIgual || termosEmComum >= 2) {
      hits.push(meu);
      usados.add(meu.i);
    }
  }
  casadoPor.set(alvo.id, hits);
}

// ------------------------------------------------------------------ relatório
const pegos = alvos.filter((a) => (casadoPor.get(a.id) ?? []).length > 0);
const perdidos = alvos.filter((a) => (casadoPor.get(a.id) ?? []).length === 0);
const soNossos = meus.filter((m) => !usados.has(m.i));

const pct = (n: number, d: number) => (d ? ((n / d) * 100).toFixed(0) : "0");

console.log("=".repeat(74));
console.log(`BENCHMARK: ${benchPath.split(/[\\/]/).pop()}  (${alvos.length} achados)`);
console.log(`PARECER  : ${parecerPath.split(/[\\/]/).pop()}  (${meus.length} achados)`);
console.log(`NIVEL    : ${report.runtime?.nivel_analise ?? "?"}`);
console.log("=".repeat(74));
console.log(`\nRECALL: ${pegos.length}/${alvos.length} = ${pct(pegos.length, alvos.length)}%\n`);

const porCat = new Map<string, { total: number; pego: number }>();
for (const a of alvos) {
  const cat = (a.categoria.split("/")[0] ?? a.categoria).trim() || "(sem categoria)";
  const e = porCat.get(cat) ?? { total: 0, pego: 0 };
  e.total++;
  if ((casadoPor.get(a.id) ?? []).length) e.pego++;
  porCat.set(cat, e);
}
console.log("RECALL POR NATUREZA");
for (const [cat, e] of [...porCat].sort((x, y) => y[1].total - x[1].total)) {
  const barra = "#".repeat(Math.round((e.pego / e.total) * 10)).padEnd(10, ".");
  console.log(
    `  ${barra} ${String(e.pego).padStart(2)}/${String(e.total).padEnd(2)} ${pct(e.pego, e.total).padStart(3)}%  ${cat}`,
  );
}

const porCrit = new Map<string, { total: number; pego: number }>();
for (const a of alvos) {
  const c = (a.criticidade.split("/")[0] ?? "").replace(/\*/g, "").trim().toUpperCase() || "?";
  const e = porCrit.get(c) ?? { total: 0, pego: 0 };
  e.total++;
  if ((casadoPor.get(a.id) ?? []).length) e.pego++;
  porCrit.set(c, e);
}
console.log("\nRECALL POR CRITICIDADE");
for (const [c, e] of porCrit) {
  console.log(`  ${String(e.pego).padStart(2)}/${String(e.total).padEnd(2)} ${pct(e.pego, e.total).padStart(3)}%  ${c}`);
}

console.log(`\n${"-".repeat(74)}\nPEGOS (${pegos.length})`);
for (const a of pegos) {
  const hits = casadoPor.get(a.id)!;
  const origens = [...new Set(hits.map((h) => h.origem))].join("+");
  console.log(
    `  [ok] ${a.id} p.${a.paginas.slice(0, 3).join(",")} [${origens}] ${a.texto.replace(/\*/g, "").slice(0, 68)}`,
  );
  for (const h of hits.slice(0, 2)) console.log(`        -> ${h.id} ${h.tipo.slice(0, 60)}`);
}

console.log(`\n${"-".repeat(74)}\nPERDIDOS (${perdidos.length})  <- onde investir`);
for (const a of perdidos) {
  console.log(
    `  [--] ${a.id} [${a.criticidade.replace(/\*/g, "")}] p.${a.paginas.slice(0, 4).join(",")} - ${a.categoria}`,
  );
  console.log(`        ${a.texto.replace(/\*/g, "").replace(/\s+/g, " ").slice(0, 110)}`);
}

console.log(`\n${"-".repeat(74)}\nSO O NEXODOC (${soNossos.length})  <- ganho OU falso positivo, leitura humana`);
const porOrigem = new Map<string, number>();
for (const m of soNossos) porOrigem.set(m.origem, (porOrigem.get(m.origem) ?? 0) + 1);
console.log(`  por origem: ${[...porOrigem].map(([o, n]) => `${o}=${n}`).join(" - ")}\n`);
for (const m of soNossos) {
  console.log(`  [+] ${m.id} [${m.origem}/${m.prioridade}] p.${m.paginas.join(",")} - ${m.tipo.slice(0, 58)}`);
}

console.log(`\n${"-".repeat(74)}\nCONTRIBUICAO POR ORIGEM (todos os achados do parecer)`);
const totalOrigem = new Map<string, { n: number; casou: number }>();
for (const m of meus) {
  const e = totalOrigem.get(m.origem) ?? { n: 0, casou: 0 };
  e.n++;
  if (usados.has(m.i)) e.casou++;
  totalOrigem.set(m.origem, e);
}
for (const [o, e] of totalOrigem) {
  console.log(`  ${o.padEnd(10)} ${String(e.n).padStart(3)} achados - ${e.casou} casaram com o benchmark`);
}
console.log();
