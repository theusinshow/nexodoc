# Tabelas na extração — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir a grade das tabelas a partir das coordenadas que o pdf.js já entrega, e ligar a primeira regra que as consome — a que hoje não enxerga `4.530,98` numa célula.

**Architecture:** Um módulo puro novo (`lib/tabela-do-pdf.ts`) sobre as primitivas de `lib/texto-do-pdf.ts`. Itens viram linhas por `y` (via `mudouDeLinha`, que já existe e já é testada), vãos horizontais viram candidatos a fronteira de coluna, e fronteiras que se **repetem** em linhas consecutivas identificam a tabela — prosa não concorda em fronteira nenhuma, então se auto-exclui. `ExtractedPdfPage` ganha `tabelas?` opcional, e `runDeclaredTotalAreaRule` passa a alimentar com células o mesmo `found` que já usa para prosa.

**Tech Stack:** TypeScript, pdf.js (`pdfjs-dist/legacy`), Node 24. Testes em node cru (type-stripping), `node:assert/strict`, sem bundler.

**Spec:** `docs/superpowers/specs/2026-08-18-tabelas-na-extracao-design.md`

## Global Constraints

- **Testes rodam com node cru:** import por caminho **relativo com extensão `.ts`**; **nunca** alias `@/` em runtime dentro de módulo que um `scripts/test-*.ts` importe. `import type` é apagado no strip.
- **`lib/tabela-do-pdf.ts` é PURO:** sem IO, sem `process.env`, sem importar pdf.js. Recebe itens já extraídos, como `texto-do-pdf.ts` faz. É o que permite testá-lo sem PDF nenhum.
- **Medidas em FRAÇÃO DO CORPO DA FONTE, nunca em pontos absolutos.** Ponto absoluto muda com o zoom do gerador do PDF. Todas as constantes seguem o padrão de `FRACAO_DE_ESPACO`/`FRACAO_DE_LINHA`.
- **Verificar por exit code, nunca pela última linha.** E no harness de precisão/recall, **verificar o FN/FP, não o exit code**: o limiar é 90%, então um falso negativo novo pode passar despercebido com exit 0.
- **Idioma:** código e comentários em pt-BR, seguindo o padrão do repositório.
- **Nenhum token de modelo.** Tudo aqui é determinístico.
- **Cuidado com heredoc e backtick:** gerar código via shell com `\n` ou `` ` `` dentro colapsa escapes silenciosamente. Prefira as ferramentas de edição de arquivo a `python - <<'PY'` para conteúdo com regex.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `lib/texto-do-pdf.ts` | modificado. Exporta `corpoDaFonte`, hoje privada. Não duplicar: o módulo declara ser "a única regra do assunto no repositório". |
| `lib/tabela-do-pdf.ts` | **novo.** Puro. Itens com coordenadas → tabelas. |
| `lib/pdf-text.ts` | modificado. `ExtractedPdfPage` ganha `tabelas?`; `extractPdfText` a preenche. |
| `lib/audit-coherence.ts` | modificado. `runDeclaredTotalAreaRule` lê também as células. |
| `scripts/test-tabela-do-pdf.ts` | **novo.** |
| `scripts/audit-precision-recall.ts` | modificado. Um positivo e dois limpos. |
| `package.json` | script `test:tabela-do-pdf`. |

A decomposição: a reconstrução da grade nasce separada da regra porque responde outra pergunta — *"onde estão as colunas?"* contra *"estes dois números deviam bater?"*. E `audit-coherence.ts` já tem 13 regras; plantar geometria de PDF lá dentro misturaria duas competências que não têm por que viajar juntas.

---

### Task 1: Itens viram linhas

**Files:**
- Modify: `lib/texto-do-pdf.ts` (exportar `corpoDaFonte`)
- Create: `lib/tabela-do-pdf.ts`
- Create: `scripts/test-tabela-do-pdf.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ItemDeTexto`, `mudouDeLinha`, `corpoDaFonte` de `lib/texto-do-pdf.ts`.
- Produces: `type LinhaDaPagina = { itens: ItemDeTexto[] }` e `linhasDaPagina(items: ItemDeTexto[]): LinhaDaPagina[]`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-tabela-do-pdf.ts`:

