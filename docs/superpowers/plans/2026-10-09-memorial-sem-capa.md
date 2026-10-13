# Memorial sem capa — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** um memorial de disciplina sem capa recebe a identidade (obra, órgão, município…) do projeto quando ele já a conhece, mostra a procedência de cada campo na ficha, e — quando o memorial geral com capa chega — a capa vira a identidade do projeto e as auditorias anteriores são conferidas contra ela, sem IA.

**Architecture:** três módulos puros em `lib/` (comparação de obra, identidade guardada do projeto, escada de fontes) + uma coluna JSON em `Project` + uma rota `GET/PUT /api/projects/[id]/identidade`. A rota `/api/nexo/classify` aplica a escada no dossiê no servidor (uma ida só). O cliente grava a capa (origem `capa`) e as correções da ficha (origem `usuario`) pela rota nova, e mostra divergência na conversa e um selo na âncora do parecer.

**Tech Stack:** Next.js (App Router — ler `node_modules/next/dist/docs/` antes de criar rota), Prisma/Postgres, TypeScript; testes são `scripts/test-*.ts` rodados com `node` (type stripping), sem framework.

Spec: `docs/superpowers/specs/2026-10-09-memorial-sem-capa-design.md`.

## Global Constraints

- Escada da ficha: `usuario > capa > projeto > corpo > vazio`; código: `arquivo > capa`, código do corpo só vira sinal.
- No projeto: `capa` sobrescreve tudo e registra divergência; `usuario` sobrescreve `selo`; nada sobrescreve `capa` exceto outra `capa`; `corpo` NUNCA grava.
- Conferência retroativa é determinística (sem chamada de modelo) e nunca reaudita.
- **Ajuste ao spec:** a conferência fica em `Project.identidade.conferencias[auditId]`, não dentro de `Audit.report` (um lugar de escrita só; o parecer é imutável).
- Módulos de `lib/` deste plano são PUROS: só imports relativos com extensão `.ts` (como `lib/identidade-do-parecer.ts`), testáveis com `node scripts/test-x.ts`.
- A frase "Li as primeiras páginas" é contrato da bateria — não mexer.
- Cada task termina com commit direto na `main` (`git diff --cached --stat` antes), mensagem em pt-BR, com `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Fixtures: disciplina `docs/samples/040-26/estrutural_concreto/040_26_est_md_a.pdf`, geral `docs/samples/040-26/1_memorial/040_26_md_geral_a.pdf` (pasta ignorada pelo git; scripts pulam com aviso se faltar).

## Mapa de arquivos

| arquivo | papel |
|---|---|
| `lib/cross-document-audit.ts` (mod.) | exporta `mesmaObra(a, b)` |
| `lib/identidade-do-projeto.ts` (novo) | tipos da identidade guardada, `gravarIdentidade`, `aplicarGravacao`, `conferirAuditoria` |
| `lib/escada-da-identidade.ts` (novo) | `escadaDaIdentidade`, `sinalDeCodigoDoCorpo` |
| `modules/nexo/lib/dossie-com-projeto.ts` (novo) | aplica a escada num `NexoDossieDraft` |
| `modules/nexo/types.ts` (mod.) | `NexoDossieDraft.origens` |
| `server/nexo/classify-documents.ts` (mod.) | sinal do código do corpo |
| `app/api/nexo/classify/route.ts` (mod.) | degrau "projeto" no servidor |
| `prisma/schema.prisma` + migração | `Project.identidade Json` |
| `app/api/projects/[id]/identidade/route.ts` (novo) | GET/PUT |
| `modules/nexo/lib/identidade-no-projeto.ts` (novo) | cliente HTTP + `fraseDaConferencia` |
| `modules/nexo/lib/ficha-do-memorial.ts` (mod.) | `origem`, `semCapa` |
| `modules/nexo/components/FichaDoMemorial.tsx` (mod.) | rótulo de procedência |
| `modules/nexo/components/NexoWorkspace.tsx` (mod.) | grava capa / correção, fala de divergência |
| `modules/nexo/components/ConfirmationCard.tsx` (mod.) | procedência no cartão, selo na âncora |
| `scripts/medir-memorial-sem-capa.mjs` (novo) | prova com os PDFs do 040-26 |

---

### Task 1: `mesmaObra` exportada

**Files:**
- Modify: `lib/cross-document-audit.ts` (logo depois de `mesmaObraPorTokens`, ~linha 720)
- Test: `scripts/test-mesma-obra.ts` (novo); `package.json` (script)

**Interfaces:**
- Produces: `export function mesmaObra(a: string, b: string): boolean` — canonicaliza com `facilityCanonical` (siglas, acento, "bairro") e compara por tokens.

- [ ] **Step 0: linha de base** (antes de qualquer mudança): `npm run medir:identidade -- --salvar "$SCRATCH/identidade-antes.json"` (qualquer pasta fora do repo). A Task 10 compara contra ela.

- [ ] **Step 1: teste que falha** — `scripts/test-mesma-obra.ts`:

```ts
/**
 * A COMPARAÇÃO DE NOME DE OBRA usada pela conferência retroativa.
 *   node scripts/test-mesma-obra.ts   (== npm run test:mesma-obra)
 */
import assert from "node:assert/strict";

import { mesmaObra } from "../lib/cross-document-audit.ts";

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

test("040-26: rodapé herdado do 125-23 diverge da capa do geral", () => {
  assert.equal(mesmaObra("Feira Comercial de Chapecó", "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ"), false);
});
test("sigla e extenso são a mesma obra", () => {
  assert.equal(mesmaObra("UBS VILA MANAUS", "Unidade Básica de Saúde Vila Manaus"), true);
});
test("caixa e acento não importam", () => {
  assert.equal(mesmaObra("Revitalização da Feira Municipal de Chapecó", "REVITALIZACAO DA FEIRA MUNICIPAL DE CHAPECO"), true);
});
test("vazio nunca é a mesma obra", () => {
  assert.equal(mesmaObra("", "UBS VILA MANAUS"), false);
});

console.log(`\n${passed} ok`);
```

Em `package.json`, junto de `"test:identidade-do-parecer"`: `"test:mesma-obra": "node scripts/test-mesma-obra.ts",`

- [ ] **Step 2:** `npm run test:mesma-obra` → FALHA (`mesmaObra` não exportada).
- [ ] **Step 3: implementação** — em `lib/cross-document-audit.ts`, depois de `mesmaObraPorTokens`:

```ts
/**
 * Dois nomes de obra, como humanos os escrevem, são a mesma obra? A forma
 * exportável de `mesmaObraPorTokens`: canonicaliza antes (siglas de equipamento,
 * acento, "bairro"). Usada pela conferência retroativa de
 * [[identidade-do-projeto.ts]] — mesma régua da regra de identidade.
 */
export function mesmaObra(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  return mesmaObraPorTokens(facilityCanonical(a), facilityCanonical(b));
}
```

- [ ] **Step 4:** `npm run test:mesma-obra` → 4 ok. Se "040-26" falhar (disser que confere), PARAR e reportar — o spec manda ajustar a regra antes de seguir.
- [ ] **Step 5:** commit `Identidade: mesmaObra exportada (040-26 diverge, UBS confere)`.

---

### Task 2: identidade guardada do projeto (puro)

**Files:**
- Create: `lib/identidade-do-projeto.ts`
- Test: `scripts/test-identidade-do-projeto.ts`; `package.json` (`"test:identidade-do-projeto"`)

**Interfaces:**
- Consumes: `mesmaObra` (Task 1).
- Produces (todos exportados):

```ts
export const CAMPOS_DA_IDENTIDADE = ["obra", "orgao", "secretaria", "bairro", "municipio", "codigo", "mesAno"] as const;
export type CampoDaIdentidade = (typeof CAMPOS_DA_IDENTIDADE)[number];
export type OrigemGuardada = "capa" | "selo" | "usuario";
export type CampoGuardado = { valor: string; origem: OrigemGuardada; fonte: string; em: string; por?: string };
export type Divergencia = { campo: CampoDaIdentidade; anterior: CampoGuardado; nova: CampoGuardado; em: string };
export type ConferenciaDaAuditoria = { estado: "confere" | "diverge"; obraDaAuditoria: string; obraDaCapa: string; em: string };
export type IdentidadeDoProjeto = {
  campos: Partial<Record<CampoDaIdentidade, CampoGuardado>>;
  divergencias: Divergencia[];
  conferencias: Record<string, ConferenciaDaAuditoria>;
};
export function lerIdentidadeDoProjeto(json: unknown): IdentidadeDoProjeto;
export function gravarIdentidade(atual: IdentidadeDoProjeto, campo: CampoDaIdentidade, novo: CampoGuardado):
  { identidade: IdentidadeDoProjeto; mudou: boolean; divergencia?: Divergencia };
