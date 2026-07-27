# Nexo — anel de consumo na barra: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar, na barra do Nexo, quantos tokens a conversa consumiu e quais modelos atenderam cada tarefa — sem inventar nenhum teto.

**Architecture:** `AiUsageEvent` ganha um `conversationId`, carimbado pelos três pontos de entrada de IA alcançáveis a partir de uma conversa. Um endpoint agrega os eventos daquela conversa por modelo e por fluxo, usando uma função PURA e testável. A barra ganha um donut de composição (círculo sempre completo, fatiado por modelo) que abre um popover com a quebra por tarefa.

**Tech Stack:** Next.js (App Router, `runtime = "nodejs"`), Prisma, React 19 + React Compiler, TypeScript, testes puros em node cru (type-stripping).

**Spec:** `docs/superpowers/specs/2026-07-27-nexo-anel-de-consumo-design.md`

## Global Constraints

- **Testes puros rodam em node cru.** Módulos testados por `scripts/test-nexo-*.ts` não podem ter imports de runtime (só `import type`). Node não resolve o alias `@/`; nos scripts, importar por caminho relativo **com `.ts` explícito**.
- **React Compiler:** proibido tocar `ref.current` no corpo do render, e proibido `Date.now()`/`crypto.randomUUID()` no render. `setState` dentro de effect só via `rAF`/`setTimeout`.
- **Nunca estimar custo no cliente.** `estimatedCostUsd` nulo vira "—" na tela. O único lugar que calcula preço é `lib/ai-usage.ts:73`.
- **`conversationId` identifica, não autentica.** Toda consulta filtra também pelo `userEmail` da sessão.
- **O anel é informação acessória:** qualquer falha (sem banco, endpoint fora) resulta em anel ausente, nunca em erro na cara do usuário.
- **Idioma:** todo texto de UI e comentário em português do Brasil, seguindo o tom dos arquivos vizinhos.
- **Commits frequentes**, um por task, direto na `main` (preferência do usuário: sem branch/PR).
- **Nunca usar `git add -A` neste repositório** — sempre listar os arquivos do commit.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `server/nexo/usage/aggregate.ts` | **Criar.** Puro. Agrega eventos por modelo e por fluxo + rótulos em português | 1 |
| `scripts/test-nexo-usage.ts` | **Criar.** Smoke-test da agregação | 1 |
| `package.json` | **Modificar.** Script `test:nexo:usage` | 1 |
| `prisma/schema.prisma` | **Modificar.** `conversationId` em `AiUsageEvent` | 2 |
| `lib/ai-usage.ts` | **Modificar.** `RecordAiUsageArgs.conversationId` → coluna | 2 |
| `lib/ai-runner.ts` | **Modificar.** `ExecuteOpenAiResponseArgs.conversationId` → repassa nas 3 gravações | 2 |
| `server/nexo/agent/run-turn.ts` | **Modificar.** Input ganha `conversationId`; desce aos dois caminhos | 3 |
| `app/api/nexo/agent/route.ts` | **Modificar.** Lê `conversationId` do corpo | 3 |
| `modules/nexo/components/NexoChat.tsx` | **Modificar.** Envia `conversationId`; dispara `refresh()` | 3, 7 |
| `app/api/ld/extract-stamp/route.ts` | **Modificar.** Lê do corpo; repassa nos dois caminhos (OpenAI e MiMo) | 4 |
| `modules/nexo/lib/selo-render.ts` | **Modificar.** Recebe e envia `conversationId` | 4 |
| `lib/audit-ai.ts` | **Modificar.** `executeAuditModelResponse` repassa `conversationId` | 5 |
| `app/api/audit/route.ts` | **Modificar.** Lê do form; passa nas 7 chamadas | 5 |
| `modules/nexo/lib/audit.ts` | **Modificar.** `runMemorialAudit` envia no form | 5 |
| `modules/nexo/lib/generate.ts` | **Modificar.** `postAudit` repassa | 5 |
| `modules/nexo/components/ConfirmationCard.tsx` | **Modificar.** Passa o id da conversa ao `postAudit`; dispara `refresh()` | 5, 7 |
| `app/api/nexo/usage/route.ts` | **Criar.** GET agregado da conversa | 6 |
| `modules/nexo/state/use-conversation-usage.ts` | **Criar.** Hook `{ data, refresh }` | 7 |
| `modules/nexo/components/UsageDonut.tsx` | **Criar.** Donut + popover na barra | 7 |
| `modules/nexo/components/NexoComposer.tsx` | **Modificar.** Slot do donut na barra | 7 |
| `modules/nexo/components/UsageArc.tsx` | **Apagar.** Substituído (teto falso) | 7 |
| `modules/nexo/state/api-usage.tsx` | **Apagar.** Segunda verdade divergente | 7 |
| `modules/nexo/components/NexoWorkspace.tsx` | **Modificar.** Passa `conversationId` à leitura de selos; solta o `api-usage` | 4, 7 |
| `modules/nexo/components/NexoCopilot.tsx` | **Modificar.** Remove o `UsageArc` | 7 |

---

### Task 1: Agregação pura e rótulos

Fundação. Sem dependência de nenhuma outra task, e o único pedaço com teste automatizado.

