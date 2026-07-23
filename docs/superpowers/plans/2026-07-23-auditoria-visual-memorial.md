# Auditoria Visual de Memorial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o núcleo determinístico da vista visual da auditoria de memorial (deriva do `AuditReport` o modelo de grafo do canvas e a posição dos pins), pronto para a camada de UI React Flow consumir quando o PR5 existir.

**Architecture:** Duas funções PURAS em `server/nexo/audit/` — `buildAuditGraph` (report → grafo: páginas, achados, grupos recorrentes) e `locateTermOnPage` (textContent do pdf.js + termo → coordenada do pin). Ambas sem React, sem IO, testáveis com node cru (type-stripping) no mesmo padrão dos `test:nexo:*`. A camada de UI (nós React Flow + `AuditCanvas`) consome esse núcleo e está especificada no Apêndice A, gated pelo PR5.

**Tech Stack:** TypeScript, Node (type-stripping, sem bundler nos testes), `node:assert/strict`. Reuso de `lib/audit-report.ts` (já existente). UI futura: `@xyflow/react` + `react-pdf` (do PR5).

## Global Constraints

- **Motor congelado (C6):** NÃO editar `/api/audit`, `AuditReport`, `runMemorialAudit`, nem `lib/audit-report.ts`. Só **consumir**. Ver `docs/superpowers/specs/2026-07-23-auditoria-visual-memorial-design.md`.
- **Testes rodam com node cru:** import por caminho **relativo com extensão `.ts`**; **nunca** alias `@/` em runtime. `import type` é apagado no strip (por isso importar `lib/audit-report.ts` é seguro — seus únicos imports são `import type`).
- **Determinístico e puro:** sem `Date.now()`/`Math.random()`; ids de grupo derivados de campos ordenados.
- **Reuso, não duplicação:** severidade, veredito e tier vêm de `lib/audit-report.ts` (`classifyFindingImpact`, `getEmissionVerdict`, `classifyFindingTier`), nunca reimplementados.
- **Idioma:** código/comentários em pt-BR, seguindo o padrão do módulo Nexo.

## Prerequisites / gate do PR5

As Tarefas 1 e 2 (Fase 1) **não dependem de nada novo** — construíveis e testáveis hoje.
O Apêndice A (UI) depende do **PR5** da ARQUITETURA.md ter entregue: `@xyflow/react` instalado, o primitivo `ArtifactThumb` (worker do react-pdf) e o `blobRegistry`. Enquanto o PR5 não existir, o Apêndice A fica como contrato de interface — não como tarefas executáveis.

---

## Task 1: `buildAuditGraph` — deriva o modelo do grafo (PURO)

**Files:**
- Create: `server/nexo/audit/build-audit-graph.ts`
- Test: `scripts/test-nexo-audit-graph.ts`
- Modify: `package.json` (adicionar script `test:nexo:audit-graph`)

**Interfaces:**
- Consumes (de `../../lib/audit-report.ts`, já existente):
  - types: `AuditFinding`, `AuditReport`, `EmissionVerdict`, `FindingImpact`, `FindingTier`
  - values: `sortAuditFindings(findings: AuditFinding[]): AuditFinding[]`, `getEmissionVerdict(findings: AuditFinding[]): EmissionVerdict`, `classifyFindingImpact(f: AuditFinding): FindingImpact`, `classifyFindingTier(f: AuditFinding): FindingTier`
- Produces (para a UI do Apêndice A e para o teste):
  - `buildAuditGraph(report: AuditReport): AuditGraph`
  - types `AuditGraph`, `AuditFindingNode`, `AuditPageNode`, `AuditRecurringGroup`, `AuditSeverity`

- [ ] **Step 1: Escrever os testes que falham**

Criar `scripts/test-nexo-audit-graph.ts`:

```ts
/**
 * Smoke-test do buildAuditGraph — deriva o modelo do grafo da auditoria visual
 * a partir do AuditReport. Puro, roda com node cru.
 *
 *   node scripts/test-nexo-audit-graph.ts   (== npm run test:nexo:audit-graph)
 */
import assert from "node:assert/strict";

import { buildAuditGraph } from "../server/nexo/audit/build-audit-graph.ts";
import type { AuditFinding, AuditReport } from "../lib/audit-report.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

function finding(over: Partial<AuditFinding>): AuditFinding {
  return {
    id: "X",
    prioridade: "Media",
    pagina: "1",
    capitulo: "",
    local: "",
    tipo: "generico",
    descricao: "",
    evidencia: "",
    conflito: "",
    sugestao_correcao: "",
    confianca: "alta",
    ...over,
  };
}

function report(findings: AuditFinding[]): AuditReport {
  return {
    tipo_auditoria: "memorial",
    tipo_documento: "memorial",
    obra: "Obra X",
    codigo: "000-00",
    municipio: "Chapecó",
    data_documento: "",
    status_analise: "concluida",
    status_geral: "com pontos de revisão",
    total_incongruencias: findings.length,
    arquivos_analisados: [],
    comparacoes: [],
    incongruencias: findings,
    conclusao: "",
  };
}

test("página vazia/não numérica vai para unplaced", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "não identificada" }),
      finding({ id: "B", pagina: "12" }),
    ]),
  );
  assert.equal(g.unplaced.length, 1);
  assert.equal(g.unplaced[0].id, "A");
  assert.equal(g.findingNodes.length, 1);
  assert.equal(g.findingNodes[0].id, "B");
  assert.equal(g.findingNodes[0].pageNumber, 12);
});

test("severidade mapeada do impacto (identidade -> critico)", () => {
  const g = buildAuditGraph(
    report([finding({ id: "A", pagina: "5", tipo: "Nome da obra divergente" })]),
  );
  assert.equal(g.findingNodes[0].severity, "critico");
});

test("pageNodes agrupa achados por página e ordena", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "40" }),
      finding({ id: "B", pagina: "5" }),
      finding({ id: "C", pagina: "5" }),
    ]),
  );
  assert.deepEqual(
    g.pageNodes.map((p) => p.pageNumber),
    [5, 40],
  );
  assert.deepEqual(g.pageNodes[0].findingIds.sort(), ["B", "C"]);
});

test("recorrente: mesmo tipo + mesma evidência em 3 páginas vira 1 grupo x3", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó" }),
      finding({ id: "B", pagina: "88", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó" }),
      finding({ id: "C", pagina: "140", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 1);
  assert.equal(g.recurringGroups[0].count, 3);
  assert.deepEqual(g.recurringGroups[0].pages, [12, 88, 140]);
  assert.deepEqual(g.recurringGroups[0].findingIds.sort(), ["A", "B", "C"]);
  for (const n of g.findingNodes) {
    assert.equal(n.groupId, g.recurringGroups[0].id);
  }
});

test("recorrente exige >=2 páginas DISTINTAS (mesma página não agrupa)", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "T", evidencia: "mesmo texto" }),
      finding({ id: "B", pagina: "12", tipo: "T", evidencia: "mesmo texto" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 0);
});

test("fallback de similaridade alta junta redações levemente diferentes", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "Obra divergente", evidencia: "obra UBS Central de Chapecó" }),
      finding({ id: "B", pagina: "88", tipo: "Obra divergente", evidencia: "UBS Central de Chapecó unidade" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 1);
  assert.equal(g.recurringGroups[0].count, 2);
});

test("tipos diferentes NÃO agrupam mesmo com evidência parecida", () => {
  const g = buildAuditGraph(
    report([
      finding({ id: "A", pagina: "12", tipo: "Obra divergente", evidencia: "UBS Central" }),
      finding({ id: "B", pagina: "88", tipo: "Norma desatualizada", evidencia: "UBS Central" }),
    ]),
  );
  assert.equal(g.recurringGroups.length, 0);
});

test("verdict vem do getEmissionVerdict (crítico -> NÃO EMITIR)", () => {
  const g = buildAuditGraph(
    report([finding({ id: "A", pagina: "5", tipo: "Nome da obra divergente" })]),
  );
  assert.equal(g.verdict.label, "NÃO EMITIR");
});

test("0 achados -> grafo vazio, verdict LIBERADO", () => {
  const g = buildAuditGraph(report([]));
  assert.equal(g.findingNodes.length, 0);
  assert.equal(g.pageNodes.length, 0);
  assert.equal(g.recurringGroups.length, 0);
  assert.equal(g.verdict.label, "LIBERADO");
});

console.log(`\n${passed} testes ok`);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node scripts/test-nexo-audit-graph.ts`
Expected: FALHA com erro de módulo não encontrado (`server/nexo/audit/build-audit-graph.ts`).

- [ ] **Step 3: Implementar `build-audit-graph.ts`**

Criar `server/nexo/audit/build-audit-graph.ts`:

```ts
import type {
  AuditFinding,
  AuditReport,
  EmissionVerdict,
  FindingImpact,
  FindingTier,
} from "../../lib/audit-report.ts";
import {
  sortAuditFindings,
  getEmissionVerdict,
  classifyFindingImpact,
  classifyFindingTier,
} from "../../lib/audit-report.ts";

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
  const verdict = getEmissionVerdict(principal);

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
```

- [ ] **Step 4: Adicionar o script de teste ao `package.json`**

Em `package.json`, na seção `"scripts"`, ao lado dos outros `test:nexo:*`, adicionar:

