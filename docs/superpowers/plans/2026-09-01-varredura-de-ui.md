# Varredura de UI — plano de implementação

> **Para trabalhadores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendada) ou
> `superpowers:executing-plans` para executar tarefa a tarefa. Os passos usam
> caixa (`- [ ]`) para acompanhamento.

**Objetivo:** acabar com o texto claro sobre fundo claro nas superfícies nativas,
e transformar contraste e cor crua em portão automatizado em vez de olho.

**Arquitetura:** o documento passa a declarar `color-scheme: dark`; a regra do
popup deixa de depender de `var()` e ganha um fiscal que impede o literal de
divergir do token; o medidor de dívida que já existe passa a ver cor; e uma prova
nova lê as cores computadas dos primitivos e reprova o que não alcançar 4,5:1.

**Stack:** Next.js 15, React 19, Tailwind v4 com tokens em `app/globals.css`,
TypeScript, Playwright. Testes puros em **node cru** (`node scripts/x.ts`).

**Spec:** `docs/superpowers/specs/2026-09-01-varredura-de-ui-design.md`

## Restrições globais

- **pt-BR em tudo que é visível e em todo comentário de código.**
- **Núcleo puro não importa o alias `@/`** — sem ele o arquivo não roda sob o
  type-stripping do node cru. Em `scripts/*.ts`, caminho relativo com `.ts`.
- **Script que importa `@/` roda com o hook:**
  `node --import ./scripts/lib/resolver-de-imports.mjs <script>`.
- **Nenhuma cor nem token novo.** `DESIGN.md:283` cobra nome, trabalho declarado,
  entrada na tabela e `npm run prova:tokens` para admitir cor nova. Hex sem token
  vira **registro**, não vira token.
- **Os limites são os da casa:** `DESIGN.md:431` fixa texto **≥ 4,5:1**;
  `DESIGN.md:926` fixa campo desabilitado a **50%**.
- **Não redesenhar componente nenhum.** Contraste e estado, não forma.
- **NENHUMA PROVA PODE ALEGAR TER VISTO O POPUP NATIVO DO `<select>`.** Ele é
  desenhado fora da página e o Playwright não o alcança. A confirmação é manual,
  pelo Matheus, e está declarada como manual na Task 6.
- **Commit direto na `main`.** `git add` com caminhos explícitos, conferindo com
  `git diff --cached --stat`.
- **Nenhuma tarefa gasta token de IA.**

## Mapa dos arquivos

**Criados**

| Arquivo | Responsabilidade |
|---|---|
| `lib/contraste.ts` | Puro. `contraste(a, b)` e `luminancia(cor)`. |
| `scripts/test-contraste.ts` | Teste puro da fórmula. |
| `scripts/prova-contraste-dos-primitivos.mjs` | Lê as cores computadas de cada estado e compara com 4,5:1. |

**Modificados**

| Arquivo | O quê |
|---|---|
| `app/globals.css` | `color-scheme: dark` no `:root`; a regra do popup em literal, com `optgroup`. |
| `scripts/prova-tokens-documentados.mjs` | Passa a conferir que o literal do popup não diverge do token. |
| `scripts/mede-divida-de-design.ts` | Passa a ver hex cru; o alcance cresce dos 5 frames para `components/` e `modules/nexo/components/`. |
| `package.json` | Um script novo. |
| Arquivos que o medidor acusar | Task 5 — a lista sai da medição, não do palpite. |

---

### Task 1: a razão de contraste, em node cru

**Files:**
- Criar: `lib/contraste.ts`
- Criar: `scripts/test-contraste.ts`
- Modificar: `package.json`

**Interfaces:**
- Consome: nada. É núcleo, sem imports.
- Produz:
  - `type RGB = { r: number; g: number; b: number }`
  - `lerCor(valor: string): RGB | null` — aceita `#rgb`, `#rrggbb`, `rgb(a,b,c)` e `rgba(a,b,c,d)`
  - `luminancia(cor: RGB): number`
  - `contraste(a: string, b: string): number` — devolve `0` quando alguma cor não é legível

- [ ] **Passo 1: escrever o teste que falha**

Criar `scripts/test-contraste.ts`:

```ts
/**
 * A RAZÃO DE CONTRASTE, pela fórmula da WCAG. Puro → node cru.
 *
 *   node scripts/test-contraste.ts   (== npm run test:contraste)
 */
import assert from "node:assert/strict";

import { contraste, lerCor, luminancia } from "../lib/contraste.ts";

let passed = 0;
function test(nome: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${nome}`);
}

