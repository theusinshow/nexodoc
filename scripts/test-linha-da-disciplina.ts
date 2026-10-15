/**
 * O que o agente ouve sobre a disciplina (15/10/2026): com 6 EST + 1 HID ele
 * recebia "Disciplina: ESTRUTURAL" e respondia "li 7 folhas da disciplina
 * ESTRUTURAL".
 *
 *   node scripts/test-linha-da-disciplina.ts   (== npm run test:linha-da-disciplina)
 */
import assert from "node:assert/strict";

import { linhaDaDisciplina } from "../server/nexo/agent/linha-da-disciplina.ts";

const misto = linhaDaDisciplina({
  disciplina: "ESTRUTURAL",
  blocos: [
    { disciplina: "ESTRUTURAL", folhas: 6 },
    { disciplina: "HIDROSSANITÁRIO", folhas: 1 },
  ],
});
assert.match(misto, /ESTRUTURAL — 6 folhas · HIDROSSANITÁRIO — 1 folha/);
assert.match(misto, /MISTO/);
assert.doesNotMatch(misto, /^- Disciplina: /);

assert.equal(linhaDaDisciplina({ disciplina: "ESTRUTURAL", blocos: [{ disciplina: "ESTRUTURAL", folhas: 7 }] }), "- Disciplina: ESTRUTURAL");
assert.equal(linhaDaDisciplina({ disciplina: "" }), "- Disciplina: ?");
assert.match(
  linhaDaDisciplina({ disciplina: "X", blocos: [{ disciplina: "ARQUITETURA", folhas: 2 }, { disciplina: "", folhas: 1 }] }),
  /SEM DISCIPLINA — 1 folha/,
);

console.log("4 teste(s) da linha da disciplina OK");
