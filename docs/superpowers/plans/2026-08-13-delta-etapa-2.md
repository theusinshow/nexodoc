# Etapa 2 do Delta — Reauditar só o que mudou — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar os 86–95% de texto reaproveitável entre revisões de um memorial em economia real, sem que o parecer resultante fique pior, mais curto ou mais difícil de usar que o de uma auditoria completa.

**Architecture:** Um módulo puro (`lib/audit-reuso.ts`) decide, sem token, quais capítulos vão ao modelo e quais achados são herdados da auditoria anterior. A leitura global passa a receber os capítulos alterados em texto integral mais um mapa comprimido dos iguais, e a emitir uma síntese por capítulo que alimenta a próxima reauditoria. As regras determinísticas e a passada de validação não mudam.

**Tech Stack:** TypeScript, Next.js 16 (App Router), Prisma 7 (Postgres/Neon), OpenAI Responses API, testes em node cru com type-stripping (`node scripts/*.ts`).

## Global Constraints

- **Spec de referência:** `docs/superpowers/specs/2026-08-13-delta-etapa-2-design.md`. Em qualquer divergência, o spec manda.
- **Módulos puros não importam `@/`** no caminho de valor, e usam extensão `.ts` nos imports relativos — é o que permite rodar em node cru (`tsconfig.json` documenta isso). Padrão já seguido por `lib/ai-precos.ts`, `lib/ai-model-name.ts` e `lib/audit-validation-prompt.ts`.
- **Achado de regra (`origem === "regra"`) NUNCA é herdado.** As regras reprocessam o documento novo inteiro sem custo.
- **Achado é mapeado a capítulo por PÁGINA**, nunca pelo campo `capitulo`: "1 - APRESENTAÇÃO" aparece três vezes nos memoriais reais.
- **Erro cai para o lado seguro: gastar, não perder.** Toda dúvida de reancoragem promove o capítulo para releitura.
- **Falta de dado nunca é "nada mudou".** Sem impressão, sem síntese ou com versão do auditor diferente, o caminho barato não existe.
- **Nada de economia silenciosa.** O parecer grava e a tela mostra qual caminho foi usado.
- **Testes rodam com `node scripts/<arquivo>.ts`** e são registrados no `package.json`. Estilo: `node:assert/strict` com o helper `test(nome, fn)` local, como em `scripts/test-nexo-audit-delta.ts`.
- **Commits em português**, na voz do repositório: o que mudou e por quê, com o número medido quando houver.

---

### Task 1: Mapear achado a capítulo, por página

**Files:**
- Create: `lib/audit-reuso.ts`
- Create: `scripts/test-audit-reuso.ts`
- Modify: `package.json` (registrar `test:audit:reuso`)

**Interfaces:**
- Consumes: `CapituloImpresso` de `lib/audit-report.ts` (`{ titulo, startPage, endPage, chars, hash }`), `AuditFinding` de `lib/audit-report.ts`.
- Produces:
  - `paginaDoAchado(pagina: string): number | null`
  - `capituloDoAchado(pagina: string, capitulos: readonly CapituloImpresso[]): CapituloImpresso | null`

- [ ] **Step 1: Write the failing test**

Criar `scripts/test-audit-reuso.ts`:

```ts
/**
 * As decisões de REUSO entre duas revisões do mesmo memorial.
 *
 * Todas determinísticas e sem token: é o módulo que decide o que o modelo vai
 * reler e qual achado sobrevive. Errar aqui é caro dos dois lados — herdar
 * achado com página errada manda o engenheiro para a folha errada; deixar de
 * herdar faz o parecer encolher sem ninguém pedir.
 *
 *   node scripts/test-audit-reuso.ts   (== npm run test:audit:reuso)
 */
import assert from "node:assert/strict";

import { capituloDoAchado, paginaDoAchado } from "../lib/audit-reuso.ts";
import type { CapituloImpresso } from "../lib/audit-report.ts";

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

const cap = (
  titulo: string,
  startPage: number,
  endPage: number,
  hash: string,
): CapituloImpresso => ({ titulo, startPage, endPage, chars: 1000, hash });

// Três capítulos com o MESMO título — a armadilha real destes memoriais.
const CAPITULOS = [
  cap("1 - APRESENTACAO", 1, 3, "h1"),
  cap("2 - ARQUITETURA", 4, 9, "h2"),
  cap("1 - APRESENTACAO", 10, 12, "h3"),
];

test("página simples vira número", () => {
  assert.equal(paginaDoAchado("7"), 7);
  assert.equal(paginaDoAchado(" 12 "), 12);
});

test("página composta usa a primeira — é onde o visor abre", () => {
  assert.equal(paginaDoAchado("11 e 14"), 11);
  assert.equal(paginaDoAchado("pág. 5"), 5);
});

test("página ilegível devolve null, nunca zero", () => {
  assert.equal(paginaDoAchado(""), null);
  assert.equal(paginaDoAchado("não informada"), null);
});

test("achado cai no capítulo cuja FAIXA o contém", () => {
  assert.equal(capituloDoAchado("5", CAPITULOS)?.hash, "h2");
  assert.equal(capituloDoAchado("1", CAPITULOS)?.hash, "h1");
});

test("título repetido não confunde — quem decide é a página", () => {
  // Os capítulos 1 e 3 têm título idêntico; o achado da página 11 pertence ao
  // terceiro, e nenhuma comparação de texto conseguiria distinguir.
  assert.equal(capituloDoAchado("11", CAPITULOS)?.hash, "h3");
});

test("página fora de qualquer faixa devolve null", () => {
  assert.equal(capituloDoAchado("99", CAPITULOS), null);
  assert.equal(capituloDoAchado("", CAPITULOS), null);
});

console.log(`\n${passed} verificações de reuso passaram.`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-audit-reuso.ts`
Expected: FAIL com `ERR_MODULE_NOT_FOUND` apontando `lib/audit-reuso.ts`.

