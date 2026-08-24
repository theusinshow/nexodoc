/**
 * A grade da tabela, contra o pdf.js DE VERDADE.
 *
 *   node scripts/prova-tabela-do-pdf.ts   (== npm run prova:tabela-do-pdf)
 *
 * POR QUE ESTA PROVA EXISTE ALÉM DO TESTE PURO
 *
 * `test:tabela-do-pdf` prova a REGRA sobre itens que eu mesmo montei — e é
 * exatamente isso que a spec registra como risco 1: coordenadas que eu escrevo
 * são mais bem-comportadas que as de um gerador real. O teste puro deixa de fora
 * a premissa em que a reconstrução inteira se apoia: que `transform[4]` é o x
 * onde o item começa, que `width` é a largura que ele ocupa, e que um recuo de
 * coluna num PDF real produz vão maior que `VAO_DE_COLUNA` corpos.
 *
 * Se qualquer uma dessas fosse falsa, os 11 testes puros continuariam verdes e a
 * tabela chegaria à auditoria desmontada.
 *
 * A mesma doutrina da `prova-texto-do-pdf.ts`, que é a vizinha desta: não gasta
 * token, não precisa de amostra confidencial, o arquivo nasce e morre em
 * memória.
 */
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";

import { chunkPdfByChapter, extractPdfText } from "../lib/pdf-text.ts";
import { buildHaystack, isFindingGrounded } from "../lib/audit-verify.ts";
import type { AuditFinding } from "../lib/audit-report.ts";

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

const CORPO = 11;

const doc = await PDFDocument.create();
const regular = await doc.embedFont(StandardFonts.Helvetica);
const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
const pagina = doc.addPage([595, 842]);

/** Colunas em x fixo, como um quadro de áreas é diagramado de verdade. */
const COLUNAS = [60, 300, 430];

function linhaDaTabela(y: number, celulas: string[], fonte = regular) {
  celulas.forEach((texto, i) => {
    if (!texto) return;
    pagina.drawText(texto, { x: COLUNAS[i], y, size: CORPO, font: fonte });
  });
}

// Um quadro de áreas com cabeçalho, três ambientes e a linha de fechamento.
linhaDaTabela(780, ["AMBIENTE", "AREA (m2)", "PISO"], negrito);
linhaDaTabela(760, ["Bloco A - salas", "2.100,00", "Ceramica"]);
linhaDaTabela(740, ["Bloco B - servico", "2.430,98", "Granilite"]);
linhaDaTabela(720, ["Circulacao", "", "Ceramica"]);
linhaDaTabela(700, ["TOTAL", "4.530,98", ""]);

/*
 * Prosa logo abaixo, encostada. Ela existe para provar as duas coisas que a
 * tabela precisa: que o parágrafo NÃO é absorvido pela tabela, e que ele fecha
 * o bloco em vez de estendê-lo.
 */
const PROSA = [
  "O presente memorial descreve os servicos de acabamento previstos para a",
  "edificacao, observadas as normas tecnicas vigentes e as condicoes locais",
  "de execucao definidas pela fiscalizacao da obra em campo.",
];
PROSA.forEach((texto, i) => {
  pagina.drawText(texto, { x: 60, y: 660 - i * 20, size: CORPO, font: regular });
});

const buffer = Buffer.from(await doc.save());
const extraido = await extractPdfText(buffer);
const paginaExtraida = extraido.pages[0];
const tabelas = paginaExtraida.tabelas ?? [];

console.log(`\n  tabelas encontradas: ${tabelas.length}`);
for (const t of tabelas) {
  for (const linha of t.linhas) console.log(`    [${linha.map((c) => `"${c}"`).join(", ")}]`);
}
console.log("");

test("o pdf.js real produz UMA tabela nesta pagina", () => {
  assert.equal(tabelas.length, 1, `esperava 1 tabela, veio ${tabelas.length}`);
});

test("a tabela tem as 5 linhas do quadro, e nao engoliu a prosa", () => {
  assert.equal(tabelas[0].linhas.length, 5);
});

test("as tres colunas sobrevivem ao gerador real", () => {
  assert.equal(tabelas[0].linhas[0].length, 3);
});

test("o valor com milhar e decimal chega INTEIRO na celula", () => {
  /*
   * O caso do benchmark. Se o gerador cortar o item no separador de milhar e a
   * célula não recosturar, "4.530,98" vira duas células e nenhuma regra
   * numérica funciona.
   */
  const total = tabelas[0].linhas.find((l) => l.some((c) => /^TOTAL/i.test(c)));
  assert.ok(total, "linha TOTAL nao encontrada");
  assert.ok(
    total.some((c) => c.trim() === "4.530,98"),
    `esperava a celula "4.530,98"; veio ${JSON.stringify(total)}`,
  );
});

