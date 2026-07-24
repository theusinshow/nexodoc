# Nexo — streaming, orb vivo e papel de chat: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a resposta do Nexo chegar transmitida (prosa primeiro, JSON das propostas no fim), alimentar de verdade o `activity`/`responding` da esfera, e tirar os atritos do chat (parar, retentar, auto-grow, scroll honesto, copiar).

**Architecture:** O prompt passa a pedir prosa seguida de uma cerca ` ```json ` com as propostas. Um separador puro (`split-stream.ts`, sem imports) fatia o fluxo em "o que vai pra tela" e "cauda de dados", e o mesmo módulo passa a ser o parser único do turno — inclusive do caminho não-streaming. A rota ganha um ramo SSE; o não-SSE continua idêntico. O chat consome os deltas com `AbortController`, e o store aprende a fazer uma mensagem crescer sem martelar o IndexedDB.

**Tech Stack:** Next.js (App Router, `runtime = "nodejs"`), React 19 + React Compiler, TypeScript, OpenAI SDK ^6.38 (Responses API com `stream: true`), IndexedDB via wrapper próprio, testes puros em node cru (type-stripping).

**Spec:** `docs/superpowers/specs/2026-07-24-nexo-streaming-orb-chat-design.md`

## Global Constraints

- **Testes puros rodam em node cru.** Módulos testados por `scripts/test-nexo-*.ts` não podem ter imports de runtime (só `import type`). Node não resolve o alias `@/` nem import sem extensão; nos scripts, importar por caminho relativo **com `.ts` explícito**.
- **React Compiler:** proibido tocar `ref.current` no corpo do render, e proibido `Date.now()`/`crypto.randomUUID()` no render. `setState` dentro de effect só via `rAF`/`setTimeout`.
- **Degradação obrigatória:** qualquer falha de formato da IA cai no comportamento de hoje (texto puro, sem propostas). Nunca mostrar JSON cru na tela; nunca perder a resposta.
- **A esfera aprovada não muda de aparência.** `agent-orb.shaders.ts` e `AgentOrbScene.tsx` **não são tocados**. A única mudança visual permitida é `paramsForState` passar a usar o `activity` que já recebe.
- **Idioma:** todo texto de UI e comentário em português do Brasil, seguindo o tom dos arquivos vizinhos.
- **Commits frequentes**, um por task, direto na `main` (preferência do usuário: sem branch/PR).
- **Nada de markdown na resposta** — fora de escopo por decisão registrada no spec.

---

## File Structure

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `server/nexo/agent/split-stream.ts` | **Criar.** Puro. Separa prosa de cauda JSON num fluxo em pedaços + `parseTail` (parser único do turno) | 1 |
| `scripts/test-nexo-stream.ts` | **Criar.** Smoke-test dos 6 casos do separador | 1 |
| `package.json` | **Modificar.** Script `test:nexo:stream` | 1 |
| `lib/ai-runner.ts` | **Modificar.** `executeOpenAiResponseStream` + exportar o tipo dos args | 2 |
| `server/nexo/agent/run-turn.ts` | **Modificar.** `runNexoAgentTurnStream`; prompt invertido; `parseTail` no lugar do parser local | 2 |
| `app/api/nexo/agent/route.ts` | **Modificar.** Ramo SSE; extrai o preâmbulo comum | 3 |
| `modules/nexo/state/conversation-store.tsx` | **Modificar.** `appendDelta` + `finalizeMessage` | 4 |
| `modules/nexo/types.ts` | **Modificar.** `interrupted?` em `NexoChatMessage` | 4 |
| `modules/nexo/components/NexoChat.tsx` | **Modificar.** Consome SSE, parar, retentar, scroll, copiar | 5, 6 |
| `modules/nexo/components/NexoComposer.tsx` | **Modificar.** Botão parar + auto-grow, nunca desabilita | 5, 6 |
| `modules/nexo/components/agent-orb/use-agent-state.ts` | **Modificar.** Sinal `responding` | 7 |
| `modules/nexo/components/agent-orb/agent-orb.types.ts` | **Modificar.** `reading` passa a usar `activity` | 7 |
| `modules/nexo/components/NexoCopilot.tsx` | **Modificar.** Repassa `activity` ao orb | 7 |
| `modules/nexo/components/NexoWorkspace.tsx` | **Modificar.** Deriva `activity` do `readProgress`/streaming | 7 |
| `modules/nexo/components/SuggestionCards.tsx` | **Apagar.** Morto | 8 |

---

### Task 1: Separador de fluxo puro (`split-stream.ts`)

Fundação de tudo. Sem dependência de nenhuma outra task.

**Files:**
- Create: `server/nexo/agent/split-stream.ts`
- Create: `scripts/test-nexo-stream.ts`
- Modify: `package.json:30` (adicionar script ao lado dos outros `test:nexo:*`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `createSplitState(): SplitState`
  - `pushChunk(state: SplitState, chunk: string): string` — devolve a prosa visível deste pedaço
  - `endStream(state: SplitState): { trailing: string; tail: string }`
  - `parseTail(tail: string): { reply: string | null; proposals: unknown }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-stream.ts`:

```ts
/**
 * Smoke-test do separador de fluxo do turno (prosa na tela, JSON na cauda).
 * Núcleo PURO (sem imports de runtime) → roda com node cru.
 *
 *   node scripts/test-nexo-stream.ts   (== npm run test:nexo:stream)
 */
import assert from "node:assert/strict";

import {
  createSplitState,
  pushChunk,
  endStream,
  parseTail,
} from "../server/nexo/agent/split-stream.ts";

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

/** Roda os pedaços pelo separador e devolve { visivel, cauda }. */
function run(chunks: string[]) {
  const state = createSplitState();
  let visivel = "";
  for (const c of chunks) visivel += pushChunk(state, c);
  const { trailing, tail } = endStream(state);
  return { visivel: visivel + trailing, cauda: tail };
}

test("prosa + cerca no fim -> prosa limpa, cauda com o JSON", () => {
  const r = run([
    "Li 15 folhas de estrutura.",
    " Qual título você quer na LD?",
    '\n```json\n{"proposals":[{"kind":"ld"}]}\n```',
  ]);
  assert.equal(r.visivel, "Li 15 folhas de estrutura. Qual título você quer na LD?");
  assert.match(r.cauda, /"kind":"ld"/);
});