- [ ] **Step 3: Write minimal implementation**

Criar `lib/audit-reuso.ts`:

```ts
/**
 * O QUE SE REAPROVEITA entre duas revisões do mesmo memorial.
 *
 * Puro e sem `@/` no caminho de valor: todas as decisões de reuso são
 * determinísticas e precisam ser testáveis sem gastar token. O modelo só entra
 * para ler o que mudou — quem decide o que mudou é este arquivo.
 */
import type { CapituloImpresso } from "./audit-report.ts";

/**
 * A página de um achado é texto livre no parecer ("7", "11 e 14", "pág. 5").
 * Vale o PRIMEIRO número: é nele que o visor de PDF abre.
 */
export function paginaDoAchado(pagina: string): number | null {
  const m = /\d+/.exec(pagina ?? "");
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * A qual capítulo pertence o achado — POR PÁGINA, nunca pelo campo `capitulo`.
 * O texto do campo é ambíguo: "1 - APRESENTACAO" aparece três vezes nos
 * memoriais reais, e casar por título traria o achado do capítulo errado.
 */
export function capituloDoAchado(
  pagina: string,
  capitulos: readonly CapituloImpresso[],
): CapituloImpresso | null {
  const n = paginaDoAchado(pagina);
  if (n === null) return null;
  return capitulos.find((c) => n >= c.startPage && n <= c.endPage) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-audit-reuso.ts`
Expected: PASS — `6 verificações de reuso passaram.`

- [ ] **Step 5: Registrar o teste**

Em `package.json`, na lista de scripts, ao lado de `"test:ai:precos"`:

```json
    "test:audit:reuso": "node scripts/test-audit-reuso.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/audit-reuso.ts scripts/test-audit-reuso.ts package.json
git commit -m "reuso: o achado encontra o seu capitulo pela pagina, e nao pelo titulo"
```

---

### Task 2: Reancorar pela aritmética do deslocamento

**Files:**
- Modify: `lib/audit-reuso.ts`
- Modify: `scripts/test-audit-reuso.ts`

**Interfaces:**
- Consumes: `capituloDoAchado`, `paginaDoAchado` (Task 1).
- Produces: `reancorarPorAritmetica(pagina: string, antes: CapituloImpresso, agora: CapituloImpresso): number | null`

- [ ] **Step 1: Write the failing test**

Acrescentar ao final de `scripts/test-audit-reuso.ts`, ANTES da linha do `console.log` final, e incluir `reancorarPorAritmetica` no import do topo:

```ts
test("capítulo que andou junto: a página do achado anda o mesmo tanto", () => {
  // Entrou um capítulo antes dele; o capítulo em si é idêntico (mesmo hash) e
  // ocupa o mesmo número de páginas. Tudo depois andou +3.
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 27, "hf");
  assert.equal(reancorarPorAritmetica("21", antes, agora), 24);
  assert.equal(reancorarPorAritmetica("20", antes, agora), 23);
});

test("capítulo parado devolve a mesma página", () => {
  const c = cap("3 - FUNDACOES", 20, 24, "hf");
  assert.equal(reancorarPorAritmetica("22", c, c), 22);
});

test("capítulo que passou a ocupar outro número de páginas NÃO usa aritmética", () => {
  // Mesmo texto, mas as quebras internas mudaram: a soma uniforme mentiria.
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 28, "hf");
  assert.equal(reancorarPorAritmetica("21", antes, agora), null);
});

test("página fora da faixa antiga não é reancorada", () => {
  const antes = cap("3 - FUNDACOES", 20, 24, "hf");
  const agora = cap("3 - FUNDACOES", 23, 27, "hf");
  assert.equal(reancorarPorAritmetica("40", antes, agora), null);
  assert.equal(reancorarPorAritmetica("sem página", antes, agora), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-audit-reuso.ts`
Expected: FAIL com `reancorarPorAritmetica is not a function` (ou erro de import).

- [ ] **Step 3: Write minimal implementation**

Acrescentar a `lib/audit-reuso.ts`:

```ts
/**
 * Capítulo casado por HASH é byte a byte idêntico. Se ele ocupa o mesmo número
 * de páginas antes e agora, tudo dentro dele andou o mesmo tanto, e a âncora é
 * uma soma — sem busca e sem token. É o caso que motivou o projeto: entrou um
 * capítulo no meio e o resto do documento desceu junto.
 *
 * Se o número de páginas MUDOU, as quebras internas se moveram e a soma
 * uniforme mentiria. Devolve `null` para quem chama tentar o caminho seguinte.
 */
export function reancorarPorAritmetica(
  pagina: string,
  antes: CapituloImpresso,
  agora: CapituloImpresso,
): number | null {
  const n = paginaDoAchado(pagina);
  if (n === null) return null;
  if (n < antes.startPage || n > antes.endPage) return null;
  if (agora.endPage - agora.startPage !== antes.endPage - antes.startPage) return null;
  return n + (agora.startPage - antes.startPage);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-audit-reuso.ts`
Expected: PASS — `10 verificações de reuso passaram.`

- [ ] **Step 5: Commit**

