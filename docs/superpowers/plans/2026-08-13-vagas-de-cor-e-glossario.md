# As vagas de cor e o glossário — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar a dessincronia entre `app/globals.css` e o `DESIGN.md` — as quatro cores de vocabulário existem em código e o documento ainda as chama de "vagas abertas" —, dar trabalho real à única que ainda não tem (a escala de dado, hoje pintada com o teal interativo), e registrar o glossário do ofício com um fiscal que o mantenha.

**Architecture:** Três movimentos independentes que se apoiam. Primeiro a escala de dado sai do teal: a lista de cores do donut vira núcleo puro (`modules/nexo/lib/escala-de-dado.ts`), testável em node cru, e o teste é justamente o que trava a regressão — nenhuma fatia pode devolver um token de interatividade. Depois nasce o fiscal do §12 (`scripts/prova-tokens-documentados.mjs`), que lê os dois arquivos e falha quando um token de vocabulário existe no CSS sem estar nomeado no DESIGN.md; ele falha na hora em que nasce, e é a reescrita do §2 que o faz passar. Por último o glossário: uma seção no DESIGN.md mais um segundo fiscal (`scripts/prova-glossario.mjs`) que varre **só strings de interface** — comentários removidos antes, porque os docblocks deste repositório usam as palavras proibidas com toda razão.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4 CSS-only, node v24 (type stripping nativo — `node scripts/x.ts` roda TypeScript sem build), `node:assert/strict`.

**Spec:** `docs/superpowers/specs/2026-08-13-propostas-ux-ui-aprovadas.md` (Parte A.1 e Lote 0)

## Global Constraints

Valem para toda tarefa, sem repetição.

- **Nenhuma cor nova.** Os quatro tokens de vocabulário já existem em
  `app/globals.css:157-200` com valor decidido. Este plano documenta e liga —
  não escolhe matiz.
- **Nenhum hex cru fora de `app/globals.css`.** Componente consome
  `var(--token)`.
- **`var(--ring)`, `var(--primary)` e `var(--accent)` são interatividade.**
  Nunca aparecem em gráfico, em fatia, em barra ou em qualquer coisa que não se
  clica. Essa é a Regra do Acento Único do §2, e é a regressão que a Tarefa 1
  conserta.
- **Núcleo puro só com `import type`.** É o que permite `node scripts/x.ts` sem
  bundler. Um `import` de valor vindo de `@/components/**` quebra o teste.
- **Toda tarefa termina com `npm run lint` limpo** nos arquivos tocados.
- **Commits direto na branch atual** (`theusinshow/kmi-adititonals`). Nunca
  `git add -A` — sempre os caminhos explícitos.
- **Português do produto.** Nome de arquivo, símbolo e comentário em português,
  como todo o `modules/nexo/lib/`.

### O que o código contradiz no documento original

| # | achado | o que o plano faz |
|---|---|---|
| 1 | `DESIGN.md:238-250` diz "quatro vagas… nenhuma tem valor decidido"; `globals.css:157-200` tem as quatro com valor | Tarefa 2 reescreve a seção como tabela de cores existentes, com consumidor nomeado |
| 2 | `UsageDonut.tsx:19-25` pinta as fatias com `var(--ring)` + duas transparências do teal, e o docblock **assume** o desvio | Tarefa 1 troca pela rampa `--data-*`, que existia sem consumidor |
| 3 | `DESIGN.md:702` diz "o sistema ainda não tem teste automático de contrato visual — quando tiver, ele mora aqui" | Tarefas 2 e 3 criam os dois primeiros, e a Tarefa 2 atualiza essa frase |
| 4 | `DESIGN.md` cita `--status-danger` como exemplo do que **não existe** | O fiscal da Tarefa 2 só checa CSS→documento, nunca documento→CSS: a checagem reversa acusaria esse contra-exemplo |

