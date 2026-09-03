/**
 * Teste do BATIMENTO da auditoria — como se sabe que uma análise ainda vive.
 *
 * O que se prova aqui é o julgamento, não a escrita: dado um registro e um
 * relógio, esta auditoria ainda tem alguém do outro lado? É a decisão que
 * transforma "rodando para sempre" em "falhou, rode de novo", e errá-la para
 * qualquer um dos lados é caro — para cá, mata análise viva no meio; para lá,
 * devolve a mentira eterna que ela existe para acabar.
 *
 *   node scripts/test-batimento-da-auditoria.ts   (== npm run test:batimento)
 */
import assert from "node:assert/strict";

import {
  BATIMENTOS_ATE_DESISTIR,
  INTERVALO_DE_BATIMENTO_MS,
  SEM_SINAL_MS,
  auditoriaSemSinal,
} from "../lib/batimento-da-auditoria.ts";

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

const AGORA = new Date("2026-09-03T12:00:00.000Z");
const ha = (ms: number) => new Date(AGORA.getTime() - ms);

test("a tolerância é MAIOR que o intervalo, e por mais de um batimento", () => {
  /*
   * Se `SEM_SINAL_MS` fosse igual ao intervalo, um único atraso de rede no
   * `update` mataria uma auditoria viva. A margem é o que separa "o processo
   * morreu" de "o batimento chegou tarde".
   */
  assert.ok(SEM_SINAL_MS > INTERVALO_DE_BATIMENTO_MS);
  assert.equal(SEM_SINAL_MS, INTERVALO_DE_BATIMENTO_MS * BATIMENTOS_ATE_DESISTIR);
  assert.ok(BATIMENTOS_ATE_DESISTIR >= 2);
});

test("batimento recente: viva", () => {
  const viva = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: ha(5_000), createdAt: ha(600_000) },
    AGORA,
  );
  assert.equal(viva, false);
});

test("análise LONGA com batimento em dia continua viva", () => {
  /*
   * O caso que um teto de duração quebraria: a leitura global do Profundo pode
   * levar 15 minutos numa única chamada, sem marco nenhum no meio. O batimento
   * não olha para quanto tempo faz que começou.
   */
  const viva = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: ha(20_000), createdAt: ha(50 * 60_000) },
    AGORA,
  );
  assert.equal(viva, false);
});

test("batimento parado além da tolerância: sem sinal", () => {
  const morta = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: ha(SEM_SINAL_MS + 1_000), createdAt: ha(600_000) },
    AGORA,
  );
  assert.equal(morta, true);
});

test("na fronteira exata ainda se dá o benefício da dúvida", () => {
  const naBorda = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: ha(SEM_SINAL_MS), createdAt: ha(600_000) },
    AGORA,
  );
  assert.equal(naBorda, false);
});

test("recém-criada e ainda sem batimento: viva", () => {
  /*
   * A corrida do primeiro batimento. Entre `createPendingAudit` e a primeira
   * escrita há uma janela em que `heartbeatAt` é nulo — declarar morta aí
   * mataria toda auditoria no berço.
   */
  const viva = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: null, createdAt: ha(3_000) },
    AGORA,
  );
  assert.equal(viva, false);
});

test("linha velha SEM batimento nenhum: sem sinal", () => {
  /*
   * As que já estavam presas antes desta coluna existir. Sem esta regra elas
   * ficariam em PROCESSING para sempre — o defeito continuaria, só que
   * congelado no acervo em vez de novo a cada queda.
   */
  const morta = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: null, createdAt: ha(72 * 3_600_000) },
    AGORA,
  );
  assert.equal(morta, true);
});

test("só PROCESSING é julgada — o resto já tem desfecho", () => {
  /*
   * COMPLETED, FAILED e CANCELED são estados FINAIS. Reabri-los por causa de
   * um batimento velho (que nunca mais vai chegar, porque acabou) apagaria
   * parecer pronto.
   */
  for (const status of ["COMPLETED", "FAILED", "CANCELED"]) {
    assert.equal(
      auditoriaSemSinal(
        { status, heartbeatAt: ha(90 * 3_600_000), createdAt: ha(90 * 3_600_000) },
        AGORA,
      ),
      false,
      `${status} não deveria ser julgado sem sinal`,
    );
  }
});

test("relógio que anda para trás não mata auditoria", () => {
  /*
   * `heartbeatAt` no futuro acontece com desvio de relógio entre a instância e
   * o banco. Diferença negativa nunca passa da tolerância — o que se quer é
   * exatamente isso, e não um `Math.abs` que trataria adiantamento como
   * atraso.
   */
  const viva = auditoriaSemSinal(
    { status: "PROCESSING", heartbeatAt: new Date(AGORA.getTime() + 60_000), createdAt: ha(600_000) },
    AGORA,
  );
  assert.equal(viva, false);
});

console.log(`\n${passed} teste(s) de batimento OK`);
