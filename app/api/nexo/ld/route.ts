import { NextResponse, type NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { saveLdDraft } from "@/lib/ld/ld-draft-store";
import { buildLdProposal, type SeloForLd } from "@/server/nexo/build-ld-proposal";
import { createLD } from "@/server/nexo/tools/create-ld";

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

  let selos: SeloForLd[];
  let tituloLd: string | undefined;
  let numTomos = 1;
  let tomoInicial = 1;
  let tomoAtual = 0;
  let tomoNumero = 0;
  let respeitarOrdem = false;
  let folhasDoTomo: string[] | undefined;
  let referenceTotal: number | undefined;
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
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  if (selos.length === 0) {
    return NextResponse.json({ error: "Nenhum selo informado." }, { status: 400 });
  }

  // Título, tomo específico e divisão em tomos são decisões do engenheiro.
  const proposal = buildLdProposal(selos, {
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
