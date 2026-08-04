# Conferência do Volume Montado — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir o PDF do volume depois de montado e conferi-lo contra o plano que o gerou — estrutura, conteúdo página a página, LD impressa e identidade —, com o veredito aparecendo sozinho no card do volume.

**Architecture:** Três peças com um trabalho cada. `volume-plano.ts` (puro) converte as partes da montagem em expectativa POR PÁGINA do PDF final. `volume-leitura.ts` (cliente) abre o PDF montado e lê cada página — carimbo de prancha vai ao modelo, LD e separatriz são lidas por extração de texto. `volume-check-core.ts` (puro) compara os dois e emite `LightCheckFinding[]`. A IA lê, a regra julga.

**Tech Stack:** TypeScript, Next.js (App Router), pdf.js (leitura), pdf-lib (fusão), OpenAI Responses API com `json_schema` estrito, Playwright (prova no navegador).

**Spec:** `docs/superpowers/specs/2026-08-04-conferencia-volume-montado-design.md`

## Global Constraints

- **Português do Brasil** em todo código, comentário, mensagem e nome de símbolo novo. É a regra do repo (`DESIGN.md`).
- **Núcleos puros não têm imports.** `server/nexo/volume-plano.ts` e `server/nexo/volume-check-core.ts` seguem `volume-parts.ts`: SEM `import` de runtime e SEM alias `@/`, para `node` cru carregá-los no script de teste. Importar tipo de outro módulo puro exigiria extensão `.ts`, que o `tsc` recusa em import de valor — se precisar de um tipo compartilhado, **redeclare-o**.
- **A IA lê, a regra julga.** O modelo devolve só o que enxerga, nunca um veredito. Comparação é código determinístico.
- **Conferência parcial não aprova.** Página que não pôde ser lida impede o veredito `"ok"`.
- **A conferência NÃO bloqueia o download** do volume. Achado crítico pinta o card; o PDF continua disponível.
- **Modelo padrão `gpt-5.4-mini`**, configurável pelo flow `volume-conferencia`.
- Comentários explicam **por quê**, não o quê — é o padrão do repo.
- Node: rode os scripts com o node do `fnm` (`v24.18.0`). No PowerShell:
  `$env:PATH = "$env:APPDATA\fnm\node-versions\v24.18.0\installation;$env:PATH"`

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `server/nexo/volume-plano.ts` (novo, puro) | Partes da montagem → expectativa por página do PDF final |
| `server/nexo/volume-check-core.ts` (novo, puro) | Expectativa × leitura → `LightCheckFinding[]` + veredito |
| `modules/nexo/lib/volume-leitura.ts` (novo, cliente) | Abre o PDF montado e lê cada página (IA na prancha, texto na LD) |
| `app/api/nexo/volume-check/route.ts` (novo) | Recebe recortes de carimbo, chama o modelo, devolve leituras |
| `server/nexo/tools/assemble-volume.ts` (modificar) | Passa a informar quantas páginas cada parte contribuiu |
| `app/api/nexo/volume/route.ts` (modificar) | Repassa as páginas por parte ao cliente |
| `lib/ai-model-config.ts` (modificar) | Flow `volume-conferencia` |
| `lib/ai-providers.ts` (modificar) | Configuração do provedor/modelo do flow |
| `modules/nexo/lib/generate.ts` (modificar) | `postVolumeCheck` |
| `modules/nexo/components/ConfirmationCard.tsx` (modificar) | Roda a conferência ao montar e exibe o resultado |
| `scripts/test-nexo-volume-check.ts` (novo) | Teste dos dois núcleos puros, node cru |
| `scripts/shot-volume-check.mjs` (novo) | Prova de fiação no navegador, sem gastar token |

---

## Task 1: A montagem informa as páginas de cada parte

O plano por página precisa saber quantas páginas cada parte contribuiu. A rota de
montagem **já carrega toda parte com `pdf-lib`** para validar — a contagem é de
graça ali, e obtê-la no cliente exigiria pdf-lib no bundle do browser.

**Files:**
- Modify: `server/nexo/tools/assemble-volume.ts`
- Modify: `app/api/nexo/volume/route.ts`
- Modify: `modules/nexo/lib/generate.ts` (tipo `VolumeGenResult`)
- Test: `scripts/test-nexo-volume-check.ts` (criado aqui, cresce nas tarefas seguintes)

**Interfaces:**
- Produces: `AssembleVolumeOutput.partes: PartePaginada[]` onde
  `interface PartePaginada { role: VolumePartRole; name: string; paginas: number }`,
  na ORDEM em que as partes entraram no PDF final.
- Produces: `VolumeGenResult.partes?: PartePaginada[]` (cliente).

- [ ] **Step 1: Escreva o teste que falha**

Crie `scripts/test-nexo-volume-check.ts`:

```ts
/**
 * Teste dos núcleos puros da CONFERÊNCIA DO VOLUME MONTADO.
 *
 *   node scripts/test-nexo-volume-check.ts   (== npm run test:nexo:volume-check)
 */
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";

import { assembleVolume } from "../server/nexo/tools/assemble-volume.ts";

let passed = 0;
function test(name: string, fn: () => void | Promise<void>) {
  const executar = async () => {
    try {
      await fn();
      passed++;
      console.log(`  ok  ${name}`);
    } catch (err) {
      console.error(`FALHOU  ${name}`);
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    }
  };
  fila.push(executar);
}
const fila: (() => Promise<void>)[] = [];

/** Um PDF de N páginas em branco, para contar sem depender de arquivo real. */
async function pdfDe(paginas: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) doc.addPage([595, 842]);
  return Buffer.from(await doc.save());
}

// ---------------------------------------------------------------------------
// Task 1 — a montagem informa quantas páginas cada parte contribuiu
// ---------------------------------------------------------------------------

test("a montagem devolve as páginas de cada parte, na ordem do PDF", async () => {
  const saida = await assembleVolume({
    parts: [
      { role: "capa", name: "capa.pdf", buffer: await pdfDe(1) },
      { role: "ld", name: "ld.pdf", buffer: await pdfDe(2) },
      { role: "prancha", name: "p.pdf", buffer: await pdfDe(3) },
    ],
  });
  assert.equal(saida.error, undefined);
  assert.equal(saida.pageCount, 6);
  assert.deepEqual(saida.partes, [
    { role: "capa", name: "capa.pdf", paginas: 1 },
    { role: "ld", name: "ld.pdf", paginas: 2 },
    { role: "prancha", name: "p.pdf", paginas: 3 },
  ]);
});

test("com faixa recortada, a parte conta só as páginas da faixa", async () => {
  const saida = await assembleVolume({
    parts: [
      { role: "prancha", name: "combinado.pdf", buffer: await pdfDe(10), startPage: 4, endPage: 6 },
    ],
  });
  assert.deepEqual(saida.partes, [
    { role: "prancha", name: "combinado.pdf", paginas: 3 },
  ]);
});

for (const t of fila) await t();
console.log(`\n${passed} teste(s) ok`);
```

- [ ] **Step 2: Rode e confirme que falha**

```
$env:PATH = "$env:APPDATA\fnm\node-versions\v24.18.0\installation;$env:PATH"
node scripts/test-nexo-volume-check.ts
```

Esperado: FALHA nas duas — `saida.partes` é `undefined`.

- [ ] **Step 3: Implemente**

Em `server/nexo/tools/assemble-volume.ts`, exporte o tipo e some o campo à saída:

```ts
/**
 * Quantas páginas cada parte contribuiu para o PDF final, na ordem em que
 * entraram. É o que permite dizer, depois, QUAL página do volume deveria ser
 * qual folha — a conferência do volume montado se apoia inteira nisto.
 *
 * Calculado aqui porque a montagem já carrega toda parte com pdf-lib para
 * validar: contar é de graça neste ponto, e refazer a conta no cliente
 * significaria pdf-lib no bundle do browser para reproduzir um número que o
 * servidor já tinha em mãos.
 */
export interface PartePaginada {
  role: VolumePartRole;
  name: string;
  paginas: number;
}
```

Acrescente `partes?: PartePaginada[]` a `AssembleVolumeOutput`.

Dentro de `assembleVolume`, o laço de validação já carrega cada parte — aproveite-o.
Substitua o laço existente por um que também guarde a contagem:

```ts
  const paginasPorParte = new Map<VolumePart, number>();
  for (const part of parts) {
    if (!part || !Buffer.isBuffer(part.buffer) || part.buffer.byteLength === 0) {
      const label = part?.name ? `"${part.name}"` : "sem nome";
      return { pdf: null, error: `Parte ${label} nao contem um PDF valido.` };
    }
    try {
      const doc = await PDFDocument.load(part.buffer);
      // A faixa é 1-based e inclusiva, e pode estourar o documento (o selo pode
      // ter mentido a página). Cortar aqui faz a conta bater com o que
      // `buildRowPdf` realmente copia.
      const total = doc.getPageCount();
      const inicio = Math.max(1, part.startPage ?? 1);
      const fim = Math.min(total, part.endPage ?? total);
      paginasPorParte.set(part, Math.max(0, fim - inicio + 1));
    } catch {
      return {
        pdf: null,
        error: `Parte "${part.name}" nao e um PDF valido ou esta corrompida.`,
      };
    }
  }
```

E no `return` de sucesso, depois de `orderedParts` estar definido:

```ts
    const partes: PartePaginada[] = orderedParts.map((part) => ({
      role: part.role,
      name: part.name,
      paginas: paginasPorParte.get(part) ?? 0,
    }));

    return { pdf: { name, buffer }, pageCount, partes };
```

- [ ] **Step 4: Rode e confirme que passa**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: `2 teste(s) ok`

- [ ] **Step 5: Repasse ao cliente**

Em `app/api/nexo/volume/route.ts`, no `NextResponse.json` final, some `partes`:

```ts
  return NextResponse.json({
    pdf: result.pdf
      ? { name: result.pdf.name, data: result.pdf.buffer.toString("base64") }
      : null,
    error: result.error,
    pageCount: result.pageCount,
    partes: result.partes,
  });
```

Em `modules/nexo/lib/generate.ts`, some ao tipo `VolumeGenResult`:

```ts
  /** Quantas páginas cada parte contribuiu, na ordem do PDF final. */
  partes?: { role: string; name: string; paginas: number }[];
```

e repasse o campo no retorno de `postVolume` (siga o que a função já faz com
`pageCount`).

- [ ] **Step 6: Registre o script e confira o tipo**

Em `package.json`, ao lado de `test:nexo:selo-regiao`:

```json
    "test:nexo:volume-check": "node scripts/test-nexo-volume-check.ts",
```