## File Structure

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `modules/nexo/lib/escala-de-dado.ts` | núcleo puro: quantas fatias → quais degraus da rampa azul | 1 |
| `scripts/test-nexo-escala-de-dado.ts` | teste em node cru, incluindo o que proíbe teal | 1 |
| `modules/nexo/components/UsageDonut.tsx` | consome a escala em vez da lista local | 1 |
| `scripts/prova-tokens-documentados.mjs` | fiscal do §12: token de vocabulário no CSS ⇒ nomeado no DESIGN.md | 2 |
| `DESIGN.md` (§2 e §12) | vagas → cores; a frase do "o que fiscaliza" ganha os dois scripts | 2, 3 |
| `scripts/prova-glossario.mjs` | fiscal do léxico: varre strings de interface, ignora comentário | 3 |
| `DESIGN.md` (seção nova) | o glossário do ofício | 3 |
| `package.json` | três entradas em `scripts` | 1, 2, 3 |

---

### Task 1: A escala de dado ganha trabalho (o donut sai do teal)

**Files:**
- Create: `modules/nexo/lib/escala-de-dado.ts`
- Create: `scripts/test-nexo-escala-de-dado.ts`
- Modify: `modules/nexo/components/UsageDonut.tsx:14-25,51`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: nada.
- Produces: `fatiasDaEscala(quantas: number): string[]`, `ESCALA_DE_DADO: readonly string[]`, `FORA_DA_ESCALA: string`. A Tarefa 2 não depende disto; o fiscal dela apenas passa a ver `--data-*` com consumidor.

- [ ] **Step 1: Escrever o teste que falha**

Crie `scripts/test-nexo-escala-de-dado.ts`. O formato é o de
`scripts/test-nexo-next-steps.ts`: `test()` local, contador, `process.exitCode`.

```ts
/**
 * A escala SEQUENCIAL de dado — o donut de consumo e o que vier depois. Núcleo
 * PURO (nenhum import de valor) → roda com node cru.
 *
 *   node scripts/test-nexo-escala-de-dado.ts   (== npm run test:nexo:escala)
 */
import assert from "node:assert/strict";

import {
  ESCALA_DE_DADO,
  FORA_DA_ESCALA,
  fatiasDaEscala,
} from "../modules/nexo/lib/escala-de-dado.ts";

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

test("zero ou negativo -> nenhuma fatia", () => {
  assert.deepEqual(fatiasDaEscala(0), []);
  assert.deepEqual(fatiasDaEscala(-3), []);
});

test("uma fatia -> o degrau mais claro (o mais legível no fundo escuro)", () => {
  assert.deepEqual(fatiasDaEscala(1), ["var(--data-5)"]);
});

test("duas fatias -> os extremos da rampa, nunca dois tons vizinhos", () => {
  assert.deepEqual(fatiasDaEscala(2), ["var(--data-5)", "var(--data-1)"]);
});

test("tres fatias -> extremos + meio", () => {
  assert.deepEqual(fatiasDaEscala(3), [
    "var(--data-5)",
    "var(--data-3)",
    "var(--data-1)",
  ]);
});

test("cinco fatias -> a rampa inteira, do claro ao escuro", () => {
  assert.deepEqual(fatiasDaEscala(5), [...ESCALA_DE_DADO]);
});

test("acima da rampa -> o excedente sai da escala, sem repetir degrau", () => {
  const sete = fatiasDaEscala(7);
  assert.equal(sete.length, 7);
  assert.deepEqual(sete.slice(0, 5), [...ESCALA_DE_DADO]);
  assert.deepEqual(sete.slice(5), [FORA_DA_ESCALA, FORA_DA_ESCALA]);
});

test("toda fatia e distinta enquanto a rampa alcanca", () => {
  for (const n of [2, 3, 4, 5]) {
    const fatias = fatiasDaEscala(n);
    assert.equal(new Set(fatias).size, n, `${n} fatias deveriam ser distintas`);
  }
});

/*
 * O TESTE QUE EXISTE PELA REGRA, não pelo comportamento.
 *
 * O donut pintava as fatias com `var(--ring)` e duas transparências do teal —
 * e o docblock assumia o desvio. Teal significa interativo (DESIGN.md §2,
 * Regra do Acento Único); fatia de gráfico não se clica. Sem esta asserção, a
 * próxima pessoa com pressa devolve o teal por parecer bonito.
 */
test("nenhum degrau usa cor de interatividade", () => {
  const proibidos = ["--ring", "--primary", "--accent", "5bdac6", "00a693"];
  for (const cor of [...ESCALA_DE_DADO, FORA_DA_ESCALA]) {
    for (const p of proibidos) {
      assert.ok(
        !cor.includes(p),
        `"${cor}" usa ${p}, que significa interatividade`,
      );
    }
  }
});

console.log(`\n${passed} teste(s) ok`);
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `node scripts/test-nexo-escala-de-dado.ts`
Expected: FAIL — `Cannot find module … escala-de-dado.ts`

- [ ] **Step 3: Escrever o núcleo**

Crie `modules/nexo/lib/escala-de-dado.ts`.

```ts
/**
 * A ESCALA SEQUENCIAL DE DADO (DESIGN.md §2) — quantas fatias, quais degraus.
 *
 * A rampa `--data-*` existia em `globals.css` sem ninguém a consumir, enquanto
 * o donut de consumo pintava as fatias com `var(--ring)` e duas transparências
 * do teal. O comentário de lá dizia "escala do teal do sistema — distinção, não
 * semântica", e é justamente essa distinção que o sistema não permite: teal
 * significa interativo, e fatia de gráfico não se clica. Um leitor que aprendeu
 * a regra na primeira tela desaprende na segunda.
 *
 * A escolha dos degraus ESPALHA em vez de sequenciar: com duas fatias, pegar
 * `--data-5` e `--data-4` daria dois azuis quase iguais num anel de 2,5px de
 * traço. Pegar os extremos é o que faz duas fatias se distinguirem de longe —
 * e é o mesmo raciocínio que faz três pegarem extremos + meio.
 *
 * Do CLARO para o ESCURO: no fundo escuro do produto, o degrau mais claro é o
 * que mais avança, e a primeira fatia é sempre a maior (o chamador ordena).
 *
 * PURO e sem imports: roda no node cru.
 */

