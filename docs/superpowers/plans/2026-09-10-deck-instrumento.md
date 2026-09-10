# O deck como instrumento — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer a estrutura e o visual das 19 folhas de `/apresentacao` e das 6 de `/apresentacao/valores` no sistema "Instrumento" do spec `docs/superpowers/specs/2026-09-10-deck-instrumento-design.md`, sem mudar uma palavra do texto ou das notas.

**Architecture:** O `Palco` passa a desenhar uma armadura fixa (trilho vertical com os índices, rótulo-título, grade) fora do crossfade; as folhas usam quatro arquétipos (`EscalaHorizontal`, `EscalaVertical`, `Confronto`, composição própria) e uma `Leitura` na base. `slides.tsx` vira um concatenador de seis arquivos, um por bloco. Toda prova é sem token, por Playwright contra o dev server.

**Tech Stack:** Next.js (App Router, React client components), CSS puro em `palco.css` com o sistema `--ap-*`, Playwright (`playwright` já é dependência) para as provas, Node 24.

## Global Constraints

- Palco fixo de **1920 × 1080**, escalado por `transform: scale()`; nada responsivo.
- **Texto e notas não mudam.** Copiar verbatim de `app/apresentacao/slides.tsx` e `app/apresentacao/valores/slides-valores.tsx` (versão do commit `3fc3651`).
- **Caixa alta só em três lugares:** rótulo-título, rótulos Mono e siglas. Caixa alta de rótulo é feita por `text-transform: uppercase` no CSS, nunca digitada; o DOM guarda caixa de frase.
- **Siglas (lista fechada):** LD, LDs, UBS, ODT, PDF, ZIP, IA, PROSUL, API, OCR, SC, S/N.
- **Cores:** só `var(--foreground)`, `var(--muted-foreground)`, `var(--border)`, `var(--nexodoc-accent)`, `var(--status-warning)`, `var(--status-critical)`, `var(--status-ok)`, `var(--status-ok-bg)`, `var(--nexodoc-raised)` e os neutros `#e6eaec`, `#8a969c`, `#5f6b72`, `#3d474d`, `#1f272c`. Teal abaixo de 10% da folha.
- **Tipo:** IBM Plex Sans para texto, IBM Plex Mono para dado e rótulo. Rampa: 16 · 20 · 26 · 32 · 44 · 60 · 80 · 96. `max-width: 64ch` em texto de leitura. Números com `font-variant-numeric: tabular-nums`.
- **Movimento:** só `transform` e `opacity`; durações e curvas só dos tokens `--ap-*` em `palco.css`; movimento reduzido mostra o estado final na hora.
- **Grade:** conteúdo de x = 224 a 1840; 12 colunas, calha 24; toda medida múltiplo de 4. Proibido centrar verticalmente um bloco que ocupe a folha.
- **Proibido:** `border-left`/`border-right` colorido maior que 1 px como faixa, gradiente em texto, cartão dentro de cartão, grade de cartões iguais, glow, partícula, typewriter.
- **Scripts de prova rodam da raiz do repo** (`playwright` não resolve do scratchpad) e exigem `npm run dev` noutro terminal. Scripts em Python para editar arquivos: gravar em arquivo e rodar com `python -X utf8` (heredoc com acento quebra no Git Bash).
- **Commits direto na main**, mensagem em pt-BR sem acento no título, rodapé de coautoria:

  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01XbP3NEdqrDM6b7NgmbTUW3
  ```

- **Nunca `git add -A`.** Adicionar caminho a caminho e conferir com `git diff --cached --stat`.

---

## Mapa de arquivos

| arquivo | responsabilidade |
|---|---|
| `app/apresentacao/palco.css` | armadura (`.ap-trilho`, `.ap-rotulo-titulo`, `.ap-grade`), arquétipos (`.ap-escala-h`, `.ap-escala-v`, `.ap-leitura`, `.ap-mostrador`, `.ap-confronto`), sistema `--ap-*` (mantido) |
| `app/apresentacao/palco.tsx` | motor: teclado, escala, crossfade, **trilho** e **rótulo-título** por folha; interface `Slide` ganha `titulo`/`subtitulo`, perde `denso` |
| `app/apresentacao/pecas.tsx` | peças compartilhadas: `Entra`, `Linhas`, `Contador`, `Linha` (mantidas) + `RotuloTitulo`, `Leitura`, `EscalaHorizontal`, `EscalaVertical`, `Confronto`, `Mostrador` (novas); `Marcador`, `Titulo`, `Fecho` removidas no fim |
| `app/apresentacao/folhas/o-que-e.tsx` | folhas 01 a 05 (capa, o que é, motor, revisa a si mesmo, o produto) + peças do motor e do mapa |
| `app/apresentacao/folhas/o-problema.tsx` | folhas 06 a 08 |
| `app/apresentacao/folhas/o-que-existe.tsx` | folhas 09 a 11 |
| `app/apresentacao/folhas/possiveis-perguntas.tsx` | folhas 13 a 16 |
| `app/apresentacao/folhas/o-dinheiro.tsx` | folhas 12 e 17 + `BotaoDosValores` |
| `app/apresentacao/folhas/o-pedido.tsx` | folhas 18 e 19 |
| `app/apresentacao/slides.tsx` | só concatena os seis arquivos na ordem 01–19 |
| `app/apresentacao/valores/slides-valores.tsx` | anexo A–F refeito nos arquétipos |
| `scripts/prova-deck-regua.mjs` | o trilho acende o índice certo e mostra o bloco certo em toda folha |
| `scripts/prova-deck-caixa.mjs` | nenhuma sigla em minúscula, nenhuma caixa alta digitada fora do Mono |
| `scripts/medir-folga-apresentacao.mjs` | passa a medir `.ap-rotulo-titulo` em y = 80 |
| `scripts/gerar-apresentacao-offline.mjs` | serializa o trilho dentro de cada folha |
| `package.json` | `prova:deck-regua`, `prova:deck-caixa` |

Ordem de dependência: Task 1 (armadura) → Task 2 (peças) → Tasks 3–7 (folhas, independentes entre si depois da 2) → Task 8 (anexo) → Task 9 (limpeza) → Task 10 (offline) → Task 11 (prova final e documentação).

---

### Task 1: A armadura — trilho e rótulo-título no `Palco`

**Files:**
- Modify: `app/apresentacao/palco.tsx`
- Modify: `app/apresentacao/palco.css`
- Create: `scripts/prova-deck-regua.mjs`
- Modify: `package.json` (scripts)

**Interfaces:**
- Produces: `interface Slide { rotulo; numero; bloco?; titulo?; subtitulo?; notas; corpo }` (sem `denso`). Classes CSS `.ap-trilho`, `.ap-trilho__indice`, `.ap-trilho__indice--atual`, `.ap-trilho__marca`, `.ap-trilho__bloco`, `.ap-rotulo-titulo`, `.ap-rotulo-titulo__sub`, `.ap-mono-rotulo`, `.ap-grade`. `.ap-folha` com `padding: 156px 80px 80px 224px`.

- [ ] **Step 1: Escrever a prova que falha**

Criar `scripts/prova-deck-regua.mjs`:

```js
// O TRILHO ACENDE A FOLHA CERTA — 10/09/2026.
//
// Em cada folha do deck e do anexo: o índice aceso no trilho é o número da
// folha, e o nome do bloco na vertical é o bloco dela. É a prova de que a
// armadura (que vive fora da folha) e o conteúdo (que vive dentro) não se
// desencontram — o único jeito de isso quebrar é silencioso.
//
//   npm run dev                          (noutro terminal)
//   node scripts/prova-deck-regua.mjs
//
// NÃO GASTA TOKEN.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const BLOCOS_DO_DECK = [
  "", "O que é", "O que é", "O que é", "O que é",
  "O problema", "O problema", "O problema",
  "O que existe", "O que existe", "O que existe",
  "O dinheiro",
  "Possíveis perguntas", "Possíveis perguntas", "Possíveis perguntas", "Possíveis perguntas",
  "O dinheiro",
  "O pedido", "O pedido",
];
const LETRAS = ["A", "B", "C", "D", "E", "F"];

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" });
let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log((cond ? "  OK      " : "  FALHOU  ") + nome + (cond ? "" : " :: " + detalhe));
  if (!cond) falhas++;
};

await p.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) {
  await p.getByRole("button", { name: /Entrar como dev/i }).click();
  await p.waitForURL("**/nexo**");
}

async function trilho() {
  return p.evaluate(() => {
    const t = document.querySelector(".ap-trilho");
    if (!t) return null;
    const aceso = t.querySelector(".ap-trilho__indice--atual");
    const marca = t.querySelector(".ap-trilho__marca");
    const r = aceso?.getBoundingClientRect();
    const m = marca?.getBoundingClientRect();
    return {
      indices: t.querySelectorAll(".ap-trilho__indice").length,
      aceso: aceso?.textContent?.trim() ?? null,
      bloco: t.querySelector(".ap-trilho__bloco")?.textContent?.trim() ?? "",
      // a marca fica na mesma altura do índice aceso (centro a centro, ±2 px)
      marcaAlinhada: r && m ? Math.abs((r.top + r.height / 2) - (m.top + m.height / 2)) < 2 : false,
    };
  });
}

for (const [rota, esperados, blocos] of [
  ["/apresentacao", Array.from({ length: 19 }, (_, i) => String(i + 1).padStart(2, "0")), BLOCOS_DO_DECK],
  ["/apresentacao/valores", LETRAS, LETRAS.map(() => "Os valores")],
]) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  for (let i = 0; i < esperados.length; i++) {
    if (i > 0) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(350); }
    const t = await trilho();
    ok(`${rota} ${esperados[i]} tem trilho`, !!t);
    if (!t) continue;
    ok(`${rota} ${esperados[i]} lista ${esperados.length} índices`, t.indices === esperados.length, String(t.indices));
    ok(`${rota} ${esperados[i]} acende o índice certo`, t.aceso === esperados[i], t.aceso ?? "nenhum");
    ok(`${rota} ${esperados[i]} mostra o bloco certo`, t.bloco === blocos[i], JSON.stringify(t.bloco));
    ok(`${rota} ${esperados[i]} marca alinhada ao índice`, t.marcaAlinhada);
  }
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO CERTO");
process.exit(falhas ? 1 : 0);
```

Adicionar em `package.json`, depois de `"prova:marca"`:

```json
    "prova:deck-regua": "node scripts/prova-deck-regua.mjs",
    "prova:deck-caixa": "node scripts/prova-deck-caixa.mjs",
```

- [ ] **Step 2: Rodar a prova e ver falhar**

Run: `npm run dev` (noutro terminal), depois `node scripts/prova-deck-regua.mjs`
Expected: `FALHOU /apresentacao 01 tem trilho` em toda folha; termina em `25 FALHA(S)` ou mais.

- [ ] **Step 3: CSS da armadura**

Em `app/apresentacao/palco.css`, **substituir** o bloco de `.ap-folha` até `.ap-numero` (inclusive `.ap-folha--denso`, `.ap-folha--denso .ap-cabeca`, `.ap-cabeca`, `.ap-bloco`, `.ap-numero`) por:

```css
/*
 * A FOLHA. Ocupa o palco inteiro; só a corrente é montada (mais a que sai, por
 * 260 ms). O recuo esquerdo de 224 deixa os 144 do trilho mais 80 de margem; o
 * de cima, 156, é onde o conteúdo nasce — abaixo do rótulo-título (y = 80) e
 * da linha fina (y = 124). NADA aqui centra verticalmente: o que sobra de
 * espaço fica embaixo, e isso é aceitável; o bloco à deriva não é.
 */
.ap-folha {
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 156px 80px 80px 224px;
  background: var(--background);
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}

/* ═══════════════════════════════════════════════════════════════════════════
   A ARMADURA — o que é igual em toda folha e NÃO participa do crossfade.

   O TRILHO. Faixa de 144 px à esquerda com os índices de todas as folhas; a
   corrente acesa, uma marca teal ao lado dela e o nome do bloco na vertical.
   Mora no palco, fora da <section> da folha: na troca, o conteúdo se dissolve
   e o trilho fica — só a marca desliza um índice. É assim que a sala percebe
   a mudança de bloco sem slide separador.
   ═══════════════════════════════════════════════════════════════════════════ */
.ap-trilho {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 144px;
  border-right: 1px solid var(--border);
  font-family: "IBM Plex Mono", ui-monospace, monospace;
}

