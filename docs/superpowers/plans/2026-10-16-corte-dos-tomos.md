# Corte dos tomos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O engenheiro escolhe onde cada tomo termina arrastando uma marca numa régua linear no topo do canvas, ou pelo item "O tomo começa aqui" na folha.

**Architecture:** Um módulo puro (`modules/nexo/lib/corte-dos-tomos.ts`) converte a divisão que o canvas já calcula (`folhasPorTomo`) em uma sequência linear + posições de corte, e de volta em `grupo` por folha. A régua (`ReguaDosTomos.tsx`) desenha a sequência e os cortes e, ao soltar, chama o `onMoverFolhas` que já existe com TODAS as folhas — congelando a divisão como o arrasto de prancha já faz. "Voltar ao automático" desfaz.

**Tech Stack:** React (client), React Flow (canvas existente), testes em node cru.

**Spec:** `docs/superpowers/specs/2026-10-16-corte-dos-tomos-design.md`

## Global Constraints

- A ordem das pranchas não muda: só o corte.
- Nenhum tomo vazio; uma marca não atravessa a vizinha; encostar junta.
- Mexer no corte congela a divisão (grava `grupo` em todas as folhas); "Voltar ao automático" desfaz.
- Módulo puro sem `@/` (roda em `node scripts/test-*.ts`).
- Acento teal só no interativo (DESIGN.md); âmbar = acima do teto de 20 MB.
- Commits na main, `git add` por caminho, pt-BR, `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## File Structure

| Arquivo | Papel |
|---|---|
| `modules/nexo/lib/corte-dos-tomos.ts` | puro: faixas ↔ sequência+cortes, mover/criar/remover corte, patches, peso |
| `scripts/test-nexo-corte-dos-tomos.ts` | testes |
| `modules/nexo/components/ReguaDosTomos.tsx` | a régua (arrasto, clique no vão, teclado) |
| `modules/nexo/components/NexoCanvas.tsx` (mod.) | monta a régua; passa o atalho à folha |
| `modules/nexo/components/FolhaNode.tsx` (mod.) | ação "Tomo começa aqui" |
| `components/telas/nexo/*.css` (mod.) | estilo da régua |

---

### Task 1: Núcleo puro do corte

**Files:**
- Create: `modules/nexo/lib/corte-dos-tomos.ts`
- Create: `scripts/test-nexo-corte-dos-tomos.ts`
- Modify: `package.json` (`"test:nexo:corte-dos-tomos": "node scripts/test-nexo-corte-dos-tomos.ts"`)

**Interfaces — Produces:**

```ts
export interface Cortes { sequencia: string[]; cortes: number[] }
export function cortesDasFaixas(faixas: readonly (readonly string[])[]): Cortes;
export function faixasDosCortes(sequencia: readonly string[], cortes: readonly number[]): string[][];
export function moverCorte(cortes: readonly number[], i: number, pos: number, total: number): number[];
export function criarCorte(cortes: readonly number[], pos: number, total: number): number[];
export function removerCorte(cortes: readonly number[], i: number): number[];
export function patchesDosCortes(sequencia: readonly string[], cortes: readonly number[]): { id: string; patch: { grupo: number } }[];
export function pesoDasFaixas(faixas: readonly (readonly string[])[], bytesDe: (id: string) => number | null): (number | null)[];
```

Regras: `cortes` é crescente, cada um em `1..total-1` (posição na sequência onde um tomo NOVO começa). `moverCorte` limita ao intervalo `[anterior, próximo]`; cair exatamente no anterior/próximo (ou em 0/total nas bordas) REMOVE o corte (junta os tomos). `criarCorte` ignora posição já cortada ou fora de `1..total-1`. `pesoDasFaixas` devolve `null` para a faixa com alguma folha de peso desconhecido.

- [ ] **Step 1: testes que falham** — `scripts/test-nexo-corte-dos-tomos.ts`:

```ts
/**
 * O CORTE DOS TOMOS (16/10/2026): a régua converte a divisão em cortes e de
 * volta. O caso que trouxe isto: 5 pranchas de uma disciplina e 20 de outra,
 * que o automático divide parelho e o engenheiro quer 15 + 10.
 *
 *   node scripts/test-nexo-corte-dos-tomos.ts
 */