test("cerca partida entre pedaços -> não vaza crase na tela", () => {
  const r = run(["Pronto.\n", "``", '`json\n{"proposals":[]}\n```']);
  assert.equal(r.visivel, "Pronto.\n");
  assert.match(r.cauda, /proposals/);
});

test("sem cerca nenhuma -> tudo é prosa, cauda vazia", () => {
  const r = run(["Não entendi o pedido.", " Pode repetir?"]);
  assert.equal(r.visivel, "Não entendi o pedido. Pode repetir?");
  assert.equal(r.cauda, "");
});

test("JSON solto sem cerca (após quebra de linha) -> vira cauda", () => {
  const r = run(['Segue a proposta.\n{"proposals":[{"kind":"capa"}]}']);
  assert.equal(r.visivel, "Segue a proposta.");
  assert.match(r.cauda, /"kind":"capa"/);
});

test("modelo devolve o JSON ANTIGO inteiro -> prosa vazia, tudo na cauda", () => {
  const r = run(['{"reply":"Olá","proposals":[{"kind":"ld"}]}']);
  assert.equal(r.visivel, "");
  const parsed = parseTail(r.cauda);
  assert.equal(parsed.reply, "Olá");
  assert.deepEqual(parsed.proposals, [{ kind: "ld" }]);
});

test("parseTail: cauda inválida não explode", () => {
  assert.deepEqual(parseTail("```json\n{quebrado"), { reply: null, proposals: null });
  assert.deepEqual(parseTail(""), { reply: null, proposals: null });
});

console.log(`\n${passed} teste(s) do separador de fluxo OK.`);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```bash
node scripts/test-nexo-stream.ts
```

Esperado: FALHA com erro de módulo não encontrado (`Cannot find module .../split-stream.ts`).

- [ ] **Step 3: Implementar o separador**

Criar `server/nexo/agent/split-stream.ts`:

```ts
/**
 * Separador do fluxo do turno: o que vai PRA TELA (prosa) e o que é CAUDA DE
 * DADOS (o JSON das propostas). O agente responde em prosa e só no fim abre uma
 * cerca ```json — porque JSON não se mostra pela metade.
 *
 * PURO, SEM IMPORTS de runtime (padrão de `light-check-core.ts`/`normalize.ts`):
 * roda em node cru, sem esbarrar no alias `@/`.
 *
 * Também é o PARSER ÚNICO do turno (`parseTail`) — o caminho não-streaming usa o
 * mesmo código, para não existirem dois parsers divergindo com o tempo.
 */

/** Marcadores que abrem a cauda. `\n{` pega o JSON solto, sem cerca. */
const MARKERS = ["```", "\n{"];

export interface SplitState {
  /** Já entrou na cauda: daqui pra frente nada mais vai pra tela. */
  inTail: boolean;
  /** Sufixo retido — pode ser o começo de um marcador partido entre pedaços. */
  held: string;
  /** Cauda acumulada (cerca + JSON). */
  tail: string;
  /** Já saiu alguma prosa? (decide se um "{" inicial é o JSON antigo inteiro) */
  emitted: boolean;
}

export function createSplitState(): SplitState {
  return { inTail: false, held: "", tail: "", emitted: false };
}

/**
 * Maior sufixo de `buf` que é começo (parcial) de algum marcador — o pedaço que
 * NÃO pode ser mostrado ainda porque o próximo chunk pode completar a cerca.
 */
function heldSuffixLength(buf: string): number {
  for (let n = Math.min(2, buf.length); n > 0; n--) {
    const suffix = buf.slice(buf.length - n);
    if (MARKERS.some((m) => m.length > n && m.startsWith(suffix))) return n;
  }
  return 0;
}

/** Consome um pedaço do fluxo e devolve a PROSA VISÍVEL dele (pode ser ""). */
export function pushChunk(state: SplitState, chunk: string): string {
  if (state.inTail) {
    state.tail += chunk;
    return "";
  }

  let buf = state.held + chunk;
  state.held = "";

  // Modelo desobedeceu e mandou o JSON antigo inteiro: a resposta ABRE com "{".
  // Sem isto, o JSON cru iria pra tela.
  if (!state.emitted) {
    const lead = buf.trimStart();
    if (lead === "") {
      state.held = buf; // só espaço até agora — ainda não dá pra decidir
      return "";
    }
    if (lead.startsWith("{")) {
      state.inTail = true;
      state.tail = lead;
      return "";
    }
  }

  // Marcador mais cedo no buffer abre a cauda.
  let cut = -1;
  for (const marker of MARKERS) {
    const i = buf.indexOf(marker);
    if (i !== -1 && (cut === -1 || i < cut)) cut = i;
  }
  if (cut !== -1) {
    state.inTail = true;
    state.tail = buf.slice(cut);
    const visible = buf.slice(0, cut);
    if (visible) state.emitted = true;
    return visible;
  }

  // Sem marcador: retém o sufixo ambíguo (cerca partida entre pedaços).
  const hold = heldSuffixLength(buf);
  if (hold > 0) {
    state.held = buf.slice(buf.length - hold);
    buf = buf.slice(0, buf.length - hold);
  }
  if (buf) state.emitted = true;
  return buf;
}

/** Fecha o fluxo: solta o sufixo retido (não era cerca) e entrega a cauda. */
export function endStream(state: SplitState): { trailing: string; tail: string } {
  const trailing = state.inTail ? "" : state.held;
  state.held = "";
  return { trailing, tail: state.tail };
}

/**
 * Lê a cauda. Tolerante a cercas e a prosa em volta. Devolve `reply` quando o
 * modelo mandou o JSON antigo inteiro (rede de segurança do formato velho).
 */
export function parseTail(tail: string): { reply: string | null; proposals: unknown } {
  const cleaned = tail.replace(/```json/gi, "```").replace(/```/g, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return { reply: null, proposals: null };
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      reply?: unknown;
      proposals?: unknown;
    };
    return {
      reply: typeof parsed.reply === "string" ? parsed.reply : null,
      proposals: parsed.proposals ?? null,
    };
  } catch {
    return { reply: null, proposals: null };
  }
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```bash
node scripts/test-nexo-stream.ts
```

Esperado: 6 linhas `ok` e `6 teste(s) do separador de fluxo OK.`

- [ ] **Step 5: Registrar o script no package.json**

Em `package.json`, junto dos outros `test:nexo:*` (após a linha `"test:nexo:slots"`), adicionar:

