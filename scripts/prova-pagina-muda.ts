/**
 * A PROVA CONTRA O ARQUIVO REAL — o `114_19_VOLUME ÚNICO.pdf`.
 *
 * O teste unitário (`npm run test:pagina-muda`) trabalha em fixture: ele fixa
 * as REGRAS. Esta prova abre o PDF que originou o problema e mede o que sai
 * dele, que é a única forma de saber se o detector continua acertando quando o
 * pdf.js, o limiar ou a contagem de tinta mudarem.
 *
 * NÃO GASTA IA. Ela para na detecção — a transcrição é do navegador, e provar
 * a transcrição custa ~US$ 0,07 (ver o cabeçalho de [[transcricao-por-visao.ts]]).
 *
 *   node scripts/prova-pagina-muda.ts [caminho.pdf]   (== npm run prova:pagina-muda)
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { aplicarTranscricao, diagnosticarPaginasMudas } from "../lib/pagina-muda.ts";
import { extractPdfText } from "../lib/pdf-text.ts";
import { coberturaCompleta, paginasMudasPendentes, resumoDoEsforco } from "../lib/resumo-do-esforco.ts";

const PADRAO = "C:/Users/matheus.mendes/Desktop/114-19/114_19_VOLUME ÚNICO.pdf";
const caminho = process.argv[2] ?? PADRAO;

if (!existsSync(caminho)) {
  console.log(`Arquivo não encontrado: ${caminho}`);
  console.log("Passe o caminho de um memorial: node scripts/prova-pagina-muda.ts <arquivo.pdf>");
  process.exit(0);
}

const extraido = await extractPdfText(readFileSync(caminho));
const d = diagnosticarPaginasMudas(extraido);
const conta = (c: string) => d.paginas.filter((p) => p.classe === c).length;

console.log(`arquivo:   ${caminho}`);
console.log(`páginas:   ${extraido.pageCount}`);
console.log(`caracteres:${extraido.charCount} (${Math.round(extraido.charCount / extraido.pageCount)}/página)`);
console.log(`classes:   texto=${conta("texto")} muda=${conta("muda")} vazia=${conta("vazia")}`);
console.log(`mudas:     ${d.mudas.join(",") || "—"}`);

/*
 * A COBERTURA COMO ELA CHEGARIA AO PARECER. É este par de números que mentia:
 * 7.470 de 7.470 caracteres = 100%, num documento em que 25 folhas nunca foram
 * lidas por ninguém.
 */
const cobertura = {
  caracteres_lidos: extraido.text.length,
  caracteres_totais: extraido.text.length,
  blocos_lidos: 1,
  blocos_totais: 1,
  blocos_planejados: 1,
  paginas_mudas: d.mudas.length,
  paginas_transcritas: 0,
};

console.log(`\ncobertura sem transcrever: completa=${coberturaCompleta(cobertura)}`);
console.log(`  ${resumoDoEsforco(cobertura)}`);

if (d.mudas.length > 0) {
  assert.equal(
    coberturaCompleta(cobertura),
    false,
    "documento com folha muda NÃO pode sair com cobertura completa",
  );
  assert.match(resumoDoEsforco(cobertura), /ATEN..O/, "o parecer precisa dizer que faltou folha");
}

/*
 * E DEPOIS DE TRANSCREVER. Simulado com texto de marcação — a chamada de modelo
 * de verdade é do navegador. O que se prova aqui é o CAMINHO: a folha deixa de
 * ser muda, ganha a marca da origem e a cobertura fecha.
 */
const transcrito = aplicarTranscricao(
  extraido,
  d.mudas.map((pagina) => ({ pagina, texto: `texto recuperado da folha ${pagina}` })),
);
const depois = diagnosticarPaginasMudas(transcrito);
const marcadas = transcrito.pages.filter((p) => p.origem === "visao").length;

console.log(`\napós transcrever: mudas=${depois.mudas.length} marcadas=${marcadas}`);
assert.equal(depois.mudas.length, 0, "toda folha transcrita deixa de ser muda");
assert.equal(marcadas, d.mudas.length, "toda folha transcrita carrega origem=visao");
assert.ok(
  transcrito.charCount > extraido.charCount || d.mudas.length === 0,
  "transcrever precisa aumentar o texto do documento",
);

const coberturaDepois = { ...cobertura, paginas_transcritas: marcadas };
assert.equal(paginasMudasPendentes(coberturaDepois), 0);
assert.equal(coberturaCompleta(coberturaDepois), true);
console.log(`  ${resumoDoEsforco(coberturaDepois)}`);

console.log("\nOK");