import assert from "node:assert/strict";

import {
  criarCorte, cortesDasFaixas, faixasDosCortes, moverCorte, patchesDosCortes, pesoDasFaixas, removerCorte,
} from "../modules/nexo/lib/corte-dos-tomos.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok  ${name}`); }
  catch (err) { console.error(`FALHOU  ${name}`); console.error(err instanceof Error ? err.message : err); process.exitCode = 1; }
}

const ids = (pref: string, n: number) => Array.from({ length: n }, (_, i) => `${pref}${i + 1}`);
const fnd = ids("fnd", 5);
const est = ids("est", 20);

test("ida e volta: faixas → cortes → faixas", () => {
  const faixas = [[...fnd, ...est.slice(0, 7)], est.slice(7, 14), est.slice(14)];
  const { sequencia, cortes } = cortesDasFaixas(faixas);
  assert.deepEqual(cortes, [12, 19]);
  assert.deepEqual(faixasDosCortes(sequencia, cortes), faixas);
});

test("o caso do Matheus: 5 + 20 cortado em 15 dá [15, 10]", () => {
  const { sequencia } = cortesDasFaixas([[...fnd, ...est]]);
  const cortes = criarCorte([], 15, sequencia.length);
  assert.deepEqual(faixasDosCortes(sequencia, cortes).map((f) => f.length), [15, 10]);
});

test("mover não atravessa a vizinha", () => {
  assert.deepEqual(moverCorte([10, 20], 0, 25, 30), [20]); // encostou: juntou
  assert.deepEqual(moverCorte([10, 20], 0, 15, 30), [15, 20]);
  assert.deepEqual(moverCorte([10, 20], 1, 5, 30), [10]); // passou da vizinha: junta, não cruza
});

test("encostar na borda junta com o tomo de fora", () => {
  assert.deepEqual(moverCorte([10], 0, 0, 30), []);
  assert.deepEqual(moverCorte([10], 0, 30, 30), []);
});

test("criar no vão já cortado ou fora da faixa não faz nada", () => {
  assert.deepEqual(criarCorte([10], 10, 30), [10]);
  assert.deepEqual(criarCorte([10], 0, 30), [10]);
  assert.deepEqual(criarCorte([10], 30, 30), [10]);
  assert.deepEqual(criarCorte([10], 4, 30), [4, 10]);
});

test("remover corte junta os dois tomos", () => {
  assert.deepEqual(removerCorte([4, 10], 0), [10]);
});

test("patches: toda folha ganha o tomo (a divisão congela)", () => {
  const p = patchesDosCortes(["a", "b", "c", "d"], [1, 3]);
  assert.deepEqual(p, [
    { id: "a", patch: { grupo: 1 } },
    { id: "b", patch: { grupo: 2 } },
    { id: "c", patch: { grupo: 2 } },
    { id: "d", patch: { grupo: 3 } },
  ]);
});

test("nenhum tomo vazio sai dos cortes", () => {
  const faixas = faixasDosCortes(["a", "b", "c"], [1, 2]);
  assert.ok(faixas.every((f) => f.length > 0));
});

test("peso: soma por faixa, null quando falta o tamanho de alguma folha", () => {
  const bytes: Record<string, number> = { a: 10, b: 20, c: 5 };
  assert.deepEqual(pesoDasFaixas([["a", "b"], ["c", "x"]], (id) => bytes[id] ?? null), [30, null]);
});