```bash
git add lib/audit-reuso.ts scripts/test-audit-reuso.ts
git commit -m "reuso: capitulo identico que andou de lugar reancora por soma, sem busca"
```

---

### Task 3: Reancorar pelo `termo_busca`, quando a aritmética não serve

**Files:**
- Modify: `lib/audit-reuso.ts`
- Modify: `scripts/test-audit-reuso.ts`

**Interfaces:**
- Consumes: `ExtractedPdfPage` de `lib/pdf-text.ts` (`{ page: number; text: string }`).
- Produces: `reancorarPorTermo(termo: string | undefined, paginas: readonly ExtractedPdfPage[]): number | null`

- [ ] **Step 1: Write the failing test**

Acrescentar a `scripts/test-audit-reuso.ts` (e ao import: `reancorarPorTermo`; e `import type { ExtractedPdfPage } from "../lib/pdf-text.ts";`):

```ts
const PAGINAS: ExtractedPdfPage[] = [
  { page: 1, text: "Memorial descritivo da obra." },
  { page: 2, text: "As fundacoes serao em estacas escavadas de 40cm." },
  { page: 3, text: "Concreto  fck   25   MPa para todas as pecas." },
];

test("termo encontrado devolve a página em que está", () => {
  assert.equal(reancorarPorTermo("estacas escavadas", PAGINAS), 2);
});

test("espaço em excesso não impede o encontro", () => {
  // O texto do PDF vem com espaçamento irregular; o termo do achado, não.
  assert.equal(reancorarPorTermo("fck 25 MPa", PAGINAS), 3);
});

test("acento e caixa não impedem o encontro", () => {
  assert.equal(reancorarPorTermo("FUNDAÇÕES SERÃO", PAGINAS), 2);
});

test("termo ausente devolve null — quem chama decide o que fazer", () => {
  assert.equal(reancorarPorTermo("laje nervurada", PAGINAS), null);
  assert.equal(reancorarPorTermo(undefined, PAGINAS), null);
  assert.equal(reancorarPorTermo("   ", PAGINAS), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-audit-reuso.ts`
Expected: FAIL com `reancorarPorTermo is not a function`.

- [ ] **Step 3: Write minimal implementation**

Acrescentar a `lib/audit-reuso.ts` (e ao topo, `import type { ExtractedPdfPage } from "./pdf-text.ts";`):

```ts
/**
 * Normalização para BUSCA — e só para busca. Aqui, ao contrário do hash da
 * impressão digital, tirar acento e caixa é o certo: o termo foi escrito pelo
 * modelo e o texto veio do pdf.js, e os dois divergem em acentuação e
 * espaçamento sem que o trecho seja outro.
 */
function paraBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Onde está o termo no documento NOVO. Usado quando a aritmética não serve —
 * capítulo que passou a ocupar outro número de páginas.
 *
 * Devolve `null` quando não acha: o chamador trata isso promovendo o capítulo
 * para releitura, que é o lado seguro (gastar, não perder).
 */
export function reancorarPorTermo(
  termo: string | undefined,
  paginas: readonly ExtractedPdfPage[],
): number | null {
  const alvo = paraBusca(termo ?? "");
  if (!alvo) return null;
  const encontrada = paginas.find((p) => paraBusca(p.text).includes(alvo));
  return encontrada ? encontrada.page : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-audit-reuso.ts`
Expected: PASS — `14 verificações de reuso passaram.`

- [ ] **Step 5: Commit**

```bash
git add lib/audit-reuso.ts scripts/test-audit-reuso.ts
git commit -m "reuso: quando a soma mente, o termo de busca reancora o achado"
```

---

### Task 4: O plano de reuso — o que ler, o que herdar, o que promover

**Files:**
- Modify: `lib/audit-reuso.ts`
- Modify: `scripts/test-audit-reuso.ts`

**Interfaces:**
- Consumes: `capituloDoAchado`, `reancorarPorAritmetica`, `reancorarPorTermo`; `DeltaDeCapitulos` de `lib/audit-fingerprint.ts`; `AuditFinding`, `CapituloImpresso` de `lib/audit-report.ts`.
- Produces:
  - `export const VERSAO_AUDITOR = 1;`
  - `type PlanoDeReuso = { capitulosParaLer: CapituloImpresso[]; achadosHerdados: AuditFinding[]; hashesHerdados: string[]; promovidos: { titulo: string; motivo: "sem-ancora" }[] }`
  - `planejarReuso(args: { delta: DeltaDeCapitulos; capitulosAntes: readonly CapituloImpresso[]; achadosAntes: readonly AuditFinding[]; paginasAgora: readonly ExtractedPdfPage[]; versaoAnterior?: number }): PlanoDeReuso`

- [ ] **Step 1: Write the failing test**

Acrescentar a `scripts/test-audit-reuso.ts` (imports: `planejarReuso`, `VERSAO_AUDITOR`; e `import type { AuditFinding } from "../lib/audit-report.ts";`):

