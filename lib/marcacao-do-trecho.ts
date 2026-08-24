/**
 * ONDE, NA PÁGINA, ESTÁ O TRECHO DO ACHADO — em faixas de caractere por item.
 *
 * O DEFEITO QUE ISTO SUBSTITUI (24/08/2026)
 *
 * O visor recebia a evidência e montava uma expressão regular com o trecho
 * inteiro E CADA PALAVRA dele com 4 letras ou mais. Depois aplicava essa
 * expressão a cada span da camada de texto, um por um, cada um julgado sem
 * saber dos outros.
 *
 * Numa página de memorial isso acende a folha inteira: "revestimento",
 * "conforme" e "especificação" aparecem dezenas de vezes, e todas ficavam
 * marcadas. A pessoa via marca em todo lugar e trecho em lugar nenhum — o
 * relato foi "a marcação está ficando imprecisa", e o diagnóstico é que ela
 * nunca soube ONDE o trecho estava. Ela marcava PALAVRAS, não o trecho.
 *
 * A palavra solta entrou como remendo para um problema real: o pdf.js corta o
 * texto em spans, e uma frase de cinco palavras quase nunca cabe num só. Mas o
 * remendo trocou "não marca" por "marca errado em dez lugares".
 *
 * O CONSERTO é a regra que o pin já usava desde sempre
 * ([[../server/nexo/audit/locate-term.ts]]): costurar os itens na ordem de
 * leitura com a MESMA medida da extração, achar o trecho no texto costurado, e
 * mapear o casamento de volta para as faixas de cada item. Uma ocorrência, a
 * certa, com começo e fim.
 *
 * PURO de propósito — sem pdf.js, sem DOM, sem React: recebe os itens, devolve
 * as faixas. É o que permite provar as nove regressões em node cru
 * (`npm run test:marcacao`), inclusive a página que acendia inteira.
 */
import { separadorEntreItens, type ItemDeTexto } from "./texto-do-pdf.ts";

/**
 * Faixas `[início, fim)` a marcar dentro de `item.str`, por índice do item.
 * Vazio quando o trecho não foi encontrado — e vazio é a resposta certa:
 * marcar em dúvida é o defeito que este módulo existe para não repetir.
 */
export type FaixasDaMarcacao = Map<number, [number, number][]>;

/**
 * Abaixo disto o termo casa em qualquer lugar da página.
 *
 * O mesmo piso do `MIN_ANCHOR_LENGTH` do pin, pela mesma razão: "de", "com" e
 * "não" existem em toda folha, e uma marca que pode estar em qualquer lugar não
 * informa nada sobre onde o achado está.
 */
const MIN_TERMO = 4;

/** Palavras mínimas que um prefixo precisa ter para valer como recorte. */
const MIN_PALAVRAS_DO_PREFIXO = 2;

/**
 * A forma comparável de um caractere: sem acento, minúscula.
 *
 * Um caractere por vez, e não a string inteira, porque o mapeamento de volta
 * para o item exige que ÍNDICE seja preservado — `NFD` numa string decompõe o
 * acento num segundo código e desloca tudo que vem depois.
 */
