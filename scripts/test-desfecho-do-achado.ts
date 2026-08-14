// Como um achado é encerrado, e o que isso grava.
//
//   node scripts/test-desfecho-do-achado.ts   (== npm run test:desfecho)
//
// O desfecho toca DOIS eixos que o schema separa de propósito: o trabalho
// (`resolvedAt`) e o julgamento da IA (`verdict`). Só um dos três mexe no
// segundo, e acertar qual é o que este teste protege — errar aqui contamina o
// benchmark do motor com achados que ninguém disse serem falsos.
import assert from "node:assert/strict";

import { DesfechoInvalido, gravacaoDoDesfecho } from "../lib/desfecho-do-achado.ts";

const agora = new Date("2026-08-14T12:00:00.000Z");

// Corrigi no memorial: fecha o trabalho, e não diz nada sobre a IA ter acertado.
const corrigido = gravacaoDoDesfecho({ desfecho: "FIXED_IN_DOC", agora });
assert.equal(corrigido.resolutionKind, "FIXED_IN_DOC");
assert.equal(corrigido.resolvedAt.toISOString(), agora.toISOString());
assert.equal(corrigido.verdict, undefined);
assert.equal(corrigido.note, "");

// Falso positivo: fecha o trabalho E julga a IA. É o único que mexe nos dois, e
// é o que alimenta o benchmark.
const falso = gravacaoDoDesfecho({ desfecho: "FALSE_POSITIVE", agora });
assert.equal(falso.verdict, "FALSE_POSITIVE");
assert.equal(falso.resolvedAt.toISOString(), agora.toISOString());

// Decisão técnica exige nota. Sem justificativa escrita, ninguém defende a
// decisão seis meses depois, na frente da prefeitura.
assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "ACCEPTED_RISK", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);
assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "ACCEPTED_RISK", note: "   ", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);

const risco = gravacaoDoDesfecho({
  desfecho: "ACCEPTED_RISK",
  note: "Aprovado pelo corpo de bombeiros em 12/08.",
  agora,
});
assert.equal(risco.resolutionKind, "ACCEPTED_RISK");
assert.equal(risco.note, "Aprovado pelo corpo de bombeiros em 12/08.");
assert.equal(risco.verdict, undefined);

// A nota é aparada, e vale para os três: espaço em volta não é justificativa.
const comEspaco = gravacaoDoDesfecho({
  desfecho: "FIXED_IN_DOC",
  note: "  corrigido no capítulo 4  ",
  agora,
});
assert.equal(comEspaco.note, "corrigido no capítulo 4");

// Nota longa é cortada no mesmo limite da coluna, e não recusada: perder o
// fim de uma justificativa é ruim, mas recusar o desfecho inteiro por excesso
// de zelo do usuário seria pior.
const longa = gravacaoDoDesfecho({
  desfecho: "ACCEPTED_RISK",
  note: "x".repeat(1500),
  agora,
});
assert.equal(longa.note.length, 1000);

assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "RESOLVIDO", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);

// E o desfecho vazio não passa por engano: string vazia não é "não informei".
assert.throws(
  () => gravacaoDoDesfecho({ desfecho: "", agora }),
  (err: unknown) => err instanceof DesfechoInvalido,
);

console.log("OK  desfecho do achado");
