// Helpers de parsing de carimbos (selos) de escritório, compartilhados entre
// `components/ld/ld-workspace.tsx` (módulo original de LD) e
// `server/nexo/build-ld-proposal.ts` (Nexo). São funções puras de string, sem
// dependências de React/DOM — mantenha a lógica idêntica byte a byte.

export function normalizeExtractedValue(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function cleanStampDescription(value: string) {
  const normalized = normalizeExtractedValue(value);

  if (/^(PRANCHA|ARQUIVO)\b/i.test(normalized)) {
    return "";
  }

  return normalized
    .replace(/^\s*(?:CONTE[ÚU]DO|DESCRI[ÇC][ÃA]O)\s*[:\-]?\s*/i, "")
    .replace(
      /\s+(?:IMP|DATA|ESCALA|REV|REVIS[ÃA]O|VISTO|DESENHO|FOLHA|N[°º]?\s*DA\s*FOLHA|PRANCHA|ARQUIVO|RESPONS[ÁA]VEL|CLIENTE|OBRA|FASE|DISCIPLINA)\s*[:\-]?[\s\S]*$/i,
      "",
    )
    .replace(/\s*[,;:\-–—]+\s*$/g, "")
    .trim();
}

// Fallback para carimbos de CAD em grade: os rótulos ("CONTEÚDO:") ficam numa
// célula e os valores em outra, então ao linearizar o texto o valor do CONTEÚDO
// se separa do rótulo e a extração por rótulo falha. Nesses selos o título
// técnico da prancha aparece logo ANTES do código do arquivo (ex.: 040_26_est_
// imp_001_a) e depois do último rótulo do carimbo — é isso que recortamos aqui.
export function extractDescriptionNearFileCode(text: string, fileCode: string) {
  if (!fileCode) {
    return "";
  }

  const normalized = normalizeExtractedValue(text);
  const codePattern = new RegExp(fileCode.replace(/[_\-.]/g, "[ _\\-.]"), "i");
  const match = codePattern.exec(normalized);

  if (!match) {
    return "";
  }

  const before = normalized.slice(0, match.index);
  const boundary =
    /(?:SEDES|OBSERVA[ÇC][ÕO]ES|ENDERE[ÇC]O|CLIENTE|RESPONS[ÁA]VEL\s+T[ÉE]CNICO|VISTO\s+DATA|SECRETARIA)\b/gi;
  let start = 0;
  let boundaryMatch: RegExpExecArray | null;

  while ((boundaryMatch = boundary.exec(before)) !== null) {
    start = boundaryMatch.index + boundaryMatch[0].length;
  }

  // Sem limitador reconhecido, evita puxar a página inteira: usa só o final.
  const candidate = start > 0 ? before.slice(start) : before.slice(-120);

  return cleanStampDescription(candidate);
}
