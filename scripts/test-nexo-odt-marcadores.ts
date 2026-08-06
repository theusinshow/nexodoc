/**
 * Teste da SUBSTITUIÇÃO DE MARCADORES no modelo ODT.
 *
 * Dois comportamentos que já produziram defeito em produção e não tinham teste
 * porque viviam dentro de `server/odt/index.ts`, que importa por alias `@/` e
 * por isso não roda em node cru:
 *
 *   1. marcador repetido DIVIDE o valor em linhas (com `replaceAll` o nome da
 *      obra saía duplicado nos dois parágrafos da capa de Criciúma);
 *   2. marcador sem conteúdo SOME COM O PARÁGRAFO (senão sobra uma linha em
 *      branco exatamente entre a obra e o bairro, numa obra de uma linha só).
 *
 * O escape entra injetado: aqui passamos a identidade, para as asserções
 * falarem de estrutura e não de entidades XML.
 *
 *   node scripts/test-nexo-odt-marcadores.ts   (== npm run test:nexo:odt-marcadores)
 */
import assert from "node:assert/strict";

import { distribuirNosMarcadores } from "../server/odt/marcadores.ts";

/** Escape neutro: o teste é sobre a estrutura, não sobre entidades XML. */
const cru = (v: string) => v;

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

const P = (estilo: string, dentro: string) =>
  `<text:p text:style-name="${estilo}">${dentro}</text:p>`;

// ---------------------------------------------------------------------------
// Uma ocorrência: o valor inteiro
// ---------------------------------------------------------------------------

test("com UMA ocorrência, o valor inteiro entra", () => {
  const bloco = P("P6", "{{NOME_OBRA}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{NOME_OBRA}}", "ESCOLA X", cru),
    P("P6", "ESCOLA X"),
  );
});

// ---------------------------------------------------------------------------
// Marcador repetido divide as linhas
// ---------------------------------------------------------------------------

test("duas ocorrências recebem uma linha cada — a obra não duplica", () => {
  const bloco = P("P6", "{{NOME_OBRA}}") + P("P7", "{{NOME_OBRA}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{NOME_OBRA}}", "REFORMA\nEMEB RAMOS", cru),
    P("P6", "REFORMA") + P("P7", "EMEB RAMOS"),
  );
});

test("a ÚLTIMA ocorrência recebe o que sobrar", () => {
  const bloco = P("P6", "{{T}}") + P("P7", "{{T}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{T}}", "A\nB\nC", cru),
    P("P6", "A") + P("P7", "B\nC"),
  );
});

// ---------------------------------------------------------------------------
// Ocorrência vazia SOME com o parágrafo
// ---------------------------------------------------------------------------

test("obra de uma linha: o 2º parágrafo some, o bairro fica colado", () => {
  const bloco =
    P("P6", "{{NOME_OBRA}}") + P("P7", "{{NOME_OBRA}}") + P("P8", "{{BAIRRO}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{NOME_OBRA}}", "UBS RENASCER", cru),
    P("P6", "UBS RENASCER") + P("P8", "{{BAIRRO}}"),
  );
});

test("campo opcional vazio não deixa linha em branco", () => {
  const bloco = P("P8", "{{BAIRRO}}") + P("P9", "VOLUME");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{BAIRRO}}", "", cru),
    P("P9", "VOLUME"),
  );
});

// ---------------------------------------------------------------------------
// O que NÃO pode colapsar
// ---------------------------------------------------------------------------

test("parágrafo com texto fixo em volta NÃO colapsa", () => {
  const bloco = P("P9", "VOLUME {{VOLUME}} – {{TITULO_CAPA}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{TITULO_CAPA}}", "", cru),
    P("P9", "VOLUME {{VOLUME}} – "),
  );
});

test("marcador ausente devolve o bloco intacto", () => {
  const bloco = P("P6", "sem marcador");
  assert.equal(distribuirNosMarcadores(bloco, "{{X}}", "v", cru), bloco);
});

test("o escape injetado é aplicado ao valor", () => {
  const bloco = P("P6", "{{X}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{X}}", "a&b", (v) => v.replace("&", "&amp;")),
    P("P6", "a&amp;b"),
  );
});

console.log(`\n${passed} teste(s) ok.`);
