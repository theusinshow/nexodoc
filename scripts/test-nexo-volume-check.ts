/**
 * Teste dos núcleos puros da CONFERÊNCIA DO VOLUME MONTADO.
 *
 *   node scripts/test-nexo-volume-check.ts   (== npm run test:nexo:volume-check)
 */
import assert from "node:assert/strict";

import {
  montarPlanoDePaginas,
  paginasDaParte,
  type BlocoDoPlano,
  type PaginaEsperada,
  type ParteDoPlano,
} from "../server/nexo/volume-plano.ts";
import {
  checkVolumeMontado,
  parseLinhasDaLd,
  type AlvoDoVolume,
  type LeituraDaPagina,
  type LinhaDaLdImpressa,
  type VolumeCheckResult,
} from "../server/nexo/volume-check-core.ts";

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

// ---------------------------------------------------------------------------
// Task 1 — quantas páginas cada parte contribui
// ---------------------------------------------------------------------------

test("sem faixa, a parte contribui o documento inteiro", () => {
  assert.equal(paginasDaParte(7), 7);
});

test("com faixa, conta só o intervalo (1-based e inclusivo)", () => {
  assert.equal(paginasDaParte(10, 4, 6), 3);
  assert.equal(paginasDaParte(10, 1, 1), 1);
});

test("faixa que estoura o fim do documento para na última página", () => {
  // O selo mentiu a página. `buildRowPdf` copia só o que existe, e a conta
  // aqui tem de bater com o que ele copiou.
  assert.equal(paginasDaParte(10, 4, 99), 7);
});

test("faixa que começa antes da primeira página começa em 1", () => {
  assert.equal(paginasDaParte(10, 0, 3), 3);
  assert.equal(paginasDaParte(10, -5, 2), 2);
});

test("faixa invertida não vira contagem negativa", () => {
  assert.equal(paginasDaParte(10, 8, 3), 0);
});

test("documento vazio ou inválido contribui zero", () => {
  assert.equal(paginasDaParte(0), 0);
  assert.equal(paginasDaParte(Number.NaN), 0);
});

// ---------------------------------------------------------------------------
// Task 2 — a expectativa por página do PDF final
// ---------------------------------------------------------------------------

/** Um volume real de dois blocos: capa + (sep · LD · pranchas) x2. */
const PARTES: ParteDoPlano[] = [
  { papel: "capa", nome: "capa.pdf", paginas: 1 },
  { papel: "separatriz", nome: "sep-est.pdf", paginas: 1, bloco: "est" },
  { papel: "ld", nome: "ld-est.pdf", paginas: 2, bloco: "est" },
  { papel: "prancha", nome: "est.pdf", paginas: 2, bloco: "est" },
  { papel: "separatriz", nome: "sep-arq.pdf", paginas: 1, bloco: "arq" },
  { papel: "ld", nome: "ld-arq.pdf", paginas: 1, bloco: "arq" },
  { papel: "prancha", nome: "arq.pdf", paginas: 3, bloco: "arq" },
];

const BLOCOS: BlocoDoPlano[] = [
  {
    codigo: "est",
    folhas: [
      { folha: 1, total: 2, codigo: "040_26_est_001_a", titulo: "FORMAS PISO" },
      { folha: 2, total: 2, codigo: "040_26_est_002_a", titulo: "FORMAS TOPO" },
    ],
  },
  {
    codigo: "arq",
    folhas: [
      { folha: 1, total: 3, codigo: "040_26_arq_a", titulo: "IMPLANTACAO" },
      { folha: 2, total: 3, codigo: "040_26_arq_a", titulo: "PLANTA TERREO" },
      { folha: 3, total: 3, codigo: "040_26_arq_a", titulo: "CORTES" },
    ],
  },
];

test("cada página do volume ganha a sua expectativa, na ordem", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  assert.equal(plano.length, 11, "1+1+2+2+1+1+3");
  assert.deepEqual(
    plano.map((p) => p.papel),
    [
      "capa",
      "separatriz", "ld", "ld", "prancha", "prancha",
      "separatriz", "ld", "prancha", "prancha", "prancha",
    ],
  );
  assert.deepEqual(
    plano.map((p) => p.pagina),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  );
});

test("a página de prancha sabe QUAL folha ela deveria ser", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  const est = plano.filter((p) => p.papel === "prancha" && p.bloco === "est");
  assert.deepEqual(
    est.map((p) => [p.pagina, p.folha, p.total]),
    [[5, 1, 2], [6, 2, 2]],
  );
  assert.equal(est[0].codigo, "040_26_est_001_a");
  assert.equal(est[1].titulo, "FORMAS TOPO");
});

