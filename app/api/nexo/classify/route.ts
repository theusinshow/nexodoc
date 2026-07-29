import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import {
  classifyDocuments,
  type ClassifyDocumentsInput,
} from "@/server/nexo/classify-documents";

export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB por arquivo, igual a auditoria

export async function POST(req: NextRequest) {
  // Kill-switch: rota inerte com o modulo desligado.
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Maximo de ${MAX_FILES} arquivos por vez.` },
      { status: 400 },
    );
  }
  const tooBig = files.find((f) => f.size > MAX_BYTES);
  if (tooBig) {
    return NextResponse.json(
      { error: `Arquivo "${tooBig.name}" excede 25 MB.` },
      { status: 400 },
    );
  }

  // Caminhos relativos (opcional, de upload de diretorio) enriquecem volume/blocos.
  let relPaths: string[] = [];
  const relRaw = form.get("relPaths");
  if (typeof relRaw === "string") {
    try {
      const parsed = JSON.parse(relRaw);
      if (Array.isArray(parsed)) relPaths = parsed.map((p) => String(p));
    } catch {
      // opcional; ignora se malformada
    }
  }

  // O chamador pode declarar que o arquivo E o memorial, corrigindo o palpite
  // do nome. Sem isso, arquivo fora da convencao volta sem identidade nenhuma.
  const forcarMemorial = form.get("forcarMemorial") === "1";

  const inputs: ClassifyDocumentsInput[] = await Promise.all(
    files.map(async (file, index) => ({
      fileName: file.name,
      buffer: Buffer.from(await file.arrayBuffer()),
      relPath: relPaths[index] || undefined,
      forcarMemorial,
    })),
  );

  try {
    const dossie = await classifyDocuments(inputs);
    return NextResponse.json({ dossie });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao classificar." },
      { status: 500 },
    );
  }
}
