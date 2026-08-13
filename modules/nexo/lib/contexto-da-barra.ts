/**
 * O que a BARRA DO TOPO pode afirmar sobre a obra da conversa.
 *
 * Devolver `null` é resposta, não falha: antes da leitura dos selos não existe
 * obra nenhuma — não há `projectId` no Nexo, e a identidade nasce dos próprios
 * PDFs. Uma faixa dizendo "nenhum documento lido ainda" ocuparia a maior parte
 * do tempo declarando ignorância, que é o defeito que esta barra veio corrigir.
 * Sem obra, a barra não existe.
 *
 * A precedência é a do produto inteiro: engenheiro > carimbo > vazio. Ver
 * [[identidade.ts]].
 *
 * PURO: nenhum import de runtime, para rodar em node pelado no
 * `scripts/test-nexo-contexto-da-barra.ts`.
 */

import type { IdentidadeDoProjeto } from "./identidade.ts";
import type { SeloResult } from "./selo-render.ts";
import { summarizeSelos } from "./agent-context.ts";

export interface ContextoDaBarra {
  /** Nome da obra. É o que faz a barra existir. */
  obra: string;
  /** Órgão/cliente, quando se sabe. */
  orgao?: string;
  /** Código da obra ("063_26") — o mesmo que agrupa a pasta na lateral. */
  codigo?: string;
}

/** Aparado, ou `undefined`. Campo em branco é ausência, não valor. */
function texto(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** O primeiro selo que respondeu por este campo. O carimbo dominante basta. */
function doSelo(
  selos: readonly SeloResult[],
  campo: "obra" | "cliente" | "logoOrgao",
): string | undefined {
  for (const s of selos) {
    const v = texto(s.extraction?.[campo]);
    if (v) return v;
  }
  return undefined;
}

export function contextoDaBarra(entrada: {
  identidade: IdentidadeDoProjeto;
  seloResults: readonly SeloResult[];
}): ContextoDaBarra | null {
  const { identidade, seloResults } = entrada;

  const obra = texto(identidade.obra) ?? doSelo(seloResults, "obra");
  if (!obra) return null;

  /*
   * O brasão é a terceira escolha de propósito: ele diz de quem é o logotipo
   * impresso, que costuma bater com o cliente mas não é o campo do cliente.
   */
  const orgao =
    texto(identidade.orgao) ??
    doSelo(seloResults, "cliente") ??
    doSelo(seloResults, "logoOrgao");

  /*
   * O código é derivado do mesmo jeito que a chave da pasta na lateral
   * (`deriveFolderKey`, no conversation-store): do nome de arquivo dos selos.
   * Repetir a derivação em vez de expor o `folderKey` mantém este módulo puro.
   */
  const codigo =
    texto(identidade.codigo) ??
    (seloResults.length > 0
      ? texto(
          summarizeSelos(
            seloResults.map((r) => ({
              fileName: r.fileName,
              arquivo: r.extraction?.arquivo ?? null,
              disciplina: r.extraction?.disciplina ?? null,
              obra: r.extraction?.obra ?? null,
            })),
          ).codigo,
        )
      : undefined);

  return { obra, ...(orgao ? { orgao } : {}), ...(codigo ? { codigo } : {}) };
}
