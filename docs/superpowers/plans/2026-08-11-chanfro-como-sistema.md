# O chanfro como sistema — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o raio de 8px por um chanfro em dois cantos opostos no shell do Nexo e nos primitivos de UI, com contorno e anel de foco desenhados em camada, sem tocar em tipografia, cor ou grade.

**Architecture:** Toda a geometria vive em `app/globals.css` como tokens `--cut-*` e duas famílias de classe (`.nx-cut-*` para superfície chapada, `.nx-edge-*` para superfície com contorno). `.nx-edge-*` desenha a borda com o fundo do próprio elemento e o miolo com um `::before` recortado — `isolation: isolate` + `z-index: -1` põem o miolo acima do fundo e abaixo do conteúdo, sem wrapper e sem regra em `> *`. O anel de foco é o mesmo `::before` recuando de 1px para 3px. Os componentes só escolhem o corte e setam `--nx-edge` / `--nx-fill`; nenhum escreve `clip-path`.

**Tech Stack:** Next.js 15 (App Router), Tailwind v4 CSS-only (sem `tailwind.config.*`), `class-variance-authority`, Radix (`@radix-ui/react-slot`, `react-tooltip`), Playwright 1.61 para prova em navegador.

## Global Constraints

Valem para toda tarefa, sem repetição.

- **A fonte é IBM Plex, não Geist.** O handoff diz "Geist Mono" — é o tipo do documento de design, não o do produto. A spec fecha que tipografia não muda. Use `font-mono`, que resolve para `var(--font-plex-mono)`. **Nunca importe Geist.**
- **Nenhum `clip-path` literal fora de `app/globals.css`.** Componente consome `.nx-cut-*` / `.nx-edge-*` e as variáveis `--nx-edge` / `--nx-fill`.
- **Nenhuma cor solta.** Os valores novos (`#00bda7`, `#00877a`, `#7af7e1`) entram em `:root`. Os que o handoff cita inline já existem: `#2c3338` = `--input`, `#1a1e21` = `--secondary`, `#23282c` = `--border`, `#5bdac6` = `--ring`, `#00a693` = `--primary`, `#06080a` = `--nexodoc-recessed` / `--primary-foreground`.
- **Classe nova entra em `@layer components`.** Fora de camada ela venceria as utilities do Tailwind e mataria `border-*` silenciosamente — já aconteceu neste repositório (o comentário em `globals.css:188-195` documenta o episódio).
- **`box-shadow` externo e `outline` não sobrevivem ao recorte.** `inset` sobrevive. Toda sombra de elevação em elemento recortado tem que virar `filter: drop-shadow()` **num pai não recortado**, nunca no próprio elemento (`filter` é aplicado antes de `clip-path`, então o resultado seria cortado junto).
- **Chanfro sempre em superior esquerdo + inferior direito.** Sem exceção decorativa.
- **Escopo:** só os nove alvos. `app/admin/**`, `modules/volume-builder/**` e `components/audit-result.tsx` ficam fora por decisão registrada na spec.
- **Commits direto na `main`.** Sem branch, sem PR. Nunca `git add -A` — sempre os caminhos explícitos, porque a árvore tem modificações não relacionadas.

### Quatro achados do código que contradizem o handoff

| # | achado | o que o plano faz |
|---|---|---|
| 1 | `chip.tsx` é `rounded-full` **de propósito** — o docblock diz "em forma de pílula" | O handoff manda corte 6. O chanfro vence; a Tarefa 5 reescreve o docblock para não deixar duas fontes de verdade brigando. |
| 2 | `badge.tsx` tem 10 variantes com borda **e** fundo translúcidos (`border-primary/20` sobre `bg-primary/8`) | Translucidez não sobrevive à camada: o miolo comporia sobre a cor da borda, não sobre a página. Badge fica com **`.nx-cut-5` e uma forma só**, sem contorno — que é exatamente o que o handoff já manda ("badge preenchido não recebe camada externa"). |
| 3 | `dropdown.tsx` usa `shadow-lg` e `tooltip.tsx` usa `--shadow-overlay` — sombras **externas** | Ambas morrem no recorte. A Tarefa 6 move a elevação para `filter: drop-shadow()` num pai. |
| 4 | O ring global de `globals.css:284-298` é `box-shadow` e cobre `a, button, summary, input, select, textarea` | Se não for desligado no elemento recortado, o controle fica **sem foco visível nenhum** — regressão de acessibilidade. Tarefa 1. |

## File Structure

| arquivo | responsabilidade | tarefa |
|---|---|---|
| `app/globals.css` | tokens `--cut-*`, cores novas, `.nx-cut-*`, `.nx-edge-*`, `.nx-ctl`, desligamento do ring global, `prefers-reduced-motion` | 1 |
| `app/bancada-do-chanfro/page.tsx` | rota de bancada: todo primitivo, toda variante, sem login e sem IA — é o alvo da prova | 1 |
| `scripts/prova-chanfro.mjs` | mede `getComputedStyle` na bancada e falha com código 1; é o teste de todas as tarefas | 1 |
| `components/ui/button.tsx` | reescrita: 3 alturas, lâmina, foco em camada | 2 |
| `components/ui/card.tsx` · `glass-panel.tsx` | corte 8 | 3 |
| `components/ui/input.tsx` · `textarea.tsx` | corte 7 com wrapper real (única exceção) | 4 |
| `components/ui/chip.tsx` · `badge.tsx` | corte 6 · 5 | 5 |
| `components/ui/dropdown.tsx` · `tooltip.tsx` | corte 6, itens 5, elevação por `drop-shadow` | 6 |
| `modules/nexo/components/*Node.tsx`, `AcaoDoNo.tsx` | nós do palco, corte 6 | 7 |
| `modules/nexo/components/NexoSidebar.tsx` | corte 6 · 5 | 8 |

`scripts/prova-chanfro.mjs` cresce a cada tarefa: cada uma adiciona seus casos ao mesmo arquivo, roda para ver falhar, implementa, roda para ver passar.

---

### Task 1: A fundação — tokens, classes, bancada e a prova

**Files:**
- Modify: `app/globals.css` (`:root` em ~L122; fim do `@layer components` em L1296; regra de foco em L284-298)
- Create: `app/bancada-do-chanfro/page.tsx`
- Create: `scripts/prova-chanfro.mjs`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: nada.
- Produces: os tokens `--cut-4|5|6|7|8|12`, `--primary-hover`, `--primary-active`, `--blade`, `--blade-on-primary`, `--blade-on-secondary`, `--blade-on-destructive`; as classes `.nx-cut-4|5|6|7|8|12`, `.nx-edge-5|6|7|8`, `.nx-ctl`, `.nx-dot`; as variáveis de consumo `--nx-edge`, `--nx-fill`, `--nx-blade`. Toda tarefa seguinte usa esses nomes exatos.

- [ ] **Step 1: Escrever a bancada (o alvo da prova)**

Crie `app/bancada-do-chanfro/page.tsx`. Ela existe para a prova ter onde medir sem login e sem gastar token, e segue o precedente de `app/bancada-do-orbe/`. Nesta tarefa ela só exercita as classes cruas; as tarefas seguintes acrescentam os primitivos reais.

