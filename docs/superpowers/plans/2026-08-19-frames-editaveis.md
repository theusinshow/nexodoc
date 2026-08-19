# Frames editáveis do chat — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer os frames editáveis do chat caberem no olho e no dedo — um componente com dois modos, um botão que alarga a coluna, e as 71 violações da `DESIGN.md` de volta à escala.

**Architecture:** O `FrameDoDocumento` ganha um prop `modo` em vez de um irmão: no chat ele é formulário com a FORMA do documento (a tipografia do ODT sai, a ordem fica); alargado, o texto volta a ser fiel. A largura da coluna sai da cabeça do `ShellSplitter` e vira um módulo com dono único, para o botão do frame poder pedir a mudança sem dois lugares escrevendo a mesma variável CSS.

**Tech Stack:** TypeScript, React, Next 16, Tailwind, Node 22+ com type-stripping (`node scripts/x.ts`), `node:assert/strict` sem framework.

**Spec:** `docs/superpowers/specs/2026-08-19-frames-editaveis-design.md`

## Global Constraints

- **A `DESIGN.md` é a autoridade.** Nada de token novo, variante nova ou tamanho inventado. Onde o spec e a DESIGN.md divergirem, vence a DESIGN.md e o spec é corrigido.
- **Escala tipográfica:** Mono Label 12px é o piso; 11px só em microrrótulo; **10px não existe**. Body 14px, Caption 12px, Title 18px.
- **Grade de 4px:** todo espaçamento é múltiplo de 4. `0.5` (2px), `1.5` (6px), `2.5` (10px) e `3.5` (14px) não entram.
- **Campos:** altura 40px, **32px no compacto**. Wrapper `.nx-edge-7`. O anel de foco é por dentro.
- **Breakpoint de CONTAINER, não de janela.** A coluna é estreita enquanto a janela é larga; `xl:` mente. Usar `@container`.
- **Sem framework de teste.** `scripts/test-*.ts` com `node:assert/strict`, registrado em `package.json`.
- **Núcleo puro roda em node cru:** sem alias `@/`, sem DOM, import relativo **com extensão `.ts`**.
- **Comentários em pt-BR**, explicando *por quê*, no estilo dos arquivos tocados.
- **Commits direto na `main`.** Nunca `git add -A`; sempre caminhos explícitos e `git diff --cached --stat` antes.
- **`npx tsc --noEmit -p tsconfig.json` limpo** antes de cada commit que toca `.ts`/`.tsx`.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `scripts/mede-divida-de-design.ts` | *criar* — conta as violações nos 5 arquivos; é o teste da Tarefa 5 | 1 |
| `modules/nexo/lib/largura-do-copiloto.ts` | *criar* — dono único da largura da coluna (constantes + store) | 2 |
| `scripts/test-largura-do-copiloto.ts` | *criar* | 2 |
| `modules/nexo/components/ShellSplitter.tsx` | *modificar* — passa a consumir o módulo em vez de possuir a largura | 2 |
| `modules/nexo/lib/corpo-do-frame.ts` | *criar* — puro: corpo do ODT → classe, por modo | 3 |
| `scripts/test-corpo-do-frame.ts` | *criar* | 3 |
| `modules/nexo/components/FrameDoDocumento.tsx` | *modificar* — prop `modo`, campos de 32px, grade de 4 | 3 |
| `modules/nexo/components/PlanoDeGeracao.tsx` | *modificar* — o botão "ver como sai" + dívida | 4, 5 |
| `modules/nexo/components/BlocoDaLd.tsx` | *modificar* — dívida | 5 |
| `modules/nexo/components/EditorDoNo.tsx` | *modificar* — dívida | 5 |
| `modules/nexo/components/ConfirmationCard.tsx` | *modificar* — dívida | 5 |

---

## Task 1: O contador da dívida

Ele vem primeiro porque é o TESTE da Tarefa 5, e porque o número de partida só
existe antes de alguém mexer.

