/**
 * A LEITURA DE SELO, MEDIDA CONTRA O QUE O ESCRITÓRIO ENTREGOU.
 *
 *   node scripts/mede-leitura-de-selo.ts    (== npm run mede:leitura)
 *
 * ## O gabarito não é hipótese — ele está impresso
 *
 * Cada `*_ld_*.pdf` dos samples é a Lista de Documentos que saiu para o
 * cliente, e ela traz, por prancha, a folha, o código do arquivo e a DESCRIÇÃO
 * corretos. É a resposta certa, conferida por quem assina o projeto.
 *
 * O casamento entre os dois lados é o código do arquivo (`040_26_his_001_a`) —
 * a única chave que existe nos dois.
 *
 * ## O limite, dito na cara
 *
 * Mede a metade DETERMINÍSTICA da leitura. A contribuição do modelo de visão só
 * se mede gastando token. Hoje isso pesa pouco (com a fonte sã,
 * `tituloDaPrancha` devolve a leitura da geometria e o modelo só decide acento),
 * mas o número NÃO é "a leitura está X% certa" — é "a parte que não custa nada
 * está X% certa".
 *
 * ## Duas contagens para a descrição, e não uma
 *
 * Igual EXATA e igual ignorando acento e pontuação. A fonte quebrada da família
 * EST troca acento, e isso não é o mesmo erro que perder metade do texto: somar
 * os dois esconderia qual dos dois está acontecendo, que é justamente o que a
 * bancada existe para separar.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";

import { extractPdfText } from "../lib/pdf-text.ts";
import { normalizarItens } from "../lib/coordenada-do-pdf.ts";
import {
  acharCaixaDoSelo,
  conteudoDoSelo,
  type ItemPosicionado,
} from "../server/nexo/selo-regiao.ts";
import { cleanStampDescription } from "../lib/ld/stamp-parsing.ts";

const RAIZ = "docs/samples";

interface LinhaDoGabarito {
  folha: string;
  arquivo: string;
  descricao: string;
}

/**
 * As linhas da LD entregue.
 *
 * Uma linha que começa com `NN/TT` abre um registro; linha que não começa assim
 * é CONTINUAÇÃO da descrição anterior — descrições longas quebram em duas e
 * três linhas no PDF ("PLANTA BAIXA SANITÁRIO PAVIMENTO COBERTURA / – PARTE I E
 * PAVIMENTO RESERVATÓRIO E TOPO / RESERVATÓRIO").
 *
 * O rodapé do documento vem DEPOIS da tabela e não pode ser colado na última
 * prancha: sem a guarda abaixo, a última descrição de toda LD sairia com o
 * caminho de rede e a lei de direitos autorais pendurados.
 */
/**
 * O RODAPÉ FECHA A TABELA.
 *
 * Recusar linha a linha por prefixo não bastou: o rodapé quebra em várias
 * linhas, e a segunda delas começa no meio da frase ("FEIRA MUNICIPAL DE
 * CHAPECÓ – PROJETO EXECUTIVO..."). Sem prefixo reconhecível, ela era colada na
 * ÚLTIMA descrição de toda LD — e a bancada acusava um erro de leitura que era
 * defeito dela própria.
 *
 * A régua é o fim da tabela, não a forma da linha: depois da primeira folha
 * lida, qualquer coisa com assinatura de rodapé encerra o documento.
 */
const FIM_DA_TABELA =
  /LISTA DE DOCUMENTOS|PROJETO EXECUTIVO|Direitos Autorais|^P:\\|^SECRETARIA DE|^PREFEITURA MUNICIPAL/i;

/**
 * A CÉLULA DA LD HIFENIZA NA QUEBRA DE LINHA.
 *
 * "PLANTA DE SITUAÇÃO E IMPLANTAÇÃO, QUA-" / "DROS DE ÁREAS" é UMA palavra
 * partida pelo editor de texto, não duas. Juntando com espaço, o gabarito vira
 * "QUA- DROS DE ÁREAS" e a bancada acusa vinte e cinco erros de leitura que são
 * defeito dela própria — com o leitor devolvendo o texto CERTO.
 *
 * A régua é o hífen colado a uma letra: "CONSTRUIR - PLANTA" tem espaço antes e
 * é travessão de verdade; "QUA-" não tem e é quebra.
 */
const HIFEN_DE_QUEBRA = /\p{L}-$/u;

