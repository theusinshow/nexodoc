import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import {
  createInvalidProviderResponseError,
  getAiConfiguration,
} from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { isNexoEnabled } from "@/lib/feature-flags";
import {
  checkSeloIdentity,
  type AlvoDaConferencia,
  type LeituraDoSelo,
} from "@/server/nexo/selo-identity-core";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";

export const runtime = "nodejs";

/**
 * CONFERÊNCIA DE IDENTIDADE DO SELO — a única parte da conferência que usa IA.
 *
 * Recebe uma AMOSTRA de recortes de carimbo e devolve o veredito sobre três
 * coisas que a conferência determinística não alcança: se o selo traz o
 * ENDEREÇO da obra, se o BRASÃO é o da prefeitura para quem o volume vai, e se
 * a NUMERAÇÃO impressa no carimbo bate com a folha que aquela página deveria
 * ser.
 *
 * O modelo só LÊ — devolve o que enxerga, campo a campo, e nunca um juízo.
 * Quem compara com a prefeitura-alvo é `checkSeloIdentity`, determinístico e
 * testado. Um modelo que erra a leitura gera um achado errado, visível e
 * corrigível; um modelo que desse o veredito poderia aprovar no escuro o
 * volume com o logo trocado, que é o acidente que este módulo existe para
 * impedir.
 *
 * LEVE de propósito: o modelo barato, uma única chamada, e uma AMOSTRA de
 * folhas (o brasão e o endereço são do volume inteiro — a prancha intrusa é
 * pega pelo texto, na conferência determinística). Não se gasta visão em 200
 * páginas para descobrir de quem é o brasão.
 */

const MODELO_PADRAO = "gpt-5.6-luna";
/** Teto de amostras: o custo tem de ser previsível, e o brasão não muda. */
const MAX_AMOSTRAS = 4;

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
          "endereco",
          "orgao",
          "logoPresente",
          "logoOrgao",
          "numeracaoTexto",
          "folha",
          "total",
        ],
        properties: {
          endereco: {
            type: ["string", "null"],
            description:
              "Endereço da OBRA como escrito na folha (rua, avenida, bairro). null se não aparecer.",
          },
          orgao: {
            type: ["string", "null"],
            description:
              "Órgão/prefeitura como escrito na folha, por extenso. null se não aparecer.",
          },
          logoPresente: {
            type: "boolean",
            description: "Há brasão ou logotipo de órgão público na imagem?",
          },
          logoOrgao: {
            type: ["string", "null"],
            description:
              "A quem o brasão pertence, segundo o que está ESCRITO nele ou imediatamente ao lado. null se houver brasão mas não der para atribuir. Não adivinhe pelo desenho.",
          },
          numeracaoTexto: {
            type: ["string", "null"],
            description:
              "O campo de numeração da prancha exatamente como impresso (ex.: '01/11', '1 de 11'). null se não aparecer.",
          },
          folha: {
            type: ["number", "null"],
            description: "Número da folha lido nesse campo. null se ilegível.",
          },
          total: {
            type: ["number", "null"],
            description: "Total de folhas lido nesse campo. null se ilegível.",
          },
        },
      },
    },
  },
} as const;

const INSTRUCOES = `Você lê carimbos (selos) de pranchas de projeto de engenharia.

Para CADA imagem recebida, devolva o que está ESCRITO nela. Nada mais.

- Copie os textos como aparecem. Não corrija, não complete, não traduza.
- Se um campo não estiver visível na imagem, devolva null. Nunca deduza.
- "logoOrgao" é o nome que aparece ESCRITO no brasão ou colado a ele. Se houver
  um brasão mas nenhum nome legível, devolva null — não tente reconhecer o
  desenho.
- Não avalie se algo está certo ou errado. Não opine. Só leia.

A ordem do array de saída deve ser a mesma ordem das imagens recebidas.`;

interface AmostraRecebida {
  label: string;
  imageDataUrl: string;
}

function isImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(value);
}

