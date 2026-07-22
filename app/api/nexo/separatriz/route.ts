import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { generateSeparatrizes } from "@/server/nexo/tools/generate-separatrizes";

export const runtime = "nodejs";

/**
 * Gera UMA folha separatriz (nome da disciplina no meio da página) para entrar no
 * volume, na ordem capa → separatriz → LD → pranchas. Reusa a ferramenta headless.
 */
export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let title: string;
  let codigo: string | undefined;
  let revisao: string | undefined;
  try {
    const body = (await req.json()) as {
      title?: unknown;
      codigo?: unknown;
      revisao?: unknown;
    };
    title = String(body.title ?? "").trim();
    if (!title) throw new Error("title ausente");
    if (typeof body.codigo === "string" && body.codigo.trim()) codigo = body.codigo.trim();
    if (typeof body.revisao === "string" && body.revisao.trim()) revisao = body.revisao.trim();
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  try {
    const result = await generateSeparatrizes({ titles: [title], codigo, revisao, includePdf: true });
    return NextResponse.json({
      pdfError: result.pdfError,
      pdf: result.pdf
        ? { name: result.pdf.name, data: result.pdf.buffer.toString("base64") }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar a separatriz." },
      { status: 400 },
    );
  }
}