/** Duas casas bastam: a régua é 4,5 e ninguém decide nada no terceiro decimal. */
const perto = (a: number, b: number) => Math.abs(a - b) < 0.01;

console.log("contraste\n");

test("branco sobre preto é 21:1 — o teto da escala", () => {
  assert.ok(perto(contraste("#ffffff", "#000000"), 21));
});

test("a mesma cor contra ela mesma é 1:1", () => {
  assert.ok(perto(contraste("#121518", "#121518"), 1));
});

test("a ordem não muda o resultado", () => {
  const a = contraste("#e1e7ea", "#121518");
  const b = contraste("#121518", "#e1e7ea");
  assert.ok(perto(a, b), `${a} != ${b}`);
});

test("o texto do produto sobre o cartão passa de 4,5:1", () => {
  // --foreground #e1e7ea sobre --card #121518. É o par mais comum da tela, e se
  // ELE não passasse, a régua estaria errada e não o produto.
  assert.ok(contraste("#e1e7ea", "#121518") > 4.5);
});

test("lê hex de 3 e de 6 dígitos como a mesma cor", () => {
  assert.deepEqual(lerCor("#fff"), { r: 255, g: 255, b: 255 });
  assert.deepEqual(lerCor("#ffffff"), { r: 255, g: 255, b: 255 });
});

test("lê o que o navegador devolve: rgb() e rgba()", () => {
  /*
   * `getComputedStyle` nunca devolve hex — devolve `rgb(18, 21, 24)`. Uma régua
   * que só lesse hex passaria verde sem medir nada, porque `lerCor` devolveria
   * null e o contraste cairia em zero... que reprova. Pior: o contrário, se
   * alguém "consertasse" o zero para 21.
   */
  assert.deepEqual(lerCor("rgb(18, 21, 24)"), { r: 18, g: 21, b: 24 });
  assert.deepEqual(lerCor("rgba(18, 21, 24, 0.5)"), { r: 18, g: 21, b: 24 });
});

test("cor ilegível devolve ZERO, e zero reprova", () => {
  /*
   * Nunca 21. Um valor que a régua não entende tem de FALHAR a checagem, não
   * passar por ela — senão a prova fica verde exatamente onde ela deixou de
   * medir.
   */
  assert.equal(contraste("transparent", "#000000"), 0);
  assert.equal(contraste("var(--card)", "#000000"), 0);
  assert.equal(lerCor("transparent"), null);
});

test("a luminância do preto é 0 e a do branco é 1", () => {
  assert.ok(perto(luminancia({ r: 0, g: 0, b: 0 }), 0));
  assert.ok(perto(luminancia({ r: 255, g: 255, b: 255 }), 1));
});

