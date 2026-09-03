# Pré-voo do anexo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** decidir se um PDF anexado é memorial ou prancha olhando o CONTEÚDO antes de ler, e perguntar quando nome e conteúdo discordarem — em vez de rotear pelo nome e descobrir o erro 31 folhas depois.

**Architecture:** um módulo PURO (`papel-do-anexo.ts`) que julga a partir de fatos, um invólucro de navegador (`pre-voo-do-anexo.ts`) que colhe os fatos com pdf.js, e um terceiro estado (`"indeciso"`) no chip do anexo. O julgamento REUSA `classificarPagina` de `server/nexo/selo-regiao.ts` — que não tem imports e já sabe o que é papel de prancha — em vez de reescrever a geometria com números novos.

**Tech Stack:** TypeScript, Next.js (App Router), pdfjs-dist (legacy build, no navegador), testes em `node` cru com type-stripping.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-09-03-pre-voo-do-anexo-design.md`.
- **Zero IA no roteamento.** Nenhuma tarefa deste plano chama modelo.
- **`server/nexo/parse-filename.ts` NÃO muda.** A convenção do escritório segue autoritativa onde ela fala.
- **Módulos puros importam com extensão `.ts`** (`from "../../../server/nexo/selo-regiao.ts"`) — é o que torna o módulo carregável pelo `node` cru, e a regra já está escrita no topo de `parse-filename.ts`.
- **Nada de terceira cópia do `loadPdfjs`.** Já existem duas (`selo-render.ts` e `pagina-muda-render.ts`); a Task 3 extrai uma e rewira UM consumidor. `selo-render.ts` fica como está — é o caminho da leitura de selo, e mexer nele não serve a este objetivo.
- **Limiar nenhum entra sem medição no acervo.** A Task 2 é o portão: os números da Task 1 são provisórios até ela.
- **Português nos identificadores de domínio**, como o resto de `modules/nexo/lib/`.
- **Rodar `npx tsc --noEmit` e `npx eslint <arquivos>` antes de cada commit.**

---

### Task 1: O julgamento puro — `papel-do-anexo.ts`

**Files:**
- Create: `modules/nexo/lib/papel-do-anexo.ts`
- Create: `scripts/test-papel-do-anexo.ts`
- Modify: `package.json` (registrar `test:papel-do-anexo`)

**Interfaces:**
- Consumes: `classificarPagina` e `TipoDePagina` de `server/nexo/selo-regiao.ts` (já existentes, módulo sem imports).
- Produces:
  - `interface MedidaDaPagina { tipo: TipoDePagina; chars: number; temTinta: boolean }`
  - `interface FatosDoAnexo { paginas: number; amostra: MedidaDaPagina[] }`
  - `type PapelPelaGeometria = "memorial" | "prancha" | "nao-sei"`
  - `type PapelDoAnexo = "memorial" | "prancha" | "indeciso"`
  - `function paginasDaAmostra(total: number): number[]`
  - `function papelPelaGeometria(fatos: FatosDoAnexo): PapelPelaGeometria`
  - `function decidirPapel(args: { pelaConvencao: NexoDocTipo; pelaGeometria: PapelPelaGeometria; fatos: FatosDoAnexo }): { papel: PapelDoAnexo; porque: string }`
  - constantes `PAGINAS_PARA_SER_DOCUMENTO`, `CHARS_DE_MEMORIAL`, `CHARS_DE_FOLHA_MUDA`

- [ ] **Step 1: Write the failing test**

Criar `scripts/test-papel-do-anexo.ts`:

```ts
/**
 * Teste do PAPEL DO ANEXO — memorial ou prancha, decidido antes de ler.
 *
 * O que se prova aqui é o julgamento com fatos de mentira: a geometria sozinha,
 * e depois a precedência contra o nome. Os limiares só valem depois da medição
 * no acervo (`npm run medir:papel`), e é por isso que cada um deles tem um caso
 * dos DOIS lados da fronteira.
 *
 *   node scripts/test-papel-do-anexo.ts   (== npm run test:papel-do-anexo)
 */
import assert from "node:assert/strict";

import {
  CHARS_DE_MEMORIAL,
  PAGINAS_PARA_SER_DOCUMENTO,
  decidirPapel,
  paginasDaAmostra,
  papelPelaGeometria,
  type FatosDoAnexo,
  type MedidaDaPagina,
} from "../modules/nexo/lib/papel-do-anexo.ts";

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

const pagina = (p: Partial<MedidaDaPagina> = {}): MedidaDaPagina => ({
  tipo: "capa",
  chars: 4000,
  temTinta: false,
  ...p,
});

const fatos = (paginas: number, amostra: MedidaDaPagina[]): FatosDoAnexo => ({
  paginas,
  amostra,
});

// ---------------------------------------------------------------- amostra

test("a amostra é espalhada, não as primeiras", () => {
  /*
   * Um memorial que abre com capa + sumário derruba a média das três primeiras,
   * e o 116_25_md_ter_pav já está no fio (1157 chars/pág, o menor do acervo).
   */
  const p = paginasDaAmostra(100);
  assert.deepEqual(p, [1, 50, 75]);
});

test("documento curto não repete página na amostra", () => {
  assert.deepEqual(paginasDaAmostra(1), [1]);
  assert.deepEqual(paginasDaAmostra(2), [1, 2]);
});

test("a amostra nunca sai do documento", () => {
  for (const total of [1, 2, 3, 5, 11, 258]) {
    for (const n of paginasDaAmostra(total)) {
      assert.ok(n >= 1 && n <= total, `página ${n} fora de 1..${total}`);
    }
  }
});

// ------------------------------------------------------------- geometria

test("uma folha com carimbo já prova que é prancha", () => {
  /*
   * `classificarPagina` só devolve "prancha" com âncoras de carimbo ou papel
   * grande. Uma folha basta: o resto do arquivo pode ser capa e separatriz.
   */
  const f = fatos(40, [pagina({ tipo: "prancha", chars: 500 }), pagina(), pagina()]);
  assert.equal(papelPelaGeometria(f), "prancha");
});

test("A4 de texto corrido e páginas demais: memorial", () => {
  const f = fatos(67, [pagina({ chars: 5533 }), pagina({ chars: 5100 }), pagina({ chars: 4800 })]);
  assert.equal(papelPelaGeometria(f), "memorial");
});

test("volume montado NÃO é memorial: texto ralo demais", () => {
  // Medido no acervo: volume montado vai a 570 chars/pág; memorial começa em 1157.
  const f = fatos(21, [pagina({ chars: 379 }), pagina({ chars: 500 }), pagina({ chars: 198 })]);
  assert.notEqual(papelPelaGeometria(f), "memorial");
});

test("capa e separatriz: prancha, sem pergunta", () => {
  assert.equal(papelPelaGeometria(fatos(1, [pagina({ chars: 21 })])), "prancha");
  assert.equal(papelPelaGeometria(fatos(2, [pagina({ chars: 244 }), pagina({ chars: 179 })])), "prancha");
});

