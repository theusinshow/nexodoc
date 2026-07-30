import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { recordNexoArtifacts } from "@/lib/nexo-artifacts";
import { buildSeparatrizesFileName } from "@/lib/separatrizes-file-name";
import { buildSeparatrizOdt } from "@/server/nexo/tools/separatriz-template";
import { convertOdtToPdf } from "@/server/pdf";

export const runtime = "nodejs";

const ODT_MIME = "application/vnd.oasis.opendocument.text";

/**
 * Gera as folhas separatrizes (nome da disciplina no meio da página) para entrar
 * no volume, na ordem capa → separatriz → LD → pranchas. UMA FOLHA POR
 * DISCIPLINA: o volume real tem várias, e gerar uma de cada vez era o que ainda
 * obrigava o engenheiro a abrir a tela `/separatrizes`.
 *
 * Devolve ODT, PDF e ZIP. O ODT importa: é o arquivo editável, para quando o
 * texto precisa de um ajuste que nenhum campo cobre. Sem ele, um detalhe fora do
 * lugar significava refazer a folha na tela antiga.
 */
export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let titulos: string[];
  let codigo = "";
  let revisao = "";
  try {
    const body = (await req.json()) as {
      titulos?: unknown;
      title?: unknown;
      codigo?: unknown;
      revisao?: unknown;
    };
    // `title` (singular) é o contrato antigo, de quando a folha era uma só.
    const brutos = Array.isArray(body.titulos)
      ? body.titulos
      : [body.title].filter((v) => v !== undefined);
    titulos = brutos
      .map((t) => (typeof t === "string" ? t.trim() : ""))
      .filter(Boolean);
    if (titulos.length === 0) throw new Error("titulo ausente");
    if (typeof body.codigo === "string") codigo = body.codigo.trim();
    if (typeof body.revisao === "string") revisao = body.revisao.trim();
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  try {
    // Preenche o TEMPLATE oficial da separatriz e converte p/ PDF.
    const odtBuffer = await buildSeparatrizOdt(titulos);
    const { pdfBuffer, error } = await convertOdtToPdf(odtBuffer);

    // Mesmo nome da tela `/separatrizes` (regra única, `buildSeparatrizesFileName`):
    // sem código o arquivo saía como "separatriz.pdf", sem dizer de que projeto é.
    const odtName = buildSeparatrizesFileName(codigo, revisao, "odt");
    const pdfName = buildSeparatrizesFileName(codigo, revisao, "pdf");
    const zipName = buildSeparatrizesFileName(codigo, revisao, "zip");

    const zip = new JSZip();
    zip.file(odtName, odtBuffer);
    if (pdfBuffer) zip.file(pdfName, pdfBuffer);
    const zipBuffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

    /*
     * As separatrizes geradas entram no HISTÓRICO DO SERVIDOR — a tela
     * /separatrizes nunca registrou nada, então aqui o Nexo passa a registrar o
     * que ela deixava passar. `OTHER` porque o enum de artefatos não tem
     * separatriz; os títulos são o que identifica as folhas (é o texto que
     * aparece no meio de cada página).
     */
    await recordNexoArtifacts({
      user: { email: session.user.email, name: session.user.name },
      module: "separatrizes",
      metadata: {
        artifactRole: "separatriz",
        titulo: titulos[0],
        titulos,
        folhas: titulos.length,
        codigo,
        revisao,
        pdfGerado: Boolean(pdfBuffer),
      },
      files: [
        { kind: "OTHER", fileName: odtName, mimeType: ODT_MIME, data: odtBuffer },
        ...(pdfBuffer
          ? [
              {
                kind: "OTHER" as const,
                fileName: pdfName,
                mimeType: "application/pdf",
                data: pdfBuffer,
              },
            ]
          : []),
      ],
    });

    return NextResponse.json({
      pdfError: error,
      folhas: titulos.length,
      odt: { name: odtName, data: odtBuffer.toString("base64") },
      pdf: pdfBuffer
        ? { name: pdfName, data: pdfBuffer.toString("base64") }
        : null,
      zip: { name: zipName, data: zipBuffer.toString("base64") },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar a separatriz." },
      { status: 400 },
    );
  }
}
