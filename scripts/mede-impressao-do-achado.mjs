/**
 * QUAL IMPRESSÃO DIGITAL RECONHECE O MESMO ACHADO?
 *
 * A chave de hoje (`arquivo|tipo|pagina|evidencia|conflito`) casa 7% dos achados
 * entre duas corridas do MESMO documento — o modelo reescreve `tipo` e
 * `conflito` a cada corrida mantendo o defeito. Como rede contra o mesmo achado
 * sair duas vezes na reauditoria, ela está praticamente desligada.
 *
 * Trocar a chave tem DUAS maneiras de errar, e a segunda é a cara:
 *
 *   ESTABILIDADE — o mesmo defeito, em duas corridas, dá a mesma chave?
 *   COLISÃO      — defeitos DIFERENTES, na mesma corrida, dão chaves diferentes?
 *
 * Uma chave frouxa acerta a primeira e falha a segunda: funde dois achados reais
 * e some com um deles. Este produto já pagou por filtro que escondia achado
 * (12/08), e uma chave frouxa é a mesma falha com outro nome. Por isso as duas
 * colunas saem juntas, e nenhuma decisão se toma olhando só uma.
 *
 *   node scripts/mede-impressao-do-achado.mjs <corrida1.json> <corrida2.json>
 */
import fs from "node:fs";

const [p1, p2] = process.argv.slice(2);
if (!p1 || !p2) {
  console.error("Uso: node scripts/mede-impressao-do-achado.mjs <corrida1.json> <corrida2.json>");
  process.exit(1);
}

const carrega = (p) => JSON.parse(fs.readFileSync(p, "utf8")).report.incongruencias ?? [];
const A = carrega(p1);
const B = carrega(p2);

const esq = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** A primeira página declarada — âncora estável mesmo quando a faixa muda. */
const pag1 = (f) => String(f.pagina ?? "").match(/\d+/)?.[0] ?? "";

/** Todas as páginas declaradas, ordenadas. */
const pags = (f) => [...new Set(String(f.pagina ?? "").match(/\d+/g) ?? [])].sort().join(",");

/** Números "de engenharia" da evidência: 4.530,98 · 21,08 · 9574. */
const numeros = (f) => {
  const txt = `${f.evidencia ?? ""} ${f.conflito ?? ""}`;
  const out = new Set();
  for (const m of txt.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+|\d{4,}/g)) {
    out.add(m[0].replace(/\./g, "").replace(",", "."));
  }
  return [...out].sort().join("~");
};

/**
 * SÓ O QUE ESTÁ ENTRE ASPAS.
 *
 * A evidência vem ora como `Pág. 17: "texto"`, ora como `“texto”` — a moldura é
 * redação do auditor e muda entre corridas; o miolo é transcrição do documento
 * e não muda. Botar a moldura na chave é botar a variação dentro do que deveria
 * ser o invariante.
 */
const citacao = (f) => {
  const bruto = String(f.evidencia ?? "");
  const aspas = [...bruto.matchAll(/[“"']([^”"']{8,})[”"']/g)].map((m) => m[1]);
  if (aspas.length > 0) return esq(aspas.join(" "));
  return esq(bruto.replace(/^\s*(?:p[áa]g(?:ina)?\.?|p\.)\s*[\d,\s e-]+:?\s*/i, ""));
};

const CANDIDATAS = [
  {
    nome: "A · hoje (tipo+evid+conflito)",
    fn: (f) => [f.arquivo, f.tipo, f.pagina, String(f.evidencia ?? "").slice(0, 120), String(f.conflito ?? "").slice(0, 120)].map(esq).join("|"),
  },
  { nome: "B · pagina + evidencia(40)", fn: (f) => [esq(f.arquivo), pag1(f), esq(f.evidencia).slice(0, 40)].join("|") },
  { nome: "C · pagina + evidencia(60)", fn: (f) => [esq(f.arquivo), pag1(f), esq(f.evidencia).slice(0, 60)].join("|") },
  { nome: "D · paginas + evidencia(40)", fn: (f) => [esq(f.arquivo), pags(f), esq(f.evidencia).slice(0, 40)].join("|") },
  { nome: "E · pagina + termo_busca", fn: (f) => [esq(f.arquivo), pag1(f), esq(f.termo_busca)].join("|") },
  { nome: "F · pagina + numeros", fn: (f) => [esq(f.arquivo), pag1(f), numeros(f)].join("|") },
  { nome: "G · pagina + evid(40) + numeros", fn: (f) => [esq(f.arquivo), pag1(f), esq(f.evidencia).slice(0, 40), numeros(f)].join("|") },
  { nome: "H · so pagina", fn: (f) => [esq(f.arquivo), pag1(f)].join("|") },
  { nome: "I · paginas + citacao(40)", fn: (f) => [esq(f.arquivo), pags(f), citacao(f).slice(0, 40)].join("|") },
  { nome: "J · paginas + citacao(30)", fn: (f) => [esq(f.arquivo), pags(f), citacao(f).slice(0, 30)].join("|") },
  { nome: "K · pagina1 + citacao(40)", fn: (f) => [esq(f.arquivo), pag1(f), citacao(f).slice(0, 40)].join("|") },
];

console.log(`corrida 1: ${A.length} achados · corrida 2: ${B.length} achados\n`);
console.log("                                    ESTABILIDADE      COLISAO (achados fundidos)");
console.log("chave                               entre corridas    corrida1   corrida2");
console.log("-".repeat(80));

for (const c of CANDIDATAS) {
  const kA = A.map(c.fn);
  const kB = new Set(B.map(c.fn));
  const estaveis = kA.filter((k) => kB.has(k)).length;

  /* Colisão: quantos achados DESAPARECERIAM por dividir chave com outro. */
  const colide = (lista) => lista.length - new Set(lista.map(c.fn)).size;
  const cA = colide(A);
  const cB = colide(B);

  const pct = Math.round((100 * estaveis) / A.length);
  console.log(
    `${c.nome.padEnd(35)} ${String(estaveis).padStart(3)}/${A.length} = ${String(pct).padStart(3)}%` +
      `      ${String(cA).padStart(4)}       ${String(cB).padStart(4)}`,
  );
}

console.log("-".repeat(80));
console.log("ESTABILIDADE alta = reconhece o mesmo defeito na reauditoria.");
console.log("COLISAO > 0      = achados DISTINTOS somem. Zero nao e meta, e requisito.");

/* Quem colide em cada candidata que não seja a de hoje — para leitura humana. */
for (const c of CANDIDATAS.slice(1)) {
  const porChave = new Map();
  for (const f of B) {
    const k = c.fn(f);
    if (!porChave.has(k)) porChave.set(k, []);
    porChave.get(k).push(f);
  }
  const grupos = [...porChave.values()].filter((g) => g.length > 1);
  if (!grupos.length) continue;
  console.log(`\n--- ${c.nome}: ${grupos.length} grupo(s) fundido(s) na corrida 2 ---`);
  for (const g of grupos.slice(0, 6)) {
    console.log(`  p.${g[0].pagina}:`);
    for (const f of g) console.log(`     ${f.id} ${String(f.tipo).slice(0, 62)}`);
  }
}
