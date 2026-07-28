# Página como nó — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada folha vira um nó no canvas do Nexo, e corrigir o título de uma folha ali passa a valer na LD gerada depois — ligando o `ajustes` que o Document State deixou pronto e desligado.

**Architecture:** `ajustes` sobe para o `conversation-store` (persiste e restaura junto da conversa) e alimenta o ponto único `folhas(selosLidos, conv.ajustes)` que já existe no `NexoWorkspace`. O canvas troca `PranchaInfo`/`pranchasCount` por `Folha[]` + um mapa de números resolvidos, desenha um nó barato por folha numa grade dentro da fileira do tomo, e passa a fatiar por `gruposDasFolhas` em vez de `faixasDosTomos`. A geometria da grade sai para um módulo puro, testado em Node pelado.

**Tech Stack:** Next.js (App Router), React 19 + React Compiler, TypeScript, `@xyflow/react` (React Flow), Tailwind v4, IndexedDB via `modules/nexo/lib/nexo-db.ts`, testes puros em `scripts/test-nexo-*.ts` rodados por `node` (sem framework).

**Spec:** `docs/superpowers/specs/2026-07-28-nexo-pagina-como-no-design.md`

## Global Constraints

- **Nunca `git add -A` neste repositório.** Listar os arquivos, sempre. Um `git add -A` já varreu 2.578 arquivos de config de assistentes para dentro do repo.
- Commitar direto na `main` e dar `git push origin main`. Não criar branch nem PR.
- Mensagem de commit **sem acentos** (padrão do histórico), terminando em `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Testes puros: nenhum import de runtime em `modules/nexo/lib/folhas.ts` e no módulo novo de layout — eles rodam em `node` direto, com `.ts` na extensão do import.
- `modules/nexo/lib/folhas.ts` **não muda neste plano**. Ele já está implementado e testado; aqui ele é consumido.
- Objetos passados como dependência de `useMemo` que desce ao canvas precisam de **referência estável** entre renders. Um objeto literal novo a cada render recria todos os nós, e o popover de edição fecha no instante em que abre — defeito já ocorrido neste arquivo.
- Erro pré-existente e não relacionado: `npx eslint .` falha em `components/audit-pdf-viewer-internal.tsx:70` (react-hooks/immutability). Não é deste trabalho; não tentar consertar.
- Verificação de tipos em qualquer task que mexa em `.tsx`: `npx tsc --noEmit`.

---

### Task 1: Os testes puros que faltam na projeção

Fecha as três lacunas que o spec pede em `scripts/test-nexo-folhas.ts`. A mais importante é a equivalência entre `gruposDasFolhas` e `faixasDosTomos` — é ela que autoriza a troca da divisão no canvas (Task 5) como mudança comprovadamente idêntica.

**Files:**
- Modify: `scripts/test-nexo-folhas.ts` (acrescentar ao fim; o arquivo já tem 15 testes)

**Interfaces:**
- Consumes: `folhas`, `folhaId`, `gruposDasFolhas`, `aplicarAjuste` de `modules/nexo/lib/folhas.ts`; `buildBalancedQuantities` e `faixasDosTomos` de `lib/ld/ld-rules.ts`; os helpers locais `test()` e `selo()` que já existem no arquivo.
- Produces: nada consumido por outras tasks — é uma trava de regressão.

- [ ] **Step 1: Acrescentar `faixasDosTomos` ao import de `ld-rules`**

O arquivo já importa `buildBalancedQuantities` daquele módulo. Trocar a linha de import:

```ts
import { buildBalancedQuantities, faixasDosTomos } from "../lib/ld/ld-rules.ts";
```

- [ ] **Step 2: Escrever os três testes que faltam**

Colar no fim de `scripts/test-nexo-folhas.ts`, antes da linha final que imprime o resumo (se houver — caso o arquivo termine com um `console.log` de total, inserir **antes** dele):

```ts
// ---------------------------------------------------------------------------
// A troca da divisão no canvas só é segura porque estas duas concordam
// ---------------------------------------------------------------------------

test("sem grupo manual, gruposDasFolhas divide igual a faixasDosTomos", () => {
  const muitos = Array.from({ length: 24 }, (_, i) => selo("a.pdf", i + 1));
  const projetadas = folhas(muitos, {});
  const grupos = gruposDasFolhas(projetadas, 3, buildBalancedQuantities);
  const faixas = faixasDosTomos(24, 3);

  assert.equal(grupos.length, 3);
  grupos.forEach((ids, i) => {
    const esperado = projetadas.slice(faixas[i].inicio - 1, faixas[i].fim).map((f) => f.id);
    assert.deepEqual(ids, esperado, `tomo ${i + 1} divergiu da faixa`);
  });
});

test("desfazer: titulo undefined devolve o que o selo dizia e limpa `editado`", () => {
  const id = folhaId(SELOS[0]);
  const comAjuste = aplicarAjuste({}, id, { titulo: "TROCADO" });
  assert.equal(folhas(SELOS, comAjuste)[0].conteudo, "TROCADO");
  assert.equal(folhas(SELOS, comAjuste)[0].editado, true);

  const desfeito = aplicarAjuste(comAjuste, id, { titulo: undefined });
  // Ajuste vazio não pode sobrar ocupando o estado.
  assert.deepEqual(desfeito, {});
  assert.equal(folhas(SELOS, desfeito)[0].conteudo, SELOS[0].conteudo);
  assert.equal(folhas(SELOS, desfeito)[0].editado, false);
});

