/**
 * A IMPRESSÃO DIGITAL RECONHECE O MESMO DEFEITO — E SÓ ELE.
 *
 * Os casos vêm das duas corridas Deep do 117_25 em 18/08/2026.
 *
 *   node scripts/test-impressao-do-achado.ts  (== npm run test:impressao-achado)
 */
import assert from "node:assert/strict";

import { impressaoDoAchado } from "../lib/impressao-do-achado.ts";

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

const achado = (p: Record<string, unknown>) => p as never;

test("o mesmo defeito com rótulo reescrito dá a mesma impressão", () => {
  /*
   * Caso real: entre as corridas 1 e 2 o modelo trocou
   * "Unidade de seção de condutor errada" por "Unidade de seção incorreta",
   * e reescreveu o conflito. A transcrição e a página não mudaram.
   */
  const corrida1 = achado({
    arquivo: "117_25_md_geral_a.pdf",
    tipo: "Unidade de seção de condutor errada",
    conflito: "A unidade m² altera a seção em seis ordens de grandeza.",
    pagina: "113",
    evidencia: "“Ramal de ligação aéreo: Alumínio multiplexado de # 35m²”",
  });
  const corrida2 = achado({
    arquivo: "117_25_md_geral_a.pdf",
    tipo: "Unidade de seção incorreta",
    conflito: "Seção de condutor não se mede em metros quadrados.",
    pagina: "113",
    evidencia: "“Ramal de ligação aéreo: Alumínio multiplexado de # 35m²”",
  });
  assert.equal(impressaoDoAchado(corrida1), impressaoDoAchado(corrida2));
});

test("defeitos DIFERENTES na mesma página não se fundem", () => {
  /*
   * O caso que reprovou as chaves frouxas: as duas evidências começam com
   * "Temperatura de bulbo seco (TBS): " — 25 caracteres iguais — e só divergem
   * no número. Uma é a temperatura EXTERNA, outra a INTERNA.
   */
  const externa = achado({
    arquivo: "m.pdf",
    tipo: "Premissa climática contraditória",
    pagina: "159-202",
    evidencia: 'Página 159: “Temperatura de bulbo seco (TBS): 32,0°C”. Fichas: “TBS externa (15:00h) : 38 (°C)”.',
  });
  const interna = achado({
    arquivo: "m.pdf",
    tipo: "Premissa interna contraditória",
    pagina: "159-202",
    evidencia: 'Página 159: “Temperatura de bulbo seco (TBS): 24°C”. Fichas: “Temperatura : 23 (°C)”.',
  });
  assert.notEqual(
    impressaoDoAchado(externa),
    impressaoDoAchado(interna),
    "fundir estes dois esconderia um achado real",
  );
});

test("a ordem das páginas não muda a impressão", () => {
  // "17 e 21" e "21, 17" são a mesma declaração; o modelo alterna.
  const a = achado({ arquivo: "m.pdf", pagina: "17 e 21", evidencia: "“prevalecerão os projetos”" });
  const b = achado({ arquivo: "m.pdf", pagina: "21, 17", evidencia: "“prevalecerão os projetos”" });
  assert.equal(impressaoDoAchado(a), impressaoDoAchado(b));
});

test("a moldura da evidência não entra na chave", () => {
  // `Pág. 41:` é redação do auditor e varia; o miolo é do documento.
  const a = achado({ arquivo: "m.pdf", pagina: "41", evidencia: 'p. 41: "Piso de concreto JBM Artefatos"' });
  const b = achado({ arquivo: "m.pdf", pagina: "41", evidencia: '“Piso de concreto JBM Artefatos”' });
  assert.equal(impressaoDoAchado(a), impressaoDoAchado(b));
});

test("página diferente é achado diferente", () => {
  const a = achado({ arquivo: "m.pdf", pagina: "29", evidencia: "“a 6,1 km da USB Vila Manaus.”" });
  const b = achado({ arquivo: "m.pdf", pagina: "31", evidencia: "“a 6,1 km da USB Vila Manaus.”" });
  assert.notEqual(impressaoDoAchado(a), impressaoDoAchado(b));
});

test("arquivo diferente é achado diferente", () => {
  const a = achado({ arquivo: "tomo1.pdf", pagina: "12", evidencia: "“UBS Paraíso – Porte 1”" });
  const b = achado({ arquivo: "tomo2.pdf", pagina: "12", evidencia: "“UBS Paraíso – Porte 1”" });
  assert.notEqual(impressaoDoAchado(a), impressaoDoAchado(b));
});

test("acento e espaço reflowado não separam o que é igual", () => {
  const a = achado({ arquivo: "m.pdf", pagina: "92", evidencia: "“UBS Paraíso – Porte 1”" });
  const b = achado({ arquivo: "m.pdf", pagina: "92", evidencia: "“UBS  Paraiso - Porte 1”" });
  assert.equal(impressaoDoAchado(a), impressaoDoAchado(b));
});

test("sem evidência, a página ainda distingue", () => {
  // Achado de regra pode chegar com evidência curta; a chave não pode explodir.
  const a = achado({ arquivo: "m.pdf", pagina: "10", evidencia: "" });
  const b = achado({ arquivo: "m.pdf", pagina: "11", evidencia: "" });
  assert.notEqual(impressaoDoAchado(a), impressaoDoAchado(b));
  assert.ok(impressaoDoAchado(a).length > 0);
});

console.log(`\n${passed} teste(s) de impressão do achado OK`);
