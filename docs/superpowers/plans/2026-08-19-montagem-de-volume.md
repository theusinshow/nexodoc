# Montagem de volume: prefeitura, medição e histórico — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Impedir que um documento saia com a prefeitura errada, medir a leitura de carimbo contra os documentos que o escritório já entregou, e transformar o histórico numa lista de projetos em vez de uma lista de conversas.

**Architecture:** Quatro frentes independentes, na ordem do estrago. A prefeitura deixa de ser um parâmetro resolvido por documento e vira a identidade do projeto, resolvida uma vez por turno e verificada por um portão antes de gerar. Duas bancadas determinísticas medem, sem gastar token, o que hoje é palpite — usando como gabarito as LDs que o escritório entregou. O histórico passa a ter um nível só: a pasta do projeto.

**Tech Stack:** TypeScript, Next.js 16, React, pdfjs-dist (legacy, `disableWorker`), Node 22+ com type-stripping nativo (`node scripts/x.ts`), `node:assert/strict` sem framework de teste.

**Spec:** `docs/superpowers/specs/2026-08-19-montagem-de-volume-design.md`

## Global Constraints

- **Sem framework de teste.** Todo teste é um script em `scripts/test-*.ts` com `node:assert/strict`, rodado por `node scripts/test-x.ts`, registrado em `package.json` como `test:*`. Segue o molde de `scripts/test-nexo-agent.ts`.
- **Núcleos puros rodam em node cru.** Módulo testado por `node` não pode importar com o alias `@/` (o node não o resolve) nem tocar DOM. Import relativo **com extensão `.ts`**.
- **Comentários em pt-BR**, explicando *por quê*, no estilo já presente nos arquivos tocados. Comentário que repete o código não entra.
- **Nenhuma chamada de modelo** em nenhuma tarefa deste plano. Custo de IA: zero.
- **Ordem das prefeituras de produção é `["prefchap", "pmcriciuma", "prefflor", "prefsjose"]`** — Chapecó em primeiro. Todo teste de prefeitura usa essa ordem; qualquer outra esconde o defeito.
- **Commits direto na `main`**, sem branch e sem PR.
- **Nunca `git add -A`.** Sempre caminhos explícitos, e `git diff --cached --stat` antes de commitar.
- **Verificar antes de afirmar.** `npx tsc --noEmit -p tsconfig.json` precisa sair limpo antes de cada commit que toca `.ts`/`.tsx`.

## Fora deste plano

O passo "consertar o que a medição apontar" (item 4 da ordem do dia do spec) **não vira tarefa aqui**: o escopo dele depende do que as Tarefas 3 e 5 imprimirem. Vira um plano próprio depois que os números existirem. Fechá-lo agora seria adivinhar — e o dia de hoje já mostrou que a causa não estava onde parecia.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `server/nexo/agent/normalize.ts` | *modificar* — a prefeitura passa a ser resolvida UMA vez por turno | 1 |
| `scripts/test-nexo-agent.ts` | *modificar* — testes do vazamento e da concordância | 1 |
| `modules/nexo/lib/coerencia-do-volume.ts` | *criar* — puro: os documentos do plano concordam sobre a prefeitura? | 2 |
| `scripts/test-coerencia-do-volume.ts` | *criar* | 2 |
| `modules/nexo/components/PlanoDeGeracao.tsx` | *modificar* — o portão antes de gerar | 2 |
| `scripts/mede-prefeitura.ts` | *criar* — bancada do `motivo`, contra o rodapé das LDs | 3 |
| `lib/coordenada-do-pdf.ts` | *criar* — puro: `transform` do pdf.js → 0..1, extraído de `selo-render.ts` | 4 |
| `modules/nexo/lib/selo-render.ts` | *modificar* — passa a consumir o módulo puro | 4 |
| `scripts/mede-leitura-de-selo.ts` | *criar* — bancada da leitura, contra as LDs entregues | 5 |
| `modules/nexo/lib/pasta-do-projeto.ts` | *criar* — puro: nome da pasta e nome da conversa | 6 |
| `scripts/test-pasta-do-projeto.ts` | *criar* | 6 |
| `modules/nexo/state/conversation-store.tsx` | *modificar* — passa a derivar pasta e título pela nova regra | 6 |
| `modules/nexo/lib/group-conversations.ts` | *modificar* — agrupa por pasta, filtra por tipo dentro | 7 |
| `modules/nexo/components/NexoSidebar.tsx` | *modificar* — um nível: pastas no topo | 7 |
| `modules/nexo/components/FolhaNode.tsx` | *modificar* — sai o `line-clamp-2` | 8 |

---

## Task 1: O vazamento da prefeitura

**Files:**
- Modify: `server/nexo/agent/normalize.ts:305-395`
- Test: `scripts/test-nexo-agent.ts`

**Interfaces:**
- Consumes: `matchPrefeitura(wanted, prefeituras, escritorio)`, `ESCRITORIO_VAZIO`, `NormalizeContext` — todos já existem no arquivo.
- Produces: `normalizeProposals(raw, ctx)` com contrato novo — capa e separatriz **sempre** saem com o mesmo `templateId`, e `""` quando a prefeitura não foi decidida.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao fim de `scripts/test-nexo-agent.ts`, **antes** da linha `console.log(...)` final. `REAIS` já existe no arquivo (linha 70) e já está na ordem de produção, com `prefchap` em primeiro — é isso que faz estes testes valerem:

```ts
/*
 * A SEPARATRIZ CAÍA NA PRIMEIRA PREFEITURA CONFIGURADA.
 *
 * A capa foi endurecida contra isso (o comentário em normalize.ts conta o
 * volume de Criciúma que saiu como Florianópolis) e o `|| firstTemplateId` foi
 * removido dela. A separatriz ficou com a linha antiga — mesmo defeito, arquivo
 * seguinte, corrigido pela metade.
 *
 * `REAIS` está na ORDEM DE PRODUÇÃO, com Chapecó em primeiro. Com Criciúma em
 * primeiro estes testes passariam verdes com o defeito intacto, e é exatamente
 * assim que este defeito sobreviveu à correção do irmão dele.
 */
test("prefeitura não decidida NÃO vira Chapecó na separatriz", () => {
  const r = normalizeProposals(
    [{ kind: "capa" }, { kind: "separatriz" }],
    { prefeituras: REAIS, disciplina: "METALICA" } as never,
  );
  const sep = r.find((p) => p.kind === "separatriz")?.params as { templateId: string };
  const capa = r.find((p) => p.kind === "capa")?.params as { templateId: string };
  assert.equal(capa.templateId, "", "capa sem prefeitura decidida fica vazia");
  assert.equal(sep.templateId, "", "separatriz sem prefeitura decidida TAMBÉM fica vazia");
});

test("a separatriz continua no plano, travada — não some", () => {
  const r = normalizeProposals(
    [{ kind: "separatriz" }],
    { prefeituras: REAIS, disciplina: "METALICA" } as never,
  );
  assert.equal(r.length, 1, "sumir esconderia que o volume tem uma separatriz");
});

test("capa e separatriz saem SEMPRE com a mesma prefeitura", () => {
  // O pedido nomeia a prefeitura só na capa: a separatriz herda a MESMA
  // decisão. Duas resoluções independentes do mesmo fato é o que produz um
  // volume com capa de Criciúma e separatriz de Chapecó.
  const r = normalizeProposals(
    [{ kind: "capa", prefeitura: "Prefeitura Municipal de Criciúma" }, { kind: "separatriz" }],
    { prefeituras: REAIS, disciplina: "METALICA" } as never,
  );
  const capa = r.find((p) => p.kind === "capa")?.params as { templateId: string };
  const sep = r.find((p) => p.kind === "separatriz")?.params as { templateId: string };
  assert.equal(capa.templateId, "pmcriciuma");
  assert.equal(sep.templateId, "pmcriciuma");
});

test("sem prefeitura CONFIGURADA não há capa nem separatriz", () => {
  const r = normalizeProposals(
    [{ kind: "capa" }, { kind: "separatriz" }],
    { prefeituras: [], disciplina: "METALICA" } as never,
  );
  assert.equal(r.length, 0);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-nexo-agent.ts`
