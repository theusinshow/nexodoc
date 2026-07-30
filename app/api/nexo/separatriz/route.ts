import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { recordNexoArtifacts } from "@/lib/nexo-artifacts";
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

    /*
     * A separatriz gerada entra no HISTÓRICO DO SERVIDOR — a tela
     * /separatrizes nunca registrou nada, então aqui o Nexo passa a registrar
     * o que ela deixava passar. Só quando o PDF saiu: sem LibreOffice não há
     * documento, e registrar mesmo assim seria histórico de coisa que não
     * aconteceu. `OTHER` porque o enum de artefatos não tem separatriz; o
     * título é o que identifica a folha (é ele que aparece no meio da página).
     */
    if (pdfBuffer) {
      await recordNexoArtifacts({
        user: { email: session.user.email, name: session.user.name },
        module: "separatrizes",
        metadata: { artifactRole: "separatriz", titulo: title },
        files: [
          {
            kind: "OTHER",
            fileName: "separatriz.pdf",
            mimeType: "application/pdf",
            data: pdfBuffer,
          },
        ],
      });
    }

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