```json
"test:nexo:stream": "node scripts/test-nexo-stream.ts",
```

Rodar `npm run test:nexo:stream` e conferir a mesma saída.

- [ ] **Step 6: Commit**

```bash
git add server/nexo/agent/split-stream.ts scripts/test-nexo-stream.ts package.json
git commit -m "Nexo: separador de fluxo do turno (prosa na tela, JSON na cauda)"
```

---

### Task 2: Streaming no runner e no cérebro

**Files:**
- Modify: `lib/ai-runner.ts` (exportar `ExecuteOpenAiResponseArgs`; adicionar `executeOpenAiResponseStream` no fim do arquivo)
- Modify: `server/nexo/agent/run-turn.ts` (prompt invertido; `parseTail`; `runNexoAgentTurnStream`)

**Interfaces:**
- Consumes: `createSplitState`, `pushChunk`, `endStream`, `parseTail` da Task 1.
- Produces:
  - `executeOpenAiResponseStream(args: ExecuteOpenAiResponseArgs, externalSignal?: AbortSignal): AsyncGenerator<AiStreamEvent>` onde `AiStreamEvent = { type: "delta"; text: string } | { type: "done"; text: string; usage: number }`
  - `runNexoAgentTurnStream(input: RunNexoAgentTurnInput, signal?: AbortSignal): AsyncGenerator<NexoTurnEvent>` onde `NexoTurnEvent = { type: "delta"; text: string } | { type: "done"; reply: string; proposals: NexoAgentProposal[]; usage: number }`
  - `providerSupportsStreaming(): boolean`

- [ ] **Step 1: Exportar o tipo dos args no runner**

Em `lib/ai-runner.ts:26`, trocar `type ExecuteOpenAiResponseArgs = {` por:

```ts
export type ExecuteOpenAiResponseArgs = {
```

- [ ] **Step 2: Adicionar o runner de streaming**

No fim de `lib/ai-runner.ts`, acrescentar:

```ts
export type AiStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; text: string; usage: number };

/**
 * Variante TRANSMITIDA do runner. Só OpenAI (Responses API com `stream: true`);
 * DeepSeek não entra aqui — quem chama usa `providerSupportsStreaming()` e cai
 * no `executeOpenAiResponse` normal.
 *
 * Mantém a "prova de vida" no log e o registro de consumo, como o runner normal.
 * `externalSignal` é o abortar do usuário (botão parar) — sem ele, parar seria
 * só visual e o modelo seguiria gerando (e cobrando).
 */
export async function* executeOpenAiResponseStream(
  args: ExecuteOpenAiResponseArgs,
  externalSignal?: AbortSignal,
): AsyncGenerator<AiStreamEvent, void, unknown> {
  await refreshAiModelOverrideCache();

  const provider = getProviderForFlow(args.flow);
  if (provider !== "openai") {
    throw new Error(`streaming indisponível para o provider ${provider}`);
  }

  const timeoutMs = args.timeoutMs ?? getDefaultTimeoutMs();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onAbort);
  const startedAt = Date.now();

  try {
    const stream = await getOpenAIClient().responses.create(
      { ...args.request, stream: true },
      { signal: controller.signal },
    );

    let text = "";
    let finalResponse: unknown = null;
    for await (const event of stream as AsyncIterable<{
      type?: string;
      delta?: string;
      response?: unknown;
    }>) {
      if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
        text += event.delta;
        yield { type: "delta", text: event.delta };
      } else if (event.type === "response.completed") {
        finalResponse = event.response;
      }
    }

    const durationMs = Date.now() - startedAt;
    const usage = extractTokenUsage(finalResponse);
    console.log(
      `[ai] flow=${args.flow} op=${args.operation} provider=${provider} model=${args.model} status=OK-stream in=${usage.inputTokens} out=${usage.outputTokens} total=${usage.totalTokens} ${durationMs}ms`,
    );
    await recordAiUsage({
      flow: args.flow,
      provider,
      model: args.model,
      operation: args.operation,
      response: finalResponse,
      durationMs,
      metadata: args.metadata,
      userEmail: args.userEmail,
    });

    yield { type: "done", text, usage: usage.totalTokens };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const failure = classifyProviderFailure(provider, args.flow, args.model, error);
    console.error(
      `[ai] flow=${args.flow} op=${args.operation} provider=${provider} model=${args.model} status=FAILED-stream categoria=${failure.category} ${durationMs}ms :: ${String((error as { message?: string })?.message ?? error).slice(0, 200)}`,
    );
    recordProviderFailure(failure);
    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", onAbort);
  }
}
```

- [ ] **Step 3: Inverter o formato no prompt**

Em `server/nexo/agent/run-turn.ts`, substituir o bloco final do prompt (as linhas de
`Responda SOMENTE com um JSON válido nesta forma (sem texto fora do JSON):` até
`pediu neste turno).`) por:

```
Formato da resposta, nesta ordem:

1) Primeiro escreva a resposta ao engenheiro em TEXTO PURO (sem JSON, sem cercas,
   sem markdown) — curta e direta, afirmando os fatos e pedindo a confirmação ou
   a decisão que falta.

2) Depois, e SÓ depois, uma cerca com as propostas:

```json
{
  "proposals": [
    { "kind": "ld", "resumo": "LD <disciplina> · <código> · N folhas",
      "tituloLd": "", "numTomos": 1 },
    { "kind": "capa", "resumo": "Capa <prefeitura>", "templateId": "<id>",
      "volume": "", "numTomos": 1 },
    { "kind": "separatriz", "resumo": "Separatriz <prefeitura>",
      "templateId": "<id>", "numTomos": 1 },
    { "kind": "auditoria", "resumo": "Auditoria <disciplina>",
      "nivel": "standard" },
    { "kind": "conferencia", "resumo": "Conferência <disciplina>" },
    { "kind": "volume", "resumo": "Volume <disciplina>" }
  ]
}
```

Inclua no array proposals apenas os artefatos pedidos (0+; só os que o engenheiro
pediu neste turno). Se não houver nenhum, mande "proposals": [].
NUNCA escreva JSON antes do texto. NUNCA repita o texto dentro do JSON.
```

- [ ] **Step 3b: Extrair o request comum aos dois caminhos**

Os dois turnos (single-shot e transmitido) mandam exatamente o mesmo `request` e os
mesmos `metadata`. Extrair antes de duplicar. Acrescentar em `run-turn.ts`, logo
acima de `runNexoAgentTurn`:

```ts
/** Request idêntico nos dois caminhos (single-shot e transmitido). */
function buildTurnRequest(input: RunNexoAgentTurnInput, model: string) {
  return {
    model,
    instructions:
      "Você é o Nexo: interpreta o pedido e propõe parâmetros de LD/capa. " +
      "Nunca gera documentos. Responde em texto puro e só no FINAL abre uma " +
      "cerca ```json com as propostas.",
    reasoning: { effort: getReasoningEffort() },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    input: buildPrompt(input),
  };
}

/** Metadados de telemetria idênticos nos dois caminhos. */
function buildTurnMetadata(input: RunNexoAgentTurnInput) {
  return {
    disciplina: input.resumo.disciplina,
    folhas: input.resumo.totalFolhas,
    prefeituras: input.prefeituras.length,
  };
}
```

E trocar o corpo da chamada em `runNexoAgentTurn` (linhas 178-196) por:

```ts
  const model = getAiConfiguration().nexoAgent.model;
  const ai = await executeOpenAiResponse({
    flow: "nexo-agent",
    model,
    operation: "nexo-agent-turn",
    metadata: buildTurnMetadata(input),
    request: buildTurnRequest(input, model),
  });
```

- [ ] **Step 4: Usar o parser único e adicionar o turno transmitido**

Em `server/nexo/agent/run-turn.ts`, trocar os imports do topo:

```ts
import {
  executeOpenAiResponse,
  executeOpenAiResponseStream,
} from "@/lib/ai-runner";
import { getAiConfiguration, getNexoProvider } from "@/lib/ai-providers";
import type { NexoAgentProposal, NexoAgentTurn } from "@/modules/nexo/types";
import { normalizeProposals } from "./normalize";
import { createSplitState, pushChunk, endStream, parseTail } from "./split-stream";
```

Apagar a função local `parseFirstJsonObject` (linhas 68-79) — `parseTail` a substitui.

Em `runNexoAgentTurn`, trocar o bloco de parse (linhas 200-219) por:

```ts
  const parsed = parseTail(text);
  const prosa = text.split(/```/)[0]?.trim() ?? "";
  const reply =
    (parsed.reply ?? "").trim() ||
    prosa ||
    "Segue a proposta abaixo — confira e confirme.";
  return {
    reply,
    proposals: normalizeProposals(parsed.proposals, {
      disciplina: input.resumo.disciplina,
      prefeituras: input.prefeituras,
    }),
    usage,
  };
```

E acrescentar, no fim do arquivo:

```ts
export type NexoTurnEvent =
  | { type: "delta"; text: string }
  | {
      type: "done";
      reply: string;
      proposals: NexoAgentProposal[];
      usage: number;
    };

/** O provider resolvido para o flow do Nexo consegue transmitir? */
export function providerSupportsStreaming(): boolean {
  return getNexoProvider() === "openai";
}

/**
 * Turno TRANSMITIDO. A prosa sai em deltas conforme chega; as propostas só no
 * fim (vêm na cauda JSON). Em qualquer falha de formato, degrada: se não houver
 * cauda, o turno termina com o texto que apareceu e zero propostas.
 */
export async function* runNexoAgentTurnStream(
  input: RunNexoAgentTurnInput,
  signal?: AbortSignal,
): AsyncGenerator<NexoTurnEvent, void, unknown> {
  const model = getAiConfiguration().nexoAgent.model;
  const state = createSplitState();
  let visible = "";
  let usage = 0;

  const stream = executeOpenAiResponseStream(
    {
      flow: "nexo-agent",
      model,
      operation: "nexo-agent-turn",
      metadata: buildTurnMetadata(input),
      request: buildTurnRequest(input, model),
    },
    signal,
  );

  for await (const event of stream) {
    if (event.type === "delta") {
      const chunk = pushChunk(state, event.text);
      if (chunk) {
        visible += chunk;
        yield { type: "delta", text: chunk };
      }
    } else {
      usage = event.usage;
    }
  }

  const { trailing, tail } = endStream(state);
  if (trailing) {
    visible += trailing;
    yield { type: "delta", text: trailing };
  }

  const parsed = parseTail(tail);
  // Rede de segurança: modelo mandou o JSON antigo inteiro (prosa vazia).
  const reply =
    visible.trim() ||
    (parsed.reply ?? "").trim() ||
    "Segue a proposta abaixo — confira e confirme.";
  if (!visible.trim() && reply) {
    yield { type: "delta", text: reply };
  }

  yield {
    type: "done",
    reply,
    proposals: normalizeProposals(parsed.proposals, {
      disciplina: input.resumo.disciplina,
      prefeituras: input.prefeituras,
    }),
    usage,
  };
}
```

- [ ] **Step 5: Exportar `getNexoProvider`**

`providerSupportsStreaming` precisa dele, e hoje ele é privado do módulo. Em
`lib/ai-providers.ts:172`, trocar:

```ts
function getNexoProvider(): "openai" | "deepseek" {
```

por:

```ts
export function getNexoProvider(): "openai" | "deepseek" {
```

Nada mais muda: o uso interno na linha 230 continua igual.

- [ ] **Step 6: Verificar tipos e lint**

```bash
npx tsc --noEmit
npx eslint lib/ai-runner.ts lib/ai-providers.ts server/nexo/agent/run-turn.ts server/nexo/agent/split-stream.ts
```

Esperado: ambos sem erro.

- [ ] **Step 7: Conferir que nada regrediu**

```bash
npm run test:nexo:agent && npm run test:nexo:stream
```

Esperado: 11/11 e 6/6.

- [ ] **Step 8: Commit**

```bash
git add lib/ai-runner.ts lib/ai-providers.ts server/nexo/agent/run-turn.ts
git commit -m "Nexo: turno transmitido (prosa em deltas, propostas na cauda)"
```

---

### Task 3: Ramo SSE na rota do agente

**Files:**
- Modify: `app/api/nexo/agent/route.ts`

**Interfaces:**
- Consumes: `runNexoAgentTurnStream`, `providerSupportsStreaming` (Task 2); `buildSlotRequestForTurn` (já existe).
- Produces: rota que responde `text/event-stream` quando o cliente pede. Eventos:
  - `data: {"type":"delta","text":"…"}`
  - `data: {"type":"done","proposals":[…],"slotRequest":{…}|null,"ldPreview":{…},"usage":123}`
  - `data: {"type":"error","error":"…"}`

- [ ] **Step 1: Trocar o bloco final da rota**

Em `app/api/nexo/agent/route.ts`, substituir o `try { … } catch { … }` das linhas
95-118 por:

```ts
  const now = new Date();
  const slotContext = {
    selos,
    disciplina: resumo.disciplina,
    obra: resumo.obra,
    prefeituras,
    mesAtual: now.getMonth() + 1,
    anoAtual: now.getFullYear(),
  };

  const wantsStream = (req.headers.get("accept") ?? "").includes("text/event-stream");

  // Caminho TRANSMITIDO: a prosa sai em deltas; propostas/slotRequest/ldPreview
  // só no `done` (dependem da cauda JSON, que chega no fim).
  if (wantsStream && providerSupportsStreaming()) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };
        try {
          for await (const event of runNexoAgentTurnStream(
            { message, history, resumo, prefeituras },
            req.signal,
          )) {
            if (event.type === "delta") {
              send({ type: "delta", text: event.text });
            } else {
              send({
                type: "done",
                proposals: event.proposals,
                slotRequest: buildSlotRequestForTurn(event.proposals, slotContext) ?? null,
                ldPreview,
                usage: event.usage,
              });
            }
          }
        } catch (err) {
          // Abortar não é falha: o usuário apertou parar.
          if (!req.signal.aborted) {
            send({
              type: "error",
              error:
                err instanceof Error ? err.message : "Falha ao processar a conversa.",
            });
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Sem isto, proxies com buffer seguram os deltas e o streaming some.
        "X-Accel-Buffering": "no",
      },
    });
  }

  // Caminho de sempre (não-SSE / provider sem streaming): resposta única.
  try {
    const turn = await runNexoAgentTurn({ message, history, resumo, prefeituras });
    const slotRequest = buildSlotRequestForTurn(turn.proposals, slotContext);
    return NextResponse.json({ turn: { ...turn, slotRequest }, ldPreview });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Falha ao processar a conversa.",
      },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 2: Atualizar o import da rota**

Em `app/api/nexo/agent/route.ts:7-10`:

```ts
import {
  runNexoAgentTurn,
  runNexoAgentTurnStream,
  providerSupportsStreaming,
  type NexoAgentPrefeitura,
} from "@/server/nexo/agent/run-turn";
```

- [ ] **Step 3: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint app/api/nexo/agent/route.ts
```

Esperado: sem erro.

- [ ] **Step 4: Commit**

```bash
git add app/api/nexo/agent/route.ts
git commit -m "Nexo: rota do agente responde SSE (mantem o JSON para quem nao pede)"
```

---

### Task 4: Store aprende a fazer uma mensagem crescer

**Files:**
- Modify: `modules/nexo/state/conversation-store.tsx`
- Modify: `modules/nexo/types.ts:299-306`

**Interfaces:**
- Consumes: nada das tasks anteriores.
- Produces (no `ConversationStoreValue`):
  - `appendDelta: (id: string, text: string) => void`
  - `finalizeMessage: (id: string, patch: { proposals?: NexoAgentProposal[]; slotRequest?: NexoSlotRequest; ldPreview?: LdPreviewData; interrupted?: boolean }) => void`

- [ ] **Step 1: Marcar mensagem interrompida no tipo**

Em `modules/nexo/types.ts`, dentro de `interface NexoChatMessage`, acrescentar após `ldPreview`:

```ts
  /** Turno interrompido pelo usuário (texto parcial, sem propostas). */
  interrupted?: boolean;
```

- [ ] **Step 2: Adicionar os métodos ao contrato do store**

Em `modules/nexo/state/conversation-store.tsx`, em `interface ConversationStoreValue`,
logo após `appendMessage`:

```ts
  /** Faz a última mensagem crescer (streaming). NÃO persiste — só memória. */
  appendDelta: (id: string, text: string) => void;
  /** Fecha o turno transmitido e persiste de uma vez. */
  finalizeMessage: (
    id: string,
    patch: {
      proposals?: NexoAgentProposal[];
      slotRequest?: NexoSlotRequest;
      ldPreview?: LdPreviewData;
      interrupted?: boolean;
    },
  ) => void;
```

Garantir os `import type` de `NexoAgentProposal`, `NexoSlotRequest` e `LdPreviewData`
vindos de `../types` no topo do arquivo (o arquivo já importa `NexoChatMessage` de lá).

- [ ] **Step 3: Implementar os métodos**

Em `conversation-store.tsx`, logo depois de `appendMessage` (linha ~221):

```ts
  // Crescimento por delta: mexe SÓ no estado em memória. Persistir a cada token
  // viraria centenas de gravações no IndexedDB por resposta — o `finalizeMessage`
  // grava uma vez, no fim.
  const appendDelta = useCallback((id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
    );
  }, []);

  const finalizeMessage = useCallback(
    (
      id: string,
      patch: {
        proposals?: NexoAgentProposal[];
        slotRequest?: NexoSlotRequest;
        ldPreview?: LdPreviewData;
        interrupted?: boolean;
      },
    ) => {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
        setTitle((t) => deriveTitle(t, next, snapshotRef.current.seloResults));
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );
```

- [ ] **Step 4: Expor no value do provider**

Localizar o objeto passado ao `ConversationStoreContext.Provider` (o `value`) e
acrescentar `appendDelta,` e `finalizeMessage,` na lista, junto de `appendMessage`.
Se o `value` estiver memoizado com `useMemo`, incluir os dois no array de dependências.

- [ ] **Step 5: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint modules/nexo/state/conversation-store.tsx modules/nexo/types.ts
```

Esperado: sem erro. Atenção ao React Compiler: nenhum dos métodos novos toca
`ref.current` durante o render.

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/state/conversation-store.tsx modules/nexo/types.ts
git commit -m "Nexo: store faz mensagem crescer por delta (persiste so no fim)"
```

---

### Task 5: Chat consome o fluxo — parar e retentar

**Files:**
- Modify: `modules/nexo/components/NexoChat.tsx`
- Modify: `modules/nexo/components/NexoComposer.tsx`

**Interfaces:**
- Consumes: `appendDelta`/`finalizeMessage` (Task 4); protocolo SSE (Task 3).
- Produces: `NexoChat` reporta `{ thinking, error, streaming, activity }` via `onTurnStatus` — a Task 7 consome isso.

- [ ] **Step 1: Composer com botão parar, sem desabilitar**

Em `modules/nexo/components/NexoComposer.tsx`, trocar a assinatura e o corpo do
`textarea`/botão. Props novas: `onStop`. O `busy` deixa de desabilitar o campo.

```tsx
import type { RefObject } from "react";
import { Paperclip, Send, Square } from "lucide-react";
```

Props:

```tsx
export function NexoComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  variant,
  onAttach,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  /** Aborta o turno em andamento (o enviar vira parar enquanto `busy`). */
  onStop?: () => void;
  busy: boolean;
  variant: "hero" | "docked";
  onAttach?: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
```

O `textarea` perde o `disabled` e ganha auto-grow (a altura acompanha o conteúdo
até o teto do `max-h-32`):

```tsx
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onInput={(e) => {
            // Auto-grow: zera e reassume a altura do conteúdo (o max-h corta).
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${el.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy) onSubmit();
            }
          }}
          rows={1}
          placeholder={
            isHero
              ? "Peça em texto: “cria a LD e a capa dessas pranchas”…"
              : "Escreva para o Nexo…"
          }
          className="max-h-32 min-h-9 min-w-0 flex-1 resize-none self-center overflow-y-auto bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
```

E o botão da direita vira parar durante o turno:

```tsx
        {busy && onStop ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Parar"
            className="shrink-0 rounded-sm p-1.5 text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            <Square className="h-4 w-4 fill-current" aria-hidden />
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={busy || !value.trim()}
            aria-label="Enviar"
            className="shrink-0 rounded-sm p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" aria-hidden />
          </button>
        )}
```

- [ ] **Step 2: Chat lê o SSE**

Em `modules/nexo/components/NexoChat.tsx`, trocar a função `send` inteira
(linhas 93-132) por:

```tsx
  const { messages, appendMessage, appendDelta, finalizeMessage } = useConversation();
  // …demais hooks…
  const abortRef = useRef<AbortController | null>(null);
  // Última mensagem do usuário — o "tentar de novo" reenvia esta.
  const [lastSent, setLastSent] = useState<string | null>(null);

  function stop() {
    abortRef.current?.abort();
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    onSend?.();
    setError(null);
    const userMsg: NexoChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    appendMessage(userMsg);
    setLastSent(text);
    setInput("");
    setBusy(true);

    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    let started = false;

    try {
      const res = await fetch("/api/nexo/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: text, history, selos }),
        signal: controller.signal,
      });

      const isStream = (res.headers.get("content-type") ?? "").includes("text/event-stream");

      // Caminho não transmitido (provider sem streaming): igual ao de sempre.
      if (!isStream) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; turn?: NexoAgentTurn; ldPreview?: LdPreviewData }
          | null;
        if (!res.ok || !payload?.turn) {
          throw new Error(payload?.error ?? "Falha ao conversar com o Nexo.");
        }
        addTokens(payload.turn.usage ?? 0);
        setRevealId(assistantId); // sem streaming, o typewriter ainda vale
        appendMessage({
          id: assistantId,
          role: "assistant",
          content: payload.turn.reply,
          proposals: payload.turn.proposals,
          slotRequest: payload.turn.slotRequest,
          ldPreview: payload.ldPreview,
        });
        return;
      }

      if (!res.ok || !res.body) throw new Error("Falha ao conversar com o Nexo.");

      // Bolha vazia que vai crescendo com os deltas.
      appendMessage({ id: assistantId, role: "assistant", content: "" });
      started = true;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE: eventos separados por linha em branco.
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | {
                type: "done";
                proposals: NexoAgentTurn["proposals"];
                slotRequest?: NexoAgentTurn["slotRequest"] | null;
                ldPreview?: LdPreviewData;
                usage?: number;
              }
            | { type: "error"; error: string };

          if (event.type === "delta") {
            appendDelta(assistantId, event.text);
          } else if (event.type === "done") {
            addTokens(event.usage ?? 0);
            finalizeMessage(assistantId, {
              proposals: event.proposals,
              ...(event.slotRequest ? { slotRequest: event.slotRequest } : {}),
              ...(event.ldPreview ? { ldPreview: event.ldPreview } : {}),
            });
          } else {
            streamError = event.error;
          }
        }
      }

      if (streamError) throw new Error(streamError);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      if (aborted) {
        // Parou: guarda o parcial marcado como interrompido, sem cards.
        if (started) finalizeMessage(assistantId, { interrupted: true });
      } else {
        setError(err instanceof Error ? err.message : "Erro na conversa.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function retry() {
    if (!lastSent || busy) return;
    setError(null);
    void send(lastSent);
  }
```

- [ ] **Step 3: Ligar parar e retentar na UI**

No JSX de `NexoChat`, trocar o bloco de erro (linhas 220-226) por:

```tsx
      {error && (
        <div className="mx-auto w-full max-w-[46rem] px-4">
          <div
            role="alert"
            className="mb-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={retry}
              className="shrink-0 rounded-sm px-2 py-1 text-xs font-medium underline underline-offset-2 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}
```

E passar o `onStop` ao composer:

```tsx
          <NexoComposer
            variant="docked"
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            onStop={stop}
            busy={busy}
            onAttach={onAttach}
            inputRef={inputRef}
          />
```

- [ ] **Step 4: Indicador de digitação só ANTES do primeiro delta**

O bloco `{busy && (…)}` dos três pontinhos (linhas 201-216) precisa sumir assim que
o texto começa a chegar, senão fica um balão vazio junto do que cresce. Trocar a
condição por:

```tsx
          {busy && messages[messages.length - 1]?.role === "user" && (
```

- [ ] **Step 5: Marcar visualmente a resposta interrompida**

No `map` das mensagens, logo após `<MessageBubble … />`, acrescentar:

```tsx
              {m.interrupted && (
                <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                  interrompido
                </span>
              )}
```

- [ ] **Step 6: Reportar o estado do turno pro orb**

Trocar o effect de `onTurnStatus` (linhas 88-91) e o tipo da prop por:

```tsx
  /** Reporta o estado do turno pro Nexo Core (analyzing/responding/erro). */
  onTurnStatus?: (s: {
    thinking: boolean;
    error: boolean;
    responding: boolean;
  }) => void;
```

```tsx
  // `responding` = já chegou texto (o modelo saiu do raciocínio e está escrevendo).
  const responding =
    busy && messages[messages.length - 1]?.role === "assistant";

  useEffect(() => {
    onTurnStatus?.({ thinking: busy, error: error != null, responding });
  }, [busy, error, responding, onTurnStatus]);
```

- [ ] **Step 7: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint modules/nexo/components/NexoChat.tsx modules/nexo/components/NexoComposer.tsx
```

Esperado: sem erro. Se o eslint do React Compiler reclamar de `abortRef` no render,
conferir que ele só é lido dentro de `send`/`stop` (handlers), nunca no corpo do
componente.

- [ ] **Step 8: Ajustar o chamador que quebrou**

`NexoCopilot.tsx` repassa `onTurnStatus`; `NexoWorkspace.tsx:496-505` consome. O tipo
mudou (ganhou `responding`), então o `tsc` do passo anterior aponta os dois. Corrigir
o tipo da prop em `NexoCopilot.tsx:54`:

```tsx
  onTurnStatus?: (s: { thinking: boolean; error: boolean; responding: boolean }) => void;
```

E em `NexoWorkspace.tsx`, o estado e o handler:

```tsx
  const [chatStatus, setChatStatus] = useState({
    thinking: false,
    error: false,
    responding: false,
  });
  const handleTurnStatus = useCallback(
    (s: { thinking: boolean; error: boolean; responding: boolean }) => setChatStatus(s),
    [],
  );
```

Rodar `npx tsc --noEmit` de novo — esperado: sem erro.

- [ ] **Step 9: Commit**

```bash
git add modules/nexo/components/NexoChat.tsx modules/nexo/components/NexoComposer.tsx modules/nexo/components/NexoCopilot.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: chat consome o fluxo transmitido (parar, tentar de novo, auto-grow)"
```

---

### Task 6: Log honesto — scroll e copiar

**Files:**
- Modify: `modules/nexo/components/NexoChat.tsx`

**Interfaces:**
- Consumes: nada novo.
- Produces: nada consumido por outras tasks.

- [ ] **Step 1: Scroll que respeita quem rolou pra cima**

Em `NexoChat.tsx`, trocar o effect de scroll (linhas 84-86) por:

```tsx
  // Só gruda no fim se o usuário JÁ estava no fim (margem de 64px p/ subpixel).
  // Quem rolou pra cima pra reler não é arrancado de lá.
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    if (!atBottom) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, atBottom]);
```

E o container do log ganha o handler:

```tsx
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversa com o Nexo"
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 64);
        }}
        className="relative min-h-0 flex-1 overflow-y-auto"
      >
