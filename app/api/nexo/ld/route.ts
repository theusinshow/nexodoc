import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
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
  try {
    const body = (await req.json()) as {
      selos?: unknown;
      tituloLd?: unknown;
      numTomos?: unknown;
      tomoInicial?: unknown;
      tomoAtual?: unknown;
      tomoNumero?: unknown;
    };
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
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  if (selos.length === 0) {
    return NextResponse.json({ error: "Nenhum selo informado." }, { status: 400 });
  }

  // Título, tomo específico e divisão em tomos são decisões do engenheiro.
  const proposal = buildLdProposal(selos, { numTomos, tomoInicial, tomoAtual, tomoNumero, tituloLd });
  const result = await createLD(proposal.input);

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
