# Frame do documento — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O card "Vou gerar" deixa de ser lista de rótulo/valor e passa a ser o documento desenhado a partir do modelo ODT, com os campos editáveis no lugar em que serão impressos.

**Architecture:** Um leitor puro do `content.xml` devolve a estrutura de impressão (parágrafos, marcadores, alinhamento, corpo); a rota de templates a expõe com cache chaveado pela data do ODT; um componente único desenha o frame a partir dela e serve tanto o card (antes de gerar) quanto o nó do canvas (depois). As edições viram decisões de nível de conversa, mescladas por cima do que o agente propõe, com regra explícita de quem vence.

**Tech Stack:** Next.js App Router, TypeScript, React 19 (+ React Compiler lint), Tailwind, JSZip, Playwright, pdfjs-dist (legacy).

**Spec:** `docs/superpowers/specs/2026-08-06-frame-do-documento-design.md`

## Global Constraints

- **Módulos puros não importam runtime nem alias `@/`.** Só `import type` ou relativos extensionless. É o que permite `node scripts/test-*.ts` rodar sem bundler. `server/odt/index.ts` importa `@/lib/cover-utils` e por isso **não é testável em node cru** — daí a Tarefa 1.
- **Commit e push direto na `main`.** Não criar branch nem PR.
- **Nunca usar `git add -A`.** Sempre listar os arquivos.
- **Testes de navegador não gastam token:** encenar `/api/ld/extract-stamp` e `/api/nexo/agent` via `context.addInitScript`, como em `scripts/shot-nexo-frame-capa.mjs`.
- **Comentários e nomes em pt-BR**, seguindo o código existente. Comentário explica *por quê*, não *o quê*.
- **Node:** o `node` do projeto está em `C:\Users\matheus.mendes\AppData\Roaming\fnm\node-versions\v24.18.0\installation`. O `git` está em `C:\Users\matheus.mendes\AppData\Local\Programs\Git\cmd`. Ambos precisam entrar no `PATH` da sessão do PowerShell.
- **Verificação mínima antes de cada commit:** `npx tsc --noEmit` e `npx eslint <arquivos tocados>` limpos.

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `server/odt/marcadores.ts` **(novo, puro)** | Substituição de marcadores: distribuir linhas entre ocorrências, colapsar parágrafo vazio. Sai de `index.ts` para virar testável. |
| `server/odt/layout.ts` **(novo, puro)** | Ler o `content.xml` e devolver a estrutura de impressão. |
| `server/odt/index.ts` | Passa a usar `marcadores.ts` (Tarefa 1) e ganha o canal genérico de marcadores extras (Tarefa 12). |
| `server/templates/registry.ts` | Ganha `getTemplateLayout(id)` com cache por data do ODT. |
| `app/api/capas/templates/route.ts` | Devolve `layout` junto de cada template. |
| `modules/nexo/lib/decisoes.ts` **(novo, puro)** | Regra de precedência entre decisão do engenheiro e proposta do agente. |
| `modules/nexo/state/conversation-store.tsx` | Guarda e persiste `decisoes`. |
| `modules/nexo/components/FrameDoDocumento.tsx` **(novo)** | Desenha o frame a partir do layout. Usado nas duas casas. |
| `modules/nexo/components/PlanoDeGeracao.tsx` | O card vira o frame. |
| `modules/nexo/components/BlocoDaLd.tsx` **(novo)** | O bloco compacto da LD (cabeçalho + primeiras folhas). |
| `modules/nexo/components/EditorDoNo.tsx` | Passa a usar `FrameDoDocumento`. |
| `modules/nexo/components/FrameDaCapa.tsx` | **Apagado** na Tarefa 9. |

---

### Task 1: Extrair a substituição de marcadores para um módulo puro

Hoje `distribuirNosMarcadores` e `colapsarParagrafoDoMarcador` vivem em `server/odt/index.ts`, que importa `@/lib/cover-utils` e por isso não roda em node cru. Sem esta extração, nada do comportamento de marcador tem teste automatizado — e ele já produziu dois defeitos (obra duplicada, parágrafo vazio entre obra e bairro).

A dependência de escape entra **injetada**, que é o padrão do repositório para núcleo puro.

**Files:**
- Create: `server/odt/marcadores.ts`
- Create: `scripts/test-nexo-odt-marcadores.ts`
- Modify: `server/odt/index.ts` (remove as funções, importa do novo módulo)
- Modify: `package.json` (script `test:nexo:odt-marcadores`)

**Interfaces:**
- Consumes: nada (primeira tarefa).
- Produces:
  ```ts
  export function distribuirNosMarcadores(
    bloco: string,
    marcador: string,
    valor: string,
    escapar: (valor: string) => string,
  ): string;
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-odt-marcadores.ts`:

```ts
/**
 * Teste da SUBSTITUIÇÃO DE MARCADORES no modelo ODT.
 *
 * Dois comportamentos que já produziram defeito em produção e não tinham teste
 * porque viviam dentro de `server/odt/index.ts`, que importa por alias e não
 * roda em node cru:
 *
 *   1. marcador repetido DIVIDE o valor em linhas (com `replaceAll` o nome da
 *      obra saía duplicado nos dois parágrafos da capa de Criciúma);
 *   2. marcador sem conteúdo SOME COM O PARÁGRAFO (senão sobra uma linha em
 *      branco exatamente entre a obra e o bairro, numa obra de uma linha só).
 *
 * O escape entra injetado: aqui passamos a identidade, para as asserções
 * falarem de estrutura e não de entidades XML.
 *
 *   node scripts/test-nexo-odt-marcadores.ts
 */
import assert from "node:assert/strict";

import { distribuirNosMarcadores } from "../server/odt/marcadores.ts";

/** Escape neutro: o teste é sobre a estrutura, não sobre entidades XML. */
const cru = (v: string) => v;

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

const P = (estilo: string, dentro: string) =>
  `<text:p text:style-name="${estilo}">${dentro}</text:p>`;

// ---------------------------------------------------------------------------
// Uma ocorrência: o valor inteiro
// ---------------------------------------------------------------------------

test("com UMA ocorrência, o valor inteiro entra", () => {
  const bloco = P("P6", "{{NOME_OBRA}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{NOME_OBRA}}", "ESCOLA X", cru),
    P("P6", "ESCOLA X"),
  );
});

// ---------------------------------------------------------------------------
// Marcador repetido divide as linhas
// ---------------------------------------------------------------------------

test("duas ocorrências recebem uma linha cada — a obra não duplica", () => {
  const bloco = P("P6", "{{NOME_OBRA}}") + P("P7", "{{NOME_OBRA}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{NOME_OBRA}}", "REFORMA\nEMEB RAMOS", cru),
    P("P6", "REFORMA") + P("P7", "EMEB RAMOS"),
  );
});

test("a ÚLTIMA ocorrência recebe o que sobrar", () => {
  const bloco = P("P6", "{{T}}") + P("P7", "{{T}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{T}}", "A\nB\nC", cru),
    P("P6", "A") + P("P7", "B\nC"),
  );
});

// ---------------------------------------------------------------------------
// Ocorrência vazia SOME com o parágrafo
// ---------------------------------------------------------------------------

test("obra de uma linha: o 2º parágrafo some, o bairro fica colado", () => {
  const bloco =
    P("P6", "{{NOME_OBRA}}") + P("P7", "{{NOME_OBRA}}") + P("P8", "{{BAIRRO}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{NOME_OBRA}}", "UBS RENASCER", cru),
    P("P6", "UBS RENASCER") + P("P8", "{{BAIRRO}}"),
  );
});

test("campo opcional vazio não deixa linha em branco", () => {
  const bloco = P("P8", "{{BAIRRO}}") + P("P9", "VOLUME");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{BAIRRO}}", "", cru),
    P("P9", "VOLUME"),
  );
});

// ---------------------------------------------------------------------------
// O que NÃO pode colapsar
// ---------------------------------------------------------------------------

test("parágrafo com texto fixo em volta NÃO colapsa", () => {
  const bloco = P("P9", "VOLUME {{VOLUME}} – {{TITULO_CAPA}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{TITULO_CAPA}}", "", cru),
    P("P9", "VOLUME {{VOLUME}} – "),
  );
});

test("marcador ausente devolve o bloco intacto", () => {
  const bloco = P("P6", "sem marcador");
  assert.equal(distribuirNosMarcadores(bloco, "{{X}}", "v", cru), bloco);
});

test("o escape injetado é aplicado ao valor", () => {
  const bloco = P("P6", "{{X}}");
  assert.equal(
    distribuirNosMarcadores(bloco, "{{X}}", "a&b", (v) => v.replace("&", "&amp;")),
    P("P6", "a&amp;b"),
  );
});

console.log(`\n${passed} teste(s) ok.`);
```

- [ ] **Step 2: Rodar o teste e ver falhar**

```powershell
$env:PATH = "C:\Users\matheus.mendes\AppData\Roaming\fnm\node-versions\v24.18.0\installation;" + $env:PATH
node scripts/test-nexo-odt-marcadores.ts
```

Esperado: `ERR_MODULE_NOT_FOUND` — `server/odt/marcadores.ts` não existe.

- [ ] **Step 3: Criar o módulo puro**

Criar `server/odt/marcadores.ts` movendo o corpo que hoje está em `server/odt/index.ts` (funções `distribuirNosMarcadores`, `colapsarParagrafoDoMarcador`, `temTextoVisivel`), com o escape injetado:

```ts
/**
 * SUBSTITUIÇÃO DE MARCADORES no corpo do modelo ODT.
 *
 * Puro (nenhum import), para rodar em `node scripts/test-nexo-odt-marcadores.ts`.
 * Morava em `server/odt/index.ts`, que importa por alias e por isso nunca pôde
 * ser testado — e é o código que já produziu a obra duplicada na capa e a linha
 * em branco entre a obra e o bairro.
 *
 * O escape do XML entra INJETADO pela mesma razão: ele vive em
 * `@/lib/cover-utils`, que o node cru não resolve.
 */

/** Há texto de verdade aqui, fora das tags? */
function temTextoVisivel(xml: string): boolean {
  return xml.replace(/<[^>]*>/g, "").trim().length > 0;
}

/**
 * Remove o `<text:p>` que envolvia um marcador sem conteúdo, devolvendo o XML
 * já emendado — ou `null` quando não dá para colapsar com segurança.
 *
 * Recusa colapsar se sobrou texto visível dentro do parágrafo (o marcador
 * dividia espaço com texto fixo) ou se as tags não fecham como esperado.
 * Recusar é sempre seguro: cai no comportamento de deixar o parágrafo vazio.
 */
function colapsarParagrafoDoMarcador(
  antes: string,
  depois: string,
): string | null {
  const FECHA = "</text:p>";
  const abre = antes.lastIndexOf("<text:p");
  const fecha = depois.indexOf(FECHA);
  if (abre < 0 || fecha < 0) return null;

  // O parágrafo tem de ser aberto DEPOIS do último fechamento: senão o que
  // achamos é um ancestral, e apagá-lo levaria junto conteúdo alheio.
  if (antes.lastIndexOf(FECHA) > abre) return null;

  if (temTextoVisivel(antes.slice(abre)) || temTextoVisivel(depois.slice(0, fecha))) {
    return null;
  }
  return antes.slice(0, abre) + depois.slice(fecha + FECHA.length);
}

/**
 * O MARCADOR REPETIDO DIVIDE O VALOR EM LINHAS.
 *
 * Cada ocorrência recebe a sua linha; a ÚLTIMA recebe o que sobrar, para nada
 * se perder quando o texto tem mais linhas do que o modelo previu. A ocorrência
 * que não recebe nada SOME COM O PARÁGRAFO — deixá-lo vazio abriria uma linha
 * em branco entre a obra e o bairro, e a regra da capa é que o bairro venha
 * logo abaixo do nome.
 *
 * Com UMA ocorrência, o valor inteiro entra (as quebras viram
 * `<text:line-break/>` dentro do `escapar` que o chamador injeta).
 */
export function distribuirNosMarcadores(
  bloco: string,
  marcador: string,
  valor: string,
  escapar: (valor: string) => string,
): string {
  const partes = bloco.split(marcador);
  const quantos = partes.length - 1;
  if (quantos <= 0) return bloco;

  const linhas = valor
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const conteudoDe = (i: number) =>
    quantos === 1
      ? valor
      : i === quantos - 1
        ? linhas.slice(i).join("\n")
        : (linhas[i] ?? "");

  let saida = partes[0];
  for (let i = 0; i < quantos; i++) {
    const conteudo = conteudoDe(i);
    const resto = partes[i + 1];

    if (!conteudo.trim()) {
      const semParagrafo = colapsarParagrafoDoMarcador(saida, resto);
      if (semParagrafo !== null) {
        saida = semParagrafo;
        continue;
      }
    }
    saida += escapar(conteudo) + resto;
  }
  return saida;
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

```powershell
node scripts/test-nexo-odt-marcadores.ts
```

Esperado: `8 teste(s) ok.`

- [ ] **Step 5: Ligar no `server/odt/index.ts`**

Em `server/odt/index.ts`: apagar as três funções movidas e importar do novo módulo. Todas as chamadas passam a levar `markerXmlValue` como quarto argumento:

```ts
import { distribuirNosMarcadores } from "./marcadores";
```

```ts
    for (const [marker, value] of Object.entries(replacements)) {
      block = distribuirNosMarcadores(block, marker, value, markerXmlValue);
    }

    block = distribuirNosMarcadores(block, "{{TITULO_CAPA}}", page.tituloCapa, markerXmlValue);
```

- [ ] **Step 6: Registrar o script e verificar**

Em `package.json`, ao lado de `test:nexo:capa-linhas`:

```json
    "test:nexo:odt-marcadores": "node scripts/test-nexo-odt-marcadores.ts",
```

```powershell
npx tsc --noEmit
npx eslint server/odt/index.ts server/odt/marcadores.ts
node scripts/shot-nexo-frame-capa.mjs
```

Esperado: `tsc` e `eslint` sem saída. O shot mantém o mesmo resultado de antes desta tarefa (a checagem "obra de 2 linhas + 3 disciplinas cabe em uma página" continua falhando — é dívida conhecida do modelo, não regressão).

- [ ] **Step 7: Commit**

```powershell
$env:PATH = "C:\Users\matheus.mendes\AppData\Local\Programs\Git\cmd;" + $env:PATH
git add server/odt/marcadores.ts server/odt/index.ts scripts/test-nexo-odt-marcadores.ts package.json
git commit -m "ODT: a substituicao de marcadores vira modulo puro e ganha teste"
```

---

### Task 2: O leitor do layout do modelo

**Files:**
- Create: `server/odt/layout.ts`
- Create: `scripts/test-nexo-odt-layout.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada da Tarefa 1 (independente).
- Produces:
  ```ts
  export type ParteDoParagrafo =
    | { tipo: "texto"; valor: string }
    | { tipo: "marcador"; nome: string }
    | { tipo: "quebrado"; bruto: string };

  export interface ParagrafoDoModelo {
    indice: number;
    alinhamento: "start" | "center" | "end";
    corpo?: number;
    partes: ParteDoParagrafo[];
  }

  export function lerLayoutDoModelo(contentXml: string): ParagrafoDoModelo[];
  export function marcadoresDoLayout(layout: ParagrafoDoModelo[]): string[];
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-odt-layout.ts`:

```ts
/**
 * Teste do LEITOR DO LAYOUT do modelo de capa.
 *
 * É a leitura que foi feita à mão para diagnosticar a obra duplicada e o
 * `{{TOMO}}` partido em spans. Vira código porque o frame do documento passa a
 * ser desenhado a partir dela: se o leitor erra, o frame mostra uma coisa e o
 * PDF sai outra — o defeito que este trabalho existe para matar.
 *
 * Contra os modelos REAIS o teste afirma INVARIANTES, não estruturas fixas:
 * assim ele acusa uma edição que quebre um modelo sem quebrar a cada ajuste de
 * espaçamento que o engenheiro fizer.
 *
 *   node scripts/test-nexo-odt-layout.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

import { lerLayoutDoModelo, marcadoresDoLayout } from "../server/odt/layout.ts";

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

// ---------------------------------------------------------------------------
// Fixtures — casos exatos, inclusive o defeito real
// ---------------------------------------------------------------------------

const ESTILOS = `<office:automatic-styles>
<style:style style:name="P6" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/><style:text-properties fo:font-size="16pt"/></style:style>
<style:style style:name="P11" style:family="paragraph"><style:paragraph-properties fo:text-align="end"/><style:text-properties fo:font-size="14pt"/></style:style>
</office:automatic-styles>`;

const corpo = (dentro: string) =>
  `<?xml version="1.0"?><office:document-content>${ESTILOS}<office:body><office:text>${dentro}</office:text></office:body></office:document-content>`;

test("um marcador sozinho vira uma parte de marcador", () => {
  const l = lerLayoutDoModelo(corpo('<text:p text:style-name="P6">{{NOME_OBRA}}</text:p>'));
  assert.equal(l.length, 1);
  assert.deepEqual(l[0].partes, [{ tipo: "marcador", nome: "NOME_OBRA" }]);
});

test("o alinhamento e o corpo saem do estilo do parágrafo", () => {
  const l = lerLayoutDoModelo(corpo('<text:p text:style-name="P11">{{TOMO}}</text:p>'));
  assert.equal(l[0].alinhamento, "end");
  assert.equal(l[0].corpo, 14);
});

test("texto fixo e marcador convivem na mesma linha, em ordem", () => {
  const l = lerLayoutDoModelo(
    corpo('<text:p text:style-name="P6">VOLUME {{VOLUME}} – {{TITULO_CAPA}}</text:p>'),
  );
  assert.deepEqual(l[0].partes, [
    { tipo: "texto", valor: "VOLUME " },
    { tipo: "marcador", nome: "VOLUME" },
    { tipo: "texto", valor: " – " },
    { tipo: "marcador", nome: "TITULO_CAPA" },
  ]);
});

test("o marcador PARTIDO em spans é detectado, não ignorado", () => {
  // O caso real: `{{TOMO}}` digitado como `{{(TOMO)}}` e ainda quebrado pelo
  // LibreOffice em <text:span> próprios. Nunca casaria com "{{TOMO}}".
  const l = lerLayoutDoModelo(
    corpo(
      '<text:p text:style-name="P6">{{<text:span text:style-name="T6">(</text:span>TOMO<text:span text:style-name="T6">)</text:span>}}</text:p>',
    ),
  );
  assert.deepEqual(l[0].partes, [{ tipo: "quebrado", bruto: "{{(TOMO)}}" }]);
});

test("parágrafo vazio aparece no layout, sem partes", () => {
  const l = lerLayoutDoModelo(corpo('<text:p text:style-name="P6"/>'));
  assert.equal(l.length, 1);
  assert.deepEqual(l[0].partes, []);
});

test("a ordem de impressão é preservada no índice", () => {
  const l = lerLayoutDoModelo(
    corpo(
      '<text:p text:style-name="P6">{{A}}</text:p><text:p text:style-name="P6">{{B}}</text:p>',
    ),
  );
  assert.deepEqual(
    l.map((p) => p.indice),
    [0, 1],
  );
});

test("marcadoresDoLayout lista os nomes, sem repetir", () => {
  const l = lerLayoutDoModelo(
    corpo(
      '<text:p text:style-name="P6">{{NOME_OBRA}}</text:p><text:p text:style-name="P6">{{NOME_OBRA}}</text:p><text:p text:style-name="P6">{{BAIRRO}}</text:p>',
    ),
  );
  assert.deepEqual(marcadoresDoLayout(l), ["NOME_OBRA", "BAIRRO"]);
});

// ---------------------------------------------------------------------------
// Contra os modelos REAIS — invariantes
// ---------------------------------------------------------------------------

const RAIZ = path.resolve("templates/capas");
const pastas = fs
  .readdirSync(RAIZ, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith("_"))
  .map((e) => e.name);

console.log(`\nModelos reais: ${pastas.join(", ")}`);

for (const pasta of pastas) {
  const config = JSON.parse(
    fs.readFileSync(path.join(RAIZ, pasta, "config.json"), "utf-8"),
  ) as { arquivoTemplate: string };
  const odt = path.join(RAIZ, pasta, config.arquivoTemplate);
  const zip = await JSZip.loadAsync(fs.readFileSync(odt));
  const xml = await zip.file("content.xml")!.async("string");
  const layout = lerLayoutDoModelo(xml);

  test(`${pasta}: produz parágrafos`, () => {
    assert.ok(layout.length > 0, "nenhum parágrafo lido");
  });

  test(`${pasta}: produz ao menos um marcador`, () => {
    assert.ok(marcadoresDoLayout(layout).length > 0, "nenhum marcador");
  });

  test(`${pasta}: nenhum marcador quebrado`, () => {
    const quebrados = layout
      .flatMap((p) => p.partes)
      .filter((x) => x.tipo === "quebrado");
    assert.deepEqual(quebrados, [], `marcador(es) quebrado(s) em ${pasta}`);
  });

  test(`${pasta}: todo parágrafo tem alinhamento`, () => {
    for (const p of layout) {
      assert.ok(
        ["start", "center", "end"].includes(p.alinhamento),
        `parágrafo ${p.indice} sem alinhamento`,
      );
    }
  });
}

console.log(`\n${passed} teste(s) ok.`);
```