test("titulo so de espacos e tratado como ausente — nao vira titulo em branco na LD", () => {
  const id = folhaId(SELOS[0]);
  const ajustes = aplicarAjuste({}, id, { titulo: "   " });
  const out = folhas(SELOS, ajustes);
  assert.equal(out[0].conteudo, SELOS[0].conteudo);
  assert.equal(out[0].editado, false);
});
```

- [ ] **Step 3: Rodar e ver os três novos passarem**

Run: `npm run test:nexo:folhas`
Expected: as linhas `ok` de antes **mais** as três novas, e saída sem `FALHOU`. Se o teste da equivalência falhar, **pare o plano**: a troca da Task 5 deixa de ser segura e o spec precisa ser revisto.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-nexo-folhas.ts
git commit -m "Nexo: testes que faltavam na projecao das folhas

A equivalencia entre gruposDasFolhas e faixasDosTomos e o que autoriza o canvas a
trocar de divisao sem mudar nada na tela. Mais o desfazer (titulo undefined volta
ao selo) e o titulo so de espacos, que nao pode virar titulo em branco na LD.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: Geometria da grade (módulo puro)

Onde cada folha fica dentro da fileira do tomo, e quanto a fileira ocupa em altura. Puro e testado à parte porque é a única parte do layout com aritmética — e porque errar aqui faz um tomo de 200 folhas invadir a fileira de baixo, que é o tipo de defeito que só se vê depois de pronto.

**Files:**
- Create: `modules/nexo/lib/layout-canvas.ts`
- Create: `scripts/test-nexo-layout.ts`
- Modify: `package.json` (script `test:nexo:layout`)

**Interfaces:**
- Consumes: nada.
- Produces: `COLUNAS_DA_GRADE`, `PASSO_X`, `PASSO_Y`, `ALTURA_MINIMA_FILEIRA`, `posicaoNaGrade(indice, colunas?)`, `larguraDaGrade(quantidade, colunas?)`, `alturaDaGrade(quantidade, colunas?)`, `alturaDaFileira(quantidadeDeFolhas)`, `topoDasFileiras(alturas)`. A Task 5 usa todas.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-layout.ts`:

```ts
/**
 * Teste da GEOMETRIA do canvas: onde cada folha cai na grade do tomo e quanto a
 * fileira ocupa. Puro — roda em Node pelado.
 *
 *   node scripts/test-nexo-layout.ts   (== npm run test:nexo:layout)
 */
import assert from "node:assert/strict";

import {
  ALTURA_MINIMA_FILEIRA,
  PASSO_X,
  PASSO_Y,
  alturaDaFileira,
  alturaDaGrade,
  larguraDaGrade,
  posicaoNaGrade,
  topoDasFileiras,
} from "../modules/nexo/lib/layout-canvas.ts";

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

test("a grade preenche da esquerda para a direita e quebra na 7a folha", () => {
  assert.deepEqual(posicaoNaGrade(0), { x: 0, y: 0 });
  assert.deepEqual(posicaoNaGrade(5), { x: 5 * PASSO_X, y: 0 });
  assert.deepEqual(posicaoNaGrade(6), { x: 0, y: PASSO_Y });
  assert.deepEqual(posicaoNaGrade(13), { x: PASSO_X, y: 2 * PASSO_Y });
});

test("largura para de crescer quando a linha enche", () => {
  assert.equal(larguraDaGrade(0), 0);
  assert.equal(larguraDaGrade(1), PASSO_X);
  assert.equal(larguraDaGrade(6), 6 * PASSO_X);
  assert.equal(larguraDaGrade(7), 6 * PASSO_X);
});

test("altura cresce por linha comecada", () => {
  assert.equal(alturaDaGrade(0), 0);
  assert.equal(alturaDaGrade(1), PASSO_Y);
  assert.equal(alturaDaGrade(6), PASSO_Y);
  assert.equal(alturaDaGrade(7), 2 * PASSO_Y);
  assert.equal(alturaDaGrade(200), 34 * PASSO_Y);
});

test("fileira pequena usa a altura minima; a grande manda", () => {
  assert.equal(alturaDaFileira(0), ALTURA_MINIMA_FILEIRA);
  assert.equal(alturaDaFileira(6), ALTURA_MINIMA_FILEIRA);
  assert.ok(alturaDaFileira(200) > ALTURA_MINIMA_FILEIRA);
});

test("um tomo grande nao invade a fileira de baixo", () => {
  const alturas = [alturaDaFileira(200), alturaDaFileira(3)];
  const topos = topoDasFileiras(alturas);
  assert.equal(topos[0], 0);
  assert.ok(
    topos[1] >= alturas[0],
    `a 2a fileira comeca em ${topos[1]}, dentro da 1a que tem ${alturas[0]} de altura`,
  );
});

test("fileiras vazias e lista vazia nao quebram", () => {
  assert.deepEqual(topoDasFileiras([]), []);
  assert.deepEqual(topoDasFileiras([ALTURA_MINIMA_FILEIRA]), [0]);
});

console.log(`\n${passed} testes de layout OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-nexo-layout.ts`
Expected: FALHA no import — `Cannot find module '.../layout-canvas.ts'`.

- [ ] **Step 3: Escrever o módulo**

Criar `modules/nexo/lib/layout-canvas.ts`:

```ts
/**
 * Geometria do canvas: onde cada folha cai na grade do seu tomo e quanto cada
 * fileira ocupa em altura.
 *
 * As folhas viram GRADE, não esteira: uma fileira horizontal de 200 folhas
 * empurraria o nó do volume para fora da tela justamente no projeto grande, e o
 * volume é o resultado que o tomo produz. A grade cresce para BAIXO, que é a
 * direção em que o canvas já cresce (uma fileira por tomo).
 *
 * PURO: nenhum import: roda em Node pelado no `scripts/test-nexo-layout.ts`.
 */

/** Folhas por linha da grade. */
export const COLUNAS_DA_GRADE = 6;
/** Largura do nó da folha (120) + respiro. */
export const PASSO_X = 128;
/** Altura do nó da folha (56) + respiro. */
export const PASSO_Y = 64;
/** Altura de uma fileira sem folhas — o bastante para os nós de documento. */
export const ALTURA_MINIMA_FILEIRA = 330;
/** Respiro entre a grade e a fileira seguinte. */
const FOLGA_DA_FILEIRA = 40;

/** Posição da n-ésima folha dentro da grade do tomo (relativa à grade). */
export function posicaoNaGrade(
  indice: number,
  colunas: number = COLUNAS_DA_GRADE,
): { x: number; y: number } {
  return {
    x: (indice % colunas) * PASSO_X,
    y: Math.floor(indice / colunas) * PASSO_Y,
  };
}

/** Largura ocupada pela grade — para saber onde o nó seguinte começa. */
export function larguraDaGrade(
  quantidade: number,
  colunas: number = COLUNAS_DA_GRADE,
): number {
  return Math.min(quantidade, colunas) * PASSO_X;
}

