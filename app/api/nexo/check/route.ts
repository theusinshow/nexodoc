import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { runLightCheck } from "@/server/nexo/light-check";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

export const runtime = "nodejs";

/**
 * Conferência leve (light check): porta de qualidade determinística, SEM IA.
 * Recebe os selos lidos das pranchas e confere se pranchas/LD/capa são
 * internamente consistentes (código/obra/revisão/disciplina/sequência).
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
  let templateId: string | undefined;
  /** Bloco (disciplina) de cada selo e os rótulos — calculados no cliente. */
  let blocos: string[] | undefined;
  let rotulos: Record<string, string> | undefined;
  try {
    const body = (await req.json()) as {
      selos?: unknown;
      templateId?: unknown;
      blocos?: unknown;
      rotulos?: unknown;
    };
    if (!Array.isArray(body.selos)) throw new Error("selos ausente");
    selos = body.selos as SeloForLd[];
    if (typeof body.templateId === "string" && body.templateId.trim()) {
      templateId = body.templateId.trim();
    }
    if (Array.isArray(body.blocos)) {
      blocos = body.blocos.map((b) => (typeof b === "string" ? b : ""));
    }
    if (body.rotulos && typeof body.rotulos === "object" && !Array.isArray(body.rotulos)) {
      rotulos = Object.fromEntries(
        Object.entries(body.rotulos as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
  } catch {
    return NextResponse.json({ error: "Corpo invalido." }, { status: 400 });
  }

  const result = runLightCheck(selos, { templateId, blocos, rotulos });

  return NextResponse.json({ result });
}