test("folha MUDA não vira 'não é memorial' — vira pergunta", () => {
  /*
   * O 114_19: 31 folhas A4 com o texto DESENHADO (curva vetorial), 241
   * caracteres por página. Pela densidade seria "não é memorial", e chamar isso
   * de prancha repete o defeito de origem com outra roupa.
   */
  const f = fatos(31, [
    pagina({ chars: 90, temTinta: true }),
    pagina({ chars: 0, temTinta: true }),
    pagina({ chars: 120, temTinta: true }),
  ]);
  assert.equal(papelPelaGeometria(f), "nao-sei");
});

test("documento de tamanho médio sem sinal claro: não sei", () => {
  const f = fatos(5, [pagina({ chars: 700 }), pagina({ chars: 650 }), pagina({ chars: 800 })]);
  assert.equal(papelPelaGeometria(f), "nao-sei");
});

test("sem amostra nenhuma (PDF que não abriu): não sei", () => {
  assert.equal(papelPelaGeometria(fatos(0, [])), "nao-sei");
});

test("as fronteiras dos limiares são exatas", () => {
  const cheia = (chars: number) => [pagina({ chars }), pagina({ chars }), pagina({ chars })];
  assert.equal(
    papelPelaGeometria(fatos(PAGINAS_PARA_SER_DOCUMENTO, cheia(CHARS_DE_MEMORIAL))),
    "memorial",
  );
  assert.notEqual(
    papelPelaGeometria(fatos(PAGINAS_PARA_SER_DOCUMENTO - 1, cheia(CHARS_DE_MEMORIAL))),
    "memorial",
  );
  assert.notEqual(
    papelPelaGeometria(fatos(PAGINAS_PARA_SER_DOCUMENTO, cheia(CHARS_DE_MEMORIAL - 1))),
    "memorial",
  );
});

// ------------------------------------------------------------ precedência

const memorial = fatos(67, [pagina({ chars: 5533 }), pagina({ chars: 5100 }), pagina({ chars: 4800 })]);
const prancha = fatos(40, [pagina({ tipo: "prancha" }), pagina({ tipo: "prancha" }), pagina({ tipo: "prancha" })]);
const naoSei = fatos(5, [pagina({ chars: 700 })]);

test("nome que diz memorial ganha de qualquer geometria", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "memorial", pelaGeometria: "prancha", fatos: prancha }).papel,
    "memorial",
  );
});

test("nome confiante e geometria de acordo: segue o nome, calado", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "prancha", pelaGeometria: "prancha", fatos: prancha }).papel,
    "prancha",
  );
});

test("nome confiante e geometria sem opinião: segue o nome", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "capa", pelaGeometria: "nao-sei", fatos: naoSei }).papel,
    "prancha",
  );
});

test("nome diz prancha e a geometria diz memorial: PERGUNTA", () => {
  /*
   * O caso do kit de erros plantados: `02-contratual-e-escopo.pdf` é memorial e
   * o "02" do nome virou número de folha. Decidir sozinho por qualquer um dos
   * lados escolheria em silêncio contra evidência — e é isso que o estado
   * indeciso existe para não fazer.
   */
  const d = decidirPapel({ pelaConvencao: "prancha", pelaGeometria: "memorial", fatos: memorial });
  assert.equal(d.papel, "indeciso");
  assert.match(d.porque, /67/);
});

test("nome silencioso: a geometria decide", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "outro", pelaGeometria: "memorial", fatos: memorial }).papel,
    "memorial",
  );
  assert.equal(
    decidirPapel({ pelaConvencao: "outro", pelaGeometria: "prancha", fatos: prancha }).papel,
    "prancha",
  );
});

test("nome silencioso e geometria sem opinião: pergunta", () => {
  assert.equal(
    decidirPapel({ pelaConvencao: "outro", pelaGeometria: "nao-sei", fatos: naoSei }).papel,
    "indeciso",
  );
});

test("orçamento continua fora de escopo, sem virar pergunta", () => {
  /*
   * `foraDeEscopo` já é tratado antes do anexo virar trabalho. Aqui só se
   * garante que a geometria não o promove a memorial por ser A4 com texto.
   */
  assert.equal(
    decidirPapel({ pelaConvencao: "orcamento", pelaGeometria: "memorial", fatos: memorial }).papel,
    "prancha",
  );
});

test("todo indeciso vem com um porquê que cita o fato medido", () => {
  const d = decidirPapel({ pelaConvencao: "capa", pelaGeometria: "memorial", fatos: memorial });
  assert.equal(d.papel, "indeciso");
  assert.ok(d.porque.length > 20, "o porquê precisa dizer algo");
});

console.log(`\n${passed} teste(s) de papel do anexo OK`);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node scripts/test-papel-do-anexo.ts
```

Expected: `ERR_MODULE_NOT_FOUND` apontando `modules/nexo/lib/papel-do-anexo.ts`.

- [ ] **Step 3: Write minimal implementation**

Criar `modules/nexo/lib/papel-do-anexo.ts`:

```ts
/**
 * MEMORIAL OU PRANCHA — o julgamento, antes de ler o arquivo.
 *
 * O roteamento sempre foi pelo NOME: `isMemorialFile` é
 * `parseFilename(nome).tipo === "memorial"`, e a partição é binária — memorial
 * contra todo o resto. Arquivo que caia em `tipo: "outro"` vai para o fluxo de
 * prancha exatamente como uma prancha vai, e ninguém olha o conteúdo antes.
 *
 * Medido em 03/09/2026 sobre os 659 PDFs de `docs/`: a convenção acerta 656. O
 * nome só erra quando quem nomeou está FORA da convenção do escritório — o
 * arquivo que chega do cliente ou de outro escritório. Por isso a convenção
 * continua mandando onde ela fala, e a geometria entra como contestação, nunca
 * como substituta.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *
 * REUSA `classificarPagina`, e não reimplementa a geometria.
 *
 * "Papel grande", "tem carimbo" e "é índice" já estão decididos em
 * `server/nexo/selo-regiao.ts`, que é o mesmo julgamento que a leitura de selo
 * usa para pular folha. Escrever aqui um segundo `maiorLado > N` daria duas
 * noções de "isto é prancha" no mesmo repositório — e a discordância entre elas
 * apareceria como um arquivo que o chip chama de memorial e o leitor de selo
 * insiste em ler.
 *
 * O que sobra para este módulo é o que aquele não responde: quantas folhas o
 * documento tem, quanto texto cada uma carrega, e se a folha sem texto tem
 * tinta (folha muda) ou está vazia de verdade.
 *
 * PURO e sem I/O — roda no `node` cru, que é onde os limiares ficam prováveis
 * sem navegador. Quem colhe os fatos é `pre-voo-do-anexo.ts`.
 */
import type { NexoDocTipo } from "../../../server/nexo/parse-filename.ts";
import type { TipoDePagina } from "../../../server/nexo/selo-regiao.ts";

/** O que se mediu de UMA folha da amostra. */
export interface MedidaDaPagina {
  /** O veredito de `classificarPagina` — prancha / indice / capa / outra. */
  tipo: TipoDePagina;
  /** Caracteres extraíveis da folha. */
  chars: number;
  /** A folha manda desenhar (curva ou imagem) apesar de não ter texto. */
  temTinta: boolean;
}

export interface FatosDoAnexo {
  paginas: number;
  amostra: MedidaDaPagina[];
}