/** A rampa inteira, na ordem de leitura: primeiro o que mais aparece. */
export const ESCALA_DE_DADO = [
  "var(--data-5)",
  "var(--data-4)",
  "var(--data-3)",
  "var(--data-2)",
  "var(--data-1)",
] as const;

/**
 * O que sobra quando há mais fatias do que degraus. Borda estrutural, de
 * propósito: repetir um degrau mentiria (dois valores diferentes com a mesma
 * cor), e inventar um sexto azul é ampliar paleta sem trabalho declarado.
 */
export const FORA_DA_ESCALA = "var(--border)";

/**
 * As cores de `quantas` fatias, da maior para a menor. Acima de cinco, o
 * excedente sai da escala em vez de dar a volta.
 */
export function fatiasDaEscala(quantas: number): string[] {
  if (quantas <= 0) return [];
  if (quantas === 1) return [ESCALA_DE_DADO[0]];

  if (quantas > ESCALA_DE_DADO.length) {
    const excedente = quantas - ESCALA_DE_DADO.length;
    return [
      ...ESCALA_DE_DADO,
      ...Array.from({ length: excedente }, () => FORA_DA_ESCALA),
    ];
  }

  const passo = (ESCALA_DE_DADO.length - 1) / (quantas - 1);
  return Array.from(
    { length: quantas },
    (_, i) => ESCALA_DE_DADO[Math.round(i * passo)],
  );
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `node scripts/test-nexo-escala-de-dado.ts`
Expected: PASS — `8 teste(s) ok`

- [ ] **Step 5: Registrar o script**

Em `package.json`, no bloco `scripts`, junto dos outros `test:nexo:*`:

```json
"test:nexo:escala": "node scripts/test-nexo-escala-de-dado.ts",
```

- [ ] **Step 6: Ligar o donut na escala**

Em `modules/nexo/components/UsageDonut.tsx`, apague o bloco `SLICE_COLORS`
(L19-25) e o comentário que o defendia, e importe a escala.

```tsx
import { fatiasDaEscala } from "../lib/escala-de-dado";
```

Onde hoje está `color: SLICE_COLORS[i] ?? "var(--input)"` (L51), a cor passa a
sair de uma lista calculada uma vez para o total de modelos. Dentro do `reduce`
que monta as fatias, o acumulador já conhece o índice; a lista vem de fora:

```tsx
const cores = fatiasDaEscala(models.length);
```

e a fatia usa `color: cores[i]`. Nenhum `??` de fallback: `fatiasDaEscala`
devolve exatamente `models.length` itens, e um fallback silencioso é como o
teal voltaria sem ninguém ver.

- [ ] **Step 7: Provar no navegador que o anel mudou**

Run: `npm run lint`
Expected: sem erro nos arquivos tocados.

O anel vive no rodapé da conversa. Confira a olho que as fatias estão azuis e
que nenhuma é teal — `npm run dev`, abra `/nexo` numa conversa com consumo.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/lib/escala-de-dado.ts scripts/test-nexo-escala-de-dado.ts modules/nexo/components/UsageDonut.tsx package.json
git commit -m "cores: a escala de dado sai do teal e ganha o trabalho que o sistema lhe deu"
```

---

### Task 2: O fiscal do §12 (e a reescrita das "vagas")

**Files:**
- Create: `scripts/prova-tokens-documentados.mjs`
- Modify: `DESIGN.md:238-256` (seção "Vagas abertas") e `DESIGN.md:702-703`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: nada da Tarefa 1 (o fiscal lê arquivos, não código).
- Produces: `npm run prova:tokens`. A Tarefa 3 acrescenta a irmã `prova:glossario` e as duas entram juntas na frase do §12.

- [ ] **Step 1: Escrever o fiscal**

Crie `scripts/prova-tokens-documentados.mjs`.

```js
/**
 * O FISCAL DO §12: todo token de VOCABULÁRIO definido em `globals.css` tem de
 * estar nomeado no `DESIGN.md`.
 *
 * A regra do §12 sempre esteve escrita — "token novo nasce com nome, valor e
 * trabalho declarado" — e mesmo assim quatro famílias inteiras (`--signal-*`,
 * `--legacy*`, `--discipline-*`, `--data-*`) entraram no CSS enquanto o
 * documento continuava a chamá-las de "vagas abertas, nenhuma com valor
 * decidido". Regra sem fiscal é intenção.
 *
 * SÓ CSS → DOCUMENTO, nunca o contrário. O DESIGN.md cita `--status-danger`
 * como exemplo do que NÃO existe ("qualquer referência a eles é bug"), e uma
 * checagem reversa acusaria o próprio contra-exemplo. Token documentado a mais
 * é assunto de revisão humana; token no CSS a menos no documento é a
 * dessincronia que já aconteceu.
 *
 * VOCABULÁRIO, não toda variável. Neutro, raio e duração são gramática — mudam
 * sem mudar o que o produto diz. Cor com semântica é vocabulário, e é o que o
 * §2 tem de listar.
 *
 *   node scripts/prova-tokens-documentados.mjs   (== npm run prova:tokens)
 */
import { readFileSync } from "node:fs";

/** As famílias que o §2 tem de nomear. Prefixo, não nome exato. */
const FAMILIAS = [
  "--status-",
  "--signal-",
  "--legacy",
  "--discipline-",
  "--data-",
  "--nexo-marca-",
];

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

/*
 * Só DEFINIÇÃO (`--x: valor`), no começo da linha. `var(--x)` no meio de uma
 * regra é consumo, e o bloco `@theme` do Tailwind v4 redefine cada token como
 * `--color-signal-info: var(--signal-info)` — que é ponte, não vocabulário, e
 * fica de fora porque nenhum prefixo da lista casa com `--color-`.
 */
const definidos = new Set();
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) {
  const nome = m[1];
  if (FAMILIAS.some((f) => nome.startsWith(f))) definidos.add(nome);
}

