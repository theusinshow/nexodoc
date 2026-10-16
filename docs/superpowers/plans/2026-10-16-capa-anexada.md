# Capa anexada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O engenheiro anexa a capa pronta do projeto (ODT ou PDF) no chat do Nexo; o ODT vira o modelo de capa daquele projeto, e o PDF entra como está no volume.

**Architecture:** Núcleo puro em `server/nexo/modelo-capa/` (ler parágrafos, classificar por regras, injetar marcadores), testado por ida e volta contra os 4 modelos do repositório. Uma rota `/api/nexo/modelo-capa` lê (POST), confirma e grava (PUT) e devolve o atual (GET); a IA (`gpt-6-luna`) só classifica parágrafos que as regras não reconhecem. O modelo gravado vira o template `projeto:<projectId>`, resolvido na rota da capa (bytes do cofre + config da tabela) e escolhido pelo `normalize` para a capa.

**Tech Stack:** Next.js (rotas `app/api`), Prisma/Postgres, JSZip, pdf-lib, LibreOffice (`convertOdtToPdf`), OpenAI Responses via `executeOpenAiResponse`, testes em node cru (`node scripts/test-*.ts`, sem `@/` nos módulos puros).

**Spec:** `docs/superpowers/specs/2026-10-16-capa-anexada-design.md`

## Global Constraints

- Módulos testados em node cru NÃO importam por `@/` — só caminhos relativos com extensão `.ts`.
- Precedência: **decisão do engenheiro > modelo do projeto > prefeitura pelo carimbo**.
- Escopo do modelo: **o projeto**. Um ativo por projeto.
- Nada é gravado antes de o engenheiro confirmar.
- Modelo que transborda no ensaio é **recusado**; nos 4 modelos de prefeitura, transbordo é só **aviso**.
- IA: `gpt-6-luna` por padrão (env `NEXODOC_MODELO_CAPA_MODEL`), `reasoning.effort:"none"`, `json_schema` estrito. *(Ajuste do spec: segue o padrão do `selo-check` — env, não `AiModelConfig` — porque `AI_MODEL_FLOW_DEFINITIONS` exige fiação em `ai-providers.ts` sem ganho aqui.)*
- Commits na main, `git add` por caminho, mensagem em pt-BR, terminando com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Textos de interface em pt-BR, no tom dos cards existentes.

## File Structure

| Arquivo | Papel |
|---|---|
| `server/odt/marcadores.ts` (mod.) | + `preencherCorpo`: a substituição de uma página, pura (sai de `server/odt/index.ts`) |
| `server/odt/index.ts` (mod.) | usa `preencherCorpo`; aceita `templateBytes` |
| `server/nexo/modelo-capa/tipos.ts` | tipos do núcleo |
| `server/nexo/modelo-capa/paragrafos.ts` | parágrafos do `content.xml` (mesma enumeração de `server/odt/layout.ts`) |
| `server/nexo/modelo-capa/regras.ts` | classificação determinística em trechos + formatos de tomo/volume |
| `server/nexo/modelo-capa/injetar.ts` | troca os trechos por `{{CAMPO}}` no XML |
| `scripts/test-nexo-modelo-capa.ts` | ida e volta nos 4 modelos + unidades |
| `prisma/schema.prisma` + migração | `ModeloDeCapaDoProjeto` |
| `server/modelo-capa.ts` | guardar/obter o modelo do projeto (cofre + tabela) |
| `server/nexo/modelo-capa/ia.ts` | chamada à IA para os parágrafos que sobraram |
| `app/api/nexo/modelo-capa/route.ts` | GET/POST/PUT |
| `server/nexo/build-capa-proposal.ts` (mod.) | aceita `template` já resolvido |
| `app/api/nexo/capa/route.ts` (mod.) | resolve `projeto:<id>` |
| `app/api/capas/templates/route.ts` (mod.) | lista o modelo do projeto junto |
| `server/nexo/agent/normalize.ts` + `app/api/nexo/agent/route.ts` (mod.) | `modeloDoProjeto` na capa |
| `modules/nexo/lib/papel-do-anexo.ts`, `NexoChat.tsx`, `NexoWorkspace.tsx` (mod.) | papel `capa`, `.odt`, o card |
| `modules/nexo/components/ModeloDeCapaCard.tsx` | card de confirmação |
| `server/nexo/tools/generate-covers.ts` (mod.) | aviso de transbordo em toda capa |

---

### Task 1: `preencherCorpo` puro (refatoração sem mudança de comportamento)

**Files:**
- Modify: `server/odt/marcadores.ts` (acrescenta no fim)
- Modify: `server/odt/index.ts:140-185` (o laço de páginas de `fillExistingOdt`)
- Test: `scripts/test-nexo-odt-marcadores.ts`

**Interfaces:**
- Produces: `preencherCorpo(corpo: string, valores: ValoresDaPagina, escapar: (v: string) => string): string` e `interface ValoresDaPagina { gerais: Record<string,string>; tituloCapa: string; extras: Record<string,string>; disciplina: string; tomo: string; volume: string }` — `gerais` chaveado por marcador com chaves (`"{{ORGAO}}"`).

- [ ] **Step 1: teste que falha** — acrescentar em `scripts/test-nexo-odt-marcadores.ts`, antes do resumo final:

```ts
import { preencherCorpo } from "../server/odt/marcadores.ts";

test("preencherCorpo: título em 2 parágrafos, volume com rótulo fixo", () => {
  const corpo =
    '<text:p text:style-name="P1">{{TITULO_CAPA}}</text:p>' +
    '<text:p text:style-name="P1">{{TITULO_CAPA}}</text:p>' +
    '<text:p text:style-name="P2">Vol. {{VOLUME}}</text:p>' +
    '<text:p text:style-name="P3">{{CODIGO_EXIBIDO}}</text:p>';
  const xml = preencherCorpo(
    corpo,
    {
      gerais: { "{{CODIGO_EXIBIDO}}": "040-26" },
      tituloCapa: "PROJETO ESTRUTURAL\nIMPLANTAÇÃO",
      extras: {},
      disciplina: "",
      tomo: "",
      volume: "VII",
    },
    (v) => v.replace(/\n/g, "<text:line-break/>"),
  );
  assert.match(xml, />PROJETO ESTRUTURAL</);
  assert.match(xml, />IMPLANTAÇÃO</);
  assert.match(xml, />Vol\. VII</);
  assert.match(xml, />040-26</);
});
```

- [ ] **Step 2:** `npm run test:nexo:odt-marcadores` → FALHA (`preencherCorpo` não exportado).

- [ ] **Step 3: implementação** — fim de `server/odt/marcadores.ts`:

```ts
/** Os valores de UMA página da capa, já formatados. */
export interface ValoresDaPagina {
  /** Chaveado pelo marcador COM chaves: `"{{ORGAO}}"`. */
  gerais: Record<string, string>;
  tituloCapa: string;
  /** Marcadores que o modelo tem e o Nexo não conhece, SEM chaves. */
  extras: Record<string, string>;
  disciplina: string;
  tomo: string;
  volume: string;
}

/**
 * Preenche o corpo de UMA página. Saiu de `server/odt/index.ts` para o teste de
 * ida e volta do modelo anexado usar a MESMA substituição que imprime a capa —
 * uma cópia no teste provaria a cópia, não o gerador.
 */
export function preencherCorpo(
  corpo: string,
  valores: ValoresDaPagina,
  escapar: (v: string) => string,
): string {
  let block = corpo;
  for (const [marker, value] of Object.entries(valores.gerais)) {
    block = distribuirNosMarcadores(block, marker, value, escapar);
  }
  block = distribuirNosMarcadores(block, "{{TITULO_CAPA}}", valores.tituloCapa, escapar);
  for (const [nome, valor] of Object.entries(valores.extras)) {
    block = distribuirNosMarcadores(block, `{{${nome}}}`, valor, escapar);
  }
  block = block.replaceAll("{{DISCIPLINA}}", escapar(valores.disciplina));
  block = block.replaceAll("{{TOMO}}", escapar(valores.tomo));
  block = block.replaceAll("{{VOLUME}}", escapar(valores.volume));
  return block;
}
```

Em `server/odt/index.ts`, o corpo do laço `for (let i = 0; i < pages.length; i++)` passa a ser (mantendo os comentários existentes acima do laço):

```ts
    let block = preencherCorpo(
      corpoDoModelo,
      {
        gerais: replacements,
        tituloCapa: page.tituloCapa,
        extras,
        disciplina: page.disciplina,
        tomo: page.tomo,
        volume: page.volume,
      },
      markerXmlValue,
    );
```

e o import vira `import { desembrulharCamposDeUsuario, preencherCorpo } from "./marcadores";`.

- [ ] **Step 4:** `npm run test:nexo:odt-marcadores` → todos `ok`. `npx tsc --noEmit -p .` sem erro novo.

- [ ] **Step 5: commit** — `git add server/odt/marcadores.ts server/odt/index.ts scripts/test-nexo-odt-marcadores.ts` → `"ODT: o preenchimento de uma página vira função pura (preencherCorpo)"`.

---

### Task 2: Núcleo puro — parágrafos, regras, injeção, e a ida e volta nos 4 modelos

**Files:**
- Create: `server/nexo/modelo-capa/tipos.ts`, `paragrafos.ts`, `regras.ts`, `injetar.ts`
- Create: `scripts/test-nexo-modelo-capa.ts`
- Modify: `package.json` (script `"test:nexo:modelo-capa": "node scripts/test-nexo-modelo-capa.ts"`)

