/**
 * AS FERRAMENTAS DEVOLVEM A PÁGINA CERTA — E DIZEM QUANDO NÃO ACHARAM.
 *
 * Sem token e sem banco: são funções sobre estruturas, como
 * `server/nexo/agent/fatos.ts` já é.
 *
 * O caso que mais importa aqui é o do termo inexistente. A tentação é devolver
 * "o mais parecido", e ela é o defeito: o modelo trataria a aproximação como
 * ocorrência e citaria uma página onde o termo não está.
 *
 *   node scripts/test-chat-ferramentas.ts  (== npm run test:chat:ferramentas)
 */
import assert from "node:assert/strict";

import {
  TETO_DE_PAGINAS_POR_LEITURA,
  aplicarAchadoNoParecer,
  buscarNoMemorial,
  lerAchado,
  lerPaginas,
  listarCapitulos,
  montarContexto,
  registrarAchado,
  temMemoria,
} from "../server/audit/chat/ferramentas.ts";

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

const memoria = {
  fileName: "063_26.pdf",
  paginas: [
    { page: 40, text: "1 - PAREDES\nAlvenaria em bloco ceramico de vedacao 14x19x39." },
    { page: 41, text: "Chapisco com argamassa de cimento e areia no traco 1:3." },
    { page: 42, text: "2 - PISOS\nPiso vinilico em manta de 2mm sobre contrapiso." },
    { page: 43, text: "Rodape do mesmo material, altura de 10cm." },
    { page: 44, text: "3 - COBERTURA\nTelha metalica termoacustica de 30mm." },
    { page: 45, text: "Calha em chapa galvanizada numero 24." },
    { page: 46, text: "Rufo em chapa galvanizada numero 24." },
  ],
  capitulos: [
    { id: "chunk-1", title: "1 - PAREDES", startPage: 40, endPage: 41, chars: 110 },
    { id: "chunk-2", title: "2 - PISOS", startPage: 42, endPage: 43, chars: 95 },
    { id: "chunk-3", title: "3 - COBERTURA", startPage: 44, endPage: 46, chars: 120 },
  ],
  charCount: 325,
};

const report = {
  arquivo: "063_26.pdf",
  tipo_auditoria: "memorial",
  tipo_documento: "Memorial descritivo",
  total_incongruencias: 1,
  incongruencias: [
    {
      id: "INC-001",
      arquivo: "063_26.pdf",
      prioridade: "Alta",
      pagina: "44",
      capitulo: "3 - COBERTURA",
      local: "Cobertura",
      tipo: "Espessura de telha divergente",
      descricao: "A telha declarada nao bate com a prancha.",
      evidencia: 'Pagina 44: "Telha metalica termoacustica de 30mm"',
      conflito: "A prancha indica 50mm.",
      sugestao_correcao: "Uniformizar a espessura.",
      confianca: "alta",
      origem: "ia",
    },
  ],
} as never;

const ctx = montarContexto(report, [memoria]);

test("com memoria gravada, o contexto diz que tem o documento", () => {
  assert.equal(temMemoria(ctx), true);
  assert.equal(temMemoria(montarContexto(report, [])), false);
});

test("listar_capitulos devolve o indice com pagina inicial e final", () => {
  const saida = listarCapitulos(ctx);
  assert.ok(saida.includes("1 - PAREDES"));
  assert.ok(saida.includes("40"));
  assert.ok(saida.includes("3 - COBERTURA"));
  // O indice nao carrega o texto: e indice, nao o documento.
  assert.ok(!saida.includes("bloco ceramico"), "o indice vazou o texto do capitulo");
});

test("buscar_no_memorial devolve a PAGINA REAL do termo", () => {
  const saida = buscarNoMemorial(ctx, "chapisco");
  assert.ok(/p[aá]gina\s*41/i.test(saida), saida);
  assert.ok(saida.includes("argamassa"), "nao trouxe o texto ao redor");
});

test("busca e imune a acento, caixa e refluxo de espaco", () => {
  const saida = buscarNoMemorial(ctx, "TELHA  METÁLICA");
  assert.ok(/p[aá]gina\s*44/i.test(saida), saida);
});

test("termo que aparece em duas paginas devolve as duas", () => {
  const saida = buscarNoMemorial(ctx, "chapa galvanizada");
  assert.ok(/45/.test(saida) && /46/.test(saida), saida);
});

test("termo que nao existe diz que NAO ACHOU, sem aproximar", () => {
  const saida = buscarNoMemorial(ctx, "impermeabilizacao com manta asfaltica");
  assert.ok(/n[aã]o encontr/i.test(saida), saida);
  // Aproximar seria inventar pagina.
  assert.ok(!/p[aá]gina\s*4\d/i.test(saida), `aproximou: ${saida}`);
});

test("ler_paginas devolve o texto literal do intervalo", () => {
  const saida = lerPaginas(ctx, 40, 41);
  assert.ok(saida.includes("bloco ceramico"));
  assert.ok(saida.includes("argamassa"));
  assert.ok(saida.includes("40") && saida.includes("41"));
});

