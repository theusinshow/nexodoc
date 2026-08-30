// A transição do painel para o Nexo — prova de FLUIDEZ, sem gastar um token.
//
// Esta prova nasceu de uma reclamação que nenhuma asserção de DOM pegaria: a
// transição "estava travada". Nada estava quebrado — o painel apagava, o Nexo
// chegava, os testes passavam. O que faltava era medir o tempo, e não o estado.
//
// O que ela mede, e por que assim:
//
//  - QUADROS PERDIDOS entre o clique e a chegada. É a definição operacional de
//    "travado": o navegador não conseguiu pintar dentro do orçamento. Um quadro
//    a 60fps são 16,7ms; acima de 32ms já se perdeu pelo menos um, e é isso que
//    o olho lê como engasgo;
//  - o MAIOR BURACO, que é o congelamento único que a pessoa sente. Média não
//    serve aqui: 60 quadros bons e um de 400ms dão uma média ótima e uma
//    experiência ruim;
//  - QUANDO a casca do Nexo aparece. É o número que a primeira versão desta
//    transição errava — ela só PEDIA a rota depois de 240ms de animação, e os
//    dois tempos ficavam em fila em vez de correrem juntos.
//
// O TETO É DE DESENVOLVIMENTO, e generoso de propósito. Em `next dev` não há
// pré-carregamento de rota (o Next desliga `prefetch` em desenvolvimento) e o
// módulo do Nexo é compilado sob demanda na primeira visita — então o número
// medido aqui é o PIOR caso, não o que o usuário vê em produção. O portão existe
// para pegar regressão de estrutura (voltar a serializar a navegação, reacender
// o `backdrop-filter` durante a saída), não para cravar um número de produção.
//
// A MEDIÇÃO É POR DENTRO, com `requestAnimationFrame` na própria página. Medir
// de fora, pela extensão do navegador, não funciona: o mundo isolado onde o
// script roda perde os quadros agendados no instante da navegação, e o
// resultado volta vazio — o que parece "nada aconteceu" e não é.
//
//   node scripts/prova-partida-pelo-orbe.mjs   (== npm run prova:partida)
import { chromium } from "playwright";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";

/** Acima disto, pelo menos um quadro se perdeu (16,7ms é o orçamento a 60fps). */
const QUADRO_PERDIDO = 32;

/** Teto de quadros perdidos na janela medida, em desenvolvimento. */
const TETO_PERDIDOS = 0.4;

/** O maior congelamento único tolerado, em ms. */
const TETO_BURACO = 1200;

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 });
  }

  const orbe = page.locator('a[aria-label="Falar com o Nexo"]');
  await orbe.waitFor({ timeout: 20000 });

  /*
   * AQUECER A ROTA ANTES DE MEDIR. Em `next dev` a primeira visita a `/nexo`
   * compila o módulo inteiro, e isso são segundos que não têm nada a ver com a
   * transição — mediríamos o compilador, não o desenho. Ir e voltar uma vez põe
   * o dev server no mesmo pé em que o usuário está na segunda visita.
   */
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nexo-shell", { timeout: 30000 });
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await orbe.waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);

  const medida = await page.evaluate(async () => {
    const m = { quadros: [], marcos: [] };
    const t0 = performance.now();
    let ult = t0;

    const pronto = new Promise((resolve) => {
      const passo = (t) => {
        m.quadros.push(Math.round(t - ult));
        ult = t;

        const casca = document.querySelector(".nexo-shell");
        const jaTem = (nome) => m.marcos.some((x) => x[1] === nome);
        if (casca && !jaTem("casca no DOM")) m.marcos.push([Math.round(t - t0), "casca no DOM"]);
        if (casca && getComputedStyle(casca).opacity === "1" && !jaTem("casca opaca")) {
          m.marcos.push([Math.round(t - t0), "casca opaca"]);
        }

        if (t - t0 < 4000) requestAnimationFrame(passo);
        else resolve();
      };
      requestAnimationFrame(passo);
    });

    document.querySelector('a[aria-label="Falar com o Nexo"]').click();
    await pronto;
    return m;
  });

  const q = medida.quadros;
  const perdidos = q.filter((d) => d > QUADRO_PERDIDO).length;
  const fracao = perdidos / q.length;
  const buraco = Math.max(...q);
  const naDOM = medida.marcos.find((x) => x[1] === "casca no DOM")?.[0];
  const opaca = medida.marcos.find((x) => x[1] === "casca opaca")?.[0];

  console.log("");
  console.log(`  casca do Nexo no DOM ....... ${naDOM ?? "—"} ms depois do clique`);
  console.log(`  casca do Nexo opaca ........ ${opaca ?? "—"} ms`);
  console.log(`  quadros na janela .......... ${q.length}`);
  console.log(`  quadros perdidos (>32ms) ... ${perdidos} (${(fracao * 100).toFixed(1)}%)`);
  console.log(`  maior buraco ............... ${buraco} ms`);
  console.log("");

  check("o Nexo entra no DOM sem esperar a saída terminar", naDOM !== undefined && naDOM < 900, `naDOM=${naDOM}`);
  check(
    `menos de ${(TETO_PERDIDOS * 100).toFixed(0)}% de quadros perdidos`,
    fracao < TETO_PERDIDOS,
    `${(fracao * 100).toFixed(1)}%`,
  );
  check(`nenhum congelamento acima de ${TETO_BURACO}ms`, buraco <= TETO_BURACO, `${buraco}ms`);
  check("sem erro de página", erros.length === 0, erros.join(" | "));
} finally {
  await browser.close();
}

if (falhas > 0) {
  console.error(`\n${falhas} falha(s).`);
  process.exit(1);
}
console.log("\nTudo certo.");
