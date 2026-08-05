/**
 * Teste de ONDE FICA O SELO e DO QUE A PÁGINA É.
 *
 * As posições vêm das pranchas reais de `docs/samples/040-26`, medidas com
 * pdf.js: numa A0 de 2384×1684, os rótulos do carimbo ficam em
 * PRANCHA(0.95, 0.95) · CONTEÚDO(0.79, 0.95) · ESCALA(0.79, 0.98) ·
 * ARQUIVO(0.87, 0.98) · CLIENTE(0.92, 0.92) · OBRA(0.79, 0.89); nas de
 * 3370×1684 o carimbo começa em x = 0.85.
 *
 * O que precisa ficar provado:
 *
 *   1. a caixa contém o carimbo INTEIRO e deixa a tabela de lajes de fora;
 *   2. o campo PRANCHA sai em ordem de leitura ("EST 01/15", não "EST 15 01/");
 *   3. capa e índice são reconhecidos, e NADA MAIS é descartado.
 *
 *   node scripts/test-nexo-selo-regiao.ts   (== npm run test:nexo:selo-regiao)
 */
import assert from "node:assert/strict";

import {
  CAIXA_FALLBACK,
  acharCaixaDoSelo,
  classificarPagina,
  conteudoDoSelo,
  dentro,
  textoPorPosicao,
  valeLerComoPrancha,
  type ItemPosicionado,
} from "../server/nexo/selo-regiao.ts";

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

const it = (texto: string, x: number, y: number): ItemPosicionado => ({ texto, x, y });

/** Os rótulos do carimbo de uma A0 real (2384×1684). */
const CARIMBO_A0: ItemPosicionado[] = [
  it("OBRA:", 0.79, 0.89),
  it("CLIENTE:", 0.92, 0.92),
  it("CONTEÚDO:", 0.79, 0.95),
  it("PRANCHA:", 0.95, 0.95),
  it("ESCALA:", 0.79, 0.98),
  it("ARQUIVO:", 0.87, 0.98),
];

/** O corpo do desenho: tabela de lajes e coordenadas, longe do carimbo. */
const CORPO_DO_DESENHO: ItemPosicionado[] = [
  it("LA119", 0.62, 0.58),
  it("Maciça", 0.66, 0.58),
  it("500", 0.7, 0.58),
  it("X:340103.42", 0.6, 0.72),
  it("Área de lajes", 0.58, 0.8),
  it("Dimensão máxima do agregado = 19 mm", 0.6, 0.83),
];

// ---------------------------------------------------------------------------
// A caixa do carimbo
// ---------------------------------------------------------------------------

test("acha a caixa pelas âncoras e ela contém o carimbo inteiro", () => {
  const { caixa, ancoras } = acharCaixaDoSelo([...CORPO_DO_DESENHO, ...CARIMBO_A0]);
  assert.equal(ancoras, 6);
  for (const rotulo of CARIMBO_A0) {
    assert.ok(dentro(rotulo, caixa), `"${rotulo.texto}" ficou de fora da caixa`);
  }
  assert.equal(caixa.x1, 1, "a caixa vai até a borda: é lá que fica a numeração");
  assert.equal(caixa.y1, 1);
});

test("a caixa aperta o suficiente para deixar a tabela de lajes de fora", () => {
  const { caixa } = acharCaixaDoSelo([...CORPO_DO_DESENHO, ...CARIMBO_A0]);
  const fora = CORPO_DO_DESENHO.filter((i) => !dentro(i, caixa));
  assert.equal(fora.length, CORPO_DO_DESENHO.length, "nada do desenho podia entrar");
});

test("na geometria real, a caixa medida é bem mais apertada que o quadrante", () => {
  const { caixa } = acharCaixaDoSelo(CARIMBO_A0);
  const areaMedida = (1 - caixa.x0) * (1 - caixa.y0);
  const areaAntiga = (1 - CAIXA_FALLBACK.x0) * (1 - CAIXA_FALLBACK.y0);
  assert.ok(areaMedida < areaAntiga / 3, `medida ${areaMedida} vs antiga ${areaAntiga}`);
});

test("âncora fora do canto manda na caixa: quem mede é ela, não a convenção", () => {
  // Carimbo em faixa horizontal no rodapé, como alguns escritórios desenham.
  // A caixa acompanha, mesmo ficando MAIOR que o quadrante antigo — é para
  // isso que se mede.
  const faixa = [it("OBRA:", 0.05, 0.9), it("CLIENTE:", 0.4, 0.9), it("PRANCHA:", 0.9, 0.9)];
  const { caixa } = acharCaixaDoSelo(faixa);
  assert.ok(caixa.x0 < CAIXA_FALLBACK.x0);
  for (const rotulo of faixa) assert.ok(dentro(rotulo, caixa));
});

