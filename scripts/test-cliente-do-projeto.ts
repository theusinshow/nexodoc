/**
 * O CLIENTE CANÔNICO — slug estável e a decisão do que gravar. Puro → node cru.
 *
 *   node scripts/test-cliente-do-projeto.ts   (== npm run test:cliente)
 */
import assert from "node:assert/strict";

import { decidirCliente, slugDoCliente } from "../lib/cliente-do-projeto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("cliente do projeto\n");

test("três grafias do mesmo cliente dão a MESMA chave", () => {
  // É a razão de a chave existir: hoje isto seriam três grupos e três cores.
  assert.equal(slugDoCliente("CRICIÚMA"), "criciuma");
  assert.equal(slugDoCliente("Criciúma"), "criciuma");
  assert.equal(slugDoCliente("Prefeitura Municipal de Criciúma"), "criciuma");
});

test("a cedilha e o til sobrevivem à normalização", () => {
  assert.equal(slugDoCliente("IÇARA"), "icara");
  assert.equal(slugDoCliente("Prefeitura Municipal de São José"), "sao-jose");
  assert.equal(slugDoCliente("Chapecó"), "chapeco");
});

test("a UF não entra na chave", () => {
  // "Criciúma - SC" e "Criciúma" são o mesmo município.
  assert.equal(slugDoCliente("Criciúma - SC"), "criciuma");
  assert.equal(slugDoCliente("São José/SC"), "sao-jose");
});

test("vazio é vazio — nunca uma chave inventada", () => {
  assert.equal(slugDoCliente(""), "");
  assert.equal(slugDoCliente("   "), "");
  assert.equal(slugDoCliente(null), "");
  assert.equal(slugDoCliente(undefined), "");
  // Só palavras institucionais não identificam ninguém.
  assert.equal(slugDoCliente("Prefeitura Municipal"), "");
});

test("cliente VAZIO é preenchido pelo que foi lido", () => {
  /*
   * A inversão da regra escrita hoje em por-centro-de-custo/route.ts. O
   * cadastro de quem criou vale mais que a leitura de um PDF — mas VAZIO NÃO É
   * CADASTRO, e ninguém digita prefeitura em lugar nenhum hoje.
   */
  const d = decidirCliente({
    atual: "",
    atualKey: "",
    lido: "Prefeitura Municipal de Criciúma",
    municipioLido: "Criciúma",
  });
  assert.equal(d.client, "Prefeitura Municipal de Criciúma");
  assert.equal(d.clientKey, "criciuma");
  assert.equal(d.preencheu, true);
  assert.equal(d.divergencia, null);
});

test("cliente PREENCHIDO não é sobrescrito", () => {
  const d = decidirCliente({
    atual: "CRICIÚMA",
    atualKey: "criciuma",
    lido: "Prefeitura Municipal de Florianópolis",
    municipioLido: "Florianópolis",
  });
  assert.equal(d.client, "CRICIÚMA", "o cadastro vence a leitura");
  assert.equal(d.clientKey, "criciuma");
  assert.equal(d.preencheu, false);
  assert.deepEqual(d.divergencia, {
    cadastrado: "CRICIÚMA",
    lido: "Prefeitura Municipal de Florianópolis",
  });
});

test("ruído de grafia NÃO é divergência", () => {
  /*
   * Interromper a auditoria porque o PDF escreveu "Pref. Mun. de Criciúma" e o
   * cadastro diz "CRICIÚMA" seria atrito por ruído. A chave é que decide se é
   * o mesmo cliente.
   */
  const d = decidirCliente({
    atual: "CRICIÚMA",
    atualKey: "criciuma",
    lido: "Prefeitura Municipal de Criciúma",
    municipioLido: "Criciúma",
  });
  assert.equal(d.divergencia, null);
  assert.equal(d.preencheu, false);
});

test("chave em branco num cliente preenchido é recalculada", () => {
  // O estado que a migração deixa: `client` de antes, `clientKey` no default "".
  const d = decidirCliente({ atual: "IÇARA", atualKey: "", lido: "", municipioLido: "" });
  assert.equal(d.client, "IÇARA");
  assert.equal(d.clientKey, "icara");
  assert.equal(d.preencheu, false);
  assert.equal(d.divergencia, null);
});

test("nada lido e nada cadastrado não inventa nada", () => {
  const d = decidirCliente({ atual: "", atualKey: "", lido: "", municipioLido: "" });
  assert.equal(d.client, "");
  assert.equal(d.clientKey, "");
  assert.equal(d.preencheu, false);
  assert.equal(d.divergencia, null);
});

test("o município vence o órgão ao formar a chave", () => {
  /*
   * O órgão pode ser uma secretaria com nome longo ("Secretaria de
   * Desenvolvimento Sustentável e Obras Estruturantes"). O município é o que
   * identifica o cliente.
   */
  const d = decidirCliente({
    atual: "",
    atualKey: "",
    lido: "Secretaria de Obras de Chapecó",
    municipioLido: "Chapecó",
  });
  assert.equal(d.clientKey, "chapeco");
});

console.log(`\n${passed} passaram`);