```tsx
/**
 * Bancada do chanfro — todo corte e toda camada numa tela só.
 *
 * Existe para `scripts/prova-chanfro.mjs` medir sem login e sem disparar IA.
 * Cada elemento carrega `data-prova` porque asserção por classe quebra quando a
 * classe muda de nome, e asserção por posição no DOM quebra quando alguém
 * insere uma linha acima.
 */
export const metadata = { title: "Bancada do chanfro" };

const CORTES = [4, 5, 6, 7, 8, 12] as const;
const CAMADAS = [5, 6, 7, 8] as const;

export default function BancadaDoChanfro() {
  return (
    <main className="flex min-h-screen flex-col gap-10 bg-background p-10">
      <section className="flex flex-wrap gap-4" data-prova="cortes">
        {CORTES.map((n) => (
          <div
            key={n}
            data-prova={`cut-${n}`}
            className={`nx-cut-${n} flex h-16 w-40 items-center justify-center bg-card font-mono text-xs text-muted-foreground`}
          >
            nx-cut-{n}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-4" data-prova="camadas">
        {CAMADAS.map((n) => (
          <div
            key={n}
            data-prova={`edge-${n}`}
            className={`nx-edge-${n} flex h-16 w-40 items-center justify-center font-mono text-xs text-muted-foreground`}
          >
            nx-edge-{n}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-4" data-prova="foco">
        <button
          type="button"
          data-prova="foco-alvo"
          className="nx-edge-7 h-10 border-0 px-4 font-mono text-xs text-foreground"
        >
          foco por dentro
        </button>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Escrever a prova, que ainda vai falhar**

Crie `scripts/prova-chanfro.mjs`. O idioma é o de `scripts/prova-css-no-login.mjs`: Playwright, login pelo atalho dev se aparecer, medida por `getComputedStyle`, `process.exit(1)` na falha.

```js
/**
 * PROVA: o chanfro existe, tem contorno e mostra foco.
 *
 * Tres coisas que uma asserção de DOM nao pega e que ja quebraram este projeto:
 *   - `clip-path` que nao aplicou volta "none", nao volta erro;
 *   - o miolo do contorno pintado ATRAS do fundo some sem avisar;
 *   - o anel de foco recortado deixa o controle sem foco visivel nenhum.
 * Por isso tudo aqui e medido no estilo computado, nao no markup.
 *
 * Nao gasta token: nao dispara nenhuma chamada de IA.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";

const falhas = [];
function conferir(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`OK    ${nome}`);
  } else {
    falhas.push(`${nome} — ${detalhe}`);
    console.log(`FALHA ${nome} — ${detalhe}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
}
await page.waitForLoadState("networkidle").catch(() => {});

// --- 1. Os seis cortes aplicaram ---
for (const n of [4, 5, 6, 7, 8, 12]) {
  const clip = await page.evaluate(
    (sel) => getComputedStyle(document.querySelector(sel)).clipPath,
    `[data-prova="cut-${n}"]`,
  );
  conferir(
    `nx-cut-${n} aplica clip-path`,
    clip.includes("polygon") && clip.includes(`${n}px`),
    `veio "${clip}"`,
  );
}

// --- 2. O contorno e uma camada visivel, nao uma borda ---
for (const n of [5, 6, 7, 8]) {
  const m = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const fora = getComputedStyle(el);
    const dentro = getComputedStyle(el, "::before");
    return {
      clipFora: fora.clipPath,
      clipDentro: dentro.clipPath,
      bgFora: fora.backgroundColor,
      bgDentro: dentro.backgroundColor,
      inset: dentro.insetBlockStart || dentro.top,
      z: dentro.zIndex,
      isolation: fora.isolation,
      conteudo: dentro.content,
    };
  }, `[data-prova="edge-${n}"]`);

  conferir(`nx-edge-${n}: o ::before existe`, m.conteudo !== "none", `content=${m.conteudo}`);
  conferir(`nx-edge-${n}: ambas as formas recortadas`, m.clipFora.includes("polygon") && m.clipDentro.includes("polygon"), `fora=${m.clipFora} dentro=${m.clipDentro}`);
  conferir(`nx-edge-${n}: borda e miolo tem cores diferentes`, m.bgFora !== m.bgDentro, `ambos ${m.bgFora}`);
  conferir(`nx-edge-${n}: miolo a 1px`, m.inset === "1px", `veio ${m.inset}`);
  // Sem isolation, o z-index -1 cai ATRAS do fundo e o miolo some.
  conferir(`nx-edge-${n}: miolo abaixo do conteudo e acima do fundo`, m.z === "-1" && m.isolation === "isolate", `z=${m.z} isolation=${m.isolation}`);
}

// --- 3. O foco e por dentro, e o ring global se desligou ---
await page.locator('[data-prova="foco-alvo"]').focus();
const foco = await page.evaluate(() => {
  const el = document.querySelector('[data-prova="foco-alvo"]');
  const fora = getComputedStyle(el);
  const dentro = getComputedStyle(el, "::before");
  return { bg: fora.backgroundColor, sombra: fora.boxShadow, inset: dentro.insetBlockStart || dentro.top };
});
conferir("foco: o miolo recua para 3px", foco.inset === "3px", `veio ${foco.inset}`);
conferir("foco: a moldura vira --ring", foco.bg === "rgb(91, 218, 198)", `veio ${foco.bg}`);
// Se o ring global sobrevivesse, ele seria recortado e o foco sumiria.
conferir("foco: o ring global de box-shadow se desligou", foco.sombra === "none", `veio ${foco.sombra}`);

await browser.close();
console.log(`\n=== ${falhas.length === 0 ? "PASSOU" : `${falhas.length} FALHA(S)`} ===`);
if (falhas.length) for (const f of falhas) console.log(`  · ${f}`);
process.exit(falhas.length ? 1 : 0);
```

- [ ] **Step 3: Registrar o atalho no `package.json`**

No bloco `"scripts"`, ao lado dos outros `test:`:

```json
"test:chanfro": "node scripts/prova-chanfro.mjs",
```

- [ ] **Step 4: Rodar a prova e ver falhar**

Com `npm run dev` de pé noutro terminal:

```
npm run test:chanfro
```

Esperado: FALHA em todas as linhas de `nx-cut-*` e `nx-edge-*` (`veio "none"`), porque as classes ainda não existem. As três linhas de foco também falham. Código de saída 1.

- [ ] **Step 5: Adicionar os tokens em `:root`**

Em `app/globals.css`, logo depois de `--nexo-sidebar-w: 240px;` (L122):

```css
  /* ---------------------------------------------------------------------
     O CHANFRO (docs/superpowers/specs/2026-08-11-chanfro-como-sistema-design.md)
     Corte em superior esquerdo + inferior direito, sempre. O tamanho e o mesmo
     do raio que ele substitui. Os seis polígonos vivem so aqui: componente que
     escrever `clip-path` na mao quebra o criterio 02.
     --------------------------------------------------------------------- */
  --cut-4: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
  --cut-5: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
  --cut-6: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  --cut-7: polygon(7px 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, 0 7px);
  --cut-8: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
  --cut-12: polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px);

  /* Os tres degraus do teal interativo. Substituem o `hover:bg-primary/90`, que
     ENFRAQUECIA o botao no hover em vez de reagir a ele. */
  --primary-hover: #00bda7;
  --primary-active: #00877a;
  --blade: #7af7e1;
  --blade-on-primary: rgb(122 247 225 / 0.5);
  --blade-on-secondary: rgb(0 166 147 / 0.2);
  --blade-on-destructive: rgb(255 255 255 / 0.28);
```

- [ ] **Step 6: Adicionar as classes no fim do `@layer components`**

Em `app/globals.css`, imediatamente **antes** da chave que fecha o `@layer components` (a última linha do arquivo, L1296):

```css
/* =====================================================================
   O CHANFRO — duas familias, uma geometria.

   `.nx-cut-*`  superficie chapada: uma forma so.
   `.nx-edge-*` superficie com contorno: o fundo do elemento E a borda, e o
                `::before` recortado a 1px E o miolo.

   Por que `isolation: isolate` + `z-index: -1` e nao uma regra em `> *`:
   o -1 sozinho cairia atras do fundo do proprio elemento e o miolo sumiria;
   o `isolation` faz o elemento virar contexto de empilhamento, entao o -1
   passa a significar "acima do meu fundo, abaixo do meu conteudo". Com
   `> *` em vez disso, no de texto solto (sem elemento em volta) ficaria
   embaixo do miolo.
   ===================================================================== */
.nx-cut-4 { clip-path: var(--cut-4); }
.nx-cut-5 { clip-path: var(--cut-5); }
.nx-cut-6 { clip-path: var(--cut-6); }
.nx-cut-7 { clip-path: var(--cut-7); }
.nx-cut-8 { clip-path: var(--cut-8); }
.nx-cut-12 { clip-path: var(--cut-12); }

.nx-edge-5,
.nx-edge-6,
.nx-edge-7,
.nx-edge-8 {
  position: relative;
  isolation: isolate;
  background: var(--nx-edge, var(--border));
}

.nx-edge-5::before,
.nx-edge-6::before,
.nx-edge-7::before,
.nx-edge-8::before {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: -1;
  background: var(--nx-fill, var(--card));
  transition:
    inset var(--duration-fast) var(--ease-feedback),
    background-color var(--duration-fast) var(--ease-feedback);
}

