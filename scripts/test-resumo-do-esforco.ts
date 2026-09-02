/**
 * O RESUMO DO ESFORÇO não pode exagerar o que foi feito.
 *
 * O relatório do 084_25 afirmou "98 blocos de leitura por capítulo" numa corrida
 * que leu 8 — a frase usava o total de capítulos do documento em vez dos blocos
 * que foram ao modelo, e a leitura global tinha recebido 16% do texto.
 *
 *   node scripts/test-resumo-do-esforco.ts   (== npm run test:resumo-esforco)
 */
import assert from "node:assert/strict";

import {
  coberturaCompleta,
  coberturaReconciliada,
  fracaoLida,
  paginasMudasPendentes,
  resumoDoEsforco,
} from "../lib/resumo-do-esforco.ts";

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

/** A corrida real do 084_25 em 17/08/2026. */
const O_084_25 = {
  caracteres_lidos: 90_000,
  caracteres_totais: 547_855,
  blocos_lidos: 8,
  blocos_totais: 98,
};

const COMPLETA = {
  caracteres_lidos: 547_855,
  caracteres_totais: 547_855,
  blocos_lidos: 98,
  blocos_totais: 98,
};

test("o caso real: diz 8 de 98, não 98", () => {
  const frase = resumoDoEsforco(O_084_25);
  assert.match(frase, /8 de 98 blocos/);
  assert.doesNotMatch(frase, /(?<!de )98 blocos/, "não pode anunciar 98 como lidos");
});

test("o caso real: declara a fração lida do documento", () => {
  assert.match(resumoDoEsforco(O_084_25), /16% do documento/);
});

test("o caso real: AVISA que partes não foram lidas", () => {
  /*
   * O aviso vai DENTRO da frase, não num campo à parte: foi a ausência dele que
   * deixou uma leitura de 16% chegar à tela com cara de auditoria completa.
   */
  assert.match(resumoDoEsforco(O_084_25), /ATENÇÃO/);
});

test("cobertura completa não leva aviso", () => {
  const frase = resumoDoEsforco(COMPLETA);
  assert.doesNotMatch(frase, /ATENÇÃO/);
  assert.match(frase, /documento inteiro/);
  assert.match(frase, /98 blocos de leitura por capítulo \(todos\)/);
});

test("Profundo: global inteira e ZERO blocos planejados É cobertura completa", () => {
  /*
   * Este teste afirmava o contrário, e a afirmação estava errada na prática.
   *
   * No Profundo `chunkLimit` é 0 por desenho: a global lê o documento inteiro e
   * nenhum bloco é planejado. Exigir `blocos_lidos >= blocos_totais` marcava
   * TODA corrida Profunda como incompleta. Medido em 18/08/2026 no 117_25 — a
   * corrida boa e a corrida cuja global morreu em 503 saíram com a mesma frase,
   * o mesmo "ATENÇÃO" e a mesma cobertura. O aviso existia para denunciar a
   * segunda e não conseguia, porque nunca se apagava na primeira.
   */
  const soGlobal = { ...COMPLETA, blocos_lidos: 0, blocos_totais: 98, blocos_planejados: 0 };
  assert.equal(coberturaCompleta(soGlobal), true);
  assert.doesNotMatch(resumoDoEsforco(soGlobal), /ATENÇÃO/);
});

test("Padrão: plano de 8 blocos com 3 lidos continua incompleto", () => {
  // Onde a intenção original vale, ela segue valendo: o plano previa blocos e
  // eles ficaram para trás.
  const parcial = { ...COMPLETA, blocos_lidos: 3, blocos_totais: 98, blocos_planejados: 8 };
  assert.equal(coberturaCompleta(parcial), false);
  assert.match(resumoDoEsforco(parcial), /ATENÇÃO/);
});

test("parecer antigo, sem plano declarado, é lido como antes", () => {
  // Sem `blocos_planejados` vale `blocos_totais` — quem já estava gravado não
  // muda de significado por causa deste conserto.
  const antigo = { ...COMPLETA, blocos_lidos: 8, blocos_totais: 98 };
  assert.equal(coberturaCompleta(antigo), false);
});

test("global que falhou zera os caracteres lidos", () => {
  /*
   * O caso de 18/08: a global abortou com 503 e a cobertura seguiu afirmando
   * 469.053 de 469.053 caracteres lidos por uma passada que leu ZERO. A prosa
   * sabia da falha; os números não. Quem consome `cobertura` por máquina lia
   * cobertura total de uma auditoria sem IA nenhuma.
   */
  const prometido = { ...COMPLETA, blocos_lidos: 0, blocos_totais: 98, blocos_planejados: 0 };
  const real = coberturaReconciliada(prometido, [
    { passada: "Leitura global do documento", motivo: "503 overloaded" },
  ]);
  assert.equal(real.caracteres_lidos, 0);
  assert.equal(coberturaCompleta(real), false);
  assert.match(resumoDoEsforco(real), /ATENÇÃO/);
});

