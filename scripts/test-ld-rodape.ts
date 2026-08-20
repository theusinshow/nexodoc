/**
 * O RODAPÉ DA LD: quem emite, e em que fase.
 *
 * Duas divergências medidas em 20/08/2026 contra o volume 10 de 040-26. O
 * escritório imprime:
 *
 *   SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL E OBRAS ESTRUTURANTES - SEDES
 *   – 040_26 – REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ – PROJETO EXECUTIVO
 *   – LISTA DE DOCUMENTOS
 *
 * e o Nexo imprimia `PREFEITURA MUNICIPAL DE CHAPECÓ` no primeiro campo e
 * `PREVENTIVO` no da fase.
 *
 * 1. O EMISSOR É A SECRETARIA. O primeiro campo do rodapé (`Info 1`) recebia
 *    `cliente`, que no carimbo é a PREFEITURA. A capa imprime os dois em linhas
 *    separadas — órgão e secretaria —, e o rodapé da LD usa a segunda.
 *
 * 2. UMA FOLHA MAL LIDA NÃO DEFINE A FASE DO VOLUME. A fase saía de `mode()`
 *    sobre o campo FASE dos selos, e `mode` ignora vazios: com 19 folhas em
 *    branco e UMA trazendo "PREVENTIVO" — o nome de uma disciplina, capturado
 *    no campo errado pela leitura —, o volume inteiro virava fase PREVENTIVO.
 *    As três LDs saíram assim, inclusive a do hidrossanitário.
 *
 *    O mesmo conjunto lido noutra corrida veio todo em branco e caiu no default
 *    correto, "PROJETO EXECUTIVO" — ou seja, o valor impresso dependia da sorte
 *    da leitura. É a regra do empate que o produto já usa noutros lugares:
 *    evidência fraca não preenche.
 *
 *   node --import ./scripts/lib/resolver-de-imports.mjs scripts/test-ld-rodape.ts
 *   (== npm run test:ld:rodape)
 */
import assert from "node:assert/strict";

import { buildLdProposal, type SeloForLd } from "../server/nexo/build-ld-proposal.ts";

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

const SECRETARIA = "SECRETARIA DE DESENVOLVIMENTO SUSTENTÁVEL E OBRAS ESTRUTURANTES - SEDES";
const PREFEITURA = "PREFEITURA MUNICIPAL DE CHAPECÓ";

function selo(folha: number, extra: Partial<SeloForLd> = {}): SeloForLd {
  const nome = `040_26_his_${String(folha).padStart(3, "0")}_a`;
  return {
    fileName: `${nome}.pdf`,
    pageNumber: 1,
    arquivo: `${nome}.dwg`,
    disciplina: "HIS",
    folha,
    total: 20,
    numeroFolha: `${String(folha).padStart(2, "0")}/20`,
    conteudo: "PLANTA",
    cliente: PREFEITURA,
    secretaria: SECRETARIA,
    obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ",
    fase: null,
    ...extra,
  } as SeloForLd;
}

const conjunto = (n: number, extra?: (i: number) => Partial<SeloForLd>) =>
  Array.from({ length: n }, (_, i) => selo(i + 1, extra?.(i) ?? {}));

const dados = (selos: SeloForLd[]) => buildLdProposal(selos, { respeitarOrdem: true }).input.ldData;

// ------------------------------------------------------------------ o emissor

test("o rodapé leva a SECRETARIA, não a prefeitura", () => {
  assert.equal(dados(conjunto(5)).client, SECRETARIA);
});

test("sem secretaria no carimbo, cai na prefeitura", () => {
  assert.equal(dados(conjunto(5, () => ({ secretaria: null }))).client, PREFEITURA);
});

test("uma secretaria mal lida não vence a maioria", () => {
  const selos = conjunto(10, (i) => (i === 0 ? { secretaria: "SECRETARIA DE OUTRA COISA" } : {}));
  assert.equal(dados(selos).client, SECRETARIA);
});

// --------------------------------------------------------------------- a fase

test("uma folha em vinte não define a fase do volume", () => {
  const selos = conjunto(20, (i) => (i === 7 ? { fase: "PREVENTIVO" } : {}));
  assert.equal(dados(selos).phase, "PROJETO EXECUTIVO");
});

test("a fase que a maioria traz vale", () => {
  const selos = conjunto(20, (i) => (i < 18 ? { fase: "PROJETO BÁSICO" } : {}));
  assert.equal(dados(selos).phase, "PROJETO BÁSICO");
});

test("metade das folhas ja é apoio suficiente", () => {
  const selos = conjunto(20, (i) => (i < 10 ? { fase: "PROJETO BÁSICO" } : {}));
  assert.equal(dados(selos).phase, "PROJETO BÁSICO");
});

test("abaixo da metade, o default do escritório manda", () => {
  const selos = conjunto(20, (i) => (i < 9 ? { fase: "PROJETO BÁSICO" } : {}));
  assert.equal(dados(selos).phase, "PROJETO EXECUTIVO");
});

/*
 * O QUE O ENGENHEIRO DIZ VENCE, em qualquer apoio. A precedência já existia
 * (`dito(opts.fase)`) e não pode ter afrouxado.
 */
test("fase declarada vence o carimbo e o default", () => {
  const ld = buildLdProposal(conjunto(20), { respeitarOrdem: true, fase: "AS BUILT" });
  assert.equal(ld.input.ldData.phase, "AS BUILT");
});

console.log(`\n${passed} teste(s) passaram.`);
