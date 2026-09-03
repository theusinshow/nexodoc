/**
 * MEDE o julgamento de papel contra o acervo inteiro de `docs/`.
 *
 * Não é teste: é o instrumento que ESCOLHE os limiares. Ele roda o MESMO
 * `papelPelaGeometria` que a produção roda — se reimplementasse a conta aqui,
 * mediria uma cópia, e um número sobre uma cópia dá confiança sobre código que
 * não é o que roda.
 *
 * O gabarito é o NOME: no acervo real a convenção acerta 656 de 659. As
 * exceções conhecidas estão em `GABARITO_A_MAO` — os memoriais do kit de erros
 * plantados, cujo nome descreve o defeito e não o tipo do documento.
 *
 * REPROVA só a TROCA DE LADO (memorial vira prancha, ou o contrário).
 * `nao-sei` em qualquer quantidade é resultado aceitável: é uma pergunta, não
 * um erro — e a contagem dela é o preço da regra, que vale saber.
 *
 *   npm run medir:papel
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

import { parseFilename } from "../server/nexo/parse-filename.ts";
import { classificarPagina } from "../server/nexo/selo-regiao.ts";
import { normalizarItens } from "../lib/coordenada-do-pdf.ts";
import {
  CHARS_DE_FOLHA_MUDA,
  decidirPapel,
  paginasDaAmostra,
  papelPelaGeometria,
} from "../modules/nexo/lib/papel-do-anexo.ts";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const OPS = pdfjs.OPS;

/**
 * Os arquivos cujo NOME mente, e o que eles são de verdade.
 *
 * Todos do kit de erros plantados (`docs/samples/_auditoria-teste/`): o nome
 * descreve o defeito plantado ("01-identidade-capa-x-corpo"), não o tipo do
 * documento. Os oito são MEMORIAIS — o `GABARITO.md` da pasta abre com "Kit de
 * memoriais com erros plantados" —, e é justamente neles que a geometria acerta
 * e o nome erra.
 *
 * A PASTA É IGNORADA PELO GIT. Quem clonar o repositório não a tem, e o medidor
 * simplesmente não a encontra: são 8 arquivos de menos na conta, nenhum erro.
 * Para recriá-la: `node scripts/gera-memoriais-defeituosos.mjs`.
 *
 * `fora-do-dominio` é o relatório de auditoria de segurança: 18 páginas A4 de
 * texto corrido que não são documento de projeto nenhum. A geometria vai
 * chamá-lo de memorial, e está certa no que ela sabe medir — "documento de
 * texto". Fica marcado para não contar como erro nem como acerto.
 */
const GABARITO_A_MAO = new Map([
  ["01-identidade-capa-x-corpo.pdf", "memorial"],
  ["02-contratual-e-escopo.pdf", "memorial"],
  ["03-numerico-areas-e-unidades.pdf", "memorial"],
  // O 04 é a CAPA do par cruzado capa+memorial (GABARITO.md:67) — o par é
  // enviado junto, com fileTypes capa e memorial. Duas folhas, e o fluxo de
  // prancha é o lugar certo dela.
  ["04-par-capa.pdf", "prancha"],
  ["05-par-memorial.pdf", "memorial"],
  ["06-capa-ilegivel.pdf", "memorial"],
  ["07-sutil-tres-erros.pdf", "memorial"],
  ["08-controle-limpo.pdf", "memorial"],
  ["relatorio-auditoria-seguranca.pdf", "fora-do-dominio"],
]);

function esperado(nome) {
  const aMao = GABARITO_A_MAO.get(nome);
  if (aMao) return aMao;
  const tipo = parseFilename(nome).tipo;
  if (tipo === "memorial") return "memorial";
  if (tipo === "outro") return "desconhecido";
  return "prancha";
}

function listarPdfs(raiz) {
  const saida = [];
  (function anda(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.toLowerCase().endsWith(".pdf")) saida.push(p);
    }
  })(raiz);
  return saida;
}

