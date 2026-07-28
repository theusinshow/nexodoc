# Mexer nas folhas (4A) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O canvas do Nexo passa a aceitar seleção por janela, arrasto de folhas entre tomos e reordenação — escrevendo `grupo` e `ordem` em `ajustes`, de modo que o volume montado depois saia na organização desenhada à mão.

**Architecture:** Os nós do canvas deixam de ser um `useMemo` somente-leitura e passam a ser estado reconciliado a partir da derivação (a derivação continua sendo a verdade; a reconciliação preserva a seleção). O gesto vem do React Flow (`selectionOnDrag` + `panOnDrag={[1,2]}`), e a tradução de "soltei aqui" para "escreva isto em `ajustes`" mora num módulo puro novo, `modules/nexo/lib/drop-folhas.ts`, testado em Node pelado.

**Tech Stack:** Next.js (App Router), React 19 + React Compiler, TypeScript, `@xyflow/react` 12.11, testes puros em `scripts/test-nexo-*.ts` rodados por `node` (sem framework).

**Spec:** `docs/superpowers/specs/2026-07-28-nexo-mexer-nas-folhas-design.md`

## Global Constraints

- **Nunca `git add -A` neste repositório.** Listar os arquivos, sempre.
- Commitar direto na `main` e dar `git push origin main`. Não criar branch nem PR.
- Mensagem de commit **sem acentos**, terminando em `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Módulos puros (`folhas.ts`, `layout-canvas.ts`, `drop-folhas.ts`) **não podem ter import de runtime**: rodam em `node` direto, com `.ts` na extensão do import.
- **`setState` síncrono no corpo de um `useEffect` é barrado pelo lint do React Compiler neste repo.** O jeito já usado aqui é adiar por `requestAnimationFrame` (ver `modules/nexo/components/agent-orb/use-agent-state.ts:44-54`). Isso vale para o effect que reconcilia os nós.
- Verificação de tipos em qualquer task que mexa em `.tsx`: `npx tsc --noEmit`. Lint da pasta tocada: `npx eslint modules/nexo`.
- Erro pré-existente e não relacionado: `npx eslint .` falha em `components/audit-pdf-viewer-internal.tsx:70`. Não é deste trabalho.

---

### Task 1: A chave de ordenação fica visível na projeção

`ajusteDoDrop` precisa saber a chave de ordenação real de cada folha para inserir
entre duas. Essa chave é `ordem ?? posição natural`, e a `posição natural` — o
índice na leitura, antes de qualquer ajuste — hoje é calculada dentro de
`folhas()` e **jogada fora**.

Usar o índice no array projetado no lugar dela produziria um defeito silencioso:
com uma folha já reordenada, os índices projetados deixam de coincidir com as
chaves, e a folha solta entre A e B iria parar depois de B.

**Files:**
- Modify: `modules/nexo/lib/folhas.ts`
- Modify: `scripts/test-nexo-folhas.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `Folha.natural: number` e `chaveDeOrdem(f: Folha): number`. A Task 2 usa as duas.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar em `scripts/test-nexo-folhas.ts`, antes do `console.log` final:

```ts
// ---------------------------------------------------------------------------
// A chave de ordenação, que o arrasto (4A) precisa enxergar
// ---------------------------------------------------------------------------

test("a folha carrega a posição natural da leitura", () => {
  const out = folhas(SELOS, {});
  assert.deepEqual(out.map((f) => f.natural), [0, 1, 2]);
});

test("chaveDeOrdem é `ordem` quando há, e a natural quando não há", () => {
  const ajustes = aplicarAjuste({}, folhaId(SELOS[2]), { ordem: 0.5 });
  const out = folhas(SELOS, ajustes);
  // A reordenada vem em 2º e a chave dela é a `ordem` manual.
  assert.deepEqual(out.map((f) => chaveDeOrdem(f)), [0, 0.5, 1]);
  // A natural NÃO muda com a reordenação: é a posição na leitura.
  assert.deepEqual(out.map((f) => f.natural), [0, 2, 1]);
});
```

E acrescentar `chaveDeOrdem` ao import de `../modules/nexo/lib/folhas.ts` no topo
do arquivo.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm run test:nexo:folhas`
Expected: FALHA com `chaveDeOrdem is not a function` (ou erro de import).

- [ ] **Step 3: Expor a natural e a chave**

Em `modules/nexo/lib/folhas.ts`, dentro de `interface Folha`, depois de `editado`:

```ts
  /**
   * Posição na LEITURA, antes de qualquer ajuste. É a chave de ordenação quando
   * não há `ordem` — e quem insere uma folha entre duas outras (o arrasto)
   * precisa dela: o índice no array já projetado não serve, porque com uma folha
   * reordenada os dois deixam de coincidir.
   */
  natural: number;