/** Altura ocupada pela grade: linha começada é linha inteira. */
export function alturaDaGrade(
  quantidade: number,
  colunas: number = COLUNAS_DA_GRADE,
): number {
  return Math.ceil(quantidade / colunas) * PASSO_Y;
}

/** Altura da fileira do tomo: o que for maior entre os documentos e a grade. */
export function alturaDaFileira(quantidadeDeFolhas: number): number {
  return Math.max(ALTURA_MINIMA_FILEIRA, alturaDaGrade(quantidadeDeFolhas) + FOLGA_DA_FILEIRA);
}

/**
 * O `y` de cada fileira, ACUMULADO. Era `linha * 330` fixo — com um tomo de 200
 * folhas, a fileira de baixo era desenhada por cima da grade de cima.
 */
export function topoDasFileiras(alturas: readonly number[]): number[] {
  const topos: number[] = [];
  let cursor = 0;
  for (const altura of alturas) {
    topos.push(cursor);
    cursor += altura;
  }
  return topos;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-nexo-layout.ts`
Expected: 6 linhas `ok` e `6 testes de layout OK`.

- [ ] **Step 5: Registrar o script no `package.json`**

Na lista de scripts, logo abaixo de `"test:nexo:folhas"`, acrescentar:

```json
    "test:nexo:layout": "node scripts/test-nexo-layout.ts"
```

(atenção à vírgula da linha anterior)

- [ ] **Step 6: Rodar pelo npm**

Run: `npm run test:nexo:layout`
Expected: `6 testes de layout OK`.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/lib/layout-canvas.ts scripts/test-nexo-layout.ts package.json
git commit -m "Nexo: geometria da grade das folhas (modulo puro)

As folhas viram grade, nao esteira: 200 folhas numa fileira horizontal jogariam o
no do volume pra fora da tela. E o topo das fileiras passa a ser ACUMULADO -- com
`linha * 330` fixo, um tomo de 200 folhas era desenhado por cima do de baixo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: `ajustes` no `conversation-store`

Liga o estado. Depois desta task o `ajustes` existe, persiste e volta no restore — mas ainda não há quem escreva nele pela interface (é a Task 6).

**Files:**
- Modify: `modules/nexo/lib/nexo-db.ts` (tipo `StoredConversation`)
- Modify: `modules/nexo/state/conversation-store.tsx`
- Modify: `modules/nexo/components/NexoWorkspace.tsx` (o ponto único da projeção)

**Interfaces:**
- Consumes: `Ajuste`, `FolhaId`, `aplicarAjuste`, `folhas` de `modules/nexo/lib/folhas.ts`.
- Produces: `conv.ajustes: Record<FolhaId, Ajuste>` e `conv.ajustarFolha(id: FolhaId, patch: Ajuste): void` no `ConversationStoreValue`. A Task 6 usa `ajustarFolha`; a Task 5 depende de `conv.ajustes` já estar no memo da projeção.

- [ ] **Step 1: Acrescentar `ajustes` ao registro persistido**

Em `modules/nexo/lib/nexo-db.ts`, no topo dos imports de tipo:

```ts
import type { Ajuste, FolhaId } from "./folhas";
```

E dentro de `interface StoredConversation`, depois de `seloResults`:

```ts
  /**
   * O que o usuário mudou à mão nas folhas (título etc.). OPCIONAL: conversas
   * gravadas antes desta versão não têm o campo, e ausente = nenhum ajuste. Por
   * isso não há migração de `DB_VERSION` — o store é schemaless.
   */
  ajustes?: Record<FolhaId, Ajuste>;
```

- [ ] **Step 2: Declarar o estado e o escritor no contrato do store**

Em `modules/nexo/state/conversation-store.tsx`, no bloco de imports:

```ts
import { aplicarAjuste, type Ajuste, type FolhaId } from "../lib/folhas";
```

Em `interface ConversationStoreValue`, depois de `seloResults: SeloResult[];`:

```ts
  /** O que o usuário mudou à mão nas folhas. Vazio = a projeção é a identidade. */
  ajustes: Record<FolhaId, Ajuste>;
```

E depois de `setSeloResults: (r: SeloResult[]) => void;`:

```ts
  /** Acumula um ajuste numa folha. Campo `undefined` no patch DESFAZ aquele campo. */
  ajustarFolha: (id: FolhaId, patch: Ajuste) => void;
```

- [ ] **Step 3: Implementar o estado, o escritor, o snapshot e o persist**

No `ConversationStoreProvider`, depois da linha `const [seloResults, setSeloResultsState] = useState<SeloResult[]>([]);`:

```ts
  const [ajustes, setAjustes] = useState<Record<FolhaId, Ajuste>>({});
```

No `snapshotRef`, incluir `ajustes` no valor inicial e no effect de sincronização:

```ts
  const snapshotRef = useRef({
    conversationId,
    title,
    messages,
    seloResults,
    ajustes,
    results,
    createdAt: 0,
  });
  useEffect(() => {
    snapshotRef.current = {
      ...snapshotRef.current,
      conversationId,
      title,
      messages,
      seloResults,
      ajustes,
      results,
      createdAt: snapshotRef.current.createdAt || Date.now(),
    };
  });
```

Em `persistNow`, no objeto `rec`, depois de `seloResults: s.seloResults,`:

```ts
      ...(Object.keys(s.ajustes).length > 0 ? { ajustes: s.ajustes } : {}),
```

Logo depois de `setSeloResults`, o escritor:

```ts
  /*
   * ÚNICO escritor de ajustes. `aplicarAjuste` é puro e já testado: acumula sem
   * mutar, e apaga a entrada quando o ajuste fica vazio — desfazer não pode
   * deixar lixo ocupando o estado.
   */
  const ajustarFolha = useCallback(
    (id: FolhaId, patch: Ajuste) => {
      setAjustes((prev) => aplicarAjuste(prev, id, patch));
      schedulePersist();
    },
    [schedulePersist],
  );
```

Em `newConversation`, junto com `setSeloResultsState([])`:

```ts
    setAjustes({});
```

Em `selectConversation`, junto com `setSeloResultsState(rec.seloResults)`:

```ts
      // Conversa gravada antes deste campo existir não tem `ajustes`.
      setAjustes(rec.ajustes ?? {});
```

E no `useMemo` do `value`, acrescentar `ajustes` e `ajustarFolha` **tanto no objeto quanto no array de dependências**.

- [ ] **Step 4: Ligar no ponto único da projeção**

Em `modules/nexo/components/NexoWorkspace.tsx`, apagar a constante congelada e o seu comentário:

```ts
/** Sem ajustes ainda: quem os escreve são os sub-projetos 3 e 4. */
const SEM_AJUSTES: Readonly<Record<FolhaId, Ajuste>> = Object.freeze({});
```

Ajustar o import (o arquivo deixa de precisar de `Ajuste`):

```ts
import { folhas, type FolhaId } from "../lib/folhas";
```

E trocar o memo da projeção (o comentário longo acima dele permanece, menos o parágrafo sobre `SEM_AJUSTES`):

```ts
  const selos = useMemo(() => folhas(selosLidos, conv.ajustes), [selosLidos, conv.ajustes]);
```

O último parágrafo do comentário passa a ser:

```
   * `conv.ajustes` vem do `useState` do store, então é referência ESTÁVEL entre
   * renders. Um objeto literal aqui recriaria o memo a cada render e remontaria
   * todos os nós do canvas — que foi exatamente o bug do popover que fechava
   * sozinho.
```

- [ ] **Step 5: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros. **Manter o `type FolhaId` no import mesmo que ele fique sem uso aqui** — a Task 5 usa-o no mesmo arquivo, e tirar agora só cria trabalho de volta.

Run: `npm run test:nexo:folhas && npm run test:nexo:layout`
Expected: ambos verdes (nada aqui deveria tê-los tocado).

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/lib/nexo-db.ts modules/nexo/state/conversation-store.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: ajustes viram estado duravel da conversa

SEM_AJUSTES morre: a projecao passa a ler `conv.ajustes`, que persiste no
IndexedDB junto da conversa e volta no restore. Sem persistir, corrigir 40 titulos
e dar F5 perderia tudo -- pior do que nao ter o recurso.

Campo OPCIONAL no registro: conversa gravada antes disso nao tem `ajustes`, e
ausente ja significa nenhum ajuste. Por isso nao ha migracao de DB_VERSION.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: O nó da folha

O componente, isolado e ainda não usado — para que a Task 5, que é a troca de fiação, não tenha de inventar UI ao mesmo tempo.

**Files:**
- Create: `modules/nexo/components/FolhaNode.tsx`

**Interfaces:**
- Consumes: `AgentPopover` de `@/components/ui/agent-popover` (props: `open`, `onClose`, `label`, `panelClassName`, `anchor`, `children`); `FolhaId` de `../lib/folhas`; `Handle`, `Position`, `NodeProps`, `Node` de `@xyflow/react`.
- Produces: `export type FolhaNodeData` e `export function FolhaNode(props: NodeProps<Node<FolhaNodeData>>)`. A Task 5 registra `FolhaNode` em `nodeTypes` com a chave `"folha"` e monta objetos `FolhaNodeData`.

- [ ] **Step 1: Escrever o componente**

Criar `modules/nexo/components/FolhaNode.tsx`:

```tsx
"use client";

/**
 * Uma folha (prancha) como nó do canvas. BARATO de propósito: texto puro, nenhum
 * PDF renderizado — um projeto pode ter 200+ folhas, e miniatura em todas
 * trocaria este trabalho por um trabalho sobre performance.
 *
 * O nó mostra o que o selo diz. Quando algum campo veio de ajuste manual
 * (`editado`), ele se marca — sem a marca o usuário não distingue o que o sistema
 * leu do que ele mesmo mudou.
 */

import { useState } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

import { AgentPopover } from "@/components/ui/agent-popover";
import type { FolhaId } from "../lib/folhas";

export type FolhaNodeData = {
  id: FolhaId;
  /** Número da folha resolvido (`resolveSheetNumbers`), ou null quando não há. */
  numero: number | null;
  titulo: string;
  editado: boolean;
  /** Falso na conversa restaurada: os bytes da prancha não persistem. */
  podeAbrir: boolean;
  onAbrir: (id: FolhaId) => void;
  /** Título vazio DESFAZ o ajuste e devolve o que o selo dizia. */
  onCorrigir: (id: FolhaId, titulo: string) => void;
} & Record<string, unknown>;

export function FolhaNode({ data, selected }: NodeProps<Node<FolhaNodeData>>) {
  const [corrigindo, setCorrigindo] = useState(false);
  const [texto, setTexto] = useState(data.titulo);

  const borda = selected
    ? "border-[var(--ring)]"
    : data.editado
      ? "border-[var(--status-warning)]"
      : "border-border";

  const corpo = (
    <div className={`w-[120px] overflow-hidden rounded-sm border ${borda} bg-card px-2 py-1.5`}>
      <div className="flex items-center gap-1">
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {data.numero != null ? String(data.numero).padStart(2, "0") : "—"}
        </span>
        {data.editado && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-[var(--status-warning)]"
            title="corrigido à mão"
            aria-label="corrigido à mão"
          />
        )}
      </div>
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight" title={data.titulo}>
        {data.titulo || "—"}
      </p>
      {/* As ações só no nó SELECIONADO: com 200 folhas na tela, botões em todas
          seriam ruído maior que o conteúdo. */}
      {selected && (
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            disabled={!data.podeAbrir}
            onClick={() => data.onAbrir(data.id)}
            title={
              data.podeAbrir
                ? "Abrir a página original"
                : "Reanexe as pranchas para ver a página"
            }
            className="nodrag nopan rounded-sm text-[10px] text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Abrir
          </button>
          <button
            type="button"
            onClick={() => {
              setTexto(data.titulo);
              setCorrigindo(true);
            }}
            className="nodrag nopan rounded-sm text-[10px] text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            Corrigir
          </button>
        </div>
      )}
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );

  return (
    <AgentPopover
      open={corrigindo}
      onClose={() => setCorrigindo(false)}
      label="Corrigir o título"
      panelClassName="w-[260px]"
      anchor={corpo}
    >
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          data.onCorrigir(data.id, texto);
          setCorrigindo(false);
        }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={3}
          autoFocus
          className="nodrag nopan w-full rounded-sm border border-border bg-background p-1.5 text-[11px]"
        />
        <p className="text-[10px] text-muted-foreground">
          Vazio devolve o título que o selo dizia.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setCorrigindo(false)}
            className="nodrag nopan rounded-sm text-[11px] text-muted-foreground"
          >
            Cancelar
          </button>
          <button type="submit" className="nodrag nopan rounded-sm text-[11px] font-medium text-primary">
            Aplicar
          </button>
        </div>
      </form>
    </AgentPopover>
  );
}
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. Se `AgentPopover` reclamar de alguma prop, abrir `components/ui/agent-popover.tsx` e conferir a assinatura contra o uso em `NexoCanvas.tsx` (`ArtifactNode` usa o mesmo conjunto).