**Files:**
- Create: `scripts/mede-divida-de-design.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada.
- Produces: `npm run mede:divida` — imprime a contagem por arquivo e sai com
  código 1 quando há violação. Nenhuma outra tarefa importa deste script.

- [ ] **Step 1: Escrever o contador**

Criar `scripts/mede-divida-de-design.ts`:

```ts
/**
 * QUANTAS VEZES OS FRAMES FURAM A `DESIGN.md`.
 *
 *   node scripts/mede-divida-de-design.ts   (== npm run mede:divida)
 *
 * "Apertado, pequeno e muito junto" não é questão de gosto: é a escala do
 * sistema sendo ignorada. Este script transforma a reclamação em número, e o
 * número em portão — ele sai com código 1 enquanto houver violação, então a
 * dívida não volta pela porta dos fundos numa tela nova copiada daqui.
 *
 * As três regras vêm da `DESIGN.md`, palavra por palavra:
 *
 *   tipografia  "a rampa não tem buracos… para que nenhuma tela invente um
 *                tamanho fora da escala (`text-[11px]`, `text-[15px]`)"
 *               "microrrótulos podem cair a 11px, NUNCA ABAIXO"
 *   grade       "Grade base de 4px; todo espaçamento é múltiplo de 4"
 *   campo       "Campos. … altura 40px (32px compacto)"
 */
import { readFileSync } from "node:fs";

const ARQUIVOS = [
  "modules/nexo/components/FrameDoDocumento.tsx",
  "modules/nexo/components/PlanoDeGeracao.tsx",
  "modules/nexo/components/BlocoDaLd.tsx",
  "modules/nexo/components/EditorDoNo.tsx",
  "modules/nexo/components/ConfirmationCard.tsx",
];

/** Tamanho de fonte fora da escala. 10px é abaixo do piso; 11px só em microrrótulo. */
const FONTE_INVENTADA = /text-\[(\d+(?:\.\d+)?)px\]/g;

/** `0.5`=2px, `1.5`=6px, `2.5`=10px, `3.5`=14px — nenhum é múltiplo de 4. */
const FORA_DA_GRADE =
  /\b(?:gap|gap-x|gap-y|p|px|py|pt|pb|pl|pr|m|mt|mb|ml|mr|space-x|space-y)-(?:0\.5|1\.5|2\.5|3\.5)\b/g;

interface Achado {
  arquivo: string;
  linha: number;
  regra: string;
  trecho: string;
}

const achados: Achado[] = [];