**Interfaces:**
- Consumes: `preencherCorpo` (Task 1), `desembrulharCamposDeUsuario`.
- Produces:
  - `tipos.ts`: `CampoDaCapa` (union abaixo), `Trecho = { texto: string; campo: CampoDaCapa | "FIXO" }`, `ParagrafoDaCapa = { indice: number; texto: string }`, `ParagrafoClassificado = ParagrafoDaCapa & { trechos: Trecho[] | null; origem: "regra" | "ia" | "pessoa" | null }`, `FormatoDoTomo`, `FormatoDoVolume`, `PropostaDeModelo = { paragrafos: ParagrafoClassificado[]; tomoFormat: FormatoDoTomo | null; volumeFormat: FormatoDoVolume | null }`, `ContextoDasRegras = { obra?: string; bairro?: string; orgaos: string[]; secretarias: string[] }`.
  - `paragrafos.ts`: `lerParagrafos(contentXml: string): ParagrafoDaCapa[]` (só os com texto; `indice` = posição na enumeração COMPLETA, a mesma de `lerLayoutDoModelo`), `PARAGRAFO_RE`, `corpoDoTexto(contentXml)`.
  - `regras.ts`: `classificarPorRegras(paragrafos, ctx): PropostaDeModelo`, `aplicarRespostas(proposta, respostas: { indice: number; campo: CampoDaCapa | "FIXO" }[], origem: "ia" | "pessoa"): PropostaDeModelo`, `pendentes(proposta): ParagrafoClassificado[]`.
  - `injetar.ts`: `injetarMarcadores(contentXml: string, proposta: PropostaDeModelo): string`.

- [ ] **Step 1: tipos** — `server/nexo/modelo-capa/tipos.ts`:

```ts
/**
 * O MODELO DE CAPA ANEXADO — os tipos do núcleo puro.
 * Desenho: docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 * PURO: nenhum import.
 */
export type CampoDaCapa =
  | "ORGAO"
  | "SECRETARIA"
  | "NOME_OBRA"
  | "BAIRRO"
  | "FASE"
  | "TITULO_CAPA"
  | "DISCIPLINA"
  | "TOMO"
  | "VOLUME"
  | "MES_ANO"
  | "CODIGO_EXIBIDO";

export const CAMPOS_DA_CAPA: readonly CampoDaCapa[] = [
  "ORGAO", "SECRETARIA", "NOME_OBRA", "BAIRRO", "FASE", "TITULO_CAPA",
  "DISCIPLINA", "TOMO", "VOLUME", "MES_ANO", "CODIGO_EXIBIDO",
];

/** Um pedaço do parágrafo: texto fixo, ou o valor de um campo. */
export interface Trecho {
  texto: string;
  campo: CampoDaCapa | "FIXO";
}

export interface ParagrafoDaCapa {
  /** Posição na enumeração COMPLETA do corpo (a de `lerLayoutDoModelo`). */
  indice: number;
  /** Texto visível, entidades XML decodificadas. */
  texto: string;
}

export interface ParagrafoClassificado extends ParagrafoDaCapa {
  /** `null` = ninguém classificou ainda (vai para a IA). */
  trechos: Trecho[] | null;
  origem: "regra" | "ia" | "pessoa" | null;
}

export type FormatoDoTomo = "parenthesized-padded" | "parenthesized" | "plain-padded" | "plain";
export type FormatoDoVolume = "roman" | "numeric";

export interface PropostaDeModelo {
  paragrafos: ParagrafoClassificado[];
  tomoFormat: FormatoDoTomo | null;
  volumeFormat: FormatoDoVolume | null;
}

export interface ContextoDasRegras {
  /** Obra do projeto (`Project.identidade`/nome), para reconhecer as linhas dela. */
  obra?: string;
  bairro?: string;
  /** `defaults.orgao` dos modelos de prefeitura. */
  orgaos: string[];
  /** `defaults.secretaria` dos modelos de prefeitura (vazias fora). */
  secretarias: string[];
}
```

- [ ] **Step 2: parágrafos** — `server/nexo/modelo-capa/paragrafos.ts`:

```ts
/**
 * Os parágrafos com texto do corpo do ODT, na MESMA enumeração de
 * `server/odt/layout.ts` (parágrafo E título, auto-fechado primeiro). O índice
 * é o que a injeção usa para achar o parágrafo de volta — enumerar diferente
 * aqui marcaria a linha errada.
 * PURO: nenhum import de runtime.
 */
import type { ParagrafoDaCapa } from "./tipos.ts";

export const PARAGRAFO_RE =
  /<text:(?:p|h)\b[^>]*\/>|<text:(p|h)\b[^>]*(?<!\/)>[\s\S]*?<\/text:\1>/g;

/** Início e fim do miolo de `<office:text>`. */
export function corpoDoTexto(contentXml: string): { inicio: number; fim: number } {
  const abre = /<office:text\b[^>]*>/.exec(contentXml);
  if (!abre) throw new Error("ODT sem office:text");
  const inicio = abre.index + abre[0].length;
  const fim = contentXml.indexOf("</office:text>", inicio);
  if (fim < 0) throw new Error("ODT sem fechamento de office:text");
  return { inicio, fim };
}

export function decodificar(texto: string): string {
  return texto
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Texto visível de um parágrafo bruto: `<text:s/>` vira espaço, `<text:tab/>` também. */
export function textoDoParagrafo(bruto: string): string {
  return decodificar(
    bruto
      .replace(/^<text:(?:p|h)\b[^>]*>/, "")
      .replace(/<\/text:(?:p|h)>$/, "")
      .replace(/<text:(?:s|tab)\b[^>]*\/>/g, " ")
      .replace(/<text:line-break\/>/g, " ")
      .replace(/<[^>]*>/g, ""),
  );
}

export function lerParagrafos(contentXml: string): ParagrafoDaCapa[] {
  const inicio = contentXml.indexOf("<office:body");
  const corpo = inicio >= 0 ? contentXml.slice(inicio) : contentXml;
  const brutos = corpo.match(PARAGRAFO_RE) ?? [];
  const saida: ParagrafoDaCapa[] = [];
  brutos.forEach((bruto, indice) => {
    const texto = textoDoParagrafo(bruto).replace(/\s+/g, " ").trim();
    if (texto) saida.push({ indice, texto });
  });
  return saida;
}
```

- [ ] **Step 3: regras** — `server/nexo/modelo-capa/regras.ts`:

```ts
/**
 * A LEITURA DETERMINÍSTICA da capa anexada: o que tem forma conhecida não vai
 * para a IA. Código, data, tomo, volume, fase, órgão e secretaria têm forma; a
 * obra se reconhece pela identidade do projeto. O resto fica `null` e sobe.
 * PURO: nenhum import de runtime.
 */
import type {
  CampoDaCapa, ContextoDasRegras, FormatoDoTomo, FormatoDoVolume,
  ParagrafoClassificado, ParagrafoDaCapa, PropostaDeModelo, Trecho,
} from "./tipos.ts";

const MESES =
  "JANEIRO|FEVEREIRO|MARÇO|MARCO|ABRIL|MAIO|JUNHO|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO";

function norm(v: string): string {
  return v.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const inteiro = (campo: CampoDaCapa, texto: string): Trecho[] => [{ texto, campo }];

interface Achado {
  trechos: Trecho[];
  tomoFormat?: FormatoDoTomo;
  volumeFormat?: FormatoDoVolume;
}

function formatoDoTomo(texto: string): FormatoDoTomo {
  const parenteses = texto.trim().startsWith("(");
  const numero = /\d+/.exec(texto)?.[0] ?? "";
  const comZero = numero.length >= 2 && numero.startsWith("0");
  if (parenteses) return comZero ? "parenthesized-padded" : "parenthesized";
  return comZero ? "plain-padded" : "plain";
}

/** Uma regra por forma. A primeira que casa decide o parágrafo. */
function porForma(texto: string, ctx: ContextoDasRegras): Achado | null {
  const t = texto.trim();

  if (/^\d{3}[-_]\d{2}$/.test(t)) return { trechos: inteiro("CODIGO_EXIBIDO", t) };

  if (new RegExp(`^(${MESES})\\s*(DE\\s+)?[/ -]?\\s*\\d{4}$`, "i").test(t) || /^\d{2}\/\d{4}$/.test(t)) {
    return { trechos: inteiro("MES_ANO", t) };
  }

  if (/^\(?\s*TOMO\s+\d+\s*\)?$/i.test(t)) {
    return { trechos: inteiro("TOMO", t), tomoFormat: formatoDoTomo(t) };
  }

  // "Vol. VII", "VOLUME 05" — o rótulo fica fixo, o valor vira campo.
  const vol = /^(VOL(?:UME)?\.?\s*)([IVXLC]+|\d+)$/i.exec(t);
  if (vol) {
    return {
      trechos: [{ texto: vol[1], campo: "FIXO" }, { texto: vol[2], campo: "VOLUME" }],
      volumeFormat: /^\d+$/.test(vol[2]) ? "numeric" : "roman",
    };
  }

  // "VOLUME 05 – PROJETO ESTRUTURAL" (Criciúma): rótulo, volume, separador, título.
  const volTitulo = /^(VOL(?:UME)?\.?\s*)([IVXLC]+|\d+)(\s*[–-]\s*)(.+)$/i.exec(t);
  if (volTitulo) {
    return {
      trechos: [
        { texto: volTitulo[1], campo: "FIXO" },
        { texto: volTitulo[2], campo: "VOLUME" },
        { texto: volTitulo[3], campo: "FIXO" },
        { texto: volTitulo[4], campo: "TITULO_CAPA" },
      ],
      volumeFormat: /^\d+$/.test(volTitulo[2]) ? "numeric" : "roman",
    };
  }

  if (/^PROJETO\s+(EXECUTIVO|B[ÁA]SICO|LEGAL|PRELIMINAR)$/i.test(t)) {
    return { trechos: inteiro("FASE", t) };
  }

  const n = norm(t);
  if (ctx.orgaos.some((o) => o && norm(o) === n) || /^prefeitura municipal de /.test(n)) {
    return { trechos: inteiro("ORGAO", t) };
  }
  if (ctx.secretarias.some((s) => s && norm(s) === n) || /^secretaria (municipal )?de /.test(n)) {
    return { trechos: inteiro("SECRETARIA", t) };
  }

  if (ctx.bairro && n.length >= 4 && norm(ctx.bairro) === n) return { trechos: inteiro("BAIRRO", t) };

  // A obra quebra em linhas: cada linha é um PEDAÇO contíguo da obra do projeto.
  if (ctx.obra && n.length >= 8 && norm(ctx.obra).includes(n)) {
    return { trechos: inteiro("NOME_OBRA", t) };
  }

  return null;
}

export function classificarPorRegras(
  paragrafos: readonly ParagrafoDaCapa[],
  ctx: ContextoDasRegras,
): PropostaDeModelo {
  let tomoFormat: FormatoDoTomo | null = null;
  let volumeFormat: FormatoDoVolume | null = null;
  const saida: ParagrafoClassificado[] = paragrafos.map((p) => {
    const achado = porForma(p.texto, ctx);
    if (!achado) return { ...p, trechos: null, origem: null };
    if (achado.tomoFormat) tomoFormat ??= achado.tomoFormat;
    if (achado.volumeFormat) volumeFormat ??= achado.volumeFormat;
    return { ...p, trechos: achado.trechos, origem: "regra" };
  });
  return { paragrafos: saida, tomoFormat, volumeFormat };
}

/** Os que ninguém classificou — é isso, e só isso, que vai para a IA. */
export function pendentes(proposta: PropostaDeModelo): ParagrafoClassificado[] {
  return proposta.paragrafos.filter((p) => p.trechos === null);
}

/**
 * Aplica respostas por parágrafo inteiro (IA ou pessoa). Resposta para índice
 * que não existe é ignorada: o índice alucinado não pode marcar outra linha.
 */
export function aplicarRespostas(
  proposta: PropostaDeModelo,
  respostas: readonly { indice: number; campo: CampoDaCapa | "FIXO" }[],
  origem: "ia" | "pessoa",
): PropostaDeModelo {
  const porIndice = new Map(respostas.map((r) => [r.indice, r.campo]));
  return {
    ...proposta,
    paragrafos: proposta.paragrafos.map((p) => {
      const campo = porIndice.get(p.indice);
      if (campo === undefined) return p;
      // A IA só preenche o que está pendente; a pessoa pode trocar qualquer um.
      if (origem === "ia" && p.trechos !== null) return p;
      return { ...p, trechos: [{ texto: p.texto, campo }], origem };
    }),
  };
}
```

