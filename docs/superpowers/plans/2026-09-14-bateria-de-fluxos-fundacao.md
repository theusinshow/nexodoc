# Bateria de fluxos esquisitos: fundação e primeiras jornadas

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** um comando (`npm run bateria`) que roda os testes puros e as jornadas de navegador contra um banco e um servidor próprios, com a IA simulada, sem gastar token. Inclui as quatro primeiras jornadas (fumaça, C4, A1, A3).

**Arquitetura:**
- A IA simulada entra em `lib/ai-runner.ts`, respondendo por `operation`.
- O executor (`scripts/bateria/rodar.mjs`) faz, em ordem:
  1. prepara o `nexodoc_teste` (migra, esvazia, semeia);
  2. roda os `scripts/test-*.ts` e prepara o banco de novo;
  3. sobe `next dev` na porta 3100 com o ambiente da bateria;
  4. roda as jornadas Playwright;
  5. imprime o relatório e sai com código diferente de zero se houver vermelho.

**Tecnologia:** Node 24 (TypeScript nativo, sem build), Playwright 1.61 (já é dependência), Prisma + Postgres Neon, Next 16.

**Desenho:** `docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md`. Leia antes de começar.

## Restrições globais

- Zero token: nenhuma jornada pode chegar à OpenAI de verdade. O servidor da bateria roda com `NEXODOC_IA_SIMULADA=1` e `OPENAI_API_KEY=sk-simulada`.
- A IA simulada só liga com `NEXODOC_IA_SIMULADA === "1"` **e** `NODE_ENV !== "production"`.
- Banco: só `nexodoc_teste`. O executor recusa qualquer outro nome de banco na URL antes de qualquer escrita.
- Porta do servidor da bateria: `3100`. Pasta de build dele: `.next-bateria`.
- E-mail do usuário da bateria: `bateria@nexodoc.local`.
- Testes puros no estilo do repo: `node scripts/test-*.ts`, `node:assert/strict`, sem framework.
- Módulo importado por teste em node cru não usa o alias `@/`: use caminho relativo com extensão `.ts`/`.mjs`.
- Comentários e textos em pt-BR, no tom do repositório. O comentário explica o PORQUÊ, com a data e o caso medido.
- Commit direto na `main`, um por tarefa. Mensagem em pt-BR, minúscula, dizendo o que mudou para quem usa, com o rodapé de atribuição da sessão. Antes de commitar: `git diff --cached --stat`.
- Nunca `git add -A`. Adicione os arquivos pelo nome.
- A rota nova em `app/api` precisa chamar `requireActor(`, senão `npm run prova:rotas` quebra.
- No Playwright, o input de anexo do chat é `input[type="file"][accept="application/pdf,image/*"]`. O primeiro `input[type=file]` da página é o de classificação de pasta e **não** anexa memorial.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/ia-simulada.ts` (novo) | respostas sintéticas por operação, fila de falhas, stream simulado; puro |
| `scripts/test-ia-simulada.ts` (novo) | trava o simulador |
| `lib/ai-runner.ts` (alterar) | desvia para o simulador nos dois executores |
| `app/api/teste/ia/route.ts` (novo) | GET/POST/DELETE da fila de falhas; 404 fora do modo simulado |
| `next.config.ts` (alterar) | `distDir` por variável, para o servidor da bateria não disputar `.next` com o seu `npm run dev` |
| `scripts/bateria/lib/guarda-do-banco.mjs` (novo) | decide se a URL é do banco da bateria; puro |
| `scripts/test-guarda-do-banco.ts` (novo) | trava a guarda |
| `scripts/bateria/lib/ambiente.mjs` (novo) | lê `.env.local` e monta o ambiente do servidor e dos testes |
| `scripts/bateria/criar-banco.mjs` (novo) | cria o `nexodoc_teste` uma vez |
| `scripts/bateria/lib/banco.mjs` (novo) | migra, esvazia e semeia o `nexodoc_teste` |
| `scripts/bateria/lib/servidor.mjs` (novo) | derruba quem estiver na porta, sobe, espera a saúde, derruba |
| `scripts/lib/so-o-alias.mjs` (novo) | hook mínimo do alias `@/` para testes puros |
| `scripts/bateria/lib/puros.mjs` (novo) | roda os `scripts/test-*.ts` em paralelo |
| `scripts/bateria/lib/contexto.mjs` (novo) | o `ctx` das jornadas |
| `scripts/bateria/lib/jornadas.mjs` (novo) | descobre e roda as jornadas |
| `scripts/bateria/lib/relatorio.mjs` (novo) | imprime o relatório |
| `scripts/bateria/rodar.mjs` (novo) | a linha de comando |
| `scripts/bateria/jornadas/fumaca/f0-abre-o-nexo.mjs` (novo) | prova que a fundação funciona |
| `scripts/bateria/jornadas/conversas/c4-conversa-antiga.mjs` (novo) | cenário C4 |
| `scripts/bateria/jornadas/auditoria/a1-leitura-da-ia-aborta.mjs` (novo) | cenário A1 |
| `scripts/bateria/jornadas/auditoria/a3-reauditar-mesmo-memorial.mjs` (novo) | cenário A3 |
| `scripts/bateria/fixtures/parecer-117-25-incompleto.json` (**já existe**) | parecer real de 52 achados no formato antigo |
| `docs/bateria/defeitos-achados.md` (novo) | registro dos defeitos que a bateria achou |
| `package.json` (alterar) | scripts `bateria`, `bateria:criar-banco`, `test:ia-simulada`, `test:guarda-do-banco` |

---

### Tarefa 1: IA simulada (módulo puro)

**Arquivos:**
- Criar: `lib/ia-simulada.ts`
- Criar: `scripts/test-ia-simulada.ts`
- Alterar: `package.json` (script `test:ia-simulada`)

**Interfaces:**
- Produz:
  - `iaSimuladaLigada(env?: Record<string, string | undefined>): boolean`
  - `type ComportamentoSimulado = "abortar" | "truncar" | "503" | "recusar" | "json-invalido" | \`lento:${number}\``
  - `enfileirar(operation: string, comportamento: ComportamentoSimulado): void`
  - `limparFila(): void`
  - `verFila(): { operation: string; comportamento: ComportamentoSimulado }[]`
  - `comportamentoValido(texto: string): texto is ComportamentoSimulado`
  - `respostaSimulada(pedido: { operation: string; model: string; request: unknown }, signal?: AbortSignal): Promise<RespostaSimulada>`
  - `streamSimulado(pedido, signal?): AsyncGenerator<{ type: string; delta?: string; response?: unknown }>`
  - `type RespostaSimulada = { id: string; status: "completed" | "incomplete"; incomplete_details?: { reason: string }; output_text: string; output: unknown[]; usage: { input_tokens: 0; output_tokens: 0; total_tokens: 0 } }`

- [ ] **Passo 1: escrever o teste que falha**

`scripts/test-ia-simulada.ts`:

```ts
/**
 * Teste da IA SIMULADA — o modelo falso que a bateria usa.
 *
 * A bateria roda os fluxos esquisitos sem gastar token. O simulador responde por
 * operação, com JSON válido para o formato de cada uma, e falha DE PROPÓSITO
 * quando o cenário pede: é assim que "a leitura global abortou aos 900s"
 * (117_25, 14/09/2026) vira teste de segundos.
 *
 *   node scripts/test-ia-simulada.ts   (== npm run test:ia-simulada)
 */
import assert from "node:assert/strict";

import {
  comportamentoValido,
  enfileirar,
  iaSimuladaLigada,
  limparFila,
  respostaSimulada,
  streamSimulado,
  verFila,
} from "../lib/ia-simulada.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  limparFila();
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const DOCUMENTO = [
  "--- PAGINA 1 ---",
  "VOLUME 1",
  "--- PAGINA 3 ---",
  "O reservatório superior tem capacidade de 10 m³ conforme o projeto hidráulico.",
  "--- PAGINA 7 ---",
  "As instalações elétricas seguem a NBR 5410 e o padrão da concessionária local.",
  "--- PAGINA 9 ---",
  "A cobertura será em telha metálica termoacústica com inclinação mínima de 5%.",
].join("\n");

await test("liga só com a variável E fora de produção", () => {
  assert.equal(iaSimuladaLigada({ NEXODOC_IA_SIMULADA: "1", NODE_ENV: "development" }), true);
  assert.equal(iaSimuladaLigada({ NEXODOC_IA_SIMULADA: "1", NODE_ENV: "production" }), false);
  assert.equal(iaSimuladaLigada({ NODE_ENV: "development" }), false);
});

await test("leitura global devolve achados ancorados em trechos reais, com a página", async () => {
  const r = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.equal(r.status, "completed");
  const corpo = JSON.parse(r.output_text) as { findings: { evidencia: string; pagina: string }[]; sintese: unknown[] };
  assert.ok(corpo.findings.length >= 1 && corpo.findings.length <= 3);
  for (const f of corpo.findings) {
    assert.ok(DOCUMENTO.includes(f.evidencia), `evidência inventada: ${f.evidencia}`);
  }
  assert.equal(corpo.findings[0].pagina, "3");
  assert.ok(Array.isArray(corpo.sintese));
});

await test("validação não mexe nos achados", async () => {
  const r = await respostaSimulada({ operation: "audit-validation", model: "m", request: { input: "x" } });
  assert.deepEqual(JSON.parse(r.output_text), { decisions: [] });
});

await test("agente propõe auditoria quando o pedido é auditar", async () => {
  const input = "REGRAS...\nPEDIDO DO ENGENHEIRO:\naudita o memorial\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  const cauda = r.output_text.slice(r.output_text.indexOf("```"));
  const json = JSON.parse(cauda.replace(/```json|```/g, "")) as { proposals: { kind: string }[] };
  assert.equal(json.proposals[0].kind, "auditoria");
});