if (definidos.size === 0) {
  console.error("FALHOU  nenhum token de vocabulário encontrado em globals.css");
  console.error("        (a regex de definição quebrou, ou o arquivo mudou de forma)");
  process.exit(1);
}

const ausentes = [...definidos].filter((t) => !design.includes(t)).sort();

if (ausentes.length > 0) {
  console.error(`FALHOU  ${ausentes.length} token(s) no CSS e ausente(s) no DESIGN.md:\n`);
  for (const t of ausentes) console.error(`  ${t}`);
  console.error("\nDESIGN.md §12: token novo nasce com nome, valor e trabalho declarado.");
  console.error("Documente-os no §2 (cores) ou remova-os do CSS.");
  process.exit(1);
}

console.log(`  ok  ${definidos.size} token(s) de vocabulário, todos nomeados no DESIGN.md`);
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `node scripts/prova-tokens-documentados.mjs`
Expected: FAIL, saída com os tokens de `--signal-*`, `--legacy*`,
`--discipline-*`, `--data-*` e `--nexo-marca-*` listados como ausentes. Os
`--status-*` passam (o §2 já os tem em tabela).

- [ ] **Step 3: Reescrever o §2**

Em `DESIGN.md`, substitua a seção `### Vagas abertas — cores que ainda não
existem` (L238-256) inteira pelo texto abaixo. O título muda porque a afirmação
mudou: não há vaga, há vocabulário.