- [ ] **Step 2: Rodar e ver falhar**

```powershell
node scripts/test-nexo-odt-layout.ts
```

Esperado: `ERR_MODULE_NOT_FOUND` — `server/odt/layout.ts` não existe.

- [ ] **Step 3: Implementar o leitor**

Criar `server/odt/layout.ts`:

```ts
/**
 * A ESTRUTURA DE IMPRESSÃO do modelo ODT.
 *
 * Devolve, na ordem em que saem, os parágrafos do corpo: os marcadores que cada
 * um contém, o texto fixo em volta, o alinhamento e o corpo da fonte. É a
 * leitura que foi feita à mão para diagnosticar a obra duplicada e o `{{TOMO}}`
 * partido em spans — vira código porque o frame do documento passa a ser
 * desenhado a partir dela.
 *
 * O leitor tira as tags de DENTRO do parágrafo antes de procurar marcador. Sem
 * isso, um marcador que o LibreOffice partiu em `<text:span>` passaria
 * despercebido — que é exatamente como `{{(TOMO)}}` chegou à produção sem que
 * nada acusasse.
 *
 * PURO: nenhum import. Roda em `node scripts/test-nexo-odt-layout.ts`.
 */

export type ParteDoParagrafo =
  | { tipo: "texto"; valor: string }
  | { tipo: "marcador"; nome: string }
  | { tipo: "quebrado"; bruto: string };

export interface ParagrafoDoModelo {
  /** Ordem de impressão. */
  indice: number;
  alinhamento: "start" | "center" | "end";
  /** Corpo da fonte em pt, quando o estilo o declara. */
  corpo?: number;
  partes: ParteDoParagrafo[];
}

/** Nome de marcador aceito pelo gerador: MAIÚSCULAS, dígitos e `_`. */
const NOME_VALIDO = /^[A-Z_][A-Z0-9_]*$/;

/** Alinhamento por nome de estilo, lido de `<office:automatic-styles>`. */
function lerEstilos(xml: string): Map<string, { alinhamento: string; corpo?: number }> {
  const mapa = new Map<string, { alinhamento: string; corpo?: number }>();
  const blocos = xml.match(/<style:style\b[\s\S]*?<\/style:style>/g) ?? [];
  for (const bloco of blocos) {
    const nome = /style:name="([^"]+)"/.exec(bloco)?.[1];
    if (!nome) continue;
    const alinhamento = /fo:text-align="([^"]+)"/.exec(bloco)?.[1] ?? "start";
    const pt = /fo:font-size="([\d.]+)pt"/.exec(bloco)?.[1];
    mapa.set(nome, {
      alinhamento,
      ...(pt ? { corpo: Number(pt) } : {}),
    });
  }
  return mapa;
}

/** "end"/"right" → end; "center" → center; o resto → start. */
function normalizarAlinhamento(bruto: string): "start" | "center" | "end" {
  if (bruto === "center") return "center";
  if (bruto === "end" || bruto === "right") return "end";
  return "start";
}

/**
 * Quebra o texto do parágrafo em texto fixo e marcadores.
 *
 * O que parece marcador mas não tem nome válido sai como `quebrado` — é o único
 * jeito de o frame poder mostrar o problema em vez de desenhar um campo que
 * nunca será preenchido.
 */
function partesDoTexto(texto: string): ParteDoParagrafo[] {
  const partes: ParteDoParagrafo[] = [];
  const re = /\{\{([^{}]*)\}\}/g;
  let ultimo = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(texto)) !== null) {
    if (m.index > ultimo) {
      partes.push({ tipo: "texto", valor: texto.slice(ultimo, m.index) });
    }
    const nome = m[1];
    partes.push(
      NOME_VALIDO.test(nome)
        ? { tipo: "marcador", nome }
        : { tipo: "quebrado", bruto: m[0] },
    );
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) {
    const resto = texto.slice(ultimo);
    if (resto) partes.push({ tipo: "texto", valor: resto });
  }
  return partes;
}

export function lerLayoutDoModelo(contentXml: string): ParagrafoDoModelo[] {
  const estilos = lerEstilos(contentXml);

  const inicio = contentXml.indexOf("<office:body");
  const corpoXml = inicio >= 0 ? contentXml.slice(inicio) : contentXml;

  const paragrafos =
    corpoXml.match(/<text:p\b[^>]*>[\s\S]*?<\/text:p>|<text:p\b[^>]*\/>/g) ?? [];

  return paragrafos.map((bruto, indice) => {
    const nomeDoEstilo = /text:style-name="([^"]+)"/.exec(bruto)?.[1] ?? "";
    const estilo = estilos.get(nomeDoEstilo);
    // As tags de DENTRO saem antes da busca por marcador: é o que enxerga o
    // marcador que o LibreOffice partiu em spans.
    const texto = bruto
      .replace(/^<text:p\b[^>]*>/, "")
      .replace(/<\/text:p>$/, "")
      .replace(/<[^>]*>/g, "");

    return {
      indice,
      alinhamento: normalizarAlinhamento(estilo?.alinhamento ?? "start"),
      ...(estilo?.corpo !== undefined ? { corpo: estilo.corpo } : {}),
      partes: partesDoTexto(texto),
    };
  });
}

/** Os nomes de marcador do modelo, na ordem de impressão e sem repetir. */
export function marcadoresDoLayout(layout: ParagrafoDoModelo[]): string[] {
  const vistos: string[] = [];
  for (const p of layout) {
    for (const parte of p.partes) {
      if (parte.tipo === "marcador" && !vistos.includes(parte.nome)) {
        vistos.push(parte.nome);
      }
    }
  }
  return vistos;
}
```

- [ ] **Step 4: Rodar e ver passar**

```powershell
node scripts/test-nexo-odt-layout.ts
```

Esperado: todos `ok`, incluindo os quatro modelos reais (`pmcriciuma`, `prefchap`, `prefflor`, `prefsjose`).

Se algum modelo real acusar "marcador quebrado", **isso é achado, não falha do teste**: registre qual modelo e qual marcador, e conserte o ODT como foi feito com o `{{TOMO}}` de Criciúma.

- [ ] **Step 5: Registrar o script**

```json
    "test:nexo:odt-layout": "node scripts/test-nexo-odt-layout.ts",
```

- [ ] **Step 6: Verificar e commitar**

```powershell
npx tsc --noEmit
npx eslint server/odt/layout.ts
```

```powershell
git add server/odt/layout.ts scripts/test-nexo-odt-layout.ts package.json
git commit -m "ODT: leitor da estrutura de impressao do modelo"
```

---

### Task 3: A rota de templates devolve o layout

**Files:**
- Modify: `server/templates/registry.ts`
- Modify: `app/api/capas/templates/route.ts`

**Interfaces:**
- Consumes: `lerLayoutDoModelo`, `ParagrafoDoModelo` (Tarefa 2).
- Produces:
  ```ts
  export async function getTemplateLayout(
    templateId: string,
  ): Promise<ParagrafoDoModelo[] | null>;
  ```
  E a resposta de `GET /api/capas/templates` passa a ser
  `{ templates: (TemplateConfigFile & { layout: ParagrafoDoModelo[] })[] }`.

- [ ] **Step 1: Acrescentar `getTemplateLayout` ao registry**

Em `server/templates/registry.ts`, depois de `getTemplateOdtPath`:

```ts
import { readdir, readFile, access, stat } from "fs/promises";
import { lerLayoutDoModelo, type ParagrafoDoModelo } from "@/server/odt/layout";
```

```ts
/**
 * O layout do modelo, com cache CHAVEADO PELA DATA DO ARQUIVO.
 *
 * O `cachedTemplates` acima nunca invalida, e isso não morde porque o ODT é
 * lido fresco a cada geração. Pendurar o layout no mesmo cache faria uma edição
 * no modelo exigir reiniciar o servidor — e quem edita o modelo é o engenheiro,
 * no meio do trabalho. A data de modificação resolve sem cerimônia.
 */
const cachedLayouts = new Map<string, { mtimeMs: number; layout: ParagrafoDoModelo[] }>();

export async function getTemplateLayout(
  templateId: string,
): Promise<ParagrafoDoModelo[] | null> {
  const odtPath = await getTemplateOdtPath(templateId);
  if (!odtPath) return null;

  const { mtimeMs } = await stat(odtPath);
  const guardado = cachedLayouts.get(templateId);
  if (guardado && guardado.mtimeMs === mtimeMs) return guardado.layout;

  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await readFile(odtPath));
  const arquivo = zip.file("content.xml");
  if (!arquivo) return null;

  const layout = lerLayoutDoModelo(await arquivo.async("string"));
  cachedLayouts.set(templateId, { mtimeMs, layout });
  return layout;
}
```

- [ ] **Step 2: Devolver o layout na rota**

Substituir `app/api/capas/templates/route.ts` inteiro:

```ts
import { NextResponse } from "next/server";
import { getTemplateRegistry, getTemplateLayout } from "@/server/templates/registry";

export async function GET() {
  try {
    const registry = await getTemplateRegistry();
    /*
     * O LAYOUT vai junto: o cliente já busca esta rota para montar o seletor de
     * prefeitura, e o frame do documento precisa da estrutura do modelo para se
     * desenhar. Endpoint separado seria uma ida a mais para ligar sem ganho.
     *
     * Modelo ilegível não derruba a lista: ele volta com `layout: []`, e o card
     * cai para a lista de rótulo/valor.
     */
    const templates = await Promise.all(
      registry.map(async (t) => ({
        ...t,
        layout: (await getTemplateLayout(t.id).catch(() => null)) ?? [],
      })),
    );
    return NextResponse.json({ templates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verificar no servidor**

```powershell
npm run dev
```

Noutro terminal:

```powershell
curl.exe -s http://localhost:3000/api/capas/templates | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const t=JSON.parse(s).templates;for(const x of t)console.log(x.id, x.layout.length, 'paragrafos')})"
```

Esperado: quatro linhas, cada uma com um número de parágrafos maior que zero. Ex.: `pmcriciuma 21 paragrafos`.

- [ ] **Step 4: Provar que o cache respeita a edição do modelo**

Tocar a data do ODT e conferir que o número muda quando o arquivo muda:

```powershell
(Get-Item templates\capas\pmcriciuma\modelo_capa.odt).LastWriteTime = Get-Date
curl.exe -s http://localhost:3000/api/capas/templates | Select-String -Pattern '"id":"pmcriciuma"'
```

Esperado: responde sem erro e **sem reiniciar o servidor**. (Se tivesse ficado preso no `cachedTemplates`, só reiniciar traria o layout novo.)

- [ ] **Step 5: Verificar e commitar**

```powershell
npx tsc --noEmit
npx eslint server/templates/registry.ts app/api/capas/templates/route.ts
```

```powershell
git add server/templates/registry.ts app/api/capas/templates/route.ts
git commit -m "Templates: a rota devolve o layout do modelo, com cache por data do arquivo"
```

---

### Task 4: A regra de precedência entre decisão e proposta

**Files:**
- Create: `modules/nexo/lib/decisoes.ts`
- Create: `scripts/test-nexo-decisoes.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export interface Decisao { valor: string; sobre: string }
  export type DecisoesDoProjeto = Record<string, Decisao>;
  export const CAMPOS_DECIDIVEIS: readonly string[];
  export function anotarDecisao(
    atuais: DecisoesDoProjeto,
    campo: string,
    valor: string,
    propostoPeloAgente: string,
  ): DecisoesDoProjeto;
  export function mesclarDecisoes(
    decisoes: DecisoesDoProjeto,
    paramsDoAgente: Record<string, string>,
  ): { valores: Record<string, string>; vivas: DecisoesDoProjeto };
  ```

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-decisoes.ts`:

```ts
/**
 * Teste da PRECEDÊNCIA entre a decisão do engenheiro e a proposta do agente.
 *
 * "Correção aceita e revertida sem aviso" já aconteceu duas vezes neste
 * projeto. Aqui está a regra que impede a terceira:
 *
 *   cada decisão guarda o valor do agente que ela substituiu. No turno
 *   seguinte, se o agente mudou de ideia ele vence; se repetiu o mesmo valor,
 *   a decisão do engenheiro fica.
 *
 * Sem isso o `numTomos` é o caso feio: o agente recalcula os 6 tomos todo
 * turno, e a troca manual para 4 seria desfeita em silêncio a cada mensagem.
 *
 *   node scripts/test-nexo-decisoes.ts
 */
import assert from "node:assert/strict";

import { anotarDecisao, mesclarDecisoes } from "../modules/nexo/lib/decisoes.ts";

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

// ---------------------------------------------------------------------------
// Anotar
// ---------------------------------------------------------------------------

test("a decisão guarda o valor do agente que ela substituiu", () => {
  const d = anotarDecisao({}, "tituloCapa", "PROJETO ESTRUTURAL", "");
  assert.deepEqual(d.tituloCapa, { valor: "PROJETO ESTRUTURAL", sobre: "" });
});

test("decidir o mesmo que o agente propôs não cria decisão", () => {
  const d = anotarDecisao({}, "numTomos", "6", "6");
  assert.deepEqual(d, {});
});

test("apagar o campo desfaz a decisão", () => {
  const antes = anotarDecisao({}, "tituloCapa", "X", "");
  assert.deepEqual(anotarDecisao(antes, "tituloCapa", "", ""), {});
});

test("decidir um campo não mexe nos outros", () => {
  const antes = anotarDecisao({}, "tituloCapa", "X", "");
  const depois = anotarDecisao(antes, "volume", "6", "");
  assert.deepEqual(Object.keys(depois).sort(), ["tituloCapa", "volume"]);
});

// ---------------------------------------------------------------------------
// Mesclar — a regra que importa
// ---------------------------------------------------------------------------

test("o agente REPETIU o valor: a decisão do engenheiro fica", () => {
  const d = anotarDecisao({}, "numTomos", "4", "6");
  const r = mesclarDecisoes(d, { numTomos: "6" });
  assert.equal(r.valores.numTomos, "4");
  assert.ok(r.vivas.numTomos, "a decisão deveria continuar viva");
});

test("o agente MUDOU de ideia: o agente vence e a decisão cai", () => {
  const d = anotarDecisao({}, "tituloCapa", "MEU TITULO", "");
  const r = mesclarDecisoes(d, { tituloCapa: "TITULO NOVO DO AGENTE" });
  assert.equal(r.valores.tituloCapa, "TITULO NOVO DO AGENTE");
  assert.equal(r.vivas.tituloCapa, undefined);
});

test("campo sem decisão passa direto o que o agente propôs", () => {
  const r = mesclarDecisoes({}, { volume: "6" });
  assert.equal(r.valores.volume, "6");
});

test("decisão sobre campo que o agente não propôs continua valendo", () => {
  const d = anotarDecisao({}, "bairroFake", "X", "");
  const r = mesclarDecisoes(d, {});
  assert.equal(r.valores.bairroFake, "X");
  assert.ok(r.vivas.bairroFake);
});

test("o título vazio do agente não apaga a decisão do engenheiro", () => {
  // O agente devolve `tituloCapa: ""` de propósito quando ninguém lhe deu um.
  const d = anotarDecisao({}, "tituloCapa", "PROJETO ESTRUTURAL", "");
  const r = mesclarDecisoes(d, { tituloCapa: "" });
  assert.equal(r.valores.tituloCapa, "PROJETO ESTRUTURAL");
});

console.log(`\n${passed} teste(s) ok.`);
```

- [ ] **Step 2: Rodar e ver falhar**

```powershell
node scripts/test-nexo-decisoes.ts
```

Esperado: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Criar `modules/nexo/lib/decisoes.ts`:

```ts
/**
 * AS DECISÕES do engenheiro sobre o documento — título, volume, data, divisão
 * em tomos, prefeitura.
 *
 * Diferente da IDENTIDADE ([[identidade.ts]]), que o agente nunca propõe: estes
 * campos ELE propõe a cada turno, e por isso precisam de uma regra de quem
 * vence. Sem ela, editar o título no frame e mandar outra mensagem no chat
 * desfaria a edição em silêncio — a terceira encarnação de "correção aceita e
 * revertida sem aviso" neste projeto.
 *
 * A regra, em uma frase: cada decisão guarda O VALOR DO AGENTE QUE ELA
 * SUBSTITUIU. No turno seguinte, se o agente mudou de ideia ele vence; se
 * repetiu o mesmo valor, a decisão fica.
 *
 * Isso resolve os dois casos que uma regra simples erraria: "a decisão sempre
 * vence" impediria pedir "muda o título para X" pelo chat; "o agente sempre
 * vence" apagaria a edição do frame.
 *
 * PURO: nenhum import de runtime, para rodar em
 * `node scripts/test-nexo-decisoes.ts`.
 */

export interface Decisao {
  /** O que o engenheiro pôs. */
  valor: string;
  /** O que o agente propunha quando esta decisão foi tomada. */
  sobre: string;
}

export type DecisoesDoProjeto = Record<string, Decisao>;

/** Os campos que o frame decide. A identidade NÃO entra aqui. */
export const CAMPOS_DECIDIVEIS = [
  "templateId",
  "tituloCapa",
  "tituloLd",
  "volume",
  "mes",
  "ano",
  "numTomos",
  "tomoInicial",
] as const;

/**
 * Registra uma decisão. Valor vazio APAGA — é como se desfaz, igual à
 * identidade. Decidir exatamente o que o agente já propôs também não é
 * decisão: guardá-la só criaria ruído para a mescla resolver depois.
 */
export function anotarDecisao(
  atuais: DecisoesDoProjeto,
  campo: string,
  valor: string,
  propostoPeloAgente: string,
): DecisoesDoProjeto {
  const proxima = { ...atuais };
  const limpo = valor.trim();
  if (!limpo || limpo === propostoPeloAgente.trim()) {
    delete proxima[campo];
    return proxima;
  }
  proxima[campo] = { valor: limpo, sobre: propostoPeloAgente.trim() };
  return proxima;
}

/**
 * Os valores que valem agora, e as decisões que sobrevivem ao turno.
 *
 * Quem chama deve GUARDAR `vivas` de volta: uma decisão que perdeu para o
 * agente e continuasse guardada voltaria a vencer no turno seguinte, quando o
 * agente repetisse o valor novo.
 */
export function mesclarDecisoes(
  decisoes: DecisoesDoProjeto,
  paramsDoAgente: Record<string, string>,
): { valores: Record<string, string>; vivas: DecisoesDoProjeto } {
  const valores: Record<string, string> = { ...paramsDoAgente };
  const vivas: DecisoesDoProjeto = {};

  for (const [campo, decisao] of Object.entries(decisoes)) {
    const agora = (paramsDoAgente[campo] ?? "").trim();
    const mudouDeIdeia = agora !== "" && agora !== decisao.sobre;
    if (mudouDeIdeia) continue; // o agente vence; a decisão cai
    valores[campo] = decisao.valor;
    vivas[campo] = decisao;
  }
  return { valores, vivas };
}
```

- [ ] **Step 4: Rodar e ver passar**

```powershell
node scripts/test-nexo-decisoes.ts
```

Esperado: `9 teste(s) ok.`

- [ ] **Step 5: Registrar o script, verificar e commitar**

```json
    "test:nexo:decisoes": "node scripts/test-nexo-decisoes.ts",
```

```powershell
npx tsc --noEmit
npx eslint modules/nexo/lib/decisoes.ts
git add modules/nexo/lib/decisoes.ts scripts/test-nexo-decisoes.ts package.json
git commit -m "Nexo: regra de precedencia entre a decisao do engenheiro e a proposta do agente"
```

---

### Task 5: As decisões na store da conversa

**Files:**
- Modify: `modules/nexo/state/conversation-store.tsx`
- Modify: `modules/nexo/lib/nexo-db.ts` (campo no registro persistido)

**Interfaces:**
- Consumes: `DecisoesDoProjeto`, `anotarDecisao` (Tarefa 4).
- Produces: no contexto da conversa, `decisoes: DecisoesDoProjeto` e
  `decidir: (campo: string, valor: string, propostoPeloAgente: string) => void`,
  além de `guardarDecisoesVivas: (vivas: DecisoesDoProjeto) => void`.

- [ ] **Step 1: Declarar no tipo persistido**

Em `modules/nexo/lib/nexo-db.ts`, no `StoredConversation`, ao lado de `identidade`:

```ts
  /** As decisões do engenheiro sobre o documento (título, volume, tomos…). */
  decisoes?: Record<string, { valor: string; sobre: string }>;
```

- [ ] **Step 2: Estado, ações e persistência**

Em `modules/nexo/state/conversation-store.tsx`:

```ts
import { anotarDecisao, type DecisoesDoProjeto } from "../lib/decisoes";
```

No valor do contexto (junto de `identidade`, linha ~135):

```ts
  decisoes: DecisoesDoProjeto;
  decidir: (campo: string, valor: string, propostoPeloAgente: string) => void;
  guardarDecisoesVivas: (vivas: DecisoesDoProjeto) => void;
```

No estado (junto de `const [identidade, setIdentidade]`, linha ~231):

```ts
  const [decisoes, setDecisoes] = useState<DecisoesDoProjeto>({});
```

Nas ações (junto de `corrigirIdentidade`, linha ~509):