```ts
const achado = (
  id: string,
  pagina: string,
  origem: "ia" | "regra",
  termo?: string,
): AuditFinding => ({
  id,
  pagina,
  capitulo: "irrelevante",
  local: "",
  tipo: "t",
  descricao: "d",
  evidencia: "e",
  conflito: "c",
  sugestao_correcao: "s",
  prioridade: "Media",
  confianca: "alta",
  origem,
  termo_busca: termo,
});

// Antes: dois capítulos. Agora: entrou um capítulo novo antes do segundo.
const A1 = cap("1 - GENERALIDADES", 1, 3, "hA");
const A2 = cap("2 - FUNDACOES", 4, 8, "hB");
const N1 = cap("1 - GENERALIDADES", 1, 3, "hA");
const NOVO = cap("1.5 - METALICO", 4, 6, "hNOVO");
const N2 = cap("2 - FUNDACOES", 7, 11, "hB");

const DELTA_SIMPLES = {
  iguais: [N1, N2],
  alterados: [],
  novos: [NOVO],
  sumidos: [],
};

test("achado de capítulo igual é herdado com a página reancorada", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO_AUDITOR,
  });
  assert.equal(plano.achadosHerdados.length, 1);
  assert.equal(plano.achadosHerdados[0].pagina, "8"); // 5 + (7-4)
  assert.deepEqual(plano.capitulosParaLer.map((c) => c.hash), ["hNOVO"]);
});

test("achado de REGRA nunca é herdado — as regras reprocessam de graça", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "regra")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO_AUDITOR,
  });
  assert.equal(plano.achadosHerdados.length, 0);
});

test("achado de capítulo que SUMIU não entra no parecer novo", () => {
  const plano = planejarReuso({
    delta: { iguais: [N1], alterados: [], novos: [], sumidos: [A2] },
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO_AUDITOR,
  });
  assert.equal(plano.achadosHerdados.length, 0);
});

test("sem âncora, o capítulo inteiro volta a ser lido", () => {
  // Capítulo igual que passou a ocupar mais páginas (aritmética recusa) e cujo
  // achado não tem termo de busca: não há como reancorar.
  const antes = cap("2 - FUNDACOES", 4, 8, "hB");
  const agora = cap("2 - FUNDACOES", 7, 12, "hB");
  const plano = planejarReuso({
    delta: { iguais: [agora], alterados: [], novos: [], sumidos: [] },
    capitulosAntes: [antes],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO_AUDITOR,
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.deepEqual(plano.capitulosParaLer.map((c) => c.hash), ["hB"]);
  assert.deepEqual(plano.promovidos, [{ titulo: "2 - FUNDACOES", motivo: "sem-ancora" }]);
});

test("versão do auditor diferente: nada é herdado e tudo é lido", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: VERSAO_AUDITOR - 1,
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.equal(plano.capitulosParaLer.length, 3);
  assert.deepEqual(plano.hashesHerdados, []);
});

test("parecer sem versão gravada é tratado como incomparável", () => {
  const plano = planejarReuso({
    delta: DELTA_SIMPLES,
    capitulosAntes: [A1, A2],
    achadosAntes: [achado("INC-1", "5", "ia")],
    paginasAgora: PAGINAS,
    versaoAnterior: undefined,
  });
  assert.equal(plano.achadosHerdados.length, 0);
  assert.equal(plano.capitulosParaLer.length, 3);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-audit-reuso.ts`
Expected: FAIL com `planejarReuso is not a function`.

- [ ] **Step 3: Write minimal implementation**

Acrescentar a `lib/audit-reuso.ts` (e ao topo, `import type { DeltaDeCapitulos } from "./audit-fingerprint.ts";` e `import type { AuditFinding } from "./audit-report.ts";`):

```ts
/**
 * VERSÃO DO AUDITOR. Suba à mão ao mexer no prompt ou no modelo da leitura
 * global: achado herdado foi produzido pelo auditor de ontem, e servi-lo depois
 * de melhorar o prompt é servir leitura vencida. Mesma regra do cache de
 * leitura de selo.
 */
export const VERSAO_AUDITOR = 1;

export type PlanoDeReuso = {
  capitulosParaLer: CapituloImpresso[];
  achadosHerdados: AuditFinding[];
  hashesHerdados: string[];
  promovidos: { titulo: string; motivo: "sem-ancora" }[];
};

/**
 * O que o modelo vai reler e o que sobrevive da auditoria anterior.
 *
 * Ordem das decisões:
 * 1. Versão do auditor diferente (ou ausente) → nada é herdado, tudo é lido.
 * 2. Achado de regra → descartado sempre; as regras reprocessam de graça.
 * 3. Achado de capítulo que sumiu ou que mudou → descartado; o capítulo vai ao
 *    modelo e produz achado fresco.
 * 4. Achado de capítulo igual → reancora por aritmética, depois por termo.
 * 5. Falhou a âncora → o capítulo INTEIRO sai dos iguais e vai para leitura, e
 *    os achados dele são descartados (virão frescos do modelo).
 */
export function planejarReuso(args: {
  delta: DeltaDeCapitulos;
  capitulosAntes: readonly CapituloImpresso[];
  achadosAntes: readonly AuditFinding[];
  paginasAgora: readonly ExtractedPdfPage[];
  versaoAnterior?: number;
}): PlanoDeReuso {
  const mudados = [
    ...args.delta.alterados.map((a) => a.agora),
    ...args.delta.novos,
  ];

  if (args.versaoAnterior !== VERSAO_AUDITOR) {
    return {
      capitulosParaLer: [...args.delta.iguais, ...mudados],
      achadosHerdados: [],
      hashesHerdados: [],
      promovidos: [],
    };
  }

  const antesPorHash = new Map(args.capitulosAntes.map((c) => [c.hash, c]));
  const herdadosPorHash = new Map<string, AuditFinding[]>();
  const semAncora = new Set<string>();

  for (const finding of args.achadosAntes) {
    if (finding.origem === "regra") continue;

    const capAntes = capituloDoAchado(finding.pagina, args.capitulosAntes);
    if (!capAntes) continue;

    const capAgora = args.delta.iguais.find((c) => c.hash === capAntes.hash);
    if (!capAgora) continue; // alterado, novo ou sumido: virá fresco

    const pagina =
      reancorarPorAritmetica(finding.pagina, capAntes, capAgora) ??
      reancorarPorTermo(finding.termo_busca, args.paginasAgora);

    if (pagina === null) {
      semAncora.add(capAgora.hash);
      continue;
    }

    const lista = herdadosPorHash.get(capAgora.hash) ?? [];
    lista.push({ ...finding, pagina: String(pagina) });
    herdadosPorHash.set(capAgora.hash, lista);
  }

  const promovidosCapitulos = args.delta.iguais.filter((c) => semAncora.has(c.hash));
  const iguaisMantidos = args.delta.iguais.filter((c) => !semAncora.has(c.hash));

  return {
    capitulosParaLer: [...mudados, ...promovidosCapitulos],
    achadosHerdados: iguaisMantidos.flatMap((c) => herdadosPorHash.get(c.hash) ?? []),
    hashesHerdados: iguaisMantidos.map((c) => c.hash),
    promovidos: promovidosCapitulos.map((c) => ({
      titulo: c.titulo,
      motivo: "sem-ancora" as const,
    })),
  };
}
```

