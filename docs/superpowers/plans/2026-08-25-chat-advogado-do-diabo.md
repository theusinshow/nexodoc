# Chat advogado do diabo — plano de implementação

> **Para quem executa:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development
> (recomendado) ou superpowers:executing-plans para implementar tarefa a tarefa.
> Os passos usam caixa (`- [ ]`) para marcação.

**Objetivo:** dar ao chat pós-auditoria a capacidade de RELER o memorial por
ferramentas determinísticas, responder qualquer pergunta sobre ele com página
verificável, e registrar no parecer o erro que o motor deixou passar.

**Arquitetura:** o texto extraído passa a ser gravado com a auditoria
(`AuditText`); a rota `/api/audit/chat` é reescrita como laço de tool-calling
(`server/audit/chat/`), espelhando a separação que `server/nexo/agent/` já usa;
as ferramentas são funções puras sobre estruturas, testáveis em Node cru; o
achado nascido no chat entra no parecer com `origem: "chat"` e só depois de a
evidência ancorar no texto guardado.

**Pilha:** Next 16 (App Router, runtime nodejs), Prisma 7, OpenAI SDK 6
(Responses API com `tools`), TypeScript. Testes são scripts `node scripts/*.ts`
com `node:assert/strict` — **não há jest nem vitest neste repositório**.

## Restrições globais

Valem para TODA tarefa. Copiadas da spec e do código apurado em 24-25/08/2026.

- **Fato determinístico primeiro, IA por último.** Página e trecho saem sempre
  da ferramenta, nunca da cabeça do modelo.
- **Comentário e nome em pt-BR**, no tom do repositório: explique POR QUE, não
  o que a linha faz. Módulos novos em `lib/` seguem o padrão recente
  (`impressao-do-achado.ts`, `diff-de-pareceres.ts`).
- **Nenhum `git add -A`.** Sempre caminho por caminho, e
  `git diff --cached --stat` antes de commitar.
- **Commit direto na `main`.** Sem branch e sem PR.
- **Teste novo entra no `package.json`** como `"test:<nome>": "node scripts/test-<nome>.ts"`.
- `executeOpenAiResponse` devolve `{ response, text, durationMs, model }`, e
  `text` é `""` quando a resposta só traz `function_call` — isso **não** é erro.
  Ela só lança em `status: "incomplete"` e em recusa.
- **Toda volta do laço passa por `executeOpenAiResponse`**, que já cobra,
  telemetra e respeita o teto mensal. Nada de chamar o cliente OpenAI direto.
- `AuditFinding.origem` passa a aceitar `"chat"`. Os seis consumidores testam
  `=== "regra"` / `!== "regra"` — **nenhum deles muda**.
- O chat **nunca** escreve `AuditFeedback.verdict`.

---

## Estrutura de arquivos

**Criar:**

| Arquivo | Responsabilidade |
|---|---|
| `lib/ancoragem-de-evidencia.ts` | Índice tolerante do documento e casamento de trecho→página. Extraído de `scripts/prova-evidencia-ancorada.ts`, que passa a importá-lo. |
| `lib/memoria-do-documento.ts` | Grava e lê o `AuditText`. Único lugar que conhece Prisma nesta feature. |
| `server/audit/chat/ferramentas.ts` | Definições (JSON Schema) e implementações das ferramentas. Puro. |
| `server/audit/chat/prompt.ts` | As instruções do advogado do diabo. Puro. |
| `server/audit/chat/run-chat-turn.ts` | O laço de tool-calling. Recebe o executor por injeção. |
| `scripts/test-ancoragem.ts` | Teste da ancoragem. |
| `scripts/test-chat-ferramentas.ts` | Teste das ferramentas. |
| `scripts/test-chat-laco.ts` | Teste do laço (teto, despacho, modo degradado). |
| `scripts/prova-chat-advogado.mjs` | Prova no navegador, caixa contra janela. |

**Modificar:**

| Arquivo | O quê |
|---|---|
| `prisma/schema.prisma:299-325` | `Audit` ganha `texts AuditText[]`; modelo `AuditText` novo. |
| `prisma/migrations/…` | Migração nova. |
| `lib/audit-persistence.ts:96-175` | `persistCompletedAudit` grava o `AuditText` na transação que já existe. |
| `lib/audit-report.ts:83` | `origem?: "regra" \| "ia" \| "chat"`. |
| `scripts/prova-evidencia-ancorada.ts:31-137` | Passa a importar de `lib/ancoragem-de-evidencia.ts`. |
| `app/api/audit/chat/route.ts` | Reescrita: rota fina, SSE, laço no `server/audit/chat/`. |
| `modules/nexo/components/NexoCopilot.tsx:215` | Desce `auditId` para o `NexoChat`. |
| `modules/nexo/components/NexoChat.tsx:65-320` | Prop `auditId`; roteia o turno; funde o achado novo. |
| `package.json` | Três entradas de teste e uma de prova. |

---

## Tarefa 1: a ancoragem sai do script e vira biblioteca

O casamento "este trecho existe nesta página?" já está escrito e já foi provado
contra memorial real — mas mora num script com `process.argv` e `await` de
topo, inalcançável para a rota. A ferramenta `buscar_no_memorial` e a trava de
`registrar_achado` são o MESMO problema, e ter duas noções de "o trecho ancora"
no repositório é garantir que um dia elas discordem sobre a mesma folha.

**Arquivos:**
- Criar: `lib/ancoragem-de-evidencia.ts`
- Criar: `scripts/test-ancoragem.ts`
- Modificar: `scripts/prova-evidencia-ancorada.ts` (linhas 29-137 saem)
- Modificar: `package.json` (entrada `test:ancoragem`)

**Interfaces:**
- Consome: `ExtractedPdfPage` de `lib/pdf-text.ts` (`{ page: number; text: string }`).
- Produz, e as tarefas 3, 4 e 6 dependem destes nomes exatos:

```ts
export type PaginaDeTexto = { page: number; text: string };
export type IndiceDeAncoragem = {
  porPagina: Map<number, string>;
  documentoInteiro: string;
  nInicio: number;
  nFim: number;
};
export type Veredito = "ancorada" | "outra_pagina" | "nao_encontrada" | "sem_transcricao";

export function esqueleto(texto: unknown): string;
export function trechosCitados(evidencia: unknown): string[];
export function paginasDe(raw: unknown): number[];
export function indexarParaAncoragem(paginas: readonly PaginaDeTexto[]): IndiceDeAncoragem;
export function ancorarTrecho(
  indice: IndiceDeAncoragem,
  trecho: string,
  paginasDeclaradas: readonly number[],
): Veredito;
export function ancorarEvidencia(
  indice: IndiceDeAncoragem,
  evidencia: string,
  pagina: unknown,
): { veredito: Veredito; trecho: string };
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-ancoragem.ts`:

```ts
/**
 * A ANCORAGEM RECONHECE A TRANSCRIÇÃO CORRETA — E RECUSA A INVENTADA.
 *
 * Os casos vêm do 117_25: carimbo de rodapé no meio da frase, elisão com
 * `[...]`, e frase que atravessa a virada de página.
 *
 *   node scripts/test-ancoragem.ts  (== npm run test:ancoragem)
 */
import assert from "node:assert/strict";

import {
  ancorarEvidencia,
  ancorarTrecho,
  esqueleto,
  indexarParaAncoragem,
  paginasDe,
  trechosCitados,
} from "../lib/ancoragem-de-evidencia.ts";

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

/** Rodapé igual ao do memorial real, com o número variando por página. */
const rodape = (n: number) => `PREFEITURA MUNICIPAL DE PALHOCA Cap.7 - Pag.${n} Direitos Autorais Reservados`;
const pagina = (n: number, corpo: string) => ({ page: n, text: `${rodape(n)} ${corpo} ${rodape(n)}` });

const paginas = [
  pagina(60, "As alvenarias serao executadas em blocos ceramicos de vedacao."),
  pagina(61, "Para melhor amarracao com a alvenaria"),
  pagina(62, "existente, evitando fissuras na interface entre os materiais."),
  pagina(63, "As portas de vidro temperado deverao receber sinalizacao visual."),
  pagina(64, "Ramal de ligacao aereo: Aluminio multiplexado de # 35m2."),
];
const indice = indexarParaAncoragem(paginas);

test("esqueleto ignora acento, caixa e refluxo de espaco", () => {
  assert.equal(esqueleto("UBS  Paraíso – Porte 1"), esqueleto("ubs paraiso - porte 1"));
});

test("o carimbo repetido em toda pagina e detectado e removido", () => {
  assert.ok(indice.nInicio > 0, "prefixo comum nao detectado");
  assert.ok(indice.nFim > 0, "sufixo comum nao detectado");
});

test("frase que atravessa a virada de pagina ancora na faixa declarada", () => {
  // Só ancora porque o carimbo saiu do meio: com ele, "alvenariaexistente"
  // nunca aparece contíguo.
  const v = ancorarTrecho(indice, "melhor amarracao com a alvenaria existente", [61, 62]);
  assert.equal(v, "ancorada");
});

test("elisao com [...] e procurada em pedacos", () => {
  const v = ancorarTrecho(indice, "As portas de vidro [...] deverao receber sinalizacao", [63]);
  assert.equal(v, "ancorada");
});

test("trecho que existe em OUTRA pagina nao passa por ancorado", () => {
  const v = ancorarTrecho(indice, "blocos ceramicos de vedacao", [63]);
  assert.equal(v, "outra_pagina");
});

test("trecho que nao existe no documento e recusado", () => {
  const v = ancorarTrecho(indice, "impermeabilizacao com manta asfaltica de 4mm", [60]);
  assert.equal(v, "nao_encontrada");
});

test("evidencia sem transcricao nenhuma e reportada como tal", () => {
  const r = ancorarEvidencia(indice, "p. 60:", 60);
  assert.equal(r.veredito, "sem_transcricao");
});

test("evidencia com aspas usa o que esta entre elas", () => {
  const r = ancorarEvidencia(indice, 'Pagina 64: "Aluminio multiplexado de # 35m2"', "64");
  assert.equal(r.veredito, "ancorada");
  assert.ok(r.trecho.includes("multiplexado"));
});

test("trechosCitados prefere as aspas e cai no resto sem elas", () => {
  assert.deepEqual(trechosCitados('x "uma transcricao longa aqui" y'), ["uma transcricao longa aqui"]);
  assert.deepEqual(trechosCitados("Pagina 57: uma transcricao sem aspas"), ["uma transcricao sem aspas"]);
});

test("paginasDe expande faixa e nao perde numero solto", () => {
  assert.deepEqual(paginasDe("159-161"), [159, 160, 161]);
  assert.deepEqual(paginasDe("17 e 21").sort((a, b) => a - b), [17, 21]);
});

console.log(`\n${passed} teste(s) de ancoragem OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-ancoragem.ts
```
Esperado: `Cannot find module` / `ERR_MODULE_NOT_FOUND` apontando
`lib/ancoragem-de-evidencia.ts`.

- [ ] **Passo 3: escreva `lib/ancoragem-de-evidencia.ts`**

O corpo vem de `scripts/prova-evidencia-ancorada.ts` (linhas 29-137 e 140-181),
sem alterar a lógica: ela já foi provada contra memorial real e mudá-la aqui
trocaria uma medição conhecida por uma suposição.

```ts
/**
 * O TRECHO CITADO EXISTE MESMO NA PÁGINA DECLARADA?
 *
 * Esta era a alma de `scripts/prova-evidencia-ancorada.ts`, e saiu de lá porque
 * ganhou um segundo consumidor: o chat advogado do diabo confere a evidência do
 * achado que ele mesmo propõe ANTES de gravá-lo (`registrar_achado`), e é a
 * mesma pergunta. Duas implementações da mesma pergunta acabam discordando
 * sobre a mesma folha — e a que discordasse acusaria de invenção quem citou
 * certo, que é o erro mais caro que este sistema pode cometer.
 *
 * O casamento é TOLERANTE de propósito: o pdf.js reflui espaço, hifeniza e
 * perde acento. Cobrar igualdade literal reprovaria transcrição boa.
 */

export type PaginaDeTexto = { page: number; text: string };

export type IndiceDeAncoragem = {
  /** Página → corpo esqueletizado, já sem o carimbo das bordas. */
  porPagina: Map<number, string>;
  /** Os corpos concatenados: onde se procura quando a página declarada falha. */
  documentoInteiro: string;
  nInicio: number;
  nFim: number;
};

export type Veredito = "ancorada" | "outra_pagina" | "nao_encontrada" | "sem_transcricao";

/** Só letras e dígitos, minúsculo, sem acento: imune a refluxo de espaço. */
export function esqueleto(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Os trechos citados dentro de uma evidência.
 *
 * O campo costuma vir como `Página 57: "ABNT NBR 9574:2008 - Execução"`. O que
 * se procura no documento é o que está entre aspas — o resto é moldura escrita
 * pelo auditor.
 */
export function trechosCitados(evidencia: unknown): string[] {
  const bruto = String(evidencia ?? "");
  const aspas = [...bruto.matchAll(/[“"'‘]([^”"'’]{12,})[”"'’]/g)].map((m) => m[1]);
  if (aspas.length > 0) return aspas;
  const semRotulo = bruto.replace(/^\s*(?:p[áa]g(?:ina)?\.?|p\.)\s*[\d,\s e-]+:?\s*/i, "");
  return semRotulo.trim().length >= 12 ? [semRotulo.trim()] : [];
}

/**
 * As páginas que o achado declara.
 *
 * Sem teto na largura da faixa: um achado de capítulo inteiro escreve
 * "159-202", e recusar a faixa por ser larga deixava só 159 e 202 — o trecho
 * citado morava na 160 e seria dado como inexistente.
 */
export function paginasDe(raw: unknown): number[] {
  const txt = String(raw ?? "").replace(/[–—]/g, "-");
  const out = new Set<number>();
  for (const m of txt.matchAll(/(\d{1,4})\s*-\s*(\d{1,4})/g)) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (b >= a && b - a <= 400) for (let p = a; p <= b; p++) out.add(p);
  }
  for (const m of txt.matchAll(/\d{1,4}/g)) out.add(Number(m[0]));
  return [...out].filter((n) => n > 0 && n < 5000);
}

/**
 * O CARIMBO DE PÁGINA, FORA DO CAMINHO.
 *
 * Toda página do memorial carrega o mesmo rodapé e o mesmo cabeçalho, e eles
 * caem NO MEIO das frases: a p.61 termina em "Para melhor amarração com a
 * alvenaria" e a p.62 recomeça em "existente, evitando fissura". Quem confere
 * colando as páginas com o carimbo entre elas acusaria de invenção uma
 * transcrição exata.
 */
function comumNasBordas(paginas: string[], modo: "inicio" | "fim"): number {
  if (paginas.length < 4) return 0;
  const car = (s: string, i: number) => (modo === "inicio" ? s[i] : s[s.length - 1 - i]);
  const menor = Math.min(...paginas.map((p) => p.length));
  let n = 0;
  while (n < menor && n < 400) {
    const alvo = car(paginas[0], n);
    // "quase todas" e não "todas": uma página de tabela ou a capa quebram a
    // igualdade total sem que o carimbo deixe de existir nas outras 210.
    const quantas = paginas.filter((p) => car(p, n) === alvo).length;
    if (quantas < paginas.length * 0.6) break;
    n++;
  }
  return n;
}

export function indexarParaAncoragem(paginas: readonly PaginaDeTexto[]): IndiceDeAncoragem {
  // Dígitos viram "#" só para DETECTAR a borda: o número de página muda, o
  // resto não.
  const semDigitos = paginas.map((p) => esqueleto(p.text).replace(/\d/g, "#"));
  const nInicio = comumNasBordas(semDigitos, "inicio");
  const nFim = comumNasBordas(semDigitos, "fim");

  const porPagina = new Map<number, string>();
  const corpos: string[] = [];
  for (const p of paginas) {
    const cru = esqueleto(p.text);
    const corpo = cru.slice(nInicio, cru.length - nFim);
    porPagina.set(p.page, corpo);
    corpos.push(corpo);
  }

  return { porPagina, documentoInteiro: corpos.join(""), nInicio, nFim };
}

/** Os pedaços procuráveis de um trecho: a elisão `[...]` parte a busca em dois. */
function pedacosDe(trecho: string): string[] {
  return trecho
    .split(/\[\s*\.\.\.\s*\]|\[…\]|…|\.\.\./)
    .map((p) => esqueleto(p).slice(0, 60))
    .filter((p) => p.length >= 12);
}

export function ancorarTrecho(
  indice: IndiceDeAncoragem,
  trecho: string,
  paginasDeclaradas: readonly number[],
): Veredito {
  const pedacos = pedacosDe(trecho);
  if (pedacos.length === 0) return "sem_transcricao";

  /*
   * As páginas declaradas viram UM texto só: frase de memorial atravessa a
   * virada de página o tempo todo, e conferindo página a página isoladamente
   * uma transcrição correta de p.61-62 não ancoraria em nenhuma das duas.
   */
  const textoDeclarado = paginasDeclaradas.map((p) => indice.porPagina.get(p) ?? "").join("");
  if (pedacos.every((pedaco) => textoDeclarado.includes(pedaco))) return "ancorada";
  if (pedacos.every((pedaco) => indice.documentoInteiro.includes(pedaco))) return "outra_pagina";
  return "nao_encontrada";
}