```

Em `folhas()`, o objeto devolvido dentro do `map` ganha o campo (o valor já existe
na variável `natural` do `map`):

```ts
    return {
      folha: {
        ...selo,
        id: folhaId(selo),
        natural,
        conteudo: titulo ?? selo.conteudo,
```

E, no fim do arquivo, a chave:

```ts
/**
 * A chave de ordenação de uma folha: a `ordem` manual quando existe, senão a
 * posição natural. É por esta chave que a projeção ordena — e é entre duas
 * destas que uma folha arrastada tem de cair.
 */
export function chaveDeOrdem(f: Folha): number {
  return f.ordem ?? f.natural;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm run test:nexo:folhas`
Expected: os 18 testes de antes **mais** os 2 novos, sem `FALHOU`. Em especial o
primeiro teste do arquivo ("sem ajustes, a projeção devolve os selos na ordem
natural") tem de continuar verde — ele é a garantia de não-regressão da montagem.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/lib/folhas.ts scripts/test-nexo-folhas.ts
git commit -m "Nexo: a projecao passa a expor a posicao natural e a chave de ordem

O arrasto precisa inserir uma folha ENTRE duas, e pra isso tem de ler a chave real
de ordenacao (ordem ?? natural). Usar o indice do array projetado no lugar dela
erra em silencio: com uma folha ja reordenada os dois deixam de coincidir, e a
folha solta entre A e B iria parar depois de B.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: `drop-folhas.ts` — soltar vira ajuste

O módulo puro que traduz "soltei neste ponto" em "escreva isto em `ajustes`".

**Files:**
- Create: `modules/nexo/lib/drop-folhas.ts`
- Create: `scripts/test-nexo-drop.ts`
- Modify: `package.json` (script `test:nexo:drop`)

**Interfaces:**
- Consumes: `Folha`, `FolhaId`, `Ajuste` de `./folhas` — **só como tipo** (`import type`), que é apagado em runtime. **Nada de import de valor:** `drop-folhas.ts` roda em `node` direto, e `import { x } from "./folhas.ts"` faz `npx tsc --noEmit` falhar com TS5097. É a mesma razão pela qual `folhas.ts` recebe `repartir` injetado em vez de importá-lo (ver o comentário no topo daquele arquivo). Por isso `chaveDeOrdem` e as medidas da grade chegam por parâmetro.
- Produces: `FileiraDoDrop`, `GradeDoDrop`, `alvoDoDrop(ponto, fileiras, grade)`, `ordensEntre(anterior, proxima, quantas)`, `ajusteDoDrop(movidas, alvo, fileiraAlvo, divisaoAtual, chave)`. A Task 5 usa `alvoDoDrop` e `ajusteDoDrop`.

**O congelamento — leia antes de escrever o código.** Só fixar o `grupo` da folha
arrastada não basta: as outras continuam na divisão automática, que reequilibra os
tomos e puxa uma folha de volta para a vaga aberta. Verificado com 6 folhas em 2
tomos, arrastando a folha 1 do tomo 1 para o tomo 2:

```
antes    tomo 1: [1, 2, 3]     tomo 2: [4, 5, 6]
depois   tomo 1: [2, 3, 4]     tomo 2: [1, 5, 6]      ← a folha 4 voltou sozinha
```

Por isso `ajusteDoDrop` recebe a divisão que está na tela e **congela o palpite**:
toda folha sem `grupo` ganha o tomo em que já está. Depois disso, só se move o que
for movido à mão.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-drop.ts`:

```ts
/**
 * Teste do DROP: onde a folha caiu → o que escrever em `ajustes`.
 *
 * Ordem esparsa é aritmética que erra em silêncio (folha que "volta" pro lugar,
 * duas folhas com a mesma ordem) e o defeito só apareceria no PDF montado.
 *
 *   node scripts/test-nexo-drop.ts   (== npm run test:nexo:drop)
 */
import assert from "node:assert/strict";

import {
  chaveDeOrdem,
  folhas,
  gruposDasFolhas,
  type Ajuste,
  type Folha,
  type FolhaId,
} from "../modules/nexo/lib/folhas.ts";
import {
  ajusteDoDrop,
  alvoDoDrop,
  ordensEntre,
  type FileiraDoDrop,
  type GradeDoDrop,
} from "../modules/nexo/lib/drop-folhas.ts";
import {
  COLUNAS_DA_GRADE,
  PASSO_X,
  PASSO_Y,
} from "../modules/nexo/lib/layout-canvas.ts";
import type { SeloForLd } from "../server/nexo/build-ld-proposal.ts";
import { buildBalancedQuantities } from "../lib/ld/ld-rules.ts";

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

function selo(fileName: string, pageNumber: number): SeloForLd {
  return {
    fileName,
    pageNumber,
    disciplina: "ARQUITETURA",
    folha: pageNumber,
    total: 6,
    numeroFolha: String(pageNumber),
    arquivo: `${fileName}-${pageNumber}`,
    conteudo: `Prancha ${pageNumber}`,
    cliente: null,
    secretaria: null,
    obra: null,
    fase: null,
    tituloSecao: null,
  };
}

const SELOS: SeloForLd[] = [1, 2, 3, 4, 5, 6].map((n) => selo("a.pdf", n));
const PROJETADAS = folhas(SELOS, {});

// A grade e a chave chegam INJETADAS no módulo puro; o teste passa as de
// produção — um dublê aqui só provaria que o parâmetro é chamado.
const GRADE: GradeDoDrop = {
  colunas: COLUNAS_DA_GRADE,
  passoX: PASSO_X,
  passoY: PASSO_Y,
};

/** A divisão que estaria na tela: 3 folhas por tomo, como o automático faria. */
const DIVISAO: { tomo: number; folhas: readonly Folha[] }[] = [
  { tomo: 1, folhas: PROJETADAS.slice(0, 3) },
  { tomo: 2, folhas: PROJETADAS.slice(3) },
];

// Duas fileiras: tomo 1 com as 3 primeiras, tomo 2 com as 3 últimas.
const FILEIRAS: FileiraDoDrop[] = [
  {
    tomo: 1,
    topo: 0,
    altura: 330,
    gradeX: 780,
    gradeY: 0,
    folhas: PROJETADAS.slice(0, 3).map((f) => f.id),
  },
  {
    tomo: 2,
    topo: 330,
    altura: 330,
    gradeX: 780,
    gradeY: 330,
    folhas: PROJETADAS.slice(3).map((f) => f.id),
  },
];

// ---------------------------------------------------------------------------
// ordensEntre
// ---------------------------------------------------------------------------

test("intercala estritamente entre os dois vizinhos", () => {
  const [o] = ordensEntre(1, 2, 1);
  assert.ok(o > 1 && o < 2, `${o} não ficou entre 1 e 2`);
});

test("várias juntas mantêm a ordem entre si e cabem no intervalo", () => {
  const out = ordensEntre(1, 2, 3);
  assert.equal(out.length, 3);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out[0] > 1 && out[2] < 2, `${out.join(",")} saiu do intervalo`);
});

test("sem vizinho anterior, vem antes do próximo", () => {
  const out = ordensEntre(null, 3, 2);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out[out.length - 1] < 3, `${out.join(",")} não ficou antes de 3`);
});

test("sem próximo, vem depois do anterior", () => {
  const out = ordensEntre(5, null, 2);
  assert.deepEqual(out, [...out].sort((a, b) => a - b));
  assert.ok(out[0] > 5, `${out.join(",")} não ficou depois de 5`);
});

test("lista vazia não produz ordem nenhuma", () => {
  assert.deepEqual(ordensEntre(1, 2, 0), []);
});

// ---------------------------------------------------------------------------
// alvoDoDrop
// ---------------------------------------------------------------------------

test("acerta a fileira e a posição pela coordenada", () => {
  // Sobre a 2ª folha do tomo 1.
  const alvo = alvoDoDrop({ x: 780 + PASSO_X, y: 10 }, FILEIRAS, GRADE);
  assert.deepEqual(alvo, { tomo: 1, indice: 1 });
});

test("cair na folga entre a grade e o volume ainda é a fileira", () => {
  // Bem à direita da grade, mas dentro da faixa vertical do tomo 2.
  const alvo = alvoDoDrop({ x: 780 + 40 * PASSO_X, y: 400 }, FILEIRAS, GRADE);
  assert.equal(alvo?.tomo, 2);
  // Clampado ao fim da fileira, não a um índice inventado.
  assert.equal(alvo?.indice, 3);
});

test("a segunda linha da grade continua a contagem", () => {
  const alvo = alvoDoDrop({ x: 780, y: PASSO_Y + 5 }, FILEIRAS, GRADE);
  assert.deepEqual(alvo, { tomo: 1, indice: 3 });
});

test("fora de qualquer fileira devolve null", () => {
  assert.equal(alvoDoDrop({ x: 780, y: 5000 }, FILEIRAS, GRADE), null);
});

// ---------------------------------------------------------------------------
// ajusteDoDrop — e o que a montagem faz com ele
// ---------------------------------------------------------------------------

test("mover uma folha para o outro tomo escreve grupo E ordem nela", () => {
  const movida = PROJETADAS[0];
  const patches = ajusteDoDrop(
    [movida],
    { tomo: 2, indice: 1 },
    PROJETADAS.slice(3),
    DIVISAO,
    chaveDeOrdem,
  );
  const daMovida = patches.find((p) => p.id === movida.id);
  assert.equal(daMovida?.patch.grupo, 2);
  assert.ok(typeof daMovida?.patch.ordem === "number");
});

test("congela o palpite: TODA folha sem grupo ganha o tomo em que já estava", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[0]],
    { tomo: 2, indice: 1 },
    PROJETADAS.slice(3),
    DIVISAO,
    chaveDeOrdem,
  );
  // As 6 folhas saem com grupo — a arrastada no destino, as outras onde estavam.
  assert.equal(patches.length, 6);
  const porId = new Map(patches.map((p) => [p.id, p.patch]));
  assert.equal(porId.get("a.pdf#2")?.grupo, 1);
  assert.equal(porId.get("a.pdf#3")?.grupo, 1);
  assert.equal(porId.get("a.pdf#4")?.grupo, 2);
  // Congelar não inventa ordem para quem não se moveu.
  assert.equal(porId.get("a.pdf#2")?.ordem, undefined);
});

test("sem divisão (uma fileira só), reordena sem escrever grupo nenhum", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[2]],
    { tomo: 1, indice: 0 },
    PROJETADAS,
    null,
    chaveDeOrdem,
  );
  assert.equal(patches.length, 1);
  assert.equal(patches[0].patch.grupo, undefined);
  assert.ok(typeof patches[0].patch.ordem === "number");
});

test("O TESTE QUE AMARRA: a folha vai para o tomo e a posição do drop, e NENHUMA outra se mexe", () => {
  const movida = PROJETADAS[0]; // 1ª folha, hoje no tomo 1
  const patches = ajusteDoDrop(
    [movida],
    { tomo: 2, indice: 1 }, // entre a 4 e a 5
    PROJETADAS.slice(3),
    DIVISAO,
    chaveDeOrdem,
  );

  const ajustes: Record<FolhaId, Ajuste> = {};
  for (const p of patches) ajustes[p.id] = p.patch;

  const grupos = gruposDasFolhas(folhas(SELOS, ajustes), 2, buildBalancedQuantities);
  // O tomo 1 perdeu SÓ a folha arrastada.
  assert.deepEqual(grupos[0], ["a.pdf#2", "a.pdf#3"]);
  // O tomo 2 recebeu ela entre a 4 e a 5, e não perdeu ninguém.
  assert.deepEqual(grupos[1], ["a.pdf#4", "a.pdf#1", "a.pdf#5", "a.pdf#6"]);
});

test("soltar exatamente onde já estava não escreve ajuste nenhum", () => {
  const movidas = PROJETADAS.slice(0, 2);
  const patches = ajusteDoDrop(
    movidas,
    { tomo: 1, indice: 0 },
    PROJETADAS.slice(0, 3),
    DIVISAO,
    chaveDeOrdem,
  );
  // Nem o congelamento: gesto sem efeito não escreve nada.
  assert.deepEqual(patches, []);
});

test("mas mover UMA casa dentro da mesma fileira escreve", () => {
  const patches = ajusteDoDrop(
    [PROJETADAS[0]],
    { tomo: 1, indice: 2 },
    PROJETADAS.slice(0, 3),
    DIVISAO,
    chaveDeOrdem,
  );
  const daMovida = patches.find((p) => p.id === "a.pdf#1");
  assert.ok(typeof daMovida?.patch.ordem === "number");
});

console.log(`\n${passed} teste(s) do drop OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-nexo-drop.ts`
Expected: FALHA no import — `Cannot find module '.../drop-folhas.ts'`.

- [ ] **Step 3: Escrever o módulo**

Criar `modules/nexo/lib/drop-folhas.ts`:

```ts
/**
 * Soltar uma folha no canvas → o que escrever em `ajustes`.
 *
 * O canvas só reporta COORDENADA; a regra mora aqui, onde dá para testar em Node
 * pelado. Ordem esparsa é aritmética que erra em silêncio — folha que "volta"
 * para o lugar, duas folhas com a mesma ordem — e um defeito desses só apareceria
 * no PDF montado.
 *
 * PURO: nenhum import de VALOR. Só `import type`, que é apagado em runtime — um
 * import de valor com `.ts` faz o `tsc` do projeto falhar (TS5097), e sem o `.ts`
 * o Node não resolve. Por isso a grade e a chave de ordenação chegam INJETADAS,
 * do mesmo jeito que `folhas.ts` recebe `repartir`.
 */

import type { Ajuste, Folha, FolhaId } from "./folhas.ts";

/** As medidas da grade (`layout-canvas`), injetadas. */
export interface GradeDoDrop {
  colunas: number;
  passoX: number;
  passoY: number;
}

/** Uma fileira, como o canvas a desenhou: onde está e o que tem dentro. */
export interface FileiraDoDrop {
  tomo: number;
  /** Caixa da fileira inteira, em coordenadas do canvas. */
  topo: number;
  altura: number;
  /** Canto superior esquerdo da grade de folhas. */
  gradeX: number;
  gradeY: number;
  /** Ids das folhas da fileira, na ordem em que estão desenhadas. */
  folhas: FolhaId[];
}

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(maximo, Math.max(minimo, valor));
}

/**
 * Em que tomo e em que posição da grade o ponto caiu. `null` quando cai fora de
 * qualquer fileira — soltar no vazio não inventa tomo (isso é o 4B).
 *
 * A coluna usa ARREDONDAMENTO, não truncamento: o alvo é a fresta ENTRE duas
 * folhas, então soltar na metade direita de uma folha insere depois dela.
 */
export function alvoDoDrop(
  ponto: { x: number; y: number },
  fileiras: readonly FileiraDoDrop[],
  grade: GradeDoDrop,
): { tomo: number; indice: number } | null {
  const fileira = fileiras.find(
    (f) => ponto.y >= f.topo && ponto.y < f.topo + f.altura,
  );
  if (!fileira) return null;

  const coluna = limitar(
    Math.round((ponto.x - fileira.gradeX) / grade.passoX),
    0,
    grade.colunas,
  );
  const linha = Math.max(0, Math.floor((ponto.y - fileira.gradeY) / grade.passoY));
  const indice = limitar(linha * grade.colunas + coluna, 0, fileira.folhas.length);
  return { tomo: fileira.tomo, indice };
}

/**
 * As ordens esparsas para `quantas` folhas soltas entre dois vizinhos. Reparte o
 * intervalo em partes iguais, preservando a ordem relativa de quem foi junto.
 *
 * Esparsa de propósito: mover uma folha não renumera as outras, e é isso que faz
 * dois arrastos seguidos não brigarem.
 */
export function ordensEntre(
  anterior: number | null,
  proxima: number | null,
  quantas: number,
): number[] {
  if (quantas <= 0) return [];
  if (anterior === null && proxima === null) {
    return Array.from({ length: quantas }, (_, i) => i);
  }
  if (anterior === null) {
    return Array.from({ length: quantas }, (_, i) => proxima! - (quantas - i));
  }
  if (proxima === null) {
    return Array.from({ length: quantas }, (_, i) => anterior + 1 + i);
  }
  const passo = (proxima - anterior) / (quantas + 1);
  return Array.from({ length: quantas }, (_, i) => anterior + passo * (i + 1));
}

/**
 * O que escrever em `ajustes` por causa deste arrasto.
 *
 * CONGELA o palpite: toda folha sem `grupo` ganha o tomo em que já está. Sem isso,
 * arrastar uma folha faz outra pular de tomo sozinha — a divisão automática
 * reequilibra e puxa uma folha para a vaga que abriu.
 *
 * `divisaoAtual` nula (uma fileira só) NÃO escreve `grupo` nenhum: sem divisão,
 * gravar o tomo seria inventar uma decisão que o usuário não tomou.
 */
export function ajusteDoDrop(
  movidas: readonly Folha[],
  alvo: { tomo: number; indice: number },
  fileiraAlvo: readonly Folha[],
  divisaoAtual: readonly { tomo: number; folhas: readonly Folha[] }[] | null,
  chaveDeOrdem: (f: Folha) => number,
): { id: FolhaId; patch: Ajuste }[] {
  if (movidas.length === 0) return [];

  const indoJunto = new Set(movidas.map((f) => f.id));
  /*
   * A fileira de destino SEM quem está sendo movido: soltar entre A e B tem de
   * olhar para quem VAI ficar lá. Contar a própria folha arrastada como vizinha
   * daria uma ordem no lugar de onde ela está saindo.
   */
  const restantes = fileiraAlvo.filter((f) => !indoJunto.has(f.id));
  const indice = limitar(alvo.indice, 0, restantes.length);

  // Quem foi junto entra na ordem em que já estava — arrastar não embaralha.
  const naOrdem = [...movidas].sort((a, b) => chaveDeOrdem(a) - chaveDeOrdem(b));

  /*
   * Soltar exatamente onde já estava não escreve nada. Sem esta guarda, encostar
   * numa folha e largar no mesmo lugar gravaria `grupo` e `ordem` — o estado
   * cresceria a cada gesto sem efeito, e a folha passaria a ter posição FIXADA à
   * mão sem que ninguém tenha decidido isso.
   */
  const jaMoravamAqui = naOrdem.every((f) => fileiraAlvo.some((g) => g.id === f.id));
  if (jaMoravamAqui) {
    const depois = [
      ...restantes.slice(0, indice).map((f) => f.id),
      ...naOrdem.map((f) => f.id),
      ...restantes.slice(indice).map((f) => f.id),
    ];
    const antes = fileiraAlvo.map((f) => f.id);
    if (antes.length === depois.length && antes.every((id, i) => id === depois[i])) {
      return [];
    }
  }

  const anterior = indice > 0 ? chaveDeOrdem(restantes[indice - 1]) : null;
  const proxima = indice < restantes.length ? chaveDeOrdem(restantes[indice]) : null;
  const ordens = ordensEntre(anterior, proxima, naOrdem.length);

  const patches = new Map<FolhaId, Ajuste>();

  // Congela o palpite: quem não tem grupo ganha o tomo em que já está. Sem ordem
  // — não se moveu, e inventar ordem para todo mundo fixaria o que não foi
  // decidido.
  if (divisaoAtual) {
    for (const fileira of divisaoAtual) {
      for (const f of fileira.folhas) {
        if (f.grupo === undefined) patches.set(f.id, { grupo: fileira.tomo });
      }
    }
  }

  // As arrastadas vêm por último: elas mandam sobre o congelamento.
  naOrdem.forEach((f, i) => {
    patches.set(f.id, {
      ...(divisaoAtual ? { grupo: alvo.tomo } : {}),
      ordem: ordens[i],
    });
  });

  return [...patches].map(([id, patch]) => ({ id, patch }));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-nexo-drop.ts`
Expected: 15 linhas `ok` e `15 teste(s) do drop OK`.

- [ ] **Step 5: Registrar o script no `package.json`**

Abaixo de `"test:nexo:layout"`:

```json
    "test:nexo:drop": "node scripts/test-nexo-drop.ts"
```

(atenção à vírgula da linha anterior)

- [ ] **Step 6: Rodar pelo npm**

Run: `npm run test:nexo:drop`
Expected: `15 teste(s) do drop OK`.

- [ ] **Step 6b: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros. **Se aparecer TS5097** ("An import path can only end with a
'.ts' extension when allowImportingTsExtensions is enabled"), é sinal de que
sobrou um import de VALOR no módulo — ele só pode ter `import type`.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/lib/drop-folhas.ts scripts/test-nexo-drop.ts package.json
git commit -m "Nexo: a regra do drop das folhas (modulo puro)

Onde a folha caiu -> o que escrever em ajustes. O canvas so reporta coordenada.

A ordem nova e a media entre as chaves dos vizinhos, e a fileira de destino e
olhada SEM quem esta sendo movido -- contar a propria folha arrastada como vizinha
daria uma ordem no lugar de onde ela esta saindo.

O teste que amarra tudo aplica o ajuste e confere que gruposDasFolhas devolve a
folha no tomo e na posicao do drop.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 8: A marca âmbar não pode acender no canvas inteiro**

Congelar escreve `grupo` em todas as folhas, e `editado` é verdadeiro para
qualquer ajuste — então a marca de "corrigido à mão" no nó acenderia em todas
elas depois do primeiro arrasto, mentindo sobre o que o usuário mexeu.

Escrever o teste primeiro, em `scripts/test-nexo-folhas.ts` (antes do
`console.log` final):

```ts
test("editadoTexto separa texto reescrito de folha só remanejada", () => {
  const so_arranjo = folhas(SELOS, { "a.pdf#1": { grupo: 2, ordem: 3.5 } });
  assert.equal(so_arranjo[0].editado, true);
  assert.equal(so_arranjo[0].editadoTexto, false);

  const com_texto = folhas(SELOS, { "a.pdf#1": { titulo: "OUTRO" } });
  assert.equal(com_texto[0].editadoTexto, true);

  const disciplina = folhas(SELOS, { "a.pdf#1": { disciplina: "ESTRUTURAL" } });
  assert.equal(disciplina[0].editadoTexto, true);
});
```

- [ ] **Step 9: Rodar e ver falhar**

Run: `npm run test:nexo:folhas`
Expected: FALHA — `editadoTexto` é `undefined`, não `false`.

- [ ] **Step 10: Separar os dois na projeção**

Em `modules/nexo/lib/folhas.ts`, dentro de `interface Folha`, logo depois de
`editado`:

```ts
  /**
   * O TEXTO foi reescrito (título ou disciplina). Diferente de `editado`, que é
   * verdadeiro para qualquer ajuste: depois que o primeiro arrasto congela a
   * divisão, TODA folha tem `grupo` — e a marca de "corrigido à mão" no canvas
   * acenderia em todas, mentindo sobre o que o usuário mexeu. Posição não é
   * leitura de carimbo.
   */
  editadoTexto: boolean;
```

E no objeto devolvido por `folhas()`, junto de `editado`:

```ts
        editadoTexto: titulo !== null || disciplina !== null,
```

- [ ] **Step 11: O nó da folha passa a usar a marca certa**

Em `modules/nexo/components/FolhaNode.tsx`, o campo `editado` de `FolhaNodeData`
continua com o mesmo nome (é a marca visual), mas quem o alimenta muda. Nada a
mudar neste arquivo — a troca é no canvas, e ela entra na Task 4. Anotar no
relatório que `NexoCanvas.tsx` ainda passa `editado: f.editado` e que a Task 4 tem
de trocar para `f.editadoTexto`.

- [ ] **Step 12: Rodar, verificar e commitar**

Run: `npm run test:nexo:folhas && npx tsc --noEmit`
Expected: os testes de antes mais o novo, e tipos limpos.

```bash
git add modules/nexo/lib/folhas.ts scripts/test-nexo-folhas.ts
git commit -m "Nexo: a projecao separa texto reescrito de folha remanejada

Congelar a divisao escreve grupo em TODA folha, e `editado` e verdadeiro pra
qualquer ajuste -- entao a marca de corrigido-a-mao acenderia no canvas inteiro
depois do primeiro arrasto, mentindo sobre o que o usuario mexeu.

`editadoTexto` diz se titulo ou disciplina foram trocados. Posicao nao e leitura
de carimbo.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: Escrita em bloco no store

Um arrasto de 30 folhas escreve 30 ajustes. Precisa ser um `setState` só.

**Files:**
- Modify: `modules/nexo/state/conversation-store.tsx`

**Interfaces:**
- Consumes: `aplicarAjuste`, `Ajuste`, `FolhaId` de `../lib/folhas` (já importados no arquivo).
- Produces: `conv.ajustarFolhas(entradas: { id: FolhaId; patch: Ajuste }[]): void`. A Task 5 usa.

- [ ] **Step 1: Declarar no contrato**

Em `interface ConversationStoreValue`, logo abaixo de `ajustarFolha`:

```ts
  /** Vários ajustes numa tacada (um arrasto de seleção). Um `setState` só. */
  ajustarFolhas: (entradas: { id: FolhaId; patch: Ajuste }[]) => void;
```

- [ ] **Step 2: Implementar**

Logo abaixo do `ajustarFolha` existente:

```ts
  /*
   * Um arrasto de 30 folhas são 30 ajustes. Chamar `ajustarFolha` num laço
   * funcionaria — `aplicarAjuste` é puro e compõe —, mas seriam 30 renders e 30
   * agendamentos de persistência para um único gesto.
   */
  const ajustarFolhas = useCallback(
    (entradas: { id: FolhaId; patch: Ajuste }[]) => {
      if (entradas.length === 0) return;
      setAjustes((prev) =>
        entradas.reduce((acc, e) => aplicarAjuste(acc, e.id, e.patch), prev),
      );
      schedulePersist();
    },
    [schedulePersist],
  );
```

- [ ] **Step 3: Publicar no `value`**

No `useMemo` do `value`, acrescentar `ajustarFolhas` **no objeto e no array de
dependências**, logo depois de `ajustarFolha` nos dois lugares.

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/state/conversation-store.tsx
git commit -m "Nexo: ajustarFolhas escreve o arrasto inteiro numa tacada

Um arrasto de 30 folhas sao 30 ajustes. Num laco isso viraria 30 renders e 30
agendamentos de persistencia pra um gesto so.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: Os nós viram estado, e o gesto entra

A troca estrutural. Depois desta task dá para selecionar por janela e arrastar —
mas soltar ainda não escreve nada (é a Task 5). Separado de propósito: se o canvas
quebrar, o defeito é aqui, não na regra do drop.

**Files:**
- Modify: `modules/nexo/components/NexoCanvas.tsx`

**Interfaces:**
- Consumes: `FileiraDoDrop` de `../lib/drop-folhas` (Task 2).
- Produces: no `useMemo` do canvas, além de `nodes`/`edges`/`fileiras`, também `fileirasDoDrop: FileiraDoDrop[]` e `folhasPorTomo: Map<number, Folha[]>`; e `reconciliar(derivados, atuais)`. A Task 5 usa os três.

- [ ] **Step 1: Trocar os imports**

Em `modules/nexo/components/NexoCanvas.tsx`:

```ts
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  useNodesState,
  Handle,
  Position,
  MarkerType,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
```

E acrescentar, junto dos outros imports de `../lib`:

```ts
import type { FileiraDoDrop } from "../lib/drop-folhas";
```

- [ ] **Step 2: Tirar a seleção manual do memo**

Apagar o estado `selecionadoId` e o comentário longo acima dele:

```ts
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
```

No corpo do `useMemo`, apagar as duas linhas `selected: it.id === selecionadoId,`
e `selected: id === selecionadoId,` (a seleção passa a viver no estado dos nós), e
tirar `selecionadoId` do array de dependências.

- [ ] **Step 3: O memo passa a devolver a geometria do drop**

Dentro do `useMemo`, antes do `return`, montar as duas estruturas novas. Declarar
no topo do corpo do memo, junto de `const nodes: Node[] = []`:

```ts
    const fileirasDoDrop: FileiraDoDrop[] = [];
    const folhasPorTomo = new Map<number, Folha[]>();
```

Dentro do `grupos.forEach`, logo depois de `antes.forEach(empurrar);`, guardar onde
a grade começa (o cursor naquele instante) — recalcular depois repetiria a regra de
layout em dois lugares:

```ts
      const gradeX = cursorX;
```

E, no fim do `forEach`, logo depois de `depois.forEach(empurrar);`:

```ts
      /*
       * A geometria que o drop vai consultar. `gradeX` é o cursor de ANTES dos
       * documentos que vêm depois da grade — por isso é capturado aqui e não
       * recalculado: recalcular seria repetir a regra de layout em dois lugares.
       */
      // A geometria que o drop vai consultar.
      fileirasDoDrop.push({
        tomo: grupo.tomo,
        topo: y,
        altura: alturaDaFileira(daFileira.length),
        gradeX,
        gradeY: y,
        folhas: daFileira.map((f) => f.id),
      });
      folhasPorTomo.set(grupo.tomo, daFileira);
```

E trocar o `return` do memo:

```ts
    return { nodes, edges, fileiras, fileirasDoDrop, folhasPorTomo };
```

E a desestruturação, na linha do `useMemo`:

```ts
  const { nodes: derivados, edges, fileiras, fileirasDoDrop, folhasPorTomo } = useMemo(() => {
```

- [ ] **Step 4: Os nós viram estado, reconciliados**

Logo depois do `useMemo`, acrescentar:

```ts
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  /*
   * A DERIVAÇÃO é a verdade: posição, rótulo e conteúdo de cada nó saem dela.
   * O estado existe porque janela de seleção e arrasto são coisas que o React
   * Flow entrega por `onNodesChange` — com nós somente-leitura, nada disso chega.
   *
   * Reconciliar preserva o que é do USUÁRIO (quais nós estão selecionados).
   * Trocar o array inteiro apagaria a seleção sempre que qualquer coisa mudasse —
   * inclusive no meio de um gesto.
   */
  const reconciliar = useCallback((novos: Node[], atuais: Node[]): Node[] => {
    const selecionados = new Set(atuais.filter((n) => n.selected).map((n) => n.id));
    return novos.map((n) => (selecionados.has(n.id) ? { ...n, selected: true } : n));
  }, []);

  /*
   * O `setState` é adiado por rAF porque `setState` SÍNCRONO no corpo do effect é
   * barrado pelo lint do React Compiler — é o mesmo jeito que `use-agent-state`
   * já usa.
   */
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setNodes((atuais) => reconciliar(derivados, atuais)),
    );
    return () => cancelAnimationFrame(raf);
  }, [derivados, reconciliar, setNodes]);
```

- [ ] **Step 5: Trocar as props do `<ReactFlow>`**

```tsx
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        colorMode="dark"
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        elementsSelectable
        /*
         * Botão esquerdo no vazio DESENHA A JANELA de seleção; a tela se move
         * com o botão do meio, o direito, ou espaço + arrastar. É o gesto do
         * AutoCAD, que foi o pedido — e a única coisa que muda de hábito.
         * `selectionKeyCode={null}` evita que Shift+arrastar vire uma segunda
         * janela: Shift é o que SOMA à seleção.
         */
        selectionOnDrag
        selectionKeyCode={null}
        panOnDrag={[1, 2]}
        panOnScroll
        zoomOnScroll
      >
```

Note que `onNodeClick`, `onPaneClick` e `nodesDraggable={false}` **saem**: a
seleção passa a ser nativa, e arrastar é o ponto do sub-projeto. Quem controla
quem arrasta é o `draggable` de cada nó — os de documento já vêm com
`draggable: false` da derivação, e a linha do nó de folha muda para
`draggable: true`:

```ts
          draggable: true,
```

(na hora de empurrar o nó de folha, dentro do `daFileira.forEach`)

- [ ] **Step 5b: A marca âmbar passa a ler `editadoTexto`**

No `useMemo`, no `data` do nó de folha, trocar a linha:

```ts
            editado: f.editado,
```

por:

```ts
            // `editadoTexto`, não `editado`: depois que o primeiro arrasto congela
            // a divisão, TODA folha tem `grupo` — e a marca de "corrigido à mão"
            // acenderia no canvas inteiro, mentindo sobre o que o usuário mexeu.
            editado: f.editadoTexto,
```

- [ ] **Step 6: Verificar tipos, lint e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

Run: `npx eslint modules/nexo`
Expected: sem saída. **Se acusar `setState` em effect**, é sinal de que o rAF do
Step 4 foi perdido na edição — o padrão com rAF é o que passa neste repo.

Run: `npm run build`
Expected: build completo.

- [ ] **Step 7: Ver no navegador**

Run: `npm run dev` e, noutro terminal, `node scripts/shot-nexo.mjs`

Expected: **todas as checagens continuam OK**, inclusive "clicar no nó o deixa
SELECIONADO", "‘Editar aqui’ CONTINUA na tela (nó não remonta)" e "editor do nó
CONTINUA aberto". Se o editor passar a fechar sozinho, a causa é a derivação
mudando mais vezes do que deveria — o effect só pode disparar quando `derivados`
muda de verdade. Conferir que nenhuma dependência do `useMemo` é recriada a cada
render (foi esse o defeito original do popover que fechava sozinho).

Depois, à mão em `/nexo`: arrastar no vazio desenha um retângulo e as folhas
dentro dele ficam com a borda de selecionado; o botão do meio (ou espaço) move a
tela; arrastar uma folha a tira do lugar e, ao soltar, ela **volta** para a grade
(ainda não há escrita — é a Task 5).

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/components/NexoCanvas.tsx
git commit -m "Nexo: os nos do canvas viram estado, e o gesto de selecao entra

Janela de selecao e arrasto sao o que o React Flow entrega por onNodesChange, e
com nos derivados de um useMemo nada disso chegava -- foi por isso que a selecao
era manual e o minimapa nao funcionava.

A derivacao continua sendo a verdade; o estado e reconciliado a partir dela
preservando a selecao. O setState vai por rAF porque setState sincrono no corpo do
effect e barrado pelo lint do React Compiler, como use-agent-state ja fazia.

O botao esquerdo troca de dono: no vazio ele desenha a janela, e a tela se move
com o meio/direito ou espaco. Soltar ainda nao escreve nada.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: Soltar escreve o ajuste

A ponta que faz o gesto valer.

**Files:**
- Modify: `modules/nexo/components/NexoCanvas.tsx`
- Modify: `modules/nexo/components/NexoWorkspace.tsx`

**Interfaces:**
- Consumes: `alvoDoDrop`, `ajusteDoDrop` (Task 2); `conv.ajustarFolhas` (Task 3); `fileirasDoDrop`, `folhasPorTomo`, `reconciliar` (Task 4).
- Produces: prop `onMoverFolhas?: (entradas: { id: FolhaId; patch: Ajuste }[]) => void` no `NexoCanvas`.

- [ ] **Step 1: A prop nova no canvas**

Em `CanvasInterno` e em `NexoCanvas`, acrescentar à assinatura:

```ts
  /** O arrasto terminou: escreva estes ajustes. */
  onMoverFolhas?: (entradas: { id: FolhaId; patch: Ajuste }[]) => void;
```

E ao import de `../lib/folhas`, acrescentar `type Ajuste`; ao de
`../lib/drop-folhas`, as funções:

```ts
import { ajusteDoDrop, alvoDoDrop, type FileiraDoDrop } from "../lib/drop-folhas";
```

- [ ] **Step 2: O manipulador do fim do arrasto**

Logo depois do effect de reconciliação:

```ts
  /*
   * Fim do arrasto: traduz a coordenada em ajuste. O ponto de referência é o
   * CENTRO do nó arrastado, não o canto — soltar "em cima" de uma folha é o que o
   * gesto quer dizer, e o canto fica meio nó à esquerda do que o olho mira.
   */
  const aoSoltar = useCallback(
    (_: React.MouseEvent, no: Node, arrastados: Node[]) => {
      const centro = {
        x: no.position.x + (no.measured?.width ?? LARGURA_FOLHA) / 2,
        y: no.position.y + (no.measured?.height ?? ALTURA_FOLHA) / 2,
      };
      const alvo = alvoDoDrop(centro, fileirasDoDrop);
      // Sem alvo, nada muda: soltar no vazio não inventa tomo (isso é o 4B). A
      // reconciliação devolve as folhas para a grade.
      if (alvo) {
        const ids = new Set(
          arrastados.filter((n) => n.type === "folha").map((n) => String(n.data.id)),
        );
        const movidas = folhas.filter((f) => ids.has(f.id));
        const destino = folhasPorTomo.get(alvo.tomo) ?? [];
        const temDivisao = fileirasDoDrop.filter((f) => f.tomo > 0).length > 1;
        const patches = ajusteDoDrop(movidas, alvo, destino, temDivisao);
        if (patches.length > 0) onMoverFolhas?.(patches);
      }
      /*
       * Reconciliar SEMPRE, mesmo sem ajuste: o nó ficou na posição solta e só a
       * derivação sabe a posição de grade. Sem isto, soltar fora deixaria a folha
       * pendurada no vazio.
       */
      setNodes((atuais) => reconciliar(derivados, atuais));
    },
    [fileirasDoDrop, folhasPorTomo, folhas, onMoverFolhas, derivados, reconciliar, setNodes],
  );
```

Acrescentar ao import de `../lib/layout-canvas` as duas medidas usadas acima:

```ts
import {
  ALTURA_FOLHA,
  LARGURA_FOLHA,
  alturaDaFileira,
  larguraDaGrade,
  posicaoNaGrade,
  topoDasFileiras,
} from "../lib/layout-canvas";
```

E, em `modules/nexo/lib/layout-canvas.ts`, exportar as duas medidas que hoje só
existem como comentário dentro de `PASSO_X`/`PASSO_Y`:

```ts
/** Largura do nó da folha (o passo tem o respiro somado). */
export const LARGURA_FOLHA = 120;
/** Altura do nó da folha. */
export const ALTURA_FOLHA = 56;
```

- [ ] **Step 3: Ligar no `<ReactFlow>`**

```tsx
        onNodeDragStop={aoSoltar}
```

- [ ] **Step 4: Ligar o workspace ao store**

Em `modules/nexo/components/NexoWorkspace.tsx`, junto dos outros callbacks:

```tsx
  // O arrasto no canvas escreve grupo/ordem — e a montagem lê a projeção.
  const moverFolhas = useCallback(
    (entradas: { id: FolhaId; patch: Ajuste }[]) => {
      conv.ajustarFolhas(entradas);
    },
    [conv],
  );
```

Acrescentar `type Ajuste` ao import de `../lib/folhas` e a prop ao canvas:

```tsx
            onCorrigirFolha={corrigirFolha}
            onMoverFolhas={moverFolhas}
```

- [ ] **Step 5: Verificar tipos, lint e build**

Run: `npx tsc --noEmit && npx eslint modules/nexo && npm run build`
Expected: os três sem erro.

- [ ] **Step 6: A prova — arrastar tem de mudar o PDF**

Com `npm run dev` rodando, à mão em `/nexo`:

1. anexar 3 pranchas, pedir "Crie LD e Capa, separados em 2 tomos, prefeitura de
   Criciuma, título PROJETO TESTE" e gerar;
2. arrastar uma folha do **tomo 1** para a fileira do **tomo 2**;
3. conferir na hora: a folha aparece na fileira do tomo 2 e a contagem no rótulo
   de cada tomo muda;
4. **regerar** pelo botão "Gerar de novo";
5. abrir o PDF da LD do tomo 2: aquela folha tem de estar listada lá — e sumir da
   LD do tomo 1.

Expected: os cinco passos. **O passo 5 é o único que prova o sub-projeto** — o nó
mudar de fileira é só a tela.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/components/NexoCanvas.tsx modules/nexo/components/NexoWorkspace.tsx modules/nexo/lib/layout-canvas.ts
git commit -m "Nexo: soltar a folha escreve grupo e ordem

O fim do arrasto vira coordenada, a coordenada vira ajuste no modulo puro, e a
montagem le a projecao -- entao regerar sai na organizacao desenhada a mao.

O centro do no e o ponto de referencia, nao o canto: soltar "em cima" de uma folha
e o que o gesto quer dizer. E a reconciliacao roda SEMPRE, mesmo sem ajuste, senao
soltar fora deixaria a folha pendurada no vazio.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: A regressão que o gesto novo pode causar

O `shot-nexo.mjs` é o portão de qualidade do Nexo no navegador. Ele clica em nós e
espera ferramentas aparecerem — tudo isso passou a depender de seleção nativa.
Esta task fecha o portão em volta do gesto novo.

**Files:**
- Modify: `scripts/shot-nexo.mjs`

**Interfaces:**
- Consumes: o canvas das Tasks 4 e 5.
- Produces: nada.

- [ ] **Step 1: Checar a janela de seleção**

Em `scripts/shot-nexo.mjs`, logo depois da checagem "cada folha vira um nó do
canvas":

```js
  // --- janela de seleção (4A) ----------------------------------------------
  // Arrastar no VAZIO tem de selecionar as folhas cobertas, e não panorar. O
  // defeito silencioso aqui seria a janela existir mas não marcar nada.
  const caixaDoCanvas = await page.locator(".react-flow__pane").boundingBox();
  await page.mouse.move(caixaDoCanvas.x + 8, caixaDoCanvas.y + 8);
  await page.mouse.down();
  await page.mouse.move(
    caixaDoCanvas.x + caixaDoCanvas.width - 8,
    caixaDoCanvas.y + caixaDoCanvas.height - 8,
    { steps: 12 },
  );
  await page.mouse.up();
  await page.waitForTimeout(400);
  const selecionadas = await page
    .locator('.react-flow__node[data-id^="folha:"].selected')
    .count();
  check(
    "janela de seleção marca as folhas cobertas",
    selecionadas > 0,
    `${selecionadas} folhas selecionadas`,
  );
  await page.keyboard.press("Escape");
  await page.locator(".react-flow__pane").click({ position: { x: 8, y: 8 } });
```

- [ ] **Step 2: Rodar o portão inteiro**

Run: `npm run dev` (noutro terminal) e `node scripts/shot-nexo.mjs`
Expected: todas as checagens OK, incluindo a nova. Se "clicar no nó o deixa
SELECIONADO" falhar, a seleção nativa não está chegando aos nós — o problema é a
reconciliação da Task 4, não este script.

- [ ] **Step 3: Rodar a bateria pura inteira**

Run: `npm run test:nexo:folhas && npm run test:nexo:drop && npm run test:nexo:layout && npm run test:nexo:tomos`
Expected: os quatro verdes.

- [ ] **Step 4: Commit**

```bash
git add scripts/shot-nexo.mjs
git commit -m "Nexo: o portao do navegador cobre a janela de selecao

Arrastar no vazio tem de MARCAR as folhas cobertas. O defeito silencioso seria a
janela existir e nao selecionar nada -- e o resto do script passaria verde.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

## Sequência e dependências

| Task | Depende de | Entrega verificável |
|---|---|---|
| 1 Chave de ordenação | — | `npm run test:nexo:folhas` verde com os 2 testes novos |
| 2 `drop-folhas.ts` | 1 | `npm run test:nexo:drop` verde, incluindo o teste que amarra |
| 3 `ajustarFolhas` | — | `tsc` limpo |
| 4 Nós viram estado | 2 (só o tipo) | Janela de seleção seleciona; `shot-nexo` continua verde |
| 5 Soltar escreve | 2, 3, 4 | Arrastar para o tomo 2 e regerar muda o PDF |
| 6 Portão no navegador | 4, 5 | `shot-nexo` verde com a checagem nova |

Tasks 1 e 3 são independentes entre si. A 2 depende só da 1.