```ts
/**
 * A GRADE DA TABELA, reconstruída das coordenadas que o pdf.js já entrega.
 *
 * A camada determinística inteira é ancorada em PROSA e os achados numéricos do
 * benchmark moram em TABELA. `ExtractedPdfPage` era `{ page, text }` e o
 * `transform[4]`/`[5]` de cada item ia para o lixo.
 *
 *   node scripts/test-tabela-do-pdf.ts   (== npm run test:tabela-do-pdf)
 */
import assert from "node:assert/strict";

import { linhasDaPagina } from "../lib/tabela-do-pdf.ts";
import type { ItemDeTexto } from "../lib/texto-do-pdf.ts";

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

/** Item com corpo de fonte 10, na posição (x, y) e com a largura medida. */
function item(str: string, x: number, y: number, largura = str.length * 5): ItemDeTexto {
  return { str, transform: [10, 0, 0, 10, x, y], width: largura, height: 10 };
}

test("itens no mesmo y viram uma linha só", () => {
  const linhas = linhasDaPagina([item("AMBIENTE", 50, 700), item("AREA", 300, 700)]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].itens.length, 2);
});

test("degrau no y abre linha nova", () => {
  const linhas = linhasDaPagina([
    item("AMBIENTE", 50, 700),
    item("Sala 1", 50, 680),
    item("Sala 2", 50, 660),
  ]);
  assert.equal(linhas.length, 3);
});

test("o marcador hasEOL do pdf.js também fecha a linha", () => {
  const linhas = linhasDaPagina([
    item("Sala 1", 50, 700),
    { str: "", transform: [10, 0, 0, 10, 0, 700], width: 0, height: 10, hasEOL: true },
    item("Sala 2", 50, 700),
  ]);
  assert.equal(linhas.length, 2);
});

test("item vazio sem hasEOL é descartado, não vira linha", () => {
  const linhas = linhasDaPagina([
    item("Sala 1", 50, 700),
    { str: "", transform: [10, 0, 0, 10, 0, 700], width: 0, height: 10 },
    item("Sala 2", 200, 700),
  ]);
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].itens.length, 2);
});

test("página vazia não quebra", () => {
  assert.deepEqual(linhasDaPagina([]), []);
});

console.log(`\n${passed} teste(s) de tabela do PDF OK`);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-tabela-do-pdf.ts; echo "exit=$?"`
Expected: FALHA — `Cannot find module .../lib/tabela-do-pdf.ts` (`exit=1`).

- [ ] **Step 3: Exportar `corpoDaFonte`**

Em `lib/texto-do-pdf.ts`, trocar `function corpoDaFonte(` por `export function corpoDaFonte(` e acrescentar acima:

```ts
/**
 * O corpo da fonte do item, em unidades do PDF.
 *
 * Exportada porque `tabela-do-pdf.ts` mede vão de coluna na mesma unidade em que
 * este módulo mede vão de palavra. Duas medidas do mesmo corpo, calculadas por
 * dois lugares diferentes, é como se cria divergência silenciosa entre a linha
 * que a extração vê e a coluna que a tabela vê.
 */
```

- [ ] **Step 4: Write minimal implementation**

Create `lib/tabela-do-pdf.ts`:

