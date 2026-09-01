/**
 * DE ONDE VEM O PDF do memorial. Puro → node cru.
 *
 *   node scripts/test-fonte-do-documento.ts   (== npm run test:fonte-documento)
 */
import assert from "node:assert/strict";

import { fonteDoDocumento } from "../lib/fonte-do-documento.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("fonte do documento\n");

test("o LOCAL vence quando existe", () => {
  /*
   * Instantâneo e sem rede. Quem rodou a auditoria tem o memorial no
   * IndexedDB, e mandá-lo baixar 5 MB do servidor seria piorar o que já
   * funcionava.
   */
  const f = fonteDoDocumento({ urlLocal: "blob:abc", checksum: "a".repeat(64) });
  assert.equal(f.tipo, "local");
  assert.equal(f.tipo === "local" && f.url, "blob:abc");
});

test("sem local, cai para o SERVIDOR", () => {
  // É o caso que este trabalho existe para resolver: quem chegou pelo link do
  // e-mail nunca teve o memorial nesta máquina.
  const bom = "a".repeat(64);
  const f = fonteDoDocumento({ urlLocal: null, checksum: bom });
  assert.equal(f.tipo, "servidor");
  assert.equal(f.tipo === "servidor" && f.url, `/api/arquivos/${bom}`);
});

test("sem local e sem checksum, AUSENTE com motivo", () => {
  /*
   * A tela DIZ isso, em vez de esconder o botão: botão ausente não se
   * distingue de funcionalidade inexistente.
   */
  const f = fonteDoDocumento({ urlLocal: null, checksum: null });
  assert.equal(f.tipo, "ausente");
  assert.equal(
    f.tipo === "ausente" && f.motivo,
    "Este documento foi auditado antes de o sistema passar a guardá-lo.",
  );
});

test("checksum em branco é o mesmo que não ter", () => {
  assert.equal(fonteDoDocumento({ urlLocal: null, checksum: "" }).tipo, "ausente");
  assert.equal(fonteDoDocumento({ urlLocal: null, checksum: "   " }).tipo, "ausente");
});

test("url local em branco não vence nada", () => {
  const f = fonteDoDocumento({ urlLocal: "  ", checksum: "a".repeat(64) });
  assert.equal(f.tipo, "servidor");
});

test("checksum torto NÃO vira URL", () => {
  /*
   * O valor entra num caminho de URL. Um `../` aqui sairia do endpoint, e
   * confiar em `encodeURIComponent` sozinho seria confiar que ninguém nunca
   * troque a montagem. O formato é fechado: 64 hexadecimais.
   */
  for (const torto of ["../etc/passwd", "abc/def", "ZZZ", "abc123!", "a".repeat(63)]) {
    assert.equal(
      fonteDoDocumento({ urlLocal: null, checksum: torto }).tipo,
      "ausente",
      torto,
    );
  }
});

test("checksum de 64 hex é aceito", () => {
  const bom = "a".repeat(64);
  const f = fonteDoDocumento({ urlLocal: null, checksum: bom });
  assert.equal(f.tipo, "servidor");
  assert.equal(f.tipo === "servidor" && f.url, `/api/arquivos/${bom}`);
});

console.log(`\n${passed} passaram`);