- [ ] **Step 4: injeção** — `server/nexo/modelo-capa/injetar.ts`:

```ts
/**
 * INJETA OS MARCADORES na capa anexada: cada parágrafo classificado tem o seu
 * texto trocado pelos trechos — o fixo escapado, o campo como `{{CAMPO}}`. O
 * estilo do parágrafo fica; o do PRIMEIRO span também (é ele que costuma
 * carregar fonte e corpo). Parágrafo todo FIXO, ou sem classificação, fica
 * intacto, byte a byte.
 * PURO: nenhum import de runtime.
 */
import { PARAGRAFO_RE, corpoDoTexto } from "./paragrafos.ts";
import type { PropostaDeModelo, Trecho } from "./tipos.ts";

function escapar(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function miolo(trechos: readonly Trecho[]): string {
  return trechos.map((t) => (t.campo === "FIXO" ? escapar(t.texto) : `{{${t.campo}}}`)).join("");
}

function reescrever(bruto: string, trechos: readonly Trecho[]): string {
  const abre = /^<text:(p|h)\b[^>]*?(\/?)>/.exec(bruto)!;
  const tag = abre[1];
  const abertura = abre[2] === "/" ? abre[0].replace(/\s*\/>$/, ">") : abre[0];
  const span = /<text:span\b[^>]*text:style-name="([^"]+)"[^>]*>/.exec(bruto)?.[1];
  const dentro = span ? `<text:span text:style-name="${span}">${miolo(trechos)}</text:span>` : miolo(trechos);
  return `${abertura}${dentro}</text:${tag}>`;
}

export function injetarMarcadores(contentXml: string, proposta: PropostaDeModelo): string {
  const porIndice = new Map(
    proposta.paragrafos
      .filter((p) => p.trechos && p.trechos.some((t) => t.campo !== "FIXO"))
      .map((p) => [p.indice, p.trechos!]),
  );
  // A MESMA enumeração da leitura: a partir de <office:body>.
  const corpoInicio = Math.max(0, contentXml.indexOf("<office:body"));
  const { fim } = corpoDoTexto(contentXml);
  let indice = -1;
  const corpo = contentXml.slice(corpoInicio, fim).replace(PARAGRAFO_RE, (bruto) => {
    indice++;
    const trechos = porIndice.get(indice);
    return trechos ? reescrever(bruto, trechos) : bruto;
  });
  return contentXml.slice(0, corpoInicio) + corpo + contentXml.slice(fim);
}
```

- [ ] **Step 5: o teste de ida e volta** — `scripts/test-nexo-modelo-capa.ts`:

```ts
/**
 * IDA E VOLTA do modelo de capa anexado, nos 4 modelos do repositório.
 *
 * Para cada modelo M: preenche com os dados A → capa C (o que o engenheiro
 * anexaria). Lê C, classifica por regras, responde os pendentes com um ORÁCULO
 * (o marcador que o modelo original tinha naquele parágrafo — testa a fiação,
 * não a IA), injeta → modelo M'. Então:
 *   1. M' preenchido com A dá o MESMO texto que C;
 *   2. M' preenchido com B (outra obra, outro tomo, outra data) dá o mesmo
 *      texto que M preenchido com B — prova que os campos são campos de verdade.
 *
 *   node scripts/test-nexo-modelo-capa.ts   (== npm run test:nexo:modelo-capa)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import JSZip from "jszip";

import { lerLayoutDoModelo } from "../server/odt/layout.ts";
import { desembrulharCamposDeUsuario, preencherCorpo, type ValoresDaPagina } from "../server/odt/marcadores.ts";
import { lerParagrafos } from "../server/nexo/modelo-capa/paragrafos.ts";
import { aplicarRespostas, classificarPorRegras, pendentes } from "../server/nexo/modelo-capa/regras.ts";
import { injetarMarcadores } from "../server/nexo/modelo-capa/injetar.ts";
import type { CampoDaCapa } from "../server/nexo/modelo-capa/tipos.ts";

let passed = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const escapar = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<text:line-break/>");

const ROOT = "templates/capas";
const MODELOS = ["prefchap", "pmcriciuma", "prefflor", "prefsjose"];

interface Dados {
  obra: string; bairro: string; titulo: string; tomo: string; volume: string; mesAno: string; codigo: string;
}
const A: Dados = {
  obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL\nDE CHAPECÓ", bairro: "CENTRO",
  titulo: "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO", tomo: "", volume: "", mesAno: "JUNHO/2026", codigo: "040-26",
};
const B: Dados = {
  obra: "CENTRO DE EVENTOS\nARENA BELVEDERE", bairro: "BELVEDERE",
  titulo: "PROJETO HIDROSSANITÁRIO\nREDE DE ESGOTO", tomo: "", volume: "", mesAno: "OUTUBRO/2026", codigo: "117-25",
};

function corpoDe(xml: string): string {
  const a = /<office:text\b[^>]*>/.exec(xml)!;
  return xml.slice(a.index + a[0].length, xml.indexOf("</office:text>"));
}
function comCorpo(xml: string, corpo: string): string {
  const a = /<office:text\b[^>]*>/.exec(xml)!;
  return xml.slice(0, a.index + a[0].length) + corpo + xml.slice(xml.indexOf("</office:text>"));
}

async function carregar(id: string) {
  const cfg = JSON.parse(readFileSync(`${ROOT}/${id}/config.json`, "utf8"));
  const zip = await JSZip.loadAsync(readFileSync(`${ROOT}/${id}/${cfg.arquivoTemplate}`));
  const xml = desembrulharCamposDeUsuario(await zip.file("content.xml")!.async("string"));
  return { cfg, xml };
}

function valores(cfg: { defaults: { orgao: string; secretaria: string; fase: string }; tomoFormat?: string; volumeFormat?: string }, d: Dados, tomo: string, volume: string): ValoresDaPagina {
  return {
    gerais: {
      "{{ORGAO}}": cfg.defaults.orgao, "{{SECRETARIA}}": cfg.defaults.secretaria,
      "{{NOME_OBRA}}": d.obra, "{{FASE}}": cfg.defaults.fase, "{{BAIRRO}}": d.bairro,
      "{{MES_ANO}}": d.mesAno, "{{CODIGO_EXIBIDO}}": d.codigo,
    },
    tituloCapa: d.titulo, extras: {}, disciplina: "", tomo, volume,
  };
}

function preencher(xml: string, v: ValoresDaPagina): string {
  return comCorpo(xml, preencherCorpo(corpoDe(xml), v, escapar));
}

const textos = (xml: string) => lerParagrafos(xml).map((p) => p.texto);

for (const id of MODELOS) {
  await test(`${id}: ida e volta preserva a capa e os campos`, async () => {
    const { cfg, xml } = await carregar(id);
    const tomoA = cfg.tomoFormat === "plain" ? "TOMO 2" : cfg.tomoFormat === "plain-padded" ? "TOMO 02" : cfg.tomoFormat === "parenthesized" ? "(TOMO 2)" : "(TOMO 02)";
    const volA = cfg.volumeFormat === "numeric" ? "05" : "VII";
    const capaA = preencher(xml, valores(cfg, A, tomoA, volA));

    // O oráculo: o marcador que o modelo ORIGINAL tinha em cada parágrafo de C.
    // A enumeração de C não é a de M (parágrafos de marcador vazio colapsam), então
    // casamos pelo TEXTO: o texto de cada parágrafo de C → o marcador de M que o gerou.
    const layout = lerLayoutDoModelo(xml);
    const oraculo = new Map<string, CampoDaCapa | "FIXO">();
    const paragrafosC = lerParagrafos(capaA);
    for (const p of paragrafosC) {
      const temTitulo = A.titulo.split("\n").some((l) => p.texto.includes(l));
      if (temTitulo) oraculo.set(p.texto, "TITULO_CAPA");
    }

    const ctx = {
      obra: A.obra.replace(/\n/g, " "), bairro: A.bairro,
      orgaos: [cfg.defaults.orgao], secretarias: [cfg.defaults.secretaria],
    };
    let proposta = classificarPorRegras(paragrafosC, ctx);
    const faltam = pendentes(proposta);
    proposta = aplicarRespostas(
      proposta,
      faltam.map((p) => ({ indice: p.indice, campo: oraculo.get(p.texto) ?? "FIXO" })),
      "ia",
    );
    if (proposta.tomoFormat) assert.equal(proposta.tomoFormat, cfg.tomoFormat ?? "plain-padded", "formato do tomo");
    if (proposta.volumeFormat) assert.equal(proposta.volumeFormat, cfg.volumeFormat ?? "roman", "formato do volume");

    const modeloNovo = injetarMarcadores(capaA, proposta);

    // 1. mesmo texto com os mesmos dados
    assert.deepEqual(textos(preencher(modeloNovo, valores(cfg, A, tomoA, volA))), textos(capaA));

    // 2. outros dados: o modelo novo imprime o que o original imprimiria
    const tomoB = tomoA.replace("2", "3");
    const volB = cfg.volumeFormat === "numeric" ? "08" : "IX";
    assert.deepEqual(
      textos(preencher(modeloNovo, valores(cfg, B, tomoB, volB))),
      textos(preencher(xml, valores(cfg, B, tomoB, volB))),
    );
    // a IA só viu o que as regras não reconhecem — nunca código, data, tomo, volume
    for (const p of faltam) assert.ok(!/^\d{3}[-_]\d{2}$|TOMO|^VOL/i.test(p.texto), `foi para a IA: ${p.texto}`);
  });
}

await test("injeção: parágrafo FIXO fica byte a byte", () => {
  const xml = '<office:body><office:text><text:p text:style-name="P1">ESTADO DE SANTA CATARINA</text:p><text:p text:style-name="P2"><text:span text:style-name="T1">040-26</text:span></text:p></office:text></office:body>';
  const proposta = classificarPorRegras(lerParagrafos(xml), { orgaos: [], secretarias: [] });
  const saida = injetarMarcadores(xml, proposta);
  assert.match(saida, /<text:p text:style-name="P1">ESTADO DE SANTA CATARINA<\/text:p>/);
  assert.match(saida, /<text:span text:style-name="T1">\{\{CODIGO_EXIBIDO\}\}<\/text:span>/);
});

await test("regras: Vol. VII mantém o rótulo fixo", () => {
  const p = classificarPorRegras([{ indice: 0, texto: "Vol. VII" }], { orgaos: [], secretarias: [] });
  assert.deepEqual(p.paragrafos[0].trechos, [{ texto: "Vol. ", campo: "FIXO" }, { texto: "VII", campo: "VOLUME" }]);
  assert.equal(p.volumeFormat, "roman");
});

await test("aplicarRespostas: índice alucinado não marca nada", () => {
  const base = classificarPorRegras([{ indice: 3, texto: "QUALQUER" }], { orgaos: [], secretarias: [] });
  const r = aplicarRespostas(base, [{ indice: 99, campo: "NOME_OBRA" }], "ia");
  assert.equal(r.paragrafos[0].trechos, null);
});

console.log(`\n${passed} ok`);
```

