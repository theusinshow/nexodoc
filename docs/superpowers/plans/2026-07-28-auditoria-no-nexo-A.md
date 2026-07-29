# O agente entende memorial (sub-projeto A) — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anexar um memorial no Nexo e pedir a auditoria passa a rodar a auditoria de verdade — hoje o agente responde "Primeiro anexe as pranchas" e nunca chega a pensar.

**Architecture:** A guarda de selos vazios vira uma REGRA de fatos: o agente passa a ter duas fontes (selos das pranchas e classificação do memorial) e só recusa quando não há nenhuma. A regra é um módulo puro, testado em Node pelado. O cliente passa a enviar os fatos do memorial junto da mensagem, e o cartão de auditoria — que já existe e já chama o motor — passa a achar o gabarito quando não há pranchas.

**Tech Stack:** Next.js (App Router), React 19 + React Compiler, TypeScript, testes puros em `scripts/test-nexo-*.ts` rodados por `node`, Playwright para o portão de navegador.

**Spec:** `docs/superpowers/specs/2026-07-28-auditoria-no-nexo-design.md`

## Global Constraints

- **Nunca `git add -A`.** Listar os arquivos, sempre.
- Commitar direto na `main` e `git push origin main`. Sem branch, sem PR.
- Mensagem de commit **sem acentos**, terminando em `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Módulo puro (`server/nexo/agent/fatos.ts`): **nenhum import de runtime** — roda em `node` direto, e por isso os imports do TESTE terminam em `.ts`. No módulo, só `import type`.
- `npx tsc --noEmit` e `npx eslint modules/nexo server/nexo app/api/nexo` limpos em toda task que mexa em `.ts`/`.tsx`.
- **O agente NUNCA gera documento.** Ele interpreta intenção e preenche parâmetros; quem gera são as rotas determinísticas, no clique de confirmação. Nada neste plano muda isso.
- O padrão do produto é **afirma-fato / pergunta-decisão**: o prompt injeta os fatos lidos e proíbe re-perguntá-los; só pergunta o que é decisão.

---

### Task 1: A regra de fatos (módulo puro)

Hoje `app/api/nexo/agent/route.ts:66` recusa o turno quando `selos.length === 0`.
A recusa vira uma REGRA: com o que o agente pode falar, dado o que a conversa tem.

**Files:**
- Create: `server/nexo/agent/fatos.ts`
- Create: `scripts/test-nexo-fatos.ts`
- Modify: `package.json` (script `test:nexo:fatos`)

**Interfaces:**
- Consumes: nada (puro).
- Produces: `FatosDoMemorial`, `FatosDaConversa`, `fatosDaConversa(selos, memorial)`. A Task 2 usa `fatosDaConversa`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-nexo-fatos.ts`:

```ts
/**
 * Teste da REGRA DE FATOS do agente: sobre o que ele pode falar, dado o que a
 * conversa tem. Substitui a guarda "sem selos, recusa" — que impedia auditar
 * memorial, porque memorial não tem selo de prancha.
 *
 *   node scripts/test-nexo-fatos.ts   (== npm run test:nexo:fatos)
 */
import assert from "node:assert/strict";

import { fatosDaConversa } from "../server/nexo/agent/fatos.ts";

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

const MEMORIAL = {
  fileName: "017_26_md_geral_c.pdf",
  obra: "Centro Comunitário Primeira Linha",
  municipio: "Criciúma",
  codigo: "017-26",
};

test("sem selos e sem memorial, o agente NÃO tem sobre o que falar", () => {
  const f = fatosDaConversa([], null);
  assert.equal(f.temFatos, false);
  assert.equal(f.temSelos, false);
  assert.equal(f.temMemorial, false);
});

test("só memorial: tem fatos, e o gabarito vem do próprio documento", () => {
  const f = fatosDaConversa([], MEMORIAL);
  assert.equal(f.temFatos, true);
  assert.equal(f.temMemorial, true);
  assert.equal(f.gabarito.obra, MEMORIAL.obra);
  assert.equal(f.gabarito.origem, "memorial");
});

test("só selos: tem fatos, sem memorial para auditar", () => {
  const f = fatosDaConversa([{ obra: "OBRA DAS PRANCHAS" }], null);
  assert.equal(f.temFatos, true);
  assert.equal(f.temSelos, true);
  assert.equal(f.temMemorial, false);
  assert.equal(f.gabarito.origem, "selos");
});

test("OS DOIS: o carimbo manda no gabarito — fonte independente do memorial", () => {
  // É o caso mais forte do produto: o memorial pode estar inteiro com o nome de
  // outra obra, e é o carimbo da prancha que denuncia.
  const f = fatosDaConversa([{ obra: "OBRA DAS PRANCHAS" }], MEMORIAL);
  assert.equal(f.temSelos, true);
  assert.equal(f.temMemorial, true);
  assert.equal(f.gabarito.obra, "OBRA DAS PRANCHAS");
  assert.equal(f.gabarito.origem, "selos");
});

test("memorial sem obra legível não inventa gabarito", () => {
  const f = fatosDaConversa([], { fileName: "x.pdf" });
  assert.equal(f.temFatos, true);
  assert.equal(f.gabarito.obra, null);
  assert.equal(f.gabarito.origem, "nenhuma");
});

test("obra em branco ou só espaço conta como ausente", () => {
  const f = fatosDaConversa([], { fileName: "x.pdf", obra: "   " });
  assert.equal(f.gabarito.obra, null);
});

console.log(`\n${passed} teste(s) de fatos OK`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-nexo-fatos.ts`
Expected: FALHA no import — `Cannot find module '.../fatos.ts'`.