console.log(`\n${passed} passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

```bash
node scripts/test-contraste.ts
```

Esperado: FALHA com `Cannot find module '.../lib/contraste.ts'`.

- [ ] **Passo 3: escrever a implementação**

Criar `lib/contraste.ts`:

```ts
/**
 * A RAZÃO DE CONTRASTE entre duas cores, pela fórmula da WCAG.
 *
 * Existe para a régua do §4 da DESIGN.md ("contraste: texto ≥4,5:1") deixar de
 * ser uma frase e virar portão. Olhar uma captura e achar que está bom é
 * exatamente como um botão desabilitado vira ilegível sem ninguém notar.
 *
 * PURO e sem imports → roda em node cru (`npm run test:contraste`).
 */

export type RGB = { r: number; g: number; b: number };

/**
 * Aceita o que o CSS escreve E o que o navegador devolve.
 *
 * `getComputedStyle` nunca devolve hex: devolve `rgb(18, 21, 24)`. Uma régua que
 * só lesse hex nunca mediria nada vindo do navegador — que é justamente de onde
 * vêm os valores que importam.
 *
 * O ALFA É DESCARTADO, de propósito: medir cor translúcida exigiria saber o que
 * está atrás dela, e a prova mede pares que ela já conhece. Uma cor com alfa que
 * precise ser medida é sinal de que o par certo é outro.
 */
export function lerCor(valor: string): RGB | null {
  const texto = (valor ?? "").trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(texto);
  if (hex) {
    const d = hex[1];
    const par = (i: number) =>
      d.length === 3
        ? parseInt(d[i] + d[i], 16)
        : parseInt(d.slice(i * 2, i * 2 + 2), 16);

    return { r: par(0), g: par(1), b: par(2) };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(texto);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

/** Luminância relativa: 0 no preto, 1 no branco. */
export function luminancia(cor: RGB): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * canal(cor.r) + 0.7152 * canal(cor.g) + 0.0722 * canal(cor.b);
}

/**
 * A razão entre duas cores. De 1 (iguais) a 21 (branco e preto).
 *
 * ZERO QUANDO NÃO DÁ PARA LER alguma das duas — e zero reprova qualquer régua.
 * O contrário (devolver 21, ou pular a checagem) deixaria a prova verde
 * exatamente onde ela parou de medir, que é o pior desfecho possível para uma
 * ferramenta que existe para vigiar.
 */
export function contraste(a: string, b: string): number {
  const ca = lerCor(a);
  const cb = lerCor(b);

  if (!ca || !cb) return 0;

  const la = luminancia(ca);
  const lb = luminancia(cb);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);

  return (claro + 0.05) / (escuro + 0.05);
}
```

- [ ] **Passo 4: rodar e ver passar**

```bash
node scripts/test-contraste.ts
```

Esperado: 8 linhas `ok` e `8 passaram`.

- [ ] **Passo 5: registrar o script**

Em `package.json`, dentro de `"scripts"`, depois de `"test:atencao-painel"`:

```json
"test:contraste": "node scripts/test-contraste.ts",
```

- [ ] **Passo 6: commit**

```bash
git add lib/contraste.ts scripts/test-contraste.ts package.json
git diff --cached --stat
git commit -m "o contraste vira número: a régua do §4 ganha aritmética"
```

---

### Task 2: o documento declara que é escuro

**Files:**
- Modificar: `app/globals.css`

**Interfaces:**
- Consome: nada.
- Produz: `:root { color-scheme: dark }` e a regra do popup em literal.

- [ ] **Passo 1: declarar o esquema no `:root`**

Em `app/globals.css`, dentro do bloco `:root {` (por volta da linha 65), como
**primeira** declaração:

```css
  /*
   * O PRODUTO É ESCURO, e agora o navegador sabe.
   *
   * Havia UM lugar declarando isso: o `style` inline do primitivo `Select`, para
   * si mesmo. Medido em 01/09/2026, `getComputedStyle(document.documentElement)
   * .colorScheme` devolvia "normal" — e toda superfície nativa que este CSS não
   * pinta era desenhada CLARA, herdando o texto claro da página. Popup de
   * `<datalist>`, barra de rolagem, preenchimento automático, as setas de
   * `type="number"`, o seletor de `type="color"` e o botão de `type="file"`.
   *
   * O comentário do `Select` adiava esta linha dizendo que ela "mexeria também
   * em barra de rolagem e em todo controle nativo". Mexe — e é o efeito
   * pretendido: um app escuro com barra de rolagem clara é o defeito, não o
   * cuidado. Decidido com o Matheus em 01/09/2026, sabendo disso.
   *
   * Há UM `:root` neste arquivo, sem tema claro e sem `prefers-color-scheme`.
   * Declarar o esquema é dizer a verdade que o CSS já pratica.
   */
  color-scheme: dark;
```

- [ ] **Passo 2: a regra do popup para de depender de `var()`**

Substituir o bloco que hoje é:

```css
select option {
  background-color: var(--card);
  color: var(--foreground);
}
```

por:

```css
/* LITERAL, E NÃO `var()` — e o motivo tem precedente escrito neste projeto.
   `lib/aviso-de-achados.ts` declara a paleta do e-mail em hex cru porque
   "cliente de e-mail não resolve var(), e um token que chegasse cru pintaria
   texto de preto sobre preto". O popup do select é a mesma classe de problema:
   uma superfície que o app NÃO POSSUI. Se ela não resolver a variável,
   `background-color` cai para o claro padrão enquanto `color` segue herdando o
   claro da página — que é exatamente o branco-sobre-branco relatado.

   Os dois valores são `--card` (#121518) e `--foreground` (#e1e7ea), e eles NÃO
   PODEM divergir em silêncio: `npm run prova:tokens` confere que o hex escrito
   aqui é o mesmo do token.

   `optgroup` entra junto. A regra anterior era só `select option`, e o seletor
   de destinatário do parecer (`audit-result.tsx`) agrupa por disciplina — o
   rótulo do grupo ficava de fora e caía no padrão do navegador. */
select option,
select optgroup {
  background-color: #121518;
  color: #e1e7ea;
}
```

- [ ] **Passo 3: provar que o documento mudou**

Com o `next dev` de pé, criar `scratchpad/qa-esquema.mjs`:

```js
import { chromium } from "playwright";
const b = await chromium.launch();
const pg = await (await b.newContext({ baseURL: "http://localhost:3000" })).newPage();
await pg.goto("/login", { waitUntil: "networkidle" });
console.log("colorScheme do documento:", await pg.evaluate(
  () => getComputedStyle(document.documentElement).colorScheme,
));
await b.close();
```

```bash
node scratchpad/qa-esquema.mjs
```

Esperado: `colorScheme do documento: dark`. Antes desta tarefa era `normal`.
Apague o script depois — é rascunho.

- [ ] **Passo 4: as provas visuais que já existem continuam passando**

```bash
npm run prova:tokens
npm run prova:home
```

Esperado: as duas verdes. A `prova:home` mede px e cores da home — se o esquema
novo quebrasse alguma superfície própria do app, ela acusaria.

- [ ] **Passo 5: commit**

```bash
git add app/globals.css
git diff --cached --stat
git commit -m "o documento passa a dizer ao navegador que o produto é escuro"
```

---

### Task 3: o literal do popup não pode divergir do token

**Files:**
- Modificar: `scripts/prova-tokens-documentados.mjs`

**Interfaces:**
- Consome: a regra escrita na Task 2.
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: acrescentar o fiscal**

Em `scripts/prova-tokens-documentados.mjs`, antes do desfecho que decide o código
de saída, acrescentar:

```js
/*
 * O LITERAL DO POPUP CONTRA O TOKEN.
 *
 * A regra `select option, select optgroup` usa hex cru de propósito (o popup é
 * superfície que o app não possui e pode não resolver `var()`). O preço de um
 * literal é ele envelhecer calado: mudar `--card` no `:root` e deixar o popup no
 * valor velho não quebra nada visível AQUI — quebra lá dentro, na única
 * superfície que ninguém consegue fotografar.
 *
 * Este fiscal é o que paga esse preço.
 */
const css = readFileSync("app/globals.css", "utf8");

function valorDoToken(nome) {
  const m = new RegExp(`--${nome}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`).exec(css);
  return m ? m[1].toLowerCase() : null;
}

const regraDoPopup = /select option,\s*select optgroup\s*\{([^}]*)\}/.exec(css);

if (!regraDoPopup) {
  console.error(
    "\nFALHOU  a regra `select option, select optgroup` sumiu de globals.css.\n" +
      "        Ela é a segunda defesa contra o branco-sobre-branco do popup.",
  );
  process.exitCode = 1;
} else {
  const corpo = regraDoPopup[1];
  const fundo = /background-color:\s*(#[0-9a-fA-F]{3,8})/.exec(corpo)?.[1]?.toLowerCase();
  const texto = /(?<!-)color:\s*(#[0-9a-fA-F]{3,8})/.exec(corpo)?.[1]?.toLowerCase();
  const card = valorDoToken("card");
  const fg = valorDoToken("foreground");

  if (fundo !== card) {
    console.error(
      `\nFALHOU  o popup do select pinta ${fundo}, e --card é ${card}.\n` +
        "        O literal envelheceu. Ver o comentário da regra em globals.css.",
    );
    process.exitCode = 1;
  }
  if (texto !== fg) {
    console.error(
      `\nFALHOU  o texto do popup é ${texto}, e --foreground é ${fg}.\n` +
        "        O literal envelheceu. Ver o comentário da regra em globals.css.",
    );
    process.exitCode = 1;
  }
  if (fundo === card && texto === fg) {
    console.log(`\nOK  o literal do popup do select bate com os tokens (${card} / ${fg})`);
  }
}
```

Se `readFileSync` já estiver importado no topo do arquivo, não duplique o import.

- [ ] **Passo 2: rodar e ver passar**

```bash
npm run prova:tokens
```

Esperado: a saída de sempre mais
`OK  o literal do popup do select bate com os tokens (#121518 / #e1e7ea)`.

- [ ] **Passo 3: provar que o fiscal REPROVA quando deve**

Um fiscal que nunca acusou não se sabe se funciona. Estrague o literal de
propósito e confirme que ele pega:

```bash
sed -i 's/  background-color: #121518;/  background-color: #123456;/' app/globals.css
npm run prova:tokens; echo "código de saída: $?"
```

Esperado: `FALHOU  o popup do select pinta #123456, e --card é #121518.` e código
de saída `1`.

Desfaça:

```bash
sed -i 's/  background-color: #123456;/  background-color: #121518;/' app/globals.css
npm run prova:tokens; echo "código de saída: $?"
```

Esperado: verde e código `0`. Confirme com `git diff app/globals.css` que o
arquivo voltou ao que era.

- [ ] **Passo 4: commit**

```bash
git add scripts/prova-tokens-documentados.mjs
git diff --cached --stat
git commit -m "o literal do popup ganha fiscal: envelhecer calado sai caro numa superfície que ninguém vê"
```

---

### Task 4: o medidor de dívida passa a ver cor

**Files:**
- Modificar: `scripts/mede-divida-de-design.ts`

**Interfaces:**
- Consome: nada de tarefas anteriores.
- Produz: `npm run mede:divida` acusa hex cru em arquivo de UI.

- [ ] **Passo 1: trocar a lista fixa por uma varredura com exclusões**

Em `scripts/mede-divida-de-design.ts`, substituir a constante `ARQUIVOS` por uma
varredura de diretório:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * ONDE OLHAR. Cresceu dos cinco frames para a UI inteira quando a regra de cor
 * entrou: hex cru num frame não é mais nem menos dívida que hex cru num botão.
 */
const RAIZES = ["components", "modules/nexo/components"];

/**
 * ONDE NÃO OLHAR — e cada exclusão tem motivo, não conveniência.
 *
 *   brand/       a marca. Cor ali é a identidade, não estilo. Um token no lugar
 *                do hex do logotipo trocaria a marca por uma variável de tema.
 *   agent-orb/   WebGL. Cor é DADO que vai para o shader, não classe de CSS.
 *   bancada-     bancadas de afinação. Elas existem para experimentar valor cru;
 *                um fiscal ali proibiria exatamente o que a tela é.
 *
 * Acrescentar exclusão exige escrever o motivo AQUI. Sem isso, a lista vira o
 * lugar onde a regra é afrouxada em silêncio.
 */
const FORA = ["/brand/", "/agent-orb/", "/bancada-"];

function arquivosDeUi(raiz: string, achados: string[] = []): string[] {
  for (const item of readdirSync(raiz, { withFileTypes: true })) {
    const caminho = join(raiz, item.name).replace(/\\/g, "/");
    if (item.isDirectory()) arquivosDeUi(caminho, achados);
    else if (caminho.endsWith(".tsx") && !FORA.some((f) => caminho.includes(f))) {
      achados.push(caminho);
    }
  }
  return achados;
}

const ARQUIVOS = RAIZES.flatMap((r) => arquivosDeUi(r)).sort();
```

- [ ] **Passo 2: acrescentar a regra de cor**

Junto das outras duas expressões, no topo:

```ts
/**
 * Cor escrita à mão. O sistema tem token para tudo que é vocabulário
 * (`DESIGN.md` §2), e um hex solto é uma cor que não passou pelo portão do §12 —
 * não tem nome, não tem trabalho declarado, e não aparece em nenhuma busca por
 * onde aquela cor é usada.
 */
const COR_CRUA = /#[0-9a-fA-F]{3,8}\b/g;
```

E, dentro do `forEach` das linhas, junto dos outros dois laços:

```ts
    for (const m of codigo.matchAll(COR_CRUA)) {
      achados.push({ arquivo, linha: i + 1, regra: "cor crua, use o token", trecho: m[0] });
    }
```

- [ ] **Passo 3: o relatório para de listar cinco arquivos fixos**

O rodapé imprime uma linha por arquivo da lista antiga. Com dezenas de arquivos,
isso vira ruído. Substituir o laço de impressão por:

```ts
const curto = (a: string) => a.replace("modules/nexo/components/", "").replace("components/", "");
const porArquivo = new Map<string, number>();
for (const a of achados) porArquivo.set(a.arquivo, (porArquivo.get(a.arquivo) ?? 0) + 1);

console.log(`dívida de design em ${ARQUIVOS.length} arquivos de UI\n`);

/* SÓ QUEM TEM DÍVIDA. Listar os limpos gastaria a tela com o que está certo, e
 * é a lista de pendências que precisa caber de uma olhada. */
const comDivida = [...porArquivo.entries()].sort((a, b) => b[1] - a[1]);
for (const [arquivo, quantas] of comDivida) {
  console.log(`  ${String(quantas).padStart(3)}  ${curto(arquivo)}`);
}
console.log(`\n  ${achados.length} violação(ões) em ${comDivida.length} arquivo(s)`);
```

- [ ] **Passo 4: rodar e VER O NÚMERO**

```bash
npm run mede:divida
```

Esperado: uma contagem bem maior que as 2 violações de antes, e o comando saindo
com código 1. **Isso é o resultado correto desta tarefa** — o medidor passou a
enxergar o que não enxergava. Anote o número: ele é a linha de base da Task 5.

- [ ] **Passo 5: provar que as exclusões funcionam**

```bash
npm run mede:divida | grep -cE "logo-nexo|AgentOrbScene|bancada"
```

Esperado: `0`. Se algum deles aparecer, a exclusão não pegou — conserte antes de
seguir, senão a Task 5 vai "corrigir" a marca.

- [ ] **Passo 6: commit**

```bash
git add scripts/mede-divida-de-design.ts
git diff --cached --stat
git commit -m "o medidor de dívida passa a ver cor, e a marca fica de fora com motivo"
```

---

### Task 5: corrigir o que o medidor acusou

**Files:**
- Modificar: os arquivos que `npm run mede:divida` listar. **A lista sai da
  medição, não do palpite** — rode o comando antes de começar.

**Interfaces:**
- Consome: o medidor da Task 4.
- Produz: `npm run mede:divida` verde, ou uma lista escrita do que ficou e por quê.

- [ ] **Passo 1: tirar a lista do medidor**

```bash
npm run mede:divida > /tmp/divida.txt; cat /tmp/divida.txt
```

Trabalhe de cima para baixo — o relatório já ordena por quantidade.

- [ ] **Passo 2: para cada hex, achar o token que já existe**

```bash
grep -n "#121518\|#1a1e21\|#2c3338" app/globals.css
```

Troque o hex pela classe que usa o token. Exemplo real do padrão que o
repositório já usa:

```tsx
// antes
className="bg-[#0f2d2a] text-[var(--nexodoc-accent)]"

// depois — quando existir token para o fundo
className="bg-[var(--nexodoc-panel)] text-[var(--nexodoc-accent)]"
```

- [ ] **Passo 3: hex SEM token vira registro, e não token novo**

`DESIGN.md:283` cobra nome, trabalho declarado, consumidor na tabela e
`npm run prova:tokens` para admitir cor nova. Criar token aqui seria passar por
cima desse portão no meio de uma varredura.

Para cada hex sem token correspondente, deixe-o onde está e acrescente **na
linha acima** um comentário no formato:

```tsx
{/* COR SEM TOKEN: #0f2d2a, o fundo do realce "achado seu". Não vira token nesta
    varredura — DESIGN.md:283 cobra nome, trabalho declarado e consumidor na
    tabela, e isso é decisão do design system, não de uma passagem de limpeza. */}
```

E acrescente o arquivo à lista `FORA` **não** — a exclusão é para categorias, não
para casos. Em vez disso, registre-os todos juntos no fim desta tarefa (Passo 5).

- [ ] **Passo 4: rodar o medidor de novo**

```bash
npm run mede:divida
```

Esperado: o número baixou. O que sobrou são os casos do Passo 3.

- [ ] **Passo 5: escrever o que ficou, e por quê**

Criar `docs/cores-sem-token.md`:

```markdown
# Cores sem token

Levantadas na varredura de UI de 01/09/2026 (`npm run mede:divida`).

Cada uma destas é hex cru que **não tem token correspondente** em
`app/globals.css`. Elas não viraram token na varredura de propósito:
`DESIGN.md:283` cobra nome, trabalho declarado, consumidor nomeado na tabela do
§2 e `npm run prova:tokens` para admitir cor nova — e isso é decisão do design
system, não de uma passagem de limpeza.

| Cor | Onde | O que ela faz |
|---|---|---|
```

Preencha a tabela com o que sobrou. Uma linha por cor, dizendo **o trabalho** que
ela faz — que é justamente o que o §12 vai pedir no dia em que ela virar token.

- [ ] **Passo 6: conferir que nada visual quebrou**

```bash
npx tsc --noEmit
npm run lint
npm run prova:home
npm run prova:tokens
```

Esperado: tudo verde.

- [ ] **Passo 7: commit**

```bash
git add -u components modules docs/cores-sem-token.md
git diff --cached --stat
git commit -m "as cores cruas viram token, e as que não têm token viram lista escrita"
```

---

### Task 6: o contraste dos primitivos, medido

**Files:**
- Criar: `scripts/prova-contraste-dos-primitivos.mjs`
- Modificar: `package.json`

**Interfaces:**
- Consome: `contraste` de `lib/contraste.ts` (Task 1).
- Produz: nada para tarefas seguintes.

- [ ] **Passo 1: escrever a prova**

Criar `scripts/prova-contraste-dos-primitivos.mjs`:

```js
// O CONTRASTE DOS PRIMITIVOS, MEDIDO — e não olhado.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-contraste-dos-primitivos.mjs
//   (== npm run prova:contraste)
//
// `DESIGN.md:431` fixa o número: texto ≥ 4,5:1. Ele estava escrito e ninguém o
// media — e é assim que um botão desabilitado vira ilegível sem ninguém notar.
//
// USA A BANCADA DO CHANFRO, que já monta os primitivos em todas as variantes.
// Montar uma página só para a prova criaria uma segunda verdade sobre como os
// componentes são usados.
//
// O QUE ESTA PROVA NÃO FAZ: ver o popup nativo do `<select>`. Ele é desenhado
// fora da página e o Playwright não o alcança. A verificação daquela superfície
// é manual, e está no fim deste arquivo como instrução impressa.
import { chromium } from "playwright";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { contraste } = await import("../lib/contraste.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
/** `DESIGN.md:431` — "contraste: texto ≥4,5:1". O número é da casa. */
const MINIMO = 4.5;

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1400 } });
const pg = await ctx.newPage();
await pg.goto("/bancada-do-chanfro", { waitUntil: "networkidle" });
await pg.waitForTimeout(2500);

/*
 * O FUNDO EFETIVO, subindo a árvore.
 *
 * Um botão `ghost` tem `background-color: transparent` — medir contra ele daria
 * a razão 1:1 e reprovaria um controle correto. O que vale é a primeira
 * superfície OPACA acima dele, que é o que o olho vê atrás do texto.
 */
async function medir(pg, seletor, rotulo) {
  const par = await pg.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;

    const opaco = (c) => c && c !== "transparent" && !/rgba\([^)]*,\s*0\s*\)/.test(c);
    let fundo = null;
    for (let no = el; no; no = no.parentElement) {
      const bg = getComputedStyle(no).backgroundColor;
      if (opaco(bg)) {
        fundo = bg;
        break;
      }
    }
    return { texto: getComputedStyle(el).color, fundo, opacidade: getComputedStyle(el).opacity };
  }, seletor);

  if (!par) {
    check(`${rotulo} — existe na bancada`, false, seletor);
    return null;
  }

  const razao = contraste(par.texto, par.fundo ?? "");
  return { ...par, razao };
}

