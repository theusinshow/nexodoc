/**
 * OS CARTÕES DE PROJETO da barra lateral. Núcleo PURO → node cru:
 *
 *   node scripts/test-nexo-cartoes.ts   (== npm run test:nexo:cartoes)
 */
import assert from "node:assert/strict";

import {
  cartoesDeProjeto,
  ehDocumentoFinal,
  TETO_DE_CONVERSAS,
  type ConversaResumida,
} from "../modules/nexo/lib/cartoes-de-projeto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
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

const c = (
  id: string,
  pasta: string | null,
  updatedAt: number,
  kinds: string[] = [],
  extra: Partial<ConversaResumida> = {},
): ConversaResumida => ({
  id,
  title: "MET",
  folderKey: pasta,
  tipo: "volume",
  updatedAt,
  folhas: 10,
  kinds,
  ...extra,
});

test("agrupa por projeto e soma as folhas", () => {
  const r = cartoesDeProjeto([
    c("a", "084-25-CRICIUMA", 300, ["ld"], { folhas: 44 }),
    c("b", "084-25-CRICIUMA", 200, ["capa", "volume"], { folhas: 61 }),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].folhas, 105);
  assert.equal(r[0].codigo, "084-25");
  assert.equal(r[0].cliente, "CRICIUMA");
});

test("os artefatos saem na ordem do FLUXO, não na de chegada", () => {
  const r = cartoesDeProjeto([c("a", "084-25-X", 100, ["volume", "ld", "separatriz", "capa"])]);
  assert.deepEqual(r[0].artefatos, ["LD", "CAPA", "SEP", "VOL"]);
});

test("corta em quatro e conta o resto, dizendo desde quando", () => {
  const conversas = [1, 2, 3, 4, 5, 6].map((n) => c(`c${n}`, "084-25-X", n * 100));
  const r = cartoesDeProjeto(conversas);
  assert.equal(r[0].conversas.length, TETO_DE_CONVERSAS);
  assert.equal(r[0].restantes, 2);
  assert.equal(r[0].restantesDesde, 100, "a data da MAIS ANTIGA das cortadas");
  assert.equal(r[0].conversas[0].id, "c6", "as mais recentes ficam");
});

test("o desfecho é o artefato mais adiantado", () => {
  const r = cartoesDeProjeto([
    c("vol", "084-25-X", 400, ["ld", "capa", "volume"]),
    c("ld", "084-25-X", 300, ["ld"]),
    c("aud", "084-25-X", 200, ["auditoria"]),
    c("nada", "084-25-X", 100, [], { folhas: 0 }),
  ]);
  const por = Object.fromEntries(r[0].conversas.map((x) => [x.id, x.desfecho]));
  assert.equal(por.vol, "volume");
  assert.equal(por.ld, "LD");
  assert.equal(por.aud, "auditoria");
  assert.equal(por.nada, "em branco");
});

test("pasta só com código diz que falta a prefeitura", () => {
  // `084-25` ao lado de `084-25-CRICIUMA` existe de verdade na barra: é a pasta
  // da derivação antiga, e a que nasce quando o carimbo não traz prefeitura.
  const r = cartoesDeProjeto([c("a", "084-25", 100)]);
  assert.equal(r[0].codigo, "084-25");
  assert.equal(r[0].cliente, "");
});

test("SEM CÓDIGO vai para o fim, mesmo sendo o mais recente", () => {
  const r = cartoesDeProjeto([c("solta", null, 9999), c("proj", "084-25-X", 100)]);
  assert.deepEqual(r.map((x) => x.chave), ["084-25-X", ""]);
});

test("análise rodando marca o projeto e a conversa", () => {
  const r = cartoesDeProjeto([
    c("a", "084-25-X", 200),
    c("b", "084-25-X", 100, ["auditoria"], { auditoriaPendente: true }),
  ]);
  assert.equal(r[0].rodando, true);
  assert.equal(r[0].conversas.find((x) => x.id === "b")?.rodando, true);
  assert.equal(r[0].conversas.find((x) => x.id === "a")?.rodando, false);
});

test("o documento FINAL se distingue dos intermediários", () => {
  assert.equal(ehDocumentoFinal("VOL"), true);
  assert.equal(ehDocumentoFinal("AUDITORIA"), true);
  assert.equal(ehDocumentoFinal("LD"), false);
  assert.equal(ehDocumentoFinal("CAPA"), false);
});

test("sem conversa nenhuma não há cartão", () => {
  assert.deepEqual(cartoesDeProjeto([]), []);
});

console.log(`\n${passed} teste(s) ok`);