```
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem saída.

- [ ] **Step 7: Commit**

```bash
git add server/nexo/tools/assemble-volume.ts app/api/nexo/volume/route.ts modules/nexo/lib/generate.ts scripts/test-nexo-volume-check.ts package.json
git commit -m "Montagem do volume informa as paginas de cada parte"
```

---

## Task 2: `volume-plano.ts` — a expectativa por página

**Files:**
- Create: `server/nexo/volume-plano.ts`
- Modify: `scripts/test-nexo-volume-check.ts`

**Interfaces:**
- Consumes: `PartePaginada` da Task 1 (redeclarado localmente — núcleo puro não importa).
- Produces:
  ```ts
  type PapelDaPagina = "capa" | "separatriz" | "ld" | "prancha";
  interface FolhaEsperada { folha: number | null; total: number | null; codigo: string | null; titulo: string | null }
  interface BlocoDoPlano { codigo: string; folhas: FolhaEsperada[] }
  interface ParteDoPlano { papel: PapelDaPagina; nome: string; paginas: number; bloco?: string }
  interface PaginaEsperada { pagina: number; papel: PapelDaPagina; bloco: string; folha: number | null; total: number | null; codigo: string | null; titulo: string | null }
  function montarPlanoDePaginas(partes: readonly ParteDoPlano[], blocos: readonly BlocoDoPlano[]): PaginaEsperada[]
  ```

- [ ] **Step 1: Escreva o teste que falha**

Acrescente ao fim de `scripts/test-nexo-volume-check.ts` (antes do laço `for (const t of fila)`):

```ts
import {
  montarPlanoDePaginas,
  type BlocoDoPlano,
  type PaginaEsperada,
  type ParteDoPlano,
} from "../server/nexo/volume-plano.ts";

// ---------------------------------------------------------------------------
// Task 2 — a expectativa por página do PDF final
// ---------------------------------------------------------------------------

/** Um volume real de dois blocos: capa + (sep · LD · 2 pranchas) x2. */
const PARTES: ParteDoPlano[] = [
  { papel: "capa", nome: "capa.pdf", paginas: 1 },
  { papel: "separatriz", nome: "sep-est.pdf", paginas: 1, bloco: "est" },
  { papel: "ld", nome: "ld-est.pdf", paginas: 2, bloco: "est" },
  { papel: "prancha", nome: "est.pdf", paginas: 2, bloco: "est" },
  { papel: "separatriz", nome: "sep-arq.pdf", paginas: 1, bloco: "arq" },
  { papel: "ld", nome: "ld-arq.pdf", paginas: 1, bloco: "arq" },
  { papel: "prancha", nome: "arq.pdf", paginas: 3, bloco: "arq" },
];

const BLOCOS: BlocoDoPlano[] = [
  {
    codigo: "est",
    folhas: [
      { folha: 1, total: 2, codigo: "040_26_est_001_a", titulo: "FORMAS PISO" },
      { folha: 2, total: 2, codigo: "040_26_est_002_a", titulo: "FORMAS TOPO" },
    ],
  },
  {
    codigo: "arq",
    folhas: [
      { folha: 1, total: 3, codigo: "040_26_arq_a", titulo: "IMPLANTACAO" },
      { folha: 2, total: 3, codigo: "040_26_arq_a", titulo: "PLANTA TERREO" },
      { folha: 3, total: 3, codigo: "040_26_arq_a", titulo: "CORTES" },
    ],
  },
];

