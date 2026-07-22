import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { buildSeparatrizOdt } from "@/server/nexo/tools/separatriz-template";
import { convertOdtToPdf } from "@/server/pdf";

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
  try {
    const body = (await req.json()) as { title?: unknown };
    title = String(body.title ?? "").trim();
    if (!title) throw new Error("title ausente");
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  try {
    // Preenche o TEMPLATE oficial da separatriz e converte p/ PDF.
    const odt = await buildSeparatrizOdt(title);
    const { pdfBuffer, error } = await convertOdtToPdf(odt);
    return NextResponse.json({
      pdfError: error,
      pdf: pdfBuffer
        ? { name: "separatriz.pdf", data: pdfBuffer.toString("base64") }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar a separatriz." },
      { status: 400 },
    );
  }
}