export function ancorarEvidencia(
  indice: IndiceDeAncoragem,
  evidencia: string,
  pagina: unknown,
): { veredito: Veredito; trecho: string } {
  const trechos = trechosCitados(evidencia);
  if (trechos.length === 0) return { veredito: "sem_transcricao", trecho: "" };

  const paginas = paginasDe(pagina);
  let melhor: Veredito = "nao_encontrada";
  let qual = trechos[0];

  for (const trecho of trechos) {
    const v = ancorarTrecho(indice, trecho, paginas);
    if (v === "ancorada") return { veredito: "ancorada", trecho };
    if (v === "outra_pagina" && melhor === "nao_encontrada") {
      melhor = "outra_pagina";
      qual = trecho;
    }
  }

  return { veredito: melhor, trecho: qual };
}
```

- [ ] **Passo 4: rode o teste e confirme que passa**

```
node scripts/test-ancoragem.ts
```
Esperado: `11 teste(s) de ancoragem OK`, saída sem `FALHOU`.

- [ ] **Passo 5: o script passa a importar a biblioteca**

Em `scripts/prova-evidencia-ancorada.ts`, apague as declarações locais de
`esqueleto`, `trechosCitados`, `paginasDe` e `comumNasBordas` (linhas 29-104 do
arquivo atual) e o bloco que monta `porPagina`/`documentoInteiro` (linhas
108-124), e troque por:

```ts
import {
  ancorarEvidencia,
  indexarParaAncoragem,
  type Veredito,
} from "../lib/ancoragem-de-evidencia.ts";
```

O laço de achados (linhas 128-182) vira:

```ts
const extracted = await extractPdfText(await readFile(pdfPath));
const indice = indexarParaAncoragem(extracted.pages);

if (indice.nInicio + indice.nFim > 0) {
  console.log(
    `(carimbo de página detectado: ${indice.nInicio} chars no início, ${indice.nFim} no fim — removidos)\n`,
  );
}

const resultado: { id: string; tipo: string; pagina: string; veredito: Veredito; trecho: string }[] = [];

for (const f of achados) {
  const { veredito, trecho } = ancorarEvidencia(indice, String(f.evidencia ?? ""), f.pagina);
  resultado.push({ id: f.id, tipo: f.tipo, pagina: String(f.pagina), veredito, trecho });
}
```

O resto do arquivo (as contagens e a impressão) fica **intacto**.

- [ ] **Passo 6: prove que o script não mudou de comportamento**

```
npm run prova:evidencia-ancorada -- tests/relatorio_incongruencias_memorial_117_25.md tests/117_25_md_geral_a.pdf
```

Se esse `.md` não for JSON, use qualquer parecer JSON gravado. Esperado: roda
até o fim e imprime as quatro contagens. O número de `ancorada` tem de ser o
MESMO de antes da mudança — rode uma vez ANTES do passo 5 e anote, porque é a
única prova de que a extração não regrediu.

- [ ] **Passo 7: registre o teste no `package.json`**

Ao lado de `"test:impressao-achado"`, acrescente:

```json
"test:ancoragem": "node scripts/test-ancoragem.ts",
```

- [ ] **Passo 8: commit**

```bash
git add lib/ancoragem-de-evidencia.ts scripts/test-ancoragem.ts scripts/prova-evidencia-ancorada.ts package.json
git diff --cached --stat
git commit -m "ancoragem: a pergunta 'este trecho existe nesta pagina' ganha um dono so"
```

---

## Tarefa 2: a memória do documento

Hoje `app/api/audit/route.ts` extrai o texto por corrida e o descarta; no banco
sobra só `AuditFile.extractedCharCount`, e o provedor de blob está em `"none"`
(`lib/file-storage.ts:14`) — os bytes do PDF vivem no navegador. Por isso o
chat nunca viu o documento, e nenhum ajuste de prompt resolveria.

`persistCompletedAudit` **já recebe** `uploadedFiles: UploadedAuditFile[]`, e
cada item já carrega `extracted: ExtractedPdf` com todas as páginas. Não é
preciso mexer na rota de auditoria nem re-extrair nada: é gravar o que já está
na mão, dentro da transação que já existe.

**Arquivos:**
- Modificar: `prisma/schema.prisma:299-325` (Audit) e fim do arquivo (AuditText)
- Criar: `prisma/migrations/20260825120000_memoria_do_documento/migration.sql`
- Criar: `lib/memoria-do-documento.ts`
- Modificar: `lib/audit-persistence.ts:96-175`
- Criar: `scripts/test-memoria-do-documento.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: `UploadedAuditFile` de `lib/audit-persistence.ts`; `chunkPdfByChapter`
  e `textoDaPaginaParaIA` de `lib/pdf-text.ts`; `PaginaDeTexto` da Tarefa 1.
- Produz, e as tarefas 4, 5 e 6 dependem destes nomes exatos:

```ts
export type CapituloGravado = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  chars: number;
};
export type MemoriaDoDocumento = {
  fileName: string;
  paginas: PaginaDeTexto[];
  capitulos: CapituloGravado[];
  charCount: number;
};

/** Puro: transforma os arquivos da corrida nas linhas a gravar. Testável sem banco. */
export function memoriasDosArquivos(
  uploadedFiles: readonly { file: { name: string }; extracted: ExtractedPdf }[],
): MemoriaDoDocumento[];

/** Lê o texto guardado. `null` = parecer antigo, sem memória: modo degradado. */
export async function carregarMemoriaDoDocumento(auditId: string): Promise<MemoriaDoDocumento[]>;
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-memoria-do-documento.ts`:

```ts
/**
 * O QUE VAI PARA O BANCO É O QUE O CHAT PRECISA RELER.
 *
 * Sem banco e sem token: `memoriasDosArquivos` é função pura sobre o
 * `ExtractedPdf` que a corrida já tem na mão.
 *
 *   node scripts/test-memoria-do-documento.ts  (== npm run test:memoria)
 */
import assert from "node:assert/strict";

import { memoriasDosArquivos } from "../lib/memoria-do-documento.ts";

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

const paginas = [
  { page: 1, text: "1 - PAREDES E PAINEIS\nAs alvenarias serao em bloco ceramico." },
  { page: 2, text: "Continuacao das paredes, com chapisco e emboco." },
  { page: 3, text: "2 - REVESTIMENTOS DE PISO\nPiso vinilico em manta." },
];
const extracted = (p: typeof paginas) => ({
  pages: p,
  text: p.map((x) => x.text).join("\n"),
  pageCount: p.length,
  charCount: p.reduce((s, x) => s + x.text.length, 0),
}) as never;

const memorias = memoriasDosArquivos([
  { file: { name: "063_26_md_geral_a.pdf" }, extracted: extracted(paginas) },
]);

test("uma memoria por arquivo, com o nome do arquivo", () => {
  assert.equal(memorias.length, 1);
  assert.equal(memorias[0].fileName, "063_26_md_geral_a.pdf");
});

test("guarda UMA entrada por pagina, com o numero real da pagina", () => {
  assert.deepEqual(
    memorias[0].paginas.map((p) => p.page),
    [1, 2, 3],
  );
  assert.ok(memorias[0].paginas[0].text.includes("bloco ceramico"));
});

test("o indice de capitulos vem SEM o texto", () => {
  const cap = memorias[0].capitulos;
  assert.ok(cap.length >= 2, `esperava 2+ capitulos, veio ${cap.length}`);
  for (const c of cap) {
    assert.ok(!("text" in c), `capitulo ${c.id} carregou o texto — dobra o armazenamento`);
    assert.equal(typeof c.chars, "number");
    assert.ok(c.startPage >= 1 && c.endPage >= c.startPage);
  }
});

test("o titulo do capitulo sai do cabecalho da pagina", () => {
  const titulos = memorias[0].capitulos.map((c) => c.title).join(" | ");
  assert.ok(/PAREDES/i.test(titulos), `titulos: ${titulos}`);
  assert.ok(/REVESTIMENTOS/i.test(titulos), `titulos: ${titulos}`);
});

test("charCount bate com a soma das paginas", () => {
  const soma = memorias[0].paginas.reduce((s, p) => s + p.text.length, 0);
  assert.equal(memorias[0].charCount, soma);
});

test("a pagina guardada leva a grade da tabela junto", () => {
  // `textoDaPaginaParaIA` anexa a grade; é o texto que o modelo lê, e o chat
  // precisa ver a tabela pelo mesmo motivo que o auditor precisa.
  const comTabela = memoriasDosArquivos([
    {
      file: { name: "t.pdf" },
      extracted: extracted([
        { page: 1, text: "Quadro de areas", tabelas: [{ linhas: [["Sala", "12,5"]] }] } as never,
      ]),
    },
  ]);
  assert.ok(comTabela[0].paginas[0].text.includes("12,5"));
});

test("arquivo sem paginas nao vira memoria vazia no banco", () => {
  const vazio = memoriasDosArquivos([{ file: { name: "v.pdf" }, extracted: extracted([]) }]);
  assert.equal(vazio.length, 0);
});

console.log(`\n${passed} teste(s) de memoria do documento OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-memoria-do-documento.ts
```
Esperado: `ERR_MODULE_NOT_FOUND` em `lib/memoria-do-documento.ts`.

- [ ] **Passo 3: modelo novo no `prisma/schema.prisma`**

Em `model Audit` (linha 299), acrescente na lista de relações, logo abaixo de
`artifacts DocumentArtifact[]`:

```prisma
  texts          AuditText[]
```

E no fim do bloco de modelos de auditoria, depois de `model AuditFile`:

```prisma
/// O texto do documento auditado, guardado para o chat pós-parecer poder RELER
/// o memorial em vez de falar de cor sobre o parecer. Sem isto o chat nunca viu
/// o documento — só o JSON dos achados.
///
/// Guardamos o TEXTO, não o PDF: os bytes vivem no navegador e o provedor de
/// blob está em "none" (`lib/file-storage.ts:14`). ~173 KB para um memorial de
/// 73 páginas.
model AuditText {
  id        String   @id @default(cuid())
  auditId   String
  fileName  String
  /// Uma entrada por página: { page, text }. É daqui que sai o número da página
  /// que o chat cita — o modelo nunca o inventa.
  pages     Json
  /// O ÍNDICE por capítulo (`chunkPdfByChapter`), SEM o texto: título, página
  /// inicial, final e nº de chars. Guardar o texto aqui também dobraria o
  /// armazenamento — o texto do capítulo se reconstrói das páginas.
  capitulos Json
  charCount Int
  createdAt DateTime @default(now())
  audit     Audit    @relation(fields: [auditId], references: [id], onDelete: Cascade)

  @@index([auditId])
}
```

- [ ] **Passo 4: gere a migração**

```
npm run db:migrate:dev -- --name memoria_do_documento
```

Esperado: cria `prisma/migrations/<timestamp>_memoria_do_documento/` com um
`CREATE TABLE "AuditText"` e um `CREATE INDEX`. Confira que **não há nenhum
`DROP`** no SQL gerado antes de seguir — se houver, o schema local divergiu do
banco e isso precisa ser resolvido primeiro.

Sem banco na máquina, o comando falha; nesse caso escreva o SQL à mão em
`prisma/migrations/20260825120000_memoria_do_documento/migration.sql`:

```sql
CREATE TABLE "AuditText" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "pages" JSONB NOT NULL,
    "capitulos" JSONB NOT NULL,
    "charCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditText_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditText_auditId_idx" ON "AuditText"("auditId");

ALTER TABLE "AuditText" ADD CONSTRAINT "AuditText_auditId_fkey"
    FOREIGN KEY ("auditId") REFERENCES "Audit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

e rode `npm run db:generate`.

- [ ] **Passo 5: escreva `lib/memoria-do-documento.ts`**

```ts
/**
 * O TEXTO DO MEMORIAL, GUARDADO — para o chat poder RELER.
 *
 * Até 24/08/2026 a auditoria extraía o texto por corrida e o descartava: no
 * banco sobrava `AuditFile.extractedCharCount`, e os bytes do PDF ficavam no
 * navegador (`lib/file-storage.ts` está em "none"). O chat pós-parecer nunca
 * tinha visto o documento — respondia de cor sobre o JSON dos achados, e o
 * prompt dele mandava literalmente "não diga que releu o PDF".
 *
 * Guardamos o TEXTO e não o PDF, e o índice de capítulos SEM o texto: o texto
 * do capítulo se reconstrói das páginas, e duplicá-lo dobraria o armazenamento
 * de graça.
 */
import type { Prisma } from "@prisma/client";

import type { PaginaDeTexto } from "@/lib/ancoragem-de-evidencia";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { chunkPdfByChapter, textoDaPaginaParaIA, type ExtractedPdf } from "@/lib/pdf-text";

export type CapituloGravado = {
  id: string;
  title: string;
  startPage: number;
  endPage: number;
  chars: number;
};

export type MemoriaDoDocumento = {
  fileName: string;
  paginas: PaginaDeTexto[];
  capitulos: CapituloGravado[];
  charCount: number;
};

/**
 * PURO de propósito: a gravação acontece dentro de uma transação que já existe,
 * e o que decide o CONTEÚDO da linha precisa ser testável sem banco.
 */
export function memoriasDosArquivos(
  uploadedFiles: readonly { file: { name: string }; extracted: ExtractedPdf }[],
): MemoriaDoDocumento[] {
  const memorias: MemoriaDoDocumento[] = [];

  for (const item of uploadedFiles) {
    const pages = item.extracted.pages ?? [];
    // Arquivo sem página não vira linha: uma memória vazia no banco faria o
    // chat achar que tem o documento e responder "não consta" sobre tudo.
    if (pages.length === 0) continue;

    /*
     * A página guardada é a que o MODELO lê — com a grade das tabelas anexada.
     * Guardar `page.text` cru devolveria a tabela como sopa de números, que é
     * exatamente o defeito que `textoDaPaginaParaIA` existe para consertar.
     */
    const paginas: PaginaDeTexto[] = pages.map((p) => ({
      page: p.page,
      text: textoDaPaginaParaIA(p),
    }));

    const capitulos: CapituloGravado[] = chunkPdfByChapter(item.extracted).map((c) => ({
      id: c.id,
      title: c.title,
      startPage: c.startPage,
      endPage: c.endPage,
      chars: c.text.length,
    }));

    memorias.push({
      fileName: item.file.name,
      paginas,
      capitulos,
      charCount: paginas.reduce((soma, p) => soma + p.text.length, 0),
    });
  }

  return memorias;
}

/** As linhas prontas para `createMany`, dentro da transação de quem chama. */
export function linhasDeAuditText(auditId: string, memorias: readonly MemoriaDoDocumento[]) {
  return memorias.map((m) => ({
    auditId,
    fileName: m.fileName,
    pages: m.paginas as unknown as Prisma.InputJsonValue,
    capitulos: m.capitulos as unknown as Prisma.InputJsonValue,
    charCount: m.charCount,
  }));
}

/**
 * O texto guardado desta auditoria. Vetor vazio = parecer antigo, sem memória —
 * e o chat precisa DIZER isso na resposta, nunca fingir que leu.
 */
export async function carregarMemoriaDoDocumento(auditId: string): Promise<MemoriaDoDocumento[]> {
  if (!auditId || !isDatabaseConfigured()) return [];

  try {
    const prisma = getPrisma();
    const linhas = await prisma.auditText.findMany({
      where: { auditId },
      orderBy: { createdAt: "asc" },
      select: { fileName: true, pages: true, capitulos: true, charCount: true },
    });

    return linhas.map((linha) => ({
      fileName: linha.fileName,
      paginas: (linha.pages as unknown as PaginaDeTexto[]) ?? [],
      capitulos: (linha.capitulos as unknown as CapituloGravado[]) ?? [],
      charCount: linha.charCount,
    }));
  } catch (error) {
    // Falhar aqui NÃO derruba o chat: ele cai no modo degradado e avisa.
    console.error("[audit-chat] falha ao ler a memória do documento", error);
    return [];
  }
}
```

- [ ] **Passo 6: rode o teste e confirme que passa**

```
node scripts/test-memoria-do-documento.ts
```
Esperado: `7 teste(s) de memoria do documento OK`.

- [ ] **Passo 7: grave dentro da transação que já existe**

Em `lib/audit-persistence.ts`, acrescente ao topo:

```ts
import { linhasDeAuditText, memoriasDosArquivos } from "@/lib/memoria-do-documento";
```

E dentro de `persistCompletedAudit`, logo DEPOIS do `auditFile.createMany`
(linha ~136) e ANTES do `if (args.projectId && args.actor)`:

```ts
      /*
       * O TEXTO, para o chat poder reler.
       *
       * Na mesma transação e a partir do `extracted` que já está na mão: a
       * corrida acabou de extrair o documento inteiro e o descartava. Reauditar
       * substitui a memória junto com o parecer — as duas coisas descrevem a
       * MESMA corrida, e uma memória de outra revisão faria o chat citar a
       * página de um documento que não é mais o auditado.
       */
      await transaction.auditText.deleteMany({ where: { auditId: args.auditId! } });
      const memorias = memoriasDosArquivos(args.uploadedFiles);
      if (memorias.length > 0) {
        await transaction.auditText.createMany({
          data: linhasDeAuditText(args.auditId!, memorias),
        });
      }
```

- [ ] **Passo 8: confirme que compila**

```
npx tsc --noEmit
```
Esperado: sai sem erro. Se acusar `Property 'auditText' does not exist`, o
cliente Prisma não foi regerado: rode `npm run db:generate` e repita.

- [ ] **Passo 9: registre o teste no `package.json`**

```json
"test:memoria": "node scripts/test-memoria-do-documento.ts",
```

- [ ] **Passo 10: commit**

```bash
git add prisma/schema.prisma prisma/migrations lib/memoria-do-documento.ts lib/audit-persistence.ts scripts/test-memoria-do-documento.ts package.json
git diff --cached --stat
git commit -m "memoria: o texto do memorial deixa de ser jogado fora no fim da auditoria"
```

---

## Tarefa 3: as ferramentas de leitura

Cinco ferramentas, todas determinísticas e todas puras. É onde mora a decisão
que sustenta a spec: a página e a evidência **saem da ferramenta**, nunca da
cabeça do modelo. A IA escolhe o que olhar; quem responde *onde está* é o código.

**Arquivos:**
- Criar: `server/audit/chat/ferramentas.ts`
- Criar: `scripts/test-chat-ferramentas.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: `MemoriaDoDocumento`, `CapituloGravado` (Tarefa 2);
  `esqueleto`, `indexarParaAncoragem`, `ancorarEvidencia`, `IndiceDeAncoragem`
  (Tarefa 1); `AuditReport`, `AuditFinding` de `lib/audit-report.ts`.
- Produz, e as tarefas 4, 5 e 6 dependem destes nomes exatos:

```ts
export type ContextoDoChat = {
  report: AuditReport;
  memorias: MemoriaDoDocumento[];
  /** Índices de ancoragem por arquivo, montados uma vez por turno. */
  indices: Map<string, IndiceDeAncoragem>;
};