> **Nota ao implementador:** se a asserção 1 ou 2 falhar num modelo, a falha é DADO: imprima `paragrafosC` e a proposta. O ajuste esperado é na regra (`porForma`) ou no oráculo — nunca relaxar a asserção. Linhas de obra que viram 2 parágrafos (`{{NOME_OBRA}}` repetido) precisam sair NOME_OBRA nos dois; `distribuirNosMarcadores` já reparte as linhas.

- [ ] **Step 6:** `npm run test:nexo:modelo-capa` → falhas viram ajuste; repetir até `4 + 3 ok`.
- [ ] **Step 7: commit** — `git add server/nexo/modelo-capa scripts/test-nexo-modelo-capa.ts package.json` → `"Modelo de capa: leitura por regras e injeção de marcadores, ida e volta nos 4 modelos"`.

---

### Task 3: Tabela + armazenamento do modelo do projeto

**Files:**
- Modify: `prisma/schema.prisma` (model novo + relação em `Project`, perto de `pranchas PranchaDoProjeto[]`, linha ~245)
- Create: `prisma/migrations/20261016120000_modelo_de_capa_do_projeto/migration.sql`
- Create: `server/modelo-capa.ts`

**Interfaces:**
- Produces:
  - `ConfigDoModeloDoProjeto = { campos: string[]; tomoFormat: FormatoDoTomo; volumeFormat: FormatoDoVolume; defaults: { orgao: string; secretaria: string; fase: string }; paginasPorCapa: number }`
  - `guardarModeloDeCapa(args: { organizationId; projectId; nomeOriginal; bytes: Uint8Array; config: ConfigDoModeloDoProjeto; email: string }): Promise<FichaDoModelo>`
  - `fichaDoModeloDeCapa(projectId): Promise<FichaDoModelo | null>` com `FichaDoModelo = { nomeOriginal: string; criadoEm: string; config: ConfigDoModeloDoProjeto; checksum: string }`
  - `modeloDeCapaResolvido(projectId, organizationId): Promise<{ config: ConfigDoModeloDoProjeto; bytes: Buffer } | null>`
  - `ID_DO_MODELO_DO_PROJETO = (projectId: string) => \`projeto:${projectId}\`` e `projetoDoModelo(templateId: string): string | null`

- [ ] **Step 1: schema**

```prisma
/// O MODELO DE CAPA que o projeto já tinha (16/10/2026). Os bytes moram no
/// cofre (`StoredFile`, cifrado); aqui fica a ficha e a leitura confirmada.
/// Um ativo por projeto: anexar outro substitui.
model ModeloDeCapaDoProjeto {
  id             String   @id @default(cuid())
  projectId      String   @unique
  checksumSha256 String
  nomeOriginal   String
  /// campos, tomoFormat, volumeFormat, defaults, paginasPorCapa
  config         Json
  /// E-mail de quem confirmou. Registro, não posse.
  criadoPor      String
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  project        Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

e em `model Project`: `modeloDeCapa ModeloDeCapaDoProjeto?`.

- [ ] **Step 2: migração** — `migration.sql`:

```sql
CREATE TABLE "ModeloDeCapaDoProjeto" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "nomeOriginal" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "criadoPor" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModeloDeCapaDoProjeto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ModeloDeCapaDoProjeto_projectId_key" ON "ModeloDeCapaDoProjeto"("projectId");
ALTER TABLE "ModeloDeCapaDoProjeto" ADD CONSTRAINT "ModeloDeCapaDoProjeto_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Aplicar só no banco de dev: `npx prisma migrate deploy` com o `.env.local` apontando para `nexodoc_dev` (conferir `DATABASE_URL` antes — memória `nexodoc-dev-escreve-em-producao`), depois `npx prisma generate`.

- [ ] **Step 3: `server/modelo-capa.ts`**

```ts
/**
 * O MODELO DE CAPA DO PROJETO: ficha no Postgres, bytes no cofre.
 * Desenho: docs/superpowers/specs/2026-10-16-capa-anexada-design.md
 * Toda função recebe o projeto JÁ conferido (`projetoDoEscritorio`).
 */
import { guardarNoCofre, lerDoCofre } from "@/lib/cofre";
import { getPrisma } from "@/lib/db";
import type { FormatoDoTomo, FormatoDoVolume } from "@/server/nexo/modelo-capa/tipos";

export interface ConfigDoModeloDoProjeto {
  campos: string[];
  tomoFormat: FormatoDoTomo;
  volumeFormat: FormatoDoVolume;
  defaults: { orgao: string; secretaria: string; fase: string };
  /** 1, ou 2 quando o modelo tem contracapa. É a régua do transbordo. */
  paginasPorCapa: number;
}

export interface FichaDoModelo {
  nomeOriginal: string;
  criadoEm: string;
  checksum: string;
  config: ConfigDoModeloDoProjeto;
}

const PREFIXO = "projeto:";
export const idDoModeloDoProjeto = (projectId: string) => `${PREFIXO}${projectId}`;
export function projetoDoModelo(templateId: string): string | null {
  return templateId.startsWith(PREFIXO) ? templateId.slice(PREFIXO.length) || null : null;
}

const ODT_MIME = "application/vnd.oasis.opendocument.text";

export async function guardarModeloDeCapa(args: {
  organizationId: string;
  projectId: string;
  nomeOriginal: string;
  bytes: Uint8Array;
  config: ConfigDoModeloDoProjeto;
  email: string;
}): Promise<FichaDoModelo> {
  const guardado = await guardarNoCofre({ bytes: args.bytes, organizationId: args.organizationId, mimeType: ODT_MIME });
  const dados = {
    checksumSha256: guardado.checksumSha256,
    nomeOriginal: args.nomeOriginal,
    config: args.config as unknown as object,
    criadoPor: args.email,
  };
  const linha = await getPrisma().modeloDeCapaDoProjeto.upsert({
    where: { projectId: args.projectId },
    create: { projectId: args.projectId, ...dados },
    update: dados,
  });
  return {
    nomeOriginal: linha.nomeOriginal,
    criadoEm: linha.updatedAt.toISOString(),
    checksum: linha.checksumSha256,
    config: linha.config as unknown as ConfigDoModeloDoProjeto,
  };
}

export async function fichaDoModeloDeCapa(projectId: string): Promise<FichaDoModelo | null> {
  const linha = await getPrisma().modeloDeCapaDoProjeto.findUnique({ where: { projectId } });
  if (!linha) return null;
  return {
    nomeOriginal: linha.nomeOriginal,
    criadoEm: linha.updatedAt.toISOString(),
    checksum: linha.checksumSha256,
    config: linha.config as unknown as ConfigDoModeloDoProjeto,
  };
}

export async function modeloDeCapaResolvido(
  projectId: string,
  organizationId: string,
): Promise<{ ficha: FichaDoModelo; bytes: Buffer } | null> {
  const ficha = await fichaDoModeloDeCapa(projectId);
  if (!ficha) return null;
  const arquivo = await lerDoCofre(ficha.checksum, organizationId);
  if (!arquivo) return null;
  return { ficha, bytes: arquivo.bytes };
}
```

