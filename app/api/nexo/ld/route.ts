import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { saveLdDraft } from "@/lib/ld/ld-draft-store";
import { buildLdProposal, type SeloForLd } from "@/server/nexo/build-ld-proposal";
import { createLD } from "@/server/nexo/tools/create-ld";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { getTemplateRegistry } from "@/server/templates/registry";
import { casarPrefeituraDoCarimbo } from "@/server/nexo/agent/normalize";
import { carregarEscritorio } from "@/lib/escritorio-config";

export const runtime = "nodejs";

/**
 * Recebe os selos lidos das pranchas, monta a proposta de LD e gera o documento.
 * Retorna os arquivos em base64 (a camada HTTP encoda; as ferramentas dao Buffer).
 */
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

  let selos: SeloForLd[];
  let tituloLd: string | undefined;
  let numTomos = 1;
  let tomoInicial = 1;
  let tomoAtual = 0;
  let tomoNumero = 0;
  let respeitarOrdem = false;
  let folhasDoTomo: string[] | undefined;
  let referenceTotal: number | undefined;
  /** A prefeitura escolhida no card, quando o plano tem capa/separatriz. */
  let templateId = "";
  /** A identidade do projeto corrigida à mão — a MESMA que a capa recebe. */
  const identidade: Record<string, string> = {};
  try {
    const body = (await req.json()) as {
      selos?: unknown;
      tituloLd?: unknown;
      numTomos?: unknown;
      tomoInicial?: unknown;
      tomoAtual?: unknown;
      tomoNumero?: unknown;
      respeitarOrdem?: unknown;
      folhasDoTomo?: unknown;
      referenceTotal?: unknown;
      templateId?: unknown;
    } & Record<string, unknown>;
    if (!Array.isArray(body.selos)) throw new Error("selos ausente");
    selos = body.selos as SeloForLd[];
    if (typeof body.tituloLd === "string" && body.tituloLd.trim()) {
      tituloLd = body.tituloLd.trim();
    }
    if (typeof body.numTomos === "number" && Number.isFinite(body.numTomos)) {
      numTomos = Math.max(1, Math.floor(body.numTomos));
    }
    if (typeof body.tomoInicial === "number" && Number.isFinite(body.tomoInicial)) {
      tomoInicial = Math.max(1, Math.floor(body.tomoInicial));
    }
    if (typeof body.tomoAtual === "number" && Number.isFinite(body.tomoAtual)) {
      tomoAtual = Math.max(0, Math.floor(body.tomoAtual));
    }
    if (typeof body.tomoNumero === "number" && Number.isFinite(body.tomoNumero)) {
      tomoNumero = Math.max(0, Math.floor(body.tomoNumero));
    }
    // Só quando o cliente PEDE: sem isso, o carimbo continua mandando na ordem.
    respeitarOrdem = body.respeitarOrdem === true;
    // A divisão decidida no canvas. Sem isto, o servidor cai na divisão por
    // quantidade e o grupo arrastado à mão não chega ao PDF.
    if (Array.isArray(body.folhasDoTomo)) {
      const ids = body.folhasDoTomo.filter((v): v is string => typeof v === "string");
      if (ids.length > 0) folhasDoTomo = ids;
    }
    // O total de folhas dito à mão. Vence o carimbo — ver `BuildLdOptions`.
    if (
      typeof body.referenceTotal === "number" &&
      Number.isFinite(body.referenceTotal) &&
      body.referenceTotal > 0
    ) {
      referenceTotal = Math.floor(body.referenceTotal);
    }
    // A LD imprime a mesma obra/código/revisão que a capa: a correção vale nas
    // duas, senão os dois documentos do mesmo volume discordam.
    for (const chave of ["orgao", "obra", "fase", "codigo", "revisao"]) {
      const valor = body[chave];
      if (typeof valor === "string" && valor.trim()) identidade[chave] = valor.trim();
    }
    if (typeof body.templateId === "string") templateId = body.templateId.trim();
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  if (selos.length === 0) {
    return NextResponse.json({ error: "Nenhum selo informado." }, { status: 400 });
  }

  /*
   * QUEM ASSINA O RODAPÉ DA LD É A PREFEITURA, e cada uma tem a sua regra.
   *
   * Medido nas 39 LDs entregues de `docs/samples` (31/08/2026):
   *
   *   Criciúma (116-25)  PREFEITURA MUNICIPAL DE CRICIÚMA          10 de 10
   *   Chapecó  (040-26)  SECRETARIA DE DESENV. SUSTENTÁVEL — SEDES
   *   113-22             PMN – Sec. Municipal de Planejamento Urbano
   *
   * O rodapé usava SEMPRE a secretaria lida do carimbo, com a prefeitura só de
   * reserva — regra tirada do 040-26, que é Chapecó. Aplicada a Criciúma, ela
   * imprimia "SECRETARIA DE INFRAESTRUTURA E OBRAS" onde o escritório entrega
   * "PREFEITURA MUNICIPAL DE CRICIÚMA".
   *
   * Quem sabe a regra é o MODELO da prefeitura, e ele já sabia: o `config.json`
   * de Criciúma declara `secretaria: ""` e o de Chapecó declara a dela. Modelo
   * sem secretaria = documento que não imprime secretaria. Nenhum dado novo, um
   * consumidor a mais.
   *
   * O template vem do card quando há capa; sem ele (pedido de "só a LD"), sai do
   * mesmo carimbo, pelo mesmo casamento que a capa usa — senão a LD sozinha
   * voltaria a errar exatamente onde este conserto mira.
   */
  let usarSecretaria = true;
  try {
    const templates = await getTemplateRegistry();
    let modelo = templateId ? templates.find((t) => t.id === templateId) : undefined;
    if (!modelo) {
      const casado = casarPrefeituraDoCarimbo(
        selos,
        templates.map((t) => ({ id: t.id, nome: t.nome })),
        carregarEscritorio(),
      );
      modelo = casado?.resolvedId
        ? templates.find((t) => t.id === casado.resolvedId)
        : undefined;
    }
    // Sem modelo reconhecido, nada muda: continua a regra de antes.
    if (modelo && !modelo.defaults.secretaria.trim()) usarSecretaria = false;
  } catch {
    // Registro de modelos indisponível não pode impedir a LD de sair.
  }

  // Título, tomo específico e divisão em tomos são decisões do engenheiro.
  const proposal = buildLdProposal(selos, {
    usarSecretaria,
    numTomos,
    tomoInicial,
    tomoAtual,
    tomoNumero,
    tituloLd,
    respeitarOrdem,
    folhasDoTomo,
    referenceTotal,
    ...identidade,
  });
  const result = await createLD(proposal.input);

  /*
   * A LD gerada pelo Nexo entra no HISTÓRICO DO SERVIDOR.
   *
   * Até aqui, tudo que o Nexo produzia vivia só no IndexedDB do navegador:
   * trocar de máquina, limpar o navegador ou abrir em outro computador e o
   * trabalho desaparecia. A tela `/ld` sempre gravou em Postgres, com trilha de
   * eventos por usuário — era ela, e não o Nexo, a única persistência real do
   * produto. Isso também deixava o painel `/admin/lds` cego para tudo feito no
   * Nexo, que hoje é o caminho principal.
   *
   * Gravamos DEPOIS de gerar e só quando gerou: um registro de LD que não
   * produziu arquivo seria histórico de coisa que não aconteceu.
   *
   * A falha ao persistir NÃO derruba a resposta. O engenheiro já tem o
   * documento em mãos; perder o download por causa da contabilidade seria
   * trocar o produto pelo registro dele.
   */
  if (result.ok && result.files) {
    const email = session.user.email?.trim().toLowerCase();
    if (email) {
      try {
        await saveLdDraft({
          user: { email, name: session.user.name ?? null },
          payload: {
            ldData: proposal.input.ldData as unknown as Prisma.InputJsonValue,
            rows: proposal.input.rows as unknown as Prisma.InputJsonValue,
            referenceTotal: proposal.input.referenceTotal ?? null,
            uploadedFileCount: selos.length,
            generatedFileNames: [
              result.files.odt.name,
              ...(result.files.pdf ? [result.files.pdf.name] : []),
            ],
            status: "GENERATED",
          },
        });
      } catch (err) {
        console.error(
          `[nexo/ld] LD gerada mas NAO registrada no historico: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }

  return NextResponse.json({
    resumo: proposal.resumo,
    ok: result.ok,
    blockingIssues: result.blockingIssues,
    warnings: result.warnings,
    files: result.files
      ? {
          odt: {
            name: result.files.odt.name,
            data: result.files.odt.buffer.toString("base64"),
          },
          pdf: result.files.pdf
            ? {
                name: result.files.pdf.name,
                data: result.files.pdf.buffer.toString("base64"),
              }
            : null,
          report: result.files.report,
        }
      : null,
  });
}
