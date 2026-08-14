import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import { getAiConfiguration } from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { isNexoEnabled } from "@/lib/feature-flags";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

/**
 * LEITURA DO CARIMBO PÁGINA A PÁGINA do volume JÁ MONTADO.
 *
 * O modelo só LÊ — devolve o que enxerga em cada recorte e nunca um juízo. Quem
 * compara com o plano da montagem é `checkVolumeMontado`, determinístico e
 * testado em node cru. Um modelo que erra a leitura gera um achado errado,
 * visível e corrigível; um modelo que desse o veredito poderia aprovar no
 * escuro o volume com a folha trocada.
 *
 * Diferente de `/api/nexo/selo-check`, que confere uma AMOSTRA por bloco: aqui o
 * volume inteiro passa, porque a pergunta é outra. "De quem é o brasão" é do
 * volume todo e uma amostra responde; "a página 9 é a folha que a LD promete" é
 * de cada página, e amostra nenhuma responde. O custo disso é uma chamada por
 * lote de páginas, e está aceito no spec
 * (`docs/superpowers/specs/2026-08-04-conferencia-volume-montado-design.md`,
 * decisão 3).
 */

/**
 * Páginas por chamada. Lote grande dilui o overhead da chamada; grande demais
 * estoura o teto de saída e faz o modelo perder a ordem das imagens, que é o
 * que liga cada leitura à sua página.
 */
const PAGINAS_POR_LOTE = 4;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["leituras"],
  properties: {
    leituras: {
      type: "array",
      description:
        "Uma entrada por imagem recebida, NA MESMA ORDEM em que as imagens foram enviadas.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "numeracaoTexto",
          "folha",
          "total",
          "codigo",
          "titulo",
          "disciplina",
          "orgao",
          "obra",
        ],
        properties: {
          numeracaoTexto: {
            type: ["string", "null"],
            description:
              "O campo PRANCHA exatamente como impresso (ex.: '01/16', '1 de 16'). null se nao aparecer.",
          },
          folha: {
            type: ["number", "null"],
            description: "Numero da folha lido nesse campo. null se ilegivel.",
          },
          total: {
            type: ["number", "null"],
            description: "Total de folhas lido nesse campo. null se ilegivel.",
          },
          codigo: {
            type: ["string", "null"],
            description:
              "Valor do campo ARQUIVO (ex.: '040_26_est_imp_001_a'). null se nao aparecer.",
          },
          titulo: {
            type: ["string", "null"],
            description:
              "Valor do campo CONTEUDO — so a descricao tecnica da prancha, sem rotulos vizinhos.",
          },
          disciplina: {
            type: ["string", "null"],
            description:
              "Sigla ou nome da disciplina impressos no carimbo (ex.: 'EST', 'ESTRUTURAL'). null se nao aparecer.",
          },
          orgao: {
            type: ["string", "null"],
            description: "Orgao/prefeitura como escrito no carimbo, por extenso.",
          },
          obra: {
            type: ["string", "null"],
            description: "Nome da obra como escrito no carimbo.",
          },
        },
      },
    },
  },
} as const;

/*
 * NÃO INFLE ESTE TEXTO PARA TENTAR GANHAR CACHE. Medido em 13/08/2026.
 *
 * Esta operação aparece como o pior caso do painel: 188 chamadas, 1,2 M de
 * tokens de entrada e cache ZERO em 45 dias. A causa é estrutural — a única
 * parte estável do prompt são estas instruções (417 chars, ~104 tokens), e o
 * corte mínimo da OpenAI para cachear prefixo é da ordem de 1.024. Tudo o que
 * vem depois (a lista de páginas e os recortes de carimbo) muda a cada chamada.
 *
 * A "correção" óbvia seria engordar este bloco até passar do corte. A conta diz
 * que não vale: hoje são ~6.479 tokens por chamada; com ~920 tokens de enchimento
 * seriam ~7.399, dos quais 1.024 a 10% do preço — efetivo ~6.477. Ganho de 0,03%,
 * em troca de 920 tokens de ruído num prompt cuja única função é dizer "copie o
 * que está escrito, não deduza". Pior leitura para economizar nada.
 *
 * O cache que existe no projeto (audit-global 35-45%, nexo-selo 16%) NÃO vem de
 * prefixo compartilhado: vem de repetir a MESMA chamada — reauditar o mesmo
 * documento, reler a mesma prancha. Esse é o caminho que rende, e quem cuida
 * dele é o cache por checksum da leitura de selo e a etapa 2 do delta.
 */
const INSTRUCOES = `Você lê carimbos (selos) de pranchas de projeto de engenharia.

Para CADA imagem recebida, devolva o que está ESCRITO nela. Nada mais.

- Copie os textos como aparecem. Não corrija, não complete, não traduza.
- Se um campo não estiver visível na imagem, devolva null. Nunca deduza.
- Não avalie se algo está certo ou errado. Não opine. Só leia.

A ordem do array de saída deve ser a mesma ordem das imagens recebidas.`;

interface PaginaRecebida {
  pagina: number;
  imageDataUrl: string;
}

function ehImagem(valor: unknown): valor is string {
  return typeof valor === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(valor);
}