```markdown
### As quatro cores de vocabulário

Além dos três sinais, o sistema tem quatro famílias com trabalho declarado.
Elas nasceram como vagas abertas — cor com função pensada e valor por decidir —
e foram preenchidas uma a uma. Nenhuma pode ser confundida com um sinal de
status a três metros da tela; é essa a prova que todas passaram.

| Família | Token | Valor | Trabalho | Quem consome |
|---------|-------|-------|----------|--------------|
| **Informação / neutro-ativo** | `--signal-info` `--signal-info-bg` `--signal-info-border` | `#7fb2e8` | aviso que **não** é status: dica, contexto que o agente oferece. Antes disto tudo virava âmbar, e o âmbar dizia menos | `<Badge variant="info">`, `AuditoriaEmCurso`, `FaixaDeEstado`, `aviso-sem-acesso` |
| **Legado / congelado** | `--legacy` `--legacy-bg` `--legacy-border` | `#9d94ab` | o que ainda funciona mas saiu do caminho principal. Roxo-acinzentado dessaturado: presente sem chamar, longe demais dos sinais para parecer erro | `<Badge variant="legacy">`, `app/ferramentas/`, `NexoSidebar` |
| **Disciplina (categórica)** | `--discipline-arq` `-est` `-hid` `-ele` `-pci` `-cli` `-ter` `-pai` | oito tons dessaturados | agrupar folhas no canvas por disciplina. **A sigla mono de três letras é o portador primário; a cor é secundária** — nenhuma decisão do produto pode depender só do matiz | `modules/nexo/lib/disciplina-cor.ts` |
| **Escala de dado (sequencial)** | `--data-1` … `--data-5` | rampa azul | donut de consumo e gráficos futuros. Azul, **nunca** teal: teal significa interativo, e fatia de gráfico não se clica | `modules/nexo/lib/escala-de-dado.ts` |

São oito cores de disciplina para vinte e três códigos do léxico do escritório,
e isso é de propósito: agrupar por família mantém a escala legível. O código que
não casa fica **sem cor** — inventar um tom para cada um faria a escala competir
com os três sinais, que é exatamente o que ela não pode fazer.

