/**
 * A matriz de severidade. Núcleo PURO → node cru.
 *
 *   node scripts/test-severidade.ts   (== npm run test:severidade)
 *
 * O GABARITO É A TABELA INTEIRA. São nove cruzamentos (três consequências ×
 * três graus de certeza) e todos estão aqui, um a um, escritos à mão. Testar
 * "alguns casos" numa matriz é deixar de testá-la: o valor dela é ser completa
 * e igual toda vez.
 *
 * Depois vem a parte que não é sobre acerto, e sim sobre HISTÓRIA. Em agosto de
 * 2026 quatro regras que mandavam calar saíram do auditor porque escondiam
 * achado. "Apertar a severidade" é a porta pela qual isso volta — e a última
 * seção existe para trancá-la: nenhuma combinação de incerteza pode empurrar um
 * achado para fora da faixa da sua consequência.
 */
import assert from "node:assert/strict";

import { severidadeDoAchado } from "../lib/severidade.ts";
import type { AuditFinding, FindingImpact, FindingConfidence } from "../lib/audit-report.ts";

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

function achado(partial: Partial<AuditFinding>): AuditFinding {
  return {
    id: "T-001",
    prioridade: "Baixa",
    pagina: "1",
    capitulo: "cap",
    local: "local",
    tipo: "tipo",
    descricao: "desc",
    evidencia: "ev",
    conflito: "conf",
    sugestao_correcao: "corrigir",
    confianca: "media",
    ...partial,
  };
}

const prioridadeDe = (impacto: FindingImpact, confianca: FindingConfidence) =>
  severidadeDoAchado(achado({ impacto, confianca })).prioridade;

// --- a tabela, os nove cruzamentos -----------------------------------------

test("crítico documental: Alta nos três graus de certeza", () => {
  assert.equal(prioridadeDe("critico_documental", "alta"), "Alta");
  assert.equal(prioridadeDe("critico_documental", "media"), "Alta");
  assert.equal(prioridadeDe("critico_documental", "baixa"), "Alta");
});

test("técnico contratual: Media/Alta, Media, Media", () => {
  assert.equal(prioridadeDe("tecnico_contratual", "alta"), "Media/Alta");
  assert.equal(prioridadeDe("tecnico_contratual", "media"), "Media");
  assert.equal(prioridadeDe("tecnico_contratual", "baixa"), "Media");
});

test("revisão editorial: Media, Baixa/Media, Baixa", () => {
  assert.equal(prioridadeDe("revisao_editorial", "alta"), "Media");
  assert.equal(prioridadeDe("revisao_editorial", "media"), "Baixa/Media");
  assert.equal(prioridadeDe("revisao_editorial", "baixa"), "Baixa");
});

// --- a garantia: a certeza não sai da faixa --------------------------------

test("nenhuma incerteza rebaixa um achado que impede a emissão", () => {
  /*
   * O caso exato do risco. Um bloqueador lido com confiança baixa continua
   * bloqueador — a dúvida já é dita na camada `sugestao` e no selo do cartão,
   * e repeti-la aqui custaria o lugar dele no topo da lista.
   */
  const baixa = severidadeDoAchado(
    achado({ impacto: "critico_documental", confianca: "baixa", origem: "ia" }),
  );
  assert.equal(baixa.prioridade, "Alta");
  assert.match(baixa.motivo, /incerteza não atenua/i);
});

test("editorial nunca sobe para Alta, por mais certo que seja", () => {
  // A faixa protege dos dois lados: ela impede o rebaixamento e impede que
  // "revisão de texto" dispute o topo com o que impede emitir.
  assert.equal(prioridadeDe("revisao_editorial", "alta"), "Media");
});

test("achado de REGRA conta como certeza alta, ignorando o campo confianca", () => {
  /*
   * Achado de regra é comparação determinística, não leitura: não tem como
   * alucinar, e a confiança que o modelo declarou não fala dele. Sem isto, uma
   * regra que gravasse "media" seria rebaixada por um número que não é sobre
   * ela.
   */
  const porRegra = severidadeDoAchado(
    achado({ impacto: "tecnico_contratual", confianca: "baixa", origem: "regra" }),
  );
  assert.equal(porRegra.prioridade, "Media/Alta");
  assert.match(porRegra.motivo, /verificado por regra/i);
});

// --- o motivo é a auditabilidade, então ele tem de dizer algo --------------

test("o motivo nomeia os DOIS eixos, não só o resultado", () => {
  const s = severidadeDoAchado(
    achado({ impacto: "tecnico_contratual", confianca: "alta", origem: "ia" }),
  );
  assert.match(s.motivo, /Consequência:/);
  assert.match(s.motivo, /Certeza:/);
  assert.match(s.motivo, /responsável técnico/i);
  assert.match(s.motivo, /confiança alta/i);
});

test("mesmo achado, mesma resposta — a matriz não depende dos vizinhos", () => {
  /*
   * Severidade que olha a lista produz "este é menos grave porque hoje tem
   * muita coisa grave", que foi o raciocínio que sumiu com achados. A função
   * recebe um achado e nada mais; este teste trava a assinatura.
   */
  const a = severidadeDoAchado(achado({ impacto: "revisao_editorial", confianca: "media" }));
  const b = severidadeDoAchado(achado({ impacto: "revisao_editorial", confianca: "media" }));
  assert.deepEqual(a, b);
});

test("sem impacto declarado, a matriz usa o classificado — não estoura", () => {
  const s = severidadeDoAchado(
    achado({ tipo: "Erro de grafia", categoria: "Ortografia / Redação", confianca: "media" }),
  );
  assert.ok(["Alta", "Media/Alta", "Media", "Baixa/Media", "Baixa"].includes(s.prioridade));
  assert.match(s.motivo, /Consequência:/);
});

console.log(`\n${passed} teste(s) OK`);