for (const arquivo of ARQUIVOS) {
  const linhas = readFileSync(arquivo, "utf8").split("\n");
  linhas.forEach((linha, i) => {
    /*
     * Comentário não é interface. Estes arquivos explicam o PORQUÊ das
     * decisões, e um comentário que cita `text-[10px]` para dizer que ele saiu
     * seria contado como violação — o contador acusaria a própria explicação.
     */
    const codigo = linha.replace(/\/\/.*$/, "").replace(/\/\*[\s\S]*?\*\//g, "");
    if (/^\s*\*/.test(linha)) return;

    for (const m of codigo.matchAll(FONTE_INVENTADA)) {
      const px = Number(m[1]);
      // 11px é permitido em microrrótulo; abaixo disso, nunca.
      if (px < 11) {
        achados.push({ arquivo, linha: i + 1, regra: `fonte ${px}px < piso 11px`, trecho: m[0] });
      } else {
        achados.push({ arquivo, linha: i + 1, regra: "fonte fora da escala", trecho: m[0] });
      }
    }
    for (const m of codigo.matchAll(FORA_DA_GRADE)) {
      achados.push({ arquivo, linha: i + 1, regra: "fora da grade de 4px", trecho: m[0] });
    }
  });
}

const porArquivo = new Map<string, number>();
for (const a of achados) porArquivo.set(a.arquivo, (porArquivo.get(a.arquivo) ?? 0) + 1);

console.log("dívida de design nos frames editáveis\n");
for (const arquivo of ARQUIVOS) {
  const n = porArquivo.get(arquivo) ?? 0;
  console.log(`  ${String(n).padStart(3)}  ${arquivo.replace("modules/nexo/components/", "")}`);
}
console.log(`\n  ${achados.length} violação(ões)`);

if (achados.length > 0) {
  console.log("\ndetalhe:");
  for (const a of achados) {
    console.log(`  ${a.arquivo.replace("modules/nexo/components/", "")}:${a.linha}  ${a.trecho}  — ${a.regra}`);
  }
  process.exit(1);
}
console.log("\nnenhuma. os frames estão na escala.");
```

- [ ] **Step 2: Rodar e ver o número de partida**

Run: `node scripts/mede-divida-de-design.ts`
Expected: FALHA (exit 1), com o total por arquivo. **Anote o número** — ele é a
linha de base, e é o que a Tarefa 5 leva a zero.

- [ ] **Step 3: Registrar o script**

Em `package.json`, junto dos demais `mede:*`:

```json
    "mede:divida": "node scripts/mede-divida-de-design.ts",
```

- [ ] **Step 4: Commit com o número no corpo da mensagem**

```bash
git add scripts/mede-divida-de-design.ts package.json
git diff --cached --stat
git commit -m "bancada: quantas vezes os frames furam a DESIGN.md"
```

---

## Task 2: A largura da coluna ganha dono único

Hoje o `ShellSplitter` POSSUI a largura em estado local. O botão do frame precisa
mudá-la, e dois donos escrevendo a mesma variável CSS é como o estado do
splitter fica velho e a próxima seta do teclado devolve a largura antiga.

**Files:**
- Create: `modules/nexo/lib/largura-do-copiloto.ts`
- Create: `scripts/test-largura-do-copiloto.ts`
- Modify: `modules/nexo/components/ShellSplitter.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `PADRAO = 520`, `MIN = 320`, `MAX = 760`, `PASSO = 24`, `CHAVE = "nexo:copilot-w"`
  - `limitar(px: number): number`
  - `larguraDeDocumento(): number` — a largura do modo documento
  - `usarLarguraDoCopiloto(): { largura: number; definir(px: number): void; abrirDocumento(): void; fecharDocumento(): void; emDocumento: boolean }`

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-largura-do-copiloto.ts`:

```ts
/**
 * A LARGURA da coluna do copiloto. Núcleo puro → node cru.
 *
 *   node scripts/test-largura-do-copiloto.ts  (== npm run test:nexo:largura)
 */
import assert from "node:assert/strict";

import {
  MAX,
  MIN,
  PADRAO,
  larguraDeDocumento,
  limitar,
} from "../modules/nexo/lib/largura-do-copiloto.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("largura do copiloto\n");

test("limitar prende entre MIN e MAX", () => {
  assert.equal(limitar(100), MIN);
  assert.equal(limitar(9999), MAX);
  assert.equal(limitar(520), 520);
});

test("limitar arredonda — a variável CSS não aceita fração de pixel", () => {
  assert.equal(limitar(520.4), 520);
  assert.equal(limitar(520.6), 521);
});

test("o padrão está dentro da faixa", () => {
  assert.equal(limitar(PADRAO), PADRAO);
});

test("a largura de DOCUMENTO é a maior que o shell permite", () => {
  /*
   * Não é número escolhido a dedo: é o teto do próprio shell. Acima de MAX o
   * canvas deixa de caber como área de trabalho, e uma folha mais larga que
   * isso não caberia na tela de qualquer jeito. Se o parágrafo mais largo do
   * modelo ainda quebrar em MAX, o limite é o shell — não esta escolha.
   */
  assert.equal(larguraDeDocumento(), MAX);
  assert.equal(limitar(larguraDeDocumento()), larguraDeDocumento());
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-largura-do-copiloto.ts`
Expected: FALHA com `Cannot find module .../largura-do-copiloto.ts`.

- [ ] **Step 3: Escrever o módulo**

Criar `modules/nexo/lib/largura-do-copiloto.ts`:

```ts
"use client";

/**
 * A LARGURA DA COLUNA DO COPILOTO — e por que ela tem um dono só.
 *
 * Ela morava dentro do `ShellSplitter`, em estado local. Funcionava enquanto o
 * splitter era o único a mexer. O botão "ver como sai" do frame também precisa
 * mexer, e dois donos escrevendo a MESMA variável CSS é como o estado do
 * splitter fica velho: a coluna alarga, o usuário aperta a seta do teclado, e o
 * splitter devolve a largura que ele achava que era a atual.
 *
 * Aqui a largura é um valor com assinatura. Quem muda, muda por aqui; quem
 * desenha, escuta.
 *
 * As CONSTANTES são puras e ficam no topo para o teste em node cru alcançá-las
 * sem tocar em React.
 */
import { useCallback, useEffect, useState } from "react";

export const CHAVE = "nexo:copilot-w";
export const PADRAO = 520;
/** Abaixo disto o composer e os cards ficam apertados demais. */
export const MIN = 320;
/** Acima disto o canvas deixa de caber como área de trabalho. */
export const MAX = 760;
export const PASSO = 24;

export function limitar(px: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(px)));
}

/**
 * A largura do modo DOCUMENTO.
 *
 * É o teto do shell, e isso é a resposta honesta: acima de `MAX` o canvas
 * deixaria de caber como área de trabalho, então não há largura maior a
 * escolher. Se o parágrafo mais largo do modelo ainda quebrar aqui, o limite é
 * o shell — não esta escolha.
 */
export function larguraDeDocumento(): number {
  return MAX;
}

/* ------------------------------------------------------------------ store */

let larguraAtual = PADRAO;
/** A largura de antes de abrir o documento, para o fechar poder devolvê-la. */
let larguraGuardada: number | null = null;
const ouvintes = new Set<() => void>();

function avisar() {
  for (const o of ouvintes) o();
}

function aplicar(px: number) {
  larguraAtual = limitar(px);
  const shell = document.querySelector<HTMLElement>(".nexo-shell");
  shell?.style.setProperty("--nexo-copilot-w", `${larguraAtual}px`);
  avisar();
}

/**
 * A preferência SÓ é gravada quando o usuário decide a largura — nunca quando o
 * modo documento a impõe. Sem isso, abrir o documento e fechar o navegador
 * deixaria a coluna larga para sempre, e a preferência real do usuário estaria
 * perdida sem ele ter mudado nada.
 */
function gravar() {
  try {
    window.localStorage.setItem(CHAVE, String(larguraAtual));
  } catch {
    /* modo privado / cota cheia: a largura vale só para esta sessão */
  }
}

export function usarLarguraDoCopiloto() {
  const [, forcar] = useState(0);

  useEffect(() => {
    const ouvinte = () => forcar((n) => n + 1);
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);

  const definir = useCallback((px: number) => {
    larguraGuardada = null;
    aplicar(px);
    gravar();
  }, []);

  const abrirDocumento = useCallback(() => {
    if (larguraGuardada === null) larguraGuardada = larguraAtual;
    aplicar(larguraDeDocumento());
  }, []);

  const fecharDocumento = useCallback(() => {
    if (larguraGuardada === null) return;
    aplicar(larguraGuardada);
    larguraGuardada = null;
  }, []);

  return {
    largura: larguraAtual,
    definir,
    abrirDocumento,
    fecharDocumento,
    emDocumento: larguraGuardada !== null,
  };
}

/** Lê a preferência guardada. Chamada uma vez, depois de montar. */
export function restaurarPreferencia() {
  const salvo = Number(window.localStorage.getItem(CHAVE));
  if (Number.isFinite(salvo) && salvo > 0) aplicar(salvo);
  else aplicar(PADRAO);
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node scripts/test-largura-do-copiloto.ts`
Expected: `4 teste(s) passaram.`

- [ ] **Step 5: `ShellSplitter` passa a consumir**

Em `modules/nexo/components/ShellSplitter.tsx`, apagar as constantes locais
(`CHAVE`, `PADRAO`, `MIN`, `MAX`, `PASSO`, `limitar`) e os dois `useEffect` de
leitura/gravação, e trocar o estado por:

```tsx
import {
  PASSO,
  PADRAO,
  restaurarPreferencia,
  usarLarguraDoCopiloto,
} from "../lib/largura-do-copiloto";
```

```tsx
export function ShellSplitter() {
  const { largura, definir } = usarLarguraDoCopiloto();

  /*
   * Lê a preferência DEPOIS de montar: no servidor não existe `localStorage`, e
   * ler no primeiro render faria o HTML do servidor divergir do cliente.
   */
  useEffect(() => {
    restaurarPreferencia();
  }, []);
```

Trocar cada `setLargura(x)` por `definir(x)`:
- arraste: `definir(window.innerWidth - ev.clientX)`
- seta direita: `definir(largura + PASSO)`
- seta esquerda: `definir(largura - PASSO)`
- duplo clique / reset: `definir(PADRAO)`

O `useEffect` que escrevia `--nexo-copilot-w` sai: quem escreve agora é
`aplicar`, dentro do módulo.

- [ ] **Step 6: Registrar o script e conferir**

Em `package.json`:

```json
    "test:nexo:largura": "node scripts/test-largura-do-copiloto.ts",
```

Run: `node scripts/test-largura-do-copiloto.ts && npx tsc --noEmit -p tsconfig.json`
Expected: 4 testes verdes, typecheck sem saída.

- [ ] **Step 7: Commit**

```bash
git add modules/nexo/lib/largura-do-copiloto.ts scripts/test-largura-do-copiloto.ts modules/nexo/components/ShellSplitter.tsx package.json
git diff --cached --stat
git commit -m "shell: a largura da coluna ganha dono unico"
```

---

## Task 3: O frame ganha dois modos

**Files:**
- Create: `modules/nexo/lib/corpo-do-frame.ts`
- Create: `scripts/test-corpo-do-frame.ts`
- Modify: `modules/nexo/components/FrameDoDocumento.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces:
  - `type ModoDoFrame = "campo" | "documento"`
  - `classeDeCorpo(corpo: number | undefined, modo: ModoDoFrame): string`
  - `FrameDoDocumento` ganha o prop opcional `modo?: ModoDoFrame` (padrão `"campo"`).

- [ ] **Step 1: Escrever o teste que falha**

Criar `scripts/test-corpo-do-frame.ts`:

```ts
/**
 * O CORPO do texto no frame, por modo. Núcleo puro → node cru.
 *
 *   node scripts/test-corpo-do-frame.ts   (== npm run test:nexo:corpo)
 */
import assert from "node:assert/strict";

import { classeDeCorpo } from "../modules/nexo/lib/corpo-do-frame.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

console.log("corpo do frame\n");

test("modo CAMPO ignora o corpo do ODT e usa a escala da UI", () => {
  /*
   * O frame promete no cabeçalho ser a ESTRUTURA, não pré-visualização fiel —
   * e importava o corpo da fonte do ODT assim mesmo. É daí que vinha o
   * "pequeno": uma A4 encolhida numa coluna de 520px.
   */
  assert.equal(classeDeCorpo(18, "campo"), classeDeCorpo(8, "campo"));
  assert.equal(classeDeCorpo(undefined, "campo"), classeDeCorpo(11, "campo"));
});

test("modo CAMPO nunca desce da escala", () => {
  for (const corpo of [6, 8, 10, 12, 16, 24, undefined]) {
    const c = classeDeCorpo(corpo, "campo");
    assert.ok(!/text-\[\d/.test(c), `tamanho inventado em ${corpo}: ${c}`);
  }
});

test("modo DOCUMENTO volta a seguir o corpo do ODT", () => {
  const grande = classeDeCorpo(18, "documento");
  const medio = classeDeCorpo(14, "documento");
  const pequeno = classeDeCorpo(9, "documento");
  assert.notEqual(grande, medio);
  assert.notEqual(medio, pequeno);
});

test("modo DOCUMENTO também respeita o piso de 11px", () => {
  // Fiel é o TEXTO, não o direito de sumir: 10px não existe na escala.
  for (const corpo of [4, 6, 8, 9]) {
    assert.ok(
      !/text-\[(\d|10)px\]/.test(classeDeCorpo(corpo, "documento")),
      `abaixo do piso em ${corpo}`,
    );
  }
});

console.log(`\n${passed} teste(s) passaram.`);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/test-corpo-do-frame.ts`
Expected: FALHA com `Cannot find module .../corpo-do-frame.ts`.

- [ ] **Step 3: Escrever o módulo**

Criar `modules/nexo/lib/corpo-do-frame.ts`:

```ts
/**
 * O TAMANHO DO TEXTO no frame do documento, por MODO.
 *
 * Núcleo puro (sem imports) → `node scripts/test-corpo-do-frame.ts`.
 *
 * A função morava dentro do `FrameDoDocumento` e tinha um problema que o
 * próprio cabeçalho do componente denunciava sem perceber: ele promete
 *
 *   "Não é pré-visualização fiel (fonte e brasão são do ODT); é a ESTRUTURA"
 *
 * e mesmo assim importava o corpo da fonte do ODT para dentro da interface —
 * 16pt virava `text-sm`, e o rodapé de 8pt virava `text-[11px]`. O resultado é
 * uma folha A4 encolhida numa coluna de 520px, com campos que o cursor não
 * acerta. Era esse o "muito pequeno".
 *
 * Agora há dois modos, e a diferença entre eles é SÓ esta função:
 *
 *   campo       o frame é um formulário com a FORMA do documento. A ordem, o
 *               alinhamento e o número de linhas continuam vindo do modelo; o
 *               tamanho do texto passa a ser o da interface.
 *   documento   a coluna alargou e o ponto é ver como sai. O corpo do ODT volta
 *               a mandar — mas nunca abaixo do piso da escala, porque fiel é o
 *               TEXTO, não o direito de sumir da tela.
 */

export type ModoDoFrame = "campo" | "documento";

/**
 * Degraus nomeados da `DESIGN.md`. Nenhum tamanho inventado: a rampa existe
 * "para que nenhuma tela invente um tamanho fora da escala".
 */
const CORPO = "text-sm"; // Body 14px
const CAPTION = "text-xs"; // Caption 12px
const SUBTITLE = "text-base font-medium"; // Subtitle 16px
const TITLE = "text-lg font-medium"; // Title 18px

export function classeDeCorpo(corpo: number | undefined, modo: ModoDoFrame): string {
  if (modo === "campo") {
    /*
     * UM tamanho para tudo. O documento tem hierarquia de corpo; o formulário
     * tem hierarquia de POSIÇÃO — que já vem do modelo, no alinhamento e na
     * ordem. Repetir a hierarquia do papel aqui só devolve o problema.
     */
    return CORPO;
  }

  if (!corpo) return CAPTION;
  if (corpo >= 18) return TITLE;
  if (corpo >= 15) return SUBTITLE;
  if (corpo >= 12) return CORPO;
  /*
   * O PISO. Abaixo de 12pt o documento continua diminuindo e a interface não:
   * "microrrótulos podem cair a 11px, nunca abaixo". Um rodapé de 8pt fiel ao
   * milímetro seria ilegível na tela e impossível de editar — e este modo
   * existe para CONFERIR.
   */
  return CAPTION;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `node scripts/test-corpo-do-frame.ts`
Expected: `4 teste(s) passaram.`

- [ ] **Step 5: `FrameDoDocumento` consome o módulo e ganha o prop**

Em `modules/nexo/components/FrameDoDocumento.tsx`:

Apagar a função local `classeDeCorpo` (linhas ~39-45) e importar:

```tsx
import { classeDeCorpo, type ModoDoFrame } from "../lib/corpo-do-frame";
```

Acrescentar o prop à assinatura, com padrão:

```tsx
export function FrameDoDocumento({
  layout,
  campos,
  valores,
  derivados = {},
  onChange,
  modo = "campo",
}: {
  layout: ParagrafoDoModelo[];
  campos: CampoDoFrame[];
  valores: Record<string, string>;
  derivados?: Record<string, string>;
  onChange: (marcador: string, valor: string) => void;
  /** `campo` (padrão) = formulário no chat. `documento` = coluna alargada. */
  modo?: ModoDoFrame;
}) {
```

Trocar as três chamadas `classeDeCorpo(paragrafo.corpo)` por
`classeDeCorpo(paragrafo.corpo, modo)`.

- [ ] **Step 6: O campo ganha altura de dedo**

Ainda em `FrameDoDocumento.tsx`, trocar a classe `comum` do campo:

```tsx
              const comum =
                /* EXCEÇÃO da spec do chanfro: campo tracejado do carimbo fica com raio
                   de 4px e borda tracejada. Tracejado não sobrevive ao recorte, e aqui
                   o tracejado é PAPEL, não interface. O painel que os contém tem chanfro.

                   ALTURA MÍNIMA DE 32px nos DOIS modos — o "compacto" que a DESIGN.md
                   documenta. Antes eram `py-1` com texto de 11px, o que dava ~25px:
                   abaixo do piso, e pequeno demais para acertar com o cursor. No modo
                   documento o TEXTO encolhe conforme o modelo, mas a CAIXA não: fidelidade
                   que impede editar não serve ao modo que existe para conferir. */
                "min-h-8 min-w-0 flex-1 rounded-[4px] border border-dashed border-border bg-transparent px-2 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-solid focus:border-[var(--ring)] focus:bg-[var(--nexodoc-panel)]";
```

E trocar os dois `text-[10px]` restantes (marcador quebrado e campo derivado)
por `text-xs`, e os `px-1.5 py-0.5` por `px-2 py-1`.

- [ ] **Step 7: Registrar e conferir**

Em `package.json`:

```json
    "test:nexo:corpo": "node scripts/test-corpo-do-frame.ts",
```

Run: `node scripts/test-corpo-do-frame.ts && npx tsc --noEmit -p tsconfig.json && node scripts/mede-divida-de-design.ts`
Expected: 4 testes verdes; typecheck limpo; o contador da Tarefa 1 com
`FrameDoDocumento.tsx` em **0**.

- [ ] **Step 8: Commit**

```bash
git add modules/nexo/lib/corpo-do-frame.ts scripts/test-corpo-do-frame.ts modules/nexo/components/FrameDoDocumento.tsx package.json
git diff --cached --stat
git commit -m "frame: o formulario para de imitar o tamanho do papel"
```

---

## Task 4: O botão "ver como sai"

**Files:**
- Modify: `modules/nexo/components/PlanoDeGeracao.tsx`

**Interfaces:**
- Consumes: `usarLarguraDoCopiloto()` (Tarefa 2), `FrameDoDocumento` com `modo` (Tarefa 3).
- Produces: nada consumido por outra tarefa.

- [ ] **Step 1: Ligar o alargamento**

Em `modules/nexo/components/PlanoDeGeracao.tsx`, importar:

```tsx
import { Maximize2, Minimize2 } from "lucide-react";
import { usarLarguraDoCopiloto } from "../lib/largura-do-copiloto";
```

Dentro do componente, ao lado dos demais hooks:

```tsx
  /*
   * VER COMO SAI. Não abre superfície nova: alarga a coluna que já é
   * redimensionável e troca o modo do frame. O mapa e o chat continuam na tela,
   * e voltar é uma transição de largura em vez de uma tela que fecha.
   */
  const { abrirDocumento, fecharDocumento, emDocumento } = usarLarguraDoCopiloto();
```

- [ ] **Step 2: O botão, colado ao frame**

Localizar o `<FrameDoDocumento` (linha ~729) e envolvê-lo:

```tsx
          <div className="space-y-2">
            <div className="flex items-center justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => (emDocumento ? fecharDocumento() : abrirDocumento())}
                aria-pressed={emDocumento}
              >
                {emDocumento ? (
                  <Minimize2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Maximize2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                )}
                {emDocumento ? "Voltar ao formulário" : "Ver como sai"}
              </Button>
            </div>
            <FrameDoDocumento
              modo={emDocumento ? "documento" : "campo"}
```

(o resto das props do `FrameDoDocumento` fica como está; fechar a `</div>` extra
depois dele)

- [ ] **Step 3: Typecheck e lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint modules/nexo/components/PlanoDeGeracao.tsx`
Expected: sem saída nos dois.

- [ ] **Step 4: Provar na tela, medindo a caixa**

Subir `npm run dev`, abrir uma conversa com proposta de capa e:

1. clicar em **Ver como sai** — a coluna alarga para 760px e o texto do frame
   passa a seguir o corpo do modelo;
2. clicar em **Voltar ao formulário** — a coluna volta à largura de antes;
3. conferir que o campo mais baixo do frame tem **pelo menos 32px de altura nos
   dois modos**, medindo `getBoundingClientRect().height` — presença no DOM não
   prova tamanho, e é assim que este produto já se enganou antes.

- [ ] **Step 5: Commit**

```bash
git add modules/nexo/components/PlanoDeGeracao.tsx
git diff --cached --stat
git commit -m "plano: ver como sai alarga a coluna em vez de abrir uma tela"
```

---

## Task 5: Zerar a dívida nos cinco arquivos

**Files:**
- Modify: `app/globals.css` — o degrau de 11px ganha nome
- Modify: `modules/nexo/components/PlanoDeGeracao.tsx`
- Modify: `modules/nexo/components/BlocoDaLd.tsx`
- Modify: `modules/nexo/components/EditorDoNo.tsx`
- Modify: `modules/nexo/components/ConfirmationCard.tsx`

**Interfaces:**
- Consumes: `npm run mede:divida` (Tarefa 1) como portão.
- Produces: nada consumido por outra tarefa.

- [ ] **Step 1: Ver o que falta**

Run: `node scripts/mede-divida-de-design.ts`
Expected: FALHA (exit 1), listando arquivo, linha e trecho de cada violação
restante. `FrameDoDocumento.tsx` já deve estar em 0 pela Tarefa 3.

- [ ] **Step 2: O degrau de 11px ganha nome**

Aqui há uma contradição a resolver antes de mexer em qualquer arquivo, e ela é
do contador, não da `DESIGN.md`.

A spec permite 11px: *"microrrótulos podem cair a 11px, nunca abaixo"*. O
contador da Tarefa 1 reprova todo `text-[11px]`. Os dois estão certos sobre
coisas diferentes — a regra real não é "11px é proibido", é **"nenhuma tela
inventa um tamanho fora da escala"**. Um degrau nomeado é escala; um valor
arbitrário espalhado por cinco arquivos é invenção, mesmo quando o número
coincide.

Então o degrau ganha nome. Em `app/globals.css`, junto das demais utilidades:

```css
/*
 * MONO LABEL MIÚDO — o degrau de 11px que a §3 autoriza para microrrótulo.
 *
 * Ele existe como CLASSE, e não como `text-[11px]` espalhado, por causa da
 * própria razão de a rampa existir: "para que nenhuma tela invente um tamanho
 * fora da escala". Nomeado, ele é escala e dá para achar todos os usos;
 * solto, ele é o mesmo número escrito dezoito vezes sem ninguém saber por quê.
 *
 * NÃO use para texto de leitura. É para contador, sigla e hora — dado curto
 * que acompanha outro elemento. Frase em 11px é a letra miúda que a v1 da
 * barra lateral já produziu, e que a v2 desfez subindo a escala.
 */
@utility text-microrrotulo {
  font-size: 11px;
  line-height: 1.2;
}
```

E o contador passa a aceitar a classe nomeada, continuando a reprovar o valor
solto. Em `scripts/mede-divida-de-design.ts`, o comentário da regra ganha a
exceção — a expressão em si não muda, porque `text-microrrotulo` não casa com
`text-[…px]`.

- [ ] **Step 3: Tipografia — arquivo por arquivo**

Para cada tamanho solto que o contador apontar:

| Era | Vira | Quando |
|---|---|---|
| `text-[10px]` | `text-xs` (12px) | rótulo de campo, badge, metadado — 10px não existe na escala |
| `text-[11px]` em dado curto | `text-microrrotulo` | contador, sigla, hora, unidade |
| `text-[11px]` em texto de leitura | `text-sm` (14px) | descrição, conclusão, frase inteira |

A dúvida entre as duas últimas linhas se resolve com uma pergunta: **isso é uma
frase?** Se for, é `text-sm`. Microrrótulo é dado que acompanha, não texto que
se lê.

- [ ] **Step 4: Grade — trocar por múltiplos de 4**

| Era | Vira |
|---|---|
| `py-0.5` (2px) | `py-1` (4px) |
| `px-1.5` (6px) | `px-2` (8px) |
| `py-1.5` (6px) | `py-2` (8px) |
| `gap-1.5` (6px) | `gap-2` (8px) |
| `space-y-1.5` (6px) | `space-y-2` (8px) |
| `space-y-0.5` (2px) | `space-y-1` (4px) |
| `mt-1.5` (6px) | `mt-2` (8px) |
| `py-2.5` / `space-y-2.5` (10px) | `py-3` / `space-y-3` (12px) |

Arredondar **para cima**, não para baixo: a reclamação é aperto, e a correção
que aperta mais não é correção.

- [ ] **Step 5: O contador chega a zero**

Run: `node scripts/mede-divida-de-design.ts`
Expected: `nenhuma. os frames estão na escala.` e exit 0.

- [ ] **Step 6: Nada regrediu**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint modules/nexo/components/PlanoDeGeracao.tsx modules/nexo/components/BlocoDaLd.tsx modules/nexo/components/EditorDoNo.tsx modules/nexo/components/ConfirmationCard.tsx`
Expected: sem saída nos dois.

- [ ] **Step 7: Olhar a tela**

Subir `npm run dev` e abrir uma conversa com plano de geração. Confirmar que
nenhum card quebrou de layout ao crescer — texto maior e espaçamento maior
mudam altura, e o que cabia em duas linhas pode passar a caber em três.

- [ ] **Step 8: Commit com o número no corpo da mensagem**

```bash
git add app/globals.css modules/nexo/components/PlanoDeGeracao.tsx modules/nexo/components/BlocoDaLd.tsx modules/nexo/components/EditorDoNo.tsx modules/nexo/components/ConfirmationCard.tsx
git diff --cached --stat
git commit -m "frames: a divida de design zerada nos cinco arquivos"
```

---

## Ordem e dependências

| # | Tarefa | Depende de |
|---|---|---|
| 1 | Contador da dívida | — |
| 2 | Largura com dono único | — |
| 3 | Frame com dois modos | — |
| 4 | Botão "ver como sai" | 2 e 3 |
| 5 | Zerar a dívida | 1 (é o portão) e 3 |

As Tarefas 1, 2 e 3 são independentes entre si. A 4 é a única que precisa de
duas anteriores, e a 5 fecha.

## Uma coisa que o spec pedia e não virou tarefa

O spec manda usar `@container` em vez de `xl:`. **Nenhuma tarefa acabou
precisando de breakpoint**: o frame é flexbox e a coluna que alarga só lhe dá
mais espaço — não há layout que precise mudar de forma em nenhuma largura.

A regra fica em Global Constraints como guarda: se alguma tarefa descobrir que
precisa de um breakpoint, ele é de CONTAINER. Registrado aqui para a ausência
não parecer esquecimento.
