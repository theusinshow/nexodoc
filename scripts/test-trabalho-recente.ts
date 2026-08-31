/**
 * "ONDE EU ESTAVA" E "EM QUE PROJETOS EU MEXI" — a regra da home.
 *
 * A home só olhava auditorias e achados pendentes; quem passou o dia montando
 * volumes não via nada. Núcleo PURO → node cru:
 *
 *   node scripts/test-trabalho-recente.ts   (== npm run test:trabalho-recente)
 */
import assert from "node:assert/strict";

import {
  ondeParou,
  partesDaPasta,
  projetosRecentes,
  type ConversaCrua,
} from "../lib/trabalho-recente.ts";

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
  folderKey: string | null,
  updatedAt: number,
  tipo: string | null = "volume",
  extra: Partial<ConversaCrua> = {},
): ConversaCrua => ({ id, title: id.toUpperCase(), folderKey, tipo, updatedAt, ...extra });

// -------------------------------------------------------- a pasta em partes

test("088-25-CRICIUMA vira contrato e município", () => {
  assert.deepEqual(partesDaPasta("088-25-CRICIUMA"), {
    codigo: "088-25",
    cliente: "CRICIUMA",
  });
});

test("município com hífen no nome não é partido ao meio", () => {
  // A expressão ancora no CÓDIGO e leva todo o resto como cliente.
  assert.deepEqual(partesDaPasta("116-25-SAO-JOSE"), {
    codigo: "116-25",
    cliente: "SAO JOSE",
  });
});

test("pasta fora da convenção não inventa separação", () => {
  assert.deepEqual(partesDaPasta("coisa-qualquer"), { codigo: "", cliente: "" });
  assert.deepEqual(partesDaPasta(""), { codigo: "", cliente: "" });
});

// ------------------------------------------------------------- onde parou

test("onde parou é a mais recente, e só", () => {
  const r = ondeParou([c("a", "x", 100), c("b", "x", 300), c("c", "x", 200)]);
  assert.equal(r?.id, "b");
});

test("sem conversa nenhuma devolve null — a tela ensina em vez de mostrar régua vazia", () => {
  assert.equal(ondeParou([]), null);
});

// --------------------------------------------------------------- projetos

test("agrupa por pasta e conta o que tem dentro", () => {
  const r = projetosRecentes([
    c("v1", "088-25-CRICIUMA", 100, "volume"),
    c("v2", "088-25-CRICIUMA", 300, "volume"),
    c("a1", "088-25-CRICIUMA", 200, "auditoria"),
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].conversas, 3);
  assert.equal(r[0].volumes, 2);
  assert.equal(r[0].auditorias, 1);
  assert.equal(r[0].ultima.id, "v2", "o botão leva para a mais recente da pasta");
  assert.equal(r[0].atualizadoEm, 300);
});

test("ordena por RECÊNCIA, não por abandono", () => {
  /*
   * A outra seção da home cobra o que está parado, e é o critério certo LÁ.
   * Aqui a pergunta é "onde eu estava".
   */
  const r = projetosRecentes([
    c("velho", "013-26-CHAPECO", 100),
    c("novo", "088-25-CRICIUMA", 900),
    c("meio", "063-26-CRICIUMA", 500),
  ]);
  assert.deepEqual(
    r.map((p) => p.chave),
    ["088-25-CRICIUMA", "063-26-CRICIUMA", "013-26-CHAPECO"],
  );
});

test("SEM PASTA vai para o fim, mesmo sendo a mais recente", () => {
  /*
   * É onde caem as conversas sem identidade de projeto — as mais numerosas e as
   * menos informativas. No topo, empurrariam para baixo o projeto que a pessoa
   * reconheceria.
   */
  const r = projetosRecentes([
    c("solta", null, 9999),
    c("projeto", "088-25-CRICIUMA", 100),
  ]);
  assert.deepEqual(
    r.map((p) => p.chave),
    ["088-25-CRICIUMA", ""],
  );
});

test("auditoria em voo marca a pasta inteira", () => {
  const r = projetosRecentes([
    c("parada", "088-25-CRICIUMA", 100),
    c("rodando", "088-25-CRICIUMA", 50, "auditoria", { auditoriaPendente: true }),
  ]);
  assert.equal(r[0].emCurso, true);
});

test("o limite corta a lista, e corta DEPOIS de ordenar", () => {
  const r = projetosRecentes(
    [
      c("a", "001-26-X", 100),
      c("b", "002-26-X", 300),
      c("c", "003-26-X", 200),
    ],
    { limite: 2 },
  );
  assert.deepEqual(
    r.map((p) => p.chave),
    ["002-26-X", "003-26-X"],
  );
});

test("nada dentro devolve lista vazia", () => {
  assert.deepEqual(projetosRecentes([]), []);
});

console.log(`\n${passed} teste(s) ok`);