.nx-edge-5, .nx-edge-5::before { clip-path: var(--cut-5); }
.nx-edge-6, .nx-edge-6::before { clip-path: var(--cut-6); }
.nx-edge-7, .nx-edge-7::before { clip-path: var(--cut-7); }
.nx-edge-8, .nx-edge-8::before { clip-path: var(--cut-8); }

/* O ANEL DE FOCO E POR DENTRO. `outline` e `box-shadow` externo sao recortados
   pelo clip-path -- um anel por fora exigiria inflar a caixa ou envolver todo
   focalizavel. Aqui a moldura que ja existe vira teal e o miolo recua 2px.
   `:has(:focus-visible)` cobre o wrapper de campo, onde o foco esta no filho. */
:is(.nx-edge-5, .nx-edge-6, .nx-edge-7, .nx-edge-8):is(:focus-visible, :has(:focus-visible)) {
  background: var(--ring);
}
:is(.nx-edge-5, .nx-edge-6, .nx-edge-7, .nx-edge-8):is(:focus-visible, :has(:focus-visible))::before {
  inset: 3px;
}

/* A LAMINA. Camada inclinada a 30 graus que entra pela direita e sai pela
   esquerda. Quem quiser lamina seta `--nx-blade`; sem isso `.nx-ctl` nao pinta
   nada e continua servindo so como gancho. */
.nx-ctl::after {
  content: "";
  position: absolute;
  top: -2px;
  bottom: -2px;
  left: 0;
  width: 160%;
  z-index: -1;
  background: var(--nx-blade, transparent);
  transform: skewX(-30deg) translateX(120%);
  transition: transform 300ms var(--ease-feedback);
  pointer-events: none;
}
.nx-ctl:hover:not(:disabled)::after {
  transform: skewX(-30deg) translateX(-14%);
}
.nx-ctl[data-loading="true"]::after {
  background: var(--nx-blade, transparent);
  opacity: 0.6;
  animation: nx-lamina 1.8s linear infinite;
}
@keyframes nx-lamina {
  from { transform: skewX(-30deg) translateX(120%); }
  to { transform: skewX(-30deg) translateX(-160%); }
}

/* O PONTO DE CANTO, so na secundaria: na primaria chapada nao ha contraste para
   ele. Vai como segunda camada de background do miolo -- o ::after ja e a
   lamina, e um terceiro pseudo-elemento nao existe. O ::before esta a 1px da
   borda, entao `top 1px right 1px` da os 2px que a spec pede. */
.nx-dot:hover:not(:disabled)::before {
  background:
    linear-gradient(var(--ring), var(--ring)) no-repeat top 1px right 1px / 4px 4px,
    var(--nx-fill, var(--card));
}

/* Nada desliza. A lamina some em vez de correr, e o hover vira troca de fundo. */
@media (prefers-reduced-motion: reduce) {
  .nx-ctl::after,
  .nx-ctl[data-loading="true"]::after {
    display: none;
    animation: none;
  }
  :is(.nx-edge-5, .nx-edge-6, .nx-edge-7, .nx-edge-8)::before {
    transition: none;
  }
}
```

- [ ] **Step 7: Desligar o ring global no elemento recortado**

Em `app/globals.css`, o seletor de foco em L288-293 vira:

```css
a:focus-visible,
button:not([class*="nx-cut-"]):not([class*="nx-edge-"]):focus-visible,
summary:focus-visible,
input:not([class*="nx-cut-"]):not([class*="nx-edge-"]):focus-visible,
select:focus-visible,
textarea:not([class*="nx-cut-"]):not([class*="nx-edge-"]):focus-visible {
  border-color: var(--ring);
  /* Ring unico do sistema: 3px em bright-teal /25, para o que AINDA nao tem
     chanfro. Em elemento recortado este box-shadow e CORTADO -- o controle
     ficaria sem foco visivel nenhum. Quem tem chanfro usa o anel por dentro do
     `.nx-edge-*`, e por isso sai daqui pelo `:not()`. */
  box-shadow: 0 0 0 3px rgb(91 218 198 / 0.25);
}
```

O `:not([class*=...])` segue o mesmo idioma que o `:not([type="checkbox"])` de L311 — a alternativa (sobrescrever com `box-shadow: none` em `@layer components`) apagaria junto o `inset` do fio de luz da primária, que **sobrevive** ao recorte e tem que continuar lá.

- [ ] **Step 8: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Esperado: todas as linhas `OK`, `=== PASSOU ===`, código de saída 0.

Se `nx-edge-*: borda e miolo tem cores diferentes` falhar com as duas cores iguais, o `::before` está sendo pintado atrás do fundo — confira se o `isolation: isolate` entrou.

- [ ] **Step 9: Commit**

```bash
git add app/globals.css app/bancada-do-chanfro/page.tsx scripts/prova-chanfro.mjs package.json
git commit -m "css: o chanfro vira token, e o contorno deixa de ser borda"
```

---

### Task 2: O botão

**Files:**
- Modify: `components/ui/button.tsx` (reescrita completa)
- Modify: `app/bancada-do-chanfro/page.tsx` (acrescentar a seção de botões)
- Modify: `scripts/prova-chanfro.mjs` (acrescentar o bloco 4)

**Interfaces:**
- Consumes: `.nx-edge-6|7|8`, `.nx-ctl`, `.nx-dot`, `--nx-edge`, `--nx-fill`, `--nx-blade`, `--primary-hover`, `--primary-active`, `--blade-on-*` (Tarefa 1).
- Produces: `Button` com `size: "default" | "sm" | "lg" | "icon"` (40 / 32 / 44 / 40px) e `variant: "default" | "destructive" | "outline" | "secondary" | "google" | "ghost"` — os mesmos nomes de hoje, nenhum call site muda. Prop nova opcional `loading?: boolean`. `buttonVariants` segue exportado.

- [ ] **Step 1: Acrescentar os botões à bancada**

Em `app/bancada-do-chanfro/page.tsx`, importe `Button` e acrescente antes de `</main>`:

```tsx
      <section className="flex flex-wrap items-center gap-4" data-prova="botoes">
        <Button data-prova="btn-lg" size="lg">Confirmar e gerar</Button>
        <Button data-prova="btn-default">Corrigir</Button>
        <Button data-prova="btn-sm" size="sm">Denso</Button>
        <Button data-prova="btn-secondary" variant="secondary">Secundária</Button>
        <Button data-prova="btn-ghost" variant="ghost">Cancelar</Button>
        <Button data-prova="btn-loading" loading>Gerando</Button>
      </section>
```

- [ ] **Step 2: Acrescentar o bloco 4 à prova, e vê-lo falhar**

Em `scripts/prova-chanfro.mjs`, antes de `await browser.close()`:

```js
// --- 4. As tres alturas coexistem e o CSS global nao forca 40px ---
const alturas = await page.evaluate(() =>
  ["btn-lg", "btn-default", "btn-sm"].map((p) => {
    const el = document.querySelector(`[data-prova="${p}"]`);
    return { p, h: Math.round(el.getBoundingClientRect().height), clip: getComputedStyle(el).clipPath };
  }),
);
conferir("botao 44 (size lg)", alturas[0].h === 44, `veio ${alturas[0].h}px`);
conferir("botao 40 (size default)", alturas[1].h === 40, `veio ${alturas[1].h}px`);
conferir("botao 32 (size sm)", alturas[2].h === 32, `veio ${alturas[2].h}px`);
for (const { p, clip } of alturas) {
  conferir(`${p} recortado`, clip.includes("polygon"), `veio ${clip}`);
}

// A lamina so aparece no hover -- em repouso ela esta fora da caixa.
const laminaRepouso = await page.evaluate(
  () => getComputedStyle(document.querySelector('[data-prova="btn-lg"]'), "::after").transform,
);
conferir("lamina existe como matriz de transformacao", laminaRepouso.startsWith("matrix"), `veio ${laminaRepouso}`);