```ts
  /*
   * Uma decisão do engenheiro sobre o documento. Guarda junto o que o agente
   * propunha na hora — é esse par que deixa a mescla saber, no turno seguinte,
   * se o agente mudou de ideia ou apenas repetiu.
   */
  const decidir = useCallback(
    (campo: string, valor: string, propostoPeloAgente: string) => {
      setDecisoes((atual) => anotarDecisao(atual, campo, valor, propostoPeloAgente));
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * As decisões que sobreviveram ao turno. Guardar de volta é obrigatório: uma
   * decisão que perdeu para o agente e continuasse guardada voltaria a vencer
   * no turno seguinte, quando ele repetisse o valor novo.
   */
  const guardarDecisoesVivas = useCallback(
    (vivas: DecisoesDoProjeto) => {
      setDecisoes(vivas);
      schedulePersist();
    },
    [schedulePersist],
  );
```

No snapshot (junto de `identidade`, linhas ~251 e ~269), no registro persistido (linha ~344):

```ts
      ...(Object.keys(s.decisoes).length > 0 ? { decisoes: s.decisoes } : {}),
```

Na restauração (junto de `setIdentidade(rec.identidade ?? {})`, linha ~689):

```ts
      setDecisoes(rec.decisoes ?? {});
```

E nos dois objetos de valor do provider (linhas ~804 e ~841), ao lado de `identidade` e `corrigirIdentidade`:

```ts
      decisoes,
      decidir,
      guardarDecisoesVivas,
```

- [ ] **Step 3: Verificar**

```powershell
npx tsc --noEmit
npx eslint modules/nexo/state/conversation-store.tsx modules/nexo/lib/nexo-db.ts
```

Esperado: sem saída. Se o lint do React Compiler reclamar de dependência faltando nos `useCallback`, acrescente `schedulePersist` — é a única dependência real, como nas ações vizinhas.

- [ ] **Step 4: Commit**

```powershell
git add modules/nexo/state/conversation-store.tsx modules/nexo/lib/nexo-db.ts
git commit -m "Nexo: as decisoes do documento viram estado da conversa, persistido"
```

---

### Task 6: O componente `FrameDoDocumento`

**Files:**
- Create: `modules/nexo/components/FrameDoDocumento.tsx`

**Interfaces:**
- Consumes: `ParagrafoDoModelo`, `ParteDoParagrafo` (Tarefa 2).
- Produces:
  ```ts
  export interface CampoDoFrame {
    /** Nome do marcador, ex. "NOME_OBRA". */
    marcador: string;
    rotulo: string;
    /** Ausente = campo editável. Presente = derivado, desenhado em cinza. */
    derivadoDe?: string;
    /** Quantas linhas o campo aceita. */
    linhas?: number;
    placeholder?: string;
  }

  export function FrameDoDocumento(props: {
    layout: ParagrafoDoModelo[];
    campos: CampoDoFrame[];
    valores: Record<string, string>;
    onChange: (marcador: string, valor: string) => void;
  }): React.ReactElement;
  ```

- [ ] **Step 1: Escrever o componente**

Criar `modules/nexo/components/FrameDoDocumento.tsx`:

```tsx
"use client";

/**
 * O DOCUMENTO COM A FORMA DO DOCUMENTO, desenhado a partir do MODELO.
 *
 * O frame anterior era um esqueleto em CSS fixo: descrevia a capa de Criciúma
 * como ela era num dia. Quem edita o modelo é o engenheiro — no dia seguinte o
 * modelo tinha duas linhas de nome de obra, e o esqueleto passou a mentir sem
 * que nada acusasse.
 *
 * Aqui a ordem, o alinhamento e o corpo saem do `content.xml`. Marcador vira
 * campo no lugar em que será impresso; texto fixo em volta continua texto;
 * marcador repetido vira uma linha por ocorrência, como `distribuirNosMarcadores`
 * faz na geração. Acrescentar um campo ao modelo passa a bastar — nada de código.
 *
 * Não é pré-visualização fiel (fonte e brasão são do ODT); é a ESTRUTURA, que é
 * o que se confere antes de gerar.
 */

import type { ParagrafoDoModelo } from "@/server/odt/layout";

export interface CampoDoFrame {
  marcador: string;
  rotulo: string;
  /** Ausente = editável. Presente = derivado; desenhado em cinza com a origem. */
  derivadoDe?: string;
  linhas?: number;
  placeholder?: string;
}

const ALINHAMENTO: Record<ParagrafoDoModelo["alinhamento"], string> = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
};

/** Corpo do modelo (pt) → classe de tamanho. Relativo basta: é esqueleto. */
function classeDeCorpo(corpo: number | undefined): string {
  if (!corpo) return "text-xs";
  if (corpo >= 16) return "text-sm font-semibold";
  if (corpo >= 13) return "text-xs font-medium";
  return "text-[11px]";
}

export function FrameDoDocumento({
  layout,
  campos,
  valores,
  onChange,
}: {
  layout: ParagrafoDoModelo[];
  campos: CampoDoFrame[];
  valores: Record<string, string>;
  onChange: (marcador: string, valor: string) => void;
}) {
  const campoDe = (marcador: string) => campos.find((c) => c.marcador === marcador);

  /*
   * Quantas vezes cada marcador já apareceu. O modelo desenha o nome da obra em
   * DOIS parágrafos, um por linha; o campo tem de aparecer uma vez, no primeiro,
   * com as linhas que o modelo comporta — repetir o mesmo campo duas vezes faria
   * o engenheiro digitar a obra duas vezes.
   */
  const jaDesenhados = new Set<string>();
  const ocorrencias = new Map<string, number>();
  for (const p of layout) {
    for (const parte of p.partes) {
      if (parte.tipo === "marcador") {
        ocorrencias.set(parte.nome, (ocorrencias.get(parte.nome) ?? 0) + 1);
      }
    }
  }

  return (
    <div className="rounded-md border border-border bg-[var(--nexodoc-recessed)] p-4">
      {layout.map((paragrafo) => {
        if (paragrafo.partes.length === 0) return null;

        return (
          <div
            key={paragrafo.indice}
            className={`flex flex-wrap items-baseline justify-center gap-1 py-0.5 ${
              ALINHAMENTO[paragrafo.alinhamento]
            }`}
          >
            {paragrafo.partes.map((parte, i) => {
              const chave = `${paragrafo.indice}-${i}`;

              if (parte.tipo === "texto") {
                return (
                  <span
                    key={chave}
                    className={`${classeDeCorpo(paragrafo.corpo)} text-foreground`}
                  >
                    {parte.valor}
                  </span>
                );
              }

              if (parte.tipo === "quebrado") {
                /*
                 * O marcador que o LibreOffice partiu em spans. O gerador nunca
                 * o substituirá e ele sairá LITERAL na capa — foi assim que
                 * `{{(TOMO)}}` chegou à produção. Aqui ele é visível.
                 */
                return (
                  <span
                    key={chave}
                    role="alert"
                    className="rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[10px] text-destructive"
                  >
                    {parte.bruto} — marcador quebrado, conserte no modelo
                  </span>
                );
              }

              const campo = campoDe(parte.nome);
              // Marcador que o modelo tem e ninguém mapeou: texto livre, para a
              // promessa "o modelo dita" não ser meia-verdade.
              const rotulo = campo?.rotulo ?? parte.nome;

              if (campo?.derivadoDe) {
                return (
                  <span
                    key={chave}
                    className="font-mono text-[10px] text-muted-foreground"
                    title={`${rotulo} · ${campo.derivadoDe}`}
                  >
                    {valores[parte.nome] || "—"}
                    <span className="opacity-60"> · {campo.derivadoDe}</span>
                  </span>
                );
              }

              if (jaDesenhados.has(parte.nome)) return null;
              jaDesenhados.add(parte.nome);

              const linhas = campo?.linhas ?? ocorrencias.get(parte.nome) ?? 1;
              const comum =
                "min-w-0 flex-1 rounded-sm border border-dashed border-border bg-transparent px-1.5 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-solid focus:border-[var(--ring)] focus:bg-[var(--nexodoc-recessed)]";

              return linhas > 1 ? (
                <textarea
                  key={chave}
                  aria-label={rotulo}
                  rows={linhas}
                  value={valores[parte.nome] ?? ""}
                  placeholder={campo?.placeholder}
                  onChange={(e) => onChange(parte.nome, e.target.value)}
                  className={`${comum} resize-none ${classeDeCorpo(paragrafo.corpo)} ${
                    ALINHAMENTO[paragrafo.alinhamento]
                  }`}
                />
              ) : (
                <input
                  key={chave}
                  aria-label={rotulo}
                  value={valores[parte.nome] ?? ""}
                  placeholder={campo?.placeholder}
                  onChange={(e) => onChange(parte.nome, e.target.value)}
                  className={`${comum} ${classeDeCorpo(paragrafo.corpo)} ${
                    ALINHAMENTO[paragrafo.alinhamento]
                  }`}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

```powershell
npx tsc --noEmit
npx eslint modules/nexo/components/FrameDoDocumento.tsx
```

Esperado: sem saída. O import de `@/server/odt/layout` é `import type` — nada de servidor entra no pacote do cliente.

- [ ] **Step 3: Commit**

```powershell
git add modules/nexo/components/FrameDoDocumento.tsx
git commit -m "Nexo: frame do documento desenhado a partir do modelo ODT"
```

---

### Task 7: O card "Vou gerar" vira o frame

**Files:**
- Modify: `modules/nexo/components/PlanoDeGeracao.tsx`
- Create: `modules/nexo/lib/campos-do-frame.ts`

**Interfaces:**
- Consumes: `FrameDoDocumento`, `CampoDoFrame` (Tarefa 6); `mesclarDecisoes` (Tarefa 4); `decisoes`, `decidir`, `guardarDecisoesVivas` (Tarefa 5); `layout` no template (Tarefa 3).
- Produces:
  ```ts
  export const CAMPOS_DO_FRAME: CampoDoFrame[];
  /**
   * Marcador do modelo → valor que ele mostra.
   * `derivados` é chaveado por NOME DE MARCADOR ("CODIGO_EXIBIDO", "MES_ANO"),
   * não por nome de campo — é o marcador que o frame desenha.
   */
  export function valoresDoFrame(args: {
    identidade: IdentidadeDoProjeto;
    derivados: Record<string, string>;
    params: Record<string, string>;
  }): Record<string, string>;
  export function separarParaGerar(valores: Record<string, string>): {
    identidade: Record<string, string>;
    params: Record<string, string>;
    extras: Record<string, string>;
  };
  ```

- [ ] **Step 1: Mapear marcador → campo**

Criar `modules/nexo/lib/campos-do-frame.ts`:

```ts
/**
 * De onde vem cada marcador do modelo.
 *
 * O frame desenha o que o modelo manda; esta tabela diz o que cada marcador
 * SIGNIFICA: se é decisão do engenheiro (campo editável), fato do carimbo
 * (derivado, cinza) ou identidade do projeto (editável, mas guardada na
 * conversa e não no documento).
 *
 * Marcador que não estiver aqui vira texto livre no frame e sai pelo canal de
 * extras na geração — é o que torna verdadeira a promessa de que acrescentar um
 * campo ao ODT basta.
 *
 * PURO: só `import type`.
 */