export type Gravacao = { origem: OrigemGuardada; fonte: string; em: string; por?: string; campos: Partial<Record<CampoDaIdentidade, string>> };
export function aplicarGravacao(atual: IdentidadeDoProjeto, g: Gravacao):
  { identidade: IdentidadeDoProjeto; divergencias: Divergencia[]; obraDaCapa: string | null };
export function conferirAuditoria(obraDaAuditoria: string, obraDaCapa: string, em: string): ConferenciaDaAuditoria;
```

- [ ] **Step 1: teste que falha** — `scripts/test-identidade-do-projeto.ts` (mesmo cabeçalho/`test()` da Task 1):

```ts
import assert from "node:assert/strict";
import {
  aplicarGravacao,
  conferirAuditoria,
  gravarIdentidade,
  lerIdentidadeDoProjeto,
  type CampoGuardado,
} from "../lib/identidade-do-projeto.ts";

const EM = "2026-10-09T12:00:00.000Z";
const g = (valor: string, origem: CampoGuardado["origem"], fonte = "x"): CampoGuardado => ({ valor, origem, fonte, em: EM });
const vazia = () => lerIdentidadeDoProjeto(null);

test("lê JSON ausente/torto como identidade vazia", () => {
  assert.deepEqual(vazia(), { campos: {}, divergencias: [], conferencias: {} });
  assert.deepEqual(lerIdentidadeDoProjeto({ campos: { obra: { valor: 1 } } }).campos, {});
});

test("usuário preenche campo vazio", () => {
  const r = gravarIdentidade(vazia(), "obra", g("Feira Comercial de Chapecó", "usuario"));
  assert.equal(r.mudou, true);
  assert.equal(r.identidade.campos.obra?.origem, "usuario");
});

test("capa sobrescreve usuário divergente e registra divergência", () => {
  const antes = gravarIdentidade(vazia(), "obra", g("Feira Comercial de Chapecó", "usuario")).identidade;
  const r = gravarIdentidade(antes, "obra", g("REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", "capa", "040_26_md_geral_a.pdf p.1"));
  assert.equal(r.identidade.campos.obra?.valor, "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ");
  assert.equal(r.divergencia?.anterior.valor, "Feira Comercial de Chapecó");
  assert.equal(r.identidade.divergencias.length, 1);
});

test("capa igual (por tokens) ao usuário não é divergência", () => {
  const antes = gravarIdentidade(vazia(), "obra", g("UBS Vila Manaus", "usuario")).identidade;
  const r = gravarIdentidade(antes, "obra", g("UNIDADE BÁSICA DE SAÚDE VILA MANAUS", "capa"));
  assert.equal(r.divergencia, undefined);
  assert.equal(r.identidade.campos.obra?.origem, "capa");
});

test("usuário NÃO sobrescreve capa", () => {
  const antes = gravarIdentidade(vazia(), "obra", g("REVITALIZAÇÃO DA FEIRA", "capa")).identidade;
  const r = gravarIdentidade(antes, "obra", g("Outra coisa", "usuario"));
  assert.equal(r.mudou, false);
  assert.equal(r.identidade.campos.obra?.valor, "REVITALIZAÇÃO DA FEIRA");
});

test("selo não sobrescreve usuário; usuário sobrescreve selo", () => {
  const u = gravarIdentidade(vazia(), "municipio", g("Chapecó", "usuario")).identidade;
  assert.equal(gravarIdentidade(u, "municipio", g("Xanxerê", "selo")).mudou, false);
  const s = gravarIdentidade(vazia(), "municipio", g("Xanxerê", "selo")).identidade;
  assert.equal(gravarIdentidade(s, "municipio", g("Chapecó", "usuario")).identidade.campos.municipio?.valor, "Chapecó");
});

test("município compara sem acento e sem caixa", () => {
  const antes = gravarIdentidade(vazia(), "municipio", g("chapeco", "usuario")).identidade;
  assert.equal(gravarIdentidade(antes, "municipio", g("CHAPECÓ", "capa")).divergencia, undefined);
});

test("aplicarGravacao ignora valor vazio e devolve a obra da capa", () => {
  const r = aplicarGravacao(vazia(), { origem: "capa", fonte: "geral p.1", em: EM, campos: { obra: "REVITALIZAÇÃO", municipio: "  " } });
  assert.equal(r.obraDaCapa, "REVITALIZAÇÃO");
  assert.equal(r.identidade.campos.municipio, undefined);
  assert.equal(aplicarGravacao(vazia(), { origem: "usuario", fonte: "ficha", em: EM, campos: { obra: "X" } }).obraDaCapa, null);
});

test("conferência retroativa: 040-26 diverge", () => {
  const c = conferirAuditoria("Feira Comercial de Chapecó", "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", EM);
  assert.equal(c.estado, "diverge");
});
```

- [ ] **Step 2:** `npm run test:identidade-do-projeto` → FALHA (módulo não existe).
- [ ] **Step 3: implementação** — `lib/identidade-do-projeto.ts`:

```ts
/**
 * A IDENTIDADE GUARDADA DO PROJETO — o que se sabe da obra, campo a campo, e
 * DE ONDE veio cada valor (09/10/2026). Mora em `Project.identidade`.
 *
 * Existe pelo memorial de disciplina sem capa: a capa mora no memorial GERAL,
 * que chega depois ou nunca. Ver
 * `docs/superpowers/specs/2026-10-09-memorial-sem-capa-design.md`.
 *
 * A regra de escrita: a CAPA é documento oficial e vence tudo, registrando a
 * divergência com o que havia; o que o USUÁRIO digitou vence o SELO; nada
 * vence a capa a não ser outra capa. O CORPO do memorial não é origem
 * guardável: no 040-26 ele trazia a obra e o código de outro projeto.
 *
 * PURO.
 */
import { mesmaObra } from "./cross-document-audit.ts";

export const CAMPOS_DA_IDENTIDADE = ["obra", "orgao", "secretaria", "bairro", "municipio", "codigo", "mesAno"] as const;
export type CampoDaIdentidade = (typeof CAMPOS_DA_IDENTIDADE)[number];
export type OrigemGuardada = "capa" | "selo" | "usuario";
export type CampoGuardado = { valor: string; origem: OrigemGuardada; fonte: string; em: string; por?: string };
export type Divergencia = { campo: CampoDaIdentidade; anterior: CampoGuardado; nova: CampoGuardado; em: string };
export type ConferenciaDaAuditoria = { estado: "confere" | "diverge"; obraDaAuditoria: string; obraDaCapa: string; em: string };
export type IdentidadeDoProjeto = {
  campos: Partial<Record<CampoDaIdentidade, CampoGuardado>>;
  divergencias: Divergencia[];
  conferencias: Record<string, ConferenciaDaAuditoria>;
};

const ORIGENS: readonly OrigemGuardada[] = ["capa", "selo", "usuario"];
/** Quem pode sobrescrever quem. A capa só perde para outra capa. */
const FORCA: Record<OrigemGuardada, number> = { selo: 1, usuario: 2, capa: 3 };

function ehCampoGuardado(v: unknown): v is CampoGuardado {
  const c = v as CampoGuardado | null;
  return Boolean(c) && typeof c!.valor === "string" && c!.valor.trim() !== "" &&
    ORIGENS.includes(c!.origem) && typeof c!.fonte === "string" && typeof c!.em === "string";
}

