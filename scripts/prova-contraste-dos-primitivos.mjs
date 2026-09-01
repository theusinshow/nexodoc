// O CONTRASTE DOS PRIMITIVOS, MEDIDO — e não olhado.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-contraste-dos-primitivos.mjs
//   (== npm run prova:contraste)
//
// `DESIGN.md:431` fixa o número: texto ≥ 4,5:1. Ele estava escrito e ninguém o
// media — e é assim que um botão desabilitado vira ilegível sem ninguém notar.
//
// USA A BANCADA DO CHANFRO, que já monta os primitivos. Montar uma página só
// para a prova criaria uma segunda verdade sobre como os componentes são usados.
//
// O QUE ESTA PROVA NÃO FAZ: ver o popup nativo do `<select>`. Ele é desenhado
// fora da página e o Playwright não o alcança. A verificação daquela superfície
// é manual, e está impressa no fim deste arquivo.
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
async function medir(seletor, rotulo) {
  const pares = await pg.evaluate((sel) => {
    const todos = [...document.querySelectorAll(sel)];
    if (todos.length === 0) return null;

    /*
     * OPACO = alfa 1, em QUALQUER espaço de cor.
     *
     * O primeiro alvo a cair aqui foi o Badge: fundo `oklab(… / 0.08)`, teal a
     * 8%. Uma checagem que só recusasse `transparent` e `rgba(…, 0)` aceitaria
     * esse valor como fundo — e ele não é: 8% de tinta deixa passar 92% do que
     * está atrás. Medir contra ele daria um número que ninguém enxerga.
     *
     * Duas formas de alfa no CSS moderno: o quarto argumento de `rgba(…)` e a
     * barra de `oklab(l a b / α)`. As duas são recusadas quando α < 1, e a
     * subida continua até a primeira superfície que realmente tapa o fundo.
     */
    const opaco = (c) => {
      if (!c || c === "transparent") return false;
      const barra = /\/\s*([\d.]+%?)\s*\)/.exec(c);
      if (barra) {
        const v = barra[1].endsWith("%") ? Number(barra[1].slice(0, -1)) / 100 : Number(barra[1]);
        return v >= 1;
      }
      const virgula = /rgba\(\s*[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+[\s,]+([\d.]+)\s*\)/.exec(c);
      if (virgula) return Number(virgula[1]) >= 1;
      return true;
    };
    return todos.map((el) => {
      let fundo = null;
      for (let no = el; no; no = no.parentElement) {
        const bg = getComputedStyle(no).backgroundColor;
        if (opaco(bg)) {
          fundo = bg;
          break;
        }
      }
      return { texto: getComputedStyle(el).color, fundo, rotulo: (el.textContent ?? "").trim() };
    });
  }, seletor);

  if (!pares) {
    check(`${rotulo} — existe na bancada`, false, seletor);
    return null;
  }

  return pares.map((p) => ({ ...p, razao: contraste(p.texto, p.fundo ?? "") }));
}

/*
 * OS PRIMITIVOS QUE A BANCADA MONTA — conferido em 01/09/2026:
 * 7 Button, 2 Badge, 2 Chip, 1 Input, 1 Textarea.
 *
 * `Select` NÃO está aqui porque a bancada não o monta. Medi-lo exigiria uma
 * página só para a prova, e isso criaria uma segunda verdade sobre como os
 * componentes são usados. É também o primitivo cuja superfície crítica é o
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

/*
 * TODAS AS INSTÂNCIAS, não a primeira.
 *
 * A bancada monta 7 Button, e eles diferem: `ghost` não tem fundo, `destructive`
 * inverte a tinta. Medir só `querySelector` daria uma linha verde e deixaria
 * passar exatamente a variante quebrada — que é o único motivo de a prova
 * existir. O pior número de cada primitivo é o que vale.
 *
 * A MARGEM MAIS FINA DA CASA, medida em 01/09/2026: o botão primário OCUPADO
 * ("Gerando") escurece o teal de `#00a693` para `#00877a` e cai a **4,53:1** —
 * dentro da régua por 0,03. Não é defeito e não foi mexido; é aviso de que
 * escurecer mais aquele teal reprova aqui, e é bom que reprove.
 */
for (const [seletor, rotulo] of alvos) {
  const medidos = await medir(seletor, rotulo);
  if (!medidos) continue;

  const pior = medidos.reduce((a, b) => (b.razao < a.razao ? b : a));
  check(
    `${rotulo} (${medidos.length}×, pior ${pior.razao.toFixed(2)}:1) contra ${MINIMO}:1`,
    pior.razao >= MINIMO,
    `"${pior.rotulo.slice(0, 30)}" — texto ${pior.texto} sobre ${pior.fundo}`,
  );
}

/*
 * O DESABILITADO tem régua PRÓPRIA. `DESIGN.md:926`: "campo desabilitado cai a
 * 50%". Ele NÃO deve alcançar o contraste de texto ativo — se alcançasse, não
 * pareceria desabilitado. O que se confere é que está abaixo do normal e acima
 * de invisível.
 *
 * A BANCADA NÃO MONTA NENHUM DESABILITADO (conferido em 01/09/2026: zero
 * ocorrências de `disabled` no arquivo). Em vez de inventar uma página, a prova
 * DESABILITA um botão que já está lá — é o mesmo componente, no mesmo contexto,
 * no estado que interessa.
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

const esquema = await pg.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
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