**Regra para admitir uma cor nova:** ela tem nome, tem trabalho declarado, tem
token em `globals.css`, tem consumidor nomeado nesta tabela, e passa no teste de
não ser confundível com um sinal de status a três metros da tela.
`npm run prova:tokens` recusa o commit que esquecer a tabela.
```

- [ ] **Step 4: Rodar para ver passar**

Run: `node scripts/prova-tokens-documentados.mjs`
Expected: PASS — `ok  N token(s) de vocabulário, todos nomeados no DESIGN.md`

Se algum `--nexo-marca-*` ainda acusar ausência, acrescente-o à tabela: ele é a
barra de 2px que marca o tipo de trabalho no item da sidebar (montagem ×
auditoria), e o valor está em `globals.css`.

- [ ] **Step 5: Registrar o script e atualizar o §12**

Em `package.json`:

```json
"prova:tokens": "node scripts/prova-tokens-documentados.mjs",
```

Em `DESIGN.md:702-703`, a frase do "O que fiscaliza" deixa de ser uma promessa:

```markdown
**O que fiscaliza.** Revisão humana, este documento e dois testes que saem com
código 1: `npm run prova:tokens` (todo token de vocabulário do `globals.css`
está nomeado no §2) e `npm run prova:glossario` (nenhuma string de interface
usa palavra fora do léxico do §13). Contrato visual — geometria, estado,
contraste — ainda é revisão humana.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/prova-tokens-documentados.mjs DESIGN.md package.json
git commit -m "design: as vagas de cor viram vocabulario, e um fiscal impede a proxima dessincronia"
```

---

### Task 3: O glossário do ofício e o fiscal do léxico

**Files:**
- Create: `scripts/prova-glossario.mjs`
- Modify: `DESIGN.md` (seção nova ao fim das regras nomeadas)
- Modify: as strings que a prova acusar (esperadas: `app/projetos/[id]/page.tsx:221`, `modules/volume-builder/components/imported-files-pool.tsx:98`, `modules/volume-builder/components/volume-builder-page.tsx:446`)
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: `npm run prova:tokens` da Tarefa 2 já existe e a frase do §12 já cita `prova:glossario` — esta tarefa é que a torna verdadeira.
- Produces: `npm run prova:glossario`.

- [ ] **Step 1: Escrever o fiscal**

Crie `scripts/prova-glossario.mjs`. O ponto delicado está no docblock: os
comentários deste repositório usam as palavras proibidas com toda razão
("recuperada com sucesso", "processar arquivo" ao explicar o que **não** se
faz), e varrer o arquivo cru acusaria a própria documentação.

```js
/**
 * O FISCAL DO LÉXICO: nenhuma string de interface fala a língua do SaaS.
 *
 * O produto diz lote, folha, tomo, selo, conferência, parecer, achado. Não diz
 * "upload concluído", "processando", "validar". Consistência de termo é metade
 * da sensação de bem feito, e é a metade que se perde primeiro — cada tela nova
 * traz uma palavra a mais de fora.
 *
 * COMENTÁRIO SAI ANTES DA VARREDURA. Os docblocks daqui são longos e usam as
 * palavras proibidas com razão (explicando o que o produto NÃO diz). Varrer o
 * arquivo cru acusaria a própria documentação, e um fiscal que grita no lugar
 * errado é desligado na primeira semana.
 *
 * SÓ O QUE ESTÁ ENTRE ASPAS OU ENTRE TAGS. `upload.fileName` é o modelo de
 * dados do Prisma e não aparece para ninguém; `"Nenhum upload registrado."`
 * aparece. A diferença é essa, e é o que a extração abaixo separa.
 *
 * FORA DE ESCOPO: `app/admin/**` (tela interna, público de um) e
 * `modules/volume-builder/**` além dos rótulos visíveis já corrigidos — o
 * builder é legado e não se evolui (ver `docs/nexo-paridade-telas.md`).
 *
 *   node scripts/prova-glossario.mjs   (== npm run prova:glossario)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const RAIZ = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");

/** Onde a interface do produto mora. */
const ALVOS = [
  "modules/nexo/components",
  "components/ui",
  "components/layout",
  "app/nexo",
  "app/ferramentas",
  "app/projetos",
  "app/login",
];

/**
 * Palavra proibida → o que dizer no lugar. A mensagem de falha ENSINA: um
 * fiscal que só diz "não" faz a pessoa contornar em vez de aprender.
 */
