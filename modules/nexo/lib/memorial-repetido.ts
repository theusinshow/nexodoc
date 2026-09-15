/**
 * O MESMO MEMORIAL SOLTO DE NOVO.
 *
 * Até 15/09/2026, soltar outra vez o memorial que a conversa já tinha criava um
 * segundo chip, relia o documento e gravava de novo "Anexei o memorial" e "Li as
 * primeiras páginas" — duas rodadas idênticas no histórico (jornada c1).
 *
 * REFINADO EM 15/09/2026 (revisão final da segunda rodada): a primeira regra era
 * só o NOME, e ela quebrava a revisão do memorial — dois PDFs diferentes com o
 * mesmo nome são a regra quando o memorial volta revisado
 * (`use-delta-do-memorial.ts`). A revisão B era ignorada e a auditoria rodava na
 * A. Agora:
 *
 * - repetido = mesmo nome, mesmo tamanho E mesmo sha-256 dos bytes. Não usa
 *   `lastModified`: copiar o arquivo muda a data sem mudar o documento.
 * - mesmo nome com bytes diferentes = REVISÃO: fica no lote, e quem chama troca o
 *   memorial e diz isso.
 *
 * O tamanho vem primeiro porque é de graça; o sha só é calculado quando nome e
 * tamanho batem.
 *
 * REFINADO EM 15/09/2026 (revisão final, segunda rodada): `crypto.subtle` exige
 * HTTPS ou localhost — falta numa sessão de dev aberta pelo IP da rede. Sem
 * fallback, `sha256` lançava, a promessa de `separarMemorialRepetido` rejeitava
 * e `void readSelos(...)` (quem chama) engolia a rejeição: o drop não fazia
 * nada, calado. Sem como confirmar o conteúdo, o lado seguro é tratar como
 * REVISÃO (troca o memorial) e não como repetido — pior um chip extra do que um
 * memorial revisado descartado em silêncio.
 *
 * PURO e sem imports: roda no node cru (`crypto.subtle` é global no node e no
 * navegador, quando existe).
 */
export interface ArquivoComparavel {
  name: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/** Falso fora de HTTPS/localhost — não há como ler o sha-256 dos bytes ali. */
function temSubtleDigest(): boolean {
  return (
    typeof crypto !== "undefined" && typeof crypto.subtle?.digest === "function"
  );
}

async function sha256(arquivo: ArquivoComparavel): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    await arquivo.arrayBuffer(),
  );
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}

export async function separarMemorialRepetido<T extends ArquivoComparavel>(
  pdfs: readonly T[],
  memorialRetido: ArquivoComparavel | null,
): Promise<{ novos: T[]; repetido: string | null; revisao: string | null }> {
  if (!memorialRetido)
    return { novos: [...pdfs], repetido: null, revisao: null };
  const novos: T[] = [];
  let repetido: string | null = null;
  let revisao: string | null = null;
  let shaDoRetido: string | null = null;
  const podeConferirBytes = temSubtleDigest();
  for (const f of pdfs) {
    if (f.name !== memorialRetido.name) {
      novos.push(f);
      continue;
    }
    // Sem `crypto.subtle`, nome e tamanho batendo não bastam para dizer
    // "repetido" — cai direto no `else` abaixo, que é a via da revisão.
    let igual = podeConferirBytes && f.size === memorialRetido.size;
    if (igual) {
      shaDoRetido ??= await sha256(memorialRetido);
      igual = (await sha256(f)) === shaDoRetido;
    }
    if (igual) {
      repetido = f.name;
    } else {
      novos.push(f);
      revisao = f.name;
    }
  }
  return { novos, repetido, revisao };
}
