/**
 * O PARECER IMPRESSO — gerado e RELIDO, sem token e sem navegador.
 *
 *   node scripts/prova-parecer-em-pdf.ts   (== npm run prova:parecer)
 *
 * A prova não olha a estrutura: ela gera o PDF de verdade e extrai o texto de
 * volta com pdfjs, que é o que o fiscal do outro lado vai ler. Um parecer que
 * "monta" mas sai sem a evidência do achado é o defeito que só o arquivo
 * gerado denuncia.
 *
 * Guarda o arquivo em `SHOT_DIR` para poder ser aberto a olho quando o desenho
 * mudar — mas nenhuma asserção depende disso.
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

import type { AuditReport } from "../lib/audit-report.ts";
import {
  gerarParecerPdf,
  nomeDoParecer,
  paraWinAnsi,
} from "../server/pdf/parecer.ts";

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/*
 * O SINAL DE MAIOR-OU-IGUAL ESTÁ AQUI DE PROPÓSITO. Ele não existe na tabela
 * WinAnsi das 14 fontes padrão, e `drawText` LANÇA nele — um memorial que
 * escreve "largura >= 1,20 m" com o sinal tipográfico derrubaria a exportação
 * inteira. É o caso que motivou `paraWinAnsi`.
 */
const EVIDENCIA_COM_SINAL =
  "a largura livre deve ser ≥ 1,20 m em todo o percurso";

const achados = Array.from({ length: 14 }, (_, i) => ({
  id: `INC-${String(i + 1).padStart(3, "0")}`,
  prioridade: i < 3 ? "Alta" : "Media",
  pagina: String(10 + i * 3),
  capitulo: i % 2 === 0 ? "PPCI" : "Hidrossanitario",
  local: "",
  tipo: `Pendencia numero ${i + 1} do memorial`,
  descricao:
    "Descricao longa o bastante para quebrar em mais de uma linha no papel e forcar a paginacao a decidir alguma coisa de verdade, em vez de caber inteira na primeira pagina.",
  evidencia: i === 0 ? EVIDENCIA_COM_SINAL : `trecho citado do achado ${i + 1}`,
  conflito: "regra em conflito",
  sugestao_correcao: "Declarar o valor no memorial.",
  confianca: "alta",
  impacto: i < 3 ? "critico_documental" : "tecnico_contratual",
}));

const report = {
  tipo_auditoria: "memorial",
  tipo_documento: "memorial descritivo",
  obra: "UBS Vila Manaus",
  codigo: "117-25",
  municipio: "Criciuma",
  data_documento: "10/2025",
  status_analise: "concluida",
  status_geral: "com inconsistencias criticas",
  total_incongruencias: achados.length,
  arquivos_analisados: [],
  comparacoes: [],
  conclusao: "Corrigir os criticos antes de emitir.",
  incongruencias: achados,
} as unknown as AuditReport;

check(
  "o sinal fora da tabela vira equivalente legivel, e nao some",
  paraWinAnsi(EVIDENCIA_COM_SINAL).includes(">= 1,20 m"),
  paraWinAnsi(EVIDENCIA_COM_SINAL),
);

const bytes = await gerarParecerPdf(report);
check("o PDF foi gerado", bytes.length > 1000, `${bytes.length} bytes`);

const destino = `${process.env.SHOT_DIR ?? "."}/${nomeDoParecer(report)}`;
writeFileSync(destino, bytes);
check(
  "o nome do arquivo carrega codigo e obra",
  nomeDoParecer(report) === "parecer-117-25-ubs-vila-manaus.pdf",
  nomeDoParecer(report),
);

// --- Relido com pdfjs: e isto que o fiscal recebe.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
const paginas: string[] = [];
for (let i = 1; i <= doc.numPages; i++) {
  const c = await (await doc.getPage(i)).getTextContent();
  paginas.push(
    (c.items as { str: string }[])
      .map((x) => x.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}
const tudo = paginas.join(" \n ");
console.log(`  (${doc.numPages} paginas, ${tudo.length} caracteres relidos)`);

check(
  "mais de uma pagina — a paginacao rodou de verdade",
  doc.numPages > 1,
  `${doc.numPages}`,
);
check(
  "o titulo da peca esta na primeira pagina",
  /Parecer de auditoria/i.test(paginas[0]),
);
check(
  "a obra e o codigo aparecem",
  /117-25/.test(tudo) && /UBS Vila Manaus/i.test(tudo),
);
check("o veredito esta escrito", /com inconsistencias criticas/i.test(tudo));
check(
  "o sumario conta os criticos",
  // Sem acento na régua: o PDF guarda "críticos" com acento, e comparar com a
  // forma sem acento reprovaria um texto certo.
  /14 achados/.test(tudo) &&
    /3 cr[ií]ticos documentais/.test(tudo) &&
    !/0 outros/.test(tudo),
  tudo.slice(0, 400),
);
check(
  "o primeiro e o ultimo achado sobreviveram",
  /INC-001/.test(tudo) && /INC-014/.test(tudo),
);
check("a pagina do achado vai junto", /p\.10\b/.test(tudo), tudo.slice(0, 300));
check(
  "a EVIDENCIA com o sinal trocado chegou ao papel",
  />= 1,20 m/.test(tudo),
  tudo.slice(0, 300),
);
check(
  "a correcao recomendada tambem",
  /CORRECAO RECOMENDADA|CORREÇÃO RECOMENDADA/i.test(tudo),
);

// O rodape identifica a folha SOLTA: toda pagina, com obra e numero.
const semRodape = paginas
  .map((t, i) =>
    t.includes(`NEXODOC`) && t.includes(`${i + 1}/${doc.numPages}`)
      ? null
      : i + 1,
  )
  .filter(Boolean);
check(
  "toda pagina traz o selo e a numeracao",
  semRodape.length === 0,
  `faltou em ${semRodape.join(", ")}`,
);

// A regra que existe para o papel ser conferivel: cabecalho e o que o explica
// na MESMA pagina.
const orfaos = paginas
  .map((t, i) => {
    const m = [...t.matchAll(/INC-\d{3}/g)].at(-1);
    if (!m) return null;
    const depois = t.slice(m.index ?? 0);
    return depois.length < 60 ? `${m[0]} na pagina ${i + 1}` : null;
  })
  .filter(Boolean);
check(
  "nenhum cabecalho de achado ficou orfao no pe da pagina",
  orfaos.length === 0,
  orfaos.join("; "),
);

console.log(`\nPDF em ${destino}`);
console.log(falhas === 0 ? "\nPROVA DO PARECER OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