Expected: FALHA em "prefeitura não decidida NÃO vira Chapecó na separatriz", com `expected '' to equal 'prefchap'` (a mensagem do assert mostra `prefchap`).

- [ ] **Step 3: Resolver a prefeitura UMA vez**

Em `server/nexo/agent/normalize.ts`, adicionar esta função logo **antes** de `normalizeProposals`:

```ts
/**
 * A PREFEITURA DO VOLUME, resolvida UMA VEZ a partir de tudo que o turno pediu.
 *
 * Antes cada proposta resolvia a sua: `normalizeProposals` chamava
 * `matchPrefeitura` duas vezes sobre o mesmo pedido — uma para a capa, outra
 * para a separatriz. Duas resoluções independentes do mesmo fato podem
 * discordar, e discordavam: a capa virava pergunta e era respondida certo,
 * enquanto a separatriz caía calada na primeira prefeitura configurada.
 *
 * A prefeitura não é atributo de documento. É a IDENTIDADE DO PROJETO, e um
 * projeto tem uma só. Resolver uma vez não é economia de chamada — é a única
 * forma de os documentos do volume não poderem discordar entre si.
 *
 * `""` = não decidida, e não decidida vira PERGUNTA. Nunca a primeira da lista.
 */
function prefeituraDoTurno(raw: readonly unknown[], ctx: NormalizeContext): string {
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (p.kind !== "capa" && p.kind !== "separatriz") continue;

    const match = matchPrefeitura(
      { id: String(p.templateId ?? ""), nome: String(p.prefeitura ?? "") },
      ctx.prefeituras,
      ctx.escritorio ?? ESCRITORIO_VAZIO,
    );
    const id = match?.id ?? String(p.templateId ?? "").trim();
    if (id) return id;
  }
  return "";
}
```

- [ ] **Step 4: Usar a resolução única e apagar `firstTemplateId`**

Substituir, em `normalizeProposals`:

```ts
  const firstTemplateId = ctx.prefeituras[0]?.id ?? "";
```

por:

```ts
  /*
   * UMA resolução para o volume inteiro. A variável que havia aqui —
   * `firstTemplateId`, a primeira prefeitura configurada — era o defeito, não
   * um detalhe dele: em produção a primeira é Chapecó, e todo volume cuja
   * prefeitura não casasse saía com uma separatriz de Chapecó.
   */
  const templateDoVolume = prefeituraDoTurno(raw, ctx);
```

No ramo `p.kind === "capa"`, trocar:

```ts
      const match = matchPrefeitura(
        { id: String(p.templateId ?? ""), nome: String(p.prefeitura ?? "") },
        ctx.prefeituras,
        ctx.escritorio ?? ESCRITORIO_VAZIO,
      );
```
...e a linha `const templateId = match?.id ?? String(p.templateId ?? "").trim();`

por:

```ts
      const match = ctx.prefeituras.find((t) => t.id === templateDoVolume) ?? null;
      const templateId = templateDoVolume;
```

No ramo `p.kind === "separatriz"`, trocar o bloco equivalente por:

```ts
      const match = ctx.prefeituras.find((t) => t.id === templateDoVolume) ?? null;
      const templateId = templateDoVolume;
      /*
       * MESMA REGRA DA CAPA: sem prefeitura CONFIGURADA não há separatriz
       * possível; sem prefeitura DECIDIDA há — ela é a pergunta, e a separatriz
       * aparece no plano TRAVADA. Sumir esconderia que o volume tem uma
       * separatriz, e peça que falta é tão grave quanto peça errada.
       */
      if (ctx.prefeituras.length === 0) continue;
```

(a linha antiga `if (!templateId) continue;` sai junto)

- [ ] **Step 5: Rodar os testes**

Run: `node scripts/test-nexo-agent.ts`
Expected: todos ok, incluindo os quatro novos.

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída, exit 0.

- [ ] **Step 7: Commit**

```bash
git add server/nexo/agent/normalize.ts scripts/test-nexo-agent.ts
git diff --cached --stat
git commit -m "prefeitura: a separatriz caia em Chapeco, e ninguem via"
```

---

## Task 2: O portão de coerência antes de gerar

A Tarefa 1 impede que documentos divergentes **nasçam**. Este portão pega o que a construção não pega: o engenheiro editar a prefeitura de UM documento depois.

**Files:**
- Create: `modules/nexo/lib/coerencia-do-volume.ts`
- Create: `scripts/test-coerencia-do-volume.ts`
- Modify: `modules/nexo/components/PlanoDeGeracao.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `conferirPrefeitura(documentos: DocumentoDoPlano[]): ProblemaDePrefeitura | null`, onde
  `DocumentoDoPlano = { rotulo: string; templateId: string }` e
  `ProblemaDePrefeitura = { tipo: "vazia" | "divergente"; mensagem: string }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-coerencia-do-volume.ts`:

```ts
/**
 * O PORTÃO da prefeitura, antes de gerar.
 *
 *   node scripts/test-coerencia-do-volume.ts
 */
import assert from "node:assert/strict";

import { conferirPrefeitura } from "../modules/nexo/lib/coerencia-do-volume.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

test("todos concordando passa", () => {
  assert.equal(
    conferirPrefeitura([
      { rotulo: "Capa", templateId: "pmcriciuma" },
      { rotulo: "Separatriz", templateId: "pmcriciuma" },
    ]),
    null,
  );
});

test("divergência é recusada e DIZ quem discorda", () => {
  const p = conferirPrefeitura([
    { rotulo: "Capa", templateId: "pmcriciuma" },
    { rotulo: "Separatriz", templateId: "prefchap" },
  ]);
  assert.equal(p?.tipo, "divergente");
  assert.match(p!.mensagem, /Capa/);
  assert.match(p!.mensagem, /Separatriz/);
  assert.match(p!.mensagem, /pmcriciuma/);
  assert.match(p!.mensagem, /prefchap/);
});

test("prefeitura vazia trava o volume INTEIRO", () => {
  const p = conferirPrefeitura([
    { rotulo: "Capa", templateId: "" },
    { rotulo: "Separatriz", templateId: "" },
  ]);
  assert.equal(p?.tipo, "vazia");
});

test("um só documento vazio trava igual", () => {
  const p = conferirPrefeitura([
    { rotulo: "Capa", templateId: "pmcriciuma" },
    { rotulo: "Separatriz", templateId: "" },
  ]);
  assert.equal(p?.tipo, "vazia");
});