await test("agente só conversa quando o pedido não é ação", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\noi, tudo bem?\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  assert.ok(!r.output_text.includes('"kind"'));
});

await test("a fila é por operação e consumida na ordem", async () => {
  enfileirar("audit-global", "truncar");
  enfileirar("audit-validation", "503");
  enfileirar("audit-global", "abortar");
  const truncada = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.equal(truncada.status, "incomplete");
  assert.equal(truncada.incomplete_details?.reason, "max_output_tokens");
  await assert.rejects(
    respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } }),
    (e: Error) => e.name === "AbortError" && /aborted/i.test(e.message),
  );
  assert.deepEqual(verFila(), [{ operation: "audit-validation", comportamento: "503" }]);
});

await test("503 carrega o status, para a retentativa reconhecer", async () => {
  enfileirar("audit-global", "503");
  await assert.rejects(
    respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } }),
    (e: Error & { status?: number }) => e.status === 503,
  );
});

await test("recusa e JSON inválido saem no formato do provedor", async () => {
  enfileirar("audit-global", "recusar");
  enfileirar("audit-global", "json-invalido");
  const recusa = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.equal((recusa.output[0] as { content: { type: string }[] }).content[0].type, "refusal");
  const invalido = await respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } });
  assert.throws(() => JSON.parse(invalido.output_text));
});

await test("lento respeita o aborto do prazo", async () => {
  enfileirar("audit-global", "lento:5000");
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 20);
  await assert.rejects(
    respostaSimulada({ operation: "audit-global", model: "m", request: { input: DOCUMENTO } }, controller.signal),
    (e: Error) => e.name === "AbortError",
  );
});

await test("operação sem simulação quebra alto", async () => {
  await assert.rejects(
    respostaSimulada({ operation: "operacao-nova", model: "m", request: {} }),
    /operação sem simulação: operacao-nova/,
  );
});

await test("stream entrega o mesmo texto em pedaços e fecha com completed", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\naudita o memorial\n\nFormato da resposta, nesta ordem:";
  const eventos: { type: string; delta?: string; response?: { output_text: string } }[] = [];
  for await (const e of streamSimulado({ operation: "nexo-agent-turn", model: "m", request: { input } })) {
    eventos.push(e as never);
  }
  const texto = eventos.filter((e) => e.type === "response.output_text.delta").map((e) => e.delta).join("");
  const fim = eventos.at(-1)!;
  assert.equal(fim.type, "response.completed");
  assert.equal(texto, fim.response!.output_text);
});

await test("comportamentoValido aceita só a lista", () => {
  assert.equal(comportamentoValido("lento:1500"), true);
  assert.equal(comportamentoValido("lento:abc"), false);
  assert.equal(comportamentoValido("explodir"), false);
});

console.log(`\n${passed} teste(s) passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-ia-simulada.ts`
Esperado: FALHA com `ERR_MODULE_NOT_FOUND` apontando para `lib/ia-simulada.ts`.

- [ ] **Passo 3: implementar o mínimo**

`lib/ia-simulada.ts`:

```ts
/**
 * IA SIMULADA — o modelo falso da bateria de fluxos.
 *
 * Existe para testar o FLUXO sem pagar o modelo: em 14/09/2026 sete defeitos do
 * 117_25 apareceram fora do caminho feliz (leitura abortada, revisão truncada,
 * reauditar, F5), e nenhum dependia do que o modelo responde — dependiam de ele
 * responder, demorar ou falhar. Ver
 * `docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md`.
 *
 * PURO e sem alias: o teste em node cru o importa, e `lib/ai-runner.ts` só o
 * carrega quando `iaSimuladaLigada()`.
 *
 * Operação sem simulação QUEBRA ALTO. Uma chamada nova no produto que passasse
 * calada pela bateria seria um fluxo sem teste fingindo que tem.
 */

export type ComportamentoSimulado =
  | "abortar"
  | "truncar"
  | "503"
  | "recusar"
  | "json-invalido"
  | `lento:${number}`;

export type RespostaSimulada = {
  id: string;
  status: "completed" | "incomplete";
  incomplete_details?: { reason: string };
  output_text: string;
  output: unknown[];
  usage: { input_tokens: 0; output_tokens: 0; total_tokens: 0 };
};

type Pedido = { operation: string; model: string; request: unknown };
type ItemDaFila = { operation: string; comportamento: ComportamentoSimulado };

/** As DUAS condições: uma variável esquecida no Render não pode ligar isto. */
export function iaSimuladaLigada(env: Record<string, string | undefined> = process.env) {
  return env.NEXODOC_IA_SIMULADA === "1" && env.NODE_ENV !== "production";
}

export function comportamentoValido(texto: string): texto is ComportamentoSimulado {
  return /^(abortar|truncar|503|recusar|json-invalido|lento:\d{1,6})$/.test(texto);
}

/* O servidor da bateria é um processo só: a fila mora em `globalThis`, que
   sobrevive ao recarregamento de módulo do `next dev`. */
function estado(): { fila: ItemDaFila[] } {
  const g = globalThis as { __nexodocIaSimulada?: { fila: ItemDaFila[] } };
  g.__nexodocIaSimulada ??= { fila: [] };
  return g.__nexodocIaSimulada;
}

export function enfileirar(operation: string, comportamento: ComportamentoSimulado) {
  estado().fila.push({ operation, comportamento });
}

export function limparFila() {
  estado().fila.length = 0;
}

export function verFila(): ItemDaFila[] {
  return estado().fila.map((i) => ({ ...i }));
}

function tirarDaFila(operation: string): ComportamentoSimulado | null {
  const fila = estado().fila;
  const i = fila.findIndex((x) => x.operation === operation);
  if (i === -1) return null;
  return fila.splice(i, 1)[0].comportamento;
}

/** Todo o texto do pedido, venha ele como string ou como lista de mensagens. */
function textoDoPedido(request: unknown): string {
  const input = (request as { input?: unknown } | null)?.input;
  if (typeof input === "string") return input;
  if (!Array.isArray(input)) return "";
  return input
    .map((item) => {
      const content = (item as { content?: unknown })?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map((c) => String((c as { text?: unknown })?.text ?? "")).join("\n");
      }
      return "";
    })
    .join("\n");
}

/** A fala do engenheiro dentro do prompt do agente (`server/nexo/agent/run-turn.ts`). */
function pedidoDoEngenheiro(texto: string): string {
  const m = /PEDIDO DO ENGENHEIRO:\n([\s\S]*?)\n\nFormato da resposta/.exec(texto);
  return (m?.[1] ?? texto).trim();
}

/**
 * Linhas que um achado pode citar LITERALMENTE, com a página em que estão.
 * O marcador é o de `textoDoDocumentoParaIA` (`--- PAGINA N ---`), conferido no
 * 117_25 em 14/09/2026. A evidência sai do texto real para passar pelas mesmas
 * travas que um achado de verdade passaria.
 */
function trechosAncoraveis(texto: string): { pagina: string; trecho: string }[] {
  const saida: { pagina: string; trecho: string }[] = [];
  let pagina = "1";
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    const marcador = /^---\s*P[AÁ]GINA\s+(\d+)\s*---$/i.exec(linha);
    if (marcador) {
      pagina = marcador[1];
      continue;
    }
    if (linha.length >= 40 && linha.length <= 160 && /[a-zà-ú]{4}/i.test(linha) && !/\.{5,}/.test(linha)) {
      saida.push({ pagina, trecho: linha });
    }
  }
  return saida;
}

function completa(texto: string, extra: Partial<RespostaSimulada> = {}): RespostaSimulada {
  return {
    id: `simulada-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    status: "completed",
    output_text: texto,
    output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: texto }] }],
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    ...extra,
  };
}

function achadoSimulado(i: number, ancora: { pagina: string; trecho: string }) {
  return {
    prioridade: "Media",
    pagina: ancora.pagina,
    capitulo: "não identificado",
    local: "texto do memorial",
    tipo: `Achado simulado ${i + 1}`,
    descricao: `Achado simulado ${i + 1} da leitura global.`,
    evidencia: ancora.trecho,
    termo_busca: ancora.trecho.slice(0, 60),
    arquivo: "",
    categoria: "simulada",
    referencia_comparada: "",
    conflito: "Conflito simulado para teste de fluxo.",
    sugestao_correcao: "Revisar o trecho indicado.",
    confianca: "alta",
    impacto: "tecnico_contratual",
  };
}

function corpoDaOperacao(operation: string, request: unknown): string {
  const texto = textoDoPedido(request);

  switch (operation) {
    case "audit-global": {
      const trechos = trechosAncoraveis(texto);
      const escolhidos = [...new Set([0, Math.floor(trechos.length / 2), trechos.length - 1])]
        .filter((i) => i >= 0 && i < trechos.length)
        .map((i) => trechos[i]);
      return JSON.stringify({ findings: escolhidos.map((a, i) => achadoSimulado(i, a)), sintese: [] });
    }
    case "audit-validation":
      return JSON.stringify({ decisions: [] });
    case "audit-chunk":
    case "audit-coherence":
    case "audit-identity":
      return JSON.stringify({ findings: [] });
    case "audit-cross-document":
      return JSON.stringify({ comparisons: [], findings: [] });
    case "audit-refutation":
      return JSON.stringify({ verdicts: [] });
    case "audit-transcricao":
      return "TEXTO TRANSCRITO PELA IA SIMULADA.";
    case "audit-chat-turn":
      return "Resposta simulada do chat da auditoria.";
    case "nexo-agent-turn": {
      const pedido = pedidoDoEngenheiro(texto);
      if (/audit/i.test(pedido)) {
        const reply = "Vou auditar o memorial (resposta simulada).";
        const cauda = { reply, proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] };
        return `${reply}\n\n\`\`\`json\n${JSON.stringify(cauda)}\n\`\`\``;
      }
      return "Entendido (resposta simulada).";
    }
    default:
      throw new Error(`operação sem simulação: ${operation}`);
  }
}

