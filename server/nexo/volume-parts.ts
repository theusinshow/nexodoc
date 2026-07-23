/**
 * Núcleo PURO da montagem do volume: a ORDEM CANÔNICA das partes do escritório —
 * capa → separatriz → LD → pranchas. SEM imports de runtime (nem alias `@/`), de
 * propósito: assim `node` puro carrega o módulo e o smoke-test (`test:nexo:parts`)
 * roda sem o resolver de módulos. A geração de cada parte (capa/LD/separatriz via
 * rotas, base64 das pranchas) fica no cliente; aqui só ORDENAMOS o que já veio
 * pronto — a ordem é o fato objetivo que precisa ficar travado por teste.
 *
 * Multidisciplina (fluxo central do Nexo): o volume é uma capa ÚNICA seguida de
 * um bloco POR disciplina (separatriz → LD → pranchas da disciplina). Uma só
 * disciplina é o caso degenerado com `disciplines` de tamanho 1.
 */

export type VolumePartRole = "capa" | "separatriz" | "ld" | "prancha";

/**
 * Uma parte do volume no formato de FIO que a rota `/api/nexo/volume` consome:
 * `data` é o PDF em base64 cru (não object URL — o URL é só p/ download/preview).
 * `startPage`/`endPage` recortam o intervalo de pranchas num PDF combinado.
 */
export interface VolumePart {
  role: VolumePartRole;
  name: string;
  data: string;
  startPage?: number;
  endPage?: number;
}

/** Fonte de UMA parte já gerada (capa/separatriz/LD ou uma prancha). */
export interface VolumePartSource {
  /** nome do arquivo/rótulo da parte. */
  name: string;
  /** PDF em base64 cru. */
  data: string;
  /** intervalo (1-based) a incluir; usado só para pranchas de PDF combinado. */
  startPage?: number;
  endPage?: number;
}

/** Bloco de UMA disciplina dentro do volume, na ordem separatriz → LD → pranchas. */
export interface VolumeDisciplineParts {
  separatriz?: VolumePartSource | null;
  ld?: VolumePartSource | null;
  pranchas?: VolumePartSource[];
}

/** Entrada da montagem: a capa do volume (uma) + uma ou mais disciplinas. */
export interface BuildVolumePartsInput {
  /** capa do volume — abre o documento; ausente = volume sem capa. */
  capa?: VolumePartSource | null;
  /** disciplinas na ordem em que entram no volume (>= 1 no fluxo real). */
  disciplines: VolumeDisciplineParts[];
}

/** Anexa uma fonte como parte do papel `role`, ignorando fontes ausentes/vazias. */
function pushPart(
  parts: VolumePart[],
  role: VolumePartRole,
  source: VolumePartSource | null | undefined,
): void {
  if (!source || !source.data) return;
  parts.push({
    role,
    name: source.name,
    data: source.data,
    ...(typeof source.startPage === "number" ? { startPage: source.startPage } : {}),
    ...(typeof source.endPage === "number" ? { endPage: source.endPage } : {}),
  });
}

/**
 * Monta as partes do volume na ORDEM CANÔNICA: capa → (por disciplina:
 * separatriz → LD → pranchas). Partes ausentes (ex.: separatriz best-effort que
 * falhou, LD não gerada) são simplesmente puladas — a ordem relativa das partes
 * presentes é preservada. Função PURA: sem IO, sem `@/`, testável com node cru.
 */
export function buildVolumeParts(input: BuildVolumePartsInput): VolumePart[] {
  const parts: VolumePart[] = [];

  // Capa do volume abre o documento (uma só, mesmo em multidisciplina).
  pushPart(parts, "capa", input.capa);

  for (const disc of input.disciplines) {
    pushPart(parts, "separatriz", disc.separatriz);
    pushPart(parts, "ld", disc.ld);
    for (const prancha of disc.pranchas ?? []) {
      pushPart(parts, "prancha", prancha);
    }
  }

  return parts;
}