- [ ] **Step 4:** `npx tsc --noEmit -p .` limpo.
- [ ] **Step 5: commit** — `git add prisma/schema.prisma prisma/migrations/20261016120000_modelo_de_capa_do_projeto server/modelo-capa.ts` → `"Modelo de capa do projeto: tabela e cofre"`.

---

### Task 4: A capa gera com o modelo do projeto (rota da capa + ODT por bytes)

**Files:**
- Modify: `server/odt/index.ts` (`GenerateOdtInput.templateBytes?: Buffer`)
- Modify: `server/nexo/tools/generate-covers.ts` (`templateBytes?` repassado; aviso de páginas — ver Task 7)
- Modify: `server/nexo/build-capa-proposal.ts:179-189` (`input.template?: TemplateConfigFile`)
- Modify: `app/api/nexo/capa/route.ts` (resolve `projeto:`)

**Interfaces:**
- Consumes: `modeloDeCapaResolvido`, `projetoDoModelo`, `projetoDoEscritorio` (de `server/pranchas.ts`).
- Produces: `templateDoModeloDoProjeto(projectId, ficha): TemplateConfigFile` em `server/modelo-capa.ts`:

```ts
import type { TemplateConfigFile } from "@/server/templates/registry";

/** O modelo do projeto com a cara de um template de prefeitura. */
export function templateDoModeloDoProjeto(projectId: string, ficha: FichaDoModelo): TemplateConfigFile {
  return {
    id: idDoModeloDoProjeto(projectId),
    nome: "Modelo do projeto",
    grupo: "Modelo do projeto",
    variante: ficha.nomeOriginal,
    arquivoTemplate: ficha.nomeOriginal,
    volumeFormat: ficha.config.volumeFormat,
    tomoFormat: ficha.config.tomoFormat,
    coverTitleMode: "items",
    defaults: ficha.config.defaults,
    campos: ficha.config.campos,
  };
}
```

- [ ] **Step 1:** `server/odt/index.ts` — em `GenerateOdtInput` acrescentar:

```ts
  /** Bytes do modelo quando ele não mora em `templates/capas` (modelo do projeto). */
  templateBytes?: Buffer;
```

e em `generateOdtBuffer`, antes do `getTemplateOdtPath`:

```ts
  if (input.templateBytes) {
    return await fillExistingOdt(templateId ?? "", input.templateBytes, generalData, mesAno, codigoExibido, pages, extras ?? {});
  }
```

- [ ] **Step 2:** `generate-covers.ts` — `GenerateCoversInput` ganha `templateBytes?: Buffer`, repassado em `generateOdtBuffer({... , ...(input.templateBytes ? { templateBytes: input.templateBytes } : {}) })`.

- [ ] **Step 3:** `build-capa-proposal.ts` — `BuildCapaInput` ganha `template?: TemplateConfigFile`; a busca vira:

```ts
  const template = input.template ?? (await getTemplateRegistry()).find((t) => t.id === input.templateId);
```

- [ ] **Step 4:** `app/api/nexo/capa/route.ts` — trocar `await requireActor()` por `const actor = await requireActor();` (declarar `let actor` fora do try), e antes de `buildCapaProposal`:

```ts
  /*
   * O MODELO DO PROJETO (16/10/2026): `projeto:<id>` não mora no disco — a
   * config vem da tabela e os bytes do cofre, e só se o projeto é deste
   * escritório. Sem isso, cai no 400 de template desconhecido, como antes.
   */
  let templateDoProjeto: { template: TemplateConfigFile; bytes: Buffer } | null = null;
  const projetoDoTemplate = projetoDoModelo(templateId);
  if (projetoDoTemplate) {
    const ok = await projetoDoEscritorio(projetoDoTemplate, actor.organizationId);
    const resolvido = ok ? await modeloDeCapaResolvido(projetoDoTemplate, actor.organizationId) : null;
    if (!resolvido) {
      return NextResponse.json({ error: "O modelo de capa deste projeto não foi encontrado. Anexe a capa de novo." }, { status: 404 });
    }
    templateDoProjeto = { template: templateDoModeloDoProjeto(projetoDoTemplate, resolvido.ficha), bytes: resolvido.bytes };
  }
```

passar `...(templateDoProjeto ? { template: templateDoProjeto.template } : {})` ao `buildCapaProposal` e `...(templateDoProjeto ? { templateBytes: templateDoProjeto.bytes } : {})` ao `generateCovers`.

- [ ] **Step 5:** `npx tsc --noEmit -p .` limpo; `npm run test:nexo:odt-marcadores` e `npm run test:nexo:modelo-capa` verdes.
- [ ] **Step 6: commit** — `"Capa: gera com o modelo do projeto (projeto:<id>), bytes do cofre"`.

---

### Task 5: Rota `/api/nexo/modelo-capa` (ler, confirmar, consultar) + IA

**Files:**
- Create: `server/nexo/modelo-capa/ia.ts`
- Create: `app/api/nexo/modelo-capa/route.ts`

**Interfaces:**
- Consumes: Tasks 2–4; `executeOpenAiResponse` (`lib/ai-runner.ts`), `verificarTetoMensal`/`mensagemDeTetoEstourado` (`lib/ai-budget.ts`, mesmo uso de `app/api/nexo/selo-check/route.ts`), `convertOdtToPdf` (`server/pdf`), `generateOdtBuffer`, `getTemplateRegistry`.
- Produces (contrato HTTP; projeto sempre por `?projeto=<id>`):
  - `GET` → `{ modelo: FichaDoModelo | null }`
  - `POST` multipart `arquivo` (.odt) → `{ proposta: PropostaDeModelo, paginasOriginais: number | null }` (nada gravado)
  - `PUT` multipart `arquivo` + `proposta` (JSON) → `{ modelo: FichaDoModelo, templateId: string }` ou `422 { error, motivo: "transborda" }`

- [ ] **Step 1: `ia.ts`**

```ts
/**
 * A IA SÓ NO QUE SOBROU: os parágrafos que as regras não reconheceram, numa
 * chamada só, resposta em JSON estrito. O índice vem da posição que mandamos —
 * `aplicarRespostas` descarta índice que não existe.
 */
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { CAMPOS_DA_CAPA, type CampoDaCapa, type ParagrafoClassificado } from "./tipos";

const MODELO_PADRAO = "gpt-6-luna";

const INSTRUCOES = `Você classifica linhas da CAPA de um volume de projeto de engenharia brasileiro (entregue a uma prefeitura).
Para cada linha, diga qual campo ela é:
ORGAO (prefeitura/governo), SECRETARIA, NOME_OBRA (nome da obra, pode ocupar várias linhas), BAIRRO, FASE (ex.: PROJETO EXECUTIVO),
TITULO_CAPA (o que o volume contém, ex.: PROJETO ESTRUTURAL CONCRETO, IMPLANTAÇÃO — pode ocupar várias linhas),
DISCIPLINA, TOMO, VOLUME, MES_ANO, CODIGO_EXIBIDO,
ou FIXO quando a linha é igual em toda capa deste escritório (nome da empresa, "ESTADO DE SANTA CATARINA", endereço, rótulos).
Na dúvida entre um campo e FIXO, prefira FIXO: um campo errado apaga texto da capa.`;

export async function classificarComIa(args: {
  pendentes: readonly ParagrafoClassificado[];
  contexto: readonly ParagrafoClassificado[];
  userEmail: string;
  projectId: string;
}): Promise<{ indice: number; campo: CampoDaCapa | "FIXO" }[]> {
  if (args.pendentes.length === 0) return [];
  const model = process.env.NEXODOC_MODELO_CAPA_MODEL?.trim() || MODELO_PADRAO;
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["linhas"],
    properties: {
      linhas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["indice", "campo"],
          properties: {
            indice: { type: "integer" },
            campo: { type: "string", enum: [...CAMPOS_DA_CAPA, "FIXO"] },
          },
        },
      },
    },
  };
  const capaInteira = args.contexto.map((p) => `${p.indice}: ${p.texto}`).join("\n");
  const aClassificar = args.pendentes.map((p) => p.indice).join(", ");
  const resultado = await executeOpenAiResponse({
    flow: "ld-extraction",
    model,
    operation: "nexo-modelo-capa",
    userEmail: args.userEmail,
    projectId: args.projectId,
    metadata: { pendentes: args.pendentes.length },
    request: {
      model,
      max_output_tokens: 1500,
      reasoning: { effort: "none" },
      instructions: INSTRUCOES,
      input: [{ role: "user", content: [{ type: "input_text" as const, text: `A capa inteira (índice: texto):\n${capaInteira}\n\nClassifique só os índices: ${aClassificar}` }] }],
      text: { format: { type: "json_schema" as const, name: "nexo_modelo_capa", strict: true, schema } },
    },
  });
  const parsed = JSON.parse(resultado.text) as { linhas?: { indice: number; campo: string }[] };
  const validos = new Set(args.pendentes.map((p) => p.indice));
  return (parsed.linhas ?? [])
    .filter((l) => validos.has(l.indice) && (CAMPOS_DA_CAPA as readonly string[]).concat("FIXO").includes(l.campo))
    .map((l) => ({ indice: l.indice, campo: l.campo as CampoDaCapa | "FIXO" }));
}
```