/** Texto do modelo → leitura, com os buracos virando "" (nunca `undefined`). */
function paraLeitura(
  bruto: Record<string, unknown> | undefined,
  label: string,
): LeituraDoSelo {
  const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const numero = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
  return {
    label,
    endereco: texto(bruto?.endereco),
    orgao: texto(bruto?.orgao),
    logoPresente: bruto?.logoPresente === true,
    logoOrgao: texto(bruto?.logoOrgao),
    numeracaoTexto: texto(bruto?.numeracaoTexto),
    folha: numero(bruto?.folha),
    total: numero(bruto?.total),
  };
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

  const teto = await verificarTetoMensal({
    userId: session.user.id ?? null,
    userEmail: session.user.email ?? null,
  });
  if (teto.estourou) {
    return NextResponse.json({ error: mensagemDeTetoEstourado(teto) }, { status: 402 });
  }

  let amostras: AmostraRecebida[];
  let alvo: AlvoDaConferencia;
  let conversationId: string | null = null;
  try {
    const body = (await req.json()) as {
      amostras?: unknown;
      alvo?: unknown;
      conversationId?: unknown;
    };
    if (!Array.isArray(body.amostras)) throw new Error("amostras ausente");
    amostras = body.amostras
      .map((raw) => raw as { label?: unknown; imageDataUrl?: unknown })
      .filter((a) => isImageDataUrl(a.imageDataUrl))
      .slice(0, MAX_AMOSTRAS)
      .map((a) => ({
        label: typeof a.label === "string" && a.label.trim() ? a.label.trim() : "(sem nome)",
        imageDataUrl: a.imageDataUrl as string,
      }));

    const bruto = body.alvo as { orgao?: unknown; esperado?: unknown } | undefined;
    const orgao = typeof bruto?.orgao === "string" ? bruto.orgao.trim() : "";
    if (!orgao) throw new Error("alvo.orgao ausente");
    alvo = {
      orgao,
      esperado: Array.isArray(bruto?.esperado)
        ? (bruto.esperado as Record<string, unknown>[]).map((e) => ({
            label: typeof e.label === "string" ? e.label : "",
            folha: typeof e.folha === "number" ? e.folha : null,
            total: typeof e.total === "number" ? e.total : null,
          }))
        : [],
    };
    if (typeof body.conversationId === "string") conversationId = body.conversationId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Corpo invalido." },
      { status: 400 },
    );
  }

  if (amostras.length === 0) {
    return NextResponse.json(
      { error: "Nenhuma amostra de selo utilizável." },
      { status: 400 },
    );
  }

  /*
   * A conferência é VISUAL: o brasão não existe no texto extraído. Um provider
   * sem visão devolveria uma leitura vazia e a regra produziria "sem brasão em
   * todas as folhas" — um achado inventado pela configuração, não pelo
   * documento. Melhor dizer que não dá.
   */
  const provider = getAiConfiguration().ldExtraction.primary.provider;
  if (provider !== "openai") {
    return NextResponse.json(
      {
        error:
          "A conferência do selo precisa de um modelo com visão. Aponte NEXODOC_LD_PROVIDER para openai.",
      },
      { status: 503 },
    );
  }

  const model = process.env.NEXODOC_SELO_CHECK_MODEL?.trim() || MODELO_PADRAO;

  let leituras: LeituraDoSelo[];
  let usage = 0;
  try {
    const resultado = await executeOpenAiResponse({
      flow: "ld-extraction",
      model,
      operation: "nexo-selo-identidade",
      userEmail: session.user.email,
      conversationId,
      metadata: { amostras: amostras.length, alvo: alvo.orgao },
      request: {
        model,
        max_output_tokens: 2000,
        reasoning: { effort: "none" },
        instructions: INSTRUCOES,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text" as const,
                text: `${amostras.length} recorte(s) de carimbo, nesta ordem: ${amostras
                  .map((a, i) => `${i + 1}) ${a.label}`)
                  .join("; ")}`,
              },
              ...amostras.map((a) => ({
                type: "input_image" as const,
                image_url: a.imageDataUrl,
                detail: "high" as const,
              })),
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema" as const,
            name: "nexo_selo_identidade",
            strict: true,
            schema,
          },
        },
      },
    });

    const parsed = JSON.parse(resultado.text) as { leituras?: Record<string, unknown>[] };
    /*
     * O rótulo vem da POSIÇÃO, não do que o modelo escreveu: um label
     * alucinado faria a numeração ser conferida contra a folha errada, e o
     * achado apontaria para o arquivo errado — o pior tipo de falso positivo,
     * o que manda o engenheiro procurar defeito onde não há.
     */
    leituras = amostras.map((a, i) => paraLeitura(parsed.leituras?.[i], a.label));
    const bruto = resultado.response as { usage?: { total_tokens?: number } };
    usage = typeof bruto.usage?.total_tokens === "number" ? bruto.usage.total_tokens : 0;
  } catch (err) {
    if (err instanceof SyntaxError) {
      const invalido = createInvalidProviderResponseError();
      return NextResponse.json({ error: invalido.message }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha na conferência do selo." },
      { status: 502 },
    );
  }

  const result = checkSeloIdentity(leituras, alvo);

  return NextResponse.json({ result, leituras, model, usage });
}
