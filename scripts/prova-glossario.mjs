// O FISCAL DO LÉXICO: nenhuma string de interface fala a língua do SaaS.
//
// O produto diz lote, folha, tomo, selo, conferência, parecer, achado. Não diz
// "upload concluído", "processando", "validar". Consistência de termo é metade
// da sensação de bem feito, e é a metade que se perde primeiro — cada tela nova
// traz uma palavra a mais de fora, e ninguém percebe até o dia em que a
// interface inteira fala como qualquer outro software.
//
// COMENTÁRIO SAI ANTES DA VARREDURA. Os docblocks deste repositório são longos
// e usam as palavras proibidas com toda razão — explicando o que o produto NÃO
// diz. Varrer o arquivo cru acusaria a própria documentação, e um fiscal que
// grita no lugar errado é desligado na primeira semana.
//
// SÓ O QUE ESTÁ ENTRE ASPAS OU ENTRE TAGS. `upload.fileName` é o modelo de
// dados do Prisma e não aparece para ninguém; `"Nenhum upload registrado."`
// aparece. A diferença é essa, e é o que a extração abaixo separa.
//
// FORA DE ESCOPO: `app/admin/**` (tela interna, público de um) e
// `modules/volume-builder/**` (legado que não se evolui — ver
// docs/nexo-paridade-telas.md). Ampliar o alvo é bem-vindo; ampliar sem
// arrumar o que aparecer, não.
//
//   node scripts/prova-glossario.mjs   (== npm run prova:glossario)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));

/** Onde a interface do produto mora. */
const ALVOS = [
  "modules/nexo/components",
  "components/ui",
  "components/layout",
  "app/nexo",
  "app/ferramentas",
  "app/projetos",
  "app/login",
];

/**
 * Palavra proibida → o que dizer no lugar.
 *
 * A mensagem de falha ENSINA. Um fiscal que só diz "não" faz a pessoa contornar
 * (abreviar, trocar por sinônimo pior) em vez de aprender o léxico.
 */
const PROIBIDAS = [
  ["upload", "envio / anexo — ou o verbo do ofício: solte as pranchas"],
  ["uploads", "envios / anexos"],
  ["processar", "ler (selo), auditar (memorial), gerar (documento)"],
  ["processando", "lendo / auditando / gerando"],
  ["processado", "lido / auditado / gerado"],
  ["processados", "lidos / auditados / gerados"],
  ["com sucesso", "diga o que ficou pronto: “12 folhas lidas”"],
  ["validar", "conferir"],
  ["validação", "conferência"],
  ["relatório", "parecer"],
  ["issue", "achado"],
  ["batch", "lote"],
];

/** Remove comentário de bloco e de linha, preservando as quebras (o nº da linha). */
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/**
 * O que um humano lê: literal entre aspas, e texto entre `>` e `<`.
 *
 * A exclusão de `{` e `}` no texto JSX é o que impede a captura de expressões
 * (`>{algo}<`), que são código e não texto.
 */
function trechosVisiveis(linha) {
  const out = [];
  for (const m of linha.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  for (const m of linha.matchAll(/>([^<>{}\n]+)</g)) out.push(m[1]);
  return out;
}

/*
 * Literais que são CÓDIGO, não texto: nome de classe, rota, chave, import.
 * Sem isto, `className="... upload-..."` ou `href="/uploads"` seriam acusados —
 * e o fiscal perderia a confiança de quem o lê.
 */
function ehCodigo(trecho) {
  return (
    /^[./#@]/.test(trecho) ||
    /^[a-z0-9-]+\/[a-z0-9-/.]+$/i.test(trecho) ||
    /[{}[\]()<>;=]/.test(trecho) ||
    /^[a-z-]+:[a-z-]/i.test(trecho) ||
    // Cadeia de utilitário Tailwind: muitas palavras, todas sem acento e com
    // hífen ou dois-pontos. Frase de interface quase nunca se parece com isto.
    /^(?:[a-z0-9:[\]/_.-]+\s+){2,}[a-z0-9:[\]/_.-]+$/.test(trecho)
  );
}

function arquivos(dir) {
  const out = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entradas) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

const faltas = [];
let varridos = 0;

for (const alvo of ALVOS) {
  for (const arquivo of arquivos(join(RAIZ, alvo))) {
    varridos++;
    const linhas = semComentarios(readFileSync(arquivo, "utf8")).split("\n");
    linhas.forEach((linha, i) => {
      for (const trecho of trechosVisiveis(linha)) {
        if (!trecho.trim() || ehCodigo(trecho)) continue;
        for (const [palavra, troca] of PROIBIDAS) {
          if (new RegExp(`\\b${palavra}\\b`, "i").test(trecho)) {
            faltas.push({
              onde: `${relative(RAIZ, arquivo).replace(/\\/g, "/")}:${i + 1}`,
              palavra,
              troca,
              trecho: trecho.trim().slice(0, 70),
            });
          }
        }
      }
    });
  }
}

if (varridos === 0) {
  console.error("FALHOU  nenhum arquivo varrido — os caminhos de ALVOS mudaram?");
  process.exit(1);
}

if (faltas.length > 0) {
  console.error(`FALHOU  ${faltas.length} string(s) fora do léxico:\n`);
  for (const f of faltas) {
    console.error(`  ${f.onde}`);
    console.error(`    "${f.trecho}"`);
    console.error(`    “${f.palavra}” → ${f.troca}\n`);
  }
  console.error("O glossário está no DESIGN.md §13.");
  process.exit(1);
}

console.log(`  ok  ${varridos} arquivo(s) varrido(s), nenhuma string fora do léxico`);