test("cada página do volume ganha a sua expectativa, na ordem", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  assert.equal(plano.length, 11, "1+1+2+2+1+1+3");
  assert.deepEqual(plano.map((p) => p.papel), [
    "capa",
    "separatriz", "ld", "ld", "prancha", "prancha",
    "separatriz", "ld", "prancha", "prancha", "prancha",
  ]);
  assert.deepEqual(plano.map((p) => p.pagina), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("a página de prancha sabe QUAL folha ela deveria ser", () => {
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  const est = plano.filter((p) => p.papel === "prancha" && p.bloco === "est");
  assert.deepEqual(est.map((p) => [p.pagina, p.folha, p.total]), [[5, 1, 2], [6, 2, 2]]);
  assert.equal(est[0].codigo, "040_26_est_001_a");
  assert.equal(est[1].titulo, "FORMAS TOPO");
});

test("bloco cujo código do ARQUIVO não traz a folha ainda numera certo", () => {
  // A família `arq` imprime "040_26_arq_a" em TODAS as folhas. Quem numera é a
  // ordem dentro do bloco, não o código.
  const plano = montarPlanoDePaginas(PARTES, BLOCOS);
  const arq = plano.filter((p) => p.papel === "prancha" && p.bloco === "arq");
  assert.deepEqual(arq.map((p) => p.folha), [1, 2, 3]);
  assert.deepEqual(arq.map((p) => p.codigo), ["040_26_arq_a", "040_26_arq_a", "040_26_arq_a"]);
});

test("mais páginas de prancha do que folhas na LD: o excedente fica sem expectativa", () => {
  // Não é erro DESTE módulo julgar — ele só descreve. Quem acusa é o core.
  const plano = montarPlanoDePaginas(
    [{ papel: "prancha", nome: "x.pdf", paginas: 3, bloco: "est" }],
    [{ codigo: "est", folhas: [{ folha: 1, total: 1, codigo: null, titulo: null }] }],
  );
  assert.equal(plano.length, 3);
  assert.equal(plano[0].folha, 1);
  assert.equal(plano[1].folha, null);
  assert.equal(plano[2].folha, null);
});

test("volume sem capa e sem LD (só pranchas) não quebra", () => {
  const plano = montarPlanoDePaginas(
    [{ papel: "prancha", nome: "x.pdf", paginas: 2, bloco: "" }],
    [],
  );
  assert.deepEqual(plano.map((p) => p.papel), ["prancha", "prancha"]);
  assert.equal(plano[0].folha, null);
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: erro de módulo não encontrado (`volume-plano.ts`).

- [ ] **Step 3: Implemente**

Crie `server/nexo/volume-plano.ts`:

```ts
/**
 * A EXPECTATIVA POR PÁGINA do volume montado — núcleo puro.
 *
 * A montagem sabe o que vai gerar: `buildVolumeParts` produz as partes na ordem
 * canônica, e `assembleVolume` diz quantas páginas cada uma contribuiu. O que
 * faltava era transformar isso na pergunta que a conferência precisa fazer:
 *
 *   a página 9 do PDF final deveria ser O QUÊ?
 *
 * Sem essa tabela, conferir o volume montado seria comparar o documento com uma
 * intuição. Com ela, cada página tem um gabarito, e discordar do gabarito é um
 * achado com página e nome.
 *
 * O gabarito de folha/código/título vem das LINHAS DA LD daquele bloco — a
 * mesma fonte que imprimiu a LD encadernada. É deliberado: a LD é o documento
 * que PROMETE o conteúdo do volume, e conferir o volume contra a promessa é
 * exatamente o que se quer.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-volume-check.ts`.
 * Por isso `PapelDaPagina` é redeclarado em vez de importado de `volume-parts.ts`.
 */

/** Espelha `VolumePartRole` de `volume-parts.ts`. Redeclarado: núcleo puro. */
export type PapelDaPagina = "capa" | "separatriz" | "ld" | "prancha";

/** O que a LD promete de UMA folha. */
export interface FolhaEsperada {
  folha: number | null;
  total: number | null;
  /** Campo ARQUIVO. Nem toda família imprime o número da folha nele. */
  codigo: string | null;
  /** CONTEÚDO — a descrição técnica da prancha. */
  titulo: string | null;
}

/** Um bloco (disciplina) e as folhas que a LD dele lista, em ordem. */
export interface BlocoDoPlano {
  codigo: string;
  folhas: FolhaEsperada[];
}

/** Uma parte já montada, com quantas páginas ela contribuiu. */
export interface ParteDoPlano {
  papel: PapelDaPagina;
  nome: string;
  paginas: number;
  /** Código do bloco a que a parte pertence; a capa do volume não tem. */
  bloco?: string;
}

/** O gabarito de UMA página do PDF final. */
export interface PaginaEsperada {
  /** 1-based no volume final. */
  pagina: number;
  papel: PapelDaPagina;
  /** "" para a capa do volume, que não pertence a bloco nenhum. */
  bloco: string;
  folha: number | null;
  total: number | null;
  codigo: string | null;
  titulo: string | null;
}

/**
 * Achata as partes em páginas e casa cada página de prancha com a folha que a
 * LD promete naquela posição.
 *
 * As folhas do bloco são consumidas EM ORDEM, uma por página de prancha. Não é
 * casamento por código porque o código não identifica a folha em toda família:
 * `est` imprime `040_26_est_001_a`, `arq` imprime `040_26_arq_a` em todas. A
 * posição é o único eixo que vale nas duas.
 *
 * Página de prancha sem folha correspondente na LD sai com tudo `null` — este
 * módulo DESCREVE, não julga. Acusar sobra ou falta é trabalho de
 * `volume-check-core.ts`, que é onde a severidade mora.
 */
export function montarPlanoDePaginas(
  partes: readonly ParteDoPlano[],
  blocos: readonly BlocoDoPlano[],
): PaginaEsperada[] {
  const folhasPorBloco = new Map<string, FolhaEsperada[]>();
  for (const bloco of blocos) folhasPorBloco.set(bloco.codigo, [...bloco.folhas]);
  const consumido = new Map<string, number>();

  const plano: PaginaEsperada[] = [];
  let pagina = 0;

  for (const parte of partes) {
    const bloco = parte.bloco ?? "";
    for (let i = 0; i < parte.paginas; i++) {
      pagina++;
      if (parte.papel !== "prancha") {
        plano.push({
          pagina,
          papel: parte.papel,
          bloco,
          folha: null,
          total: null,
          codigo: null,
          titulo: null,
        });
        continue;
      }

      const usadas = consumido.get(bloco) ?? 0;
      const esperada = folhasPorBloco.get(bloco)?.[usadas] ?? null;
      consumido.set(bloco, usadas + 1);

      plano.push({
        pagina,
        papel: "prancha",
        bloco,
        folha: esperada?.folha ?? null,
        total: esperada?.total ?? null,
        codigo: esperada?.codigo ?? null,
        titulo: esperada?.titulo ?? null,
      });
    }
  }

  return plano;
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: `7 teste(s) ok`

- [ ] **Step 5: Commit**

```bash
git add server/nexo/volume-plano.ts scripts/test-nexo-volume-check.ts
git commit -m "Expectativa por pagina do volume montado"
```

---

## Task 3: `volume-check-core.ts` — estrutura

Primeira fatia do juízo. É a única dimensão que não depende do modelo, e por isso
a única que emite crítico com confiança total.

**Files:**
- Create: `server/nexo/volume-check-core.ts`
- Modify: `scripts/test-nexo-volume-check.ts`

**Interfaces:**
- Produces:
  ```ts
  type Severidade = "critico" | "aviso" | "info";
  type Veredito = "ok" | "aviso" | "critico";
  interface Achado { severidade: Severidade; campo: string; mensagem: string; detalhe?: string }
  interface LeituraDaPagina {
    pagina: number;
    temCarimbo: boolean;
    numeracaoTexto: string; folha: number | null; total: number | null;
    codigo: string; titulo: string; disciplina: string;
    orgao: string; obra: string;
    linhasDaLd?: LinhaDaLdImpressa[];
    erro?: string;
  }
  interface LinhaDaLdImpressa { sheet: string; file: string; description: string }
  interface AlvoDoVolume { orgao: string; pageCount: number }
  interface VolumeCheckResult { veredito: Veredito; findings: Achado[]; paginasConferidas: number }
  function checkVolumeMontado(esperado, lido, alvo): VolumeCheckResult
  ```
  `Achado` é estruturalmente igual a `LightCheckFinding` de `light-check-core.ts`
  — redeclarado porque núcleo puro não importa. A UI consome os dois igual.

- [ ] **Step 1: Escreva o teste que falha**

Acrescente a `scripts/test-nexo-volume-check.ts`:

```ts
import {
  checkVolumeMontado,
  type AlvoDoVolume,
  type LeituraDaPagina,
} from "../server/nexo/volume-check-core.ts";

// ---------------------------------------------------------------------------
// Task 3 — estrutura
// ---------------------------------------------------------------------------

const ALVO: AlvoDoVolume = { orgao: "Prefeitura Municipal de Chapecó", pageCount: 11 };

/** Leitura de uma página que bate exatamente com o gabarito. */
function leituraPerfeita(p: PaginaEsperada): LeituraDaPagina {
  const prancha = p.papel === "prancha";
  return {
    pagina: p.pagina,
    temCarimbo: prancha,
    numeracaoTexto: prancha && p.folha ? `${p.folha}/${p.total}` : "",
    folha: p.folha,
    total: p.total,
    codigo: p.codigo ?? "",
    titulo: p.titulo ?? "",
    disciplina: prancha ? p.bloco.toUpperCase() : "",
    orgao: prancha ? "PREFEITURA MUNICIPAL DE CHAPECO" : "",
    obra: prancha ? "REVITALIZACAO DA FEIRA MUNICIPAL" : "",
  };
}

const PLANO = montarPlanoDePaginas(PARTES, BLOCOS);
const LEITURA_OK = PLANO.map(leituraPerfeita);

test("volume perfeito dá ok e não inventa achado", () => {
  const r = checkVolumeMontado(PLANO, LEITURA_OK, ALVO);
  assert.equal(r.veredito, "ok", JSON.stringify(r.findings, null, 2));
  assert.equal(r.paginasConferidas, 11);
});

test("pageCount diferente do plano é crítico", () => {
  const r = checkVolumeMontado(PLANO, LEITURA_OK, { ...ALVO, pageCount: 12 });
  const f = r.findings.find((x) => x.campo === "paginas");
  assert.ok(f, "devia acusar a contagem");
  assert.equal(f.severidade, "critico");
  assert.equal(r.veredito, "critico");
});

test("página que deveria ser prancha e chega sem carimbo é crítico", () => {
  // A faixa recortada trouxe capa ou índice para dentro do bloco.
  const lido = LEITURA_OK.map((l) => (l.pagina === 5 ? { ...l, temCarimbo: false } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "papel");
  assert.ok(f);
  assert.equal(f.severidade, "critico");
  assert.match(f.mensagem, /5/);
});

test("página que deveria ser LD e chega com carimbo de prancha é crítico", () => {
  const lido = LEITURA_OK.map((l) => (l.pagina === 3 ? { ...l, temCarimbo: true } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "papel");
  assert.ok(f);
  assert.equal(f.severidade, "critico");
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: módulo `volume-check-core.ts` não encontrado.

- [ ] **Step 3: Implemente**

Crie `server/nexo/volume-check-core.ts`:

```ts
/**
 * CONFERÊNCIA DO VOLUME MONTADO — núcleo puro.
 *
 * O portão final. As outras duas conferências olham os SELOS LIDOS, antes da
 * montagem; esta abre o PDF que vai ser enviado e o confere contra o plano que
 * o gerou.
 *
 * A divisão de trabalho é a mesma do resto do sistema, e é o ponto do módulo:
 *
 *   a IA lê, a regra julga.
 *
 * O modelo devolve o que enxerga no carimbo de cada página e nada mais. Comparar
 * com o gabarito é código determinístico, aqui, testável em node cru. Um modelo
 * que erra a leitura produz um achado errado, que se vê e se corrige; um modelo
 * que erra o veredito produz um volume aprovado no escuro.
 *
 * A SEVERIDADE segue de quem afirma o quê. A estrutura (contagem, papel) é
 * aritmética sobre o plano e não passa pelo modelo — crítico ali é confiável.
 * O conteúdo passa pela leitura, e leitura erra: divergência isolada é aviso, e
 * só o padrão SISTEMÁTICO sobe para crítico. Um crítico falso ensina a ignorar
 * o semáforo, que é o pior estrago que uma conferência pode fazer.
 *
 * PURO: sem imports, para rodar em node cru no `scripts/test-nexo-volume-check.ts`.
 */

export type Severidade = "critico" | "aviso" | "info";
export type Veredito = "ok" | "aviso" | "critico";

/** Espelha `LightCheckFinding` de `light-check-core.ts`. Redeclarado: núcleo puro. */
export interface Achado {
  severidade: Severidade;
  campo: string;
  mensagem: string;
  detalhe?: string;
}

/** Uma linha da LD como ela foi IMPRESSA dentro do volume. */
export interface LinhaDaLdImpressa {
  sheet: string;
  file: string;
  description: string;
}

/** O que se leu de UMA página do PDF montado. Leitura, não juízo. */
export interface LeituraDaPagina {
  pagina: number;
  /** A página tem carimbo de prancha? Vem da contagem de âncoras, não do modelo. */
  temCarimbo: boolean;
  numeracaoTexto: string;
  folha: number | null;
  total: number | null;
  codigo: string;
  titulo: string;
  disciplina: string;
  orgao: string;
  obra: string;
  /** Só em página de LD: as linhas lidas por extração de texto. */
  linhasDaLd?: LinhaDaLdImpressa[];
  /** A página não pôde ser lida. Impede o veredito "ok". */
  erro?: string;
}

/** Contra o que se confere. */
export interface AlvoDoVolume {
  /** A prefeitura DECLARADA — a da capa. Nunca inferida do próprio selo. */
  orgao: string;
  /** O `pageCount` que a montagem devolveu para o PDF final. */
  pageCount: number;
}

export interface VolumeCheckResult {
  veredito: Veredito;
  findings: Achado[];
  /** Quantas páginas entraram no juízo — a UI diz sobre o que ele fala. */
  paginasConferidas: number;
}

const RANK: Record<Veredito, number> = { ok: 0, aviso: 1, critico: 2 };

/** Lista curta e legível (a mensagem não pode estourar com 200 páginas). */
function juntar(itens: string[], max = 6): string {
  if (itens.length <= max) return itens.join(", ");
  return `${itens.slice(0, max).join(", ")} (+${itens.length - max})`;
}

/** Redeclarado de `volume-plano.ts`: núcleo puro não importa. */
export interface PaginaEsperada {
  pagina: number;
  papel: "capa" | "separatriz" | "ld" | "prancha";
  bloco: string;
  folha: number | null;
  total: number | null;
  codigo: string | null;
  titulo: string | null;
}

export function checkVolumeMontado(
  esperado: readonly PaginaEsperada[],
  lido: readonly LeituraDaPagina[],
  alvo: AlvoDoVolume,
): VolumeCheckResult {
  const findings: Achado[] = [];
  const porPagina = new Map(lido.map((l) => [l.pagina, l]));

  // --- Estrutura: a contagem (CRÍTICO) ---------------------------------------
  if (esperado.length > 0 && alvo.pageCount !== esperado.length) {
    findings.push({
      severidade: "critico",
      campo: "paginas",
      mensagem: `O volume saiu com ${alvo.pageCount} página(s); o plano previa ${esperado.length}.`,
      detalhe:
        "A fusão comeu ou duplicou páginas — o PDF não corresponde às partes que foram montadas.",
    });
  }

  /*
   * --- Estrutura: papel trocado (CRÍTICO) ----------------------------------
   *
   * A prova é a presença do CARIMBO, que vem da contagem de âncoras e não de uma
   * leitura de papel pelo modelo (o modelo não devolve papel). A ordem canônica
   * em si não é reconferida: ela sai de `buildVolumeParts`, que é puro e já
   * travado por `test:nexo:parts`. O que pode dar errado da montagem para o PDF
   * é a FAIXA de páginas de cada parte, e é isso que estas duas regras pegam.
   */
  const semCarimbo: string[] = [];
  const carimboAMais: string[] = [];
  for (const p of esperado) {
    const l = porPagina.get(p.pagina);
    if (!l || l.erro) continue;
    if (p.papel === "prancha" && !l.temCarimbo) semCarimbo.push(`p.${p.pagina}`);
    if (p.papel !== "prancha" && l.temCarimbo) {
      carimboAMais.push(`p.${p.pagina} (devia ser ${p.papel})`);
    }
  }
  if (semCarimbo.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "papel",
      mensagem: `${semCarimbo.length} página(s) deveriam ser prancha e não têm carimbo.`,
      detalhe: `${juntar(semCarimbo)} — a faixa recortada trouxe capa ou índice para dentro do bloco.`,
    });
  }
  if (carimboAMais.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "papel",
      mensagem: `${carimboAMais.length} página(s) trazem carimbo de prancha onde deveria haver outra parte.`,
      detalhe: juntar(carimboAMais),
    });
  }

  let veredito: Veredito = "ok";
  for (const f of findings) {
    const como: Veredito =
      f.severidade === "critico" ? "critico" : f.severidade === "aviso" ? "aviso" : "ok";
    if (RANK[como] > RANK[veredito]) veredito = como;
  }

  return { veredito, findings, paginasConferidas: lido.length };
}
```

- [ ] **Step 4: Rode e confirme que passa**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: `11 teste(s) ok`

- [ ] **Step 5: Commit**

```bash
git add server/nexo/volume-check-core.ts scripts/test-nexo-volume-check.ts
git commit -m "Conferencia do volume: estrutura (contagem e papel)"
```

---

## Task 4: `volume-check-core.ts` — conteúdo página a página

**Files:**
- Modify: `server/nexo/volume-check-core.ts`
- Modify: `scripts/test-nexo-volume-check.ts`

**Interfaces:**
- Consumes: tudo da Task 3. Nenhuma assinatura nova — `checkVolumeMontado` ganha
  regras.

- [ ] **Step 1: Escreva o teste que falha**

```ts
// ---------------------------------------------------------------------------
// Task 4 — conteúdo página a página
// ---------------------------------------------------------------------------

test("numeração divergente numa página isolada é AVISO, não crítico", () => {
  // Leitura erra. Um crítico aqui ensinaria a ignorar o semáforo.
  const lido = LEITURA_OK.map((l) => (l.pagina === 6 ? { ...l, folha: 7 } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "numeracao");
  assert.ok(f);
  assert.equal(f.severidade, "aviso");
  assert.equal(r.veredito, "aviso");
});

test("bloco inteiro deslocado com o MESMO offset é CRÍTICO", () => {
  // Não é ruído: é a faixa recortada errada. As 3 folhas do arq lidas como 2,3,4.
  const lido = LEITURA_OK.map((l) =>
    l.pagina >= 9 && l.pagina <= 11 && l.folha != null ? { ...l, folha: l.folha + 1 } : l,
  );
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "faixa");
  assert.ok(f, "devia acusar a faixa deslocada");
  assert.equal(f.severidade, "critico");
  assert.match(f.detalhe ?? "", /arq/i);
});

test("folha esperada ausente do volume é crítico", () => {
  const lido = LEITURA_OK.map((l) => (l.pagina === 10 ? { ...l, folha: null, numeracaoTexto: "" } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "sequencia" && /faltando/i.test(x.mensagem));
  assert.ok(f);
  assert.equal(f.severidade, "critico");
});

test("folha repetida dentro do bloco é crítico", () => {
  const lido = LEITURA_OK.map((l) => (l.pagina === 10 ? { ...l, folha: 1 } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "sequencia" && /duplicad/i.test(x.mensagem));
  assert.ok(f);
  assert.equal(f.severidade, "critico");
});

test("disciplina lida diferente do bloco em que a página caiu é crítico", () => {
  const lido = LEITURA_OK.map((l) => (l.pagina === 5 ? { ...l, disciplina: "ARQ" } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "disciplina");
  assert.ok(f);
  assert.equal(f.severidade, "critico");
});

test("disciplina em branco não acusa nada (o carimbo nem sempre traz)", () => {
  const lido = LEITURA_OK.map((l) => (l.pagina === 5 ? { ...l, disciplina: "" } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  assert.equal(r.findings.find((x) => x.campo === "disciplina"), undefined);
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: 6 falhas novas.

- [ ] **Step 3: Implemente**

Em `server/nexo/volume-check-core.ts`, acrescente helpers no topo (depois de `juntar`):

```ts
/** minúsculas, sem acento, sem pontuação — para comparar disciplina e obra. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Valor mais frequente entre números; 0 quando não há nenhum. */
function moda(valores: number[]): { valor: number; vezes: number } {
  const contas = new Map<number, number>();
  for (const v of valores) contas.set(v, (contas.get(v) ?? 0) + 1);
  let valor = 0;
  let vezes = 0;
  for (const [k, n] of contas) if (n > vezes) [valor, vezes] = [k, n];
  return { valor, vezes };
}
```

E, dentro de `checkVolumeMontado`, antes do cálculo do veredito:

```ts
  // --- Conteúdo, página a página --------------------------------------------
  const pranchas = esperado.filter((p) => p.papel === "prancha");
  const blocosDoPlano = [...new Set(pranchas.map((p) => p.bloco))];

  for (const bloco of blocosDoPlano) {
    const doBloco = pranchas.filter((p) => p.bloco === bloco);
    const rotulo = bloco ? bloco.toUpperCase() : "sem disciplina";

    /*
     * A FAIXA DESLOCADA vem primeiro porque ela EXPLICA as divergências
     * individuais. Quando metade ou mais das páginas do bloco erram pelo MESMO
     * valor, não são N leituras ruins: é uma faixa recortada errada, e reportar
     * página por página esconderia a causa atrás do sintoma.
     */
    const desvios: number[] = [];
    const divergentes: string[] = [];
    for (const p of doBloco) {
      const l = porPagina.get(p.pagina);
      if (!l || l.erro || p.folha == null || l.folha == null) continue;
      if (l.folha !== p.folha) {
        desvios.push(l.folha - p.folha);
        divergentes.push(`p.${p.pagina}: selo diz ${l.folha}, esperado ${p.folha}`);
      }
    }

    const comparaveis = doBloco.filter((p) => {
      const l = porPagina.get(p.pagina);
      return l && !l.erro && p.folha != null && l.folha != null;
    }).length;
    const { valor: desvio, vezes } = moda(desvios);

    const sistematico = comparaveis > 0 && desvio !== 0 && vezes >= Math.ceil(comparaveis / 2);
    if (sistematico) {
      findings.push({
        severidade: "critico",
        campo: "faixa",
        mensagem: `${rotulo}: ${vezes} de ${comparaveis} folha(s) deslocadas em ${desvio > 0 ? "+" : ""}${desvio} — a faixa de páginas deste bloco foi recortada errada.`,
        detalhe: juntar(divergentes),
      });
    } else if (divergentes.length > 0) {
      findings.push({
        severidade: "aviso",
        campo: "numeracao",
        mensagem: `${rotulo}: a numeração do carimbo discorda do esperado em ${divergentes.length} página(s).`,
        detalhe: juntar(divergentes),
      });
    }

    // --- Presença e duplicata dentro do bloco (CRÍTICO) ---------------------
    const esperadas = doBloco
      .map((p) => p.folha)
      .filter((n): n is number => n != null);
    const contagem = new Map<number, number>();
    for (const p of doBloco) {
      const l = porPagina.get(p.pagina);
      if (!l || l.erro || l.folha == null) continue;
      contagem.set(l.folha, (contagem.get(l.folha) ?? 0) + 1);
    }

    /*
     * Faixa deslocada já explica a ausência e a duplicata inteiras: com o bloco
     * corrido em +1, TODA folha some e TODA folha aparece fora do lugar. Somar
     * os três achados sobre a mesma causa entulha a tela e esconde o conserto.
     */
    if (!sistematico && contagem.size > 0) {
      const faltando = esperadas.filter((n) => !contagem.has(n));
      if (faltando.length > 0) {
        findings.push({
          severidade: "critico",
          campo: "sequencia",
          mensagem: `${rotulo}: folha(s) faltando no volume: ${faltando.join(", ")}.`,
          detalhe: `A LD deste bloco promete ${esperadas.length} folha(s).`,
        });
      }
      const repetidas = [...contagem.entries()]
        .filter(([, n]) => n > 1)
        .map(([n]) => n)
        .sort((a, b) => a - b);
      if (repetidas.length > 0) {
        findings.push({
          severidade: "critico",
          campo: "sequencia",
          mensagem: `${rotulo}: folha(s) repetida(s) no volume: ${repetidas.join(", ")}.`,
          detalhe: repetidas.map((n) => `folha ${n} aparece ${contagem.get(n)}x`).join(" | "),
        });
      }
    }

    // --- Disciplina: a prancha caiu no bloco certo? (CRÍTICO) ---------------
    const foraDoBloco: string[] = [];
    for (const p of doBloco) {
      const l = porPagina.get(p.pagina);
      if (!l || l.erro || !l.disciplina.trim() || !bloco) continue;
      const lida = normalizar(l.disciplina);
      const doPlano = normalizar(bloco);
      // O carimbo escreve a sigla ("EST") ou o nome ("ESTRUTURAL"); o plano tem
      // o código do bloco ("est"). Prefixo cobre os dois sem tabela de rótulos.
      if (!lida.startsWith(doPlano) && !doPlano.startsWith(lida)) {
        foraDoBloco.push(`p.${p.pagina}: carimbo diz "${l.disciplina}"`);
      }
    }
    if (foraDoBloco.length > 0) {
      findings.push({
        severidade: "critico",
        campo: "disciplina",
        mensagem: `${rotulo}: ${foraDoBloco.length} página(s) de outra disciplina dentro deste bloco.`,
        detalhe: juntar(foraDoBloco),
      });
    }
  }
```

- [ ] **Step 4: Rode e confirme que passa**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: `17 teste(s) ok`

- [ ] **Step 5: Commit**

```bash
git add server/nexo/volume-check-core.ts scripts/test-nexo-volume-check.ts
git commit -m "Conferencia do volume: conteudo pagina a pagina"
```

---

## Task 5: `volume-check-core.ts` — a LD impressa × o volume

**Files:**
- Modify: `server/nexo/volume-check-core.ts`
- Modify: `scripts/test-nexo-volume-check.ts`

**Interfaces:**
- Produces: `function parseLinhasDaLd(texto: string): LinhaDaLdImpressa[]`

- [ ] **Step 1: Escreva o teste que falha**

```ts
import { parseLinhasDaLd } from "../server/nexo/volume-check-core.ts";

// ---------------------------------------------------------------------------
// Task 5 — a LD impressa × o volume
// ---------------------------------------------------------------------------

/** Texto de uma página de LD como sai da extração posicional: uma linha por linha. */
const TEXTO_LD_EST = [
  "LISTA DE DOCUMENTOS",
  "FOLHA ARQUIVOS DESCRIÇÃO",
  "01/02 040_26_est_001_a FORMAS PISO",
  "02/02 040_26_est_002_a FORMAS TOPO",
].join("\n");

test("lê as linhas da LD impressa", () => {
  const linhas = parseLinhasDaLd(TEXTO_LD_EST);
  assert.deepEqual(linhas, [
    { sheet: "01/02", file: "040_26_est_001_a", description: "FORMAS PISO" },
    { sheet: "02/02", file: "040_26_est_002_a", description: "FORMAS TOPO" },
  ]);
});

test("o cabeçalho e o título da LD não viram linha", () => {
  assert.equal(parseLinhasDaLd("LISTA DE DOCUMENTOS\nFOLHA ARQUIVOS DESCRIÇÃO").length, 0);
});

/** Uma leitura completa com a LD do bloco est preenchida. */
function comLdImpressa(linhas: LinhaDaLdImpressa[]): LeituraDaPagina[] {
  // As páginas 3 e 4 são a LD do bloco est; a primeira carrega as linhas.
  return LEITURA_OK.map((l) => (l.pagina === 3 ? { ...l, linhasDaLd: linhas } : l));
}

test("LD impressa que bate com as pranchas não acusa nada", () => {
  const r = checkVolumeMontado(PLANO, comLdImpressa(parseLinhasDaLd(TEXTO_LD_EST)), ALVO);
  assert.equal(r.findings.find((x) => x.campo === "ld"), undefined);
  assert.equal(r.veredito, "ok", JSON.stringify(r.findings, null, 2));
});

test("LD VELHA (lista folha que não está no volume) é crítico", () => {
  const velha = parseLinhasDaLd(
    `${TEXTO_LD_EST}\n03/03 040_26_est_003_a DETALHES`,
  );
  const r = checkVolumeMontado(PLANO, comLdImpressa(velha), ALVO);
  const f = r.findings.find((x) => x.campo === "ld");
  assert.ok(f, "devia acusar a LD velha");
  assert.equal(f.severidade, "critico");
  assert.match(f.detalhe ?? "", /040_26_est_003_a/);
});

test("LD que não lista uma prancha presente é crítico", () => {
  const curta = parseLinhasDaLd("01/02 040_26_est_001_a FORMAS PISO");
  const r = checkVolumeMontado(PLANO, comLdImpressa(curta), ALVO);
  const f = r.findings.find((x) => x.campo === "ld");
  assert.ok(f);
  assert.equal(f.severidade, "critico");
});

test("bloco sem LD impressa legível não acusa (não dá para comparar)", () => {
  const r = checkVolumeMontado(PLANO, LEITURA_OK, ALVO);
  assert.equal(r.findings.find((x) => x.campo === "ld"), undefined);
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: 6 falhas novas.

- [ ] **Step 3: Implemente**

Em `server/nexo/volume-check-core.ts`, acrescente a função exportada:

```ts
/**
 * As linhas da LD como ela foi IMPRESSA no volume.
 *
 * O gabarito do plano vem das linhas ATUAIS da LD; esta leitura vem do papel que
 * está encadernado. As duas discordarem é exatamente o caso que se quer pegar:
 * o volume montado com uma LD gerada antes de alguém mexer nas folhas.
 *
 * O formato é sempre o mesmo — é a nossa própria LD, saída do template do
 * escritório: `NN/TT`, o código do arquivo, e o resto é a descrição. Por isso o
 * parse é por forma da linha, e não por posição de coluna: o texto extraído já
 * chega linha a linha, e ancorar na numeração é o que sobrevive a uma coluna
 * mudar de largura.
 */
export function parseLinhasDaLd(texto: string): LinhaDaLdImpressa[] {
  const linhas: LinhaDaLdImpressa[] = [];
  for (const bruta of texto.split("\n")) {
    const limpa = bruta.replace(/\s+/g, " ").trim();
    // Âncora: a linha de dado começa com a numeração da folha.
    const m = /^(\d{1,3}\s*\/\s*\d{1,3})\s+(\S+)\s*(.*)$/.exec(limpa);
    if (!m) continue;
    linhas.push({
      sheet: m[1].replace(/\s+/g, ""),
      file: m[2],
      description: m[3].trim(),
    });
  }
  return linhas;
}
```

E, dentro do laço `for (const bloco of blocosDoPlano)`, ao final:

```ts
    /*
     * --- A LD IMPRESSA × as pranchas que vieram depois dela (CRÍTICO) -------
     *
     * A LD é o documento que PROMETE o conteúdo do volume. Ela discordar do que
     * está encadernado logo abaixo é o defeito que não tem meio-termo: quem
     * recebe confere pela lista, e uma lista errada é pior do que lista nenhuma.
     *
     * Compara por CÓDIGO quando o bloco tem códigos distintos por folha; quando
     * a família imprime o mesmo código em todas (`arq`), o código não separa
     * nada e a comparação cai na CONTAGEM. É o mesmo fato da seção 3.2 do spec.
     */
    const paginaDaLd = esperado.find((p) => p.papel === "ld" && p.bloco === bloco);
    const leituraDaLd = paginaDaLd ? porPagina.get(paginaDaLd.pagina) : undefined;
    const impressa = leituraDaLd?.linhasDaLd;
    if (impressa && impressa.length > 0) {
      const codigosDoPlano = doBloco
        .map((p) => p.codigo?.trim())
        .filter((c): c is string => Boolean(c));
      const distintos = new Set(codigosDoPlano).size;

      if (distintos > 1 && distintos === codigosDoPlano.length) {
        const naLd = new Set(impressa.map((l) => l.file.trim().toLowerCase()));
        const noVolume = new Set(codigosDoPlano.map((c) => c.toLowerCase()));
        const soNaLd = [...naLd].filter((c) => !noVolume.has(c));
        const soNoVolume = [...noVolume].filter((c) => !naLd.has(c));
        if (soNaLd.length > 0 || soNoVolume.length > 0) {
          findings.push({
            severidade: "critico",
            campo: "ld",
            mensagem: `${rotulo}: a LD encadernada não bate com as pranchas do volume.`,
            detalhe: [
              soNaLd.length > 0 ? `na LD e ausentes do volume: ${juntar(soNaLd)}` : "",
              soNoVolume.length > 0 ? `no volume e ausentes da LD: ${juntar(soNoVolume)}` : "",
              "provável LD gerada antes da última mudança nas folhas.",
            ]
              .filter(Boolean)
              .join(" | "),
          });
        }
      } else if (impressa.length !== doBloco.length) {
        findings.push({
          severidade: "critico",
          campo: "ld",
          mensagem: `${rotulo}: a LD encadernada lista ${impressa.length} folha(s), mas o volume traz ${doBloco.length}.`,
          detalhe: "provável LD gerada antes da última mudança nas folhas.",
        });
      }
    }
```

- [ ] **Step 4: Rode e confirme que passa**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: `23 teste(s) ok`

- [ ] **Step 5: Commit**

```bash
git add server/nexo/volume-check-core.ts scripts/test-nexo-volume-check.ts
git commit -m "Conferencia do volume: LD impressa x pranchas encadernadas"
```

---

## Task 6: `volume-check-core.ts` — identidade e leitura parcial

**Files:**
- Modify: `server/nexo/volume-check-core.ts`
- Modify: `scripts/test-nexo-volume-check.ts`

- [ ] **Step 1: Escreva o teste que falha**

```ts
// ---------------------------------------------------------------------------
// Task 6 — identidade e leitura parcial
// ---------------------------------------------------------------------------

test("órgão de outra prefeitura no volume é crítico", () => {
  const lido = LEITURA_OK.map((l) =>
    l.pagina === 9 ? { ...l, orgao: "PREFEITURA MUNICIPAL DE CRICIUMA" } : l,
  );
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "orgao");
  assert.ok(f);
  assert.equal(f.severidade, "critico");
  assert.equal(r.veredito, "critico");
});

test("órgão em branco não acusa: o carimbo nem sempre traz", () => {
  const lido = LEITURA_OK.map((l) => (l.pagina === 9 ? { ...l, orgao: "" } : l));
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  assert.equal(r.findings.find((x) => x.campo === "orgao"), undefined);
});

test("obra divergente entre páginas do volume é crítico", () => {
  const lido = LEITURA_OK.map((l) =>
    l.pagina === 9 ? { ...l, obra: "AMPLIACAO DA ESCOLA MUNICIPAL" } : l,
  );
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "obra");
  assert.ok(f);
  assert.equal(f.severidade, "critico");
});

test("página que não deu para ler vira achado E impede o ok", () => {
  const lido = LEITURA_OK.map((l) =>
    l.pagina === 6 ? { ...l, erro: "tempo esgotado" } : l,
  );
  const r = checkVolumeMontado(PLANO, lido, ALVO);
  const f = r.findings.find((x) => x.campo === "leitura");
  assert.ok(f, "devia denunciar a página não conferida");
  assert.notEqual(r.veredito, "ok", "conferência parcial não aprova");
});

test("nada lido: não aprova e diz por quê", () => {
  const r = checkVolumeMontado(PLANO, [], { ...ALVO, pageCount: 11 });
  assert.notEqual(r.veredito, "ok");
  assert.equal(r.paginasConferidas, 0);
});
```

- [ ] **Step 2: Rode e confirme que falha**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: 5 falhas novas.

- [ ] **Step 3: Implemente**

Acrescente ao topo do módulo (junto de `normalizar`):

```ts
/**
 * Palavras que todo nome de prefeitura carrega e que, por isso, não identificam
 * ninguém. Mesma lista e mesma razão de `selo-identity-core.ts`: sem tirá-las,
 * "Prefeitura Municipal de Chapecó" e "Prefeitura Municipal de Criciúma"
 * casariam em três das quatro palavras — e a conferência aprovaria justamente o
 * erro que ela existe para pegar. Duplicada aqui porque núcleo puro não importa.
 */
const VAZIAS = new Set([
  "prefeitura", "municipal", "municipio", "de", "do", "da", "dos", "das", "e",
  "estado", "governo", "secretaria", "obras", "planejamento", "urbanismo",
  "desenvolvimento",
]);

/** O que RESTA de um nome de órgão depois de tirar o que é comum a todos. */
function nucleo(valor: string): string[] {
  return normalizar(valor)
    .split(" ")
    .filter((p) => p.length > 2 && !VAZIAS.has(p));
}

/** Dois nomes de órgão apontam para o mesmo município? `null` = não dá para dizer. */
function mesmoOrgao(a: string, b: string): boolean | null {
  const na = nucleo(a);
  const nb = nucleo(b);
  if (na.length === 0 || nb.length === 0) return null;
  return na.some((p) => nb.includes(p));
}
```

E, dentro de `checkVolumeMontado`, antes do cálculo do veredito:

```ts
  // --- Identidade: para QUEM este volume está indo (CRÍTICO) -----------------
  const outroOrgao = lido.filter(
    (l) => !l.erro && l.orgao.trim() && mesmoOrgao(l.orgao, alvo.orgao) === false,
  );
  if (outroOrgao.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "orgao",
      mensagem: `${outroOrgao.length} página(s) do volume apontam outro órgão que não ${alvo.orgao}.`,
      detalhe: juntar(outroOrgao.map((l) => `p.${l.pagina}: "${l.orgao}"`)),
    });
  }

  const obras = new Map<string, number[]>();
  for (const l of lido) {
    if (l.erro) continue;
    const chave = normalizar(l.obra);
    if (!chave) continue;
    if (!obras.has(chave)) obras.set(chave, []);
    obras.get(chave)!.push(l.pagina);
  }
  if (obras.size > 1) {
    findings.push({
      severidade: "critico",
      campo: "obra",
      mensagem: `Nomes de obra divergentes dentro do volume (${obras.size} versões) — prancha de outro projeto encadernada junto.`,
      detalhe: [...obras.entries()]
        .map(([obra, pgs]) => `"${obra}": ${juntar(pgs.map((p) => `p.${p}`))}`)
        .join(" | "),
    });
  }

  /*
   * --- Leitura parcial (AVISO, e trava o "ok") -----------------------------
   *
   * Mesma regra do auditor: análise parcial não aprova. O veredito "ok" afirma
   * que o volume foi conferido, e ele não foi — dizer "ok" sobre um documento
   * que não se olhou inteiro é a única saída pior do que não conferir.
   */
  const naoLidas = lido.filter((l) => l.erro);
  const faltantes = esperado.filter((p) => !porPagina.has(p.pagina));
  const semConferir = naoLidas.length + faltantes.length;
  if (semConferir > 0) {
    findings.push({
      severidade: "aviso",
      campo: "leitura",
      mensagem: `${semConferir} de ${esperado.length} página(s) não puderam ser conferidas — o veredito fala só do resto.`,
      detalhe: juntar([
        ...naoLidas.map((l) => `p.${l.pagina}: ${l.erro}`),
        ...faltantes.map((p) => `p.${p.pagina}: não lida`),
      ]),
    });
  }
```

- [ ] **Step 4: Rode e confirme que passa**

```
node scripts/test-nexo-volume-check.ts
```
Esperado: `28 teste(s) ok`

- [ ] **Step 5: Confira o tipo e commite**

```
npx tsc --noEmit -p tsconfig.json
git add server/nexo/volume-check-core.ts scripts/test-nexo-volume-check.ts
git commit -m "Conferencia do volume: identidade e leitura parcial"
```

---

## Task 7: A rota `/api/nexo/volume-check` e o flow do modelo

**Files:**
- Create: `app/api/nexo/volume-check/route.ts`
- Modify: `lib/ai-model-config.ts`
- Modify: `lib/ai-providers.ts`

**Interfaces:**
- Produces: `POST /api/nexo/volume-check`
  - body: `{ paginas: { pagina: number; imageDataUrl: string }[], conversationId?: string | null }`
  - 200: `{ leituras: LeituraDoCarimbo[], model: string, usage: { totalTokens: number } }`
  - `interface LeituraDoCarimbo { pagina: number; numeracaoTexto: string | null; folha: number | null; total: number | null; codigo: string | null; titulo: string | null; disciplina: string | null; orgao: string | null; obra: string | null }`

- [ ] **Step 1: Registre o flow do modelo**

Em `lib/ai-model-config.ts`, dentro de `AI_MODEL_FLOW_DEFINITIONS`, logo abaixo da
linha de `volume-suggestion`:

```ts
  { id: "volume-conferencia", label: "Volumes - conferência do volume montado" },
```

Em `lib/ai-providers.ts`, junto das outras constantes de default:

```ts
const DEFAULT_VOLUME_CONFERENCIA_MODEL = "gpt-5.4-mini";
```

e, no objeto de configuração, ao lado de `volumeSuggestion`:

```ts
    volumeConferencia: {
      provider: volumeProvider,
      model: getProviderModel(
        volumeProvider,
        getBackendValue("NEXODOC_VOLUME_CONFERENCIA_MODEL") ||
          DEFAULT_VOLUME_CONFERENCIA_MODEL,
        ["DEEPSEEK_VOLUME_CONFERENCIA_MODEL"],
        "volume-conferencia",
      ),
      keyConfigured: getProviderKeyConfigured(volumeProvider),
    },
```

- [ ] **Step 2: Escreva a rota**

Crie `app/api/nexo/volume-check/route.ts`. Espelhe `app/api/nexo/selo-check/route.ts`
— mesma estrutura de auth, teto, schema estrito e `executeOpenAiResponse`.

```ts
import { NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import {
  createInvalidProviderResponseError,
  getAiConfiguration,
} from "@/lib/ai-providers";
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { isNexoEnabled } from "@/lib/feature-flags";

export const runtime = "nodejs";

/**
 * LEITURA DO CARIMBO PÁGINA A PÁGINA do volume já montado.
 *
 * O modelo só LÊ — devolve o que enxerga em cada recorte e nunca um juízo. Quem
 * compara com o plano da montagem é `checkVolumeMontado`, determinístico e
 * testado. Um modelo que erra a leitura gera um achado errado, visível e
 * corrigível; um modelo que desse o veredito poderia aprovar no escuro o volume
 * com a folha trocada.
 *
 * Diferente de `/api/nexo/selo-check`, que confere uma AMOSTRA por bloco: aqui
 * o volume inteiro passa, porque a pergunta é outra — não "de quem é o brasão",
 * que é do volume todo, mas "a página 9 é a folha que a LD promete", que é de
 * cada página. O custo disso é uma chamada por lote de páginas, e está aceito no
 * spec (2026-08-04-conferencia-volume-montado-design.md, decisão 3).
 */

/** Páginas por chamada. Lote grande economiza overhead; grande demais estoura
 *  o teto de saída e degrada a leitura de cada imagem. */
const PAGINAS_POR_LOTE = 4;

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["leituras"],
  properties: {
    leituras: {
      type: "array",
      description:
        "Uma entrada por imagem recebida, NA MESMA ORDEM em que as imagens foram enviadas.",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "numeracaoTexto",
          "folha",
          "total",
          "codigo",
          "titulo",
          "disciplina",
          "orgao",
          "obra",
        ],
        properties: {
          numeracaoTexto: {
            type: ["string", "null"],
            description:
              "O campo PRANCHA exatamente como impresso (ex.: '01/16', '1 de 16'). null se não aparecer.",
          },
          folha: { type: ["number", "null"], description: "Número da folha lido nesse campo." },
          total: { type: ["number", "null"], description: "Total de folhas lido nesse campo." },
          codigo: {
            type: ["string", "null"],
            description: "Valor do campo ARQUIVO (ex.: '040_26_est_imp_001_a'). null se não aparecer.",
          },
          titulo: {
            type: ["string", "null"],
            description:
              "Valor do campo CONTEÚDO — só a descrição técnica da prancha, sem rótulos vizinhos.",
          },
          disciplina: {
            type: ["string", "null"],
            description:
              "Sigla ou nome da disciplina impressos no carimbo (ex.: 'EST', 'ESTRUTURAL'). null se não aparecer.",
          },
          orgao: {
            type: ["string", "null"],
            description: "Órgão/prefeitura como escrito no carimbo, por extenso.",
          },
          obra: { type: ["string", "null"], description: "Nome da obra como escrito no carimbo." },
        },
      },
    },
  },
} as const;

const INSTRUCOES = `Você lê carimbos (selos) de pranchas de projeto de engenharia.

Para CADA imagem recebida, devolva o que está ESCRITO nela. Nada mais.

- Copie os textos como aparecem. Não corrija, não complete, não traduza.
- Se um campo não estiver visível na imagem, devolva null. Nunca deduza.
- Não avalie se algo está certo ou errado. Não opine. Só leia.

A ordem do array de saída deve ser a mesma ordem das imagens recebidas.`;

interface PaginaRecebida {
  pagina: number;
  imageDataUrl: string;
}

function ehImagem(valor: unknown): valor is string {
  return typeof valor === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(valor);
}

export async function POST(req: NextRequest) {
  if (!isNexoEnabled()) {
    return NextResponse.json({ error: "Modulo Nexo desativado." }, { status: 404 });
  }
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
  }

  // Sem teto aqui, um volume de 200 páginas fura a proteção da fatura numa
  // montagem só — e a conferência é AUTOMÁTICA, então ninguém escolheu pagar.
  const teto = await verificarTetoMensal({
    userId: session.user.id ?? null,
    userEmail: session.user.email ?? null,
  });
  if (teto.estourou) {
    return NextResponse.json({ error: mensagemDeTetoEstourado(teto) }, { status: 402 });
  }

  let paginas: PaginaRecebida[];
  let conversationId: string | null = null;
  try {
    const body = (await req.json()) as { paginas?: unknown; conversationId?: unknown };
    if (!Array.isArray(body.paginas)) throw new Error("paginas ausente");
    paginas = body.paginas.map((raw, i) => {
      const p = raw as { pagina?: unknown; imageDataUrl?: unknown };
      if (typeof p.pagina !== "number") throw new Error(`paginas[${i}].pagina invalido`);
      if (!ehImagem(p.imageDataUrl)) throw new Error(`paginas[${i}].imageDataUrl invalido`);
      return { pagina: p.pagina, imageDataUrl: p.imageDataUrl };
    });
    if (typeof body.conversationId === "string" && body.conversationId.trim()) {
      conversationId = body.conversationId.trim();
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Corpo invalido." },
      { status: 400 },
    );
  }

  if (paginas.length === 0) {
    return NextResponse.json({ error: "Nenhuma pagina informada." }, { status: 400 });
  }
  if (paginas.length > PAGINAS_POR_LOTE) {
    return NextResponse.json(
      { error: `No maximo ${PAGINAS_POR_LOTE} paginas por chamada.` },
      { status: 400 },
    );
  }

  const configuracao = getAiConfiguration().volumeConferencia;
  const resultado = await executeOpenAiResponse({
    flow: "volume-conferencia",
    model: configuracao.model,
    operation: "nexo-volume-check",
    userEmail: session.user.email,
    conversationId,
    metadata: { paginas: paginas.map((p) => p.pagina) },
    request: {
      model: configuracao.model,
      max_output_tokens: 4000,
      reasoning: { effort: "none" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text" as const, text: INSTRUCOES },
            ...paginas.map((p) => ({
              type: "input_image" as const,
              image_url: p.imageDataUrl,
              detail: "high" as const,
            })),
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "leitura_do_volume",
          strict: true,
          schema,
        },
      },
    },
  });

  let leituras: Record<string, unknown>[];
  try {
    leituras = (JSON.parse(resultado.text) as { leituras: Record<string, unknown>[] }).leituras;
  } catch {
    throw createInvalidProviderResponseError();
  }

  /*
   * A página volta CASADA POR ÍNDICE com o que foi enviado, e não pelo que o
   * modelo disser: pedir o número da página na resposta convidaria a
   * alucinação a mover uma leitura de página, e mover leitura de página é
   * exatamente o defeito que esta conferência existe para pegar.
   */
  return NextResponse.json({
    leituras: paginas.map((p, i) => ({ pagina: p.pagina, ...(leituras[i] ?? {}) })),
    model: resultado.model,
  });
}
```

- [ ] **Step 3: Ensine o runner a conhecer o fluxo novo**

Isto NÃO é opcional: `AiProviderFlow` é uma união fechada, e sem o membro novo o
`flow: "volume-conferencia"` da rota não compila.

Em `lib/ai-providers.ts:7`, some o membro à união:

```ts
export type AiProviderFlow = "audit" | "audit-chat" | "nexo-agent" | "ld-extraction" | "volume-analysis" | "volume-suggestion" | "volume-conferencia";
```

Em `lib/ai-runner.ts`, dentro de `getProviderForFlow`, acrescente o `case` ANTES
do `default` (o `default` cai em `volumeAnalysis`, que usa outro modelo):

```ts
    case "volume-conferencia":
      return configuration.volumeConferencia.provider;