console.log(`\n${passed} teste(s) ok.`);
```

- [ ] **Step 2:** `node scripts/test-nexo-corte-dos-tomos.ts` → falha (módulo não existe).

- [ ] **Step 3: implementação** — `modules/nexo/lib/corte-dos-tomos.ts`:

```ts
/**
 * O CORTE DOS TOMOS (16/10/2026): a divisão em tomos vista como UMA sequência
 * de folhas com marcas de corte. É o que a régua desenha e arrasta.
 * Desenho: docs/superpowers/specs/2026-10-16-corte-dos-tomos-design.md
 *
 * `cortes[i]` é a posição na sequência onde um tomo NOVO começa: sempre
 * crescente, sempre em 1..total-1 — por construção, nenhum tomo fica vazio.
 *
 * PURO: nenhum import.
 */
export interface Cortes {
  sequencia: string[];
  cortes: number[];
}

export function cortesDasFaixas(faixas: readonly (readonly string[])[]): Cortes {
  const cheias = faixas.filter((f) => f.length > 0);
  const sequencia = cheias.flat();
  const cortes: number[] = [];
  let acumulado = 0;
  cheias.forEach((f, i) => {
    if (i > 0) cortes.push(acumulado);
    acumulado += f.length;
  });
  return { sequencia, cortes };
}

export function faixasDosCortes(sequencia: readonly string[], cortes: readonly number[]): string[][] {
  const bordas = [0, ...cortes, sequencia.length];
  const faixas: string[][] = [];
  for (let i = 0; i < bordas.length - 1; i++) {
    const faixa = sequencia.slice(bordas[i], bordas[i + 1]);
    if (faixa.length > 0) faixas.push(faixa);
  }
  return faixas;
}

/**
 * Arrasta o corte `i` para `pos`. Não atravessa a vizinha: passar dela (ou
 * encostar nela, ou na borda) JUNTA os dois tomos — o corte some.
 */
export function moverCorte(cortes: readonly number[], i: number, pos: number, total: number): number[] {
  const anterior = i > 0 ? cortes[i - 1] : 0;
  const proximo = i < cortes.length - 1 ? cortes[i + 1] : total;
  const resto = cortes.filter((_, j) => j !== i);
  if (pos <= anterior || pos >= proximo) return resto;
  return [...resto, Math.round(pos)].sort((a, b) => a - b);
}

export function criarCorte(cortes: readonly number[], pos: number, total: number): number[] {
  const p = Math.round(pos);
  if (p <= 0 || p >= total || cortes.includes(p)) return [...cortes];
  return [...cortes, p].sort((a, b) => a - b);
}

export function removerCorte(cortes: readonly number[], i: number): number[] {
  return cortes.filter((_, j) => j !== i);
}

/** O tomo de CADA folha — gravar todas é o que congela a divisão. */
export function patchesDosCortes(
  sequencia: readonly string[],
  cortes: readonly number[],
): { id: string; patch: { grupo: number } }[] {
  return faixasDosCortes(sequencia, cortes).flatMap((faixa, i) =>
    faixa.map((id) => ({ id, patch: { grupo: i + 1 } })),
  );
}

