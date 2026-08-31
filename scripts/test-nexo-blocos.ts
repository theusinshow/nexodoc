/**
 * Teste dos BLOCOS: o volume de várias disciplinas.
 *
 *   node scripts/test-nexo-blocos.ts   (== npm run test:nexo:blocos)
 *
 * Os casos são os volumes REAIS de `docs/samples` — 040-26, 113-22, 116-25 e
 * 156-25. O volume 10 de 040-26 (`his_inc_spd`) tem, no disco, uma capa e TRÊS
 * separatrizes e TRÊS LDs; o volume 3, seis de cada. Se o agrupamento aqui não
 * devolver três e seis blocos, o volume montado sai com uma separatriz só e as
 * outras disciplinas entram caladas sob o título errado.
 *
 * As disciplinas de cada nome de arquivo (`DO_NOME`) são a saída VERIFICADA do
 * `parseFilename` de produção — ele não pode ser importado aqui (importa por
 * caminho sem extensão, e node cru não resolve), então entra como dado, não
 * como lógica repetida.
 */
import assert from "node:assert/strict";

import {
  blocoGera,
  blocosDasFolhas,
  codigoDoRotulo,
  escolherCodigo,
  fundirBlocos,
  misturaDisciplinas,
  resumoDosBlocos,
  tabelasDoLexico,
} from "../modules/nexo/lib/blocos.ts";
import { folhas } from "../modules/nexo/lib/folhas.ts";
import type { Folha } from "../modules/nexo/lib/folhas.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";
// O léxico REAL do escritório. Um dublê aqui só provaria que o Map funciona.
import {
  DISCIPLINA_LEXICON,
  QUALIFICADORES_DA_DISCIPLINA,
} from "../server/nexo/disciplinas.ts";

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

// As MESMAS tabelas da produção — com qualificadores. Montá-las sem eles aqui
// testaria uma configuração que não existe em lugar nenhum.
const TABELAS = tabelasDoLexico(DISCIPLINA_LEXICON, QUALIFICADORES_DA_DISCIPLINA);

/** Saída verificada do `parseFilename` de produção para nomes reais. */
const DO_NOME: Record<string, string[]> = {
  "040_26_his_001_a.pdf": ["his"],
  "040_26_inc_003_a.pdf": ["inc"],
  "040_26_spd_002_a.pdf": ["spd"],
  "040_26_vol10_his_inc_spd_a.pdf": ["his", "inc", "spd"],
  "125-23_top_001_A1.pdf": ["top"],
  "ge_040-26_eixos-PLANTA-A1-500.pdf": [],
  "te_040-26_DDM_R00.pdf": [],
  "Relatorio de Sondagem - Camelodromo.pdf": [],
  "040_26_dre_001_a.pdf": ["dre"],
  "040_26_dre_002_a.pdf": ["dre"],
  "pav_040-26_Sec-tipo-FORMATO_A1-500.pdf": ["pav"],
  "040_26_arq_007_a.pdf": ["arq"],
  "040_26_arq_008_a.pdf": ["arq"],
};

function selo(fileName: string, pageNumber: number, disciplina: string): SeloForLd {
  return {
    fileName,
    pageNumber,
    disciplina,
    folha: pageNumber,
    conteudo: `Folha ${pageNumber}`,
  } as SeloForLd;
}

/** A ligação de produção, com as disciplinas do nome entrando como dado. */
function codigoDe(f: Folha): string {
  return escolherCodigo(
    {
      manual: f.disciplinaManual ? (f.disciplina ?? "") : "",
      doNome: DO_NOME[f.fileName] ?? [],
      doCarimbo: f.disciplina ?? "",
    },
    TABELAS,
  );
}

const rotuloDe = (codigo: string) => DISCIPLINA_LEXICON[codigo] ?? "";
const blocosDe = (lista: Folha[]) => blocosDasFolhas(lista, codigoDe, rotuloDe);

// ---------------------------------------------------------------- o léxico

test("o carimbo por extenso volta a virar código", () => {
  assert.equal(codigoDoRotulo("DRENAGEM", TABELAS), "dre");
  assert.equal(codigoDoRotulo("Topografia", TABELAS), "top");
  assert.equal(codigoDoRotulo("dre", TABELAS), "dre");
});