const PROIBIDAS = [
  ["upload", "envio / anexo — ou o verbo do ofício: solte as pranchas"],
  ["processar", "ler (selo), auditar (memorial), gerar (documento)"],
  ["processando", "lendo / auditando / gerando"],
  ["processado", "lido / auditado / gerado"],
  ["com sucesso", "diga o que ficou pronto: “12 folhas lidas”"],
  ["validar", "conferir"],
  ["validação", "conferência"],
  ["relatório", "parecer"],
  ["issue", "achado"],
  ["batch", "lote"],
];

/** Remove comentário de bloco e de linha, preservando as quebras (o nº da linha). */
function semComentarios(fonte) {
  return fonte
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
}

/** O que um humano lê: literal entre aspas, e texto entre `>` e `<`. */
function trechosVisiveis(linha) {
  const out = [];
  for (const m of linha.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  for (const m of linha.matchAll(/>([^<>{}\n]+)</g)) out.push(m[1]);
  return out;
}

function arquivos(dir) {
  const out = [];
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entradas) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...arquivos(p));
    else if (/\.tsx$/.test(p)) out.push(p);
  }
  return out;
}

const faltas = [];
for (const alvo of ALVOS) {
  for (const arquivo of arquivos(join(RAIZ, alvo))) {
    const linhas = semComentarios(readFileSync(arquivo, "utf8")).split("\n");
    linhas.forEach((linha, i) => {
      for (const trecho of trechosVisiveis(linha)) {
        for (const [palavra, troca] of PROIBIDAS) {
          const re = new RegExp(`\\b${palavra}\\b`, "i");
          if (re.test(trecho)) {
            faltas.push({
              onde: `${relative(RAIZ, arquivo).replace(/\\/g, "/")}:${i + 1}`,
              palavra,
              troca,
              trecho: trecho.trim().slice(0, 70),
            });
          }
        }
      }
    });
  }
}

if (faltas.length > 0) {
  console.error(`FALHOU  ${faltas.length} string(s) fora do léxico:\n`);
  for (const f of faltas) {
    console.error(`  ${f.onde}`);
    console.error(`    "${f.trecho}"`);
    console.error(`    “${f.palavra}” → ${f.troca}\n`);
  }
  console.error("O glossário está no DESIGN.md §13.");
  process.exit(1);
}

console.log("  ok  nenhuma string de interface fora do léxico");
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `node scripts/prova-glossario.mjs`
Expected: FAIL. O alvo conhecido é `app/projetos/[id]/page.tsx:221`
(`empty="Nenhum upload registrado."`). Ícones do `lucide-react` chamados
`Upload` **não** devem aparecer — são identificadores, não literais.

Se a prova acusar um trecho que é código e não texto (um `className`, um `href`,
uma chave de objeto), o filtro de `trechosVisiveis` está largo demais: acrescente
a exclusão e comente por quê, em vez de encolher a lista de palavras.

- [ ] **Step 3: Escrever o glossário no DESIGN.md**

Acrescente ao `DESIGN.md`, como seção nova depois do §12 (numere-a **§13**, e
atualize o sumário do topo se houver):