import type { CampoDoFrame } from "../components/FrameDoDocumento";
import type { IdentidadeDoProjeto } from "./identidade";

export const CAMPOS_DO_FRAME: CampoDoFrame[] = [
  { marcador: "NOME_OBRA", rotulo: "Obra", linhas: 2, placeholder: "nome da obra" },
  { marcador: "BAIRRO", rotulo: "Bairro", placeholder: "bairro (opcional)" },
  { marcador: "TITULO_CAPA", rotulo: "Título", linhas: 3, placeholder: "disciplina do projeto" },
  { marcador: "ORGAO", rotulo: "Órgão", derivadoDe: "do modelo" },
  { marcador: "SECRETARIA", rotulo: "Secretaria", placeholder: "secretaria" },
  { marcador: "FASE", rotulo: "Fase", derivadoDe: "do modelo" },
  { marcador: "VOLUME", rotulo: "Volume", derivadoDe: "do arquivo" },
  { marcador: "TOMO", rotulo: "Tomo", derivadoDe: "da divisão" },
  { marcador: "CODIGO_EXIBIDO", rotulo: "Código", derivadoDe: "do carimbo" },
  { marcador: "MES_ANO", rotulo: "Data", derivadoDe: "do mês corrente" },
  { marcador: "DISCIPLINA", rotulo: "Disciplina", derivadoDe: "do carimbo" },
];

/** Marcadores que são IDENTIDADE do projeto (valem para a conversa inteira). */
const DA_IDENTIDADE: Record<string, keyof IdentidadeDoProjeto> = {
  NOME_OBRA: "obra",
  BAIRRO: "bairro",
  ORGAO: "orgao",
  SECRETARIA: "secretaria",
  FASE: "fase",
  CODIGO_EXIBIDO: "codigo",
};

/** Marcadores que são PARAMS do documento (decisões por artefato). */
const DOS_PARAMS: Record<string, string> = {
  TITULO_CAPA: "tituloCapa",
  VOLUME: "volume",
};

/**
 * O valor que cada marcador mostra: a correção à mão vence; senão o derivado do
 * carimbo/arquivo/divisão. Vazio significa "ainda não decidido", e é o que
 * acende o campo no frame.
 */
export function valoresDoFrame(args: {
  identidade: IdentidadeDoProjeto;
  derivados: Record<string, string>;
  params: Record<string, string>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const campo of CAMPOS_DO_FRAME) {
    const daIdentidade = DA_IDENTIDADE[campo.marcador];
    const doParam = DOS_PARAMS[campo.marcador];
    out[campo.marcador] =
      (daIdentidade ? args.identidade[daIdentidade]?.trim() : "") ||
      (doParam ? (args.params[doParam] ?? "").trim() : "") ||
      args.derivados[campo.marcador] ||
      "";
  }
  return out;
}

/**
 * Separa o que o frame devolveu nos três destinos: identidade (da conversa),
 * params (do documento) e extras (marcadores que o modelo tem e o Nexo não
 * conhece). Misturá-los faria a correção da obra durar só até a próxima
 * geração pelo plano — o defeito que `separarIdentidade` já resolveu uma vez.
 */
export function separarParaGerar(valores: Record<string, string>): {
  identidade: Record<string, string>;
  params: Record<string, string>;
  extras: Record<string, string>;
} {
  const identidade: Record<string, string> = {};
  const params: Record<string, string> = {};
  const extras: Record<string, string> = {};
  const derivados = new Set(
    CAMPOS_DO_FRAME.filter((c) => c.derivadoDe).map((c) => c.marcador),
  );

  for (const [marcador, valor] of Object.entries(valores)) {
    if (derivados.has(marcador)) continue; // derivado não se envia: se recalcula
    if (DA_IDENTIDADE[marcador]) identidade[DA_IDENTIDADE[marcador]] = valor;
    else if (DOS_PARAMS[marcador]) params[DOS_PARAMS[marcador]] = valor;
    else extras[marcador] = valor;
  }
  return { identidade, params, extras };
}
```

- [ ] **Step 2: Trocar a lista de rótulo/valor pelo frame**

Em `modules/nexo/components/PlanoDeGeracao.tsx`:

1. `templates` passa a carregar `layout` — ajuste o tipo da prop para
   `{ id: string; nome: string; layout?: ParagrafoDoModelo[] }[]`.
2. Substituir o `<div>` de `<Linha …>` (linhas ~320-369) por:

```tsx
        {layoutDoModelo.length > 0 ? (
          <FrameDoDocumento
            layout={layoutDoModelo}
            campos={CAMPOS_DO_FRAME}
            valores={valoresDoFrame({
              identidade,
              derivados: {
                CODIGO_EXIBIDO: codigo,
                MES_ANO: dataDaCapa || "auto (mês corrente)",
                VOLUME: capa?.volume?.trim() || "auto",
                TOMO: numTomos > 1 ? `TOMO ${String(tomoInicial).padStart(2, "0")}` : "",
                NOME_OBRA: obra,
              },
              params: mesclado.valores,
            })}
            onChange={aoEditarNoFrame}
          />
        ) : (
          /* Modelo ilegível: degradar para a lista de sempre é melhor que
             mostrar um card em branco. */
          <div className="space-y-1">
            {obra && <Linha rotulo="Obra" valor={obra} />}
            {codigo && <Linha rotulo="Código" valor={codigo} />}
            <Linha rotulo="Folhas" valor={`${selos.length}`} />
          </div>
        )}
```

3. Acrescentar, antes do `return`:

```tsx
  const { decisoes, decidir, guardarDecisoesVivas } = useConversation();

  /*
   * Os params que valem AGORA: as decisões do engenheiro por cima do que o
   * agente propôs neste turno, com a regra de quem vence.
   */
  const paramsDoAgente: Record<string, string> = {
    templateId: capa?.templateId ?? "",
    tituloCapa: capa?.tituloCapa ?? "",
    tituloLd: ld?.tituloLd ?? "",
    volume: capa?.volume ?? "",
    mes: capa?.mes ?? "",
    ano: capa?.ano ?? "",
    numTomos: String(capa?.numTomos ?? ld?.numTomos ?? 1),
    tomoInicial: String(capa?.tomoInicial ?? ld?.tomoInicial ?? 1),
  };
  const mesclado = mesclarDecisoes(decisoes, paramsDoAgente);

  const layoutDoModelo =
    templates.find((t) => t.id === mesclado.valores.templateId)?.layout ?? [];

  /*
   * Editar no frame é DECIDIR. Identidade vai para a conversa (regra própria:
   * vazio = vale o carimbo); o resto vira decisão, que guarda junto o que o
   * agente propunha — é esse par que faz a edição sobreviver ao próximo turno.
   */
  function aoEditarNoFrame(marcador: string, valor: string) {
    const { identidade: ident, params, extras } = separarParaGerar({ [marcador]: valor });
    if (Object.keys(ident).length > 0) corrigirIdentidade(ident);
    for (const [campo, v] of Object.entries(params)) {
      decidir(campo, v, paramsDoAgente[campo] ?? "");
    }
    for (const [campo, v] of Object.entries(extras)) {
      decidir(campo, v, "");
    }
  }
```

4. Em `gerarTudo`, trocar o uso de `capa`/`ld` crus pelos valores mesclados e
   guardar as decisões vivas antes de gerar:

```tsx
  async function gerarTudo() {
    guardarDecisoesVivas(mesclado.vivas);
    setFalhas([]);
    // …o resto do corpo atual, usando `mesclado.valores` no lugar de
    // `capa?.tituloCapa`, `capa?.volume`, `capa?.mes`, `capa?.ano`,
    // `numTomos` e `tomoInicial`.
```

5. `semTitulo` passa a olhar o valor mesclado:

```tsx
  const titulo = mesclado.valores.tituloCapa?.trim() || mesclado.valores.tituloLd?.trim() || "";
```

6. Apagar a frase que mandava responder no chat (linhas ~424-430): com o campo
   no frame, ela deixou de ser verdade. O botão continua desabilitado, e o campo
   do título é o que está aceso.

7. **Sem prefeitura escolhida não há layout**, e sem layout não há frame. O
   seletor tem de vir ANTES, senão o card fica na lista degradada sem dizer por
   quê. Acrescentar acima do frame:

```tsx
        {!mesclado.valores.templateId && capa && (
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.05em] text-muted-foreground">
              Prefeitura
            </span>
            <select
              value=""
              onChange={(e) => decidir("templateId", e.target.value, "")}
              className="w-full rounded-sm border border-input bg-transparent px-2 py-1.5 font-mono text-[11px]"
            >
              <option value="">escolha a prefeitura</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </label>
        )}
```

**Nota de ordem:** os `extras` que `separarParaGerar` coleta (marcadores que o
modelo tem e o Nexo não conhece) só chegam ao documento depois da **Tarefa 12**.
Até lá eles são guardados como decisão e ignorados na geração — o spec não está
cumprido enquanto a 12 não entrar.

- [ ] **Step 3: Verificar**

```powershell
npx tsc --noEmit
npx eslint modules/nexo/components/PlanoDeGeracao.tsx modules/nexo/lib/campos-do-frame.ts
```

- [ ] **Step 4: Commit**

```powershell
git add modules/nexo/components/PlanoDeGeracao.tsx modules/nexo/lib/campos-do-frame.ts
git commit -m "Nexo: o card Vou gerar vira o documento desenhado"
```

---

### Task 8: O bloco da LD no card

Revive a prévia determinística das folhas, que existe e está órfã: o servidor manda `ldPreview` todo turno, o chat a guarda na mensagem, e `FolhaPreview` está pronto — mas o `ConfirmationCard` que a renderizava só recebe propostas que não são capa/LD/separatriz desde que `PlanoDeGeracao` assumiu esse caminho (`NexoChat.tsx:368`).

**Files:**
- Create: `modules/nexo/components/BlocoDaLd.tsx`
- Modify: `modules/nexo/components/PlanoDeGeracao.tsx`
- Modify: `modules/nexo/components/NexoChat.tsx` (passar `ldPreview` ao `PlanoDeGeracao`)

**Interfaces:**
- Consumes: `LdPreviewData` (`modules/nexo/types.ts`).
- Produces:
  ```ts
  export function BlocoDaLd(props: {
    titulo: string;
    onTitulo: (valor: string) => void;
    somenteLeitura?: boolean;
    codigo: string;
    revisao: string;
    preview?: LdPreviewData;
    totalFolhas: number;
  }): React.ReactElement;
  ```

- [ ] **Step 1: Escrever o componente**

Criar `modules/nexo/components/BlocoDaLd.tsx`:

```tsx
"use client";