test("celula vazia no meio nao desloca a coluna seguinte", () => {
  const circulacao = tabelas[0].linhas.find((l) => l[0]?.startsWith("Circulacao"));
  assert.ok(circulacao, "linha Circulacao nao encontrada");
  assert.equal(circulacao[2], "Ceramica", `veio ${JSON.stringify(circulacao)}`);
});

test("A PROSA NAO VIROU TABELA — a premissa que o teste puro nao alcanca", () => {
  const texto = tabelas.flatMap((t) => t.linhas.flat()).join(" ");
  assert.ok(
    !/presente memorial descreve/i.test(texto),
    "a prosa foi absorvida pela tabela",
  );
});

/*
 * A GRADE CHEGA AO MODELO? — a pergunta que faltava (24/08/2026).
 *
 * As seis provas acima param na reconstrucao: elas provam que a grade sai certa
 * das coordenadas. Nenhuma delas perguntava quem a LE, e a resposta era
 * "ninguem": `page.tabelas` tinha um unico consumidor em todo o repositorio,
 * `runDeclaredTotalAreaRule`. O texto que vai para a IA sai de `page.text`, e
 * `page.text` e a pagina achatada — numa tabela, as celulas viram uma sequencia
 * de palavras sem dono.
 *
 * Foi isso que produziu o achado "nao existe tabela" num documento que TEM a
 * tabela: o modelo nao estava errado sobre o que recebeu.
 */
test("O CHUNK QUE VAI PARA O MODELO TRAZ A GRADE, e nao so a pagina achatada", () => {
  const chunk = chunkPdfByChapter(extraido)[0];
  assert.ok(chunk, "esperava ao menos um bloco");

  assert.ok(
    /\[TABELA\]/.test(chunk.text),
    `o bloco enviado ao modelo nao marca tabela nenhuma:\n${chunk.text.slice(0, 400)}`,
  );
  assert.ok(
    /AMBIENTE \| AREA \(m2\) \| PISO/.test(chunk.text),
    "o cabecalho da tabela nao chegou ao modelo com as colunas separadas",
  );
  assert.ok(
    /TOTAL \| 4\.530,98/.test(chunk.text),
    "a linha TOTAL nao chegou ao modelo com o valor na coluna certa",
  );
});

test("a prosa da pagina continua inteira no bloco do modelo", () => {
  const chunk = chunkPdfByChapter(extraido)[0];
  assert.ok(
    /presente memorial descreve/i.test(chunk.text),
    "a grade nao pode custar a prosa: o modelo precisa das duas",
  );
});

/*
 * A TRAVA ANTI-ALUCINAÇÃO PRECISA ENXERGAR A MESMA COISA QUE O MODELO LEU.
 *
 * `filterGroundedFindings` descarta todo achado de IA cuja evidência não exista
 * no texto extraído — é o que impede a auditoria de apontar o que não está
 * escrito. O haystack dela saía de `extracted.text`, a página achatada.
 *
 * No instante em que a grade passou a ir para o modelo, isso virou uma armadilha
 * silenciosa: o modelo cita "TOTAL | 4.530,98" porque foi assim que ele leu, e a
 * trava não acha o `|` em lugar nenhum e joga o achado fora. O conserto do
 * insumo teria produzido um segundo defeito PIOR que o primeiro — achado certo
 * descartado sem deixar rastro, em vez de achado errado visível.
 */
function achadoDeTabela(evidencia: string): AuditFinding {
  return {
    id: "F1",
    tipo: "Divergência no quadro de áreas",
    descricao: "teste",
    evidencia,
    termo_busca: evidencia,
  } as AuditFinding;
}

test("EVIDENCIA CITADA DA GRADE nao e descartada pela trava anti-alucinacao", () => {
  const haystack = buildHaystack(extraido);
  assert.ok(
    isFindingGrounded(achadoDeTabela("TOTAL | 4.530,98"), haystack),
    "a trava rejeitou uma evidencia que o proprio modelo leu na grade",
  );
});

test("a trava continua rejeitando o que NAO esta no documento", () => {
  const haystack = buildHaystack(extraido);
  assert.ok(
    !isFindingGrounded(achadoDeTabela("TOTAL | 9.999,99 de area inventada"), haystack),
    "a trava passou a aceitar texto inexistente",
  );
});

console.log(`\n${passed} prova(s) de tabela contra o pdf.js OK`);
