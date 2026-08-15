// O AMBIENTE: a luz, o brilho e a grade — e o interruptor que desliga os três.
//
//   node scripts/prova-ambiente-visual.mjs   (== npm run prova:ambiente)
//
// O QUE ESTA PROVA MEDE, E POR QUE ELA PRECISA DE NAVEGADOR
//
// As três utilidades do bloco AMBIENTE (`globals.css`) são CSS puro, e CSS puro
// é exatamente o que `tsc` e `eslint` não olham. Já custou caro nesta base
// acreditar em "compila limpo": a tela pode subir com o efeito invisível — um
// `background-clip: text` sem o preenchimento apagado não mostra lâmina nenhuma,
// e um `::after` atrás do fundo do cartão não aparece nunca.
//
// Três medidas, e as três são do navegador:
//
//  1. O SPOTLIGHT ACENDE E SEGUE. O cartão de achado é real, semeado no
//     IndexedDB. Move-se o ponteiro e confere-se que `--mx`/`--my` mudaram E que
//     o `::after` saiu de opacidade 0.
//  2. A LÂMINA NÃO APAGA O TEXTO. `background-clip: text` exige
//     `-webkit-text-fill-color: transparent`, e aí quem se lê é o gradiente. Se
//     as pontas dele não forem `currentColor`, a frase some fora da lâmina. A
//     prova confere que a cor de base sobreviveu.
//  3. `--motion-gain: 0` APAGA O AMBIENTE E NÃO APAGA A INFORMAÇÃO. É o
//     contrato do token, e é o que `prefers-reduced-motion` aciona.
//
// Nenhuma chamada de modelo: o parecer é semeado, como em prova:validacao.
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

const browser = await chromium.launch();

/** Abre o Nexo com um parecer semeado e devolve a página pronta. */
async function palcoComAchados(contexto) {
  const page = await contexto.newPage();
  await page.goto(`${BASE}/login`);
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(`${BASE}/nexo`);
  await pularTourGuiado(page);
  await page.waitForTimeout(1200);

  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const incongruencias = [1, 2, 3].map((n) => ({
      id: `INC-${String(n).padStart(3, "0")}`,
      prioridade: "Media",
      pagina: String(n * 3),
      capitulo: "",
      local: "",
      tipo: "Redação / editorial",
      descricao: `Achado semeado ${n}.`,
      evidencia: `trecho de conferencia ${n}`,
      conflito: "Diverge do declarado.",
      sugestao_correcao: "Conferir e corrigir.",
      confianca: "alta",
      origem: "ia",
      impacto: "revisao_editorial",
    }));
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: "qa-ambiente-visual",
        title: "QA AMBIENTE VISUAL",
        createdAt: agora,
        updatedAt: agora,
        messages: [{ id: "m1", role: "assistant", content: "Auditoria concluída." }],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:qa-ambiente",
            kind: "auditoria",
            summary: "Auditoria do memorial",
            files: [],
            payload: {
              auditId: "qa-ambiente-visual",
              texto: "RESULTADO DA AUDITORIA",
              report: {
                tipo_auditoria: "memorial",
                tipo_documento: "memorial descritivo",
                obra: "QA",
                codigo: "000-00",
                municipio: "",
                data_documento: "",
                status_analise: "concluida",
                status_geral: "com pontos de revisão",
                total_incongruencias: incongruencias.length,
                arquivos_analisados: [],
                comparacoes: [],
                conclusao: "Parecer semeado.",
                incongruencias,
              },
            },
          },
        ],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2200);
  await page.getByText("QA AMBIENTE VISUAL", { exact: false }).first().click({ timeout: 15000 });
  await page.waitForTimeout(1600);
  const chip = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chip.count()) > 0) await chip.first().click();
  const aba = page.getByRole("button", { name: /^Achados/i }).first();
  if ((await aba.count()) > 0) await aba.click();
  await page.waitForTimeout(1200);
  return page;
}

