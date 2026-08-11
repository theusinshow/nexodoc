/**
 * DE QUE TIPO É A CONVERSA — montagem de volume ou auditoria de memorial.
 *
 * Ninguém escolhe: o tipo é DERIVADO do que a conversa produziu. Uma entrada só
 * na sidebar ("Nova conversa") e o tipo decidido pelo que se anexa é melhor que
 * duas portas na frente, porque quem chega não sabe ainda em qual dos dois
 * trabalhos vai cair — e escolher errado na porta é um erro que a pessoa carrega
 * até o fim.
 *
 * Núcleo PURO (só `import type` → testável com node cru:
 * `node scripts/test-nexo-tipo.ts`). Quem chama é o `conversation-store`, na
 * mesma passada em que já deriva `folderKey` e título.
 */
import type { TipoDeTrabalho } from "./nexo-db.ts";

/**
 * O mínimo que a regra lê da conversa. Estrutural de propósito: o snapshot do
 * store cresce toda semana, e repetir a lista de campos aqui só criaria um
 * segundo lugar para esquecer de atualizar.
 */
export interface FatosDoTipo {
  /** Artefatos já gerados. Só o `kind` importa. */
  results?: { kind: string }[];
  /** Auditoria disparada e ainda sem resultado — o fluxo já rodou. */
  auditoriaPendente?: unknown;
  /** Memorial anexado (e classificado, quando tem `dossie`). */
  memorial?: unknown;
  /** Selos lidos das pranchas. Só a contagem importa. */
  seloResults?: unknown[];
}

/** Os `kind` de artefato que só a montagem produz. */
const KINDS_DE_VOLUME = new Set(["ld", "capa", "separatriz", "volume"]);

/** Os `kind` de artefato que só a auditoria produz. */
const KINDS_DE_AUDITORIA = new Set(["auditoria"]);

/**
 * Decide a seção da conversa. A ordem das regras é a ordem do handoff:
 *
 * 1. produziu relatório de auditoria (o fluxo `/api/audit` rodou) → auditoria;
 * 2. produziu volume, capa ou LD → volume;
 * 3. nenhum dos dois, mas há memorial anexado → auditoria; há selos lidos → volume;
 * 4. nada decidiu → volume.
 *
 * A regra 1 vem antes da 2 por assimetria de custo: a auditoria é o trabalho
 * caro e demorado, e uma conversa que auditou E montou é lembrada pela
 * auditoria. `conferencia` não decide nada — ela acontece dentro da montagem.
 */
export function derivarTipoDeTrabalho(fatos: FatosDoTipo): TipoDeTrabalho {
  const kinds = fatos.results?.map((r) => r.kind) ?? [];

  // 01 — o relatório de auditoria existe, ou está a caminho.
  if (kinds.some((k) => KINDS_DE_AUDITORIA.has(k))) return "auditoria";
  if (fatos.auditoriaPendente) return "auditoria";

  // 02 — a montagem entregou documento.
  if (kinds.some((k) => KINDS_DE_VOLUME.has(k))) return "volume";

  // 03 — nada saiu ainda; vale o que ENTROU.
  if (fatos.memorial) return "auditoria";
  if ((fatos.seloResults?.length ?? 0) > 0) return "volume";

  // 04 — conversa ainda sem forma.
  return "volume";
}

/**
 * O tipo de um resumo da lista, com o padrão dos registros antigos aplicado.
 *
 * Existe para o `undefined` virar "volume" num lugar só: espalhar
 * `?? "volume"` pela sidebar é como uma das duas seções acaba discordando da
 * outra sobre onde uma conversa velha mora.
 */
export function tipoDoResumo(resumo: { tipo?: TipoDeTrabalho }): TipoDeTrabalho {
  return resumo.tipo ?? "volume";
}