test("ler_paginas respeita o teto e DIZ que truncou", () => {
  const saida = lerPaginas(ctx, 40, 40 + TETO_DE_PAGINAS_POR_LEITURA + 10);
  assert.ok(/teto|limite/i.test(saida), `nao avisou o truncamento: ${saida}`);
  const lidas = [...saida.matchAll(/--- P[AÁ]GINA (\d+)/gi)].length;
  assert.ok(lidas <= TETO_DE_PAGINAS_POR_LEITURA, `leu ${lidas} paginas`);
});

test("ler_paginas fora do documento nao inventa pagina", () => {
  const saida = lerPaginas(ctx, 900, 905);
  assert.ok(/n[aã]o (existe|encontr)/i.test(saida), saida);
});

test("ler_achado devolve o achado inteiro do parecer", () => {
  const saida = lerAchado(ctx, "INC-001");
  assert.ok(saida.includes("Espessura de telha divergente"));
  assert.ok(saida.includes("A prancha indica 50mm"));
});

test("ler_achado de id inexistente lista os ids validos", () => {
  const saida = lerAchado(ctx, "INC-999");
  assert.ok(/INC-001/.test(saida), `nao ajudou o modelo a se corrigir: ${saida}`);
});

test("sem memoria, as ferramentas de documento dizem que nao ha texto", () => {
  const semTexto = montarContexto(report, []);
  assert.ok(/n[aã]o/i.test(buscarNoMemorial(semTexto, "chapisco")));
  assert.ok(/n[aã]o/i.test(lerPaginas(semTexto, 1, 2)));
  // O parecer continua acessivel: o modo degradado e parcial, nao total.
  assert.ok(lerAchado(semTexto, "INC-001").includes("Espessura"));
});

const proposta = {
  pagina: "41",
  tipo: "Traco de argamassa divergente",
  descricao: "O traco declarado no chapisco nao bate com a norma citada.",
  evidencia: 'Pagina 41: "argamassa de cimento e areia no traco 1:3"',
  conflito: "A norma citada no capitulo 1 exige 1:4.",
  sugestao_correcao: "Uniformizar o traco entre o texto e a norma referenciada.",
  prioridade: "Media",
  impacto: "tecnico_contratual",
} as never;

test("achado com evidencia que ANCORA na pagina declarada e aceito", () => {
  const r = registrarAchado(ctx, proposta);
  assert.equal(r.ok, true, r.ok ? "" : r.mensagem);
  if (!r.ok) return;
  assert.equal(r.achado.origem, "chat");
  assert.equal(r.achado.pagina, "41");
  assert.ok(/^INC-\d{3}$/.test(r.achado.id), `id fora da serie: ${r.achado.id}`);
});

test("achado com trecho que NAO existe no documento e RECUSADO", () => {
  const r = registrarAchado(ctx, {
    ...proposta,
    evidencia: 'Pagina 41: "impermeabilizacao com manta asfaltica de 4mm"',
  } as never);
  assert.equal(r.ok, false);
  // A recusa tem de ENSINAR: o modelo le esta mensagem e tenta de novo.
  assert.ok(/n[aã]o (existe|foi encontrad)/i.test(r.mensagem), r.mensagem);
});

test("trecho que existe em OUTRA pagina e recusado, dizendo qual", () => {
  const r = registrarAchado(ctx, {
    ...proposta,
    pagina: "44",
    evidencia: 'Pagina 44: "argamassa de cimento e areia no traco 1:3"',
  } as never);
  assert.equal(r.ok, false);
  assert.ok(/outra p[aá]gina/i.test(r.mensagem), r.mensagem);
});

test("achado sem transcricao entre aspas e recusado", () => {
  const r = registrarAchado(ctx, { ...proposta, evidencia: "p. 41:" } as never);
  assert.equal(r.ok, false);
  assert.ok(/transcri/i.test(r.mensagem), r.mensagem);
});

test("achado que repete defeito ja no parecer e recusado pela impressao digital", () => {
  // O defeito mais provavel: o modelo "descobrindo" na conversa um achado que
  // acabou de ler no proprio parecer.
  const r = registrarAchado(ctx, {
    ...proposta,
    pagina: "44",
    tipo: "Espessura de telha errada",
    evidencia: 'Pagina 44: "Telha metalica termoacustica de 30mm"',
  } as never);
  assert.equal(r.ok, false);
  assert.ok(/INC-001/.test(r.mensagem), `nao apontou o achado existente: ${r.mensagem}`);
});

test("sem memoria do documento, registrar_achado NAO grava as cegas", () => {
  const r = registrarAchado(montarContexto(report, []), proposta);
  assert.equal(r.ok, false);
  assert.ok(/n[aã]o (h[aá]|tem)/i.test(r.mensagem), r.mensagem);
});

test("aplicar no parecer acrescenta o achado e atualiza o total", () => {
  const r = registrarAchado(ctx, proposta);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const novo = aplicarAchadoNoParecer(report, r.achado);
  assert.equal(novo.incongruencias.length, 2);
  assert.equal(novo.total_incongruencias, 2);
  // O parecer original NAO foi mexido: quem grava decide quando trocar.
  assert.equal(report.incongruencias.length, 1);
});

console.log(`\n${passed} teste(s) de ferramentas do chat OK`);
