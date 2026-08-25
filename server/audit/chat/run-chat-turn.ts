/**
 * O LAÇO DE FERRAMENTAS.
 *
 * A IA escolhe O QUE olhar; quem responde ONDE ESTÁ é o código. Cada volta é
 * uma chamada ao modelo, e cada chamada passa por `executeOpenAiResponse` — que
 * já cobra, telemetra e respeita o teto mensal. Nada aqui fala com a OpenAI
 * direto: o executor é INJETADO, e é por isso que este arquivo inteiro é
 * testável sem gastar um token.
 *
 * O teto de voltas não é otimização, é honestidade: um modelo que entra em laço
 * com `buscar_no_memorial` gastaria sem entregar nada, e o engenheiro ficaria
 * olhando para uma bolha vazia. Estourou, ele responde com o que juntou e DIZ
 * que parou por limite.
 *
 * POR QUE FERRAMENTAS, E NÃO AS ALTERNATIVAS — está aqui porque é o que quem
 * vier depois vai ser tentado a "simplificar":
 *  - contexto cheio: o memorial de 73 páginas tem 173k chars (≈43k tokens) e
 *    entraria em TODA pergunta; o cache de prefixo já foi medido e não rende
 *    aqui, e com 73 páginas coladas o modelo erra o número da página;
 *  - RAG leve (uma busca por turno): o advogado do diabo precisa NAVEGAR — "e na
 *    página seguinte?", "onde mais aparece essa cota?". Uma busca única não
 *    navega: ele responde com o que a primeira trouxe e cala sobre o resto.
 */
import type { FunctionTool } from "openai/resources/responses/responses";

import type { AuditFinding } from "../../../lib/audit-report.ts";
import {
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTA_REGISTRAR,
  buscarNoMemorial,
  lerAchado,
  lerPaginas,
  listarCapitulos,
  registrarAchado,
  temMemoria,
  type AchadoProposto,
  type ContextoDoChat,
} from "./ferramentas.ts";
import { FERRAMENTA_HISTORICO } from "./historico.ts";
import { instrucoesDoAdvogado, primeiraEntrada } from "./prompt.ts";

export type ItemDeSaida = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
};

export type ExecutorDoModelo = (args: {
  input: unknown[];
  tools: FunctionTool[];
  volta: number;
  /** Última volta permitida: as ferramentas saem de cena e ele TEM de responder. */
  ultimaVolta: boolean;
}) => Promise<{ text: string; output: ItemDeSaida[] }>;

export type EventoDoChat =
  | { type: "ferramenta"; nome: string; resumo: string }
  | { type: "delta"; text: string }
  | { type: "achado"; achado: AuditFinding }
  | { type: "proposta"; turno: unknown }
  | { type: "done"; voltas: number; parouPorTeto: boolean };

export const FERRAMENTA_ENCAMINHAR: FunctionTool = {
  type: "function",
  name: "encaminhar_para_geracao",
  description:
    "Entrega o turno ao Nexo quando o engenheiro pede para GERAR algo (LD, capa, separatriz, " +
    "volume, nova auditoria) em vez de perguntar sobre o parecer.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      pedido: { type: "string", description: "O pedido do engenheiro, com as palavras dele." },
    },
    required: ["pedido"],
  },
};

/**
 * Oito voltas por padrão. Configurável porque o número certo depende do
 * memorial: navegar um documento de 200 páginas custa mais idas do que um de 40.
 */
export function tetoDeVoltas(): number {
  const bruto = Number(process.env.NEXODOC_AUDIT_CHAT_MAX_TOOL_TURNS ?? 8);
  if (!Number.isFinite(bruto) || bruto < 1) return 8;
  return Math.min(Math.trunc(bruto), 20);
}

/** O que dizer ao engenheiro enquanto o modelo lê. */
function resumoDaChamada(nome: string, args: Record<string, unknown>): string {
  switch (nome) {
    case "buscar_no_memorial":
      return `procurando "${String(args.termo ?? "").slice(0, 60)}"`;
    case "ler_paginas":
      return `lendo as páginas ${args.de}-${args.ate}`;
    case "ler_achado":
      return `revendo o achado ${args.id}`;
    case "listar_capitulos":
      return "abrindo o índice do memorial";
    case "historico_da_obra":
      return "consultando o histórico da obra";
    case "registrar_achado":
      return `registrando um achado na página ${args.pagina}`;
    case "encaminhar_para_geracao":
      return "passando o pedido ao Nexo";
    default:
      return nome;
  }
}