- [ ] **Step 3: Commit**

```bash
git add modules/nexo/components/FolhaNode.tsx
git commit -m "Nexo: o no de uma folha (texto puro, sem miniatura)

Barato de proposito: um projeto pode ter 200+ folhas, e renderizar a pagina em
todas trocaria o trabalho por um sobre performance. As acoes so aparecem no no
selecionado -- botao em 200 nos seria ruido maior que o conteudo.

Ainda nao usado: a fiacao entra no commit seguinte.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: O canvas passa a desenhar folhas

A troca de fiação, atômica: `PranchaInfo`/`pranchasCount`/`selos` saem, `Folha[]` entra, a pilha vira grade e a divisão passa por `gruposDasFolhas`. Canvas e workspace mudam no mesmo commit porque a troca de props quebra a compilação se separada.

**Files:**
- Modify: `modules/nexo/components/NexoCanvas.tsx`
- Modify: `modules/nexo/components/NexoWorkspace.tsx`

**Interfaces:**
- Consumes: `FolhaNode`, `FolhaNodeData` (Task 4); `posicaoNaGrade`, `larguraDaGrade`, `alturaDaFileira`, `topoDasFileiras` (Task 2); `gruposDasFolhas`, `Folha`, `FolhaId` de `../lib/folhas`; `buildBalancedQuantities` de `@/lib/ld/ld-rules`; `resolveSheetNumbers` de `@/server/nexo/parse-filename`.
- Produces: `NexoCanvas` com as props `folhas?: Folha[]`, `numeros?: Record<FolhaId, number | null>`, `arquivosDisponiveis?: ReadonlySet<string>`, `onAbrirFolha?: (id: FolhaId) => void`, `onCorrigirFolha?: (id: FolhaId, titulo: string) => void`. A Task 6 liga `onCorrigirFolha` ao store.

- [ ] **Step 1: Trocar os imports do canvas**

Em `modules/nexo/components/NexoCanvas.tsx`:

```ts
import { Waypoints, Maximize2, Pencil, Trash2, SlidersHorizontal } from "lucide-react";
```

(`Layers` era só da pilha, que morre nesta task)

Trocar `import { faixasDosTomos } from "@/lib/ld/ld-rules";` por:

```ts
import { buildBalancedQuantities } from "@/lib/ld/ld-rules";
import { gruposDasFolhas, type Folha, type FolhaId } from "../lib/folhas";
import {
  alturaDaFileira,
  larguraDaGrade,
  posicaoNaGrade,
  topoDasFileiras,
} from "../lib/layout-canvas";
import { FolhaNode, type FolhaNodeData } from "./FolhaNode";
```

- [ ] **Step 2: Apagar `PranchaInfo`, `StackNode` e `StackNodeData`**

Remover do arquivo:
- a `interface PranchaInfo` e o seu comentário;
- `type StackNodeData = ...`;
- a função `StackNode` inteira, com o comentário acima dela.

Em `ArtifactNodeData`, trocar o tipo do campo `selos`:

```ts
  selos?: Folha[];