> Conferir a assinatura real de `ExecuteOpenAiResponseArgs` (`lib/ai-runner.ts`): se `projectId` não existir nela, retirar; se `conversationId` for obrigatório, passar `null`.

- [ ] **Step 2: a rota** — `app/api/nexo/modelo-capa/route.ts`. Estrutura (portão igual a `app/api/pranchas/route.ts`: `comPortao`, `projetoConferido`, `erro`):

```ts
import JSZip from "jszip";
import { NextResponse, type NextRequest } from "next/server";
import { PDFDocument } from "pdf-lib";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { mensagemDeTetoEstourado, verificarTetoMensal } from "@/lib/ai-budget";
import { isDatabaseConfigured } from "@/lib/db";
import { getPrisma } from "@/lib/db";
import { isNexoEnabled } from "@/lib/feature-flags";
import { projetoDoEscritorio } from "@/server/pranchas";
import { fichaDoModeloDeCapa, guardarModeloDeCapa, idDoModeloDoProjeto, type ConfigDoModeloDoProjeto } from "@/server/modelo-capa";
import { classificarComIa } from "@/server/nexo/modelo-capa/ia";
import { injetarMarcadores } from "@/server/nexo/modelo-capa/injetar";
import { lerParagrafos } from "@/server/nexo/modelo-capa/paragrafos";
import { aplicarRespostas, classificarPorRegras, pendentes } from "@/server/nexo/modelo-capa/regras";
import type { PropostaDeModelo } from "@/server/nexo/modelo-capa/tipos";
import { desembrulharCamposDeUsuario } from "@/server/odt/marcadores";
import { generateOdtBuffer } from "@/server/odt";
import { convertOdtToPdf } from "@/server/pdf";
import { getTemplateRegistry } from "@/server/templates/registry";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const TETO_DO_ODT = 15 * 1024 * 1024;

function erro(status: number, mensagem: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: mensagem, ...extra }, { status });
}

async function projetoConferido(req: NextRequest, organizationId: string): Promise<string | null> {
  const projeto = req.nextUrl.searchParams.get("projeto")?.trim() ?? "";
  if (!ID.test(projeto)) return null;
  return (await projetoDoEscritorio(projeto, organizationId)) ? projeto : null;
}

async function comPortao(fn: () => Promise<Response>): Promise<Response> {
  if (!isNexoEnabled()) return erro(404, "Modulo Nexo desativado.");
  try {
    if (!isDatabaseConfigured()) return erro(503, "Banco não configurado.");
    return await fn();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

/** O ODT do formulário, conferido: é zip, tem content.xml, cabe no teto. */
async function odtDoFormulario(form: FormData): Promise<{ nome: string; bytes: Buffer; contentXml: string } | string> {
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File)) return "Faltou o arquivo.";
  if (!/\.odt$/i.test(arquivo.name)) return "O modelo precisa ser .odt.";
  if (arquivo.size > TETO_DO_ODT) return "O ODT passa de 15 MB.";
  const bytes = Buffer.from(await arquivo.arrayBuffer());
  try {
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("content.xml")?.async("string");
    if (!xml) return "O arquivo não é um ODT válido (falta content.xml).";
    return { nome: arquivo.name, bytes, contentXml: desembrulharCamposDeUsuario(xml) };
  } catch {
    return "O arquivo não abriu como ODT.";
  }
}

async function paginasDoPdf(pdf: Buffer | null): Promise<number | null> {
  if (!pdf) return null;
  return (await PDFDocument.load(pdf, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
}

/** O contexto das regras: obra do projeto + órgãos/secretarias das prefeituras. */
async function contextoDasRegras(projectId: string) {
  const projeto = await getPrisma().project.findUnique({ where: { id: projectId }, select: { name: true, identidade: true } });
  const identidade = (projeto?.identidade ?? {}) as Record<string, { valor?: string } | string | undefined>;
  const valor = (k: string) => {
    const v = identidade[k];
    return typeof v === "string" ? v : v?.valor;
  };
  const registry = await getTemplateRegistry();
  return {
    obra: valor("obra") || projeto?.name || undefined,
    bairro: valor("bairro") || undefined,
    orgaos: registry.map((t) => t.defaults.orgao).filter(Boolean),
    secretarias: registry.map((t) => t.defaults.secretaria).filter(Boolean),
  };
}

export async function GET(req: NextRequest) {
  return comPortao(async () => {
    const actor = await requireActor();
    const projeto = await projetoConferido(req, actor.organizationId);
    if (!projeto) return erro(404, "Projeto não encontrado.");
    return NextResponse.json({ modelo: await fichaDoModeloDeCapa(projeto) });
  });
}

export async function POST(req: NextRequest) {
  return comPortao(async () => {
    const actor = await requireActor();
    const projeto = await projetoConferido(req, actor.organizationId);
    if (!projeto) return erro(404, "Projeto não encontrado.");
    const odt = await odtDoFormulario(await req.formData());
    if (typeof odt === "string") return erro(400, odt);

    let proposta = classificarPorRegras(lerParagrafos(odt.contentXml), await contextoDasRegras(projeto));
    const faltam = pendentes(proposta);
    if (faltam.length > 0) {
      const teto = await verificarTetoMensal();
      if (teto && !teto.dentro) {
        // Sem IA, o que sobrou fica "texto fixo" e o engenheiro corrige no card.
        proposta = aplicarRespostas(proposta, faltam.map((p) => ({ indice: p.indice, campo: "FIXO" as const })), "ia");
      } else {
        const respostas = await classificarComIa({ pendentes: faltam, contexto: proposta.paragrafos, userEmail: actor.email, projectId: projeto });
        proposta = aplicarRespostas(proposta, respostas, "ia");
        // O que a IA não respondeu também cai em FIXO: nada fica sem dono no card.
        proposta = aplicarRespostas(proposta, pendentes(proposta).map((p) => ({ indice: p.indice, campo: "FIXO" as const })), "ia");
      }
    }

    const original = await convertOdtToPdf(odt.bytes);
    return NextResponse.json({ proposta, paginasOriginais: await paginasDoPdf(original.pdfBuffer ?? null) });
  });
}

export async function PUT(req: NextRequest) {
  return comPortao(async () => {
    const actor = await requireActor();
    const projeto = await projetoConferido(req, actor.organizationId);
    if (!projeto) return erro(404, "Projeto não encontrado.");
    const form = await req.formData();
    const odt = await odtDoFormulario(form);
    if (typeof odt === "string") return erro(400, odt);
    let proposta: PropostaDeModelo;
    try {
      proposta = JSON.parse(String(form.get("proposta") ?? "")) as PropostaDeModelo;
      if (!Array.isArray(proposta.paragrafos)) throw new Error();
    } catch {
      return erro(400, "Proposta inválida.");
    }

    // 1. os marcadores entram no content.xml
    const zip = await JSZip.loadAsync(odt.bytes);
    zip.file("content.xml", injetarMarcadores(odt.contentXml, proposta));
    const modelo = Buffer.from(await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/vnd.oasis.opendocument.text" }));

    const campos = [...new Set(proposta.paragrafos.flatMap((p) => (p.trechos ?? []).map((t) => t.campo)).filter((c) => c !== "FIXO"))];
    const textoDe = (campo: string) =>
      proposta.paragrafos.filter((p) => p.trechos?.some((t) => t.campo === campo)).map((p) => p.texto).join(" ");

    // 2. o ensaio: dados longos de propósito
    const original = await paginasDoPdf((await convertOdtToPdf(odt.bytes)).pdfBuffer ?? null);
    const ensaio = await generateOdtBuffer({
      templateId: idDoModeloDoProjeto(projeto),
      templateBytes: modelo,
      generalData: {
        orgao: textoDe("ORGAO") || "PREFEITURA MUNICIPAL",
        secretaria: textoDe("SECRETARIA"),
        nomeObra: "REVITALIZAÇÃO E AMPLIAÇÃO DO CENTRO MUNICIPAL\nDE EVENTOS E FEIRAS DA REGIÃO\nOESTE COM ESTACIONAMENTO\nE ÁREA DE LAZER",
        fase: textoDe("FASE") || "PROJETO EXECUTIVO",
        bairro: "CENTRO",
        mes: "SETEMBRO", ano: "2026",
        codigoInterno: "999_26", codigoExibido: "999-26",
      } as never,
      pages: [{ tituloCapa: "PROJETO DE INSTALAÇÕES HIDROSSANITÁRIAS\nREDE DE ESGOTO E DRENAGEM", disciplina: "", tomo: "(TOMO 04)", volume: "VIII" }] as never,
    });
    const doEnsaio = await paginasDoPdf((await convertOdtToPdf(ensaio)).pdfBuffer ?? null);
    if (original !== null && doEnsaio !== null && doEnsaio > original) {
      return erro(422, `A capa transborda para a ${doEnsaio}ª página com uma obra de 4 linhas — ajuste o espaço no modelo e anexe de novo.`, { motivo: "transborda" });
    }

    const config: ConfigDoModeloDoProjeto = {
      campos,
      tomoFormat: proposta.tomoFormat ?? "parenthesized-padded",
      volumeFormat: proposta.volumeFormat ?? "roman",
      defaults: { orgao: textoDe("ORGAO"), secretaria: textoDe("SECRETARIA"), fase: textoDe("FASE") || "PROJETO EXECUTIVO" },
      paginasPorCapa: original ?? 1,
    };
    const ficha = await guardarModeloDeCapa({
      organizationId: actor.organizationId, projectId: projeto, nomeOriginal: odt.nome, bytes: modelo, config, email: actor.email,
    });
    return NextResponse.json({ modelo: ficha, templateId: idDoModeloDoProjeto(projeto), ensaiado: doEnsaio !== null });
  });
}
```