```json
"test:nexo:audit-graph": "node scripts/test-nexo-audit-graph.ts",
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `node scripts/test-nexo-audit-graph.ts`
Expected: PASS — todas as linhas `ok`, e `9 testes ok` no fim, exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/nexo/audit/build-audit-graph.ts scripts/test-nexo-audit-graph.ts package.json
git commit -m "Nexo auditoria visual: buildAuditGraph (deriva grafo do AuditReport)"
```

---

## Task 2: `locateTermOnPage` — posição aproximada do pin (PURO)

**Files:**
- Create: `server/nexo/audit/locate-term.ts`
- Test: `scripts/test-nexo-locate-term.ts`
- Modify: `package.json` (adicionar script `test:nexo:locate-term`)

**Interfaces:**
- Consumes: nada externo (puro sobre a entrada).
- Produces:
  - `locateTermOnPage(input: LocateInput): PinPosition | null`
  - types `LocateInput`, `PinPosition`, `TextItem`

- [ ] **Step 1: Escrever os testes que falham**

Criar `scripts/test-nexo-locate-term.ts`:

```ts
/**
 * Smoke-test do locateTermOnPage — acha a posição aproximada de um trecho na
 * camada de texto do pdf.js pra ancorar o pin do erro. Puro, node cru.
 *
 *   node scripts/test-nexo-locate-term.ts   (== npm run test:nexo:locate-term)
 */
import assert from "node:assert/strict";

import { locateTermOnPage } from "../server/nexo/audit/locate-term.ts";
import type { TextItem } from "../server/nexo/audit/locate-term.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

// transform = [a, b, c, d, e, f]; e = x, f = y (origem inferior-esquerda do PDF)
function item(str: string, x: number, y: number): TextItem {
  return { str, transform: [1, 0, 0, 1, x, y], width: str.length * 5, height: 10 };
}

const PAGE = { pageWidth: 600, pageHeight: 800 };

test("acha o item e devolve percentual (y invertido)", () => {
  const items: TextItem[] = [
    item("Cabeçalho do documento", 60, 760),
    item("UBS Central de Chapecó", 120, 400),
  ];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.ok(pos);
  assert.ok(Math.abs(pos!.xPct - 120 / 600) < 0.01);
  // y do PDF é de baixo pra cima; no DOM é de cima pra baixo -> 1 - f/altura
  assert.ok(Math.abs(pos!.yPct - (1 - 400 / 800)) < 0.01);
});

test("busca tolerante a acento/caixa", () => {
  const items = [item("ubs central de chapeco", 100, 200)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.ok(pos);
});

test("casa por prefixo quando o termo é longo", () => {
  const items = [item("Rua das Flores, 123 - Centro, Xanxerê", 90, 300)];
  const pos = locateTermOnPage({
    items,
    ...PAGE,
    termo: "Rua das Flores, 123 - Centro, Xanxerê - SC, CEP 89820-000",
  });
  assert.ok(pos);
});

test("termo não encontrado -> null", () => {
  const items = [item("outro conteúdo qualquer", 10, 10)];
  const pos = locateTermOnPage({ items, ...PAGE, termo: "UBS Central de Chapecó" });
  assert.equal(pos, null);
});

test("termo vazio -> null", () => {
  const items = [item("qualquer", 10, 10)];
  assert.equal(locateTermOnPage({ items, ...PAGE, termo: "" }), null);
});

console.log(`\n${passed} testes ok`);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `node scripts/test-nexo-locate-term.ts`
Expected: FALHA — módulo `server/nexo/audit/locate-term.ts` não encontrado.

- [ ] **Step 3: Implementar `locate-term.ts`**

Criar `server/nexo/audit/locate-term.ts`:

```ts
// Item da camada de texto do pdf.js (subconjunto usado). transform[4]=x,
// transform[5]=y na origem inferior-esquerda do PDF.
export interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

export interface LocateInput {
  items: TextItem[];
  pageWidth: number; // em unidades do PDF (viewport.width)
  pageHeight: number; // em unidades do PDF (viewport.height)
  termo: string;
}

export interface PinPosition {
  xPct: number; // 0..1 a partir da esquerda
  yPct: number; // 0..1 a partir do TOPO (y do PDF já invertido)
}

function norm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// Prefixo significativo do termo pra casar itens curtos da camada de texto
// (a evidência costuma ser mais longa que um item isolado).
function termNeedle(termo: string): string {
  const n = norm(termo);
  const words = n.split(" ").slice(0, 4).join(" ");
  return words.length >= 4 ? words : n;
}

