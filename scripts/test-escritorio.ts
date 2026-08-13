/**
 * Teste dos DADOS DO ESCRITÓRIO — a subtração que impede o endereço do emissor
 * de ser lido como cliente.
 *
 * O caso que originou tudo tem nome: um volume de Criciúma emitido como
 * Florianópolis, porque o endereço do escritório está impresso nas 71 pranchas.
 * Ele está travado aqui, e junto dele o falso negativo simétrico — o trabalho
 * PARA a prefeitura da mesma cidade do escritório, que precisa continuar
 * casando.
 *
 *   node scripts/test-escritorio.ts   (== npm run test:escritorio)
 */
import assert from "node:assert/strict";

import {
  ESCRITORIO_VAZIO,
  escritorioDeclarado,
  marcadoresDoEscritorio,
  normalizarDadosDoEscritorio,
  textoSemOEscritorio,
  validarDadosDoEscritorio,
} from "../lib/escritorio.ts";

import { matchPrefeitura, type AgentPrefeitura } from "../server/nexo/agent/normalize.ts";

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

const ESCRITORIO = normalizarDadosDoEscritorio({
  nome: "Engeplan Engenharia Ltda",
  enderecoImpresso: "Rua Saldanha Marinho, 89, Centro - Florianópolis - SC",
  municipio: "Florianópolis",
  uf: "sc",
  responsavelTecnico: "Eng. Fulano de Tal",
  crea: "CREA/SC 123456-7",
});

const PREFEITURAS: AgentPrefeitura[] = [
  { id: "criciuma", nome: "Prefeitura Municipal de Criciúma" },
  { id: "florianopolis", nome: "Prefeitura Municipal de Florianópolis" },
];

test("normalizar apara e sobe a UF", () => {
  assert.equal(ESCRITORIO.uf, "SC");
  assert.equal(normalizarDadosDoEscritorio({ nome: "  Acme  " }).nome, "Acme");
  assert.deepEqual(normalizarDadosDoEscritorio(null), ESCRITORIO_VAZIO);
});

test("escritório vazio é válido — é o estado de hoje", () => {
  assert.deepEqual(validarDadosDoEscritorio(ESCRITORIO_VAZIO), []);
  assert.equal(escritorioDeclarado(ESCRITORIO_VAZIO), false);
  assert.equal(escritorioDeclarado(ESCRITORIO), true);
});

test("validação pega UF torta, município sem UF e endereço sem município", () => {
  assert.deepEqual(validarDadosDoEscritorio(ESCRITORIO), []);
  assert.equal(
    validarDadosDoEscritorio(normalizarDadosDoEscritorio({ uf: "SCC" })).length,
    1,
  );
  assert.equal(
    validarDadosDoEscritorio(normalizarDadosDoEscritorio({ municipio: "Içara" })).length,
    1,
  );
  assert.equal(
    validarDadosDoEscritorio(
      normalizarDadosDoEscritorio({ enderecoImpresso: "Rua Saldanha Marinho, 89" }),
    ).length,
    1,
  );
});

test("sem escritório declarado, o texto passa intacto (só normalizado)", () => {
  assert.equal(
    textoSemOEscritorio("Prefeitura Municipal de Criciúma", ESCRITORIO_VAZIO),
    "prefeitura municipal de criciuma",
  );
});

test("O CASO CRICIÚMA: a linha do escritório sai e o cliente fica", () => {
  const carimbo =
    "PREFEITURA MUNICIPAL DE CRICIÚMA — Rua Saldanha Marinho, 89, Centro - Florianópolis - SC";
  const restante = textoSemOEscritorio(carimbo, ESCRITORIO);

  assert.ok(restante.includes("criciuma"), `sobrou: "${restante}"`);
  assert.ok(!restante.includes("florianopolis"), `sobrou: "${restante}"`);

  const casou = matchPrefeitura({ nome: restante }, PREFEITURAS);
  assert.equal(casou?.id, "criciuma");
});

test("o carimbo com SÓ o endereço do escritório não casa com ninguém", () => {
  const restante = textoSemOEscritorio(
    "Rua Saldanha Marinho, 89, Centro - Florianópolis - SC",
    ESCRITORIO,
  );
  assert.equal(matchPrefeitura({ nome: restante }, PREFEITURAS), null);
});

test("FALSO NEGATIVO SIMÉTRICO: trabalho para a prefeitura da própria cidade", () => {
  const restante = textoSemOEscritorio("PREFEITURA MUNICIPAL DE FLORIANÓPOLIS", ESCRITORIO);
  assert.equal(matchPrefeitura({ nome: restante }, PREFEITURAS)?.id, "florianopolis");
});

test("o município do escritório só cai junto de outra marca dele", () => {
  // Sem nome nem logradouro no texto: "Florianópolis - SC" é do cliente.
  const sozinho = textoSemOEscritorio("Obra em Florianópolis - SC", ESCRITORIO);
  assert.ok(sozinho.includes("florianopolis"), `sobrou: "${sozinho}"`);

  // Com o logradouro junto: a dupla é do escritório e sai inteira.
  const acompanhado = textoSemOEscritorio(
    "Rua Saldanha Marinho, 89 — Florianópolis - SC",
    ESCRITORIO,
  );
  assert.ok(!acompanhado.includes("florianopolis"), `sobrou: "${acompanhado}"`);
});

test("o logradouro sozinho basta — carimbo lido pela metade", () => {
  const restante = textoSemOEscritorio(
    "PREFEITURA MUNICIPAL DE CRICIÚMA · Rua Saldanha Marinho",
    ESCRITORIO,
  );
  assert.equal(matchPrefeitura({ nome: restante }, PREFEITURAS)?.id, "criciuma");
});

test("marcadores de ODT saem só para campo preenchido", () => {
  assert.deepEqual(marcadoresDoEscritorio(ESCRITORIO_VAZIO), {});
  assert.deepEqual(marcadoresDoEscritorio(ESCRITORIO), {
    ESCRITORIO: "Engeplan Engenharia Ltda",
    ESCRITORIO_ENDERECO: "Rua Saldanha Marinho, 89, Centro - Florianópolis - SC",
    RESPONSAVEL: "Eng. Fulano de Tal",
    CREA: "CREA/SC 123456-7",
  });
});

console.log(`\n${passed} teste(s) passaram.`);
