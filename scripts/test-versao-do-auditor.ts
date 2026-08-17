/**
 * A VERSÃO DO AUDITOR é derivada, não digitada.
 *
 * Era `VERSAO_AUDITOR = 1`, uma constante que alguém precisava lembrar de subir
 * ao mexer no prompt ou no modelo. Em 17/08/2026 o modelo dos blocos mudou de
 * `sol` para `terra` e o agrupamento de 28k para 10k sem ninguém subir nada —
 * achado herdado seria de um auditor que não existe mais.
 *
 *   node scripts/test-versao-do-auditor.ts   (== npm run test:versao-auditor)
 */
import assert from "node:assert/strict";

import { versaoDoAuditor, type ConfiguracaoDoAuditor } from "../lib/versao-do-auditor.ts";

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

const BASE: ConfiguracaoDoAuditor = {
  prompt: "Você audita memoriais descritivos. Peque pelo excesso.",
  modeloGlobal: "gpt-5.6-sol",
  modeloBloco: "gpt-5.6-terra",
  modeloValidacao: "gpt-5.6-sol",
  esforco: "medium",
  tamanhoDoBloco: 10000,
};

test("mesma configuração, mesma versão", () => {
  assert.equal(versaoDoAuditor(BASE), versaoDoAuditor({ ...BASE }));
});

test("versão é curta e estável no formato", () => {
  const v = versaoDoAuditor(BASE);
  assert.match(v, /^[0-9a-f]{12}$/);
});

test("uma vírgula no prompt já invalida", () => {
  const outro = versaoDoAuditor({ ...BASE, prompt: `${BASE.prompt},` });
  assert.notEqual(outro, versaoDoAuditor(BASE));
});

test("trocar o modelo do BLOCO invalida — o caso de 17/08", () => {
  const outro = versaoDoAuditor({ ...BASE, modeloBloco: "gpt-5.6-sol" });
  assert.notEqual(outro, versaoDoAuditor(BASE));
});

test("cada campo, sozinho, invalida", () => {
  const mudancas: Partial<ConfiguracaoDoAuditor>[] = [
    { modeloGlobal: "x" },
    { modeloValidacao: "x" },
    { esforco: "high" },
    { tamanhoDoBloco: 28000 },
  ];
  for (const m of mudancas) {
    assert.notEqual(
      versaoDoAuditor({ ...BASE, ...m }),
      versaoDoAuditor(BASE),
      `mudar ${Object.keys(m)[0]} deveria mudar a versão`,
    );
  }
});

test("a ordem dos campos não muda a versão", () => {
  /*
   * O hash sai de uma serialização com chaves ORDENADAS — senão a versão
   * dependeria da ordem em que o objeto foi montado, e um refactor inocente
   * invalidaria o reuso de todos os memoriais do escritório de uma vez.
   */
  const invertido: ConfiguracaoDoAuditor = {
    tamanhoDoBloco: BASE.tamanhoDoBloco,
    esforco: BASE.esforco,
    modeloValidacao: BASE.modeloValidacao,
    modeloBloco: BASE.modeloBloco,
    modeloGlobal: BASE.modeloGlobal,
    prompt: BASE.prompt,
  };
  assert.equal(versaoDoAuditor(invertido), versaoDoAuditor(BASE));
});

test("nunca colide por concatenação ambígua", () => {
  // "ab" + "c" e "a" + "bc" não podem produzir a mesma entrada de hash.
  const a = versaoDoAuditor({ ...BASE, modeloGlobal: "ab", modeloBloco: "c" });
  const b = versaoDoAuditor({ ...BASE, modeloGlobal: "a", modeloBloco: "bc" });
  assert.notEqual(a, b);
});

console.log(`\n${passed} teste(s) de versão do auditor OK`);
