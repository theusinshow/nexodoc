// NINGUÉM ESCREVE UM BADGE À MÃO.
//
//   node scripts/prova-badge-a-mao.mjs   (== npm run prova:badge)
//
// A DESIGN.md diz duas vezes, e nas duas com todas as letras: "o padrão
// canônico é `<Badge variant="ok|warning|critical">`. Use o componente; não
// escreva as classes à mão" (§2) e "coluna de status renderiza `<Badge>`, não
// texto colorido" (§7).
//
// POR QUE ISTO PRECISOU DE UMA PROVA
//
// Em 21/08/2026 a fila de etiquetas do cartão de achado tinha NOVE `<span>`
// com `border-.../35 bg-...-bg text-...` copiado, e `getSeverityClass` devolvia
// exatamente as três variantes do Badge, transcritas. Ao arrumar aquela tela,
// a varredura achou o mesmo defeito em mais SEIS lugares — quatro deles no
// admin, a tela de quem paga a conta. Um deles usava `<Badge variant="outline">`
// e SOBRESCREVIA com as classes de status: o componente estava ali, sendo
// contrariado.
//
// O estrago não é estético. Enquanto a cópia existir, ajustar o âmbar do
// sistema deixa essas telas para trás e ninguém nota — a mudança "pega" no
// componente e não pega em quem o transcreveu.
//
// A ASSINATURA MECÂNICA de um badge escrito à mão é ter, na MESMA string de
// classe, o fundo de um token de status e a cor de texto de um token de status.
// É o que o `badgeVariants` faz, e é o que ninguém mais precisa fazer.
//
// AS EXCEÇÕES SÃO DECLARADAS, e não inferidas. Caixa de recado (um parágrafo
// inteiro em fundo de status) usa a mesma dupla legitimamente e não é badge:
// ela entra na lista abaixo, com motivo. Mesmo idioma do `GRUPO_INFERIDO` em
// `server/nexo/disciplinas.ts` — exceção que alguém escolheu, e não silêncio.
import fs from "node:fs";
import path from "node:path";

const RAIZES = ["components", "modules", "app"];

/** O próprio primitivo é quem PODE — é dele que as classes saem. */
const A_FONTE = path.join("components", "ui", "badge.tsx");

/**
 * Caixas de recado: parágrafo ou painel inteiro sobre fundo de status. Não são
 * etiquetas, e transformá-las em `<Badge>` encolheria um aviso de uma frase
 * para um chip de 22px.
 */
const CAIXAS_DE_RECADO = new Set([
  path.join("modules", "nexo", "components", "EditorDoNo.tsx"),
  path.join("app", "admin", "quality", "page.tsx"),
]);

/**
 * A SAÍDA POR LINHA, para o que não é etiqueta nem recado — um CONTROLE cuja
 * aparência carrega o estado (botão que liga e desliga um vínculo, por exemplo).
 * Badge é um `<span>` passivo e trocaria um botão por um rótulo.
 *
 * Fica na linha, e não numa lista aqui, para a exceção viajar com o código: quem
 * apagar o botão apaga a exceção junto, e ela não vira mentira nesta lista.
 * A contagem é impressa no fim — exceção silenciosa vira regra.
 */
const SAIDA = "badge-a-mao-permitido";

function arquivos(dir) {
  const saida = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const completo = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name === "node_modules" || item.name.startsWith(".")) continue;
      saida.push(...arquivos(completo));
    } else if (item.name.endsWith(".tsx")) {
      saida.push(completo);
    }
  }
  return saida;
}

const FUNDO = /bg-\[var\(--status-[a-z]+-bg\)\]/;
const TEXTO = /text-\[var\(--status-[a-z]+\)\]|text-destructive\b/;

const achados = [];
const permitidos = [];

for (const raiz of RAIZES) {
  if (!fs.existsSync(raiz)) continue;

  for (const arquivo of arquivos(raiz)) {
    if (arquivo === A_FONTE || CAIXAS_DE_RECADO.has(arquivo)) continue;

    const linhas = fs.readFileSync(arquivo, "utf8").split(/\r?\n/);

    linhas.forEach((linha, i) => {
      if (!FUNDO.test(linha) || !TEXTO.test(linha)) return;

      // A saída vale na própria linha ou nas três acima (ternario quebrado em
      // varias linhas nao cabe a marca em cada ramo).
      const perto = linhas.slice(Math.max(0, i - 3), i + 1).join(" ");
      if (perto.includes(SAIDA)) {
        permitidos.push(`${arquivo}:${i + 1}`);
        return;
      }

      achados.push({ arquivo, linha: i + 1, texto: linha.trim().slice(0, 96) });
    });
  }
}

if (achados.length > 0) {
  console.error(`\nFALHOU  ${achados.length} badge(s) escrito(s) a mao:\n`);
  for (const a of achados) {
    console.error(`  ${a.arquivo}:${a.linha}`);
    console.error(`    ${a.texto}`);
  }
  console.error(
    `\n  Use <Badge variant="ok|warning|critical|info|legacy|emphasis">.`,
  );
  console.error(
    `  Se for CAIXA DE RECADO (paragrafo inteiro, nao etiqueta), declare o`,
  );
  console.error(`  arquivo em CAIXAS_DE_RECADO aqui, com motivo.\n`);
  process.exit(1);
}

console.log("  ok  nenhum badge escrito a mao fora do primitivo");

if (permitidos.length > 0) {
  console.log(
    `      ${permitidos.length} saida(s) declarada(s) na linha: ${permitidos.join(", ")}`,
  );
}
