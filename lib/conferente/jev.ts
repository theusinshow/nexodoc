/**
 * O CONFERENTE — cliente do Jev (TypeSafe System One).
 *
 * O QUE ESTA CAMADA É, E O QUE ELA NUNCA É
 *
 * Ela não lê memorial, não descobre achado e não escreve texto. Ela responde
 * PERGUNTA DE CONJUNTO FECHADO com probabilidade: "sim/não", "qual destes",
 * "que nível desta régua". É o que a OpenAI não devolve calibrado e o que o
 * NexoDoc hoje resolve com string livre que o próprio modelo escreveu sobre si.
 *
 * A REGRA DE OURO, que vale para os quatro encaixes:
 *
 *   O CONFERENTE NUNCA REMOVE NEM REBAIXA ACHADO.
 *
 * Ele assina, varre, mede e agrupa. Falhou, deu 429, deu timeout, devolveu
 * resposta inválida — a auditoria sai EXATAMENTE como sai hoje. Por isso toda
 * função daqui devolve `null` em vez de lançar: quem chama trata a ausência
 * como "não perguntei", nunca como "respondeu não".
 *
 * TRÊS COISAS DA API QUE MUDAM O DESENHO (docs.typesafe.ai, 21/09/2026)
 *
 * 1. A SAÍDA É DE GRAÇA. Só entrada é cobrada, a US$ 0,042 por 1M. Isso não é
 *    detalhe de preço: é o que torna o Encaixe 2 possível. Varrer um bloco que
 *    ninguém leu custa a entrada do bloco e mais nada — e foi justamente o teto
 *    de SAÍDA que censurou 24% dos blocos entre jun e ago/2026.
 *
 * 2. UMA CHAMADA CARREGA MUITAS PERGUNTAS. `questions` é um mapa. Decompor
 *    ("o nome curto é sigla do longo?" + "os nomes próprios coincidem?" + ...)
 *    não custa uma chamada por pergunta: custa a mesma entrada, uma vez. A
 *    decomposição deixa de ser luxo e vira o jeito barato de perguntar.
 *
 * 3. O TETO É 64k POR REQUISIÇÃO, com 32k para o `state` mais a maior pergunta.
 *    Estourar isso é 422. Quem chama recorta antes — ver `recortarEstado`.
 *
 * A ARMADILHA QUE A DOCUMENTAÇÃO ESCREVE E QUE É NOSSA
 *
 * "English performs best; other languages, including CJK scripts, are handled
 * but not equally well." TODO memorial daqui é pt-BR. A saída disso é escrever
 * PERGUNTA e RUBRICA em inglês e deixar o `state` em português — o trecho do
 * memorial não pode ser traduzido, porque é ele que ancora o achado na página.
 * Traduzir a evidência para agradar o modelo seria trocar a âncora pelo resumo.
 */

import { getJevApiKey } from "@/lib/ai-providers";
import { recordAiUsage } from "@/lib/ai-usage";

/**
 * VERSÃO PINADA, NUNCA O ALIAS.
 *
 * `jev-latest` e `jev-preview` apontam hoje para `jev-1.13.0`, e um dia não vão
 * mais. O que está em jogo não é a resposta mudar — é a CALIBRAÇÃO mudar: a
 * probabilidade que alimenta a severidade passaria a significar outra coisa da
 * noite para o dia, sem uma linha de diff e sem ninguém notar. Ao subir esta
 * constante, remeça o harness antes de confiar no número.
 */
export const MODELO_DO_CONFERENTE = "jev-1.13.0";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";

/** Teto da requisição (64k) e do `state` + maior pergunta (32k), em tokens. */
const TETO_DE_ESTADO_EM_TOKENS = 32_000;
/**
 * ~4 caracteres por token é a conta grosseira de sempre, e ela subestima em
 * português (acento vira byte extra). A margem de 15% existe para o 422 nunca
 * depender de eu ter acertado a razão — recortar de leve é barato, 422 é uma
 * chamada perdida.
 */
const CARACTERES_POR_TOKEN = 4;
const TETO_DE_ESTADO_EM_CARACTERES = Math.floor(TETO_DE_ESTADO_EM_TOKENS * CARACTERES_POR_TOKEN * 0.85);

const TIMEOUT_MS = 20_000;
const TENTATIVAS = 3;

export type PerguntaNoul = {
  type: "noul";
  /** Em INGLÊS — ver o cabeçalho. */
  instructions: string;
  /**
   * OS DOIS POLOS, e a documentação está errada sobre isto.
   *
   * `docs.typesafe.ai/api.md` diz que `criteria` de um `noul` é uma string
   * opcional. Mandar string é 422: "Input should be a valid dictionary or
   * object to extract fields from". O que a API aceita é um objeto com as
   * chaves `true` e `false`.
   *
   * E as chaves importam. Medido em 21/09/2026 no mesmo estado: com
   * `{true, false}` a resposta foi 0,82; com `{yes, no}` foi 0,89 — idêntica à
   * de não mandar critério nenhum. Ou seja, `yes`/`no` passa no schema e é
   * silenciosamente ignorado. Escrever o polo errado não dá erro: dá uma
   * resposta que parece calibrada e não leu a rubrica.
   */
  criteria?: { true: string; false: string };
};

export type PerguntaChoice = {
  type: "choice";
  instructions: string;
  /** Mapa opção -> o que ela significa. Em INGLÊS. */
  criteria: Record<string, string>;
};

export type PerguntaScore = {
  type: "score";
  instructions: string;
  /** Régua ORDENADA, do nível 0 para cima. De 2 a 10 níveis. Em INGLÊS. */
  criteria: string[];
};

export type Pergunta = PerguntaNoul | PerguntaChoice | PerguntaScore;