function erroDeAborto() {
  const erro = new Error("Request was aborted.");
  erro.name = "AbortError";
  return erro;
}

function esperar(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(erroDeAborto());
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(erroDeAborto());
      },
      { once: true },
    );
  });
}

export async function respostaSimulada(pedido: Pedido, signal?: AbortSignal): Promise<RespostaSimulada> {
  const comportamento = tirarDaFila(pedido.operation);

  if (comportamento === "abortar") throw erroDeAborto();
  if (comportamento === "503") {
    const erro = new Error("503 Our servers are currently overloaded. Please try again later.") as Error & {
      status?: number;
    };
    erro.status = 503;
    throw erro;
  }
  if (comportamento?.startsWith("lento:")) {
    await esperar(Number(comportamento.slice("lento:".length)), signal);
  }
  if (comportamento === "truncar") {
    return completa("", { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
  }
  if (comportamento === "recusar") {
    return completa("", {
      output: [
        { type: "message", role: "assistant", content: [{ type: "refusal", refusal: "Não posso ajudar com isso." }] },
      ],
    });
  }
  if (comportamento === "json-invalido") {
    return completa("isto não é json {");
  }

  return completa(corpoDaOperacao(pedido.operation, pedido.request));
}

/** Os mesmos eventos que `executeOpenAiResponseStream` lê da OpenAI. */
export async function* streamSimulado(pedido: Pedido, signal?: AbortSignal) {
  const resposta = await respostaSimulada(pedido, signal);
  if (resposta.status === "incomplete") {
    yield { type: "response.incomplete", response: resposta };
    return;
  }
  for (let i = 0; i < resposta.output_text.length; i += 24) {
    yield { type: "response.output_text.delta", delta: resposta.output_text.slice(i, i + 24) };
  }
  yield { type: "response.completed", response: resposta };
}
```

Em `package.json`, junto dos outros `test:*`:

```json
    "test:ia-simulada": "node scripts/test-ia-simulada.ts",
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `node scripts/test-ia-simulada.ts`
Esperado: `12 teste(s) passaram`, código de saída 0.

- [ ] **Passo 5: commit**

```bash
git add lib/ia-simulada.ts scripts/test-ia-simulada.ts package.json
git diff --cached --stat
git commit -m "a bateria ganha uma ia simulada que responde por operacao e falha de proposito"
```

---

### Tarefa 2: ligar a IA simulada no produto (runner e rota de controle)

**Arquivos:**
- Alterar: `lib/ai-runner.ts` (onde `response = args.emSegundoPlano ? ...` é atribuído em `executeOpenAiResponse`, e onde `const stream = await getOpenAIClient().responses.create(` aparece em `executeOpenAiResponseStream`)
- Criar: `app/api/teste/ia/route.ts`

**Interfaces:**
- Consome: `iaSimuladaLigada`, `respostaSimulada`, `streamSimulado`, `enfileirar`, `limparFila`, `verFila` e `comportamentoValido`, da Tarefa 1.
- Produz a rota HTTP (usada pelo `ctx.ia` da Tarefa 6), ligada só no modo simulado; fora dele responde 404:
  - `GET /api/teste/ia` → `{ fila }`;
  - `POST /api/teste/ia` com corpo `{ operation, comportamento }` → `{ fila }`;
  - `DELETE /api/teste/ia` → `{ fila: [] }`.

- [ ] **Passo 1: desviar o executor normal**

Em `lib/ai-runner.ts`, acrescente depois dos imports:

```ts
/**
 * A IA SIMULADA da bateria de fluxos. As duas condições, como em
 * `lib/ia-simulada.ts`: fora de teste o módulo nem é carregado.
 */
function iaSimuladaLigada() {
  return process.env.NEXODOC_IA_SIMULADA === "1" && process.env.NODE_ENV !== "production";
}
```

E troque o bloco que atribui `response` dentro do `try` de `executeOpenAiResponse` (hoje `response = args.emSegundoPlano ? await respostaEmSegundoPlano({...}) : await getOpenAIClient().responses.create(...)`) por:

```ts
    response = iaSimuladaLigada()
      ? await (await import("@/lib/ia-simulada")).respostaSimulada(
          { operation: args.operation, model: args.model, request: args.request },
          controller.signal,
        )
      : args.emSegundoPlano
        ? await respostaEmSegundoPlano({
            cliente: getOpenAIClient().responses as unknown as ClienteDeRespostas,
            request: args.request as unknown as Record<string, unknown>,
            signal: controller.signal,
          })
        : await getOpenAIClient().responses.create(args.request, {
            signal: controller.signal,
            /*
             * O prazo do SDK acompanha o NOSSO. O padrão dele é 600s com duas
             * retentativas: numa passada com orçamento maior, aos 600s ele
             * reenviava a chamada por conta própria — uma segunda resposta paga,
             * que o nosso aborto matava no meio. Medido em 14/09/2026.
             */
            timeout: timeoutMs + 5_000,
          });
```

- [ ] **Passo 2: desviar o executor de stream**

Em `executeOpenAiResponseStream`, troque:

```ts
    const stream = await getOpenAIClient().responses.create(
      { ...args.request, stream: true },
      { signal: controller.signal },
    );
```

por:

```ts
    const stream = iaSimuladaLigada()
      ? (await import("@/lib/ia-simulada")).streamSimulado(
          { operation: args.operation, model: args.model, request: args.request },
          controller.signal,
        )
      : await getOpenAIClient().responses.create(
          { ...args.request, stream: true },
          { signal: controller.signal },
        );
```

- [ ] **Passo 3: criar a rota de controle**

`app/api/teste/ia/route.ts`:

```ts
/**
 * A FILA DE FALHAS da IA simulada — só existe no servidor da bateria.
 *
 * Um cenário da bateria pede "a próxima leitura global aborta" e o simulador
 * obedece. Fora do modo simulado a rota responde 404, como se não existisse:
 * em produção ela não pode nem ser descoberta. O portão de sessão fica mesmo
 * assim (`prova:rotas` exige), e as jornadas estão logadas.
 */
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import {
  comportamentoValido,
  enfileirar,
  iaSimuladaLigada,
  limparFila,
  verFila,
} from "@/lib/ia-simulada";

export const runtime = "nodejs";

async function portao() {
  if (!iaSimuladaLigada()) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404 });
  }
  try {
    await requireActor();
    return null;
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function GET() {
  const barrado = await portao();
  if (barrado) return barrado;
  return NextResponse.json({ fila: verFila() });
}

export async function POST(request: Request) {
  const barrado = await portao();
  if (barrado) return barrado;

  const corpo = (await request.json().catch(() => null)) as {
    operation?: unknown;
    comportamento?: unknown;
  } | null;
  const operation = typeof corpo?.operation === "string" ? corpo.operation.trim() : "";
  const comportamento = typeof corpo?.comportamento === "string" ? corpo.comportamento : "";

  if (!operation || !comportamentoValido(comportamento)) {
    return NextResponse.json(
      { error: "Envie { operation, comportamento } com um comportamento conhecido." },
      { status: 400 },
    );
  }

  enfileirar(operation, comportamento);
  return NextResponse.json({ fila: verFila() });
}

export async function DELETE() {
  const barrado = await portao();
  if (barrado) return barrado;
  limparFila();
  return NextResponse.json({ fila: [] });
}
```

- [ ] **Passo 4: verificar tipos, lint e a prova das rotas**

Rode: `npx tsc --noEmit -p . && npx eslint lib/ai-runner.ts lib/ia-simulada.ts app/api/teste/ia/route.ts && npm run prova:rotas`
Esperado: sem erro de tipo, sem erro de lint, e a prova termina com `OK  nenhuma rota aberta`.

- [ ] **Passo 5: conferir que fora do modo simulado nada muda**

Rode: `node scripts/test-resposta-em-segundo-plano.ts && node scripts/test-ia-simulada.ts`
Esperado: os dois verdes. O desvio só é tomado com `NEXODOC_IA_SIMULADA=1`, e nenhum desses testes a define.

- [ ] **Passo 6: commit**

```bash
git add lib/ai-runner.ts app/api/teste/ia/route.ts
git diff --cached --stat
git commit -m "o servidor responde com a ia simulada quando a bateria pede, e so ai"
```

---

### Tarefa 3: guarda do banco, ambiente e criação do nexodoc_teste

**Arquivos:**
- Criar: `scripts/bateria/lib/guarda-do-banco.mjs`
- Criar: `scripts/test-guarda-do-banco.ts`
- Criar: `scripts/bateria/lib/ambiente.mjs`
- Criar: `scripts/bateria/criar-banco.mjs`
- Alterar: `package.json` (`test:guarda-do-banco`, `bateria:criar-banco`)

**Interfaces:**
- Produz:
  - `bancoDaBateria(url: string): { ok: true; banco: string } | { ok: false; motivo: string }`
  - `semOPooler(url: string): string`
  - `lerEnvLocal(): Record<string, string>`
  - `urlDaBateria(): string`, que lança erro com o motivo se a guarda recusar
  - `ambienteDoServidor(porta: number): NodeJS.ProcessEnv`
  - `ambienteDosTestes(): NodeJS.ProcessEnv`

- [ ] **Passo 1: escrever o teste que falha**

`scripts/test-guarda-do-banco.ts`:

```ts
/**
 * Teste da GUARDA DO BANCO da bateria.
 *
 * A bateria APAGA tabelas a cada rodada. Até 14/08/2026 o `.env.local` apontava
 * para o banco de produção sem ninguém perceber (memória "Dev separado de
 * produção"). A guarda decide pelo NOME do banco na URL, antes de qualquer
 * escrita, e só aceita um.
 *
 *   node scripts/test-guarda-do-banco.ts
 */
import assert from "node:assert/strict";

import { bancoDaBateria, semOPooler } from "./bateria/lib/guarda-do-banco.mjs";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const HOST = "postgresql://u:p@ep-x-pooler.sa-east-1.aws.neon.tech";

test("aceita só o nexodoc_teste", () => {
  assert.deepEqual(bancoDaBateria(`${HOST}/nexodoc_teste?sslmode=require`), { ok: true, banco: "nexodoc_teste" });
});

test("recusa produção e o banco de desenvolvimento, dizendo qual é", () => {
  for (const banco of ["neondb", "nexodoc_dev", "nexodoc"]) {
    const r = bancoDaBateria(`${HOST}/${banco}?sslmode=require`);
    assert.equal(r.ok, false, banco);
    assert.match((r as { motivo: string }).motivo, new RegExp(banco));
  }
});

test("recusa URL vazia ou torta", () => {
  assert.equal(bancoDaBateria("").ok, false);
  assert.equal(bancoDaBateria("isto não é url").ok, false);
});

test("sem o pooler para CREATE DATABASE e migração", () => {
  assert.equal(
    semOPooler(`${HOST}/nexodoc_teste?sslmode=require`),
    "postgresql://u:p@ep-x.sa-east-1.aws.neon.tech/nexodoc_teste?sslmode=require",
  );
});

console.log(`\n${passed} teste(s) passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-guarda-do-banco.ts`
Esperado: FALHA com `ERR_MODULE_NOT_FOUND` para `guarda-do-banco.mjs`.

- [ ] **Passo 3: implementar a guarda**

`scripts/bateria/lib/guarda-do-banco.mjs`:

```js
// A GUARDA DO BANCO: a bateria apaga tabelas, e só pode fazer isso num banco.
// Decide pelo NOME do banco na URL, antes de qualquer conexão.

const PERMITIDO = "nexodoc_teste";

export function bancoDaBateria(url) {
  let alvo;
  try {
    alvo = new URL(url);
  } catch {
    return { ok: false, motivo: "DATABASE_URL_BATERIA ausente ou não é uma URL" };
  }
  const banco = decodeURIComponent(alvo.pathname.replace(/^\//, ""));
  if (banco !== PERMITIDO) {
    return {
      ok: false,
      motivo: `a bateria só roda no banco ${PERMITIDO}, e a URL aponta para "${banco || "(vazio)"}"`,
    };
  }
  return { ok: true, banco };
}

/** O pooler do Neon não aceita CREATE DATABASE nem o lock da migração. */
export function semOPooler(url) {
  const alvo = new URL(url);
  alvo.hostname = alvo.hostname.replace("-pooler.", ".");
  return alvo.toString();
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `node scripts/test-guarda-do-banco.ts`
Esperado: `4 teste(s) passaram`.

- [ ] **Passo 5: ambiente**

`scripts/bateria/lib/ambiente.mjs`:

```js
// O AMBIENTE da bateria. Variável definida no processo ganha do `.env.local`: o
// Next não sobrescreve o que já existe, e os testes do repo leem o arquivo com
// `if (!process.env[x])`. É assim que o servidor e os testes caem no banco
// da bateria sem ninguém editar o `.env.local`.
import fs from "node:fs";

import { bancoDaBateria } from "./guarda-do-banco.mjs";

export const EMAIL_DA_BATERIA = "bateria@nexodoc.local";

export function lerEnvLocal() {
  const env = {};
  if (!fs.existsSync(".env.local")) return env;
  for (const linha of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(linha.trim());
    if (m && env[m[1]] === undefined) env[m[1]] = m[2];
  }
  return env;
}

export function urlDaBateria() {
  const url = process.env.DATABASE_URL_BATERIA ?? lerEnvLocal().DATABASE_URL_BATERIA ?? "";
  const guarda = bancoDaBateria(url);
  if (!guarda.ok) {
    throw new Error(
      `${guarda.motivo}. Acrescente DATABASE_URL_BATERIA ao .env.local (ver docs/bateria/rodar-no-pc-de-casa.md).`,
    );
  }
  return url;
}

export function ambienteDosTestes() {
  return { ...process.env, DATABASE_URL: urlDaBateria(), DIRECT_DATABASE_URL: "" };
}

export function ambienteDoServidor(porta) {
  const base = `http://localhost:${porta}`;
  return {
    ...ambienteDosTestes(),
    NEXODOC_IA_SIMULADA: "1",
    NEXODOC_DEV_AUTH: "true",
    NEXODOC_DEV_AUTH_EMAIL: EMAIL_DA_BATERIA,
    NEXODOC_DEV_AUTH_NAME: "Bateria",
    OPENAI_API_KEY: "sk-simulada",
    NEXT_PUBLIC_NEXO_ENABLED: "true",
    NEXODOC_DIST_DIR: ".next-bateria",
    AUTH_URL: base,
    NEXTAUTH_URL: base,
    // Nenhum e-mail de verdade sai de uma jornada.
    RESEND_API_KEY: "",
    NEXODOC_EMAIL_FROM: "",
  };
}
```

- [ ] **Passo 6: criação do banco (uma vez por máquina)**

`scripts/bateria/criar-banco.mjs`:

```js
// Cria o banco da bateria uma vez. Conecta ao banco de PRODUÇÃO do mesmo
// projeto Neon (`neondb`) só para o CREATE DATABASE, e não escreve nada nele.
//
//   npm run bateria:criar-banco
import pg from "pg";

import { urlDaBateria } from "./lib/ambiente.mjs";
import { semOPooler } from "./lib/guarda-do-banco.mjs";

const url = new URL(semOPooler(urlDaBateria()));
url.searchParams.delete("channel_binding");
const admin = new URL(url);
admin.pathname = "/neondb";

const cliente = new pg.Client({ connectionString: admin.toString() });
await cliente.connect();
const existe = await cliente.query("select 1 from pg_database where datname = 'nexodoc_teste'");
if (existe.rowCount === 0) {
  await cliente.query("CREATE DATABASE nexodoc_teste");
  console.log("banco nexodoc_teste criado");
} else {
  console.log("banco nexodoc_teste já existia");
}
await cliente.end();
```

Em `package.json`:

```json
    "test:guarda-do-banco": "node scripts/test-guarda-do-banco.ts",
    "bateria:criar-banco": "node scripts/bateria/criar-banco.mjs",
```

- [ ] **Passo 7: criar o banco de verdade**

Rode: `npm run bateria:criar-banco`
Esperado: `banco nexodoc_teste criado`. Na segunda vez, `já existia`. Se falhar com "DATABASE_URL_BATERIA ausente", siga `docs/bateria/rodar-no-pc-de-casa.md` (passo 4).

- [ ] **Passo 8: commit**

```bash
git add scripts/bateria/lib/guarda-do-banco.mjs scripts/test-guarda-do-banco.ts scripts/bateria/lib/ambiente.mjs scripts/bateria/criar-banco.mjs package.json
git diff --cached --stat
git commit -m "a bateria so escreve no nexodoc_teste, e cria esse banco com um comando"
```

---

### Tarefa 4: banco preparado e servidor próprio

**Arquivos:**
- Criar: `scripts/bateria/lib/banco.mjs`
- Criar: `scripts/bateria/lib/servidor.mjs`
- Alterar: `next.config.ts` (acrescentar `distDir`)
- Alterar: `.gitignore`, `tsconfig.json`, `eslint.config.mjs` (ignorar `.next-bateria`)

**Interfaces:**
- Consome: `urlDaBateria`, `ambienteDosTestes`, `ambienteDoServidor`, `EMAIL_DA_BATERIA` e `semOPooler`, da Tarefa 3.
- Produz:
  - `prepararBanco(): Promise<void>`: migra, esvazia tudo menos `_prisma_migrations`, semeia.
  - `consultar(sql: string, params?: unknown[]): Promise<unknown[]>`
  - `subirServidor({ porta, arquivoDeLog }): Promise<{ base: string; derrubar: () => Promise<void> }>`
  - `matarPorta(porta: number): void`

- [ ] **Passo 1: `distDir` por variável**

Em `next.config.ts`, dentro de `const nextConfig: NextConfig = {`, como primeira propriedade:

```ts
  /*
   * A PASTA DE BUILD pode mudar pelo ambiente. O servidor da bateria usa
   * `.next-bateria`: com a mesma `.next`, ele disputava o arquivo com o
   * `npm run dev` de quem está programando ("Another next dev server is already
   * running", visto em 14/09/2026). Sem a variável, nada muda.
   */
  distDir: process.env.NEXODOC_DIST_DIR || ".next",
```

Acrescente `.next-bateria/` ao `.gitignore`, logo abaixo da linha `.next/` ou `/.next/`.

A pasta nova também precisa ficar fora das checagens:
- **`tsconfig.json`:** o `include` tem `**/*.ts` e pegaria os tipos gerados dentro de `.next-bateria`. Acrescente `".next-bateria"` ao array `exclude`, que hoje é `["node_modules", "design-system", "scripts", "scratchpad"]`.
- **`eslint.config.mjs`:** acrescente `".next-bateria/**"` logo abaixo de `".next/**"`.

Rode `npx tsc --noEmit -p .` e `npx eslint next.config.ts`. Esperado: sem erro.

- [ ] **Passo 2: banco**

`scripts/bateria/lib/banco.mjs`:

```js
// Prepara o nexodoc_teste para uma rodada: migrações em dia, tabelas vazias e o
// mínimo para entrar (usuário da bateria como ADMIN da org-prosul).
import { spawnSync } from "node:child_process";

import pg from "pg";

import { EMAIL_DA_BATERIA, ambienteDosTestes, urlDaBateria } from "./ambiente.mjs";

function cliente() {
  const url = new URL(urlDaBateria());
  url.searchParams.delete("channel_binding");
  return new pg.Client({ connectionString: url.toString() });
}

export async function consultar(sql, params = []) {
  const c = cliente();
  await c.connect();
  try {
    return (await c.query(sql, params)).rows;
  } finally {
    await c.end();
  }
}

function rodar(comando, env) {
  const r = spawnSync(comando, { shell: true, env, encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`falhou: ${comando}\n${r.stdout ?? ""}\n${r.stderr ?? ""}`);
  }
}

export async function prepararBanco() {
  const env = ambienteDosTestes();
  rodar("npx prisma migrate deploy", env);

  const tabelas = await consultar(
    "select tablename from pg_tables where schemaname = current_schema() and tablename <> '_prisma_migrations'",
  );
  if (tabelas.length > 0) {
    const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
    await consultar(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
  }

  rodar("node scripts/seed-desenvolvimento.ts", {
    ...env,
    NEXODOC_DEV_AUTH_EMAIL: EMAIL_DA_BATERIA,
    NEXODOC_DEV_AUTH_NAME: "Bateria",
  });
}
```

- [ ] **Passo 3: servidor**

`scripts/bateria/lib/servidor.mjs`:

```js
// O servidor da bateria: sobe numa porta própria e é derrubado pelo PID de quem
// ESCUTA na porta. Parar só o npm deixava o `node` filho vivo, respondendo com
// código velho (medido duas vezes em 14/09/2026).
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";

import { ambienteDoServidor } from "./ambiente.mjs";

export function matarPorta(porta) {
  try {
    if (process.platform === "win32") {
      const saida = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      const pids = new Set(
        saida
          .split(/\r?\n/)
          .filter((l) => l.includes(`:${porta} `) && /LISTEN/i.test(l))
          .map((l) => l.trim().split(/\s+/).at(-1))
          .filter((pid) => pid && pid !== "0"),
      );
      for (const pid of pids) execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      const pids = execSync(`lsof -ti tcp:${porta} -sTCP:LISTEN || true`, { encoding: "utf8" }).trim();
      if (pids) execSync(`kill -9 ${pids.split(/\s+/).join(" ")}`, { stdio: "ignore" });
    }
  } catch {
    // Nada escutando: é o caso normal.
  }
}

async function esperarSaude(base, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    try {
      const r = await fetch(`${base}/api/saude`);
      if (r.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`o servidor da bateria não respondeu /api/saude em ${ms / 1000}s`);
}

export async function subirServidor({ porta, arquivoDeLog }) {
  matarPorta(porta);
  const log = fs.openSync(arquivoDeLog, "a");
  const filho = spawn(`npx next dev -p ${porta}`, {
    shell: true,
    env: ambienteDoServidor(porta),
    stdio: ["ignore", log, log],
  });
  const base = `http://localhost:${porta}`;
  try {
    await esperarSaude(base, 240_000);
  } catch (err) {
    matarPorta(porta);
    throw err;
  }
  return {
    base,
    async derrubar() {
      matarPorta(porta);
      filho.kill();
      fs.closeSync(log);
    },
  };
}
```

- [ ] **Passo 4: provar que sobe, responde a IA simulada e cai**

Crie o arquivo temporário `scratchpad/prova-servidor-bateria.mjs`:

```js
import { prepararBanco, consultar } from "../scripts/bateria/lib/banco.mjs";
import { subirServidor } from "../scripts/bateria/lib/servidor.mjs";

await prepararBanco();
const usuarios = await consultar(`select email from "User"`);
console.log("usuários:", usuarios.map((u) => u.email));
const s = await subirServidor({ porta: 3100, arquivoDeLog: "scratchpad/servidor-bateria.log" });
const semSessao = await fetch(`${s.base}/api/teste/ia`);
console.log("GET /api/teste/ia sem sessão:", semSessao.status);
await s.derrubar();
const depois = await fetch(`${s.base}/api/saude`).then((r) => r.status).catch(() => "caiu");
console.log("depois de derrubar:", depois);
```

Rode: `node scratchpad/prova-servidor-bateria.mjs`
Esperado:
- `usuários: [ 'bateria@nexodoc.local' ]`;
- `GET /api/teste/ia sem sessão: 401` (ou 403). Um 404 aqui significa que a IA simulada não ligou: confira `NEXODOC_IA_SIMULADA` em `ambienteDoServidor`;
- `depois de derrubar: caiu`.

Teste também com o seu `npm run dev` ligado na 3000 ao mesmo tempo: a prova tem de passar igual. Se aparecer "Another next dev server is already running", o `distDir` não resolveu. Nesse caso anote em `docs/bateria/defeitos-achados.md` e faça o executor (Tarefa 6) parar com a mensagem "desligue o npm run dev antes de rodar a bateria". Não esconda.

- [ ] **Passo 5: commit**

```bash
git add next.config.ts .gitignore tsconfig.json eslint.config.mjs scripts/bateria/lib/banco.mjs scripts/bateria/lib/servidor.mjs
git diff --cached --stat
git commit -m "a bateria prepara o proprio banco e sobe o proprio servidor na 3100"
```

---

### Tarefa 5: executor dos testes puros

**Arquivos:**
- Criar: `scripts/lib/so-o-alias.mjs`
- Criar: `scripts/bateria/lib/puros.mjs`

**Interfaces:**
- Consome: `ambienteDosTestes`, da Tarefa 3.
- Produz: `rodarPuros({ paralelo = 6, timeoutMs = 90_000, filtro?: string }): Promise<ResultadoPuro[]>`, com `ResultadoPuro = { arquivo: string; estado: "verde" | "vermelho" | "apodrecido"; motivo: string; ms: number }`.

- [ ] **Passo 1: o hook do alias**

`scripts/lib/so-o-alias.mjs` (mesmo conteúdo do `scratchpad/so-o-alias.mjs` usado em 14/09/2026):

```js
// Hook mínimo: resolve APENAS o alias "@/" do tsconfig. Não toca em mais nada
// (o resolvedor dos scripts também reescreve import relativo sem extensão, e
// isso quebra require de CJS dentro de node_modules — pg, resend).
import { registerHooks } from "node:module";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const RAIZ = process.cwd();
const EXT = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const base = `${RAIZ}/${specifier.slice(2)}`;
      for (const e of EXT) {
        if (fs.existsSync(base + e)) return { url: pathToFileURL(base + e).href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
```

- [ ] **Passo 2: o executor**

`scripts/bateria/lib/puros.mjs`:

```js
// Roda os scripts/test-*.ts. "Apodrecido" é o teste que nem chega a rodar
// (import quebrado, sintaxe): foi assim que o de disciplinas ficou 11 dias
// mudo em agosto de 2026. Ele sai separado do vermelho porque pede outro gesto.
import { spawn } from "node:child_process";
import fs from "node:fs";

import { ambienteDosTestes } from "./ambiente.mjs";

const IMPORT_QUEBRADO = /ERR_MODULE_NOT_FOUND|SyntaxError|Cannot find package|does not provide an export/;

function executar(args, env, timeoutMs) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const filho = spawn(process.execPath, args, { env });
    let saida = "";
    filho.stdout.on("data", (d) => (saida += d));
    filho.stderr.on("data", (d) => (saida += d));
    const relogio = setTimeout(() => filho.kill("SIGKILL"), timeoutMs);
    filho.on("close", (codigo, sinal) => {
      clearTimeout(relogio);
      resolve({ codigo, estourou: sinal === "SIGKILL", saida, ms: Date.now() - inicio });
    });
  });
}

function primeiraLinhaDeErro(saida) {
  const linhas = saida.split(/\r?\n/);
  return (
    linhas.find((l) => /FALHOU|Error|AssertionError|falha/.test(l) && !/warning/i.test(l)) ??
    linhas.filter(Boolean).at(-1) ??
    ""
  ).trim().slice(0, 200);
}

async function rodarUm(arquivo, env, timeoutMs) {
  let r = await executar([arquivo], env, timeoutMs);
  if (r.codigo !== 0 && /Cannot find package '@\//.test(r.saida)) {
    r = await executar(["--import", "./scripts/lib/so-o-alias.mjs", arquivo], env, timeoutMs);
  }
  if (r.estourou) return { arquivo, estado: "vermelho", motivo: `tempo esgotado (${timeoutMs / 1000}s)`, ms: r.ms };
  if (r.codigo === 0) return { arquivo, estado: "verde", motivo: "", ms: r.ms };
  const apodrecido = IMPORT_QUEBRADO.test(r.saida) && !/ok\s/.test(r.saida);
  return { arquivo, estado: apodrecido ? "apodrecido" : "vermelho", motivo: primeiraLinhaDeErro(r.saida), ms: r.ms };
}

export async function rodarPuros({ paralelo = 6, timeoutMs = 90_000, filtro } = {}) {
  const env = ambienteDosTestes();
  const arquivos = fs
    .readdirSync("scripts")
    .filter((n) => /^test-.*\.ts$/.test(n) && (!filtro || n.includes(filtro)))
    .sort()
    .map((n) => `scripts/${n}`);

  const resultados = [];
  let proximo = 0;
  async function trabalhador() {
    while (proximo < arquivos.length) {
      const arquivo = arquivos[proximo++];
      const r = await rodarUm(arquivo, env, timeoutMs);
      resultados.push(r);
      process.stdout.write(r.estado === "verde" ? "." : r.estado === "apodrecido" ? "A" : "F");
    }
  }
  await Promise.all(Array.from({ length: paralelo }, trabalhador));
  process.stdout.write("\n");
  return resultados.sort((a, b) => a.arquivo.localeCompare(b.arquivo));
}
```

- [ ] **Passo 3: provar em um subconjunto**

Crie `scratchpad/prova-puros.mjs`:

```js
import { rodarPuros } from "../scripts/bateria/lib/puros.mjs";

const r = await rodarPuros({ filtro: "auditoria" });
for (const x of r) console.log(x.estado.padEnd(10), x.arquivo, x.motivo);
```

Rode: `node scratchpad/prova-puros.mjs`
Esperado: pelo menos `scripts/test-auditoria-incompleta.ts` e `scripts/test-auditoria-da-proposta.ts` verdes.

- [ ] **Passo 4: commit**

```bash
git add scripts/lib/so-o-alias.mjs scripts/bateria/lib/puros.mjs
git diff --cached --stat
git commit -m "a bateria roda todos os testes puros e separa o que apodreceu do que falhou"
```

---

### Tarefa 6: executor de jornadas, relatório, comando e jornada de fumaça

**Arquivos:**
- Criar: `scripts/bateria/lib/contexto.mjs`
- Criar: `scripts/bateria/lib/jornadas.mjs`
- Criar: `scripts/bateria/lib/relatorio.mjs`
- Criar: `scripts/bateria/rodar.mjs`
- Criar: `scripts/bateria/jornadas/fumaca/f0-abre-o-nexo.mjs`
- Alterar: `package.json` (script `bateria`)

**Interfaces:**
- Consome: `prepararBanco`, `consultar`, `subirServidor` (Tarefa 4) e `rodarPuros` (Tarefa 5).
- Produz o formato de jornada: `export default { id: string, area: string, titulo: string, async rodar(ctx) }`.
- Produz o `ctx`:
  - `page`, `base`;
  - `login()`, `abrirOutraAba()`;
  - `ia.fila(operation, comportamento)`, `ia.limpar()`;
  - `banco.consultar(sql, params?)`;
  - `indexeddb.gravarConversa(registro)`, `indexeddb.lerConversas()`;
  - `abrirConversa(titulo)`, `anexar(caminhos)`;
  - `esperarTexto(regex, ms)`, `esperarBotao(regex, ms)`, `visivel(locator)`;
  - `verificar(nome, condicao, detalhe?)`.
- Produz `rodarJornadas({ base, filtro, pastaDeArtefatos }): Promise<ResultadoJornada[]>`, com `ResultadoJornada = { id, area, titulo, estado: "verde" | "vermelho", falhas: string[], ms }`.

- [ ] **Passo 1: contexto**

`scripts/bateria/lib/contexto.mjs`:

```js
// O `ctx` de uma jornada. `verificar` registra e segue: uma jornada relata
// todas as falhas de uma vez, em vez de parar na primeira e esconder as outras.
import path from "node:path";

import { pularTourGuiado } from "../../lib/sessao-de-teste.mjs";
import { consultar } from "./banco.mjs";

export async function criarContexto({ browser, base }) {
  const contexto = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await contexto.newPage();
  const falhas = [];
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await pularTourGuiado(page);

  async function abrirBanco() {
    return page.evaluate(
      () =>
        new Promise((res, rej) => {
          const r = indexedDB.open("nexo");
          r.onsuccess = () => {
            r.result.close();
            res(true);
          };
          r.onerror = () => rej(r.error);
        }),
    );
  }

  const ctx = {
    page,
    base,
    falhas,
    erros,

    async login() {
      await page.goto(`${base}/nexo`, { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) {
        await page.getByRole("button", { name: /Entrar como dev/i }).click();
        await page.waitForURL("**/nexo**", { timeout: 60_000 });
      }
      await page.waitForTimeout(1500);
    },

    async abrirOutraAba() {
      const outra = await contexto.newPage();
      await pularTourGuiado(outra);
      await outra.goto(`${base}/nexo`, { waitUntil: "domcontentloaded" });
      return outra;
    },

    ia: {
      async fila(operation, comportamento) {
        const r = await page.request.post(`${base}/api/teste/ia`, { data: { operation, comportamento } });
        if (!r.ok()) throw new Error(`fila da IA simulada recusou (${r.status()}): ${await r.text()}`);
      },
      async limpar() {
        await page.request.delete(`${base}/api/teste/ia`);
      },
    },

    banco: { consultar },

    indexeddb: {
      async gravarConversa(registro) {
        await abrirBanco();
        await page.evaluate(async (reg) => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("nexo");
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction("conversations", "readwrite");
            tx.objectStore("conversations").put(reg);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        }, registro);
      },
      async lerConversas() {
        return page.evaluate(async () => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("nexo");
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          const todas = await new Promise((res, rej) => {
            const q = db.transaction("conversations").objectStore("conversations").getAll();
            q.onsuccess = () => res(q.result);
            q.onerror = () => rej(q.error);
          });
          db.close();
          return todas;
        });
      },
    },

    async abrirConversa(titulo) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await page.getByText(titulo).first().click({ timeout: 30_000 });
      await page.waitForTimeout(2500);
    },

    /** O input de ANEXO DO CHAT. O primeiro input da página é o de pasta. */
    async anexar(caminhos) {
      const absolutos = caminhos.map((c) => path.resolve(c));
      await page.locator('input[type="file"][accept="application/pdf,image/*"]').first().setInputFiles(absolutos);
    },

    async esperarTexto(regex, ms = 60_000) {
      await page.getByText(regex).first().waitFor({ timeout: ms });
    },

    async esperarBotao(regex, ms = 60_000) {
      const botao = page.getByRole("button", { name: regex }).last();
      await botao.waitFor({ timeout: ms });
      const fim = Date.now() + ms;
      while (Date.now() < fim && (await botao.isDisabled())) await page.waitForTimeout(500);
      return botao;
    },

    /** Visível DE VERDADE: a caixa dentro da janela, não só presente no DOM. */
    async visivel(locator) {
      const caixa = await locator.first().boundingBox().catch(() => null);
      if (!caixa) return false;
      const janela = page.viewportSize();
      return caixa.width > 0 && caixa.height > 0 && caixa.y < janela.height && caixa.x < janela.width && caixa.y + caixa.height > 0;
    },

    verificar(nome, condicao, detalhe = "") {
      if (condicao) console.log(`      ok  ${nome}`);
      else {
        console.log(`      FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
        falhas.push(`${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
      }
    },

    async fechar() {
      await contexto.close();
    },
  };

  return ctx;
}
```

- [ ] **Passo 2: executor de jornadas**

`scripts/bateria/lib/jornadas.mjs`:

```js
// Descobre as jornadas em scripts/bateria/jornadas/<area>/*.mjs e roda uma de
// cada vez, cada uma num navegador limpo (IndexedDB e cookies zerados).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { criarContexto } from "./contexto.mjs";