```ts
/**
 * A GRADE DAS TABELAS, reconstruída das coordenadas.
 *
 * Puro de propósito: recebe os itens já extraídos, não importa o pdf.js. É o que
 * permite testá-lo em node cru (`scripts/test-tabela-do-pdf.ts`), com fixtures
 * de coordenadas escritas à mão.
 *
 * Existe porque a camada determinística da auditoria é toda ancorada em PROSA e
 * os achados numéricos moram em TABELA — `runDeclaredTotalAreaRule` exige a
 * frase "área total construída" logo antes do número, e numa célula não há
 * frase nenhuma.
 */
import { corpoDaFonte, mudouDeLinha, type ItemDeTexto } from "./texto-do-pdf.ts";

/** Uma linha visual da página: os itens que dividem o mesmo `y`. */
export type LinhaDaPagina = { itens: ItemDeTexto[] };

/**
 * Agrupa os itens da página em linhas, pela MESMA medida que a extração usa
 * para decidir quebra de linha. Se divergissem, a tabela veria linhas que o
 * texto não vê.
 */
export function linhasDaPagina(items: ItemDeTexto[]): LinhaDaPagina[] {
  const linhas: LinhaDaPagina[] = [];
  let atual: ItemDeTexto[] = [];
  let anterior: ItemDeTexto | null = null;

  const fechar = () => {
    if (atual.length > 0) linhas.push({ itens: atual });
    atual = [];
    anterior = null;
  };

  for (const item of items) {
    /*
     * O pdf.js marca fim de linha num item VAZIO. Ele não escreve nada, então
     * não entra na linha; mas descartá-lo sem olhar jogaria fora a única marca
     * de quebra que alguns PDFs emitem.
     */
    if (!item.str) {
      if (item.hasEOL) fechar();
      continue;
    }

    if (anterior && mudouDeLinha(anterior, item)) fechar();

    atual.push(item);
    anterior = item;
  }

  fechar();
  return linhas;
}

/** O `x` onde o item começa. */
export function inicioDoItem(item: ItemDeTexto): number {
  return item.transform?.[4] ?? 0;
}

/** O `x` onde o item termina. */
export function fimDoItem(item: ItemDeTexto): number {
  return inicioDoItem(item) + (item.width ?? 0);
}

/** O corpo de fonte representativo de uma linha — o do primeiro item que tiver um. */
export function corpoDaLinha(linha: LinhaDaPagina): number {
  for (const item of linha.itens) {
    const corpo = corpoDaFonte(item);
    if (corpo > 0) return corpo;
  }
  return 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node scripts/test-tabela-do-pdf.ts && echo OK`
Expected: `OK`, 5 testes.

- [ ] **Step 6: Registrar o script**

Em `package.json`, ao lado de `"test:aviso-gravacao"`:

```json
    "test:tabela-do-pdf": "node scripts/test-tabela-do-pdf.ts",
```

- [ ] **Step 7: Verificar que a extração não regrediu**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-texto-do-pdf.ts && echo OK
```
Expected: `OK`. O `test-texto-do-pdf.ts` é o guarda de que exportar `corpoDaFonte` não mexeu em nada.

- [ ] **Step 8: Commit**

```bash
git add lib/texto-do-pdf.ts lib/tabela-do-pdf.ts scripts/test-tabela-do-pdf.ts package.json
git commit -m "tabela: os itens da pagina viram linhas, pela mesma medida da extracao"
```

---

### Task 2: Linhas viram tabela

O coração do plano. **Nenhuma linha declara que é tabela** — a tabela se identifica sozinha, pelas fronteiras que se repetem.

**Files:**
- Modify: `lib/tabela-do-pdf.ts`
- Modify: `scripts/test-tabela-do-pdf.ts`

**Interfaces:**
- Consumes: `linhasDaPagina`, `corpoDaLinha`, `inicioDoItem`, `fimDoItem` da Task 1.
- Produces: `type Tabela = { pagina: number; linhas: string[][] }` e `tabelasDaPagina(items: ItemDeTexto[], pagina: number): Tabela[]`.

- [ ] **Step 1: Write the failing test**

Acrescentar a `scripts/test-tabela-do-pdf.ts` (e ao import: `tabelasDaPagina`):

```ts
/** Uma linha de tabela: textos nas posições x dadas, todos no mesmo y. */
function linhaEm(y: number, celulas: [string, number][]): ItemDeTexto[] {
  return celulas.map(([texto, x]) => item(texto, x, y));
}

test("grade limpa de 3 colunas vira tabela", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["AMBIENTE", 50], ["AREA", 300], ["PISO", 450]]),
      ...linhaEm(680, [["Sala 1", 50], ["32,50", 300], ["Ceramica", 450]]),
      ...linhaEm(660, [["Sala 2", 50], ["28,10", 300], ["Ceramica", 450]]),
      ...linhaEm(640, [["TOTAL", 50], ["60,60", 300]]),
    ],
    45,
  );
  assert.equal(tabelas.length, 1);
  assert.equal(tabelas[0].pagina, 45);
  assert.equal(tabelas[0].linhas.length, 4);
  assert.deepEqual(tabelas[0].linhas[1], ["Sala 1", "32,50", "Ceramica"]);
});