test("o carimbo qualificado casa pelo prefixo do rótulo", () => {
  // O carimbo raramente traz o rótulo pelado: "ESTRUTURAL CONCRETO",
  // "ARQUITETONICO - REFORMA". Exigir igualdade exata jogaria fora a leitura boa.
  assert.equal(codigoDoRotulo("ESTRUTURAL CONCRETO", TABELAS), "est");
  assert.equal(codigoDoRotulo("Arquitetonico - reforma", TABELAS), "arq");
});

test("metálica não cai no bloco do concreto", () => {
  // "Estrutura metalica" começa com "Estrutura", que é prefixo de "Estrutural".
  // Vence o rótulo MAIS LONGO que casa — senão os dois volumes viram um.
  assert.equal(codigoDoRotulo("ESTRUTURA METALICA", TABELAS), "met");
  assert.equal(codigoDoRotulo("Estrutural", TABELAS), "est");
});

test("o carimbo que escreve ESTRUTURAL METÁLICO não vira concreto", () => {
  /*
   * O caso real (31/08/2026): um volume inteiro de estrutural metálico saiu com
   * "PROJETO ESTRUTURAL CONCRETO" na capa e na LD. "estrutural metalico" COMEÇA
   * com "estrutural" (`est`) e NÃO começa com "estrutura metalica" (`met`),
   * então a regra do prefixo mais longo nem chegava a considerar o metálico — o
   * rótulo dele não era candidato. Quem decide agora é o qualificador.
   */
  for (const escrito of [
    "ESTRUTURAL METÁLICO",
    "ESTRUTURAL METALICO",
    "ESTRUTURAL - METÁLICA",
    "PROJETO ESTRUTURAL METÁLICO",
    "Cobertura metálica",
  ]) {
    assert.equal(codigoDoRotulo(escrito, TABELAS), "met", escrito);
  }
});

test("o qualificador não rouba o concreto", () => {
  assert.equal(codigoDoRotulo("ESTRUTURAL CONCRETO", TABELAS), "est");
  assert.equal(codigoDoRotulo("Estrutural", TABELAS), "est");
  assert.equal(codigoDoRotulo("CONCRETO ARMADO", TABELAS), "est");
});

test("duas famílias qualificando o mesmo texto NÃO decidem", () => {
  /*
   * "Estrutural concreto e metálico" numa folha só é uma folha que o sistema não
   * sabe classificar. Escolher uma das duas poria metade do volume sob o título
   * errado, calado; cair no prefixo (aqui, `est`) mantém a regra antiga, e onde
   * nem ela resolver a folha vai para o bloco "sem disciplina", que é visível.
   */
  assert.equal(codigoDoRotulo("ESTRUTURAL CONCRETO E METALICO", TABELAS), "est");
});

test("grafias irmãs do léxico dão o mesmo bloco", () => {
  // `elt` e `ele` são "Eletrico"; `cft` e `cftv` são "CFTV". Sem canonizar, um
  // volume com as duas grafias sairia com duas separatrizes para a mesma coisa.
  assert.equal(codigoDoRotulo("ele", TABELAS), codigoDoRotulo("elt", TABELAS));
  assert.equal(codigoDoRotulo("cftv", TABELAS), codigoDoRotulo("cft", TABELAS));
});

test("o que não é disciplina não vira disciplina", () => {
  assert.equal(codigoDoRotulo("", TABELAS), "");
  assert.equal(codigoDoRotulo("PLANTA BAIXA", TABELAS), "");
});

// ------------------------------------------------------------- a prioridade

test("o nome do arquivo vence o carimbo", () => {
  // O nome é a convenção do escritório; o carimbo sai de OCR e erra.
  assert.equal(
    escolherCodigo(
      { manual: "", doNome: ["dre"], doCarimbo: "TOPOGRAFIA" },
      TABELAS,
    ),
    "dre",
  );
});

test("a correção à mão vence o nome do arquivo", () => {
  assert.equal(
    escolherCodigo(
      { manual: "Pavimentacao", doNome: ["dre"], doCarimbo: "DRENAGEM" },
      TABELAS,
    ),
    "pav",
  );
});

test("nome com várias disciplinas não decide — quem decide é o carimbo", () => {
  // `040_26_vol10_his_inc_spd_a.pdf` é o volume inteiro. Chamar as 20 folhas
  // dele de "his" poria o nome errado em duas das três separatrizes.
  assert.equal(
    escolherCodigo(
      { manual: "", doNome: ["his", "inc", "spd"], doCarimbo: "SPDA" },
      TABELAS,
    ),
    "spd",
  );
});

