import { NextResponse } from "next/server";

import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { ConversaDaPasta } from "@/modules/nexo/lib/conversas-superadas";

export const runtime = "nodejs";

/**
 * O QUE UMA PASTA TEM DE APAGÁVEL — os dados, não o veredito.
 *
 * A regra mora em [[conversas-superadas.ts]], pura e testada em node cru. Esta
 * rota só entrega o que ela precisa: por conversa da pasta, os TIPOS de
 * artefato produzidos e se há auditoria em voo.
 *
 * UMA PASTA POR VEZ, e sob demanda — não é detalhe de tela, é o que torna isto
 * viável. Os artefatos vivem dentro do `data` de cada conversa, e a rota da
 * LISTA lê só as sete colunas de fora justamente para não "arrastar megabytes
 * por nada" ao desenhar a barra lateral. Abrir o JSON de quatro conversas
 * quando alguém pede é barato; de cem, a cada render, não é.
 *
 * `limpeza` é segmento ESTÁTICO e por isso vence o `[id]` irmão no roteamento —
 * não existe conversa com este id.
 */

async function guarda() {
  if (!isNexoEnabled()) {
    return { erro: NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 }) };
  }
  try {
    const actor = await requireActor();
    return { userEmail: actor.email };
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return { erro: negado };
    throw err;
  }
}

/** Os tipos de artefato de uma conversa, sem repetição e sem lixo. */
function kindsDoData(data: unknown): string[] {
  const results = (data as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const vistos = new Set<string>();
  for (const r of results) {
    const kind = (r as { kind?: unknown })?.kind;
    if (typeof kind === "string" && kind.trim()) vistos.add(kind.trim());
  }
  return [...vistos];
}

export async function GET(req: Request) {
  const g = await guarda();
  if (g.erro) return g.erro;
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "sem servidor" }, { status: 404 });
  }

  const url = new URL(req.url);
  /*
   * `pasta` VAZIA é a pasta "Sem pasta", e não "todas as pastas".
   *
   * A distinção importa: um parâmetro ausente lido como "todas" faria a rota
   * abrir o `data` de TODAS as conversas do usuário — exatamente o custo que
   * este desenho existe para evitar. Sem o parâmetro, a resposta é 400.
   */
  if (!url.searchParams.has("pasta")) {
    return NextResponse.json({ error: "informe a pasta" }, { status: 400 });
  }
  const pasta = url.searchParams.get("pasta")?.trim() ?? "";

  try {
    const linhas = await getPrisma().nexoConversation.findMany({
      where: {
        userEmail: g.userEmail,
        folderKey: pasta ? pasta : null,
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        auditoriaPendente: true,
        data: true,
      },
      // Teto de segurança: uma pasta com centenas de conversas é um caso que
      // não existe, e ler todas seria pagar o custo que a rota evita.
      take: 200,
    });

    const conversas: ConversaDaPasta[] = linhas.map((l) => ({
      id: l.id,
      title: l.title,
      updatedAt: l.updatedAt.getTime(),
      kinds: kindsDoData(l.data),
      auditoriaPendente: l.auditoriaPendente,
    }));

    return NextResponse.json({ conversas });
  } catch (error) {
    console.error("[nexo-limpeza] falha ao ler a pasta", error);
    return NextResponse.json({ error: "falha ao ler do servidor" }, { status: 500 });
  }
}
