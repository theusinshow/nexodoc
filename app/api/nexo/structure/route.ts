import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import {
  classifyFilenames,
  type ClassifyNamesInput,
} from "@/server/nexo/classify-documents";

export const runtime = "nodejs";

const MAX_ITEMS = 5000;

/**
 * Classificacao SO por nome (upload de pasta): o browser envia nomes+relPaths,
 * sem subir os PDFs. Monta a estrutura do projeto (volumes/blocos) instantaneo.
 */
export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  let items: ClassifyNamesInput[];
  try {
    const body = (await req.json()) as { items?: unknown };
    if (!Array.isArray(body.items)) throw new Error("items ausente");
    items = body.items
      .map((it) => {
        const o = it as { fileName?: unknown; relPath?: unknown };
        return {
          fileName: String(o.fileName ?? ""),
          relPath: o.relPath ? String(o.relPath) : undefined,
        };
      })
      .filter((it) => it.fileName && /\.pdf$/i.test(it.fileName));
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "Nenhum PDF informado." }, { status: 400 });
  }
  if (items.length > MAX_ITEMS) {
    return NextResponse.json(
      { error: `Maximo de ${MAX_ITEMS} arquivos.` },
      { status: 400 },
    );
  }

  const dossie = classifyFilenames(items);
  return NextResponse.json({ dossie });
}