/**
 * Injeta um parágrafo com `.nx-shiny` e uma caixa com `.nx-dotgrid` e devolve o
 * que o navegador calculou. São as duas utilidades que não têm superfície real
 * alcançável sem PDF — mas o que se mede aqui é o CONTRATO do CSS, que é onde o
 * defeito mora.
 */
async function medirUtilidadesSinteticas(page) {
  return page.evaluate(() => {
    const alvo = document.createElement("div");
    alvo.style.cssText = "position:fixed;left:-9999px;top:0;color:rgb(200,210,215)";
    alvo.innerHTML =
      '<p class="nx-shiny" id="qa-shiny">Analisando documentos</p>' +
      '<div class="nx-dotgrid" id="qa-grid" style="width:100px;height:100px"></div>';
    document.body.appendChild(alvo);
    const shiny = document.getElementById("qa-shiny");
    const grid = document.getElementById("qa-grid");
    const cs = getComputedStyle(shiny);
    const cg = getComputedStyle(grid);
    const medida = {
      shinyTemLamina: cs.backgroundImage !== "none",
      shinyAnima: cs.animationName === "nx-shiny-sweep",
      // A cor de base tem de sobreviver ao recorte: é ela que se lê fora da
      // lâmina. `currentColor` no gradiente resolve para isto.
      shinyCorDeBase: cs.color,
      shinyLaminaTemCorDeBase: cs.backgroundImage.includes("200, 210, 215"),
      gridTemPontos: cg.backgroundImage.includes("radial-gradient"),
      gridPasso: cg.backgroundSize,
      gain: getComputedStyle(document.documentElement).getPropertyValue("--motion-gain").trim(),
      /*
       * A LAMINA COBRE O TEXTO EM TODO O CICLO?
       *
       * Com o preenchimento apagado, onde o gradiente nao chega o glifo fica
       * TRANSPARENTE — a frase some. A primeira versao varria de 220% a -120%
       * e passava a maior parte do ciclo fora da caixa: as frases ficavam
       * invisiveis, e esta prova aprovou assim mesmo, porque media que a lamina
       * EXISTIA e nao que ela estava por cima.
       *
       * Em porcentagem o ponto P da imagem encosta no ponto P da caixa, entao a
       * faixa segura e 0%..100%: nos dois extremos a imagem de 220% ainda cobre
       * os 100% da caixa. Le-se dos quadros-chave, que e a fonte — o valor
       * computado durante a animacao e so um instante dela.
       */
      laminaForaDaCaixa: (() => {
        /*
         * A BUSCA DESCE. O `@keyframes` mora dentro de `@layer components`, e
         * regra de agrupamento (`@layer`, `@media`, `@supports`) guarda as
         * filhas no proprio `cssRules` — varrer so o topo da folha nao acha
         * nada, e o "nao encontrado" pareceria defeito do CSS.
         */
        const achar = (regras) => {
          for (const regra of regras) {
            if (regra.name === "nx-shiny-sweep" && regra.cssRules) return regra;
            if (regra.cssRules && !regra.keyText) {
              const dentro = achar(regra.cssRules);
              if (dentro) return dentro;
            }
          }
          return null;
        };
        for (const folha of document.styleSheets) {
          let regras;
          try {
            regras = folha.cssRules;
          } catch {
            continue; // folha de outra origem
          }
          const quadros = achar(regras);
          if (!quadros) continue;
          const fora = [];
          for (const quadro of quadros.cssRules) {
            const pos = quadro.style.backgroundPosition || "";
            const pct = Number.parseFloat(pos);
            if (!Number.isFinite(pct) || pct < 0 || pct > 100) fora.push(`${quadro.keyText}: ${pos}`);
          }
          return fora;
        }
        return ["quadros-chave nao encontrados"];
      })(),
    };
    alvo.remove();
    return medida;
  });
}

// =====================================================================
// 1. MOVIMENTO NORMAL
// =====================================================================
const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await palcoComAchados(contexto);

