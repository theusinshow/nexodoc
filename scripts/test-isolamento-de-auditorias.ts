/**
 * Regressão do isolamento de auditorias.
 *
 * A primeira metade prova a expressão de posse sem banco. A segunda trava os
 * endpoints que já vazaram por `auditId`, para uma refatoração não voltar a
 * trocar autorização por mera autenticação.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  auditByIdWhereForActor,
  auditWhereForActor,
} from "../lib/audit-access.ts";

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`FALHOU  ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("auditoria de projeto fica limitada ao escritório do ator", () => {
  assert.deepEqual(
    auditWhereForActor({ organizationId: "org-a", userId: "user-a" }),
    {
      OR: [
        { project: { organizationId: "org-a" } },
        { projectId: null, userId: "user-a" },
      ],
    },
  );
});

test("ator sem userId não casa registros legados com userId nulo", () => {
  assert.deepEqual(
    auditWhereForActor({ organizationId: "org-a", userId: null }),
    { OR: [{ project: { organizationId: "org-a" } }] },
  );
});

test("busca por id conserva id e escopo no mesmo predicado", () => {
  assert.deepEqual(
    auditByIdWhereForActor("audit-123", { organizationId: "org-a", userId: "user-a" }),
    {
      id: "audit-123",
      OR: [
        { project: { organizationId: "org-a" } },
        { projectId: null, userId: "user-a" },
      ],
    },
  );
});

const rotas = {
  recent: readFileSync("app/api/audits/recent/route.ts", "utf8"),
  quality: readFileSync("app/api/audits/quality/route.ts", "utf8"),
  chat: readFileSync("app/api/audit/chat/route.ts", "utf8"),
  cancel: readFileSync("app/api/audit/[id]/cancel/route.ts", "utf8"),
  feedback: readFileSync("app/api/audits/[id]/feedback/route.ts", "utf8"),
  delta: readFileSync("app/api/audit/delta/route.ts", "utf8"),
};

test("listagens e métricas aplicam o escopo", () => {
  assert.match(rotas.recent, /where:\s*auditWhereForActor\(actor\)/);
  assert.match(rotas.quality, /where:\s*\{\s*audit:\s*auditWhereForActor\(actor\)\s*\}/);
});

test("todos os endpoints por auditId aplicam o predicado de posse", () => {
  for (const nome of ["chat", "cancel", "feedback", "delta"] as const) {
    assert.match(
      rotas[nome],
      /auditByIdWhereForActor\(/,
      `${nome} deixou de usar o escopo por auditId`,
    );
  }
});

test("chat deriva o projeto da auditoria autorizada, não do body", () => {
  assert.match(rotas.chat, /projectIdAutorizado\s*=\s*audit\.projectId/);
  assert.match(rotas.chat, /projectId:\s*projectIdAutorizado/);
  assert.doesNotMatch(rotas.chat, /historicoDaObra\([^)]*body\.projectId/s);
});

console.log(`\n${passed} teste(s) de isolamento de auditorias passaram.`);