```

- [ ] **Step 4: Confira o tipo**

```
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem saída.

- [ ] **Step 5: Commit**

```bash
git add app/api/nexo/volume-check/route.ts lib/ai-model-config.ts lib/ai-providers.ts lib/ai-runner.ts
git commit -m "Rota de conferencia do volume montado e flow do modelo"
```

---

## Task 8: `volume-leitura.ts` — ler o PDF montado no cliente

**Files:**
- Create: `modules/nexo/lib/volume-leitura.ts`
- Modify: `modules/nexo/lib/generate.ts` (`postVolumeCheck`)

**Interfaces:**
- Consumes: `acharCaixaDoSelo`, `classificarPagina`, `textoPorPosicao` de
  `@/server/nexo/selo-regiao`; `repararTextoCad` de `@/server/nexo/texto-cad`;
  `parseLinhasDaLd` e `LeituraDaPagina` de `@/server/nexo/volume-check-core`.
- Produces:
  ```ts
  async function lerVolumeMontado(args: {
    pdfBase64: string;
    esperado: PaginaEsperada[];
    conversationId?: string | null;
    onProgresso?: (lidas: number, total: number) => void;
  }): Promise<LeituraDaPagina[]>
  ```

- [ ] **Step 1: Escreva o módulo**

Crie `modules/nexo/lib/volume-leitura.ts`:

```ts
/**
 * Leitura do VOLUME JÁ MONTADO — CLIENT-ONLY (usa canvas do browser).
 *
 * Abre o PDF final e devolve, por página, o que está escrito no carimbo. Não
 * julga nada: comparar com o plano é `checkVolumeMontado`.
 *
 * O RECORTE do "a IA lê tudo": página de LD ou separatriz é lida por EXTRAÇÃO DE
 * TEXTO, sem modelo. São PDFs que nós mesmos geramos, com texto limpo — mandá-los
 * a um modelo de visão é pagar para ler o que nós escrevemos. É também de onde
 * saem as linhas da LD impressa, que é o gabarito da conferência LD × volume.
 */
"use client";

import {
  acharCaixaDoSelo,
  classificarPagina,
  textoPorPosicao,
  type ItemPosicionado,
} from "@/server/nexo/selo-regiao";
import { repararTextoCad } from "@/server/nexo/texto-cad";
import {
  parseLinhasDaLd,
  type LeituraDaPagina,
} from "@/server/nexo/volume-check-core";
import type { PaginaEsperada } from "@/server/nexo/volume-plano";

import { postVolumeCheck } from "./generate";

/** Páginas por chamada — tem de casar com `PAGINAS_POR_LOTE` da rota. */
const PAGINAS_POR_LOTE = 4;
/** Lotes simultâneos. Três é o mesmo teto da leitura de selo. */
const LOTES_SIMULTANEOS = 3;

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfjsModule> | null = null;

async function carregarPdfjs(): Promise<PdfjsModule> {
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

function base64ParaBytes(base64: string): Uint8Array {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Uma leitura vazia — a página existe, mas nada foi lido dela ainda. */
function vazia(pagina: number): LeituraDaPagina {
  return {
    pagina,
    temCarimbo: false,
    numeracaoTexto: "",
    folha: null,
    total: null,
    codigo: "",
    titulo: "",
    disciplina: "",
    orgao: "",
    obra: "",
  };
}

export async function lerVolumeMontado(args: {
  pdfBase64: string;
  esperado: PaginaEsperada[];
  conversationId?: string | null;
  onProgresso?: (lidas: number, total: number) => void;
}): Promise<LeituraDaPagina[]> {
  const pdfjs = await carregarPdfjs();
  const doc = await pdfjs.getDocument({ data: base64ParaBytes(args.pdfBase64) }).promise;
  const papelDe = new Map(args.esperado.map((p) => [p.pagina, p.papel]));

  try {
    const resultados: LeituraDaPagina[] = [];
    /** As páginas de prancha, com o recorte do carimbo pronto para o modelo. */
    const paraOModelo: { pagina: number; imageDataUrl: string }[] = [];

    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const brutos = content.items
        .filter((r) => {
          const it = r as { str?: string; transform?: number[] };
          return typeof it.str === "string" && it.str.trim() && it.transform;
        })
        .map((r) => {
          const it = r as { str: string; fontName?: string };
          return { raw: r as { transform: number[] }, texto: it.str, fonte: it.fontName ?? "" };
        });
      const { textos } = repararTextoCad(brutos);
      const itens: ItemPosicionado[] = brutos.map((b, i) => {
        const [vx, vy] = viewport.convertToViewportPoint(b.raw.transform[4], b.raw.transform[5]);
        return { texto: textos[i].trim(), x: vx / viewport.width, y: vy / viewport.height };
      });

      const tipo = classificarPagina({
        largura: viewport.width,
        altura: viewport.height,
        itens,
      });
      const { caixa, ancoras } = acharCaixaDoSelo(itens);
      const leitura = vazia(n);
      // O carimbo é FATO da página, não opinião do modelo: são as âncoras.
      leitura.temCarimbo = tipo === "prancha" && ancoras > 0;

      const papel = papelDe.get(n);
      if (papel === "ld" || papel === "separatriz") {
        // Nosso próprio PDF: texto limpo, leitura de graça.
        leitura.linhasDaLd = parseLinhasDaLd(
          textoPorPosicao(itens, { x0: 0, y0: 0, x1: 1, y1: 1 }),
        );
        resultados.push(leitura);
      } else if (leitura.temCarimbo) {
        const { renderSeloCrop } = await import("./selo-render-crop");
        paraOModelo.push({ pagina: n, imageDataUrl: await renderSeloCrop(page as never, caixa) });
        resultados.push(leitura);
      } else {
        resultados.push(leitura);
      }
    }

    // Lotes ao modelo, com concorrência limitada.
    const lotes: { pagina: number; imageDataUrl: string }[][] = [];
    for (let i = 0; i < paraOModelo.length; i += PAGINAS_POR_LOTE) {
      lotes.push(paraOModelo.slice(i, i + PAGINAS_POR_LOTE));
    }

    const porPagina = new Map(resultados.map((r) => [r.pagina, r]));
    let feitas = 0;
    let cursor = 0;
    const trabalhador = async () => {
      for (;;) {
        const lote = lotes[cursor++];
        if (!lote) break;
        try {
          const leituras = await postVolumeCheck(lote, args.conversationId);
          for (const l of leituras) {
            const alvo = porPagina.get(l.pagina);
            if (!alvo) continue;
            alvo.numeracaoTexto = l.numeracaoTexto ?? "";
            alvo.folha = l.folha;
            alvo.total = l.total;
            alvo.codigo = l.codigo ?? "";
            alvo.titulo = l.titulo ?? "";
            alvo.disciplina = l.disciplina ?? "";
            alvo.orgao = l.orgao ?? "";
            alvo.obra = l.obra ?? "";
          }
        } catch (err) {
          // A página não some: vira erro, e erro trava o veredito "ok".
          const motivo = err instanceof Error ? err.message : "Falha ao ler a página.";
          for (const p of lote) {
            const alvo = porPagina.get(p.pagina);
            if (alvo) alvo.erro = motivo;
          }
        }
        feitas += lote.length;
        args.onProgresso?.(feitas, paraOModelo.length);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(LOTES_SIMULTANEOS, lotes.length) }, trabalhador),
    );

    return resultados;
  } finally {
    await doc.destroy();
  }
}
```

