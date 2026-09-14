/**
 * Teste da GUARDA DO BANCO da bateria.
 *
 * A bateria APAGA tabelas a cada rodada. Até 14/08/2026 o `.env.local` apontava
 * para o banco de produção sem ninguém perceber (memória "Dev separado de
 * produção"). A guarda decide pelo NOME do banco na URL, antes de qualquer
 * escrita, e só aceita um.
 *
 *   node scripts/test-guarda-do-banco.ts
 */
import assert from "node:assert/strict";

import { bancoDaBateria, semOPooler } from "./bateria/lib/guarda-do-banco.mjs";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const HOST = "postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech";

test("aceita só o nexodoc_teste", () => {
  assert.deepEqual(bancoDaBateria(`${HOST}/nexodoc_teste?sslmode=require`), { ok: true, banco: "nexodoc_teste" });
});

test("recusa produção e o banco de desenvolvimento, dizendo qual é", () => {
  for (const banco of ["neondb", "nexodoc_dev", "nexodoc"]) {
    const r = bancoDaBateria(`${HOST}/${banco}?sslmode=require`);
    assert.equal(r.ok, false, banco);
    assert.match((r as { motivo: string }).motivo, new RegExp(banco));
  }
});

test("recusa URL vazia ou torta", () => {
  assert.equal(bancoDaBateria("").ok, false);
  assert.equal(bancoDaBateria("isto não é url").ok, false);
});

test("sem o pooler para CREATE DATABASE e migração", () => {
  assert.equal(
    semOPooler(`${HOST}/nexodoc_teste?sslmode=require`),
    "postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/nexodoc_teste?sslmode=require",
  );
});

console.log(`\n${passed} teste(s) passaram`);