test("prancha larga (3370×1684): a caixa acompanha o carimbo mais à direita", () => {
  // Medido no mesmo arquivo: no papel mais largo, o carimbo ocupa uma fatia
  // menor da largura, e o quadrante fixo erra ainda mais feio.
  const carimboLargo: ItemPosicionado[] = [
    it("OBRA:", 0.85, 0.89),
    it("CLIENTE:", 0.94, 0.92),
    it("CONTEÚDO:", 0.85, 0.95),
    it("PRANCHA:", 0.97, 0.95),
    it("ESCALA:", 0.85, 0.98),
    it("ARQUIVO:", 0.91, 0.98),
  ];
  const { caixa } = acharCaixaDoSelo(carimboLargo);
  const { caixa: normal } = acharCaixaDoSelo(CARIMBO_A0);
  assert.ok(caixa.x0 > normal.x0, "carimbo mais estreito, caixa mais estreita");
  for (const rotulo of carimboLargo) assert.ok(dentro(rotulo, caixa), rotulo.texto);
});

test("sem âncora, cai no quadrante antigo — pior do que hoje, nunca", () => {
  const { caixa, ancoras } = acharCaixaDoSelo(CORPO_DO_DESENHO);
  assert.equal(ancoras, 0);
  assert.deepEqual(caixa, CAIXA_FALLBACK);
});

test("duas âncoras não bastam (ESCALA aparece solta em corte)", () => {
  const { caixa, ancoras } = acharCaixaDoSelo([it("ESCALA:", 0.2, 0.3), it("PROJETO", 0.25, 0.3)]);
  assert.equal(ancoras, 2);
  assert.deepEqual(caixa, CAIXA_FALLBACK, "âncora frouxa não pode mover a caixa");
});

// ---------------------------------------------------------------------------
// A ordem de leitura — o campo PRANCHA
// ---------------------------------------------------------------------------

test("o campo PRANCHA sai em ordem de leitura, não na ordem do PDF", () => {
  // Como o PDF os desenha: "EST", depois "15", depois "01/". Como se lê:
  // "EST" numa linha, "01/ 15" na de baixo.
  const itens = [
    it("EST", 0.96, 0.95),
    it("15", 0.975, 0.965),
    it("01/", 0.96, 0.965),
  ];
  const texto = textoPorPosicao(itens, { x0: 0.9, y0: 0.9, x1: 1, y1: 1 });
  assert.equal(texto, "EST\n01/ 15");
});

test("itens na mesma linha saem da esquerda para a direita", () => {
  const itens = [
    it("JUNHO/2026", 0.93, 0.98),
    it("INDICADA", 0.86, 0.98),
    it("ESCALA:", 0.8, 0.98),
  ];
  const texto = textoPorPosicao(itens, CAIXA_FALLBACK);
  assert.equal(texto, "ESCALA: INDICADA JUNHO/2026");
});

test("linhas diferentes não se misturam", () => {
  const itens = [
    it("OBRA:", 0.79, 0.89),
    it("REVITALIZAÇÃO DA FEIRA", 0.83, 0.89),
    it("ENDEREÇO:", 0.79, 0.92),
    it("TRAVESSA BRASIL", 0.83, 0.92),
  ];
  const texto = textoPorPosicao(itens, CAIXA_FALLBACK);
  assert.equal(texto, "OBRA: REVITALIZAÇÃO DA FEIRA\nENDEREÇO: TRAVESSA BRASIL");
});

test("o texto fora da caixa não entra", () => {
  const texto = textoPorPosicao(
    [...CORPO_DO_DESENHO, it("ARQUIVO:", 0.87, 0.98)],
    { x0: 0.75, y0: 0.85, x1: 1, y1: 1 },
  );
  assert.equal(texto, "ARQUIVO:");
});

// ---------------------------------------------------------------------------
// O CONTEÚDO pela geometria da grade
// ---------------------------------------------------------------------------

test("família est: o valor está na linha DE BAIXO do rótulo", () => {
  const itens = [
    ...CARIMBO_A0,
    it("BLOCO A E BLOCO B: PLANTA DE FORMAS PISO", 0.795, 0.962),
    it("EST", 0.96, 0.962), // o valor do PRANCHA, na célula ao lado
    it("INDICADA", 0.83, 0.98), // o valor do ESCALA, na célula de baixo
  ];
  assert.equal(conteudoDoSelo(itens), "BLOCO A E BLOCO B: PLANTA DE FORMAS PISO");
});

test("família arq: o valor está na MESMA linha do rótulo", () => {
  const itens = [
    ...CARIMBO_A0,
    it("IMPLANTAÇÃO TÉRREO - EIXOS E SETORIZAÇÃO", 0.82, 0.95),
    it("ARQ", 0.96, 0.962),
  ];
  assert.equal(conteudoDoSelo(itens), "IMPLANTAÇÃO TÉRREO - EIXOS E SETORIZAÇÃO");
});