Nota para quem implementa: `antesPorHash` fica declarado mas não é usado nesta versão — **remova-o** ao escrever, ou o `eslint` reclama.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-audit-reuso.ts`
Expected: PASS — `20 verificações de reuso passaram.`

- [ ] **Step 5: Verificar tipos e lint**

Run: `npx tsc --noEmit && npx eslint lib/audit-reuso.ts scripts/test-audit-reuso.ts`
Expected: sem saída.

- [ ] **Step 6: Commit**

```bash
git add lib/audit-reuso.ts scripts/test-audit-reuso.ts
git commit -m "reuso: o plano diz o que reler e o que herdar, e promove o capitulo sem ancora"
```

---

### Task 5: Gravar a versão do auditor e a síntese no parecer

**Files:**
- Modify: `lib/audit-report.ts` (bloco `runtime`, a partir da linha 81)
- Modify: `app/api/audit/route.ts` (bloco `runtime`, onde hoje se grava `impressao`)

**Interfaces:**
- Consumes: `VERSAO_AUDITOR` de `lib/audit-reuso.ts`.
- Produces: `AuditReport["runtime"]` ganha `versao_auditor?: number`, `sintese?: SinteseDoArquivo[]`, `reauditoria?: {...}`; e o tipo `SinteseDoArquivo = { arquivo: string; capitulos: { hash: string; resumo: string }[] }`.

- [ ] **Step 1: Acrescentar os tipos**

Em `lib/audit-report.ts`, junto de `ImpressaoDoArquivo` (linha 21):

```ts
/**
 * A síntese por capítulo, chaveada pelo HASH — não pelo índice nem pelo título.
 * É o hash que sobrevive a capítulo inserido no meio, e é por hash que o
 * casamento da impressão digital já funciona.
 */
export type SinteseDoArquivo = {
  arquivo: string;
  capitulos: { hash: string; resumo: string }[];
};
```

E dentro de `runtime?: {`:

```ts
    /** Impressão + síntese só são reaproveitáveis pelo auditor da mesma versão. */
    versao_auditor?: number;
    sintese?: SinteseDoArquivo[];
    /**
     * Preenchido só quando a auditoria usou o caminho barato. A ausência dele
     * significa leitura completa — nunca "não sei".
     */
    reauditoria?: {
      base_audit_id: string;
      capitulos_lidos: number;
      capitulos_herdados: number;
      achados_herdados: number;
      promovidos_sem_ancora: string[];
    };
```

- [ ] **Step 2: Gravar a versão em toda auditoria**

Em `app/api/audit/route.ts`, no objeto `runtime`, logo abaixo do bloco `impressao:`:

```ts
        versao_auditor: VERSAO_AUDITOR,
```

E no topo do arquivo, junto dos outros imports de `@/lib`:

```ts
import { VERSAO_AUDITOR } from "@/lib/audit-reuso";
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run --silent test:audit`
Expected: sem erro de tipo; `65 teste(s) passaram.`

- [ ] **Step 4: Commit**

```bash
git add lib/audit-report.ts app/api/audit/route.ts
git commit -m "auditoria: o parecer passa a dizer qual auditor o produziu"
```

---

### Task 6: A leitura global emite a síntese por capítulo

**Files:**
- Modify: `app/api/audit/route.ts` (schema de resposta da global, prompt da global, teto de saída, montagem do `runtime.sintese`)

**Interfaces:**
- Consumes: `impressaoDosCapitulos`, `chunkPdfByChapter`.
- Produces: `runtime.sintese` preenchido em toda auditoria completa.

- [ ] **Step 1: Acrescentar o campo ao schema da resposta global**

No objeto de `json_schema` da leitura global, ao lado de `findings`, acrescentar:

```ts
        sintese: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              capitulo: { type: "string" },
              resumo: { type: "string" },
            },
            required: ["capitulo", "resumo"],
          },
        },