export function montarContexto(report: AuditReport, memorias: MemoriaDoDocumento[]): ContextoDoChat;
export function temMemoria(ctx: ContextoDoChat): boolean;

export function listarCapitulos(ctx: ContextoDoChat): string;
export function buscarNoMemorial(ctx: ContextoDoChat, termo: string, limite?: number): string;
export function lerPaginas(ctx: ContextoDoChat, de: number, ate: number): string;
export function lerAchado(ctx: ContextoDoChat, id: string): string;

export const TETO_DE_PAGINAS_POR_LEITURA = 6;
export const FERRAMENTAS_DE_LEITURA: FunctionTool[];
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-chat-ferramentas.ts`:

```ts
/**
 * AS FERRAMENTAS DEVOLVEM A PÁGINA CERTA — E DIZEM QUANDO NÃO ACHARAM.
 *
 * Sem token e sem banco: são funções sobre estruturas.
 *
 *   node scripts/test-chat-ferramentas.ts  (== npm run test:chat:ferramentas)
 */
import assert from "node:assert/strict";

import {
  TETO_DE_PAGINAS_POR_LEITURA,
  buscarNoMemorial,
  lerAchado,
  lerPaginas,
  listarCapitulos,
  montarContexto,
  temMemoria,
} from "../server/audit/chat/ferramentas.ts";

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

const memoria = {
  fileName: "063_26.pdf",
  paginas: [
    { page: 40, text: "1 - PAREDES\nAlvenaria em bloco ceramico de vedacao 14x19x39." },
    { page: 41, text: "Chapisco com argamassa de cimento e areia no traco 1:3." },
    { page: 42, text: "2 - PISOS\nPiso vinilico em manta de 2mm sobre contrapiso." },
    { page: 43, text: "Rodape do mesmo material, altura de 10cm." },
    { page: 44, text: "3 - COBERTURA\nTelha metalica termoacustica de 30mm." },
    { page: 45, text: "Calha em chapa galvanizada numero 24." },
    { page: 46, text: "Rufo em chapa galvanizada numero 24." },
  ],
  capitulos: [
    { id: "chunk-1", title: "1 - PAREDES", startPage: 40, endPage: 41, chars: 110 },
    { id: "chunk-2", title: "2 - PISOS", startPage: 42, endPage: 43, chars: 95 },
    { id: "chunk-3", title: "3 - COBERTURA", startPage: 44, endPage: 46, chars: 120 },
  ],
  charCount: 325,
};

const report = {
  arquivo: "063_26.pdf",
  tipo_auditoria: "memorial",
  tipo_documento: "Memorial descritivo",
  total_incongruencias: 1,
  incongruencias: [
    {
      id: "INC-001",
      arquivo: "063_26.pdf",
      prioridade: "Alta",
      pagina: "44",
      capitulo: "3 - COBERTURA",
      local: "Cobertura",
      tipo: "Espessura de telha divergente",
      descricao: "A telha declarada nao bate com a prancha.",
      evidencia: 'Pagina 44: "Telha metalica termoacustica de 30mm"',
      conflito: "A prancha indica 50mm.",
      sugestao_correcao: "Uniformizar a espessura.",
      confianca: "alta",
      origem: "ia",
    },
  ],
} as never;

const ctx = montarContexto(report, [memoria]);

test("com memoria gravada, o contexto diz que tem o documento", () => {
  assert.equal(temMemoria(ctx), true);
  assert.equal(temMemoria(montarContexto(report, [])), false);
});

test("listar_capitulos devolve o indice com pagina inicial e final", () => {
  const saida = listarCapitulos(ctx);
  assert.ok(saida.includes("1 - PAREDES"));
  assert.ok(saida.includes("40"));
  assert.ok(saida.includes("3 - COBERTURA"));
  // O índice não carrega o texto: é índice, não o documento.
  assert.ok(!saida.includes("bloco ceramico"), "o indice vazou o texto do capitulo");
});

test("buscar_no_memorial devolve a PAGINA REAL do termo", () => {
  const saida = buscarNoMemorial(ctx, "chapisco");
  assert.ok(/p[aá]gina\s*41/i.test(saida), saida);
  assert.ok(saida.includes("argamassa"), "nao trouxe o texto ao redor");
});

test("busca e imune a acento, caixa e refluxo de espaco", () => {
  const saida = buscarNoMemorial(ctx, "TELHA  METÁLICA");
  assert.ok(/p[aá]gina\s*44/i.test(saida), saida);
});

test("termo que aparece em duas paginas devolve as duas", () => {
  const saida = buscarNoMemorial(ctx, "chapa galvanizada");
  assert.ok(/45/.test(saida) && /46/.test(saida), saida);
});

test("termo que nao existe diz que NAO ACHOU, sem aproximar", () => {
  const saida = buscarNoMemorial(ctx, "impermeabilizacao com manta asfaltica");
  assert.ok(/n[aã]o encontr/i.test(saida), saida);
  // Não pode devolver "o mais parecido": aproximar é inventar página.
  assert.ok(!/p[aá]gina\s*4\d/i.test(saida), `aproximou: ${saida}`);
});

test("ler_paginas devolve o texto literal do intervalo", () => {
  const saida = lerPaginas(ctx, 40, 41);
  assert.ok(saida.includes("bloco ceramico"));
  assert.ok(saida.includes("argamassa"));
  assert.ok(saida.includes("40") && saida.includes("41"));
});

test("ler_paginas respeita o teto e DIZ que truncou", () => {
  const saida = lerPaginas(ctx, 40, 40 + TETO_DE_PAGINAS_POR_LEITURA + 10);
  assert.ok(/teto|limite/i.test(saida), `nao avisou o truncamento: ${saida}`);
  const lidas = [...saida.matchAll(/--- P[AÁ]GINA (\d+)/gi)].length;
  assert.ok(lidas <= TETO_DE_PAGINAS_POR_LEITURA, `leu ${lidas} paginas`);
});

test("ler_paginas fora do documento nao inventa pagina", () => {
  const saida = lerPaginas(ctx, 900, 905);
  assert.ok(/n[aã]o (existe|encontr)/i.test(saida), saida);
});

test("ler_achado devolve o achado inteiro do parecer", () => {
  const saida = lerAchado(ctx, "INC-001");
  assert.ok(saida.includes("Espessura de telha divergente"));
  assert.ok(saida.includes("A prancha indica 50mm"));
});

test("ler_achado de id inexistente lista os ids validos", () => {
  const saida = lerAchado(ctx, "INC-999");
  assert.ok(/INC-001/.test(saida), `nao ajudou o modelo a se corrigir: ${saida}`);
});

test("sem memoria, as ferramentas de documento dizem que nao ha texto", () => {
  const semTexto = montarContexto(report, []);
  assert.ok(/n[aã]o/i.test(buscarNoMemorial(semTexto, "chapisco")));
  assert.ok(/n[aã]o/i.test(lerPaginas(semTexto, 1, 2)));
  // O parecer continua acessível: o modo degradado é parcial, não total.
  assert.ok(lerAchado(semTexto, "INC-001").includes("Espessura"));
});