/*
 * OS PRIMITIVOS QUE A BANCADA MONTA — conferido em 01/09/2026:
 * 7 Button, 2 Badge, 2 Chip, 1 Input, 1 Textarea.
 *
 * `Select` NÃO está aqui porque a bancada não o monta. Medi-lo exigiria uma
 * página só para a prova, e isso criaria uma segunda verdade sobre como os
 * componentes são usados. O `Select` é o primitivo cuja superfície crítica é o
 * popup — que nem essa página nova alcançaria.
 *
 * Todos têm `data-slot`, então o seletor é o do próprio primitivo e não uma
 * adivinhação de tag.
 */
const alvos = [
  ['[data-slot="button"]', "Button"],
  ['[data-slot="badge"]', "Badge"],
  ['[data-slot="chip"]', "Chip"],
  ['[data-slot="input"]', "Input"],
  ['[data-slot="textarea"]', "Textarea"],
];

for (const [seletor, rotulo] of alvos) {
  const m = await medir(pg, seletor, rotulo);
  if (!m) continue;
  check(
    `${rotulo}: ${m.razao.toFixed(2)}:1 contra ${MINIMO}:1`,
    m.razao >= MINIMO,
    `texto ${m.texto} sobre ${m.fundo}`,
  );
}

/*
 * O DESABILITADO tem régua PRÓPRIA. `DESIGN.md:926`: "campo desabilitado cai a
 * 50%". Ele NÃO deve alcançar o contraste de texto ativo — se alcançasse, não
 * pareceria desabilitado. O que se confere é que ele está abaixo do normal e
 * acima de invisível.
 *
 * A BANCADA NÃO MONTA NENHUM DESABILITADO (conferido em 01/09/2026: zero
 * ocorrências de `disabled` no arquivo). Em vez de inventar uma página, a prova
 * DESABILITA um botão que já está lá e mede o resultado — é o mesmo componente,
 * no mesmo contexto, no estado que interessa.
 */
