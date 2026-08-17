/**
 * A costura da camada de texto do PDF. Núcleo PURO → node cru.
 *
 *   node scripts/test-texto-do-pdf.ts   (== npm run test:texto-do-pdf)
 *
 * COMO OS ITENS DAQUI FORAM MONTADOS
 *
 * O pdf.js entrega, por trecho, a matriz do texto (`transform`, com x em [4] e y
 * em [5]), a largura ocupada e a altura do corpo da fonte. As medidas abaixo
 * usam corpo 10 e larguras proporcionais ao que uma fonte de texto entrega —
 * não são números inventados para o teste passar, são as duas grandezas que a
 * decisão compara:
 *
 *  - ajuste de kerning: da ordem de 0,2 a 0,8 do ponto (0,02–0,08 do corpo);
 *  - espaço de verdade: 2 a 3 pontos (0,20–0,30 do corpo).
 *
 * METADE DESTE ARQUIVO É O QUE NÃO PODE SER GRUDADO, de propósito. Errar para
 * o lado de juntar inventa erro de português novo — "PROJETOEXECUTIVO" — em vez
 * de corrigir o antigo, e um teste que só cobre o lado bom deixaria a porta
 * aberta para um limiar folgado demais passar despercebido.
 */
import assert from "node:assert/strict";

import { textoDosItens, separadorEntreItens, type ItemDeTexto } from "../lib/texto-do-pdf.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const CORPO = 10;
/** Largura média de um caractere no corpo 10 — o suficiente para posicionar. */
const LARGURA_POR_CHAR = 5;

/**
 * Monta uma linha a partir de pedaços e dos VÃOS entre eles, em pontos.
 * `vaos[i]` é a folga entre o pedaço `i` e o `i+1`.
 */
function linha(pedacos: string[], vaos: number[], y = 700): ItemDeTexto[] {
  const itens: ItemDeTexto[] = [];
  let x = 100;
  pedacos.forEach((str, i) => {
    const width = str.length * LARGURA_POR_CHAR;
    itens.push({ str, transform: [1, 0, 0, CORPO, x, y], width, height: CORPO });
    x += width + (vaos[i] ?? 0);
  });
  return itens;
}

// ---------------------------------------------------------------------------
// O que TEM de ser juntado — os casos relatados no memorial real.
// ---------------------------------------------------------------------------

test('"r" + "espingos" com vao de kerning vira "respingos"', () => {
  assert.equal(textoDosItens(linha(["r", "espingos"], [0.4])), "respingos");
});

test('"d" + "a pia" vira "da pia" (o espaco de dentro do item se preserva)', () => {
  assert.equal(textoDosItens(linha(["d", "a pia"], [0.3])), "da pia");
});

test('"P" + "c" + "D" vira "PcD"', () => {
  assert.equal(textoDosItens(linha(["P", "c", "D"], [0.5, 0.5])), "PcD");
});

test("vao negativo (sobreposicao de negrito falso) tambem e a mesma palavra", () => {
  assert.equal(textoDosItens(linha(["exe", "cutivo"], [-0.6])), "executivo");
});

test("frase inteira picada em letras volta inteira", () => {
  const pedacos = "instalacoes".split("");
  assert.equal(textoDosItens(linha(pedacos, pedacos.map(() => 0.3))), "instalacoes");
});

// ---------------------------------------------------------------------------
// O que NAO pode ser juntado — a metade que impede o conserto de virar defeito.
// ---------------------------------------------------------------------------

test("espaco de verdade entre duas palavras continua espaco", () => {
  assert.equal(textoDosItens(linha(["PROJETO", "EXECUTIVO"], [2.5])), "PROJETO EXECUTIVO");
});

test("espaco APERTADO (0,20 do corpo) ainda e espaco", () => {
  assert.equal(textoDosItens(linha(["kg", "f"], [2.0])), "kg f");
});

test("sigla com pontos nao vira palavra", () => {
  assert.equal(textoDosItens(linha(["P.C.D.", "e", "acessibilidade"], [2.5, 2.5])),
    "P.C.D. e acessibilidade");
});

test("norma e numero seguem separados", () => {
  assert.equal(textoDosItens(linha(["ABNT", "NBR", "9050"], [2.5, 2.5])), "ABNT NBR 9050");
});

test("unidade separada do numero continua separada", () => {
  assert.equal(textoDosItens(linha(["12", "m2"], [2.6])), "12 m2");
});

test("numeracao de item nao vira numero unico", () => {
  assert.equal(textoDosItens(linha(["1.2.3", "Fundacoes"], [3])), "1.2.3 Fundacoes");
});

// ---------------------------------------------------------------------------
// Linha, fim de linha e as bordas.
// ---------------------------------------------------------------------------

test("linha nova sempre separa, por mais alinhado que o x esteja", () => {
  const a: ItemDeTexto = { str: "primeira", transform: [1, 0, 0, CORPO, 100, 700], width: 40, height: CORPO };
  const b: ItemDeTexto = { str: "segunda", transform: [1, 0, 0, CORPO, 100, 686], width: 35, height: CORPO };
  assert.equal(textoDosItens([a, b]), "primeira segunda");
});