- [ ] **Step 2: Exponha `renderSeloCrop`**

`renderSeloCrop` hoje é privada em `modules/nexo/lib/selo-render.ts`. Extraia-a
para `modules/nexo/lib/selo-render-crop.ts`, exportada, e passe `selo-render.ts` a
importá-la de lá. É o mesmo motivo pelo qual `recortarSelo` já existe: recortar de
novo com outras constantes faria a conferência julgar um pedaço de papel diferente
daquele de onde saíram os dados.

Mova o corpo da função sem alterá-lo, junto das constantes `RENDER_SCALE` e
`MAX_IMAGE_EDGE` de que ela depende.

- [ ] **Step 3: Escreva `postVolumeCheck`**

Em `modules/nexo/lib/generate.ts`, ao lado de `postCheck`:

```ts
/** O que a rota devolve por página. Campos anuláveis: o modelo devolve null. */
export interface LeituraDoCarimbo {
  pagina: number;
  numeracaoTexto: string | null;
  folha: number | null;
  total: number | null;
  codigo: string | null;
  titulo: string | null;
  disciplina: string | null;
  orgao: string | null;
  obra: string | null;
}

/** Manda um lote de recortes de carimbo do volume montado e devolve as leituras. */
export async function postVolumeCheck(
  paginas: { pagina: number; imageDataUrl: string }[],
  conversationId?: string | null,
): Promise<LeituraDoCarimbo[]> {
  const res = await fetch("/api/nexo/volume-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paginas, conversationId }),
  });
  conferirSessao(res);
  if (!res.ok) {
    const p = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(p?.error ?? "Falha ao conferir o volume.");
  }
  const json = (await res.json()) as { leituras: LeituraDoCarimbo[] };
  return json.leituras;
}
```