test("a célula fecha antes do código do arquivo — título e código não grudam", () => {
  // O defeito medido: sem o limite de baixo, saía "...FORMAS PISO ESTRUTURAL
  // 040_26_est_bl.a_bl.b_001_a".
  const itens = [
    ...CARIMBO_A0,
    it("BLOCO A E BLOCO B: CORTES", 0.795, 0.962),
    it("040_26_est_bl.a_bl.b_004_a", 0.88, 0.985),
    it("ESTRUTURAL", 0.93, 0.985),
  ];
  assert.equal(conteudoDoSelo(itens), "BLOCO A E BLOCO B: CORTES");
});

test("rótulo com acento QUEBRADO ainda é reconhecido", () => {
  // Na família EST o exportador entrega "CONTEdDO" — e era por isso que as 14
  // pranchas de est_met voltavam sem título nenhum.
  const itens = [
    it("CONTEdDO:", 0.79, 0.95),
    it("PRANCHA:", 0.95, 0.95),
    it("PERSPECTIVA GERAL E CORTE LONGITUDINAL", 0.795, 0.962),
  ];
  assert.equal(conteudoDoSelo(itens), "PERSPECTIVA GERAL E CORTE LONGITUDINAL");
});

test("sem rótulo CONTEÚDO, devolve vazio — não inventa título", () => {
  assert.equal(conteudoDoSelo(CORPO_DO_DESENHO), "");
});

test("célula vazia devolve vazio", () => {
  assert.equal(conteudoDoSelo(CARIMBO_A0), "");
});

// ---------------------------------------------------------------------------
// O que a página é
// ---------------------------------------------------------------------------

const A0 = { largura: 2384, altura: 1684 };
const A4 = { largura: 595, altura: 842 };

test("prancha A0 com carimbo é prancha", () => {
  const tipo = classificarPagina({ ...A0, itens: [...CORPO_DO_DESENHO, ...CARIMBO_A0] });
  assert.equal(tipo, "prancha");
  assert.equal(valeLerComoPrancha(tipo), true);
});

test("o índice A4 que lista os códigos das pranchas é índice, e não se lê", () => {
  // A página 3 de todo PDF combinado: quinze códigos, nenhum carimbo. Lida
  // como prancha, ela devolvia o primeiro código da lista — e a folha
  // duplicada reatribuía a numeração do conjunto inteiro.
  const itens = [
    it("040_26_est_bl.a_bl.b_001_a", 0.25, 0.2),
    it("040_26_est_bl.a_bl.b_002_a", 0.25, 0.24),
    it("040_26_est_bl.a_bl.b_003_a", 0.25, 0.29),
    it("VIGAS COBERTURA (1/3)", 0.6, 0.2),
  ];
  const tipo = classificarPagina({ ...A4, itens });
  assert.equal(tipo, "indice");
  assert.equal(valeLerComoPrancha(tipo), false);
});

test("a capa A4 é capa, e não se lê", () => {
  const tipo = classificarPagina({ ...A4, itens: [it("Vol. VI", 0.6, 0.6), it("JUNHO/2026", 0.7, 0.6)] });
  assert.equal(tipo, "capa");
  assert.equal(valeLerComoPrancha(tipo), false);
});

// ---------------------------------------------------------------------------
// NADA MAIS é descartado — o lado conservador da classificação
// ---------------------------------------------------------------------------

test("prancha ESCANEADA, sem uma linha de texto, continua sendo lida", () => {
  // Sem texto não há âncora nem código: é o caso em que sumir com a folha
  // seria o estrago maior. Papel grande em paisagem passa.
  const tipo = classificarPagina({ ...A0, itens: [] });
  assert.equal(tipo, "outra");
  assert.equal(valeLerComoPrancha(tipo), true, "prancha escaneada não pode sumir");
});

test("folha de detalhes em A4 COM carimbo é prancha — o carimbo decide primeiro", () => {
  const tipo = classificarPagina({ ...A4, itens: CARIMBO_A0 });
  assert.equal(tipo, "prancha");
});

test("prancha que lista códigos numa tabela não vira índice: ela tem carimbo", () => {
  const itens = [
    ...CARIMBO_A0,
    it("040_26_est_imp_001_a", 0.3, 0.3),
    it("040_26_est_imp_002_a", 0.3, 0.34),
    it("040_26_est_imp_003_a", 0.3, 0.38),
  ];
  assert.equal(classificarPagina({ ...A0, itens }), "prancha");
});

test("A2 em pé é papel de prancha, não de capa", () => {
  const tipo = classificarPagina({ largura: 1190, altura: 1684, itens: [] });
  assert.equal(tipo, "outra");
  assert.equal(valeLerComoPrancha(tipo), true);
});

console.log(`\n${passed} teste(s) ok`);
