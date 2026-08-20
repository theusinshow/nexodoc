/**
 * O TÍTULO DA LD É O NOME DA CAPA, E A COLUNA ARQUIVOS NÃO LEVA EXTENSÃO.
 *
 * Duas divergências medidas em 20/08/2026 contra o volume 10 de 040-26 e
 * confirmadas em 116-25.
 *
 * 1. O ESCRITÓRIO USA DOIS NOMES POR DISCIPLINA, e escolhe pelo TIPO de
 *    documento. Lido dos PDFs que ele entregou:
 *
 *      disciplina | separatriz                                   | LD e capa
 *      -----------|----------------------------------------------|------------------
 *      his        | PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS      | PROJETO HIDROSSANITÁRIO
 *      inc        | PROJETO PREVENTIVO CONTRA INCÊNDIO           | PROJETO PREVENTIVO
 *      spd        | PROJETO DE SISTEMA DE PROTEÇÃO CONTRA D. A.  | PROJETO SPDA
 *
 *    O léxico já trazia os dois (`capa` e `documento`) e já estava certo. Quem
 *    errava era o consumidor: a LD chamava `nomeNoDocumento` — cujo comentário
 *    dizia, em prosa, "como a disciplina sai na SEPARATRIZ e no título da LD".
 *    A separatriz sim; a LD, não.
 *
 * 2. A COLUNA ARQUIVOS traz o código da prancha SEM extensão. O carimbo diz
 *    `040_26_his_001_a.dwg` e a LD do escritório imprime `040_26_his_001_a`.
 *    Conferido em dois projetos: em cada LD real, o único nome com extensão é
 *    o caminho de rede do rodapé — nenhuma linha da tabela tem.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs scripts/test-ld-titulo-e-arquivo.ts
 *   (== npm run test:ld:titulo-e-arquivo)
 */
import assert from "node:assert/strict";

import { buildLdProposal, type SeloForLd } from "../server/nexo/build-ld-proposal.ts";
import { nomeNaCapa, nomeNaSeparatriz } from "../server/nexo/disciplinas.ts";

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

function selo(disciplina: string, folha: number, total: number): SeloForLd {
  const nome = `040_26_${disciplina}_${String(folha).padStart(3, "0")}_a`;
  return {
    fileName: `${nome}.pdf`,
    pageNumber: 1,
    arquivo: `${nome}.dwg`, // o carimbo traz a extensão do CAD
    disciplina: disciplina.toUpperCase(),
    folha,
    total,
    numeroFolha: `${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`,
    conteudo: "PLANTA DE IMPLANTAÇÃO",
    obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ",
    cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ",
  } as SeloForLd;
}

const tituloDe = (d: string, n = 3) =>
  buildLdProposal(
    Array.from({ length: n }, (_, i) => selo(d, i + 1, n)),
    { respeitarOrdem: true },
  ).input.ldData.sectionTitle;

// ------------------------------------------------------- o título, por disciplina

test("hidrossanitário sai como PROJETO HIDROSSANITÁRIO", () => {
  assert.equal(tituloDe("his"), "PROJETO HIDROSSANITÁRIO");
});

test("preventivo sai como PROJETO PREVENTIVO", () => {
  assert.equal(tituloDe("inc"), "PROJETO PREVENTIVO");
});

test("SPDA sai como PROJETO SPDA", () => {
  assert.equal(tituloDe("spd"), "PROJETO SPDA");
});

test("arquitetônico sai como PROJETO ARQUITETÔNICO (conferido em 116-25)", () => {
  assert.equal(tituloDe("arq"), "PROJETO ARQUITETÔNICO");
});

/*
 * O NOME LONGO CONTINUA EXISTINDO, e é o da separatriz. Trocar um pelo outro
 * nos dois sentidos é o erro que este teste tranca.
 */
test("a separatriz continua com o nome longo", () => {
  assert.equal(nomeNaSeparatriz("his"), "PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS");
  assert.equal(nomeNaSeparatriz("inc"), "PROJETO PREVENTIVO CONTRA INCÊNDIO");
  assert.equal(
    nomeNaSeparatriz("spd"),
    "PROJETO DE SISTEMA DE PROTEÇÃO CONTRA DESCARGAS ATMOSFÉRICAS",
  );
});

test("os dois nomes são de fato diferentes — não é alias", () => {
  for (const code of ["his", "inc", "spd"]) {
    assert.notEqual(nomeNaCapa(code), nomeNaSeparatriz(code), `${code} tem um nome só`);
  }
});

/*
 * O QUE O ENGENHEIRO DIGITA VENCE. A precedência já existia e não pode afrouxar.
 */
test("título digitado vence o léxico", () => {
  const ld = buildLdProposal([selo("his", 1, 1)], { tituloLd: "PROJETO DE ÁGUAS PLUVIAIS" });
  assert.equal(ld.input.ldData.sectionTitle, "PROJETO DE ÁGUAS PLUVIAIS");
});

// ------------------------------------------------------- a coluna ARQUIVOS

test("a coluna ARQUIVOS perde a extensão do CAD", () => {
  const ld = buildLdProposal([selo("his", 1, 1)], { respeitarOrdem: true });
  assert.equal(ld.input.rows[0].file, "040_26_his_001_a");
});

test("sem campo ARQUIVO no carimbo, o nome do PDF também perde a extensão", () => {
  const s = { ...selo("his", 1, 1) } as Record<string, unknown>;
  delete s.arquivo;
  const ld = buildLdProposal([s as SeloForLd], { respeitarOrdem: true });
  assert.equal(ld.input.rows[0].file, "040_26_his_001_a");
});

/*
 * PONTO NO MEIO NÃO É EXTENSÃO. Só o sufixo final curto sai — um código que
 * contenha ponto no corpo tem de sobreviver inteiro.
 */
test("ponto no meio do código sobrevive", () => {
  const s = { ...selo("his", 1, 1), arquivo: "040_26_his_1.2_a.dwg" } as SeloForLd;
  const ld = buildLdProposal([s], { respeitarOrdem: true });
  assert.equal(ld.input.rows[0].file, "040_26_his_1.2_a");
});

test("código sem extensão nenhuma passa intacto", () => {
  const s = { ...selo("his", 1, 1), arquivo: "040_26_his_001_a" } as SeloForLd;
  const ld = buildLdProposal([s], { respeitarOrdem: true });
  assert.equal(ld.input.rows[0].file, "040_26_his_001_a");
});

console.log(`\n${passed} teste(s) passaram.`);
