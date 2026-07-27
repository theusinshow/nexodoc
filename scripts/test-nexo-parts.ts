/**
 * Smoke-test da ORDEM CANÔNICA das partes do volume (capa → separatriz → LD →
 * pranchas). Trava a regra do escritório que a montagem depende: se a ordem
 * escorregar, o volume sai fora de padrão. Também cobre multidisciplina (capa
 * única + um bloco por disciplina) e o pulo de partes ausentes.
 *
 * Roda sem framework, direto no Node com type-stripping nativo:
 *   node scripts/test-nexo-parts.ts
 * (também exposto como `npm run test:nexo:parts`)
 *
 * Testa a função PURA `buildVolumeParts` (só ordena o que já veio pronto), que
 * não depende de nenhum resolver de módulos — por isso roda com node cru.
 */
import assert from "node:assert/strict";

import {
  buildVolumeParts,
  type VolumePartSource,
} from "../server/nexo/volume-parts.ts";
import { removerVaziosAntesDoTitulo } from "../server/nexo/tools/separatriz-content.ts";

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

/** Fonte de parte com base64 fictício (o conteúdo não importa p/ a ordem). */
function src(name: string, extra: Partial<VolumePartSource> = {}): VolumePartSource {
  return { name, data: `b64-${name}`, ...extra };
}

test("uma disciplina -> capa, separatriz, LD, pranchas nesta ordem", () => {
  const parts = buildVolumeParts({
    capa: src("capa.pdf"),
    disciplines: [
      {
        separatriz: src("separatriz.pdf"),
        ld: src("ld.pdf"),
        pranchas: [src("folha-01.pdf"), src("folha-02.pdf")],
      },
    ],
  });
  assert.deepEqual(
    parts.map((p) => p.role),
    ["capa", "separatriz", "ld", "prancha", "prancha"],
  );
  assert.deepEqual(
    parts.map((p) => p.name),
    ["capa.pdf", "separatriz.pdf", "ld.pdf", "folha-01.pdf", "folha-02.pdf"],
  );
});

test("multidisciplina -> capa única + bloco (sep, LD, pranchas) por disciplina", () => {
  const parts = buildVolumeParts({
    capa: src("capa.pdf"),
    disciplines: [
      {
        separatriz: src("sep-A.pdf"),
        ld: src("ld-A.pdf"),
        pranchas: [src("A-01.pdf")],
      },
      {
        separatriz: src("sep-B.pdf"),
        ld: src("ld-B.pdf"),
        pranchas: [src("B-01.pdf"), src("B-02.pdf")],
      },
    ],
  });
  assert.deepEqual(
    parts.map((p) => p.name),
    [
      "capa.pdf",
      "sep-A.pdf",
      "ld-A.pdf",
      "A-01.pdf",
      "sep-B.pdf",
      "ld-B.pdf",
      "B-01.pdf",
      "B-02.pdf",
    ],
    "a capa abre o volume; cada disciplina entra como sep -> LD -> pranchas",
  );
  // Só UMA capa, mesmo com N disciplinas.
  assert.equal(parts.filter((p) => p.role === "capa").length, 1);
});

test("partes ausentes são puladas, ordem relativa preservada", () => {
  // Sem capa e sem separatriz (best-effort que falhou): sobra LD -> pranchas.
  const parts = buildVolumeParts({
    disciplines: [
      { ld: src("ld.pdf"), pranchas: [src("folha-01.pdf")] },
    ],
  });
  assert.deepEqual(
    parts.map((p) => p.role),
    ["ld", "prancha"],
  );
});

test("fonte sem data é ignorada (não vira parte)", () => {
  const parts = buildVolumeParts({
    capa: { name: "vazia.pdf", data: "" },
    disciplines: [{ pranchas: [src("folha-01.pdf")] }],
  });
  assert.deepEqual(
    parts.map((p) => p.name),
    ["folha-01.pdf"],
  );
});

test("intervalo de páginas da prancha é propagado", () => {
  const parts = buildVolumeParts({
    disciplines: [
      { pranchas: [src("combinado.pdf", { startPage: 6, endPage: 214 })] },
    ],
  });
  const prancha = parts.find((p) => p.role === "prancha");
  assert.ok(prancha, "esperava uma parte de prancha");
  assert.equal(prancha.startPage, 6);
  assert.equal(prancha.endPage, 214);
});

// --- Separatriz: a página em branco que sobrava no volume --------------------

/*
 * O template oficial da separatriz abre com um parágrafo VAZIO antes do título.
 * O parágrafo do título declara `style:master-page-name`, e no ODF isso força
 * quebra de página — então o vazio virava uma PÁGINA EM BRANCO inteira, que
 * aparecia no volume montado logo depois da capa.
 */
test("separatriz: paragrafo vazio antes do titulo e removido", () => {
  const xml =
    '<office:body><office:text>' +
    '<text:p text:style-name="P11"/>' +
    '<text:p text:style-name="P13">{{TITULO}}</text:p>' +
    '</office:text></office:body>';
  const out = removerVaziosAntesDoTitulo(xml);
  assert.ok(!out.includes('text:style-name="P11"'), "o vazio saiu");
  assert.ok(out.includes("{{TITULO}}"), "o titulo continua la");
});

test("separatriz: vazio com tag aberta/fechada tambem sai", () => {
  const xml =
    '<office:body><office:text>' +
    '<text:p text:style-name="P11"></text:p>' +
    '<text:p text:style-name="P13">{{TITULO}}</text:p>' +
    '</office:text></office:body>';
  assert.ok(!removerVaziosAntesDoTitulo(xml).includes('"P11"'));
});

test("separatriz: paragrafo COM texto antes do titulo e preservado", () => {
  const xml =
    '<office:body><office:text>' +
    '<text:p text:style-name="P11">PREFEITURA</text:p>' +
    '<text:p text:style-name="P13">{{TITULO}}</text:p>' +
    '</office:text></office:body>';
  const out = removerVaziosAntesDoTitulo(xml);
  assert.ok(out.includes("PREFEITURA"), "conteudo real nunca e descartado");
});

test("separatriz: vazio DEPOIS do titulo nao e tocado", () => {
  const xml =
    '<office:body><office:text>' +
    '<text:p text:style-name="P13">{{TITULO}}</text:p>' +
    '<text:p text:style-name="P11"/>' +
    '</office:text></office:body>';
  assert.ok(removerVaziosAntesDoTitulo(xml).includes('"P11"'));
});

test("separatriz: sem marcador, devolve o xml intacto", () => {
  const xml = '<office:body><office:text><text:p text:style-name="P11"/></office:text></office:body>';
  assert.equal(removerVaziosAntesDoTitulo(xml), xml);
});

console.log(`
${passed} teste(s) passaram.`);
