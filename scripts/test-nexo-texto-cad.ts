/**
 * Teste da RECUPERAÇÃO DO TEXTO DE PRANCHA EXPORTADA DE CAD.
 *
 * As strings aqui não são inventadas: saíram do pdf.js sobre os arquivos reais
 * de `docs/samples/040-26` (famílias `est`, `est_fnd`, `est_met`), com o espaço
 * como vem de lá — 0x03, não 0x20. O módulo existe para o modelo parar de
 * copiar `35()(,785$...` como nome do cliente, então o que este teste precisa
 * provar é isto, nos dois sentidos:
 *
 *   1. o que estava quebrado volta a ser palavra;
 *   2. o que NUNCA esteve quebrado não é tocado.
 *
 * A (2) é a que mais importa, e é a que o desenho por FONTE resolve. Uma cota
 * ("150(+/-35)", "X:340103.42") também é "quase só pontuação": olhando string
 * por string ela é indistinguível de prosa quebrada, e um reparo afoito a
 * transforma em "NRMEHLJPRF" — trocando um campo ilegível por um campo errado
 * com cara de certo, que é o único desfecho pior do que não reparar nada.
 *
 *   node scripts/test-nexo-texto-cad.ts   (== npm run test:nexo:texto-cad)
 */
import assert from "node:assert/strict";

import {
  descobrirDeslocamento,
  deslocar,
  pareceTexto,
  repararTextoCad,
  type ItemDeTexto,
} from "../server/nexo/texto-cad.ts";

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

/** O espaço, como o exportador quebrado o escreve. */
const ESP = "";

// Strings REAIS de docs/samples/040-26. O deslocamento deste subset é 29.
const PREFEITURA = `35()(,785$${ESP}081,&,3$/${ESP}'(${ESP}&+$3(&Ï`;
const OBRA = `5(9,7$/,=$d2${ESP}'$${ESP})(,5$${ESP}081,&,3$/`;
const ENDERECO = "(1'(5(d2";
const EMISSAO = `$${ESP}(0,662${ESP},1,&,$/`;
const DIREITOS = `'LUHLWRV${ESP}$XWRUDLV${ESP}/HL`;

/** A fonte quebrada do carimbo (`g_d0_f4` nos arquivos reais). */
const F_QUEBRADA = "g_d0_f4";
/** A fonte sã das cotas e coordenadas (`g_d0_f1`, 1137 itens numa página). */
const F_SA = "g_d0_f1";

/**
 * Texto REAL da fonte sã — a que desenha o corpo da prancha. É o grupo inteiro,
 * cotas E prosa, como ele chega do pdf.js: são as legendas de tabela no meio
 * das cotas que provam que a fonte está sã, e por isso elas fazem parte do
 * caso de teste tanto quanto as coordenadas.
 */
const FONTE_SA_ITENS = [
  "150(+/-35)", // cota com tolerância
  "Ct:-44.5", // cota de terraplenagem
  "(kgf/m²)", // unidade de tabela
  "X:340103.42", // coordenada UTM
  "Y:7000867.53",
  "i=10.28%", // declividade
  "040_26_est_imp_001_a", // código do arquivo no carimbo
  "01/16", // o campo PRANCHA
  "20x30", // seção de pilar
  "2 N7 ø10.0 C=437", // ferro
  "Características dos materiais", // legenda de tabela
  "Área de lajes",
  "Volume de concreto",
];

const item = (texto: string, fonte: string): ItemDeTexto => ({ texto, fonte });

// ---------------------------------------------------------------------------
// O que estava quebrado volta a ser palavra
// ---------------------------------------------------------------------------

test("acha o deslocamento da fonte sem que ele seja cravado", () => {
  assert.equal(descobrirDeslocamento([PREFEITURA, OBRA]), 29);
});

test("PREFEITURA MUNICIPAL DE CHAPECÓ volta, com os espaços", () => {
  const saida = deslocar(PREFEITURA, 29);
  assert.equal(saida, "PREFEITURA MUNICIPAL DE CHAPECÏ");
  assert.ok(pareceTexto(saida));
});

test("o nome da obra volta, com o acento torto e legível", () => {
  // O "Ç" o exportador mapeou por outra tabela: sai "REVITALIZAdO". Torto e
  // reconhecível é o que basta para corroborar o que a imagem mostra.
  assert.equal(deslocar(OBRA, 29), "REVITALIZAdO DA FEIRA MUNICIPAL");
});

test("rótulos do carimbo quebrados voltam", () => {
  const { textos } = repararTextoCad([
    item(ENDERECO, F_QUEBRADA),
    item(EMISSAO, F_QUEBRADA),
    item(DIREITOS, F_QUEBRADA),
  ]);
  assert.equal(textos[0], "ENDEREdO");
  assert.equal(textos[1], "A EMISSO INICIAL");
  assert.equal(textos[2], "Direitos Autorais Lei");
});

test("relata a fonte quebrada e o deslocamento dela", () => {
  const { fontesQuebradas, reparados } = repararTextoCad([
    item(PREFEITURA, F_QUEBRADA),
    item(OBRA, F_QUEBRADA),
  ]);
  assert.deepEqual(fontesQuebradas, [{ fonte: F_QUEBRADA, deslocamento: 29 }]);
  assert.equal(reparados, 2);
});