**Files:**
- Create: `server/nexo/usage/aggregate.ts`
- Create: `scripts/test-nexo-usage.ts`
- Modify: `package.json` (ao lado dos outros `test:nexo:*`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface UsageRow { flow: string; model: string; totalTokens: number; estimatedCostUsd: number | null }`
  - `interface UsageSlice { model: string; totalTokens: number; costUsd: number | null }`
  - `interface UsageTaskRow { flow: string; label: string; model: string; totalTokens: number; costUsd: number | null }`
  - `interface UsageSummary { porModelo: UsageSlice[]; porTarefa: UsageTaskRow[]; totalTokens: number; totalCostUsd: number | null }`
  - `aggregateUsage(rows: UsageRow[]): UsageSummary`
  - `flowLabel(flow: string): string`

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-usage.ts`:

```ts
/**
 * Smoke-test da agregação do consumo da conversa (por modelo e por tarefa).
 * Núcleo PURO (sem imports de runtime) → roda com node cru.
 *
 *   node scripts/test-nexo-usage.ts   (== npm run test:nexo:usage)
 */
import assert from "node:assert/strict";

import { aggregateUsage, flowLabel } from "../server/nexo/usage/aggregate.ts";

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

test("soma tokens por modelo, maior primeiro", () => {
  const r = aggregateUsage([
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 100, estimatedCostUsd: 0.01 },
    { flow: "ld-extraction", model: "gpt-5-mini", totalTokens: 300, estimatedCostUsd: 0.002 },
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 50, estimatedCostUsd: 0.005 },
  ]);
  assert.deepEqual(
    r.porModelo.map((m) => m.model),
    ["gpt-5-mini", "gpt-5.5"],
  );
  assert.equal(r.porModelo[0].totalTokens, 300);
  assert.equal(r.porModelo[1].totalTokens, 150);
  assert.equal(r.totalTokens, 450);
});

test("mesma tarefa com dois modelos vira DUAS linhas", () => {
  const r = aggregateUsage([
    { flow: "ld-extraction", model: "gpt-5-mini", totalTokens: 200, estimatedCostUsd: null },
    { flow: "ld-extraction", model: "mimo-vl", totalTokens: 80, estimatedCostUsd: null },
  ]);
  assert.equal(r.porTarefa.length, 2);
  assert.deepEqual(
    r.porTarefa.map((t) => t.model),
    ["gpt-5-mini", "mimo-vl"],
  );
  // O rótulo da tarefa se repete — é a troca de modelo que se quer ver.
  assert.equal(r.porTarefa[0].label, "Leitura de selos");
  assert.equal(r.porTarefa[1].label, "Leitura de selos");
});

test("custo: nenhum evento com preço -> total nulo (nao zero)", () => {
  const r = aggregateUsage([
    { flow: "audit", model: "mimo-vl", totalTokens: 10, estimatedCostUsd: null },
  ]);
  assert.equal(r.totalCostUsd, null);
  assert.equal(r.porModelo[0].costUsd, null);
});

test("custo parcial: soma so o que existe", () => {
  const r = aggregateUsage([
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 10, estimatedCostUsd: 0.02 },
    { flow: "nexo-agent", model: "gpt-5.5", totalTokens: 10, estimatedCostUsd: null },
  ]);
  assert.equal(r.porModelo.length, 1);
  assert.equal(r.porModelo[0].costUsd, 0.02);
  assert.equal(r.totalCostUsd, 0.02);
});

test("lista vazia -> zeros, listas vazias e custo nulo", () => {
  const r = aggregateUsage([]);
  assert.deepEqual(r.porModelo, []);
  assert.deepEqual(r.porTarefa, []);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalCostUsd, null);
});

test("flowLabel: fluxo desconhecido devolve o proprio flow", () => {
  assert.equal(flowLabel("nexo-agent"), "Turnos da conversa");
  assert.equal(flowLabel("fluxo-novo-qualquer"), "fluxo-novo-qualquer");
  assert.equal(flowLabel(""), "");
});

console.log(`\n${passed} teste(s) da agregação de consumo OK.`);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
node scripts/test-nexo-usage.ts
```

Esperado: FALHA com `Cannot find module .../aggregate.ts`.

- [ ] **Step 3: Implementar a agregação**

Criar `server/nexo/usage/aggregate.ts`:

```ts
/**
 * Agregação do consumo de IA de UMA conversa: dois cortes do mesmo conjunto de
 * eventos — por modelo (as fatias do anel) e por tarefa+modelo (as linhas do
 * popover).
 *
 * PURO, SEM IMPORTS de runtime (padrão de `normalize.ts`/`split-stream.ts`):
 * roda em node cru, sem esbarrar no alias `@/`. A rota faz o I/O e chama isto.
 *
 * REGRA DO CUSTO: `estimatedCostUsd` é nulo quando o modelo não está na tabela
 * de preços (`lib/ai-usage.ts`). Somamos só o que existe, e devolvemos `null`
 * quando NENHUM evento do grupo tem preço — nunca zero, que se leria como
 * "de graça".
 */

/** Uma linha crua vinda do banco (`AiUsageEvent`). */
export interface UsageRow {
  flow: string;
  model: string;
  totalTokens: number;
  estimatedCostUsd: number | null;
}

/** Uma fatia do anel. */
export interface UsageSlice {
  model: string;
  totalTokens: number;
  costUsd: number | null;
}

/** Uma linha do popover: par (tarefa, modelo). */
export interface UsageTaskRow {
  flow: string;
  label: string;
  model: string;
  totalTokens: number;
  costUsd: number | null;
}

export interface UsageSummary {
  porModelo: UsageSlice[];
  porTarefa: UsageTaskRow[];
  totalTokens: number;
  totalCostUsd: number | null;
}

/** Fluxo técnico → o nome que o engenheiro reconhece. */
const FLOW_LABELS: Record<string, string> = {
  "nexo-agent": "Turnos da conversa",
  "ld-extraction": "Leitura de selos",
  audit: "Auditoria do memorial",
};

/** Rótulo da tarefa. Fluxo novo cai no próprio nome — nunca string vazia. */
export function flowLabel(flow: string): string {
  return FLOW_LABELS[flow] ?? flow;
}

/** Soma tolerante a nulos: nulo só quando NADA no grupo tinha preço. */
function addCost(current: number | null, next: number | null): number | null {
  if (next == null) return current;
  return (current ?? 0) + next;
}

export function aggregateUsage(rows: UsageRow[]): UsageSummary {
  const byModel = new Map<string, UsageSlice>();
  const byTask = new Map<string, UsageTaskRow>();
  let totalTokens = 0;
  let totalCostUsd: number | null = null;

  for (const row of rows) {
    totalTokens += row.totalTokens;
    totalCostUsd = addCost(totalCostUsd, row.estimatedCostUsd);

    const slice = byModel.get(row.model);
    if (slice) {
      slice.totalTokens += row.totalTokens;
      slice.costUsd = addCost(slice.costUsd, row.estimatedCostUsd);
    } else {
      byModel.set(row.model, {
        model: row.model,
        totalTokens: row.totalTokens,
        costUsd: row.estimatedCostUsd,
      });
    }

    const key = `${row.flow} ${row.model}`;
    const task = byTask.get(key);
    if (task) {
      task.totalTokens += row.totalTokens;
      task.costUsd = addCost(task.costUsd, row.estimatedCostUsd);
    } else {
      byTask.set(key, {
        flow: row.flow,
        label: flowLabel(row.flow),
        model: row.model,
        totalTokens: row.totalTokens,
        costUsd: row.estimatedCostUsd,
      });
    }
  }

  const desc = (a: { totalTokens: number }, b: { totalTokens: number }) =>
    b.totalTokens - a.totalTokens;

  return {
    porModelo: [...byModel.values()].sort(desc),
    porTarefa: [...byTask.values()].sort(desc),
    totalTokens,
    totalCostUsd,
  };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
node scripts/test-nexo-usage.ts
```

Esperado: 6 linhas `ok` e `6 teste(s) da agregação de consumo OK.`

- [ ] **Step 5: Registrar o script no package.json**

Em `package.json`, após a linha `"test:nexo:stream"`, acrescentar (lembrando da vírgula na linha anterior):

```json
"test:nexo:usage": "node scripts/test-nexo-usage.ts"
```

Rodar `npm run test:nexo:usage` e conferir a mesma saída.

- [ ] **Step 6: Commit**

```bash
git add server/nexo/usage/aggregate.ts scripts/test-nexo-usage.ts package.json
git commit -m "Nexo: agregacao pura do consumo por modelo e por tarefa"
```

---

### Task 2: Migração e o gravador aceitando a conversa

Sem isto não há onde guardar o vínculo. Nada muda de comportamento ainda: o campo é opcional e todo chamador existente grava `null`.

**Files:**
- Modify: `prisma/schema.prisma` (bloco `model AiUsageEvent`, linha ~482)
- Modify: `lib/ai-usage.ts:12` (args) e `:110` (create)
- Modify: `lib/ai-runner.ts:26` (args) e as três gravações (`:295`, `:329`, `:395`)

**Interfaces:**
- Consumes: nada.
- Produces: `RecordAiUsageArgs.conversationId?: string | null` e `ExecuteOpenAiResponseArgs.conversationId?: string | null`.

- [ ] **Step 1: Acrescentar a coluna no schema**

Em `prisma/schema.prisma`, no `model AiUsageEvent`, logo após a linha `userEmail String?`:

```prisma
  conversationId String?
```

E junto dos `@@index` existentes do mesmo model:

```prisma
  @@index([conversationId])
```

- [ ] **Step 2: Gerar a migração**

```bash
npm run db:migrate:dev -- --name nexo_usage_conversation
```

Conferir que o SQL gerado em `prisma/migrations/<timestamp>_nexo_usage_conversation/migration.sql` acrescenta a coluna `conversationId` e cria o índice — e **nada mais**. Se aparecer qualquer `DROP`, parar e reportar.

- [ ] **Step 3: O gravador aceita e grava o campo**

Em `lib/ai-usage.ts`, no tipo `RecordAiUsageArgs` (linha 12), após `userEmail?: string | null;`:

```ts
  /** Conversa do Nexo que originou a chamada (só o Nexo preenche). */
  conversationId?: string | null;
```

E no `create` (linha ~110), após `userEmail: args.userEmail || null,`:

```ts
        conversationId: args.conversationId || null,
```

- [ ] **Step 4: O runner repassa o campo**

Em `lib/ai-runner.ts`, no tipo `ExecuteOpenAiResponseArgs` (linha 26), após `timeoutMs?: number;`:

```ts
  /** Conversa do Nexo que originou a chamada (só o Nexo preenche). */
  conversationId?: string | null;
```

São **três** chamadas a `recordAiUsage` neste arquivo. Em cada uma, acrescentar `conversationId: args.conversationId,` junto de `userEmail: args.userEmail`:

1. sucesso do `executeOpenAiResponse` (linha ~295);
2. falha do `executeOpenAiResponse` (linha ~329);
3. sucesso do `executeOpenAiResponseStream` (linha ~395).

Exemplo da primeira, para não restar dúvida da forma:

```ts
    await recordAiUsage({
      flow: args.flow,
      aiTaskId,
      taskId: args.taskId,
      taskLabel: args.taskLabel,
      provider,
      model: args.model,
      operation: args.operation,
      response,
      durationMs,
      metadata: args.metadata,
      userEmail: args.userEmail,
      conversationId: args.conversationId,
    });
```

- [ ] **Step 5: Verificar tipos, lint e testes**

```bash
npx tsc --noEmit && npx eslint lib/ai-usage.ts lib/ai-runner.ts && npm run test:nexo:usage
```

Esperado: os três sem erro; 6/6 no teste.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/ai-usage.ts lib/ai-runner.ts
git commit -m "Nexo: AiUsageEvent guarda a conversa que originou a chamada"
```

---

### Task 3: Caminho do agente carimba a conversa

Primeiro dos três caminhos. Verificável de ponta a ponta sozinho.

**Files:**
- Modify: `server/nexo/agent/run-turn.ts` (`RunNexoAgentTurnInput`, `runNexoAgentTurn`, `runNexoAgentTurnStream`)
- Modify: `app/api/nexo/agent/route.ts` (corpo da requisição)
- Modify: `modules/nexo/components/NexoChat.tsx` (envio)

**Interfaces:**
- Consumes: `ExecuteOpenAiResponseArgs.conversationId` (Task 2).
- Produces: `RunNexoAgentTurnInput.conversationId?: string | null`.

- [ ] **Step 1: O input do turno carrega a conversa**

Em `server/nexo/agent/run-turn.ts`, na `interface RunNexoAgentTurnInput`, após `prefeituras: NexoAgentPrefeitura[];`:

```ts
  /** Conversa do Nexo, para amarrar o consumo (opcional: sem ela, não conta). */
  conversationId?: string | null;
```

- [ ] **Step 2: Os dois caminhos repassam**

No mesmo arquivo, em `runNexoAgentTurn`, dentro do objeto passado a `executeOpenAiResponse`, após `metadata: buildTurnMetadata(input),`:

```ts
    conversationId: input.conversationId,
```

E em `runNexoAgentTurnStream`, dentro do objeto passado a `executeOpenAiResponseStream`, após `metadata: buildTurnMetadata(input),`:

```ts
      conversationId: input.conversationId,
```

- [ ] **Step 3: A rota lê do corpo**

Em `app/api/nexo/agent/route.ts`, na desestruturação do corpo, acrescentar a variável junto de `message`/`history`/`selos`:

```ts
  let message: string;
  let history: ChatTurn[];
  let selos: SeloForLd[];
  let conversationId: string | null;
```

Dentro do `try` do parse, após a linha que preenche `selos`:

```ts
    conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : null;
```

E o tipo do corpo (o `as {…}` logo acima) ganha:

```ts
      conversationId?: unknown;
```

Por fim, as **duas** chamadas do turno passam a levar o campo. No ramo SSE:

```ts
          for await (const event of runNexoAgentTurnStream(
            { message, history, resumo, prefeituras, conversationId },
            req.signal,
          )) {
```

E no caminho não-SSE:

```ts
    const turn = await runNexoAgentTurn({
      message,
      history,
      resumo,
      prefeituras,
      conversationId,
    });
```

- [ ] **Step 4: O chat envia o id**

Em `modules/nexo/components/NexoChat.tsx`, a desestruturação do store já traz `messages`; acrescentar `conversationId`:

```ts
  const { messages, conversationId, appendMessage, appendDelta, finalizeMessage } =
    useConversation();
```

E no corpo do `fetch` dentro de `send`:

```ts
        body: JSON.stringify({ message: text, history, selos, conversationId }),
```

- [ ] **Step 5: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint server/nexo/agent/run-turn.ts app/api/nexo/agent/route.ts modules/nexo/components/NexoChat.tsx
```

Esperado: sem erro.

- [ ] **Step 6: Provar que chegou no banco**

Com `npm run dev` e o banco configurado, mandar uma mensagem qualquer em `/nexo` e conferir:

```bash
npx prisma studio
```

Na tabela `AiUsageEvent`, a linha mais recente com `flow = "nexo-agent"` deve ter `conversationId` preenchido. Se estiver nulo, parar: algum passo acima não pegou.

- [ ] **Step 7: Commit**

```bash
git add server/nexo/agent/run-turn.ts app/api/nexo/agent/route.ts modules/nexo/components/NexoChat.tsx
git commit -m "Nexo: turno do agente carimba a conversa no consumo"
```

---

### Task 4: Caminho dos selos carimba a conversa

**Files:**
- Modify: `app/api/ld/extract-stamp/route.ts` (corpo + os dois caminhos de gravação)
- Modify: `modules/nexo/lib/selo-render.ts` (`postExtractStamp`, `extractSeloFromImage`, `extractSeloFromPage`, `extractSelosFromFiles`)
- Modify: `modules/nexo/components/NexoWorkspace.tsx:340,348` (chamadas)

**Interfaces:**
- Consumes: `ExecuteOpenAiResponseArgs.conversationId` e `RecordAiUsageArgs.conversationId` (Task 2).
- Produces: `extractSelosFromFiles(files, onResult?, conversationId?)` e `extractSeloFromImage(file, conversationId?)`.

**Atenção:** esta rota grava consumo em **dois** lugares — o caminho OpenAI (via `executeOpenAiResponse`, dentro de `extractWithOpenAi`) e o **fallback MiMo** (via `recordAiUsage` direto). Os dois precisam do campo, senão a leitura que caiu no fallback some da conta.

- [ ] **Step 1: A rota lê o id do corpo**

Em `app/api/ld/extract-stamp/route.ts`, no `POST`, o tipo do corpo ganha o campo:

```ts
  const body = (await request.json()) as {
    imageDataUrl?: unknown;
    pdfText?: unknown;
    metadata?: ExtractionMetadata;
    conversationId?: unknown;
  };
```

Logo após a linha `const metadata = body.metadata ?? {};`:

```ts
  const conversationId =
    typeof body.conversationId === "string" && body.conversationId.trim()
      ? body.conversationId.trim()
      : null;
```

- [ ] **Step 2: O caminho OpenAI repassa**

No mesmo arquivo, o tipo `ExtractionTrackingContext` ganha:

```ts
type ExtractionTrackingContext = {
  operation: string;
  metadata: ExtractionMetadata;
  userEmail?: string | null;
  hasImage: boolean;
  pdfTextChars: number;
  conversationId?: string | null;
};
```

Dentro de `extractWithOpenAi`, no objeto passado a `executeOpenAiResponse`, após `userEmail: tracking.userEmail,`:

```ts
    conversationId: tracking.conversationId,
```

E na chamada de `extractWithOpenAi` dentro do `POST`, o objeto de tracking ganha a última linha:

```ts
      {
        operation,
        metadata,
        userEmail: session.user.email,
        hasImage: Boolean(imageDataUrl),
        pdfTextChars: pdfText?.length ?? 0,
        conversationId,
      },
```

- [ ] **Step 3: O fallback MiMo repassa**

Ainda no `POST`, no `recordAiUsage` do bloco do fallback, após `userEmail: session.user.email,`:

```ts
        conversationId,
```

- [ ] **Step 4: O cliente dos selos envia o id**

Em `modules/nexo/lib/selo-render.ts`, `postExtractStamp` ganha o parâmetro e o manda no corpo:

```ts
async function postExtractStamp(
  imageDataUrl: string,
  pdfText: string,
  metadata: Record<string, unknown>,
  conversationId?: string | null,
): Promise<{ extraction: StampExtraction; usage: number }> {
```

```ts
      body: JSON.stringify({ imageDataUrl, pdfText, metadata, conversationId }),
```

`extractSeloFromImage` recebe e repassa:

```ts
export async function extractSeloFromImage(
  file: File,
  conversationId?: string | null,
): Promise<SeloResult> {
```

```ts
    const { extraction, usage } = await postExtractStamp(
      imageDataUrl,
      "",
      { fileName: file.name, source: "image", operation: "nexo-selo-image" },
      conversationId,
    );
```

`extractSeloFromPage` recebe e repassa:

```ts
async function extractSeloFromPage(
  doc: { getPage: (n: number) => Promise<unknown> },
  file: File,
  pageNumber: number,
  pageCount: number,
  conversationId?: string | null,
): Promise<SeloResult> {
```

```ts
    const { extraction, usage } = await postExtractStamp(
      imageDataUrl,
      pdfText,
      { fileName: file.name, pageNumber, source: "visual", operation: "nexo-selo" },
      conversationId,
    );
```

E `extractSelosFromFiles` recebe e desce até a página:

```ts
export async function extractSelosFromFiles(
  files: File[],
  onResult?: (result: SeloResult) => void,
  conversationId?: string | null,
): Promise<SeloResult[]> {
```

```ts
          const result = await extractSeloFromPage(
            doc,
            file,
            pageNumber,
            pageCount,
            conversationId,
          );
```

- [ ] **Step 5: O workspace passa o id da conversa**

Em `modules/nexo/components/NexoWorkspace.tsx`, o `conversationId` já está disponível via `conv` (o componente faz `const conv = useConversation();`). Nas duas chamadas:

```ts
          await extractSelosFromFiles(
            pranchas,
            (r) => {
              collected.push(r);
              setSeloResults([...collected]);
              setReadProgress({ done: collected.length, total });
            },
            conv.conversationId,
          );
```

```ts
          const r = await extractSeloFromImage(img, conv.conversationId);
```

**Nota:** as linhas `addTokens(r.usage ?? 0)` saem aqui — o `api-usage` morre na Task 7 e a contagem passa a vir do banco. Se preferir não deixar o arquivo quebrado entre tasks, mantenha-as e remova na Task 7; o `tsc` aponta o que sobrar.

- [ ] **Step 6: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint app/api/ld/extract-stamp/route.ts modules/nexo/lib/selo-render.ts modules/nexo/components/NexoWorkspace.tsx
```

Esperado: sem erro.

- [ ] **Step 7: Provar que chegou no banco**

Com `npm run dev`, anexar uma prancha em `/nexo` e ler os selos. No `npx prisma studio`, as linhas novas com `flow = "ld-extraction"` devem ter `conversationId` preenchido.

- [ ] **Step 8: Commit**

```bash
git add app/api/ld/extract-stamp/route.ts modules/nexo/lib/selo-render.ts modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: leitura de selos carimba a conversa no consumo"
```

---

### Task 5: Caminho da auditoria carimba a conversa

O caminho mais fácil de errar: **sete** chamadas ao modelo na mesma rota. Esquecer uma produz um número quase certo, que é pior que um obviamente errado.

**Files:**
- Modify: `lib/audit-ai.ts:48` (`executeAuditModelResponse`)
- Modify: `app/api/audit/route.ts` (form + as 7 chamadas)
- Modify: `modules/nexo/lib/audit.ts:24` (`runMemorialAudit`)
- Modify: `modules/nexo/lib/generate.ts:278` (`postAudit`)
- Modify: `modules/nexo/components/ConfirmationCard.tsx` (chamador)

**Interfaces:**
- Consumes: `ExecuteOpenAiResponseArgs.conversationId` (Task 2).
- Produces: `runMemorialAudit(memorial, gabarito, level, conversationId?)` e `postAudit(memorial, gabarito, level, conversationId?)`.

- [ ] **Step 1: O executor da auditoria aceita e repassa**

Em `lib/audit-ai.ts`, na assinatura de `executeAuditModelResponse`, acrescentar ao objeto de args:

```ts
  conversationId?: string | null;
```

E no objeto passado a `executeOpenAiResponse`, após `metadata: args.metadata ?? {},`:

```ts
    conversationId: args.conversationId,
```

- [ ] **Step 2: A rota lê o id do form**

Em `app/api/audit/route.ts`, junto de onde os outros campos do `FormData` são lidos (`auditMode`, `analysisLevel`, `gabaritoObra`…), acrescentar:

```ts
  const conversationIdRaw = form.get("conversationId");
  const conversationId =
    typeof conversationIdRaw === "string" && conversationIdRaw.trim()
      ? conversationIdRaw.trim()
      : null;
```

- [ ] **Step 3: Atravessar as sete funções**

**Nenhuma das 7 chamadas enxerga o escopo do `POST`.** Cada uma vive numa função
de módulo que recebe um objeto `args` — então o `conversationId` precisa entrar
no `args` de cada uma e ser repassado por quem as chama. Não recrie a leitura do
form lá dentro.

As sete funções, com a linha da declaração e a linha da chamada ao modelo:

| Função | Declaração | Chamada |
|---|---|---|
| `analyzeChunkWithModel` | 1761 | 1773 |
| `analyzeIdentityWithModel` | 1872 | 1887 |
| `analyzeFileGloballyWithModel` | 2028 | 2044 |
| `analyzeDocumentCoherenceWithModel` | 2157 | 2171 |
| `validateFindingsWithModel` | 2394 | 2414 |
| `analyzeCrossDocumentsWithModel` | 2516 | 2533 |
| `refuteFindingsWithModel` | 2606 | 2624 |

Em **cada uma das sete**, duas edições. No tipo do parâmetro `args`, acrescentar
como último campo:

```ts
  conversationId?: string | null;
```

E no objeto passado a `executeAuditModelResponse`, acrescentar como última linha:

```ts
    conversationId: args.conversationId,
```

Depois, **quem chama essas sete** precisa passar o valor. Localizar os chamadores:

```bash
grep -n "analyzeChunkWithModel(\|analyzeIdentityWithModel(\|analyzeFileGloballyWithModel(\|analyzeDocumentCoherenceWithModel(\|validateFindingsWithModel(\|analyzeCrossDocumentsWithModel(\|refuteFindingsWithModel(" app/api/audit/route.ts
```

Os chamadores estão no `POST` (2894) — que tem a variável do Step 2 — e em
`deepAnalyzeFile` (2678), que é intermediária: ela também recebe `args` e também
precisa de `conversationId?: string | null;` no seu tipo, repassando
`conversationId: args.conversationId` para as funções que aciona. O `POST` passa
`conversationId` direto ao chamar `deepAnalyzeFile`.

- [ ] **Step 3b: Provar que nenhuma das sete ficou para trás**

```bash
grep -c "conversationId: args.conversationId" app/api/audit/route.ts
```

Esperado: **um número ≥ 8** — as 7 chamadas ao modelo mais os repasses de
`deepAnalyzeFile`. Se vier menos que 8, alguma função ficou sem o carimbo.

```bash
npx tsc --noEmit
```

O `tsc` é a rede de segurança real aqui: como o campo é opcional, ele **não**
acusa quem esqueceu de passar. Por isso a contagem acima existe — e por isso a
prova final da Task 8 roda uma auditoria de verdade.

- [ ] **Step 4: O cliente da auditoria envia o id**

Em `modules/nexo/lib/audit.ts`:

```ts
export async function runMemorialAudit(
  memorial: File,
  gabarito: MemorialAuditGabarito = {},
  level: MemorialAuditLevel = "standard",
  conversationId?: string | null,
): Promise<AuditReport> {
```

E dentro, junto dos outros `form.append`:

```ts
  if (conversationId) form.append("conversationId", conversationId);
```

Em `modules/nexo/lib/generate.ts`, `postAudit` ganha o parâmetro e repassa ao `runMemorialAudit`:

```ts
export async function postAudit(
  memorial: File,
  gabarito: MemorialAuditGabarito = {},
  level: MemorialAuditLevel = "standard",
  conversationId?: string | null,
)
```

- [ ] **Step 5: O card passa o id**

Em `modules/nexo/components/ConfirmationCard.tsx`, dentro de `AuditoriaConfirmation`, o componente já usa o store (`getResult` vem de `useConversation()`). Acrescentar `conversationId` à desestruturação desse hook e passá-lo na chamada:

```ts
      const r = await postAudit(
        memorialFile,
        { obra, prefeitura },
        params.nivel,
        conversationId,
      );
```

- [ ] **Step 6: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint lib/audit-ai.ts app/api/audit/route.ts modules/nexo/lib/audit.ts modules/nexo/lib/generate.ts modules/nexo/components/ConfirmationCard.tsx
```

Esperado: sem erro.

- [ ] **Step 7: Commit**

```bash
git add lib/audit-ai.ts app/api/audit/route.ts modules/nexo/lib/audit.ts modules/nexo/lib/generate.ts modules/nexo/components/ConfirmationCard.tsx
git commit -m "Nexo: auditoria do memorial carimba a conversa no consumo"
```

---

### Task 6: Endpoint de agregação

**Files:**
- Create: `app/api/nexo/usage/route.ts`

**Interfaces:**
- Consumes: `aggregateUsage`/`UsageRow` (Task 1); a coluna `conversationId` (Task 2).
- Produces: `GET /api/nexo/usage?conversationId=…` → `UsageSummary` em JSON.

- [ ] **Step 1: Escrever a rota**

Criar `app/api/nexo/usage/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { isNexoEnabled } from "@/lib/feature-flags";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { aggregateUsage, type UsageRow } from "@/server/nexo/usage/aggregate";

export const runtime = "nodejs";

/** Resposta de "não há nada a mostrar" — o anel some, sem erro na tela. */
const VAZIO = { porModelo: [], porTarefa: [], totalTokens: 0, totalCostUsd: null };

/**
 * Consumo de IA de UMA conversa do Nexo, agregado por modelo e por tarefa.
 *
 * O `conversationId` é um UUID gerado no cliente: ele IDENTIFICA, não autentica.
 * Por isso a consulta filtra SEMPRE também pelo e-mail da sessão — sem isso,
 * adivinhar um id exporia o consumo de outra pessoa.
 */
export async function GET(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  const conversationId = req.nextUrl.searchParams.get("conversationId")?.trim();
  const userEmail = session.user.email;
  if (!conversationId || !userEmail || !isDatabaseConfigured()) {
    return NextResponse.json(VAZIO);
  }

  try {
    const events = (await getPrisma().aiUsageEvent.findMany({
      where: { conversationId, userEmail },
      select: {
        flow: true,
        model: true,
        totalTokens: true,
        estimatedCostUsd: true,
      },
    })) satisfies UsageRow[];

    return NextResponse.json(aggregateUsage(events));
  } catch (error) {
    // Informação acessória: falhar aqui não pode atrapalhar a conversa.
    console.error("[nexo-usage] falha ao agregar consumo", error);
    return NextResponse.json(VAZIO);
  }
}
```

- [ ] **Step 2: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint app/api/nexo/usage/route.ts
```

Esperado: sem erro. Se o `satisfies UsageRow[]` reclamar (o Prisma pode devolver `Decimal` ou `number | null` conforme o provider), trocar por um `.map()` explícito para o formato de `UsageRow` — **não** afrouxar o tipo com `as unknown as`.

- [ ] **Step 3: Provar que responde**

Com `npm run dev` e uma conversa que já consumiu IA, pegar o `conversationId` no `prisma studio` e:

```bash
curl -s "http://localhost:3000/api/nexo/usage?conversationId=<id>" --cookie "<cookie de sessão>"
```

Esperado: JSON com `porModelo`, `porTarefa`, `totalTokens` batendo com as linhas da tabela. Sem cookie, esperado 401.

- [ ] **Step 4: Commit**

```bash
git add app/api/nexo/usage/route.ts
git commit -m "Nexo: endpoint do consumo agregado da conversa"
```

---

### Task 7: O anel na barra

**Files:**
- Create: `modules/nexo/state/use-conversation-usage.ts`
- Create: `modules/nexo/components/UsageDonut.tsx`
- Modify: `modules/nexo/components/NexoComposer.tsx` (slot na barra)
- Modify: `modules/nexo/components/NexoChat.tsx` (dispara `refresh`, passa o donut ao composer)
- Modify: `modules/nexo/components/NexoWorkspace.tsx` (solta o `api-usage`)
- Modify: `modules/nexo/components/NexoCopilot.tsx` (remove o `UsageArc`)
- Modify: `modules/nexo/components/ConfirmationCard.tsx` (dispara `refresh` após auditoria)
- Delete: `modules/nexo/components/UsageArc.tsx`
- Delete: `modules/nexo/state/api-usage.tsx`

**Interfaces:**
- Consumes: `GET /api/nexo/usage` (Task 6); `UsageSummary` (Task 1).
- Produces: `useConversationUsage(conversationId)` → `{ data: UsageSummary | null; refresh: () => void }`.

- [ ] **Step 1: O hook**

Criar `modules/nexo/state/use-conversation-usage.ts`:

```ts
"use client";

/**
 * Consumo de IA da conversa atual, vindo do banco (fonte única). Busca ao montar,
 * ao trocar de conversa, e sob `refresh()` — que quem termina um trabalho chama.
 *
 * Falha em silêncio: consumo é informação acessória, e um erro aqui não pode
 * virar ruído na conversa.
 */

import { useCallback, useEffect, useState } from "react";

import type { UsageSummary } from "@/server/nexo/usage/aggregate";

export function useConversationUsage(conversationId: string) {
  const [data, setData] = useState<UsageSummary | null>(null);

  const refresh = useCallback(() => {
    if (!conversationId) return;
    fetch(`/api/nexo/usage?conversationId=${encodeURIComponent(conversationId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: UsageSummary | null) => setData(d))
      .catch(() => setData(null));
  }, [conversationId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, refresh };
}
```

- [ ] **Step 2: O donut**

Criar `modules/nexo/components/UsageDonut.tsx`:

```tsx
"use client";

/**
 * Consumo de IA DESTA conversa: um donut fatiado por modelo. O círculo está
 * SEMPRE completo — ele mostra composição, não fração de um teto. (Não existe
 * limite por usuário neste produto, e inventar um seria mentir.)
 *
 * Clicar abre a quebra por tarefa. Some enquanto não houve consumo.
 */

import { useState } from "react";

import { AgentPopover } from "@/components/ui/agent-popover";
import type { UsageSummary } from "@/server/nexo/usage/aggregate";

const R = 7;
const CIRC = 2 * Math.PI * R;

/** Escala do teal do sistema — distinção, não semântica. 2 a 4 modelos na prática. */
const SLICE_COLORS = [
  "var(--ring)",
  "rgb(91 218 198 / 0.55)",
  "rgb(91 218 198 / 0.3)",
  "var(--input)",
];

function abreviar(tokens: number): string {
  if (tokens < 1000) return String(tokens);
  const k = tokens / 1000;
  return `${k.toFixed(k >= 10 ? 0 : 1).replace(".", ",")}k`;
}

function dinheiro(usd: number | null): string {
  return usd == null ? "—" : `$${usd.toFixed(3)}`;
}

export function UsageDonut({ data }: { data: UsageSummary | null }) {
  const [open, setOpen] = useState(false);

  if (!data || data.totalTokens <= 0) return null;

  // Cada fatia começa onde a anterior terminou (rotação -90 põe o zero no topo).
  let cursor = 0;
  const fatias = data.porModelo.map((m, i) => {
    const len = (m.totalTokens / data.totalTokens) * CIRC;
    const offset = cursor;
    cursor += len;
    return { ...m, len, offset, color: SLICE_COLORS[i] ?? "var(--input)" };
  });

  return (
    <AgentPopover
      open={open}
      onClose={() => setOpen(false)}
      label="Consumo de IA desta conversa"
      panelClassName="w-[300px]"
      anchor={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`Consumo desta conversa: ${data.totalTokens.toLocaleString("pt-BR")} tokens`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <svg width="15" height="15" viewBox="0 0 18 18" className="-rotate-90" aria-hidden>
            {fatias.map((f) => (
              <circle
                key={f.model}
                cx="9"
                cy="9"
                r={R}
                fill="none"
                stroke={f.color}
                strokeWidth="2.5"
                strokeDasharray={`${f.len} ${CIRC - f.len}`}
                strokeDashoffset={-f.offset}
              />
            ))}
          </svg>
          <span className="font-mono text-[9px] tabular-nums">
            {abreviar(data.totalTokens)}
          </span>
        </button>
      }
    >
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
        Consumo desta conversa
      </p>
      <table className="w-full text-[11px]">
        <tbody>
          {data.porTarefa.map((t) => (
            <tr key={`${t.flow}-${t.model}`} className="align-baseline">
              <td className="py-0.5 pr-2 text-foreground">{t.label}</td>
              <td className="py-0.5 pr-2 font-mono text-muted-foreground">{t.model}</td>
              <td className="py-0.5 pr-2 text-right font-mono tabular-nums text-foreground">
                {abreviar(t.totalTokens)}
              </td>
              <td className="py-0.5 text-right font-mono tabular-nums text-muted-foreground">
                {dinheiro(t.costUsd)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <td className="pt-1.5 text-muted-foreground" colSpan={2}>
              Total
            </td>
            <td className="pt-1.5 text-right font-mono tabular-nums text-foreground">
              {abreviar(data.totalTokens)}
            </td>
            <td className="pt-1.5 text-right font-mono tabular-nums text-foreground">
              {dinheiro(data.totalCostUsd)}
            </td>
          </tr>
        </tfoot>
      </table>
    </AgentPopover>
  );
}
```

- [ ] **Step 3: O composer ganha o slot**

Em `modules/nexo/components/NexoComposer.tsx`, acrescentar a prop:

```tsx
  /** Peça opcional à esquerda do enviar (hoje: o anel de consumo). */
  trailing?: React.ReactNode;
```

Na desestruturação, junto de `onStop`: `trailing,`. E no JSX, imediatamente **antes** do bloco `{busy && onStop ? (`:

```tsx
        {trailing}
```

O import do topo passa a incluir o tipo:

```tsx
import type { ReactNode, RefObject } from "react";
```

- [ ] **Step 4: O chat liga tudo**

Em `modules/nexo/components/NexoChat.tsx`:

```tsx
import { useConversationUsage } from "../state/use-conversation-usage";
import { UsageDonut } from "./UsageDonut";
```

No corpo do componente, após a desestruturação do store:

```tsx
  const { data: usage, refresh: refreshUsage } = useConversationUsage(conversationId);
```

Chamar `refreshUsage()` ao fim do turno — no `finally` do `send`, junto de `setBusy(false)`:

```tsx
    } finally {
      abortRef.current = null;
      setBusy(false);
      refreshUsage();
    }
```

E o composer recebe o donut:

```tsx
            onStop={stop}
            trailing={<UsageDonut data={usage} />}
            busy={busy}
```

Remover o `useApiUsage`/`addTokens` deste arquivo: o import, a linha `const { addTokens } = useApiUsage();` e as duas chamadas `addTokens(...)` (uma no caminho não-SSE, outra no evento `done`).

- [ ] **Step 5: Soltar o `api-usage` do resto**

Em `modules/nexo/components/NexoWorkspace.tsx`, quatro remoções — o provider é montado aqui:

1. o import da linha 22: `import { ApiUsageProvider, useApiUsage } from "../state/api-usage";`
2. o `<ApiUsageProvider>` da linha 44 e o `</ApiUsageProvider>` da linha 50 (mantendo o `<ArtifactStoreProvider>` que fica entre eles);
3. a linha 58: `const { addTokens } = useApiUsage();`
4. as duas chamadas `addTokens(r.usage ?? 0)` (linhas ~342 e ~350).

Em `modules/nexo/components/NexoCopilot.tsx`: remover o import de `UsageArc` e o `<UsageArc />` (linha ~129), junto do comentário que o antecede.

Em `modules/nexo/components/ConfirmationCard.tsx`, dentro de `AuditoriaConfirmation`, após o `saveResult` da auditoria, disparar o refresh. O componente já tem o `conversationId` (Task 5); acrescentar o hook e a chamada:

```tsx
  const { refresh: refreshUsage } = useConversationUsage(conversationId);
```

```tsx
      refreshUsage();
```

- [ ] **Step 6: Apagar o que morreu**

```bash
grep -rn "UsageArc\|useApiUsage\|ApiUsageProvider" --include=*.ts --include=*.tsx .
```

Esperado: nenhuma ocorrência fora dos próprios arquivos a apagar. **Se sobrar qualquer importador, NÃO apagar** — corrigir o importador primeiro.

```bash
git rm modules/nexo/components/UsageArc.tsx modules/nexo/state/api-usage.tsx
```

- [ ] **Step 7: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint modules/nexo
```

Esperado: sem erro. Atenção ao React Compiler: o `refresh` do hook é `useCallback`, e nenhum `setState` novo roda síncrono no corpo de um effect.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/state/use-conversation-usage.ts modules/nexo/components/UsageDonut.tsx modules/nexo/components/NexoComposer.tsx modules/nexo/components/NexoChat.tsx modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/NexoCopilot.tsx modules/nexo/components/ConfirmationCard.tsx
git commit -m "Nexo: anel de consumo na barra (composicao por modelo, quebra por tarefa)"
```

---

### Task 8: Verificação final

**Files:** nenhum (só verificação; correções que aparecerem entram aqui).

- [ ] **Step 1: Suíte completa do Nexo**

```bash
npm run test:nexo:tomos && npm run test:nexo:check && npm run test:nexo:reconcile && npm run test:nexo:context && npm run test:nexo:attachments && npm run test:nexo:next-steps && npm run test:nexo:group && npm run test:nexo:agent && npm run test:nexo:parts && npm run test:nexo:session && npm run test:nexo:slots && npm run test:nexo:stream && npm run test:nexo:usage
```

Esperado: 13 suítes verdes, incluindo os 6 novos da agregação.

- [ ] **Step 2: Tipos, lint e build de produção**

```bash
npx tsc --noEmit && npx eslint . && npm run build
```

Esperado: `tsc` e `build` verdes. O `eslint .` tem **um erro pré-existente** em `components/audit-pdf-viewer-internal.tsx:70` (`react-hooks/immutability`), alheio a este trabalho — qualquer erro ALÉM desse é regressão e precisa ser corrigido.

- [ ] **Step 3: Prova dos três caminhos (manual, indispensável)**

Este é o passo que o plano existe para garantir. Com `npm run dev` e OpenAI configurado, numa conversa NOVA em `/nexo`:

1. Anexar pranchas e ler os selos → o anel aparece e o popover mostra **Leitura de selos**.
2. Pedir "cria a LD e a capa" → o popover ganha **Turnos da conversa**, e o total cresce.
3. Anexar um memorial e rodar a auditoria → o popover ganha **Auditoria do memorial**.
4. Somar as três linhas e conferir contra o banco:

```bash
npx prisma studio
```

Filtrando `AiUsageEvent` por aquele `conversationId`, a soma de `totalTokens` deve bater com o total do popover. **Se a auditoria não aparecer, alguma das 7 chamadas da Task 5 ficou sem o carimbo** — é o erro mais provável deste plano.

5. Recarregar a página e reabrir a mesma conversa pelo histórico → o anel volta com o mesmo número (prova que o recorte é a conversa, não a sessão).

- [ ] **Step 4: Commit de fechamento (se algo foi corrigido)**

```bash
git add <arquivos corrigidos>
git commit -m "Nexo: correcoes da verificacao final do anel de consumo"
```
