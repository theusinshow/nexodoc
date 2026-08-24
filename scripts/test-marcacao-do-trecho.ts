/**
 * A MARCAÇÃO DO TRECHO NA PÁGINA — provada sem navegador e sem pdf.js.
 *
 *   node scripts/test-marcacao-do-trecho.ts   (== npm run test:marcacao)
 *
 * O defeito que originou este arquivo (24/08/2026, apontado numa auditoria
 * real: "a marcação dos trechos nas páginas está ficando imprecisa"):
 *
 * O visor destacava o trecho inteiro E CADA PALAVRA dele com 4 letras ou mais,
 * span por span, cada um julgado em isolamento. Numa página de memorial as
 * palavras da evidência — "revestimento", "conforme", "especificação" —
 * aparecem dezenas de vezes, e a página inteira acendia. O usuário via marca em
 * todo lugar e trecho em lugar nenhum.
 *
 * A regra certa é a que `locate-term.ts` já usava para o pin: costurar os itens
 * na ordem de leitura, achar ONDE o trecho está, e marcar só ali.
 */
import assert from "node:assert/strict";

import { marcacaoDoTrecho } from "../lib/marcacao-do-trecho.ts";
import type { ItemDeTexto } from "../lib/texto-do-pdf.ts";

let passed = 0;
function check(nome: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${nome}`);
  } catch (err) {
    console.error(`FALHOU  ${nome}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const CORPO = 11;

/** Uma linha de itens em x crescente, colados com um espaço de verdade. */
function linha(y: number, palavras: string[], x0 = 60): ItemDeTexto[] {
  let x = x0;
  return palavras.map((str) => {
    const width = str.length * CORPO * 0.5;
    const item: ItemDeTexto = {
      str,
      transform: [CORPO, 0, 0, CORPO, x, y],
      width,
      height: CORPO,
    };
    // vão de um espaço até a próxima palavra
    x += width + CORPO * 0.3;
    return item;
  });
}

/** O que ficou marcado, item a item, como texto legível. */
function marcado(itens: ItemDeTexto[], termo: string): string[] {
  const faixas = marcacaoDoTrecho(itens, termo);
  const saida: string[] = [];
  for (const [indice, trechos] of faixas) {
    for (const [inicio, fim] of trechos) {
      saida.push(itens[indice].str.slice(inicio, fim));
    }
  }
  return saida;
}

// ---------------------------------------------------------------------------

check("marca o trecho onde ele está, e nada além", () => {
  const itens = [
    ...linha(700, ["O", "revestimento", "cerâmico", "será", "assentado"]),
    ...linha(680, ["conforme", "a", "norma", "vigente"]),
  ];
  assert.deepEqual(
    marcado(itens, "revestimento cerâmico"),
    ["revestimento", "cerâmico"],
  );
});

check("A PALAVRA REPETIDA NÃO ACENDE A PÁGINA INTEIRA — o defeito original", () => {
  /*
   * "revestimento" aparece três vezes; a evidência é a segunda ocorrência. A
   * versão antiga marcava as três, mais "conforme", mais "especificação", em
   * qualquer lugar da página.
   */
  const itens = [
    ...linha(700, ["O", "revestimento", "de", "piso", "conforme", "projeto"]),
    ...linha(680, ["O", "revestimento", "de", "parede", "conforme", "projeto"]),
    ...linha(660, ["O", "revestimento", "de", "forro", "conforme", "projeto"]),
  ];
  const faixas = marcacaoDoTrecho(itens, "revestimento de parede");
  const indices = [...faixas.keys()].sort((a, b) => a - b);

  assert.deepEqual(
    indices.map((i) => itens[i].str),
    ["revestimento", "de", "parede"],
  );
  // e é a ocorrência da SEGUNDA linha, não da primeira
  assert.ok(indices[0] > 5, `marcou a ocorrência errada (item ${indices[0]})`);
});

check("marca só o pedaço do item quando o trecho começa no meio dele", () => {
  const itens: ItemDeTexto[] = [
    { str: "áreatotalconstruída1.234,56m²", transform: [CORPO, 0, 0, CORPO, 60, 700], width: 200, height: CORPO },
  ];
  assert.deepEqual(marcado(itens, "1.234,56"), ["1.234,56"]);
});

check("atravessa a quebra de linha, que é onde a evidência costuma cair", () => {
  const itens = [
    ...linha(700, ["a", "cobertura", "metálica", "do"]),
    ...linha(680, ["ginásio", "deverá", "ser", "revisada"]),
  ];
  assert.deepEqual(
    marcado(itens, "metálica do ginásio"),
    ["metálica", "do", "ginásio"],
  );
});

check("ignora acento e caixa, como a extração faz", () => {
  const itens = linha(700, ["Especificação", "Técnica", "Complementar"]);
  assert.deepEqual(
    marcado(itens, "especificacao tecnica"),
    ["Especificação", "Técnica"],
  );
});

check("EVIDÊNCIA MAIS LONGA QUE A PÁGINA: cai para o maior prefixo que existe", () => {
  /*
   * O modelo cita mais do que está escrito (juntou duas frases, ou completou o
   * final). Marcar nada seria perder o trecho; marcar palavra solta seria o
   * defeito de volta. O meio-termo é o maior PREFIXO contíguo que a página tem.
   */
  const itens = linha(700, ["O", "revestimento", "cerâmico", "PEI-4", "assentado"]);
  assert.deepEqual(
    marcado(itens, "revestimento cerâmico PEI-4 com argamassa colante AC-III"),
    ["revestimento", "cerâmico", "PEI-4"],
  );
});

check("trecho que não existe na página não marca NADA", () => {
  const itens = linha(700, ["O", "revestimento", "cerâmico"]);
  assert.equal(marcacaoDoTrecho(itens, "esquadria de alumínio anodizado").size, 0);
});

check("termo curto demais não marca — ancoraria em qualquer lugar", () => {
  const itens = linha(700, ["de", "revestimento", "de", "piso"]);
  assert.equal(marcacaoDoTrecho(itens, "de").size, 0);
});

check("o separador da grade não impede o casamento", () => {
  /*
   * Desde 24/08/2026 o modelo lê as tabelas como grade e cita a evidência com
   * o `|` que nós mesmos escrevemos ("TOTAL | 4.530,98"). Esse caractere não
   * existe na folha; se ele contasse, toda evidência de tabela ficaria sem
   * marca justamente onde a leitura acabou de melhorar.
   */
  const itens = linha(700, ["TOTAL", "4.530,98"]);
  assert.deepEqual(marcado(itens, "TOTAL | 4.530,98"), ["TOTAL", "4.530,98"]);
});

console.log(`\n${passed} teste(s) de marcação do trecho OK`);