/** JSON do banco → identidade. Tudo o que não tiver a forma certa é descartado. */
export function lerIdentidadeDoProjeto(json: unknown): IdentidadeDoProjeto {
  const bruto = (json ?? {}) as Partial<Record<keyof IdentidadeDoProjeto, unknown>>;
  const campos: IdentidadeDoProjeto["campos"] = {};
  const c = (bruto.campos ?? {}) as Record<string, unknown>;
  for (const campo of CAMPOS_DA_IDENTIDADE) if (ehCampoGuardado(c[campo])) campos[campo] = c[campo] as CampoGuardado;
  const divergencias = Array.isArray(bruto.divergencias) ? (bruto.divergencias as Divergencia[]) : [];
  const conferencias =
    bruto.conferencias && typeof bruto.conferencias === "object"
      ? (bruto.conferencias as Record<string, ConferenciaDaAuditoria>)
      : {};
  return { campos, divergencias, conferencias };
}

function chave(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

function mesmoValor(campo: CampoDaIdentidade, a: string, b: string): boolean {
  return campo === "obra" ? mesmaObra(a, b) || chave(a) === chave(b) : chave(a) === chave(b);
}

export function gravarIdentidade(
  atual: IdentidadeDoProjeto,
  campo: CampoDaIdentidade,
  novo: CampoGuardado,
): { identidade: IdentidadeDoProjeto; mudou: boolean; divergencia?: Divergencia } {
  const valor = novo.valor.trim();
  if (!valor) return { identidade: atual, mudou: false };
  const anterior = atual.campos[campo];
  if (anterior && FORCA[novo.origem] < FORCA[anterior.origem]) return { identidade: atual, mudou: false };
  if (anterior && anterior.valor === valor && anterior.origem === novo.origem) return { identidade: atual, mudou: false };

  const gravado = { ...novo, valor };
  const divergencia: Divergencia | undefined =
    anterior && novo.origem === "capa" && anterior.origem !== "capa" && !mesmoValor(campo, anterior.valor, valor)
      ? { campo, anterior, nova: gravado, em: novo.em }
      : undefined;

  return {
    identidade: {
      ...atual,
      campos: { ...atual.campos, [campo]: gravado },
      divergencias: divergencia ? [...atual.divergencias, divergencia] : atual.divergencias,
    },
    mudou: true,
    ...(divergencia ? { divergencia } : {}),
  };
}

export type Gravacao = {
  origem: OrigemGuardada;
  fonte: string;
  em: string;
  por?: string;
  campos: Partial<Record<CampoDaIdentidade, string>>;
};

/** Vários campos de uma vez (uma capa, uma correção). */
export function aplicarGravacao(
  atual: IdentidadeDoProjeto,
  g: Gravacao,
): { identidade: IdentidadeDoProjeto; divergencias: Divergencia[]; obraDaCapa: string | null } {
  let identidade = atual;
  const divergencias: Divergencia[] = [];
  for (const campo of CAMPOS_DA_IDENTIDADE) {
    const valor = g.campos[campo]?.trim();
    if (!valor) continue;
    const r = gravarIdentidade(identidade, campo, {
      valor,
      origem: g.origem,
      fonte: g.fonte,
      em: g.em,
      ...(g.por ? { por: g.por } : {}),
    });
    identidade = r.identidade;
    if (r.divergencia) divergencias.push(r.divergencia);
  }
  const obraDaCapa = g.origem === "capa" ? (identidade.campos.obra?.origem === "capa" ? identidade.campos.obra.valor : null) : null;
  return { identidade, divergencias, obraDaCapa };
}

/** A obra com que uma auditoria rodou × a capa do geral. Sem IA. */
export function conferirAuditoria(obraDaAuditoria: string, obraDaCapa: string, em: string): ConferenciaDaAuditoria {
  return {
    estado: mesmoValor("obra", obraDaAuditoria, obraDaCapa) ? "confere" : "diverge",
    obraDaAuditoria,
    obraDaCapa,
    em,
  };
}
```

- [ ] **Step 4:** `npm run test:identidade-do-projeto` → todos ok.
- [ ] **Step 5:** commit `Identidade do projeto: regra de escrita (capa vence e avisa) e conferência retroativa`.

---

### Task 3: a escada de fontes (puro) + sinal do código do corpo

**Files:**
- Create: `lib/escada-da-identidade.ts`
- Modify: `server/nexo/classify-documents.ts:131-134`
- Test: `scripts/test-escada-da-identidade.ts`; `package.json` (`"test:escada-da-identidade"`)

**Interfaces:**
- Consumes: `IdentidadeDoProjeto`, `CampoDaIdentidade`, `CAMPOS_DA_IDENTIDADE` (Task 2).
- Produces:

```ts
export type OrigemNaFicha = "usuario" | "capa" | "projeto" | "corpo" | "arquivo";
export type ValorComOrigem = { valor: string; origem: OrigemNaFicha; fonte?: string };
export type Escada = Record<CampoDaIdentidade, ValorComOrigem | null>;
export function escadaDaIdentidade(args: {
  codigoDoArquivo?: string;
  capa?: Partial<Record<CampoDaIdentidade, string>> | null;
  projeto?: IdentidadeDoProjeto | null;
  corpo?: Partial<Record<CampoDaIdentidade, string>>;
}): Escada;
export function sinalDeCodigoDoCorpo(doArquivo: string, doCorpo: string): string | null;
```

- [ ] **Step 1: teste que falha** — `scripts/test-escada-da-identidade.ts`:

```ts
import assert from "node:assert/strict";
import { escadaDaIdentidade, sinalDeCodigoDoCorpo } from "../lib/escada-da-identidade.ts";
import { lerIdentidadeDoProjeto } from "../lib/identidade-do-projeto.ts";

const EM = "2026-10-09T12:00:00.000Z";
const projeto040 = lerIdentidadeDoProjeto({
  campos: {
    obra: { valor: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", origem: "capa", fonte: "040_26_md_geral_a.pdf p.1", em: EM },
    orgao: { valor: "PREFEITURA MUNICIPAL DE CHAPECÓ", origem: "capa", fonte: "040_26_md_geral_a.pdf p.1", em: EM },
    municipio: { valor: "Chapecó", origem: "capa", fonte: "040_26_md_geral_a.pdf p.1", em: EM },
  },
});
// O que o corpo do 040_26_est_md_a.pdf entrega hoje (medido em 09/10/2026).
const corpo040 = { obra: "Feira Comercial de Chapecó", codigo: "125-23" };

test("disciplina sem capa, projeto conhecido: projeto vence o corpo", () => {
  const e = escadaDaIdentidade({ codigoDoArquivo: "040-26", capa: null, projeto: projeto040, corpo: corpo040 });
  assert.deepEqual(e.obra, { valor: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", origem: "projeto", fonte: "040_26_md_geral_a.pdf p.1" });
  assert.equal(e.municipio?.origem, "projeto");
  assert.deepEqual(e.codigo, { valor: "040-26", origem: "arquivo" });
  assert.equal(e.secretaria, null);
});

test("disciplina sem capa, primeiro arquivo: corpo é sugestão", () => {
  const e = escadaDaIdentidade({ codigoDoArquivo: "040-26", capa: null, projeto: null, corpo: corpo040 });
  assert.deepEqual(e.obra, { valor: "Feira Comercial de Chapecó", origem: "corpo" });
  assert.equal(e.orgao, null);
});

test("código do corpo nunca é usado como código", () => {
  const e = escadaDaIdentidade({ capa: null, projeto: null, corpo: corpo040 });
  assert.equal(e.codigo, null);
});

test("capa do próprio memorial vence o projeto", () => {
  const e = escadaDaIdentidade({ codigoDoArquivo: "040-26", capa: { obra: "OUTRA OBRA" }, projeto: projeto040, corpo: {} });
  assert.equal(e.obra?.origem, "capa");
  assert.equal(e.orgao?.origem, "projeto");
});

test("sinal do código do corpo", () => {
  assert.equal(sinalDeCodigoDoCorpo("040-26", "125-23"), "código do corpo (125-23) diverge do nome do arquivo (040-26)");
  assert.equal(sinalDeCodigoDoCorpo("040-26", "040_26"), null);
  assert.equal(sinalDeCodigoDoCorpo("", "125-23"), null);
});
```

- [ ] **Step 2:** `npm run test:escada-da-identidade` → FALHA.
- [ ] **Step 3: implementação** — `lib/escada-da-identidade.ts`:

```ts
/**
 * A ESCADA DE FONTES da identidade do memorial (09/10/2026).
 *
 * Memorial de disciplina chega sem capa — a capa mora no GERAL. Cada campo
 * vem do degrau mais alto que o tiver: capa do próprio memorial > identidade
 * guardada do projeto > corpo (rodapé/"Obra:"), que é só SUGESTÃO. O usuário
 * fica acima de todos, mas a correção dele entra pela ficha
 * ([[ficha-do-memorial.ts]]), não por aqui.
 *
 * O CÓDIGO é outra escada: o nome do arquivo manda (é a chave do projeto), a
 * capa só confere, e o do corpo nunca vale — no 040-26 o rodapé trazia 125-23,
 * herdado de outro projeto.
 *
 * PURO.
 */
import { CAMPOS_DA_IDENTIDADE, type CampoDaIdentidade, type IdentidadeDoProjeto } from "./identidade-do-projeto.ts";

export type OrigemNaFicha = "usuario" | "capa" | "projeto" | "corpo" | "arquivo";
export type ValorComOrigem = { valor: string; origem: OrigemNaFicha; fonte?: string };
export type Escada = Record<CampoDaIdentidade, ValorComOrigem | null>;

const limpo = (v: string | undefined | null) => (v ?? "").trim();

export function escadaDaIdentidade(args: {
  codigoDoArquivo?: string;
  capa?: Partial<Record<CampoDaIdentidade, string>> | null;
  projeto?: IdentidadeDoProjeto | null;
  corpo?: Partial<Record<CampoDaIdentidade, string>>;
}): Escada {
  const escada = {} as Escada;
  for (const campo of CAMPOS_DA_IDENTIDADE) {
    if (campo === "codigo") {
      const doArquivo = limpo(args.codigoDoArquivo);
      const daCapa = limpo(args.capa?.codigo);
      escada.codigo = doArquivo
        ? { valor: doArquivo, origem: "arquivo" }
        : daCapa
          ? { valor: daCapa, origem: "capa" }
          : null;
      continue;
    }
    const daCapa = limpo(args.capa?.[campo]);
    const guardado = args.projeto?.campos[campo];
    const doCorpo = limpo(args.corpo?.[campo]);
    escada[campo] = daCapa
      ? { valor: daCapa, origem: "capa" }
      : guardado
        ? { valor: guardado.valor, origem: "projeto", fonte: guardado.fonte }
        : doCorpo
          ? { valor: doCorpo, origem: "corpo" }
          : null;
  }
  return escada;
}

/** O código que o CORPO cita, quando difere do nome do arquivo: sinal, não fato. */
export function sinalDeCodigoDoCorpo(doArquivo: string, doCorpo: string): string | null {
  const a = doArquivo.trim().replace("_", "-");
  const c = doCorpo.trim().replace("_", "-");
  if (!a || !c || a === c) return null;
  return `código do corpo (${c}) diverge do nome do arquivo (${a})`;
}
```

- [ ] **Step 4:** em `server/nexo/classify-documents.ts`, trocar o bloco das linhas ~131-134 por:

```ts
      /*
       * O nome do arquivo manda no código (é a chave do projeto); a capa só
       * confere, e a divergência tem de aparecer em vez de ser engolida. Sem
       * capa, o código que o CORPO cita também confere (09/10/2026, 040-26: o
       * rodapé trazia 125-23, herdado de outro projeto).
       */
      const divergencia = doc.capa
        ? divergenciaDeCodigo(parsed.codigo, doc.capa.codigo)
        : sinalDeCodigoDoCorpo(parsed.codigo, doc.codigo);
      if (divergencia) content.sinais = [...content.sinais, divergencia];
```

e o import: `import { sinalDeCodigoDoCorpo } from "@/lib/escada-da-identidade";`.

- [ ] **Step 5:** `npm run test:escada-da-identidade && npm run test:leitura-da-capa && npm run test:identidade-do-parecer` → tudo ok.
- [ ] **Step 6:** commit `Escada da identidade: capa > projeto > corpo; código do corpo vira sinal`.

---

### Task 4: coluna `Project.identidade`

**Files:**
- Modify: `prisma/schema.prisma` (model `Project`, depois de `clientKey`)
- Create: `prisma/migrations/20261009120000_identidade_do_projeto/migration.sql`

- [ ] **Step 1:** no `model Project`, depois do bloco de `clientKey`:

```prisma
  /// A IDENTIDADE GUARDADA (09/10/2026): obra, órgão, município… campo a campo,
  /// com a ORIGEM (capa, selo, usuário) e o arquivo que provou. A capa do
  /// memorial geral vence e registra divergência; o corpo do memorial nunca
  /// grava. Também guarda a conferência retroativa das auditorias. Forma e
  /// regra em [[lib/identidade-do-projeto.ts]].
  identidade     Json               @default("{}")
```

- [ ] **Step 2:** `migration.sql`:

```sql
-- A identidade guardada do projeto (09/10/2026). Ver lib/identidade-do-projeto.ts.
ALTER TABLE "Project" ADD COLUMN "identidade" JSONB NOT NULL DEFAULT '{}';
```

- [ ] **Step 3:** `npx prisma migrate dev` (banco `nexodoc_dev`; ele deve reconhecer a migração sem gerar outra) e depois `npm run db:generate`. Esperado: "Already in sync" ou aplicação da migração; sem migração nova gerada.
- [ ] **Step 4:** `npx tsc --noEmit` → sem erros novos.
- [ ] **Step 5:** commit `Project.identidade: coluna JSON da identidade guardada`.

---

### Task 5: rota `GET/PUT /api/projects/[id]/identidade`

**Files:**
- Create: `app/api/projects/[id]/identidade/route.ts`

**Interfaces:**
- Consumes: Task 2 inteira; `decidirCliente` (`lib/cliente-do-projeto.ts`); `createProjectEvent` (`lib/project-store.ts`); `requireActor`/`accessDeniedResponse`.
- Produces (HTTP):
  - `GET` → `200 { identidade: IdentidadeDoProjeto }`
  - `PUT` body `{ origem: "capa" | "usuario"; fonte: string; campos: Partial<Record<CampoDaIdentidade,string>> }` → `200 { identidade, divergencias: Divergencia[], conferidas: Array<ConferenciaDaAuditoria & { auditId: string; quando: string }> }`
  - 400 origem inválida; 404 projeto fora do escritório; 503 sem banco.

- [ ] **Step 1:** ler `node_modules/next/dist/docs/` sobre route handlers com params dinâmicos (o `params` é Promise nesta versão? conferir) e espelhar a assinatura usada em `app/api/projects/[id]/route.ts`.
- [ ] **Step 2: implementação**:

```ts
/**
 * A IDENTIDADE GUARDADA DO PROJETO (09/10/2026).
 *
 * PUT com origem `capa` vem do memorial GERAL: grava, recalcula nome e
 * cliente, e CONFERE as auditorias já feitas contra a obra da capa — regra
 * determinística, sem modelo, sem reauditar. PUT com origem `usuario` vem da
 * ficha corrigida. O corpo do memorial nunca chega aqui. Ver
 * [[lib/identidade-do-projeto.ts]].
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import { decidirCliente } from "@/lib/cliente-do-projeto";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import {
  aplicarGravacao,
  conferirAuditoria,
  lerIdentidadeDoProjeto,
  type CampoDaIdentidade,
} from "@/lib/identidade-do-projeto";
import { createProjectEvent } from "@/lib/project-store";

export const runtime = "nodejs";

type Contexto = { params: Promise<{ id: string }> };

async function projetoDoEscritorio(id: string, organizationId: string) {
  return getPrisma().project.findFirst({
    where: { id, organizationId, deletedAt: null },
    select: { id: true, name: true, code: true, client: true, clientKey: true, identidade: true },
  });
}

export async function GET(_req: Request, { params }: Contexto) {
  try {
    const actor = await requireActor();
    if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    const projeto = await projetoDoEscritorio((await params).id, actor.organizationId);
    if (!projeto) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });
    return NextResponse.json({ identidade: lerIdentidadeDoProjeto(projeto.identidade) });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}

export async function PUT(req: Request, { params }: Contexto) {
  try {
    const actor = await requireActor();
    if (!isDatabaseConfigured()) return NextResponse.json({ error: "DATABASE_URL não configurada." }, { status: 503 });
    const corpo = (await req.json().catch(() => null)) as {
      origem?: unknown;
      fonte?: unknown;
      campos?: Record<string, unknown>;
    } | null;
    const origem = corpo?.origem;
    if (origem !== "capa" && origem !== "usuario") {
      return NextResponse.json({ error: "origem deve ser capa ou usuario." }, { status: 400 });
    }
    const fonte = typeof corpo?.fonte === "string" ? corpo.fonte.trim().slice(0, 300) : "";
    const campos: Partial<Record<CampoDaIdentidade, string>> = {};
    for (const [k, v] of Object.entries(corpo?.campos ?? {})) {
      if (typeof v === "string") campos[k as CampoDaIdentidade] = v.trim().slice(0, 300);
    }

    const prisma = getPrisma();
    const projeto = await projetoDoEscritorio((await params).id, actor.organizationId);
    if (!projeto) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 });

    const em = new Date().toISOString();
    const r = aplicarGravacao(lerIdentidadeDoProjeto(projeto.identidade), {
      origem,
      fonte,
      em,
      ...(origem === "usuario" ? { por: actor.userId } : {}),
      campos,
    });
    let identidade = r.identidade;

    /*
     * A CONFERÊNCIA RETROATIVA — só quando a capa trouxe a obra. Cada auditoria
     * concluída do projeto é comparada pela obra com que rodou (`report.obra`).
     */
    const conferidas: Array<ReturnType<typeof conferirAuditoria> & { auditId: string; quando: string }> = [];
    if (r.obraDaCapa) {
      const auditorias = await prisma.audit.findMany({
        where: { projectId: projeto.id, status: "COMPLETED" },
        select: { id: true, createdAt: true, report: true },
        orderBy: { createdAt: "asc" },
      });
      const conferencias = { ...identidade.conferencias };
      for (const a of auditorias) {
        const obra = (a.report as { obra?: unknown } | null)?.obra;
        if (typeof obra !== "string" || !obra.trim()) continue;
        const c = conferirAuditoria(obra.trim(), r.obraDaCapa, em);
        conferencias[a.id] = c;
        conferidas.push({ ...c, auditId: a.id, quando: a.createdAt.toISOString() });
      }
      identidade = { ...identidade, conferencias };
    }

    /*
     * NOME E CLIENTE derivam da identidade quando a CAPA fala. O nome digitado
     * no cadastro não é sobrescrito por correção de ficha — só pela capa.
     */
    const dados: Prisma.ProjectUpdateInput = { identidade: identidade as unknown as Prisma.InputJsonValue };
    if (origem === "capa" && identidade.campos.obra?.origem === "capa") dados.name = identidade.campos.obra.valor;
    if (origem === "capa" && (campos.orgao || campos.municipio)) {
      const decisao = decidirCliente({
        atual: projeto.client,
        atualKey: projeto.clientKey,
        lido: campos.orgao ?? "",
        municipioLido: campos.municipio ?? "",
      });
      dados.client = decisao.client;
      dados.clientKey = decisao.clientKey;
    }
    await prisma.project.update({ where: { id: projeto.id }, data: dados });

    for (const d of r.divergencias) {
      await createProjectEvent(prisma, {
        projectId: projeto.id,
        actor: { id: actor.userId, email: actor.email, name: actor.name },
        type: "PROJECT_UPDATED",
        title: "Capa do geral difere do que estava declarado",
        summary: `${d.campo}: era "${d.anterior.valor}" (${d.anterior.origem}); a capa diz "${d.nova.valor}".`,
        details: d,
      });
    }

    return NextResponse.json({ identidade, divergencias: r.divergencias, conferidas });
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }
}
```

Conferir se `createProjectEvent` aceita `details` como objeto genérico (ver assinatura em `lib/project-store.ts`); se exigir `Prisma.InputJsonValue`, fazer cast como em `por-centro-de-custo/route.ts`.

- [ ] **Step 3:** `npx tsc --noEmit` → sem erros.
- [ ] **Step 4: prova manual** com o dev server (`npm run dev`, logado): achar o id do projeto 040-26 (`GET /api/projects`), depois no console do navegador:

```js
await (await fetch(`/api/projects/${id}/identidade`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origem: "usuario", fonte: "teste", campos: { obra: "Feira Comercial de Chapecó" } }) })).json()
await (await fetch(`/api/projects/${id}/identidade`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origem: "capa", fonte: "040_26_md_geral_a.pdf p.1", campos: { obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", municipio: "Chapecó" } }) })).json()
```

Esperado: a 2ª resposta traz `divergencias.length === 1`; `GET` devolve `campos.obra.origem === "capa"`. Depois restaurar: `UPDATE "Project" SET identidade='{}' WHERE id=…` no `nexodoc_dev` (dev apenas).
- [ ] **Step 5:** commit `Rota da identidade do projeto: capa grava, confere auditorias e registra divergência`.

---

### Task 6: degrau "projeto" no `/api/nexo/classify`

**Files:**
- Create: `modules/nexo/lib/dossie-com-projeto.ts`
- Modify: `modules/nexo/types.ts` (`NexoDossieDraft`), `app/api/nexo/classify/route.ts:38,91`
- Test: `scripts/test-dossie-com-projeto.ts`; `package.json` (`"test:dossie-com-projeto"`)

**Interfaces:**
- Consumes: `escadaDaIdentidade`, `OrigemNaFicha` (Task 3); `IdentidadeDoProjeto` (Task 2).
- Produces:
  - `NexoDossieDraft.origens?: Partial<Record<"obra"|"orgao"|"secretaria"|"bairro"|"municipio"|"codigo"|"mesAno", { origem: OrigemNaFicha; fonte?: string }>>`
  - `export function aplicarEscadaAoDossie(dossie: NexoDossieDraft, projeto: IdentidadeDoProjeto | null): NexoDossieDraft`

- [ ] **Step 1:** em `modules/nexo/types.ts`, dentro de `NexoDossieDraft` depois de `caracterizacao?`:

```ts
  /**
   * DE ONDE veio cada campo da identidade (09/10/2026): capa, projeto, corpo
   * ou arquivo. A ficha mostra; o corpo vira "confira". Ver
   * [[lib/escada-da-identidade.ts]].
   */
  origens?: Partial<Record<"obra" | "orgao" | "secretaria" | "bairro" | "municipio" | "codigo" | "mesAno", { origem: import("@/lib/escada-da-identidade").OrigemNaFicha; fonte?: string }>>;
```

(Se o projeto não aceitar `import()` em tipo, usar `import type { OrigemNaFicha } from "@/lib/escada-da-identidade";` no topo.)

- [ ] **Step 2: teste que falha** — `scripts/test-dossie-com-projeto.ts`:

```ts
import assert from "node:assert/strict";
import { aplicarEscadaAoDossie } from "../modules/nexo/lib/dossie-com-projeto.ts";
import { lerIdentidadeDoProjeto } from "../lib/identidade-do-projeto.ts";

const EM = "2026-10-09T12:00:00.000Z";
const base = { disciplinas: [], volumes: [], semVolume: [], arquivos: [] };
const projeto = lerIdentidadeDoProjeto({
  campos: { obra: { valor: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", origem: "capa", fonte: "geral p.1", em: EM } },
});

test("sem capa: obra do projeto entra, corpo vira origem corpo onde o projeto cala", () => {
  const d = aplicarEscadaAoDossie({ ...base, obra: "Feira Comercial de Chapecó", codigo: "040-26", secretaria: "" }, projeto);
  assert.equal(d.obra, "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ");
  assert.deepEqual(d.origens?.obra, { origem: "projeto", fonte: "geral p.1" });
  assert.deepEqual(d.origens?.codigo, { origem: "arquivo" });
});

test("sem projeto: valores do corpo ficam, marcados como corpo", () => {
  const d = aplicarEscadaAoDossie({ ...base, obra: "Feira Comercial de Chapecó", codigo: "040-26" }, null);
  assert.equal(d.obra, "Feira Comercial de Chapecó");
  assert.equal(d.origens?.obra?.origem, "corpo");
});

test("com capa: valores do dossiê (já da capa) ficam, origem capa", () => {
  const capa = { orgao: "PREFEITURA MUNICIPAL DE CHAPECÓ", secretaria: "", municipio: "CHAPECÓ", obra: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ", bairro: "", mesAno: "JUNHO/2024", codigo: "040-26" };
  const d = aplicarEscadaAoDossie({ ...base, capa, obra: capa.obra, municipio: "Chapecó", codigo: "040-26" }, null);
  assert.equal(d.municipio, "Chapecó"); // caixa de título do dossiê preservada
  assert.equal(d.origens?.municipio?.origem, "capa");
});
```

- [ ] **Step 3:** `npm run test:dossie-com-projeto` → FALHA.
- [ ] **Step 4: implementação** — `modules/nexo/lib/dossie-com-projeto.ts`:

```ts
/**
 * O DOSSIÊ DO MEMORIAL com o degrau "projeto" da escada (09/10/2026).
 *
 * O classificador já põe a capa antes do corpo em cada campo; o que faltava
 * era o meio: o que o projeto já sabe (a capa do geral, gravada antes).
 * Quando a capa do próprio memorial falou, o valor do dossiê fica como está
 * (o município vem em caixa de título dele); senão o projeto vence o corpo.
 *
 * Módulo puro (imports relativos): os testes rodam em node cru.
 */
import { escadaDaIdentidade } from "../../../lib/escada-da-identidade.ts";
import { CAMPOS_DA_IDENTIDADE, type IdentidadeDoProjeto } from "../../../lib/identidade-do-projeto.ts";
import type { NexoDossieDraft } from "../types";

export function aplicarEscadaAoDossie(dossie: NexoDossieDraft, projeto: IdentidadeDoProjeto | null): NexoDossieDraft {
  const capa = dossie.capa
    ? Object.fromEntries(CAMPOS_DA_IDENTIDADE.map((c) => [c, dossie.capa?.[c] ? (dossie[c] || dossie.capa[c]) : ""]))
    : null;
  const corpo = Object.fromEntries(CAMPOS_DA_IDENTIDADE.map((c) => [c, dossie.capa?.[c] ? "" : (dossie[c] ?? "")]));
  const escada = escadaDaIdentidade({ codigoDoArquivo: dossie.codigo, capa, projeto, corpo });

  const proximo: NexoDossieDraft = { ...dossie, origens: {} };
  for (const campo of CAMPOS_DA_IDENTIDADE) {
    const degrau = escada[campo];
    if (!degrau) continue;
    proximo[campo] = degrau.valor;
    proximo.origens![campo] = { origem: degrau.origem, ...(degrau.fonte ? { fonte: degrau.fonte } : {}) };
  }
  return proximo;
}
```

Atenção: `dossie.codigo` no fluxo do Nexo já é "nome do arquivo primeiro" (`toClassification`), por isso vira origem `arquivo`.

- [ ] **Step 5:** `npm run test:dossie-com-projeto` → ok.
- [ ] **Step 6:** em `app/api/nexo/classify/route.ts`: guardar o ator (`const actor = await requireActor();` no lugar de `await requireActor();`) e trocar `const dossie = await classifyDocuments(inputs);` por:

```ts
    const lido = await classifyDocuments(inputs);
    /*
     * O DEGRAU "PROJETO" (09/10/2026): memorial de disciplina sem capa herda o
     * que o projeto já sabe pelo código do nome do arquivo. Falhar aqui não
     * derruba a leitura: o dossiê segue só com capa e corpo.
     */
    let projeto: IdentidadeDoProjeto | null = null;
    const temMemorial = lido.arquivos.some((a) => a.tipo === "memorial");
    const code = normalizarCentroDeCusto(lido.codigo ?? "");
    if (temMemorial && code && isDatabaseConfigured()) {
      try {
        const p = await getPrisma().project.findUnique({
          where: { organizationId_code: { organizationId: actor.organizationId, code } },
          select: { identidade: true, deletedAt: true },
        });
        if (p && !p.deletedAt) projeto = lerIdentidadeDoProjeto(p.identidade);
      } catch (err) {
        console.error("[nexo-classify] identidade do projeto indisponível", err);
      }
    }
    const dossie = temMemorial ? aplicarEscadaAoDossie(lido, projeto) : lido;
```

Imports: `getPrisma, isDatabaseConfigured` de `@/lib/db`; `normalizarCentroDeCusto` de `@/lib/resolucao-de-projeto`; `lerIdentidadeDoProjeto, type IdentidadeDoProjeto` de `@/lib/identidade-do-projeto`; `aplicarEscadaAoDossie` de `@/modules/nexo/lib/dossie-com-projeto`. Conferir que `requireActor()` devolve `organizationId` (como em `por-centro-de-custo/route.ts`).

- [ ] **Step 7:** `npx tsc --noEmit` e `npm run test:dossie-com-projeto` → ok.
- [ ] **Step 8:** commit `Classify: memorial sem capa herda a identidade do projeto (degrau projeto da escada)`.

---

### Task 7: a ficha mostra a procedência

**Files:**
- Modify: `modules/nexo/lib/ficha-do-memorial.ts`, `modules/nexo/components/FichaDoMemorial.tsx`, CSS da ficha (achar `.nx-ficha-corrigido` com `grep -rn "nx-ficha-corrigido" app styles`)
- Test: o teste existente da ficha (`grep -rln "ficha-do-memorial" scripts`), acrescentando casos

**Interfaces:**
- Consumes: `NexoDossieDraft.origens` (Task 6), `OrigemNaFicha` (Task 3).
- Produces: `LinhaDoMemorial.origem?: OrigemNaFicha; fonte?: string`; `FichaDoMemorial.semCapa?: true`; `corrigirFicha` passa a pôr `origem: "usuario"`.

- [ ] **Step 1: testes que falham** (no arquivo de teste existente da ficha; se não houver, criar `scripts/test-ficha-do-memorial.ts` + script `test:ficha-do-memorial`):

```ts
test("ficha carrega a origem e marca memorial sem capa", () => {
  const f = fichaDoMemorial(
    { disciplinas: [], volumes: [], semVolume: [], arquivos: [], obra: "REVITALIZAÇÃO", origens: { obra: { origem: "projeto", fonte: "geral p.1" } } },
    "040_26_est_md_a.pdf",
  );
  assert.equal(f.semCapa, true);
  assert.deepEqual(f.linhas[0], { campo: "obra", valor: "REVITALIZAÇÃO", origem: "projeto", fonte: "geral p.1" });
});
test("correção vira origem usuario", () => {
  const f = fichaDoMemorial({ disciplinas: [], volumes: [], semVolume: [], arquivos: [] }, "a.pdf");
  const c = corrigirFicha(f, "municipio", "Chapecó");
  assert.equal(c.linhas.find((l) => l.campo === "municipio")?.origem, "usuario");
});
```

- [ ] **Step 2:** rodar → FALHA.
- [ ] **Step 3: implementação** em `ficha-do-memorial.ts`:

```ts
import type { OrigemNaFicha } from "../../../lib/escada-da-identidade.ts";
// LinhaDoMemorial ganha:
  /** De onde veio o valor (09/10/2026). Ausente em fichas gravadas antes. */
  origem?: OrigemNaFicha;
  fonte?: string;
// FichaDoMemorial ganha:
  /** O memorial não tinha capa: a linha vazia convida a preencher. */
  semCapa?: true;
```

`fichaDoMemorial`:

```ts
  return {
    arquivo,
    linhas: CAMPOS_DO_MEMORIAL.map((campo) => {
      const o = dossie?.origens?.[campo];
      return { campo, valor: valorNoDossie(dossie, campo), ...(o ? { origem: o.origem, ...(o.fonte ? { fonte: o.fonte } : {}) } : {}) };
    }),
    ...(dossie && !dossie.capa ? { semCapa: true as const } : {}),
    ...(divergencia ? { divergencia } : {}),
  };
```

`corrigirFicha`: `{ campo, valor: limpo, corrigido: true, origem: "usuario" as const }`.

Em `FichaDoMemorial.tsx`, na `Linha` (receber `semCapa` como prop vinda do card):

```tsx
const PROCEDENCIA: Partial<Record<NonNullable<LinhaDoMemorial["origem"]>, string>> = {
  projeto: "do projeto",
  corpo: "do texto — confira",
};
// …no ramo não-editando, no lugar do vazio e do selo "corrigido":
{linha.valor ? <span className="nx-ficha-valor">{linha.valor}</span> : (
  <span className="nx-ficha-vazio">{semCapa ? "a capa vem no geral — preencha se souber" : "não veio na capa"}</span>
)}
{linha.corrigido && <span className="nx-ficha-corrigido">{linha.origem === "usuario" ? "você preencheu" : "corrigido"}</span>}
{!linha.corrigido && linha.origem && PROCEDENCIA[linha.origem] && (
  <span className="nx-ficha-procedencia" title={linha.fonte}>{PROCEDENCIA[linha.origem]}</span>
)}
{(linha.campo === "obra" || linha.origem === "corpo") && !linha.corrigido && <span className="ds-pill ds-pill--decide nx-ficha-confira">confira</span>}
```

CSS `.nx-ficha-procedencia`: copiar a regra de `.nx-ficha-corrigido` trocando a cor para `var(--muted-foreground)` (acento teal só no interativo — regra do acento único). Dentro de `@layer` se a regra irmã estiver em layer.

- [ ] **Step 4:** rodar o teste da ficha → ok; `npx tsc --noEmit` → ok.
- [ ] **Step 5:** commit `Ficha do memorial: procedência por linha e convite a preencher quando não há capa`.

---

### Task 8: o cliente grava a capa e a correção, e fala a divergência

**Files:**
- Create: `modules/nexo/lib/identidade-no-projeto.ts`
- Modify: `modules/nexo/components/NexoWorkspace.tsx` (`appendMemorialIntake` ~1056-1160; `corrigirCampoDoMemorial` ~2888)
- Test: `scripts/test-identidade-no-projeto.ts`; `package.json` (`"test:identidade-no-projeto"`)

**Interfaces:**
- Consumes: rota da Task 5; `NexoDossieDraft.origens` (Task 6).
- Produces:

```ts
export type ConferidaDoServidor = { auditId: string; quando: string; estado: "confere" | "diverge"; obraDaAuditoria: string; obraDaCapa: string };
export type RespostaDaIdentidade = { identidade: unknown; divergencias: Array<{ campo: string; anterior: { valor: string }; nova: { valor: string } }>; conferidas: ConferidaDoServidor[] };
export function camposDaCapaNoDossie(dossie: NexoDossieDraft): Record<string, string>;
export function fraseDaConferencia(r: RespostaDaIdentidade, formatarData: (iso: string) => string): string | null;
export async function gravarIdentidadeNoProjeto(projectId: string, corpo: { origem: "capa" | "usuario"; fonte: string; campos: Record<string, string> }): Promise<RespostaDaIdentidade | null>;
```

- [ ] **Step 1: teste que falha** — `scripts/test-identidade-no-projeto.ts`:

```ts
import assert from "node:assert/strict";
import { camposDaCapaNoDossie, fraseDaConferencia } from "../modules/nexo/lib/identidade-no-projeto.ts";

const data = (iso: string) => iso.slice(8, 10) + "/" + iso.slice(5, 7);

test("só os campos de origem capa sobem", () => {
  const campos = camposDaCapaNoDossie({
    disciplinas: [], volumes: [], semVolume: [], arquivos: [],
    obra: "REVITALIZAÇÃO", municipio: "Chapecó", secretaria: "Sec. X",
    origens: { obra: { origem: "capa" }, municipio: { origem: "capa" }, secretaria: { origem: "corpo" } },
  });
  assert.deepEqual(campos, { obra: "REVITALIZAÇÃO", municipio: "Chapecó" });
});

test("frase cita a auditoria que diverge", () => {
  const f = fraseDaConferencia(
    { identidade: {}, divergencias: [], conferidas: [
      { auditId: "a1", quando: "2026-10-03T10:00:00.000Z", estado: "diverge", obraDaAuditoria: "Feira Comercial de Chapecó", obraDaCapa: "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ" },
      { auditId: "a2", quando: "2026-10-04T10:00:00.000Z", estado: "confere", obraDaAuditoria: "x", obraDaCapa: "x" },
    ] },
    data,
  );
  assert.equal(
    f,
    "A capa do geral diz “REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ”. A auditoria de 03/10 foi feita com “Feira Comercial de Chapecó” — vale conferir se o texto é desta obra. 1 outra confere.",
  );
});

test("sem divergência e sem conferidas, nada a dizer", () => {
  assert.equal(fraseDaConferencia({ identidade: {}, divergencias: [], conferidas: [] }, data), null);
});
```

- [ ] **Step 2:** rodar → FALHA.
- [ ] **Step 3: implementação** — `modules/nexo/lib/identidade-no-projeto.ts`:

```ts
/**
 * A IDENTIDADE NO PROJETO, do lado do navegador (09/10/2026): grava a capa do
 * geral e as correções da ficha em `/api/projects/[id]/identidade`, e diz em
 * uma frase o que a conferência retroativa achou.
 *
 * Puro exceto `gravarIdentidadeNoProjeto` (fetch). Testes em node cru.
 */
import type { NexoDossieDraft } from "../types";

export type ConferidaDoServidor = { auditId: string; quando: string; estado: "confere" | "diverge"; obraDaAuditoria: string; obraDaCapa: string };
export type RespostaDaIdentidade = {
  identidade: unknown;
  divergencias: Array<{ campo: string; anterior: { valor: string }; nova: { valor: string } }>;
  conferidas: ConferidaDoServidor[];
};

const CAMPOS = ["obra", "orgao", "secretaria", "bairro", "municipio", "codigo", "mesAno"] as const;

/** Só o que a CAPA disse: o corpo nunca grava no projeto. */
export function camposDaCapaNoDossie(dossie: NexoDossieDraft): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const c of CAMPOS) {
    const v = dossie[c]?.trim();
    if (v && dossie.origens?.[c]?.origem === "capa") campos[c] = v;
  }
  return campos;
}

export function fraseDaConferencia(r: RespostaDaIdentidade, formatarData: (iso: string) => string): string | null {
  const divergem = r.conferidas.filter((c) => c.estado === "diverge");
  if (divergem.length === 0) return null;
  const capa = divergem[0].obraDaCapa;
  const citadas = divergem
    .map((c) => `a auditoria de ${formatarData(c.quando)} foi feita com “${c.obraDaAuditoria}”`)
    .join("; ");
  const conferem = r.conferidas.length - divergem.length;
  return (
    `A capa do geral diz “${capa}”. ${citadas.charAt(0).toUpperCase()}${citadas.slice(1)} — vale conferir se o texto é desta obra.` +
    (conferem > 0 ? ` ${conferem} ${conferem === 1 ? "outra confere" : "outras conferem"}.` : "")
  );
}

export async function gravarIdentidadeNoProjeto(
  projectId: string,
  corpo: { origem: "capa" | "usuario"; fonte: string; campos: Record<string, string> },
): Promise<RespostaDaIdentidade | null> {
  if (Object.keys(corpo.campos).length === 0) return null;
  const r = await fetch(`/api/projects/${encodeURIComponent(projectId)}/identidade`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  });
  return r.ok ? ((await r.json()) as RespostaDaIdentidade) : null;
}
```

- [ ] **Step 4:** `npm run test:identidade-no-projeto` → ok.
- [ ] **Step 5:** em `NexoWorkspace.tsx`, `appendMemorialIntake`:
  - a busca da divergência (`?.sinais.find((s) => s.startsWith("código da capa"))`) passa a `s.startsWith("código da capa") || s.startsWith("código do corpo")`;
  - dentro do IIFE do vínculo, logo depois de `if (v.tipo === "vinculado") conv.vincularProjeto(v.projeto.id);`:

```ts
        /*
         * A CAPA DO GERAL VIRA A VERDADE DO PROJETO (09/10/2026). Só o que a
         * capa disse sobe; a resposta traz a conferência das auditorias já
         * feitas, e a divergência é dita aqui, onde o geral acabou de chegar.
         */
        if (v.tipo === "vinculado" && dossie?.capa) {
          const r = await gravarIdentidadeNoProjeto(v.projeto.id, {
            origem: "capa",
            fonte: `${memorial.name} p.1`,
            campos: camposDaCapaNoDossie(dossie),
          });
          const frase = r && fraseDaConferencia(r, (iso) => formatarEmBrasilia(iso, { day: "2-digit", month: "2-digit" }));
          if (frase) conv.appendMessage({ id: crypto.randomUUID(), role: "assistant", content: frase });
        }
```

  (`formatarEmBrasilia` já é usado no projeto — importar do mesmo lugar que `ConfirmationCard.tsx` importa.)
  - em `corrigirCampoDoMemorial`, depois de `if (patch) conv.corrigirIdentidade(patch);`:

```ts
    if (conv.projectId) {
      void gravarIdentidadeNoProjeto(conv.projectId, {
        origem: "usuario",
        fonte: `ficha de ${mensagem.fichaDoMemorial.arquivo}`,
        campos: { [campo]: valor.trim() },
      }).catch(() => {});
    }
```

- [ ] **Step 6:** `npx tsc --noEmit` → ok.
- [ ] **Step 7:** commit `Nexo: capa do geral grava no projeto e a conferência retroativa vira fala; correção da ficha também grava`.

---

### Task 9: procedência no cartão e selo na âncora do parecer

**Files:**
- Modify: `modules/nexo/components/ConfirmationCard.tsx` (texto de procedência ~2820; `AuditoriaAncora` ~3153 e seu uso ~2760)

**Interfaces:**
- Consumes: `memorialFatos.origens` (o dossiê; conferir que `memorialFatos` é o dossiê salvo — se for outro tipo, ler `origens` de onde `memorialFatos` é montado); `GET /api/projects/[id]/identidade` (Task 5); `ConferenciaDaAuditoria` (Task 2); `result.auditId`.

- [ ] **Step 1:** texto de procedência da obra — trocar o ternário `fatos.gabarito.origem === "selos" ? … : …` por:

```tsx
{fatos.gabarito.origem === "selos"
  ? "Obra lida do carimbo das pranchas — fonte independente do memorial."
  : memorialFatos?.origens?.obra?.origem === "projeto"
    ? "Obra do projeto (capa do memorial geral) — fonte independente deste memorial."
    : memorialFatos?.origens?.obra?.origem === "usuario"
      ? "Obra preenchida por você."
      : "Obra lida do próprio memorial — sem prancha para confrontar."}
```

- [ ] **Step 2:** selo na âncora. Acrescentar a `AuditoriaAncora` a prop `conferencia?: { estado: "confere" | "diverge"; obraDaCapa: string }` e, logo depois de `<AvisoDeAuditoriaIncompleta … />`:

```tsx
{conferencia && (
  <p className="cx-texto text-xs text-muted-foreground" data-conferencia={conferencia.estado}>
    {conferencia.estado === "confere"
      ? "Identidade conferida contra a capa do geral."
      : `Feita com outra obra: a capa do geral diz “${conferencia.obraDaCapa}”.`}
  </p>
)}
```

No uso (`if (result) { return (<> <AuditoriaAncora …`), buscar a conferência uma vez por montagem:

```tsx
const [conferencia, setConferencia] = useState<{ estado: "confere" | "diverge"; obraDaCapa: string } | null>(null);
useEffect(() => {
  const auditId = result?.auditId;
  if (!auditId || !projectId) return;
  let vivo = true;
  fetch(`/api/projects/${encodeURIComponent(projectId)}/identidade`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { if (vivo) setConferencia(j?.identidade?.conferencias?.[auditId] ?? null); })
    .catch(() => {});
  return () => { vivo = false; };
}, [result?.auditId, projectId]);
```

(`projectId` de `useConversation()`; hooks ANTES de qualquer `return` condicional do componente.) Passar `conferencia={conferencia ?? undefined}`.

- [ ] **Step 3:** `npx tsc --noEmit && npm run lint` → 0 erros (o lint está no portão do CI).
- [ ] **Step 4:** commit `Auditoria: procedência da obra no cartão e selo de conferência na âncora do parecer`.

---

### Task 10: prova com os PDFs reais do 040-26

**Files:**
- Create: `scripts/medir-memorial-sem-capa.mjs`; `package.json` (`"medir:memorial-sem-capa": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/medir-memorial-sem-capa.mjs"`)

- [ ] **Step 1:** script (sem banco, sem IA):

```js
// O 040-26 de ponta a ponta, sem banco e sem IA: a disciplina sem capa antes e
// depois do geral. Ver docs/superpowers/specs/2026-10-09-memorial-sem-capa-design.md.
import { existsSync, readFileSync } from "node:fs";

const DISCIPLINA = "docs/samples/040-26/estrutural_concreto/040_26_est_md_a.pdf";
const GERAL = "docs/samples/040-26/1_memorial/040_26_md_geral_a.pdf";
for (const f of [DISCIPLINA, GERAL]) if (!existsSync(f)) { console.warn(`pulando: falta ${f}`); process.exit(0); }

const { classifyDocuments } = await import("../server/nexo/classify-documents.ts");
const { aplicarEscadaAoDossie } = await import("../modules/nexo/lib/dossie-com-projeto.ts");
const { aplicarGravacao, conferirAuditoria, lerIdentidadeDoProjeto } = await import("../lib/identidade-do-projeto.ts");
const { camposDaCapaNoDossie } = await import("../modules/nexo/lib/identidade-no-projeto.ts");

const ler = async (f) => aplicarEscadaAoDossie(
  await classifyDocuments([{ fileName: f.split("/").pop(), buffer: readFileSync(f) }]), null);
const EM = new Date().toISOString();

const antes = await ler(DISCIPLINA);
console.log("1. disciplina sozinha:", antes.obra, antes.origens?.obra, antes.codigo, antes.arquivos[0].sinais);
if (antes.codigo !== "040-26") throw new Error("o código tinha de vir do nome do arquivo");
if (!antes.arquivos[0].sinais.some((s) => s.startsWith("código do corpo (125-23)"))) throw new Error("faltou o sinal do 125-23");

const geral = await ler(GERAL);
const projeto = aplicarGravacao(lerIdentidadeDoProjeto(null), { origem: "capa", fonte: "040_26_md_geral_a.pdf p.1", em: EM, campos: camposDaCapaNoDossie(geral) });
console.log("2. projeto depois do geral:", projeto.identidade.campos.obra);

const c = conferirAuditoria(antes.obra, projeto.obraDaCapa, EM);
console.log("3. auditoria da disciplina conferida:", c.estado);
if (c.estado !== "diverge") throw new Error("o 040-26 tinha de divergir");

const lidoDeNovo = await classifyDocuments([{ fileName: "040_26_est_md_a.pdf", buffer: readFileSync(DISCIPLINA) }]);
const depois = aplicarEscadaAoDossie(lidoDeNovo, projeto.identidade);
console.log("4. disciplina com o projeto conhecido:", depois.obra, depois.origens?.obra);
if (depois.origens?.obra?.origem !== "projeto") throw new Error("a obra tinha de vir do projeto");
console.log("ok");
```

- [ ] **Step 2:** `npm run medir:memorial-sem-capa` → termina com `ok`. Se a etapa 1 mostrar `codigo` ≠ `040-26`, investigar `parseFilename` com `est_md` antes de seguir.
- [ ] **Step 3:** rodar a regressão: `npm run test:leitura-da-capa && npm run test:capa-dos-modelos && npm run test:identidade-do-parecer && npm run medir:identidade -- --comparar "$SCRATCH/identidade-antes.json"` (a linha de base da Task 1, Step 0). Nenhum campo dos 15 memoriais pode mudar: o `medir:identidade` lê `classifyDocument` direto, que este plano não altera.
- [x] **Step 4: prova no navegador** (13/10: `scripts/prova-memorial-sem-capa.mjs`, 15 asserções, sem token) (build de produção — `npm run build && npm run start`, por causa do manifesto que recarrega o dev): conversa nova → anexar `040_26_est_md_a.pdf` → a ficha mostra "a capa vem no geral — preencha se souber" nas linhas vazias, "do texto — confira" na obra e o aviso do código 125-23; corrigir o município → "você preencheu". Conversa nova → anexar `040_26_md_geral_a.pdf` → aparece a fala de divergência se houver auditoria da disciplina; abrir a conversa da disciplina → selo "Feita com outra obra". Anexar a disciplina de novo numa terceira conversa → obra "do projeto".
- [ ] **Step 5:** commit `Prova do memorial sem capa com os PDFs do 040-26`.