test("celula vazia no meio NAO desmancha a tabela", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["AMBIENTE", 50], ["AREA", 300], ["PISO", 450]]),
      ...linhaEm(680, [["Sala 1", 50], ["Ceramica", 450]]),
      ...linhaEm(660, [["Sala 2", 50], ["28,10", 300], ["Ceramica", 450]]),
      ...linhaEm(640, [["Sala 3", 50], ["11,00", 300], ["Ceramica", 450]]),
    ],
    1,
  );
  assert.equal(tabelas.length, 1);
  assert.equal(tabelas[0].linhas.length, 4);
});

test("PROSA CORRIDA NAO E TABELA — o falso positivo estrutural", () => {
  /*
   * Prosa justificada tem vãos largos, mas em x DIFERENTE a cada linha. É essa
   * discordância que a torna auto-excluída, e é por isso que a regra não precisa
   * de ninguém declarando onde a tabela começa.
   */
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["O", 50], ["memorial", 90], ["descreve", 210]]),
      ...linhaEm(680, [["a", 50], ["execucao", 130], ["dos", 280]]),
      ...linhaEm(660, [["servicos", 50], ["previstos", 175], ["em", 330]]),
    ],
    1,
  );
  assert.deepEqual(tabelas, []);
});

test("uma linha isolada nao e tabela", () => {
  const tabelas = tabelasDaPagina(linhaEm(700, [["A", 50], ["B", 300]]), 1);
  assert.deepEqual(tabelas, []);
});

test("numero com milhar e decimal NAO e partido em duas celulas", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["AMBIENTE", 50], ["AREA", 300]]),
      ...linhaEm(680, [["Bloco A", 50], ["4.530,98", 300]]),
      ...linhaEm(660, [["Bloco B", 50], ["1.200,00", 300]]),
    ],
    1,
  );
  assert.equal(tabelas[0].linhas[1][1], "4.530,98");
});