test("sem falha, a cobertura reconciliada é a mesma", () => {
  const c = { ...COMPLETA, blocos_lidos: 0, blocos_totais: 98, blocos_planejados: 0 };
  assert.deepEqual(coberturaReconciliada(c, []), c);
  assert.equal(coberturaCompleta(coberturaReconciliada(c, [])), true);
});

test("falha de OUTRA passada não mexe na leitura global", () => {
  // Blocos que falharam são buraco de blocos, não de leitura global. Zerar a
  // global por causa deles trocaria uma mentira por outra.
  const c = { ...COMPLETA, blocos_lidos: 2, blocos_totais: 98, blocos_planejados: 8 };
  const real = coberturaReconciliada(c, [{ passada: "blocos", motivo: "teto" }]);
  assert.equal(real.caracteres_lidos, COMPLETA.caracteres_lidos);
});

test("sem blocos, a frase não inventa a parte de blocos", () => {
  const soGlobal = { ...COMPLETA, blocos_lidos: 0, blocos_totais: 98 };
  assert.doesNotMatch(resumoDoEsforco(soGlobal), /blocos de leitura/);
});

test("fração nunca passa de 100% nem divide por zero", () => {
  assert.equal(fracaoLida({ ...COMPLETA, caracteres_lidos: 999_999 }), 1);
  assert.equal(fracaoLida({ ...COMPLETA, caracteres_totais: 0 }), 0);
});

test("sem medição, não afirma cobertura nenhuma", () => {
  const frase = resumoDoEsforco(undefined);
  assert.doesNotMatch(frase, /\d/, "parecer antigo não ganha número inventado");
  assert.ok(frase.length > 10);
});

test("zero por cento nao e amostra pequena, e passada ausente", () => {
  // "0% (trechos amostrados)" descreveria uma amostragem que nao houve.
  const nada = { ...COMPLETA, caracteres_lidos: 0, blocos_lidos: 0, blocos_totais: 98, blocos_planejados: 0 };
  const frase = resumoDoEsforco(nada);
  assert.match(frase, /N.O foi conclu/);
  assert.doesNotMatch(frase, /amostrados/);
});

/*
 * O 114-19, em 02/09/2026. O denominador sai da PRÓPRIA extração, então a folha
 * cujo texto está desenhado em vez de escrito não baixa a fração: ela some da
 * conta. 7.470 de 7.470 caracteres, cobertura completa, parecer sem ressalva —
 * numa auditoria que viu 6 das 31 páginas do memorial.
 */
const O_114_19 = {
  caracteres_lidos: 7_470,
  caracteres_totais: 7_470,
  blocos_lidos: 2,
  blocos_totais: 2,
  paginas_mudas: 25,
  paginas_transcritas: 0,
};

test("25 folhas sem texto não deixam a cobertura sair completa", () => {
  assert.equal(fracaoLida(O_114_19), 1, "a fração mente por construção: 7.470/7.470");
  assert.equal(coberturaCompleta(O_114_19), false, "e por isso ela não decide sozinha");
  assert.equal(paginasMudasPendentes(O_114_19), 25);
});

test("o resumo diz QUANTAS folhas ficaram sem leitura, e por quê", () => {
  const frase = resumoDoEsforco(O_114_19);
  assert.match(frase, /ATEN..O: 25 p.ginas/);
  assert.match(frase, /desenhado na folha/);
});

test("transcrever todas as folhas mudas devolve a cobertura completa", () => {
  const transcrito = { ...O_114_19, paginas_transcritas: 25 };
  assert.equal(paginasMudasPendentes(transcrito), 0);
  assert.equal(coberturaCompleta(transcrito), true);
  const frase = resumoDoEsforco(transcrito);
  assert.match(frase, /25 p.ginas sem texto recuperadas por vis.o/);
  assert.doesNotMatch(frase, /ATEN..O/);
});

test("transcrição parcial conta o que sobrou, não o que foi feito", () => {
  const meio = { ...O_114_19, paginas_transcritas: 20 };
  assert.equal(paginasMudasPendentes(meio), 5);
  assert.equal(coberturaCompleta(meio), false);
  assert.match(resumoDoEsforco(meio), /ATEN..O: 5 p.ginas/);
});

test("parecer antigo, sem os campos novos, não muda de comportamento", () => {
  // Nenhum parecer gravado antes de 02/09/2026 declara `paginas_mudas`. Deduzir
  // "tem buraco" para eles acenderia o alarme no acervo inteiro — e um alarme
  // que toca sempre não avisa nada.
  assert.equal(paginasMudasPendentes(COMPLETA), 0);
  assert.equal(coberturaCompleta(COMPLETA), true);
  assert.doesNotMatch(resumoDoEsforco(COMPLETA), /desenhado na folha/);
});

console.log(`\n${passed} teste(s) de resumo do esforço OK`);
