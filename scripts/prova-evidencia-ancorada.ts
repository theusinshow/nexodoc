/**
 * A EVIDÊNCIA EXISTE MESMO NO DOCUMENTO?
 *
 * O falso positivo mais grave que um auditor pode cometer não é errar o
 * julgamento — é citar um trecho que não está lá. Julgamento errado um
 * engenheiro refuta lendo a página; citação inventada destrói a confiança no
 * parecer inteiro, porque nenhuma das outras 56 linhas pode mais ser lida sem
 * conferência.
 *
 * Isto é mecânico e não precisa de engenheiro: pega a transcrição de cada
 * achado, procura na PÁGINA que ele declara, e diz quais não ancoram.
 *
 *   node scripts/prova-evidencia-ancorada.ts <parecer.json> <memorial.pdf>
 *
 * O casamento é tolerante de propósito — a extração do pdf.js reflui espaço,
 * hifeniza e às vezes perde acento, e cobrar igualdade literal reprovaria
 * evidência boa. Reprovar evidência boa faria este script mentir na direção
 * mais cara: acusar de invenção quem transcreveu certo.
 */
import { readFile } from "node:fs/promises";

import { extractPdfText } from "../lib/pdf-text.ts";

const [parecerPath, pdfPath] = process.argv.slice(2);
if (!parecerPath || !pdfPath) {
  console.error("Uso: node scripts/prova-evidencia-ancorada.ts <parecer.json> <memorial.pdf>");
  process.exit(1);
}

/** Só letras e dígitos, minúsculo, sem acento: imune a refluxo de espaço. */
function esqueleto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Os trechos citados dentro de uma evidência.
 *
 * O campo costuma vir como `Página 57: "ABNT NBR 9574:2008 - Execução"` ou
 * `“a 6,1 km da USB Vila Manaus.”`. O que se procura no documento é o que está
 * entre aspas — o resto é moldura escrita pelo auditor.
 */
function trechosCitados(evidencia: string): string[] {
  const bruto = String(evidencia ?? "");
  const aspas = [...bruto.matchAll(/[“"']([^”"']{12,})[”"']/g)].map((m) => m[1]);
  if (aspas.length > 0) return aspas;
  // Sem aspas: tira o rótulo "p. 41:" / "Página 57:" e usa o resto.
  const semRotulo = bruto.replace(/^\s*(?:p[áa]g(?:ina)?\.?|p\.)\s*[\d,\s e-]+:?\s*/i, "");
  return semRotulo.trim().length >= 12 ? [semRotulo.trim()] : [];
}

/**
 * As páginas que o achado declara.
 *
 * Sem teto na largura da faixa: um achado de capítulo inteiro escreve
 * "159-202", e recusar a faixa por ser larga deixava só 159 e 202 — o trecho
 * citado morava na 160 e o script o dava como inexistente. Aqui a faixa é a
 * declaração do auditor sobre onde procurar, não uma suspeita a ser limitada.
 */
function paginasDe(raw: unknown): number[] {
  const txt = String(raw ?? "").replace(/[–—]/g, "-");
  const out = new Set<number>();
  for (const m of txt.matchAll(/(\d{1,4})\s*-\s*(\d{1,4})/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b >= a && b - a <= 400) for (let p = a; p <= b; p++) out.add(p);
  }
  for (const m of txt.matchAll(/\d{1,4}/g)) out.add(Number(m[0]));
  return [...out].filter((n) => n > 0 && n < 5000);
}

const parecer = JSON.parse(await readFile(parecerPath, "utf8"));
const report = parecer.report ?? parecer;
const achados = report.incongruencias ?? [];

/**
 * O CARIMBO DE PÁGINA, FORA DO CAMINHO.
 *
 * Toda página do memorial carrega o mesmo rodapé ("PREFEITURA MUNICIPAL ... Cap.7
 * – Pág.61 Direitos Autorais ...") e o mesmo cabeçalho de capítulo. Eles caem
 * NO MEIO das frases: a p.61 termina em "Para melhor amarração com a alvenaria"
 * e a p.62 recomeça em "existente, evitando fissura...".
 *
 * O auditor remonta a frase e cita certo. Quem erra é quem confere colando as
 * páginas com o carimbo entre elas — e acusaria de invenção uma transcrição
 * exata. Achar o prefixo e o sufixo comuns a quase todas as páginas (com os
 * dígitos neutralizados, porque o número muda) devolve o corpo do texto.
 */
function comumNasBordas(paginas: string[], modo: "inicio" | "fim"): number {
  if (paginas.length < 4) return 0;
  const car = (s: string, i: number) => (modo === "inicio" ? s[i] : s[s.length - 1 - i]);
  const menor = Math.min(...paginas.map((p) => p.length));
  let n = 0;
  while (n < menor && n < 400) {
    const alvo = car(paginas[0], n);
    // "quase todas" e não "todas": uma página de tabela ou a capa quebram a igualdade
    // total sem que o carimbo deixe de existir nas outras 210.
    const quantas = paginas.filter((p) => car(p, n) === alvo).length;
    if (quantas < paginas.length * 0.6) break;
    n++;
  }
  return n;
}

