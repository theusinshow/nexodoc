import type { AuditFinding } from "@/lib/audit-report";
import type { ExtractedPdf } from "@/lib/pdf-text";

// ---------------------------------------------------------------------------
// Trava anti-alucinação (Fase B).
//
// Todo achado vindo da IA precisa estar ancorado no texto realmente extraído do
// documento. Se o trecho citado não existe no texto, o achado é descartado — é
// o filtro que impede a auditoria de "apontar coisas que não existem".
//
// A comparação é robusta ao ruído do pdfjs: normaliza acento/caixa, colapsa
// espaços E também testa uma forma "sem espaços" (para hifenização/quebra que
// separa palavras, ex.: "serviço" vira "ser viço" na extração).
// Achados de regra (origem === "regra") não passam pela trava: já carregam
// evidência verificada por construção.
// ---------------------------------------------------------------------------

const WINDOW = 24; // tamanho da janela de casamento
const MIN_NEEDLE = 8; // termos menores que isto são genéricos demais para ancorar

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** forma canônica com espaços colapsados */
function normalizeCollapsed(value: string) {
  return stripAccents(value).toLowerCase().replace(/\s+/g, " ").trim();
}

/** forma sem nenhum espaço (robusta a palavras quebradas na extração) */
function normalizeSpaceless(value: string) {
  return stripAccents(value).toLowerCase().replace(/\s+/g, "");
}

type Haystack = { collapsed: string; spaceless: string };

export function buildHaystack(extracted: ExtractedPdf): Haystack {
  return {
    collapsed: normalizeCollapsed(extracted.text),
    spaceless: normalizeSpaceless(extracted.text),
  };
}

/** true se alguma janela do termo aparece no texto (em qualquer das formas) */
function hasWindowMatch(haystack: Haystack, needle: string) {
  const collapsed = normalizeCollapsed(needle);
  const spaceless = normalizeSpaceless(needle);

  if (spaceless.length < MIN_NEEDLE) {
    return false;
  }

  if (collapsed.length <= WINDOW) {
    return haystack.collapsed.includes(collapsed) || haystack.spaceless.includes(spaceless);
  }

  const step = Math.max(1, Math.floor(WINDOW / 2));

  for (let i = 0; i + WINDOW <= spaceless.length; i += step) {
    if (haystack.spaceless.includes(spaceless.slice(i, i + WINDOW))) {
      return true;
    }
  }

  for (let i = 0; i + WINDOW <= collapsed.length; i += step) {
    if (haystack.collapsed.includes(collapsed.slice(i, i + WINDOW))) {
      return true;
    }
  }

  return false;
}

/** um achado está ancorado se o termo de busca OU a evidência existem no texto */
export function isFindingGrounded(finding: AuditFinding, haystack: Haystack) {
  return (
    hasWindowMatch(haystack, finding.termo_busca ?? "") ||
    hasWindowMatch(haystack, finding.evidencia ?? "")
  );
}

// --- Supressão de ruído -----------------------------------------------------

/** achado sobre a MECÂNICA da auditoria (ex.: "o bloco só tem a chamada do
 *  capítulo no sumário"), não um defeito do documento. */