```

- [ ] **Step 2: Botão "novas mensagens" quando está rolado pra cima**

Logo antes do fechamento do container do log (depois do `</div>` da coluna interna),
acrescentar:

```tsx
        {!atBottom && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              setAtBottom(true);
            }}
            className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--nexodoc-recessed)] px-3 py-1.5 text-xs text-foreground shadow-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            ↓ novas mensagens
          </button>
        )}
```

- [ ] **Step 3: Copiar a resposta**

Substituir o componente `MessageBubble` (linhas 300-328) por uma versão com botão de
copiar no hover (só do assistente):

```tsx
/**
 * Bolha da mensagem. Assistente = vidro fraco (chrome do agente); usuário =
 * recessed matte (dado). Cantos assimétricos discretos, sem borda gritante.
 * A resposta do Nexo ganha "copiar" no hover — o engenheiro cola no e-mail.
 */
function MessageBubble({
  role,
  content,
  reveal = false,
}: {
  role: "user" | "assistant";
  content: string;
  /** Revela o texto progressivamente (só no caminho SEM streaming). */
  reveal?: boolean;
}) {
  const isUser = role === "user";
  const shown = useRevealText(content, reveal);
  const [copied, setCopied] = useState(false);

  // O "copiado" volta sozinho. setState em timeout (nunca no corpo do render).
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="group/msg relative max-w-[85%]">
      <div
        className={
          isUser
            ? "whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--nexodoc-recessed)] px-4 py-2.5 text-[15px] leading-[1.55] text-foreground"
            : "nexo-glass nexo-glass--weak whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-[1.6] text-foreground"
        }
      >
        <span className="sr-only">{isUser ? "Você" : "Nexo"}: </span>
        {shown}
      </div>
      {!isUser && content.trim() !== "" && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(content).then(() => setCopied(true));
          }}
          aria-label="Copiar resposta"
          className="absolute -bottom-2 right-1 rounded-md border border-border bg-card px-1.5 py-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 group-hover/msg:opacity-100"
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Copy className="h-3 w-3" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
```

Atualizar o import de ícones no topo do arquivo:

```tsx
import { Loader2, FileText, X, Copy, Check } from "lucide-react";
```

Como a bolha agora tem `max-w-[85%]` no wrapper, remover o `max-w-[80%]`/`max-w-[85%]`
que estava nas classes internas (já feito no código acima).

- [ ] **Step 4: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint modules/nexo/components/NexoChat.tsx
```