test("sem nenhuma das três fontes, o sistema diz que não sabe", () => {
  assert.equal(
    escolherCodigo({ manual: "", doNome: [], doCarimbo: "" }, TABELAS),
    "",
  );
});

// ---------------------------------------------------------------- os blocos

test("040-26 volume 10: três disciplinas, três blocos, nesta ordem", () => {
  const selos = [
    selo("040_26_his_001_a.pdf", 1, "HIDROSSANITARIO"),
    selo("040_26_his_001_a.pdf", 2, "HIDROSSANITARIO"),
    selo("040_26_inc_003_a.pdf", 1, "PREVENTIVO CONTRA INCENDIO"),
    selo("040_26_spd_002_a.pdf", 1, "SPDA"),
  ];
  const blocos = blocosDe(folhas(selos, {}));
  assert.deepEqual(
    blocos.map((b) => b.codigo),
    ["his", "inc", "spd"],
  );
  assert.deepEqual(
    blocos.map((b) => b.ids.length),
    [2, 1, 1],
  );
  assert.equal(misturaDisciplinas(blocos), true);
});

test("040-26 volume 5 (só arquitetura): um bloco, sem mistura", () => {
  const selos = [
    selo("040_26_arq_007_a.pdf", 1, "ARQUITETONICO"),
    selo("040_26_arq_008_a.pdf", 1, "ARQUITETONICO"),
  ];
  const blocos = blocosDe(folhas(selos, {}));
  assert.equal(blocos.length, 1);
  assert.equal(misturaDisciplinas(blocos), false);
});

test("a disciplina fora de ordem não vira separatriz repetida", () => {
  // Uma pasta por disciplina no escritório: dre, pav, dre são DOIS blocos.
  const selos = [
    selo("040_26_dre_001_a.pdf", 1, "DRENAGEM"),
    selo("pav_040-26_Sec-tipo-FORMATO_A1-500.pdf", 1, "PAVIMENTACAO"),
    selo("040_26_dre_002_a.pdf", 1, "DRENAGEM"),
  ];
  const blocos = blocosDe(folhas(selos, {}));
  assert.deepEqual(
    blocos.map((b) => b.codigo),
    ["dre", "pav"],
  );
  assert.equal(blocos[0].ids.length, 2);
});

test("a prancha de terceiro sem disciplina fica por último", () => {
  // 040-26 volume 3 tem o laudo de sondagem e as pranchas de terraplenagem com
  // nomes fora da convenção. Enfiá-las no meio empurraria as disciplinas de
  // verdade para fora da ordem do escritório.
  const selos = [
    selo("Relatorio de Sondagem - Camelodromo.pdf", 1, ""),
    selo("040_26_dre_001_a.pdf", 1, "DRENAGEM"),
    selo("te_040-26_DDM_R00.pdf", 1, ""),
  ];
  const blocos = blocosDe(folhas(selos, {}));
  assert.deepEqual(
    blocos.map((b) => b.codigo),
    ["dre", ""],
  );
  assert.equal(blocos[1].ids.length, 2);
  // Duas folhas ilegíveis não fazem um volume de uma disciplina virar misto.
  assert.equal(misturaDisciplinas(blocos), false);
});

test("o carimbo salva a prancha cujo nome não segue a convenção", () => {
  const selos = [selo("ge_040-26_eixos-PLANTA-A1-500.pdf", 1, "GEOMETRICO")];
  const blocos = blocosDe(folhas(selos, {}));
  assert.deepEqual(
    blocos.map((b) => b.codigo),
    ["gmt"],
  );
});

test("corrigir a disciplina à mão move a folha de bloco", () => {
  // Sem `disciplinaManual`, o nome do arquivo venceria e a correção seria
  // aceita e ignorada — o pior desfecho possível para quem digitou.
  const selos = [
    selo("040_26_dre_001_a.pdf", 1, "DRENAGEM"),
    selo("040_26_dre_002_a.pdf", 1, "DRENAGEM"),
  ];
  const ajustes = { "040_26_dre_002_a.pdf#1": { disciplina: "Pavimentacao" } };
  const blocos = blocosDe(folhas(selos, ajustes));
  assert.deepEqual(
    blocos.map((b) => b.codigo),
    ["dre", "pav"],
  );
});