const desabilitado = await pg.evaluate(() => {
  const el = document.querySelector('[data-slot="button"]');
  if (!el) return null;
  el.setAttribute("disabled", "");
  return getComputedStyle(el).opacity;
});
check(
  `desabilitado entre 40% e 60%, e não invisível (${desabilitado})`,
  desabilitado !== null && Number(desabilitado) >= 0.4 && Number(desabilitado) <= 0.6,
  String(desabilitado),
);

const esquema = await pg.evaluate(
  () => getComputedStyle(document.documentElement).colorScheme,
);
check("o documento declara color-scheme: dark", esquema === "dark", esquema);

await navegador.close();

console.log(
  "\nA CONFERIR À MÃO — a automação não alcança:\n" +
    "  abra uma lista de <select> (o seletor de destinatário do parecer serve)\n" +
    "  e confirme que o popup está ESCURO. O Playwright não fotografa essa\n" +
    "  superfície; ela é desenhada fora da página.",
);

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
```

- [ ] **Passo 2: confirmar o que a bancada monta**

```bash
grep -oE "<(Button|Badge|Chip|Input|Select|Textarea)" app/bancada-do-chanfro/page.tsx | sort | uniq -c
```

Esperado, conferido em 01/09/2026:

```
  2 <Badge
  7 <Button
  2 <Chip
  1 <Input
  1 <Textarea