const RAIZ = "scripts/bateria/jornadas";

function listar(filtro) {
  const arquivos = [];
  for (const area of fs.readdirSync(RAIZ).sort()) {
    const pasta = path.join(RAIZ, area);
    if (!fs.statSync(pasta).isDirectory()) continue;
    for (const nome of fs.readdirSync(pasta).sort()) {
      if (!nome.endsWith(".mjs")) continue;
      if (filtro && area !== filtro && !nome.startsWith(filtro)) continue;
      arquivos.push(path.join(pasta, nome));
    }
  }
  return arquivos;
}

export async function rodarJornadas({ base, filtro, pastaDeArtefatos }) {
  const resultados = [];
  const browser = await chromium.launch();
  try {
    for (const arquivo of listar(filtro)) {
      const jornada = (await import(pathToFileURL(path.resolve(arquivo)).href)).default;
      console.log(`\n  ${jornada.id} · ${jornada.titulo}`);
      const inicio = Date.now();
      const ctx = await criarContexto({ browser, base });
      try {
        await ctx.ia.limpar().catch(() => {});
        await jornada.rodar(ctx);
      } catch (err) {
        ctx.falhas.push(`quebrou: ${err instanceof Error ? err.message.split("\n")[0] : err}`);
        console.log(`      QUEBROU  ${err instanceof Error ? err.message.split("\n")[0] : err}`);
      }
      if (ctx.erros.length > 0) ctx.falhas.push(`erro de runtime na página: ${ctx.erros[0].slice(0, 160)}`);
      if (ctx.falhas.length > 0) {
        await ctx.page
          .screenshot({ path: path.join(pastaDeArtefatos, `${jornada.id}.png`), fullPage: false })
          .catch(() => {});
      }
      await ctx.fechar();
      resultados.push({
        id: jornada.id,
        area: jornada.area,
        titulo: jornada.titulo,
        estado: ctx.falhas.length === 0 ? "verde" : "vermelho",
        falhas: ctx.falhas,
        ms: Date.now() - inicio,
      });
    }
  } finally {
    await browser.close();
  }
  return resultados;
}
```

- [ ] **Passo 3: relatório**

`scripts/bateria/lib/relatorio.mjs`:

```js
export function imprimirRelatorio({ puros, jornadas, pastaDeArtefatos }) {
  const conta = (lista, estado) => lista.filter((x) => x.estado === estado).length;

  console.log("\n══════════ BATERIA ══════════");
  if (puros) {
    console.log(
      `\nTestes puros: ${conta(puros, "verde")} verdes · ${conta(puros, "vermelho")} vermelhos · ${conta(puros, "apodrecido")} apodrecidos`,
    );
    for (const p of puros.filter((x) => x.estado !== "verde")) {
      console.log(`  ${p.estado.toUpperCase().padEnd(10)} ${p.arquivo} — ${p.motivo}`);
    }
  }
  if (jornadas) {
    const areas = [...new Set(jornadas.map((j) => j.area))];
    console.log(`\nJornadas: ${conta(jornadas, "verde")} verdes · ${conta(jornadas, "vermelho")} vermelhas`);
    for (const area of areas) {
      console.log(`  [${area}]`);
      for (const j of jornadas.filter((x) => x.area === area)) {
        console.log(`    ${j.estado === "verde" ? "ok     " : "FALHOU "} ${j.id} ${j.titulo} (${Math.round(j.ms / 1000)}s)`);
        for (const f of j.falhas) console.log(`           - ${f}`);
      }
    }
  }
  console.log(`\nArtefatos: ${pastaDeArtefatos}`);

  const vermelhos =
    (puros ? conta(puros, "vermelho") + conta(puros, "apodrecido") : 0) + (jornadas ? conta(jornadas, "vermelho") : 0);
  return vermelhos;
}
```

- [ ] **Passo 4: comando**

`scripts/bateria/rodar.mjs`:

```js
// A BATERIA DE FLUXOS ESQUISITOS.
//
//   npm run bateria                  # puros + todas as jornadas
//   npm run bateria -- auditoria     # puros + jornadas da área (ou id: a1)
//   npm run bateria -- --so-puros
//   npm run bateria -- --so-jornadas auditoria
//
// Desenho: docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md
import fs from "node:fs";
import path from "node:path";