test("bloco cujo código do ARQUIVO não traz a folha ainda numera certo", () => {
  // A família `arq` imprime "040_26_arq_a" em TODAS as folhas. Quem numera é a
  // ordem dentro do bloco, não o código.
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  const arq = plano.filter((p) => p.papel === "prancha" && p.bloco === "arq");
  assert.deepEqual(arq.map((p) => p.folha), [1, 2, 3]);
  assert.deepEqual(
    arq.map((p) => p.codigo),
    ["040_26_arq_a", "040_26_arq_a", "040_26_arq_a"],
  );
});

test("a capa do volume não pertence a bloco nenhum", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  assert.equal(plano[0].papel, "capa");
  assert.equal(plano[0].bloco, "");
});

test("mais páginas de prancha do que folhas na LD: o excedente fica sem expectativa", () => {
  // Não é erro DESTE módulo julgar — ele só descreve. Quem acusa é o core.
  const plano = montarPlanoDePaginas(
    [{ papel: "prancha", nome: "x.pdf", paginas: 3, bloco: "est" }],
    [{ codigo: "est", folhas: [{ folha: 1, total: 1, codigo: null, titulo: null }] }],
  );
  assert.equal(plano.length, 3);
  assert.equal(plano[0].folha, 1);
  assert.equal(plano[1].folha, null);
  assert.equal(plano[2].folha, null);
});

test("volume sem capa e sem LD (só pranchas) não quebra", () => {
  const plano = montarPlanoDePaginas(
    [{ papel: "prancha", nome: "x.pdf", paginas: 2, bloco: "" }],
    [],
  );
  assert.deepEqual(plano.map((p) => p.papel), ["prancha", "prancha"]);
  assert.equal(plano[0].folha, null);
});

test("parte de zero páginas não ocupa lugar no volume", () => {
  // Faixa invertida ou PDF vazio: a parte não entrou, e a numeração das
  // seguintes não pode escorregar por causa dela.
  const plano = montarPlanoDePaginas(
    [
      { papel: "separatriz", nome: "sep.pdf", paginas: 0, bloco: "est" },
      { papel: "prancha", nome: "x.pdf", paginas: 2, bloco: "est" },
    ],
    [{ codigo: "est", folhas: [{ folha: 1, total: 2, codigo: null, titulo: null }, { folha: 2, total: 2, codigo: null, titulo: null }] }],
  );
  assert.deepEqual(plano.map((p) => p.pagina), [1, 2]);
  assert.deepEqual(plano.map((p) => p.papel), ["prancha", "prancha"]);
});

// ---------------------------------------------------------------------------
// Task 3 — estrutura
// ---------------------------------------------------------------------------

const ALVO: AlvoDoVolume = { orgao: "Prefeitura Municipal de Chapecó", pageCount: 11 };

/**
 * O achado daquele campo, ou explode. Existe em vez de `assert.ok(f)` porque as
 * funções de asserção do node não estreitam o tipo de forma confiável aqui — e
 * um teste que não compila não protege nada.
 */
function achado(r: VolumeCheckResult, campo: string, filtro?: RegExp) {
  const f = r.findings.find(
    (x) => x.campo === campo && (!filtro || filtro.test(x.mensagem)),
  );
  if (!f) {
    throw new Error(
      `esperava um achado de "${campo}"${filtro ? ` casando ${filtro}` : ""}; achados: ${JSON.stringify(r.findings, null, 2)}`,
    );
  }
  return f;
}

function semAchado(r: VolumeCheckResult, campo: string) {
  const f = r.findings.find((x) => x.campo === campo);
  if (f) throw new Error(`não esperava achado de "${campo}": ${JSON.stringify(f)}`);
}

/** Leitura de uma página que bate exatamente com o gabarito. */
function leituraPerfeita(p: PaginaEsperada): LeituraDaPagina {
  const prancha = p.papel === "prancha";
  return {
    pagina: p.pagina,
    temCarimbo: prancha,
    numeracaoTexto: prancha && p.folha ? `${p.folha}/${p.total}` : "",
    folha: p.folha,
    total: p.total,
    codigo: p.codigo ?? "",
    titulo: p.titulo ?? "",
    disciplina: prancha ? p.bloco.toUpperCase() : "",
    orgao: prancha ? "PREFEITURA MUNICIPAL DE CHAPECO" : "",
    obra: prancha ? "REVITALIZACAO DA FEIRA MUNICIPAL" : "",
  };
}