export function isMetaAuditFinding(finding: AuditFinding) {
  const scope = normalizeCollapsed(
    [
      finding.tipo,
      finding.descricao,
      finding.conflito,
      finding.sugestao_correcao,
      finding.referencia_comparada ?? "",
    ].join(" "),
  );

  /*
   * Exceção: divergência REAL entre o sumário e o corpo é defeito do documento,
   * não queixa do pipeline. Vários padrões abaixo ("nao corresponde ao conteudo",
   * "com base no sumario") casavam com ela e a apagavam — foi o que sumiu com o
   * sumário incompatível do 063-26, que era o achado crítico do arquivo.
   * O sinal de que é defeito do documento: o achado compara o índice com os
   * capítulos/páginas do corpo. O sinal de que é queixa do pipeline: o achado
   * fala do que RECEBEU para ler ("trecho auditado", "página auditada", "recorte",
   * "apenas a chamada no sumário"). Na presença de qualquer marcador de mecânica
   * a exceção não vale e a supressão segue valendo.
   */
  const isPipelineComplaint =
    /(trecho|pagina|paginas) auditad/.test(scope) ||
    /chamada no sumario/.test(scope) ||
    /com base (apenas )?no sumario/.test(scope) ||
    /recorte|reprocessar|fornecid|disponibilizar|solicitad/.test(scope) ||
    /nao (e|eh) possivel auditar/.test(scope);

  if (
    !isPipelineComplaint &&
    /(sumario|indice)/.test(scope) &&
    /(capitulo|pagina|corpo|documento real|numeracao)/.test(scope)
  ) {
    return false;
  }

  return (
    /trecho auditado/.test(scope) ||
    /pagina auditada nao contem/.test(scope) ||
    /pagina auditada nao corresponde/.test(scope) ||
    /nao contem o texto tecnico do capitulo/.test(scope) ||
    /nao corresponde ao conteudo tecnico/.test(scope) ||
    /apenas (a|sua) chamada no sumario/.test(scope) ||
    /com base (apenas )?no sumario/.test(scope) ||
    /nao (e|eh) possivel auditar/.test(scope) ||
    /inconsistencia de recorte/.test(scope) ||
    /recorte\/hierarquia/.test(scope) ||
    // sugestão que pede reprocessar/fornecer páginas = queixa do pipeline, não defeito do doc
    /(reprocessar|disponibilizar|fornecer) .{0,50}(recorte|paginas?|capitulo)/.test(scope) ||
    /(trecho|paginas?) (informad[oa]s?|solicitad[oa]s?|fornecid[oa]s?) .{0,50}sumario/.test(scope)
  );
}

function isEditorialType(finding: AuditFinding) {
  const scope = normalizeCollapsed([finding.tipo, finding.categoria ?? "", finding.local].join(" "));
  return /reda|grafia|ortograf|formata|acentua|editorial/.test(scope);
}

/**
 * Palavra quebrada pela extração do pdfjs (ex.: "serviço" vira "ser viço").
 * True quando o termo editorial contém duas palavras adjacentes que, unidas,
 * aparecem como palavra isolada no documento — sinal de artefato, não de erro.
 */
export function isEditorialExtractionArtifact(finding: AuditFinding, haystack: Haystack) {
  if (!isEditorialType(finding)) {
    return false;
  }

  // Aceita fragmentos de 1 letra: o pdfjs costuma quebrar após a 1ª letra
  // ("peças" → "p eças"). A proteção real é o resultado unido (>=5) precisar
  // existir como palavra isolada no documento.
  const term = normalizeCollapsed(finding.termo_busca ?? finding.evidencia ?? "");
  const words = term.split(" ").filter((word) => /^[a-z]+$/.test(word));

  for (let i = 0; i + 1 < words.length; i += 1) {
    const joined = words[i] + words[i + 1];

    if (joined.length >= 5 && new RegExp(`(^|[^a-z])${joined}([^a-z]|$)`).test(haystack.collapsed)) {
      return true;
    }
  }

  return false;
}

export type EvidenceGateResult = {
  kept: AuditFinding[];
  /** descartados por falta de evidência no texto (alucinação) */
  dropped: AuditFinding[];
  /** suprimidos por ruído: meta-achado da auditoria ou artefato de extração */
  suppressed: AuditFinding[];
};

/**
 * Filtra achados de IA: descarta os sem ancoragem no texto (alucinação) e
 * suprime ruído (meta-achado sobre a mecânica da auditoria; typo que é artefato
 * de extração do pdfjs). Achados de regra passam direto.
 */
export function filterGroundedFindings(
  findings: AuditFinding[],
  extracted: ExtractedPdf,
): EvidenceGateResult {
  const haystack = buildHaystack(extracted);
  const kept: AuditFinding[] = [];
  const dropped: AuditFinding[] = [];
  const suppressed: AuditFinding[] = [];

  for (const finding of findings) {
    if (finding.origem === "regra") {
      kept.push(finding);
      continue;
    }

    if (isMetaAuditFinding(finding) || isEditorialExtractionArtifact(finding, haystack)) {
      suppressed.push(finding);
      continue;
    }

    if (isFindingGrounded(finding, haystack)) {
      kept.push(finding);
    } else {
      dropped.push(finding);
    }
  }

  return { kept, dropped, suppressed };
}