export type PapelPelaGeometria = "memorial" | "prancha" | "nao-sei";
export type PapelDoAnexo = "memorial" | "prancha" | "indeciso";

/**
 * A partir de quantas folhas um PDF deixa de ser capa/separatriz e vira
 * documento. Capa e separatriz do acervo têm 1 folha; o menor memorial tem 11.
 */
export const PAGINAS_PARA_SER_DOCUMENTO = 10;

/**
 * Caracteres por folha a partir dos quais o documento é texto corrido.
 *
 * MEDIDO no acervo (ver `npm run medir:papel`): o maior não-memorial é o volume
 * montado, com 570 chars/folha; o menor memorial é o `116_25_md_ter_pav`, com
 * 1157. O limiar mora no vão, e não numa das bordas — encostá-lo em 570 faria
 * o primeiro volume um pouco mais falante virar memorial.
 */
export const CHARS_DE_MEMORIAL = 1000;

/**
 * Abaixo disto a folha não tem texto para efeito de julgamento.
 *
 * O `114_19` tem 241 chars/folha porque o texto virou curva vetorial. Não é
 * folha em branco, e não é folha lida: é o caso que a densidade não alcança, e
 * o único desfecho honesto é perguntar.
 */
export const CHARS_DE_FOLHA_MUDA = 400;

const media = (n: readonly number[]) =>
  n.length === 0 ? 0 : n.reduce((s, v) => s + v, 0) / n.length;

/**
 * QUAIS FOLHAS MEDIR — primeira, meio e três quartos.
 *
 * As três PRIMEIRAS seriam o palpite óbvio e são o pior corte possível: um
 * memorial abre com capa, folha de assinaturas e sumário, que juntas carregam
 * menos texto que qualquer capítulo. O `116_25_md_ter_pav` já está a 1157
 * chars/folha na média geral; medido só no começo, ele cairia abaixo do limiar
 * e o documento inteiro seria roteado errado.
 *
 * Três folhas, e não cinco: cada uma custa um `getTextContent`, e o vão entre
 * volume (570) e memorial (1157) é largo o bastante para não precisar de mais
 * amostra. Documento curto devolve só as folhas que existem, sem repetir.
 */
export function paginasDaAmostra(total: number): number[] {
  if (total <= 0) return [];
  const candidatas = [1, Math.ceil(total / 2), Math.ceil((total * 3) / 4)];
  const vistas = new Set<number>();
  const saida: number[] = [];
  for (const n of candidatas) {
    const clamped = Math.min(Math.max(1, n), total);
    if (!vistas.has(clamped)) {
      vistas.add(clamped);
      saida.push(clamped);
    }
  }
  return saida;
}

/**
 * O que o CONTEÚDO diz, ignorando o nome do arquivo.
 *
 * A ordem das perguntas é a garantia, e é a mesma de `classificarPagina`: o
 * carimbo decide primeiro. Uma folha com carimbo prova o arquivo inteiro —
 * memorial nenhum tem selo de prancha —, e por isso ela vem antes da contagem
 * de texto, que é estatística.
 */
export function papelPelaGeometria(fatos: FatosDoAnexo): PapelPelaGeometria {
  if (fatos.amostra.length === 0) return "nao-sei";

  // Uma só basta: `classificarPagina` só diz "prancha" com âncoras de carimbo
  // ou papel grande, e nenhum dos dois acontece por acaso num memorial.
  if (fatos.amostra.some((p) => p.tipo === "prancha")) return "prancha";

  const chars = media(fatos.amostra.map((p) => p.chars));

  if (fatos.paginas >= PAGINAS_PARA_SER_DOCUMENTO) {
    if (chars >= CHARS_DE_MEMORIAL) return "memorial";
    /*
     * Folhas demais, texto de menos e tinta na folha: o texto está DESENHADO.
     * Ver [[lib/pagina-muda.ts]]. Aqui não se decide — pergunta-se.
     */
    if (chars < CHARS_DE_FOLHA_MUDA && fatos.amostra.some((p) => p.temTinta)) {
      return "nao-sei";
    }
    return "nao-sei";
  }

  /*
   * Documento curto e magro é capa, separatriz ou LD — o fluxo de prancha lida
   * com os três há muito tempo, e pular esses arquivos é o comportamento certo
   * dele. Perguntar aqui poria uma pergunta em toda montagem de volume.
   */
  if (fatos.paginas <= 2 && chars < CHARS_DE_MEMORIAL) return "prancha";

  return "nao-sei";
}

/** Os tipos de nome que afirmam "isto não é memorial". */
const NOME_DIZ_PRANCHA: readonly NexoDocTipo[] = [
  "prancha",
  "capa",
  "separatriz",
  "volume",
  "orcamento",
];

/**
 * O PAPEL FINAL, cruzando a convenção com o conteúdo.
 *
 * A regra em uma frase: **o nome é o palpite, a geometria pode contestar, e
 * contestação vira pergunta**. Nunca se troca um nome confiante em silêncio —
 * a convenção acerta 656 de 659, e sobrepô-la calado trocaria um erro raro e
 * visível por um erro raro e invisível.
 */
