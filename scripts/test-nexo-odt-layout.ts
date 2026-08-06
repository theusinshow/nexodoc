/**
 * Teste do LEITOR DO LAYOUT do modelo de capa.
 *
 * É a leitura que foi feita à mão para diagnosticar a obra duplicada e o
 * `{{TOMO}}` partido em spans. Vira código porque o frame do documento passa a
 * ser desenhado a partir dela: se o leitor erra, o frame mostra uma coisa e o
 * PDF sai outra — o defeito que este trabalho existe para matar.
 *
 * Contra os modelos REAIS o teste afirma INVARIANTES, não estruturas fixas:
 * assim ele acusa uma edição que quebre um modelo sem quebrar a cada ajuste de
 * espaçamento que o engenheiro fizer.
 *
 *   node scripts/test-nexo-odt-layout.ts   (== npm run test:nexo:odt-layout)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

import { lerLayoutDoModelo, marcadoresDoLayout } from "../server/odt/layout.ts";

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

// ---------------------------------------------------------------------------
// Fixtures — casos exatos, inclusive o defeito real
// ---------------------------------------------------------------------------

const ESTILOS = `<office:automatic-styles>
<style:style style:name="P6" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="16pt"/></style:style>
<style:style style:name="P11" style:family="paragraph"><style:paragraph-properties fo:text-align="end"/><style:text-properties fo:font-size="14pt"/></style:style>
</office:automatic-styles>`;

const corpo = (dentro: string) =>
  `<?xml version="1.0"?><office:document-content>${ESTILOS}<office:body><office:text>${dentro}</office:text></office:body></office:document-content>`;

test("um marcador sozinho vira uma parte de marcador", () => {
  const l = lerLayoutDoModelo(corpo('<text:p text:style-name="P6">{{NOME_OBRA}}</text:p>'));
  assert.equal(l.length, 1);
  assert.deepEqual(l[0].partes, [{ tipo: "marcador", nome: "NOME_OBRA" }]);
});

test("o alinhamento e o corpo saem do estilo do parágrafo", () => {
  const l = lerLayoutDoModelo(corpo('<text:p text:style-name="P11">{{TOMO}}</text:p>'));
  assert.equal(l[0].alinhamento, "end");
  assert.equal(l[0].corpo, 14);
});

test("texto fixo e marcador convivem na mesma linha, em ordem", () => {
  const l = lerLayoutDoModelo(
    corpo('<text:p text:style-name="P6">VOLUME {{VOLUME}} – {{TITULO_CAPA}}</text:p>'),
  );
  assert.deepEqual(l[0].partes, [
    { tipo: "texto", valor: "VOLUME " },
    { tipo: "marcador", nome: "VOLUME" },
    { tipo: "texto", valor: " – " },
    { tipo: "marcador", nome: "TITULO_CAPA" },
  ]);
});

test("o marcador PARTIDO em spans é detectado, não ignorado", () => {
  // O caso real: `{{TOMO}}` digitado como `{{(TOMO)}}` e ainda quebrado pelo
  // LibreOffice em <text:span> próprios. Nunca casaria com "{{TOMO}}".
  const l = lerLayoutDoModelo(
    corpo(
      '<text:p text:style-name="P6">{{<text:span text:style-name="T6">(</text:span>TOMO<text:span text:style-name="T6">)</text:span>}}</text:p>',
    ),
  );
  assert.deepEqual(l[0].partes, [{ tipo: "quebrado", bruto: "{{(TOMO)}}" }]);
});

test("parágrafo vazio aparece no layout, sem partes", () => {
  const l = lerLayoutDoModelo(corpo('<text:p text:style-name="P6"/>'));
  assert.equal(l.length, 1);
  assert.deepEqual(l[0].partes, []);
});

test("a ordem de impressão é preservada no índice", () => {
  const l = lerLayoutDoModelo(
    corpo(
      '<text:p text:style-name="P6">{{A}}</text:p><text:p text:style-name="P6">{{B}}</text:p>',
    ),
  );
  assert.deepEqual(
    l.map((p) => p.indice),
    [0, 1],
  );
});

test("marcadoresDoLayout lista os nomes, sem repetir", () => {
  const l = lerLayoutDoModelo(
    corpo(
      '<text:p text:style-name="P6">{{NOME_OBRA}}</text:p><text:p text:style-name="P6">{{NOME_OBRA}}</text:p><text:p text:style-name="P6">{{BAIRRO}}</text:p>',
    ),
  );
  assert.deepEqual(marcadoresDoLayout(l), ["NOME_OBRA", "BAIRRO"]);
});

// ---------------------------------------------------------------------------
// Contra os modelos REAIS — invariantes
// ---------------------------------------------------------------------------

const RAIZ = path.resolve("templates/capas");
const pastas = fs
  .readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name);

console.log(`\nModelos reais: ${pastas.join(", ")}`);

for (const pasta of pastas) {
  const config = JSON.parse(
    fs.readFileSync(path.join(RAIZ, pasta, "config.json"), "utf-8"),
  ) as { arquivoTemplate: string };
  const odt = path.join(RAIZ, pasta, config.arquivoTemplate);
  const zip = await JSZip.loadAsync(fs.readFileSync(odt));
  const xml = await zip.file("content.xml")!.async("string");
  const layout = lerLayoutDoModelo(xml);

  test(`${pasta}: produz parágrafos`, () => {
    assert.ok(layout.length > 0, "nenhum parágrafo lido");
  });

  test(`${pasta}: produz ao menos um marcador`, () => {
    assert.ok(marcadoresDoLayout(layout).length > 0, "nenhum marcador");
  });

  test(`${pasta}: nenhum marcador quebrado`, () => {
    const quebrados = layout
      .flatMap((p) => p.partes)
      .filter((x) => x.tipo === "quebrado");
    assert.deepEqual(quebrados, [], `marcador(es) quebrado(s) em ${pasta}`);
  });

  test(`${pasta}: todo parágrafo tem alinhamento`, () => {
    for (const p of layout) {
      assert.ok(
        ["start", "center", "end"].includes(p.alinhamento),
        `parágrafo ${p.indice} sem alinhamento`,
      );
    }
  });
}

console.log(`\n${passed} teste(s) ok.`);