import { prepararBanco } from "./lib/banco.mjs";
import { rodarJornadas } from "./lib/jornadas.mjs";
import { rodarPuros } from "./lib/puros.mjs";
import { imprimirRelatorio } from "./lib/relatorio.mjs";
import { subirServidor } from "./lib/servidor.mjs";
import { urlDaBateria } from "./lib/ambiente.mjs";

const args = process.argv.slice(2);
const soPuros = args.includes("--so-puros");
const soJornadas = args.includes("--so-jornadas");
const filtro = args.find((a) => !a.startsWith("--"));

urlDaBateria(); // falha cedo, com o motivo, se o banco não for o da bateria

const carimbo = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const pastaDeArtefatos = path.join("scratchpad", "bateria", carimbo);
fs.mkdirSync(pastaDeArtefatos, { recursive: true });

let puros = null;
let jornadas = null;

// Migra ANTES dos testes puros: na primeira rodada o banco nasce sem tabelas, e
// os testes que tocam o banco ficariam vermelhos por um motivo que não é deles.
console.log("Preparando o banco nexodoc_teste…");
await prepararBanco();

if (!soJornadas) {
  console.log("Testes puros…");
  puros = await rodarPuros({});
}

if (!soPuros) {
  // De novo: o que os testes puros gravaram não pode vazar para as jornadas.
  if (!soJornadas) await prepararBanco();
  console.log("Subindo o servidor da bateria na 3100…");
  const servidor = await subirServidor({ porta: 3100, arquivoDeLog: path.join(pastaDeArtefatos, "servidor.log") });
  try {
    jornadas = await rodarJornadas({ base: servidor.base, filtro, pastaDeArtefatos });
  } finally {
    await servidor.derrubar();
  }
}