```

Registrar o nó novo:

```ts
const nodeTypes = { artifact: ArtifactNode, stack: StackNode, rotulo: RotuloNode, folha: FolhaNode };
```

vira

```ts
const nodeTypes = { artifact: ArtifactNode, rotulo: RotuloNode, folha: FolhaNode };
```

- [ ] **Step 3: Trocar a assinatura de `CanvasInterno` e de `NexoCanvas`**

```tsx
function CanvasInterno({
  folhas = [],
  numeros = {},
  arquivosDisponiveis,
  onAbrirFolha,
  onCorrigirFolha,
}: {
  /** A projeção (selo + ajuste). É a MESMA lista que a montagem lê. */
  folhas?: Folha[];
  /** Número da folha resolvido por `resolveSheetNumbers`, por id. */
  numeros?: Record<FolhaId, number | null>;
  /** Nomes de arquivo com bytes em memória — sem eles não dá para abrir a página. */
  arquivosDisponiveis?: ReadonlySet<string>;
  onAbrirFolha?: (id: FolhaId) => void;
  onCorrigirFolha?: (id: FolhaId, titulo: string) => void;
}) {
```

E no fim do arquivo:

```tsx
export function NexoCanvas(props: {
  folhas?: Folha[];
  numeros?: Record<FolhaId, number | null>;
  arquivosDisponiveis?: ReadonlySet<string>;
  onAbrirFolha?: (id: FolhaId) => void;
  onCorrigirFolha?: (id: FolhaId, titulo: string) => void;
}) {
  return (
    <ReactFlowProvider>
      <CanvasInterno {...props} />
    </ReactFlowProvider>
  );
}
```

- [ ] **Step 4: Reescrever o `useMemo` que monta os nós**

Substituir o corpo inteiro do `useMemo` (de `const { nodes, edges, fileiras } = useMemo(() => {` até o `}, [...])`) por:

```tsx
  const { nodes, edges, fileiras } = useMemo(() => {
    type Item = { id: string; rank: number; type: "artifact"; data: unknown };

    /*
     * UMA FILEIRA POR TOMO: capa → separatriz → LD → [grade de folhas] → volume.
     * O grupo "sem tomo" fica por último: são artefatos gerados ANTES da divisão
     * e que sobraram. Escondê-los faria o canvas mentir sobre o que existe.
     */
    const grupos = agruparPorTomo(artifacts);
    const fileiras: FileiraNavegavel[] = [];
    const tomosReais = grupos.filter((g) => g.tomo > 0).length;

    /*
     * A divisão sai de `gruposDasFolhas`, não mais de `faixasDosTomos`: ela
     * respeita o `grupo` manual e só cai na divisão por quantidade quando não há
     * nenhum. Sem grupo manual as duas dão o mesmo resultado — há teste para essa
     * igualdade. Sem esta troca, arrastar uma folha (sub-projeto 4) faria ela
     * voltar para o lugar, porque a tela continuaria dividindo por contagem.
     */
    const divisao =
      tomosReais > 1 ? gruposDasFolhas(folhas, tomosReais, buildBalancedQuantities) : [];
    const porId = new Map(folhas.map((f) => [f.id, f]));

    // As folhas de cada fileira, decididas ANTES de posicionar: a altura da
    // fileira depende de quantas folhas ela tem.
    const folhasPorFileira = grupos.map((grupo) => {
      // Com vários tomos, a folha pertence a UM tomo. A fileira "fora da divisão"
      // não recebe folha nenhuma: id repetido em duas fileiras quebra o React Flow,
      // e uma folha em dois volumes seria mentira sobre a montagem.
      if (tomosReais > 1) {
        return grupo.tomo > 0
          ? (divisao[grupo.tomo - 1] ?? []).map((id) => porId.get(id)!).filter(Boolean)
          : [];
      }
      return folhas;
    });

    const topos = topoDasFileiras(folhasPorFileira.map((fs) => alturaDaFileira(fs.length)));

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    grupos.forEach((grupo, linha) => {
      const y = topos[linha];
      const daFileira = folhasPorFileira[linha];

      const items: Item[] = grupo.itens
        .map((a) => ({
          id: a.id,
          rank: CANONICAL_RANK[a.kind] ?? 9,
          type: "artifact" as const,
          data: {
            ...a,
            editavel: EDITAVEIS.includes(a.kind),
            params: results.find((r) => r.artifactId === a.id)?.payload as
              | Record<string, unknown>
              | undefined,
            templates,
            tomosExistentes: artifacts.map((x) => tomoDoArtefato(x.id)),
            selos: folhas,
          } as unknown,
        }))
        .sort((a, b) => a.rank - b.rank);

      // A grade das folhas entra na posição canônica (depois da LD, antes do
      // volume): os documentos antes dela, os de depois deslocados pela largura.
      const antes = items.filter((it) => it.rank < PRANCHAS_RANK);
      const depois = items.filter((it) => it.rank > PRANCHAS_RANK);

      let cursorX = 0;
      const idsDaFileira: string[] = [];
      let anterior: string | null = null;

      const empurrar = (it: Item) => {
        nodes.push({
          id: it.id,
          type: it.type,
          position: { x: cursorX, y },
          data: it.data as Record<string, unknown>,
          draggable: false,
          selected: it.id === selecionadoId,
        });
        if (anterior) {
          edges.push({
            id: `${anterior}->${it.id}`,
            source: anterior,
            target: it.id,
            style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
        anterior = it.id;
        idsDaFileira.push(it.id);
        cursorX += 260;
      };

      antes.forEach(empurrar);

      daFileira.forEach((f, i) => {
        const p = posicaoNaGrade(i);
        const id = `folha:${f.id}`;
        nodes.push({
          id,
          type: "folha",
          position: { x: cursorX + p.x, y: y + p.y },
          data: {
            id: f.id,
            numero: numeros[f.id] ?? null,
            titulo: f.conteudo ?? "",
            editado: f.editado,
            podeAbrir: arquivosDisponiveis?.has(f.fileName) ?? false,
            onAbrir: abrirFolha,
            onCorrigir: corrigirFolha,
          } satisfies FolhaNodeData,
          draggable: false,
          selected: id === selecionadoId,
        });
        idsDaFileira.push(id);
        // Só a PRIMEIRA folha recebe a seta: uma seta por folha viraria 200
        // linhas cruzando a grade, e a sequência já é dada pela leitura da grade.
        if (i === 0 && anterior) {
          edges.push({
            id: `${anterior}->${id}`,
            source: anterior,
            target: id,
            style: { stroke: "var(--ring)", strokeWidth: 1.5, opacity: 0.5 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "var(--ring)" },
          });
        }
        if (i === daFileira.length - 1) anterior = id;
      });

      if (daFileira.length > 0) cursorX += larguraDaGrade(daFileira.length) + 60;

      depois.forEach(empurrar);

      fileiras.push({ tomo: grupo.tomo, ids: idsDaFileira });

      // Rótulo da fileira. Só aparece quando há divisão — com um volume só ele
      // seria ruído. A CONTAGEM vem para cá: era o que a pilha mostrava.
      if (grupos.length > 1) {
        nodes.push({
          id: `rotulo:${grupo.tomo}`,
          type: "rotulo",
          position: { x: -150, y: y + 130 },
          data: { tomo: grupo.tomo, folhas: daFileira.length },
          draggable: false,
          selectable: false,
        });
      }
    });

    return { nodes, edges, fileiras };
  }, [
    artifacts,
    folhas,
    numeros,
    arquivosDisponiveis,
    abrirFolha,
    corrigirFolha,
    results,
    templates,
    selecionadoId,
  ]);
```

Logo **acima** desse `useMemo`, os dois callbacks estáveis (sem eles, cada render recria o `data` de 200 nós):

```tsx
  /*
   * Estáveis de propósito: eles entram no `data` de cada nó de folha, e uma
   * função nova a cada render recriaria todos os nós — o mesmo defeito que fazia
   * o popover fechar no instante em que abria.
   */
  const abrirFolha = useCallback((id: FolhaId) => onAbrirFolha?.(id), [onAbrirFolha]);
  const corrigirFolha = useCallback(
    (id: FolhaId, titulo: string) => onCorrigirFolha?.(id, titulo),
    [onCorrigirFolha],
  );
```

E acrescentar `useCallback` ao import de `react` no topo do arquivo.

- [ ] **Step 5: Mostrar a contagem no rótulo do tomo**

Substituir a assinatura e o corpo de `RotuloNode`:

```tsx
function RotuloNode({
  data,
}: NodeProps<Node<{ tomo: number; folhas: number } & Record<string, unknown>>>) {
  const ehResto = data.tomo === 0;
  return (
    <div className="w-[130px] text-right">
      <p
        className={
          ehResto
            ? "font-mono text-[11px] uppercase tracking-[0.07em] text-[var(--status-warning)]"
            : "font-mono text-[11px] font-medium uppercase tracking-[0.07em] text-foreground"
        }
      >
        {ehResto ? "Fora da divisão" : `Tomo ${String(data.tomo).padStart(2, "0")}`}
      </p>
      {/* A contagem era o que a pilha dava de relance; ela morreu, isto fica. */}
      {data.folhas > 0 && (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground tabular-nums">
          {data.folhas} folha{data.folhas === 1 ? "" : "s"}
        </p>
      )}
      {ehResto && (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          gerado antes de dividir
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Atualizar o cabeçalho do arquivo**

O comentário do topo ainda promete a pilha. Trocar o terceiro parágrafo por:

```
 * Linha d'água (Apêndice H): o frame de DADO é MATTE. As pranchas do usuário
 * viram UM NÓ POR FOLHA (texto puro, sem miniatura) — a pilha única de antes não
 * era manipulável, e o sub-projeto 4 precisa endereçar folha a folha. Só
 * capa/separatriz/LD ganham miniatura real.
```

- [ ] **Step 7: No workspace, montar os números, os arquivos disponíveis e o abrir**

Em `modules/nexo/components/NexoWorkspace.tsx`, **apagar** o `useMemo` de `pranchaInfos` inteiro (com o comentário acima dele) e, no lugar, colocar:

```tsx
  // Número da folha (resolvido entre arquivos) por id — derivação dos selos, não
  // ajuste: por isso mora aqui e não no módulo puro da projeção.
  const numerosDasFolhas = useMemo(() => {
    const resolvidos = resolveSheetNumbers(
      selos.map((f) => ({
        fileName: f.fileName,
        pageNumber: f.pageNumber,
        arquivo: f.arquivo,
        folha: f.folha,
      })),
    );
    const mapa: Record<FolhaId, number | null> = {};
    selos.forEach((f, i) => {
      mapa[f.id] = resolvidos[i] ?? null;
    });
    return mapa;
  }, [selos]);

  // Quais pranchas ainda têm bytes em memória. Numa conversa restaurada isto é
  // vazio: os PDFs de ENTRADA não persistem, só os gerados.
  const arquivosDisponiveis = useMemo(
    () => new Set(pranchaFiles.map((f) => f.name)),
    [pranchaFiles],
  );

  /*
   * Object URL por ARQUIVO, retido num cache. Revogar logo depois do `open`
   * mataria a aba antes de ela carregar o PDF; o cache é limpo no mesmo ponto em
   * que `pranchaFiles` é zerado (nova conversa / trocar de conversa).
   */
  const urlsDasPranchas = useRef(new Map<string, string>());
  const abrirFolha = useCallback(
    (id: FolhaId) => {
      const folha = selos.find((f) => f.id === id);
      if (!folha) return;
      const file = pranchaFiles.find((f) => f.name === folha.fileName);
      if (!file) return;
      let url = urlsDasPranchas.current.get(file.name);
      if (!url) {
        url = URL.createObjectURL(file);
        urlsDasPranchas.current.set(file.name, url);
      }
      window.open(`${url}#page=${folha.pageNumber ?? 1}`, "_blank", "noopener,noreferrer");
    },
    [selos, pranchaFiles],
  );

  // Limpa as pranchas e os object URLs que elas geraram, sem vazar.
  const limparPranchas = useCallback(() => {
    urlsDasPranchas.current.forEach((url) => URL.revokeObjectURL(url));
    urlsDasPranchas.current.clear();
    setPranchaFiles([]);
  }, []);
```

Trocar as duas chamadas `setPranchaFiles([])` existentes (uma na nova conversa, por volta da linha 450; outra em `selectConv`, por volta da linha 473) por `limparPranchas()`.

- [ ] **Step 8: Trocar as props do canvas**

```tsx
        stage={
          <NexoCanvas
            folhas={selos}
            numeros={numerosDasFolhas}
            arquivosDisponiveis={arquivosDisponiveis}
            onAbrirFolha={abrirFolha}
          />
        }
```

`onCorrigirFolha` entra na Task 6 — sem ele, o botão "Corrigir" abre o popover e o Aplicar não faz nada. É esperado neste commit.

- [ ] **Step 9: Verificar tipos e testes**

Run: `npx tsc --noEmit`
Expected: sem erros. Um erro sobre `PranchaInfo` significa que sobrou algum uso — procurar com `rg "PranchaInfo" modules/` e remover.

Run: `npm run test:nexo:folhas && npm run test:nexo:layout`
Expected: ambos verdes.

Run: `npm run build`
Expected: build completo, sem erro.

- [ ] **Step 10: Ver no navegador**

Run: `npm run dev` e, noutro terminal, `node scripts/shot-nexo.mjs`

Expected, olhando o print gerado:
- uma caixinha por folha, em grade, entre a LD e o volume;
- com mais de um tomo, cada folha aparece em **uma** fileira só e o rótulo diz "Tomo 01 · N folhas";
- as fileiras não se sobrepõem;
- nenhum aviso de id duplicado no console do navegador.

- [ ] **Step 11: Commit**

```bash
git add modules/nexo/components/NexoCanvas.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: cada folha vira um no do canvas

A pilha (StackNode) e o PranchaInfo morrem: eram uma segunda projecao dos mesmos
selos, e uma lista DENTRO de um no nao e manipulavel. O canvas passa a receber
`Folha[]` -- a mesma lista que a montagem le -- mais o mapa de numeros resolvidos.

A divisao troca pra gruposDasFolhas, que respeita grupo manual. Sem grupo as duas
sao identicas (ha teste), entao nada muda na tela agora -- e no sub-projeto 4 a
folha arrastada nao volta pro lugar.

Duas mudancas de comportamento assumidas: a ordem na tela vira a da MONTAGEM (nao
mais por numero de folha), e folha sem numero e sem descricao deixa de ser
escondida -- ela entra no volume, esconde-la e o canvas mentir. Com varios tomos,
a fileira 'fora da divisao' nao recebe folha: id repetido quebraria o React Flow.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: Corrigir o título passa a valer na LD

Liga a última ponta: o popover do nó escreve em `ajustes`, a projeção aplica, e a LD gerada depois sai com o texto corrigido. É esta task que faz a edição valer — sem ela, editar seria enfeite.

**Files:**
- Modify: `modules/nexo/components/NexoWorkspace.tsx`

**Interfaces:**
- Consumes: `conv.ajustarFolha` (Task 3); a prop `onCorrigirFolha` do `NexoCanvas` (Task 5).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Ligar o escritor**

Junto dos outros callbacks do workspace (logo abaixo de `abrirFolha`):

```tsx
  /*
   * Texto vazio DESFAZ o ajuste: `aplicarAjuste` apaga o campo quando o patch traz
   * `undefined`, e a folha volta a mostrar o que o selo dizia. A projeção também
   * trata string em branco como ausente — as duas defesas existem porque um título
   * vazio na LD é pior do que um título errado: some do documento sem avisar.
   */
  const corrigirFolha = useCallback(
    (id: FolhaId, titulo: string) => {
      conv.ajustarFolha(id, { titulo: titulo.trim() ? titulo : undefined });
    },
    [conv],
  );
```

- [ ] **Step 2: Passar a prop**

```tsx
          <NexoCanvas
            folhas={selos}
            numeros={numerosDasFolhas}
            arquivosDisponiveis={arquivosDisponiveis}
            onAbrirFolha={abrirFolha}
            onCorrigirFolha={corrigirFolha}
          />
```

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit && npm run build`
Expected: ambos sem erro.

- [ ] **Step 4: O teste que importa — a correção tem de sair no PDF**

Run: `npm run dev`, abrir `/nexo` e executar à mão:

1. anexar 3+ pranchas e esperar a leitura dos selos;
2. clicar numa folha no canvas → **Corrigir** → trocar o título por `TESTE DE AJUSTE` → Aplicar;
3. conferir na hora: o nó mostra o texto novo, com borda âmbar e o ponto de "corrigido à mão";
4. **gerar a LD pelo chat** e abrir o PDF: a linha daquela folha tem de sair como `TESTE DE AJUSTE`;
5. clicar **Corrigir** de novo, apagar tudo, Aplicar → o nó volta ao título do selo e a marca âmbar some;
6. recarregar a página (F5), abrir a mesma conversa pelo histórico → a correção feita no passo 2 (refeita, se desfeita no 5) continua lá, e o botão **Abrir** aparece desabilitado com o aviso de reanexar.

Expected: os seis passos como descritos. **O passo 4 é o único que prova o sub-projeto** — ver o nó mudar na tela não prova nada; o que importa é a montagem ler o ajuste.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: corrigir o titulo da folha vale na LD gerada depois

O popover do no escreve em `ajustes`, a projecao aplica por cima do selo e a
montagem le a projecao. Sem esta ponta, editar no canvas seria enfeite.

Texto vazio desfaz o ajuste. Duas defesas contra titulo em branco (o patch com
undefined e o `texto()` da projecao) porque titulo vazio na LD some do documento
sem avisar -- pior que titulo errado.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 7: Medir com 200 folhas

O spec proíbe ligar `onlyRenderVisibleElements` preventivamente — ele interage mal com `fitView`. Esta task mede e só então decide.

**Files:**
- Modify: `modules/nexo/components/NexoCanvas.tsx` (**apenas se** a medição mostrar engasgo)

**Interfaces:**
- Consumes: o canvas da Task 5.
- Produces: nada.

- [ ] **Step 1: Medir**

Com `npm run dev` rodando e uma conversa com **200+ folhas** (anexar um lote grande de pranchas, ou repetir o mesmo PDF de muitas páginas), medir no canvas:

- o `fitView` inicial completa sem travar a aba?
- pan e zoom seguram ~60fps? (DevTools → Performance, gravar 5s de pan)
- clicar numa folha seleciona sem atraso perceptível?

- [ ] **Step 2: Se estiver fluido, registrar e parar**

Escrever a medição no fim do spec, seção "Riscos", e não mexer em código:

```markdown
**Medido em <data do dia>:** <N> folhas, fitView em <X>ms, pan estável.
`onlyRenderVisibleElements` NÃO foi ligado — o nó de texto puro aguentou.
```

- [ ] **Step 3: Só se engasgar — ligar o render por viewport**

Em `<ReactFlow ...>`, acrescentar:

```tsx
        onlyRenderVisibleElements
```

Depois **re-testar o `fitView`**: com essa opção, nós fora da viewport não são medidos, e o enquadramento inicial pode sair errado. Se sair, `ReenquadrarAoCrescer` precisa de um `requestAnimationFrame` a mais antes do `fitView`.

- [ ] **Step 4: Commit (em qualquer um dos dois caminhos)**

```bash
# caminho A — so a medicao no spec
git add docs/superpowers/specs/2026-07-28-nexo-pagina-como-no-design.md
git commit -m "Nexo: medicao do canvas com 200 folhas (sem mudanca de codigo)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"

# caminho B — precisou do render por viewport
git add modules/nexo/components/NexoCanvas.tsx docs/superpowers/specs/2026-07-28-nexo-pagina-como-no-design.md
git commit -m "Nexo: render por viewport no canvas (medido, nao preventivo)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

```bash
git push origin main
```

---

## Sequência e dependências

| Task | Depende de | Entrega verificável |
|---|---|---|
| 1 Testes puros | — | `npm run test:nexo:folhas` verde, com a equivalência travada |
| 2 Geometria | — | `npm run test:nexo:layout` verde |
| 3 `ajustes` no store | — | `tsc` limpo; ajuste persiste e restaura |
| 4 `FolhaNode` | — | `tsc` limpo |
| 5 Canvas desenha folhas | 2, 3, 4 | Print do canvas com um nó por folha |
| 6 Correção vale na LD | 3, 5 | LD gerada sai com o título corrigido |
| 7 Medição | 5 | Medição registrada no spec |

Tasks 1, 2, 3 e 4 são independentes entre si e podem ir em qualquer ordem.
