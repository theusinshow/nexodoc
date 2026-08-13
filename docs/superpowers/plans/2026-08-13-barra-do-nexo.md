# Barra do Nexo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar a faixa vazia de `/nexo` (que hoje só diz "NEXO") por uma barra que mostra o contexto da obra em repouso e a auditoria em curso quando há.

**Architecture:** A barra sai do `AppShell` — que não alcança os providers do Nexo, pois eles vivem dentro do seu `children` — e vira uma linha do `NexoShell`, irmã de `__sidebar`/`__stage`/`__copilot`. Toda a regra do que a barra afirma mora em dois módulos puros testáveis em node cru; o componente React só renderiza o que eles devolvem. `AuditoriaEmCursoInfo` ganha `conversationId` para o progresso não vazar entre conversas.

**Tech Stack:** Next.js (App Router), React 19, TypeScript, Tailwind v4 + `app/globals.css`, testes em node cru (`node scripts/*.ts`, `node:assert/strict`), provas de navegador em Playwright (`scripts/prova-*.mjs`).

## Global Constraints

- **Idioma:** todo código, comentário, commit e texto de tela em **pt-BR**. Comentários explicam *por quê*, não *o quê* — siga o tom dos arquivos vizinhos (ex.: `modules/nexo/lib/etapas-da-auditoria.ts`).
- **Módulos puros são puros:** `modules/nexo/lib/*.ts` testados em node não podem importar React, `next/*`, nem nada de runtime do browser. É o que permite `node scripts/test-*.ts`.
- **Precedência da identidade, já fixada no produto:** engenheiro > agente > carimbo > vazio. Empate não preenche.
- **Nada de `git add -A`.** Sempre caminhos explícitos, e sempre `git diff --cached --stat` antes de commitar — caminho inexistente derruba o `git add` inteiro em silêncio.
- **Commits direto na `main`.** Não criar branch nem PR.
- **Abaixo de 1024px** o Nexo não tenta caber: mostra o recado de tela estreita. A barra some junto com `__stage`/`__copilot`.
- **Estado vazio é ausência:** sem obra lida e sem auditoria em curso, a barra **não renderiza**. Nada de faixa dizendo "nenhum documento lido".
- **Fora de escopo:** progresso de capas/LD/montagem de volume. Esse `busy` é `useState` dentro do `ConfirmationCard` e morre com o cartão; elevá-lo é outro spec.

**Spec:** `docs/superpowers/specs/2026-08-13-barra-do-nexo-design.md`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `modules/nexo/lib/contexto-da-barra.ts` (criar) | Puro. Dado `identidade` + `seloResults`, diz qual obra/órgão/código a barra afirma — ou `null`. |
| `modules/nexo/lib/resumo-da-auditoria.ts` (criar) | Puro. Dados os marcos, diz a etapa corrente em uma linha. |
| `scripts/test-nexo-contexto-da-barra.ts` (criar) | Teste em node do módulo acima. |
| `scripts/test-nexo-resumo-da-auditoria.ts` (criar) | Teste em node do módulo acima. |
| `modules/nexo/state/auditoria-store.tsx` (modificar) | Ganha `conversationId` em `AuditoriaEmCursoInfo`. |
| `modules/nexo/components/ConfirmationCard.tsx:2235` (modificar) | Passa o `conversationId` ao `iniciar`. |
| `modules/nexo/components/PalcoDoNexo.tsx:40` e `NexoWorkspace.tsx:168` (modificar) | Filtram `emCurso` pela conversa ativa. |
| `modules/nexo/components/BarraDoNexo.tsx` (criar) | Só render: as duas camadas. |
| `modules/nexo/components/NexoShell.tsx` (modificar) | Nova prop/linha `barra`. |
| `app/globals.css` (modificar) | `.nexo-shell__barra` e as linhas do grid. |
| `components/layout/app-shell.tsx` (modificar) | Não renderiza `<header>` quando `fullBleed`. |
| `scripts/prova-barra-do-nexo.mjs` (criar) | Prova no navegador, sem gastar token. |

---

### Task 1: `contextoDaBarra` — o que a barra afirma em repouso

**Files:**
- Create: `modules/nexo/lib/contexto-da-barra.ts`
- Test: `scripts/test-nexo-contexto-da-barra.ts`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: `SeloResult` de `modules/nexo/lib/selo-render.ts:68`; `IdentidadeDoProjeto` de `modules/nexo/lib/identidade.ts:23`; `summarizeSelos` de `modules/nexo/lib/agent-context.ts:80`.
- Produces: `interface ContextoDaBarra { obra: string; orgao?: string; codigo?: string }` e `contextoDaBarra(entrada: { identidade: IdentidadeDoProjeto; seloResults: readonly SeloResult[] }): ContextoDaBarra | null`. A Task 4 renderiza esse retorno.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-contexto-da-barra.ts`:

```ts
/**
 * O que a BARRA DO TOPO pode afirmar sobre a obra.
 *
 * A regra que se prova aqui é a precedência: engenheiro > carimbo > vazio. E a
 * regra que mais importa é a última — sem obra, a função devolve `null`, e é
 * isso que faz a barra não existir em vez de existir vazia dizendo que não sabe
 * de nada.
 *
 *   node scripts/test-nexo-contexto-da-barra.ts   (== npm run test:nexo:contexto-barra)
 */
