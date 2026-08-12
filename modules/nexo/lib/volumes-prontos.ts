/**
 * OS VOLUMES MONTADOS de uma conversa, prontos para baixar de uma vez.
 *
 * Núcleo PURO (só `import type`) → testável com node cru:
 * `node scripts/test-nexo-volumes-prontos.ts`.
 *
 * O "montar todos" existe porque um volume de seis tomos são seis cliques; o
 * "baixar todos" existe pelo mesmo motivo, do outro lado. A diferença é que o
 * download só faz sentido quando o conjunto está COMPLETO: meia entrega é o tipo
 * de erro que ninguém confere antes de mandar para a prefeitura.
 */
import type { SavedResult } from "../state/conversation-store";

const PDF_MIME = "application/pdf";

/** Um volume montado, com o nome que ele terá dentro do ZIP. */
export interface VolumePronto {
  /** Número do tomo, quando o resultado registrou. Usado para ordenar e desempatar. */
  tomo?: number;
  nome: string;
  url: string;
}

function numeroDoTomo(r: SavedResult): number | undefined {
  const payload = r.payload as { tomo?: unknown } | undefined;
  return typeof payload?.tomo === "number" ? payload.tomo : undefined;
}

/**
 * Os PDFs dos volumes montados, em ordem de tomo.
 *
 * Só o arquivo `primary` de cada resultado `kind: "volume"` entra: o card pode
 * anexar outros arquivos ao mesmo resultado, e o volume é o que tem `primary`.
 *
 * Nome repetido não apaga arquivo em silêncio — é a mesma armadilha dos
 * editáveis. Dois tomos podem gerar o mesmo nome quando a nomenclatura não
 * carrega o tomo; o desempate prefixa com `tomo-NN-`, que é o dado que
 * distingue, e só cai no índice quando nem isso existe.
 */
export function volumesProntosDosResultados(results: readonly SavedResult[]): VolumePronto[] {
  const encontrados: VolumePronto[] = [];

  for (const r of results) {
    if (r.kind !== "volume") continue;

    const arquivo = (r.files ?? []).find((f) => f.mime === PDF_MIME && f.primary)
      ?? (r.files ?? []).find((f) => f.mime === PDF_MIME);

    if (!arquivo?.url) continue;

    const tomo = numeroDoTomo(r);
    encontrados.push({ ...(tomo !== undefined ? { tomo } : {}), nome: arquivo.name, url: arquivo.url });
  }

  encontrados.sort((a, b) => (a.tomo ?? Number.MAX_SAFE_INTEGER) - (b.tomo ?? Number.MAX_SAFE_INTEGER));

  const usados = new Set<string>();

  return encontrados.map((v, indice) => {
    if (!usados.has(v.nome)) {
      usados.add(v.nome);
      return v;
    }

    const prefixo = v.tomo !== undefined ? `tomo-${String(v.tomo).padStart(2, "0")}-` : `${indice + 1}-`;
    const nome = `${prefixo}${v.nome}`;
    usados.add(nome);
    return { ...v, nome };
  });
}

/**
 * O conjunto está completo? Só então o download faz sentido.
 *
 * Compara com o número de tomos PLANEJADOS, não com "tem pelo menos um": num
 * volume de seis tomos com quatro montados, baixar os quatro entrega um conjunto
 * incompleto sem dizer que é.
 */
export function todosOsVolumesProntos(prontos: readonly VolumePronto[], totalDeTomos: number): boolean {
  return totalDeTomos > 0 && prontos.length >= totalDeTomos;
}