/** Texto do modelo → leitura, com os buracos virando "" (nunca `undefined`). */
function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  /*
   * O PORTAO, DEPOIS da sessao.
   *
   * A checagem acima continua porque ela ESTREITA o tipo: o codigo abaixo le
   * `session.user` direto, e remove-la faria o TypeScript recusar cada leitura.
   * Mas ela nunca bastou -- responde "tem sessao?", e sessao sem escritorio
   * passava, deixando a rota util para quem nao pertence a lugar nenhum.
   *
   * As duas recusas independentes estao em [[lib/actor.ts]].
   */
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  /*
   * Sem teto aqui, um volume de 200 páginas fura a proteção da fatura numa
   * montagem só — e a conferência é AUTOMÁTICA, então ninguém escolheu pagar.
   */
  const teto = await verificarTetoMensal({
    userId: session.user.id ?? null,
    userEmail: session.user.email ?? null,
  });
  if (teto.estourou) {
    return NextResponse.json({ error: mensagemDeTetoEstourado(teto) }, { status: 402 });
  }

  let paginas: PaginaRecebida[];
  let conversationId: string | null = null;
  try {
    const body = (await req.json()) as { paginas?: unknown; conversationId?: unknown };
    if (!Array.isArray(body.paginas)) throw new Error("paginas ausente");
    paginas = body.paginas.map((raw, i) => {
      const p = raw as { pagina?: unknown; imageDataUrl?: unknown };
      if (typeof p.pagina !== "number") throw new Error(`paginas[${i}].pagina invalido`);
      if (!ehImagem(p.imageDataUrl)) throw new Error(`paginas[${i}].imageDataUrl invalido`);
      return { pagina: p.pagina, imageDataUrl: p.imageDataUrl };
    });
    if (typeof body.conversationId === "string" && body.conversationId.trim()) {
      conversationId = body.conversationId.trim();
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Corpo invalido." },
      { status: 400 },
    );
  }

  if (paginas.length === 0) {
    return NextResponse.json({ error: "Nenhuma pagina informada." }, { status: 400 });
  }
  if (paginas.length > PAGINAS_POR_LOTE) {
    return NextResponse.json(
      { error: `No maximo ${PAGINAS_POR_LOTE} paginas por chamada.` },
      { status: 400 },
    );
  }

  const configuracao = getAiConfiguration().volumeConferencia;
  /*
   * A conferência é VISUAL: ela lê um recorte de carimbo. Um provider sem visão
   * devolveria leituras vazias, e a regra produziria "nenhuma página traz
   * órgão" — um achado inventado pela configuração, não pelo documento.
   */
  if (configuracao.provider !== "openai") {
    return NextResponse.json(
      {
        error:
          "A conferencia do volume precisa de um modelo com visao. Escolha um modelo com visao no painel para o fluxo volume-conferencia.",
      },
      { status: 503 },
    );
  }

  let brutas: Record<string, unknown>[];
  let model = configuracao.model;
  try {
    const resultado = await executeOpenAiResponse({
      flow: "volume-conferencia",
      model: configuracao.model,
      operation: "nexo-volume-check",
      userEmail: session.user.email,
      conversationId,
      metadata: { paginas: paginas.map((p) => p.pagina) },
      request: {
        model: configuracao.model,
        max_output_tokens: 4000,
        reasoning: { effort: "none" },
        instructions: INSTRUCOES,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text" as const,
                text: `${paginas.length} recorte(s) de carimbo, nesta ordem: ${paginas
                  .map((p, i) => `${i + 1}) pagina ${p.pagina}`)
                  .join("; ")}`,
              },
              ...paginas.map((p) => ({
                type: "input_image" as const,
                image_url: p.imageDataUrl,
                detail: "high" as const,
              })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema" as const,
            name: "nexo_volume_leitura",
            strict: true,
            schema,
          },
        },
      },
    });
    model = resultado.model;
    const parsed = JSON.parse(resultado.text) as { leituras?: Record<string, unknown>[] };
    brutas = Array.isArray(parsed.leituras) ? parsed.leituras : [];
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao ler o volume." },
      { status: 502 },
    );
  }

  /*
   * A página volta CASADA POR ÍNDICE com o que foi enviado, e não pelo que o
   * modelo disser. Pedir o número da página na resposta convidaria a alucinação
   * a MOVER uma leitura de página — e leitura na página errada é exatamente o
   * defeito que esta conferência existe para pegar. Se o modelo devolver menos
   * entradas do que imagens, as que sobram saem vazias e a regra trata como
   * "não conferida", que é a verdade.
   */
  return NextResponse.json({
    leituras: paginas.map((p, i) => {
      const b = brutas[i];
      return {
        pagina: p.pagina,
        numeracaoTexto: texto(b?.numeracaoTexto),
        folha: numero(b?.folha),
        total: numero(b?.total),
        codigo: texto(b?.codigo),
        titulo: texto(b?.titulo),
        disciplina: texto(b?.disciplina),
        orgao: texto(b?.orgao),
        obra: texto(b?.obra),
        ...(b ? {} : { erro: "o modelo nao devolveu leitura para esta pagina" }),
      };
    }),
    model,
  });
}