test("hasEOL separa mesmo com os itens colados no eixo x", () => {
  const a: ItemDeTexto = { str: "fim", transform: [1, 0, 0, CORPO, 100, 700], width: 15, height: CORPO, hasEOL: true };
  const b: ItemDeTexto = { str: "comeco", transform: [1, 0, 0, CORPO, 115, 700], width: 30, height: CORPO };
  assert.equal(textoDosItens([a, b]), "fim comeco");
});

test("item vazio com hasEOL nao some levando a quebra junto", () => {
  const a: ItemDeTexto = { str: "fim", transform: [1, 0, 0, CORPO, 100, 700], width: 15, height: CORPO };
  const vazio: ItemDeTexto = { str: "", transform: [1, 0, 0, CORPO, 115, 700], width: 0, height: CORPO, hasEOL: true };
  const b: ItemDeTexto = { str: "comeco", transform: [1, 0, 0, CORPO, 115, 700], width: 30, height: CORPO };
  assert.equal(textoDosItens([a, vazio, b]), "fim comeco");
});

test("espaco ja escrito no fim de um item nao vira espaco duplo", () => {
  const itens = linha(["planta ", "baixa"], [0.2]);
  assert.equal(textoDosItens(itens), "planta baixa");
});

test("sem corpo de fonte, erra para o lado de SEPARAR", () => {
  /*
   * Sem altura e sem `transform[3]` não há régua. Grudar às cegas juntaria
   * palavras — o erro que cria achado falso. Separar às cegas apenas mantém o
   * comportamento antigo, que é ruim mas conhecido.
   */
  const a: ItemDeTexto = { str: "a", transform: [1, 0, 0, 0, 100, 700], width: 5, height: 0 };
  const b: ItemDeTexto = { str: "b", transform: [1, 0, 0, 0, 105, 700], width: 5, height: 0 };
  assert.equal(separadorEntreItens(a, b), " ");
});

test("lista vazia devolve string vazia", () => {
  assert.equal(textoDosItens([]), "");
});

// ---------------------------------------------------------------------------
// A QUEBRA DE LINHA PRESERVADA — sem ela, tabela vira sopa de palavras.
//
// Ate 17/08/2026 toda quebra virava espaco e a pagina inteira chegava ao auditor
// como UMA linha. Num quadro de areas ou de acabamentos isso e fatal: nenhum
// modelo consegue dizer que valor pertence a que linha. E colava numeros: no
// sumario do 156-25, o "11" da pagina grudava no "1.1" do item seguinte e virava
// "111.1", um numero que nao existe no documento.
// ---------------------------------------------------------------------------

test("com `quebrarLinhas`, mudanca de linha vira \n", () => {
  const a: ItemDeTexto = { str: "primeira", transform: [1, 0, 0, CORPO, 100, 700], width: 40, height: CORPO };
  const b: ItemDeTexto = { str: "segunda", transform: [1, 0, 0, CORPO, 100, 686], width: 35, height: CORPO };
  assert.equal(textoDosItens([a, b], { quebrarLinhas: true }), "primeira\nsegunda");
});

test("com `quebrarLinhas`, hasEOL vira \n", () => {
  const a: ItemDeTexto = { str: "fim", transform: [1, 0, 0, CORPO, 100, 700], width: 15, height: CORPO, hasEOL: true };
  const b: ItemDeTexto = { str: "comeco", transform: [1, 0, 0, CORPO, 115, 700], width: 30, height: CORPO };
  assert.equal(textoDosItens([a, b], { quebrarLinhas: true }), "fim\ncomeco");
});

test("a quebra NAO desfaz a costura de palavra partida", () => {
  /*
   * O conserto da Etapa 2 (troca de fonte no meio da palavra) continua valendo:
   * "r" + "espingos" na MESMA linha seguem virando "respingos". A quebra so
   * entra onde a linha realmente muda.
   */
  assert.equal(textoDosItens(linha(["r", "espingos"], [0.4]), { quebrarLinhas: true }), "respingos");
});

test("sem a opcao, o comportamento e o de sempre — espaco", () => {
  /*
   * `locateTermOnPage` remonta a pagina com `separadorEntreItens` e procura a
   * evidencia com espacos normalizados. Mudar o padrao quebraria o pin de todo
   * achado cujo trecho atravessa uma linha.
   */
  const a: ItemDeTexto = { str: "primeira", transform: [1, 0, 0, CORPO, 100, 700], width: 40, height: CORPO };
  const b: ItemDeTexto = { str: "segunda", transform: [1, 0, 0, CORPO, 100, 686], width: 35, height: CORPO };
  assert.equal(textoDosItens([a, b]), "primeira segunda");
  assert.equal(separadorEntreItens(a, b), " ");
});

test("uma tabela mantem uma linha por linha", () => {
  const l1 = linha(["Ambiente", "Piso", "Parede"], [40, 40], 700);
  const l2 = linha(["Sala", "Porcelanato", "Pintura"], [40, 40], 686);
  const l3 = linha(["Cozinha", "Ceramica", "Azulejo"], [40, 40], 672);
  const texto = textoDosItens([...l1, ...l2, ...l3], { quebrarLinhas: true });
  assert.deepEqual(texto.split("\n"), [
    "Ambiente Piso Parede",
    "Sala Porcelanato Pintura",
    "Cozinha Ceramica Azulejo",
  ]);
});

console.log(`\n${passed} teste(s) OK`);
