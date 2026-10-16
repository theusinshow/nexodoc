import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import { createInvalidProviderResponseError, getAiConfiguration } from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { isNexoEnabled } from "@/lib/feature-flags";
import { suspeitasDoDicionario } from "@/server/nexo/dicionario-pt";
import {
  montarResultadoDaGrafia,
  TETO_DE_CARACTERES,
  type ErroDaIa,
  type JuizoDaSuspeita,
  type LinhaUnica,
  type SuspeitaDoDicionario,
} from "@/server/nexo/grafia-core";

export const runtime = "nodejs";

/**
 * CONFERÊNCIA DE GRAFIA das pranchas (16/10/2026).
 *
 * Recebe as linhas DISTINTAS do texto das pranchas (o navegador já extraiu e
 * tirou a repetição) e devolve os achados no formato da conferência leve.
 *
 * Duas fontes, porque cada uma erra para um lado:
 *
 *   - o DICIONÁRIO (hunspell pt-BR) acha toda palavra que não existe, sempre,
 *     mas aceita "BOXA" (verbo boxar) — o erro que motivou isto;
 *   - a IA lê a frase e acha "QUADRA DE BOXA", mas pode esquecer uma palavra
 *     numa corrida e lembrar na outra.
 *
 * A IA também julga cada suspeita do dicionário (erro, ou nome/termo técnico),
 * que é o que tira marca de equipamento e nome de planta da lista. O veredito
 * — o que vale, com que gravidade — é de `montarResultadoDaGrafia`, puro e
 * testado; a IA só lê.
 */

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["erros", "juizos"],
  properties: {
    erros: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["linha", "errado", "certo", "motivo"],
        properties: {
          linha: { type: "number", description: "O número L da linha onde o erro está." },
          errado: {
            type: "string",
            description: "O trecho errado, COPIADO EXATAMENTE como está na linha (mesmas letras e caixa).",
          },
          certo: { type: "string", description: "Como deveria estar escrito." },
          motivo: { type: "string", description: "Uma frase curta: por que está errado." },
        },
      },
    },
    juizos: {
      type: "array",
      description: "Um juízo para CADA palavra da lista de suspeitas.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["palavra", "erro", "certo"],
        properties: {
          palavra: { type: "string" },
          erro: {
            type: "boolean",
            description:
              "true se é palavra portuguesa escrita errado; false se é nome próprio, marca, termo técnico, estrangeirismo, abreviatura ou nome científico.",
          },
          certo: { type: ["string", "null"], description: "A grafia certa quando erro=true; senão null." },
        },
      },
    },
  },
} as const;

const INSTRUCOES = `Você é revisor de texto de pranchas de projeto de engenharia e arquitetura, em português do Brasil.

Recebe as linhas de texto de um conjunto de pranchas (notas, legendas, títulos, carimbo), uma por linha, numeradas como L1, L2...

Aponte em "erros" toda palavra ESCRITA ERRADO:
- letra trocada, faltando ou sobrando (MAGUEIRA → MANGUEIRA, EXUCUÇÃO → EXECUÇÃO);
- palavra que existe mas é a errada NO CONTEXTO (QUADRA DE BOXA → QUADRA DE BOCHA; CALCADA → CALÇADA numa nota de pavimentação);
- acento ou cedilha faltando ou errado (TUBULACAO → TUBULAÇÃO).

Não aponte:
- siglas, códigos, normas, unidades, cotas, números, nomes de arquivo;
- nomes próprios, marcas, nomes científicos, termos técnicos e estrangeirismos de uso corrente na obra;
- abreviaturas (PAVTO, QUANT, EQUIP);
- estilo, pontuação, concordância, caixa alta.
- linhas marcadas [recuperada]: o texto delas veio de reparo de fonte e os ACENTOS não são confiáveis; ali só aponte erro de LETRA claro.

"errado" tem de ser copiado exatamente como aparece na linha. Na dúvida, não aponte.

Em "juizos", dê um juízo para cada palavra da lista de suspeitas (palavras que o dicionário não conhece).`;