console.log(`\n${passed} teste(s) de ferramentas do chat OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-chat-ferramentas.ts
```
Esperado: `ERR_MODULE_NOT_FOUND` em `server/audit/chat/ferramentas.ts`.

- [ ] **Passo 3: a normalização ganha um mapa de posições**

A busca precisa achar o termo no texto NORMALIZADO (imune a acento e refluxo) e
devolver o trecho no texto ORIGINAL — senão o chat mostraria ao engenheiro um
texto sem acento que não é o que está na folha. O mapa mora junto da
normalização, e não numa cópia dela: duas normalizações no repositório é o
defeito que a Tarefa 1 existe para evitar.

Acrescente em `lib/ancoragem-de-evidencia.ts`, logo depois de `esqueleto`:

```ts
/**
 * O esqueleto MAIS o índice de onde cada caractere estava no original.
 *
 * A busca casa no esqueleto (imune a acento e a espaço reflowado) e precisa
 * devolver o trecho COMO ESTÁ ESCRITO na folha. Sem o mapa, o chat mostraria ao
 * engenheiro um texto sem acento e sem pontuação, que não é o que ele vai
 * encontrar quando abrir o PDF para conferir.
 */
export function esqueletoComMapa(texto: string): { skeleton: string; indices: number[] } {
  const bruto = String(texto ?? "");
  let skeleton = "";
  const indices: number[] = [];
  /*
   * Normaliza CARACTERE A CARACTERE, e não a string inteira: o índice tem de
   * apontar para o texto original, e uma letra acentuada vira dois code points
   * em NFD — normalizar tudo de uma vez deslocaria o recorte a partir do
   * primeiro acento da página.
   */
  for (let i = 0; i < bruto.length; i += 1) {
    const limpo = bruto[i]
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    for (const c of limpo) {
      if (/[a-z0-9]/.test(c)) {
        skeleton += c;
        indices.push(i);
      }
    }
  }
  return { skeleton, indices };
}
```

O caractere a caractere devolve o MESMO esqueleto que `esqueleto()` — o teste do
Passo 6 casa os dois, porque duas normalizações que divergem em silêncio são
justamente o defeito que esta biblioteca existe para evitar.

- [ ] **Passo 4: escreva `server/audit/chat/ferramentas.ts`**

```ts
/**
 * AS FERRAMENTAS DO ADVOGADO DO DIABO — todas determinísticas.
 *
 * O princípio é o do resto do produto: fato determinístico primeiro, IA por
 * último. A IA escolhe O QUE olhar; quem responde ONDE ESTÁ é o código. É isso
 * que torna a afirmação do chat verificável, e é a única razão de "achado novo
 * nascido na conversa" poder entrar no parecer com prova que sustenta.
 *
 * Nenhuma função aqui toca banco, rede ou modelo. Todas são testáveis em Node
 * cru — como `server/nexo/agent/fatos.ts` já é.
 */
import type { FunctionTool } from "openai/resources/responses/responses";

import {
  esqueleto,
  esqueletoComMapa,
  indexarParaAncoragem,
  type IndiceDeAncoragem,
} from "@/lib/ancoragem-de-evidencia";
import type { AuditFinding, AuditReport } from "@/lib/audit-report";
import type { MemoriaDoDocumento } from "@/lib/memoria-do-documento";

/**
 * Quantas páginas uma chamada de `ler_paginas` entrega.
 *
 * Seis, e não "o que ele pedir": o memorial de 73 páginas tem 173k chars, e um
 * pedido de 1 a 73 devolveria o documento inteiro por ferramenta — que é
 * exatamente o contexto cheio que a spec recusou, entrando pela porta dos
 * fundos e em TODA volta do laço.
 */
export const TETO_DE_PAGINAS_POR_LEITURA = 6;

/** Quantas ocorrências uma busca devolve antes de dizer que há mais. */
const TETO_DE_OCORRENCIAS = 8;

/** Caracteres de contexto ao redor da ocorrência, de cada lado. */
const JANELA = 260;

export type ContextoDoChat = {
  report: AuditReport;
  memorias: MemoriaDoDocumento[];
  /** Um índice de ancoragem por arquivo, montado uma vez por turno. */
  indices: Map<string, IndiceDeAncoragem>;
};

export function montarContexto(
  report: AuditReport,
  memorias: MemoriaDoDocumento[],
): ContextoDoChat {
  const indices = new Map<string, IndiceDeAncoragem>();
  for (const m of memorias) {
    indices.set(m.fileName, indexarParaAncoragem(m.paginas));
  }
  return { report, memorias, indices };
}

/** Falso = parecer antigo, gravado antes de a memória do documento existir. */
export function temMemoria(ctx: ContextoDoChat): boolean {
  return ctx.memorias.some((m) => m.paginas.length > 0);
}

const SEM_TEXTO =
  "Esta auditoria foi gravada antes de o texto do memorial passar a ser guardado. " +
  "Não há documento para reler: responda apenas com o parecer e DIGA ao engenheiro " +
  "que não tem o documento desta auditoria, sugerindo reauditar para habilitar a releitura.";

export function listarCapitulos(ctx: ContextoDoChat): string {
  if (!temMemoria(ctx)) return SEM_TEXTO;

  const linhas: string[] = [];
  for (const m of ctx.memorias) {
    const paginas = m.paginas.map((p) => p.page);
    linhas.push(
      `Arquivo: ${m.fileName} — ${m.paginas.length} páginas (${Math.min(...paginas)} a ${Math.max(...paginas)}), ${m.charCount} chars`,
    );
    for (const c of m.capitulos) {
      linhas.push(`  ${c.title} | páginas ${c.startPage}-${c.endPage} | ${c.chars} chars`);
    }
  }
  return linhas.join("\n");
}

export function buscarNoMemorial(
  ctx: ContextoDoChat,
  termo: string,
  limite = TETO_DE_OCORRENCIAS,
): string {
  if (!temMemoria(ctx)) return SEM_TEXTO;

  const alvo = esqueleto(termo);
  if (alvo.length < 3) {
    return "Termo curto demais para buscar. Use pelo menos 3 caracteres alfanuméricos.";
  }

  const achados: string[] = [];
  let total = 0;

  for (const m of ctx.memorias) {
    for (const pagina of m.paginas) {
      const { skeleton, indices } = esqueletoComMapa(pagina.text);
      let de = skeleton.indexOf(alvo);
      while (de !== -1) {
        total += 1;
        if (achados.length < limite) {
          const inicio = Math.max(0, (indices[de] ?? 0) - JANELA);
          const fim = Math.min(pagina.text.length, (indices[de + alvo.length - 1] ?? 0) + JANELA);
          const trecho = pagina.text.slice(inicio, fim).replace(/\s+/g, " ").trim();
          achados.push(`${m.fileName} · página ${pagina.page}:\n  ...${trecho}...`);
        }
        de = skeleton.indexOf(alvo, de + 1);
      }
    }
  }

  if (total === 0) {
    /*
     * NÃO APROXIMAR. A tentação é devolver "o mais parecido", e ela é o defeito:
     * o modelo trataria a aproximação como ocorrência e citaria uma página onde
     * o termo não está. Dizer que não achou é a resposta correta e verificável.
     */
    return `Não encontrado: o termo "${termo}" não aparece no texto extraído de nenhum dos arquivos desta auditoria.`;
  }

  const cabecalho =
    total > achados.length
      ? `${total} ocorrência(s); mostrando as ${achados.length} primeiras. Refine o termo para ver o resto.`
      : `${total} ocorrência(s).`;
  return `${cabecalho}\n\n${achados.join("\n\n")}`;
}

export function lerPaginas(ctx: ContextoDoChat, de: number, ate: number): string {
  if (!temMemoria(ctx)) return SEM_TEXTO;

  const inicio = Math.max(1, Math.min(de, ate));
  const fimPedido = Math.max(de, ate);
  const fim = Math.min(fimPedido, inicio + TETO_DE_PAGINAS_POR_LEITURA - 1);

  const blocos: string[] = [];
  for (const m of ctx.memorias) {
    for (const pagina of m.paginas) {
      if (pagina.page < inicio || pagina.page > fim) continue;
      blocos.push(`--- PAGINA ${pagina.page} (${m.fileName}) ---\n${pagina.text}`);
    }
  }

  if (blocos.length === 0) {
    const todas = ctx.memorias.flatMap((m) => m.paginas.map((p) => p.page));
    const faixa = todas.length ? `${Math.min(...todas)} a ${Math.max(...todas)}` : "nenhuma";
    return `Não existe página ${inicio}-${fim} nesta auditoria. O documento vai da página ${faixa}.`;
  }

  const aviso =
    fimPedido > fim
      ? `\n\n(teto de ${TETO_DE_PAGINAS_POR_LEITURA} páginas por leitura: você pediu até ${fimPedido} e recebeu até ${fim}. Chame de novo a partir da ${fim + 1}.)`
      : "";
  return `${blocos.join("\n\n")}${aviso}`;
}

export function lerAchado(ctx: ContextoDoChat, id: string): string {
  const achados = ctx.report.incongruencias ?? [];
  const alvo = achados.find((f) => f.id === id || esqueleto(f.id) === esqueleto(id));

  if (!alvo) {
    const ids = achados.map((f) => f.id).join(", ") || "(o parecer não tem achados)";
    return `Não existe achado "${id}" neste parecer. IDs disponíveis: ${ids}`;
  }

  return JSON.stringify(alvo as AuditFinding, null, 2);
}

export const FERRAMENTAS_DE_LEITURA: FunctionTool[] = [
  {
    type: "function",
    name: "listar_capitulos",
    description:
      "O índice do memorial auditado: cada capítulo com sua página inicial, final e tamanho. " +
      "Use ANTES de ler páginas, para saber onde procurar.",
    strict: false,
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "buscar_no_memorial",
    description:
      "Procura um termo no texto do memorial e devolve as ocorrências com a PÁGINA REAL e o texto ao redor. " +
      "Imune a acento e a espaço. Se não encontrar, diz que não encontrou — nunca aproxima.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        termo: { type: "string", description: "O que procurar. Mínimo 3 caracteres alfanuméricos." },
      },
      required: ["termo"],
    },
  },
  {
    type: "function",
    name: "ler_paginas",
    description:
      `O texto literal de um intervalo de páginas. Máximo de ${TETO_DE_PAGINAS_POR_LEITURA} páginas por chamada; ` +
      "chame de novo para continuar.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        de: { type: "integer", description: "Primeira página." },
        ate: { type: "integer", description: "Última página." },
      },
      required: ["de", "ate"],
    },
  },
  {
    type: "function",
    name: "ler_achado",
    description: "O achado inteiro do parecer, com todos os campos, pelo id (ex.: INC-003).",
    strict: false,
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "O id do achado." } },
      required: ["id"],
    },
  },
];
```

- [ ] **Passo 5: rode o teste e confirme que passa**

```
node scripts/test-chat-ferramentas.ts
```
Esperado: `12 teste(s) de ferramentas do chat OK`.

- [ ] **Passo 6: prove que as duas normalizações não divergem**

Acrescente em `scripts/test-ancoragem.ts`, antes da linha final do `console.log`:

```ts
test("esqueletoComMapa devolve o MESMO esqueleto que esqueleto()", () => {
  const casos = [
    "MÉTRICA de execução — 1,20m²",
    "Ramal de ligação aéreo: Alumínio multiplexado de # 35m²",
    "PREFEITURA  MUNICIPAL\nDE  PALHOÇA",
  ];
  for (const caso of casos) {
    assert.equal(esqueletoComMapa(caso).skeleton, esqueleto(caso), caso);
  }
});

test("o indice do mapa aponta para o texto ORIGINAL, com acento", () => {
  const texto = "A MÉTRICA de execução é a área líquida.";
  const { skeleton, indices } = esqueletoComMapa(texto);
  const de = skeleton.indexOf("area");
  assert.notEqual(de, -1);
  // Recortando pelo índice, o original volta ACENTUADO — é o que o engenheiro
  // vai encontrar quando abrir o PDF.
  assert.equal(texto.slice(indices[de], indices[de] + 4), "área");
});
```

E acrescente `esqueletoComMapa` ao `import` do topo do arquivo. Rode:

```
node scripts/test-ancoragem.ts
```
Esperado: `13 teste(s) de ancoragem OK`.

- [ ] **Passo 7: registre o teste no `package.json`**

```json
"test:chat:ferramentas": "node scripts/test-chat-ferramentas.ts",
```

- [ ] **Passo 8: commit**

```bash
git add server/audit/chat/ferramentas.ts lib/ancoragem-de-evidencia.ts scripts/test-chat-ferramentas.ts scripts/test-ancoragem.ts package.json
git diff --cached --stat
git commit -m "chat: as ferramentas de leitura -- quem diz onde esta o trecho e o codigo"
```

---

## Tarefa 4: o achado nascido no chat

`AuditFinding.origem` passa a aceitar `"chat"`. **Por que isso é seguro:** os
seis consumidores de `origem` testam `=== "regra"` (`lib/audit-report.ts:108,931,956`,
`lib/audit-reuso.ts:156`, `lib/audit-verify.ts:228,255`, `lib/severidade.ts:68`).
Um achado `"chat"` cai no mesmo ramo que um achado `"ia"` em severidade,
verificação e reuso — que é o comportamento correto: ele **é** nascido de IA, e
deve passar pela mesma trava anti-alucinação e pelo mesmo reancoramento entre
versões. Nenhum desses ramos muda.

O que muda é a porta de entrada: `registrar_achado` valida a evidência **contra
o texto guardado** antes de aceitar. É a ideia de `audit-verify.ts`, só que
rodando no ato — se o trecho citado não existe na página informada, a ferramenta
**recusa** e devolve o erro ao modelo, que tenta de novo.

**Arquivos:**
- Modificar: `lib/audit-report.ts:83`
- Modificar: `server/audit/chat/ferramentas.ts` (acrescenta ao fim)
- Modificar: `scripts/test-chat-ferramentas.ts` (acrescenta casos)

**Interfaces:**
- Consome: `ContextoDoChat`, `temMemoria` (Tarefa 3); `ancorarEvidencia`,
  `paginasDe` (Tarefa 1); `impressaoDoAchado` de `lib/impressao-do-achado.ts`.
- Produz, e a Tarefa 6 depende destes nomes exatos:

```ts
export type AchadoProposto = {
  pagina: string;
  tipo: string;
  descricao: string;
  evidencia: string;
  conflito: string;
  sugestao_correcao: string;
  prioridade: FindingPriority;
  impacto: FindingImpact;
  capitulo?: string;
  local?: string;
};
export type ResultadoDoRegistro =
  | { ok: true; achado: AuditFinding; mensagem: string }
  | { ok: false; mensagem: string };

export function registrarAchado(ctx: ContextoDoChat, proposto: AchadoProposto): ResultadoDoRegistro;
export function aplicarAchadoNoParecer(report: AuditReport, achado: AuditFinding): AuditReport;
export const FERRAMENTA_REGISTRAR: FunctionTool;
```

- [ ] **Passo 1: escreva os testes que falham**

Acrescente em `scripts/test-chat-ferramentas.ts`, antes do `console.log` final,
e acrescente `aplicarAchadoNoParecer` e `registrarAchado` ao `import` do topo:

```ts
const proposta = {
  pagina: "41",
  tipo: "Traço de argamassa divergente",
  descricao: "O traço declarado no chapisco não bate com a norma citada.",
  evidencia: 'Página 41: "argamassa de cimento e areia no traco 1:3"',
  conflito: "A norma citada no capítulo 1 exige 1:4.",
  sugestao_correcao: "Uniformizar o traço entre o texto e a norma referenciada.",
  prioridade: "Media",
  impacto: "tecnico_contratual",
} as never;

test("achado com evidencia que ANCORA na pagina declarada e aceito", () => {
  const r = registrarAchado(ctx, proposta);
  assert.equal(r.ok, true, r.ok ? "" : r.mensagem);
  if (!r.ok) return;
  assert.equal(r.achado.origem, "chat");
  assert.equal(r.achado.pagina, "41");
  assert.ok(/^INC-\d{3}$/.test(r.achado.id), `id fora da serie: ${r.achado.id}`);
});

test("achado com trecho que NAO existe no documento e RECUSADO", () => {
  const r = registrarAchado(ctx, {
    ...proposta,
    evidencia: 'Página 41: "impermeabilizacao com manta asfaltica de 4mm"',
  } as never);
  assert.equal(r.ok, false);
  // A recusa tem de ENSINAR: o modelo lê esta mensagem e tenta de novo.
  assert.ok(/n[aã]o (existe|foi encontrad)/i.test(r.mensagem), r.mensagem);
});

test("trecho que existe em OUTRA pagina e recusado, dizendo qual", () => {
  const r = registrarAchado(ctx, {
    ...proposta,
    pagina: "44",
    evidencia: 'Página 44: "argamassa de cimento e areia no traco 1:3"',
  } as never);
  assert.equal(r.ok, false);
  assert.ok(/outra p[aá]gina/i.test(r.mensagem), r.mensagem);
});

test("achado sem transcricao entre aspas e recusado", () => {
  const r = registrarAchado(ctx, { ...proposta, evidencia: "p. 41:" } as never);
  assert.equal(r.ok, false);
  assert.ok(/transcri/i.test(r.mensagem), r.mensagem);
});

test("achado que repete defeito ja no parecer e recusado pela impressao digital", () => {
  const r = registrarAchado(ctx, {
    ...proposta,
    pagina: "44",
    tipo: "Espessura de telha errada",
    evidencia: 'Página 44: "Telha metalica termoacustica de 30mm"',
  } as never);
  assert.equal(r.ok, false);
  assert.ok(/INC-001/.test(r.mensagem), `nao apontou o achado existente: ${r.mensagem}`);
});

test("sem memoria do documento, registrar_achado NAO grava as cegas", () => {
  const r = registrarAchado(montarContexto(report, []), proposta);
  assert.equal(r.ok, false);
  assert.ok(/n[aã]o (h[aá]|tem)/i.test(r.mensagem), r.mensagem);
});

test("aplicar no parecer acrescenta o achado e atualiza o total", () => {
  const r = registrarAchado(ctx, proposta);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const novo = aplicarAchadoNoParecer(report, r.achado);
  assert.equal(novo.incongruencias.length, 2);
  assert.equal(novo.total_incongruencias, 2);
  // O parecer original NAO foi mexido: quem grava decide quando trocar.
  assert.equal(report.incongruencias.length, 1);
});
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-chat-ferramentas.ts
```
Esperado: `registrarAchado is not a function` (ou `does not provide an export`).

- [ ] **Passo 3: abra `origem` para `"chat"`**

Em `lib/audit-report.ts`, linha 83, troque:

```ts
  origem?: "regra" | "ia";
```

por:

```ts
  /**
   * De onde o achado veio.
   *
   * `"chat"` nasceu na conversa pós-parecer, com o engenheiro perguntando — e
   * passa pelos MESMOS ramos que `"ia"` em severidade, verificação e reuso,
   * porque é nascido de IA e merece a mesma trava anti-alucinação. Os seis
   * consumidores deste campo testam `=== "regra"`, e nenhum precisou mudar.
   *
   * A distinção existe para a TELA: o engenheiro precisa saber que aquele
   * achado veio da conversa, não da varredura.
   */
  origem?: "regra" | "ia" | "chat";
```

- [ ] **Passo 4: escreva o registro em `server/audit/chat/ferramentas.ts`**

Acrescente aos imports do arquivo:

```ts
import { ancorarEvidencia, paginasDe } from "@/lib/ancoragem-de-evidencia";
import type { FindingImpact, FindingPriority } from "@/lib/audit-report";
import { impressaoDoAchado } from "@/lib/impressao-do-achado";
```

E ao fim do arquivo:

```ts
export type AchadoProposto = {
  pagina: string;
  tipo: string;
  descricao: string;
  evidencia: string;
  conflito: string;
  sugestao_correcao: string;
  prioridade: FindingPriority;
  impacto: FindingImpact;
  capitulo?: string;
  local?: string;
};

export type ResultadoDoRegistro =
  | { ok: true; achado: AuditFinding; mensagem: string }
  | { ok: false; mensagem: string };

/**
 * O PORTÃO do achado nascido na conversa.
 *
 * Recusar e explicar é melhor que aceitar e avisar: a mensagem de erro volta
 * para o modelo, que corrige e tenta de novo dentro do mesmo turno. Um achado
 * inventado que entra no parecer não tem essa segunda chance — ele passa a ser
 * uma linha que o engenheiro vai levar para a prefeitura.
 */
export function registrarAchado(
  ctx: ContextoDoChat,
  proposto: AchadoProposto,
): ResultadoDoRegistro {
  if (!temMemoria(ctx)) {
    return {
      ok: false,
      mensagem:
        "Não há texto guardado desta auditoria, então não dá para conferir a evidência. " +
        "Sem conferência não se grava achado: relate o problema na resposta e sugira reauditar.",
    };
  }

  const faltando = (["pagina", "tipo", "descricao", "evidencia", "conflito", "sugestao_correcao"] as const)
    .filter((campo) => !String(proposto[campo] ?? "").trim());
  if (faltando.length > 0) {
    return { ok: false, mensagem: `Faltam campos obrigatórios: ${faltando.join(", ")}.` };
  }

  /*
   * A ancoragem roda contra o arquivo do achado — ou contra todos, quando a
   * auditoria tem mais de um. Basta ancorar em UM: o achado declara página, e a
   * página pertence a um arquivo só.
   */
  const paginas = paginasDe(proposto.pagina);
  let melhor: ReturnType<typeof ancorarEvidencia> = { veredito: "nao_encontrada", trecho: "" };
  let arquivo = ctx.memorias[0]?.fileName ?? ctx.report.arquivo ?? "";

  for (const memoria of ctx.memorias) {
    const indice = ctx.indices.get(memoria.fileName);
    if (!indice) continue;
    const r = ancorarEvidencia(indice, proposto.evidencia, proposto.pagina);
    if (r.veredito === "ancorada") {
      melhor = r;
      arquivo = memoria.fileName;
      break;
    }
    if (r.veredito !== "nao_encontrada" && melhor.veredito === "nao_encontrada") {
      melhor = r;
      arquivo = memoria.fileName;
    }
  }

  if (melhor.veredito === "sem_transcricao") {
    return {
      ok: false,
      mensagem:
        "A evidência não traz transcrição conferível. Cite entre aspas um trecho LITERAL " +
        "do memorial, com pelo menos 12 caracteres, exatamente como aparece na página.",
    };
  }
  if (melhor.veredito === "outra_pagina") {
    return {
      ok: false,
      mensagem:
        `O trecho existe no documento, mas NÃO na página ${proposto.pagina} — está em outra página. ` +
        "Use `buscar_no_memorial` com esse trecho para descobrir a página certa e registre de novo.",
    };
  }
  if (melhor.veredito !== "ancorada") {
    return {
      ok: false,
      mensagem:
        "O trecho citado não foi encontrado em nenhuma página do documento. " +
        "Não aproxime nem parafraseie: transcreva literalmente do que `ler_paginas` devolveu.",
    };
  }

  const achados = ctx.report.incongruencias ?? [];
  const candidato: AuditFinding = {
    id: `INC-${String(achados.length + 1).padStart(3, "0")}`,
    arquivo,
    prioridade: proposto.prioridade,
    pagina: String(proposto.pagina),
    capitulo: proposto.capitulo ?? capituloDaPagina(ctx, paginas[0]),
    local: proposto.local ?? "",
    tipo: proposto.tipo,
    descricao: proposto.descricao,
    evidencia: proposto.evidencia,
    conflito: proposto.conflito,
    sugestao_correcao: proposto.sugestao_correcao,
    // Nasceu de IA e não foi rebaixado pela validação — mesma régua do achado
    // de IA que a trava aprovou.
    confianca: "media",
    origem: "chat",
    impacto: proposto.impacto,
  };

  /*
   * A IMPRESSÃO DIGITAL fecha o portão contra o defeito mais provável: o modelo
   * "descobrindo" na conversa um achado que ele acabou de ler no próprio
   * parecer. Duplicata no parecer é pior que achado a menos — o engenheiro
   * trabalha duas vezes a mesma linha e desconfia da contagem.
   */
  const digital = impressaoDoAchado(candidato);
  const jaExiste = achados.find((f) => impressaoDoAchado(f) === digital);
  if (jaExiste) {
    return {
      ok: false,
      mensagem:
        `Este defeito já está no parecer como ${jaExiste.id} ("${jaExiste.tipo}"). ` +
        "Se a sua leitura for diferente da dele, diga isso na resposta em vez de registrar de novo.",
    };
  }

  return {
    ok: true,
    achado: candidato,
    mensagem: `Achado registrado como ${candidato.id}, com a evidência conferida na página ${candidato.pagina}.`,
  };
}

/** O capítulo em vigor na página, tirado do índice guardado. */
function capituloDaPagina(ctx: ContextoDoChat, pagina: number | undefined): string {
  if (pagina === undefined) return "";
  for (const m of ctx.memorias) {
    const c = m.capitulos.find((cap) => pagina >= cap.startPage && pagina <= cap.endPage);
    if (c) return c.title;
  }
  return "";
}

/**
 * O parecer COM o achado novo. Devolve cópia: quem grava decide quando trocar,
 * e mutar o objeto que a tela está desenhando é como se perde o parecer.
 */
export function aplicarAchadoNoParecer(report: AuditReport, achado: AuditFinding): AuditReport {
  const incongruencias = [...(report.incongruencias ?? []), achado];
  return {
    ...report,
    incongruencias,
    total_incongruencias: incongruencias.length,
  };
}

export const FERRAMENTA_REGISTRAR: FunctionTool = {
  type: "function",
  name: "registrar_achado",
  description:
    "Grava no parecer um problema REAL que você encontrou e que não estava lá. " +
    "A evidência é conferida contra o texto do memorial: se o trecho não existir na página " +
    "informada, a gravação é recusada e você recebe o motivo para corrigir. " +
    "Só use depois de ter lido o trecho com `ler_paginas` ou `buscar_no_memorial`.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      pagina: { type: "string", description: "A página onde o problema está. Ex.: \"41\" ou \"41-42\"." },
      tipo: { type: "string", description: "O defeito, em poucas palavras." },
      descricao: { type: "string", description: "O que está errado e por quê." },
      evidencia: {
        type: "string",
        description:
          "O trecho LITERAL do memorial entre aspas, como aparece na página. Mínimo 12 caracteres.",
      },
      conflito: { type: "string", description: "Contra o que isso conflita (norma, prancha, outro trecho)." },
      sugestao_correcao: { type: "string", description: "O que o engenheiro deve fazer." },
      prioridade: {
        type: "string",
        enum: ["Alta", "Media/Alta", "Media", "Baixa/Media", "Baixa"],
      },
      impacto: {
        type: "string",
        enum: ["critico_documental", "tecnico_contratual", "revisao_editorial"],
        description:
          "A régua do escritório: erro documental crítico, ponto técnico/contratual ou revisão editorial.",
      },
      capitulo: { type: "string", description: "Opcional: sai do índice se você não informar." },
      local: { type: "string", description: "Opcional: o ambiente ou item afetado." },
    },
    required: [
      "pagina",
      "tipo",
      "descricao",
      "evidencia",
      "conflito",
      "sugestao_correcao",
      "prioridade",
      "impacto",
    ],
  },
};
```

- [ ] **Passo 5: rode o teste e confirme que passa**

```
node scripts/test-chat-ferramentas.ts
```
Esperado: `19 teste(s) de ferramentas do chat OK`.

- [ ] **Passo 6: prove que os consumidores de `origem` não regrediram**

```
npm run test:severidade && npm run test:audit:reuso && npm run test:impressao-achado && npx tsc --noEmit
```
Esperado: todos verdes e `tsc` sem erro. Se algum acusar `origem`, o ramo que
falhou testava `=== "ia"` em vez de `=== "regra"` — pare e reporte, porque a
premissa da spec estaria errada.

- [ ] **Passo 7: commit**

```bash
git add lib/audit-report.ts server/audit/chat/ferramentas.ts scripts/test-chat-ferramentas.ts
git diff --cached --stat
git commit -m "achado do chat: entra no parecer, mas so depois de a evidencia ancorar"
```

---

## Tarefa 5: o contexto do acervo

*"Esse mesmo erro foi apontado na revisão anterior e continua aqui"* é o tipo de
frase que só existe com acervo — e é exatamente a munição do advogado do diabo.
Uma consulta Prisma por `projectId` mais os aprendizados ativos. Barata, por
isso fica nesta tarefa em vez de virar sub-projeto.

**Arquivos:**
- Criar: `server/audit/chat/historico.ts`
- Criar: `scripts/test-chat-historico.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: `getPrisma`, `isDatabaseConfigured` de `lib/db.ts`;
  `listAuditLearnings` de `lib/audit-learnings.ts`.
- Produz, e a Tarefa 6 depende destes nomes exatos:

```ts
export type ParecerAnterior = {
  auditId: string;
  quando: string;
  veredito: string;
  totalAchados: number;
  criticos: number;
  arquivo: string;
};
export type Acervo = {
  anteriores: ParecerAnterior[];
  aprendizados: { title: string; content: string }[];
};

/** Puro: a redação da resposta da ferramenta. Testável sem banco. */
export function redigirHistorico(acervo: Acervo): string;

/** Com banco: busca os pareceres anteriores da MESMA obra e os aprendizados. */
export async function historicoDaObra(args: {
  auditId: string;
  projectId?: string | null;
}): Promise<string>;

export const FERRAMENTA_HISTORICO: FunctionTool;
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-chat-historico.ts`:

```ts
/**
 * O ACERVO VIRA FRASE ÚTIL — OU DIZ QUE NÃO TEM NADA.
 *
 * A parte que fala com o banco é fina de propósito; o que decide o TEXTO que o
 * modelo recebe é puro, e é o que se testa aqui.
 *
 *   node scripts/test-chat-historico.ts  (== npm run test:chat:historico)
 */
import assert from "node:assert/strict";

import { redigirHistorico } from "../server/audit/chat/historico.ts";

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

test("sem obra e sem parecer anterior, diz que nao ha historico", () => {
  const saida = redigirHistorico({ anteriores: [], aprendizados: [] });
  assert.ok(/n[aã]o h[aá]|primeira/i.test(saida), saida);
  // Não pode inventar um histórico vazio que pareça histórico.
  assert.ok(!/revis[aã]o anterior apontou/i.test(saida), saida);
});

test("lista os pareceres anteriores do mais novo para o mais velho", () => {
  const saida = redigirHistorico({
    anteriores: [
      { auditId: "b", quando: "2026-08-20", veredito: "Reprovado", totalAchados: 12, criticos: 3, arquivo: "m_b.pdf" },
      { auditId: "a", quando: "2026-06-02", veredito: "Aprovado com ressalvas", totalAchados: 27, criticos: 5, arquivo: "m_a.pdf" },
    ],
    aprendizados: [],
  });
  assert.ok(saida.indexOf("2026-08-20") < saida.indexOf("2026-06-02"), saida);
  assert.ok(/12/.test(saida) && /27/.test(saida), saida);
  assert.ok(/Reprovado/.test(saida), saida);
});

test("os aprendizados ativos entram nomeados", () => {
  const saida = redigirHistorico({
    anteriores: [],
    aprendizados: [{ title: "Cláusula 3 do template", content: "Gera 11 achados em todo projeto." }],
  });
  assert.ok(/Cl[aá]usula 3/.test(saida), saida);
  assert.ok(/11 achados/.test(saida), saida);
});

test("nao promete comparacao que a ferramenta nao faz", () => {
  // A ferramenta entrega FATOS do acervo. Dizer "este achado se repete" é
  // conclusão do modelo, e ele precisa ler os dois pareceres para afirmar.
  const saida = redigirHistorico({
    anteriores: [
      { auditId: "a", quando: "2026-06-02", veredito: "Reprovado", totalAchados: 27, criticos: 5, arquivo: "m.pdf" },
    ],
    aprendizados: [],
  });
  assert.ok(!/se repete|continua aqui/i.test(saida), saida);
});

console.log(`\n${passed} teste(s) de historico da obra OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-chat-historico.ts
```
Esperado: `ERR_MODULE_NOT_FOUND` em `server/audit/chat/historico.ts`.

- [ ] **Passo 3: escreva `server/audit/chat/historico.ts`**

```ts
/**
 * O QUE JÁ SE SABE DESTA OBRA.
 *
 * Sem acervo, o chat só consegue falar do documento que está na frente dele — e
 * "esse mesmo erro foi apontado na revisão anterior e continua aqui" é
 * justamente a frase que o engenheiro precisa ouvir e que nenhuma leitura de
 * página sozinha produz.
 *
 * A ferramenta entrega FATOS: quais pareceres existem, quando, com que veredito
 * e quantos achados. Concluir que um defeito se repete é trabalho do modelo, e
 * ele tem `ler_achado` e `buscar_no_memorial` para sustentar a conclusão.
 */
import type { FunctionTool } from "openai/resources/responses/responses";

import { listAuditLearnings } from "@/lib/audit-learnings";
import type { AuditReport } from "@/lib/audit-report";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";

export type ParecerAnterior = {
  auditId: string;
  quando: string;
  veredito: string;
  totalAchados: number;
  criticos: number;
  arquivo: string;
};

export type Acervo = {
  anteriores: ParecerAnterior[];
  aprendizados: { title: string; content: string }[];
};

export function redigirHistorico(acervo: Acervo): string {
  const partes: string[] = [];

  if (acervo.anteriores.length === 0) {
    partes.push("Não há parecer anterior desta obra no acervo: esta é a primeira auditoria registrada.");
  } else {
    partes.push(`Pareceres anteriores desta obra (${acervo.anteriores.length}), do mais recente ao mais antigo:`);
    for (const p of acervo.anteriores) {
      partes.push(
        `  ${p.quando} · ${p.arquivo} · ${p.veredito} · ${p.totalAchados} achado(s), ${p.criticos} crítico(s) · id ${p.auditId}`,
      );
    }
  }

  if (acervo.aprendizados.length > 0) {
    partes.push("");
    partes.push("Aprendizados ativos do escritório:");
    for (const a of acervo.aprendizados) {
      partes.push(`  ${a.title}: ${a.content}`);
    }
  }

  return partes.join("\n");
}

/** Quantos achados de prioridade Alta o parecer gravado tinha. */
function criticosDe(report: unknown): number {
  const achados = (report as AuditReport | null)?.incongruencias ?? [];
  return achados.filter((f) => f.prioridade === "Alta").length;
}

export async function historicoDaObra(args: {
  auditId: string;
  projectId?: string | null;
}): Promise<string> {
  const aprendizados = await listAuditLearnings({ activeOnly: true })
    .then((lista) => lista.map((a) => ({ title: a.title, content: a.content })))
    .catch(() => []);

  /*
   * SEM OBRA não há acervo a consultar, e isso não é falha: auditoria avulsa
   * existe. Os aprendizados do escritório continuam valendo, e vão junto.
   */
  if (!args.projectId || !isDatabaseConfigured()) {
    return redigirHistorico({ anteriores: [], aprendizados });
  }

  try {
    const prisma = getPrisma();
    const linhas = await prisma.audit.findMany({
      where: {
        projectId: args.projectId,
        status: "COMPLETED",
        id: { not: args.auditId },
      },
      orderBy: { completedAt: "desc" },
      // Dez basta: o acervo serve de contexto, não de segunda leitura. Sem teto,
      // uma obra com trinta revisões encheria o turno de tabela.
      take: 10,
      select: {
        id: true,
        completedAt: true,
        createdAt: true,
        result: true,
        report: true,
        totalFindings: true,
        files: { select: { fileName: true }, take: 1 },
      },
    });

    const anteriores: ParecerAnterior[] = linhas.map((linha) => ({
      auditId: linha.id,
      quando: (linha.completedAt ?? linha.createdAt).toISOString().slice(0, 10),
      veredito: (linha.report as AuditReport | null)?.status_geral ?? "sem veredito registrado",
      totalAchados: linha.totalFindings,
      criticos: criticosDe(linha.report),
      arquivo: linha.files[0]?.fileName ?? "arquivo não registrado",
    }));

    return redigirHistorico({ anteriores, aprendizados });
  } catch (error) {
    console.error("[audit-chat] falha ao consultar o histórico da obra", error);
    return redigirHistorico({ anteriores: [], aprendizados });
  }
}

export const FERRAMENTA_HISTORICO: FunctionTool = {
  type: "function",
  name: "historico_da_obra",
  description:
    "Os pareceres anteriores desta MESMA obra (data, veredito, nº de achados e de críticos) " +
    "e os aprendizados ativos do escritório. Use para saber se um defeito já foi apontado antes.",
  strict: false,
  parameters: { type: "object", properties: {}, required: [] },
};
```

- [ ] **Passo 4: rode o teste e confirme que passa**

```
node scripts/test-chat-historico.ts && npx tsc --noEmit
```
Esperado: `4 teste(s) de historico da obra OK` e `tsc` sem erro.

Se `tsc` acusar `status_geral` ausente em `AuditReport`, confira o nome do campo
em `lib/audit-report.ts` — `PalcoDoNexo.tsx:1036` o usa como
`resultado.report.status_geral`, então ele existe; o erro seria de import.

- [ ] **Passo 5: registre o teste no `package.json`**

```json
"test:chat:historico": "node scripts/test-chat-historico.ts",
```

- [ ] **Passo 6: commit**

```bash
git add server/audit/chat/historico.ts scripts/test-chat-historico.ts package.json
git diff --cached --stat
git commit -m "acervo: o chat passa a saber o que ja foi apontado nesta obra"
```

---

## Tarefa 6: o laço de ferramentas e a postura

O cérebro, isolado da rota — a mesma separação que `server/nexo/agent/` já usa,
e pelo mesmo motivo: a rota é fina e trocável, o laço é testável sem servidor.

**Por que ferramentas, e não as alternativas** (a decisão está na spec e vale
repetir aqui, porque é o que o executor vai ser tentado a "simplificar"):

- **Contexto cheio** — o `063_26_md_geral_a.pdf` tem 73 páginas e 173k chars
  (≈43k tokens) e entraria em TODA pergunta. O cache de prefixo já foi medido e
  não rende aqui. Pior: com 73 páginas coladas, o modelo erra o número da página.
- **RAG leve** (uma busca por turno) — o advogado do diabo precisa **navegar**:
  "e na página seguinte?", "onde mais aparece essa cota?". Uma busca única não
  navega; ele responde com o que a primeira busca trouxe e cala sobre o resto.

**Decisão de streaming, tomada aqui:** o laço **não** transmite token a token.
Não dá para saber que uma volta é a última antes de ela voltar sem chamada de
ferramenta, e transmitir a última exigiria uma chamada extra ao modelo — pagar
de novo pelo mesmo texto. O que viaja em tempo real é o PROGRESSO: um evento por
ferramenta executada ("lendo páginas 41-44"), e o texto final numa parcela só. O
cliente já entende `delta` e `done`; ganha um terceiro tipo.

**Arquivos:**
- Criar: `server/audit/chat/prompt.ts`
- Criar: `server/audit/chat/run-chat-turn.ts`
- Criar: `scripts/test-chat-laco.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: tudo das Tarefas 3, 4 e 5.
- Produz, e as tarefas 7 e 8 dependem destes nomes exatos:

```ts
// prompt.ts
export function instrucoesDoAdvogado(args: { temMemoria: boolean }): string;
export function primeiraEntrada(args: {
  pergunta: string;
  historico: { role: "user" | "assistant"; content: string }[];
  report: AuditReport;
}): string;

// run-chat-turn.ts
export type ItemDeSaida = { type?: string; call_id?: string; name?: string; arguments?: string };
export type ExecutorDoModelo = (args: {
  input: unknown[];
  tools: FunctionTool[];
  volta: number;
  ultimaVolta: boolean;
}) => Promise<{ text: string; output: ItemDeSaida[] }>;

export type EventoDoChat =
  | { type: "ferramenta"; nome: string; resumo: string }
  | { type: "delta"; text: string }
  | { type: "achado"; achado: AuditFinding }
  | { type: "proposta"; turno: unknown }
  | { type: "done"; voltas: number; parouPorTeto: boolean };

export function tetoDeVoltas(): number;

export async function* runChatTurn(args: {
  ctx: ContextoDoChat;
  pergunta: string;
  historico: { role: "user" | "assistant"; content: string }[];
  executar: ExecutorDoModelo;
  aoRegistrar?: (achado: AuditFinding) => Promise<void> | void;
  encaminhar?: (pedido: string) => Promise<unknown>;
  historicoDaObra?: () => Promise<string>;
}): AsyncGenerator<EventoDoChat>;
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-chat-laco.ts`:

```ts
/**
 * O LAÇO DESPACHA, PARA NO TETO, E NUNCA SILENCIA.
 *
 * O executor do modelo é injetado: nenhum token é gasto aqui.
 *
 *   node scripts/test-chat-laco.ts  (== npm run test:chat:laco)
 */
import assert from "node:assert/strict";

import { montarContexto } from "../server/audit/chat/ferramentas.ts";
import { runChatTurn, tetoDeVoltas } from "../server/audit/chat/run-chat-turn.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
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

const memoria = {
  fileName: "m.pdf",
  paginas: [
    { page: 40, text: "1 - PAREDES\nAlvenaria em bloco ceramico de vedacao." },
    { page: 41, text: "Chapisco com argamassa de cimento e areia no traco 1:3." },
  ],
  capitulos: [{ id: "chunk-1", title: "1 - PAREDES", startPage: 40, endPage: 41, chars: 100 }],
  charCount: 100,
};

const report = {
  arquivo: "m.pdf",
  tipo_auditoria: "memorial",
  tipo_documento: "Memorial descritivo",
  status_geral: "Reprovado",
  total_incongruencias: 0,
  incongruencias: [],
} as never;

const ctx = montarContexto(report, [memoria]);

/** Um executor roteirizado: devolve, em ordem, as saídas que o roteiro manda. */
function roteiro(passos: { text: string; output: unknown[] }[]) {
  const vistas: { input: unknown[]; ultimaVolta: boolean }[] = [];
  let i = 0;
  const executar = async (args: never) => {
    vistas.push({ input: (args as never as { input: unknown[] }).input, ultimaVolta: (args as never as { ultimaVolta: boolean }).ultimaVolta });
    const passo = passos[Math.min(i, passos.length - 1)];
    i += 1;
    return passo as never;
  };
  return { executar, vistas, chamadas: () => i };
}

const chamada = (call_id: string, name: string, args: Record<string, unknown>) => ({
  type: "function_call",
  call_id,
  name,
  arguments: JSON.stringify(args),
});

async function colher(gen: AsyncGenerator<{ type: string; [k: string]: unknown }>) {
  const eventos: { type: string; [k: string]: unknown }[] = [];
  for await (const e of gen) eventos.push(e);
  return eventos;
}

await test("resposta sem ferramenta sai em uma volta so", async () => {
  const r = roteiro([{ text: "O parecer reprova por 3 achados críticos.", output: [] }]);
  const eventos = await colher(
    runChatTurn({ ctx, pergunta: "resuma", historico: [], executar: r.executar as never }),
  );
  assert.equal(r.chamadas(), 1);
  const delta = eventos.find((e) => e.type === "delta");
  assert.ok(String(delta?.text).includes("3 achados"));
  const done = eventos.find((e) => e.type === "done");
  assert.equal(done?.voltas, 1);
  assert.equal(done?.parouPorTeto, false);
});

await test("uma chamada de ferramenta vira evento e realimenta o modelo", async () => {
  const r = roteiro([
    { text: "", output: [chamada("c1", "buscar_no_memorial", { termo: "chapisco" })] },
    { text: "Está na página 41.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({ ctx, pergunta: "onde fala de chapisco?", historico: [], executar: r.executar as never }),
  );
  const ferramenta = eventos.find((e) => e.type === "ferramenta");
  assert.equal(ferramenta?.nome, "buscar_no_memorial");
  assert.equal(r.chamadas(), 2);
  // A segunda volta viu o resultado da ferramenta.
  const segundaEntrada = JSON.stringify(r.vistas[1].input);
  assert.ok(segundaEntrada.includes("function_call_output"), segundaEntrada.slice(0, 300));
  assert.ok(segundaEntrada.includes("41"), "o resultado da busca nao voltou pro modelo");
});

await test("ferramenta desconhecida nao derruba o turno: devolve erro ao modelo", async () => {
  const r = roteiro([
    { text: "", output: [chamada("c1", "ferramenta_que_nao_existe", {})] },
    { text: "Corrigido.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({ ctx, pergunta: "x", historico: [], executar: r.executar as never }),
  );
  assert.ok(eventos.some((e) => e.type === "done"));
  assert.ok(JSON.stringify(r.vistas[1].input).match(/n[aã]o existe|desconhecid/i));
});

await test("argumento invalido (JSON quebrado) volta como erro, nao como excecao", async () => {
  const r = roteiro([
    { text: "", output: [{ type: "function_call", call_id: "c1", name: "ler_paginas", arguments: "{nao e json" }] },
    { text: "Ok.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({ ctx, pergunta: "x", historico: [], executar: r.executar as never }),
  );
  assert.ok(eventos.some((e) => e.type === "done"));
});

await test("o laco PARA no teto e DIZ que parou", async () => {
  // Um roteiro que nunca para de pedir ferramenta.
  const r = roteiro([{ text: "", output: [chamada("c1", "listar_capitulos", {})] }]);
  const eventos = await colher(
    runChatTurn({ ctx, pergunta: "x", historico: [], executar: r.executar as never }),
  );
  const done = eventos.find((e) => e.type === "done");
  assert.equal(done?.parouPorTeto, true);
  assert.equal(done?.voltas, tetoDeVoltas());
  // A última chamada foi avisada de que era a última: sem isso o modelo pediria
  // ferramenta de novo e o usuário ficaria sem resposta nenhuma.
  assert.equal(r.vistas.at(-1)?.ultimaVolta, true);
  assert.ok(eventos.some((e) => e.type === "delta"), "estourou o teto e nao respondeu nada");
});

await test("registrar_achado aceito emite o achado e avisa quem grava", async () => {
  const gravados: unknown[] = [];
  const r = roteiro([
    {
      text: "",
      output: [
        chamada("c1", "registrar_achado", {
          pagina: "41",
          tipo: "Traço divergente",
          descricao: "O traço não bate com a norma.",
          evidencia: 'Página 41: "argamassa de cimento e areia no traco 1:3"',
          conflito: "A norma exige 1:4.",
          sugestao_correcao: "Uniformizar o traço.",
          prioridade: "Media",
          impacto: "tecnico_contratual",
        }),
      ],
    },
    { text: "Registrei como INC-001.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({
      ctx,
      pergunta: "achou algo?",
      historico: [],
      executar: r.executar as never,
      aoRegistrar: (a) => { gravados.push(a); },
    }),
  );
  const achado = eventos.find((e) => e.type === "achado");
  assert.ok(achado, "nao emitiu o achado para o cliente");
  assert.equal(gravados.length, 1);
});

await test("registrar_achado com evidencia inventada NAO grava e ensina o modelo", async () => {
  const gravados: unknown[] = [];
  const r = roteiro([
    {
      text: "",
      output: [
        chamada("c1", "registrar_achado", {
          pagina: "41",
          tipo: "Defeito imaginario",
          descricao: "x",
          evidencia: 'Página 41: "manta asfaltica de quatro milimetros"',
          conflito: "y",
          sugestao_correcao: "z",
          prioridade: "Alta",
          impacto: "critico_documental",
        }),
      ],
    },
    { text: "Não consegui sustentar; retiro.", output: [] },
  ]);
  const eventos = await colher(
    runChatTurn({
      ctx,
      pergunta: "achou algo?",
      historico: [],
      executar: r.executar as never,
      aoRegistrar: (a) => { gravados.push(a); },
    }),
  );
  assert.equal(gravados.length, 0, "gravou achado com evidencia inventada");
  assert.ok(!eventos.some((e) => e.type === "achado"));
  assert.ok(JSON.stringify(r.vistas[1].input).match(/n[aã]o foi encontrad|n[aã]o existe/i));
});

await test("sem memoria do documento, o turno avisa e ainda responde", async () => {
  const semTexto = montarContexto(report, []);
  const r = roteiro([{ text: "Não tenho o documento desta auditoria.", output: [] }]);
  const eventos = await colher(
    runChatTurn({ ctx: semTexto, pergunta: "leia a pagina 41", historico: [], executar: r.executar as never }),
  );
  // A instrução do modo degradado tem de chegar ao modelo na PRIMEIRA volta.
  assert.ok(JSON.stringify(r.vistas[0].input).match(/n[aã]o (tem|h[aá])|reaudit/i));
  assert.ok(eventos.some((e) => e.type === "delta"));
});

console.log(`\n${passed} teste(s) do laco do chat OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-chat-laco.ts
```
Esperado: `ERR_MODULE_NOT_FOUND` em `server/audit/chat/run-chat-turn.ts`.

- [ ] **Passo 3: escreva `server/audit/chat/prompt.ts`**

```ts
/**
 * A POSTURA. O chefe foi explícito: "seja o advogado do diabo".
 *
 * As regras abaixo não são enfeite de prompt — cada uma existe contra um
 * comportamento observado. A que mais importa é a terceira: sem ela o modelo
 * responde com a página que ele ACHA que é, e uma página errada num parecer
 * destrói a confiança nas outras 56 linhas, porque nenhuma pode mais ser lida
 * sem conferência.
 */
import type { AuditReport } from "@/lib/audit-report";

export function instrucoesDoAdvogado(args: { temMemoria: boolean }): string {
  const base = `
Você é o auditor sênior do NexoDoc conversando com o engenheiro DEPOIS que o
parecer ficou pronto. O documento auditado está ao seu alcance por ferramentas.

Sua função é dupla: responder qualquer pergunta sobre o memorial, e ENCONTRAR o
erro que o motor deixou passar.

REGRAS:

1. Responda QUALQUER pergunta sobre o memorial. Se não souber, BUSQUE antes de
   dizer que não consta.
2. NUNCA concorde por educação. Se um achado do parecer não se sustenta na
   evidência, diga isso e mostre o trecho que o contradiz.
3. NUNCA afirme página ou trecho sem ter chamado uma ferramenta. Se a ferramenta
   não achou, diga que não achou — não aproxime, não parafraseie, não estime.
4. Ao encontrar um problema real que não está no parecer, registre-o com
   \`registrar_achado\`. A evidência é conferida contra o texto: se você inventar
   ou errar a página, a gravação é recusada e você recebe o motivo.
5. Distinga erro documental crítico, ponto técnico/contratual e revisão
   editorial — a régua do escritório, a mesma do motor.
6. Se o engenheiro pedir para GERAR algo (LD, capa, separatriz, volume, nova
   auditoria), chame \`encaminhar_para_geracao\` com o pedido dele. Você não gera
   documento.
7. Você NÃO decide que um achado existente é falso positivo. Se concluir isso,
   ARGUMENTE e deixe a decisão com o engenheiro — quem julga a auditoria é ele.
8. Escreva em português, direto e técnico, para um escritório de engenharia.
   Cite sempre a página de onde veio cada afirmação sobre o documento.
`.trim();

  if (args.temMemoria) return base;

  return `${base}

ATENÇÃO — MODO DEGRADADO: esta auditoria foi gravada ANTES de o texto do
memorial passar a ser guardado. Você NÃO tem o documento e não pode relê-lo.
Responda apenas com o que está no parecer, DIGA ao engenheiro que não tem o
documento desta auditoria, e sugira reauditar para habilitar a releitura. Nunca
finja ter lido.`;
}

/**
 * O parecer vai INTEIRO na primeira entrada, e o memorial não vai nenhum pedaço.
 *
 * É a assimetria que sustenta a arquitetura: o parecer tem dezenas de linhas e
 * cabe; o memorial tem 173k chars e é ele que a ferramenta busca sob demanda.
 */
export function primeiraEntrada(args: {
  pergunta: string;
  historico: { role: "user" | "assistant"; content: string }[];
  report: AuditReport;
}): string {
  const hist =
    args.historico
      .slice(-6)
      .map((t) => `${t.role}: ${t.content.slice(0, 1200)}`)
      .join("\n\n") || "(sem histórico)";

  return `
Parecer desta auditoria:
${JSON.stringify(args.report, null, 2)}

Histórico recente da conversa:
${hist}

Pergunta do engenheiro:
${args.pergunta}
`.trim();
}
```

- [ ] **Passo 4: escreva `server/audit/chat/run-chat-turn.ts`**

```ts
/**
 * O LAÇO DE FERRAMENTAS.
 *
 * A IA escolhe O QUE olhar; quem responde ONDE ESTÁ é o código. Cada volta é
 * uma chamada ao modelo, e cada chamada passa por `executeOpenAiResponse` — que
 * já cobra, telemetra e respeita o teto mensal. Nada aqui fala com a OpenAI
 * direto: o executor é injetado, e é por isso que este arquivo inteiro é
 * testável sem gastar um token.
 *
 * O teto de voltas não é otimização, é honestidade: um modelo que entra em
 * laço com `buscar_no_memorial` gastaria sem entregar nada, e o engenheiro
 * ficaria olhando para uma bolha vazia. Estourou, ele responde com o que juntou
 * e DIZ que parou por limite.
 */
import type { FunctionTool } from "openai/resources/responses/responses";

import type { AuditFinding } from "@/lib/audit-report";
import {
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTA_REGISTRAR,
  buscarNoMemorial,
  lerAchado,
  lerPaginas,
  listarCapitulos,
  registrarAchado,
  temMemoria,
  type AchadoProposto,
  type ContextoDoChat,
} from "./ferramentas";
import { FERRAMENTA_HISTORICO } from "./historico";
import { instrucoesDoAdvogado, primeiraEntrada } from "./prompt";

export type ItemDeSaida = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
};

export type ExecutorDoModelo = (args: {
  input: unknown[];
  tools: FunctionTool[];
  volta: number;
  /** Última volta permitida: as ferramentas saem de cena e ele TEM de responder. */
  ultimaVolta: boolean;
}) => Promise<{ text: string; output: ItemDeSaida[] }>;

export type EventoDoChat =
  | { type: "ferramenta"; nome: string; resumo: string }
  | { type: "delta"; text: string }
  | { type: "achado"; achado: AuditFinding }
  | { type: "proposta"; turno: unknown }
  | { type: "done"; voltas: number; parouPorTeto: boolean };

export const FERRAMENTA_ENCAMINHAR: FunctionTool = {
  type: "function",
  name: "encaminhar_para_geracao",
  description:
    "Entrega o turno ao Nexo quando o engenheiro pede para GERAR algo (LD, capa, separatriz, " +
    "volume, nova auditoria) em vez de perguntar sobre o parecer.",
  strict: false,
  parameters: {
    type: "object",
    properties: {
      pedido: { type: "string", description: "O pedido do engenheiro, com as palavras dele." },
    },
    required: ["pedido"],
  },
};

/**
 * Oito voltas por padrão. Configurável porque o número certo depende do
 * memorial: navegar um documento de 200 páginas custa mais idas do que um de 40.
 */
export function tetoDeVoltas(): number {
  const bruto = Number(process.env.NEXODOC_AUDIT_CHAT_MAX_TOOL_TURNS ?? 8);
  if (!Number.isFinite(bruto) || bruto < 1) return 8;
  return Math.min(Math.trunc(bruto), 20);
}

function resumoDaChamada(nome: string, args: Record<string, unknown>): string {
  switch (nome) {
    case "buscar_no_memorial":
      return `procurando "${String(args.termo ?? "").slice(0, 60)}"`;
    case "ler_paginas":
      return `lendo as páginas ${args.de}-${args.ate}`;
    case "ler_achado":
      return `revendo o achado ${args.id}`;
    case "listar_capitulos":
      return "abrindo o índice do memorial";
    case "historico_da_obra":
      return "consultando o histórico da obra";
    case "registrar_achado":
      return `registrando um achado na página ${args.pagina}`;
    case "encaminhar_para_geracao":
      return "passando o pedido ao Nexo";
    default:
      return nome;
  }
}

export async function* runChatTurn(args: {
  ctx: ContextoDoChat;
  pergunta: string;
  historico: { role: "user" | "assistant"; content: string }[];
  executar: ExecutorDoModelo;
  aoRegistrar?: (achado: AuditFinding) => Promise<void> | void;
  encaminhar?: (pedido: string) => Promise<unknown>;
  historicoDaObra?: () => Promise<string>;
}): AsyncGenerator<EventoDoChat> {
  const teto = tetoDeVoltas();
  const comMemoria = temMemoria(args.ctx);

  const ferramentas: FunctionTool[] = [
    ...FERRAMENTAS_DE_LEITURA,
    FERRAMENTA_REGISTRAR,
    ...(args.historicoDaObra ? [FERRAMENTA_HISTORICO] : []),
    ...(args.encaminhar ? [FERRAMENTA_ENCAMINHAR] : []),
  ];

  const input: unknown[] = [
    {
      role: "system",
      content: instrucoesDoAdvogado({ temMemoria: comMemoria }),
    },
    {
      role: "user",
      content: primeiraEntrada({
        pergunta: args.pergunta,
        historico: args.historico,
        report: args.ctx.report,
      }),
    },
  ];

  let volta = 0;

  while (volta < teto) {
    volta += 1;
    const ultimaVolta = volta === teto;

    const { text, output } = await args.executar({
      input: [...input],
      // Na última volta as ferramentas SAEM: deixá-las na mesa convida o modelo
      // a pedir mais uma, e aí o engenheiro fica sem resposta nenhuma.
      tools: ultimaVolta ? [] : ferramentas,
      volta,
      ultimaVolta,
    });

    const chamadas = (output ?? []).filter((item) => item?.type === "function_call");

    if (chamadas.length === 0) {
      if (text.trim()) yield { type: "delta", text: text.trim() };
      yield { type: "done", voltas: volta, parouPorTeto: false };
      return;
    }

    if (ultimaVolta) {
      // Pediu ferramenta na volta em que elas não existiam mais: responde com o
      // que tem e assume o limite, em vez de entregar silêncio.
      break;
    }

    // A saída do modelo volta VERBATIM para a entrada seguinte: é assim que a
    // Responses API amarra a chamada ao seu resultado (`call_id`).
    input.push(...(output as unknown[]));

    for (const chamada of chamadas) {
      const nome = chamada.name ?? "";
      let parsed: Record<string, unknown> = {};
      let resultado: string;

      try {
        parsed = chamada.arguments ? (JSON.parse(chamada.arguments) as Record<string, unknown>) : {};
      } catch {
        resultado = "Os argumentos não são JSON válido. Reformule a chamada.";
        input.push({ type: "function_call_output", call_id: chamada.call_id, output: resultado });
        continue;
      }

      yield { type: "ferramenta", nome, resumo: resumoDaChamada(nome, parsed) };

      switch (nome) {
        case "listar_capitulos":
          resultado = listarCapitulos(args.ctx);
          break;
        case "buscar_no_memorial":
          resultado = buscarNoMemorial(args.ctx, String(parsed.termo ?? ""));
          break;
        case "ler_paginas":
          resultado = lerPaginas(args.ctx, Number(parsed.de ?? 0), Number(parsed.ate ?? 0));
          break;
        case "ler_achado":
          resultado = lerAchado(args.ctx, String(parsed.id ?? ""));
          break;
        case "historico_da_obra":
          resultado = args.historicoDaObra
            ? await args.historicoDaObra()
            : "O histórico da obra não está disponível nesta instalação.";
          break;
        case "registrar_achado": {
          const r = registrarAchado(args.ctx, parsed as unknown as AchadoProposto);
          resultado = r.mensagem;
          if (r.ok) {
            /*
             * O contexto do turno passa a CONTER o achado novo: sem isto, dois
             * registros na mesma conversa nasceriam com o mesmo id e a
             * impressão digital não pegaria a duplicata do segundo.
             */
            args.ctx.report.incongruencias = [...(args.ctx.report.incongruencias ?? []), r.achado];
            args.ctx.report.total_incongruencias = args.ctx.report.incongruencias.length;
            await args.aoRegistrar?.(r.achado);
            yield { type: "achado", achado: r.achado };
          }
          break;
        }
        case "encaminhar_para_geracao": {
          if (!args.encaminhar) {
            resultado = "Encaminhamento indisponível nesta conversa. Responda você mesmo.";
            break;
          }
          const turno = await args.encaminhar(String(parsed.pedido ?? args.pergunta));
          yield { type: "proposta", turno };
          resultado =
            "Pedido entregue ao Nexo; a proposta já foi mostrada ao engenheiro. " +
            "Feche a resposta em uma frase, sem repetir a proposta.";
          break;
        }
        default:
          resultado = `A ferramenta "${nome}" não existe. As disponíveis são: ${ferramentas.map((f) => f.name).join(", ")}.`;
      }

      input.push({ type: "function_call_output", call_id: chamada.call_id, output: resultado });
    }
  }

  /*
   * Estourou o teto. Uma última ida ao modelo SEM ferramenta nenhuma, para ele
   * responder com o que juntou. Silenciar aqui seria o pior desfecho: o
   * engenheiro pagou por N voltas e não recebe frase nenhuma.
   */
  input.push({
    role: "user",
    content:
      `Você atingiu o limite de ${teto} consultas às ferramentas nesta pergunta. ` +
      "Responda AGORA com o que você já apurou, e diga em uma frase que parou por limite " +
      "e o que faltava investigar.",
  });

  const fecho = await args.executar({ input: [...input], tools: [], volta, ultimaVolta: true });
  const texto =
    fecho.text.trim() ||
    `Parei por limite de ${teto} consultas ao documento e não consegui fechar a resposta. Refaça a pergunta mais específica (por exemplo, apontando o capítulo ou a página).`;

  yield { type: "delta", text: texto };
  // Chegar aqui significa teto: o `while` só sai por ele.
  yield { type: "done", voltas: volta, parouPorTeto: true };
}
```

- [ ] **Passo 5: rode o teste e confirme que passa**

```
node scripts/test-chat-laco.ts
```
Esperado: `8 teste(s) do laco do chat OK`.

> Se o teste "o laco PARA no teto" falhar em `voltas`, confira o contrato: o
> `done` reporta a volta em que o laço saiu, e o fecho não conta como volta nova
> — ele é a mesma pergunta sendo respondida sem ferramenta.

- [ ] **Passo 6: registre o teste no `package.json`**

```json
"test:chat:laco": "node scripts/test-chat-laco.ts",
```

- [ ] **Passo 7: commit**

```bash
git add server/audit/chat/prompt.ts server/audit/chat/run-chat-turn.ts scripts/test-chat-laco.ts package.json
git diff --cached --stat
git commit -m "laco: o chat navega o memorial por ferramenta, e para de fingir que leu"
```

---

## Tarefa 7: a rota

`app/api/audit/chat/route.ts` é **reescrita**. A atual está morta desde que as
telas standalone foram aposentadas, e mesmo viva só enxergava o JSON compactado
do parecer — o prompt dela manda literalmente *"Não diga que releu o PDF"*.

Aproveitados como estão: o portão de sessão `requireActor`, o CORS
(`getAllowedOrigin`/`withCors`), a escolha de perfil de execução
(`getAuditExecutionProfile`) e a classificação de falha do provedor
(`classifyProviderFailure`).

> **DIVERGÊNCIA DELIBERADA DA SPEC — leia antes de implementar.**
> A spec manda `encaminhar_para_geracao` rodar `runNexoAgentTurn` **dentro da
> rota do chat**. Não é o que este plano faz, e o motivo é concreto:
> `runNexoAgentTurn` precisa de `resumo`, `prefeituras`, `escritorio`,
> `tomosSugeridos`, `dataDoSelo` e `decisoes`, e esse contexto é montado em 180
> linhas de `app/api/nexo/agent/route.ts:1-180` que o chat não tem. Duplicá-las
> criaria duas fontes para a mesma verdade — o defeito que a `dataDominante`
> compartilhada existe para evitar.
> **O que este plano faz:** a rota emite `{ type: "encaminhar", pedido }` e o
> CLIENTE reenvia o turno a `/api/nexo/agent` com o corpo que ele já monta hoje
> (Tarefa 8). Para o engenheiro o resultado é idêntico — o card de confirmação
> aparece igual. Se algum dia o contexto do Nexo for extraído para um módulo
> compartilhado, mover isto para o servidor é uma troca de duas linhas.

**Arquivos:**
- Modificar: `app/api/audit/chat/route.ts` (reescrita)
- Criar: `scripts/test-chat-rota.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: `runChatTurn`, `EventoDoChat` (Tarefa 6); `montarContexto` (Tarefa 3);
  `aplicarAchadoNoParecer` (Tarefa 4); `carregarMemoriaDoDocumento` (Tarefa 2);
  `historicoDaObra` (Tarefa 5); `executeOpenAiResponse` de `lib/ai-runner.ts`.
- Produz — **o contrato SSE que a Tarefa 8 consome**:

```ts
{ type: "ferramenta", nome: string, resumo: string }
{ type: "delta", text: string }
{ type: "achado", achado: AuditFinding, report: AuditReport }
{ type: "encaminhar", pedido: string }
{ type: "done", voltas: number, parouPorTeto: boolean }
{ type: "error", error: string }
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-chat-rota.ts`. Ele testa o que a rota DECIDE, sem subir
servidor: a serialização SSE e a gravação do parecer.

```ts
/**
 * O CONTRATO SSE DA ROTA, E A GRAVAÇÃO DO ACHADO NOVO.
 *
 * Sem servidor, sem banco e sem token: as duas funções puras que a rota usa.
 *
 *   node scripts/test-chat-rota.ts  (== npm run test:chat:rota)
 */
import assert from "node:assert/strict";

import { linhaSse, respostaDoModelo } from "../app/api/audit/chat/serializacao.ts";

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

test("cada evento vira UMA linha data:, terminada em linha em branco", () => {
  const linha = linhaSse({ type: "delta", text: "ok" });
  assert.ok(linha.startsWith("data: "));
  assert.ok(linha.endsWith("\n\n"));
  assert.equal(linha.split("\n\n").length, 2);
});

test("quebra de linha no texto NAO parte o evento SSE", () => {
  // Um delta com "\n\n" dentro partiria o evento em dois e o cliente leria
  // metade da frase como um evento sem `type`.
  const linha = linhaSse({ type: "delta", text: "primeira\n\nsegunda" });
  const corpo = linha.slice("data: ".length, -2);
  assert.deepEqual(JSON.parse(corpo).text, "primeira\n\nsegunda");
  assert.equal(linha.split("\n\n").length, 2);
});

test("respostaDoModelo colhe as function_call da saida da Responses API", () => {
  const r = respostaDoModelo({
    text: "",
    response: {
      output: [
        { type: "reasoning", id: "r1" },
        { type: "function_call", call_id: "c1", name: "ler_paginas", arguments: '{"de":1,"ate":2}' },
      ],
    },
  } as never);
  assert.equal(r.output.length, 2);
  assert.equal(r.output.filter((i) => i.type === "function_call").length, 1);
  assert.equal(r.text, "");
});

test("respostaDoModelo cai no output_text quando o runner nao trouxe texto", () => {
  const r = respostaDoModelo({
    text: "",
    response: { output_text: "resposta final", output: [] },
  } as never);
  assert.equal(r.text, "resposta final");
});

console.log(`\n${passed} teste(s) da rota do chat OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-chat-rota.ts
```
Esperado: `ERR_MODULE_NOT_FOUND` em `app/api/audit/chat/serializacao.ts`.

- [ ] **Passo 3: crie `app/api/audit/chat/serializacao.ts`**

```ts
/**
 * As duas decisões da rota que dão para testar sem subir servidor.
 *
 * Ficam fora do `route.ts` porque o Next só exporta handlers de lá — qualquer
 * export a mais vira erro de build, e sem elas aqui o contrato SSE só seria
 * conferido no navegador, tarde demais.
 */
import type { ItemDeSaida } from "@/server/audit/chat/run-chat-turn";

/** Um evento SSE. `JSON.stringify` escapa a quebra de linha; é o que impede o corte. */
export function linhaSse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * O que o laço precisa da resposta do runner.
 *
 * `text` vem vazio quando a volta só trouxe chamada de ferramenta — e isso NÃO
 * é erro: `extractOutputText` só lança em resposta incompleta ou recusada.
 */
export function respostaDoModelo(ai: { text: string; response: unknown }): {
  text: string;
  output: ItemDeSaida[];
} {
  const bruto = ai.response as { output?: ItemDeSaida[]; output_text?: string };
  return {
    text: ai.text || (bruto.output_text ?? "").trim(),
    output: bruto.output ?? [],
  };
}
```

- [ ] **Passo 4: rode o teste e confirme que passa**

```
node scripts/test-chat-rota.ts
```
Esperado: `4 teste(s) da rota do chat OK`.

- [ ] **Passo 5: reescreva `app/api/audit/chat/route.ts`**

Mantenha intactas, copiando do arquivo atual, as funções `getAllowedOrigin`,
`withCors`, `jsonError` e `getReasoningEffort` (linhas 26-101). Troque todo o
resto por:

```ts
import { NextResponse } from "next/server";

import { accessDeniedResponse, requireActor } from "@/lib/access-control";
import {
  classifyProviderFailure,
  getAiConfiguration,
  getAuditExecutionProfile,
  type AiProvider,
} from "@/lib/ai-providers";
import { refreshAiModelOverrideCache } from "@/lib/ai-model-config";
import { executeOpenAiResponse, getProviderFailureStatus } from "@/lib/ai-runner";
import type { AuditReport } from "@/lib/audit-report";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { carregarMemoriaDoDocumento } from "@/lib/memoria-do-documento";
import { aplicarAchadoNoParecer, montarContexto } from "@/server/audit/chat/ferramentas";
import { historicoDaObra } from "@/server/audit/chat/historico";
import { runChatTurn } from "@/server/audit/chat/run-chat-turn";
import { linhaSse, respostaDoModelo } from "./serializacao";

export const runtime = "nodejs";

// … getAllowedOrigin / withCors / jsonError / getReasoningEffort inalteradas …

export function OPTIONS(request: Request) {
  return withCors(new NextResponse(null, { status: 204 }), request);
}

/**
 * O achado nascido na conversa é gravado no `Audit.report`.
 *
 * Best-effort de propósito: o cliente também funde o achado no IndexedDB (o
 * parecer persiste em dois lugares), então falhar aqui não faz o engenheiro
 * perder o achado da tela — mas o log tem de existir, porque sem banco o achado
 * some no próximo F5 e ninguém saberia por quê.
 */
async function gravarAchadoNoParecer(auditId: string, report: AuditReport) {
  if (!isDatabaseConfigured()) return;
  try {
    const prisma = getPrisma();
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        report: report as never,
        totalFindings: report.total_incongruencias,
      },
    });
  } catch (error) {
    console.error("[audit-chat] falha ao gravar o achado nascido no chat", error);
  }
}

export async function POST(request: Request) {
  try {
    await requireActor();
  } catch (err) {
    const negado = accessDeniedResponse(err);
    if (negado) return negado;
    throw err;
  }

  let executionProfile: { provider: AiProvider; model: string } = getAiConfiguration().auditChat;

  let body: {
    question?: string;
    report?: AuditReport;
    history?: { role: "user" | "assistant"; content: string }[];
    auditId?: string;
    projectId?: string | null;
  };

  try {
    await refreshAiModelOverrideCache();
    body = await request.json();
  } catch {
    return jsonError("Corpo da requisição inválido.", 400, request);
  }

  const question = String(body.question ?? "").trim();
  if (!question) {
    return jsonError("Informe uma pergunta sobre a auditoria.", 400, request);
  }
  if (!body.report || !Array.isArray(body.report.incongruencias)) {
    return jsonError("Relatório da auditoria não informado.", 400, request);
  }

  const auditId = String(body.auditId ?? "");
  const history = Array.isArray(body.history)
    ? body.history.filter((t) => t.role === "user" || t.role === "assistant").slice(-6)
    : [];

  const analysisLevel = body.report.runtime?.nivel_analise === "deep" ? "deep" : "standard";
  if (body.report.tipo_auditoria !== "volume") {
    executionProfile = getAuditExecutionProfile({ auditMode: "memorial", analysisLevel });
  }
  const model = executionProfile.model;

  /*
   * O texto guardado. Vetor vazio = parecer antigo: o laço entra em modo
   * degradado e o modelo é instruído a DIZER que não tem o documento.
   */
  const memorias = auditId ? await carregarMemoriaDoDocumento(auditId) : [];
  // Cópia do parecer: o laço acrescenta o achado novo ao contexto do turno, e
  // mutar o objeto que veio do cliente confunde quem grava.
  const ctx = montarContexto({ ...body.report }, memorias);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(linhaSse(payload)));
      try {
        for await (const evento of runChatTurn({
          ctx,
          pergunta: question,
          historico: history,
          historicoDaObra: () => historicoDaObra({ auditId, projectId: body.projectId ?? null }),
          // O encaminhamento é do CLIENTE (ver a divergência anotada no plano):
          // a rota só avisa que o turno é de geração.
          encaminhar: async (pedido) => {
            send({ type: "encaminhar", pedido });
            return null;
          },
          aoRegistrar: async (achado) => {
            const atualizado = aplicarAchadoNoParecer(body.report!, achado);
            body.report = atualizado;
            if (auditId) await gravarAchadoNoParecer(auditId, atualizado);
          },
          executar: async ({ input, tools, volta }) => {
            const ai = await executeOpenAiResponse({
              flow: "audit-chat",
              providerOverride: executionProfile.provider,
              taskId: auditId || undefined,
              taskLabel: body.report?.obra || body.report?.arquivo || "Pós-auditoria",
              model,
              operation: "audit-chat-turn",
              metadata: {
                volta,
                comMemoria: memorias.length > 0,
                findings: body.report?.incongruencias.length ?? 0,
                historyTurns: history.length,
                analysisLevel,
              },
              request: {
                model,
                instructions:
                  "Você é o auditor sênior do NexoDoc respondendo sobre um parecer já emitido, " +
                  "com o documento ao alcance por ferramentas.",
                reasoning: { effort: getReasoningEffort() },
                max_output_tokens: Number(process.env.NEXODOC_CHAT_MAX_OUTPUT_TOKENS ?? 1400),
                input: input as never,
                ...(tools.length > 0 ? { tools } : {}),
              },
            });
            return respostaDoModelo(ai);
          },
        })) {
          // O achado sai com o parecer inteiro: o cliente funde os dois de uma vez
          // e regrava no IndexedDB sem precisar recompor a lista.
          if (evento.type === "achado") {
            send({ type: "achado", achado: evento.achado, report: body.report });
          } else if (evento.type !== "proposta") {
            send(evento);
          }
        }
      } catch (error) {
        const failure = classifyProviderFailure(
          executionProfile.provider,
          "audit-chat",
          model,
          error,
        );
        console.error(`[audit-chat] falha (${failure.category})`);
        send({
          type: "error",
          error:
            failure.category !== "unknown"
              ? failure.message
              : error instanceof Error
                ? error.message
                : "Não foi possível responder sobre a auditoria.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return withCors(
    new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Sem isto, proxies com buffer seguram os eventos e o progresso some.
        "X-Accel-Buffering": "no",
      },
    }) as NextResponse,
    request,
  );
}
```

> **`getProviderFailureStatus` sai de uso nesta rota** — o erro agora viaja
> DENTRO do SSE, com status 200, porque o fluxo já começou. Remova o import se o
> lint reclamar de import não usado.

- [ ] **Passo 6: confirme que compila e que o portão continua fechado**

```
npx tsc --noEmit && npm run lint && npm run prova:rotas
```
Esperado: `tsc` e `lint` limpos, e `prova:rotas` confirmando que
`/api/audit/chat` continua exigindo sessão. Se `prova:rotas` acusar rota aberta,
o `requireActor` saiu do topo do handler.

- [ ] **Passo 7: registre o teste no `package.json`**

```json
"test:chat:rota": "node scripts/test-chat-rota.ts",
```

- [ ] **Passo 8: commit**

```bash
git add app/api/audit/chat/route.ts app/api/audit/chat/serializacao.ts scripts/test-chat-rota.ts package.json
git diff --cached --stat
git commit -m "rota do chat: a que estava morta volta com o documento na mao"
```

---

## Tarefa 8: o roteamento no cliente

O cliente decide para onde mandar o turno:

- **Parecer no palco** → `/api/audit/chat`
- **Sem parecer** → `/api/nexo/agent`, exatamente como hoje

> **DIVERGÊNCIA DELIBERADA DA SPEC — leia antes de implementar.**
> A spec manda `NexoChat` receber `auditId` como prop, descido por quem contém
> o palco e o chat. Não é o que este plano faz: `NexoChat` **já destrutura
> `results`** de `useConversation()` (linha 117), e o `auditId` sai da mesma
> lista de onde `PalcoDoNexo` o tira. Passar por prop obrigaria `NexoCopilot`
> — que hoje não conhece o store — a virar intermediário de um dado que o
> destino já tem.
> **O risco real é outro, e é ele que este plano trata:** a regra "a auditoria
> desta conversa é a MAIS RECENTE por `generatedAt`" está escrita em
> `PalcoDoNexo.tsx:118-130`, e uma segunda cópia dela no chat acabaria
> discordando sobre qual parecer está na tela — o chat responderia sobre um
> parecer e a tela mostraria outro. Por isso a regra sai para uma função com
> **um dono só**, e as duas telas passam a chamá-la.

**Arquivos:**
- Modificar: `modules/nexo/lib/audit.ts` (acrescenta `auditoriaDaConversa`)
- Modificar: `modules/nexo/components/PalcoDoNexo.tsx:118-131`
- Modificar: `modules/nexo/components/NexoChat.tsx`
- Criar: `scripts/test-chat-roteamento.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: o contrato SSE da Tarefa 7.
- Produz:

```ts
// modules/nexo/lib/audit.ts
export function auditoriaMaisRecente(
  results: readonly { kind: string; payload?: unknown; generatedAt?: number; artifactId: string }[],
): { artifactId: string; salvo: MemorialAuditResult } | null;
```

- [ ] **Passo 1: escreva o teste que falha**

Crie `scripts/test-chat-roteamento.ts`:

```ts
/**
 * QUAL PARECER ESTÁ NA TELA — e, portanto, sobre qual o chat responde.
 *
 * O caso que motiva: reauditar um memorial corrigido grava um artefato NOVO sem
 * apagar o anterior. Pegar o primeiro da lista devolvia o parecer velho, e o
 * chat responderia sobre uma revisão que não é a que o engenheiro está vendo.
 *
 *   node scripts/test-chat-roteamento.ts  (== npm run test:chat:roteamento)
 */
import assert from "node:assert/strict";

import { auditoriaMaisRecente } from "../modules/nexo/lib/audit.ts";

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

const auditoria = (artifactId: string, auditId: string, generatedAt: number) => ({
  artifactId,
  kind: "auditoria",
  generatedAt,
  payload: { auditId, texto: "", report: { incongruencias: [], total_incongruencias: 0 } },
});

test("sem auditoria na conversa, devolve null", () => {
  assert.equal(auditoriaMaisRecente([]), null);
  assert.equal(auditoriaMaisRecente([{ artifactId: "a", kind: "ld", generatedAt: 1 }]), null);
});

test("com duas auditorias, vence a MAIS RECENTE, nao a primeira da lista", () => {
  const r = auditoriaMaisRecente([
    auditoria("art-velho", "aud-velho", 1000),
    auditoria("art-novo", "aud-novo", 2000),
  ]);
  assert.equal(r?.salvo.auditId, "aud-novo");
});

test("a ordem do vetor nao decide: quem decide e generatedAt", () => {
  const r = auditoriaMaisRecente([
    auditoria("art-novo", "aud-novo", 2000),
    auditoria("art-velho", "aud-velho", 1000),
  ]);
  assert.equal(r?.salvo.auditId, "aud-novo");
});

test("artefato sem generatedAt nao derruba a escolha", () => {
  const semData = { ...auditoria("art-x", "aud-x", 0), generatedAt: undefined };
  const r = auditoriaMaisRecente([semData as never, auditoria("art-y", "aud-y", 5)]);
  assert.equal(r?.salvo.auditId, "aud-y");
});

test("auditoria sem auditId ainda e devolvida (parecer local, sem banco)", () => {
  const semId = auditoria("art-l", "", 10);
  const r = auditoriaMaisRecente([semId]);
  assert.ok(r, "parecer local sumiu");
  assert.equal(r?.artifactId, "art-l");
});

console.log(`\n${passed} teste(s) de roteamento do chat OK`);
```

- [ ] **Passo 2: rode e confirme que falha**

```
node scripts/test-chat-roteamento.ts
```
Esperado: `auditoriaMaisRecente is not a function`.

- [ ] **Passo 3: a regra ganha um dono só**

Acrescente ao fim de `modules/nexo/lib/audit.ts`:

```ts
/**
 * A AUDITORIA QUE ESTÁ NA TELA — a MAIS RECENTE desta conversa.
 *
 * Era `results.find(...)` dentro de `PalcoDoNexo`, e virou função porque ganhou
 * um segundo consumidor: o chat precisa responder sobre o MESMO parecer que a
 * tela mostra. Duas cópias da regra discordariam no dia em que alguém
 * reauditasse — `saveResult` acrescenta um artefato novo sem apagar o anterior,
 * e a lista passa a ter dois.
 *
 * `generatedAt` é o critério, e não a posição no vetor: regerar um artefato
 * existente o substitui NO LUGAR, mantendo a posição antiga.
 */
export function auditoriaMaisRecente(
  results: readonly { kind: string; payload?: unknown; generatedAt?: number; artifactId: string }[],
): { artifactId: string; salvo: MemorialAuditResult } | null {
  const auditorias = results
    .filter((r) => r.kind === "auditoria")
    .slice()
    .sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0));

  const ultima = auditorias.at(-1);
  if (!ultima?.payload) return null;

  return { artifactId: ultima.artifactId, salvo: ultima.payload as MemorialAuditResult };
}
```

- [ ] **Passo 4: rode o teste e confirme que passa**

```
node scripts/test-chat-roteamento.ts
```
Esperado: `5 teste(s) de roteamento do chat OK`.

- [ ] **Passo 5: `PalcoDoNexo` passa a chamar a função**

Em `modules/nexo/components/PalcoDoNexo.tsx`, troque o bloco das linhas 118-131
(o `useMemo` de `auditorias`, o `const auditoria`, o `const salvo`) por:

```ts
  const atual = useMemo(() => auditoriaMaisRecente(results), [results]);
  const salvo = atual?.salvo;
  const report = salvo?.report;
```

`reportAnterior` (logo abaixo) precisa da penúltima e continua precisando da
lista ordenada — mantenha o `useMemo` de `auditorias` **só** para ele:

```ts
  const auditorias = useMemo(
    () =>
      results
        .filter((r) => r.kind === "auditoria")
        .slice()
        .sort((a, b) => (a.generatedAt ?? 0) - (b.generatedAt ?? 0)),
    [results],
  );
  const reportAnterior = (auditorias.at(-2)?.payload as MemorialAuditResult | undefined)?.report;
```

E acrescente `auditoriaMaisRecente` ao import de `../lib/audit`.

- [ ] **Passo 6: `NexoChat` roteia o turno**

Em `modules/nexo/components/NexoChat.tsx`:

**6a.** Acrescente `saveResult` ao destructure de `useConversation()` (linha 115-124)
e importe a função:

```ts
import { auditoriaMaisRecente } from "../lib/audit";
```

**6b.** Logo depois do destructure, acrescente:

```ts
  /*
   * O PARECER NO PALCO decide a porta do turno. Com parecer, a pergunta vai
   * para o chat que RELÊ o memorial; sem ele, para o roteador de intenção do
   * Nexo, exatamente como sempre foi.
   */
  const auditoriaAtual = useMemo(() => auditoriaMaisRecente(results), [results]);
```

**6c.** Em `send()`, logo depois de `let started = false;`, acrescente o desvio.
O bloco `try` existente inteiro (a chamada a `/api/nexo/agent`) vira o `else`
deste `if`:

```ts
    try {
      if (auditoriaAtual?.salvo.report) {
        await perguntarSobreAuditoria({
          text,
          history,
          assistantId,
          controller,
          marcarIniciado: () => { started = true; },
        });
        return;
      }

      // … o corpo atual do try, com o fetch de /api/nexo/agent, sem mudanças …
```

**6d.** Acrescente a função `perguntarSobreAuditoria` dentro do componente,
antes de `send`:

```ts
  /**
   * O turno que vai para o chat da auditoria.
   *
   * Consome o MESMO contrato SSE do agente (`delta`/`done`/`error`) mais dois
   * eventos: `ferramenta`, que mostra o que ele está lendo enquanto lê, e
   * `achado`, que traz o parecer inteiro já com a linha nova.
   */
  async function perguntarSobreAuditoria(args: {
    text: string;
    history: { role: "user" | "assistant"; content: string }[];
    assistantId: string;
    controller: AbortController;
    marcarIniciado: () => void;
  }) {
    const alvo = auditoriaAtual;
    if (!alvo) return;

    const res = await fetch("/api/audit/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        question: args.text,
        history: args.history,
        report: alvo.salvo.report,
        auditId: alvo.salvo.auditId,
      }),
      signal: args.controller.signal,
    });

    if (!res.ok || !res.body) throw new Error("Falha ao conversar sobre a auditoria.");

    appendMessage({ id: args.assistantId, role: "assistant", content: "" });
    args.marcarIniciado();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: string | null = null;
    let encaminhado: string | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((l) => l.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6)) as
          | { type: "delta"; text: string }
          | { type: "ferramenta"; nome: string; resumo: string }
          | { type: "achado"; achado: unknown; report: AuditReport }
          | { type: "encaminhar"; pedido: string }
          | { type: "done"; voltas: number; parouPorTeto: boolean }
          | { type: "error"; error: string };

        if (event.type === "delta") {
          appendDelta(args.assistantId, event.text);
        } else if (event.type === "ferramenta") {
          // O que ele está fazendo, enquanto faz. Sem isto o engenheiro olha
          // para uma bolha vazia por até oito idas ao modelo.
          onTurnStatus?.({ thinking: true, error: false, responding: false });
        } else if (event.type === "achado") {
          /*
           * O parecer persiste em DOIS lugares (banco e IndexedDB) e os dois
           * precisam concordar. O servidor já gravou o dele; aqui regravamos o
           * artefato NO LUGAR — mesmo `artifactId`, então canvas, fila e
           * feedback enxergam o achado novo de graça.
           */
          void saveResult({
            artifactId: alvo.artifactId,
            kind: "auditoria",
            summary: `Auditoria — ${event.report.status_geral}`,
            files: [],
            payload: { ...alvo.salvo, report: event.report },
            canvas: {
              label: "Auditoria",
              detail: `${event.report.status_geral} · ${event.report.total_incongruencias} achado(s)`,
            },
          });
        } else if (event.type === "encaminhar") {
          encaminhado = event.pedido;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      }
    }

    if (streamError) throw new Error(streamError);
    finalizeMessage(args.assistantId, {});

    /*
     * O engenheiro pediu para GERAR, e não para perguntar. O turno vai ao Nexo
     * com o mesmo corpo de sempre, e o card de confirmação aparece igual.
     */
    if (encaminhado) await send(encaminhado);
  }
```

**6e.** Acrescente `AuditReport` ao import de tipos do topo do arquivo:

```ts
import type { AuditReport } from "@/lib/audit-report";
```

> **Cuidado com o laço:** `send(encaminhado)` volta a `send`, e ali
> `auditoriaAtual` continua preenchido — cairia de novo no chat da auditoria, em
> laço. Por isso `send` ganha um segundo argumento:
> `async function send(textArg?: string, forcarNexo = false)`, o desvio do
> passo 6c vira `if (auditoriaAtual?.salvo.report && !forcarNexo)`, e a chamada
> aqui vira `await send(encaminhado, true)`. **Sem isso a tela trava.**

- [ ] **Passo 7: confirme que compila e que nada regrediu**

```
npx tsc --noEmit && npm run lint && npm run test:nexo:audit-contrato
```
Esperado: os três limpos.

- [ ] **Passo 8: registre o teste no `package.json`**

```json
"test:chat:roteamento": "node scripts/test-chat-roteamento.ts",
```

- [ ] **Passo 9: commit**

```bash
git add modules/nexo/lib/audit.ts modules/nexo/components/PalcoDoNexo.tsx modules/nexo/components/NexoChat.tsx scripts/test-chat-roteamento.ts package.json
git diff --cached --stat
git commit -m "chat: com parecer no palco, a pergunta vai para quem tem o documento"
```

---

## Tarefa 9: a prova no navegador e a prova com token

Duas provas, e a ordem importa: a do navegador roda **sem gastar um token**
(o `/api/audit/chat` é interceptado e devolve um SSE roteirizado), e só depois
vem a única corrida que paga o modelo.

Vale a regra desta casa: **asserção de DOM passa verde com o painel fora da
tela.** A prova mede a caixa contra a janela, não a existência do nó.

**Arquivos:**
- Criar: `scripts/prova-chat-advogado.mjs`
- Criar: `scripts/prova-chat-com-token.md`
- Modificar: `package.json`
- Modificar: `docs/superpowers/specs/2026-08-24-chat-advogado-do-diabo-design.md` (estado)

- [ ] **Passo 1: escreva a prova do navegador**

Crie `scripts/prova-chat-advogado.mjs`:

```js
// O CHAT DA AUDITORIA APARECE, LÊ E MOSTRA O ACHADO NOVO — sem gastar token.
//
//   node scripts/prova-chat-advogado.mjs   (== npm run prova:chat-advogado)
//
// O `/api/audit/chat` é INTERCEPTADO e devolve um SSE roteirizado. O que se
// prova aqui é o lado do cliente: que a pergunta foi para a porta certa, que o
// progresso da ferramenta aparece, que o achado novo entra na tela e que a
// resposta cabe na janela.
//
// A última asserção é a que costuma pegar defeito: uma bolha que existe no DOM
// e nasce abaixo do fim da janela passa em qualquer teste de seletor e é
// invisível para quem está usando.
import { chromium } from "playwright";
import fs from "node:fs";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const ACHADO_NOVO = {
  id: "INC-002",
  arquivo: "qa.pdf",
  prioridade: "Media",
  pagina: "41",
  capitulo: "1 - PAREDES",
  local: "",
  tipo: "Traco de argamassa divergente",
  descricao: "O traco declarado nao bate com a norma citada.",
  evidencia: 'Pagina 41: "argamassa de cimento e areia no traco 1:3"',
  conflito: "A norma exige 1:4.",
  sugestao_correcao: "Uniformizar o traco.",
  confianca: "media",
  origem: "chat",
  impacto: "tecnico_contratual",
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const erros = [];
const chamadas = [];
page.on("pageerror", (e) => erros.push(String(e)));

// A porta do chat da auditoria, encenada.
await page.route("**/api/audit/chat", async (route) => {
  chamadas.push(JSON.parse(route.request().postData() ?? "{}"));
  const eventos = [
    { type: "ferramenta", nome: "buscar_no_memorial", resumo: 'procurando "argamassa"' },
    { type: "ferramenta", nome: "ler_paginas", resumo: "lendo as páginas 41-42" },
    { type: "achado", achado: ACHADO_NOVO, report: null },
    { type: "delta", text: "Encontrei um problema que o parecer nao trazia: na PAGINA 41 o traco da argamassa e 1:3, e a norma citada no capitulo 1 exige 1:4. Registrei como INC-002." },
    { type: "done", voltas: 3, parouPorTeto: false },
  ];
  await route.fulfill({
    status: 200,
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache" },
    body: eventos.map((e) => `data: ${JSON.stringify(e)}\n\n`).join(""),
  });
});

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(1500);

  // Semeia uma conversa COM parecer: é isso que abre a porta do chat da auditoria.
  const convId = await page.evaluate(async () => {
    const convId = "qa-chat-advogado";
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const report = {
      tipo_auditoria: "memorial",
      tipo_documento: "memorial descritivo",
      obra: "QA ADVOGADO",
      codigo: "000-00",
      municipio: "",
      data_documento: "",
      status_analise: "concluida",
      status_geral: "com pontos de revisão",
      total_incongruencias: 1,
      arquivos_analisados: [],
      comparacoes: [],
      conclusao: ".",
      incongruencias: [
        {
          id: "INC-001",
          arquivo: "qa.pdf",
          prioridade: "Alta",
          pagina: "44",
          capitulo: "3 - COBERTURA",
          local: "",
          tipo: "Espessura de telha divergente",
          descricao: "Semeado.",
          evidencia: 'Pagina 44: "telha de 30mm"',
          conflito: "A prancha indica 50mm.",
          sugestao_correcao: "Uniformizar.",
          confianca: "alta",
          origem: "ia",
          impacto: "critico_documental",
        },
      ],
    };
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA CHAT ADVOGADO",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:qa-advogado",
            kind: "auditoria",
            summary: "Auditoria",
            files: [],
            generatedAt: agora,
            payload: { auditId: "qa-advogado", texto: "RESULTADO", report },
          },
        ],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return convId;
  });

  await page.goto(`${BASE}/nexo?conversa=${convId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);

  const campo = page.locator("textarea").first();
  await campo.fill("Voce concorda com o INC-001? Procure erro que o motor deixou passar.");
  await campo.press("Enter");
  await page.waitForTimeout(2500);

  check("a pergunta foi para /api/audit/chat, e nao para o agente", chamadas.length === 1);
  check(
    "o corpo levou o auditId e o parecer",
    chamadas[0]?.auditId === "qa-advogado" && Array.isArray(chamadas[0]?.report?.incongruencias),
    JSON.stringify(Object.keys(chamadas[0] ?? {})),
  );

  const bolha = page.getByText(/PAGINA 41/i).first();
  check("a resposta chegou na tela", (await bolha.count()) > 0);

  // A ASSERÇÃO QUE PEGA DEFEITO: a caixa contra a janela.
  if ((await bolha.count()) > 0) {
    const caixa = await bolha.boundingBox();
    const janela = page.viewportSize();
    check(
      "a resposta esta DENTRO da janela, e nao so no DOM",
      caixa && caixa.y >= 0 && caixa.y + caixa.height <= janela.height && caixa.width > 0,
      JSON.stringify({ caixa, janela }),
    );
  }

  // O achado novo entrou no parecer que a tela desenha.
  const gravado = await page.evaluate(async () => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
    });
    const conv = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const req = tx.objectStore("conversations").get("qa-chat-advogado");
      req.onsuccess = () => res(req.result);
    });
    const auditoria = (conv?.results ?? []).find((r) => r.kind === "auditoria");
    return (auditoria?.payload?.report?.incongruencias ?? []).map((f) => ({ id: f.id, origem: f.origem }));
  });
  check(
    "o achado nascido no chat foi gravado no IndexedDB com origem chat",
    gravado.some((f) => f.id === "INC-002" && f.origem === "chat"),
    JSON.stringify(gravado),
  );

  check("nenhum erro de pagina", erros.length === 0, erros.join(" | "));
  await page.screenshot({ path: `${OUT}/chat-advogado.png`, fullPage: false });
} finally {
  await browser.close();
}

