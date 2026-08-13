// O COMPARATIVO ANTES DE GASTAR, e quanto o caminho barato poupa de verdade —
// sobre o memorial REAL, sem um token e sem servidor.
//
// Extrai o 063-26 do disco, calcula a impressão digital pelo mesmo código do
// servidor e responde duas perguntas:
//
//   PARTE 1 — o delta reconhece o que mudou?
//     a) o MESMO arquivo            → 100% já lido, zero novos;
//     b) um capítulo reescrito e um capítulo novo → acha exatamente esses dois.
//     É o caso do metálico: o memorial volta com um volume a mais.
//
//   PARTE 2 — quanto vai ao modelo depois que o plano de reuso decide?
//     Com os achados de uma auditoria REAL deste memorial, lida do banco. Mede
//     o texto dos capítulos a reler mais o mapa dos parados, e cobra a promessa
//     do projeto: economia acima de 80%.
//
// (O cabeçalho anterior dizia que isto semeava o banco e chamava
// `/api/audit/delta`. Nunca chamou — sempre comparou em processo. Corrigido
// quando a parte 2 entrou, que é a que passou a ler o banco de verdade.)
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

/* ────────────────────────────────────────────────────────────────────────────
 * ETAPA 2: o que o PLANO DE REUSO decide, com achados reais.
 *
 * A conta acima é do delta puro — quanto do TEXTO mudou. Esta é a que importa
 * para a promessa: quanto vai ao modelo DEPOIS que o plano decide o que herdar
 * e quais capítulos precisa promover por falta de âncora.
 *
 * Os achados vêm de uma auditoria REAL deste mesmo memorial, lida do banco.
 * Sem `DATABASE_URL`, esta parte é pulada em vez de inventar achados: medir
 * reuso com achado sintético mediria o meu palpite, não o comportamento.
 * ──────────────────────────────────────────────────────────────────────────── */
/**
 * `npm run` não carrega o `.env.local` — o Next carrega. Sem isto a medição se
 * pulava sozinha na máquina de quem tem o banco configurado, e o silêncio
 * parecia "não há auditoria anterior". Mesma forma do `token-do-admin.mjs`.
 */
function doAmbiente(nome) {
  if (process.env[nome]) return process.env[nome];
  if (!fs.existsSync(".env.local")) return "";
  for (const linha of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = linha.match(new RegExp(`^${nome}\\s*=\\s*(.*)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const bancoUrl = doAmbiente("DATABASE_URL");

if (!bancoUrl) {
  console.log("\n  (sem DATABASE_URL — a medição do plano de reuso foi pulada)");
} else {
  const { PrismaClient } = await import("@prisma/client");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { Pool } = await import("pg");
  const { planejarReuso, VERSAO_AUDITOR } = await import("../lib/audit-reuso.ts");
  const { buildMapaDosIguais } = await import("../lib/audit-validation-prompt.ts");

  const pool = new Pool({ connectionString: bancoUrl });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  const anterior = await prisma.audit.findFirst({
    where: {
      status: "COMPLETED",
      analysisLevel: "deep",
      totalFindings: { gt: 0 },
      files: { some: { fileName: path.basename(MEMORIAL) } },
    },
    orderBy: { totalFindings: "desc" },
    select: { id: true, report: true },
  });
  const achadosAntes = anterior?.report?.incongruencias ?? [];

  if (achadosAntes.length === 0) {
    console.log(`\n  (nenhuma auditoria concluída de ${path.basename(MEMORIAL)} no banco)`);
  } else {
    /*
     * O `agora` acima insere o capítulo novo SEM empurrar as páginas dos
     * seguintes — para comparar impressão isso não importa, mas para medir
     * reancoragem importa muito: sem o empurrão, todo capítulo cairia na
     * aritmética com deslocamento zero e o teste não provaria nada.
     *
     * Aqui as páginas andam de verdade, como andariam no PDF real em que o
     * volume do metálico entrou no meio.
     */
    const PAGINAS_DO_NOVO = 9;
    const agoraComPaginasCertas = agora.map((c, i) =>
      i > 6
        ? { ...c, startPage: c.startPage + PAGINAS_DO_NOVO, endPage: c.endPage + PAGINAS_DO_NOVO }
        : c,
    );
    const deltaReal = compararImpressoes(capitulos, agoraComPaginasCertas);

    const plano = planejarReuso({
      delta: deltaReal,
      capitulosAntes: capitulos,
      achadosAntes,
      paginasAgora: extraido.pages,
      // O parecer real é anterior a 13/08 e não tem versão gravada. Passamos a
      // versão atual de propósito: aqui se mede o REUSO, não a recusa por
      // versão — essa já está travada em test:audit:reuso.
      versaoAnterior: VERSAO_AUDITOR,
    });

    const charsPorCapitulo = new Map(capitulos.map((c) => [c.hash, c.chars]));
    const aoModelo = plano.capitulosParaLer.reduce(
      (n, c) => n + (charsPorCapitulo.get(c.hash) ?? c.chars),
      0,
    );
    const mapa = buildMapaDosIguais(
      agoraComPaginasCertas.filter((c) => plano.hashesHerdados.includes(c.hash)),
      // Parecer real ainda não tem síntese (o campo nasceu hoje): o mapa sai só
      // com título e páginas, que é o pior caso — e é o que se quer medir.
      anterior?.report?.runtime?.sintese?.[0]?.capitulos ?? [],
    );

    const enviado = aoModelo + mapa.length;
    const economia = Math.round((1 - enviado / total) * 100);

    console.log(`\n  PLANO DE REUSO com ${achadosAntes.length} achados reais (auditoria ${anterior.id.slice(0, 8)}):`);
    console.log(`    capitulos a reler ..... ${plano.capitulosParaLer.length} de ${agoraComPaginasCertas.length}`);
    console.log(`    capitulos herdados .... ${plano.hashesHerdados.length}`);
    console.log(`    achados herdados ...... ${plano.achadosHerdados.length} de ${achadosAntes.length}`);
    console.log(`    promovidos sem ancora . ${plano.promovidos.length}${plano.promovidos.length ? ` (${plano.promovidos.map((p) => p.titulo).join(", ")})` : ""}`);
    console.log(`    texto ao modelo ....... ${aoModelo.toLocaleString("pt-BR")} chars`);
    console.log(`    mapa dos parados ...... ${mapa.length.toLocaleString("pt-BR")} chars`);
    console.log(`    ECONOMIA .............. ${economia}% de ${total.toLocaleString("pt-BR")} chars`);

    checar("a economia do caminho barato passa de 80%", economia >= 80, `${economia}%`);
    checar(
      "achado de regra nao e herdado",
      plano.achadosHerdados.every((f) => f.origem !== "regra"),
    );
  }

  await prisma.$disconnect();
  await pool.end();
}

process.exitCode = falhas > 0 ? 1 : 0;
console.log(`\n${falhas === 0 ? "tudo ok" : `${falhas} falha(s)`}`);
