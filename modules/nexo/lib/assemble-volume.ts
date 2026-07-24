/**
 * Montagem do volume no cliente (caminho único p/ o chat e o painel dev). Junta
 * as partes JÁ geradas — capa PDF, LD PDF (bytes vindos dos object URLs do
 * artifact-store) e as pranchas originais (`File[]`) recortadas por faixa de
 * página — na ORDEM CANÔNICA (`buildVolumeParts`, puro/testado) e funde via
 * `/api/nexo/volume`. A separatriz é best-effort: se o LibreOffice estiver off,
 * o volume segue sem ela.
 *
 * Extraído de `SelosPanel.montarVolume` para o chat reusar EXATAMENTE o mesmo
 * caminho — nada reimplementado.
 */
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  sheetNumberFromFilename,
  resolveSheetNumbers,
} from "@/server/nexo/parse-filename";
import { buildVolumeParts, type VolumePartSource } from "@/server/nexo/volume-parts";

import {
  postSeparatriz,
  postVolume,
  type VolumeGenResult,
} from "./generate";

/** Lê um File como base64 cru (sem o prefixo data:...;base64,). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsDataURL(file);
  });
}

/** Busca um object URL e devolve o conteúdo em base64 cru (sem duplicar bytes no estado). */
export async function urlToBase64(objectUrl: string): Promise<string> {
  const blob = await (await fetch(objectUrl)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  return btoa(bin);
}

export interface AssembleVolumeInput {
  /** Selos lidos — dão as faixas de página das pranchas (PDF combinado). */
  selos: SeloForLd[];
  /** PDFs originais das pranchas (na ordem do escritório, por nº de folha do nome). */
  pranchaFiles: File[];
  /** Capa em base64 cru (ou null se não gerada). */
  capaPdf64: string | null;
  /** LD em base64 cru (ou null se não gerada). */
  ldPdf64: string | null;
  /** Nome da separatriz; vazio = sem separatriz. Best-effort. */
  separatrizTitle?: string;
  /** Nome do PDF final. */
  fileName?: string;
}

/**
 * Faixas de página de PRANCHA por arquivo, derivadas dos selos: num PDF combinado
 * (capa+LD+pranchas), inclui só as páginas que têm folha resolvida — exclui a
 * capa/LD internas para o volume não duplicar.
 */
function pranchaPagesByFile(selos: SeloForLd[]): Map<string, number[]> {
  const folhas = resolveSheetNumbers(
    selos.map((s) => ({
      fileName: s.fileName,
      pageNumber: s.pageNumber,
      arquivo: s.arquivo,
      folha: s.folha,
    })),
  );
  const byFile = new Map<string, number[]>();
  selos.forEach((s, i) => {
    if (folhas[i] == null) return;
    const page = s.pageNumber ?? 1;
    const arr = byFile.get(s.fileName);
    if (arr) arr.push(page);
    else byFile.set(s.fileName, [page]);
  });
  return byFile;
}

/** Monta o volume final a partir das partes já geradas. */
export async function assembleVolume(
  input: AssembleVolumeInput,
): Promise<VolumeGenResult> {
  const { selos, pranchaFiles, capaPdf64, ldPdf64, separatrizTitle, fileName } = input;

  // Separatriz best-effort — falha (LibreOffice off) → volume segue sem ela.
  let separatriz: VolumePartSource | null = null;
  const sepTitle = separatrizTitle?.trim();
  if (sepTitle) {
    try {
      const sep = await postSeparatriz(sepTitle);
      separatriz = { name: "separatriz.pdf", data: sep.data };
    } catch {
      /* best-effort */
    }
  }

  // Pranchas na ordem do escritório (por nº de folha do nome), recortadas no
  // intervalo de pranchas (exclui capa/LD internas de um PDF combinado).
  const pages = pranchaPagesByFile(selos);
  const ordered = [...pranchaFiles].sort(
    (a, b) =>
      (sheetNumberFromFilename(a.name) ?? 9999) -
      (sheetNumberFromFilename(b.name) ?? 9999),
  );
  const pranchas: VolumePartSource[] = [];
  for (const file of ordered) {
    const data = await fileToBase64(file);
    const range = pages.get(file.name);
    if (range && range.length > 0) {
      pranchas.push({
        name: file.name,
        data,
        startPage: Math.min(...range),
        endPage: Math.max(...range),
      });
    } else {
      pranchas.push({ name: file.name, data });
    }
  }

  const parts = buildVolumeParts({
    capa: capaPdf64 ? { name: "capa.pdf", data: capaPdf64 } : null,
    disciplines: [
      {
        separatriz,
        ld: ldPdf64 ? { name: "ld.pdf", data: ldPdf64 } : null,
        pranchas,
      },
    ],
  });

  return postVolume(parts, { fileName: fileName ?? "volume.pdf" });
}