test("lista sem documento de prefeitura não trava nada", () => {
  // Uma LD sozinha não imprime brasão: não há o que conferir.
  assert.equal(conferirPrefeitura([]), null);
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-coerencia-do-volume.ts`
Expected: FALHA com `Cannot find module` / `does not provide an export named 'conferirPrefeitura'`.

- [ ] **Step 3: Escrever o módulo**

Criar `modules/nexo/lib/coerencia-do-volume.ts`:

```ts
/**
 * OS DOCUMENTOS DO VOLUME CONCORDAM SOBRE A PREFEITURA?
 *
 * Núcleo PURO (sem imports) → roda em node cru:
 * `node scripts/test-coerencia-do-volume.ts`.
 *
 * `normalizeProposals` resolve a prefeitura UMA vez, então documentos
 * divergentes não nascem mais. Este portão existe para o que a construção não
 * alcança: o engenheiro editar a prefeitura de UM documento depois de proposto.
 *
 * O modo de falhar que ele fecha é o pior deste produto — um volume com capa de
 * Criciúma e separatriz de Chapecó, que só se descobre abrindo os dois PDFs
 * lado a lado. Recusar é barato; reemitir um volume protocolado, não.
 */

export interface DocumentoDoPlano {
  /** Como o documento se chama na tela ("Capa", "Separatriz"). */
  rotulo: string;
  /** O id do modelo de prefeitura. Vazio = não decidida. */
  templateId: string;
}

export interface ProblemaDePrefeitura {
  tipo: "vazia" | "divergente";
  /** A frase que o engenheiro lê. Diz QUEM discorda, não só que discordam. */
  mensagem: string;
}

/**
 * `null` quando pode gerar. A ordem das checagens importa: vazio é a causa
 * comum e tem conserto óbvio (responder a pergunta); divergência é rara e
 * exige olhar dois documentos, então merece a frase mais específica.
 */
export function conferirPrefeitura(
  documentos: readonly DocumentoDoPlano[],
): ProblemaDePrefeitura | null {
  if (documentos.length === 0) return null;

  const vazios = documentos.filter((d) => !d.templateId.trim());
  if (vazios.length > 0) {
    const quais = vazios.map((d) => d.rotulo).join(", ");
    return {
      tipo: "vazia",
      mensagem: `A prefeitura ainda não foi escolhida (${quais}). O volume inteiro espera essa decisão — ela sai impressa na capa e na separatriz.`,
    };
  }

  const porId = new Map<string, string[]>();
  for (const d of documentos) {
    const lista = porId.get(d.templateId);
    if (lista) lista.push(d.rotulo);
    else porId.set(d.templateId, [d.rotulo]);
  }
  if (porId.size <= 1) return null;

  const partes = [...porId.entries()]
    .map(([id, rotulos]) => `${rotulos.join(" e ")} → ${id}`)
    .join("; ");
  return {
    tipo: "divergente",
    mensagem: `Os documentos deste volume discordam sobre a prefeitura: ${partes}. Um volume tem uma prefeitura só.`,
  };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node scripts/test-coerencia-do-volume.ts`
Expected: `5 teste(s) passaram.`

- [ ] **Step 5: Registrar o script**

Em `package.json`, adicionar após a linha `"test:nexo:agent"` (ou junto das demais `test:nexo:*`):

```json
    "test:nexo:coerencia": "node scripts/test-coerencia-do-volume.ts",
```

- [ ] **Step 6: Ligar o portão no plano**

Em `modules/nexo/components/PlanoDeGeracao.tsx`, importar:

```ts
import { conferirPrefeitura } from "../lib/coerencia-do-volume";
```

Depois da linha que calcula `propostas` (a que faz `proposals.map(...)`), acrescentar:

```ts
  /*
   * O PORTÃO DA PREFEITURA. `normalizeProposals` já impede que documentos
   * divergentes nasçam; isto pega o que ele não alcança — a prefeitura editada
   * em UM documento depois de proposto.
   */
  const problemaDePrefeitura = conferirPrefeitura(
    propostas
      .filter((p) => p.kind === "capa" || p.kind === "separatriz")
      .map((p) => ({
        rotulo: p.kind === "capa" ? "Capa" : "Separatriz",
        templateId: String((p.params as { templateId?: unknown })?.templateId ?? ""),
      })),
  );
```

Localizar o `<Button>` que dispara a geração (o que chama a função de gerar do card) e:
1. acrescentar `disabled={Boolean(problemaDePrefeitura)}` às props que ele já tiver (somando a qualquer `disabled` existente com `||`);
2. renderizar a faixa logo acima dele:

```tsx
      {problemaDePrefeitura && (
        <FaixaDeEstado
          tipo="documento"
          titulo={
            problemaDePrefeitura.tipo === "vazia"
              ? "Falta escolher a prefeitura"
              : "Os documentos discordam sobre a prefeitura"
          }
        >
          {problemaDePrefeitura.mensagem}
        </FaixaDeEstado>
      )}
```

Se `FaixaDeEstado` ainda não estiver importado neste arquivo, adicionar
`import { FaixaDeEstado } from "./FaixaDeEstado";`.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída, exit 0.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/lib/coerencia-do-volume.ts scripts/test-coerencia-do-volume.ts modules/nexo/components/PlanoDeGeracao.tsx package.json
git diff --cached --stat
git commit -m "volume: capa e separatriz discordando sobre a prefeitura para de gerar"
```

---

## Task 3: Bancada do `motivo` da prefeitura

`casarPrefeituraDoCarimbo` já devolve um `motivo` que separa as causas de falha. Ninguém nunca olhou esse número, e ele decide o trabalho: `sem-evidencia` pede leitura melhor; `divergem`/`ambiguo` pede pergunta.

**Files:**
- Create: `scripts/mede-prefeitura.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `casarPrefeituraDoCarimbo(selos, prefeituras, escritorio)` e `type AgentPrefeitura` de `server/nexo/agent/normalize.ts`; `extractPdfText(buffer)` de `lib/pdf-text.ts`.
- Produces: nada consumido por outra tarefa. É diagnóstico.

- [ ] **Step 1: Escrever a bancada**

Criar `scripts/mede-prefeitura.ts`:

```ts
/**
 * QUAL `motivo` de `casarPrefeituraDoCarimbo` dispara nos projetos reais.
 *
 *   node scripts/mede-prefeitura.ts     (== npm run mede:prefeitura)
 *
 * A decisão do produto é que a prefeitura TEM de ser cravada. "Põe IA" não é a
 * resposta até se saber POR QUE ela não crava hoje:
 *
 *   sem-evidencia        → o campo não foi lido. Leitura melhor resolve.
 *   divergem / ambiguo   → a evidência se contradiz. IA nenhuma resolve isso;
 *                          decidir por cima de contradição é o chute que
 *                          produziu o incidente Florianópolis.
 *
 * O GABARITO É DE GRAÇA. O rodapé de toda LD entregue traz o caminho de rede do
 * escritório — `P:\cad\prefchap\040_26\...` —, ou seja, o id do template está
 * IMPRESSO no documento.
 *
 * O LIMITE, dito na cara: `logoOrgao` sai do brasão e só existe com modelo de
 * visão. Aqui ele é `null`, e o `cliente` é o texto determinístico da página.
 * O que se mede é: **o texto sozinho crava a prefeitura?** É o piso, não o teto.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

import { extractPdfText } from "../lib/pdf-text.ts";
import {
  casarPrefeituraDoCarimbo,
  type AgentPrefeitura,
} from "../server/nexo/agent/normalize.ts";

const RAIZ = "docs/samples";
const CAPAS = "templates/capas";

/** As prefeituras reais, lidas dos modelos — a mesma lista que a produção usa. */
function prefeiturasReais(): AgentPrefeitura[] {
  return readdirSync(CAPAS)
    .filter((d) => existsSync(join(CAPAS, d, "config.json")))
    .map((d) => {
      const cfg = JSON.parse(readFileSync(join(CAPAS, d, "config.json"), "utf8"));
      return { id: String(cfg.id), nome: String(cfg.nome) };
    });
}

/** Todo `*_ld_*.pdf` sob a raiz dos samples. */
function todasAsLds(dir: string, achados: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) todasAsLds(p, achados);
    else if (/_ld_.*\.pdf$/i.test(e.name)) achados.push(p);
  }
  return achados;
}

/** O id do template impresso no rodapé: `P:\cad\prefchap\...`. */
function gabaritoDoRodape(texto: string, prefeituras: AgentPrefeitura[]): string | null {
  for (const p of prefeituras) {
    if (new RegExp(`[\\\\/]${p.id}[\\\\/]`, "i").test(texto)) return p.id;
  }
  return null;
}

const prefeituras = prefeiturasReais();
console.log(`prefeituras configuradas: ${prefeituras.map((p) => p.id).join(", ")}\n`);

const porMotivo = new Map<string, number>();
let acertos = 0;
let comGabarito = 0;
const erros: string[] = [];

for (const caminho of todasAsLds(RAIZ)) {
  const extraido = await extractPdfText(readFileSync(caminho));
  const esperado = gabaritoDoRodape(extraido.text, prefeituras);
  if (!esperado) continue;
  comGabarito += 1;

  /*
   * O corpo da LD nomeia o órgão no rodapé impresso ("SECRETARIA ... – 040_26 –
   * ..."), que é o mesmo tipo de texto que o campo `cliente` carrega. O caminho
   * de rede é REMOVIDO antes de casar: ele é o gabarito, e deixá-lo entrar
   * faria a bancada medir a si mesma.
   */
  const semCaminho = extraido.text.replace(/[A-Z]:\\[^\s]+/gi, " ");
  const r = casarPrefeituraDoCarimbo([{ cliente: semCaminho, logoOrgao: null }], prefeituras);
  const motivo = r?.motivo ?? "(indefinido)";
  porMotivo.set(motivo, (porMotivo.get(motivo) ?? 0) + 1);

  if (r?.resolvedId === esperado) acertos += 1;
  else erros.push(`${caminho}\n    esperado=${esperado} lido=${r?.resolvedId ?? "null"} motivo=${motivo}`);
}

console.log(`documentos com gabarito no rodapé: ${comGabarito}`);
console.log(
  `acerto: ${acertos}/${comGabarito}` +
    (comGabarito ? ` (${Math.round((acertos / comGabarito) * 100)}%)` : ""),
);
console.log("\nmotivo:");
for (const [m, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${m}`);
}
if (erros.length) {
  console.log("\nnão cravou:");
  for (const e of erros) console.log(`  ${e}`);
}
console.log(
  "\nLIMITE: `logoOrgao` (o brasão) é null aqui — só existe com modelo de visão.",
);
console.log("Este número é o PISO: o que o texto sozinho consegue cravar.");
```

- [ ] **Step 2: Rodar a bancada**

Run: `node scripts/mede-prefeitura.ts`
Expected: imprime a contagem por `motivo` e o % de acerto sobre os documentos que têm o caminho de rede no rodapé. Não há critério de PASS/FAIL — o resultado é o dado.

- [ ] **Step 3: Registrar o script**

Em `package.json`, junto dos demais scripts:

```json
    "mede:prefeitura": "node scripts/mede-prefeitura.ts",
```

- [ ] **Step 4: Commit com o número no corpo da mensagem**

O número medido vai no commit — é ele que torna a próxima decisão dirigida por fato.

```bash
git add scripts/mede-prefeitura.ts package.json
git diff --cached --stat
git commit -m "bancada: qual motivo impede a prefeitura de cravar"
```

---

## Task 4: O módulo puro da coordenada

A Tarefa 5 precisa rodar o leitor **de produção**. A conversão de `transform` do pdf.js para coordenada normalizada mora hoje dentro de `selo-render.ts`, que é client-only. Reimplementá-la na bancada mediria uma cópia do leitor — e número sobre cópia é pior que número nenhum.

**Files:**
- Create: `lib/coordenada-do-pdf.ts`
- Modify: `modules/nexo/lib/selo-render.ts:233-243`

**Interfaces:**
- Consumes: `type ItemPosicionado` de `server/nexo/selo-regiao.ts`.
- Produces:
  `normalizarItens(brutos: { texto: string; x: number; y: number }[], pagina: { largura: number; altura: number }): ItemPosicionado[]`
  — recebe pontos **já convertidos para o viewport** e devolve `ItemPosicionado` com `x`/`y` em 0..1.

- [ ] **Step 1: Escrever o módulo**

Criar `lib/coordenada-do-pdf.ts`:

```ts
/**
 * A COORDENADA DO PDF EM 0..1 — e por que ela mora sozinha.
 *
 * Esta conversão vivia dentro de `selo-render.ts`, que é `"use client"` porque
 * usa o canvas do browser. A bancada de medição precisa rodar o MESMO leitor
 * que a produção roda, e não pode importar um módulo client-only.
 *
 * Reimplementá-la do lado da bancada mediria uma CÓPIA do leitor. Um número
 * sobre uma cópia é pior que número nenhum: ele dá confiança sobre código que
 * não é o que roda.
 *
 * PURO (só `import type`): sem DOM, sem pdfjs, sem alias `@/`.
 */
import type { ItemPosicionado } from "../server/nexo/selo-regiao.ts";

/** Um item já convertido para o espaço do viewport, antes de normalizar. */
export interface PontoNoViewport {
  texto: string;
  /** x em pixels do viewport, origem no canto superior esquerdo. */
  x: number;
  /** y em pixels do viewport, crescendo para BAIXO. */
  y: number;
}

/**
 * Divide pelo tamanho da página. Página degenerada (largura ou altura zero)
 * devolve lista vazia em vez de `Infinity` espalhado pelas coordenadas: a caixa
 * do selo cairia no fallback de qualquer jeito, e `NaN` viajando silenciosamente
 * é pior que a ausência.
 */
export function normalizarItens(
  brutos: readonly PontoNoViewport[],
  pagina: { largura: number; altura: number },
): ItemPosicionado[] {
  if (!(pagina.largura > 0) || !(pagina.altura > 0)) return [];
  return brutos.map((b) => ({
    texto: b.texto,
    x: b.x / pagina.largura,
    y: b.y / pagina.altura,
  }));
}
```

- [ ] **Step 2: Fazer `selo-render.ts` consumir o módulo**

Em `modules/nexo/lib/selo-render.ts`, adicionar ao bloco de imports:

```ts
import { normalizarItens } from "@/lib/coordenada-do-pdf";
```

e substituir o bloco que hoje monta `itens` (o `brutos.map` com `convertToViewportPoint`) por:

```ts
  // A NORMALIZAÇÃO mora em `lib/coordenada-do-pdf`, fora deste módulo
  // client-only, para a bancada de medição poder rodar o MESMO leitor.
  const itens = normalizarItens(
    brutos.map((b, i) => {
      const [vx, vy] = viewport.convertToViewportPoint(
        b.item.transform![4],
        b.item.transform![5],
      );
      return { texto: marcados.has(i) ? "[ilegivel]" : textos[i].trim(), x: vx, y: vy };
    }),
    { largura: w, altura: h },
  );
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída, exit 0.

- [ ] **Step 4: Confirmar que a leitura não regrediu**

Run: `node scripts/test-nexo-selo-regiao.ts`
Expected: `31 teste(s) ok`

- [ ] **Step 5: Commit**

```bash
git add lib/coordenada-do-pdf.ts modules/nexo/lib/selo-render.ts
git diff --cached --stat
git commit -m "selo: a coordenada sai do modulo client-only para a bancada poder medir o leitor de verdade"
```

---

## Task 5: Bancada da leitura de selo

**Files:**
- Create: `scripts/mede-leitura-de-selo.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `normalizarItens` (Tarefa 4); `acharCaixaDoSelo`, `conteudoDoSelo` e `type ItemPosicionado` de `server/nexo/selo-regiao.ts`; `cleanStampDescription` de `lib/ld/stamp-parsing.ts`; `extractPdfText` de `lib/pdf-text.ts`.
- Produces: nada consumido por outra tarefa. É diagnóstico.

- [ ] **Step 1: Escrever a bancada**

Criar `scripts/mede-leitura-de-selo.ts`:

```ts
/**
 * A LEITURA DE SELO, MEDIDA CONTRA O QUE O ESCRITÓRIO ENTREGOU.
 *
 *   node scripts/mede-leitura-de-selo.ts    (== npm run mede:leitura)
 *
 * O gabarito não é hipótese: ele está impresso. Cada `*_ld_*.pdf` dos samples é
 * a Lista de Documentos que saiu para o cliente, e ela traz, por prancha, a
 * folha, o código do arquivo e a DESCRIÇÃO corretos.
 *
 * O casamento entre os dois lados é o código do arquivo (`040_26_his_001_a`) —
 * a única chave que existe nos dois.
 *
 * O LIMITE: mede a metade DETERMINÍSTICA da leitura. A contribuição do modelo
 * de visão só se mede gastando token. Hoje isso pesa pouco (com a fonte sã,
 * `tituloDaPrancha` devolve a leitura da geometria e o modelo só decide acento),
 * mas o número NÃO é "a leitura está X% certa" — é "a parte que não custa nada
 * está X% certa".
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";

import { extractPdfText } from "../lib/pdf-text.ts";
import { normalizarItens } from "../lib/coordenada-do-pdf.ts";
import {
  acharCaixaDoSelo,
  conteudoDoSelo,
  type ItemPosicionado,
} from "../server/nexo/selo-regiao.ts";
import { cleanStampDescription } from "../lib/ld/stamp-parsing.ts";

const RAIZ = "docs/samples";

interface LinhaDoGabarito {
  folha: string;
  arquivo: string;
  descricao: string;
}

/**
 * As linhas da LD entregue. Uma linha que começa com `NN/TT` abre um registro;
 * linha que não começa assim é CONTINUAÇÃO da descrição anterior — descrições
 * longas quebram em duas e três linhas no PDF.
 */
function lerGabarito(texto: string): LinhaDoGabarito[] {
  const linhas: LinhaDoGabarito[] = [];
  for (const bruta of texto.split("\n")) {
    const linha = bruta.trim();
    if (!linha) continue;
    const m = /^(\d+\/\d+)\s+(\S+)\s*(.*)$/.exec(linha);
    if (m) {
      linhas.push({ folha: m[1], arquivo: m[2], descricao: m[3].trim() });
      continue;
    }
    const ultima = linhas[linhas.length - 1];
    // Só continua enquanto a linha parecer texto de descrição: o rodapé do
    // documento vem depois da tabela e não pode ser colado na última prancha.
    if (ultima && !/^(P:|Direitos|SECRETARIA|PREFEITURA)/i.test(linha)) {
      ultima.descricao = `${ultima.descricao} ${linha}`.trim();
    }
  }
  return linhas;
}

/** Sem acento, sem pontuação, minúsculo — para a segunda contagem. */
function frouxo(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Os itens posicionados da primeira página de uma prancha, pelo leitor real. */
async function itensDaPrancha(caminho: string): Promise<ItemPosicionado[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(readFileSync(caminho)),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const brutos = [];
  for (const raw of content.items) {
    const item = raw as { str?: string; transform?: number[] };
    const str = typeof item.str === "string" ? item.str.trim() : "";
    if (!str || !item.transform) continue;
    const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
    brutos.push({ texto: str, x: vx, y: vy });
  }
  return normalizarItens(brutos, { largura: viewport.width, altura: viewport.height });
}

function todasAsLds(dir: string, achados: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) todasAsLds(p, achados);
    else if (/_ld_.*\.pdf$/i.test(e.name)) achados.push(p);
  }
  return achados;
}

let comparadas = 0;
let exatas = 0;
let frouxas = 0;
let semPrancha = 0;
let semAncora = 0;
const divergencias: string[] = [];

for (const ld of todasAsLds(RAIZ)) {
  const gabarito = lerGabarito((await extractPdfText(readFileSync(ld))).text);
  const pasta = dirname(ld);

  for (const linha of gabarito) {
    const prancha = join(pasta, `${linha.arquivo}.pdf`);
    if (!existsSync(prancha)) {
      semPrancha += 1;
      continue;
    }
    const itens = await itensDaPrancha(prancha);
    const { ancoras } = acharCaixaDoSelo(itens);
    if (ancoras < 3) semAncora += 1;

    const lido = cleanStampDescription(conteudoDoSelo(itens));
    comparadas += 1;
    if (lido === linha.descricao) {
      exatas += 1;
      frouxas += 1;
    } else if (frouxo(lido) === frouxo(linha.descricao)) {
      frouxas += 1;
      divergencias.push(`~ ${basename(prancha)}\n    lido=${lido}\n    espe=${linha.descricao}`);
    } else {
      divergencias.push(`X ${basename(prancha)}\n    lido=${lido}\n    espe=${linha.descricao}`);
    }
  }
}

const pct = (n: number) => (comparadas ? `${Math.round((n / comparadas) * 100)}%` : "—");
console.log(`pranchas comparadas: ${comparadas}`);
console.log(`descrição igual EXATA:            ${exatas}/${comparadas} (${pct(exatas)})`);
console.log(`descrição igual s/ acento e pont: ${frouxas}/${comparadas} (${pct(frouxas)})`);
console.log(`caiu no quadrante de reserva (<3 âncoras): ${semAncora}`);
console.log(`linha do gabarito sem prancha no disco:    ${semPrancha}`);
if (divergencias.length) {
  console.log(`\ndivergências (X = texto diferente, ~ = só acento/pontuação):`);
  for (const d of divergencias) console.log(`  ${d}`);
}
console.log(
  "\nLIMITE: mede a metade DETERMINÍSTICA. A contribuição do modelo de visão",
);
console.log("não entra aqui — este número não é 'a leitura está X% certa'.");
```

- [ ] **Step 2: Rodar a bancada**

Run: `node scripts/mede-leitura-de-selo.ts`
Expected: imprime as duas contagens de descrição e a lista de divergências. Sem PASS/FAIL — o resultado é o dado. Pode demorar alguns minutos (centenas de PDFs).

- [ ] **Step 3: Registrar o script**

Em `package.json`:

```json
    "mede:leitura": "node scripts/mede-leitura-de-selo.ts",
```

- [ ] **Step 4: Commit com o número medido no corpo da mensagem**

```bash
git add scripts/mede-leitura-de-selo.ts package.json
git diff --cached --stat
git commit -m "bancada: a leitura de selo medida contra as LDs que o escritorio entregou"
```

---

## Task 6: A pasta é o projeto — a derivação

**Files:**
- Create: `modules/nexo/lib/pasta-do-projeto.ts`
- Create: `scripts/test-pasta-do-projeto.ts`
- Modify: `modules/nexo/state/conversation-store.tsx:296-305`
- Modify: `package.json`

**Interfaces:**
- Consumes: `centroDeCustoDaAuditoria(codigo, prefeituraOuMunicipio)` de `lib/audit-identity.ts`; `siglaDaDisciplina(disciplina)` de `modules/nexo/lib/disciplina-cor.ts`.
- Produces:
  `pastaDoProjeto(codigo: string | null | undefined, prefeitura: string | null | undefined): string`
  — devolve `"084-25-CRICIUMA"` ou `""`.
  `nomeDoVolume(disciplinas: readonly (string | null | undefined)[]): string`
  — devolve `"MET"` ou `"MET · HIS · INC"` ou `""`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `scripts/test-pasta-do-projeto.ts`:

```ts
/**
 * A PASTA DO PROJETO e o NOME DA CONVERSA. Núcleo puro → node cru.
 *
 *   node scripts/test-pasta-do-projeto.ts
 */
import assert from "node:assert/strict";

import { nomeDoVolume, pastaDoProjeto } from "../modules/nexo/lib/pasta-do-projeto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

test("código e prefeitura viram a pasta, com hífen", () => {
  assert.equal(pastaDoProjeto("084_25", "PREFEITURA MUNICIPAL DE CRICIÚMA"), "084-25-CRICIUMA");
  assert.equal(pastaDoProjeto("084-25", "Criciúma"), "084-25-CRICIUMA");
});

test("SEM PREFEITURA NÃO HÁ PASTA — nunca meio nome", () => {
  // Uma pasta "084-25" que depois vira "084-25-CRICIUMA" muda de identidade
  // debaixo de quem está usando, e quem já a abriu perde a referência.
  assert.equal(pastaDoProjeto("084_25", null), "");
  assert.equal(pastaDoProjeto("084_25", "  "), "");
});

test("sem código não há pasta", () => {
  assert.equal(pastaDoProjeto(null, "Criciúma"), "");
});

test("uma disciplina vira a sigla", () => {
  assert.equal(nomeDoVolume(["metalica"]), "MET");
});

test("volume misto lista as siglas, sem repetir e na ordem de entrada", () => {
  assert.equal(
    nomeDoVolume(["metalica", "hidrossanitario", "metalica", "incendio"]),
    "MET · HIS · INC",
  );
});

test("folha sem disciplina não entra no nome", () => {
  assert.equal(nomeDoVolume(["metalica", null, "", undefined]), "MET");
});

test("nenhuma disciplina devolve vazio", () => {
  assert.equal(nomeDoVolume([]), "");
  assert.equal(nomeDoVolume([null, ""]), "");
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-pasta-do-projeto.ts`
Expected: FALHA com `Cannot find module .../pasta-do-projeto.ts`.

- [ ] **Step 3: Escrever o módulo**

Criar `modules/nexo/lib/pasta-do-projeto.ts`:

```ts
/**
 * COMO O PROJETO SE CHAMA NO HISTÓRICO — a pasta e a conversa.
 *
 * Núcleo PURO → `node scripts/test-pasta-do-projeto.ts`.
 *
 * O histórico deixou de ser uma lista de conversas e passou a ser a lista dos
 * PROJETOS. A pasta é o projeto — `084-25-CRICIUMA`, que é como o escritório o
 * chama: está na pasta de rede, no carimbo e no e-mail. Dentro dela ficam o
 * volume e a auditoria do memorial, lado a lado.
 *
 * Antes havia DUAS derivações e nenhuma fazia isto: o volume derivava
 * `folderKey` = só o código (`084_25`, sem prefeitura), e a auditoria derivava
 * o TÍTULO como centro de custo. A função que monta o nome certo já existia,
 * usada no lugar errado.
 */
import { centroDeCustoDaAuditoria } from "../../../lib/audit-identity.ts";
import { siglaDaDisciplina } from "./disciplina-cor.ts";

/**
 * `084-25-CRICIUMA`, ou `""` quando falta código OU prefeitura.
 *
 * SEM PREFEITURA NÃO HÁ PASTA, e isso é decisão, não limitação: uma pasta
 * `084-25` que amanhã vira `084-25-CRICIUMA` muda de identidade debaixo de quem
 * está usando. A conversa fica em "Sem pasta" até a prefeitura ser decidida —
 * que é a MESMA decisão que a capa e a separatriz esperam.
 *
 * O carimbo entrega `084_25`; a normalização para hífen acontece AQUI, e não em
 * cada chamador, senão duas telas escrevem o mesmo projeto de dois jeitos.
 */
export function pastaDoProjeto(
  codigo: string | null | undefined,
  prefeitura: string | null | undefined,
): string {
  const cc = (codigo ?? "").trim();
  const pref = (prefeitura ?? "").trim();
  if (!cc || !pref) return "";
  return centroDeCustoDaAuditoria(cc.replace(/_/g, "-"), pref);
}

/** O separador entre siglas. Ponto médio, não vírgula: não parece uma frase. */
const ENTRE_SIGLAS = " · ";

/**
 * `MET`, ou `MET · HIS · INC` no volume misto.
 *
 * O misto é o CASO COMUM, não a exceção: seis dos oito volumes reais do
 * escritório misturam disciplinas. Um nome que só funcionasse com uma
 * disciplina estaria errado na maioria das vezes.
 *
 * A ordem é a de ENTRADA, não alfabética: é a ordem em que as pranchas foram
 * anexadas, e é por ela que quem montou o volume o reconhece.
 */
export function nomeDoVolume(
  disciplinas: readonly (string | null | undefined)[],
): string {
  const vistas: string[] = [];
  for (const d of disciplinas) {
    const sigla = siglaDaDisciplina(d);
    if (sigla && !vistas.includes(sigla)) vistas.push(sigla);
  }
  return vistas.join(ENTRE_SIGLAS);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node scripts/test-pasta-do-projeto.ts`
Expected: `7 teste(s) passaram.`

- [ ] **Step 5: Ligar no store**

Em `modules/nexo/state/conversation-store.tsx`, importar:

```ts
import { nomeDoVolume, pastaDoProjeto } from "../lib/pasta-do-projeto";
```

Substituir a função `deriveFolderKey` (linhas 296-305) por:

```ts
/**
 * A PASTA e o NOME da conversa, derivados dos selos.
 *
 * `deriveFolderKey` devolvia só o CÓDIGO (`084_25`), sem a prefeitura — uma
 * pasta que não identifica o projeto, porque dois municípios podem ter o mesmo
 * número de contrato. Agora a pasta é o centro de custo, e é a mesma chave que
 * a auditoria de memorial usa: o volume e a auditoria do MESMO projeto passam a
 * cair no MESMO lugar.
 */
function derivarDoProjeto(seloResults: SeloResult[]): {
  folderKey?: string;
  nome: string;
} {
  if (seloResults.length === 0) return { nome: "" };
  const facts = seloResults.map((r) => ({
    fileName: r.fileName,
    arquivo: r.extraction?.arquivo ?? null,
    disciplina: r.extraction?.disciplina ?? null,
    obra: r.extraction?.obra ?? null,
  }));
  const resumo = summarizeSelos(facts);
  const prefeitura = seloResults.find((r) => r.extraction?.cliente?.trim())?.extraction
    ?.cliente;
  const folderKey = pastaDoProjeto(resumo.codigo, prefeitura);
  return {
    ...(folderKey ? { folderKey } : {}),
    nome: nomeDoVolume(seloResults.map((r) => r.extraction?.disciplina)),
  };
}
```

E na função de gravação (linha ~462), substituir:

```ts
    const folderKey = deriveFolderKey(s.seloResults);
```

por:

```ts
    const { folderKey, nome: nomeDoConjunto } = derivarDoProjeto(s.seloResults);
```

e, na montagem de `rec`, trocar `title: s.title` por:

```ts
      /*
       * Dentro da pasta do projeto, a conversa se chama pelo que ELA é: as
       * siglas das disciplinas do volume. O nome do projeto já está na pasta —
       * repeti-lo na linha seria gastar a coluna com o que o cabeçalho já diz.
       */
      title: nomeDoConjunto || s.title,
```

- [ ] **Step 6: A auditoria de memorial entra na MESMA pasta**

Sem isto, o volume e a auditoria do mesmo projeto caem em lugares diferentes — e
reunir os dois é a razão de a pasta existir (Seção 4.2 do spec). A conversa de
memorial não tem selos, então a identidade vem da classificação.

Ainda em `conversation-store.tsx`, logo após a chamada a `derivarDoProjeto`,
acrescentar:

```ts
    /*
     * O MEMORIAL CAI NA PASTA DO MESMO PROJETO.
     *
     * A conversa de auditoria não tem selo nenhum, então `derivarDoProjeto`
     * devolve vazio — e ela ia para "Sem pasta" enquanto o volume do MESMO
     * projeto tinha a sua. Reunir os dois é a razão de a pasta existir.
     *
     * A identidade vem da classificação do memorial, que já roda antes da
     * auditoria começar, e passa pela MESMA `pastaDoProjeto`: duas derivações
     * do mesmo nome é como as duas metades do produto discordam sobre onde um
     * projeto mora.
     */
    const pastaDoMemorial = pastaDoProjeto(
      s.identidade?.codigo,
      s.identidade?.orgao || s.identidade?.municipio,
    );
    const pasta = folderKey || pastaDoMemorial;
```

Trocar, na montagem de `rec`, `...(folderKey ? { folderKey } : {})` por
`...(pasta ? { folderKey: pasta } : {})`.

E o título: a conversa de memorial se chama `Memorial` dentro da pasta, porque o
nome do projeto já está no cabeçalho dela.

```ts
      /*
       * Dentro da pasta, a conversa se chama pelo que ELA é: as siglas das
       * disciplinas do volume, ou `Memorial` na auditoria. Repetir o nome do
       * projeto na linha gastaria a coluna com o que o cabeçalho já diz.
       *
       * FORA de pasta o nome longo volta: sem cabeçalho de projeto, `Memorial`
       * sozinho não distingue duas auditorias.
       */
      title: pasta ? nomeDoConjunto || (s.memorialMeta ? "Memorial" : s.title) : s.title,
```

(substitui a linha `title: nomeDoConjunto || s.title,` do Step 5)

Acrescentar ao teste `scripts/test-pasta-do-projeto.ts`, antes do `console.log`
final:

```ts
test("memorial e volume do mesmo projeto dão a MESMA pasta", () => {
  const doVolume = pastaDoProjeto("084_25", "PREFEITURA MUNICIPAL DE CRICIÚMA");
  const doMemorial = pastaDoProjeto("084-25", "Criciúma - SC");
  assert.equal(doVolume, doMemorial);
  assert.equal(doVolume, "084-25-CRICIUMA");
});
```

- [ ] **Step 7: Registrar o script e conferir que nada regrediu**

Em `package.json`:

```json
    "test:nexo:pasta": "node scripts/test-pasta-do-projeto.ts",
```

Run: `node scripts/test-nexo-titulo-do-selo.ts && node scripts/test-pasta-do-projeto.ts && npx tsc --noEmit -p tsconfig.json`
Expected: os dois suites verdes (o de pasta agora com 8 testes) e o typecheck sem saída.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/lib/pasta-do-projeto.ts scripts/test-pasta-do-projeto.ts modules/nexo/state/conversation-store.tsx package.json
git diff --cached --stat
git commit -m "historico: a pasta passa a ser o projeto, e a conversa a disciplina"
```

---

## Task 7: A barra lateral de um nível

**Files:**
- Modify: `modules/nexo/lib/group-conversations.ts`
- Modify: `modules/nexo/components/NexoSidebar.tsx:430-520`
- Create: `scripts/test-group-conversations.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `tipoDoResumo(resumo)` e `type ConversationSummary` — já existentes.
- Produces:
  `groupConversations(conversations, query, tipo?): ConversationGroup[]` — assinatura **mantida**, comportamento mudado: com `tipo` definido, o filtro esconde ITENS e a pasta some quando fica sem item visível.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-group-conversations.ts`:

```ts
/**
 * O AGRUPAMENTO da barra lateral — a pasta manda, o tipo é etiqueta.
 *
 *   node scripts/test-group-conversations.ts
 */
import assert from "node:assert/strict";

import { groupConversations } from "../modules/nexo/lib/group-conversations.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

const conversa = (
  id: string,
  title: string,
  folderKey: string | undefined,
  tipo: "volume" | "auditoria",
) => ({ id, title, tipo, updatedAt: 1, createdAt: 1, ...(folderKey ? { folderKey } : {}) }) as never;

const LISTA = [
  conversa("1", "MET · HIS", "084-25-CRICIUMA", "volume"),
  conversa("2", "Memorial", "084-25-CRICIUMA", "auditoria"),
  conversa("3", "EST", "040-26-CHAPECO", "volume"),
  conversa("4", "Sem projeto", undefined, "volume"),
];

test("volume e auditoria do mesmo projeto caem na MESMA pasta", () => {
  const g = groupConversations(LISTA, "");
  const criciuma = g.find((x) => x.key === "084-25-CRICIUMA");
  assert.equal(criciuma?.items.length, 2, "o projeto aparece UMA vez, com os dois trabalhos");
});

test("o filtro esconde ITENS, não a pasta inteira", () => {
  const g = groupConversations(LISTA, "", "auditoria");
  const criciuma = g.find((x) => x.key === "084-25-CRICIUMA");
  assert.equal(criciuma?.items.length, 1);
  assert.equal(criciuma?.items[0].title, "Memorial");
});

test("pasta que fica sem item visível SOME", () => {
  const g = groupConversations(LISTA, "", "auditoria");
  assert.equal(
    g.find((x) => x.key === "040-26-CHAPECO"),
    undefined,
    "pasta vazia na tela é ruído",
  );
});

test("conversa sem pasta vive no grupo nulo", () => {
  const g = groupConversations(LISTA, "");
  assert.equal(g.find((x) => x.key === null)?.items.length, 1);
});

test("a busca continua valendo dentro das pastas", () => {
  const g = groupConversations(LISTA, "memorial");
  assert.equal(g.length, 1);
  assert.equal(g[0].key, "084-25-CRICIUMA");
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-group-conversations.ts`
Expected: FALHA em "volume e auditoria do mesmo projeto caem na MESMA pasta" — hoje o filtro por tipo é aplicado antes do agrupamento e a pasta nunca reúne os dois.

Nota: com `tipo` ausente o comportamento atual já reúne os dois; o teste que falha primeiro pode ser o do filtro. Qualquer um dos dois falhando é o esperado — o que não pode é passar tudo de primeira.

- [ ] **Step 3: Reescrever o cabeçalho e a função**

Em `modules/nexo/lib/group-conversations.ts`, substituir o comentário de topo por:

```ts
/**
 * Agrupa as conversas da barra por PASTA — e a pasta é o PROJETO
 * (`084-25-CRICIUMA`). Núcleo puro (só `import type`) → node cru.
 *
 * A v2 desenhava DUAS SEÇÕES no topo (montagem / auditoria) e pastas dentro de
 * cada uma. O efeito é que o projeto aparecia em dois lugares: o volume numa
 * seção, a auditoria do memorial do MESMO projeto na outra. Quem trabalha
 * pensa "o 084-25", não "a parte de montagem do 084-25".
 *
 * Agora há um nível só. O tipo de trabalho continua existindo, mas como
 * ETIQUETA: o filtro esconde ITENS dentro das pastas, e a pasta que fica sem
 * item visível some — pasta vazia na tela é ruído, não informação.
 */
```

e substituir o corpo de `groupConversations` por:

```ts
export function groupConversations(
  conversations: ConversationSummary[],
  query: string,
  /** Recorte por etiqueta. Ausente = tudo. */
  tipo?: TipoDeTrabalho,
): ConversationGroup[] {
  const q = query.trim().toLowerCase();
  const groups: ConversationGroup[] = [];
  const index = new Map<string, number>();

  for (const c of conversations) {
    if (tipo !== undefined && tipoDoResumo(c) !== tipo) continue;
    if (q !== "" && !c.title.toLowerCase().includes(q)) {
      // A busca cobre também o NOME DA PASTA: procurar por "criciuma" tem de
      // achar o projeto, e o nome do projeto não está no título da conversa —
      // ele está na pasta, que é justamente a mudança desta versão.
      if (!(c.folderKey ?? "").toLowerCase().includes(q)) continue;
    }
    const key = c.folderKey ?? null;
    const mapKey = key ?? "__none__";
    let gi = index.get(mapKey);
    if (gi === undefined) {
      gi = groups.length;
      index.set(mapKey, gi);
      groups.push({ key, items: [] });
    }
    groups[gi].items.push(c);
  }

  /*
   * "Sem pasta" vai para o FIM. São as conversas cujo projeto ainda não se
   * identificou (sem código, ou sem prefeitura decidida) — é trabalho em aberto,
   * não um projeto, e no topo empurraria os projetos reais para baixo.
   */
  return groups.sort((a, b) => (a.key === null ? 1 : 0) - (b.key === null ? 1 : 0));
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node scripts/test-group-conversations.ts`
Expected: `5 teste(s) passaram.`

- [ ] **Step 5: Um nível na barra — remover o laço EXTERNO**

O `<details>` de pasta, com o botão de apagar e a confirmação, **já existe**
dentro de cada seção (a partir da linha ~537). Não reescreva nada dele: o
trabalho é tirar a seção de cima e deixar a pasta subir um nível.

**5a.** Linhas 237-244 — trocar o mapa por tipo por um agrupamento só:

```ts
  /** As pastas do histórico. A pasta é o PROJETO; o filtro recorta por dentro. */
  const grupos = useMemo(
    () => groupConversations(conversations, query, filtro === "tudo" ? undefined : filtro),
    [conversations, query, filtro],
  );
```

**5b.** Linhas 246-251 — `secoesVisiveis` e `achou` saem; `noMatch` passa a
olhar o agrupamento único:

```ts
  const empty = conversations.length === 0;
  const noMatch = !empty && query.trim() !== "" && grupos.length === 0;
```

**5c.** Linhas 200-203 e 276-283 — `recolhidas`, `setRecolhidas` e
`alternarSecao` **saem inteiros**. Eles recolhiam SEÇÕES, e seção não existe
mais; a pasta já recolhe sozinha pelo `<details>` nativo. Remover também o
`useEffect` que persiste essa preferência, se houver, e o import de
`TipoDeTrabalho` caso fique sem uso.

**5d.** Linhas 471-536 — apagar o invólucro de seção: a linha
`secoesVisiveis.map((s) => {`, o `const grupos = gruposPorTipo[s.tipo]`, o
`total`, o `podeRecolher`, o `recolhida`, o `Cabecalho` inteiro (do `<Cabecalho`
até `</Cabecalho>`) e o parágrafo de seção vazia. O que sobra é o
`grupos.map((g) => {` que já estava lá dentro, agora renderizado direto:

```tsx
        {!empty && !noMatch && grupos.map((g) => {
```

Fechar o bloco com `})}` no lugar onde o `secoesVisiveis.map` fechava — o laço
interno perde um nível de aninhamento, não muda de forma.

**5e.** Linha ~545 — a chave da pasta perde o prefixo de tipo:

```ts
                    /*
                     * A chave da pasta é a PASTA. Ela levava o tipo junto
                     * (`volume:084-25`) porque o mesmo projeto existia duas
                     * vezes, uma em cada seção. Agora existe uma vez só, e o
                     * prefixo faria a confirmação de apagar não casar com nada.
                     */
                    const idDaPasta = g.key ?? "__none__";
```

**5f.** O rótulo da pasta já é o `g.key`, que agora vem `084-25-CRICIUMA` em
lugar de `084_25` — a Tarefa 6 mudou a derivação e este passo não precisa tocar
no texto.

- [ ] **Step 6: Typecheck e olhar a tela**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída, exit 0.

Subir `npm run dev`, abrir `/nexo` e confirmar: uma pasta por projeto, contador
à direita, conversas dentro, "Sem pasta" no fim, e o filtro escondendo itens sem
sumir com a pasta que ainda tem item do outro tipo.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/lib/group-conversations.ts modules/nexo/components/NexoSidebar.tsx scripts/test-group-conversations.ts package.json
git diff --cached --stat
git commit -m "lateral: o projeto vira a unidade, e o tipo de trabalho vira etiqueta"
```

---

## Task 8: O card que se lê

**Files:**
- Modify: `modules/nexo/components/FolhaNode.tsx:161-163`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: nada consumido por outra tarefa.

- [ ] **Step 1: Medir a descrição mais longa dos samples**

O teto não é escolhido, é medido. Rode:

```bash
node scripts/mede-leitura-de-selo.ts > /tmp/leitura.txt 2>&1
grep "espe=" /tmp/leitura.txt | sed 's/.*espe=//' | awk '{ print length, $0 }' | sort -rn | head -3
```

A primeira coluna é o número de caracteres da maior descrição real — o caso que
o card precisa acomodar. Referência conhecida: `PLANTA BAIXA SANITÁRIO PAVIMENTO
COBERTURA – PARTE I E PAVIMENTO RESERVATÓRIO E TOPO RESERVATÓRIO`, 104
caracteres, que a 10px cabe em 4 linhas na largura do nó.

- [ ] **Step 2: Trocar o clamp por altura fixa com rolagem**

Em `modules/nexo/components/FolhaNode.tsx`, substituir:

```tsx
      <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight" title={data.titulo}>
        {data.titulo || "—"}
      </p>
```

por:

```tsx
      {/*
        SEM `line-clamp-2`. Com 44 folhas na tela, conferir o título era abrir
        cada uma — e conferir é justamente o que se vai fazer ali. Reticências
        escondem exatamente a metade que o corte do carimbo comia ("PLANTA DE
        IMPLANTAÇÃO" chegava como "PLANTA DE"), e um defeito que se esconde
        atrás de "…" é um defeito que ninguém acha.

        Altura FIXA, não `auto`: cartão de altura variável vira escada e destrói
        a varredura visual, que é a razão desta tela existir. O teto cabe a
        descrição mais longa dos projetos reais; acima dele, rola por dentro.
      */}
      <p
        className="mt-0.5 max-h-12 overflow-y-auto text-[10px] leading-tight"
        title={data.titulo}
      >
        {data.titulo || "—"}
      </p>
```

Se o número medido no Step 1 não couber em `max-h-12` (48px ≈ 4 linhas a 10px),
subir para `max-h-16` e ajustar a altura do nó no canvas junto, para a grade não
descolar.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: sem saída, exit 0.

- [ ] **Step 4: Provar na tela, não no DOM**

Subir `npm run dev`, abrir um volume com pranchas de título longo e confirmar
que o texto aparece inteiro **medindo a caixa contra a janela** — asserção de
DOM passa verde com o elemento fora da tela.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/FolhaNode.tsx
git diff --cached --stat
git commit -m "folha: o titulo cortado em duas linhas escondia o proprio defeito"
```

---

## Ordem e corte natural

| # | Tarefa | Peso | Depende de |
|---|---|---|---|
| 1 | Vazamento da prefeitura | curta | — |
| 2 | Portão de coerência | média | 1 |
| 3 | Bancada do `motivo` | média | — |
| 4 | Módulo puro da coordenada | curta | — |
| 5 | Bancada da leitura | longa | 4 |
| 6 | Derivação da pasta | média | — |
| 7 | Barra lateral de um nível | longa | 6 |
| 8 | Card legível | curta | — |

**O corte natural do dia é depois da Tarefa 5.** As Tarefas 1 e 2 fecham o
defeito que pode mandar documento errado ao cliente; 3, 4 e 5 produzem os
números que dirigem o resto. As Tarefas 6 e 7 são a refatoração do histórico e
sozinhas valem meio dia — se o tempo apertar, elas são o que fica para amanhã, e
nenhuma tarefa anterior depende delas.