const vermelhos = imprimirRelatorio({ puros, jornadas, pastaDeArtefatos });
process.exit(vermelhos > 0 ? 1 : 0);
```

Em `package.json`:

```json
    "bateria": "node scripts/bateria/rodar.mjs",
```

- [ ] **Passo 5: jornada de fumaça**

`scripts/bateria/jornadas/fumaca/f0-abre-o-nexo.mjs`:

```js
// Fumaça: a fundação inteira funciona (login, IA simulada, IndexedDB, banco).
// Se esta falhar, nenhuma outra jornada diz nada.
export default {
  id: "f0",
  area: "fumaca",
  titulo: "o Nexo abre, loga e a IA simulada obedece",
  async rodar(ctx) {
    await ctx.login();
    ctx.verificar("entrou no /nexo", ctx.page.url().includes("/nexo"), ctx.page.url());

    await ctx.ia.fila("audit-global", "abortar");
    const fila = await (await ctx.page.request.get(`${ctx.base}/api/teste/ia`)).json();
    ctx.verificar("a fila da IA simulada aceitou o comportamento", fila.fila?.length === 1, JSON.stringify(fila));
    await ctx.ia.limpar();

    const conversas = await ctx.indexeddb.lerConversas();
    ctx.verificar("o IndexedDB do Nexo abre", Array.isArray(conversas));

    const usuarios = await ctx.banco.consultar(`select email from "User" where email = 'bateria@nexodoc.local'`);
    ctx.verificar("o usuário da bateria existe no banco de teste", usuarios.length === 1);
  },
};
```

- [ ] **Passo 6: rodar a fumaça**

Rode: `npm run bateria -- --so-jornadas fumaca`
Esperado: relatório com `Jornadas: 1 verdes · 0 vermelhas`, `ok f0` e código de saída 0.

- [ ] **Passo 7: commit**

```bash
git add scripts/bateria/lib/contexto.mjs scripts/bateria/lib/jornadas.mjs scripts/bateria/lib/relatorio.mjs scripts/bateria/rodar.mjs scripts/bateria/jornadas/fumaca/f0-abre-o-nexo.mjs package.json
git diff --cached --stat
git commit -m "npm run bateria roda os testes puros e as jornadas e diz o que ficou vermelho"
```

---

### Tarefa 7: jornada C4 — conversa antiga no formato anterior a 14/09

**Arquivos:**
- Criar: `scripts/bateria/jornadas/conversas/c4-conversa-antiga.mjs`
- Usa: `scripts/bateria/fixtures/parecer-117-25-incompleto.json` (já existe)

**Interfaces:**
- Consome: o `ctx` da Tarefa 6.

- [ ] **Passo 1: escrever a jornada**

`scripts/bateria/jornadas/conversas/c4-conversa-antiga.mjs`:

```js
// C4 — conversa gravada antes de a486a53, com o parecer em `auditoria:117-25`.
// Ao abrir, a migração tem de entregar o parecer à ÚLTIMA proposta e a rodada
// sobrescrita à anterior (modules/nexo/lib/auditoria-da-proposta.ts).
import fs from "node:fs";