- [ ] **Step 3: Escrever o módulo**

Criar `server/nexo/agent/fatos.ts`:

```ts
/**
 * Sobre o que o agente pode falar, dado o que a conversa tem.
 *
 * Substitui a guarda "sem selos, recusa o turno" (antiga
 * `app/api/nexo/agent/route.ts:66`), que existia quando o Nexo só montava LD e
 * capa a partir de carimbos. Um memorial não tem selo de prancha, então aquela
 * guarda impedia auditar memorial — o agente respondia "primeiro anexe as
 * pranchas" e nunca chegava a pensar.
 *
 * A guarda não some: vira o caso `temFatos: false`, que é o ÚNICO em que o
 * agente realmente não tem sobre o que falar. Sem ela, ele voltaria a propor LD
 * onde não há prancha — o defeito que o padrão "afirma-fato / pergunta-decisão"
 * existe para evitar.
 *
 * PURO: nenhum import de runtime — roda em Node pelado no teste.
 */

/** O que a classificação determinística leu do memorial anexado. */
export interface FatosDoMemorial {
  fileName: string;
  obra?: string | null;
  municipio?: string | null;
  codigo?: string | null;
  endereco?: string | null;
}

/** De onde veio a régua de identidade da auditoria. */
export type OrigemDoGabarito = "selos" | "memorial" | "nenhuma";

export interface FatosDaConversa {
  temFatos: boolean;
  temSelos: boolean;
  temMemorial: boolean;
  gabarito: {
    obra: string | null;
    municipio: string | null;
    origem: OrigemDoGabarito;
  };
}

/** Texto que só conta quando tem conteúdo — evita gabarito em branco. */
function texto(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

/**
 * `selos` chega como a lista já lida dos carimbos (só o que interessa aqui:
 * a obra). `memorial` é a classificação do documento, ou `null`.
 *
 * Quando há os DOIS, o carimbo manda no gabarito: ele é fonte INDEPENDENTE do
 * memorial, e é isso que pega o memorial emitido com o nome de outra obra —
 * o erro real que originou o projeto.
 */
export function fatosDaConversa(
  selos: readonly { obra?: string | null }[],
  memorial: FatosDoMemorial | null,
): FatosDaConversa {
  const obraDosSelos = texto(selos.find((s) => texto(s.obra))?.obra);
  const obraDoMemorial = texto(memorial?.obra);

  const origem: OrigemDoGabarito = obraDosSelos
    ? "selos"
    : obraDoMemorial
      ? "memorial"
      : "nenhuma";

  return {
    temFatos: selos.length > 0 || memorial !== null,
    temSelos: selos.length > 0,
    temMemorial: memorial !== null,
    gabarito: {
      obra: obraDosSelos ?? obraDoMemorial,
      municipio: texto(memorial?.municipio),
      origem,
    },
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node scripts/test-nexo-fatos.ts`
Expected: 6 linhas `ok` e `6 teste(s) de fatos OK`.

- [ ] **Step 5: Registrar o script**

Em `package.json`, abaixo de `"test:nexo:drop"`:

```json
    "test:nexo:fatos": "node scripts/test-nexo-fatos.ts"
```

(atenção à vírgula da linha anterior)

- [ ] **Step 6: Verificar**

