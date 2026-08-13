/**
 * Os pins de achado na margem do visor. Núcleo PURO → node cru.
 *
 *   node scripts/test-nexo-pins-do-parecer.ts   (== npm run test:nexo:pins)
 */
import assert from "node:assert/strict";

import {
  pinsDoDocumento,
  primeiraPagina,
  type AchadoPosicionavel,
} from "../lib/pins-do-parecer.ts";

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

const MEMORIAL = "blob:memorial";
const PRANCHAS = "blob:pranchas";

const achado = (p: Partial<AchadoPosicionavel>): AchadoPosicionavel => ({
  chave: "a",
  severity: "warning",
  title: "t",
  pdfUrl: MEMORIAL,
  ...p,
});

test("primeiraPagina le numero, faixa e prefixo", () => {
  assert.equal(primeiraPagina("12"), 12);
  assert.equal(primeiraPagina("12-14"), 12);
  assert.equal(primeiraPagina("p. 7"), 7);
  assert.equal(primeiraPagina("nao informada"), null);
  assert.equal(primeiraPagina(undefined), null);
  assert.equal(primeiraPagina("0"), null);
});

test("sem documento aberto ou sem tamanho -> nenhuma regua", () => {
  const a = [achado({ pagina: "3" })];
  assert.deepEqual(pinsDoDocumento(a, "", 10), []);
  assert.deepEqual(pinsDoDocumento(a, MEMORIAL, 0), []);
});

test("achado SEM pagina provavel nao vira pin (ausencia nao e conflito)", () => {
  const pins = pinsDoDocumento(
    [achado({ chave: "sem", pagina: "nao informada" }), achado({ chave: "com", pagina: "4" })],
    MEMORIAL,
    10,
  );
  assert.deepEqual(pins.map((p) => p.chave), ["com"]);
});

test("achado de OUTRO documento nao entra nesta margem", () => {
  const pins = pinsDoDocumento(
    [achado({ chave: "aqui", pagina: "2" }), achado({ chave: "la", pagina: "2", pdfUrl: PRANCHAS })],
    MEMORIAL,
    10,
  );
  assert.deepEqual(pins.map((p) => p.chave), ["aqui"]);
});

test("pagina alem do fim do documento e descartada", () => {
  const pins = pinsDoDocumento([achado({ pagina: "40" })], MEMORIAL, 10);
  assert.deepEqual(pins, []);
});

test("a posicao e o CENTRO da faixa: primeira e ultima ficam simetricas", () => {
  const pins = pinsDoDocumento(
    [achado({ chave: "p1", pagina: "1" }), achado({ chave: "p10", pagina: "10" })],
    MEMORIAL,
    10,
  );
  const [primeiro, ultimo] = pins;
  assert.ok(primeiro.top > 0, "o primeiro encostou no topo");
  assert.ok(ultimo.top < 1, "o ultimo passou do fim");
  assert.ok(Math.abs(primeiro.top - (1 - ultimo.top)) < 1e-9, "regua torta");
});

test("a ordem e a do DOCUMENTO, nao a do parecer", () => {
  const pins = pinsDoDocumento(
    [
      achado({ chave: "critico-tarde", pagina: "9", severity: "critical" }),
      achado({ chave: "aviso-cedo", pagina: "2" }),
    ],
    MEMORIAL,
    10,
  );
  assert.deepEqual(pins.map((p) => p.chave), ["aviso-cedo", "critico-tarde"]);
});

console.log(`\n${passed} teste(s) ok`);