> Conferir os tipos reais de `GeneralData`/`CoverPage` (`modules/cover-generator/types.ts`) e trocar os `as never` por objetos completos; conferir a assinatura de `verificarTetoMensal` no `selo-check` e copiar o uso.

- [ ] **Step 3: prova manual da rota** (dev, banco `nexodoc_dev`): com o servidor rodando, `curl -b <cookie> -F arquivo=@templates/capas/prefchap/modelo-capa.odt "http://localhost:3000/api/nexo/modelo-capa?projeto=<id do 040-26 no dev>"` devolve proposta com os marcadores já presentes classificados (o modelo do repositório tem `{{…}}`; as regras não casam — tudo vai para IA/FIXO; serve só de fumaça). A prova real é a Task 8.
- [ ] **Step 4:** `npx tsc --noEmit -p .` limpo. **Commit** — `"Rota do modelo de capa: lê, ensaia o transbordo e grava no projeto"`.

---

### Task 6: O modelo do projeto aparece e é escolhido

**Files:**
- Modify: `app/api/capas/templates/route.ts`
- Modify: `modules/nexo/components/NexoChat.tsx:262`, `modules/nexo/components/NexoCanvas.tsx:590` (fetch com o projeto)
- Modify: `server/nexo/agent/normalize.ts` (`NormalizeContext.modeloDoProjeto?: string`; capa)
- Modify: `app/api/nexo/agent/route.ts` (resolve e passa)
- Modify: `modules/nexo/components/NexoChat.tsx:537` (fetch do agente com `cabecalhosDeGeracao()` se ainda não manda o projeto)
- Test: `scripts/test-nexo-agent.ts`

**Interfaces:**
- Consumes: `fichaDoModeloDeCapa`, `templateDoModeloDoProjeto`, `idDoModeloDoProjeto`, `projetoDoPedido` (`lib/projeto-do-pedido.ts`).

- [ ] **Step 1: teste que falha** em `scripts/test-nexo-agent.ts` (seguir o formato dos testes de `normalizeProposals` que já estão lá):

```ts
test("capa: o modelo do projeto vence a prefeitura do carimbo", () => {
  const out = normalizeProposals(
    [{ kind: "capa", resumo: "Capa", tituloCapa: "" }],
    { disciplina: "EST", prefeituras: [{ id: "prefchap", nome: "Prefeitura Municipal de Chapecó" }], prefeituraDoSelo: "prefchap", modeloDoProjeto: "projeto:abc" },
  );
  assert.equal(out[0].kind, "capa");
  assert.equal((out[0] as { params: { templateId: string } }).params.templateId, "projeto:abc");
});

test("separatriz NÃO usa o modelo do projeto (é da prefeitura)", () => {
  const out = normalizeProposals(
    [{ kind: "separatriz", resumo: "Sep" }],
    { disciplina: "EST", prefeituras: [{ id: "prefchap", nome: "Prefeitura Municipal de Chapecó" }], prefeituraDoSelo: "prefchap", modeloDoProjeto: "projeto:abc" },
  );
  assert.equal((out[0] as { params: { templateId: string } }).params.templateId, "prefchap");
});
```

- [ ] **Step 2:** `npm run test:nexo:agent` → FALHA no primeiro.
- [ ] **Step 3: normalize** — em `NormalizeContext`:

```ts
  /**
   * O MODELO DE CAPA QUE O PROJETO JÁ TEM (`projeto:<id>`), quando há
   * (16/10/2026). Vale SÓ para a capa — a separatriz segue a prefeitura. Fica
   * acima do carimbo; a decisão do engenheiro no card continua acima dele.
   */
  modeloDoProjeto?: string;
```

no ramo `p.kind === "capa"`: `const templateId = ctx.modeloDoProjeto || templateDoVolume;` e a linha `if (ctx.prefeituras.length === 0) continue;` vira `if (ctx.prefeituras.length === 0 && !ctx.modeloDoProjeto) continue;`. O `resumo` usa `ctx.modeloDoProjeto ? "Capa — modelo do projeto" : ...`.

- [ ] **Step 4:** `npm run test:nexo:agent` → verde.
- [ ] **Step 5: rota do agente** — perto de `const registry = await getTemplateRegistry();`:

```ts
  // O modelo de capa do projeto, se o projeto da conversa (conferido) tiver um.
  const projetoDaConversa = projetoDoPedido(req.headers);
  const modeloDoProjeto =
    projetoDaConversa && (await projetoDoEscritorio(projetoDaConversa, actor.organizationId)) && (await fichaDoModeloDeCapa(projetoDaConversa))
      ? idDoModeloDoProjeto(projetoDaConversa)
      : undefined;
```

(usar o `actor` que a rota já obtém; se ela só chama `requireActor()` sem guardar, guardar). Passar `modeloDoProjeto` no `slotContext` e em toda chamada que monta o `NormalizeContext` (as linhas que hoje passam `prefeituraDoSelo: slotContext.prefeituraDoSelo` — passar `modeloDoProjeto` junto). Conferir que o fetch do agente em `NexoChat.tsx:537` manda `x-nexo-projeto`; se não, usar `headers: { ...cabecalhosDeGeracao(), Accept: ... }` preservando os cabeçalhos atuais.

- [ ] **Step 6: lista de templates** — `app/api/capas/templates/route.ts`: `GET(req: NextRequest)`, guardar o `actor`, e depois de montar `templates`:

```ts
    const projeto = projetoDoPedido(req.headers);
    if (projeto && (await projetoDoEscritorio(projeto, actor.organizationId))) {
      const resolvido = await modeloDeCapaResolvido(projeto, actor.organizationId);
      if (resolvido) {
        const zip = await JSZip.loadAsync(resolvido.bytes);
        const xml = await zip.file("content.xml")?.async("string");
        templates.unshift({
          ...templateDoModeloDoProjeto(projeto, resolvido.ficha),
          layout: xml ? lerLayoutDoModelo(xml) : [],
        });
      }
    }
```

Nos dois clientes, o `fetch("/api/capas/templates")` passa a `fetch("/api/capas/templates", { headers: cabecalhosDeGeracao() })` e depende do projeto da conversa (re-busca quando o projeto muda e quando o evento `nexo:modelo-capa-gravado` dispara — `window.addEventListener`, emitido na Task 7).

- [ ] **Step 7:** `npx tsc --noEmit -p .`; `npm run test:nexo:agent`. **Commit** — `"Capa: o modelo do projeto entra na lista e vence o carimbo na proposta"`.

---

### Task 7: Anexo no chat — papel `capa`, ODT, card de confirmação, PDF como está, aviso de transbordo

**Files:**
- Modify: `modules/nexo/lib/papel-do-anexo.ts` (`PapelDoAnexo` + `"capa"`; `decidirPapel`)
- Test: `scripts/test-papel-do-anexo.ts`
- Modify: `modules/nexo/components/NexoChat.tsx:80` (`papel?: "memorial" | "prancha" | "indeciso" | "capa"`), chip mostra "capa" sem botão de trocar
- Create: `modules/nexo/components/ModeloDeCapaCard.tsx`
- Modify: `modules/nexo/components/NexoWorkspace.tsx` (`readSelos`, `accept` dos inputs em ~3058/3080, render do card na mensagem, estado `capaPdfAnexada`)
- Modify: `modules/nexo/components/ConfirmationCard.tsx:952-1000` (capa: usa o PDF anexado quando há)
- Modify: `server/nexo/tools/generate-covers.ts` + `app/api/nexo/capa/route.ts` (aviso de páginas a mais)

**Interfaces:**
- Consumes: rota da Task 5; `cabecalhosDeGeracao`; tipo `PropostaDeModelo`, `CAMPOS_DA_CAPA` (importar de `server/nexo/modelo-capa/tipos.ts` por caminho relativo — o módulo é puro).
- Produces: mensagem de conversa com `modeloDeCapa?: { arquivoId: string; nome: string; proposta: PropostaDeModelo; estado: "propondo" | "gravado" | "recusado"; motivo?: string }` (campo novo no tipo de mensagem do `conv`, seguindo o padrão de `fichaDoMemorial`).

- [ ] **Step 1: teste que falha** — em `scripts/test-papel-do-anexo.ts`:

```ts
test("nome diz capa e o PDF tem 1 folha → capa", () => {
  const r = decidirPapel({ pelaConvencao: "capa", pelaGeometria: "prancha", fatos: { paginas: 1, amostra: [] } });
  assert.equal(r.papel, "capa");
});
test("nome diz capa mas são 30 folhas de texto → indeciso (como antes)", () => {
  const r = decidirPapel({ pelaConvencao: "capa", pelaGeometria: "memorial", fatos: { paginas: 30, amostra: [] } });
  assert.equal(r.papel, "indeciso");
});
```