Run: `npm run test:nexo:fatos && npx tsc --noEmit`
Expected: `6 teste(s) de fatos OK` e tipos limpos.

- [ ] **Step 7: Commit**

```bash
git add server/nexo/agent/fatos.ts scripts/test-nexo-fatos.ts package.json
git commit -m "Nexo: a guarda de selos vira REGRA de fatos do agente

Sem selos o agente recusava o turno e respondia 'primeiro anexe as pranchas' --
memorial nao tem selo de prancha, entao auditar memorial pelo chat era
impossivel. A recusa vira o caso `temFatos: false`, que e o unico em que ele
realmente nao tem sobre o que falar.

Com selos E memorial, o CARIMBO manda no gabarito: e fonte independente do
memorial, e e isso que pega o memorial emitido com o nome de outra obra.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 2: A rota usa a regra

**Files:**
- Modify: `app/api/nexo/agent/route.ts`

**Interfaces:**
- Consumes: `fatosDaConversa`, `FatosDoMemorial` (Task 1).
- Produces: o corpo da requisição aceita `memorial?: FatosDoMemorial`. A Task 3 envia esse campo.

- [ ] **Step 1: Aceitar o memorial no corpo**

No bloco de parse (junto de `selos`), acrescentar:

```ts
    memorial =
      body.memorial && typeof body.memorial === "object"
        ? (body.memorial as FatosDoMemorial)
        : null;
```

Declarar `let memorial: FatosDoMemorial | null;` junto dos outros `let`, e
acrescentar `memorial?: unknown;` ao tipo do `body`.

Importar no topo:

```ts
import { fatosDaConversa, type FatosDoMemorial } from "@/server/nexo/agent/fatos";
```

- [ ] **Step 2: Trocar a guarda pela regra**

Substituir o bloco inteiro:

```ts
  // Sem selos não há fatos: guarda determinística (afirma o próximo passo).
  if (selos.length === 0) {
    return NextResponse.json({
      turn: {
        reply:
          "Primeiro anexe as pranchas de uma disciplina e toque em “Ler pranchas”. " +
          "Assim eu leio os selos e proponho a LD e a capa.",
        proposals: [],
      },
    });
  }
```

por:

```ts
  /*
   * A recusa agora é sobre FATOS, não sobre selos. Um memorial não tem selo de
   * prancha: exigir selos impedia auditar memorial pelo chat, que é o caminho
   * principal do produto agora.
   */
  const fatos = fatosDaConversa(selos, memorial);
  if (!fatos.temFatos) {
    return NextResponse.json({
      turn: {
        reply:
          "Anexe as pranchas de uma disciplina (eu leio os selos e proponho a LD e a capa) " +
          "ou o memorial descritivo (eu audito contra a obra declarada).",
        proposals: [],
      },
    });
  }
```

- [ ] **Step 3: Os fatos do memorial chegam ao raciocínio**

`buildLdProposal(selos)` quebra com lista vazia. Trocar o bloco do `resumo` por:

```ts
  /*
   * Fatos determinísticos. Com pranchas, saem dos selos (mesma fonte da
   * geração). Só com memorial, saem da classificação — o agente precisa saber
   * sobre o que está falando, senão volta a inventar.
   */
  const proposal = fatos.temSelos ? buildLdProposal(selos) : null;
  const resumo = proposal
    ? {
        disciplina: proposal.resumo.disciplina,
        codigo: proposal.resumo.codigo,
        revisao: proposal.resumo.revisao,
        obra: proposal.resumo.obra,
        totalFolhas: proposal.resumo.totalFolhas,
        tituloSugerido: proposal.input.ldData.sectionTitle,
      }
    : {
        disciplina: "",
        codigo: memorial?.codigo ?? "",
        revisao: "",
        obra: fatos.gabarito.obra ?? "",
        totalFolhas: 0,
        tituloSugerido: "",
      };
```

E o `ldPreview`, que também depende da proposta:

```ts
  const ldPreview = proposal
    ? {
        rows: proposal.input.rows.map((r) => ({
          sheet: r.sheet,
          file: r.file,
          description: r.description,
        })),
        totalFolhas: proposal.resumo.totalFolhas,
        referenceTotal: proposal.input.referenceTotal ?? null,
      }
    : null;
```

- [ ] **Step 4: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros. Se acusar `ldPreview` possivelmente nulo no `send({...})` do
stream, é esperado: o tipo do payload aceita `null` (o cliente já trata ausência).
Se não aceitar, ajustar o tipo para `LdPreviewData | null`.

Run: `npm run build`
Expected: build completo.

- [ ] **Step 5: Commit**

```bash
git add app/api/nexo/agent/route.ts
git commit -m "Nexo: a rota do agente aceita conversa de memorial