import assert from "node:assert/strict";

import { contextoDaBarra } from "../modules/nexo/lib/contexto-da-barra.ts";
import type { SeloResult } from "../modules/nexo/lib/selo-render.ts";

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

/** Um selo com só o que este teste precisa; o resto é casca vazia. */
function selo(patch: Partial<NonNullable<SeloResult["extraction"]>>): SeloResult {
  return {
    fileName: "ARQ-01.pdf",
    pageNumber: 1,
    pageCount: 1,
    extraction: {
      disciplina: null,
      folha: null,
      total: null,
      numeroFolha: null,
      arquivo: null,
      conteudo: null,
      cliente: null,
      secretaria: null,
      obra: null,
      fase: null,
      tituloSecao: null,
      data: null,
      logoOrgao: null,
      confianca: "alta",
      ...patch,
    },
  };
}

// ---------------------------------------------------------------------------
// Ausência: a barra não nasce
// ---------------------------------------------------------------------------

test("sem identidade e sem selo, não há o que afirmar", () => {
  assert.equal(contextoDaBarra({ identidade: {}, seloResults: [] }), null);
});

test("selo lido mas sem obra também não basta", () => {
  assert.equal(
    contextoDaBarra({ identidade: {}, seloResults: [selo({ cliente: "PREFEITURA DE XANXERÊ" })] }),
    null,
  );
});

test("obra só de espaços não é obra", () => {
  assert.equal(contextoDaBarra({ identidade: { obra: "   " }, seloResults: [] }), null);
});

// ---------------------------------------------------------------------------
// Precedência: engenheiro > carimbo
// ---------------------------------------------------------------------------

test("sem correção, a obra vem do carimbo", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [selo({ obra: "ESCOLA MUNICIPAL JARDIM MARISTELA" })],
  });
  assert.equal(r?.obra, "ESCOLA MUNICIPAL JARDIM MARISTELA");
});

test("a correção do engenheiro vence o carimbo", () => {
  const r = contextoDaBarra({
    identidade: { obra: "CRECHE JARDIM MARISTELA" },
    seloResults: [selo({ obra: "ESCOLA MUNICIPAL JARDIM MARISTELA" })],
  });
  assert.equal(r?.obra, "CRECHE JARDIM MARISTELA");
});

test("o órgão segue a mesma precedência", () => {
  const r = contextoDaBarra({
    identidade: { obra: "CRECHE X", orgao: "PREFEITURA MUNICIPAL DE CHAPECÓ" },
    seloResults: [selo({ obra: "CRECHE X", cliente: "PREF. CHAPECO" })],
  });
  assert.equal(r?.orgao, "PREFEITURA MUNICIPAL DE CHAPECÓ");
});

test("sem correção, o órgão vem do cliente do carimbo", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [selo({ obra: "CRECHE X", cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ" })],
  });
  assert.equal(r?.orgao, "PREFEITURA MUNICIPAL DE CHAPECÓ");
});

test("sem cliente, o brasão responde pelo órgão", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [selo({ obra: "CRECHE X", logoOrgao: "PREFEITURA MUNICIPAL DE SEARA" })],
  });
  assert.equal(r?.orgao, "PREFEITURA MUNICIPAL DE SEARA");
});

test("obra sem órgão nenhum: a barra existe, o órgão não", () => {
  const r = contextoDaBarra({ identidade: { obra: "CRECHE X" }, seloResults: [] });
  assert.deepEqual(r, { obra: "CRECHE X" });
});

// ---------------------------------------------------------------------------
// O código da obra
// ---------------------------------------------------------------------------

test("o código sai do nome de arquivo dos selos, como a pasta da lateral", () => {
  const r = contextoDaBarra({
    identidade: {},
    seloResults: [{ ...selo({ obra: "CRECHE X", arquivo: "063-26-ARQ-01" }) }],
  });
  assert.equal(r?.codigo, "063_26");
});

test("o código corrigido à mão vence o derivado", () => {
  const r = contextoDaBarra({
    identidade: { obra: "CRECHE X", codigo: "040_26" },
    seloResults: [{ ...selo({ obra: "CRECHE X", arquivo: "063-26-ARQ-01" }) }],
  });
  assert.equal(r?.codigo, "040_26");
});

// ---------------------------------------------------------------------------
// Aparar
// ---------------------------------------------------------------------------

