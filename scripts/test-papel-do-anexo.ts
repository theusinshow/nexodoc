/**
 * Teste do PAPEL DO ANEXO — memorial ou prancha, decidido antes de ler.
 *
 * O que se prova aqui é o julgamento com fatos de mentira: a geometria sozinha,
 * e depois a precedência contra o nome. Os limiares só valem depois da medição
 * no acervo (`npm run medir:papel`), e é por isso que cada um deles tem um caso
 * dos DOIS lados da fronteira — escrito em termos da constante, para que mudar
 * o número não faça o teste passar por acidente.
 *
 *   node scripts/test-papel-do-anexo.ts   (== npm run test:papel-do-anexo)
 */
import assert from "node:assert/strict";

import {
  CHARS_DE_MEMORIAL,
  PAGINAS_PARA_SER_DOCUMENTO,
  decidirPapel,
  paginasDaAmostra,
  papelPelaGeometria,
  type FatosDoAnexo,
  type MedidaDaPagina,
} from "../modules/nexo/lib/papel-do-anexo.ts";

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

const pagina = (p: Partial<MedidaDaPagina> = {}): MedidaDaPagina => ({
  tipo: "capa",
  chars: 4000,
  temTinta: false,
  ...p,
});

const fatos = (paginas: number, amostra: MedidaDaPagina[]): FatosDoAnexo => ({
  paginas,
  amostra,
});

// ------------------------------------------------------------------ amostra

test("a amostra é espalhada, não as primeiras", () => {
  /*
   * Um memorial que abre com capa + sumário derruba a média das três primeiras,
   * e o 116_25_md_ter_pav já está no fio (1157 chars/pág, o menor do acervo).
   */
  assert.deepEqual(paginasDaAmostra(100), [1, 50, 75]);
});

test("documento curto não repete página na amostra", () => {
  assert.deepEqual(paginasDaAmostra(1), [1]);
  assert.deepEqual(paginasDaAmostra(2), [1, 2]);
});

test("a amostra nunca sai do documento", () => {
  for (const total of [1, 2, 3, 5, 11, 258]) {
    for (const n of paginasDaAmostra(total)) {
      assert.ok(n >= 1 && n <= total, `página ${n} fora de 1..${total}`);
    }
  }
});

test("documento sem página nenhuma não gera amostra", () => {
  assert.deepEqual(paginasDaAmostra(0), []);
});

// ---------------------------------------------------------------- geometria

test("uma folha com carimbo já prova que é prancha", () => {
  /*
   * `classificarPagina` só devolve "prancha" com âncoras de carimbo ou papel
   * grande. Uma folha basta: o resto do arquivo pode ser capa e separatriz.
   */
  const f = fatos(40, [pagina({ tipo: "prancha", chars: 500 }), pagina(), pagina()]);
  assert.equal(papelPelaGeometria(f), "prancha");
});

test("A4 de texto corrido e páginas demais: memorial", () => {
  const f = fatos(67, [
    pagina({ chars: 5533 }),
    pagina({ chars: 5100 }),
    pagina({ chars: 4800 }),
  ]);
  assert.equal(papelPelaGeometria(f), "memorial");
});

test("volume montado NÃO é memorial: texto ralo demais", () => {
  // Medido no acervo: volume montado vai a 570 chars/pág; memorial começa em 1157.
  const f = fatos(21, [
    pagina({ chars: 379 }),
    pagina({ chars: 500 }),
    pagina({ chars: 198 }),
  ]);
  assert.notEqual(papelPelaGeometria(f), "memorial");
});

test("capa e separatriz: prancha, sem pergunta", () => {
  assert.equal(papelPelaGeometria(fatos(1, [pagina({ chars: 21 })])), "prancha");
  assert.equal(
    papelPelaGeometria(fatos(2, [pagina({ chars: 244 }), pagina({ chars: 179 })])),
    "prancha",
  );
});

test("folha MUDA não vira 'não é memorial' — vira pergunta", () => {
  /*
   * O 114_19: 31 folhas A4 com o texto DESENHADO (curva vetorial), 241
   * caracteres por página. Pela densidade seria "não é memorial", e chamar isso
   * de prancha repete o defeito de origem com outra roupa.
   */
  const f = fatos(31, [
    pagina({ chars: 90, temTinta: true }),
    pagina({ chars: 0, temTinta: true }),
    pagina({ chars: 120, temTinta: true }),
  ]);
  assert.equal(papelPelaGeometria(f), "nao-sei");
});

