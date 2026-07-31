/**
 * A AMOSTRA da conferência de identidade do selo — lado do cliente.
 *
 * Escolhe QUAIS folhas vão ao modelo de visão e monta o gabarito contra o qual
 * elas serão conferidas. O critério da amostra é o que torna a conferência
 * barata sem torná-la cega:
 *
 *   uma folha por BLOCO, a primeira de cada.
 *
 * Brasão e endereço são do volume inteiro — se o logo está trocado, está
 * trocado em todas as folhas, e olhar 200 páginas para descobrir isso é
 * desperdício. Já a prancha intrusa (de outra obra, de outro projeto) é pega
 * pela conferência DETERMINÍSTICA, que roda sobre todas as folhas e não custa
 * nada. Uma por bloco, e não uma só, porque cada disciplina costuma vir de uma
 * pasta diferente — e é entre pastas que o arquivo errado se mistura.
 *
 * CLIENT-ONLY: recorta o selo com o canvas do browser (`selo-render.ts`).
 */

import { resolveSheetNumbers } from "@/server/nexo/parse-filename";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { SeloIdentityResult, LeituraDoSelo } from "@/server/nexo/selo-identity-core";

import { blocosDasFolhas } from "./blocos";
import { codigoDaFolha, rotuloDoCodigo } from "./disciplina-da-folha";
import type { Folha } from "./folhas";
import { recortarSelo } from "./selo-render";
import { conferirSessao } from "./sessao";

/** Teto de amostras — o mesmo da rota; o custo tem de ser previsível. */
const MAX_AMOSTRAS = 4;

export interface SeloCheckResponse {
  result: SeloIdentityResult;
  leituras: LeituraDoSelo[];
  model: string;
  usage: number;
}

/** Uma folha escolhida para a amostra, já com o que se espera dela. */
interface Escolhida {
  selo: SeloForLd;
  label: string;
  /**
   * O número de folha AUTORITATIVO — do nome do arquivo, reconciliado por
   * ordem de página. É contra ele que "a numeração está correta" se decide.
   */
  folha: number | null;
  /**
   * O total que a leitura de selo já tinha lido NESTA MESMA página.
   *
   * NÃO é o tamanho do bloco. A primeira versão comparava o `/11` impresso no
   * carimbo com o número de pranchas anexadas, e acusava as três folhas de uma
   * amostra de três — o mesmo erro que a conferência determinística acabara de
   * deixar de cometer: o carimbo fala da disciplina inteira, o que está em mãos
   * é só o que subiu. Aqui a comparação é entre DUAS LEITURAS do mesmo campo, e
   * discordância entre elas é sinal de leitura, não de documento.
   */
  total: number | null;
}

/** `arquivo · p.N` — o rótulo que aparece nos achados. */
function rotuloDaFolha(selo: SeloForLd): string {
  const pagina = selo.pageNumber ?? 1;
  return `${selo.fileName} · p.${pagina}`;
}

/** A primeira folha de cada bloco, até o teto, com o que se espera dela. */
export function amostraDosSelos(selos: SeloForLd[]): Escolhida[] {
  if (selos.length === 0) return [];
  const folhas = selos as Folha[];
  const blocos = blocosDasFolhas(folhas, codigoDaFolha, rotuloDoCodigo);
  const resolvidas = resolveSheetNumbers(selos);
  const porId = new Map(folhas.map((f, i) => [f.id, i]));

  const escolhidas: Escolhida[] = [];
  for (const bloco of blocos) {
    if (escolhidas.length >= MAX_AMOSTRAS) break;
    const primeiro = bloco.ids[0];
    const i = primeiro != null ? porId.get(primeiro) : undefined;
    if (i == null) continue;
    escolhidas.push({
      selo: selos[i],
      label: rotuloDaFolha(selos[i]),
      folha: resolvidas[i] ?? null,
      total: selos[i].total ?? null,
    });
  }

  /*
   * Sem bloco nenhum (nada com disciplina lida) a lista sairia vazia e a
   * conferência não teria o que olhar — justamente o volume mais suspeito. Cai
   * na primeira folha.
   */
  if (escolhidas.length === 0) {
    escolhidas.push({
      selo: selos[0],
      label: rotuloDaFolha(selos[0]),
      folha: resolvidas[0] ?? null,
      total: selos[0].total ?? null,
    });
  }
  return escolhidas;
}

/**
 * Roda a conferência de identidade: recorta os selos da amostra e manda ao
 * modelo, que LÊ; o veredito vem das regras, no servidor.
 *
 * `pranchaFiles` são os PDFs retidos. A folha cujo arquivo não estiver mais em
 * mãos é simplesmente pulada — a conferência diz sobre quantas folhas falou, e
 * falar de menos é honesto; inventar um recorte não seria.
 */
export async function conferirIdentidadeDoSelo(args: {
  selos: SeloForLd[];
  pranchaFiles: File[];
  /** A prefeitura DECLARADA para quem o volume vai. */
  orgaoAlvo: string;
  conversationId?: string | null;
}): Promise<SeloCheckResponse> {
  const porNome = new Map(args.pranchaFiles.map((f) => [f.name, f]));
  const escolhidas = amostraDosSelos(args.selos);

  const amostras: { label: string; imageDataUrl: string }[] = [];
  const esperado: { label: string; folha: number | null; total: number | null }[] = [];
  for (const e of escolhidas) {
    const file = porNome.get(e.selo.fileName);
    if (!file) continue;
    try {
      const imageDataUrl = await recortarSelo(file, e.selo.pageNumber ?? 1);
      amostras.push({ label: e.label, imageDataUrl });
      esperado.push({ label: e.label, folha: e.folha, total: e.total });
    } catch {
      // Página ilegível: some da amostra em vez de derrubar a conferência
      // inteira. É o mesmo princípio da leitura de selo.
    }
  }

  if (amostras.length === 0) {
    throw new Error(
      "Nenhuma prancha em mãos para conferir o selo — anexe os PDFs das pranchas.",
    );
  }

  const res = await fetch("/api/nexo/selo-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amostras,
      alvo: { orgao: args.orgaoAlvo, esperado },
      conversationId: args.conversationId ?? null,
    }),
  });
  conferirSessao(res);
  const payload = (await res.json().catch(() => null)) as
    | (SeloCheckResponse & { error?: string })
    | null;
  if (!res.ok || !payload?.result) {
    throw new Error(payload?.error ?? "Falha na conferência do selo.");
  }
  return payload;
}