test("duas tabelas separadas por prosa saem como duas", () => {
  const tabelas = tabelasDaPagina(
    [
      ...linhaEm(700, [["A", 50], ["1", 300]]),
      ...linhaEm(680, [["B", 50], ["2", 300]]),
      ...linhaEm(660, [["C", 50], ["3", 300]]),
      ...linhaEm(620, [["Texto corrido explicando o quadro acima.", 50]]),
      ...linhaEm(580, [["D", 50], ["4", 300]]),
      ...linhaEm(560, [["E", 50], ["5", 300]]),
      ...linhaEm(540, [["F", 50], ["6", 300]]),
    ],
    1,
  );
  assert.equal(tabelas.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-tabela-do-pdf.ts; echo "exit=$?"`
Expected: FALHA — `tabelasDaPagina` não existe (`exit=1`).

- [ ] **Step 3: Write minimal implementation**

Acrescentar a `lib/tabela-do-pdf.ts`:

```ts
/**
 * O vão horizontal, em corpos de fonte, a partir do qual duas palavras estão em
 * COLUNAS diferentes e não só separadas por espaço.
 *
 * `texto-do-pdf.ts` trata espaço entre palavras em 0,15 do corpo. 1,5 é dez
 * vezes isso: fica muito acima do espaço largo da prosa justificada e bem
 * abaixo do recuo típico entre colunas de um quadro.
 *
 * PLAUSÍVEL, NÃO MEDIDO — não há PDF real nesta máquina para calibrar. Ver o
 * risco 2 da spec.
 */
const VAO_DE_COLUNA = 1.5;

/** Quanto duas fronteiras podem diferir em `x` e ainda serem a mesma coluna. */
const TOLERANCIA_DE_FRONTEIRA = 0.8;

/**
 * Quantas linhas consecutivas precisam concordar para virar tabela.
 *
 * Três, e não duas: duas linhas concordando numa fronteira acontece por acaso
 * em prosa justificada. Três, não.
 */
const MIN_LINHAS_DA_TABELA = 3;

/** Quantas linhas precisam sustentar uma fronteira para ela valer como coluna. */
const MIN_APOIO_DA_FRONTEIRA = 2;

/** Uma tabela reconstruída: linhas de células, sem semântica nenhuma. */
export type Tabela = { pagina: number; linhas: string[][] };

/**
 * Os `x` onde a linha tem um salto grande o bastante para ser troca de coluna.
 * A fronteira fica no MEIO do vão — assim ela não pertence a nenhum dos lados.
 */
function fronteirasDaLinha(linha: LinhaDaPagina): number[] {
  const fronteiras: number[] = [];

  for (let i = 1; i < linha.itens.length; i += 1) {
    const anterior = linha.itens[i - 1];
    const proximo = linha.itens[i];
    const corpo = corpoDaFonte(anterior) || corpoDaFonte(proximo);
    if (corpo <= 0) continue;

    const vao = inicioDoItem(proximo) - fimDoItem(anterior);
    if (vao >= corpo * VAO_DE_COLUNA) {
      fronteiras.push((fimDoItem(anterior) + inicioDoItem(proximo)) / 2);
    }
  }

  return fronteiras;
}

/**
 * As fronteiras que se REPETEM entre as linhas de um bloco.
 *
 * É aqui que a tabela se identifica sozinha. Prosa justificada também tem vãos
 * largos, mas em `x` diferente a cada linha — ela não sustenta fronteira
 * nenhuma, e por isso não precisa de exclusão explícita.
 */
function fronteirasDoBloco(linhas: LinhaDaPagina[], corpo: number): number[] {
  const candidatas: { x: number; apoio: Set<number> }[] = [];

  linhas.forEach((linha, indice) => {
    for (const x of fronteirasDaLinha(linha)) {
      const existente = candidatas.find(
        (c) => Math.abs(c.x - x) <= corpo * TOLERANCIA_DE_FRONTEIRA,
      );
      if (existente) {
        existente.apoio.add(indice);
        continue;
      }
      candidatas.push({ x, apoio: new Set([indice]) });
    }
  });

  return candidatas
    .filter((c) => c.apoio.size >= MIN_APOIO_DA_FRONTEIRA)
    .map((c) => c.x)
    .sort((a, b) => a - b);
}

/** Corta a linha nas fronteiras dadas. Célula sem item nenhum vira "". */
function celulasDaLinha(linha: LinhaDaPagina, fronteiras: number[]): string[] {
  const celulas: ItemDeTexto[][] = Array.from({ length: fronteiras.length + 1 }, () => []);

  for (const item of linha.itens) {
    const x = inicioDoItem(item);
    let coluna = 0;
    while (coluna < fronteiras.length && x >= fronteiras[coluna]) coluna += 1;
    celulas[coluna].push(item);
  }

  /*
   * Dentro da célula vale a costura NORMAL da extração — é ela que impede
   * "4.530,98" de virar duas palavras quando o gerador do PDF corta o item no
   * separador de milhar.
   */
  return celulas.map((itens) => textoDosItens(itens).trim());
}

export function tabelasDaPagina(items: ItemDeTexto[], pagina: number): Tabela[] {
  const linhas = linhasDaPagina(items);
  const tabelas: Tabela[] = [];

  let bloco: LinhaDaPagina[] = [];

  const fechar = () => {
    if (bloco.length >= MIN_LINHAS_DA_TABELA) {
      const corpo = corpoDaLinha(bloco[0]);
      const fronteiras = corpo > 0 ? fronteirasDoBloco(bloco, corpo) : [];
      if (fronteiras.length > 0) {
        tabelas.push({
          pagina,
          linhas: bloco.map((linha) => celulasDaLinha(linha, fronteiras)),
        });
      }
    }
    bloco = [];
  };

  for (const linha of linhas) {
    /*
     * Linha sem vão nenhum não participa de tabela — e FECHA o bloco. É o que
     * separa dois quadros interrompidos por um parágrafo de texto corrido.
     */
    if (fronteirasDaLinha(linha).length === 0) {
      fechar();
      continue;
    }
    bloco.push(linha);
  }

  fechar();
  return tabelas;
}
```

Acrescentar `textoDosItens` ao import de `./texto-do-pdf.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-tabela-do-pdf.ts && echo OK`
Expected: `OK`, 11 testes.

Se o caso "duas tabelas separadas por prosa" falhar com 1 em vez de 2: a linha de prosa do meio tem um vão largo o bastante para participar. **Não afrouxe o teste** — é o caso real. Ajuste `VAO_DE_COLUNA` para cima e registre o novo valor no comentário e na spec.

- [ ] **Step 5: Verificar**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-texto-do-pdf.ts && echo OK
```
Expected: `OK`.

- [ ] **Step 6: Commit**

```bash
git add lib/tabela-do-pdf.ts scripts/test-tabela-do-pdf.ts
git commit -m "tabela: a grade se identifica sozinha, pelas fronteiras que se repetem"
```

---

### Task 3: A extração passa a carregar as tabelas

**Files:**
- Modify: `lib/pdf-text.ts`

**Interfaces:**
- Consumes: `tabelasDaPagina`, `Tabela`.
- Produces: `ExtractedPdfPage.tabelas?: Tabela[]`.

- [ ] **Step 1: Acrescentar o campo, opcional**

Em `lib/pdf-text.ts`:

```ts
import { tabelasDaPagina, type Tabela } from "./tabela-do-pdf";

export type ExtractedPdfPage = {
  page: number;
  text: string;
  /**
   * As tabelas da página, se houver.
   *
   * OPCIONAL de propósito: sete módulos consomem este tipo, e nenhum precisa
   * mudar. Quem não sabe de tabela segue lendo `text` como sempre leu.
   */
  tabelas?: Tabela[];
};
```

- [ ] **Step 2: Preencher na extração**

No laço de `extractPdfText`, onde a página já tem `content.items`, acrescentar ao objeto empurrado em `pages`:

```ts
    const tabelas = tabelasDaPagina(content.items as ItemDeTexto[], pageNumber);
    pages.push({
      page: pageNumber,
      text,
      ...(tabelas.length > 0 ? { tabelas } : {}),
    });
```

(`ItemDeTexto` entra por `import type` de `./texto-do-pdf`. Manter o resto do objeto exatamente como está — este passo não pode mudar `text`.)

- [ ] **Step 3: Medir o custo**

O risco 3 da spec: a varredura roda em todo documento de 218 páginas.

```bash
node scripts/prova-texto-do-pdf.ts 2>&1 | tail -5 || node scripts/test-texto-do-pdf.ts
```

Se houver script de extração sobre PDF gerado (`prova:texto-do-pdf`), rodar com `time` antes e depois e anotar a diferença no commit. Se o custo passar de ~10% do tempo de extração, PARE e reporte em vez de seguir.

- [ ] **Step 4: Verificar**

```bash
npx tsc --noEmit && npm run lint && node scripts/test-tabela-do-pdf.ts && node scripts/test-texto-do-pdf.ts && echo OK
```
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-text.ts
git commit -m "extracao: a pagina passa a carregar as tabelas que ja estavam nas coordenadas"
```

---

### Task 4: A regra finalmente lê a célula

**Files:**
- Modify: `lib/audit-coherence.ts` (`runDeclaredTotalAreaRule`)
- Modify: `scripts/audit-precision-recall.ts`

**Interfaces:**
- Consumes: `ExtractedPdfPage.tabelas`.
- Produces: nada novo. A regra continua devolvendo o mesmo achado.

- [ ] **Step 1: Write the failing test**

Em `scripts/audit-precision-recall.ts`, o `makeSource` monta `extracted` à mão — ele precisa aceitar tabelas. Trocar a assinatura para aceitar páginas ricas:

```ts
type PaginaDeTeste = string | { texto: string; tabelas?: { pagina: number; linhas: string[][] }[] };

function makeSource(fileName: string, fileType: string, pages: PaginaDeTeste[]): CrossDocumentSource {
  const extractedPages = pages.map((entrada, index) => {
    const pagina = index + 1;
    if (typeof entrada === "string") return { page: pagina, text: entrada };
    return {
      page: pagina,
      text: entrada.texto,
      ...(entrada.tabelas ? { tabelas: entrada.tabelas } : {}),
    };
  });
  // ... resto igual
}
```

E os casos novos:

```ts
  {
    /*
     * AUD-009/010/011 do benchmark do 084_25: 4.448,91 no texto contra
     * 4.530,98 na tabela. A regra existia e nao pegava, porque exige a FRASE
     * "area total construida" logo antes do numero — e numa celula nao ha frase.
     */
    name: "numerico: area declarada em prosa diverge do TOTAL da tabela",
    sources: [
      makeSource("memorial.pdf", "memorial", [
        "A area total construida da edificacao e de 4.448,91 m².",
        {
          texto: "Quadro de areas por ambiente.",
          tabelas: [
            {
              pagina: 2,
              linhas: [
                ["AMBIENTE", "AREA (m²)"],
                ["Bloco A", "2.100,00"],
                ["Bloco B", "2.430,98"],
                ["TOTAL", "4.530,98"],
              ],
            },
          ],
        },
      ]),
    ],
    expected: [{ label: "area prosa x tabela", needle: "4.448,91" }],
  },
```

E dois limpos:

```ts
  {
    /*
     * O GUARDA DO QUALIFICADOR. Tabela de area de PINTURA tambem tem TOTAL em
     * m², e compara-la com a area construida seria o "Escola Geral" outra vez:
     * um numero certo lido como se fosse outra coisa.
     */
    name: "LIMPO: TOTAL de tabela que NAO e quadro de areas nao entra",
    sources: [
      makeSource("pintura.pdf", "memorial", [
        "A area total construida da edificacao e de 4.448,91 m².",
        {
          texto: "Quantitativo de pintura.",
          tabelas: [
            {
              pagina: 2,
              linhas: [
                ["SERVICO", "QUANTIDADE (m²)"],
                ["Pintura acrilica", "8.200,00"],
                ["TOTAL", "8.200,00"],
              ],
            },
          ],
        },
      ]),
    ],
    expected: [],
  },
  {
    name: "LIMPO: TOTAL do quadro de areas BATE com a prosa",
    sources: [
      makeSource("bate.pdf", "memorial", [
        "A area total construida da edificacao e de 4.530,98 m².",
        {
          texto: "Quadro de areas.",
          tabelas: [
            {
              pagina: 2,
              linhas: [
                ["AMBIENTE", "AREA (m²)"],
                ["Bloco A", "2.100,00"],
                ["TOTAL", "4.530,98"],
              ],
            },
          ],
        },
      ]),
    ],
    expected: [],
  },
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/audit-precision-recall.ts 2>&1 | tail -8`
Expected: **FN=1** no caso da tabela. **Verificar o FN, não o exit code** — o limiar de 90% pode deixar passar com exit 0.

- [ ] **Step 3: Write minimal implementation**

Em `runDeclaredTotalAreaRule`, depois do laço que varre `page.text` e ainda dentro do `for (const page of extracted.pages)`:

```ts
    /*
     * A MESMA GRANDEZA, LIDA DA TABELA.
     *
     * Nenhuma comparação nova: o piso de plausibilidade, a tolerância de 0,5 m²
     * e o disparo em dois valores distintos já existem logo abaixo. A tabela é
     * só uma segunda fonte do mesmo fato — o que faltava era enxergá-la.
     */
    for (const tabela of page.tabelas ?? []) {
      if (!ehQuadroDeAreas(tabela)) continue;

      for (const linha of tabela.linhas) {
        if (!linha.some((celula) => /^\s*total\b/i.test(celula))) continue;

        for (const celula of linha) {
          const bruto = /^\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s*(?:m(?:²|2))?\s*$/.exec(celula);
          if (!bruto) continue;

          const value = parseAreaValue(bruto[1]);
          if (value === null || value < 10) continue;

          found.push({
            page: page.page,
            value,
            display: `${bruto[1]} m²`,
            evidence: `quadro de áreas, linha "${linha.join(" | ")}"`,
          });
          break;
        }
      }
    }
```

E a função do guarda, ao lado da regra:

```ts
/**
 * A tabela é um QUADRO DE ÁREAS DA EDIFICAÇÃO?
 *
 * É o guarda do qualificador, e a lição que a análise de arquitetura já tirou do
 * Ledger, aplicada antes de o Ledger existir: estruturar sem qualificar é
 * fábrica de falso positivo. Uma tabela de área de PINTURA também fecha com
 * TOTAL em m², e compará-la com a área construída produziria exatamente o
 * "Escola Geral" de novo — um número certo lido como se fosse outra coisa.
 *
 * Duas primeiras linhas porque quadro de áreas costuma abrir com um título que
 * ocupa a linha inteira antes do cabeçalho de colunas.
 */
function ehQuadroDeAreas(tabela: { linhas: string[][] }): boolean {
  const cabecalho = tabela.linhas.slice(0, 2).flat().join(" ");
  return /[áa]rea|ambiente|compartimento|depend[êe]ncia/i.test(cabecalho);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/audit-precision-recall.ts 2>&1 | tail -8`
Expected: **TP sobe em 1, FP=0, FN=0**, precisão e recall em 100%.

- [ ] **Step 5: Verificar a suíte inteira**

```bash
npx tsc --noEmit && npm run lint
falhas=0; for f in scripts/test-*.ts; do node "$f" >/dev/null 2>&1 || { echo "FALHOU: $f"; falhas=$((falhas+1)); }; done; echo "$falhas falha(s)"
```
Expected: `0 falha(s)`, tsc e lint limpos.

- [ ] **Step 6: Commit**

O commit precisa DECLARAR o limite, não deixá-lo implícito:

```bash
git add lib/audit-coherence.ts scripts/audit-precision-recall.ts
git commit -F - <<'EOF'
auditoria: a regra de area finalmente le a celula

AUD-009/010/011 do benchmark do 084_25: 4.448,91 no texto contra 4.530,98 na
tabela. `runDeclaredTotalAreaRule` existia e nao pegava, e o motivo estava
escrito no proprio comentario dela: a regra exige a FRASE "area total
construida" a ate 25 caracteres do numero, porque sem essa ancora ela pescava o
limite normativo "area total superior a 1.000 m2". A mesma ancora que a torna
precisa em prosa a torna cega em celula — la nao ha frase nenhuma antes do
numero.

NENHUMA LOGICA DE COMPARACAO NOVA. O piso de plausibilidade (< 10 m2), a
tolerancia de 0,5 m2 para nao acusar arredondamento e o disparo em dois valores
distintos ja existiam e ja eram testados. A tabela entra so como segunda fonte
do mesmo fato.

O GUARDA DO QUALIFICADOR e a licao que a analise de arquitetura ja tinha tirado
do Ledger, aplicada antes de o Ledger existir: estruturar sem qualificar e
fabrica de falso positivo. Tabela de area de PINTURA tambem fecha com TOTAL em
m2, e compara-la com a area construida produziria exatamente o "Escola Geral" de
novo — um numero certo lido como se fosse outra coisa. So entram tabelas que se
identificam como quadro de areas da edificacao.

LIMITE DECLARADO, e e o risco principal: as fixtures sao SINTETICAS. Nao ha PDF
do 084_25 nesta maquina, entao a grade foi provada contra coordenadas que eu
escrevi — e coordenadas que eu escrevo sao mais bem-comportadas que as de um
gerador real. A regra pode passar no teste e errar no documento. A cura e a
Fase 0.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Cobertura da spec

| Seção da spec | Task |
|---|---|
| §3 linhas por `y` | Task 1 |
| §3 fronteiras que se repetem | Task 2 |
| §3 recorte em células | Task 2, Step 3 (`celulasDaLinha`) |
| §3 `ExtractedPdfPage.tabelas?` | Task 3 |
| §3 regra alimentando o `found` | Task 4 |
| §3 guarda do qualificador | Task 4, `ehQuadroDeAreas` |
| §2 constantes em fração do corpo | Task 2, Step 3 |
| §4 fixtures da grade | Tasks 1 e 2 |
| §4 fixtures do harness | Task 4, Step 1 |
| §5 risco 1 (fixtures sintéticas) | Task 4, Step 6 — declarado no commit |
| §5 risco 2 (calibragem) | Task 2, Step 4 — instrução explícita de não afrouxar o teste |
| §5 risco 3 (custo por página) | Task 3, Step 3 — com portão de PARE |
| §5 risco 4 (tabela entre páginas) | nenhuma task — limite conhecido, registrado na spec |
| §6 fora do escopo | nenhuma task, de propósito |