Esperado: sem erro.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/NexoChat.tsx
git commit -m "Nexo: log honesto (scroll respeita leitura, copiar resposta)"
```

---

### Task 7: Orb vivo — `activity` real e `responding`

**Files:**
- Modify: `modules/nexo/components/agent-orb/use-agent-state.ts`
- Modify: `modules/nexo/components/agent-orb/agent-orb.types.ts:70-71`
- Modify: `modules/nexo/components/NexoCopilot.tsx`
- Modify: `modules/nexo/components/NexoWorkspace.tsx`

**Interfaces:**
- Consumes: `chatStatus.responding` (Task 5); `readProgress` (já existe em `NexoWorkspace:195`).
- Produces: nada consumido por outras tasks.

**`AgentOrbScene.tsx` e `agent-orb.shaders.ts` NÃO são tocados.** O `activity` já
chega até eles pela prop; a única mudança de mapeamento é o `reading` passar a usar
o valor que já recebia e ignorava.

- [ ] **Step 1: `useAgentState` ganha o sinal `responding`**

Em `use-agent-state.ts`, acrescentar ao `AgentSignals`:

```ts
  /** Turno já está ESCREVENDO (primeiro delta chegou). */
  responding?: boolean;
```

Atualizar a assinatura e a prioridade (comentário do topo também):

```ts
export function useAgentState({
  dragging,
  reading,
  thinking,
  responding,
  error,
}: AgentSignals): AgentState {
```

E no retorno, `responding` entra ANTES de `analyzing` (escrever é mais específico
que pensar):

```ts
  if (transient === "error") return "error";
  if (dragging) return "dragging";
  if (reading) return "reading";
  if (responding) return "responding";
  if (thinking) return "analyzing";
  if (transient === "complete") return "complete";
  return "idle";
```

Atualizar a linha 10 do comentário do topo para:
`* Prioridade: error > dragging > reading > responding > analyzing > complete > idle.`

- [ ] **Step 2: `reading` passa a usar o `activity`**

Em `agent-orb.types.ts`, trocar o case `reading` (linha 70-71) por:

```ts
    case "reading":
      // `scan` acompanha o progresso real da leitura (0..1): o plano varre a
      // esfera conforme as pranchas são lidas, em vez de varrer sempre igual.
      return {
        distortion: 0.08,
        pulse: 0.32 + a * 0.18,
        rim: 0.72,
        scan: 0.35 + a * 0.65,
        spin: 0.2,
        jitter: 0,
      };
```

Atualizar o comentário do bloco (linhas 53-57) para refletir que `activity` agora vale
para `reading` e `responding`:

```ts
/**
 * Alvos por estado. Coerente com engenharia/CAD: movimento lento, nada frenético.
 * `reading` usa `activity` como PROGRESSO da leitura (done/total); `responding`
 * usa como CADÊNCIA do texto que chega.
 */
```

- [ ] **Step 3: `NexoCopilot` repassa o `activity`**

Em `NexoCopilot.tsx`, adicionar a prop e repassá-la ao orb:

```tsx
  /** Atividade real 0..1: progresso da leitura ou cadência do texto. */
  activity?: number;
```

Na desestruturação, junto de `fileCount = 0`: `activity = 0,`

E no `<AgentOrb …>`:

```tsx
            <AgentOrb
              state={agentState}
              fileCount={fileCount}
              activity={activity}
              size={started ? "compact" : "hero"}
              interactive
              onActivate={() => setPopoverOpen((o) => !o)}
            />
```

- [ ] **Step 4: `NexoWorkspace` deriva o `activity`**

Em `NexoWorkspace.tsx`, junto do bloco do `useAgentState` (linha ~501):

```tsx
  // Cadência do texto que chega: cada delta empurra pra 1, e decai no silêncio.
  // Não existe "fração" no streaming (não se sabe o tamanho final da resposta).
  const [replyPulse, setReplyPulse] = useState(0);
  useEffect(() => {
    if (!chatStatus.responding) {
      setReplyPulse(0);
      return;
    }
    const id = setInterval(() => {
      setReplyPulse((p) => (p > 0.55 ? 0.35 : 0.85));
    }, 420);
    return () => clearInterval(id);
  }, [chatStatus.responding]);

E substituir a chamada existente em `NexoWorkspace.tsx:501-506` — que hoje é
`useAgentState({ dragging, reading: reading || readingMemorial, thinking:
chatStatus.thinking, error: chatStatus.error })` — por:

```tsx
  const agentState = useAgentState({
    dragging,
    reading: reading || readingMemorial,
    thinking: chatStatus.thinking,
    responding: chatStatus.responding,
    error: chatStatus.error,
  });

  // Leitura = progresso REAL (done/total). Resposta = cadência do texto.
  const orbActivity =
    reading || readingMemorial
      ? readProgress.total > 0
        ? readProgress.done / readProgress.total
        : 0
      : replyPulse;
```

E no `<NexoCopilot …>` (linha ~601), acrescentar depois de `fileCount={okCount}`:

```tsx
            activity={orbActivity}
```

- [ ] **Step 5: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint modules/nexo/components/agent-orb modules/nexo/components/NexoCopilot.tsx modules/nexo/components/NexoWorkspace.tsx
```

Esperado: sem erro.

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/components/agent-orb modules/nexo/components/NexoCopilot.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: orb reage ao progresso real da leitura e a cadencia da resposta"
```

---

### Task 8: Limpeza e verificação final

**Files:**
- Delete: `modules/nexo/components/SuggestionCards.tsx`

**Interfaces:**
- Consumes: tudo das tasks anteriores.
- Produces: nada.

- [ ] **Step 1: Confirmar que está morto de verdade**

```bash
grep -rn "SuggestionCards" --include=*.ts --include=*.tsx .
```

Esperado: só a própria definição em `modules/nexo/components/SuggestionCards.tsx`.
**Se aparecer qualquer importador, NÃO apagar** — reportar e parar.

- [ ] **Step 2: Apagar**

```bash
git rm modules/nexo/components/SuggestionCards.tsx
```

- [ ] **Step 3: Suíte completa do Nexo**

```bash
npm run test:nexo:tomos && npm run test:nexo:check && npm run test:nexo:reconcile && npm run test:nexo:context && npm run test:nexo:attachments && npm run test:nexo:next-steps && npm run test:nexo:group && npm run test:nexo:agent && npm run test:nexo:parts && npm run test:nexo:session && npm run test:nexo:slots && npm run test:nexo:stream
```

Esperado: todos verdes, incluindo os 6 novos do separador.

- [ ] **Step 4: Tipos, lint e build de produção**

```bash
npx tsc --noEmit && npx eslint . && npm run build
```

Esperado: os três verdes. O `next build` é o que pega vazamento de server→client e
quebra de SSR — não pular.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Nexo: remove SuggestionCards morto"
git push
```

---

## Teste ao vivo (usuário)

Depois da Task 8, com `npm run dev` e OpenAI configurado, em `/nexo`:

1. Anexar pranchas e pedir "cria a LD e a capa" — o texto deve **fluir**, não aparecer de uma vez.
2. Conferir que **nenhuma chave ou crase** aparece na tela em momento algum.
3. Apertar **parar** no meio — o texto parcial fica, marcado "interrompido", sem cards.
4. Conferir que o **card de confirmação ainda aparece** num turno completo (as propostas vêm na cauda).
5. Durante a leitura das pranchas, ver o **plano de varredura da esfera acompanhar** o `N/M`.
6. Rolar pra cima durante uma resposta — não deve ser arrancado; deve aparecer "↓ novas mensagens".
7. Desligar a internet e enviar — deve aparecer erro com **"Tentar de novo"** funcional.

**Se o silêncio inicial ainda passar de ~3s**, o lever seguinte é `NEXODOC_NEXO_REASONING_EFFORT`, não mais UI (registrado no spec).