function normalizarCaractere(c: string): string {
  return c.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Caractere que não conta para o casamento: branco e o `|` da grade. */
function ehIgnoravel(c: string): boolean {
  // O `|` e o `-` de célula vazia são MOLDURA NOSSA (ver `textoDaPaginaParaIA`),
  // escrita para o modelo ler tabela. Ela não existe na folha, e sem esta
  // isenção toda evidência tirada de tabela ficaria sem marca.
  return /\s/.test(c) || c === "|";
}

type Costura = {
  /** O texto da página, normalizado, sem branco nem moldura. */
  texto: string;
  /** Para cada caractere de `texto`: de que item veio e em que posição. */
  origem: { item: number; offset: number }[];
};

/**
 * Costura os itens na ORDEM DE LEITURA, guardando a origem de cada caractere.
 *
 * O separador é `separadorEntreItens` — a mesma função que a extração usa. Se
 * divergissem, o visor procuraria na página um texto diferente do que o modelo
 * leu, e o achado perderia a marca justamente nas palavras que a costura
 * conserta ("respingos" contra "r espingos").
 *
 * O branco é DESCARTADO da agulha e do palheiro, e não normalizado: a evidência
 * citada pelo modelo atravessa quebra de linha e vem com o espaçamento dele, não
 * o da folha.
 */
function costurar(itens: ItemDeTexto[]): Costura {
  let texto = "";
  const origem: { item: number; offset: number }[] = [];
  let anterior: ItemDeTexto | null = null;

  itens.forEach((item, indice) => {
    if (!item.str) return;
    // O separador só existe para SEPARAR: como o branco é descartado dos dois
    // lados, ele não precisa entrar no texto — só não pode deixar duas palavras
    // se fundirem, e isso já não acontece porque cada uma guarda sua origem.
    if (anterior) separadorEntreItens(anterior, item);

    for (let i = 0; i < item.str.length; i += 1) {
      const c = item.str[i];
      if (ehIgnoravel(c)) continue;
      const normalizado = normalizarCaractere(c);
      // Um caractere pode normalizar para vários (ligaduras) ou para nenhum
      // (acento solto). Só o PRIMEIRO recebe a origem; os demais herdam-na,
      // para o índice do palheiro nunca perder o dono.
      for (const n of normalizado) {
        texto += n;
        origem.push({ item: indice, offset: i });
      }
    }
    anterior = item;
  });

  return { texto, origem };
}

/** A agulha: o termo sem branco, sem moldura, sem acento e em minúscula. */
function agulha(termo: string): string {
  let saida = "";
  for (const c of termo) {
    if (ehIgnoravel(c)) continue;
    saida += normalizarCaractere(c);
  }
  return saida;
}

/**
 * As faixas do casamento que começa em `at`, agrupadas por item.
 *
 * Faixas contíguas dentro do mesmo item são fundidas: sem isso, um item de 30
 * caracteres inteiramente dentro do trecho viraria 30 marcas de 1 caractere, e
 * o `<mark>` por letra quebra a seleção de texto e o desenho do grifo.
 */
function faixasDoCasamento(costura: Costura, at: number, tamanho: number): FaixasDaMarcacao {
  const faixas: FaixasDaMarcacao = new Map();

  for (let i = at; i < at + tamanho; i += 1) {
    const { item, offset } = costura.origem[i];
    const trechos = faixas.get(item) ?? [];
    const ultimo = trechos[trechos.length - 1];

    if (ultimo && ultimo[1] === offset) ultimo[1] = offset + 1;
    else trechos.push([offset, offset + 1]);

    faixas.set(item, trechos);
  }

  return faixas;
}

/**
 * ONDE MARCAR o trecho `termo` na página feita de `itens`.
 *
 * Procura o trecho inteiro. Não achando, encurta pela DIREITA, palavra a
 * palavra — o modelo erra no fim da citação (juntou duas frases, completou o
 * final), quase nunca no começo. O menor recorte aceito tem duas palavras: com
 * uma só voltaríamos a marcar "revestimento" nas dez vezes em que ele aparece,
 * que é exatamente o defeito de origem.
 */
export function marcacaoDoTrecho(itens: ItemDeTexto[], termo: string): FaixasDaMarcacao {
  const vazio: FaixasDaMarcacao = new Map();

  const palavras = termo.trim().split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return vazio;

  const costura = costurar(itens);
  if (!costura.texto) return vazio;

  for (let n = palavras.length; n >= MIN_PALAVRAS_DO_PREFIXO; n -= 1) {
    const recorte = agulha(palavras.slice(0, n).join(" "));
    if (recorte.length < MIN_TERMO) continue;

    const at = costura.texto.indexOf(recorte);
    if (at >= 0) return faixasDoCasamento(costura, at, recorte.length);
  }

  /*
   * UMA PALAVRA SÓ, e só se ela for longa. É o último recurso, para a evidência
   * que é um número ou um código isolado ("4.530,98", "NBR 9077"). O piso de
   * comprimento é o que impede a volta do defeito: "piso" e "obra" casam em
   * qualquer lugar; "4.530,98" e "anodizado", não.
   */
  if (palavras.length === 1) {
    const unica = agulha(palavras[0]);
    if (unica.length >= 6) {
      const at = costura.texto.indexOf(unica);
      if (at >= 0) return faixasDoCasamento(costura, at, unica.length);
    }
  }

  return vazio;
}