const PLANO = montarPlanoDePaginas(PARTES, BLOCOS);
const LEITURA_OK = PLANO.map(leituraPerfeita);

/** A leitura completa, com uma página trocada. */
function comPagina(pagina: number, patch: Partial<LeituraDaPagina>): LeituraDaPagina[] {
  return LEITURA_OK.map((l) => (l.pagina === pagina ? { ...l, ...patch } : l));
}

test("volume perfeito dá ok e não inventa achado", () => {
  const r = checkVolumeMontado(PLANO, LEITURA_OK, ALVO);
  assert.equal(r.veredito, "ok", JSON.stringify(r.findings, null, 2));
  assert.equal(r.paginasConferidas, 11);
});

test("pageCount diferente do plano é crítico", () => {
  const r = checkVolumeMontado(PLANO, LEITURA_OK, { ...ALVO, pageCount: 12 });
  assert.equal(achado(r, "paginas").severidade, "critico");
  assert.equal(r.veredito, "critico");
});

test("página que deveria ser prancha e chega sem carimbo é crítico", () => {
  // A faixa recortada trouxe capa ou índice para dentro do bloco.
  const r = checkVolumeMontado(PLANO, comPagina(5, { temCarimbo: false }), ALVO);
  const f = achado(r, "papel");
  assert.equal(f.severidade, "critico");
  assert.match(f.detalhe ?? "", /p\.5/);
});

test("página que deveria ser LD e chega com carimbo de prancha é crítico", () => {
  const r = checkVolumeMontado(PLANO, comPagina(3, { temCarimbo: true }), ALVO);
  assert.equal(achado(r, "papel").severidade, "critico");
});

test("página não lida não vira acusação de papel trocado", () => {
  // Sem leitura não há prova de nada; acusar seria inventar defeito.
  const r = checkVolumeMontado(PLANO, comPagina(5, { temCarimbo: false, erro: "timeout" }), ALVO);
  semAchado(r, "papel");
});

// ---------------------------------------------------------------------------
// Task 4 — conteúdo página a página
// ---------------------------------------------------------------------------

test("numeração divergente numa página isolada é AVISO, não crítico", () => {
  // Leitura erra. Um crítico aqui ensinaria a ignorar o semáforo.
  const r = checkVolumeMontado(PLANO, comPagina(6, { folha: 7 }), ALVO);
  assert.equal(achado(r, "numeracao").severidade, "aviso");
  assert.equal(r.veredito, "aviso");
});

test("uma leitura ruim num bloco de duas folhas NÃO vira faixa deslocada", () => {
  // Metade do bloco, mas uma página só: padrão começa em duas. Sem este piso,
  // um bloco pequeno transforma todo ruído de OCR em crítico.
  const r = checkVolumeMontado(PLANO, comPagina(6, { folha: 7 }), ALVO);
  semAchado(r, "faixa");
});

test("bloco inteiro deslocado com o MESMO offset é CRÍTICO", () => {
  // Não é ruído: é a faixa recortada errada. As 3 folhas do arq lidas como 2,3,4.
  const lido = LEITURA_OK.map((l) =>
    l.pagina >= 9 && l.pagina <= 11 && l.folha != null ? { ...l, folha: l.folha + 1 } : l,
  );
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = achado(r, "faixa");
  assert.equal(f.severidade, "critico");
  assert.match(f.mensagem, /ARQ/i);
});

test("a faixa deslocada NÃO gera também falta e duplicata da mesma causa", () => {
  const lido = LEITURA_OK.map((l) =>
    l.pagina >= 9 && l.pagina <= 11 && l.folha != null ? { ...l, folha: l.folha + 1 } : l,
  );
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  semAchado(r, "sequencia");
});

test("folha esperada ausente do volume é crítico", () => {
  const r = checkVolumeMontado(
    PLANO,
    comPagina(10, { folha: null, numeracaoTexto: "" }),
    ALVO,
  );
  assert.equal(achado(r, "sequencia", /faltando/i).severidade, "critico");
});

test("folha duplicada dentro do bloco é crítico", () => {
  const r = checkVolumeMontado(PLANO, comPagina(10, { folha: 1 }), ALVO);
  assert.equal(achado(r, "sequencia", /duplicad/i).severidade, "critico");
});

test("disciplina lida diferente do bloco em que a página caiu é crítico", () => {
  const r = checkVolumeMontado(PLANO, comPagina(5, { disciplina: "ARQ" }), ALVO);
  assert.equal(achado(r, "disciplina").severidade, "critico");
});

