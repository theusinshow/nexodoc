/**
 * A SUGESTÃO QUE DIZ "NENHUMA CORREÇÃO" NÃO É UM ACHADO.
 *
 * Casos reais: o banco de dev em 16/10/2026 e a 3ª volta do laço de corrigir e
 * reauditar o 040_26_est_md_a.
 *
 *   node scripts/test-sugestao-sem-correcao.ts  (== npm run test:sugestao-sem-correcao)
 */
import assert from "node:assert/strict";

import {
  ehSugestaoSemCorrecao,
  semSugestoesSemCorrecao,
} from "../lib/sugestao-sem-correcao.ts";

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

const sugestao = (acao: string, extra: Record<string, unknown> = {}) =>
  ({
    id: "INC-008",
    tipo: "Retomada no singular",
    origem: "ia",
    tier: "sugestao",
    pagina: "5",
    evidencia: "A impureza será retirada",
    sugestao_correcao: acao,
    ...extra,
  }) as never;

test("o caso do laço: «Nenhuma correção necessária.» sai", () => {
  assert.equal(ehSugestaoSemCorrecao(sugestao("Nenhuma correção necessária.")), true);
});

test("a palavra discutida entre guillemets não é troca concreta", () => {
  assert.equal(
    ehSugestaoSemCorrecao(sugestao("Nenhuma correção necessária; «prumo» pode ser adotado por preferência de redação.")),
    true,
  );
});

test("as outras formas de dispensar saem", () => {
  for (const acao of [
    "Nenhuma correção exigível com base apenas nos trechos apresentados.",
    "Nenhuma alteração sustentada pelo conjunto de citações apresentado.",
    "Nenhuma substituição obrigatória; esclarecer a redação apenas se necessário.",
    "Remover o achado. Eventual ausência deve ser verificada na relação completa de arquivos.",
    "Não editar com base neste candidato; seria necessário examinar visualmente a página 13.",
    "Tratar a correção no INC-005.",
    "Incorporar a ocorrência da página 27 e a delimitação do aterro do passeio à correção de INC-006.",
  ]) {
    assert.equal(ehSugestaoSemCorrecao(sugestao(acao)), true, acao);
  }
});

test("FICA: dispensa com troca concreta depois", () => {
  /*
   * É o teste que impede o filtro de virar o próximo esconde-achado: a linha
   * começa dispensando, mas ainda diz a alguém o que trocar e por qual valor.
   */
  assert.equal(
    ehSugestaoSemCorrecao(
      sugestao("Nenhuma correção obrigatória; se a intenção for informar a autonomia calculada, substituir «3,5 dias» por «aproximadamente 3,76 dias» na página 64."),
    ),
    false,
  );
});

test("FICA: ação de verdade que cita outro achado no meio", () => {
  assert.equal(
    ehSugestaoSemCorrecao(sugestao("Corrigir a identificação da página 11 e revisar o trecho associado no âmbito de INC-014.")),
    false,
  );
});

test("FICA: achado de tier normal, mesmo com a mesma frase", () => {
  assert.equal(ehSugestaoSemCorrecao(sugestao("Nenhuma correção necessária.", { tier: undefined })), false);
});

test("FICA: regra e questão em aberto do motor nunca saem", () => {
  assert.equal(ehSugestaoSemCorrecao(sugestao("Nenhuma correção necessária.", { origem: "regra" })), false);
  assert.equal(ehSugestaoSemCorrecao(sugestao("Nenhuma correção necessária.", { motor: { state: "inconclusive" } })), false);
});

test("a lista devolve o que tirou", () => {
  const fica = sugestao("Opcionalmente substituir “revitalização” por “implantação da nova UBS”.");
  const sai = sugestao("Nenhuma correção necessária.");
  const { mantidos, removidos } = semSugestoesSemCorrecao([fica, sai]);
  assert.deepEqual(mantidos, [fica]);
  assert.deepEqual(removidos, [sai]);
});

console.log(`\n${passed} teste(s) ok`);