const extracted = await extractPdfText(await readFile(pdfPath));

/** Dígitos viram "#" só para DETECTAR a borda: o número de página muda, o resto não. */
const semDigitos = extracted.pages.map((p) => esqueleto(p.text).replace(/\d/g, "#"));
const nInicio = comumNasBordas(semDigitos, "inicio");
const nFim = comumNasBordas(semDigitos, "fim");

const porPagina = new Map<number, string>();
const corpos: string[] = [];
for (const p of extracted.pages) {
  const cru = esqueleto(p.text);
  const corpo = cru.slice(nInicio, cru.length - nFim);
  porPagina.set(p.page, corpo);
  corpos.push(corpo);
}
const documentoInteiro = corpos.join("");

if (nInicio + nFim > 0) {
  console.log(`(carimbo de página detectado: ${nInicio} chars no início, ${nFim} no fim — removidos)\n`);
}

type Veredito = "ancorada" | "outra_pagina" | "nao_encontrada" | "sem_transcricao";
const resultado: { id: string; tipo: string; pagina: string; veredito: Veredito; trecho: string }[] = [];

for (const f of achados) {
  const trechos = trechosCitados(String(f.evidencia ?? ""));
  if (trechos.length === 0) {
    resultado.push({ id: f.id, tipo: f.tipo, pagina: String(f.pagina), veredito: "sem_transcricao", trecho: "" });
    continue;
  }

  const paginas = paginasDe(f.pagina);
  let melhor: Veredito = "nao_encontrada";
  let qual = trechos[0];

  for (const trecho of trechos) {
    /*
     * A ELISÃO PARTE A BUSCA EM DUAS.
     *
     * O auditor escreve `"As portas de vidro [...] deverão receber sinalização"`
     * — corta o meio de propósito, para caber. Procurar a corrida inteira
     * atravessa o `[...]` e não acha nada, e o script acusaria de invenção uma
     * transcrição correta. Errar assim é pior que não medir: destruiria a
     * confiança no achado justamente por um defeito do medidor.
     *
     * Cada pedaço é procurado por si; o achado ancora quando TODOS ancoram.
     */
    const pedacos = trecho
      .split(/\[\s*\.\.\.\s*\]|\[…\]|…|\.\.\./)
      .map((p) => esqueleto(p).slice(0, 60))
      .filter((p) => p.length >= 12);
    if (pedacos.length === 0) continue;

    /*
     * As páginas declaradas viram UM texto só.
     *
     * Frase de memorial atravessa a virada de página o tempo todo — o rodapé
     * ("PREFEITURA MUNICIPAL ... Cap.7 – Pág.61") corta a oração no meio, e a
     * continuação nasce na página seguinte. Conferindo página a página
     * isoladamente, uma transcrição correta de p.61-62 não ancora em nenhuma
     * das duas, e o script acusaria de invenção quem citou certo.
     */
    const textoDeclarado = paginas.map((p) => porPagina.get(p) ?? "").join("");
    const naPagina = pedacos.every((pedaco) => textoDeclarado.includes(pedaco));
    if (naPagina) {
      melhor = "ancorada";
      qual = trecho;
      break;
    }
    if (pedacos.every((pedaco) => documentoInteiro.includes(pedaco)) && melhor === "nao_encontrada") {
      melhor = "outra_pagina";
      qual = trecho;
    }
  }
  resultado.push({ id: f.id, tipo: f.tipo, pagina: String(f.pagina), veredito: melhor, trecho: qual });
}

const conta = (v: Veredito) => resultado.filter((r) => r.veredito === v).length;
const total = resultado.length;

console.log(`PARECER: ${parecerPath.split(/[\\/]/).pop()} — ${total} achados`);
console.log(`DOCUMENTO: ${extracted.pageCount} páginas, ${extracted.charCount} chars\n`);
console.log(`  ancorada na página declarada : ${conta("ancorada")}/${total}`);
console.log(`  existe, mas em OUTRA página  : ${conta("outra_pagina")}/${total}`);
console.log(`  NÃO encontrada no documento  : ${conta("nao_encontrada")}/${total}`);
console.log(`  sem transcrição para conferir: ${conta("sem_transcricao")}/${total}\n`);

for (const v of ["nao_encontrada", "outra_pagina", "sem_transcricao"] as Veredito[]) {
  const lista = resultado.filter((r) => r.veredito === v);
  if (!lista.length) continue;
  console.log(`--- ${v} (${lista.length}) ---`);
  for (const r of lista) {
    console.log(`  ${r.id} p.${r.pagina} · ${r.tipo}`);
    if (r.trecho) console.log(`     "${r.trecho.replace(/\s+/g, " ").slice(0, 110)}"`);
  }
  console.log();
}

if (conta("nao_encontrada") > 0) {
  console.log("ATENÇÃO: transcrição que não existe no documento é falso positivo GRAVE.");
  console.log("Confira se é invenção do modelo ou limitação da extração antes de concluir.");
}