// ---------------------------------------------------------------------------
// O QUE NUNCA ESTEVE QUEBRADO NÃO É TOCADO — a garantia que mais importa
// ---------------------------------------------------------------------------

test("a fonte das cotas não é tocada, mesmo dividindo a página com a quebrada", () => {
  // O caso real: 1137 cotas e legendas numa fonte sã + 2 linhas de prosa numa
  // quebrada, na MESMA página.
  const itens = [
    ...FONTE_SA_ITENS.map((c) => item(c, F_SA)),
    item(PREFEITURA, F_QUEBRADA),
    item(OBRA, F_QUEBRADA),
  ];
  const { textos, reparados } = repararTextoCad(itens);
  FONTE_SA_ITENS.forEach((c, i) =>
    assert.equal(textos[i], c, `"${c}" não podia ter sido tocado`),
  );
  assert.equal(reparados, 2, "só a fonte quebrada foi deslocada");
  assert.equal(textos[FONTE_SA_ITENS.length], "PREFEITURA MUNICIPAL DE CHAPECÏ");
});

test("prancha da família arq/urb (nada quebrado) não sofre reparo nenhum", () => {
  const itens = FONTE_SA_ITENS.map((c) => item(c, F_SA));
  const { textos, fontesQuebradas, reparados, marcaveis } = repararTextoCad(itens);
  assert.deepEqual(textos, FONTE_SA_ITENS);
  assert.deepEqual(fontesQuebradas, []);
  assert.equal(reparados, 0);
  assert.deepEqual(marcaveis, []);
});

test("uma única legenda legível já basta para a fonte contar como sã", () => {
  // A trava decisiva: fonte que escreve português não é tocada, por mais
  // coordenada que ela tenha em volta.
  const so = ["X:340103.42", "Y:7000867.53", "Ct:-44.5", "Área de lajes"];
  const { reparados } = repararTextoCad(so.map((c) => item(c, F_SA)));
  assert.equal(reparados, 0);
});

test("coordenada e cota não viram palavra inventada", () => {
  assert.equal(pareceTexto(deslocar("X:340103.42", 29)), false);
  assert.equal(pareceTexto(deslocar("150(+/-35)", 29)), false);
});

test("o código da prancha sobrevive: ele mora na fonte sã", () => {
  const itens = FONTE_SA_ITENS.map((c) => item(c, F_SA));
  const { textos } = repararTextoCad(itens);
  assert.ok(textos.includes("040_26_est_imp_001_a"));
  assert.ok(textos.includes("01/16"));
});

// ---------------------------------------------------------------------------
// O que não dá para reparar é DENUNCIADO, não apagado
// ---------------------------------------------------------------------------

test("na fonte quebrada, o que nem o reparo salvou é denunciado", () => {
  // Uma linha longa que nenhum deslocamento resolve fica marcável: o modelo
  // precisa saber que ali não há texto para copiar.
  const itens = [
    item(PREFEITURA, F_QUEBRADA),
    item(OBRA, F_QUEBRADA),
    item("~".repeat(14), F_QUEBRADA),
  ];
  const { marcaveis } = repararTextoCad(itens);
  assert.deepEqual(marcaveis, [2]);
});

test("sem a assinatura da quebra (espaço virado controle), a fonte fica em paz", () => {
  // Prancha de topografia: quase só coordenada, nenhum caractere de controle.
  // É o caso que a contagem de vogais sozinha não segurava — duas coordenadas
  // acham um `k` comum que as torna pronunciáveis.
  const coords = ["X:340103.42", "Y:7000867.53", "X:340107.99", "Y:7000864.86"];
  const { reparados } = repararTextoCad(coords.map((c) => item(c, "g_top_f1")));
  assert.equal(reparados, 0);
});

test("cota em fonte SÃ nunca é marcável, por mais ilegível que pareça", () => {
  const { marcaveis } = repararTextoCad(
    ["150(+/-35)", "Ct:-44.5", "X:340103.42", "Área de lajes"].map((c) => item(c, F_SA)),
  );
  assert.deepEqual(marcaveis, [], "nenhuma cota real pode ser apagada do texto");
});

// ---------------------------------------------------------------------------
// Limites
// ---------------------------------------------------------------------------

test("fonte só de números curtos não dá sinal e é deixada em paz", () => {
  const curtas = ["08", "2,00", "0,15", "AA'", "20x30", "01/16"];
  const { reparados } = repararTextoCad(curtas.map((c) => item(c, "g_d1_f1")));
  assert.equal(reparados, 0);
});

test("acaso não passa: um acerto isolado não declara a fonte quebrada", () => {
  // Duas strings, uma das quais algum k transformaria em algo pronunciável.
  // Sem a segunda corroborando, a fonte fica como está.
  const { reparados } = repararTextoCad([
    item("X:340103.42", "g_d9_fx"),
    item("Y:7000867.53", "g_d9_fx"),
  ]);
  assert.equal(reparados, 0);
});

test("item sem fonte não quebra o agrupamento", () => {
  const { textos } = repararTextoCad([item(PREFEITURA, ""), item(OBRA, "")]);
  assert.equal(textos[0], "PREFEITURA MUNICIPAL DE CHAPECÏ");
});

console.log(`\n${passed} teste(s) ok`);
