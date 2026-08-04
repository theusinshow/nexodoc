/**
 * Deriva do AuditReport o modelo de grafo da auditoria visual (a vista de canvas
 * do resultado). PURO: sem React, sem IO, sem relógio — o motor da auditoria
 * está congelado, aqui só se CONSOME o relatório que ele produziu.
 *
 * Severidade, veredito e camada NÃO são reimplementados: vêm de
 * lib/audit-report.ts, os mesmos que a tela textual usa. As duas telas falam do
 * mesmo relatório e não podem divergir.
 */
import type {
  AuditFinding,
  AuditReport,
  EmissionVerdict,
  FindingImpact,
  FindingTier,
} from "../../../lib/audit-report.ts";
import {
  sortAuditFindings,
  getEmissionVerdict,
  classifyFindingImpact,
  classifyFindingTier,
} from "../../../lib/audit-report.ts";

export type AuditSeverity = "critico" | "tecnico" | "editorial";

export interface AuditFindingNode {
  id: string;
  severity: AuditSeverity;
  tier: FindingTier;
  pageNumber: number | null;
  tipo: string;
  evidencia: string;
  sugestao: string;
  termoBusca?: string;
  groupId: string | null;
}

export interface AuditPageNode {
  pageNumber: number;
  findingIds: string[];
}

export interface AuditRecurringGroup {
  id: string;
  severity: AuditSeverity;
  tipo: string;
  findingIds: string[];
  pages: number[];
  count: number;
}

export interface AuditGraph {
  verdict: EmissionVerdict;
  pageNodes: AuditPageNode[];
  findingNodes: AuditFindingNode[]; // achados com página conhecida
  recurringGroups: AuditRecurringGroup[];
  unplaced: AuditFindingNode[]; // achados sem página localizada
}

const SEVERITY_BY_IMPACT: Record<FindingImpact, AuditSeverity> = {
  critico_documental: "critico",
  tecnico_contratual: "tecnico",
  revisao_editorial: "editorial",
};

// Limiar do fallback de similaridade (Jaccard sobre tokens da evidência). Alto
// de propósito: junta variação de redação da IA, não erros diferentes.
const SIMILARITY_THRESHOLD = 0.6;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string): Set<string> {
  return new Set(
    normalizeText(value)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function parsePage(pagina: string): number | null {
  const n = Number.parseInt((pagina ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function severityOf(finding: AuditFinding): AuditSeverity {
  const impact = finding.impacto ?? classifyFindingImpact(finding);
  return SEVERITY_BY_IMPACT[impact];
}

function toNode(finding: AuditFinding, pageNumber: number | null): AuditFindingNode {
  return {
    id: finding.id,
    severity: severityOf(finding),
    tier: classifyFindingTier(finding),
    pageNumber,
    tipo: finding.tipo,
    evidencia: finding.evidencia,
    sugestao: finding.sugestao_correcao,
    termoBusca: finding.termo_busca || finding.evidencia || undefined,
    groupId: null,
  };
}

// Clusteriza achados COLOCADOS (com página) por: mesmo tipo normalizado E
// (evidência normalizada igual OU similaridade Jaccard >= limiar). Greedy: cada
// achado entra no 1º cluster compatível; senão abre um novo.
function clusterPlaced(nodes: AuditFindingNode[]): AuditFindingNode[][] {
  const clusters: { tipo: string; evid: Set<string>; items: AuditFindingNode[] }[] = [];
  for (const node of nodes) {
    const tipoKey = normalizeText(node.tipo);
    const evidTokens = tokens(node.evidencia || node.tipo);
    let placed = false;
    for (const c of clusters) {
      if (c.tipo !== tipoKey) continue;
      if (jaccard(c.evid, evidTokens) >= SIMILARITY_THRESHOLD) {
        c.items.push(node);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push({ tipo: tipoKey, evid: evidTokens, items: [node] });
    }
  }
  return clusters.map((c) => c.items);
}

export function buildAuditGraph(report: AuditReport): AuditGraph {
  const sorted = sortAuditFindings(report.incongruencias);
  const principal = sorted.filter((f) => classifyFindingTier(f) === "principal");
  // Passadas que não completaram rebaixam o veredito ("análise parcial — não use
  // para emitir"). Sem isto o canvas mostraria LIBERADO sobre uma leitura que não
  // aconteceu, justamente o que a tela textual já corrige.
  const verdict = getEmissionVerdict(principal, report.runtime?.passadas_incompletas ?? []);

  const placed: AuditFindingNode[] = [];
  const unplaced: AuditFindingNode[] = [];
  for (const finding of sorted) {
    const page = parsePage(finding.pagina);
    const node = toNode(finding, page);
    if (page === null) unplaced.push(node);
    else placed.push(node);
  }

  // Grupos recorrentes: cluster com >= 2 páginas DISTINTAS.
  const clusters = clusterPlaced(placed);
  const recurringGroups: AuditRecurringGroup[] = [];
  for (const items of clusters) {
    const distinctPages = Array.from(
      new Set(items.map((n) => n.pageNumber as number)),
    ).sort((a, b) => a - b);
    if (distinctPages.length < 2) continue;
    const ids = items.map((n) => n.id).sort();
    const groupId = `grp-${ids[0]}`;
    for (const n of items) n.groupId = groupId;
    recurringGroups.push({
      id: groupId,
      severity: items[0].severity,
      tipo: items[0].tipo,
      findingIds: ids,
      pages: distinctPages,
      count: distinctPages.length,
    });
  }
  recurringGroups.sort((a, b) => a.id.localeCompare(b.id));

  // pageNodes: uma por página distinta, achados ordenados por id.
  const byPage = new Map<number, string[]>();
  for (const node of placed) {
    const list = byPage.get(node.pageNumber as number) ?? [];
    list.push(node.id);
    byPage.set(node.pageNumber as number, list);
  }
  const pageNodes: AuditPageNode[] = Array.from(byPage.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, findingIds]) => ({
      pageNumber,
      findingIds: findingIds.sort(),
    }));

  return { verdict, pageNodes, findingNodes: placed, recurringGroups, unplaced };
}