A guarda vira a regra de fatos, e o raciocinio ganha a segunda fonte: sem
pranchas, os fatos vem da classificacao do memorial. buildLdProposal so roda
quando ha selos -- com lista vazia ele nao tem o que resumir.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 3: O cliente envia os fatos do memorial

**Files:**
- Modify: `modules/nexo/components/NexoChat.tsx`
- Modify: `modules/nexo/components/NexoWorkspace.tsx`

**Interfaces:**
- Consumes: o corpo `memorial` da Task 2.
- Produces: a prop `memorial` do `NexoChat`.

- [ ] **Step 1: A prop no chat**

Em `NexoChat`, acrescentar à assinatura de props:

```ts
  /** Fatos do memorial anexado (classificação determinística). Null = não há. */
  memorial?: {
    fileName: string;
    obra?: string | null;
    municipio?: string | null;
    codigo?: string | null;
  } | null;
```

E no corpo da requisição:

```ts
        body: JSON.stringify({ message: text, history, selos, memorial, conversationId }),
```

- [ ] **Step 2: O workspace passa os fatos**

Em `NexoWorkspace`, onde `<NexoChat ... />` é montado, acrescentar:

```tsx
            memorial={
              memorialFile
                ? {
                    fileName: memorialFile.name,
                    obra: dossie?.obra ?? null,
                    municipio: dossie?.municipio ?? null,
                    codigo: dossie?.codigo ?? null,
                  }
                : null
            }
```

`memorialFile` e `dossie` já existem no componente (o memorial é retido em
`setMemorialFile` e a classificação em `setDossie`).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint modules/nexo`
Expected: os dois limpos.

- [ ] **Step 4: Ver no navegador**

Run: `npm run dev`, abrir `/nexo`, anexar **só o memorial** e escrever "audita o
memorial".

Expected: o agente **responde sobre o memorial** em vez de "Primeiro anexe as
pranchas". A resposta pode ainda não propor a auditoria — a proposta é a Task 4.
O que este passo prova é que a guarda caiu e os fatos chegaram.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/NexoChat.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: o chat envia os fatos do memorial ao agente

Sem isso a regra de fatos nao tem o que ler: o cliente sabia da classificacao e
nao contava pro agente.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 4: O gabarito do cartão de auditoria

O cartão de auditoria já existe e já chama o motor
(`ConfirmationCard.tsx:1200` → `postAudit`). Mas ele tira a obra de
`summarizeSelos(selos)`: **sem pranchas, roda sem gabarito** — e aí a regra de
identidade compara o documento consigo mesmo.

**Files:**
- Modify: `modules/nexo/components/ConfirmationCard.tsx`

**Interfaces:**
- Consumes: `fatosDaConversa` (Task 1) — o mesmo módulo, importado no cliente
  (é puro, sem import de runtime, então serve nos dois lados).
- Produces: nada para tasks seguintes.

- [ ] **Step 1: A prop dos fatos do memorial**

Em `AuditoriaConfirmation`, acrescentar à assinatura:

```ts
  memorialFatos?: { obra?: string | null; municipio?: string | null } | null;
```

E trocar a derivação da obra:

```ts
  /*
   * O gabarito: obra do CARIMBO quando há pranchas (fonte independente do
   * memorial), senão a que a classificação leu do próprio documento. Sem isto,
   * numa conversa só de memorial a auditoria rodava sem régua de identidade.
   */
  const fatos = fatosDaConversa(selos, memorialFatos ? { fileName: "", ...memorialFatos } : null);
  const obra = fatos.gabarito.obra ?? undefined;
```

Importar:

```ts
import { fatosDaConversa } from "@/server/nexo/agent/fatos";
```

- [ ] **Step 2: O id da auditoria sem selos**

`auditoriaId(selos)` deriva de selos. Localizar a função e garantir que ela
devolve um id estável quando a lista é vazia — se hoje ela devolve algo como
`auditoria:` vazio, dois memoriais diferentes colidiriam no mesmo artefato.
Trocar a chamada por:

```ts
  const id = auditoriaId(selos.length > 0 ? selos : [{ fileName: memorialFileName } as SeloForLd]);