export function locateTermOnPage(input: LocateInput): PinPosition | null {
  const { items, pageWidth, pageHeight, termo } = input;
  const needle = termNeedle(termo);
  if (!needle || pageWidth <= 0 || pageHeight <= 0) return null;

  for (const it of items) {
    const hay = norm(it.str);
    if (!hay) continue;
    if (hay.includes(needle) || needle.includes(hay)) {
      const x = it.transform[4];
      const y = it.transform[5];
      return {
        xPct: clamp01(x / pageWidth),
        yPct: clamp01(1 - y / pageHeight),
      };
    }
  }
  return null;
}
```

- [ ] **Step 4: Adicionar o script de teste ao `package.json`**

Em `package.json`, `"scripts"`, adicionar:

```json
"test:nexo:locate-term": "node scripts/test-nexo-locate-term.ts",
```

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `node scripts/test-nexo-locate-term.ts`
Expected: PASS — `5 testes ok`, exit 0.

- [ ] **Step 6: Commit**

```bash
git add server/nexo/audit/locate-term.ts scripts/test-nexo-locate-term.ts package.json
git commit -m "Nexo auditoria visual: locateTermOnPage (pin via camada de texto)"
```

---

## Apêndice A — Camada de UI (gated no PR5; contrato de interface)

> Não são tarefas executáveis ainda: dependem do PR5 entregar `@xyflow/react`,
> `ArtifactThumb` e `blobRegistry`. Quando o PR5 existir, este apêndice vira um
> plano de tarefas TDD próprio. Registrado aqui para o contrato ficar cravado.

**Contrato que o PR5 precisa expor (o Apêndice consome):**
- `ArtifactThumb`: componente que renderiza a página `pageNumber` de um objectUrl via o worker do react-pdf, com `onReady(textContent, viewport)` para o pin. Props previstas: `{ fileUrl: string; pageNumber: number; width: number; onReady?: (info: { textContent: { items: TextItem[] }; viewport: { width: number; height: number } }) => void; onError?: () => void }`.
- `blobRegistry`: `Map<string, { bytes: ArrayBuffer; url: string }>` fora do React; a UI põe os bytes do memorial e lê o `url` pra render.
- Canvas React Flow já tematizado (dark + glass) com registro de nós custom.

**Componentes a construir (specs; TDD quando virar plano):**
1. `MemorialPageNode` — nó custom: `ArtifactThumb` da página + pins por cima. Ao `onReady`, roda `locateTermOnPage` (Task 2) por achado da página; sem posição → badge no nível da página. Cap de K `<Document>` simultâneos (fila, como o selo). Erro de render → chip com número da página.
2. `FindingCardNode` — card colorido por `severity` (🔴/🟡/⚪) + estilo mais leve quando `tier === "sugestao"`. Edge até a página. Hover acende o par (card↔página), apaga o resto.
3. `RecurringStackNode` — pilha em ciclo contínuo (uma sobre a outra), badge ×`count`, N edges às `pages`. `prefers-reduced-motion` **congela** (estático com ×N); hover **pausa** e expande a lista das ocorrências.
4. `AuditCanvas` — instância React Flow: consome `buildAuditGraph(report)` (Task 1); auto-layout (páginas em linha/grade, achados ao redor, pilhas na margem, cluster "sem página" num canto); cabeçalho fixo com `graph.verdict`; botão "Ver relatório completo" abre o **drawer** reusando `makeTextReport`/`audit-result.tsx`.
5. Wiring de estado: `AuditReport` no estado leve da sessão; bytes do memorial no `blobRegistry`.

**Estados de borda (repetidos do spec, para o plano futuro):** 0 achados → 🟢 nó único; página nula → cluster "Sem página localizada"; termo não achado → badge; render falhou → chip de página; reduced-motion → ciclo congelado; memorial expirado pós-reload → modo "só números de página" + drawer.

---

## Self-Review (feito)

- **Cobertura do spec:** §2 decisões 6/7/8 (recorrentes, agrupamento estrito+fallback, severidade) → Task 1. Decisão 5 (pin) → Task 2. Decisões 1/2/3/4 e §4/§5/§7 (UI, layout, drawer, bordas de render) → Apêndice A (gated PR5). §6 fluxo de dados → Apêndice A wiring. Sem lacuna nas partes construíveis agora.
- **Placeholders:** nenhum nas Tasks 1–2 (código completo). O Apêndice A é explicitamente contrato, não tarefa.
- **Consistência de tipos:** `AuditGraph`/`AuditFindingNode`/`AuditRecurringGroup`/`AuditSeverity` idênticos entre Task 1 e o consumo do Apêndice A; `TextItem`/`PinPosition`/`LocateInput` idênticos entre Task 2 e `MemorialPageNode`. `buildAuditGraph(report)` (o spec citava `report, memorialFile`; o arquivo é só de render na UI, então a função pura recebe só `report` — ajuste registrado).