```

E incluir `"sintese"` no array `required` do schema.

- [ ] **Step 2: Pedir a síntese no prompt da global**

No prompt da leitura global, acrescentar antes da descrição do JSON de saída:

```
Além dos achados, devolva em "sintese" UMA LINHA por capítulo do documento, com
as afirmações que prendem o projeto: sistema estrutural, resistências, quem
executa o quê, normas declaradas. Não descreva o assunto do capítulo — registre
o que ele AFIRMA, porque é isso que uma revisão futura vai contradizer. Use o
título do capítulo como está no documento no campo "capitulo".
```

- [ ] **Step 3: Subir o teto de saída**

Localizar o `max_output_tokens` da leitura global e somar folga para a síntese — 148 capítulos × ~40 tokens ≈ 6 000:

```ts
        // +6000 para a síntese por capítulo (até 148 capítulos nos memoriais
        // reais). Sem esta folga, somar uma linha por capítulo faz o JSON
        // truncar — e truncar aqui derruba os ACHADOS junto.
        max_output_tokens: <valor atual> + 6000,
```

- [ ] **Step 4: Casar a síntese com o hash e gravar**

Onde hoje se monta `impressao`, montar também `sintese`. O modelo devolve o título; a chave é o hash, então casa-se por título normalizado contra os capítulos do próprio arquivo:

```ts
        sintese: uploadedFiles.map((file) => {
          const capitulos = impressaoDosCapitulos(chunkPdfByChapter(file.extracted));
          const porTitulo = new Map(
            capitulos.map((c) => [c.titulo.trim().toLowerCase(), c.hash]),
          );
          return {
            arquivo: file.file.name,
            capitulos: (sinteseDoModelo.get(file.file.name) ?? [])
              .map((s) => ({
                hash: porTitulo.get(s.capitulo.trim().toLowerCase()) ?? "",
                resumo: s.resumo,
              }))
              // Título que não casou com capítulo nenhum não vira entrada órfã:
              // síntese sem hash é inútil para o reuso e confundiria a contagem.
              .filter((s) => s.hash),
          };
        }),
```

`sinteseDoModelo` é um `Map<string, {capitulo: string; resumo: string}[]>` por nome de arquivo, preenchido onde o retorno da leitura global já é lido: no mesmo ponto em que `parsed?.findings` é consumido, guarde também `parsed?.sintese`. A leitura global é **best-effort** — quando ela falha, o mapa fica vazio para aquele arquivo e a auditoria segue, exatamente como já acontece com os achados.

O resultado desse casamento título→hash é o `sinteseNovaDoArquivo` usado na Task 8.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run --silent test:audit && npm run --silent test:audit:metrics`
Expected: sem erro; `65 teste(s) passaram.` e `OK — dentro do limiar de qualidade.`

- [ ] **Step 6: Commit**

```bash
git add app/api/audit/route.ts
git commit -m "auditoria: a leitura global passa a deixar o mapa do documento para a proxima revisao"
```

---

### Task 7: O mapa comprimido e o prompt do delta

**Files:**
- Modify: `lib/audit-validation-prompt.ts`
- Create: `scripts/test-audit-mapa.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CapituloImpresso`, `SinteseDoArquivo`.
- Produces: `buildMapaDosIguais(capitulos: readonly CapituloImpresso[], sintese: readonly {hash: string; resumo: string}[]): string`

- [ ] **Step 1: Write the failing test**

Criar `scripts/test-audit-mapa.ts`:

```ts
/**
 * O MAPA COMPRIMIDO dos capítulos que não mudaram.
 *
 * É o que impede a reauditoria barata de ficar cega para contradição entre o
 * capítulo novo e um que ficou parado. A passada de validação NÃO cobre isso —
 * ela só julga candidatos que já existem.
 *
 *   node scripts/test-audit-mapa.ts   (== npm run test:audit:mapa)
 */
import assert from "node:assert/strict";

import { buildMapaDosIguais } from "../lib/audit-validation-prompt.ts";
import type { CapituloImpresso } from "../lib/audit-report.ts";

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

const cap = (titulo: string, startPage: number, endPage: number, hash: string): CapituloImpresso =>
  ({ titulo, startPage, endPage, chars: 100, hash });

test("cada capítulo vira uma linha com título, páginas e resumo", () => {
  const mapa = buildMapaDosIguais(
    [cap("3 - FUNDACOES", 20, 24, "hf")],
    [{ hash: "hf", resumo: "Sapata isolada, fck 25 MPa, executada pela contratada." }],
  );
  assert.match(mapa, /3 - FUNDACOES/);
  assert.match(mapa, /20-24/);
  assert.match(mapa, /Sapata isolada, fck 25 MPa/);
});

test("capítulo sem síntese aparece mesmo assim — a forma do documento importa", () => {
  const mapa = buildMapaDosIguais([cap("4 - HIDRAULICA", 25, 30, "hh")], []);
  assert.match(mapa, /4 - HIDRAULICA/);
  assert.match(mapa, /25-30/);
});

test("sem capítulo nenhum, o mapa é vazio e não vira texto solto no prompt", () => {
  assert.equal(buildMapaDosIguais([], []), "");
});

console.log(`\n${passed} verificações do mapa passaram.`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-audit-mapa.ts`
Expected: FAIL com `buildMapaDosIguais is not a function`.

- [ ] **Step 3: Write minimal implementation**

Acrescentar a `lib/audit-validation-prompt.ts`:

```ts
/**
 * O MAPA COMPRIMIDO dos capítulos que não mudaram, para a reauditoria barata.
 *
 * Mora aqui, ao lado do `buildValidationContext`, porque são irmãos: os dois
 * comprimem o documento para caber num prompt que não pode recebê-lo inteiro.
 *
 * Existe por um motivo só: sem ele, a leitura que recebe apenas o delta não tem
 * como notar que o capítulo novo do metálico contradiz a fundação do capítulo 3.
 * A passada de validação não cobre isso — o prompt dela diz, literalmente, que a
 * tarefa não é procurar erros novos.
 */
export function buildMapaDosIguais(
  capitulos: readonly CapituloImpresso[],
  sintese: readonly { hash: string; resumo: string }[],
): string {
  if (capitulos.length === 0) return "";

  const porHash = new Map(sintese.map((s) => [s.hash, s.resumo]));

  return capitulos
    .map((c) => {
      const resumo = porHash.get(c.hash);
      const cabeca = `${c.titulo || "(sem título)"} [p. ${c.startPage}-${c.endPage}]`;
      return resumo ? `${cabeca}: ${resumo}` : cabeca;
    })
    .join("\n");
}
```

E no topo, `import type { CapituloImpresso } from "./audit-report.ts";`

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-audit-mapa.ts`
Expected: PASS — `3 verificações do mapa passaram.`

- [ ] **Step 5: Registrar o teste**

Em `package.json`:

```json
    "test:audit:mapa": "node scripts/test-audit-mapa.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/audit-validation-prompt.ts scripts/test-audit-mapa.ts package.json
git commit -m "auditoria: o mapa comprimido dos capitulos parados, para a leitura do delta enxergar o conjunto"
```

---

### Task 8: A rota aceita o caminho barato

**Files:**
- Modify: `app/api/audit/route.ts`

**Interfaces:**
- Consumes: `planejarReuso`, `VERSAO_AUDITOR`, `buildMapaDosIguais`, `compararImpressoes`, `impressaoDosCapitulos`, `chunkPdfByChapter`.
- Produces: campo `reusarDe` no `FormData` da rota; `runtime.reauditoria` preenchido.

- [ ] **Step 1: Ler `reusarDe` do FormData**

Junto de onde os outros campos do formulário são lidos:

```ts
  const reusarDe = String(form.get("reusarDe") ?? "").trim();
```

- [ ] **Step 2: Montar o plano quando houver base**

Antes da leitura global, para o arquivo único do memorial:

```ts
  // Declarados FORA do bloco porque as etapas seguintes (prompt, fusão de
  // achados, runtime) precisam deles. Todos null = caminho completo de sempre.
  let planoDeReuso: PlanoDeReuso | null = null;
  let baseDaReauditoria: string | null = null;
  let impressaoBase: ImpressaoDoArquivo | null = null;
  let sinteseBase: SinteseDoArquivo | null = null;

  if (reusarDe && analysisLevel === "deep" && uploadedFiles.length === 1) {
    const anterior = await getPrisma().audit.findFirst({
      where: { id: reusarDe, status: "COMPLETED" },
      select: { id: true, report: true },
    });
    const relatorio = anterior?.report as AuditReport | null;
    const impressaoAnterior = relatorio?.runtime?.impressao?.[0];

    if (anterior && relatorio && impressaoAnterior) {
      const file = uploadedFiles[0];
      const capitulosAgora = impressaoDosCapitulos(chunkPdfByChapter(file.extracted));
      const plano = planejarReuso({
        delta: compararImpressoes(impressaoAnterior.capitulos, capitulosAgora),
        capitulosAntes: impressaoAnterior.capitulos,
        achadosAntes: relatorio.incongruencias ?? [],
        paginasAgora: file.extracted.pages,
        versaoAnterior: relatorio.runtime?.versao_auditor,
      });
      // Plano que manda ler tudo não é reuso: seguir por ele só acrescentaria
      // um mapa redundante ao prompt e uma linha enganosa na tela.
      if (plano.hashesHerdados.length > 0) {
        planoDeReuso = plano;
        baseDaReauditoria = anterior.id;
        impressaoBase = impressaoAnterior;
        sinteseBase = relatorio.runtime?.sintese?.[0] ?? null;
      }
    }
  }
```

- [ ] **Step 3: Alimentar a leitura global com o delta**

Quando `planoDeReuso` existe, a global recebe o texto só dos capítulos a ler mais o mapa. Passar ao construtor do prompt global:

```ts
    textoParaLeitura: planoDeReuso
      ? planoDeReuso.capitulosParaLer
          .map((c) => file.extracted.pages
            .filter((p) => p.page >= c.startPage && p.page <= c.endPage)
            .map((p) => p.text)
            .join("\n"))
          .join("\n\n")
      : buildDocumentContext(file.extracted, analysisLevel),
    mapaDosIguais:
      planoDeReuso && impressaoBase
        ? buildMapaDosIguais(
            impressaoBase.capitulos.filter((c) =>
              planoDeReuso!.hashesHerdados.includes(c.hash),
            ),
            sinteseBase?.capitulos ?? [],
          )
        : "",
```

E no prompt global, quando `mapaDosIguais` não é vazio:

```
CAPÍTULOS QUE NÃO MUDARAM (não estão no texto acima; use-os só para detectar
contradição com o que você está lendo):
${mapaDosIguais}
```

- [ ] **Step 4: Fundir achados e registrar o caminho**

Onde os achados são reunidos antes da validação, acrescentar os herdados; e no `runtime`:

```ts
        reauditoria: planoDeReuso && baseDaReauditoria
          ? {
              base_audit_id: baseDaReauditoria,
              capitulos_lidos: planoDeReuso.capitulosParaLer.length,
              capitulos_herdados: planoDeReuso.hashesHerdados.length,
              achados_herdados: planoDeReuso.achadosHerdados.length,
              promovidos_sem_ancora: planoDeReuso.promovidos.map((p) => p.titulo),
            }
          : undefined,