/**
 * A LD no card, ao lado da capa.
 *
 * Bloco COMPACTO de propósito: num volume misto são uma LD por disciplina, e
 * empilhar quatro tabelas inteiras faria um card que ninguém lê. O que se
 * confere antes de gerar é o título (que sai impresso no cabeçalho e tem de
 * casar com a separatriz) e se a contagem bate — não as 71 linhas.
 *
 * A lista de folhas vem de `ldPreview`, que o servidor já manda a cada turno e
 * que estava ÓRFÃ: o componente que a desenhava só recebe propostas que não são
 * capa/LD/separatriz desde que o `PlanoDeGeracao` assumiu esse caminho.
 */

import type { LdPreviewData } from "../types";

export function BlocoDaLd({
  titulo,
  onTitulo,
  somenteLeitura,
  codigo,
  revisao,
  preview,
  totalFolhas,
}: {
  titulo: string;
  onTitulo: (valor: string) => void;
  /** Num volume misto o título é o da disciplina — não se digita. */
  somenteLeitura?: boolean;
  codigo: string;
  revisao: string;
  preview?: LdPreviewData;
  totalFolhas: number;
}) {
  const linhas = preview?.rows.slice(0, 3) ?? [];
  const restantes = Math.max(0, (preview?.rows.length ?? totalFolhas) - linhas.length);
  const referencia = preview?.referenceTotal ?? null;
  const bate = referencia === null || referencia === (preview?.totalFolhas ?? totalFolhas);

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
        Lista de documentos
      </p>

      {somenteLeitura ? (
        <p className="rounded-sm border border-border bg-[var(--nexodoc-recessed)] px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
          {titulo || "—"}
        </p>
      ) : (
        <input
          aria-label="Título da LD"
          value={titulo}
          placeholder="título da lista de documentos"
          onChange={(e) => onTitulo(e.target.value)}
          className="w-full rounded-sm border border-dashed border-border bg-transparent px-2 py-1.5 text-sm font-medium outline-none focus:border-solid focus:border-[var(--ring)]"
        />
      )}

      <p className="font-mono text-[10px] text-muted-foreground">
        {codigo || "—"} · rev {revisao || "—"} ·{" "}
        {preview?.totalFolhas ?? totalFolhas} folhas
        {referencia !== null && (
          <span className={bate ? "text-[var(--status-ok)]" : "text-[var(--status-warning)]"}>
            {" "}
            · carimbo diz {referencia}
            {bate ? " ✓" : " ✗"}
          </span>
        )}
      </p>

      {linhas.length > 0 && (
        <ul className="space-y-0.5">
          {linhas.map((r) => (
            <li key={r.file} className="font-mono text-[10px] text-muted-foreground">
              {r.sheet} · {r.file} · {r.description}
            </li>
          ))}
          {restantes > 0 && (
            <li className="font-mono text-[10px] text-muted-foreground/60">
              + {restantes} folhas
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Passar `ldPreview` ao card**

Em `modules/nexo/components/NexoChat.tsx`, no `<PlanoDeGeracao …>` (linha ~361):

```tsx
                <PlanoDeGeracao
                  proposals={m.proposals}
                  selos={selos}
                  templates={templates}
                  idsBase={idsBaseDosArtefatos(selos)}
                  ldPreview={m.ldPreview}
                />
```

- [ ] **Step 3: Empilhar no `PlanoDeGeracao`**

Acrescentar a prop `ldPreview?: LdPreviewData` e, logo abaixo do `FrameDoDocumento`, um bloco por disciplina (ou um só quando o volume não é misto):

```tsx
        {proposals.some((p) => p.kind === "ld") &&
          (misto
            ? blocos
                .filter((b) => b.codigo)
                .map((b) => (
                  <BlocoDaLd
                    key={b.codigo}
                    titulo={b.rotulo.toUpperCase()}
                    onTitulo={() => {}}
                    somenteLeitura
                    codigo={codigo}
                    revisao={identidade.revisao ?? doSelo.revisao ?? ""}
                    totalFolhas={b.ids.length}
                  />
                ))
            : (
              <BlocoDaLd
                titulo={mesclado.valores.tituloLd ?? ""}
                onTitulo={(v) => decidir("tituloLd", v, paramsDoAgente.tituloLd)}
                codigo={codigo}
                revisao={identidade.revisao ?? doSelo.revisao ?? ""}
                preview={ldPreview}
                totalFolhas={selos.length}
              />
            ))}
```

- [ ] **Step 4: Verificar e commitar**

```powershell
npx tsc --noEmit
npx eslint modules/nexo/components/BlocoDaLd.tsx modules/nexo/components/PlanoDeGeracao.tsx modules/nexo/components/NexoChat.tsx
git add modules/nexo/components/BlocoDaLd.tsx modules/nexo/components/PlanoDeGeracao.tsx modules/nexo/components/NexoChat.tsx
git commit -m "Nexo: a LD entra no card e a previa orfa das folhas volta a aparecer"
```

---

### Task 9: O editor do nó usa o mesmo frame

**Files:**
- Modify: `modules/nexo/components/EditorDoNo.tsx`
- Modify: `modules/nexo/components/NexoCanvas.tsx`
- Delete: `modules/nexo/components/FrameDaCapa.tsx`

**Interfaces:**
- Consumes: `FrameDoDocumento`, `CAMPOS_DO_FRAME`, `valoresDoFrame`, `separarParaGerar`.
- Produces: `EditorDoNo` ganha a prop `layout?: ParagrafoDoModelo[]` e deixa de receber `prefeituraDoTemplate`/`rotuloDoTomo`/`derivadosDaCapa`.

- [ ] **Step 1: Trocar o frame no `EditorDoNo`**

Trocar os imports:

```tsx
import { FrameDoDocumento } from "./FrameDoDocumento";
import { CAMPOS_DO_FRAME } from "../lib/campos-do-frame";
import type { ParagrafoDoModelo } from "@/server/odt/layout";
```

A prop `layout` entra e as três antigas saem:

```tsx
export function EditorDoNo({
  kind,
  campos,
  onAplicar,
  onCancelar,
  layout,
}: {
  kind: NexoArtifactKind;
  campos: CampoEditavel[];
  /** A estrutura do modelo. Vazia = sem frame; cai na lista de campos. */
  layout?: ParagrafoDoModelo[];
  onAplicar: (valores: Record<string, string>, frase: string | null) => Promise<void>;
  onCancelar: () => void;
}) {
```

O bloco que hoje separa `noFrame`/`foraDoFrame`/`identidade` por `CHAVES_DO_FRAME`
passa a comparar com os marcadores do frame. Substituir o trecho inteiro por:

```tsx
  /*
   * A CAPA é editada com a FORMA da capa — o mesmo componente do card, ditado
   * pelo modelo. O que o frame desenha sai da lista; o resto (tomos, prefeitura)
   * continua abaixo, onde sempre esteve.
   */
  const usaFrame = kind === "capa" && (layout?.length ?? 0) > 0;
  const marcadoresDesenhados = new Set(
    usaFrame
      ? (layout ?? [])
          .flatMap((p) => p.partes)
          .filter((x) => x.tipo === "marcador")
          .map((x) => x.nome)
      : [],
  );
  /** Chave de campo → marcador, para saber quem o frame já desenha. */
  const MARCADOR_DA_CHAVE: Record<string, string> = {
    obra: "NOME_OBRA",
    bairro: "BAIRRO",
    orgao: "ORGAO",
    secretaria: "SECRETARIA",
    fase: "FASE",
    codigo: "CODIGO_EXIBIDO",
    tituloCapa: "TITULO_CAPA",
    volume: "VOLUME",
  };
  const noFrame = (c: CampoEditavel) =>
    usaFrame && marcadoresDesenhados.has(MARCADOR_DA_CHAVE[c.chave] ?? "");

  const foraDoFrame = soltos.filter((c) => !noFrame(c));
  const gruposVisiveis = grupos
    .map((g) => ({ ...g, campos: g.campos.filter((c) => !noFrame(c)) }))
    .filter((g) => g.campos.length > 0);
```

E o render do frame:

```tsx
      {usaFrame && (
        <FrameDoDocumento
          layout={layout ?? []}
          campos={CAMPOS_DO_FRAME}
          valores={Object.fromEntries(
            Object.entries(MARCADOR_DA_CHAVE).map(([chave, marcador]) => [
              marcador,
              valores[chave] ?? "",
            ]),
          )}
          onChange={(marcador, v) => {
            const chave = Object.entries(MARCADOR_DA_CHAVE).find(
              ([, m]) => m === marcador,
            )?.[0];
            if (chave) setValores((atual) => ({ ...atual, [chave]: v }));
          }}
        />
      )}
```

- [ ] **Step 2: Passar o layout no `NexoCanvas`**

No `<EditorDoNo …>` (linha ~277), trocar `prefeituraDoTemplate`/`rotuloDoTomo`/`derivadosDaCapa` por:

```tsx
        layout={
          (data.templates ?? []).find(
            (t) => t.id === String((data.params as { templateId?: unknown })?.templateId ?? ""),
          )?.layout ?? []
        }
```

- [ ] **Step 3: Apagar o frame antigo**

```powershell
git rm modules/nexo/components/FrameDaCapa.tsx
```

- [ ] **Step 4: Verificar**

```powershell
npx tsc --noEmit
npx eslint modules/nexo/components/EditorDoNo.tsx modules/nexo/components/NexoCanvas.tsx
```

Esperado: sem saída. Se `tsc` acusar `FrameDaCapa` em algum lugar, é referência esquecida — remova.

- [ ] **Step 5: Commit**

```powershell
git add modules/nexo/components/EditorDoNo.tsx modules/nexo/components/NexoCanvas.tsx
git commit -m "Nexo: o editor do no passa a usar o mesmo frame do card"
```

---

### Task 10: As decisões vão no pedido do turno

Sem isto o Nexo volta a perguntar no chat o título que acabou de ser digitado no frame.

**Files:**
- Modify: `modules/nexo/components/NexoChat.tsx` (mandar `decisoes` no corpo)
- Modify: `app/api/nexo/agent/route.ts` (receber e semear os slots)
- Modify: `server/nexo/agent/slot-request.ts`

**Interfaces:**
- Consumes: `decisoes` da store (Tarefa 5).
- Produces: `buildSlotRequestForTurn` ganha, em `SlotRequestContext`, o campo
  `decisoes?: Record<string, string>`, mesclado sobre `slotsFromProposal`.

- [ ] **Step 1: Semear os slots com as decisões**

Em `server/nexo/agent/slot-request.ts`, na interface `SlotRequestContext`:

```ts
  /**
   * O que o engenheiro já decidiu no frame. Entra como slot PREENCHIDO: sem
   * isto o resolvedor pediria de novo, no chat, o título que ele acabou de
   * digitar no card — o oposto do que o frame existe para fazer.
   */
  decisoes?: Record<string, string>;
```

E em `buildSlotRequestForTurn`, no laço:

```ts
  for (const p of proposals) {
    const slots = slotsFromProposal(p);
    for (const [id, valor] of Object.entries(ctx.decisoes ?? {})) {
      const limpo = valor.trim();
      if (limpo) slots[id] = { value: limpo };
    }
    const { nextMissing } = resolveSlots({
      taskKind: p.kind,
      facts,
      slots,
      requirements: ARTIFACT_REQUIREMENTS,
    });
    if (nextMissing) return nextMissing;
  }
```

- [ ] **Step 2: Passar do cliente à rota**

Em `NexoChat.tsx`, no corpo do POST para `/api/nexo/agent`, acrescentar:

```ts
        decisoes: Object.fromEntries(
          Object.entries(decisoes).map(([campo, d]) => [campo, d.valor]),
        ),
```

Em `app/api/nexo/agent/route.ts`, ler `decisoes` do corpo e repassar ao
`buildSlotRequestForTurn` no contexto.

- [ ] **Step 3: Verificar e commitar**

```powershell
node scripts/test-nexo-slots.ts
npx tsc --noEmit
npx eslint modules/nexo/components/NexoChat.tsx app/api/nexo/agent/route.ts server/nexo/agent/slot-request.ts
git add modules/nexo/components/NexoChat.tsx app/api/nexo/agent/route.ts server/nexo/agent/slot-request.ts
git commit -m "Nexo: as decisoes do frame chegam ao resolvedor de slots"
```

---

### Task 11: As provas no navegador

**Files:**
- Create: `scripts/shot-nexo-frame-no-card.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: tudo. É a prova de ponta a ponta.

- [ ] **Step 1: Escrever o shot**

Criar `scripts/shot-nexo-frame-no-card.mjs`, tomando `scripts/shot-nexo-frame-capa.mjs` como molde (mesmo encenamento de `/api/ld/extract-stamp` e `/api/nexo/agent`, mesma limpeza da conversa de QA no `finally`, mesma leitura do PDF pelo `result_blobs`). Duas provas:

**Prova 1 — o card é o documento e o que se digita nele sai no PDF.**

```js
  // O card desenhado a partir do modelo, ANTES de gerar.
  const cartao = page.getByText(/Vou gerar · \d+ documentos?/i).first().locator("..");
  const obra = cartao.getByLabel("Obra", { exact: true });
  const titulo = cartao.getByLabel("Título", { exact: true });

  check("o card desenha o campo da OBRA antes de gerar", (await obra.count()) === 1);
  check("o card desenha o campo do TÍTULO antes de gerar", (await titulo.count()) === 1);

  // A checagem que faltou quando o frame nasceu: existir no DOM não é aparecer.
  const caixa = await cartao.boundingBox();
  const janela = await page.evaluate(() => ({ a: window.innerHeight, l: window.innerWidth }));
  check(
    "o card cabe na janela",
    caixa !== null && caixa.y >= -1 && caixa.x >= -1 && caixa.x + caixa.width <= janela.l + 1,
    JSON.stringify({ caixa, janela }),
  );

  await obra.fill(OBRA_EM_DUAS_LINHAS);
  await titulo.fill(TITULO_TRES_LINHAS);
  await page.getByRole("button", { name: /Gerar os? \d+/i }).first().click();
  await page.getByText(/Gerado · \d+ documentos?/i).first().waitFor({ timeout: 180000 });

  const linhas = await lerCapaGerada(`${OUT}/capa-do-card.pdf`);
  check(
    "o que foi digitado no card saiu no PDF",
    linhas.some((l) => l.texto === "REFORMA E AMPLIACAO") &&
      linhas.some((l) => /PROJETO DE PAISAGISMO/.test(l.texto)),
    JSON.stringify(linhas.map((l) => l.texto)),
  );
```

**Prova 2 — a precedência de ponta a ponta.**

```js
  // Editar no card e depois FALAR no chat: a edição tem de sobreviver ao turno.
  // "Correção aceita e revertida sem aviso" já aconteceu duas vezes aqui.
  await titulo.fill("TITULO QUE O ENGENHEIRO ESCOLHEU");
  const composer = page.locator("textarea").first();
  await composer.fill("quantas folhas tem o volume?");
  await composer.press("Enter");
  await page.waitForTimeout(6000);

  const depoisDoTurno = await page
    .getByLabel("Título", { exact: true })
    .last()
    .inputValue();
  check(
    "o título decidido no card sobrevive ao turno seguinte do chat",
    depoisDoTurno === "TITULO QUE O ENGENHEIRO ESCOLHEU",
    JSON.stringify(depoisDoTurno),
  );
```

O agente encenado deve devolver, no segundo turno, **os mesmos params do primeiro** (`tituloCapa: ""`) — é o caso "o agente repetiu o valor", em que a decisão do engenheiro fica.

- [ ] **Step 2: Rodar**

```powershell
npm run dev
node scripts/shot-nexo-frame-no-card.mjs
```

Esperado: todas as checagens `OK`. Abrir `scratchpad/qa-frame-no-card/*.png` e **olhar**: nenhuma asserção detecta rótulo encavalando campo, que foi o defeito visual do frame anterior.

- [ ] **Step 3: Registrar e commitar**

```json
    "qa:nexo:frame-no-card": "node scripts/shot-nexo-frame-no-card.mjs",
```

```powershell
git add scripts/shot-nexo-frame-no-card.mjs package.json
git commit -m "QA: o card e o documento, e a decisao sobrevive ao turno seguinte"
```

---

### Task 12: O canal genérico de marcadores

O spec promete: acrescentar um `{{RESPONSAVEL}}` ao ODT faz o campo aparecer no frame **e o valor sair no documento**. A primeira metade vem de graça com o leitor do layout; sem esta tarefa a segunda não acontece — o marcador desconhecido é impresso literal na capa, que é o comportamento de hoje.

**Files:**
- Modify: `modules/cover-generator/types.ts` (`GenerateOdtInput` ganha `extras`)
- Modify: `server/odt/index.ts` (aplica os extras)
- Modify: `server/nexo/build-capa-proposal.ts` (recebe e repassa)
- Modify: `app/api/nexo/capa/route.ts` (aceita no corpo)
- Modify: `modules/nexo/lib/generate.ts` (`postCapa` envia)
- Modify: `modules/nexo/components/PlanoDeGeracao.tsx` (manda os extras coletados)

**Interfaces:**
- Consumes: `separarParaGerar` (Tarefa 7), `distribuirNosMarcadores` (Tarefa 1).
- Produces: `BuildCapaInput.extras?: Record<string, string>` e
  `GenerateOdtInput.extras?: Record<string, string>`, ambos chaveados por NOME
  DE MARCADOR sem as chaves (`RESPONSAVEL`, não `{{RESPONSAVEL}}`).

- [ ] **Step 1: Aplicar os extras na geração**

Em `server/odt/index.ts`, logo depois do laço de `replacements` e antes de
`{{TITULO_CAPA}}`:

```ts
    /*
     * MARCADORES QUE O MODELO TEM E O NEXO NÃO CONHECE.
     *
     * O modelo é de quem o mantém: acrescentar um `{{RESPONSAVEL}}` ao ODT tem
     * de bastar. Sem este canal, o marcador novo é impresso LITERAL na capa —
     * e o frame teria oferecido um campo que não vai a lugar nenhum, que é pior
     * do que não oferecer.
     *
     * Vêm depois dos conhecidos, para nunca sobrescrever um deles por engano.
     */
    for (const [nome, valor] of Object.entries(extras ?? {})) {
      block = distribuirNosMarcadores(block, `{{${nome}}}`, valor, markerXmlValue);
    }
```

E `extras` entra na desestruturação de `GenerateOdtInput` no topo da função.

- [ ] **Step 2: Declarar no tipo**

Em `modules/cover-generator/types.ts`, na interface consumida por
`generateOdtBuffer`:

```ts
  /**
   * Marcadores do modelo que o Nexo não conhece, chaveados pelo NOME (sem as
   * chaves). Preenchidos à mão no frame do documento.
   */
  extras?: Record<string, string>;
```

- [ ] **Step 3: Passar pela cadeia**

`BuildCapaInput` ganha `extras?: Record<string, string>` e o repassa ao
`generateOdtBuffer`. A rota `app/api/nexo/capa/route.ts` lê `extras` do corpo e
o entrega a `buildCapaProposal`. `postCapa` em `modules/nexo/lib/generate.ts`
ganha `extras` nas opções e o envia. `PlanoDeGeracao` passa o
`separarParaGerar(...).extras`.

- [ ] **Step 4: Provar no navegador**

Acrescentar um marcador de teste ao modelo de QA e conferir que o valor sai no
PDF. Como não há modelo de QA separado, provar pelo caminho barato: no
`shot-nexo-frame-no-card.mjs`, interceptar o corpo de `/api/nexo/capa` e afirmar
que os extras chegam ao servidor.

```js
  check(
    "os marcadores desconhecidos chegam ao servidor",
    enviado?.extras !== undefined,
    JSON.stringify(enviado?.extras),
  );
```

- [ ] **Step 5: Verificar e commitar**

```powershell
npx tsc --noEmit
npx eslint server/odt/index.ts server/nexo/build-capa-proposal.ts app/api/nexo/capa/route.ts modules/nexo/lib/generate.ts modules/nexo/components/PlanoDeGeracao.tsx
git add server/odt/index.ts modules/cover-generator/types.ts server/nexo/build-capa-proposal.ts app/api/nexo/capa/route.ts modules/nexo/lib/generate.ts modules/nexo/components/PlanoDeGeracao.tsx
git commit -m "ODT: canal generico para marcadores que o modelo tem e o Nexo nao conhece"
```

---

## Verificação final

```powershell
$env:PATH = "C:\Users\matheus.mendes\AppData\Roaming\fnm\node-versions\v24.18.0\installation;" + $env:PATH
Get-ChildItem scripts -Filter "test-*.ts" | ForEach-Object { node $_.FullName }
npx tsc --noEmit
node scripts/shot-nexo-frame-capa.mjs
node scripts/shot-nexo-frame-no-card.mjs
```

O `shot-nexo-frame-capa.mjs` mantém falhando a checagem "obra de 2 linhas + 3 disciplinas cabe em uma página" — é dívida conhecida do modelo de Criciúma (faltam ~18pt), registrada no spec como fora de escopo. Qualquer OUTRA falha é regressão.