const fixture = JSON.parse(fs.readFileSync("scripts/bateria/fixtures/parecer-117-25-incompleto.json", "utf8"));

export default {
  id: "c4",
  area: "conversas",
  titulo: "conversa antiga abre com o parecer no cartão certo",
  async rodar(ctx) {
    await ctx.login();
    const agora = Date.now();
    const id = `bateria-c4-${agora}`;
    await ctx.indexeddb.gravarConversa({
      id,
      title: "BATERIA C4 CONVERSA ANTIGA",
      createdAt: agora - 3_600_000,
      updatedAt: agora,
      seloResults: [],
      messages: [
        { id: "u1", role: "user", content: "Anexei o memorial — 117_25_md_geral_a.pdf" },
        { id: "p1", role: "assistant", content: "Vou auditar o memorial.", proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] },
        { id: "u2", role: "user", content: "audita o memorial" },
        { id: "p2", role: "assistant", content: "Vou auditar de novo.", proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] },
      ],
      results: [{ ...fixture.resultado, generatedAt: agora - 60_000 }],
      auditorias: [
        { auditId: "rodada-sobrescrita", artifactId: "auditoria:117-25" },
        { auditId: fixture.resultado.payload.auditId, artifactId: "auditoria:117-25" },
      ],
    });

    await ctx.abrirConversa("BATERIA C4 CONVERSA ANTIGA");

    const rec = (await ctx.indexeddb.lerConversas()).find((c) => c.id === id);
    ctx.verificar("parecer migrou para a última proposta", rec?.results?.[0]?.artifactId === "auditoria:117-25:p2", rec?.results?.[0]?.artifactId);
    ctx.verificar(
      "rodada sobrescrita desceu para a proposta anterior",
      rec?.auditorias?.find((a) => a.auditId === "rodada-sobrescrita")?.artifactId === "auditoria:117-25:p1",
      JSON.stringify(rec?.auditorias),
    );

    const deNovo = ctx.page.getByRole("button", { name: /auditar de novo/i });
    ctx.verificar("um único botão de auditar de novo", (await deNovo.count()) === 1, String(await deNovo.count()));
    ctx.verificar("o aviso diz quantas páginas não foram lidas", (await ctx.page.getByText(/14 PÁGINAS NÃO FORAM LIDAS/).count()) > 0);
    ctx.verificar("a contagem não aparece sozinha", (await ctx.page.getByText(/contagem INCOMPLETA/).count()) > 0);
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas c4`
Esperado: `ok c4`. Se ficar vermelho, é defeito do produto ou da jornada. Investigue antes de mexer: leia a captura em `scratchpad/bateria/<data>/c4.png` e siga `superpowers:systematic-debugging`. Conserto de produto segue a seção "Tratamento de defeito achado" do desenho.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/conversas/c4-conversa-antiga.mjs
git diff --cached --stat
git commit -m "a bateria prova que conversa antiga abre com o parecer no cartao certo"
```