await page.locator('[data-prova="btn-lg"]').hover();
await page.waitForTimeout(400);
const laminaHover = await page.evaluate(
  () => getComputedStyle(document.querySelector('[data-prova="btn-lg"]'), "::after").transform,
);
conferir("a lamina se move no hover", laminaHover !== laminaRepouso, `parada em ${laminaHover}`);
```

Rodar: `npm run test:chanfro`. Esperado: FALHA em `botao 32` (hoje `sm` é 36px) e em `${p} recortado` (`veio none`); o resto do arquivo continua OK.

- [ ] **Step 3: Reescrever `components/ui/button.tsx`**

```tsx
import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * O chanfro (docs/superpowers/specs/2026-08-11-chanfro-como-sistema-design.md).
 *
 * Tres camadas, nenhuma delas markup -- condicao para o `asChild` do Radix
 * continuar funcionando, ja que o Slot nao aceita filho extra:
 *   elemento   a cor da borda; vira --ring no :focus-visible
 *   ::before   o miolo; recua de 1px para 3px no foco; carrega o ponto de canto
 *   ::after    a lamina
 * Tudo isso vive em `.nx-edge-*` / `.nx-ctl` / `.nx-dot` no globals.css. Aqui so
 * escolhemos o corte e passamos as cores por --nx-edge / --nx-fill / --nx-blade.
 *
 * O `min-h-10` da base SAIU: era ele que apagava a hierarquia de tamanho, e sem
 * isso as tres alturas nao coexistem numa mesma tela (criterio 04).
 *
 * A fonte e IBM Plex Mono (`font-mono`), nao Geist -- o handoff cita Geist
 * porque e o tipo do documento de design, e a spec fecha que tipografia nao muda.
 */
