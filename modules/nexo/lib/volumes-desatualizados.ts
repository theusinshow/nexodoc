/**
 * O VOLUME QUE ENVELHECEU — quando uma peça dele foi gerada DEPOIS dele.
 *
 * Núcleo PURO (só `import type`) → testável com node cru:
 * `node scripts/test-nexo-volumes-desatualizados.ts`.
 *
 * O caso que originou isto: o engenheiro montou o volume, baixou, e só no PDF
 * pronto viu o título da LD errado. Pediu a correção, o Nexo corrigiu a LD — e
 * o card do volume seguiu dizendo "Gerado", com a LD velha encadernada dentro.
 * O caminho certo e o errado, indistinguíveis.
 *
 * A assinatura de folhas que o volume já guardava não pega isto: ela descreve o
 * CONJUNTO (folha arrastada, folha removida, tomo redividido), e o título é
 * CONTEÚDO de uma peça. Daí a lista de partes.
 *
 * POR QUE A HORA, e não os parâmetros da peça. Comparar params seria mais
 * preciso — não avisaria quando a peça saiu igual —, mas há dois escritores com
 * formatos diferentes para o payload da LD (o plano de geração grava
 * `{...params, tituloLd, bloco, tomo, folhas}`; a montagem, quando gera a LD de
 * um bloco na hora, grava `{tituloLd, tomo, folhas}`). Comparar dois formatos
 * diferentes deixa AVISO ESCAPAR, que é o defeito que este módulo existe para
 * matar. A hora é uma verdade só. O preço é um falso positivo possível: regerar
 * uma peça e sair conteúdo idêntico marca o volume como velho. Aceito —
 * remontar é barato, e o motivo sai escrito com o nome da peça.
 */
import type { SavedResult } from "../state/conversation-store";

/** Uma peça que entrou no volume, e de quando ela era na hora da montagem. */
export interface ParteDoVolume {
  /** `artifactId` da capa, separatriz ou LD. */
  id: string;
  /** O `generatedAt` daquela peça no instante em que o volume foi montado. */
  em: number;
}

export interface VolumeDesatualizado {
  artifactId: string;
  /** Número do tomo; ausente no volume indiviso. */
  tomo?: number;
  /** "TOMO 02 · METALÚRGICO", "TOMO 02", "Volume · METALÚRGICO" ou "Volume". */
  rotulo: string;
  /** Uma frase por peça envelhecida, com o nome que o engenheiro vê no canvas. */
  motivos: string[];
}

/**
 * A lista que vai para o payload: sem repetição e em ordem de id.
 *
 * A ordem importa porque `estadoDoArtefato` compara payloads por
 * `JSON.stringify` LITERAL — ordem instável faria todo volume nascer pendente,
 * que é a armadilha já documentada em `payload-do-item.ts`. A repetição
 * importa porque num volume de uma disciplina só a mesma LD pode ser coletada
 * pelo caminho do bloco e pelo do volume; guardar a hora MAIOR é o lado seguro
 * (a menor faria o volume nascer velho).
 */
export function ordenarPartes(partes: readonly ParteDoVolume[]): ParteDoVolume[] {
  const porId = new Map<string, number>();
  for (const p of partes) {
    if (!p?.id) continue;
    const atual = porId.get(p.id);
    porId.set(p.id, atual === undefined ? p.em : Math.max(atual, p.em));
  }
  return [...porId.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([id, em]) => ({ id, em }));
}

/**
 * O que DEFINE o volume, separado do que RESULTOU dele.
 *
 * O volume grava `{tomo, folhas, partes, conferencia}` e o card comparava
 * contra `{tomo, folhas}`. Como `estadoDoArtefato` compara por
 * `JSON.stringify` LITERAL, chaves a mais de um lado só significam uma coisa:
 * "pendente" SEMPRE. A moldura âmbar do card de volume — a que deveria gritar
 * "este documento envelheceu" — estava acesa em toda conversa e em todo tomo
 * desde que o volume passou a gravar payload, o que é o mesmo que não gritar.
 *
 * `conferencia` descreve o volume DEPOIS de pronto e `partes` é o registro de
 * quem entrou nele: nenhuma das duas é parâmetro de entrada, e nenhuma pertence
 * à conta do que o originou. Quem julga `partes` é `volumesDesatualizados`.
 */