export function decidirPapel(args: {
  pelaConvencao: NexoDocTipo;
  pelaGeometria: PapelPelaGeometria;
  fatos: FatosDoAnexo;
}): { papel: PapelDoAnexo; porque: string } {
  const { pelaConvencao, pelaGeometria, fatos } = args;

  if (pelaConvencao === "memorial") {
    return { papel: "memorial", porque: "O nome segue a convenção de memorial." };
  }

  if (NOME_DIZ_PRANCHA.includes(pelaConvencao)) {
    if (pelaGeometria === "memorial") {
      return {
        papel: "indeciso",
        porque:
          `O nome diz ${pelaConvencao}, mas são ${fatos.paginas} folhas de texto corrido — ` +
          "isso é o formato de um memorial.",
      };
    }
    return { papel: "prancha", porque: "O nome segue a convenção do escritório." };
  }

  // `outro`: o nome não afirma nada, e aí quem fala é o conteúdo.
  if (pelaGeometria === "memorial") {
    return {
      papel: "memorial",
      porque: `O nome não diz o tipo; são ${fatos.paginas} folhas de texto corrido.`,
    };
  }
  if (pelaGeometria === "prancha") {
    return { papel: "prancha", porque: "O nome não diz o tipo; a folha tem carimbo de prancha." };
  }
  return {
    papel: "indeciso",
    porque:
      `O nome não diz o tipo, e as ${fatos.paginas} folhas não se parecem nem com ` +
      "memorial nem com prancha.",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
node scripts/test-papel-do-anexo.ts
```

Expected: `20 teste(s) de papel do anexo OK`, sem `FALHOU`.

- [ ] **Step 5: Registrar o teste e conferir tipos e lint**

Em `package.json`, logo depois da linha de `"test:batimento"`, acrescentar:

```json
    "test:papel-do-anexo": "node scripts/test-papel-do-anexo.ts",
```

```bash
npx tsc --noEmit && npx eslint modules/nexo/lib/papel-do-anexo.ts scripts/test-papel-do-anexo.ts
```

Expected: os dois sem saída (exit 0).

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/lib/papel-do-anexo.ts scripts/test-papel-do-anexo.ts package.json
git commit -m "o papel do anexo vira julgamento puro, e reusa quem já sabe o que é prancha"
```

---

### Task 2: A medição no acervo — o portão dos limiares

**Files:**
- Create: `scripts/medir-papel-do-anexo.mjs`
- Modify: `modules/nexo/lib/papel-do-anexo.ts` (só os limiares e os comentários, se a medição pedir)
- Modify: `scripts/test-papel-do-anexo.ts` (idem)
- Modify: `package.json` (registrar `medir:papel`)

**Interfaces:**
- Consumes: `paginasDaAmostra`, `papelPelaGeometria`, `MedidaDaPagina`, `FatosDoAnexo` da Task 1; `parseFilename` e `classificarPagina` já existentes.
- Produces: nada de código para tarefas seguintes — produz os NÚMEROS que ficam nos comentários do módulo puro.

**Por que existe:** os limiares da Task 1 saíram de uma amostra de ~13 arquivos por tipo. `PISO_PARA_DESCONFIAR = 4` só ficou de pé porque foi medido nos 515 PDFs de prancha, e as duas primeiras regras candidatas — que pareciam óbvias — caíram na medição. Esta tarefa é esse portão.

- [ ] **Step 1: Escrever o medidor**

Criar `scripts/medir-papel-do-anexo.mjs`:

```js
/**
 * MEDE o julgamento de papel contra o acervo inteiro de `docs/`.
 *
 * Não é teste: é o instrumento que escolhe os limiares. Ele roda o MESMO
 * `papelPelaGeometria` que a produção roda — se reimplementasse a conta aqui,
 * mediria uma cópia, e um número sobre uma cópia dá confiança sobre código que
 * não é o que roda.
 *
 * O gabarito é o NOME (a convenção acerta 656 de 659), com as exceções
 * conhecidas listadas em `GABARITO_A_MAO` — os memoriais do kit de erros
 * plantados, cujo nome descreve o defeito e não o tipo.
 *
 *   npm run medir:papel
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { parseFilename } from "../server/nexo/parse-filename.ts";
import { classificarPagina } from "../server/nexo/selo-regiao.ts";
import { normalizarItens } from "../lib/coordenada-do-pdf.ts";
import {
  paginasDaAmostra,
  papelPelaGeometria,
} from "../modules/nexo/lib/papel-do-anexo.ts";

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const OPS = pdfjs.OPS;

/**
 * Os arquivos cujo NOME mente. Todos do kit de erros plantados: o nome descreve
 * o defeito plantado ("01-identidade-capa-x-corpo"), não o tipo do documento.
 */
const GABARITO_A_MAO = new Map([
  ["01-identidade-capa-x-corpo.pdf", "memorial"],
  ["02-contratual-e-escopo.pdf", "memorial"],
  ["03-quantitativos.pdf", "memorial"],
  ["04-normas-e-referencias.pdf", "memorial"],
  ["05-par-memorial.pdf", "memorial"],
  ["06-capa-ilegivel.pdf", "memorial"],
  ["07-sumario.pdf", "memorial"],
  ["08-tabela.pdf", "memorial"],
  ["relatorio-auditoria-seguranca.pdf", "fora-do-dominio"],
]);

function esperado(nome) {
  const aMao = GABARITO_A_MAO.get(nome);
  if (aMao) return aMao;
  const tipo = parseFilename(nome).tipo;
  if (tipo === "memorial") return "memorial";
  if (tipo === "outro") return "desconhecido";
  return "prancha";
}

function listarPdfs(raiz) {
  const saida = [];
  (function anda(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) anda(p);
      else if (e.name.toLowerCase().endsWith(".pdf")) saida.push(p);
    }
  })(raiz);
  return saida;
}

async function medirTinta(page) {
  try {
    const ops = await page.getOperatorList();
    const desenho = new Set([OPS.constructPath ?? -1]);
    const imagem = new Set([
      OPS.paintImageXObject ?? -1,
      OPS.paintJpegXObject ?? -1,
      OPS.paintImageMaskXObject ?? -1,
      OPS.paintInlineImageXObject ?? -1,
    ]);
    let d = 0;
    let i = 0;
    for (const op of ops.fnArray) {
      if (desenho.has(op)) d += 1;
      else if (imagem.has(op)) i += 1;
    }
    return d + i > 0;
  } catch {
    return false;
  }
}

async function colher(caminho) {
  const data = new Uint8Array(readFileSync(caminho));
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    const paginas = doc.numPages;
    const amostra = [];
    for (const n of paginasDaAmostra(paginas)) {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const brutos = content.items.filter((it) => it.transform && typeof it.str === "string");
      const itens = normalizarItens(
        brutos.map((it) => {
          const [x, y] = vp.convertToViewportPoint(it.transform[4], it.transform[5]);
          return { texto: it.str.trim(), x, y };
        }),
        { largura: vp.width, altura: vp.height },
      );
      const chars = brutos.reduce((s, it) => s + it.str.length, 0);
      amostra.push({
        tipo: classificarPagina({ largura: vp.width, altura: vp.height, itens }),
        chars,
        temTinta: chars < 400 ? await medirTinta(page) : false,
      });
    }
    return { paginas, amostra };
  } finally {
    await doc.destroy();
  }
}

const alvos = [
  ...listarPdfs("docs"),
  "scratchpad/ESCOLA_JOSE_GIASSI_REV_A.pdf",
  "tests/117_25_md_geral_a.pdf",
];

const matriz = new Map();
const erros = [];
let lidos = 0;

for (const caminho of alvos) {
  const nome = caminho.split(/[\\/]/).pop();
  try {
    const fatos = await colher(caminho);
    const disse = papelPelaGeometria(fatos);
    const devia = esperado(nome);
    const chave = `${devia} -> ${disse}`;
    matriz.set(chave, (matriz.get(chave) ?? 0) + 1);
    lidos += 1;
    const errou =
      (devia === "memorial" && disse === "prancha") ||
      (devia === "prancha" && disse === "memorial");
    if (errou) {
      erros.push({ nome, devia, disse, paginas: fatos.paginas, caminho: relative(".", caminho) });
    }
  } catch (e) {
    matriz.set("ILEGIVEL", (matriz.get("ILEGIVEL") ?? 0) + 1);
  }
}

console.log(`\nPDFs lidos: ${lidos} de ${alvos.length}\n`);
console.log("gabarito -> geometria");
for (const [k, v] of [...matriz].sort()) console.log(`  ${k.padEnd(28)} ${v}`);

console.log(`\nTROCAS DE LADO (memorial<->prancha): ${erros.length}`);
for (const e of erros) console.log(`  ${e.devia} virou ${e.disse}  pg=${e.paginas}  ${e.caminho}`);

if (erros.length > 0) process.exitCode = 1;
```

- [ ] **Step 2: Registrar e rodar**

Em `package.json`, ao lado dos outros `medir:` (ou logo depois de `test:papel-do-anexo`):

```json
    "medir:papel": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/medir-papel-do-anexo.mjs",
```

```bash
npm run medir:papel
```

Expected: a matriz impressa e **`TROCAS DE LADO: 0`**. `nao-sei` em qualquer quantidade é resultado aceitável — é uma pergunta, não um erro. O que reprova é memorial virar prancha ou o contrário.

- [ ] **Step 3: Ajustar os limiares, se e só se a medição pedir**

Se houver troca de lado, mexer em `PAGINAS_PARA_SER_DOCUMENTO`, `CHARS_DE_MEMORIAL` ou `CHARS_DE_FOLHA_MUDA` em `modules/nexo/lib/papel-do-anexo.ts`, rodar de novo até zerar, e **atualizar o comentário de cada constante com o número medido** (o menor memorial e o maior não-memorial do acervo real, não os do sample).

Se um limiar mudar, atualizar também os casos de fronteira em `scripts/test-papel-do-anexo.ts` — eles são escritos em termos das constantes, então devem continuar passando sem edição; se não passarem, é sinal de que a mudança quebrou uma regra e não só um número.

```bash
node scripts/test-papel-do-anexo.ts && npm run medir:papel
```

Expected: testes OK e `TROCAS DE LADO: 0`.

- [ ] **Step 4: Commit**

```bash
git add scripts/medir-papel-do-anexo.mjs modules/nexo/lib/papel-do-anexo.ts scripts/test-papel-do-anexo.ts package.json
git commit -m "os limiares do papel do anexo passam pelo acervo inteiro, não por uma amostra"
```

---

### Task 3: Um `loadPdfjs` só (para os dois consumidores novos)

**Files:**
- Create: `modules/nexo/lib/pdfjs-no-navegador.ts`
- Modify: `modules/nexo/lib/pagina-muda-render.ts` (remover as cópias privadas de `loadPdfjs` e `medirTinta`, importar do módulo novo)

**Interfaces:**
- Produces:
  - `type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs")`
  - `async function loadPdfjs(): Promise<PdfjsModule>`
  - `async function medirTinta(page, OPS): Promise<{ desenho: number; imagem: number } | undefined>`

**Por que:** `loadPdfjs` já existe duplicado em `selo-render.ts` e `pagina-muda-render.ts`. O pré-voo precisa dele e de `medirTinta`; uma terceira cópia seria a que envelhece sozinha. `selo-render.ts` fica de fora de propósito — é o caminho da leitura de selo, e o objetivo desta tarefa não justifica tocá-lo.

- [ ] **Step 1: Criar o módulo compartilhado**

Criar `modules/nexo/lib/pdfjs-no-navegador.ts`:

```ts
"use client";

/**
 * O pdf.js DO NAVEGADOR, carregado uma vez — e as medidas que não dependem de
 * desenhar nada.
 *
 * `loadPdfjs` morava privado em `pagina-muda-render.ts` e em `selo-render.ts`,
 * idêntico nos dois. Com o pré-voo do anexo precisando do mesmo carregamento e
 * da mesma medida de tinta, a terceira cópia seria a que um dia divergiria — e
 * a divergência apareceria como um worker configurado num caminho e não no
 * outro, que falha só depois do deploy.
 *
 * `selo-render.ts` NÃO foi rewirado, de propósito: é o caminho da leitura de
 * selo, e trocar o carregador dele não serve a nenhum objetivo em curso.
 */

export type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let pdfjsPromise: Promise<PdfjsModule> | null = null;

export async function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/legacy/build/pdf.worker.mjs",
        import.meta.url,
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

/**
 * QUANTO A FOLHA MANDA DESENHAR, fora o texto.
 *
 * É o sinal que separa a folha em branco da folha cujo texto virou curva
 * vetorial ou tira de imagem — as duas chegam como `text: ""`. Custa um reparse
 * do content stream, então só vale a pena na folha que já é magra.
 *
 * Devolve `undefined` quando o reparse falha: ausência de medida é diferente de
 * medida zero, e quem chama precisa poder distinguir.
 */
export async function medirTinta(
  page: { getOperatorList: () => Promise<{ fnArray: number[] | Uint8Array }> },
  OPS: Record<string, number>,
): Promise<{ desenho: number; imagem: number } | undefined> {
  try {
    const ops = await page.getOperatorList();
    const desenhoOps = new Set([OPS.constructPath ?? -1]);
    const imagemOps = new Set([
      OPS.paintImageXObject ?? -1,
      OPS.paintJpegXObject ?? -1,
      OPS.paintImageMaskXObject ?? -1,
      OPS.paintInlineImageXObject ?? -1,
    ]);
    let desenho = 0;
    let imagem = 0;
    for (const op of ops.fnArray) {
      if (desenhoOps.has(op)) desenho += 1;
      else if (imagemOps.has(op)) imagem += 1;
    }
    return { desenho, imagem };
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 2: Rewirar `pagina-muda-render.ts`**

Em `modules/nexo/lib/pagina-muda-render.ts`:

1. Apagar o bloco `type PdfjsModule = ...` + `let pdfjsPromise` + `async function loadPdfjs() { ... }` (linhas ~38–52).
2. Apagar `async function medirTinta(...) { ... }` (linhas ~129–152).
3. Acrescentar o import junto dos outros imports locais:

```ts
import { loadPdfjs, medirTinta, type PdfjsModule } from "./pdfjs-no-navegador";
```

Se `PdfjsModule` não for mais referenciado no arquivo, importar só as duas funções — o lint acusa import não usado.

- [ ] **Step 3: Provar que a folha muda não regrediu**

```bash
node scripts/test-pagina-muda.ts && npx tsc --noEmit && npx eslint modules/nexo/lib/pdfjs-no-navegador.ts modules/nexo/lib/pagina-muda-render.ts
```

Expected: testes de página muda OK, `tsc` exit 0, lint sem saída.

- [ ] **Step 4: Commit**

```bash
git add modules/nexo/lib/pdfjs-no-navegador.ts modules/nexo/lib/pagina-muda-render.ts
git commit -m "o carregador do pdf.js para de ter uma terceira cópia antes de ganhá-la"
```

---

### Task 4: Colher os fatos no navegador — `pre-voo-do-anexo.ts`

**Files:**
- Create: `modules/nexo/lib/pre-voo-do-anexo.ts`

**Interfaces:**
- Consumes: `loadPdfjs`/`medirTinta` (Task 3); `paginasDaAmostra`, `decidirPapel`, `papelPelaGeometria`, `FatosDoAnexo`, `PapelDoAnexo` (Task 1); `classificarPagina` (`server/nexo/selo-regiao`), `normalizarItens` (`lib/coordenada-do-pdf`), `parseFilename` (`server/nexo/parse-filename`).
- Produces:
  - `interface PreVooDoAnexo { file: File; papel: PapelDoAnexo; porque: string; fatos: FatosDoAnexo }`
  - `async function preVoar(file: File): Promise<PreVooDoAnexo>`
  - `async function preVoarLote(files: File[]): Promise<PreVooDoAnexo[]>`

- [ ] **Step 1: Escrever o módulo**

Criar `modules/nexo/lib/pre-voo-do-anexo.ts`:

```ts
"use client";

/**
 * O PRÉ-VOO — olhar o arquivo antes de decidir para onde ele vai.
 *
 * Três folhas de `getTextContent`, sem render, sem rede e sem modelo. É o que
 * separa "o nome diz prancha" de "isto tem 67 folhas de texto corrido", e é
 * barato o bastante para rodar em todo PDF que entra.
 *
 * A DECISÃO não mora aqui: mora em [[papel-do-anexo.ts]], que é puro e
 * provável no `node` cru. Aqui só se colhe o fato — a divisão é a mesma de
 * `attachments-core.ts` e `estado-do-anexo.ts`, e existe porque limiar que só
 * pode ser conferido abrindo o navegador não é conferido.
 */

import { normalizarItens } from "@/lib/coordenada-do-pdf";
import { classificarPagina } from "@/server/nexo/selo-regiao";
import { parseFilename } from "@/server/nexo/parse-filename";

import {
  decidirPapel,
  paginasDaAmostra,
  papelPelaGeometria,
  type FatosDoAnexo,
  type MedidaDaPagina,
  type PapelDoAnexo,
} from "./papel-do-anexo";
import { loadPdfjs, medirTinta } from "./pdfjs-no-navegador";

export interface PreVooDoAnexo {
  file: File;
  papel: PapelDoAnexo;
  /** A frase que o chip mostra quando o papel é `indeciso`. */
  porque: string;
  fatos: FatosDoAnexo;
}

/** Abaixo disto vale medir a tinta: a folha é magra o bastante para ser muda. */
const CHARS_PARA_MEDIR_TINTA = 400;

async function colherFatos(file: File): Promise<FatosDoAnexo> {
  const pdfjs = await loadPdfjs();
  const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  // Lido ANTES do `destroy()`: depois dele o documento está desmontado.
  const paginas = doc.numPages;

  try {
    const amostra: MedidaDaPagina[] = [];
    for (const n of paginasDaAmostra(paginas)) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const brutos = content.items.filter(
        (it): it is typeof it & { str: string; transform: number[] } =>
          "str" in it && typeof it.str === "string" && Array.isArray(it.transform),
      );

      const itens = normalizarItens(
        brutos.map((it) => {
          const [x, y] = viewport.convertToViewportPoint(it.transform[4], it.transform[5]);
          return { texto: it.str.trim(), x, y };
        }),
        { largura: viewport.width, altura: viewport.height },
      );

      const chars = brutos.reduce((soma, it) => soma + it.str.length, 0);
      const tinta =
        chars < CHARS_PARA_MEDIR_TINTA && OPS ? await medirTinta(page, OPS) : undefined;

      amostra.push({
        tipo: classificarPagina({
          largura: viewport.width,
          altura: viewport.height,
          itens,
        }),
        chars,
        temTinta: Boolean(tinta && tinta.desenho + tinta.imagem > 0),
      });
    }
    return { paginas, amostra };
  } finally {
    await doc.destroy();
  }
}

/**
 * O pré-voo de UM arquivo.
 *
 * PDF QUE NÃO ABRE NÃO VIRA PRANCHA. A amostra sai vazia, `papelPelaGeometria`
 * devolve "nao-sei" e o arquivo cai em `indeciso` — que pergunta. O modo de
 * falha antigo era o oposto: qualquer coisa que não fosse memorial pelo nome ia
 * calada para o leitor de selo, e é esse silêncio que este módulo existe para
 * acabar.
 */
export async function preVoar(file: File): Promise<PreVooDoAnexo> {
  const pelaConvencao = parseFilename(file.name).tipo;

  let fatos: FatosDoAnexo = { paginas: 0, amostra: [] };
  try {
    fatos = await colherFatos(file);
  } catch {
    // Fatos vazios: a decisão abaixo cai em `indeciso` por conta própria.
  }

  const { papel, porque } = decidirPapel({
    pelaConvencao,
    pelaGeometria: papelPelaGeometria(fatos),
    fatos,
  });

  return { file, papel, porque, fatos };
}

/**
 * O lote inteiro, um de cada vez.
 *
 * SEM `Promise.all`: cada pré-voo abre um PDF de até 25 MB, e oito ao mesmo
 * tempo é exatamente o pico de memória que a leitura de selo já limita a três.
 * O ganho de paralelizar aqui seria de décimos de segundo; o custo seria a aba
 * travando no lote grande, que é justamente o lote em que isto importa.
 */
export async function preVoarLote(files: File[]): Promise<PreVooDoAnexo[]> {
  const saida: PreVooDoAnexo[] = [];
  for (const file of files) saida.push(await preVoar(file));
  return saida;
}
```

- [ ] **Step 2: Conferir tipos e lint**

```bash
npx tsc --noEmit && npx eslint modules/nexo/lib/pre-voo-do-anexo.ts
```

Expected: exit 0 nos dois. Se `normalizarItens` reclamar do formato do ponto, conferir a assinatura em `lib/coordenada-do-pdf.ts:38` e ajustar o objeto passado — não mudar a assinatura dela.

- [ ] **Step 3: Commit**

```bash
git add modules/nexo/lib/pre-voo-do-anexo.ts
git commit -m "o anexo passa a ser medido antes de ser roteado"
```

---

### Task 5: O terceiro estado do chip

**Files:**
- Modify: `modules/nexo/components/NexoChat.tsx:44-59` (o tipo `Attachment`) e `:865-970` (o chip)
- Modify: `modules/nexo/components/NexoWorkspace.tsx:984-1050` (o intake) e `:520-570` (a troca de papel)

**Interfaces:**
- Consumes: `preVoarLote`, `PreVooDoAnexo` (Task 4).
- Produces: `Attachment.papel` passa a aceitar `"indeciso"`; `Attachment.porque?: string`.

- [ ] **Step 1: Abrir o tipo `Attachment`**

Em `modules/nexo/components/NexoChat.tsx`, trocar o campo `papel` (linha ~58) por:

```ts
  /**
   * Papel do anexo — do nome, corrigido pelo PRÉ-VOO, e corrigível à mão.
   *
   * A partição usava só a convenção de nome (`md`/`memorial`). Um memorial
   * batizado fora dela virava prancha, ia para o OCR de selo e a auditoria
   * nunca era oferecida — sem erro, sem aviso, sem saída.
   *
   * `indeciso` é o estado que faltava: o nome diz uma coisa, o conteúdo diz
   * outra, e escolher em silêncio seria trocar um erro visível por um invisível.
   * Ver [[modules/nexo/lib/papel-do-anexo.ts]].
   */
  papel?: "memorial" | "prancha" | "indeciso";
  /** Por que o papel é indeciso — a frase que o chip mostra. */
  porque?: string;
```

- [ ] **Step 2: Desenhar o estado no chip**

Em `modules/nexo/components/NexoChat.tsx`, logo ANTES do bloco `{estado.tipo === "nao-e-prancha" && (`, acrescentar:

```tsx
      {/*
        MEMORIAL OU PRANCHA? — a pergunta, antes de qualquer leitura.

        O `nao-e-prancha` logo abaixo é o mesmo problema descoberto TARDE: ele
        só acorda depois de as 31 folhas terem sido puladas. Este aqui é o
        pré-voo, e por isso ele aparece antes de o arquivo ser lido — e o
        arquivo NÃO é lido enquanto ele estiver aceso.

        Âmbar, e não teal: é pendência, e o teal é do interativo (DESIGN.md §2).
      */}
      {att.papel === "indeciso" && (
        <span
          className="font-mono text-[10px] uppercase tracking-[0.07em]"
          style={{ color: "var(--status-warning)" }}
          title={
            att.porque
              ? `${att.porque} Escolha ao lado para eu poder continuar.`
              : "Não deu para saber se este PDF é o memorial ou uma prancha."
          }
        >
          memorial ou prancha?
        </span>
      )}
```

- [ ] **Step 3: Oferecer as DUAS saídas no indeciso**

Ainda em `NexoChat.tsx`, o botão de troca hoje é um só, e o verbo vem de `viraMemorial = att.papel === "prancha"` (linha ~868). No indeciso não há papel atual, então um botão só esconderia metade da resposta. Trocar o bloco `{att.papel && onTrocarPapel && estado.tipo !== "lido" && (...)}` por:

```tsx
      {att.papel === "indeciso" && onDefinirPapel && estado.tipo !== "lido" ? (
        <>
          <button
            type="button"
            onClick={() => onDefinirPapel(att.id, "memorial")}
            title="Tratar este PDF como o memorial (auditar em vez de ler o selo)"
            className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            tratar como memorial
          </button>
          <button
            type="button"
            onClick={() => onDefinirPapel(att.id, "prancha")}
            title="Tratar este PDF como prancha (ler o selo)"
            className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            tratar como prancha
          </button>
        </>
      ) : att.papel && att.papel !== "indeciso" && onTrocarPapel && estado.tipo !== "lido" ? (
        <button
          type="button"
          onClick={() => onTrocarPapel(att.id)}
          title={
            viraMemorial
              ? "Tratar este PDF como o memorial (auditar em vez de ler o selo)"
              : "Tratar este PDF como prancha (ler o selo)"
          }
          className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          {viraMemorial ? "tratar como memorial" : "tratar como prancha"}
        </button>
      ) : null}
```

E declarar a prop nova ao lado de `onTrocarPapelAnexo` na assinatura de `NexoChat` e no tipo de props:

```ts
  /** Define o papel de um anexo INDECISO. Diferente de trocar: aqui não há papel atual. */
  onDefinirPapelAnexo?: (id: string, papel: "memorial" | "prancha") => void;
```

repassando-a até o componente do chip como `onDefinirPapel`, no mesmo caminho que `onTrocarPapel` já percorre (e por `NexoCopilot.tsx`, que reexporta os tipos).

- [ ] **Step 4: Ligar o pré-voo no intake**

Em `modules/nexo/components/NexoWorkspace.tsx`, no bloco que hoje começa em `// Preview imediato`:

1. Manter os chips imediatos como estão (papel pelo nome) — a tela não pode esperar a medição.
2. Logo depois de `setAttachments((prev) => [...prev, ...atts]);`, acrescentar:

```tsx
    /*
     * O PRÉ-VOO, depois dos chips e ANTES de qualquer leitura.
     *
     * Os chips já estão na tela com o papel do NOME: esperar a medição para
     * desenhá-los trocaria um chip que se corrige em menos de um segundo por
     * uma tela parada com oito PDFs invisíveis. Mas a LEITURA espera, e é essa
     * a ordem que importa — ler antes de decidir é como um memorial de 31
     * folhas foi parar no OCR de selo.
     */
    const preVoos = await preVoarLote(pdfs);
    const porNome = new Map(preVoos.map((p) => [p.file.name, p]));

    setAttachments((prev) =>
      prev.map((a) => {
        const pv = a.kind === "pdf" ? porNome.get(a.name) : undefined;
        return pv ? { ...a, papel: pv.papel, porque: pv.porque } : a;
      }),
    );

    const indecisos = preVoos.filter((p) => p.papel === "indeciso");
    const decididos = preVoos.filter((p) => p.papel !== "indeciso");
```

3. Trocar as duas chamadas de `partitionByRole(pdfs)` que vêm depois por uma partição sobre `decididos`:

```tsx
    const memorials = decididos.filter((p) => p.papel === "memorial").map((p) => p.file);
    const pranchas = decididos.filter((p) => p.papel === "prancha").map((p) => p.file);
    const memorial = memorials[0] ?? null;
```

O `papelLido` usado no preview imediato continua vindo de `partitionByRole` — ele é o palpite do nome, e é isso que ele deve ser.

4. Depois de disparar a leitura, avisar sobre os indecisos:

```tsx
    /*
     * OS INDECISOS, DITOS EM VOZ ALTA.
     *
     * Um chip âmbar num lote de oito é um chip que ninguém olha. A frase é a
     * mesma forma da de `arquivosQueNaoSaoPrancha`, e pelo mesmo motivo: a tela
     * mostra O QUE aconteceu com um anexo, e a conversa mostra QUAIS anexos
     * ficaram esperando alguém.
     */
    if (indecisos.length > 0) {
      const quais = indecisos.map((p) => `"${p.file.name}"`).join(", ");
      conv.appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          `Não consegui decidir se ${quais} ${indecisos.length === 1 ? "é" : "são"} memorial ou prancha — ` +
          `${indecisos[0].porque} Escolha no anexo e eu sigo daí; o resto do lote já está andando.`,
      });
    }
```

5. Acrescentar o import:

```ts
import { preVoarLote } from "../lib/pre-voo-do-anexo";
```

- [ ] **Step 5: Fazer a escolha valer**

Ainda em `NexoWorkspace.tsx`, ao lado da função que hoje troca o papel (linha ~520), acrescentar a que DEFINE:

```tsx
  /**
   * O anexo indeciso ganha papel — e só então é lido.
   *
   * Diferente de `trocarPapelAnexo`: lá existe um papel e ele se inverte; aqui
   * não existe papel nenhum, e a leitura nunca começou. Por isso esta função
   * DISPARA o trabalho em vez de refazê-lo.
   */
  async function definirPapelAnexo(id: string, papel: "memorial" | "prancha") {
    const file = arquivosPorAnexo.current.get(id);
    if (!file) return;

    setAttachments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, papel, porque: undefined } : a)),
    );

    if (papel === "memorial") {
      setMemorialFile(file);
      conv.salvarMemorial(file).catch(() => {});
      await lerSoMemorial(file);
      return;
    }

    const anterior = leituraEmVoo.current;
    const minha = (async () => {
      await anterior.catch(() => {});
      await lerPranchas([file], [], memorialFile);
    })();
    leituraEmVoo.current = minha;
    await minha;
  }
```

e passá-la ao `NexoCopilot`/`NexoChat` como `onDefinirPapelAnexo`, no mesmo lugar onde `onTrocarPapelAnexo` já é passada.

- [ ] **Step 6: Conferir tipos, lint e o teste de anexos**

```bash
npx tsc --noEmit && npx eslint modules/nexo/components/NexoChat.tsx modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/NexoCopilot.tsx && node scripts/test-nexo-attachments.ts
```

Expected: `tsc` exit 0, lint sem saída, testes de anexos OK.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/components/NexoChat.tsx modules/nexo/components/NexoWorkspace.tsx modules/nexo/components/NexoCopilot.tsx
git commit -m "o anexo que ninguém sabe o que é para de virar prancha por omissão"
```

---

### Task 6: A prova no navegador

**Files:**
- Create: `scripts/prova-pre-voo-do-anexo.mjs`
- Modify: `package.json` (registrar `prova:pre-voo`)

**Interfaces:**
- Consumes: a tela pronta das tarefas 1–5.
- Produces: nada de código.

**Por que:** `tsc`, lint e testes unitários não pegaram NENHUM dos defeitos reais desta área — os que apareceram, apareceram em screenshot de corrida real. E asserção de DOM passa verde com o painel fora da tela: a prova mede a caixa contra a janela.

- [ ] **Step 1: Escrever a prova**

Criar `scripts/prova-pre-voo-do-anexo.mjs`, seguindo o molde de `scripts/prova-conversa-do-achado.mjs` (login dev por e-mail em `#login-dev-email-input`, Playwright já instalado):

```js
/**
 * PROVA no navegador: o anexo indeciso aparece, o lote continua, e o botão
 * resolve.
 *
 * NÃO GASTA MODELO: o arquivo usado é o `01-identidade-capa-x-corpo.pdf` do kit
 * de erros plantados — memorial cujo NOME diz "capa" —, e a prova para antes de
 * mandar auditar. O que se prova é o roteamento, não a auditoria.
 *
 *   npm run prova:pre-voo   (precisa do dev server em pé)
 */
import { chromium } from "playwright";
import assert from "node:assert/strict";

const BASE = process.env.NEXODOC_BASE_URL ?? "http://localhost:3000";
const MEMORIAL_MAL_NOMEADO = "docs/samples/_auditoria-teste/01-identidade-capa-x-corpo.pdf";
const PRANCHA = "docs/samples/040-26/4_urb_psg_mqt/1_urb/040_26_urb_001_a.pdf";

let passou = 0;
const check = (nome, cond) => {
  if (cond) {
    passou++;
    console.log(`  ok  ${nome}`);
  } else {
    console.error(`FALHOU  ${nome}`);
    process.exitCode = 1;
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/login`);
await page.fill("#login-dev-email-input", "milton@prosul.com.br");
await page.press("#login-dev-email-input", "Enter");
await page.waitForURL(/\/(nexo|$)/, { timeout: 20000 });
await page.goto(`${BASE}/nexo`);

// Solta os DOIS de uma vez: o indeciso não pode segurar a prancha.
await page.setInputFiles('input[type="file"]', [MEMORIAL_MAL_NOMEADO, PRANCHA]);

const indeciso = page.getByText("memorial ou prancha?", { exact: false }).first();
await indeciso.waitFor({ state: "visible", timeout: 30000 });
check("o chip indeciso aparece", await indeciso.isVisible());

/*
 * VISÍVEL DE VERDADE: asserção de DOM passa verde com o elemento fora da tela.
 * Ver [[nexodoc-provar-visivel]] — mede-se a caixa contra a janela.
 */
const caixa = await indeciso.boundingBox();
const janela = page.viewportSize();
check(
  "o chip está DENTRO da janela",
  Boolean(caixa) &&
    caixa.x >= 0 &&
    caixa.y >= 0 &&
    caixa.x + caixa.width <= janela.width &&
    caixa.y + caixa.height <= janela.height,
);

const titulo = await indeciso.getAttribute("title");
check("o chip diz POR QUE está em dúvida", Boolean(titulo) && /folhas/i.test(titulo));

// A prancha do mesmo lote seguiu sozinha.
await page
  .getByText(/URB|selo ilegível|não parece prancha/i)
  .first()
  .waitFor({ state: "visible", timeout: 120000 });
check("a prancha do mesmo lote foi lida sem esperar a decisão", true);

await page.getByRole("button", { name: "tratar como memorial" }).first().click();
await page.getByText("memorial ou prancha?").first().waitFor({ state: "detached", timeout: 20000 });
check("escolher apaga a dúvida", true);

await page.screenshot({ path: "docs/provas/pre-voo-do-anexo.png", fullPage: false });
await browser.close();
console.log(`\n${passou} verificação(ões) de pré-voo OK`);
```

- [ ] **Step 2: Registrar e rodar**

Em `package.json`:

```json
    "prova:pre-voo": "node scripts/prova-pre-voo-do-anexo.mjs",
```

Com o dev server em pé (`npm run dev` noutro terminal — e reiniciado, porque `next dev` velho dá falha de portão consistente e falsa):

```bash
npm run prova:pre-voo
```

Expected: `5 verificação(ões) de pré-voo OK` e a captura em `docs/provas/pre-voo-do-anexo.png`.

- [ ] **Step 3: Olhar a captura**

Abrir `docs/provas/pre-voo-do-anexo.png` e conferir com os olhos: o chip âmbar está legível, não colide com o botão ao lado, e os dois botões cabem na linha do anexo sem quebrar para uma terceira linha no painel estreito do Nexo.

- [ ] **Step 4: Commit**

```bash
git add scripts/prova-pre-voo-do-anexo.mjs package.json docs/provas/pre-voo-do-anexo.png
git commit -m "a prova do pré-voo: o indeciso aparece, o lote anda, e a escolha resolve"
```

---

## Auto-revisão do plano

**Cobertura do spec:**

| Seção do spec | Tarefa |
|---|---|
| `pre-voo-do-anexo.ts` — os fatos | Task 4 (com o `loadPdfjs` compartilhado na Task 3) |
| `papel-do-anexo.ts` — o julgamento | Task 1 |
| Amostra espalhada | Task 1, `paginasDaAmostra` + teste |
| Tabela de precedência | Task 1, `decidirPapel` + 7 testes |
| Folha muda vira pergunta | Task 1, teste "folha MUDA não vira 'não é memorial'" |
| Limiares medidos no acervo | Task 2 (portão: `TROCAS DE LADO: 0`) |
| `Attachment.papel = "indeciso"` | Task 5 |
| Chip + os dois botões | Task 5, steps 2 e 3 |
| Indeciso não é lido; lote segue | Task 5, step 4 |
| Agente nomeia os indecisos | Task 5, step 4, item 4 |
| Provas | Tasks 1, 2, 5 (regressão) e 6 (navegador) |

**Desvio deliberado do spec, e por quê:** o spec escreveu a geometria como `maiorLado > 900` e `A4 retrato`. O plano REUSA `classificarPagina` de `server/nexo/selo-regiao.ts` — que não tem imports, já encapsula papel grande (`LIMITE_PAPEL_PEQUENO = 1200`) e âncoras de carimbo (`MIN_ANCORAS = 3`), e é o mesmo julgamento que a leitura de selo usa. Escrever números próprios daria duas noções de "isto é prancha" no repositório. O spec foi corrigido junto com este plano.

**Sem placeholders:** todo passo que muda código traz o código.

**Consistência de tipos:** `FatosDoAnexo`, `MedidaDaPagina`, `PapelPelaGeometria` e `PapelDoAnexo` são definidos na Task 1 e usados com os mesmos nomes nas Tasks 2, 4 e 5. `preVoarLote` (Task 4) é o que a Task 5 consome. `onDefinirPapelAnexo` (prop) vira `onDefinirPapel` (chip) — a passagem está escrita no step 3 da Task 5.