/** Bytes por faixa; `null` quando alguma folha da faixa tem peso desconhecido. */
export function pesoDasFaixas(
  faixas: readonly (readonly string[])[],
  bytesDe: (id: string) => number | null,
): (number | null)[] {
  return faixas.map((faixa) => {
    let soma = 0;
    for (const id of faixa) {
      const b = bytesDe(id);
      if (b === null) return null;
      soma += b;
    }
    return soma;
  });
}
```

- [ ] **Step 4:** testes verdes. **Step 5: commit** — `"Corte dos tomos: núcleo puro (sequência e cortes)"`.

---

### Task 2: A régua e o atalho na folha

**Files:**
- Create: `modules/nexo/components/ReguaDosTomos.tsx`
- Modify: `modules/nexo/components/NexoCanvas.tsx` (monta a régua acima do `<ReactFlow>`, ao lado da `NavegacaoDoCanvas`; atalho no `data` das folhas, perto de `onRemover: removerFolha` ~l.884)
- Modify: `modules/nexo/components/FolhaNode.tsx` (ação nova na fileira de `AcaoDoNo`, ~l.298)
- Modify: CSS da régua em `components/telas/nexo/conversa.css` (ou o CSS do canvas, se houver um próprio — seguir onde `NavegacaoDoCanvas` é estilizada)

**Interfaces:**
- Consumes: Task 1; `folhasPorTomo: Map<number, Folha[]>` e `onMoverFolhas` de `NexoCanvas`; `codigoDe(f)` e `rotuloDoCodigo` para a cor/rótulo da disciplina; `TETO_DO_TOMO_BYTES` (`modules/nexo/lib/entrega-do-volume.ts`).
- Produces: `<ReguaDosTomos faixas={Folha[][]} onCortar={(patches) => void} bytesDe={(id) => number | null} codigoDe={(f) => string} />`.

Comportamento (do spec):
- célula por folha, na cor da disciplina (o fio de cor que o `FolhaNode` já usa por disciplina); `title` = número + título;
- marca entre tomos: `<button role="slider" aria-valuemin aria-valuemax aria-valuenow aria-label="Fim do tomo N">`; arrasto por `pointerdown/pointermove/pointerup` com `setPointerCapture`; a posição vira o vão mais próximo (`Math.round((x - esquerda) / larguraDaCelula)`);
- durante o arrasto, rótulo ao vivo acima: "Tomo 1 · 15 folhas · 12,3 MB | Tomo 2 · 10 folhas"; faixa acima de `TETO_DO_TOMO_BYTES` em âmbar; ao soltar: `onCortar(patchesDosCortes(...))`;
- clique num vão sem marca → `criarCorte` → `onCortar`;
- teclado: ← → movem 1 vão (aplica ao soltar a tecla? não: aplica a cada tecla, é uma decisão discreta), Delete/Backspace remove o corte;
- mais de ~120 folhas: célula com largura mínima de 4px e `overflow-x: auto`.
- Some quando há uma folha só (nada a cortar). Com um tomo só, mostra a sequência sem marcas — clicar num vão cria o primeiro corte.

Atalho na folha: `FolhaNode` ganha `onComecarTomo?: (id: FolhaId) => void` e `comecaTomo?: boolean` (é a 1ª folha de um tomo, ou a 1ª da sequência). `AcaoDoNo` com ícone `Scissors`, rótulo "Tomo aqui", ajuda "Começa um tomo novo nesta prancha: ela e as seguintes vão para o próximo tomo.", `desabilitado={comecaTomo}`. No canvas: `onComecarTomo = (id) => { const { sequencia, cortes } = cortesDasFaixas(faixas); onMoverFolhas(patchesDosCortes(sequencia, criarCorte(cortes, sequencia.indexOf(id), sequencia.length))) }`.

Peso por folha: `bytesDe(id)` = tamanho do arquivo da prancha ÷ páginas do arquivo, quando o canvas tem o `File` (`pranchaFiles`) ou a ficha guardada (`FichaDePrancha.sizeBytes/paginas`); senão `null` (a régua omite o peso).

- [ ] **Step 1:** implementar a régua; **Step 2:** montar no canvas e o atalho na folha; **Step 3:** `npx tsc --noEmit -p .`, `npx eslint` nos arquivos; `npm run test:nexo:corte-dos-tomos`, `test:nexo:folhas`, `test:nexo:layout`.
- [ ] **Step 4: commit** — `"Corte dos tomos: régua no topo do canvas e 'Tomo aqui' na folha"`.

---

### Task 3: Prova no navegador (build de produção)

- [ ] `scripts/prova-corte-dos-tomos.mjs`: conversa de um projeto do dev com ≥ 2 tomos (084-25 ou 040-26 EST; folhas restauradas do servidor); localizar a régua; arrastar a 1ª marca com `page.mouse` (down → move em passos → up) 3 vãos à direita; conferir que a 1ª fileira ganhou 3 folhas e a 2ª perdeu 3 (contagem nos cabeçalhos dos tomos); clicar num vão para criar um tomo; "Voltar ao automático" e conferir que volta. Screenshot de cada passo. Sem token: nada aqui chama IA.
- [ ] Commit do script e registro na memória.