test("o carimbo por extenso casa com o código do bloco", () => {
  // "ESTRUTURAL" no carimbo, "est" no plano: é a mesma disciplina.
  const r = checkVolumeMontado(PLANO, comPagina(5, { disciplina: "ESTRUTURAL" }), ALVO);
  semAchado(r, "disciplina");
});

test("disciplina em branco não acusa nada (o carimbo nem sempre traz)", () => {
  const r = checkVolumeMontado(PLANO, comPagina(5, { disciplina: "" }), ALVO);
  semAchado(r, "disciplina");
});

// ---------------------------------------------------------------------------
// Task 5 — a LD impressa × o volume
// ---------------------------------------------------------------------------

/** Texto de uma página de LD como sai da extração posicional: linha a linha. */
const TEXTO_LD_EST = [
  "LISTA DE DOCUMENTOS",
  "FOLHA ARQUIVOS DESCRIÇÃO",
  "01/02 040_26_est_001_a FORMAS PISO",
  "02/02 040_26_est_002_a FORMAS TOPO",
].join("\n");

test("lê as linhas da LD impressa", () => {
  assert.deepEqual(parseLinhasDaLd(TEXTO_LD_EST), [
    { sheet: "01/02", file: "040_26_est_001_a", description: "FORMAS PISO" },
    { sheet: "02/02", file: "040_26_est_002_a", description: "FORMAS TOPO" },
  ]);
});

test("o cabeçalho e o título da LD não viram linha", () => {
  assert.equal(parseLinhasDaLd("LISTA DE DOCUMENTOS\nFOLHA ARQUIVOS DESCRIÇÃO").length, 0);
});

test("a numeração pode vir com espaços em volta da barra", () => {
  assert.deepEqual(parseLinhasDaLd("01 / 16 040_26_arq_a IMPLANTACAO"), [
    { sheet: "01/16", file: "040_26_arq_a", description: "IMPLANTACAO" },
  ]);
});

/** A LD do bloco `est` é a página 3; é ela que carrega as linhas impressas. */
function comLdImpressa(linhas: LinhaDaLdImpressa[]): LeituraDaPagina[] {
  return comPagina(3, { linhasDaLd: linhas });
}

test("LD impressa que bate com as pranchas não acusa nada", () => {
  const r = checkVolumeMontado(PLANO, comLdImpressa(parseLinhasDaLd(TEXTO_LD_EST)), ALVO);
  semAchado(r, "ld");
  assert.equal(r.veredito, "ok", JSON.stringify(r.findings, null, 2));
});

test("LD VELHA (lista folha que não está no volume) é crítico", () => {
  const velha = parseLinhasDaLd(`${TEXTO_LD_EST}\n03/03 040_26_est_003_a DETALHES`);
  const r = checkVolumeMontado(PLANO, comLdImpressa(velha), ALVO);
  const f = achado(r, "ld");
  assert.equal(f.severidade, "critico");
  assert.match(f.detalhe ?? "", /040_26_est_003_a/);
});

test("LD que não lista uma prancha presente é crítico", () => {
  const curta = parseLinhasDaLd("01/02 040_26_est_001_a FORMAS PISO");
  const r = checkVolumeMontado(PLANO, comLdImpressa(curta), ALVO);
  assert.equal(achado(r, "ld").severidade, "critico");
});

test("bloco sem LD impressa legível não acusa (não dá para comparar)", () => {
  const r = checkVolumeMontado(PLANO, LEITURA_OK, ALVO);
  semAchado(r, "ld");
});

test("família de código repetido cai na CONTAGEM, não no código", () => {
  // `arq` imprime "040_26_arq_a" nas três folhas: o código não separa nada.
  // A LD do arq é a página 8; com duas linhas para três pranchas, acusa.
  const lido = comPagina(8, {
    linhasDaLd: parseLinhasDaLd(
      ["01/03 040_26_arq_a IMPLANTACAO", "02/03 040_26_arq_a PLANTA TERREO"].join("\n"),
    ),
  });
  const f = achado(checkVolumeMontado(PLANO, lido, ALVO), "ld");
  assert.equal(f.severidade, "critico");
  assert.match(f.mensagem, /2 folha\(s\).*3/);
});

test("família de código repetido com a contagem certa não acusa", () => {
  const lido = comPagina(8, {
    linhasDaLd: parseLinhasDaLd(
      [
        "01/03 040_26_arq_a IMPLANTACAO",
        "02/03 040_26_arq_a PLANTA TERREO",
        "03/03 040_26_arq_a CORTES",
      ].join("\n"),
    ),
  });
  semAchado(checkVolumeMontado(PLANO, lido, ALVO), "ld");
});

console.log(`\n${passed} teste(s) ok`);