function lerGabarito(texto: string): LinhaDoGabarito[] {
  const linhas: LinhaDoGabarito[] = [];
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    if (!linha) continue;

    /*
     * VÁRIAS FOLHAS NUMA LINHA SÓ. Em algumas LDs o pdf.js entrega a tabela
     * inteira sem quebra ("...TERRAPLENAGEM 156_25_gmt_004_a CADERNO DE...").
     * Casar só no início da linha engolia três folhas numa e as tirava da
     * medição em silêncio — que é o pior jeito de perder um caso.
     */
    const inicios = [...linha.matchAll(/(\d+\/\d+)\s+(\S+)/g)];
    if (inicios.length > 0) {
      inicios.forEach((m, i) => {
        const fim = inicios[i + 1]?.index ?? linha.length;
        const descricao = linha.slice((m.index ?? 0) + m[0].length, fim).trim();
        linhas.push({ folha: m[1], arquivo: m[2], descricao });
      });
      continue;
    }
    // "LISTA DE DOCUMENTOS" é também o TÍTULO da página: só encerra depois de a
    // tabela ter começado.
    if (linhas.length > 0 && FIM_DA_TABELA.test(linha)) break;

    const ultima = linhas[linhas.length - 1];
    if (!ultima) continue;
    ultima.descricao = HIFEN_DE_QUEBRA.test(ultima.descricao)
      ? `${ultima.descricao.slice(0, -1)}${linha}`.trim()
      : `${ultima.descricao} ${linha}`.trim();
  }
  return linhas;
}

/** Sem acento, sem pontuação, minúsculo — para a segunda contagem. */
function frouxo(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Os itens posicionados da primeira página, montados como o leitor real monta. */
async function itensDaPrancha(caminho: string): Promise<ItemPosicionado[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(caminho)),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const brutos: { texto: string; x: number; y: number }[] = [];
  for (const raw of content.items) {
    const item = raw as { str?: string; transform?: number[] };
    const str = typeof item.str === "string" ? item.str.trim() : "";
    if (!str || !item.transform) continue;
    const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    brutos.push({ texto: str, x: vx, y: vy });
  }
  await doc.destroy();
  return normalizarItens(brutos, { largura: viewport.width, altura: viewport.height });
}

function todasAsLds(dir: string, achados: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) todasAsLds(p, achados);
    else if (/_ld_.*\.pdf$/i.test(e.name)) achados.push(p);
  }
  return achados;
}

let comparadas = 0;
let exatas = 0;
let frouxas = 0;
let vazias = 0;
let semPrancha = 0;
let semAncora = 0;
const divergencias: string[] = [];

for (const ld of todasAsLds(RAIZ)) {
  const gabarito = lerGabarito((await extractPdfText(readFileSync(ld))).text);
  const pasta = dirname(ld);

  for (const linha of gabarito) {
    const prancha = join(pasta, `${linha.arquivo}.pdf`);
    if (!existsSync(prancha)) {
      semPrancha += 1;
      continue;
    }
    const itens = await itensDaPrancha(prancha);
    const { ancoras } = acharCaixaDoSelo(itens);
    if (ancoras < 3) semAncora += 1;

    const lido = cleanStampDescription(conteudoDoSelo(itens));
    comparadas += 1;
    if (!lido) vazias += 1;

    if (lido === linha.descricao) {
      exatas += 1;
      frouxas += 1;
    } else if (lido && frouxo(lido) === frouxo(linha.descricao)) {
      frouxas += 1;
      divergencias.push(
        `~ ${basename(prancha)}\n      lido=${lido}\n      espe=${linha.descricao}`,
      );
    } else {
      divergencias.push(
        `X ${basename(prancha)}\n      lido=${lido || "(vazio)"}\n      espe=${linha.descricao}`,
      );
    }
  }
}

const pct = (n: number) => (comparadas ? `${Math.round((n / comparadas) * 100)}%` : "—");
console.log(`\npranchas comparadas: ${comparadas}`);
console.log(`descrição igual EXATA:             ${exatas}/${comparadas} (${pct(exatas)})`);
console.log(`descrição igual s/ acento e pont.: ${frouxas}/${comparadas} (${pct(frouxas)})`);
console.log(`leitura devolveu VAZIO:            ${vazias}/${comparadas} (${pct(vazias)})`);
console.log(`caiu no quadrante de reserva (<3 âncoras): ${semAncora}`);
console.log(`linha do gabarito sem prancha no disco:    ${semPrancha}`);
if (divergencias.length) {
  console.log(`\ndivergências (X = texto diferente, ~ = só acento/pontuação):`);
  for (const d of divergencias) console.log(`  ${d}`);
}
console.log("\nLIMITE: mede a metade DETERMINÍSTICA. A contribuição do modelo de");
console.log("visão não entra aqui — este número não é 'a leitura está X% certa'.");
