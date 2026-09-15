/**
 * A ABA TRAVADA NÃO GASTA — revisão final da segunda rodada, 15/09/2026.
 *
 * Com `conflitoDeVersao` (outra aba ou máquina gravou a conversa depois que esta
 * a abriu, jornada c3), a fila descarta toda gravação desta aba. Auditoria,
 * agente e LD continuavam ligados: a auditoria paga rodava e o parecer nunca era
 * registrado. A regra: aba travada não dispara nada que custa modelo, e diz por
 * quê com a frase da faixa.
 *
 *   node scripts/test-aba-travada.ts
 */
import assert from "node:assert/strict";

import {
  MOTIVO_ABA_TRAVADA,
  MOTIVO_SEM_CONFERIR,
  juntarOrigens,
  motivoParaNaoGastar,
  origemDaTrava,
  origemDaTravaAoAbrir,
  podeGastar,
  recargaPedeConfirmacao,
  textoDaFaixa,
} from "../modules/nexo/lib/aba-travada.ts";

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

test("aba sem conflito pode gastar, e não há motivo", () => {
  assert.equal(podeGastar({ conflitoDeVersao: false }), true);
  assert.equal(motivoParaNaoGastar({ conflitoDeVersao: false }), null);
});

test("aba travada pelo conflito de versão não gasta", () => {
  assert.equal(podeGastar({ conflitoDeVersao: true }), false);
});

test("a recusa usa a frase da faixa: a conversa mudou em outra aba", () => {
  assert.equal(motivoParaNaoGastar({ conflitoDeVersao: true }), MOTIVO_ABA_TRAVADA);
  assert.match(MOTIVO_ABA_TRAVADA, /Esta conversa mudou em outra aba/);
  assert.match(MOTIVO_ABA_TRAVADA, /[Rr]ecarregue/);
});

/*
 * A TRAVA QUE NINGUÉM PROVOU — 15/09/2026, depois da segunda rodada. Com a base
 * aberta do disco sem conferir o servidor (a marca "manter"), o 409 pode ser a
 * própria gravação atrasada desta aba. A faixa dizia "Esta conversa mudou em
 * outra aba" — falso ali —, e o único botão trocava o disco pela cópia do
 * servidor, apagando edições que só existem nesta máquina.
 */
test("a origem da trava: só o 409 com base não conferida é 'sem-conferir'", () => {
  assert.equal(origemDaTrava({ origem: "disco", vaiDescer: false }), "outra-aba");
  assert.equal(origemDaTrava({ origem: "servidor", vaiDescer: true }), "outra-aba");
  assert.equal(origemDaTrava({ origem: "servidor", vaiDescer: false }), "sem-conferir");
});

test("ao abrir travada, a marca diz a origem: 'manter' é sem conferir, o resto é outra aba", () => {
  assert.equal(origemDaTravaAoAbrir({ marca: "manter" }), "sem-conferir");
  assert.equal(origemDaTravaAoAbrir({ marca: "descer" }), "outra-aba");
  assert.equal(origemDaTravaAoAbrir({ marca: null }), "outra-aba");
  // Sem a marca, mas a fila sabe que a trava da memória veio sem conferir.
  assert.equal(origemDaTravaAoAbrir({ marca: null, semConferir: true }), "sem-conferir");
});

test("uma trava provada não volta a ser 'sem conferir'; a sem conferir pode virar provada", () => {
  assert.equal(juntarOrigens(null, "sem-conferir"), "sem-conferir");
  assert.equal(juntarOrigens("sem-conferir", "outra-aba"), "outra-aba");
  assert.equal(juntarOrigens("outra-aba", "sem-conferir"), "outra-aba");
});

test("sem conferir, a recusa não diz que a conversa mudou em outra aba", () => {
  const motivo = motivoParaNaoGastar({ conflitoDeVersao: true, origem: "sem-conferir" });
  assert.equal(motivo, MOTIVO_SEM_CONFERIR);
  assert.doesNotMatch(MOTIVO_SEM_CONFERIR, /mudou em outra aba/);
  assert.match(MOTIVO_SEM_CONFERIR, /servidor/);
  assert.equal(motivoParaNaoGastar({ conflitoDeVersao: true, origem: "outra-aba" }), MOTIVO_ABA_TRAVADA);
  assert.equal(motivoParaNaoGastar({ conflitoDeVersao: false, origem: "sem-conferir" }), null);
});

test("a faixa distingue as duas origens, e a sem conferir oferece recarregar DO SERVIDOR", () => {
  const real = textoDaFaixa("outra-aba");
  assert.equal(real.titulo, "Esta conversa mudou em outra aba");
  assert.equal(real.botao, "Recarregar a conversa");
  const semConferir = textoDaFaixa("sem-conferir");
  assert.doesNotMatch(semConferir.titulo + semConferir.corpo, /mudou em outra aba|gravou esta conversa/);
  assert.match(semConferir.titulo, /confirmar/);
  assert.equal(semConferir.botao, "Recarregar do servidor");
});

test("recarregar do servidor pede confirmação quando o disco desta máquina é outra versão", () => {
  // A trava provada: o servidor é a verdade, recarrega direto, como sempre foi.
  assert.equal(recargaPedeConfirmacao({ origem: "outra-aba", disco: 5000, servidor: 1000 }), false);
  // Sem conferir: disco igual ao servidor não tem o que perder.
  assert.equal(recargaPedeConfirmacao({ origem: "sem-conferir", disco: 1000, servidor: 1000 }), false);
  // Disco com versão que o servidor não tem (mais nova OU mais velha): confirma.
  assert.equal(recargaPedeConfirmacao({ origem: "sem-conferir", disco: 5000, servidor: 1000 }), true);
  assert.equal(recargaPedeConfirmacao({ origem: "sem-conferir", disco: 900, servidor: 1000 }), true);
  // Não deu para saber a do servidor: na dúvida, confirma.
  assert.equal(recargaPedeConfirmacao({ origem: "sem-conferir", disco: 5000, servidor: null }), true);
  // Nada no disco: nada a perder.
  assert.equal(recargaPedeConfirmacao({ origem: "sem-conferir", disco: null, servidor: 1000 }), false);
});

console.log(`\n${passed} teste(s) passaram`);