- [ ] **Step 2:** `npm run test:papel-do-anexo` → FALHA.
- [ ] **Step 3:** `PapelDoAnexo = "memorial" | "prancha" | "indeciso" | "capa"`; em `decidirPapel`, dentro de `if (NOME_DIZ_PRANCHA.includes(pelaConvencao))`, depois do teste de `memorial`:

```ts
    if (pelaConvencao === "capa" && fatos.paginas <= 2) {
      return { papel: "capa", porque: "O nome diz capa: uso como a capa do volume." };
    }
```

  `npm run test:papel-do-anexo` verde. Rodar `npm run medir:papel` e registrar no commit quantos arquivos do acervo viraram `capa` (esperado: só os de nome `*capa*`).

- [ ] **Step 4: `readSelos`** em `NexoWorkspace.tsx`:
  - `const odts = all.filter((f) => /\.odt$/i.test(f.name));` e excluí-los de `recusados`. A frase de recusa passa a citar "PDF (ou a capa em ODT)".
  - Logo depois de `const pranchas = ...`: `const capasPdf = preVoos.filter((p) => p.papel === "capa").map((p) => p.file);`
  - Para cada ODT (antes do Caso A): `await lerModeloDeCapa(odt)` — função nova:

```ts
  async function lerModeloDeCapa(arquivo: File) {
    if (!conv.projectId) {
      conv.appendMessage({ id: crypto.randomUUID(), role: "assistant", content: "Para usar a capa como modelo, a conversa precisa estar num projeto. Anexe uma prancha ou o memorial primeiro." });
      return;
    }
    const id = crypto.randomUUID();
    arquivosPorAnexo.current.set(id, arquivo);
    setAttachments((prev) => [...prev, { id, name: arquivo.name, kind: "pdf" as const, papel: "capa" as const }]);
    const form = new FormData();
    form.set("arquivo", arquivo);
    const res = await fetch(`/api/nexo/modelo-capa?projeto=${encodeURIComponent(conv.projectId)}`, { method: "POST", body: form });
    const corpo = (await res.json().catch(() => null)) as { proposta?: PropostaDeModelo; error?: string } | null;
    if (!res.ok || !corpo?.proposta) {
      conv.appendMessage({ id: crypto.randomUUID(), role: "assistant", content: `Não consegui ler a capa ${arquivo.name}: ${corpo?.error ?? "erro desconhecido"}.` });
      return;
    }
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Li a capa ${arquivo.name}. Confira o que é cada linha antes de eu usar como modelo deste projeto.`,
      modeloDeCapa: { arquivoId: id, nome: arquivo.name, proposta: corpo.proposta, estado: "propondo" },
    });
  }
```

  - Capas PDF: `setCapaPdfAnexada(capasPdf[0])` e mensagem: `"Vou usar ${nome} como a capa do volume, do jeito que está."` + (se o volume tiver mais de um tomo, o card de capa mostra o aviso — Step 7).
  - `accept` dos dois inputs: `"application/pdf,.odt,application/vnd.oasis.opendocument.text"` (e `,image/*` no segundo).

- [ ] **Step 5: `ModeloDeCapaCard.tsx`** — card com os primitivos do design system já usados nos cards vizinhos (ver `ConfirmationCard.tsx` para `Card`, `Button`, `LABEL_CLASS`; seguir `DESIGN.md`: acento teal só no interativo, chanfro `.nx-cut-*`). Conteúdo:
  - título "Modelo de capa" + nome do arquivo;
  - uma linha por parágrafo: texto original (truncado em 1 linha, `title` com o inteiro) | `<select>` com `CAMPOS_DA_CAPA` em rótulos pt-BR (Órgão, Secretaria, Obra, Bairro, Fase, Título, Disciplina, Tomo, Volume, Mês/ano, Código) + "Texto fixo"; parágrafos de vários trechos (ex.: `Vol. VII`) mostram os trechos lidos e não têm seletor;
  - origem `ia` com o selo "sugerido";
  - rodapé: aviso "Sem linha de tomo: volumes com mais de um tomo sairão sem o número" quando nenhum trecho é `TOMO`;
  - botões **Usar este modelo** (primário) e **Descartar**.
  - Trocar o seletor chama `aplicarRespostas(proposta, [{ indice, campo }], "pessoa")` (import relativo de `server/nexo/modelo-capa/regras.ts`).
  - "Usar este modelo": `PUT /api/nexo/modelo-capa?projeto=…` com `arquivo` (de `arquivosPorAnexo.current.get(arquivoId)`) e `proposta`; 200 → `estado: "gravado"`, mensagem "Pronto: as capas deste projeto saem deste modelo." e `window.dispatchEvent(new Event("nexo:modelo-capa-gravado"))`; 422 → `estado: "recusado"` com o `error` no card; arquivo ausente (F5) → "Anexe a capa de novo para gravar."

- [ ] **Step 6: render** — onde a mensagem renderiza `fichaDoMemorial`, renderizar `modeloDeCapa` com o card (mesmo padrão de props/atualização `conv.atualizarMensagem`). Acrescentar `modeloDeCapa` ao tipo de mensagem e à persistência da conversa (conferir `conversation-store`: campos desconhecidos são preservados? se houver lista branca, acrescentar).

- [ ] **Step 7: PDF como está** — `ConfirmationCard` (capa, `confirm()`): receber `capaPdfAnexada?: File | null` por prop (passada pelo Workspace como os outros dados da conversa). Se presente, em vez de `postCapa`:

```ts
      if (capaPdfAnexada) {
        const url = URL.createObjectURL(capaPdfAnexada);
        await saveResult({
          artifactId: id,
          kind: "capa",
          payload: { ...params, tomo: tomo.numero, capaAnexada: capaPdfAnexada.name },
          summary: `Capa anexada · ${capaPdfAnexada.name}`,
          canvas: { label: "Capa anexada", detail: capaPdfAnexada.name, titulo: params.tituloCapa, pageNumber: 1 },
          files: [{ label: "PDF", name: capaPdfAnexada.name, mime: PDF_MIME, url, primary: true }],
        });
        return;
      }
```

  e, com `params.numTomos > 1`, o card mostra a linha "A capa em PDF entra igual em todos os tomos; para numerar o tomo, mande o ODT."

- [ ] **Step 8: aviso de transbordo em toda capa** — `generate-covers.ts`: depois de `semPaginasEmBranco`, contar páginas (`PDFDocument.load(...).getPageCount()`) e comparar com `pages.length * (input.paginasPorCapa ?? 1)`; devolver `paginasAMais: number` (0 quando bate ou sem PDF). `GenerateCoversInput.paginasPorCapa?: number` (Florianópolis: 2 — ler do `config.json` se houver campo `paginasPorCapa`; acrescentar `"paginasPorCapa": 2` em `templates/capas/prefflor/config.json` e o campo opcional em `TemplateConfigFile`; o modelo do projeto passa `ficha.config.paginasPorCapa`). A rota da capa repassa `paginasAMais` no JSON; `postCapa` o expõe em `CapaGenResult`; o card da capa, quando > 0, mostra: "A capa saiu com N página(s) a mais — o modelo transborda. Confira antes de entregar."

- [ ] **Step 9:** `npx tsc --noEmit -p .`, `npm run lint`, `npm run test:papel-do-anexo`, `npm run test:nexo:agent`, `npm run test:nexo:modelo-capa`. **Commit(s)** por assunto: papel+anexo+card; PDF como está; aviso de transbordo.

---

### Task 8: Prova no navegador (build de produção)

**Files:**
- Create: `scripts/prova-capa-anexada.mjs` (seguir o formato de `scripts/prova-memorial-sem-capa.mjs` e `scripts/shot-nexo-frame-capa.mjs`)

- [ ] **Step 1:** fabricar o ODT de prova: preencher `templates/capas/prefchap/modelo-capa.odt` com os dados do 040-26 (pode reutilizar o ODT que `/api/nexo/capa` devolve numa geração real) → `docs/samples/040-26/capa-pronta-040-26.odt` não versionado (scratchpad).
- [ ] **Step 2:** `npm run build && npm start` (memória `nexodoc-manifesto-recarrega-dev`: testar UI em build de produção); conversa do 040-26 no dev; anexar o ODT; conferir o card (obra, código, tomo, volume, data classificados); trocar uma linha à mão; "Usar este modelo".
- [ ] **Step 3:** pedir a capa no chat; conferir no card "modelo do projeto"; baixar o PDF e ler por coordenada (`shot-nexo-frame-capa.mjs`): a obra/título/tomo novos aparecem no lugar certo; 1 página.
- [ ] **Step 4:** anexar `capa.pdf` numa outra conversa e montar o volume: a 1ª página do volume é o PDF anexado.
- [ ] **Step 5:** registrar o resultado na memória do projeto e commitar o script.

---

## Self-review (feito)

- Spec §1 entrada → Task 7 (Steps 1–4). §2 leitura → Tasks 2 e 5. §3 confirmação → Task 7 (Step 5). §4 gravação/ensaio/tabela → Tasks 3 e 5. §5 uso/precedência/procedência → Tasks 4 e 6. §6 PDF → Task 7 (Step 7). §7 contagem em toda capa → Task 7 (Step 8). §8 testes → Tasks 2 e 8. Custo → Task 5.
- Desvios conscientes do spec, anotados: (a) modelo de IA por env, não `AiModelConfig`; (b) o chip de capa não oferece "trocar papel" nesta entrega (capa PDF só pelo nome; ODT é sempre capa).
- Nomes conferidos entre tarefas: `preencherCorpo`/`ValoresDaPagina`, `classificarPorRegras`/`aplicarRespostas`/`pendentes`, `injetarMarcadores`, `idDoModeloDoProjeto`/`projetoDoModelo`, `modeloDeCapaResolvido`, `templateDoModeloDoProjeto`, `fichaDoModeloDeCapa`, `modeloDoProjeto` (ctx).