- [ ] **Step 4: Confira o tipo**

```
npx tsc --noEmit -p tsconfig.json
```
Esperado: sem saída.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/lib/volume-leitura.ts modules/nexo/lib/selo-render-crop.ts modules/nexo/lib/selo-render.ts modules/nexo/lib/generate.ts
git commit -m "Leitura do volume montado no cliente"
```

---

## Task 9: A fiação — a conferência roda ao montar

**Files:**
- Modify: `modules/nexo/components/ConfirmationCard.tsx`

- [ ] **Step 1: Monte o plano e rode a conferência**

Em `ConfirmationCard.tsx`, no bloco do volume, logo após o `await assembleVolume(...)`
(por volta da linha 1490) e ANTES do `saveResult`, acrescente:

```ts
      /*
       * A conferência roda SOZINHA, e não atrás de um botão: montar é
       * irreversível na prática (o engenheiro manda o PDF), e uma conferência
       * que depende de alguém lembrar de clicar é conferência que não existe.
       * Ela NÃO bloqueia o download — quem decide é o engenheiro.
       */
      let conferencia: VolumeCheckResult | null = null;
      try {
        const partes: ParteDoPlano[] = (r.partes ?? []).map((p, i) => ({
          papel: p.role as ParteDoPlano["papel"],
          nome: p.name,
          paginas: p.paginas,
          // As partes saem na ordem canônica: capa, depois um bloco por
          // disciplina. `blocoDaParte` mapeia índice -> código do bloco.
          bloco: blocoDaParte(i, montaveis, Boolean(capaPdf64)),
        }));
        const blocosDoPlano: BlocoDoPlano[] = montaveis.map((b, i) => ({
          codigo: codigoDoBloco(b),
          folhas: linhasDaLdDoBloco(b).map((linha) => ({
            folha: parseInt(linha.sheet.split("/")[0] ?? "", 10) || null,
            total: parseInt(linha.sheet.split("/")[1] ?? "", 10) || null,
            codigo: linha.file || null,
            titulo: linha.description || null,
          })),
        }));
        const esperado = montarPlanoDePaginas(partes, blocosDoPlano);
        const lido = await lerVolumeMontado({
          pdfBase64: await urlToBase64(r.url),
          esperado,
          conversationId,
        });
        conferencia = checkVolumeMontado(esperado, lido, {
          orgao: orgaoAlvo,
          pageCount: r.pageCount ?? esperado.length,
        });
      } catch (err) {
        // Conferência que falha NÃO derruba a montagem: o volume está pronto.
        // O card mostra que ela não rodou, e é isso que precisa ficar visível.
        conferencia = {
          veredito: "aviso",
          paginasConferidas: 0,
          findings: [
            {
              severidade: "aviso",
              campo: "leitura",
              mensagem: "O volume foi montado, mas a conferência não pôde rodar.",
              detalhe: err instanceof Error ? err.message : "erro desconhecido",
            },
          ],
        };
      }