test("os valores saem aparados", () => {
  const r = contextoDaBarra({
    identidade: { obra: "  CRECHE X  ", orgao: "  PREF X  " },
    seloResults: [],
  });
  assert.deepEqual(r, { obra: "CRECHE X", orgao: "PREF X" });
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
node scripts/test-nexo-contexto-da-barra.ts
```

Esperado: FALHA — `Cannot find module '../modules/nexo/lib/contexto-da-barra.ts'`.

- [ ] **Step 3: Implementar o mínimo**

Criar `modules/nexo/lib/contexto-da-barra.ts`:

```ts
/**
 * O que a BARRA DO TOPO pode afirmar sobre a obra da conversa.
 *
 * Devolver `null` é resposta, não falha: antes da leitura dos selos não existe
 * obra nenhuma — não há `projectId` no Nexo, e a identidade nasce dos próprios
 * PDFs. Uma faixa dizendo "nenhum documento lido ainda" ocuparia a maior parte
 * do tempo declarando ignorância, que é o defeito que esta barra veio corrigir.
 * Sem obra, a barra não existe.
 *
 * A precedência é a do produto inteiro: engenheiro > carimbo > vazio. Ver
 * [[identidade.ts]].
 *
 * PURO: nenhum import de runtime, para rodar em node pelado no
 * `scripts/test-nexo-contexto-da-barra.ts`.
 */

import type { IdentidadeDoProjeto } from "./identidade";
import type { SeloResult } from "./selo-render";
import { summarizeSelos } from "./agent-context";

export interface ContextoDaBarra {
  /** Nome da obra. É o que faz a barra existir. */
  obra: string;
  /** Órgão/cliente, quando se sabe. */
  orgao?: string;
  /** Código da obra ("063_26") — o mesmo que agrupa a pasta na lateral. */
  codigo?: string;
}

/** Aparado, ou `undefined`. Campo em branco é ausência, não valor. */
function texto(v: string | null | undefined): string | undefined {
  const t = v?.trim();
  return t ? t : undefined;
}

/** O primeiro selo que respondeu por este campo. O carimbo dominante basta. */
function doSelo(
  selos: readonly SeloResult[],
  campo: "obra" | "cliente" | "logoOrgao",
): string | undefined {
  for (const s of selos) {
    const v = texto(s.extraction?.[campo]);
    if (v) return v;
  }
  return undefined;
}

export function contextoDaBarra(entrada: {
  identidade: IdentidadeDoProjeto;
  seloResults: readonly SeloResult[];
}): ContextoDaBarra | null {
  const { identidade, seloResults } = entrada;

  const obra = texto(identidade.obra) ?? doSelo(seloResults, "obra");
  if (!obra) return null;

  /*
   * O brasão é a terceira escolha de propósito: ele diz de quem é o logotipo
   * impresso, que costuma bater com o cliente mas não é o campo do cliente.
   */
  const orgao =
    texto(identidade.orgao) ??
    doSelo(seloResults, "cliente") ??
    doSelo(seloResults, "logoOrgao");

  /*
   * O código é derivado do mesmo jeito que a chave da pasta na lateral
   * (`deriveFolderKey`, no conversation-store): do nome de arquivo dos selos.
   * Repetir a derivação em vez de expor o `folderKey` mantém este módulo puro.
   */
  const codigo =
    texto(identidade.codigo) ??
    (seloResults.length > 0
      ? texto(
          summarizeSelos(
            seloResults.map((r) => ({
              fileName: r.fileName,
              arquivo: r.extraction?.arquivo ?? null,
              disciplina: r.extraction?.disciplina ?? null,
              obra: r.extraction?.obra ?? null,
            })),
          ).codigo,
        )
      : undefined);

  return { obra, ...(orgao ? { orgao } : {}), ...(codigo ? { codigo } : {}) };
}
```

- [ ] **Step 4: Rodar até passar**

```bash
node scripts/test-nexo-contexto-da-barra.ts
```

Esperado: 12 testes `ok`, `12 teste(s) passaram.`, exit 0.

Se `summarizeSelos` puxar algum import de runtime e o node reclamar, **não** contorne com stub: mova a derivação do código para dentro deste módulo copiando `extractCodigo` de `modules/nexo/lib/agent-context.ts`, e diga isso no comentário.

- [ ] **Step 5: Registrar o script no package.json**

Em `package.json`, no bloco `scripts`, logo após `"test:nexo:identidade"`:

```json
    "test:nexo:contexto-barra": "node scripts/test-nexo-contexto-da-barra.ts",
```

Rodar `npm run test:nexo:contexto-barra` e confirmar a mesma saída.

- [ ] **Step 6: Commitar**

```bash
git add modules/nexo/lib/contexto-da-barra.ts scripts/test-nexo-contexto-da-barra.ts package.json
git diff --cached --stat
git commit -F - <<'EOF'
barra do nexo: a regra do que se pode afirmar sobre a obra

Devolver null é resposta: sem selo lido não existe obra, e é isso que vai
fazer a barra não nascer em vez de nascer vazia.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: `etapaCorrente` — a auditoria em uma linha

**Files:**
- Create: `modules/nexo/lib/resumo-da-auditoria.ts`
- Test: `scripts/test-nexo-resumo-da-auditoria.ts`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: `etapasDosMarcos` e `MarcoRecebido` de `modules/nexo/lib/etapas-da-auditoria.ts:46,21`; `NOME_DA_PASSADA` de `lib/audit-progress.ts`.
- Produces: `interface ResumoDaAuditoria { rotulo: string; contagem?: string }` e `resumoDaAuditoria(marcos: readonly MarcoRecebido[]): ResumoDaAuditoria`. A Task 4 renderiza `rotulo` + `contagem`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-resumo-da-auditoria.ts`:

```ts
/**
 * A auditoria em curso reduzida a UMA LINHA, para a barra do topo.
 *
 * O painel do palco mostra a lista inteira de etapas; a barra tem uma linha e
 * precisa escolher. Escolhe a primeira não concluída — a que está acontecendo.
 * Antes do primeiro marco não há etapa nenhuma, e a barra diz que está enviando
 * em vez de inventar uma etapa que o motor não anunciou.
 *
 *   node scripts/test-nexo-resumo-da-auditoria.ts   (== npm run test:nexo:resumo-auditoria)
 */
import assert from "node:assert/strict";

import { resumoDaAuditoria } from "../modules/nexo/lib/resumo-da-auditoria.ts";
import type { MarcoRecebido } from "../modules/nexo/lib/etapas-da-auditoria.ts";

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

function marco(
  passada: MarcoRecebido["passada"],
  estado: MarcoRecebido["estado"],
  extra: Partial<MarcoRecebido> = {},
): MarcoRecebido {
  return { passada, estado, emMs: 1_000, ...extra } as MarcoRecebido;
}

test("sem marco nenhum, a barra diz que está enviando", () => {
  assert.deepEqual(resumoDaAuditoria([]), { rotulo: "Enviando o documento…" });
});

test("a etapa corrente é a primeira não concluída", () => {
  const r = resumoDaAuditoria([
    marco("extracao", "inicio"),
    marco("extracao", "fim"),
    marco("regras", "inicio"),
  ]);
  assert.equal(r.rotulo, "Regras determinísticas");
});

test("todas concluídas: a última vale como a corrente", () => {
  const r = resumoDaAuditoria([
    marco("extracao", "inicio"),
    marco("extracao", "fim"),
    marco("parecer", "inicio"),
    marco("parecer", "fim"),
  ]);
  assert.equal(r.rotulo, "Parecer");
});

test("etapa contada mostra a contagem", () => {
  const r = resumoDaAuditoria([
    marco("blocos", "progresso", { indice: 3, total: 8 }),
  ]);
  assert.equal(r.contagem, "3 de 8");
});

test("etapa concluída não mostra contagem — ela acabou", () => {
  const r = resumoDaAuditoria([
    marco("blocos", "progresso", { indice: 8, total: 8 }),
    marco("blocos", "fim", { indice: 8, total: 8 }),
  ]);
  assert.equal(r.contagem, undefined);
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar para ver falhar**

```bash
node scripts/test-nexo-resumo-da-auditoria.ts
```

Esperado: FALHA — módulo não encontrado.

Se `NOME_DA_PASSADA["regras"]` não for exatamente `"Regras determinísticas"`, **ajuste o teste ao valor real** (leia `lib/audit-progress.ts`) em vez de mudar o rótulo do produto — a barra deve dizer o mesmo que o painel.

- [ ] **Step 3: Implementar o mínimo**

Criar `modules/nexo/lib/resumo-da-auditoria.ts`:

```ts
/**
 * A auditoria em curso, reduzida ao que cabe numa linha.
 *
 * O painel do palco (`AuditoriaEmCurso`) lista todas as etapas; a barra do topo
 * tem uma linha só e precisa escolher uma. Escolhe a que está acontecendo — a
 * primeira não concluída. Quando todas concluíram e a auditoria ainda não
 * terminou, vale a última: o motor está fechando.
 *
 * Antes do primeiro marco não se afirma etapa alguma. É a mesma honestidade do
 * painel: passada que o motor não anunciou não entra na lista.
 *
 * PURO: nenhum import de runtime, para rodar em node pelado no
 * `scripts/test-nexo-resumo-da-auditoria.ts`.
 */

import { NOME_DA_PASSADA } from "@/lib/audit-progress";
import { etapasDosMarcos, type MarcoRecebido } from "./etapas-da-auditoria";

export interface ResumoDaAuditoria {
  /** Nome da etapa corrente, ou o que se diz antes de haver etapa. */
  rotulo: string;
  /** "3 de 8", só enquanto a etapa contada ainda corre. */
  contagem?: string;
}

export function resumoDaAuditoria(
  marcos: readonly MarcoRecebido[],
): ResumoDaAuditoria {
  const etapas = etapasDosMarcos(marcos);
  if (etapas.length === 0) return { rotulo: "Enviando o documento…" };

  const corrente = etapas.find((e) => !e.concluida) ?? etapas[etapas.length - 1];
  const contagem =
    !corrente.concluida && corrente.indice !== undefined && corrente.total !== undefined
      ? `${corrente.indice} de ${corrente.total}`
      : undefined;

  return { rotulo: NOME_DA_PASSADA[corrente.passada], ...(contagem ? { contagem } : {}) };
}
```

Se o alias `@/` não resolver em node cru, troque por caminho relativo (`../../../lib/audit-progress`) — `etapas-da-auditoria.ts` já é testado assim, siga o que aquele arquivo faz.

- [ ] **Step 4: Rodar até passar**

```bash
node scripts/test-nexo-resumo-da-auditoria.ts
```

Esperado: 5 testes `ok`, exit 0.

- [ ] **Step 5: Registrar o script**

Em `package.json`, após `"test:nexo:contexto-barra"`:

```json
    "test:nexo:resumo-auditoria": "node scripts/test-nexo-resumo-da-auditoria.ts",
```

- [ ] **Step 6: Commitar**

```bash
git add modules/nexo/lib/resumo-da-auditoria.ts scripts/test-nexo-resumo-da-auditoria.ts package.json
git diff --cached --stat
git commit -F - <<'EOF'
barra do nexo: a auditoria em curso reduzida a uma linha

O painel do palco lista todas as etapas; a barra tem uma linha e precisa
escolher a que está acontecendo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: `conversationId` na auditoria em curso

O bug: `AuditoriaEmCursoInfo` não sabe de qual conversa é. Trocar de conversa no meio de uma auditoria deixa o `emCurso` vivo e o mostra no palco da conversa nova. No palco isso passa despercebido; numa barra sempre visível, não.

**Files:**
- Modify: `modules/nexo/state/auditoria-store.tsx:24-32`
- Modify: `modules/nexo/components/ConfirmationCard.tsx` (perto de `:2235`)
- Modify: `modules/nexo/components/PalcoDoNexo.tsx` (perto de `:40`)
- Modify: `modules/nexo/components/NexoWorkspace.tsx:168`

**Interfaces:**
- Produces: `AuditoriaEmCursoInfo.conversationId: string` e o helper `auditoriaDaConversa(emCurso, conversationId)` exportado de `auditoria-store.tsx`. A Task 4 usa o helper.

- [ ] **Step 1: Adicionar o campo e o helper**

Em `modules/nexo/state/auditoria-store.tsx`, dentro de `AuditoriaEmCursoInfo` (linha 24), acrescentar como primeiro campo:

```ts
export interface AuditoriaEmCursoInfo {
  /**
   * De QUAL conversa é esta auditoria.
   *
   * Sem isto o `emCurso` é global de verdade: trocar de conversa no meio de uma
   * análise levava o progresso junto e o exibia sobre a conversa nova, que não
   * pediu nada. No palco passava; numa barra sempre visível, não passa.
   */
  conversationId: string;
  nivel: "standard" | "deep";
```

E, ao fim do arquivo, depois de `useAuditoria`:

```ts
/**
 * A auditoria em curso SE ela for desta conversa — senão, nada.
 *
 * Um helper e não um filtro dentro do provider: o store guarda o fato, e cada
 * tela decide o que fazer com ele. Assim a retomada pós-F5, que é por conversa
 * e vive no `conversation-store`, continua sendo o outro caminho legítimo.
 */
export function auditoriaDaConversa(
  emCurso: AuditoriaEmCursoInfo | null,
  conversationId: string,
): AuditoriaEmCursoInfo | null {
  return emCurso && emCurso.conversationId === conversationId ? emCurso : null;
}
```

- [ ] **Step 2: Ver o TypeScript reclamar**

```bash
npx tsc --noEmit
```

Esperado: erro em `ConfirmationCard.tsx` — falta `conversationId` no objeto passado a `iniciar`. **É esse erro que prova que o campo é obrigatório.** Anote a linha exata que ele apontar.

- [ ] **Step 3: Preencher no disparo**

Em `modules/nexo/components/ConfirmationCard.tsx`, na chamada `auditoria.iniciar({...})` (perto de `:2235`), acrescentar o campo. O `conversationId` vem do `useConversation()` já consumido no arquivo — se não estiver desestruturado ali, use a variável do store existente (procure `conv.conversationId` ou o hook no topo do componente):

```ts
              auditoria.iniciar({
                conversationId,
                nivel,
                arquivo: file.name,
                cancelar: () => controle.abort(),
              });
```

- [ ] **Step 4: Filtrar nos dois consumidores atuais**

Em `modules/nexo/components/NexoWorkspace.tsx:168`, trocar:

```ts
  const auditandoAgora = Boolean(useAuditoria().emCurso);
```

por (o `conv` já existe neste componente; se o nome for outro, use o que estiver lá):

```ts
  const { emCurso } = useAuditoria();
  /* A auditoria só conta para ESTA conversa — ver `auditoriaDaConversa`. */
  const auditandoAgora = Boolean(auditoriaDaConversa(emCurso, conv.conversationId));
```

Ajustar o import para `import { auditoriaDaConversa, useAuditoria } from "../state/auditoria-store";`.

Em `modules/nexo/components/PalcoDoNexo.tsx:40`, aplicar o mesmo filtro sobre o `emCurso` lido ali, usando o `conversationId` do `useConversation()`.

- [ ] **Step 5: Verificar**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: ambos limpos, exit 0. Se `tsc --noEmit` não estiver configurado, use `npm run build` e confirme que compila.

- [ ] **Step 6: Commitar**

```bash
git add modules/nexo/state/auditoria-store.tsx modules/nexo/components/ConfirmationCard.tsx modules/nexo/components/PalcoDoNexo.tsx modules/nexo/components/NexoWorkspace.tsx
git diff --cached --stat
git commit -F - <<'EOF'
auditoria: o progresso passa a saber de qual conversa é

Trocar de conversa no meio de uma análise levava o emCurso junto e o exibia
sobre a conversa nova. No palco passava despercebido; na barra do topo, que
está sempre visível, não passaria.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: O componente `BarraDoNexo`

**Files:**
- Create: `modules/nexo/components/BarraDoNexo.tsx`

**Interfaces:**
- Consumes: `contextoDaBarra` (Task 1), `resumoDaAuditoria` (Task 2), `auditoriaDaConversa` + `useAuditoria` (Task 3), `useConversation` de `modules/nexo/state/conversation-store.tsx:1146`.
- Produces: `export function BarraDoNexo(): ReactNode | null` — **devolve `null`** quando não há obra nem auditoria. A Task 5 monta isso no shell.

- [ ] **Step 1: Escrever o componente**

Criar `modules/nexo/components/BarraDoNexo.tsx`:

```tsx
"use client";

/**
 * A barra do topo: em repouso diz de QUAL OBRA é esta conversa; enquanto uma
 * auditoria roda, cede o lugar ao progresso dela.
 *
 * Existe porque a faixa que estava aqui mostrava a palavra "NEXO" e nada mais —
 * resíduo do AppShell genérico. Marca e conta não cabiam: a barra lateral já faz
 * as duas coisas, e melhor. O que sobra para uma faixa horizontal é o que muda
 * com a conversa (a obra) e o que muda com o tempo (o trabalho pesado).
 *
 * NÃO RENDERIZA quando não há nem obra nem auditoria. Uma faixa dizendo "nenhum
 * documento lido ainda" passaria a maior parte do tempo declarando ignorância,
 * que é justamente o defeito que ela veio corrigir. O preço é o layout deslocar
 * quando ela nasce, e esse preço foi aceito no spec.
 */

import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { contextoDaBarra } from "../lib/contexto-da-barra";
import { resumoDaAuditoria } from "../lib/resumo-da-auditoria";
import { auditoriaDaConversa, useAuditoria } from "../state/auditoria-store";
import { useConversation } from "../state/conversation-store";

export function BarraDoNexo() {
  const { conversationId, identidade, seloResults } = useConversation();
  const { emCurso } = useAuditoria();

  const auditando = auditoriaDaConversa(emCurso, conversationId);
  const contexto = contextoDaBarra({ identidade, seloResults });

  // Nada a afirmar: a barra não existe, e o palco fica com a altura inteira.
  if (!auditando && !contexto) return null;

  if (auditando) {
    const { rotulo, contagem } = resumoDaAuditoria(auditando.marcos);
    return (
      <div
        className="nexo-barra"
        data-camada="trabalho"
        role="status"
        aria-live="polite"
      >
        <Loader2
          className="size-3.5 shrink-0 animate-spin text-primary"
          strokeWidth={1.8}
          aria-hidden
        />
        <span className="nexo-barra__rotulo">
          Auditoria {auditando.nivel === "deep" ? "profunda" : "padrão"}
        </span>
        <span className="nexo-barra__obra" title={auditando.arquivo}>
          {auditando.arquivo}
        </span>
        <span className="nexo-barra__etapa">
          {rotulo}
          {contagem ? ` — ${contagem}` : ""}
        </span>
        {auditando.cancelar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto shrink-0"
            onClick={auditando.cancelar}
          >
            <X />
            Cancelar
          </Button>
        )}
      </div>
    );
  }

  // Repouso. `contexto` é não-nulo aqui: o retorno acima já cobriu o outro caso.
  const { obra, orgao, codigo } = contexto!;
  return (
    <div className="nexo-barra" data-camada="repouso">
      <span className="nexo-barra__obra" title={obra}>
        {obra}
      </span>
      {orgao && <span className="nexo-barra__orgao">{orgao}</span>}
      {codigo && <span className="nexo-barra__codigo">{codigo}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: limpos. O componente ainda não está montado em lugar nenhum — isso é a Task 5.

- [ ] **Step 3: Commitar**

```bash
git add modules/nexo/components/BarraDoNexo.tsx
git diff --cached --stat
git commit -F - <<'EOF'
barra do nexo: o componente das duas camadas

Repouso mostra a obra; enquanto a auditoria roda, ela cede o lugar. Sem obra
e sem auditoria, devolve null -- a barra não existe.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Montar a barra no shell (e tirar o header do AppShell)

**Files:**
- Modify: `modules/nexo/components/NexoShell.tsx:20-52`
- Modify: `modules/nexo/components/NexoWorkspace.tsx:1827` (a chamada do `NexoShell`)
- Modify: `app/globals.css:971-1074`
- Modify: `components/layout/app-shell.tsx:30-58`

**Interfaces:**
- Consumes: `BarraDoNexo` (Task 4).
- Produces: `NexoShell` ganha a prop `barra?: ReactNode`. A classe `.nexo-barra` fica disponível para a prova da Task 6.

- [ ] **Step 1: Dar a linha ao NexoShell**

Em `modules/nexo/components/NexoShell.tsx`, acrescentar a prop e a linha. Assinatura:

```tsx
export function NexoShell({
  started,
  barra,
  sidebar,
  stage,
  copilot,
}: {
  started: boolean;
  /**
   * A faixa do topo. Pode vir `null` (o componente decide não existir), e por
   * isso a linha do grid só nasce quando há conteúdo — senão sobraria um vão.
   */
  barra?: ReactNode;
  sidebar: ReactNode;
  stage: ReactNode;
  copilot: ReactNode;
}) {
```

E, logo dentro da `<div className="nexo-shell ...">`, ANTES de `nexo-shell__sidebar`:

```tsx
      {/* A barra atravessa as colunas: ela fala da conversa inteira, não de
          uma das três áreas. Só nasce quando tem o que dizer. */}
      {barra && <div className="nexo-shell__barra">{barra}</div>}
```

Acrescentar `data-com-barra={Boolean(barra)}` na `<div>` raiz, junto de `data-started` — é o gancho do CSS que decide as linhas do grid.

- [ ] **Step 2: Passar a barra no workspace**

Em `modules/nexo/components/NexoWorkspace.tsx:1827`, acrescentar a prop:

```tsx
      <NexoShell
        started={started}
        barra={<BarraDoNexo />}
        sidebar={
```

Importar: `import { BarraDoNexo } from "./BarraDoNexo";`

**Atenção:** `<BarraDoNexo />` é sempre um elemento verdadeiro, então `{barra && ...}` na Task 5/Step 1 renderiza a `<div>` do grid mesmo quando o componente devolve `null` — a linha ficaria com altura 0, mas o `gap: 1rem` do grid ainda somaria espaço. Resolver no CSS com `.nexo-shell__barra:empty { display: none; }` (Step 3). Não tente resolver movendo a decisão para o workspace: o dado que decide vive dentro dos providers e é do componente.

- [ ] **Step 3: O CSS**

Em `app/globals.css`, logo após o bloco `.nexo-shell` (linha 971-976), acrescentar:

```css
/* A barra do topo atravessa as colunas: ela fala da conversa, nao de uma area.
   A linha so existe quando ha barra -- `data-com-barra` no shell -- e some de
   vez quando o componente decide nao renderizar nada (`:empty`).

   O `row-gap: 0` NAO e detalhe: o `.nexo-shell` usa `gap: 1rem`, que vale para
   linhas tambem. Com a barra vazia em `display: none` a faixa de 1rem entre as
   linhas continuaria cobrando espaco -- o vao que o estado vazio existe para
   nao ter. As colunas seguem com o mesmo respiro de antes; a barra traz o
   proprio `padding` e a propria borda. */
.nexo-shell {
  column-gap: 1rem;
  row-gap: 0;
}

.nexo-shell[data-com-barra="true"] {
  grid-template-rows: auto minmax(0, 1fr);
}

.nexo-shell__barra {
  grid-column: 1 / -1;
  min-width: 0;
}

.nexo-shell__barra:empty {
  display: none;
}

.nexo-barra {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-width: 0;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--border);
  background: var(--card);
  font-size: 0.8125rem;
}

.nexo-barra__obra {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--foreground);
  font-weight: 500;
}

.nexo-barra__orgao,
.nexo-barra__etapa {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted-foreground);
}

.nexo-barra__rotulo {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.07em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.nexo-barra__codigo {
  flex-shrink: 0;
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  color: var(--muted-foreground);
}
```

A regra `.nexo-shell { gap: 1rem }` original (linha 974) deve ser **substituída** pelo par `column-gap`/`row-gap` acima, não duplicada — deixar as duas conviverá com a ordem do arquivo decidindo quem vence, que é o tipo de silêncio que este repo já pagou caro.

E na media query de tela estreita (linha ~1065), acrescentar `.nexo-shell__barra` à lista que some:

```css
  .nexo-shell__barra,
  .nexo-shell__stage,
  .nexo-shell__splitter,
  .nexo-shell__copilot {
    display: none;
  }
```

**Armadilha conhecida deste repo:** regra fora de `@layer` vence as utilities do Tailwind e mata `border-*` em silêncio. Coloque estes blocos no mesmo lugar/camada onde as outras regras `.nexo-shell__*` já vivem, não no fim do arquivo.

- [ ] **Step 4: Tirar o header do AppShell quando fullBleed**

Em `components/layout/app-shell.tsx`, envolver o `<header>` (linha 38) numa condição, e atualizar o comentário da prop `fullBleed` (linha 15-20):

```tsx
      {/*
        Em fullBleed o cabecalho NAO existe.

        Quem usa fullBleed e o shell conversacional do Nexo, e la a barra
        lateral ja carrega marca, navegacao e conta -- repetir isso no topo
        poria a palavra "Nexo" duas vezes a 40px de distancia e daria dois donos
        ao menu da conta. O topo do Nexo tem barra propria (`BarraDoNexo`), que
        vive DENTRO dos providers e por isso alcanca a conversa ativa; deste
        header, que e irmao acima deles, nenhum hook do Nexo e alcancavel.
      */}
      {!fullBleed && (
        <header className="sticky top-0 z-50 shrink-0 border-b border-border bg-card/95 px-5 py-3">
          {/* ...conteúdo inalterado... */}
        </header>
      )}
```

Mantenha o conteúdo interno do header exatamente como está — só a condição é nova. `/volumes`, `/admin` e `/audit` não passam `fullBleed` e seguem com header.

- [ ] **Step 5: Verificar**

```bash
npx tsc --noEmit && npm run lint
```

Esperado: limpos.

- [ ] **Step 6: Commitar**

```bash
git add modules/nexo/components/NexoShell.tsx modules/nexo/components/NexoWorkspace.tsx app/globals.css components/layout/app-shell.tsx
git diff --cached --stat
git commit -F - <<'EOF'
barra do nexo: sai do AppShell, vira linha do shell

O header era irmão acima dos providers e não alcançava nenhum hook do Nexo.
Como linha do NexoShell ele lê a conversa ativa. Em fullBleed o AppShell
deixa de renderizar cabeçalho; /volumes e /admin seguem iguais.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: A prova no navegador, sem gastar token

**Files:**
- Create: `scripts/prova-barra-do-nexo.mjs`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: `.nexo-barra`, `[data-camada="repouso"]`, `[data-camada="trabalho"]` (Task 4/5).

**Molde:** copie a estrutura de `scripts/shot-audit-reconexao.mjs` — ele já sabe subir o app, semear o IndexedDB e rodar com `AUDIT_REUSE=1`, que é como se prova a auditoria sem pagar modelo. **Leia esse arquivo primeiro** e siga o que ele faz para login/sessão; não invente um caminho novo.

- [ ] **Step 1: Escrever a prova**

Criar `scripts/prova-barra-do-nexo.mjs` cobrindo, em ordem, as cinco asserções do spec:

1. Conversa nova, nada enviado: `page.locator(".nexo-barra")` tem `count === 0`. E o palco encosta no topo.
2. Com selos semeados no IndexedDB: `.nexo-barra[data-camada="repouso"]` visível, e o texto contém a obra semeada.
3. Auditoria disparada com `AUDIT_REUSE=1`: `.nexo-barra[data-camada="trabalho"]` visível, o texto da etapa muda ao menos uma vez, e o botão `Cancelar` existe.
4. Trocar de conversa na lateral durante a auditoria: a barra da conversa nova **não** mostra `data-camada="trabalho"`.
5. **Medir a caixa contra a janela**, não só a presença no DOM:

```js
/*
 * Asserção de DOM passa verde com o elemento fora da tela. O que prova que a
 * barra APARECE é a caixa dela caber na janela.
 */
const caixa = await page.locator(".nexo-barra").boundingBox();
const janela = page.viewportSize();
if (!caixa) throw new Error("a barra não tem caixa — não está renderizada");
if (caixa.y < 0 || caixa.y + caixa.height > janela.height) {
  throw new Error(`barra fora da janela: y=${caixa.y} h=${caixa.height} janela=${janela.height}`);
}
if (caixa.width < janela.width * 0.5) {
  throw new Error(`barra estreita demais: ${caixa.width} de ${janela.width}`);
}
```

Cada asserção imprime `ok  <nome>` e o script sai com código 1 na primeira falha, como as outras `prova-*.mjs`.

- [ ] **Step 2: Rodar**

```bash
npm run prova:barra-do-nexo
```

Esperado: as 5 asserções `ok`, exit 0. Nenhuma chamada de modelo cobrada (o `AUDIT_REUSE=1` serve a auditoria já gravada).

- [ ] **Step 3: Registrar o script**

Em `package.json`, junto das outras `prova:*`:

```json
    "prova:barra-do-nexo": "node scripts/prova-barra-do-nexo.mjs",
```

- [ ] **Step 4: Commitar**

```bash
git add scripts/prova-barra-do-nexo.mjs package.json
git diff --cached --stat
git commit -F - <<'EOF'
barra do nexo: a prova no navegador, sem gastar token

Mede a caixa contra a janela: asserção de DOM passa verde com o elemento
fora da tela.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Fechamento

Depois da Task 6, rodar a bateria que toca no que foi mexido e confirmar verde antes de dizer que acabou:

```bash
npm run test:nexo:contexto-barra && npm run test:nexo:resumo-auditoria && npm run lint && npx tsc --noEmit && npm run prova:barra-do-nexo
```

Se a prova de navegador falhar por motivo de ambiente (Playwright ausente, porta ocupada), **diga isso explicitamente** em vez de declarar a tarefa completa — os testes de node não substituem a prova visual, que é justamente o que pega a barra renderizada fora da janela.