```

- [ ] **Step 5: Copiar a síntese dos capítulos herdados**

Numa reauditoria barata a leitura global só produz síntese dos capítulos que leu. A dos herdados vem do parecer anterior — sem isso, a **terceira** auditoria do mesmo memorial fica sem mapa e o benefício dura uma rodada só.

Onde a `sintese` é montada (Task 6, Step 4), quando `planoDeReuso` existe, fundir antes de gravar:

```ts
        // A síntese nova cobre só o que foi lido; a dos capítulos herdados vem
        // do parecer anterior, pelo hash. Sem esta fusão o mapa se perde na
        // rodada seguinte, e a terceira auditoria volta a ler tudo.
        const sinteseFundida = planoDeReuso
          ? [
              ...(sinteseBase?.capitulos ?? []).filter((s) =>
                planoDeReuso!.hashesHerdados.includes(s.hash),
              ),
              ...sinteseNovaDoArquivo,
            ]
          : sinteseNovaDoArquivo;
```

`sinteseNovaDoArquivo` é o resultado do casamento título→hash já descrito na Task 6.

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npx eslint app/api/audit/route.ts && npm run --silent test:audit`
Expected: sem erro; `65 teste(s) passaram.`

- [ ] **Step 7: Commit**

```bash
git add app/api/audit/route.ts
git commit -m "auditoria: a rota aceita reauditar so o delta, e registra que foi por ali que passou"
```

---

### Task 9: O botão no cartão, e a linha no parecer

**Files:**
- Modify: `modules/nexo/components/ConfirmationCard.tsx`
- Modify: `modules/nexo/lib/audit.ts` (repassar `reusarDe`)
- Modify: `components/audit-result.tsx` (a linha do "como ler")

**Interfaces:**
- Consumes: o retorno de `/api/audit/delta` que o cartão já consome (`use-delta-do-memorial.ts`), e `report.runtime.reauditoria`.

- [ ] **Step 1: O segundo botão**

No cartão do delta, ao lado do botão de auditar de sempre, quando `comparavel === true` e `fracaoJaLida > 0`:

```tsx
<button
  type="button"
  className="nx-ctl"
  onClick={() => onAuditar({ reusarDe: delta.base.auditId })}
>
  Auditar só o que mudou ({Math.round((1 - delta.fracaoJaLida) * 100)}% do documento)
</button>
```

O botão de sempre continua sendo o primeiro e continua relendo tudo — ninguém ganha economia sem pedir.

- [ ] **Step 2: A linha no parecer**

Em `components/audit-result.tsx`, na área do "como ler", quando `report.runtime?.reauditoria` existe:

```tsx
<p className="text-xs text-muted-foreground">
  Esta reauditoria leu {r.capitulos_lidos} de {r.capitulos_lidos + r.capitulos_herdados}{" "}
  capítulos; {r.achados_herdados} achado(s) vieram da auditoria anterior.
</p>
```

Fora de `passadas_incompletas`: aquilo é para quando algo falhou, e aqui nada falhou — foi escolha.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint modules/nexo/components/ConfirmationCard.tsx components/audit-result.tsx`
Expected: sem saída.

- [ ] **Step 4: Commit**

```bash
git add modules/nexo/components/ConfirmationCard.tsx modules/nexo/lib/audit.ts components/audit-result.tsx
git commit -m "auditoria: o cartao oferece o caminho barato, e o parecer diz que foi por ele"
```

---

### Task 10: A prova de que economiza, medida no memorial real

**Files:**
- Modify: `scripts/prova-delta-do-memorial.mjs`

**Interfaces:**
- Consumes: `planejarReuso`, `VERSAO_AUDITOR`, `buildMapaDosIguais`.

- [ ] **Step 1: Medir o que iria ao modelo**

Estender a prova para, além do delta que ela já mede, montar o plano de reuso e imprimir:

```js
console.log(`documento inteiro ...... ${extraido.charCount} chars`);
console.log(`caminho barato ......... ${textoDoDelta.length} chars de texto + ${mapa.length} de mapa`);
console.log(`economia ............... ${(100 * (1 - (textoDoDelta.length + mapa.length) / extraido.charCount)).toFixed(1)}%`);
console.log(`achados herdados ....... ${plano.achadosHerdados.length}`);
console.log(`capitulos promovidos ... ${plano.promovidos.length}`);
```

- [ ] **Step 2: Rodar contra o 063-26 real**

Run: `npm run prova:delta`
Expected: economia acima de 80% no cenário de um capítulo alterado mais um volume novo. **Se vier abaixo disso, pare e investigue antes de commitar** — a promessa do projeto é 86–95%, e um número menor significa que o plano está promovendo capítulo demais.

- [ ] **Step 3: Commit**

```bash
git add scripts/prova-delta-do-memorial.mjs
git commit -m "prova: quanto o caminho barato realmente poupa no 063-26, medido"
```

---

## Ordem e dependências

Tasks 1→4 constroem o módulo puro e podem ser feitas em sequência sem tocar no motor. Task 5 é pré-requisito de 6 e 8. Task 7 é independente de 5/6 e pode ser feita em paralelo. Task 8 depende de 4, 5, 6 e 7. Task 9 depende de 8. Task 10 depende de 4 e 7.

## O que NÃO entra

Auditoria Padrão, múltiplos arquivos com delta, e reauditar em lote as auditorias antigas — conforme a seção 8 do spec.