```markdown
## 13. O léxico do ofício

O software fala a língua de quem o usa. Não é preferência de estilo: o
engenheiro que lê "arquivo processado com sucesso" descobre que está diante de
mais um SaaS, e o que ele precisava saber — quantas folhas foram lidas — não
está escrito em lugar nenhum.

| O produto diz | Nunca diz | Porque |
|---------------|-----------|--------|
| **lote** | batch, conjunto de arquivos | é como se conta o trabalho: um lote de pranchas chega junto e se lê junto |
| **folha** / **prancha** | página, item, documento | folha é a unidade do volume; página é do PDF |
| **tomo** | volume parcial, parte | tomo é o volume físico que vai encadernado |
| **selo** / **carimbo** | cabeçalho, metadados | é o retângulo do canto inferior direito, e é dele que sai tudo |
| **memorial** | documento de texto | tem nome próprio no ofício |
| **LD** | lista, índice, sumário | lista de documentos, e o escritório a chama assim |
| **separatriz** | divisória, capa de seção | idem |
| **conferir** / **conferência** | validar, validação | conferência é o que a prefeitura faz; o Nexo oferece antes |
| **parecer** | relatório, report | o que sai da auditoria é um parecer técnico |
| **achado** | issue, problema encontrado, erro | achado tem gravidade e evidência; erro não |
| **ler** / **leitura** | processar, upload, importar | o que o software faz com uma prancha é ler o selo dela |
| **gerar** | exportar, criar, produzir | gerar é determinístico e tem parâmetro; exportar é o que o navegador faz |

**Mensagem de conclusão diz o que ficou pronto, não que deu certo.** "12 folhas
lidas · 2 sem selo" no lugar de "processamento concluído com sucesso": a
primeira responde o que fazer agora, a segunda pede que se procure.

`npm run prova:glossario` varre as strings de interface e recusa as palavras da
coluna do meio. Comentário de código está fora da varredura — explicar o que o
produto **não** diz exige escrever a palavra.
```

- [ ] **Step 4: Corrigir as strings acusadas**

Uma por uma, com a coluna "Porque" como argumento. A conhecida:

```tsx
// app/projetos/[id]/page.tsx:221
empty="Nenhum arquivo enviado ainda."
```

Não toque nos identificadores (`project.uploads`, `upload.fileName`,
`upload.sizeBytes`): são o modelo de dados do Prisma, não aparecem para ninguém,
e renomeá-los é migração de schema — trabalho de outro lote.

- [ ] **Step 5: Rodar para ver passar**

Run: `node scripts/prova-glossario.mjs`
Expected: PASS — `ok  nenhuma string de interface fora do léxico`

- [ ] **Step 6: Rodar tudo e registrar o script**

Em `package.json`:

```json
"prova:glossario": "node scripts/prova-glossario.mjs",
```

Run: `node scripts/test-nexo-escala-de-dado.ts && node scripts/prova-tokens-documentados.mjs && node scripts/prova-glossario.mjs && npm run lint`
Expected: as três provas passam e o lint fica limpo.

- [ ] **Step 7: Commit**

```bash
git add scripts/prova-glossario.mjs DESIGN.md package.json "app/projetos/[id]/page.tsx"
git commit -m "design: o lexico do oficio vira secao do sistema, com fiscal"
```

---

## Self-review

**Cobertura da spec (Lote 0 = A.1 + 1.5):**

| requisito da spec | tarefa |
|---|---|
| A.1 — DESIGN.md §2 chama de "vaga" o que já existe | Tarefa 2, Step 3 |
| A.1 — `--data-*` sem consumidor, donut no teal | Tarefa 1 |
| A.1 — §12 diz que não há fiscal automático | Tarefas 2 e 3 (dois fiscais + a frase reescrita) |
| 1.5 — glossário registrado no DESIGN.md | Tarefa 3, Step 3 |
| 1.5 — nenhuma string fora do glossário | Tarefa 3, Steps 1-5 |
| 1.5 — "revisão humana obrigatória (microcopy é voz do produto)" | as trocas do Step 4 são propostas, não automáticas; o mantenedor aprova no diff |

**Consistência de tipos:** `fatiasDaEscala(quantas: number): string[]`,
`ESCALA_DE_DADO` e `FORA_DA_ESCALA` têm o mesmo nome no teste (Tarefa 1 Step 1),
no núcleo (Step 3) e no consumidor (Step 6). Os dois scripts `.mjs` não exportam
nada — são executáveis, e o `package.json` os chama pelo caminho exato.

**Risco conhecido:** o `RAIZ` de `prova-glossario.mjs` desfaz o `/C:/` que
`URL.pathname` produz no Windows. Se a prova não encontrar arquivo nenhum
(`0 string(s)` com alvo existente), é aí que está — o Step 2 pede para
desconfiar disso ao ver a saída vazia.