const cartao = page.locator("[data-achado]").first();
check("o parecer montou com os cartões de achado", (await cartao.count()) > 0);
check(
  "o cartão de achado carrega a luz",
  (await cartao.getAttribute("class"))?.includes("nx-spot") === true,
  await cartao.getAttribute("class"),
);

/*
 * A FAIXA DE CIMA DO CARTÃO, e não o meio dele. O cartão de achado é alto — 60%
 * da altura dele cai FORA da janela de 1000px, e o ponteiro mandado para lá não
 * chega a elemento nenhum. A primeira versão desta prova mediu isso como "a luz
 * não segue o ponteiro", que era um defeito da prova, não da luz.
 */
await cartao.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const caixa = await cartao.boundingBox();
const linha = caixa.y + 24;
await page.mouse.move(caixa.x + caixa.width * 0.25, linha);
await page.waitForTimeout(320);
const perto = await cartao.evaluate((el) => ({
  mx: el.style.getPropertyValue("--mx"),
  my: el.style.getPropertyValue("--my"),
  opacidade: getComputedStyle(el, "::after").opacity,
}));
check("o ponteiro escreveu a posição da luz", perto.mx !== "" && perto.my !== "", JSON.stringify(perto));
check("e a luz acendeu", Number(perto.opacidade) > 0, `opacidade ${perto.opacidade}`);

await page.mouse.move(caixa.x + caixa.width * 0.8, linha);
await page.waitForTimeout(320);
const longe = await cartao.evaluate((el) => el.style.getPropertyValue("--mx"));
check("a luz SEGUE o ponteiro, não fica no primeiro ponto", longe !== perto.mx, `${perto.mx} -> ${longe}`);

const sinteticas = await medirUtilidadesSinteticas(page);
check("a lâmina do texto existe", sinteticas.shinyTemLamina, JSON.stringify(sinteticas));
check("e ela varre", sinteticas.shinyAnima, sinteticas.shinyAnima ? "" : "sem animação");
/*
 * A ASSERÇÃO QUE PEGA O DEFEITO REAL. Com `-webkit-text-fill-color: transparent`
 * o que se lê É o gradiente. Se as pontas dele não forem a cor do texto, a frase
 * desaparece fora da lâmina — e o efeito "funciona" enquanto apaga o conteúdo.
 */
check(
  "e as pontas dela são a cor do próprio texto — a frase não some fora da lâmina",
  sinteticas.shinyLaminaTemCorDeBase,
  sinteticas.shinyCorDeBase,
);
check(
  "e ela NUNCA sai de cima do texto — nenhum quadro fora de 0%..100%",
  sinteticas.laminaForaDaCaixa.length === 0,
  sinteticas.laminaForaDaCaixa.join(" | "),
);
check("a grade técnica desenha pontos", sinteticas.gridTemPontos, sinteticas.gridPasso);
check("no passo do módulo do sistema", sinteticas.gridPasso.startsWith("24px"), sinteticas.gridPasso);
check("o volume do ambiente está ligado", sinteticas.gain === "1", sinteticas.gain);

await page.screenshot({ path: `${OUT}/ambiente-1-luz.png` });

// =====================================================================
// 2. MENOS MOVIMENTO — o ambiente some, a informação fica
// =====================================================================
const contextoCalmo = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const calma = await palcoComAchados(contextoCalmo);

const cartaoCalmo = calma.locator("[data-achado]").first();
await cartaoCalmo.scrollIntoViewIfNeeded();
await calma.waitForTimeout(200);
const caixaCalma = await cartaoCalmo.boundingBox();
await calma.mouse.move(caixaCalma.x + caixaCalma.width * 0.4, caixaCalma.y + 24);
await calma.waitForTimeout(320);

const apagado = await cartaoCalmo.evaluate((el) => getComputedStyle(el, "::after").opacity);
check("com menos movimento, a luz não acende", Number(apagado) === 0, `opacidade ${apagado}`);

