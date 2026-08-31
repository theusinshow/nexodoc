/**
 * Teste da VAZÃO de auditorias — quantas rodam ao mesmo tempo.
 *
 * O que se prova aqui é a contabilidade do semáforo, que é onde este tipo de
 * proteção costuma falhar: vaga que não volta transforma o limite numa trava
 * que só aperta, e depois de algumas falhas o sistema recusaria auditoria com
 * a máquina vazia.
 *
 *   node scripts/test-vazao-de-auditoria.ts   (== npm run test:vazao)
 */
import assert from "node:assert/strict";

import {
  auditoriasEmCurso,
  mensagemDeVagaRecusada,
  pedirVaga,
  type VagaConcedida,
  type VagaRecusada,
} from "../lib/vazao-de-auditoria.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    limpar();
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

/** Zera contadores e variáveis entre testes — o estado vive em `globalThis`. */
function limpar() {
  delete process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS;
  delete process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL;
  const g = globalThis as unknown as {
    nexodocAuditoriasEmCurso?: Map<string, number>;
    nexodocAuditoriasGlobais?: { total: number };
  };
  g.nexodocAuditoriasEmCurso = new Map();
  g.nexodocAuditoriasGlobais = { total: 0 };
}

function concedida(v: ReturnType<typeof pedirVaga>): VagaConcedida {
  assert.equal(v.ok, true, "esperava vaga CONCEDIDA");
  return v as VagaConcedida;
}

function recusada(v: ReturnType<typeof pedirVaga>): VagaRecusada {
  assert.equal(v.ok, false, "esperava vaga RECUSADA");
  return v as VagaRecusada;
}

test("SEM variáveis, tudo passa — o padrão não muda o comportamento", () => {
  // É a promessa central do módulo: entregue desarmado, ele é invisível.
  for (let i = 0; i < 50; i++) {
    concedida(pedirVaga("ana@prosul.com"));
  }
  assert.equal(auditoriasEmCurso().global, 50);
});

test("o limite POR USUÁRIO recusa a partir da vaga seguinte", () => {
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS = "2";
  concedida(pedirVaga("ana@prosul.com"));
  concedida(pedirVaga("ana@prosul.com"));

  const terceira = recusada(pedirVaga("ana@prosul.com"));
  assert.equal(terceira.escopo, "usuario");
  assert.equal(terceira.emCurso, 2);
  assert.equal(terceira.limite, 2);
});

test("o limite de um usuário NÃO atinge outro", () => {
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS = "1";
  concedida(pedirVaga("ana@prosul.com"));
  recusada(pedirVaga("ana@prosul.com"));
  // O Victor não paga pela fila da Ana.
  concedida(pedirVaga("victor@prosul.com"));
});

test("o limite GLOBAL vale para todo mundo somado", () => {
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL = "2";
  concedida(pedirVaga("ana@prosul.com"));
  concedida(pedirVaga("victor@prosul.com"));

  const terceira = recusada(pedirVaga("lais@prosul.com"));
  assert.equal(terceira.escopo, "global");
  assert.equal(terceira.limite, 2);
});

test("o GLOBAL é medido antes do individual", () => {
  // Quando a máquina está cheia, a pessoa precisa ler "o sistema está ocupado"
  // e não "você abusou" — as duas mensagens pedem ações diferentes.
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL = "1";
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS = "1";
  concedida(pedirVaga("ana@prosul.com"));

  assert.equal(recusada(pedirVaga("ana@prosul.com")).escopo, "global");
});

test("LIBERAR devolve a vaga, e o próximo entra", () => {
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS = "1";
  const primeira = concedida(pedirVaga("ana@prosul.com"));
  recusada(pedirVaga("ana@prosul.com"));

  primeira.liberar();
  concedida(pedirVaga("ana@prosul.com"));
});

test("liberar DUAS VEZES não cria vaga do nada", () => {
  // O caminho de erro de uma rota SSE tem mais de uma saída, então `liberar`
  // é idempotente de propósito. Se não fosse, uma dupla liberação faria o
  // contador ficar negativo e o limite deixaria de existir.
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL = "1";
  const vaga = concedida(pedirVaga("ana@prosul.com"));

  vaga.liberar();
  vaga.liberar();
  vaga.liberar();

  assert.equal(auditoriasEmCurso().global, 0);
  concedida(pedirVaga("victor@prosul.com"));
  recusada(pedirVaga("lais@prosul.com"));
});

test("a conta VOLTA A ZERO quando todos liberam", () => {
  const vagas = ["ana", "victor", "lais"].map((n) => concedida(pedirVaga(n)));
  assert.equal(auditoriasEmCurso().global, 3);

  for (const v of vagas) v.liberar();

  const estado = auditoriasEmCurso();
  assert.equal(estado.global, 0);
  // A chave sai do mapa ao zerar: deixá-la com 0 faria o mapa crescer com o
  // número de usuários que já auditaram alguma vez, num processo que fica
  // meses no ar.
  assert.deepEqual(estado.porUsuario, {});
});

test("quem não tem dono conta no GLOBAL, e não no individual", () => {
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS = "1";
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL = "2";
  concedida(pedirVaga(null));
  concedida(pedirVaga(""));
  // Sem dono não há o que somar por usuário, mas deixar de contar no global
  // seria abrir uma porta que não fecha.
  recusada(pedirVaga(null));
  assert.deepEqual(auditoriasEmCurso().porUsuario, {});
});

test("o mesmo usuário é reconhecido com caixa e espaço diferentes", () => {
  process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS = "1";
  concedida(pedirVaga("ana@prosul.com"));
  // Senão o limite por usuário seria burlável só mudando a caixa do e-mail.
  recusada(pedirVaga("  ANA@PROSUL.COM  "));
});

test("valor inválido não vira limite", () => {
  for (const v of ["", "abc", "0", "-3"]) {
    limpar();
    process.env.NEXODOC_MAX_AUDITORIAS_SIMULTANEAS_GLOBAL = v;
    concedida(pedirVaga("ana@prosul.com"));
    concedida(pedirVaga("ana@prosul.com"));
  }
});

test("a recusa diz a CAUSA e o que fazer", () => {
  const global = mensagemDeVagaRecusada({
    ok: false,
    escopo: "global",
    emCurso: 4,
    limite: 4,
  });
  assert.match(global, /sistema/i);
  // Quem foi recusado precisa saber que não perdeu o que já estava rodando.
  assert.match(global, /nenhuma auditoria em andamento foi perdida/i);

  const pessoal = mensagemDeVagaRecusada({
    ok: false,
    escopo: "usuario",
    emCurso: 2,
    limite: 2,
  });
  assert.match(pessoal, /limite por usuário é 2/i);
});

console.log(`\n${passed} teste(s) de vazão OK`);