export function identidadeDoVolume(payload: unknown): {
  tomo: unknown;
  folhas: unknown;
} {
  const p = (payload ?? {}) as { tomo?: unknown; folhas?: unknown };
  return { tomo: p.tomo, folhas: p.folhas };
}

function partesGravadas(r: SavedResult): ParteDoVolume[] | null {
  const partes = (r.payload as { partes?: unknown } | undefined)?.partes;
  if (!Array.isArray(partes)) return null;
  const limpas = partes.filter(
    (p): p is ParteDoVolume =>
      typeof (p as ParteDoVolume)?.id === "string" &&
      typeof (p as ParteDoVolume)?.em === "number",
  );
  return limpas.length > 0 ? limpas : null;
}

function numeroDoTomo(r: SavedResult): number | undefined {
  const tomo = (r.payload as { tomo?: unknown } | undefined)?.tomo;
  return typeof tomo === "number" && tomo > 0 ? tomo : undefined;
}

/** O nome da peça como ele aparece no canvas — "LD METALÚRGICO", "Capa". */
function nomeDaPeca(r: SavedResult): string {
  return r.canvas?.label?.trim() || r.summary?.trim() || r.artifactId;
}

/**
 * O rótulo do volume no card. A disciplina sai do TÍTULO da LD que está dentro
 * dele — o dado que a própria montagem gravou —, nunca de uma segunda derivação
 * a partir dos selos: duas derivações da mesma coisa divergem.
 */
function rotuloDoVolume(
  tomo: number | undefined,
  partes: readonly ParteDoVolume[],
  porId: ReadonlyMap<string, SavedResult>,
): string {
  const base = tomo !== undefined ? `TOMO ${String(tomo).padStart(2, "0")}` : "Volume";
  const ld = partes
    .map((p) => porId.get(p.id))
    .find((r): r is SavedResult => r?.kind === "ld");
  const titulo =
    ld?.canvas?.titulo?.trim() || ld?.canvas?.label?.replace(/^LD\s+/i, "").trim() || "";
  return titulo ? `${base} · ${titulo}` : base;
}

/**
 * Os volumes montados que ficaram para trás.
 *
 * Dois limites, assumidos:
 *
 * - Peça que NASCEU depois (um bloco novo que ganhou LD própria) não é pega
 *   aqui, porque não estava na lista. Mas bloco novo muda o conjunto de folhas,
 *   e a assinatura de folhas — que segue na comparação do card — já pega.
 * - Volume montado ANTES disto existir não tem `partes` e não grita. Marcá-lo
 *   como suspeito acenderia toda conversa antiga para sempre, sem conserto
 *   possível; avisar sempre é o mesmo que não avisar. (É exceção deliberada à
 *   regra de `estadoDoArtefato`, que trata payload ausente como pendente — lá o
 *   aviso TEM conserto: gerar de novo. Aqui não teria.)
 */
export function volumesDesatualizados(
  results: readonly SavedResult[],
): VolumeDesatualizado[] {
  const porId = new Map(results.map((r) => [r.artifactId, r]));
  const velhos: VolumeDesatualizado[] = [];

  for (const r of results) {
    if (r.kind !== "volume") continue;
    const partes = partesGravadas(r);
    if (!partes) continue;

    const motivos: string[] = [];
    for (const parte of partes) {
      const peca = porId.get(parte.id);
      if (!peca) {
        motivos.push(
          `uma peça deste volume (${parte.id}) não está mais nesta conversa`,
        );
        continue;
      }
      // Sem hora dos dois lados não há comparação — e chutar aqui seria acender
      // a marca sem poder provar.
      if (typeof peca.generatedAt !== "number") continue;
      if (peca.generatedAt > parte.em) {
        motivos.push(`${nomeDaPeca(peca)} foi gerada de novo depois deste volume`);
      }
    }

    if (motivos.length === 0) continue;

    const tomo = numeroDoTomo(r);
    velhos.push({
      artifactId: r.artifactId,
      ...(tomo !== undefined ? { tomo } : {}),
      rotulo: rotuloDoVolume(tomo, partes, porId),
      motivos,
    });
  }

  velhos.sort(
    (a, b) => (a.tomo ?? Number.MAX_SAFE_INTEGER) - (b.tomo ?? Number.MAX_SAFE_INTEGER),
  );
  return velhos;
}