const buttonVariants = cva(
  "nx-ctl relative inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap border-0 font-mono font-semibold uppercase tracking-[0.06em] outline-none transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:size-4",
  {
    variants: {
      variant: {
        /* Repouso CHAPADO: a moldura tem a mesma cor do miolo, entao nao se ve
           contorno nenhum -- mas a camada existe, e e ela que vira o anel de
           foco. Substitui o `hover:bg-primary/90`, que enfraquecia o botao. */
        default:
          "text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] [--nx-edge:var(--primary)] [--nx-fill:var(--primary)] [--nx-blade:var(--blade-on-primary)] hover:[--nx-fill:var(--primary-hover)] hover:[--nx-edge:var(--primary-hover)] active:shadow-[inset_0_2px_3px_rgb(0_0_0/0.35)] active:[--nx-fill:var(--primary-active)] active:[--nx-edge:var(--primary-active)]",
        destructive:
          "text-[var(--destructive-foreground)] [--nx-edge:var(--destructive)] [--nx-fill:var(--destructive)] [--nx-blade:var(--blade-on-destructive)]",
        /* Secundaria e outline sao a mesma camada com miolos diferentes:
           #2c3338 (--input) por fora, #1a1e21 (--secondary) ou --card por dentro. */
        outline:
          "nx-dot text-foreground [--nx-edge:var(--input)] [--nx-fill:var(--card)] [--nx-blade:var(--blade-on-secondary)]",
        secondary:
          "nx-dot text-secondary-foreground [--nx-edge:var(--input)] [--nx-fill:var(--secondary)] [--nx-blade:var(--blade-on-secondary)]",
        google:
          "font-sans text-sm font-medium normal-case tracking-normal text-background [--nx-edge:var(--foreground)] [--nx-fill:var(--foreground)]",
        /* Sem forma: so texto. A camada continua existindo (transparente) para o
           anel de foco ter onde aparecer. */
        ghost:
          "text-muted-foreground [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-fill:var(--accent)]",
      },
      size: {
        lg: "nx-edge-8 h-11 px-[22px] text-[12px]",
        default: "nx-edge-7 h-10 px-[18px] text-[12px]",
        sm: "nx-edge-6 h-8 px-[14px] text-[11px]",
        icon: "nx-edge-7 size-10 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /* Carregando nao tem spinner: a lamina entra em laco e o fundo desce um
       degrau. Um spinner dentro de forma recortada briga com o chanfro. */
    loading?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      data-loading={loading ? "true" : undefined}
      disabled={disabled ?? (loading || undefined)}
      className={cn(
        buttonVariants({ variant, size }),
        loading && "[--nx-fill:var(--primary-active)] [--nx-edge:var(--primary-active)]",
        className,
      )}
      {...props}
    />
  );
}

export { Button, buttonVariants };
```

- [ ] **Step 4: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Esperado: todas as linhas `OK`, incluindo as seis do bloco 4. Código de saída 0.

- [ ] **Step 5: Conferir que o botão não regrediu nas telas reais**

```
node scripts/shot-plano-pendente.mjs
```

Abra o PNG gerado: os botões devem estar chanfrados, com rótulo em caixa alta, e nenhum deles esticado ou espremido. Se algum `Button` com `className="w-full"` perdeu a largura, o `cn()` está com a ordem trocada — `className` tem que vir por último.

- [ ] **Step 6: Commit**

```bash
git add components/ui/button.tsx app/bancada-do-chanfro/page.tsx scripts/prova-chanfro.mjs
git commit -m "botao: tres alturas, lamina no hover, e o foco desenhado por dentro"
```

---

### Task 3: Cartão e painel de vidro

**Files:**
- Modify: `components/ui/card.tsx:20`
- Modify: `components/ui/glass-panel.tsx:33`
- Modify: `app/bancada-do-chanfro/page.tsx`
- Modify: `scripts/prova-chanfro.mjs`

**Interfaces:**
- Consumes: `.nx-edge-8`, `.nx-cut-8`.
- Produces: `Card` com prop nova `flat?: boolean` — `false` (padrão) desenha o contorno em camada, `true` usa uma forma só. `GlassPanel` sem API nova.

- [ ] **Step 1: Acrescentar à bancada**

```tsx
      <section className="flex flex-wrap gap-4" data-prova="cartoes">
        <Card data-prova="card" className="w-56 p-4 text-sm text-muted-foreground">
          cartão com contorno
        </Card>
        <Card data-prova="card-flat" flat className="w-56 p-4 text-sm text-muted-foreground">
          cartão chapado
        </Card>
      </section>
```

- [ ] **Step 2: Acrescentar o bloco 5 à prova, e vê-lo falhar**

```js
// --- 5. Cartao: com contorno vira camada, chapado continua uma forma so ---
const cartoes = await page.evaluate(() => {
  const ler = (p) => {
    const el = document.querySelector(`[data-prova="${p}"]`);
    return {
      clip: getComputedStyle(el).clipPath,
      raio: getComputedStyle(el).borderTopLeftRadius,
      antes: getComputedStyle(el, "::before").content,
    };
  };
  return { card: ler("card"), flat: ler("card-flat") };
});
conferir("card recortado", cartoes.card.clip.includes("polygon"), `veio ${cartoes.card.clip}`);
conferir("card sem raio", cartoes.card.raio === "0px", `veio ${cartoes.card.raio}`);
conferir("card com contorno tem a camada", cartoes.card.antes !== "none", "sem ::before");
conferir("card chapado recortado", cartoes.flat.clip.includes("polygon"), `veio ${cartoes.flat.clip}`);
// Camada externa sem necessidade e desperdicio: chapado e uma div so.
conferir("card chapado NAO tem camada", cartoes.flat.antes === "none", "criou ::before a toa");
```

Rodar: FALHA em `card recortado`, `card sem raio` (`veio 8px`) e `card com contorno tem a camada`.

- [ ] **Step 3: Trocar `card.tsx`**

Substitua a assinatura e a `className` do `Card` (linhas 4-25) por:

```tsx
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { flat?: boolean }
>(({ className, flat = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      /*
       * DESIGN.md secao 4: FLAT POR PADRAO -- profundidade vem de borda + tom de
       * superficie, nunca de sombra.
       *
       * O raio de 8px virou chanfro de 8px (spec do chanfro). Com contorno, a
       * borda e o fundo do proprio elemento e o miolo e o ::before -- `border`
       * nao sobrevive ao recorte nas diagonais. Sem contorno (`flat`), uma forma
       * so: camada externa sem necessidade e desperdicio de pintura.
       */
      flat ? "nx-cut-8 bg-card" : "nx-edge-8",
      "text-card-foreground",
      className
    )}
    {...props}
  />
));
```

- [ ] **Step 4: Trocar `glass-panel.tsx:33`**

```tsx
        "nexo-glass nx-cut-8",
```

O vidro é uma forma só: `.nexo-glass` já pinta fundo, `backdrop-filter` e o `--glass-edge` (que é `inset`, e portanto sobrevive ao recorte).

- [ ] **Step 5: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Esperado: código de saída 0.

- [ ] **Step 6: Commit**

```bash
git add components/ui/card.tsx components/ui/glass-panel.tsx app/bancada-do-chanfro/page.tsx scripts/prova-chanfro.mjs
git commit -m "cartao e vidro: o raio sai, o chanfro entra"
```

---

### Task 4: Campo e área de texto — a exceção do wrapper

**Files:**
- Modify: `components/ui/input.tsx` (reescrita)
- Modify: `components/ui/textarea.tsx` (reescrita)
- Modify: `app/globals.css` (regra L273-277)
- Modify: `app/bancada-do-chanfro/page.tsx`
- Modify: `scripts/prova-chanfro.mjs`

**Interfaces:**
- Consumes: `.nx-edge-7`.
- Produces: `Input` e `Textarea` com a mesma API de hoje (`React.ComponentProps<"input">` / `"textarea"`), mas renderizando `<div class="nx-edge-7">` em volta. `className` continua indo para o **wrapper** quando trata de largura/layout — documentado no docblock.

- [ ] **Step 1: Acrescentar à bancada**

```tsx
      <section className="flex flex-col gap-4" data-prova="campos">
        <Input data-prova="input" placeholder="campo de texto" className="w-64" />
        <Textarea data-prova="textarea" placeholder="area de texto" className="w-64" />
      </section>
```

- [ ] **Step 2: Acrescentar o bloco 6 à prova, e vê-lo falhar**

```js
// --- 6. Campo: wrapper real, porque input nativo nao renderiza ::before ---
await page.locator('[data-prova="input"]').focus();
await page.waitForTimeout(200);
const campo = await page.evaluate(() => {
  const el = document.querySelector('[data-prova="input"]');
  const wrap = el.closest(".nx-edge-7");
  return {
    temWrapper: Boolean(wrap),
    clip: wrap ? getComputedStyle(wrap).clipPath : "sem wrapper",
    raioDoCampo: getComputedStyle(el).borderTopLeftRadius,
    sombraDoCampo: getComputedStyle(el).boxShadow,
    focoNoWrapper: wrap ? getComputedStyle(wrap).backgroundColor : null,
    insetDoMiolo: wrap ? getComputedStyle(wrap, "::before").insetBlockStart : null,
  };
});
conferir("campo tem wrapper recortado", campo.temWrapper && campo.clip.includes("polygon"), `veio ${campo.clip}`);
conferir("campo sem raio proprio", campo.raioDoCampo === "0px", `veio ${campo.raioDoCampo}`);
// Se o ring global sobrevivesse aqui, ele apareceria como retangulo FORA do chanfro.
conferir("campo sem ring de box-shadow", campo.sombraDoCampo === "none", `veio ${campo.sombraDoCampo}`);
conferir("o foco do campo acende o wrapper", campo.focoNoWrapper === "rgb(91, 218, 198)", `veio ${campo.focoNoWrapper}`);
conferir("o miolo do campo recua no foco", campo.insetDoMiolo === "3px", `veio ${campo.insetDoMiolo}`);
```

Rodar: FALHA em `campo tem wrapper recortado` (não há wrapper) e nas duas de foco.

- [ ] **Step 3: Reescrever `components/ui/input.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo com chanfro — a UNICA exceção que ainda usa wrapper de verdade.
 *
 * `input` nativo nao renderiza `::before`, entao a camada de contorno nao cabe
 * dentro dele como cabe no Button e no Card. O wrapper `.nx-edge-7` desenha a
 * borda, o miolo e o anel de foco (por `:has(:focus-visible)`, que ve o foco do
 * filho); o campo por dentro fica transparente e sem borda.
 *
 * `className` vai para o WRAPPER: e ele que ocupa espaco no layout. Para mexer
 * no campo em si, use `inputClassName`.
 */
function Input({
  className,
  inputClassName,
  type,
  ...props
}: React.ComponentProps<"input"> & { inputClassName?: string }) {
  return (
    <div className={cn("nx-edge-7 h-10 [--nx-fill:var(--nexodoc-recessed)] [--nx-edge:var(--input)]", className)}>
      <input
        type={type}
        data-slot="input"
        className={cn(
          "size-full min-w-0 border-0 bg-transparent px-3 py-1 text-sm outline-none file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          inputClassName,
        )}
        {...props}
      />
    </div>
  );
}

export { Input };
```

- [ ] **Step 4: Reescrever `components/ui/textarea.tsx`**

```tsx
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Mesma exceção do Input: `textarea` nativo nao renderiza `::before`, entao a
 * camada de contorno mora num wrapper. `className` vai para o wrapper.
 */
function Textarea({
  className,
  textareaClassName,
  ...props
}: React.ComponentProps<"textarea"> & { textareaClassName?: string }) {
  return (
    <div className={cn("nx-edge-7 min-h-16 [--nx-fill:var(--nexodoc-recessed)] [--nx-edge:var(--input)]", className)}>
      <textarea
        data-slot="textarea"
        className={cn(
          "size-full min-h-[inherit] resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          textareaClassName,
        )}
        {...props}
      />
    </div>
  );
}

export { Textarea };
```

- [ ] **Step 5: Tirar o raio global de campo**

Em `app/globals.css`, substitua L273-277:

```css
/* Campo dentro de wrapper `.nx-edge-*` nao tem forma propria: o chanfro e a
   borda vivem no wrapper. Fora dele (campo solto de terceiro), 4px continuam. */
input,
select,
textarea {
  border-radius: 4px;
}

.nx-edge-5 :is(input, select, textarea),
.nx-edge-6 :is(input, select, textarea),
.nx-edge-7 :is(input, select, textarea),
.nx-edge-8 :is(input, select, textarea) {
  border-radius: 0;
}
```

- [ ] **Step 6: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Esperado: código de saída 0.

- [ ] **Step 7: Conferir os call sites que passavam largura**

```
npx tsc --noEmit
```

Esperado: nenhum erro. Depois:

```
npm run lint
```

Se algum call site passava `className` esperando atingir o `<input>` (por exemplo `text-center` ou `font-mono`), o TypeScript não acusa — a classe simplesmente cai no wrapper e não faz efeito. Rode a busca e mova o que for tipografia para `inputClassName`:

```
npx rg -n "<Input[^>]*className=\"[^\"]*(text-|font-|placeholder|tracking)" --glob '!node_modules'
```

- [ ] **Step 8: Commit**

```bash
git add components/ui/input.tsx components/ui/textarea.tsx app/globals.css app/bancada-do-chanfro/page.tsx scripts/prova-chanfro.mjs
git commit -m "campo: o chanfro mora no wrapper, porque input nativo nao tem ::before"
```

---

### Task 5: Chip e badge

**Files:**
- Modify: `components/ui/chip.tsx:19-21` (base do cva e docblock)
- Modify: `components/ui/badge.tsx:12` (base do cva)
- Modify: `app/bancada-do-chanfro/page.tsx`
- Modify: `scripts/prova-chanfro.mjs`

**Interfaces:**
- Consumes: `.nx-edge-6`, `.nx-cut-5`.
- Produces: nenhuma mudança de API em `Chip` nem em `Badge`.

- [ ] **Step 1: Acrescentar à bancada**

```tsx
      <section className="flex flex-wrap items-center gap-4" data-prova="chips">
        <Chip data-prova="chip">chip padrão</Chip>
        <Chip data-prova="chip-suggest" variant="suggest">sugerido</Chip>
        <Badge data-prova="badge">badge</Badge>
        <Badge data-prova="badge-ok" variant="ok">ok</Badge>
      </section>
```

- [ ] **Step 2: Acrescentar o bloco 7 à prova, e vê-lo falhar**

```js
// --- 7. Chip e badge ---
const chipeBadge = await page.evaluate(() => {
  const ler = (p) => {
    const el = document.querySelector(`[data-prova="${p}"]`);
    const s = getComputedStyle(el);
    return { clip: s.clipPath, raio: s.borderTopLeftRadius, borda: s.borderTopWidth, antes: getComputedStyle(el, "::before").content };
  };
  return { chip: ler("chip"), badge: ler("badge"), badgeOk: ler("badge-ok") };
});
conferir("chip com corte 6", chipeBadge.chip.clip.includes("6px"), `veio ${chipeBadge.chip.clip}`);
conferir("chip perdeu a pilula", chipeBadge.chip.raio === "0px", `veio ${chipeBadge.chip.raio}`);
conferir("chip com contorno em camada", chipeBadge.chip.antes !== "none", "sem ::before");
conferir("badge com corte 5", chipeBadge.badge.clip.includes("5px"), `veio ${chipeBadge.badge.clip}`);
/* Badge e uma forma so: as 10 variantes tem fundo E borda TRANSLUCIDOS, e numa
   camada o miolo comporia sobre a cor da borda em vez de sobre a pagina --
   toda variante de status mudaria de cor. */
conferir("badge NAO usa camada", chipeBadge.badge.antes === "none", "criou ::before");
conferir("badge sem borda", chipeBadge.badgeOk.borda === "0px", `veio ${chipeBadge.badgeOk.borda}`);
```

- [ ] **Step 3: Trocar a base do `chip.tsx`**

Na linha 20-21, troque `rounded-full border` pelo chanfro e mate o ring de `box-shadow` (o `.nx-edge-6` já cuida do foco):

```tsx
  /* Transição pelos tokens de movimento (era `duration-150 ease-out`, solto). */
  "nx-edge-6 inline-flex min-h-8 shrink-0 items-center gap-2 whitespace-nowrap border-0 px-3 py-1 font-mono text-xs font-medium tracking-[0.02em] transition-[background-color,color] duration-[var(--duration-fast)] ease-[var(--ease-feedback)] outline-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:opacity-70",
```

E as três variantes, que passam a falar por `--nx-edge` / `--nx-fill`:

```tsx
        suggest:
          "text-foreground [--nx-edge:rgb(91_218_198/0.45)] [--nx-fill:var(--secondary)] hover:[--nx-edge:rgb(91_218_198/0.7)] hover:[--nx-fill:var(--accent)]",
        default:
          "text-foreground [--nx-edge:var(--border)] [--nx-fill:var(--secondary)] hover:[--nx-edge:var(--input)] hover:[--nx-fill:var(--accent)]",
        quiet:
          "text-muted-foreground [--nx-edge:transparent] [--nx-fill:transparent] hover:text-foreground hover:[--nx-edge:var(--border)] hover:[--nx-fill:var(--accent)]",
```

No docblock (linha 7), a frase "em forma de pílula" agora é falsa — troque por:

```
 * Chip — `<button>` real, matte, com o chanfro de 6px do sistema. Era pílula
 * (`rounded-full`) até a spec do chanfro; a forma passou a ser a mesma de todo
 * controle, porque duas geometrias competindo na mesma tela não são um sistema.
```

- [ ] **Step 4: Trocar a base do `badge.tsx:12`**

```tsx
  "nx-cut-5 inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-0 px-2 font-mono text-[11px] font-medium uppercase leading-none tracking-[0.05em] transition-colors",
```

As 10 variantes perdem o `border-*` e ficam só com `bg-*` e `text-*`. Remova apenas o trecho `border-...` de cada uma, preservando fundo e texto. Exemplo das duas primeiras:

```tsx
        default: "bg-primary/8 text-primary",
        secondary: "bg-secondary text-secondary-foreground",
```

E acrescente ao docblock (linha 7):

```
 * O badge nao usa a camada de contorno do sistema: as variantes tem fundo E
 * borda TRANSLUCIDOS, e numa camada o miolo comporia sobre a cor da borda em vez
 * de sobre a pagina -- toda variante de status mudaria de cor. Uma forma so,
 * chanfro de 5px, sem contorno. E o que a spec ja mandava.
```

- [ ] **Step 5: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Esperado: código de saída 0.

- [ ] **Step 6: Commit**

```bash
git add components/ui/chip.tsx components/ui/badge.tsx app/bancada-do-chanfro/page.tsx scripts/prova-chanfro.mjs
git commit -m "chip e badge: a pilula vira chanfro, e o badge fica sem contorno de proposito"
```

---

### Task 6: Sobreposições — dropdown e tooltip

**Files:**
- Modify: `components/ui/dropdown.tsx:79-100` (painel) e `:106-117` (item)
- Modify: `components/ui/tooltip.tsx:38-41`
- Modify: `app/globals.css` (classe `.nx-elev`, no fim do `@layer components`)
- Modify: `app/bancada-do-chanfro/page.tsx`
- Modify: `scripts/prova-chanfro.mjs`

**Interfaces:**
- Consumes: `.nx-edge-6`, `.nx-cut-6`, `.nx-cut-5`.
- Produces: classe `.nx-elev` — aplica `filter: drop-shadow()` num pai não recortado para devolver a elevação que o `clip-path` come. Nenhuma mudança de API em `Dropdown`, `DropdownItem` ou `TooltipContent`.

- [ ] **Step 1: Acrescentar à bancada**

```tsx
      <section className="flex flex-wrap gap-4" data-prova="sobreposicoes">
        <Dropdown
          trigger={({ toggle }) => (
            <Button data-prova="dd-trigger" variant="secondary" onClick={toggle}>Abrir menu</Button>
          )}
        >
          {() => (
            <>
              <DropdownItem data-prova="dd-item">Exportar</DropdownItem>
              <DropdownItem>Duplicar</DropdownItem>
            </>
          )}
        </Dropdown>
      </section>
```

- [ ] **Step 2: Acrescentar o bloco 8 à prova, e vê-lo falhar**

```js
// --- 8. Sobreposicao: chanfro no painel, corte 5 no item, elevacao por filter ---
await page.locator('[data-prova="dd-trigger"]').click();
await page.waitForSelector('[role="menu"]');
const menu = await page.evaluate(() => {
  const painel = document.querySelector('[role="menu"]');
  const item = document.querySelector('[data-prova="dd-item"]');
  return {
    clipPainel: getComputedStyle(painel).clipPath,
    sombraPainel: getComputedStyle(painel).boxShadow,
    filtroDoPai: getComputedStyle(painel.parentElement).filter,
    clipItem: getComputedStyle(item).clipPath,
  };
});
conferir("painel do menu com corte 6", menu.clipPainel.includes("6px"), `veio ${menu.clipPainel}`);
conferir("item do menu com corte 5", menu.clipItem.includes("5px"), `veio ${menu.clipItem}`);
/* box-shadow externo em elemento recortado e cortado junto: a elevacao some sem
   erro nenhum. Ela precisa vir de drop-shadow num pai NAO recortado -- `filter`
   e aplicado ANTES de `clip-path`, entao no proprio elemento seria cortada. */
conferir("o painel largou o box-shadow", menu.sombraPainel === "none", `veio ${menu.sombraPainel}`);
conferir("a elevacao veio do pai por drop-shadow", menu.filtroDoPai.includes("drop-shadow"), `veio ${menu.filtroDoPai}`);
```

- [ ] **Step 3: Acrescentar `.nx-elev` ao `globals.css`**

No fim do `@layer components`, junto do bloco do chanfro:

```css
/* ELEVACAO DE SOBREPOSICAO RECORTADA. `box-shadow` externo e cortado pelo
   clip-path, e `filter` no proprio elemento tambem (filter e aplicado ANTES do
   recorte). A sombra tem que vir de um PAI nao recortado -- ai o drop-shadow
   segue a silhueta chanfrada do filho, que e exatamente o que se quer. */
.nx-elev {
  filter: drop-shadow(0 8px 16px rgb(0 0 0 / 0.28)) drop-shadow(0 1px 2px rgb(0 0 0 / 0.35));
}
```

- [ ] **Step 4: Trocar o painel e o item do `dropdown.tsx`**

O painel ganha um pai só para carregar o filtro. Substitua o bloco `{open ? (...) : null}` (L82-97) por:

```tsx
      {open ? (
        /* O pai existe SO para a sombra: `filter` no painel recortado seria
           cortado junto. Nao tem estilo proprio nem afeta layout. */
        <div
          className={cn(
            "nx-elev absolute z-50",
            lugar?.lado === "acima" ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          <div
            role="menu"
            style={lugar ? { maxHeight: lugar.alturaMax } : undefined}
            className={cn(
              "nexodoc-enter nx-edge-6 min-w-[180px] overflow-y-auto overscroll-contain p-1 [--nx-fill:var(--nexodoc-panel)]",
              panelClassName,
            )}
          >
            {children({ close: () => setOpen(false) })}
          </div>
        </div>
      ) : null}
```

E o `DropdownItem` (L110-113):

```tsx
        "nx-cut-5 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-foreground outline-none transition-colors hover:bg-[var(--nexodoc-raised)] focus-visible:bg-[var(--nexodoc-raised)] disabled:pointer-events-none disabled:opacity-50",
```

- [ ] **Step 5: Trocar o `tooltip.tsx:38-41`**

O tooltip vai num `Portal`, então o pai da elevação é o próprio `TooltipContent` e a forma chanfrada vira um filho. **`children` tem que sair do spread** — se `{...props}` continuar carregando `children`, o Radix recebe filho duplicado. Substitua a função inteira:

```tsx
function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      {/* O Content carrega a elevacao e NAO e recortado -- `filter` e aplicado
          antes de `clip-path`, entao no elemento chanfrado a sombra sumiria.
          `--shadow-overlay` era box-shadow externo e morria no corte. */}
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className="nx-elev z-50 max-w-xs animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
        {...props}
      >
        <span className={cn("nx-edge-6 block px-3 py-1.5 font-mono text-xs text-foreground", className)}>
          {children}
        </span>
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
```

- [ ] **Step 6: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Esperado: código de saída 0. Depois confira o tooltip a olho:

```
node scripts/shot-nexo.mjs
```

- [ ] **Step 7: Commit**

```bash
git add components/ui/dropdown.tsx components/ui/tooltip.tsx app/globals.css app/bancada-do-chanfro/page.tsx scripts/prova-chanfro.mjs
git commit -m "sobreposicoes: chanfro no painel, e a elevacao migra para drop-shadow no pai"
```

---

### Task 7: Os nós do palco

**Files:**
- Modify: `modules/nexo/components/FolhaNode.tsx` (9 ocorrências de `rounded-*`)
- Modify: `modules/nexo/components/MemorialPageNode.tsx` (3)
- Modify: `modules/nexo/components/RecurringStackNode.tsx` (3)
- Modify: `modules/nexo/components/FindingCardNode.tsx` (2)
- Modify: `modules/nexo/components/AcaoDoNo.tsx` (1)
- Modify: `modules/nexo/components/FrameDoDocumento.tsx` (3)
- Modify: `modules/nexo/components/NavegacaoDoCanvas.tsx` (1 — o bloco de zoom)
- Modify: `scripts/prova-chanfro.mjs`

**Interfaces:**
- Consumes: `.nx-edge-6`, `.nx-cut-6`, `.nx-cut-4`.
- Produces: nada consumido por tarefas seguintes.

- [ ] **Step 1: Acrescentar o bloco 9 à prova, e vê-lo falhar**

Este bloco mede o palco de verdade, não a bancada — os nós dependem de estado do canvas. Acrescente ao fim de `prova-chanfro.mjs`, antes de `await browser.close()`:

```js
// --- 9. Os nos do palco ---
await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL(/\/nexo/, { timeout: 30_000 }).catch(() => {});
}
await page.waitForLoadState("networkidle").catch(() => {});

const nos = await page.evaluate(() => {
  const alvos = [...document.querySelectorAll(".react-flow__node")];
  return alvos.slice(0, 6).map((n) => {
    const forma = n.firstElementChild ?? n;
    return { clip: getComputedStyle(forma).clipPath, raio: getComputedStyle(forma).borderTopLeftRadius };
  });
});
if (nos.length === 0) {
  console.log("AVISO  nenhum no no palco -- semeie o estado antes de medir (ver scripts/shot-nexo-blocos.mjs)");
} else {
  conferir(
    `os ${nos.length} nos medidos estao recortados`,
    nos.every((n) => n.clip.includes("polygon")),
    `sem recorte: ${nos.filter((n) => !n.clip.includes("polygon")).length}`,
  );
  conferir(
    "nenhum no guardou raio",
    nos.every((n) => n.raio === "0px"),
    `com raio: ${nos.filter((n) => n.raio !== "0px").map((n) => n.raio).join(", ")}`,
  );
}
```

- [ ] **Step 2: Enumerar o que existe, para saber quando acabou**

```
npx rg -n "rounded-" modules/nexo/components/FolhaNode.tsx modules/nexo/components/MemorialPageNode.tsx modules/nexo/components/RecurringStackNode.tsx modules/nexo/components/FindingCardNode.tsx modules/nexo/components/AcaoDoNo.tsx modules/nexo/components/FrameDoDocumento.tsx modules/nexo/components/NavegacaoDoCanvas.tsx
```

Esperado no início: 22 linhas. Anote-as; ao fim do Step 3 só podem sobrar as de `rounded-full`.

- [ ] **Step 3: Trocar as classes, uma ocorrência por vez**

Leia cada arquivo antes de editar — a coluna da esquerda é o gatilho, não um texto a buscar cegamente:

| o que está lá | vira |
|---|---|
| `rounded-md border` (o nó em si, com contorno) | `nx-edge-6` + `[--nx-fill:<o bg que já estava>]`, e remova `border`/`border-*` e o `bg-*` correspondente |
| `rounded-md` sem `border` (superfície chapada) | `nx-cut-6`, mantendo o `bg-*` |
| `rounded-sm` / `rounded` em chip de ação interno | `nx-cut-6` |
| `rounded-full` em indicador de estado, avatar, orbe | **não mexa** — forma redonda é exceção da spec |

Duas regras que a tabela não cobre:

**A faixa de disciplina** no topo do nó tem que acompanhar o corte superior: dê a ela a mesma classe `nx-cut-6` do nó, senão o canto reto dela aparece por cima da diagonal.

**O bloco de zoom** (`NavegacaoDoCanvas.tsx`) recebe `nx-cut-4` **no conjunto, não em cada botão** — é exceção declarada na spec. Se os botões internos tiverem `rounded-*`, remova sem pôr corte no lugar: quem tem forma é o bloco.

- [ ] **Step 4: Rodar a prova e ver passar**

```
npm run test:chanfro
```

Se o aviso `nenhum no no palco` aparecer, semeie o estado com o molde de `scripts/shot-nexo-blocos.mjs` (IndexedDB, sem token) e rode de novo.

- [ ] **Step 5: Conferir a olho**

```
node scripts/shot-nexo-blocos.mjs
node scripts/shot-audit-canvas.mjs
```

Abra os PNGs: todo nó chanfrado, nenhum canto redondo sobrando, nenhuma faixa de disciplina com canto reto pisando na diagonal.

- [ ] **Step 6: Commit**

```bash
git add modules/nexo/components/FolhaNode.tsx modules/nexo/components/MemorialPageNode.tsx modules/nexo/components/RecurringStackNode.tsx modules/nexo/components/FindingCardNode.tsx modules/nexo/components/AcaoDoNo.tsx modules/nexo/components/FrameDoDocumento.tsx modules/nexo/components/NavegacaoDoCanvas.tsx scripts/prova-chanfro.mjs
git commit -m "palco: o no, a faixa de disciplina e os chips de acao entram no chanfro"
```

---

### Task 8: A barra lateral

**Files:**
- Modify: `modules/nexo/components/NexoSidebar.tsx` (15 ocorrências)
- Modify: `scripts/prova-chanfro.mjs`

**Interfaces:**
- Consumes: `.nx-edge-6`, `.nx-cut-6`, `.nx-cut-5`.

- [ ] **Step 1: Acrescentar o bloco 10 à prova, e vê-lo falhar**

A prova já está em `/nexo` depois do bloco 9. Acrescente:

```js
// --- 10. Barra lateral: nova conversa e busca em 6, itens em 5 ---
const lateral = await page.evaluate(() => {
  const raiz = document.querySelector(".nexo-shell__sidebar") ?? document.querySelector("aside");
  if (!raiz) return null;
  const itens = [...raiz.querySelectorAll("a, button")];
  return itens.slice(0, 12).map((el) => ({
    texto: (el.textContent ?? "").trim().slice(0, 24),
    clip: getComputedStyle(el).clipPath,
    raio: getComputedStyle(el).borderTopLeftRadius,
  }));
});
if (!lateral) {
  conferir("a barra lateral existe", false, "nem .nexo-shell__sidebar nem <aside>");
} else {
  const comRaio = lateral.filter((i) => i.raio !== "0px" && !i.clip.includes("polygon"));
  conferir(
    "nenhum controle da lateral guardou raio",
    comRaio.length === 0,
    `sobraram: ${comRaio.map((i) => `"${i.texto}" ${i.raio}`).join(", ")}`,
  );
}
```

- [ ] **Step 2: Enumerar e trocar as classes**

```
npx rg -n "rounded-" modules/nexo/components/NexoSidebar.tsx
```

Esperado no início: 15 linhas; ao fim só podem sobrar as de `rounded-full` (avatar, indicador de estado).

- "Nova conversa" e o campo de busca: `nx-edge-6` (o campo já vem do `Input` da Tarefa 4 e não precisa de nada).
- Item de conversa: `nx-cut-5`. **Só o ativo tem fundo** — o inativo fica sem `bg-*` e ganha o fundo só no `hover`.
- Avatar e indicador de estado: não mexa, ficam redondos.

- [ ] **Step 3: Rodar a prova e ver passar**

```
npm run test:chanfro
```

- [ ] **Step 4: Commit**

```bash
git add modules/nexo/components/NexoSidebar.tsx scripts/prova-chanfro.mjs
git commit -m "lateral: nova conversa e busca em 6, itens de conversa em 5"
```

---

### Task 9: Fechar os sete critérios de aceite

**Files:**
- Modify: `scripts/prova-chanfro.mjs` (blocos 11 e 12)
- Create: `scripts/shot-chanfro-nexo.mjs`

- [ ] **Step 1: Critérios 01 e 02 — a busca tem que voltar vazia**

Rode as duas buscas. Elas são o critério, não um atalho:

```
npx rg -n "rounded-(sm|md|lg|xl|\[)" components/ui modules/nexo/components/NexoSidebar.tsx modules/nexo/components/FolhaNode.tsx modules/nexo/components/MemorialPageNode.tsx modules/nexo/components/RecurringStackNode.tsx modules/nexo/components/FindingCardNode.tsx modules/nexo/components/AcaoDoNo.tsx modules/nexo/components/FrameDoDocumento.tsx
```

Esperado: **nenhuma linha**. `rounded-full` pode sobrar (formas redondas são exceção) — se aparecer, confirme que é orbe, avatar ou indicador de estado.

```
npx rg -n "clip-path|polygon\(" --glob '!node_modules' --glob '!app/globals.css' --glob '!*.svg' components app modules
```

Esperado: só os `<clipPath>` de SVG em `components/brand/logo-nexo.tsx`. Nenhum `clip-path` de CSS.

- [ ] **Step 2: Critério 05 — nada desliza com movimento reduzido**

Acrescente a `prova-chanfro.mjs`, antes de `await browser.close()`:

```js
// --- 11. Criterio 05: com prefers-reduced-motion, nada desliza ---
const ctxParado = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
const pgParado = await ctxParado.newPage();
await pgParado.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
if (pgParado.url().includes("/login")) {
  await pgParado.getByRole("button", { name: /Entrar como dev/i }).click();
  await pgParado.goto(`${BASE}/bancada-do-chanfro`, { waitUntil: "domcontentloaded" });
}
await pgParado.locator('[data-prova="btn-lg"]').hover();
await pgParado.waitForTimeout(400);
const parado = await pgParado.evaluate(() => {
  const s = getComputedStyle(document.querySelector('[data-prova="btn-lg"]'), "::after");
  const l = getComputedStyle(document.querySelector('[data-prova="btn-loading"]'), "::after");
  return { laminaHover: s.display, laminaLoading: l.display, animacao: l.animationName };
});
conferir("movimento reduzido: a lamina do hover nao existe", parado.laminaHover === "none", `veio ${parado.laminaHover}`);
conferir("movimento reduzido: carregando fica estatico", parado.laminaLoading === "none" && parado.animacao === "none", `display=${parado.laminaLoading} animation=${parado.animacao}`);
await ctxParado.close();
```

Rodar: `npm run test:chanfro`. Esperado: código de saída 0.

- [ ] **Step 3: Critério 07 — contraste AA do rótulo**

Acrescente o bloco 12:

```js
// --- 12. Criterio 07: contraste AA (>= 4.5) do rotulo na primaria, em repouso
//     e sob a lamina. O rotulo e texto pequeno (12px), entao vale o limite alto.
function luminancia([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function razao(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const cores = await page.evaluate(() => {
  const raiz = getComputedStyle(document.documentElement);
  return {
    texto: raiz.getPropertyValue("--primary-foreground").trim(),
    repouso: raiz.getPropertyValue("--primary").trim(),
    hover: raiz.getPropertyValue("--primary-hover").trim(),
    blade: raiz.getPropertyValue("--blade").trim(),
  };
});
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
// A lamina e --blade a 50% sobre --primary-hover: a mistura e a media.
const misturaBlade = hex(cores.hover).map((c, i) => Math.round((c + hex(cores.blade)[i]) / 2));
const rRepouso = razao(hex(cores.texto), hex(cores.repouso));
const rLamina = razao(hex(cores.texto), misturaBlade);
conferir(`contraste do rotulo em repouso (${rRepouso.toFixed(2)}:1)`, rRepouso >= 4.5, `precisa de 4.5`);
conferir(`contraste do rotulo sob a lamina (${rLamina.toFixed(2)}:1)`, rLamina >= 4.5, `precisa de 4.5`);
```

Rodar. Se algum dos dois ficar abaixo de 4.5, **não mexa no `--primary-foreground`** (é token do sistema): baixe a opacidade da lâmina em `--blade-on-primary` de `0.5` até passar, e anote o valor final no docblock do `button.tsx`.

- [ ] **Step 4: Critério 06 — a `/nexo` a 1600 × 1000 bate com a 11a**

Crie `scripts/shot-chanfro-nexo.mjs`:

```js
/**
 * O quadro do criterio 06: /nexo a 1600 x 1000, do mesmo tamanho da 11a do
 * "Nexo - Redesenho.dc.html", para comparar corte a corte lado a lado.
 * Nao gasta token.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL(/\/nexo/, { timeout: 30_000 }).catch(() => {});
}
await page.waitForLoadState("networkidle").catch(() => {});
await page.screenshot({ path: "chanfro-nexo-1600x1000.png" });
await browser.close();
console.log("chanfro-nexo-1600x1000.png");
```

Rode e compare com a 11a:

```
node scripts/shot-chanfro-nexo.mjs
```

Confira três coisas, nesta ordem: **os cortes** (todo canto superior esquerdo e inferior direito), **o peso do contorno** (1px, e a mesma cor de borda em toda superfície), **a tipografia** (nenhum Geist — tudo IBM Plex).

- [ ] **Step 5: Rodar a suíte de tipos e lint**

```
npx tsc --noEmit
npm run lint
npm run build
```

Esperado: os três limpos. O `build` importa porque o `@layer components` só é validado na compilação do Tailwind.

- [ ] **Step 6: Commit**

```bash
git add scripts/prova-chanfro.mjs scripts/shot-chanfro-nexo.mjs
git commit -m "prova: os sete criterios de aceite do chanfro, medidos e nao afirmados"
```

- [ ] **Step 7: Registrar as divergências na DESIGN.md**

`DESIGN.md` é a fonte única do sistema (em pt-BR). Duas coisas que ela ainda afirma e que deixaram de ser verdade: "8px é o único raio do sistema" e o ring de foco por `box-shadow`. Atualize as duas seções apontando para a spec, e registre as três exceções (campo tracejado do carimbo, formas redondas, controles do React Flow).

```bash
git add DESIGN.md
git commit -m "design: o raio unico vira chanfro unico, e o ring de foco muda de direcao"
```

---

## Ordem e paralelismo

As Tarefas 3, 5 e 6 são independentes entre si e todas dependem só da 1. A 2 e a 4 também dependem só da 1, mas mexem em arquivos que 7 e 8 consomem — faça 2 e 4 antes de 7 e 8. A 9 é a última, sempre.

```
1 ──┬── 2 ──┐
    ├── 3   ├── 7 ── 8 ── 9
    ├── 4 ──┤
    ├── 5   │
    └── 6 ──┘
```