console.log(falhas === 0 ? "\nPROVA OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: rode a prova**

Com `npm run dev` de pé em outro terminal:

```
node scripts/prova-chat-advogado.mjs
```
Esperado: cinco `OK` e `PROVA OK`.

> **Se o `dev` estiver rodando há muito tempo, reinicie antes de acreditar numa
> falha.** Um `next dev` velho dá falha de portão consistente e falsa. E se o
> Chrome insistir em "X is not a function", só `Ctrl+Shift+R` resolve — apagar
> `.next` não.

- [ ] **Passo 3: registre a prova no `package.json`**

```json
"prova:chat-advogado": "node scripts/prova-chat-advogado.mjs",
```

- [ ] **Passo 4: commit**

```bash
git add scripts/prova-chat-advogado.mjs package.json
git diff --cached --stat
git commit -m "prova: o chat da auditoria aparece, le e mostra o achado novo -- sem token"
```

- [ ] **Passo 5: escreva o roteiro da prova com token**

Crie `scripts/prova-chat-com-token.md`. É a **única** corrida que paga o modelo,
e ela existe para responder uma pergunta que nenhum teste puro responde: *a
página que o chat cita bate com o PDF?*

```markdown
# Prova com token — o chat cita a página certa

Roda UMA vez, à mão, e custa uma auditoria mais alguns turnos de chat.

## Antes

1. `npm run dev` recém-iniciado (o servidor velho mente).
2. Um memorial do kit de erros plantados na máquina, com o gabarito à mão.
3. Teto de gasto do mês conferido.

## Passos

1. Rode a auditoria do memorial pelo Nexo, até o parecer aparecer no palco.
2. Confirme que a memória foi gravada:
   `SELECT "fileName", "charCount", jsonb_array_length("pages") FROM "AuditText" WHERE "auditId" = '<id>';`
   Esperado: uma linha, `charCount` próximo do `extractedCharCount` do `AuditFile`.
3. Pergunte no chat: **"Em que página está a espessura da telha, e qual o valor?"**
   - Abra o PDF na página citada e confira o valor.
   - **Reprova** se a página não bater. Não arredonde o julgamento: página errada
     é o defeito que esta arquitetura inteira existe para impedir.
4. Pergunte: **"Você concorda com o achado INC-00X?"** escolhendo um achado que o
   gabarito diz ser falso positivo.
   - Esperado: ele discorda e mostra o trecho que o contradiz.
   - **Reprova** se ele concordar por educação.
5. Pergunte: **"Procure um erro que a auditoria deixou passar."**
   - Se ele registrar um achado, confira a evidência contra o PDF.
   - **Reprova** se a evidência não existir na página — a trava de
     `registrar_achado` teria falhado, e é o pior defeito possível.
6. Pergunte algo que NÃO está no memorial: **"O que o documento diz sobre
   elevadores?"**
   - Esperado: "não encontrei", sem aproximar.
7. Peça uma geração: **"Monta a LD dessas pranchas."**
   - Esperado: o card de confirmação do Nexo aparece, como sempre.

## Depois

Anote no `docs/superpowers/plans/` desta feature: quantas voltas cada pergunta
gastou (o log `[ai] flow=audit-chat op=audit-chat-turn` traz uma linha por
volta) e o custo total. É o número que decide se o teto de 8 está certo.
```

- [ ] **Passo 6: feche o estado da spec**

Em `docs/superpowers/specs/2026-08-24-chat-advogado-do-diabo-design.md`, linha 4,
troque:

```
**Estado:** desenho aprovado, não implementado
```

por:

```
**Estado:** implementado em 25/08/2026. Plano de execução em
`docs/superpowers/plans/2026-08-25-chat-advogado-do-diabo.md`, que registra
DUAS divergências deliberadas: `encaminhar_para_geracao` é resolvido no cliente
(a rota do chat não tem o contexto que `runNexoAgentTurn` exige), e o `auditId`
sai de `auditoriaMaisRecente(results)` em vez de descer como prop. A prova com
token está em `scripts/prova-chat-com-token.md` e ainda NÃO foi executada.
```

- [ ] **Passo 7: commit**

```bash
git add scripts/prova-chat-com-token.md docs/superpowers/specs/2026-08-24-chat-advogado-do-diabo-design.md docs/superpowers/plans/2026-08-25-chat-advogado-do-diabo.md
git diff --cached --stat
git commit -m "chat advogado do diabo: spec fechada, e o roteiro da unica corrida que paga o modelo"
```

---

# Verificação final

Antes de dizer que acabou, rode e cole a saída:

```
npm run test:ancoragem && npm run test:memoria && npm run test:chat:ferramentas && npm run test:chat:historico && npm run test:chat:laco && npm run test:chat:rota && npm run test:chat:roteamento
npm run test:severidade && npm run test:audit:reuso && npm run test:impressao-achado && npm run test:nexo:audit-contrato
npx tsc --noEmit && npm run lint && npm run prova:rotas
node scripts/prova-chat-advogado.mjs
```

**O que ainda NÃO estará provado depois disso, e precisa ser dito ao pedir
revisão:**

- A prova com token (`scripts/prova-chat-com-token.md`) — é ela que responde se
  a página citada bate com o PDF. Sem ela, o que está provado é que o mecanismo
  funciona, não que o auditor acerta.
- O comportamento com parecer antigo **em banco real** (o modo degradado está
  provado só nos testes puros).
- O teto de 8 voltas: o número é palpite até a corrida com token medir quantas
  voltas uma pergunta real gasta.
