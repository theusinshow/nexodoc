/**
 * RESPOSTA EM SEGUNDO PLANO — a chamada longa que não depende de conexão aberta.
 *
 * A leitura global espera a resposta inteira numa requisição HTTP só, e o
 * modelo passa minutos pensando sem mandar um byte. Em 14/09/2026 a do 117_25
 * ficou 900s pendurada em produção e voltou com zero token. No banco de
 * produção, das 77 leituras globais que passaram, a mais longa levou 338s; as 4
 * que cruzaram ~350s morreram todas. Na máquina de desenvolvimento o mesmo
 * documento passa: o que corta é o caminho de rede do servidor, não o modelo.
 *
 * E o SDK piorava em silêncio: com o padrão dele (prazo de 600s e duas
 * retentativas), aos 600s ele REENVIAVA a chamada — uma segunda resposta paga,
 * que o nosso prazo de 900s matava no meio.
 *
 * Em segundo plano (`background: true`) a criação volta em segundos com um id,
 * e cada consulta também. Nenhuma conexão fica calada tempo bastante para ser
 * derrubada. Provado com a chave do projeto em 14/09/2026.
 */

export type RespostaDoProvedor = {
  id: string;
  status?: string | null;
  error?: { message?: string | null; code?: string | null } | null;
};

/** O pedaço do cliente da OpenAI que o laço usa — injetável para o teste. */
export type ClienteDeRespostas = {
  create(
    body: Record<string, unknown>,
    options?: { signal?: AbortSignal; maxRetries?: number; timeout?: number },
  ): Promise<RespostaDoProvedor>;
  retrieve(
    id: string,
    query?: Record<string, unknown>,
    options?: { signal?: AbortSignal; timeout?: number },
  ): Promise<RespostaDoProvedor>;
  cancel(id: string, options?: { timeout?: number }): Promise<unknown>;
};

const EM_ANDAMENTO = new Set(["queued", "in_progress"]);

function erroDeTempoEsgotado() {
  const erro = new Error(
    "Tempo esgotado: a resposta ainda estava em andamento no provedor e foi cancelada.",
  );
  erro.name = "AbortError";
  return erro;
}

function esperarComSinal(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", aoAbortar);
      resolve();
    }, ms);
    const aoAbortar = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener("abort", aoAbortar, { once: true });
  });
}

export async function respostaEmSegundoPlano<T extends RespostaDoProvedor>(args: {
  cliente: ClienteDeRespostas;
  request: Record<string, unknown>;
  /** O prazo da passada. Ao disparar, a resposta é cancelada no provedor. */
  signal: AbortSignal;
  intervaloMs?: number;
  /**
   * Consultas que podem falhar SEGUIDAS antes de desistir. Consultar é
   * idempotente: um soluço de rede não pode jogar fora minutos de leitura já
   * paga.
   */
  falhasSeguidasToleradas?: number;
  esperar?: (ms: number, signal: AbortSignal) => Promise<void>;
}): Promise<T> {
  const intervaloMs = args.intervaloMs ?? 5_000;
  const tolerancia = args.falhasSeguidasToleradas ?? 6;
  const esperar = args.esperar ?? esperarComSinal;

  let resposta = (await args.cliente.create(
    { ...args.request, background: true },
    // Sem retentativa automática: reenviar a CRIAÇÃO cria outra resposta, e
    // cobra as duas. Quem decide repetir é `comRetentativa`, que sabe o que é
    // falha transitória.
    { signal: args.signal, maxRetries: 0, timeout: 60_000 },
  )) as T;

  let falhasSeguidas = 0;

  while (!resposta.status || EM_ANDAMENTO.has(resposta.status)) {
    await esperar(intervaloMs, args.signal);

    if (args.signal.aborted) {
      await args.cliente.cancel(resposta.id, { timeout: 15_000 }).catch(() => {});
      throw erroDeTempoEsgotado();
    }

    try {
      resposta = (await args.cliente.retrieve(resposta.id, {}, {
        signal: args.signal,
        timeout: 30_000,
      })) as T;
      falhasSeguidas = 0;
    } catch (erro) {
      if (args.signal.aborted) {
        await args.cliente.cancel(resposta.id, { timeout: 15_000 }).catch(() => {});
        throw erroDeTempoEsgotado();
      }
      falhasSeguidas++;
      if (falhasSeguidas >= tolerancia) throw erro;
    }
  }

  if (resposta.status === "failed") {
    const erro = new Error(
      resposta.error?.message?.trim() || "O provedor marcou a resposta como falha.",
    ) as Error & { code?: string };
    if (resposta.error?.code) erro.code = resposta.error.code;
    throw erro;
  }

  if (resposta.status === "cancelled") {
    throw new Error("A resposta foi cancelada no provedor antes de terminar.");
  }

  // "completed" e "incomplete" voltam como estão: é `extractOutputText` quem
  // transforma truncagem e recusa em erro, igual à chamada direta.
  return resposta;
}