```

onde `memorialFileName` é o nome do arquivo do memorial, recebido por prop.
**Se `auditoriaId` já for estável com lista vazia**, deixar como está e anotar no
relatório — não inventar mudança que o código não pede.

- [ ] **Step 3: Quem monta o cartão passa a prop**

No ponto em que `AuditoriaConfirmation` é montado, passar `memorialFatos` a
partir do mesmo `dossie` que a Task 3 usa. Se o `ConfirmationCard` ainda não
recebe o dossiê, passá-lo do `NexoWorkspace` pela mesma cadeia por onde
`memorialFile` já chega.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npx eslint modules/nexo`
Expected: limpos.

- [ ] **Step 5: A prova no navegador**

Com `npm run dev`, em `/nexo`:

1. anexar **só** o memorial 017-26;
2. pedir "audita o memorial em profundidade";
3. confirmar no cartão;
4. quando terminar, conferir no relatório que a obra do gabarito aparece e que as
   identidades divergentes foram acusadas.

Expected: a auditoria roda e acha as identidades reaproveitadas. **É este passo
que prova o sub-projeto** — o resto é fiação.

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/components/ConfirmationCard.tsx modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: a auditoria pelo chat roda com gabarito mesmo sem pranchas

O cartao tirava a obra de summarizeSelos(selos): numa conversa so de memorial
isso e vazio, e a auditoria rodava sem regua de identidade -- comparando o
documento consigo mesmo, que e justamente o erro que ela existe para pegar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 5: O chat mostra a identidade e deixa corrigir

O spec pede que o chat exiba o que detectou e o usuário **confirme ou corrija** —
e é a correção que transforma o gabarito em régua de verdade. Hoje
`appendMemorialIntake` já mostra obra/código/município e já oferece os dois
níveis; falta o "está certo?".

**Files:**
- Modify: `modules/nexo/components/NexoWorkspace.tsx` (função `appendMemorialIntake`)

**Interfaces:**
- Consumes: `dossie` (classificação) e o `slotRequest` que a função já monta.
- Produces: nada para tasks seguintes.

- [ ] **Step 1: Ler o que a classificação entrega**

Run: `rg "interface NexoDossieDraft" -A 12 modules/nexo/types.ts`

Anote quais campos existem de fato. O spec fala em "obra, prefeitura e endereço";
**só mostre os que o dossiê tiver**. Prometer endereço que a classificação não lê
é pior do que não mostrar.

- [ ] **Step 2: A mensagem afirma o fato e oferece a correção**

Em `appendMemorialIntake`, trocar o `content` e as `suggestions` por:

```ts
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        `Li as primeiras páginas: é o memorial descritivo${detail ? ` — ${detail}` : ""}.\n\n` +
        `Vou auditar usando essa obra como referência. Se o nome estiver errado, ` +
        `me diga o correto — é ele que denuncia texto reaproveitado de outro projeto.`,
      slotRequest: {
        slotId: "memorial",
        taskKind: "auditoria",
        prompt: "O que fazer com o memorial",
        optional: true,
        suggestions: [
          { label: "Auditar o memorial", value: "audita o memorial", commit: "send" },
          { label: "Auditoria profunda", value: "audita o memorial em profundidade", commit: "send" },
          {
            label: "A obra está errada",
            value: "a obra correta é ",
            commit: "fill",
          },
        ],
      },
    });
```

`commit: "fill"` escreve no composer e deixa o cursor — o usuário completa com o
nome certo. É o padrão que o produto já usa para decisão que exige texto.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npx eslint modules/nexo`
Expected: limpos.

Depois, no navegador: anexar o memorial e conferir que a mensagem mostra a obra
lida e as três opções, e que clicar em "A obra está errada" **preenche** o
composer em vez de enviar.

- [ ] **Step 4: Commit**

```bash
git add modules/nexo/components/NexoWorkspace.tsx
git commit -m "Nexo: o intake do memorial afirma a obra lida e deixa corrigir

O gabarito e a regua da auditoria de identidade. Mostrar o que foi lido sem
oferecer correcao faz a regua ser o proprio documento -- e se o memorial inteiro
for de outra obra, ninguem percebe.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

### Task 6: O portão do navegador

O `shot-audit.mjs` prova a auditoria pela tela `/audit`. Este prova o **mesmo
memorial pelo chat** — e é o que autoriza, mais tarde, aposentar a tela.

**Files:**
- Create: `scripts/shot-audit-nexo.mjs`

**Interfaces:**
- Consumes: o fluxo das Tasks 1-4.
- Produces: nada.

- [ ] **Step 1: Escrever o portão**