```

**Nenhum `<Select>`** — por isso ele não está na lista `alvos`. Se a saída
divergir disto, ajuste a lista para o que a bancada realmente monta, em vez de
criar uma página só para a prova.

- [ ] **Passo 3: rodar a prova**

Com o `next dev` de pé:

```bash
node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-contraste-dos-primitivos.mjs
```

Esperado: uma linha por primitivo com a razão medida, a checagem do desabilitado,
a do `color-scheme`, e a instrução manual impressa no fim.

**Se algum primitivo reprovar, NÃO afrouxe o mínimo.** 4,5 é o número da
`DESIGN.md`. Ou o par de cores está errado (e é isso que a prova existe para
achar), ou o seletor está medindo o elemento errado — confira o segundo antes de
concluir o primeiro.

- [ ] **Passo 4: registrar o script**

Em `package.json`, depois de `"prova:home"`:

```json
"prova:contraste": "node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-contraste-dos-primitivos.mjs",
```

- [ ] **Passo 5: rodar tudo o que este trabalho tocou**

```bash
npm run test:contraste && npm run prova:tokens && npm run mede:divida \
  && npm run prova:contraste && npm run prova:home \
  && npm run lint && npx tsc --noEmit
```

Esperado: tudo verde. **`npm run prova:fila` e `npm run prova:barra` já estavam
quebrados antes desta frente** e não entram na lista — ver o registro em
`docs/superpowers/plans/2026-09-01-multiplayer-dos-achados.md`.

- [ ] **Passo 6: commit**

```bash
git add scripts/prova-contraste-dos-primitivos.mjs package.json
git diff --cached --stat
git commit -m "o contraste dos primitivos deixa de ser opinião"
```

- [ ] **Passo 7: pedir a conferência que só uma pessoa pode fazer**

Diga ao Matheus, com estas palavras:

> Abra qualquer lista suspensa de `<select>` — o seletor de destinatário do
> parecer serve — e me diga se o popup está escuro. É a única coisa deste
> trabalho que eu não consigo ver: essa superfície é desenhada fora da página e
> nenhuma automação a alcança.

---

## O que este plano deixa de propósito para depois

- **Criar token para as cores sem token.** Elas viram `docs/cores-sem-token.md`.
  Admitir cor nova passa pelo portão do `DESIGN.md:283`, e isso é decisão do
  design system.
- **A marca, o WebGL e as bancadas.** Cor ali é conteúdo, e a exclusão está
  escrita com motivo dentro do medidor.
- **Redesenhar componente.** Contraste e estado, não forma.
- **`prova:fila` e `prova:barra`.** Quebrados antes desta sessão, por mudanças de
  UI anteriores. São outra frente.