```

Some `conferencia` ao `payload` do `saveResult` do volume:

```ts
        payload: {
          tomo: tomo.numero,
          folhas: assinaturaDoTomo(selosDoTomo as Folha[]),
          conferencia,
        },
```

- [ ] **Step 2: Escreva os três auxiliares**

No mesmo arquivo, junto das outras funções auxiliares do módulo:

```ts
/**
 * O código do bloco (disciplina) de um `BlocoDoVolume`. Vem do primeiro selo —
 * todas as folhas do bloco compartilham a disciplina, que é o que define o bloco.
 */
function codigoDoBloco(bloco: BlocoDoVolume): string {
  const primeiro = bloco.selos[0];
  return primeiro ? (codigoDaFolha(primeiro as Folha) ?? "") : "";
}

/**
 * As linhas da LD daquele bloco — o gabarito do que o volume promete. Saem da
 * MESMA proposta que gerou a LD encadernada.
 */
function linhasDaLdDoBloco(bloco: BlocoDoVolume): { sheet: string; file: string; description: string }[] {
  return buildLdProposal(bloco.selos, { respeitarOrdem: true }).input.rows;
}

/**
 * A que bloco pertence a parte de índice `i`. As partes saem na ordem canônica
 * de `buildVolumeParts`: a capa (quando existe) e depois, por bloco, separatriz →
 * LD → pranchas. Reconstituir o dono de cada parte aqui evita mudar a assinatura
 * de `assembleVolume`, que é compartilhada com o painel de dev.
 *
 * DEPENDÊNCIA: isto só vale porque a montagem do Nexo NÃO pede `reorder` à rota
 * `/api/nexo/volume` — as partes chegam ao PDF na mesma ordem em que foram
 * enviadas. Se alguém ligar `reorder: true`, o servidor reordena e este
 * mapeamento passa a mentir em silêncio, atribuindo páginas ao bloco errado.
 * Nesse dia, o caminho certo é a montagem devolver o bloco em `PartePaginada`,
 * em vez de reconstituí-lo aqui.
 */
function blocoDaParte(i: number, blocos: BlocoDoVolume[], temCapa: boolean): string {
  let cursor = temCapa ? 1 : 0;
  if (i < cursor) return "";
  for (const bloco of blocos) {
    const quantas =
      (bloco.separatrizPdf64 ? 1 : 0) + (bloco.ldPdf64 ? 1 : 0) + bloco.pranchaFiles.length;
    if (i < cursor + quantas) return codigoDoBloco(bloco);
    cursor += quantas;
  }
  return "";
}
```

Some os imports necessários ao topo do arquivo:

```ts
import { montarPlanoDePaginas, type BlocoDoPlano, type ParteDoPlano } from "@/server/nexo/volume-plano";
import { checkVolumeMontado, type VolumeCheckResult } from "@/server/nexo/volume-check-core";
import { buildLdProposal } from "@/server/nexo/build-ld-proposal";
import { lerVolumeMontado } from "../lib/volume-leitura";
```

(`urlToBase64`, `codigoDaFolha` e `BlocoDoVolume` já são importados no arquivo.)

- [ ] **Step 3: Exiba o resultado no card**

Na renderização do card de volume, depois do bloco que mostra o PDF montado,
acrescente:

```tsx
      {/* A conferência do volume montado. Crítico pinta o card, mas o botão de
          baixar continua ativo: quem decide o que fazer com o volume é o
          engenheiro, e travar o download de um PDF já gerado só o empurraria
          para montar de novo às cegas. */}
      {conferenciaDoVolume && (
        <CheckResult result={conferenciaDoVolume} titulo="Volume montado" />
      )}
```

com, junto dos outros `getResult` do componente:

```ts
  const conferenciaDoVolume = (getResult(id)?.payload as
    | { conferencia?: VolumeCheckResult }
    | undefined)?.conferencia;
```

`CheckResult` aceita `LightCheckResult`, que é estruturalmente igual a
`VolumeCheckResult` nos campos que ele usa (`veredito`, `findings`) — passe o
objeto direto.

- [ ] **Step 4: Confira o tipo e o lint**

```
npx tsc --noEmit -p tsconfig.json
npx eslint modules/nexo/components/ConfirmationCard.tsx modules/nexo/lib/volume-leitura.ts server/nexo/volume-plano.ts server/nexo/volume-check-core.ts
```
Esperado: sem saída nos dois.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/ConfirmationCard.tsx
git commit -m "Volume montado confere a si mesmo, sem bloquear o download"
```

---

## Task 10: Prova de fiação no navegador, sem gastar token

Os núcleos puros provam as REGRAS. O que eles não alcançam é a FIAÇÃO: o plano
chegar com os blocos certos, o recorte sair da página certa do volume, e o
resultado aparecer no card. Este script persegue isso — **encenando a rota do
modelo**, para custar zero.

**Files:**
- Create: `scripts/shot-volume-check.mjs`

- [ ] **Step 1: Escreva o script**

**Molde: `scripts/shot-nexo-blocos.mjs`** — ele já SEMEIA a sessão com selos
prontos (sem gastar leitura de carimbo) e dirige o card do volume até ele
aparecer. Copie dali a montagem do estado inicial e a navegação; troque os selos
pelos do volume 10 de 040-26, que é misto (his · inc · spd) e por isso exercita
o `blocoDaParte` de verdade.

**A encenação usa `context.addInitScript` com `window.fetch` remendado**, e não
`page.route`: é o padrão dos shots deste repo, e é o que permite ASSERIR sobre o
que o cliente MANDOU (`window.__ENVIADO`), que aqui importa — o teste precisa
provar que os recortes enviados são das páginas certas do volume.

```js
// CONFERÊNCIA DO VOLUME MONTADO no NAVEGADOR — sem gastar um token.
//
// Encenado (custo zero): a rota /api/nexo/volume-check, que devolve leituras
// coerentes com o volume real montado. REAL: a montagem, o plano por página, o
// recorte do carimbo e o juízo — que é o caminho que se quer provar.
//
//   npm run dev                        (noutro terminal)
//   node scripts/shot-volume-check.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-volume-check";
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

/*
 * A encenação devolve, para cada recorte recebido, a leitura de um carimbo
 * COERENTE — numeração crescente, mesma obra, mesmo órgão. Um volume bem
 * montado tem de sair "ok" com isso; se sair crítico, o defeito é da fiação,
 * que é justamente o que este script existe para pegar.
 */
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

await context.addInitScript(() => {
  const original = window.fetch.bind(window);
  /** Os lotes que o cliente MANDOU conferir — é sobre isto que o teste assere. */
  window.__LOTES = [];

  window.fetch = async (entrada, init = {}) => {
    const url = typeof entrada === "string" ? entrada : entrada.url;
    if (url.includes("/api/nexo/volume-check")) {
      const corpo = JSON.parse(init.body ?? "{}");
      window.__LOTES.push((corpo.paginas ?? []).map((p) => p.pagina));
      /*
       * A encenação devolve um carimbo COERENTE para toda página: mesma obra,
       * mesmo órgão, e a numeração deixada em null (quem numera é o plano).
       * Um volume bem montado tem de sair "ok" com isso; se sair crítico, o
       * defeito é da FIAÇÃO, que é o que este script existe para pegar.
       */
      const leituras = (corpo.paginas ?? []).map((p) => ({
        pagina: p.pagina,
        numeracaoTexto: "",
        folha: null,
        total: null,
        codigo: null,
        titulo: null,
        disciplina: null,
        orgao: "PREFEITURA MUNICIPAL DE CHAPECO",
        obra: "REVITALIZACAO DA FEIRA MUNICIPAL DE CHAPECO",
      }));
      return new Response(JSON.stringify({ leituras, model: "encenado" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return original(entrada, init);
  };
});

const page = await context.newPage();
await pularTourGuiado(page, BASE);

// Semeia a sessão com os selos do volume 10 (his · inc · spd) e dirige até o
// card do volume — copie os dois trechos de `scripts/shot-nexo-blocos.mjs`
// (a constante de selos e a sequência que clica na proposta de volume).

await page.getByRole("button", { name: /montar o volume/i }).click();
await page.waitForSelector("text=/Volume montado/i", { timeout: 180000 });
// A conferência roda DEPOIS da montagem e é assíncrona: espera o semáforo dela.
await page.waitForSelector("text=/Volume montado ·/i", { timeout: 180000 });
await page.screenshot({ path: path.join(OUT, "card-do-volume.png"), fullPage: true });

const lotes = await page.evaluate(() => window.__LOTES ?? []);
const paginasConferidas = lotes.flat();
assert.ok(lotes.length > 0, "a conferência tem de ter chamado a rota de leitura");
assert.equal(
  new Set(paginasConferidas).size,
  paginasConferidas.length,
  "nenhuma página pode ser enviada duas vezes",
);
assert.ok(
  Math.min(...paginasConferidas) >= 1,
  "página 0 significa que o índice do PDF virou 0-based em algum lugar",
);

const semaforo = await page.locator('[data-slot="badge"]').last().innerText();
assert.match(semaforo, /Consistente|Revisar/, `veredito inesperado: ${semaforo}`);

await browser.close();
console.log(
  `ok — ${lotes.length} lote(s), ${paginasConferidas.length} página(s) conferida(s), veredito "${semaforo}". Imagens em ${OUT}`,
);
```

- [ ] **Step 2: Rode**

```
npm run dev            # noutro terminal
node scripts/shot-volume-check.mjs
```
Esperado: `ok — N lote(s) de leitura, veredito "Consistente"` e o PNG do card.

Se o veredito vier "Não emitir", leia os achados no screenshot: eles apontam
exatamente qual peça da fiação está errada (plano com bloco vazio, faixa de
páginas trocada, LD não lida).

- [ ] **Step 3: Rode a suíte inteira**

```
Get-ChildItem scripts -Filter "test-*.ts" | ForEach-Object { node $_.FullName }
```
Esperado: todas as suítes ok.

- [ ] **Step 4: Commit**

```bash
git add scripts/shot-volume-check.mjs
git commit -m "Prova da conferencia do volume no navegador, sem token"
```

---

## Cobertura do spec

| Requisito do spec | Tarefa |
| --- | --- |
| §4.1 plano por página | Tasks 1, 2 |
| §4.2 leitura (IA na prancha, texto na LD) | Tasks 7, 8 |
| §4.3 juízo puro | Tasks 3–6 |
| §5.1 estrutura (contagem, papel trocado) | Task 3 |
| §5.2 conteúdo (numeração, faixa, sequência, disciplina) | Task 4 |
| §5.3 LD impressa × volume | Task 5 |
| §5.4 identidade (órgão, obra) | Task 6 |
| §5.5 leitura parcial não aprova | Task 6 |
| §6 UI: automática ao montar, sem bloquear | Task 9 |
| §7 flow `volume-conferencia`, teto de gasto | Task 7 |
| §8 testes puros + prova no navegador sem token | Tasks 1–6, 10 |