Leia `scripts/shot-audit.mjs` inteiro antes — as armadilhas da tela `/audit` estão
comentadas lá e várias valem para qualquer portão deste repo. Copie dele: o
`check()`, o `linhasDeIa()`/`totalDeLinhas()` (que leem `[ai] flow=audit` do log
do servidor), e o bloco de asserções.

O caminho até o resultado é o do `shot-nexo.mjs`, não o da `/audit`:

```js
await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL("**/nexo**", { timeout: 20000 });
}

// Pelo CLIPE: a tela tem três inputs de arquivo e só este dispara a leitura.
const [seletor] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
]);
await seletor.setFiles(MEMORIAL);

// O intake do memorial confirma o tipo e oferece os níveis.
await page.getByText(/memorial descritivo/i).first().waitFor({ timeout: 180000 });
check("o Nexo reconheceu o memorial", true);

await page.getByRole("button", { name: /Auditoria profunda/i }).first().click();

// O cartão de auditoria aparece no chat e precisa ser confirmado.
const confirmar = page.getByRole("button", { name: /Auditar|Gerar|Confirmar/i });
await confirmar.first().click({ timeout: 120000 });

const veredito = page.getByText(/NÃO EMITIR|REVISAR|LIBERADO|ANÁLISE PARCIAL/i);
await veredito.first().waitFor({ timeout: 900000 });
```

**Trava de partida**, como no portão da tela — sem ela, um clique que não pega
vira quinze minutos de espera por uma auditoria que nunca começou:

```js
const comecou = await page
  .getByText(/Analisando|auditoria|processando/i)
  .first()
  .waitFor({ timeout: 90000 })
  .then(() => true)
  .catch(() => linhasDeIa(marcoLog).length > 0);
check("a auditoria começou de fato", comecou);
if (!comecou) throw new Error("o clique não disparou a auditoria — nada a medir adiante");
```

As asserções são as MESMAS do `shot-audit.mjs`, e é isso que dá sentido ao
portão:

```js
check("o documento INTEIRO chegou na IA (A1)", entrada > 60000, `in=${entrada}`);
check("nenhuma passada da auditoria abortou", abortadas.length === 0);
check("a validação rodou", linhas.some((l) => l.includes("op=audit-validation") && l.includes("status=OK")));
for (const identidade of IDENTIDADES_ERRADAS) {
  check(`achou a identidade reaproveitada "${identidade}"`, texto.toLowerCase().includes(identidade.toLowerCase()));
}
check("o veredito de emissão está no topo", /NÃO EMITIR|REVISAR|LIBERADO|ANÁLISE PARCIAL/i.test(texto));
```

- [ ] **Step 2: Rodar**

Run: `npm run dev` (noutro terminal) e `node scripts/shot-audit-nexo.mjs`
Expected: as asserções passam. **Custa IA de verdade** (~110k tokens): é uma
auditoria Profunda do memorial de 132 páginas.

- [ ] **Step 3: Comparar com a tela**

Run: `node scripts/shot-audit.mjs`

Expected: os dois portões acham **as mesmas** identidades reaproveitadas.
Divergência aqui é regressão, não diferença de caminho — e é o que impede a
aposentadoria da `/audit` de perder recurso.

- [ ] **Step 4: Commit**

```bash
git add scripts/shot-audit-nexo.mjs
git commit -m "Auditoria: portao do mesmo memorial pelo CHAT

Mesmas assercoes do portao da tela. Os dois precisam achar o mesmo no mesmo
documento -- divergencia e regressao, nao diferenca de caminho, e e isso que
autoriza aposentar a /audit sem perder recurso.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

---

## Sequência e dependências

| Task | Depende de | Entrega verificável |
|---|---|---|
| 1 Regra de fatos | — | `npm run test:nexo:fatos` verde |
| 2 Rota usa a regra | 1 | `tsc` + build limpos |
| 3 Cliente envia o memorial | 2 | O agente responde sobre o memorial em vez de pedir pranchas |
| 4 Gabarito do cartão | 1, 3 | A auditoria roda pelo chat e acha as identidades |
| 5 Confirmar/corrigir a obra | 3 | O intake mostra a obra lida e oferece corrigir |
| 6 Portão no navegador | 4, 5 | Chat e tela acham o mesmo |

**O que este plano NÃO faz** (é o sub-projeto B): o relatório aparecer no palco
central. Ao fim do A, o resultado da auditoria fica onde os artefatos do Nexo já
ficam. Ver o spec.