---

### Tarefa 8: jornada A1 — a leitura da IA aborta

**Arquivos:**
- Criar: `scripts/bateria/jornadas/auditoria/a1-leitura-da-ia-aborta.mjs`

**Interfaces:**
- Consome: o `ctx` da Tarefa 6. A fila aceita `audit-global` com `abortar` (Tarefas 1 e 2).

- [ ] **Passo 1: escrever a jornada**

`scripts/bateria/jornadas/auditoria/a1-leitura-da-ia-aborta.mjs`:

```js
// A1 — o caso do 117_25 em 14/09/2026 15:45: a leitura global abortou e o parecer
// saiu só com as regras. Tem de dizer isso em vermelho e gravar no banco.
export default {
  id: "a1",
  area: "auditoria",
  titulo: "leitura da IA aborta: parecer avisa e grava",
  async rodar(ctx) {
    await ctx.login();
    await ctx.ia.fila("audit-global", "abortar");

    await ctx.anexar(["tests/117_25_md_geral_a.pdf"]);
    await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
    await (await ctx.esperarBotao(/Auditar o memorial/, 30_000)).click();

    // O documento tem folhas mudas: o cartão oferece as duas saídas. Aqui interessa
    // a leitura da IA, não a transcrição.
    const semTranscrever = await ctx.esperarBotao(/Auditar sem transcrever|^Auditar$/, 120_000);
    await semTranscrever.click();

    await ctx.esperarTexto(/A IA NÃO LEU O DOCUMENTO/, 600_000);
    ctx.verificar("aviso vermelho visível", await ctx.visivel(ctx.page.getByText(/AUDITORIA INCOMPLETA — A IA NÃO LEU O DOCUMENTO/)));
    ctx.verificar("contagem marcada como incompleta", (await ctx.page.getByText(/contagem INCOMPLETA/).count()) > 0);

    const [audit] = await ctx.banco.consultar(
      `select status, report->'runtime'->'passadas_incompletas' as passadas from "Audit" order by "createdAt" desc limit 1`,
    );
    ctx.verificar("auditoria gravada como COMPLETED", audit?.status === "COMPLETED", audit?.status);
    ctx.verificar(
      "a etapa que falhou está no parecer gravado",
      JSON.stringify(audit?.passadas ?? []).includes("Leitura global"),
      JSON.stringify(audit?.passadas),
    );
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas a1`
Esperado: `ok a1`. Referência de tempo: a extração das 218 páginas no servidor leva de 30 a 90s.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/auditoria/a1-leitura-da-ia-aborta.mjs
git diff --cached --stat
git commit -m "a bateria prova que leitura da ia abortada vira aviso vermelho e parecer gravado"
```

---

### Tarefa 9: jornada A3 — reauditar o mesmo memorial

**Arquivos:**
- Criar: `scripts/bateria/jornadas/auditoria/a3-reauditar-mesmo-memorial.mjs`

**Interfaces:**
- Consome: o `ctx` da Tarefa 6.

- [ ] **Passo 1: escrever a jornada**

`scripts/bateria/jornadas/auditoria/a3-reauditar-mesmo-memorial.mjs`:

```js
// A3 — o fluxo que desmontou em 14/09/2026: auditar o 117_25, e auditar de novo
// transcrevendo. Cada rodada com cartão e parecer próprios (a486a53).
export default {
  id: "a3",
  area: "auditoria",
  titulo: "reauditar o mesmo memorial abre outra rodada",
  async rodar(ctx) {
    await ctx.login();

    // Rodada 1: sem transcrever → parecer parcial (14 folhas não lidas).
    await ctx.anexar(["tests/117_25_md_geral_a.pdf"]);
    await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
    await (await ctx.esperarBotao(/Auditar o memorial/, 30_000)).click();
    await (await ctx.esperarBotao(/Auditar sem transcrever/, 120_000)).click();
    await ctx.esperarTexto(/14 PÁGINAS NÃO FORAM LIDAS/, 600_000);

    // Rodada 2: pelo botão do cartão, transcrevendo.
    const deNovo = await ctx.esperarBotao(/Transcrever e auditar de novo|Auditar de novo/, 30_000);
    await deNovo.click();
    const transcrever = await ctx.esperarBotao(/^Transcrever e auditar$/, 180_000);
    ctx.verificar("cartão novo oferece Transcrever e auditar", await transcrever.isEnabled());
    await transcrever.click();

    // Fim da rodada 2: dois cartões com parecer ("Ver o parecer" em cada um).
    const fim = Date.now() + 900_000;
    while (Date.now() < fim && (await ctx.page.getByRole("button", { name: /Ver o parecer/ }).count()) < 2) {
      await ctx.page.waitForTimeout(3000);
    }

    const conversa = (await ctx.indexeddb.lerConversas()).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    const pareceres = (conversa?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar("duas rodadas gravadas", pareceres.length === 2, String(pareceres.length));
    ctx.verificar(
      "cada rodada com o próprio id",
      new Set(pareceres.map((r) => r.artifactId)).size === pareceres.length,
      pareceres.map((r) => r.artifactId).join(" | "),
    );
    ctx.verificar(
      "a rodada 2 leu as folhas transcritas",
      pareceres.some((r) => (r.payload?.report?.arquivos_analisados?.[0]?.cobertura?.paginas_transcritas ?? 0) > 0),
    );
    ctx.verificar(
      "só a rodada mais recente oferece auditar de novo",
      (await ctx.page.getByRole("button", { name: /auditar de novo/i }).count()) === 1,
    );
    ctx.verificar("o palco mostra o que mudou entre as rodadas", (await ctx.page.locator("[data-diff-do-parecer]").count()) > 0);

    const auditorias = await ctx.banco.consultar(`select status from "Audit" order by "createdAt"`);
    ctx.verificar("as duas auditorias concluídas no banco", auditorias.filter((a) => a.status === "COMPLETED").length === 2, JSON.stringify(auditorias));
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas a3`
Esperado: `ok a3`. Se "o palco mostra o que mudou" ficar vermelho, confira na captura se o palco está na vista "Auditoria". A faixa `[data-diff-do-parecer]` só aparece nessa vista. Se a jornada precisar clicar no chip "Auditoria" antes, acrescente o clique na jornada; isso não é defeito do produto.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/auditoria/a3-reauditar-mesmo-memorial.mjs
git diff --cached --stat
git commit -m "a bateria prova que reauditar o mesmo memorial abre outra rodada e guarda as duas"
```

---

### Tarefa 10: primeira rodada completa e registro

**Arquivos:**
- Criar: `docs/bateria/defeitos-achados.md`

- [ ] **Passo 1: rodar tudo**

Rode: `npm run bateria`
Esperado: relatório completo. Anote quantos testes puros ficaram verdes, vermelhos e apodrecidos, e o resultado das 4 jornadas.

- [ ] **Passo 2: triagem dos vermelhos**

Para cada vermelho ou apodrecido:
1. Investigue a causa com `superpowers:systematic-debugging`.
2. **Defeito claro de produto:** escreva o teste puro que falha, conserte, rode a jornada ou o teste até ficar verde, commit e push, um por defeito.
3. **Teste que depende de dado do banco de desenvolvimento** e falha no `nexodoc_teste` vazio: acrescente a semente mínima que ele precisa em `prepararBanco` ou dentro do próprio teste. Nunca aponte o teste para o `nexodoc_dev`.
4. **Decisão de produto:** pare e pergunte ao Matheus, descrevendo o que acontece e as opções.

- [ ] **Passo 3: registro**

`docs/bateria/defeitos-achados.md`:

```markdown
# Defeitos achados pela bateria

Um defeito por linha, na ordem em que foram achados. "Travado por" é o teste que
quebra se o defeito voltar.

| Data | Cenário | Defeito | Causa | Commit | Travado por |
|---|---|---|---|---|---|
| 14/09/2026 | (antes da bateria) | reauditar o mesmo memorial mostrava o parecer antigo | id da auditoria por documento | a486a53 | scripts/test-auditoria-da-proposta.ts, jornada a3 |
| 14/09/2026 | (antes da bateria) | contagem de auditoria incompleta parecia o total | nenhuma tela lia `passadas_incompletas` junto do número | 983ef51 | scripts/test-auditoria-incompleta.ts, jornada a1 |
```

Acrescente uma linha para cada defeito consertado no Passo 2.

- [ ] **Passo 4: commit e push**

```bash
git add docs/bateria/defeitos-achados.md
git diff --cached --stat
git commit -m "primeira rodada da bateria registrada"
git push origin main
```

- [ ] **Passo 5: próximo plano**

Com a bateria verde em duas rodadas seguidas, escreva o plano da segunda rodada com `superpowers:writing-plans`: os cenários restantes do catálogo do desenho (A2, A4, A5, A6, A7, C1, C2, C3, C5, V1, V2, X1, X2), em `docs/superpowers/plans/<data>-bateria-segunda-rodada.md`.

Para cada cenário que exigir uma operação que o simulador ainda não cobre, o próprio plano acrescenta a resposta dela em `lib/ia-simulada.ts`:
- **V1 e V2:** `nexo-selo`, `nexo-selo-image`, `nexo-selo-identidade` e `nexo-volume-check`;
- **A7:** `audit-chat-turn` com `encaminhar_para_geracao`.

Os cenários marcados **[decisão de produto]** (C1, C3) começam perguntando ao Matheus.
