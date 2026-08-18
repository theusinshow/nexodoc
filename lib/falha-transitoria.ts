/**
 * FALHA QUE PASSA × FALHA QUE FICA.
 *
 * Em 18/08/2026 a leitura global do 117_25 morreu aos 310s com
 * "503 Our servers are currently overloaded". A auditoria seguiu adiante, pagou
 * a validação, e entregou um parecer com 10 achados de regra e nenhuma leitura
 * por IA — de um documento de 218 páginas. A corrida seguinte, idêntica, deu
 * certo: 58 achados. A diferença entre as duas não foi o código nem o
 * documento, foi o minuto.
 *
 * Retentar só faz sentido quando a causa é do tipo que passa sozinha. Truncagem
 * de saída, JSON inválido e recusa por conteúdo são determinísticos: tentar de
 * novo com a mesma entrada dá o mesmo resultado, e cobra outra vez por isso.
 * Confundir os dois grupos é o que transforma retentativa em desperdício.
 *
 * A favor de retentar o 503: ele custa ZERO token. A fatura da corrida que
 * falhou registrou `in=0 out=0` — o provedor recusou antes de processar. Uma
 * retentativa que dá certo compra a auditoria que a pessoa pediu; uma que falha
 * de novo não cobra nada.
 *
 * PURO: classifica um erro, não executa nada.
 */

/** Códigos HTTP que o provedor usa para "tente de novo daqui a pouco". */
const STATUS_TRANSITORIO = new Set([408, 409, 429, 500, 502, 503, 504, 529]);

/**
 * Marcas textuais de indisponibilidade momentânea. Ficam em minúsculas e sem
 * acento; a comparação normaliza antes.
 */
const MARCAS_TRANSITORIAS = [
  "overloaded",
  "rate limit",
  "rate_limit",
  "too many requests",
  "service unavailable",
  "temporarily unavailable",
  "try again",
  "timeout",
  "timed out",
  "econnreset",
  "etimedout",
  "econnrefused",
  "socket hang up",
  "fetch failed",
];

/**
 * Marcas de falha DETERMINÍSTICA — repetir não muda o resultado.
 *
 * Vêm antes das transitórias na decisão: "max_output_tokens" contém "tokens" e
 * uma mensagem de truncagem pode citar "try again" na dica do provedor. Sem esta
 * precedência, a falha mais cara de todas (truncagem, que queima o teto inteiro
 * e devolve zero) viraria candidata a ser repetida.
 */
const MARCAS_DEFINITIVAS = [
  "max_output_tokens",
  "incomplete_max_output_tokens",
  "invalid_request",
  "context_length",
  "content_policy",
  "invalid json",
  "json invalido",
  "resposta invalida",
  "unauthorized",
  "forbidden",
  "not found",
];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function statusDoErro(erro: unknown): number | null {
  const e = erro as { status?: unknown; statusCode?: unknown; code?: unknown };
  for (const bruto of [e?.status, e?.statusCode, e?.code]) {
    const n = Number(bruto);
    if (Number.isInteger(n) && n >= 100 && n < 600) return n;
  }
  return null;
}

export function mensagemDoErro(erro: unknown): string {
  if (typeof erro === "string") return erro;
  const m = (erro as { message?: unknown })?.message;
  return typeof m === "string" ? m : String(erro ?? "");
}

/**
 * Vale a pena tentar de novo?
 *
 * O status estruturado manda quando existe. Sem ele, sobra a mensagem — e é o
 * caso real: o erro chegou como `Error("503 Our servers are currently
 * overloaded. Please try again later.")`, com o código só no texto.
 */
export function ehFalhaTransitoria(erro: unknown): boolean {
  const texto = normalizar(mensagemDoErro(erro));

  if (MARCAS_DEFINITIVAS.some((marca) => texto.includes(marca))) return false;

  const status = statusDoErro(erro);
  if (status !== null) return STATUS_TRANSITORIO.has(status);

  // O código pode vir só no começo da mensagem: "503 Our servers are ...".
  const noTexto = texto.match(/\b(4\d{2}|5\d{2})\b/);
  if (noTexto && STATUS_TRANSITORIO.has(Number(noTexto[1]))) return true;

  return MARCAS_TRANSITORIAS.some((marca) => texto.includes(marca));
}

/**
 * Quanto esperar antes da tentativa `n` (1 = primeira retentativa).
 *
 * Recuo exponencial curto: o orçamento de tempo da passada global é de 900s e
 * uma leitura gasta ~275s, então não há espaço para esperar minutos. 2s e 8s
 * cobrem o pico de sobrecarga sem comer o orçamento da própria chamada.
 */
export function esperaDaTentativa(n: number): number {
  return Math.min(8_000, 2_000 * 2 ** Math.max(0, n - 1));
}

/**
 * Quantas vezes uma passada cara pode ser tentada ao todo (1 + retentativas).
 *
 * Três, não mais: o 503 custa zero token, mas cada tentativa BEM-SUCEDIDA custa
 * uma leitura inteira, e o orçamento de tempo da global é de 900s. Duas
 * retentativas cobrem o pico de sobrecarga do provedor sem transformar uma
 * indisponibilidade longa em espera infinita.
 */
export const TENTATIVAS_PADRAO = 3;

/**
 * Roda `fn`, repetindo enquanto a falha for do tipo que passa sozinha.
 *
 * Mora aqui, e não na rota, para poder ser provado: uma retentativa que não se
 * consegue exercitar em teste é uma retentativa em que não se pode confiar
 * justamente no dia em que ela importa.
 *
 * `aoRepetir` recebe o erro, o número da tentativa que falhou e a espera. Quem
 * chama decide se isso vira log, marco na tela ou nada — o módulo não escolhe.
 */
export async function comRetentativa<T>(
  fn: () => Promise<T>,
  opcoes: {
    tentativas?: number;
    aoRepetir?: (erro: unknown, tentativa: number, esperaMs: number) => void;
    dormir?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const tentativas = opcoes.tentativas ?? TENTATIVAS_PADRAO;
  const dormir =
    opcoes.dormir ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  let ultimo: unknown;
  for (let n = 1; n <= tentativas; n++) {
    try {
      return await fn();
    } catch (err) {
      ultimo = err;
      if (n >= tentativas || !ehFalhaTransitoria(err)) throw err;
      const espera = esperaDaTentativa(n);
      opcoes.aoRepetir?.(err, n, espera);
      await dormir(espera);
    }
  }
  throw ultimo;
}