export type RespostaNoul = { type: "noul"; noul: number };
export type RespostaChoice = {
  type: "choice";
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
};
export type RespostaScore = {
  type: "score";
  score: number;
  legend: Record<string, string>;
  probabilities: Record<string, number>;
  confidence: number;
};

export type Resposta = RespostaNoul | RespostaChoice | RespostaScore;

export type RespostaDoConferente = {
  modelo: string;
  respostas: Record<string, Resposta>;
  entrada: number;
  saida: number;
  duracaoMs: number;
};

export function conferenteEstaConfigurado() {
  return Boolean(getJevApiKey());
}

/**
 * Recorta o `state` para caber no teto, pelas DUAS PONTAS.
 *
 * Cortar só o fim é o reflexo errado aqui. O trecho que interessa numa pergunta
 * sobre achado costuma estar no MEIO de um bloco, e o que ancora a decisão é a
 * vizinhança dele — cortar o fim joga fora metade da vizinhança e mantém um
 * cabeçalho de capítulo que não decide nada. Guardar as duas pontas preserva o
 * começo (que diz do que o bloco trata) e o fim (onde o texto costuma concluir).
 */
export function recortarEstado(estado: string, teto = TETO_DE_ESTADO_EM_CARACTERES) {
  if (estado.length <= teto) {
    return estado;
  }

  const metade = Math.floor((teto - 40) / 2);

  return `${estado.slice(0, metade)}\n[...]\n${estado.slice(-metade)}`;
}

function ehRespostaValida(valor: unknown): valor is Resposta {
  if (!valor || typeof valor !== "object") {
    return false;
  }

  const resposta = valor as Record<string, unknown>;

  if (resposta.type === "noul") {
    return typeof resposta.noul === "number" && Number.isFinite(resposta.noul);
  }

  if (resposta.type === "choice") {
    return typeof resposta.choice === "string" && typeof resposta.probabilities === "object";
  }

  if (resposta.type === "score") {
    return typeof resposta.score === "number" && Number.isFinite(resposta.score);
  }

  return false;
}

function esperar(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Uma rodada de perguntas sobre um estado. Devolve `null` em qualquer falha.
 *
 * NUNCA LANÇA, de propósito: os quatro encaixes chamam daqui de dentro do
 * caminho da auditoria, e um `throw` aqui derrubaria um parecer inteiro por
 * causa de um 429 numa camada que é, por definição, opcional.
 */
export async function perguntarAoConferente(args: {
  estado: string;
  perguntas: Record<string, Pergunta>;
  /** Para a telemetria: qual encaixe está perguntando. */
  operacao: string;
  userEmail?: string | null;
  conversationId?: string | null;
}): Promise<RespostaDoConferente | null> {
  const chave = getJevApiKey();

  if (!chave || Object.keys(args.perguntas).length === 0) {
    return null;
  }

  const estado = recortarEstado(args.estado);
  const comecou = Date.now();
  let ultimoErro: unknown = null;

  for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
    const controlador = new AbortController();
    const alarme = setTimeout(() => controlador.abort(), TIMEOUT_MS);

    try {
      const resposta = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${chave}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: estado,
          model: MODELO_DO_CONFERENTE,
          questions: args.perguntas,
        }),
        signal: controlador.signal,
      });

      clearTimeout(alarme);

      /*
       * 429 e 529 são os dois que a documentação manda repetir com recuo. Os
       * outros não melhoram com insistência: 401 é chave errada e 422 é
       * requisição malformada — repetir os dois só queima tempo do parecer.
       */
      if (resposta.status === 429 || resposta.status === 529) {
        ultimoErro = new Error(`conferente respondeu ${resposta.status}`);
        await esperar(2 ** tentativa * 500);
        continue;
      }

      if (!resposta.ok) {
        ultimoErro = new Error(`conferente respondeu ${resposta.status}`);
        break;
      }

      const corpo = (await resposta.json()) as {
        model?: string;
        answers?: Record<string, unknown>;
        usage?: { input_tokens?: number; output_tokens?: number };
      };

      const respostas: Record<string, Resposta> = {};

      for (const [nome, bruta] of Object.entries(corpo.answers ?? {})) {
        if (ehRespostaValida(bruta)) {
          respostas[nome] = bruta;
        }
      }

      const entrada = corpo.usage?.input_tokens ?? 0;
      const saida = corpo.usage?.output_tokens ?? 0;
      const duracaoMs = Date.now() - comecou;

      await recordAiUsage({
        flow: "conferente",
        provider: "typesafe",
        model: corpo.model ?? MODELO_DO_CONFERENTE,
        operation: args.operacao,
        usage: { inputTokens: entrada, outputTokens: saida, cachedTokens: 0, totalTokens: entrada + saida },
        durationMs: duracaoMs,
        userEmail: args.userEmail,
        conversationId: args.conversationId,
        /*
         * A CHAVE NÃO ENTRA AQUI, e nem o trecho do memorial. `metadata` vai
         * para o banco e para o painel admin — foi exatamente por este caminho
         * que uma `sk-proj` acabou em 169 linhas. Só contagem.
         */
        metadata: { perguntas: Object.keys(args.perguntas).length },
      });

      return {
        modelo: corpo.model ?? MODELO_DO_CONFERENTE,
        respostas,
        entrada,
        saida,
        duracaoMs,
      };
    } catch (error) {
      clearTimeout(alarme);
      ultimoErro = error;
    }
  }

  await recordAiUsage({
    flow: "conferente",
    provider: "typesafe",
    model: MODELO_DO_CONFERENTE,
    operation: args.operacao,
    status: "failed",
    durationMs: Date.now() - comecou,
    error: ultimoErro,
    userEmail: args.userEmail,
    conversationId: args.conversationId,
  });

  return null;
}
