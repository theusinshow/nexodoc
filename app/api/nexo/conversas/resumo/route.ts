import { NextResponse } from "next/server";

import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import type { ConversaResumida } from "@/modules/nexo/lib/cartoes-de-projeto";

export const runtime = "nodejs";

/**
 * O RESUMO DE CADA CONVERSA — folhas lidas e tipos de artefato, sem trazer o
 * `data` inteiro.
 *
 * A barra lateral virou uma lista de PROJETOS, e cada cartão precisa dizer o que
 * o projeto tem: "LD CAPA SEP VOL · 203 fl". Esses dois fatos vivem dentro do
 * `data` JSON de cada conversa, junto com as mensagens, os selos e os bytes dos
 * artefatos — e a rota da lista lê só as sete colunas de fora justamente porque
 * puxar o `data` de cem conversas para desenhar a barra seria arrastar megabytes.
 *
 * A SAÍDA É O POSTGRES QUEM MONTA. `jsonb_array_length` e
 * `jsonb_array_elements` derivam a contagem e os tipos DENTRO do banco; o Node
 * recebe uma linha de meia dúzia de campos por conversa. É a diferença entre
 * transportar o documento e transportar a resposta.
 *
 * `resumo` é segmento ESTÁTICO e por isso vence o `[id]` irmão no roteamento.
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

/** O que o Postgres devolve — `folhas` vem como `bigint` em algumas versões. */
type LinhaCrua = {
  id: string;
  title: string;
  folderKey: string | null;
  projectId: string | null;
  projectCode: string;
  projectClient: string;
  tipo: string | null;
  updatedAt: Date;
  auditoriaPendente: boolean;
  folhas: number | bigint;
  kinds: string[] | null;
};

export async function GET() {
  const g = await guarda();
  if (g.erro) return g.erro;
  if (!isDatabaseConfigured()) return NextResponse.json({ conversas: [] });

  try {
    /*
     * `jsonb_typeof` antes de `jsonb_array_length`: o `data` é declaradamente
     * schemaless, e uma conversa gravada antes de o campo existir traz `null`
     * ali — sem a guarda, UMA linha velha derruba a consulta inteira e a barra
     * fica sem projeto nenhum.
     */
    const linhas = await getPrisma().$queryRaw<LinhaCrua[]>`
      SELECT c.id, c.title, c."folderKey", c."projectId", c.tipo, c."updatedAt",
        c."auditoriaPendente",
        /*
         * O código e o cliente vêm do PROJETO, não de uma string derivada no
         * navegador. É por isso que renomear o cliente em /projetos passa a
         * refletir na barra sem migração e sem reprocessar nada.
         */
        COALESCE(p.code, '') AS "projectCode",
        COALESCE(p.client, '') AS "projectClient",
        CASE WHEN jsonb_typeof(c.data->'seloResults') = 'array'
             THEN jsonb_array_length(c.data->'seloResults') ELSE 0 END AS folhas,
        COALESCE((
          SELECT array_agg(DISTINCT r->>'kind')
          FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(c.data->'results') = 'array'
                      THEN c.data->'results' ELSE '[]'::jsonb END) r
          WHERE r->>'kind' IS NOT NULL
        ), ARRAY[]::text[]) AS kinds
      FROM "NexoConversation" c
      LEFT JOIN "Project" p ON p.id = c."projectId"
      WHERE c."userEmail" = ${g.userEmail}
      ORDER BY c."updatedAt" DESC
      LIMIT 300`;

    const conversas: ConversaResumida[] = linhas.map((l) => ({
      id: l.id,
      title: l.title,
      folderKey: l.folderKey,
      projectId: l.projectId,
      projectCode: l.projectCode ?? "",
      projectClient: l.projectClient ?? "",
      tipo: l.tipo,
      updatedAt: l.updatedAt.getTime(),
      auditoriaPendente: l.auditoriaPendente,
      folhas: Number(l.folhas ?? 0),
      kinds: l.kinds ?? [],
    }));

    return NextResponse.json({ conversas });
  } catch (error) {
    console.error("[nexo-resumo] falha ao resumir as conversas", error);
    /*
     * Lista VAZIA e não erro: sem o resumo a barra ainda tem a lista das sete
     * colunas, e uma seção que grita é pior que uma seção que degrada. O
     * `console.error` é onde a falha fica visível para quem investiga.
     */
    return NextResponse.json({ conversas: [] });
  }
}