export async function* runChatTurn(args: {
  ctx: ContextoDoChat;
  pergunta: string;
  historico: { role: "user" | "assistant"; content: string }[];
  executar: ExecutorDoModelo;
  aoRegistrar?: (achado: AuditFinding) => Promise<void> | void;
  encaminhar?: (pedido: string) => Promise<unknown>;
  historicoDaObra?: () => Promise<string>;
}): AsyncGenerator<EventoDoChat> {
  const teto = tetoDeVoltas();
  const comMemoria = temMemoria(args.ctx);

  const ferramentas: FunctionTool[] = [
    ...FERRAMENTAS_DE_LEITURA,
    FERRAMENTA_REGISTRAR,
    ...(args.historicoDaObra ? [FERRAMENTA_HISTORICO] : []),
    ...(args.encaminhar ? [FERRAMENTA_ENCAMINHAR] : []),
  ];

  const input: unknown[] = [
    { role: "system", content: instrucoesDoAdvogado({ temMemoria: comMemoria }) },
    {
      role: "user",
      content: primeiraEntrada({
        pergunta: args.pergunta,
        historico: args.historico,
        report: args.ctx.report,
      }),
    },
  ];

  let volta = 0;

  while (volta < teto) {
    volta += 1;
    const ultimaVolta = volta === teto;

    const { text, output } = await args.executar({
      input: [...input],
      // Na última volta as ferramentas SAEM: deixá-las na mesa convida o modelo
      // a pedir mais uma, e aí o engenheiro fica sem resposta nenhuma.
      tools: ultimaVolta ? [] : ferramentas,
      volta,
      ultimaVolta,
    });

    const chamadas = (output ?? []).filter((item) => item?.type === "function_call");

    if (chamadas.length === 0) {
      if (text.trim()) yield { type: "delta", text: text.trim() };
      yield { type: "done", voltas: volta, parouPorTeto: false };
      return;
    }

    // Pediu ferramenta na volta em que elas não existiam mais: cai no fecho.
    if (ultimaVolta) break;

    // A saída do modelo volta VERBATIM para a entrada seguinte: é assim que a
    // Responses API amarra a chamada ao seu resultado, pelo `call_id`.
    input.push(...(output as unknown[]));

    for (const chamada of chamadas) {
      const nome = chamada.name ?? "";
      let parsed: Record<string, unknown> = {};

      try {
        parsed = chamada.arguments
          ? (JSON.parse(chamada.arguments) as Record<string, unknown>)
          : {};
      } catch {
        input.push({
          type: "function_call_output",
          call_id: chamada.call_id,
          output: "Os argumentos não são JSON válido. Reformule a chamada.",
        });
        continue;
      }

      yield { type: "ferramenta", nome, resumo: resumoDaChamada(nome, parsed) };

      let resultado: string;

      switch (nome) {
        case "listar_capitulos":
          resultado = listarCapitulos(args.ctx);
          break;
        case "buscar_no_memorial":
          resultado = buscarNoMemorial(args.ctx, String(parsed.termo ?? ""));
          break;
        case "ler_paginas":
          resultado = lerPaginas(args.ctx, Number(parsed.de ?? 0), Number(parsed.ate ?? 0));
          break;
        case "ler_achado":
          resultado = lerAchado(args.ctx, String(parsed.id ?? ""));
          break;
        case "historico_da_obra":
          resultado = args.historicoDaObra
            ? await args.historicoDaObra()
            : "O histórico da obra não está disponível nesta instalação.";
          break;
        case "registrar_achado": {
          const r = registrarAchado(args.ctx, parsed as unknown as AchadoProposto);
          resultado = r.mensagem;
          if (r.ok) {
            /*
             * O contexto do turno passa a CONTER o achado novo: sem isto, dois
             * registros na mesma conversa nasceriam com o mesmo id, e a
             * impressão digital não pegaria a duplicata do segundo.
             */
            args.ctx.report.incongruencias = [
              ...(args.ctx.report.incongruencias ?? []),
              r.achado,
            ];
            args.ctx.report.total_incongruencias = args.ctx.report.incongruencias.length;
            await args.aoRegistrar?.(r.achado);
            yield { type: "achado", achado: r.achado };
          }
          break;
        }
        case "encaminhar_para_geracao": {
          if (!args.encaminhar) {
            resultado = "Encaminhamento indisponível nesta conversa. Responda você mesmo.";
            break;
          }
          const turno = await args.encaminhar(String(parsed.pedido ?? args.pergunta));
          yield { type: "proposta", turno };
          resultado =
            "Pedido entregue ao Nexo; a proposta já foi mostrada ao engenheiro. " +
            "Feche a resposta em uma frase, sem repetir a proposta.";
          break;
        }
        default:
          // Listar as disponíveis ENSINA o modelo a se corrigir na volta
          // seguinte, em vez de deixá-lo tentar outro palpite.
          resultado = `A ferramenta "${nome}" não existe. As disponíveis são: ${ferramentas
            .map((f) => f.name)
            .join(", ")}.`;
      }

      input.push({ type: "function_call_output", call_id: chamada.call_id, output: resultado });
    }
  }

  /*
   * Estourou o teto. Uma última ida ao modelo SEM ferramenta nenhuma, para ele
   * responder com o que juntou. Silenciar aqui seria o pior desfecho: o
   * engenheiro pagou por N voltas e não recebe frase nenhuma.
   */
  input.push({
    role: "user",
    content:
      `Você atingiu o limite de ${teto} consultas às ferramentas nesta pergunta. ` +
      "Responda AGORA com o que você já apurou, e diga em uma frase que parou por limite " +
      "e o que faltava investigar.",
  });

  const fecho = await args.executar({ input: [...input], tools: [], volta, ultimaVolta: true });
  const texto =
    fecho.text.trim() ||
    `Parei por limite de ${teto} consultas ao documento e não consegui fechar a resposta. Refaça a pergunta mais específica (por exemplo, apontando o capítulo ou a página).`;

  yield { type: "delta", text: texto };
  // Chegar aqui significa teto: o `while` só sai por ele.
  yield { type: "done", voltas: volta, parouPorTeto: true };
}
