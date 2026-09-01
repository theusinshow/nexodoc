/**
 * QUEM ESTÁ ESPERANDO AVISO — agora com N envolvidos. Puro → node cru.
 *
 *   node scripts/test-quem-avisar.ts   (== npm run test:quem-avisar)
 */
import assert from "node:assert/strict";

import { quemAvisar, type AchadoParaAvisar } from "../lib/quem-avisar.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("quem avisar\n");

const achado = (over: Partial<AchadoParaAvisar> = {}): AchadoParaAvisar => ({
  resolvido: false,
  pessoas: [],
  ...over,
});

test("o responsável entra", () => {
  const r = quemAvisar([
    achado({ pessoas: [{ email: "milton@prosul.com", papel: "responsavel", notifiedAt: null }] }),
  ]);
  assert.deepEqual(r, [{ email: "milton@prosul.com", quantidade: 1 }]);
});

test("os envolvidos entram junto do responsável", () => {
  const r = quemAvisar([
    achado({
      pessoas: [
        { email: "milton@prosul.com", papel: "responsavel", notifiedAt: null },
        { email: "carla@prosul.com", papel: "envolvido", notifiedAt: null },
      ],
    }),
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(
    new Set(r.map((x) => x.email)),
    new Set(["milton@prosul.com", "carla@prosul.com"]),
  );
});

test("quem JÁ FOI AVISADO não é avisado de novo", () => {
  // É esta condição que torna o botão seguro de tocar duas vezes.
  const r = quemAvisar([
    achado({
      pessoas: [
        { email: "milton@prosul.com", papel: "responsavel", notifiedAt: 1_000 },
        { email: "carla@prosul.com", papel: "envolvido", notifiedAt: null },
      ],
    }),
  ]);
  assert.deepEqual(r, [{ email: "carla@prosul.com", quantidade: 1 }]);
});

test("achado JÁ RESOLVIDO não avisa ninguém", () => {
  /*
   * Se a pessoa corrigiu antes de o aviso sair, avisar seria mandá-la olhar
   * trabalho que ela mesma fechou.
   */
  const r = quemAvisar([
    achado({
      resolvido: true,
      pessoas: [{ email: "milton@prosul.com", papel: "responsavel", notifiedAt: null }],
    }),
  ]);
  assert.deepEqual(r, []);
});

test("a mesma pessoa em três achados é UM aviso com quantidade três", () => {
  const um = { email: "milton@prosul.com", papel: "responsavel" as const, notifiedAt: null };
  const r = quemAvisar([
    achado({ pessoas: [um] }),
    achado({ pessoas: [um] }),
    achado({ pessoas: [um] }),
  ]);
  assert.deepEqual(r, [{ email: "milton@prosul.com", quantidade: 3 }]);
});

test("responsável E envolvido no mesmo achado conta UMA vez", () => {
  /*
   * Dá para ser responsável por um achado e envolvido nele ao mesmo tempo (a
   * atribuição não remove ninguém dos envolvidos). Contar dois faria o assunto
   * do e-mail dizer "2 achados esperam por você" havendo um.
   */
  const r = quemAvisar([
    achado({
      pessoas: [
        { email: "milton@prosul.com", papel: "responsavel", notifiedAt: null },
        { email: "milton@prosul.com", papel: "envolvido", notifiedAt: null },
      ],
    }),
  ]);
  assert.deepEqual(r, [{ email: "milton@prosul.com", quantidade: 1 }]);
});

test("quem tem MAIS achados vem primeiro", () => {
  // É a pessoa cujo dia o envio mais muda, e a que quem confirma mais precisa
  // conferir antes de apertar.
  const r = quemAvisar([
    achado({ pessoas: [{ email: "a@prosul.com", papel: "responsavel", notifiedAt: null }] }),
    achado({ pessoas: [{ email: "b@prosul.com", papel: "responsavel", notifiedAt: null }] }),
    achado({ pessoas: [{ email: "b@prosul.com", papel: "responsavel", notifiedAt: null }] }),
  ]);
  assert.equal(r[0].email, "b@prosul.com");
  assert.equal(r[0].quantidade, 2);
});

test("sem ninguém, ninguém", () => {
  assert.deepEqual(quemAvisar([]), []);
  assert.deepEqual(quemAvisar([achado()]), []);
});

console.log(`\n${passed} passaram`);
