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
  ESCRITORIO,
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

const FICTICIO = normalizarDadosDoEscritorio({
  nome: "Engeplan Engenharia Ltda",
  enderecoImpresso: "Rua Saldanha Marinho, 89, Centro - Florianópolis - SC",
  municipio: "Florianópolis",
  uf: "sc",
});

const PREFEITURAS: AgentPrefeitura[] = [
  { id: "criciuma", nome: "Prefeitura Municipal de Criciúma" },
  { id: "florianopolis", nome: "Prefeitura Municipal de Florianópolis" },
];

test("normalizar apara e sobe a UF", () => {
  assert.equal(FICTICIO.uf, "SC");
  assert.equal(normalizarDadosDoEscritorio({ nome: "  Acme  " }).nome, "Acme");
  assert.deepEqual(normalizarDadosDoEscritorio(null), ESCRITORIO_VAZIO);
});

test("escritório vazio é válido — é o estado de hoje", () => {
  assert.deepEqual(validarDadosDoEscritorio(ESCRITORIO_VAZIO), []);
  assert.equal(escritorioDeclarado(ESCRITORIO_VAZIO), false);
  assert.equal(escritorioDeclarado(FICTICIO), true);
});

test("validação pega UF torta, município sem UF e endereço sem município", () => {
  assert.deepEqual(validarDadosDoEscritorio(FICTICIO), []);
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
  const restante = textoSemOEscritorio(carimbo, FICTICIO);

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
  const restante = textoSemOEscritorio("PREFEITURA MUNICIPAL DE FLORIANÓPOLIS", FICTICIO);
  assert.equal(matchPrefeitura({ nome: restante }, PREFEITURAS)?.id, "florianopolis");
});

test("o município do escritório só cai junto de outra marca dele", () => {
  // Sem nome nem logradouro no texto: "Florianópolis - SC" é do cliente.
  const sozinho = textoSemOEscritorio("Obra em Florianópolis - SC", FICTICIO);
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
  assert.deepEqual(marcadoresDoEscritorio(FICTICIO), {
    ESCRITORIO: "Engeplan Engenharia Ltda",
    ESCRITORIO_ENDERECO: "Rua Saldanha Marinho, 89, Centro - Florianópolis - SC",
  });
});

/*
 * A CONSTANTE REAL — o que protege a produção.
 *
 * Os testes acima usam um escritório fictício para exercitar a regra. Estes
 * usam o `ESCRITORIO` de verdade, e existem por causa da razão de ele ter
 * deixado de ser formulário: enquanto era campo de tela, ninguém tinha
 * preenchido, e a subtração nunca rodava em produção.
 */
test("o escritório do produto vale desde o primeiro boot", () => {
  assert.equal(escritorioDeclarado(ESCRITORIO), true, "constante vazia = proteção desligada");
  assert.deepEqual(validarDadosDoEscritorio(ESCRITORIO), []);
});

test("com a constante, o carimbo de Chapecó resolve sem virar pergunta", () => {
  const COM_CHAPECO: AgentPrefeitura[] = [
    { id: "prefchap", nome: "Prefeitura Municipal de Chapecó" },
    { id: "prefflor", nome: "Prefeitura Municipal de Florianópolis" },
  ];
  /*
   * O carimbo real traz as duas cidades: a do cliente e a do emissor. Sem a
   * subtração, as duas ficam plausíveis, o casamento não resolve e o volume
   * vira pergunta em toda conversa — quando 71 folhas já responderam.
   */
  const carimbo =
    "PREFEITURA MUNICIPAL DE CHAPECÓ · PROSUL · Rua Saldanha Marinho, 110, Centro - Florianópolis - SC";

  const semSubtrair = matchPrefeitura({ nome: carimbo }, COM_CHAPECO);
  const comSubtrair = matchPrefeitura(
    { nome: textoSemOEscritorio(carimbo, ESCRITORIO) },
    COM_CHAPECO,
  );

  assert.equal(comSubtrair?.id, "prefchap");
  assert.ok(
    !textoSemOEscritorio(carimbo, ESCRITORIO).includes("florianopolis"),
    "a cidade do emissor tinha de ter saído",
  );
  // E o casamento cru (sem subtrair) NÃO pode ser o critério: aqui ele acerta
  // por acidente de ordem, e é isso que a subtração deixa de depender.
  assert.ok(semSubtrair !== null);
});

console.log(`\n${passed} teste(s) passaram.`);