test("o volume numa linha", () => {
  const selos = [
    selo("040_26_his_001_a.pdf", 1, "HIDROSSANITARIO"),
    selo("040_26_inc_003_a.pdf", 1, "PREVENTIVO CONTRA INCENDIO"),
  ];
  assert.equal(
    resumoDosBlocos(blocosDe(folhas(selos, {}))),
    // Com acento desde 2026-08-06: o rótulo de tela é texto que a pessoa lê, e
    // a interface mostrava "Hidrossanitario". Ver [[disciplinas.ts]].
    "Hidrossanitário (1) · Preventivo contra incêndio (1)",
  );
});

test("fundir dois blocos numa separatriz só", () => {
  // 040-26 volume 3 emite `separatriz_gmt_ter` e a LD `geo_ter_ld`: geométrico
  // e terraplenagem juntos. A divisão automática é o palpite; quem decide é o
  // engenheiro — o mesmo princípio do tomo arrastado à mão.
  const selos = [
    selo("ge_040-26_eixos-PLANTA-A1-500.pdf", 1, "GEOMETRICO"),
    selo("te_040-26_DDM_R00.pdf", 1, "TERRAPLENAGEM"),
    selo("040_26_dre_001_a.pdf", 1, "DRENAGEM"),
  ];
  const blocos = blocosDe(folhas(selos, {}));
  assert.deepEqual(
    blocos.map((b) => b.codigo),
    ["gmt", "ter", "dre"],
  );

  const fundidos = fundirBlocos(blocos, "gmt", "ter");
  assert.deepEqual(
    fundidos.map((b) => b.codigo),
    ["gmt", "dre"],
  );
  /*
   * O rótulo de TELA do bloco fundido é a junção mecânica. O nome que vai
   * IMPRESSO na separatriz é outro — "PROJETO DE GEOMETRIA E TERRAPLENAGEM" —
   * e mora em `NOME_DO_PAR`, porque nome de par é nome próprio, não a soma dos
   * dois. Ver [[disciplinas.ts]].
   */
  assert.equal(fundidos[0].rotulo, "Geométrico e Terraplenagem");
  assert.equal(fundidos[0].ids.length, 2);
  // A drenagem não se move: fundir dois blocos não reordena o resto do volume.
  assert.equal(fundidos[1].ids.length, 1);
});

test("fundir com um código que não existe não muda nada", () => {
  const selos = [selo("040_26_dre_001_a.pdf", 1, "DRENAGEM")];
  const blocos = blocosDe(folhas(selos, {}));
  assert.deepEqual(fundirBlocos(blocos, "dre", "arq"), blocos);
  assert.deepEqual(fundirBlocos(blocos, "dre", "dre"), blocos);
});

/*
 * O QUE CADA BLOCO GERA — a tabela do escritório chegando ao plano de geração.
 *
 * Até 15/08/2026 o plano oferecia LD e separatriz para TODO bloco, e sondagem
 * saía com uma LD que o escritório não entrega. `temLd` existia em
 * `disciplinas.ts` desde a véspera e ninguém o chamava.
 *
 * A regra é do BLOCO, não do volume: num volume misto, sondagem não ganha LD e
 * as outras disciplinas continuam ganhando as suas.
 */
test("sondagem não gera LD, mas gera separatriz", () => {
  assert.equal(blocoGera("ld", { codigo: "snd" }), false);
  assert.equal(blocoGera("separatriz", { codigo: "snd" }), true);
});

test("arquitetônico gera os dois", () => {
  assert.equal(blocoGera("ld", { codigo: "arq" }), true);
  assert.equal(blocoGera("separatriz", { codigo: "arq" }), true);
});

test("o código é lido sem depender de caixa — ele vem de nome de arquivo", () => {
  assert.equal(blocoGera("ld", { codigo: "SND" }), false);
});

/*
 * OS TRÊS CASOS QUE NÃO PODEM SUMIR DO PLANO. Filtrar por disciplina só é
 * seguro quando a ausência de disciplina responde SIM: `blocosDasFolhas` produz
 * bloco de código vazio ("Sem disciplina") sempre que o nome do arquivo não
 * declara nada, e o léxico não é exaustivo. Errar para o lado do NÃO some com a
 * LD de um volume inteiro sem avisar ninguém.
 */
test("bloco ausente gera — é o volume de disciplina única", () => {
  assert.equal(blocoGera("ld", undefined), true);
});

test("bloco sem código gera", () => {
  assert.equal(blocoGera("ld", { codigo: "" }), true);
});

test("disciplina fora do léxico gera", () => {
  assert.equal(blocoGera("ld", { codigo: "zzz" }), true);
});

console.log(`\n${passed} teste(s) passaram.`);