test("documento de tamanho médio sem sinal claro: não sei", () => {
  const f = fatos(5, [
    pagina({ chars: 700 }),
    pagina({ chars: 650 }),
    pagina({ chars: 800 }),
  ]);
  assert.equal(papelPelaGeometria(f), "nao-sei");
});

test("sem amostra nenhuma (PDF que não abriu): não sei", () => {
  assert.equal(papelPelaGeometria(fatos(0, [])), "nao-sei");
});

test("as fronteiras dos limiares são exatas", () => {
  const cheia = (chars: number) => [pagina({ chars }), pagina({ chars }), pagina({ chars })];
  assert.equal(
    papelPelaGeometria(fatos(PAGINAS_PARA_SER_DOCUMENTO, cheia(CHARS_DE_MEMORIAL))),
    "memorial",
  );
  assert.notEqual(
    papelPelaGeometria(fatos(PAGINAS_PARA_SER_DOCUMENTO - 1, cheia(CHARS_DE_MEMORIAL))),
    "memorial",
  );
  assert.notEqual(
    papelPelaGeometria(fatos(PAGINAS_PARA_SER_DOCUMENTO, cheia(CHARS_DE_MEMORIAL - 1))),
    "memorial",
  );
});

// --------------------------------------------------------------- precedência

const memorial = fatos(67, [
  pagina({ chars: 5533 }),
  pagina({ chars: 5100 }),
  pagina({ chars: 4800 }),
]);
const prancha = fatos(40, [
  pagina({ tipo: "prancha" }),
  pagina({ tipo: "prancha" }),
  pagina({ tipo: "prancha" }),
]);
const naoSei = fatos(5, [pagina({ chars: 700 })]);

test("nome que diz memorial ganha de qualquer geometria", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "memorial", pelaGeometria: "prancha", fatos: prancha }).papel,
    "memorial",
  );
});

test("nome confiante e geometria de acordo: segue o nome, calado", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "prancha", pelaGeometria: "prancha", fatos: prancha }).papel,
    "prancha",
  );
});

test("nome confiante e geometria sem opinião: segue o nome", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "capa", pelaGeometria: "nao-sei", fatos: naoSei }).papel,
    "prancha",
  );
});

test("nome diz prancha e a geometria diz memorial: PERGUNTA", () => {
  /*
   * O caso do kit de erros plantados: `02-contratual-e-escopo.pdf` é memorial e
   * o "02" do nome virou número de folha. Decidir sozinho por qualquer um dos
   * lados escolheria em silêncio contra evidência — e é isso que o estado
   * indeciso existe para não fazer.
   */
  const d = decidirPapel({ pelaConvencao: "prancha", pelaGeometria: "memorial", fatos: memorial });
  assert.equal(d.papel, "indeciso");
  assert.match(d.porque, /67/);
});

test("nome silencioso: a geometria decide", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "outro", pelaGeometria: "memorial", fatos: memorial }).papel,
    "memorial",
  );
  assert.equal(
    decidirPapel({ pelaConvencao: "outro", pelaGeometria: "prancha", fatos: prancha }).papel,
    "prancha",
  );
});

test("nome silencioso e geometria sem opinião: pergunta", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "outro", pelaGeometria: "nao-sei", fatos: naoSei }).papel,
    "indeciso",
  );
});

test("orçamento continua fora de escopo, sem virar pergunta", () => {
  /*
   * `foraDeEscopo` já é tratado antes do anexo virar trabalho. Aqui só se
   * garante que a geometria não o promove a memorial por ser A4 com texto.
   */
  assert.equal(
    decidirPapel({ pelaConvencao: "orcamento", pelaGeometria: "memorial", fatos: memorial }).papel,
    "prancha",
  );
});

test("todo indeciso vem com um porquê que cita o fato medido", () => {
  const d = decidirPapel({ pelaConvencao: "capa", pelaGeometria: "memorial", fatos: memorial });
  assert.equal(d.papel, "indeciso");
  assert.ok(d.porque.length > 20, "o porquê precisa dizer algo");
});

console.log(`\n${passed} teste(s) de papel do anexo OK`);
