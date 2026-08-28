/**
 * O PARECER EM PAPEL — as decisões que erram, provadas sem gerar PDF.
 *
 *   node scripts/test-parecer-em-papel.ts   (== npm run test:parecer-papel)
 *
 * A régua é de mentira de propósito: 1 ponto por caractere. Com ela a
 * paginação vira aritmética conferível à mão — e é a paginação, não o desenho,
 * que separa o cabeçalho de um achado da evidência dele.
 */
import assert from "node:assert/strict";

import type { AuditReport } from "../lib/audit-report.ts";
import {
  ALTURA,
  blocosDoParecer,
  contagemPorImpacto,
  paginarParecer,
  quebrar,
  rodapeDaPagina,
} from "../lib/parecer-em-papel.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed++;
  console.log(`  ok  ${nome}`);
}

/** Régua de mentira: um ponto por caractere. */
const medir = (t: string) => t.length;

const achado = (over: Partial<AuditReport["incongruencias"][number]> = {}) => ({
  id: "INC-001",
  prioridade: "Alta" as const,
  pagina: "12",
  capitulo: "PPCI",
  local: "",
  tipo: "Saída de emergência sem largura",
  descricao: "Falta a largura declarada.",
  evidencia: "a saída deverá atender ao previsto",
  conflito: "NBR 9077 exige largura mínima",
  sugestao_correcao: "Declarar a largura.",
  confianca: "alta" as const,
  impacto: "critico_documental" as const,
  ...over,
});

const parecer = (over: Partial<AuditReport> = {}): AuditReport =>
  ({
    tipo_auditoria: "memorial",
    tipo_documento: "memorial descritivo",
    obra: "UBS Vila Manaus",
    codigo: "117-25",
    municipio: "Criciúma",
    data_documento: "10/2025",
    status_analise: "concluida",
    status_geral: "com inconsistências críticas",
    total_incongruencias: 1,
    arquivos_analisados: [],
    comparacoes: [],
    conclusao: "Corrigir antes de emitir.",
    incongruencias: [achado()],
    ...over,
  }) as AuditReport;

// --- quebra de linha
test("quebra pela largura, sem cortar palavra", () => {
  assert.deepEqual(quebrar("um dois tres", "texto", 8, medir), [
    "um dois",
    "tres",
  ]);
});

test("palavra maior que a linha ocupa a linha inteira em vez de sumir", () => {
  assert.deepEqual(quebrar("supercalifragilistico", "texto", 5, medir), [
    "supercalifragilistico",
  ]);
});

// --- contagem
test("a contagem sai do IMPACTO, e achado sem impacto não some", () => {
  const c = contagemPorImpacto([
    achado(),
    achado({ impacto: "tecnico_contratual" }),
    achado({ impacto: undefined }),
  ]);
  assert.deepEqual(c, { criticos: 1, contratuais: 1, outros: 1, total: 3 });
});

// --- o que entra no papel
test("sugestão da IA NÃO vai para o papel", () => {
  const blocos = blocosDoParecer(
    parecer({
      incongruencias: [achado(), achado({ id: "INC-002", tier: "sugestao" })],
    }),
  );
  const texto = blocos.map((b) => b.texto).join(" | ");
  assert.ok(texto.includes("INC-001"));
  assert.ok(!texto.includes("INC-002"));
});

test("análise PARCIAL é dita no papel, logo abaixo do veredito", () => {
  const blocos = blocosDoParecer(parecer({ status_analise: "parcial" }));
  const i = blocos.findIndex((b) => b.texto.includes("ANÁLISE PARCIAL"));
  const v = blocos.findIndex(
    (b) => b.estilo === "secao" && b.texto === "Veredito",
  );
  assert.ok(i > v, "o aviso vem depois do veredito");
  assert.ok(blocos[i].texto.includes("não use este parecer para liberar"));
});

test("análise concluída não inventa aviso nenhum", () => {
  const texto = blocosDoParecer(parecer())
    .map((b) => b.texto)
    .join(" ");
  assert.ok(!texto.includes("ANÁLISE"));
});

test("cada achado leva evidência, conflito e correção", () => {
  const blocos = blocosDoParecer(parecer());
  const rotulos = blocos
    .filter((b) => b.estilo === "rotulo")
    .map((b) => b.texto);
  assert.deepEqual(rotulos, ["EVIDÊNCIA", "CONFLITO", "CORREÇÃO RECOMENDADA"]);
});

// --- paginação: a regra que existe para não separar o achado do que o explica
test("o cabeçalho do achado NÃO fica sozinho no pé da página", () => {
  const blocos = [
    { estilo: "texto" as const, texto: "a".repeat(10) },
    { estilo: "achado" as const, texto: "INC-009", abreAssunto: true },
    { estilo: "texto" as const, texto: "a evidência dele" },
  ];
  // Altura para o primeiro texto (14) + o cabeçalho (16), e nada mais.
  const paginas = paginarParecer(blocos, { largura: 100, altura: 30 }, medir);
  assert.equal(paginas.length, 2);
  assert.equal(
    paginas[0].blocos.length,
    1,
    "o cabeçalho desceu junto com a evidência",
  );
  assert.equal(paginas[1].blocos[0].bloco.texto, "INC-009");
});

test("cabendo os dois, o achado não é empurrado à toa", () => {
  const blocos = [
    { estilo: "achado" as const, texto: "INC-009", abreAssunto: true },
    { estilo: "texto" as const, texto: "evidência" },
  ];
  const paginas = paginarParecer(
    blocos,
    { largura: 100, altura: ALTURA.achado + ALTURA.texto },
    medir,
  );
  assert.equal(paginas.length, 1);
});

test("parecer sem achado nenhum ainda dá uma página", () => {
  const paginas = paginarParecer([], { largura: 100, altura: 500 }, medir);
  assert.equal(paginas.length, 1);
});

// --- rodapé
test("o rodapé identifica a folha solta: obra, código e página", () => {
  assert.equal(
    rodapeDaPagina(parecer(), 4, 9),
    "NEXODOC · 117-25 · UBS Vila Manaus · 4/9",
  );
});

test("sem obra declarada, o rodapé diz isso em vez de mentir", () => {
  assert.ok(
    rodapeDaPagina(parecer({ obra: "" }), 1, 1).includes("sem obra declarada"),
  );
});

test("o sumario nao imprime parcela zerada", () => {
  const texto = blocosDoParecer(parecer())
    .map((b) => b.texto)
    .join(" ");
  assert.ok(texto.includes("1 achado"));
  assert.ok(texto.includes("1 crítico documental"));
  assert.ok(!texto.includes("0 outros"), texto);
});

console.log(`\n${passed} ok`);