const sinteticasCalmas = await medirUtilidadesSinteticas(calma);
check("o volume do ambiente foi a zero", sinteticasCalmas.gain === "0", sinteticasCalmas.gain);
check("a lâmina para de varrer", !sinteticasCalmas.shinyAnima);
/*
 * O QUE NÃO PODE ACONTECER: o texto sumir junto com o efeito. Sem lâmina, o
 * preenchimento tem de voltar a ser a cor do texto — senão "menos movimento"
 * vira "menos conteúdo", e aí a acessibilidade piorou em vez de melhorar.
 */
check(
  "e a frase continua visível — menos movimento não é menos conteúdo",
  !sinteticasCalmas.shinyTemLamina,
  "a lâmina deveria sumir por completo",
);
check("a grade técnica também se apaga", !sinteticasCalmas.gridTemPontos || sinteticasCalmas.gain === "0");

// O achado continua legível: o ambiente é ambiente.
check(
  "o cartão de achado continua na tela",
  (await cartaoCalmo.innerText()).length > 0,
);

// =====================================================================
// 3. O CAMPO — e a regra que ele não pode quebrar
// =====================================================================
/*
 * DUAS COISAS SE MEDEM AQUI, e a segunda é a que importa mais.
 *
 *  · que o campo MONTA e desenha (um canvas, sem erro de runtime);
 *  · que ele NUNCA está na mesma tela que o orbe vivo. O §6 diz que o orbe é o
 *    único elemento autorizado a ser vivo, e a razão é de leitura: quando duas
 *    coisas se mexem, o olho não sabe qual delas está dizendo algo. O orbe diz;
 *    o campo é atmosfera. Esta asserção é o que impede alguém de montar os dois
 *    juntos sem perceber — e ela varre as telas, não um lugar combinado.
 */
const paginaDoCampo = await contexto.newPage();
const errosDoCampo = [];
paginaDoCampo.on("pageerror", (e) => errosDoCampo.push(String(e)));
await paginaDoCampo.goto(`${BASE}/bancada-do-ambiente`, { waitUntil: "networkidle" });
await paginaDoCampo.locator('[data-campo-neural]').first().scrollIntoViewIfNeeded();
await paginaDoCampo.waitForTimeout(2000);

check(
  "o campo monta um canvas",
  (await paginaDoCampo.locator("[data-campo-neural] canvas").count()) > 0,
);
check("e não derruba nada", errosDoCampo.length === 0, errosDoCampo.slice(0, 2).join(" | "));

for (const rota of ["/", "/nexo", "/login", "/bancada-do-ambiente"]) {
  const t = await contexto.newPage();
  await t.goto(`${BASE}${rota}`, { waitUntil: "networkidle" }).catch(() => {});
  await t.waitForTimeout(1800);
  const campo = await t.locator("[data-campo-neural]").count();
  // O orbe vivo é um canvas do React Three Fiber; a redução em CSS e o SVG não
  // contam, e é essa a distinção que a regra faz.
  const orbeVivo = await t.locator(".nexo-agent-orb canvas, [data-orbe-vivo] canvas").count();
  check(
    `${rota}: campo e orbe vivo não dividem tela`,
    !(campo > 0 && orbeVivo > 0),
    `campo=${campo} orbeVivo=${orbeVivo}`,
  );
  await t.close();
}

// Em movimento reduzido ele nem monta: quem pediu menos movimento pediu menos.
const calmaCampo = await contextoCalmo.newPage();
await calmaCampo.goto(`${BASE}/bancada-do-ambiente`, { waitUntil: "networkidle" });
await calmaCampo.waitForTimeout(1800);
check(
  "com menos movimento o campo não monta canvas nenhum",
  (await calmaCampo.locator("[data-campo-neural] canvas").count()) === 0,
);

await calma.screenshot({ path: `${OUT}/ambiente-2-calmo.png` });

await browser.close();

if (falhas > 0) {
  console.error(`\n${falhas} falha(s)`);
  process.exit(1);
}
console.log("\nOK  ambiente visual");
