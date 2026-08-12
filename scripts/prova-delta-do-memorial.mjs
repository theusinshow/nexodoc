// O COMPARATIVO ANTES DE GASTAR — provado de ponta a ponta, sem um token.
//
// Semeia no banco uma auditoria "anterior" do 063-26 com a impressão digital
// REAL do PDF (calculada aqui, pelo mesmo código do servidor), e depois pergunta
// à rota `/api/audit/delta` o que mudou entre aquela e:
//   a) o MESMO arquivo   → tem de dar 100% já lido, zero novos;
//   b) o arquivo com UM capítulo alterado → tem de achar exatamente esse.
//
// É o caso do metálico: o memorial volta com um volume a mais e a pergunta é
// quanto daquilo já foi lido.
//
//   npm run prova:delta
import fs from "node:fs";
import path from "node:path";

import { chunkPdfByChapter, extractPdfText } from "../lib/pdf-text.ts";
import { impressaoDosCapitulos, compararImpressoes, fracaoJaLida, resumoDoDelta } from "../lib/audit-fingerprint.ts";

const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NEXO - TESTES\\Memoriais\\063_26_md_geral_a.pdf";

let falhas = 0;
function checar(nome, ok, detalhe = "") {
  if (ok) console.log(`  ok      ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

if (!fs.existsSync(MEMORIAL)) {
  console.error(`Sem o memorial em ${MEMORIAL}`);
  process.exit(1);
}

const extraido = await extractPdfText(fs.readFileSync(MEMORIAL));
const capitulos = impressaoDosCapitulos(chunkPdfByChapter(extraido));
console.log(
  `\n${path.basename(MEMORIAL)}: ${extraido.pageCount} páginas, ${capitulos.length} capítulos, ${extraido.charCount.toLocaleString("pt-BR")} chars\n`,
);

// (a) o MESMO documento.
const igual = compararImpressoes(capitulos, capitulos);
checar(
  "documento inalterado: nada a reler",
  igual.iguais.length === capitulos.length && igual.novos.length === 0,
  resumoDoDelta(igual),
);
checar("fração já lida = 100%", Math.round(fracaoJaLida(igual) * 100) === 100);

// (b) UM capítulo reescrito e UM capítulo novo (o "volume do metálico").
const agora = capitulos.map((c, i) =>
  i === 5 ? { ...c, hash: `${c.hash.slice(0, 60)}zzzz`, chars: c.chars } : c,
);
agora.splice(6, 0, {
  titulo: "PROJETO ESTRUTURAL METALICO",
  startPage: 40,
  endPage: 48,
  chars: 9000,
  hash: "f".repeat(64),
});
const delta = compararImpressoes(capitulos, agora);
checar(
  "um capítulo alterado + um novo são achados como tal",
  delta.alterados.length === 1 && delta.novos.length === 1 && delta.sumidos.length === 0,
  resumoDoDelta(delta),
);
const poupado = Math.round(fracaoJaLida(delta) * 100);
checar(
  "o resto do documento continua reconhecido",
  poupado >= 80,
  `${poupado}% do texto já foi lido antes`,
);

const total = capitulos.reduce((n, c) => n + c.chars, 0);
// O ALTERADO conta junto: ele mudou, então volta ao modelo. Somar só os novos
// venderia uma economia que não existe.
const reler =
  delta.novos.reduce((n, c) => n + c.chars, 0) +
  delta.alterados.reduce((n, c) => n + c.agora.chars, 0);
console.log(
  `\n  Numa reauditoria, iria ao modelo ${reler.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")} chars — ${Math.round((reler / total) * 100)}% do documento.`,
);

process.exitCode = falhas > 0 ? 1 : 0;
console.log(`\n${falhas === 0 ? "tudo ok" : `${falhas} falha(s)`}`);