.ap-trilho__indices {
  position: absolute;
  left: 0;
  top: 72px;
  width: 144px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ap-trilho__indice {
  height: 40px;
  line-height: 40px;
  text-align: center;
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  color: #3d474d;
}

.ap-trilho__indice--atual {
  color: var(--foreground);
  font-weight: 500;
}

/* A marca desliza com a folha: um passo de 40 px por índice. */
.ap-trilho__marca {
  position: absolute;
  left: 128px;
  top: 72px;
  width: 16px;
  height: 40px;
  background: var(--nexodoc-accent);
  transition: transform var(--ap-curta) var(--ap-entra);
}

.ap-trilho__bloco {
  position: absolute;
  left: 0;
  top: 864px;
  width: 144px;
  height: 168px;
  display: flex;
  align-items: center;
  justify-content: center;
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 14px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5f6b72;
  white-space: nowrap;
}

/*
 * O RÓTULO-TÍTULO. Mono, caixa alta por CSS (o DOM guarda caixa de frase), em
 * y = 80, com a linha fina em y = 124. Fica dentro da folha para dissolver com
 * ela, mas na mesma posição em toda folha — parece fixo, e só o texto muda.
 */
.ap-rotulo-titulo {
  position: absolute;
  left: 224px;
  right: 80px;
  top: 80px;
  margin: 0;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: baseline;
  gap: 28px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 20px;
  line-height: 24px;
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.ap-rotulo-titulo__sub {
  letter-spacing: 0;
  text-transform: none;
  color: #5f6b72;
}

/* Rótulo Mono genérico (A PERGUNTA, LEITURA, PÁGINAS…). Caixa alta por CSS. */
.ap-mono-rotulo {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 16px;
  line-height: 20px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #5f6b72;
}

/* A grade: 12 colunas de x = 224 a 1840, calha 24. */
.ap-grade {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0 24px;
}
```

E, no fim do arquivo, dentro do bloco `@media (prefers-reduced-motion: reduce)` já existente, acrescentar `.ap-trilho__marca { transition: none; }`.

- [ ] **Step 4: O `Palco` desenha o trilho e o rótulo**

Em `app/apresentacao/palco.tsx`, trocar a interface `Slide`:

```ts
export interface Slide {
  /** Rótulo curto, para as notas e para o índice. */
  rotulo: string;
  /** O que aparece no trilho: "01".."19" no deck, "A".."F" no anexo. */
  numero: string;
  /** O bloco narrativo a que o slide pertence. Vazio na capa. */
  bloco?: string;
  /** O rótulo-título da folha, em caixa de frase (o CSS põe em caixa alta). Vazio na capa. */
  titulo?: string;
  /** Nome de arquivo ou subtítulo que acompanha o rótulo-título, sem caixa alta. */
  subtitulo?: string;
  /** O que o apresentador fala e o slide NÃO mostra. */
  notas: string;
  corpo: ReactNode;
}
```

Acrescentar, antes de `export function Palco`:

```tsx
/**
 * O TRILHO — os índices de todas as folhas, a corrente acesa e a marca ao lado.
 * Vive fora da <section> da folha: não dissolve na troca, só a marca desliza.
 * `aria-hidden` porque é o mesmo dado que a régua de controle já anuncia.
 */
function Trilho({ folhas, indice }: { folhas: readonly Slide[]; indice: number }) {
  return (
    <div className="ap-trilho" aria-hidden="true">
      <ol className="ap-trilho__indices">
        {folhas.map((f, i) => (
          <li
            key={f.numero}
            className={
              i === indice ? "ap-trilho__indice ap-trilho__indice--atual" : "ap-trilho__indice"
            }
          >
            {f.numero}
          </li>
        ))}
      </ol>
      <span
        className="ap-trilho__marca"
        style={{ transform: `translateY(${indice * 40}px)` }}
      />
      <span className="ap-trilho__bloco">{folhas[indice].bloco ?? ""}</span>
    </div>
  );
}
```

No JSX do `Palco`, dentro de `<div className="ap-palco" ref={palco}>`, **antes** do `.map` das folhas, inserir `<Trilho folhas={slides} indice={indice} />`. Dentro de cada `<section>`, **substituir** o bloco `{folha.bloco ? (<div className="ap-cabeca">…</div>) : null}` por:

```tsx
                {folha.titulo ? (
                  <h2 className="ap-rotulo-titulo">
                    <span>{folha.titulo}</span>
                    {folha.subtitulo ? (
                      <span className="ap-rotulo-titulo__sub">{folha.subtitulo}</span>
                    ) : null}
                  </h2>
                ) : null}
```

E remover `folha.denso ? "ap-folha--denso" : ""` da lista de classes da `<section>`.

- [ ] **Step 5: Tirar `denso` das folhas para o TypeScript compilar**

Em `app/apresentacao/slides.tsx` e `app/apresentacao/valores/slides-valores.tsx`, apagar toda linha `    denso: true,` (há 3 no deck e 5 no anexo). As folhas antigas continuam com `Titulo` próprio e sem `titulo:` na interface — o rótulo-título só aparece quando cada bloco for refeito (Tasks 3–8).

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao`
Expected: nenhuma linha.

- [ ] **Step 6: Rodar a prova e ver passar o trilho (bloco ainda vazio)**

Run: `node scripts/prova-deck-regua.mjs`
Expected: `tem trilho`, `lista … índices`, `acende o índice certo` e `marca alinhada` OK em todas; `mostra o bloco certo` OK no deck (o campo `bloco` já existe nas folhas antigas) e no anexo. Termina em `TUDO CERTO`.

- [ ] **Step 7: Commit**

```bash
git add app/apresentacao/palco.tsx app/apresentacao/palco.css app/apresentacao/slides.tsx app/apresentacao/valores/slides-valores.tsx scripts/prova-deck-regua.mjs package.json
git diff --cached --stat
git commit -m "o deck ganha o trilho: a armadura vive no palco e a marca desliza na troca"
```

---

### Task 2: As peças do instrumento

**Files:**
- Modify: `app/apresentacao/pecas.tsx`
- Modify: `app/apresentacao/palco.css`
- Create: `scripts/prova-deck-caixa.mjs`

**Interfaces:**
- Consumes: `Entra`, `Linhas`, `MONO`, `rotulo`, `secundario` de `pecas.tsx`; classes da Task 1.
- Produces (exportadas de `pecas.tsx`):

```ts
export type LinhaDeLeitura = { texto: string; chave?: boolean };
export function Leitura(p: { linhas: readonly LinhaDeLeitura[]; atraso?: number; rotuloDo?: string }): JSX.Element;

export type Fato = { titulo: readonly string[]; texto?: ReactNode; cor?: string; extra?: ReactNode };
export function EscalaHorizontal(p: { fatos: readonly Fato[]; atraso?: number; tracejada?: boolean; compacta?: boolean; style?: CSSProperties }): JSX.Element;

export type ItemDaEscala = { titulo: string; texto?: string; cor?: string };
export function EscalaVertical(p: { itens: readonly ItemDaEscala[]; atraso?: number; inicio?: number; numerada?: boolean; style?: CSSProperties }): JSX.Element;

export function Confronto(p: { pergunta?: string; titulo?: string; linhaFina?: string; respostas: readonly (readonly [string, string])[]; leitura: readonly LinhaDeLeitura[] }): JSX.Element;

export function Mostrador(p: { valor: ReactNode; rotuloDo: string; cor?: string; atraso: number }): JSX.Element;
```

Classes CSS: `.ap-leitura`, `.ap-leitura__frase`, `.ap-leitura__linha--chave`, `.ap-escala-h`, `.ap-escala-h--tracejada`, `.ap-escala-h--compacta`, `.ap-escala-h__fato`, `.ap-escala-h__titulo`, `.ap-escala-h__texto`, `.ap-escala-h__linha`, `.ap-escala-h__tick`, `.ap-escala-v`, `.ap-escala-v__linha`, `.ap-escala-v__item`, `.ap-escala-v__numero`, `.ap-escala-v__tick`, `.ap-escala-v__titulo`, `.ap-escala-v__texto`, `.ap-confronto`, `.ap-confronto__pergunta`, `.ap-confronto__pergunta--longa`, `.ap-mostrador`, `.ap-mostrador__valor`, `.ap-texto` (Sans 26/1.45, 64ch), `.ap-titulo-de-fato` (Sans 500 44).

- [ ] **Step 1: A prova de caixa (falha no deck antigo por não achar `.ap-rotulo-titulo`)**

Criar `scripts/prova-deck-caixa.mjs`:

```js
// A REGRA DA CAIXA ALTA, medida — 10/09/2026.
//
// Caixa alta em três lugares e só neles: rótulo-título, rótulos Mono e siglas.
// Os dois primeiros são feitos por CSS (`text-transform`), então o DOM guarda
// caixa de frase — e é o DOM que se lê aqui. Uma palavra de 4+ letras toda em
// caixa alta, fora de elemento Mono e fora da lista de siglas, é caixa alta
// digitada onde não devia. Uma sigla da lista em minúscula é o defeito que o
// autor apontou em 10/09 ("palavras que tinham de estar em caixa alta e não
// estão").
//
//   npm run dev                          (noutro terminal)
//   node scripts/prova-deck-caixa.mjs
//
// NÃO GASTA TOKEN.
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const SIGLAS = ["LD", "LDS", "UBS", "ODT", "PDF", "ZIP", "IA", "PROSUL", "API", "OCR", "SC", "S/N", "EST"];
// "ia" e "sc" em minúscula são palavras da língua ("ele ia", "sc" não ocorre): só as inequívocas.
const MINUSCULAS_PROIBIDAS = /\b(ld|lds|ubs|odt|pdf|zip|prosul|api|ocr)\b/;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" });
let falhas = 0;
const ok = (nome, cond, detalhe = "") => {
  console.log((cond ? "  OK      " : "  FALHOU  ") + nome + (cond ? "" : " :: " + detalhe));
  if (!cond) falhas++;
};
await p.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (p.url().includes("/login")) {
  await p.getByRole("button", { name: /Entrar como dev/i }).click();
  await p.waitForURL("**/nexo**");
}

for (const [rota, n] of [["/apresentacao", 19], ["/apresentacao/valores", 6]]) {
  await p.goto(`${BASE}${rota}`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  for (let i = 1; i <= n; i++) {
    if (i > 1) { await p.keyboard.press("ArrowRight"); await p.waitForTimeout(350); }
    const r = await p.evaluate((siglas) => {
      const folha = document.querySelector(".ap-folha:not(.ap-folha--sai)");
      const temRotulo = i => !!folha.querySelector(".ap-rotulo-titulo") || i === 1;
      const andar = document.createTreeWalker(folha, NodeFilter.SHOW_TEXT);
      const capsForaDoMono = [];
      let texto = "";
      let no;
      while ((no = andar.nextNode())) {
        const t = no.textContent;
        texto += " " + t;
        const el = no.parentElement;
        const fonte = getComputedStyle(el).fontFamily;
        const mono = /Mono|monospace/i.test(fonte);
        if (mono) continue;
        for (const palavra of t.split(/[^\p{L}/]+/u)) {
          if (palavra.length >= 4 && palavra === palavra.toUpperCase() && palavra !== palavra.toLowerCase() && !siglas.includes(palavra)) {
            capsForaDoMono.push(palavra);
          }
        }
      }
      return { temRotulo: temRotulo(Number(location.pathname.length)), capsForaDoMono, texto };
    }, SIGLAS);
    const numero = String(i).padStart(2, "0");
    const min = r.texto.match(MINUSCULAS_PROIBIDAS);
    ok(`${rota} ${numero} sem sigla em minúscula`, !min, min?.[0] ?? "");
    ok(`${rota} ${numero} sem caixa alta digitada fora do Mono`, r.capsForaDoMono.length === 0, r.capsForaDoMono.join(", "));
    if (!(rota === "/apresentacao" && i === 1)) {
      const rot = await p.locator(".ap-folha:not(.ap-folha--sai) .ap-rotulo-titulo").count();
      ok(`${rota} ${numero} tem rótulo-título`, rot === 1, String(rot));
    }
  }
}
await b.close();
console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTUDO CERTO");
process.exit(falhas ? 1 : 0);
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node scripts/prova-deck-caixa.mjs`
Expected: `FALHOU … tem rótulo-título` em todas as folhas exceto a capa (as folhas antigas ainda usam `Titulo`). As duas outras asserções passam ou falham conforme o texto antigo; anotar o que falhar de "caixa alta digitada" (o esperado é nenhuma).

- [ ] **Step 3: CSS dos arquétipos**

Acrescentar em `app/apresentacao/palco.css`, logo depois de `.ap-grade`:

```css
/* ═══════════════════════════════════════════════════════════════════════════
   OS ARQUÉTIPOS — a escala segura o conteúdo; nada flutua.
   ═══════════════════════════════════════════════════════════════════════════ */

/* Texto de leitura: Sans 26, 64ch. */
.ap-texto {
  margin: 0;
  font-size: 26px;
  line-height: 1.45;
  max-width: 64ch;
  color: var(--muted-foreground);
  text-wrap: pretty;
}

/* Título de fato ou de leitura: Sans 500 44. */
.ap-titulo-de-fato {
  margin: 0;
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--foreground);
}

/*
 * ESCALA HORIZONTAL. Os fatos ficam ACIMA da linha; a linha atravessa; um tick
 * de 24 px marca o início de cada fato e o fim do último. Colunas iguais.
 * A linha se desenha (`ap-risca`) antes dos fatos assentarem: primeiro a
 * escala, depois a agulha.
 */
.ap-escala-h {
  position: relative;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 0 24px;
  padding-bottom: 36px;
}

.ap-escala-h__fato {
  position: relative;
  min-width: 0;
  padding-right: 24px;
}

.ap-escala-h__fato > * + * {
  margin-top: 16px;
}

.ap-escala-h__titulo {
  margin: 0;
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -0.02em;
  line-height: 1.1;
  color: var(--foreground);
}

.ap-escala-h--compacta .ap-escala-h__titulo {
  font-size: 26px;
  line-height: 1.3;
  letter-spacing: -0.01em;
}

.ap-escala-h__texto {
  margin: 0;
  font-size: 26px;
  line-height: 1.45;
  color: var(--muted-foreground);
  text-wrap: pretty;
}

.ap-escala-h__linha {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  background: #3d474d;
}

.ap-escala-h--tracejada .ap-escala-h__linha {
  background: repeating-linear-gradient(90deg, #3d474d 0 8px, transparent 8px 16px);
}

/* O tick nasce no início de cada fato; o último fato ganha um segundo tick no fim. */
.ap-escala-h__tick {
  position: absolute;
  bottom: -12px;
  width: 1px;
  height: 24px;
  background: #5f6b72;
}

.ap-escala-h__tick--inicio { left: 0; }
.ap-escala-h__tick--fim { right: 0; }

/*
 * ESCALA VERTICAL. Linha em x = 96 dentro do componente (x = 320 da folha),
 * número à esquerda dela, tick de 24 px por item, texto a partir de x = 144
 * (368 da folha). ALTURA IGUAL POR ITEM: o espaço disponível dividido pelo
 * número de itens, nunca a altura do texto — é o que a torna uma escala e não
 * uma lista.
 */
.ap-escala-v {
  position: relative;
  display: grid;
  grid-auto-rows: 1fr;
  flex: 1;
  min-height: 0;
}

.ap-escala-v__linha {
  position: absolute;
  left: 96px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: #3d474d;
}

.ap-escala-v__item {
  position: relative;
  display: grid;
  grid-template-columns: 96px 1fr;
  align-items: start;
  padding-top: 12px;
  min-width: 0;
}

.ap-escala-v__numero {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 16px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  color: #5f6b72;
  padding-top: 8px;
}

.ap-escala-v__tick {
  position: absolute;
  left: 84px;
  top: 22px;
  width: 24px;
  height: 1px;
  background: #5f6b72;
}

.ap-escala-v__corpo {
  padding-left: 48px;
  min-width: 0;
}

.ap-escala-v__titulo {
  margin: 0;
  font-size: 32px;
  font-weight: 500;
  letter-spacing: -0.015em;
  line-height: 1.2;
  color: var(--foreground);
  text-wrap: pretty;
}

.ap-escala-v__texto {
  margin: 8px 0 0;
  font-size: 26px;
  line-height: 1.45;
  max-width: 64ch;
  color: var(--muted-foreground);
  text-wrap: pretty;
}

/*
 * A LEITURA. Base da folha: linha em y = 820, rótulo em y = 856, frase a
 * partir de y = 892. Altura FIXA (180) para a linha cair sempre no mesmo y,
 * tenha a frase uma ou duas linhas.
 */
.ap-leitura {
  flex: none;
  margin-top: auto;
  height: 180px;
  box-sizing: border-box;
  padding-top: 32px;
  border-top: 1px solid var(--border);
}

.ap-leitura__frase {
  margin: 16px 0 0;
  font-size: 48px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.15;
  color: var(--foreground);
}

.ap-leitura__linha--chave {
  color: var(--nexodoc-accent);
}

/*
 * O CONFRONTO. Pergunta em Mono à esquerda (5 colunas), leituras à direita
 * (colunas 7 a 12). A pergunta cai um degrau (32 → 26) quando passa de 160
 * caracteres.
 */
.ap-confronto {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 0 24px;
}

.ap-confronto__esquerda {
  grid-column: 1 / span 5;
  min-width: 0;
}

.ap-confronto__direita {
  grid-column: 7 / span 6;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ap-confronto__pergunta {
  margin: 16px 0 0;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 32px;
  line-height: 1.4;
  letter-spacing: -0.012em;
  color: var(--foreground);
  text-wrap: pretty;
}

.ap-confronto__pergunta--longa {
  font-size: 26px;
}

/*
 * O MOSTRADOR. Valor em Mono 80 sobre rótulo, com uma borda esquerda de 1 px
 * (é a régua do mostrador, não faixa de acento: 1 px, neutra).
 */
.ap-mostrador {
  border-left: 1px solid #3d474d;
  padding-left: 24px;
  min-width: 0;
}

.ap-mostrador__valor {
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 80px;
  font-weight: 500;
  letter-spacing: -0.035em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--foreground);
}
```

- [ ] **Step 4: As peças em `pecas.tsx`**

Acrescentar ao fim de `app/apresentacao/pecas.tsx` (as peças antigas `Marcador`, `Titulo`, `Fecho` ficam até a Task 9):

```tsx
/* ═══════════════════════════════════════════════════════ os arquétipos (10/09) */

export type LinhaDeLeitura = { texto: string; chave?: boolean };

/**
 * A LEITURA — a conclusão da folha, na base, como a leitura de um instrumento.
 * Linha fina, rótulo LEITURA e a frase em Sans 600 48, linha a linha por
 * máscara. Qual linha é a CHAVE (em teal) é decisão editorial por folha.
 */
export function Leitura({
  linhas,
  atraso = 900,
  rotuloDo = "Leitura",
}: {
  linhas: readonly LinhaDeLeitura[];
  atraso?: number;
  rotuloDo?: string;
}) {
  return (
    <div className="ap-leitura">
      <Entra atraso={atraso}>
        <span className="ap-mono-rotulo">{rotuloDo}</span>
      </Entra>
      <p className="ap-leitura__frase">
        {linhas.map((l, i) => (
          <span
            key={l.texto}
            className={l.chave ? "ap-mascara ap-leitura__linha--chave" : "ap-mascara"}
          >
            <span
              className="ap-linha"
              style={{ animationDelay: `${atraso + 160 + i * 140}ms` }}
            >
              {l.texto}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

export type Fato = {
  /** Título em linhas deliberadas. */
  titulo: readonly string[];
  texto?: ReactNode;
  /** Cor do título (padrão: foreground). */
  cor?: string;
  /** O que vem depois do texto: uma frase colorida, uma lista Mono. */
  extra?: ReactNode;
};

/**
 * ESCALA HORIZONTAL — fatos em linha, ticks embaixo. A linha se desenha, os
 * ticks aparecem, e só então os fatos assentam, em cascata da esquerda para a
 * direita.
 */
export function EscalaHorizontal({
  fatos,
  atraso = 200,
  tracejada = false,
  compacta = false,
  style,
}: {
  fatos: readonly Fato[];
  atraso?: number;
  tracejada?: boolean;
  compacta?: boolean;
  style?: CSSProperties;
}) {
  const classes = [
    "ap-escala-h",
    tracejada ? "ap-escala-h--tracejada" : "",
    compacta ? "ap-escala-h--compacta" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} style={style}>
      {fatos.map((f, i) => (
        <div key={f.titulo.join(" ")} className="ap-escala-h__fato">
          <p className="ap-escala-h__titulo" style={f.cor ? { color: f.cor } : undefined}>
            <Linhas linhas={f.titulo} atraso={atraso + 320 + i * 160} />
          </p>
          {f.texto ? (
            <Entra atraso={atraso + 440 + i * 160}>
              <p className="ap-escala-h__texto">{f.texto}</p>
            </Entra>
          ) : null}
          {f.extra ? <Entra atraso={atraso + 560 + i * 160}>{f.extra}</Entra> : null}
          <span
            aria-hidden="true"
            className="ap-escala-h__tick ap-escala-h__tick--inicio ap-surge"
            style={{ animationDelay: `${atraso + 200}ms` }}
          />
          {i === fatos.length - 1 ? (
            <span
              aria-hidden="true"
              className="ap-escala-h__tick ap-escala-h__tick--fim ap-surge"
              style={{ animationDelay: `${atraso + 200}ms` }}
            />
          ) : null}
        </div>
      ))}
      <span
        aria-hidden="true"
        className="ap-escala-h__linha ap-risca"
        style={{ animationDelay: `${atraso}ms` }}
      />
    </div>
  );
}

export type ItemDaEscala = { titulo: string; texto?: string; cor?: string };

/**
 * ESCALA VERTICAL — leituras numeradas de altura igual. A linha desce
 * (`ap-desce`), os ticks aparecem, e as leituras assentam de cima para baixo.
 */
export function EscalaVertical({
  itens,
  atraso = 200,
  inicio = 1,
  numerada = true,
  style,
}: {
  itens: readonly ItemDaEscala[];
  atraso?: number;
  inicio?: number;
  numerada?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className="ap-escala-v" style={style}>
      <span
        aria-hidden="true"
        className="ap-escala-v__linha ap-desce"
        style={{ animationDelay: `${atraso}ms` }}
      />
      {itens.map((item, i) => (
        <div key={item.titulo} className="ap-escala-v__item">
          <span
            className="ap-escala-v__numero ap-surge"
            style={{ animationDelay: `${atraso + 200}ms`, color: item.cor }}
          >
            {numerada ? String(inicio + i).padStart(2, "0") : ""}
          </span>
          <span
            aria-hidden="true"
            className="ap-escala-v__tick ap-surge"
            style={{ animationDelay: `${atraso + 200}ms`, background: item.cor }}
          />
          <div className="ap-escala-v__corpo">
            <p className="ap-escala-v__titulo" style={item.cor ? { color: item.cor } : undefined}>
              <Linhas linhas={[item.titulo]} atraso={atraso + 320 + i * 160} />
            </p>
            {item.texto ? (
              <Entra atraso={atraso + 440 + i * 160}>
                <p className="ap-escala-v__texto">{item.texto}</p>
              </Entra>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * O CONFRONTO — a folha de objeção. A pergunta, com as palavras do comprador,
 * em Mono à esquerda (mono é o que os OUTROS dizem); as respostas como leituras
 * numeradas à direita; a leitura final na base. Sem `pergunta`, a esquerda traz
 * o título e a linha fina (a folha 16 afirma em vez de responder).
 */
export function Confronto({
  pergunta,
  titulo,
  linhaFina,
  respostas,
  leitura,
}: {
  pergunta?: string;
  titulo?: string;
  linhaFina?: string;
  respostas: readonly (readonly [string, string])[];
  leitura: readonly LinhaDeLeitura[];
}) {
  const longa = (pergunta?.length ?? 0) > 160;
  return (
    <>
      <div className="ap-confronto">
        <div className="ap-confronto__esquerda">
          {pergunta ? (
            <>
              <Entra atraso={0}>
                <span className="ap-mono-rotulo">A pergunta</span>
              </Entra>
              <Entra atraso={120}>
                <p
                  className={
                    longa ? "ap-confronto__pergunta ap-confronto__pergunta--longa" : "ap-confronto__pergunta"
                  }
                >
                  {`“${pergunta}”`}
                </p>
              </Entra>
            </>
          ) : (
            <>
              <p className="ap-titulo-de-fato">
                <Linhas linhas={[titulo ?? ""]} atraso={0} />
              </p>
              {linhaFina ? (
                <Entra atraso={140}>
                  <p className="ap-texto" style={{ marginTop: 16 }}>
                    {linhaFina}
                  </p>
                </Entra>
              ) : null}
            </>
          )}
        </div>
        <div className="ap-confronto__direita">
          <EscalaVertical
            atraso={300}
            itens={respostas.map(([t, x]) => ({ titulo: t, texto: x }))}
          />
        </div>
      </div>
      <Leitura linhas={leitura} atraso={300 + 320 + respostas.length * 160 + 200} />
    </>
  );
}

/** O MOSTRADOR — um valor em Mono 80 sobre o rótulo, com a régua de 1 px à esquerda. */
export function Mostrador({
  valor,
  rotuloDo,
  cor,
  atraso,
}: {
  valor: ReactNode;
  rotuloDo: string;
  cor?: string;
  atraso: number;
}) {
  return (
    <div className="ap-mostrador">
      <span className="ap-mascara ap-mostrador__valor" style={cor ? { color: cor } : undefined}>
        <span className="ap-linha" style={{ animationDelay: `${atraso}ms` }}>
          {valor}
        </span>
      </span>
      <Entra atraso={atraso + 120}>
        <span className="ap-mono-rotulo" style={{ display: "block", marginTop: 16 }}>
          {rotuloDo}
        </span>
      </Entra>
    </div>
  );
}
```

- [ ] **Step 5: Compilar e lintar**

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao`
Expected: nenhuma saída de erro (as peças ainda não são usadas, mas exportadas).

- [ ] **Step 6: Commit**

```bash
git add app/apresentacao/pecas.tsx app/apresentacao/palco.css scripts/prova-deck-caixa.mjs
git diff --cached --stat
git commit -m "as pecas do instrumento: escala horizontal, escala vertical, confronto, leitura e mostrador"
```

---

### Task 3: Bloco O QUE É — folhas 01 a 05

**Files:**
- Create: `app/apresentacao/folhas/o-que-e.tsx`
- Modify: `app/apresentacao/slides.tsx` (importar e usar `O_QUE_E`, apagar as folhas 01–05 antigas e as peças do motor e do mapa que vão para o arquivo novo)

**Interfaces:**
- Consumes: `Slide` (palco.tsx), `Entra`, `Linhas`, `Contador`, `MONO`, `EscalaHorizontal`, `EscalaVertical`, `Mostrador` (pecas.tsx), `MarcaViva`, `AgentOrb`, `corDaDisciplina`, `siglaDaDisciplina`.
- Produces: `export const O_QUE_E: readonly Slide[]` (5 folhas). `slides.tsx` passa a exportar `SLIDES = [...O_QUE_E, ...folhas antigas 06–19]`.

- [ ] **Step 1: Criar `app/apresentacao/folhas/o-que-e.tsx`**

Copiar de `slides.tsx` **sem alterar** os componentes `MetadeDoColchete`, `PAGINAS_COM_ACHADO`, `COR_DA_GRAVIDADE`, `MapaDoMemorial`, `CartaoDeAchado` e o tipo `Gravidade`. **Apagar** `Passo`, `Liga` e `Dado` (substituídos por `EscalaHorizontal` compacta e `Mostrador`). `Ramo` é reescrito. Conteúdo do arquivo:

```tsx
"use client";

import type { CSSProperties } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";
import { corDaDisciplina, siglaDaDisciplina } from "@/modules/nexo/lib/disciplina-cor";

import type { Slide } from "../palco";
import { Contador, Entra, EscalaHorizontal, EscalaVertical, Linhas, MONO, Mostrador } from "../pecas";

/**
 * BLOCO 1 — O QUE É (folhas 01 a 05). Texto e notas são os de 09/09/2026,
 * copiados sem alteração; o que este arquivo decide é a composição, pelo spec
 * `2026-09-10-deck-instrumento-design.md`.
 */

/** A largura do conteúdo: 1920 − 224 (trilho + margem) − 80. */
export const LARGURA_UTIL = 1616;

/* ─────────────────────────────────────────────── o motor: colchete e ramos */

// [colar aqui MetadeDoColchete, sem alteração]

/**
 * Um ramo do motor: rótulo e a cadeia de etapas como ESCALA HORIZONTAL compacta.
 * As caixas de antes eram cartões iguais em fila; aqui as etapas são fatos
 * sobre a linha, e a saída é o último fato, em teal. O documento (o pulso)
 * percorre a linha da escala — a mesma que os ticks marcam.
 */
function Ramo({
  titulo,
  cor,
  passos,
  saida,
  atrasoBase,
}: {
  titulo: string;
  cor: string;
  passos: readonly string[];
  saida: string;
  atrasoBase: number;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: 12, position: "relative" }}>
      <Entra atraso={atrasoBase}>
        <span className="ap-mono-rotulo" style={{ color: cor }}>{titulo}</span>
      </Entra>
      <div style={{ position: "relative" }}>
        <span
          aria-hidden="true"
          className="ap-pulso"
          style={{
            position: "absolute",
            left: 0,
            bottom: -5,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: cor,
            zIndex: 1,
            ["--ap-percurso" as string]: "1390px",
            animationDelay: `${atrasoBase + 320 + passos.length * 160 + 720}ms`,
          }}
        />
        <EscalaHorizontal
          compacta
          atraso={atrasoBase}
          fatos={[
            ...passos.map((p) => ({ titulo: [p] })),
            { titulo: [saida], cor: "var(--nexodoc-accent)" },
          ]}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────── o memorial lido, página a página (folha 05) */

// [colar aqui: type Gravidade, PAGINAS_COM_ACHADO, COR_DA_GRAVIDADE, MapaDoMemorial, CartaoDeAchado — sem alteração]

/* ══════════════════════════════════════════════════════════════════ AS FOLHAS */

export const O_QUE_E: readonly Slide[] = [
  {
    rotulo: "Capa",
    numero: "01",
    notas:
      "Abrir sem preâmbulo. Deixar o orbe respirar dois segundos antes de falar — ele é o produto se apresentando sozinho. Nome, o que é, quem fez. Não explicar a capa.",
    corpo: (
      <>
        {/*
          A CAPA nasce na grade, e não no centro. O orbe ocupa as colunas 1 a 4;
          o nome e a linha, da 5 em diante, alinhados pelo topo em y = 156 + 96.
          O rodapé fica sobre a linha fina em y = 900 — a única linha da capa.
        */}
        <div className="ap-grade" style={{ flex: 1, alignItems: "start", paddingTop: 96 }}>
          <div
            className="ap-surge"
            style={{ gridColumn: "1 / span 4", position: "relative", display: "grid", placeItems: "center", height: 340 }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: -40,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgb(0 166 147 / 0.16), transparent 66%)",
                filter: "blur(28px)",
              }}
            />
            <div style={{ position: "relative" }}>
              <AgentOrb size="hero" state="idle" />
            </div>
          </div>
          <div style={{ gridColumn: "5 / span 8", paddingTop: 48 }}>
            <h1 style={{ margin: 0, fontSize: 128, fontWeight: 500, letterSpacing: "-0.038em", lineHeight: 1, color: "var(--foreground)" }}>
              <Linhas linhas={["NexoDoc"]} atraso={260} />
            </h1>
            <p style={{ margin: "28px 0 0", fontSize: 44, letterSpacing: "-0.012em", lineHeight: 1.22, color: "var(--muted-foreground)" }}>
              <Linhas
                linhas={["Conferência e montagem documental", "para projetos de engenharia"]}
                atraso={520}
                passo={90}
              />
            </p>
          </div>
        </div>
        <Entra
          atraso={620}
          style={{ flex: "none", paddingTop: 32, borderTop: "1px solid var(--border)", display: "flex", gap: 20, fontFamily: MONO, fontSize: 20, color: "#5f6b72" }}
        >
          <span>Apresentação de software</span>
          <span>·</span>
          <span>2026</span>
          <span>·</span>
          <span>Matheus Mendes</span>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "O que é",
    numero: "02",
    bloco: "O que é",
    titulo: "O que é",
    notas:
      "Ler a frase central devagar. Os três limites da direita são o que impede a sala de imaginar mais do que o sistema faz — e é por dizê-los que o resto do deck fica acreditável.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1, alignItems: "start" }}>
        <div style={{ gridColumn: "1 / span 6" }}>
          <p style={{ margin: 0, fontSize: 60, fontWeight: 500, letterSpacing: "-0.022em", lineHeight: 1.15, color: "var(--foreground)" }}>
            <Linhas linhas={["Um sistema para organizar", "e documentar projetos", "de engenharia."]} atraso={80} />
          </p>
          <Entra atraso={360}>
            <p className="ap-texto" style={{ marginTop: 32, fontSize: 32, lineHeight: 1.4 }}>
              Ele monta os documentos que acompanham o projeto — listas de documentos, capas e volumes — e confere o que já está escrito nos memoriais, apontando o que não fecha.
            </p>
          </Entra>
        </div>
        <div style={{ gridColumn: "8 / span 5", display: "flex", flexDirection: "column", height: 760 }}>
          <Entra atraso={420}>
            <span className="ap-mono-rotulo">E o que ele não faz</span>
          </Entra>
          <EscalaVertical
            atraso={520}
            numerada={false}
            style={{ marginTop: 16 }}
            itens={[
              { titulo: "Lê o documento inteiro.", texto: "Não é amostragem nem busca por palavra-chave." },
              { titulo: "Não altera o documento.", texto: "Aponta onde está e o que fazer. Quem edita é você." },
              { titulo: "Não substitui revisão técnica.", texto: "Faz a conferência que hoje ninguém tem tempo de fazer." },
            ]}
          />
        </div>
      </div>
    ),
  },

  {
    rotulo: "O motor",
    numero: "03",
    bloco: "O que é",
    titulo: "Um motor, dois caminhos",
    subtitulo: "O documento entra, o sistema lê, e o caminho se decide pelo que ele é.",
    notas:
      "Acompanhar as caixas conforme aparecem, um ramo de cada vez. O ponto que vale repetir: os dois caminhos saem do MESMO motor — é o mesmo sistema lendo o mesmo tipo de documento, e por isso o que ele aprende de um lado serve do outro.",
    corpo: (
      <>
        <div style={{ flex: 1, display: "flex", gap: 0, alignItems: "stretch", paddingTop: 24 }}>
          <div
            className="ap-surge"
            style={{ flex: "none", width: 168, justifyContent: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, animationDelay: "160ms" }}
          >
            <MarcaViva size={112} parada />
            <span className="ap-mono-rotulo" style={{ textAlign: "center" }}>O motor</span>
          </div>
          <div style={{ flex: "none", width: 56, display: "flex", flexDirection: "column", gap: 40, alignSelf: "stretch" }}>
            <MetadeDoColchete paraBaixo atraso={300} />
            <MetadeDoColchete paraBaixo={false} atraso={1100} />
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
            <Ramo
              titulo="Memorial descritivo → conferência"
              cor="var(--nexodoc-accent)"
              atrasoBase={300}
              passos={[
                "Extrai o texto e mapeia cada página",
                "Aplica as regras determinísticas",
                "Lê o documento com o modelo de IA",
                "Valida cada achado e descarta o que não se sustenta",
              ]}
              saida="Parecer com página e transcrição"
            />
            <Ramo
              titulo="Pranchas e projeto → montagem"
              cor="var(--status-warning)"
              atrasoBase={1100}
              passos={[
                "Lê os selos das pranchas",
                "Reconhece a identidade do projeto",
                "Acusa folha faltante e duplicada",
                "Monta a lista, a capa e os volumes",
              ]}
              saida="ODT, PDF e ZIP prontos"
            />
          </div>
        </div>
        <Entra atraso={2000} style={{ flex: "none", paddingTop: 24, borderTop: "1px solid var(--border)" }}>
          <p className="ap-fonte" style={{ margin: 0, maxWidth: "96ch" }}>
            Regra determinística é conta e comparação: não inventa, e a IA não pode apagá-la. A IA lê o que regra nenhuma alcança. A validação é a etapa que remove o achado sem sustentação.
          </p>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "Ele revisa a si mesmo",
    numero: "04",
    bloco: "O que é",
    titulo: "Ele revisa a si mesmo",
    notas:
      "Este slide responde antes da pergunta 'e se ele inventar?'. O caso real, para narrar: uma regra minha acusava marca fechada; a validação leu o documento inteiro e achou, quarenta páginas adiante, a cláusula que derrubava a acusação. Eu tinha lido aquelas ocorrências uma a uma e não vi.",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 32, lineHeight: 1.4, maxWidth: "80ch" }}>
            A primeira leitura levanta. A segunda existe para derrubar o que a primeira afirmou sem sustentação.
          </p>
        </Entra>
        <EscalaHorizontal
          atraso={400}
          style={{ marginTop: 64 }}
          fatos={[
            { titulo: ["Cada achado volta", "ao documento"], texto: "Uma segunda passada relê o texto procurando o que contradiz o que foi apontado. O que não se sustenta é descartado antes de chegar à sua tela." },
            { titulo: ["Ele contesta", "as minhas regras"], texto: "Quando a validação discorda de uma regra do sistema, a discordância fica registrada. A mesma regra contestada várias vezes pelo mesmo motivo é defeito meu — e vira correção." },
            { titulo: ["E aprende com", "o próprio erro"], texto: "Falso positivo e gravidade errada viram caso de teste. Foi assim que uma regra inteira foi aposentada por estar errada, e o total de achados do acervo caiu quase pela metade." },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "O resultado",
    numero: "05",
    bloco: "O que é",
    titulo: "Um memorial inteiro, conferido",
    subtitulo: "117_25_md_geral_a.pdf — memorial geral de uma UBS",
    notas:
      "É A DEMONSTRAÇÃO. O mapa é o memorial página a página; a leitura passa, e onde há achado a página sobe com a cor da gravidade — a mesma grafia do canvas da auditoria. Deixar o mapa terminar antes de falar: são dois segundos e meio, e a sala acompanha sozinha.\n\nOS ACHADOS DO MAPA E O CARTÃO SÃO REAIS: saíram do parecer do 117_25 gravado no banco em 28/08/2026 (28 achados naquela corrida). O 57 é o da corrida citada no deck — é a variação entre execuções que a folha dos limites declara. Se alguém perguntar, dizer isso, e não amaciar.\n\nO CARTÃO É O QUE A SALA VAI VER NO PRODUTO. Ler o trecho em voz alta: um memorial da UBS Vila Manaus chamando a obra de 'UBS Paraíso', na página 92. Ninguém tinha visto — e este é o tipo de erro que a folha 07 explica.\n\nLer os números sem adjetivo — eles não precisam de ajuda.",
    corpo: (
      <>
        {/* Quatro mostradores nas colunas 1, 4, 7 e 10 da grade. */}
        <div className="ap-grade">
          <div style={{ gridColumn: "1 / span 3" }}>
            <Mostrador rotuloDo="páginas" atraso={520} valor={<Contador ate={218} atraso={520} duracao={2300} />} />
          </div>
          <div style={{ gridColumn: "4 / span 3" }}>
            <Mostrador rotuloDo="achados" atraso={2700} cor="var(--status-critical)" valor={<Contador ate={57} atraso={2700} duracao={720} />} />
          </div>
          <div style={{ gridColumn: "7 / span 3" }}>
            <Mostrador rotuloDo="tempo de leitura" atraso={3200} valor="≈ 6 min" />
          </div>
          <div style={{ gridColumn: "10 / span 3" }}>
            <Mostrador rotuloDo="custo da execução" atraso={3340} cor="var(--nexodoc-accent)" valor="US$ 1,49" />
          </div>
        </div>

        {/* O mapa, com a escala de página embaixo. */}
        <div style={{ marginTop: 56 }}>
          <MapaDoMemorial paginas={218} atraso={520} duracao={2300} />
          <div style={{ height: 1, background: "#3d474d", marginTop: 8 }} />
          <div className="ap-surge" style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontFamily: MONO, fontSize: 16, color: "#5f6b72", animationDelay: "520ms" }}>
            <span>p. 1</span><span>50</span><span>100</span><span>150</span><span>200</span><span>218</span>
          </div>
        </div>

        {/* O cartão nasce ligado à página 92, como no canvas. */}
        <div style={{ position: "relative", flex: 1, minHeight: 300 }}>
          <span
            aria-hidden="true"
            className="ap-desce"
            style={{ position: "absolute", left: Math.round(((92 - 0.5) / 218) * LARGURA_UTIL), top: -24, width: 1, height: 72, background: "var(--status-critical)", animationDelay: "3700ms" }}
          />
          <CartaoDeAchado
            tipo="Divergência de identificação da obra"
            evidencia="Este memorial descritivo destina-se ao projeto estrutural da UBS Paraíso – Porte 1, localizada na Rua São Francisco de Assis, S/N, Vila Manaus, Criciúma/SC."
            pagina={92}
            disciplina="estrutural"
            gravidade="critico"
            atraso={3950}
            style={{ position: "absolute", top: 48, left: Math.round(((92 - 0.5) / 218) * LARGURA_UTIL) - 26 }}
          />
          <Entra atraso={4300} style={{ position: "absolute", right: 0, bottom: 0, maxWidth: "46ch" }}>
            <p className="ap-fonte" style={{ margin: 0, textAlign: "right" }}>
              Custo lido do registro de uso do próprio sistema, não estimado. O tempo varia com o tamanho do documento.
            </p>
          </Entra>
        </div>
      </>
    ),
  },
];
```

Observações de transcrição: `MetadeDoColchete` continua com `cor = "rgb(91 218 198 / 0.4)"`. Em `CartaoDeAchado` e `MapaDoMemorial` nada muda. O `ap-fonte` continua existindo em `palco.css`.

- [ ] **Step 2: Ligar em `slides.tsx`**

No topo de `app/apresentacao/slides.tsx`, acrescentar `import { O_QUE_E } from "./folhas/o-que-e";` e trocar `export const SLIDES: readonly Slide[] = [` por `export const SLIDES: readonly Slide[] = [\n  ...O_QUE_E,`. Apagar as cinco folhas antigas (01 a 05) do array e os componentes `Passo`, `Liga`, `MetadeDoColchete`, `Ramo`, `Gravidade`, `PAGINAS_COM_ACHADO`, `COR_DA_GRAVIDADE`, `LARGURA_UTIL`, `MapaDoMemorial`, `CartaoDeAchado`, `Dado`, e os imports que ficarem sem uso (`MarcaViva`, `AgentOrb`, `corDaDisciplina`, `siglaDaDisciplina`, `Contador`).

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao`
Expected: sem erro.

- [ ] **Step 3: Capturar e olhar as cinco folhas**

Run: `ESPERA=5200 node scripts/shot-apresentacao-todas.mjs` e abrir `scratchpad/qa/apresentacao/d01.png` a `d05.png`.
Conferir: rótulo-título em y = 80 (146 na captura de 1600 px), nada cortado, mostradores da 05 alinhados nas colunas, trilho com 01–05 acesos em sequência, texto da 02 sem quebra acidental. Se uma `Linhas` quebrar sozinha, reescrever o array de linhas (nunca o texto).

- [ ] **Step 4: Provas**

Run: `node scripts/prova-deck-regua.mjs && node scripts/prova-deck-caixa.mjs 2>&1 | grep -E "apresentacao 0[1-5]|TUDO|FALHA"`
Expected: régua TUDO CERTO; caixa: as folhas 01–05 sem FALHOU.

- [ ] **Step 5: Commit**

```bash
git add app/apresentacao/folhas/o-que-e.tsx app/apresentacao/slides.tsx
git diff --cached --stat
git commit -m "bloco o que e: as cinco primeiras folhas nascem na grade, com mostradores e escalas"
```

---

### Task 4: Bloco O PROBLEMA — folhas 06 a 08

**Files:**
- Create: `app/apresentacao/folhas/o-problema.tsx`
- Modify: `app/apresentacao/slides.tsx`

**Interfaces:**
- Consumes: `Slide`, `Entra`, `Linhas`, `Contador`, `MONO`, `EscalaHorizontal`, `EscalaVertical`, `Leitura`.
- Produces: `export const O_PROBLEMA: readonly Slide[]` (3 folhas).

- [ ] **Step 1: Criar `app/apresentacao/folhas/o-problema.tsx`**

```tsx
"use client";

import type { Slide } from "../palco";
import { Contador, Entra, EscalaHorizontal, EscalaVertical, Leitura, Linhas, MONO } from "../pecas";

/** BLOCO 2 — O PROBLEMA (folhas 06 a 08). Texto e notas de 09/09/2026, sem alteração. */
export const O_PROBLEMA: readonly Slide[] = [
  {
    rotulo: "Conferência hoje",
    numero: "06",
    bloco: "O problema",
    titulo: "Como a conferência acontece hoje",
    notas:
      "A frase de fechamento é o eixo da apresentação: ela impede que a conversa vire 'quantas horas você economiza', discussão que não interessa travar. O que se propõe é um controle que hoje não existe, não um processo mais barato.\n\nOs três fatos chegam um de cada vez, com um respiro entre eles. Dizer cada um quando ele aparece — e não os três de uma vez.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={200}
          style={{ marginTop: 48 }}
          fatos={[
            { titulo: ["Cada projetista"], texto: "confere o próprio projeto" },
            { titulo: ["Sem tempo dedicado"], texto: "a conferência disputa espaço com a entrega" },
            { titulo: ["Uma a duas horas"], texto: "quando de fato acontece" },
          ]}
        />
        <Leitura
          atraso={1200}
          linhas={[
            { texto: "Isto não é um processo caro para substituir." },
            { texto: "É um controle que hoje não existe.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Por que escapa",
    numero: "07",
    bloco: "O problema",
    titulo: "Por que escapa",
    notas:
      "A primeira causa desarma qualquer leitura de incompetência — e é importante dizê-la assim, porque quem está na sala assina esses projetos. A segunda mostra que o problema é do processo, não das pessoas.\n\nAs duas frases coloridas chegam por último, uma de cada lado: a vermelha é a consequência, a âmbar é a saída. Não ler as duas emendadas.",
    corpo: (
      <EscalaHorizontal
        atraso={200}
        style={{ marginTop: 48 }}
        fatos={[
          {
            titulo: ["Quem escreveu relê o que quis dizer,", "não o que ficou escrito."],
            texto: "Não é falta de competência: é como a leitura funciona. E a consequência é sempre a mesma — na prática, a primeira revisão de verdade só acontece quando o projeto já está na mão do cliente.",
            extra: (
              <p style={{ margin: 0, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 26, lineHeight: 1.4, color: "var(--status-critical)" }}>
                Quando isso acontece, quem revisa é quem contratou.
              </p>
            ),
          },
          {
            titulo: ["O modelo-padrão leva o mesmo defeito", "para todos os projetos."],
            texto: "O texto-base é reaproveitado de um projeto para o outro. Um erro nele não erra um projeto: erra todos, até que alguém finalmente o encontre.",
            extra: (
              <p style={{ margin: 0, paddingTop: 20, borderTop: "1px solid var(--border)", fontSize: 26, lineHeight: 1.4, color: "var(--status-warning)" }}>
                Achado uma vez, corrigido uma vez, resolvido em todos.
              </p>
            ),
          },
        ]}
      />
    ),
  },

  {
    rotulo: "A conta",
    numero: "08",
    bloco: "O problema",
    titulo: "O que um erro desses custa",
    notas:
      "É AQUI que o episódio é narrado, agora que ele não tem folha própria: projeto devolvido, procuradoria acionada, três responsáveis parados três dias. Contar ANTES de avançar — a conta entra fator a fator, e cada fator é uma frase da história: três pessoas, três dias, oito horas. Só depois o total.\n\nA palavra estimativa fica visível na tela; se preferir, troque a faixa pelo valor real antes de apresentar. A coluna da direita chega por último e é o que fecha o slide: ler devagar e não insistir.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1 }}>
        <div style={{ gridColumn: "1 / span 6", display: "flex", flexDirection: "column" }}>
          <Entra atraso={120}>
            <span className="ap-mono-rotulo">A aritmética</span>
          </Entra>
          <div style={{ marginTop: 20, fontFamily: MONO, fontSize: 60, lineHeight: 1.2, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
            <Linhas linhas={["3 responsáveis", "× 3 dias", "× 8 horas"]} atraso={300} passo={260} />
          </div>
          <Entra atraso={1100} style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", fontFamily: MONO, fontSize: 60, lineHeight: 1.2, letterSpacing: "-0.02em", color: "var(--foreground)" }}>
            = <Contador ate={72} atraso={1180} duracao={720} style={{ fontWeight: 500 }} /> horas
          </Entra>
          <Entra atraso={1500}>
            <p style={{ margin: "20px 0 0", fontFamily: MONO, fontSize: 26, lineHeight: 1.4, color: "var(--muted-foreground)" }}>
              Hora de engenheiro ou arquiteto <span className="ap-premissa">(estimativa: R$ 50 a R$ 90)</span>
            </p>
          </Entra>
          <div className="ap-cresce" />
          <Entra atraso={1750} style={{ paddingTop: 24, borderTop: "1px solid var(--nexodoc-accent)" }}>
            <span className="ap-mono-rotulo" style={{ display: "block", marginBottom: 16 }}>Só de horas paradas</span>
          </Entra>
          <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1, color: "var(--foreground)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={1900} />
          </div>
        </div>
        <div style={{ gridColumn: "8 / span 5", display: "flex", flexDirection: "column" }}>
          <Entra atraso={2500}>
            <span className="ap-mono-rotulo" style={{ color: "var(--status-critical)" }}>O que não entra nessa conta</span>
          </Entra>
          <EscalaVertical
            atraso={2600}
            style={{ marginTop: 16 }}
            itens={[
              { titulo: "O desgaste com o cliente", texto: "A entrega seguinte chega a uma mesa que já desconfia da anterior." },
              { titulo: "A posição de quem apresentou", texto: "Quem levou o projeto à reunião respondeu por um erro que não era só dele." },
              { titulo: "A reputação que fica", texto: "Dentro e fora da empresa, e por muito mais tempo do que os três dias." },
            ]}
          />
        </div>
      </div>
    ),
  },
];
```

- [ ] **Step 2: Ligar em `slides.tsx`**

Acrescentar `import { O_PROBLEMA } from "./folhas/o-problema";` e, no array, `...O_PROBLEMA,` logo depois de `...O_QUE_E,`. Apagar as folhas 06, 07 e 08 antigas.

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao`
Expected: sem erro.

- [ ] **Step 3: Capturar e olhar**

Run: `node scripts/shot-apresentacao-todas.mjs` e abrir `d06.png`, `d07.png`, `d08.png`.
Conferir: linha da leitura na mesma altura em 06 (y ≈ 820 → 683 na captura); a 07 sem leitura, escala com 2 fatos e frases coloridas sobre linha fina; a 08 com a cifra grande acima de y = 1000 e a escala vertical da direita com 3 leituras de altura igual.

- [ ] **Step 4: Provas**

Run: `node scripts/prova-deck-regua.mjs && node scripts/prova-deck-caixa.mjs 2>&1 | grep -E "apresentacao 0[6-8]|TUDO|FALHA"`
Expected: sem FALHOU nas folhas 06–08.

- [ ] **Step 5: Commit**

```bash
git add app/apresentacao/folhas/o-problema.tsx app/apresentacao/slides.tsx
git diff --cached --stat
git commit -m "bloco o problema: fatos na escala, a conta na grade e a leitura na base"
```

---

### Task 5: Bloco O QUE EXISTE — folhas 09 a 11

**Files:**
- Create: `app/apresentacao/folhas/o-que-existe.tsx`
- Modify: `app/apresentacao/slides.tsx`

**Interfaces:**
- Consumes: `Slide`, `Entra`, `EscalaHorizontal`, `EscalaVertical`, `MONO`.
- Produces: `export const O_QUE_EXISTE: readonly Slide[]` (3 folhas).

- [ ] **Step 1: Criar `app/apresentacao/folhas/o-que-existe.tsx`**

```tsx
"use client";

import type { Slide } from "../palco";
import { Entra, EscalaHorizontal, EscalaVertical, MONO } from "../pecas";

/** BLOCO 3 — O QUE EXISTE (folhas 09 a 11). Texto e notas de 09/09/2026, sem alteração. */

/** As quatro linhas de cada bloco da folha 11, em Mono sobre linhas finas. */
function LinhasDoBloco({ linhas }: { linhas: readonly string[] }) {
  return (
    <ul style={{ margin: "8px 0 0", padding: 0, listStyle: "none" }}>
      {linhas.map((l) => (
        <li key={l} style={{ padding: "12px 0", borderTop: "1px solid var(--border)", fontSize: 26, lineHeight: 1.4, color: "var(--muted-foreground)", textWrap: "pretty" }}>
          {l}
        </li>
      ))}
    </ul>
  );
}

export const O_QUE_EXISTE: readonly Slide[] = [
  {
    rotulo: "Limites",
    numero: "09",
    bloco: "O que existe",
    titulo: "O que ele ainda não faz bem",
    notas:
      "Dito por você, antes de perguntarem. Este slide compra mais credibilidade que qualquer outro do deck. Não amaciar nenhum item — principalmente o do excesso, que é o que o usuário vai sentir no primeiro dia.",
    corpo: (
      <EscalaVertical
        atraso={200}
        itens={[
          { titulo: "Peca pelo excesso.", texto: "Prefere apontar demais a deixar passar, e parte do que levanta você vai descartar. É assim de propósito: achado a mais custa um minuto de leitura, achado a menos custa o que custou naquele projeto.", cor: "var(--status-warning)" },
          { titulo: "A lista varia entre execuções.", texto: "Rodando o mesmo documento duas vezes, o total fica estável, mas os achados de borda entram e saem." },
          { titulo: "A precisão ainda não foi julgada por quem projeta.", texto: "É a única medida em aberto, e depende do veredito de vocês. É exatamente isso que estou pedindo no piloto." },
          { titulo: "Não audita prancha.", texto: "Hoje o alvo é o memorial descritivo e a documentação de identidade do projeto." },
        ]}
      />
    ),
  },

  {
    rotulo: "Segurança",
    numero: "10",
    bloco: "O que existe",
    titulo: "O que protege o documento",
    notas:
      "O slide que responde 'e se vazar?'. O primeiro item é decisão de projeto, não limitação — dizer com essas palavras.\n\nSobre 'a IA aprende com os nossos projetos?': separar as duas coisas na fala. O modelo NÃO aprende — ele vem pronto de fora e o conteúdo enviado não alimenta treinamento pela política da API. O que aprende é o sistema, e só pelo que vocês corrigirem: falso positivo, gravidade errada e achado que faltou viram medida de qualidade e ajuste de regra dentro da nossa base, sem sair para o provedor.\n\nCUIDADO — ESTA É A FOLHA QUE CONVIDA 'mostra esse painel de custo aí'. A demonstração sai de produção, e a tela de uso de IA de lá lista modelos sem preço, onde hoje aparece uma chave antiga em texto puro. Ou limpar essas linhas antes do dia, ou abrir o custo POR OBRA e não a tela de uso por modelo.",
    corpo: (
      <div className="ap-grade" style={{ flex: 1 }}>
        <div style={{ gridColumn: "1 / span 6", display: "flex", flexDirection: "column" }}>
          <EscalaVertical
            atraso={200}
            itens={[
              { titulo: "O PDF anexado não é armazenado.", texto: "Ele é lido e descartado. Para reprocessar, o arquivo é reenviado — decisão de projeto, não limitação." },
              { titulo: "Nenhum documento de vocês treina o modelo.", texto: "A inteligência vem pronta de fora e não muda com o que a PROSUL manda: pela política da API usada, o conteúdo enviado não alimenta treinamento. O memorial é lido, respondido e esquecido." },
              { titulo: "Quem ensina o sistema é o feedback, não o documento.", texto: "Quando alguém marca um achado como falso positivo ou aponta o que faltou, isso vira medida de qualidade e ajuste de regra aqui dentro — fica na PROSUL e não sai para lugar nenhum." },
            ]}
          />
        </div>
        <div style={{ gridColumn: "7 / span 6", display: "flex", flexDirection: "column" }}>
          <EscalaVertical
            atraso={700}
            inicio={4}
            itens={[
              { titulo: "Acesso nominal, por login corporativo.", texto: "Cada pessoa entra com a própria conta, com papel de administrador ou membro. Desativar alguém corta o acesso na hora." },
              { titulo: "Todo acesso e todo gasto ficam registrados.", texto: "Provedor, modelo, duração e custo de cada execução, com custo por obra no painel." },
              { titulo: "Teto de gasto mensal.", texto: "Ao ser atingido, o sistema recusa a chamada em vez de continuar gastando." },
            ]}
          />
        </div>
      </div>
    ),
  },

  {
    rotulo: "O que existe hoje",
    numero: "11",
    bloco: "O que existe",
    titulo: "O que já existe e funciona",
    notas:
      "Dois blocos, não seis módulos. O que importa é a distinção entre conferir o que já existe e montar o que falta — é assim que o trabalho acontece no escritório. As cores são as dos dois ramos do motor: teal confere, âmbar monta.",
    corpo: (
      <EscalaHorizontal
        atraso={200}
        style={{ marginTop: 40 }}
        fatos={[
          {
            titulo: ["Conferência de", "memorial descritivo"],
            cor: "var(--nexodoc-accent)",
            texto: (
              <span style={{ display: "inline-block", padding: "8px 14px", background: "var(--status-ok-bg)", fontFamily: MONO, fontSize: 20, letterSpacing: "0.05em", color: "var(--status-ok)" }}>
                Medido em projeto real
              </span>
            ),
            extra: (
              <LinhasDoBloco
                linhas={[
                  "Lê o memorial inteiro e aponta o que não fecha",
                  "Cada achado com a página e a transcrição do trecho",
                  "Separa o que impede emitir do que é decisão técnica",
                  "Compara documentos entre si",
                ]}
              />
            ),
          },
          {
            titulo: ["Montagem de LDs,", "capas e volumes"],
            cor: "var(--status-warning)",
            texto: (
              <span style={{ display: "inline-block", padding: "8px 14px", background: "var(--nexodoc-raised)", fontFamily: MONO, fontSize: 20, letterSpacing: "0.05em", color: "var(--muted-foreground)" }}>
                Em uso acompanhado
              </span>
            ),
            extra: (
              <LinhasDoBloco
                linhas={[
                  "Lê os selos das pranchas e monta a lista de documentos",
                  "Acusa folha faltante, duplicada e divergência de total",
                  "Gera capa com os dados do escritório",
                  "Entrega ODT, PDF e ZIP prontos",
                ]}
              />
            ),
          },
        ]}
      />
    ),
  },
];
```

- [ ] **Step 2: Ligar em `slides.tsx`**

`import { O_QUE_EXISTE } from "./folhas/o-que-existe";` e `...O_QUE_EXISTE,` depois de `...O_PROBLEMA,`. Apagar as folhas 09, 10 e 11 antigas.

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao`
Expected: sem erro.

- [ ] **Step 3: Capturar e olhar**

Run: `node scripts/shot-apresentacao-todas.mjs` e abrir `d09.png`, `d10.png`, `d11.png`.
Conferir: na 09 os quatro itens têm a mesma altura e a primeira está em âmbar (número, tick e título); na 10 as duas escalas começam na mesma linha e a direita numera 04–06; na 11 os selos ("Medido em projeto real") estão em Mono e as listas ficam abaixo da escala sem passar de y = 1000.

- [ ] **Step 4: Provas e commit**

Run: `node scripts/prova-deck-regua.mjs && node scripts/prova-deck-caixa.mjs 2>&1 | grep -E "apresentacao (09|10|11)|TUDO|FALHA"`
Expected: sem FALHOU em 09–11.

```bash
git add app/apresentacao/folhas/o-que-existe.tsx app/apresentacao/slides.tsx
git diff --cached --stat
git commit -m "bloco o que existe: listas viram escalas verticais e os dois modulos viram fatos"
```

---

### Task 6: Bloco POSSÍVEIS PERGUNTAS — folhas 13 a 16

**Files:**
- Create: `app/apresentacao/folhas/possiveis-perguntas.tsx`
- Modify: `app/apresentacao/slides.tsx`

**Interfaces:**
- Consumes: `Slide`, `Confronto`.
- Produces: `export const POSSIVEIS_PERGUNTAS: readonly Slide[]` (4 folhas).

- [ ] **Step 1: Criar `app/apresentacao/folhas/possiveis-perguntas.tsx`**

```tsx
"use client";

import type { Slide } from "../palco";
import { Confronto } from "../pecas";

/**
 * BLOCO 5 — POSSÍVEIS PERGUNTAS (folhas 13 a 16). O rótulo diz POSSÍVEIS, e não
 * "difíceis": a sala não precisa ouvir que a conversa vai ficar difícil antes
 * de ela ficar. Texto e notas de 09/09/2026, sem alteração.
 */
export const POSSIVEIS_PERGUNTAS: readonly Slide[] = [
  {
    rotulo: "Por que não o ChatGPT",
    numero: "13",
    bloco: "Possíveis perguntas",
    titulo: "Por que não o ChatGPT",
    notas:
      "NÃO BRIGAR COM O CHATGPT: ele está dentro do sistema, e dizer isso desarma a pergunta em vez de disputá-la. Para 'contrato um desenvolvedor por dois meses': dois meses fazem a primeira versão; o que está na tela é o que sobrou depois de meses corrigindo contra memorial real, e a folha dos limites mostra o que ainda falta.\n\nRÉPLICA PROVÁVEL 1 — 'então me venda só as regras e a montagem, e eu uso o ChatGPT para o resto': as regras sozinhas acham menos da metade, e é a segunda passada que derruba o falso positivo — está na folha da autorrevisão. Vender as partes separadas entrega um motor sem freio.\n\nRÉPLICA PROVÁVEL 2 — 'em seis meses isso é um botão dentro do Word': pode ser, e nesse dia eu troco o modelo por dentro e vocês não fazem nada. O que não vem de graça em botão nenhum é saber o que perguntar ao modelo, e é isso que os oito meses compraram.",
    corpo: (
      <Confronto
        pergunta="Isso é uma casca em cima do ChatGPT. Por que não assinamos o ChatGPT e mandamos alguém jogar o PDF lá?"
        respostas={[
          ["O modelo é uma peça, não é o sistema.", "O ChatGPT é uma das caixas do diagrama que vocês viram. As outras não são dele: extrair o texto sabendo em que página cada linha está, aplicar as regras que não alucinam, validar cada achado contra o próprio documento e descartar o que não se sustenta. Sem elas, o que volta é um resumo — e resumo não se leva para o cliente."],
          ["A conversa não guarda nada.", "Colar um PDF num chat não deixa histórico por obra, nem custo por projeto, nem teto de gasto, nem registro de quem leu o quê. E o que ele entendeu de um memorial não serve para o próximo."],
          ["Metade do sistema não é leitura.", "Lista de documentos, capa, volume, folha faltante, selo divergente. Isso é montagem de arquivo. Nenhum chat entrega ODT, PDF e ZIP prontos para a entrega."],
        ]}
        leitura={[
          { texto: "E quando o modelo melhorar — e vai — ele melhora aqui dentro." },
          { texto: "Trocar de modelo é uma linha de configuração; o que sobra é o resto.", chave: true },
        ]}
      />
    ),
  },

  {
    rotulo: "Você não provou que vale",
    numero: "14",
    bloco: "Possíveis perguntas",
    titulo: "Você não provou que vale",
    notas:
      "O terceiro bloco é o que mais compra a sala: é ganho que independe de assinar contrato.\n\nRÉPLICA PROVÁVEL 1 — 'aconteceu uma vez, em quantos anos?': uma vez que os senhores SOUBERAM. O erro do modelo-padrão esteve em cinco projetos e ninguém tinha achado — e não seria achado.\n\nRÉPLICA PROVÁVEL 2 — 'então traga a medição pronta e voltamos a conversar': a medição depende do veredito de quem projeta, e é literalmente o que estou pedindo. Sem uso real ela não existe, e não há como eu produzi-la sozinho — seria eu julgando o meu próprio trabalho, que é exatamente o problema que este sistema existe para resolver.\n\nRÉPLICA PROVÁVEL 3 — 'projetista ignora checklist há vinte anos': não é checklist, é uma lista com a página e a frase do documento dele. E se ignorarem, o piloto é justamente o que mede isso.",
    corpo: (
      <Confronto
        pergunta="57 achados, e você mesmo disse que não sabe quantos são erro de verdade. Meu subdiretor lê um memorial em uma hora. Agora ele lê o memorial e mais 57 achados. Você piorou o trabalho dele."
        respostas={[
          ["A comparação não é uma hora contra seis minutos.", "É uma leitura que acontece contra uma que não acontece. A folha da conferência de hoje já disse: não há tempo dedicado para isso, e quando há, ela disputa espaço com a entrega."],
          ["Descartar um achado errado custa duas linhas.", "Cada um vem com a página e o trecho transcrito do próprio memorial. Não se investiga um achado: lê-se e decide-se."],
          ["Onze deles não são de projeto nenhum.", "São do modelo-padrão — o mesmo texto errado em cinco projetos. Corrigidos uma vez, somem de todos. Esse ganho existe mesmo que vocês não comprem nada."],
        ]}
        leitura={[
          { texto: "Quantos dos outros são erro de verdade, eu não sei." },
          { texto: "É exatamente por isso que estou pedindo seis meses, e não a sua assinatura.", chave: true },
        ]}
      />
    ),
  },

  {
    rotulo: "E se você sair",
    numero: "15",
    bloco: "Possíveis perguntas",
    titulo: "E se você sair",
    notas:
      "NÃO ENTRAR NO MÉRITO DO VÍNCULO. A relação hoje é PJ, e a folha responde CONTINUIDADE, não crachá: quem contrata licença de software não pergunta o regime de quem a escreveu. Se alguém puxar o assunto, devolver para o contrato — prazo, prazo de resposta e o que fica com vocês.\n\nCUSTÓDIA DE CÓDIGO E INSTALAÇÃO NA INFRAESTRUTURA DELES NÃO ESTÃO OFERECIDAS NA TELA. Promessa projetada não se retira depois. O fecho é o que mais tranquiliza engenheiro na sala: a assinatura, e o risco que vem com ela, não mudam de dono.\n\nRÉPLICA PROVÁVEL 1 — 'então põe o código em custódia': DECIDIDO, ela está disponível — mas nunca de graça. A contrapartida é PRAZO: a custódia entra se o piloto virar contrato longo. Dizer as duas coisas na mesma frase, porque cedida sozinha ela vira o novo ponto de partida da negociação.\n\nRÉPLICA PROVÁVEL 2 — 'prazo de resposta sem multa é papel': DECIDIDO, NÃO há multa. O prazo já é o compromisso, e contrato descumprido tem consequência sem precisar de cláusula de multa. Não ceder aqui no calor da reunião: esta linha foi escrita justamente para isso.\n\nRÉPLICA PROVÁVEL 3 — 'e se der problema num sábado?': o prazo escrito vale para problema que impeça o uso, não para toda dúvida. Dizer isso com essas palavras, sem prometer plantão.",
    corpo: (
      <Confronto
        pergunta="E se você sair, como fica? O sistema é de uma pessoa só: se você parar, a gente para junto."
        respostas={[
          ["O que nos liga é um contrato, não um crachá.", "A licença tem prazo próprio e vale por ele inteiro. Se eu deixar de tocar qualquer outro trabalho aqui, esse prazo continua de pé — são duas relações diferentes, e sempre foram."],
          ["Prazo de resposta escrito, não boa vontade.", "Problema que impeça o uso tem tempo de correção definido em contrato, e não depende de eu estar de bom humor naquela semana."],
          ["O que ele produz são arquivos, e eles são de vocês.", "Parecer, lista de documentos, capa e volume saem em arquivo. Se o sistema parar amanhã, o que já foi montado continua exatamente onde está."],
        ]}
        leitura={[
          { texto: "A responsabilidade técnica não muda de mãos, e nunca esteve na mesa." },
          { texto: "Quem assina o projeto continua sendo quem responde por ele — hoje, sem conferência nenhuma, e depois.", chave: true },
        ]}
      />
    ),
  },

  {
    rotulo: "Motivo da venda",
    numero: "16",
    bloco: "Possíveis perguntas",
    titulo: "Motivo da venda",
    notas:
      "A FOLHA DEIXOU DE SER UMA OBJEÇÃO em 09/09/2026. Antes ela punha na tela a acusação ('você é nosso funcionário, por que estamos pagando?') e respondia. Emprestar essa frase à sala é dar munição que talvez ninguém fosse buscar — e, com a relação em PJ, ela nem se sustenta. Agora a folha AFIRMA: três fatos, ditos por mim, antes de alguém precisar perguntar.\n\nFALAR DEVAGAR E NÃO JUSTIFICAR MAIS DO QUE ESTÁ ESCRITO. Quem explica demais parece estar se defendendo de algo.\n\nSE VIER 'e o que diz o seu contrato?': CONFERIDO — foi lido, e NÃO há cláusula de cessão sobre o que eu crio fora dele. Responder isso e parar; a resposta curta é a mais forte.\n\nSE VIER 'você testou com os nossos projetos, isso é informação da empresa': os documentos foram lidos, não copiados nem guardados, e o produto não contém nenhum trecho deles. O que aprendi lendo é conhecimento profissional — o mesmo que qualquer projetista leva de um projeto para o seguinte.\n\nSE VIER 'te pago as suas horas e o software passa a ser nosso': a folha que respondia isso saiu do deck em 09/09/2026, e a resposta agora é de boca. Comprar as minhas horas compraria o passado; quem mantém o sistema na semana que vem é a licença. Compra é outra negociação, com outro número e outro contrato — e eu ouço, só não é a que eu vim propor hoje. A MOEDA DE TROCA, se travar, é a CUSTÓDIA DO CÓDIGO: vale PRAZO, nunca desconto.\n\nO TERCEIRO FATO NÃO É AMEAÇA, e não se diz com esse tom. Ele explica por que existe preço em vez de doação — e, dito antes de perguntarem, tira o assunto da mesa.",
    corpo: (
      <Confronto
        titulo="Três fatos"
        linhaFina="Três fatos, ditos antes de alguém precisar perguntar."
        respostas={[
          ["Foi feito fora.", "Fora do horário, em equipamento meu, com licenças minhas. Nenhuma hora paga pela PROSUL entrou aqui."],
          ["Os documentos não ficaram comigo.", "Nenhum memorial de cliente está na minha máquina. E o sistema não guarda PDF nenhum — é a mesma decisão que a folha da segurança mostrou."],
          ["Foi pensado num problema daqui, mas não é só daqui.", "Memorial, lista de documentos, volume, prefeitura: o mesmo trabalho existe em qualquer escritório que entregue projeto público. O que está montado vira produto para outras empresas com pouca mudança."],
        ]}
        leitura={[
          { texto: "O problema é da casa. A solução não nasceu dela —" },
          { texto: "e serve a qualquer escritório que entregue projeto para prefeitura.", chave: true },
        ]}
      />
    ),
  },
];
```

Nota sobre a 16: o título "Motivo da venda" já é o rótulo-título; à esquerda entra "Três fatos" em Sans 500 44 com a linha fina, para não repetir o rótulo. É a única palavra nova na tela do deck inteiro e é o **título de leitura** da própria folha, não texto de argumento; se o autor preferir repetir "Motivo da venda", trocar `titulo="Três fatos"` por `titulo="Motivo da venda"`.

Nota sobre a 15: o fecho antigo tinha três linhas; aqui viram duas (a segunda concatena "Quem assina … por ele —" e "hoje, sem conferência nenhuma, e depois."), sem mudar palavra. Se na captura a segunda linha quebrar sozinha aos 48 px, voltar às três linhas com `chave: true` nas duas últimas.

- [ ] **Step 2: Ligar em `slides.tsx`**

`import { POSSIVEIS_PERGUNTAS } from "./folhas/possiveis-perguntas";` e `...POSSIVEIS_PERGUNTAS,` na posição das folhas 13–16 (depois da 12 antiga). Apagar as quatro folhas antigas e o componente `Objecao`.

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao`
Expected: sem erro.

- [ ] **Step 3: Capturar e olhar**

Run: `node scripts/shot-apresentacao-todas.mjs` e abrir `d13.png` a `d16.png`.
Conferir: a pergunta da 14 (longa) em 26 px e a da 15 em 32; as leituras à direita com 3 itens de altura igual; a linha da leitura na base na mesma altura nas quatro; nenhuma linha do fecho quebrando sozinha.

- [ ] **Step 4: Provas e commit**

Run: `node scripts/prova-deck-regua.mjs && node scripts/prova-deck-caixa.mjs 2>&1 | grep -E "apresentacao 1[3-6]|TUDO|FALHA"`
Expected: sem FALHOU em 13–16.

```bash
git add app/apresentacao/folhas/possiveis-perguntas.tsx app/apresentacao/slides.tsx
git diff --cached --stat
git commit -m "possiveis perguntas: as quatro objecoes viram confronto, pergunta a esquerda e leituras a direita"
```

---

### Task 7: Blocos O DINHEIRO (12, 17) e O PEDIDO (18, 19), e `slides.tsx` vira concatenador

**Files:**
- Create: `app/apresentacao/folhas/o-dinheiro.tsx`
- Create: `app/apresentacao/folhas/o-pedido.tsx`
- Modify: `app/apresentacao/slides.tsx` (só concatena)

**Interfaces:**
- Consumes: `Slide`, `Entra`, `Linhas`, `MONO`, `EscalaHorizontal`, `EscalaVertical`, `Leitura`, `AgentOrb`.
- Produces: `O_DINHEIRO_12: Slide`, `O_DINHEIRO_17: Slide`, `O_PEDIDO: readonly Slide[]`. `slides.tsx` final:

```tsx
"use client";

import type { Slide } from "./palco";
import { O_QUE_E } from "./folhas/o-que-e";
import { O_PROBLEMA } from "./folhas/o-problema";
import { O_QUE_EXISTE } from "./folhas/o-que-existe";
import { O_DINHEIRO_12, O_DINHEIRO_17 } from "./folhas/o-dinheiro";
import { POSSIVEIS_PERGUNTAS } from "./folhas/possiveis-perguntas";
import { O_PEDIDO } from "./folhas/o-pedido";

/**
 * O CONTEÚDO DO DECK — a ordem das folhas, e só ela. Cada bloco mora em
 * `folhas/`, com o texto e as notas de 09/09/2026 sem alteração.
 *
 * TRÊS REGRAS QUE ESTE DECK NÃO PODE PERDER:
 *  1. Todo número aqui foi medido, e o que é conta aparece como estimativa.
 *  2. Nenhuma cifra de preço nas folhas 01 a 19; o valor vive em
 *     `/apresentacao/valores`, e a folha 17 só traz o BOTÃO.
 *  3. Nada se mexe sem dizer algo — ver a seção de movimento em `palco.css`.
 * SEM DATA DE EXECUÇÃO EM LUGAR NENHUM.
 */
export const SLIDES: readonly Slide[] = [
  ...O_QUE_E,
  ...O_PROBLEMA,
  ...O_QUE_EXISTE,
  O_DINHEIRO_12,
  ...POSSIVEIS_PERGUNTAS,
  O_DINHEIRO_17,
  ...O_PEDIDO,
];
```

- [ ] **Step 1: Criar `app/apresentacao/folhas/o-dinheiro.tsx`**

```tsx
"use client";

import type { Slide } from "../palco";
import { Entra, EscalaVertical, Linhas, MONO } from "../pecas";

/**
 * BLOCO 4 — O DINHEIRO (folhas 12 e 17). Texto e notas de 09/09/2026, sem
 * alteração. A 17 é a única folha do deck com um elemento clicável.
 */

/**
 * O BOTÃO QUE ABRE OS VALORES. Único clicável do deck: o preço não pode ser
 * alcançado por avançar a seta. Aba nova, e não navegação: `Ctrl+W` devolve a
 * folha certa. `data-abre-valores` é por onde o gerador da cópia offline acha
 * este link para trocar o endereço por um salto interno — sem o atributo, o
 * arquivo do pen drive sai com link morto, e o gerador falha se ele sumir.
 */
function BotaoDosValores() {
  return (
    <a
      href="/apresentacao/valores"
      target="_blank"
      rel="noreferrer"
      data-abre-valores=""
      className="nx-cut-6"
      style={{ display: "inline-flex", alignItems: "center", gap: 18, padding: "24px 40px", border: "1px solid var(--nexodoc-accent)", background: "rgb(0 166 147 / 0.10)", fontSize: 32, fontWeight: 500, letterSpacing: "-0.018em", color: "var(--nexodoc-accent)", textDecoration: "none" }}
    >
      Abrir os valores
      <span style={{ fontFamily: MONO, fontSize: 30 }} aria-hidden="true">→</span>
    </a>
  );
}

export const O_DINHEIRO_12: Slide = {
  rotulo: "Como ela se paga",
  numero: "12",
  bloco: "O dinheiro",
  titulo: "Como ela se paga",
  notas:
    "DE ONDE SAI O R$ 285: a folha que abria essa conta saiu do deck em 09/09/2026 e vive na folha B do anexo. Se perguntarem como se chega nele, abrir o botão da folha 17 em vez de improvisar a conta de cabeça.\n\nESTA FOLHA NAO DISPUTA ARITMETICA, DE PROPOSITO. A versao anterior valorizava as 16 horas de montagem a hora de engenheiro e caia com uma frase: quem monta lista de documentos nao ganha hora de engenheiro. A hora de tecnico derruba a conta inteira, e o argumento nao pode depender de um numero que a sala refuta de cabeca.\n\nO TETO DE LICENCA SAIU DA TELA e vive aqui: com a operacao em R$ 285, uma licenca ate cerca de R$ 500 por mes se paga so no tempo devolvido. NAO OFERECER esse numero. O diretor vai calcula-lo sozinho, e um numero que ele deduz vale mais que um que eu concedo.\n\nOS DOIS NÚMEROS DE BAIXO SÃO A FRASE INTEIRA, sem razão escrita entre eles: o pequeno é o que custa operar, o grande é o que o episódio custou — e a sala faz a divisão sozinha. O terceiro bloco de cima e o mais forte do deck inteiro e nao tem numero nenhum. Ler devagar e parar.",
  corpo: (
    <>
      <EscalaVertical
        atraso={200}
        style={{ flex: "none", height: 420 }}
        itens={[
          { titulo: "Em tempo que volta para o projeto.", texto: "Quatro projetos por mês, até quatro horas de montagem manual cada. São dezesseis horas que ninguém precisa gastar abrindo prancha por prancha — e que voltam para quem deveria estar projetando." },
          { titulo: "Em qualidade do que sai daqui.", texto: "O projeto que chega ao cliente já passou por uma leitura que hoje não acontece. Não é uma revisão a mais: é a primeira." },
          { titulo: "E em vergonha não passada.", texto: "Este é o retorno que não entra em planilha nenhuma, e é o único que a sala inteira já viu de perto. Um projeto devolvido não custa só as horas paradas que a folha da conta somou." },
        ]}
      />
      {/*
        OS DOIS NÚMEROS no lugar da leitura: o pequeno ao lado do grande, sem
        razão escrita (a regra do spec de 24/08 proíbe disputar aritmética).
        Grade de duas linhas para os rótulos ficarem na mesma altura e os
        números na mesma linha de base.
      */}
      <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "auto 1fr", gridTemplateRows: "auto auto", columnGap: 96, rowGap: 16, alignItems: "baseline", paddingTop: 32, borderTop: "1px solid var(--nexodoc-accent)" }}>
        <Entra atraso={900}>
          <span className="ap-mono-rotulo">Operar, por mês</span>
        </Entra>
        <Entra atraso={1200}>
          <span className="ap-mono-rotulo">O episódio que já aconteceu — só a parte que deu para somar</span>
        </Entra>
        <div style={{ fontFamily: MONO, fontSize: 60, letterSpacing: "-0.025em", lineHeight: 1, color: "var(--muted-foreground)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          <Linhas linhas={["R$ 285"]} atraso={1000} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 96, fontWeight: 500, letterSpacing: "-0.035em", lineHeight: 1, color: "var(--nexodoc-accent)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
          <Linhas linhas={["R$ 3.600 a R$ 6.480"]} atraso={1300} />
        </div>
      </div>
    </>
  ),
};

export const O_DINHEIRO_17: Slide = {
  rotulo: "Quanto custa usar",
  numero: "17",
  bloco: "O dinheiro",
  titulo: "Quanto custa usar",
  notas:
    "ESTA FOLHA NÃO TEM CIFRA, E ISSO É O DESENHO. Ela existe para que o preço esteja ao alcance da mão sem estar na tela: se ninguém perguntar, ela passa em dez segundos e o deck fecha no limite, que é onde ele sempre fechou.\n\nO BLOCO VOLTA A SER 'O DINHEIRO' de propósito, depois das possíveis perguntas. A sala percebe que a conversa mudou de assunto antes de eu dizer.\n\nO BOTÃO ABRE EM ABA NOVA: clicar não perde o deck. Fechar com Ctrl+W devolve esta folha, ainda em tela cheia.\n\nQUANDO CLICAR: quando alguém perguntar o valor, ou quando eu tiver decidido que a sala está pronta. Não clicar por reflexo de estar numa folha que tem botão — a folha funciona sem ser clicada, e passar por ela sem abrir é uma escolha legítima.\n\nO PISO CONTINUA SENDO seis meses por R$ 10.000. Abaixo disso não se fecha na sala.",
  corpo: (
    <div className="ap-grade">
      <div style={{ gridColumn: "1 / span 7" }}>
        <p className="ap-titulo-de-fato">
          <Linhas linhas={["O valor não está neste deck."]} atraso={160} />
        </p>
        <Entra atraso={320}>
          <p className="ap-texto" style={{ marginTop: 20, fontSize: 28 }}>
            Ele está numa página separada, com a conta que o sustenta. Eu abro agora, se você quiser ver.
          </p>
        </Entra>
        <Entra atraso={520} style={{ marginTop: 48 }}>
          <BotaoDosValores />
        </Entra>
      </div>
    </div>
  ),
};
```

Conferir que a classe `nx-cut-6` existe em `app/globals.css` (`grep -n "nx-cut-6" app/globals.css`); se só houver `nx-cut-4`/`nx-cut-8`, usar a que existir mais próxima de 6.

- [ ] **Step 2: Criar `app/apresentacao/folhas/o-pedido.tsx`**

```tsx
"use client";

import { AgentOrb } from "@/modules/nexo/components/agent-orb/AgentOrb";

import type { Slide } from "../palco";
import { Entra, EscalaHorizontal, EscalaVertical, Leitura } from "../pecas";

/** BLOCO 6 — O PEDIDO (folhas 18 e 19). Texto e notas de 09/09/2026, sem alteração. */
export const O_PEDIDO: readonly Slide[] = [
  {
    rotulo: "O que pode vir",
    numero: "18",
    bloco: "O pedido",
    titulo: "O que pode vir depois",
    subtitulo: "Caminho, não promessa. Nada disto está pronto, e a ordem depende do que o uso real mostrar.",
    notas:
      "Deixar claro que é caminho, não promessa — nada aqui está pronto. O item que costuma acender o olho de quem projeta é o terceiro: a correção aplicada direto no arquivo editável.",
    corpo: (
      /* TRACEJADO = NÃO CONSTRUÍDO: a mesma escala das folhas 04 e 06, com a linha tracejada. */
      <EscalaHorizontal
        atraso={200}
        tracejada
        style={{ marginTop: 48 }}
        fatos={[
          { titulo: ["Conferência", "de quantidades"], texto: "Cruzar o que o memorial especifica com o que a planilha orça, e acusar o que não bate." },
          { titulo: ["Leitura especializada", "por disciplina"], texto: "Um leitor treinado no vocabulário de cada disciplina, em vez de um leitor geral para todas." },
          { titulo: ["Correção no", "arquivo editável"], texto: "A alteração aplicada direto no documento de origem, com você aprovando cada uma antes." },
        ]}
      />
    ),
  },

  {
    rotulo: "O que ela não é",
    numero: "19",
    bloco: "O pedido",
    titulo: "O que esta ferramenta não é",
    notas:
      "Fechar por aqui é escolha: a última coisa que a sala ouve é o limite, dito por mim, e não uma promessa. Ler devagar e parar.\n\nO ORBE VOLTA — o mesmo da capa, do mesmo tamanho da folha do motor. É o deck fechando onde abriu, e não um enfeite: a sala viu o produto se apresentar sozinho na primeira folha, e o vê de novo quando eu digo o que ele não é.\n\nSe vier pergunta sobre valor depois disto, voltar à folha 17 e abrir o botão — o deck não termina no preço.",
    corpo: (
      <>
        <EscalaVertical
          atraso={200}
          style={{ flex: "none", height: 460 }}
          itens={[
            { titulo: "Ela não assume responsabilidade técnica.", texto: "Quem assina o projeto continua sendo quem responde por ele. O sistema aponta; a decisão é de quem põe o nome na capa." },
            { titulo: "A IA erra, e vai errar.", texto: "Ela levanta o que parece não fechar. Parte disso não é erro nenhum, e é você quem separa uma coisa da outra." },
            { titulo: "Ela não faz o trabalho no seu lugar.", texto: "O que ela devolve não é o projeto pronto: é o tempo que se gastaria procurando — e a chance de achar o que ninguém teve tempo de procurar." },
          ]}
        />
        {/* O fecho do deck: o orbe `compact` (198 px, medida fixa) ao lado da leitura. */}
        <div style={{ marginTop: "auto", display: "grid", gridTemplateColumns: "198px 1fr", columnGap: 64, alignItems: "end" }}>
          <div className="ap-surge" style={{ width: 198, height: 198, display: "grid", placeItems: "center", animationDelay: "760ms", marginBottom: -8 }}>
            <AgentOrb size="compact" state="idle" />
          </div>
          <Leitura
            atraso={900}
            linhas={[
              { texto: "Uma segunda leitura que nunca se cansa," },
              { texto: "e que nunca assina no seu lugar.", chave: true },
            ]}
          />
        </div>
      </>
    ),
  },
];
```

- [ ] **Step 3: `slides.tsx` vira o concatenador** (conteúdo exato no bloco **Interfaces** acima). Apagar tudo o mais do arquivo, inclusive `BotaoDosValores` e os imports antigos.

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao; wc -l app/apresentacao/slides.tsx`
Expected: sem erro; `slides.tsx` com menos de 40 linhas.

- [ ] **Step 4: Capturar e olhar todas**

Run: `node scripts/shot-apresentacao-todas.mjs` e abrir `d12.png`, `d17.png`, `d18.png`, `d19.png`; depois passar por `d01` a `d19` em sequência.
Conferir: na 12, a escala de 420 px deixa os dois números acima de y = 1000; na 19, o orbe e a leitura alinham pela base; na 17, nada centrado, o botão logo abaixo do texto; o trilho desliza 01→19 sem pular.

- [ ] **Step 5: Provas e commit**

Run: `node scripts/prova-deck-regua.mjs && node scripts/prova-deck-caixa.mjs && node scripts/shot-apresentacao-folhas.mjs`
Expected: os três em TUDO CERTO.

```bash
git add app/apresentacao/folhas/o-dinheiro.tsx app/apresentacao/folhas/o-pedido.tsx app/apresentacao/slides.tsx
git diff --cached --stat
git commit -m "o dinheiro e o pedido na grade, e slides.tsx vira so a ordem das folhas"
```

---

### Task 8: O anexo A–F nos arquétipos

**Files:**
- Modify: `app/apresentacao/valores/slides-valores.tsx` (reescrita)

**Interfaces:**
- Consumes: `Slide`, `Entra`, `Linhas`, `Contador`, `MONO`, `EscalaVertical`, `Confronto`, `Leitura`, `Mostrador`.
- Produces: `export const VALORES: readonly Slide[]` (6 folhas, `numero` A–F, `bloco: "Os valores"`).

- [ ] **Step 1: Reescrever `slides-valores.tsx`**

Manter o comentário de cabeçalho do arquivo (a história do `docs/anexo-proposta.html`, a ordem ESCOPO → CUSTOS → PREÇO e a âncora do preço) e as notas de cada folha **sem alteração**. Composição:

```tsx
"use client";

import type { Slide } from "../palco";
import { Contador, Entra, EscalaVertical, Leitura, Linhas, MONO, Mostrador } from "../pecas";

// [manter o comentário de cabeçalho atual]

/** Uma linha de tabela do anexo: item, base em Mono, valor à direita. */
function LinhaDeCusto({ item, base, valor, atraso }: { item: string; base: string; valor: string; atraso: number }) {
  return (
    <Entra atraso={atraso} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "baseline", gap: "0 24px", padding: "16px 0", borderTop: "1px solid var(--border)" }}>
      <div>
        <p style={{ margin: 0, fontSize: 26, color: "var(--foreground)" }}>{item}</p>
        <p style={{ margin: "4px 0 0", fontFamily: MONO, fontSize: 20, color: "#5f6b72" }}>{base}</p>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 32, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>{valor}</span>
    </Entra>
  );
}

/** O total de uma coluna: rótulo e valor sobre linha, na base. */
function Total({ rotuloDo, valor, cor = "var(--foreground)", tamanho = 44, atraso, teal = false }: { rotuloDo: string; valor: string; cor?: string; tamanho?: number; atraso: number; teal?: boolean }) {
  return (
    <Entra atraso={atraso} style={{ marginTop: "auto", paddingTop: 20, borderTop: `1px solid ${teal ? "var(--nexodoc-accent)" : "var(--border)"}`, display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 20 }}>
      <span className="ap-mono-rotulo">{rotuloDo}</span>
      <span style={{ fontFamily: MONO, fontSize: tamanho, fontWeight: 500, letterSpacing: "-0.02em", color: cor, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{valor}</span>
    </Entra>
  );
}

export const VALORES: readonly Slide[] = [
  {
    rotulo: "O piloto",
    numero: "A",
    bloco: "Os valores",
    titulo: "Piloto de seis meses",
    notas: /* [copiar a nota atual da folha A, sem alteração] */ "",
    corpo: (
      <div className="ap-grade" style={{ flex: 1 }}>
        <div style={{ gridColumn: "1 / span 6", display: "flex", flexDirection: "column" }}>
          <EscalaVertical
            atraso={200}
            numerada={false}
            itens={[
              { titulo: "O que entra", texto: "Conferência de memorial descritivo e montagem de LDs, capas e volumes, com os usuários definidos junto com a diretoria." },
              { titulo: "O que eu entrego", texto: "Acesso, acompanhamento próximo, correção dos problemas que aparecerem e o modelo-padrão de memorial corrigido." },
              { titulo: "Como saberemos se deu certo", texto: "Nenhum achado com evidência que não exista no documento. Precisão julgada por quem usou, disciplina por disciplina. Listas e volumes reais montados sem perda de trabalho. Custo mensal dentro do estimado." },
            ]}
          />
        </div>
        <div style={{ gridColumn: "8 / span 5", display: "flex", flexDirection: "column" }}>
          <Entra atraso={640}>
            <span className="ap-mono-rotulo" style={{ color: "var(--nexodoc-accent)" }}>O que eu peço em troca</span>
          </Entra>
          <p className="ap-titulo-de-fato" style={{ marginTop: 20 }}>
            <Linhas linhas={["Que quem usar julgue cada achado:", "verdadeiro, duvidoso ou falso."]} atraso={780} />
          </p>
          <Entra atraso={980}>
            <p className="ap-texto" style={{ marginTop: 20 }}>
              É a peça que falta no produto. A planilha de julgamento já existe e está pronta para receber esse veredito — e é ele que transforma a única medida em aberto num número.
            </p>
          </Entra>
          <Leitura atraso={1100} linhas={[{ texto: "Seis meses de uso real dizem", chave: true }, { texto: "o que nenhuma apresentação diz.", chave: true }]} />
        </div>
      </div>
    ),
  },

  {
    rotulo: "Quanto custa",
    numero: "B",
    bloco: "Os valores",
    titulo: "Quanto custa operar",
    notas: /* [copiar] */ "",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            O custo por execução é medido no próprio sistema. O total mensal é <span className="ap-premissa">estimativa</span> — varia com quantos documentos passarem.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div style={{ gridColumn: "1 / span 5", display: "flex", flexDirection: "column" }}>
            <Entra atraso={200}><span className="ap-mono-rotulo">Medido por execução</span></Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto item="Conferência de um memorial" base="218 páginas, leitura profunda" valor="US$ 1,50" atraso={300} />
              <LinhaDeCusto item="Leitura de um selo de prancha" base="frações de centavo por folha" valor="US$ 0,001" atraso={460} />
            </div>
          </div>
          <div style={{ gridColumn: "7 / span 6", display: "flex", flexDirection: "column" }}>
            <Entra atraso={620}><span className="ap-mono-rotulo">Estimativa mensal, no volume do escritório</span></Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto item="Conferência de memoriais" base="cerca de 16 por mês" valor="US$ 24" atraso={720} />
              <LinhaDeCusto item="Montagem de listas e volumes" base="uso corrente" valor="menos de US$ 1" atraso={840} />
              <LinhaDeCusto item="Servidor" base="infraestrutura" valor="US$ 25" atraso={960} />
              <LinhaDeCusto item="Banco de dados" base="infraestrutura" valor="US$ 5" atraso={1080} />
            </div>
            <Total rotuloDo="Ordem de grandeza" valor="≈ R$ 285 / mês" cor="var(--nexodoc-accent)" atraso={1180} teal />
            <Entra atraso={1300}>
              <p className="ap-fonte">Convertido a <span className="ap-premissa">R$ 5,18 por dólar</span> — atualizar a cotação antes de apresentar.</p>
            </Entra>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que custou construir",
    numero: "C",
    bloco: "Os valores",
    titulo: "O que custou construir",
    notas: /* [copiar] */ "",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            O gasto em dinheiro está medido no próprio sistema, chamada por chamada. O tempo é <span className="ap-premissa">estimativa</span> — e nenhuma dessas horas foi paga pela PROSUL.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div style={{ gridColumn: "1 / span 6", display: "flex", flexDirection: "column" }}>
            <Entra atraso={200}><span className="ap-mono-rotulo">Em dinheiro — medido</span></Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto item="Modelos de IA" base="3.751 chamadas, três meses" valor="US$ 64" atraso={300} />
              <LinhaDeCusto item="Ferramenta de programação" base="assinatura, seis meses" valor="US$ 600" atraso={430} />
              <LinhaDeCusto item="Servidor e domínio" base="do período de construção" valor="US$ 26" atraso={560} />
            </div>
            <Total rotuloDo="Somado" valor="R$ 3.576" tamanho={36} atraso={720} />
          </div>
          <div style={{ gridColumn: "8 / span 5", display: "flex", flexDirection: "column" }}>
            <Entra atraso={820}><span className="ap-mono-rotulo">Em tempo — estimativa</span></Entra>
            <div style={{ marginTop: 20 }}>
              <Mostrador rotuloDo="horas, noites e fins de semana" atraso={940} valor={<Contador ate={700} atraso={1040} />} />
            </div>
            <Entra atraso={1160}>
              <p style={{ margin: "24px 0 0", fontFamily: MONO, fontSize: 26, color: "var(--muted-foreground)" }}>
                Hora de desenvolvedor júnior <span className="ap-premissa">(estimativa: R$ 30 a R$ 50)</span>
              </p>
            </Entra>
            <Total rotuloDo="Só de trabalho" valor="R$ 21.000 a R$ 35.000" tamanho={36} atraso={1300} />
          </div>
        </div>
        <Entra atraso={1460} style={{ flex: "none", marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--nexodoc-accent)", display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 40 }}>
          <p style={{ margin: 0, maxWidth: "44ch", fontSize: 32, fontWeight: 500, letterSpacing: "-0.018em", lineHeight: 1.25, color: "var(--nexodoc-accent)", textWrap: "pretty" }}>
            O piloto não compra seis meses de acesso. Compra o que já está construído.
          </p>
          <span style={{ fontFamily: MONO, fontSize: 44, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--foreground)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>R$ 24.600 a R$ 38.600</span>
        </Entra>
      </>
    ),
  },

  {
    rotulo: "A proposta",
    numero: "D",
    bloco: "Os valores",
    titulo: "A proposta",
    notas: /* [copiar] */ "",
    corpo: (
      <>
        <EscalaVertical
          atraso={120}
          numerada={false}
          style={{ flex: "none", height: 560 }}
          itens={[
            { titulo: "Modalidade", texto: "Licença de uso durante o piloto" },
            { titulo: "Prazo", texto: "6 meses" },
            { titulo: "Valor", texto: "R$ 10.000", cor: "var(--nexodoc-accent)" },
            { titulo: "Inclui", texto: "Conferência de memorial descritivo e montagem de listas de documentos, capas e volumes. Acompanhamento próximo, correção dos problemas que aparecerem, e o modelo-padrão de memorial corrigido." },
            { titulo: "Não inclui", texto: "Desenvolvimento de módulo novo sob demanda, leitura de PDF escaneado (OCR) e auditoria de prancha." },
          ]}
        />
        <Leitura
          atraso={900}
          linhas={[
            { texto: "Ao fim dos seis meses: se não atender, encerra.", chave: true },
            { texto: "Se atender, a renovação é negociada com o que o uso real tiver mostrado." },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "De onde sai esse número",
    numero: "E",
    bloco: "Os valores",
    titulo: "De onde sai esse número",
    notas: /* [copiar] */ "",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            Nada aqui é novo: os três números já passaram — dois nas duas folhas anteriores, o terceiro no deck. O que muda é que agora estão ao lado do pedido.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div style={{ gridColumn: "1 / span 6", display: "flex", flexDirection: "column" }}>
            <Entra atraso={200}><span className="ap-mono-rotulo">O que já foi gasto</span></Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto item="Construir o que vocês viram" base="R$ 3.576 em dinheiro, medido, mais 700 horas" valor="R$ 24.600 a 38.600" atraso={300} />
              <LinhaDeCusto item="O projeto devolvido" base="só as horas paradas que deu para somar" valor="R$ 3.600 a 6.480" atraso={440} />
              <LinhaDeCusto item="Operar o sistema" base="por mês, no volume do escritório" valor="R$ 285" atraso={580} />
            </div>
            <Entra atraso={720} style={{ marginTop: "auto" }}>
              <p className="ap-fonte">A hora de desenvolvedor júnior é <span className="ap-premissa">estimativa (R$ 30 a R$ 50)</span>. Todo o resto saiu do registro de uso do próprio sistema.</p>
            </Entra>
          </div>
          <div style={{ gridColumn: "8 / span 5", display: "flex", flexDirection: "column", justifyContent: "flex-start", paddingTop: 120 }}>
            <Mostrador rotuloDo="por seis meses de licença de uso" atraso={900} cor="var(--nexodoc-accent)" valor="R$ 10.000" />
          </div>
        </div>
        <Leitura
          atraso={1100}
          linhas={[
            { texto: "O piloto não compra seis meses de acesso. Compra o que já está construído —", chave: true },
            { texto: "e pede menos de metade do que custou construir." },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Propriedade",
    numero: "F",
    bloco: "Os valores",
    titulo: "Propriedade",
    notas: /* [copiar] */ "",
    corpo: (
      <>
        <p className="ap-titulo-de-fato" style={{ maxWidth: "36ch", marginTop: 48 }}>
          <Linhas
            linhas={["O NexoDoc é de autoria e propriedade de Matheus", "Mendes, desenvolvido fora do vínculo empregatício,", "em equipamento, tempo e licenças próprios."]}
            atraso={200}
          />
        </p>
        <Leitura atraso={900} linhas={[{ texto: "O que se propõe aqui é licença de uso.", chave: true }]} />
      </>
    ),
  },
];
```

Antes de gravar, **copiar as seis notas** do arquivo atual para os campos `notas` (o `/* [copiar] */ ""` é só marcação deste plano — o arquivo final não pode ter string vazia; a prova `shot-apresentacao-folhas.mjs` já exige nota com mais de 20 caracteres). Conferir também que as folhas E e F do arquivo atual têm exatamente os textos usados acima (`sed -n '700,900p' app/apresentacao/valores/slides-valores.tsx` antes de apagar).

- [ ] **Step 2: Compilar, capturar e olhar**

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao; node scripts/shot-apresentacao-todas.mjs`
Abrir `v01.png` a `v06.png`. Conferir: nada abaixo de y = 1000; na D a leitura em teal só na primeira linha; na E o mostrador R$ 10.000 alinhado ao topo das linhas de custo.

- [ ] **Step 3: Provas e commit**

Run: `node scripts/prova-deck-regua.mjs && node scripts/prova-deck-caixa.mjs && node scripts/shot-apresentacao-folhas.mjs`
Expected: TUDO CERTO nos três (o de folhas confere que o anexo cabe em 1080 px e começa pelo escopo).

```bash
git add app/apresentacao/valores/slides-valores.tsx
git diff --cached --stat
git commit -m "o anexo de valores entra no instrumento: mesma armadura, mesmas escalas"
```

---

### Task 9: Limpeza — o que morreu

**Files:**
- Modify: `app/apresentacao/pecas.tsx` (remover `Marcador`, `Titulo`, `Fecho`, `rotulo`, `paragrafo`, `secundario` se ninguém mais usar)
- Modify: `app/apresentacao/palco.css` (remover `.ap-titulo`, `.ap-cabeca`, `.ap-bloco`, `.ap-numero`, `.ap-folha--denso` se sobraram; manter `.ap-fonte`, `.ap-premissa`, `.ap-cresce`, `.ap-mono`)
- Modify: `scripts/medir-folga-apresentacao.mjs`

- [ ] **Step 1: Achar o que sobrou sem uso**

Run: `grep -rn "Marcador\|<Titulo\|<Fecho\|secundario\|paragrafo\|rotulo\b" app/apresentacao --include=*.tsx | grep -v "rotulo:" | grep -v "rotuloDo"`
Expected: só as definições em `pecas.tsx`. Se algum arquivo de `folhas/` ainda usar, trocar por `ap-texto`/`ap-mono-rotulo` antes de apagar.

- [ ] **Step 2: Apagar as peças e o CSS mortos**

Em `pecas.tsx`, remover `Marcador`, `Titulo`, `Fecho` e as constantes `rotulo`, `paragrafo`, `secundario` (se o grep do passo 1 confirmar). Em `palco.css`, `grep -n "ap-titulo\|ap-cabeca\|ap-bloco\|ap-numero\|folha--denso" app/apresentacao/palco.css` deve devolver nada; se devolver, apagar os blocos.

- [ ] **Step 3: O medidor passa a medir o rótulo-título**

Em `scripts/medir-folga-apresentacao.mjs`, trocar `if (el.closest(".ap-cabeca")) cabeca = ...` por `if (el.closest(".ap-rotulo-titulo")) cabeca = ...` e o cabeçalho do arquivo: "posição do rótulo-título (esperado 80 em toda folha menos a capa)".

Run: `npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao scripts/medir-folga-apresentacao.mjs; node scripts/medir-folga-apresentacao.mjs`
Expected: sem erro; `cabeca 80` (±2) em toda folha exceto `1 normal cabeca null`; `fundo` ≤ 1000 em todas.

- [ ] **Step 4: Commit**

```bash
git add app/apresentacao/pecas.tsx app/apresentacao/palco.css scripts/medir-folga-apresentacao.mjs
git diff --cached --stat
git commit -m "morrem marcador, titulo e fecho: o deck inteiro fala pelos arquetipos"
```

---

### Task 10: A cópia offline leva o trilho

**Files:**
- Modify: `scripts/gerar-apresentacao-offline.mjs`

**Interfaces:**
- Consumes: `.ap-trilho` (Task 1) vive fora da `<section>`; o motor offline alterna `hidden` entre `<section>`s.

- [ ] **Step 1: Ver falhar**

Run: `npm run apresentacao:offline`
Expected: gera e passa (o gerador não sabe do trilho), mas abrindo `scratchpad/nexodoc-apresentacao.html` nenhuma folha tem trilho. Provar com um script no scratchpad (rodado da raiz):

```js
// scratchpad/debug-offline-trilho.mjs
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.goto(pathToFileURL(resolve("scratchpad/nexodoc-apresentacao.html")).href);
await p.waitForTimeout(400);
console.log("trilhos visíveis:", await p.locator(".ap-folha:not([hidden]) .ap-trilho").count());
await b.close();
```

Run: `node scratchpad/debug-offline-trilho.mjs` → Expected: `trilhos visíveis: 0`.

- [ ] **Step 2: Serializar o trilho dentro de cada folha**

Em `scripts/gerar-apresentacao-offline.mjs`, no `pagina.evaluate` que clona a seção (o que começa com `const secao = document.querySelector(".ap-folha:not(.ap-folha--sai)")`), logo depois de `const clone = secao.cloneNode(true);`, acrescentar:

```js
      /*
       * O TRILHO VIVE FORA DA FOLHA no palco real (para não dissolver na troca),
       * mas o motor offline alterna folhas inteiras por `hidden`: cada folha
       * leva a SUA cópia do trilho, com o índice dela aceso. `.ap-trilho` é
       * absoluto em relação ao palco e a `<section>` cobre o palco inteiro, então
       * as coordenadas batem.
       */
      const trilho = document.querySelector(".ap-trilho");
      if (trilho) clone.prepend(trilho.cloneNode(true));
```

E na autoconferência (`conferirNoDisco`), depois da checagem de `repetidos`, acrescentar:

```js
  const semTrilho = await pagina.$$eval(".ap-folha", (secoes) =>
    secoes.filter((s) => !s.querySelector(".ap-trilho")).length,
  );
  if (semTrilho) throw new Error(`${semTrilho} folhas do arquivo saíram sem o trilho.`);
```

- [ ] **Step 3: Regerar e provar**

Run: `npm run apresentacao:offline && node scratchpad/debug-offline-trilho.mjs`
Expected: `OK — 19 folhas do deck + 6 do anexo` e `trilhos visíveis: 1`.

- [ ] **Step 4: Commit**

```bash
git add scripts/gerar-apresentacao-offline.mjs
git diff --cached --stat
git commit -m "a copia offline leva o trilho dentro de cada folha"
```

---

### Task 11: Prova final, documentação e memória

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-deck-instrumento-design.md` (nota "implementado em")
- Modify: `docs/superpowers/specs/2026-08-24-apresentacao-diretoria-design.md` (nota datada apontando para o spec do instrumento)
- Memória: `C:\Users\matheus.mendes\.claude\projects\C--Dev-trabalho-empresa-nexodoc\memory\nexodoc-deck-instrumento.md` + linha em `MEMORY.md`

- [ ] **Step 1: A bateria inteira**

Run, com `npm run dev` de pé:

```bash
node scripts/shot-apresentacao-todas.mjs
REDUZIDO=1 ESPERA=1200 node scripts/shot-apresentacao-todas.mjs
node scripts/medir-folga-apresentacao.mjs
node scripts/prova-deck-regua.mjs
node scripts/prova-deck-caixa.mjs
node scripts/shot-apresentacao-folhas.mjs
npm run apresentacao:offline
npx tsc --noEmit -p . 2>&1 | grep apresentacao; npx eslint app/apresentacao scripts/prova-deck-regua.mjs scripts/prova-deck-caixa.mjs scripts/gerar-apresentacao-offline.mjs
```

Expected: todas as capturas inteiras nos dois modos (comparar `apresentacao/` e `apresentacao-reduzido/` com o script de diferença de pixels usado em 10/09 — diferença < 2% por folha); `fundo` ≤ 1000; TUDO CERTO nas três provas; offline OK; sem erro de tipo ou lint.

- [ ] **Step 2: Olhar quadros no meio da animação**

Capturar as folhas 06, 09 e 14 a 600 ms e 1400 ms (adaptar `scratchpad/shot-passada2.mjs` de 10/09). Conferir: a linha da escala aparece antes dos fatos; nenhum glifo vaza pela máscara; a marca do trilho está na posição final (a transição de 260 ms já acabou).

- [ ] **Step 3: Notas nos specs**

No topo de `2026-09-10-deck-instrumento-design.md`, trocar `**Estado:** aprovado em conversa, aguardando plano.` por `**Estado:** implementado em <data>, commit <hash>. Plano em docs/superpowers/plans/2026-09-10-deck-instrumento.md.`

No topo de `2026-08-24-apresentacao-diretoria-design.md`, antes da nota de 10/09 existente, acrescentar:

```
> **<data> — A ESTRUTURA E O VISUAL DO DECK SÃO OS DO SPEC DO INSTRUMENTO**
> (`2026-09-10-deck-instrumento-design.md`): trilho fixo, rótulo-título em
> caixa alta, quatro arquétipos, leitura na base. Este documento continua a
> autoridade do TEXTO e das NOTAS; a nota de 10/09 abaixo descreve o sistema
> de movimento que o instrumento herdou.
```

- [ ] **Step 4: Memória**

Criar `nexodoc-deck-instrumento.md` (tipo `project`): o que é o Instrumento, a decisão contra Slidev, ritmo automático, a lista de siglas, onde vivem as provas, e o que ficou de propósito. Atualizar `nexodoc-deck-passadas-2-3.md` para apontar que o deck foi refeito. Acrescentar a linha em `MEMORY.md`.

- [ ] **Step 5: Commit e push**

```bash
git add docs/superpowers/specs/2026-09-10-deck-instrumento-design.md docs/superpowers/specs/2026-08-24-apresentacao-diretoria-design.md
git diff --cached --stat
git commit -m "o deck como instrumento esta na main: specs anotados"
git push origin main
```

---

## Auto-revisão do plano (feita em 10/09/2026)

- **Cobertura do spec:** §3 armadura → Task 1; §4 caixa e tipo → Task 2 (CSS, prova de caixa) e Tasks 3–8 (uso); §5.1–5.4 arquétipos e folhas → Tasks 2–7; §5.5 anexo → Task 8; §6 movimento → Task 2 (ordem escala→fatos), Task 1 (marca desliza, reduzido); §7 código → Tasks 1, 2, 7, 9; §8 provas → Tasks 1, 2, 9, 10, 11. Sem lacuna.
- **Placeholders:** os únicos `/* [copiar] */` são instruções de transcrição de texto já existente no repositório, com o comando para localizá-lo; nenhum "TBD".
- **Consistência de nomes:** `Leitura`, `EscalaHorizontal`, `EscalaVertical`, `Confronto`, `Mostrador`, `LinhaDeLeitura`, `Fato`, `ItemDaEscala` usados nas Tasks 3–8 exatamente como definidos na Task 2; `Slide.titulo`/`subtitulo` da Task 1 usados nas folhas; classes CSS `.ap-trilho__*`, `.ap-rotulo-titulo`, `.ap-mono-rotulo`, `.ap-grade`, `.ap-texto`, `.ap-titulo-de-fato`, `.ap-fonte`, `.ap-premissa`, `.ap-cresce` conferidas.
