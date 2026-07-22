import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { buildCapaProposal } from "@/server/nexo/build-capa-proposal";
import { generateCovers } from "@/server/nexo/tools/generate-covers";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

export const runtime = "nodejs";

/**
 * Recebe os selos + a prefeitura escolhida, monta a capa da disciplina e gera.
 * Órgão/secretaria/formato de volume vêm do template; obra/fase do selo;
 * código/disciplina/revisão do nome do arquivo. Retorna base64.
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
  let templateId: string;
  let tituloCapa: string | undefined;
  let volume: string | undefined;
  let tomo = 0;
  let mes: string | undefined;
  let ano: string | undefined;
  try {
    const body = (await req.json()) as {
      selos?: unknown;
      templateId?: unknown;
      tituloCapa?: unknown;
      volume?: unknown;
      tomo?: unknown;
      mes?: unknown;
      ano?: unknown;
    };
    if (!Array.isArray(body.selos)) throw new Error("selos ausente");
    if (typeof body.templateId !== "string" || !body.templateId) {
      throw new Error("templateId ausente");
    }
    selos = body.selos as SeloForLd[];
    templateId = body.templateId;
    if (typeof body.tituloCapa === "string" && body.tituloCapa.trim()) {
      tituloCapa = body.tituloCapa.trim();
    }
    if (typeof body.volume === "string" && body.volume.trim()) {
      volume = body.volume.trim();
    }
    if (typeof body.tomo === "number" && Number.isFinite(body.tomo)) {
      tomo = Math.max(0, Math.floor(body.tomo));
    }
    if (typeof body.mes === "string" && body.mes.trim()) mes = body.mes.trim();
    if (typeof body.ano === "string" && body.ano.trim()) ano = body.ano.trim();
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  if (selos.length === 0) {
    return NextResponse.json({ error: "Nenhum selo informado." }, { status: 400 });
  }

  let proposal;
  try {
    proposal = await buildCapaProposal({ selos, templateId, tituloCapa, volume, tomo, mes, ano });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao montar a capa." },
      { status: 400 },
    );
  }

  const result = await generateCovers({
    generalData: proposal.generalData,
    pages: proposal.pages,
  });

  return NextResponse.json({
    resumo: proposal.resumo,
    pdfError: result.pdfError,
    files: {
      odt: { name: result.odt.name, data: result.odt.buffer.toString("base64") },
      pdf: result.pdf
        ? { name: result.pdf.name, data: result.pdf.buffer.toString("base64") }
        : null,
      zip: { name: result.zip.name, data: result.zip.buffer.toString("base64") },
    },
  });
}