function texto(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function lerLinhas(bruto: unknown): LinhaUnica[] {
  if (!Array.isArray(bruto)) throw new Error("linhas ausente");
  const linhas: LinhaUnica[] = [];
  let usados = 0;
  for (const raw of bruto as Record<string, unknown>[]) {
    const t = texto(raw?.texto).trim();
    if (!t) continue;
    usados += t.length + 1;
    // O navegador já respeita o teto; aqui é só a defesa da rota.
    if (usados > TETO_DE_CARACTERES * 1.1) break;
    const ocorrencias = Array.isArray(raw.ocorrencias)
      ? (raw.ocorrencias as Record<string, unknown>[])
          .map((o) => ({ arquivo: texto(o?.arquivo), pagina: Number(o?.pagina) || 1 }))
          .filter((o) => o.arquivo)
      : [];
    linhas.push({ n: linhas.length + 1, texto: t, recuperada: raw.recuperada === true, ocorrencias });
  }
  return linhas;
}

export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }
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

  let linhas: LinhaUnica[];
  let folhasLidas = 0;
  let folhasTotal = 0;
  let conversationId: string | null = null;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    linhas = lerLinhas(body.linhas);
    folhasTotal = Math.max(0, Number(body.folhasTotal) || 0);
    folhasLidas = Math.min(folhasTotal, Math.max(0, Number(body.folhasLidas) || 0));
    if (typeof body.conversationId === "string") conversationId = body.conversationId;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Corpo invalido." },
      { status: 400 },
    );
  }

  if (linhas.length === 0) {
    return NextResponse.json({
      result: montarResultadoDaGrafia({ linhas, folhasLidas, folhasTotal, erros: [], suspeitas: [], juizos: [] }),
      model: null,
      usage: 0,
    });
  }

  let suspeitas: SuspeitaDoDicionario[];
  try {
    suspeitas = await suspeitasDoDicionario(linhas);
  } catch (err) {
    console.error("[grafia-check] dicionario", err);
    // Sem o dicionário a IA ainda lê tudo: perde-se a rede, não a conferência.
    suspeitas = [];
  }

  const configuracao = getAiConfiguration().volumeConferencia;
  if (configuracao.provider !== "openai") {
    return NextResponse.json(
      { error: "A conferencia de grafia usa o modelo do fluxo volume-conferencia, que tem de ser da OpenAI." },
      { status: 503 },
    );
  }

  const entrada = [
    linhas.map((l) => `L${l.n}${l.recuperada ? " [recuperada]" : ""}: ${l.texto}`).join("\n"),
    suspeitas.length > 0
      ? `SUSPEITAS (fora do dicionário): ${suspeitas.map((s) => s.palavra).join(", ")}`
      : "SUSPEITAS: nenhuma",
  ].join("\n\n");

  let erros: ErroDaIa[] = [];
  let juizos: JuizoDaSuspeita[] = [];
  let model = configuracao.model;
  let usage = 0;
  try {
    const resultado = await executeOpenAiResponse({
      flow: "volume-conferencia",
      model: configuracao.model,
      operation: "nexo-grafia-check",
      userEmail: session.user.email,
      conversationId,
      metadata: { linhas: linhas.length, suspeitas: suspeitas.length },
      request: {
        model: configuracao.model,
        max_output_tokens: 6000,
        reasoning: { effort: "low" },
        instructions: INSTRUCOES,
        input: [{ role: "user", content: [{ type: "input_text" as const, text: entrada }] }],
        text: {
          format: { type: "json_schema" as const, name: "nexo_grafia", strict: true, schema },
        },
      },
    });
    model = resultado.model;
    const parsed = JSON.parse(resultado.text) as { erros?: unknown; juizos?: unknown };
    erros = (Array.isArray(parsed.erros) ? parsed.erros : []).map((e) => {
      const r = e as Record<string, unknown>;
      return { linha: Number(r.linha) || 0, errado: texto(r.errado), certo: texto(r.certo), motivo: texto(r.motivo) };
    });
    juizos = (Array.isArray(parsed.juizos) ? parsed.juizos : []).map((j) => {
      const r = j as Record<string, unknown>;
      return { palavra: texto(r.palavra), erro: r.erro === true, certo: typeof r.certo === "string" ? r.certo : null };
    });
    const bruto = resultado.response as { usage?: { total_tokens?: number } };
    usage = typeof bruto.usage?.total_tokens === "number" ? bruto.usage.total_tokens : 0;
  } catch (err) {
    if (err instanceof SyntaxError) {
      return NextResponse.json({ error: createInvalidProviderResponseError().message }, { status: 502 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha na conferência de grafia." },
      { status: 502 },
    );
  }

  const result = montarResultadoDaGrafia({ linhas, folhasLidas, folhasTotal, erros, suspeitas, juizos });
  return NextResponse.json({ result, model, usage });
}