async function temTinta(page) {
  try {
    const ops = await page.getOperatorList();
    const desenho = new Set([OPS.constructPath ?? -1]);
    const imagem = new Set([
      OPS.paintImageXObject ?? -1,
      OPS.paintJpegXObject ?? -1,
      OPS.paintImageMaskXObject ?? -1,
      OPS.paintInlineImageXObject ?? -1,
    ]);
    for (const op of ops.fnArray) {
      if (desenho.has(op) || imagem.has(op)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function colher(caminho) {
  const data = new Uint8Array(readFileSync(caminho));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    const paginas = doc.numPages;
    const amostra = [];
    for (const n of paginasDaAmostra(paginas)) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const brutos = content.items.filter(
        (it) => Array.isArray(it.transform) && typeof it.str === "string",
      );
      const itens = normalizarItens(
        brutos.map((it) => {
          const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
          return { texto: it.str.trim(), x, y };
        }),
        { largura: vp.width, altura: vp.height },
      );
      const chars = brutos.reduce((s, it) => s + it.str.length, 0);
      amostra.push({
        tipo: classificarPagina({ largura: vp.width, altura: vp.height, itens }),
        chars,
        temTinta: chars < CHARS_DE_FOLHA_MUDA ? await temTinta(page) : false,
      });
    }
    return { paginas, amostra };
  } finally {
    await doc.destroy();
  }
}

const extras = [
  "scratchpad/ESCOLA_JOSE_GIASSI_REV_A.pdf",
  "tests/117_25_md_geral_a.pdf",
];
const alvos = [...listarPdfs("docs"), ...extras.filter((p) => existsSync(p))];

const matriz = new Map();
const decisoes = new Map();
const indecisos = [];
const trocasDeLado = [];
/** Os extremos que decidem os limiares — o que aparece no comentário do módulo. */
const extremos = { menorMemorial: Infinity, maiorNaoMemorial: 0, quem: { memorial: "", outro: "" } };
let lidos = 0;
let ilegiveis = 0;

for (const caminho of alvos) {
  const nome = caminho.split(/[\\/]/).pop();
  let fatos;
  try {
    fatos = await colher(caminho);
  } catch {
    ilegiveis += 1;
    continue;
  }
  lidos += 1;

  const disse = papelPelaGeometria(fatos);
  const devia = esperado(nome);
  const chave = `${devia} -> ${disse}`;
  matriz.set(chave, (matriz.get(chave) ?? 0) + 1);

  /*
   * A DECISÃO FINAL é o que a pessoa vê, e é outro número.
   *
   * A geometria dizer "não sei" não vira pergunta: a precedência manda seguir o
   * nome quando ele fala. Medir só a geometria faz o custo da regra parecer bem
   * maior do que é — na primeira corrida com o limiar em 600, `nao-sei` subiu
   * para 46, e nenhum desses 46 gerava pergunta nenhuma.
   */
  const final = decidirPapel({
    pelaConvencao: parseFilename(nome).tipo,
    pelaGeometria: disse,
    fatos,
  });
  decisoes.set(final.papel, (decisoes.get(final.papel) ?? 0) + 1);
  if (final.papel === "indeciso") {
    indecisos.push({ nome, paginas: fatos.paginas, porque: final.porque });
  }

  const chars =
    fatos.amostra.length === 0
      ? 0
      : Math.round(
          fatos.amostra.reduce((s, p) => s + p.chars, 0) / fatos.amostra.length,
        );
  // Só folhas SEM carimbo entram nos extremos: a prancha é decidida antes da
  // densidade, e a densidade dela não diz nada sobre onde pôr o limiar.
  const semCarimbo = !fatos.amostra.some((p) => p.tipo === "prancha");
  if (semCarimbo && fatos.paginas >= 10) {
    if (devia === "memorial" && chars < extremos.menorMemorial) {
      extremos.menorMemorial = chars;
      extremos.quem.memorial = `${nome} (${fatos.paginas} pág)`;
    }
    if (devia === "prancha" && chars > extremos.maiorNaoMemorial) {
      extremos.maiorNaoMemorial = chars;
      extremos.quem.outro = `${nome} (${fatos.paginas} pág)`;
    }
  }

  if (
    (devia === "memorial" && disse === "prancha") ||
    (devia === "prancha" && disse === "memorial")
  ) {
    trocasDeLado.push({
      devia,
      disse,
      paginas: fatos.paginas,
      chars,
      caminho: relative(".", caminho),
    });
  }
}

console.log(`\nPDFs lidos: ${lidos} de ${alvos.length}  (ilegíveis: ${ilegiveis})\n`);
console.log("gabarito -> geometria");
for (const [k, v] of [...matriz].sort()) console.log(`  ${k.padEnd(30)} ${v}`);

console.log("\nDECISÃO FINAL (o que a pessoa vê, já com a precedência do nome)");
for (const [k, v] of [...decisoes].sort()) console.log(`  ${k.padEnd(30)} ${v}`);
if (indecisos.length > 0) {
  console.log(`\n  os ${indecisos.length} que viram pergunta:`);
  for (const i of indecisos) console.log(`    ${i.nome} (${i.paginas} pág) — ${i.porque}`);
}

console.log("\nextremos da densidade (só documentos de 10+ folhas sem carimbo):");
console.log(`  menor memorial ....... ${extremos.menorMemorial} chars/folha  ${extremos.quem.memorial}`);
console.log(`  maior não-memorial ... ${extremos.maiorNaoMemorial} chars/folha  ${extremos.quem.outro}`);

console.log(`\nTROCAS DE LADO (memorial<->prancha): ${trocasDeLado.length}`);
for (const t of trocasDeLado) {
  console.log(`  ${t.devia} virou ${t.disse}  pg=${t.paginas} chars=${t.chars}  ${t.caminho}`);
}

if (trocasDeLado.length > 0) process.exitCode = 1;
