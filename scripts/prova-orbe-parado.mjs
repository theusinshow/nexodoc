// O orbe PARADO tem de nascer do tamanho do vivo — prova em pixels, sem token.
//
// O que ela guarda, e por que nenhum outro teste guardaria:
//
// Enquanto o pedaço do WebGL não chega, o `AgentOrb` mostra o degrau parado
// (`OrbGlow`, o quadro capturado do §6). Quando o canvas monta, um troca pelo
// outro. Se os dois não tiverem o MESMO diâmetro no MESMO centro, o que se vê é
// a esfera dar um salto de tamanho no instante da troca — e foi assim que este
// arquivo nasceu: o placeholder era um gradiente teal chapado, um objeto
// completamente diferente, visível por ~300ms na primeira ida ao Nexo.
//
// NENHUMA ASSERÇÃO DE DOM PEGA ISSO. As duas caixas têm o tamanho que devem ter
// — o que difere é a fração da caixa que cada esfera OCUPA: o PNG traz 8% de
// folga em volta da silhueta, e a esfera viva recua conforme a câmera do shader.
// As duas frações não têm por que bater sozinhas, e não batem. Por isso a prova
// conta pixels acesos na captura, e não atributos.
//
// QUEM QUEBRA ISTO: mexer no recuo de câmera do `AgentOrbCanvas`, trocar o PNG
// da marca por um com outra margem, ou mexer no `inset` do `OrbGlow`. Nos três
// casos a tela continua "funcionando" e só o quadro da troca denuncia.
//
// O TRUQUE DO ATRASO. Para fotografar o placeholder é preciso segurá-lo na tela:
// a rota intercepta os pedaços de JS e adia por 2,5s aquele que traz o three.js.
// Sem isso o canvas monta antes da primeira captura e a prova mediria o vivo
// duas vezes — passando verde sem ter olhado para o parado.
//
//   node scripts/prova-orbe-parado.mjs   (== npm run prova:orbe-parado)
import { chromium } from "playwright";
import fs from "node:fs";
import sharp from "sharp";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

/** Quanto os diâmetros podem divergir. 2% de 165px é pouco mais de 3px. */
const TOLERANCIA_DIAMETRO = 0.02;

/** Quanto os centros podem divergir, em pixels. */
const TOLERANCIA_CENTRO = 2;

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/**
 * A caixa da esfera dentro da captura: os pixels acima do fundo do palco.
 *
 * O corte em 70 (soma dos canais) fica bem acima do `#0a0e11` do fundo — que
 * soma 27 — e bem abaixo do bordo da esfera, que é o ponto mais escuro que
 * ainda conta. A §6 garante essa folga: "o bordo da esfera NUNCA chega ao preto
 * do fundo".
 */
async function caixaDaEsfera(arquivo) {
  const { data, info } = await sharp(arquivo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let x1 = 0;
  let y0 = info.height;
  let y1 = 0;

  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (info.width * y + x) * info.channels;
      if (data[i] + data[i + 1] + data[i + 2] <= 70) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }

  if (x1 < x0) return null;
  return { d: x1 - x0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForSelector(".nexo-agent-orb", { timeout: 30000 });

  // Segura o pedaço do three.js, e só ele, para o parado dar tempo de ser visto.
  await page.route("**/*.js*", async (route) => {
    const resposta = await route.fetch();
    const corpo = await resposta.text();
    if (corpo.includes("WebGLRenderer") || corpo.includes("@react-three")) {
      await new Promise((r) => setTimeout(r, 2500));
    }
    return route.fulfill({ response: resposta, body: corpo });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector(".nexo-agent-orb", { timeout: 30000 });
  await page.waitForTimeout(400);

  const canvasAntes = await page.locator(".nexo-agent-orb canvas").count();
  check("o parado aparece antes do canvas (senão a prova mediria o vivo duas vezes)", canvasAntes === 0);

  await page.locator(".nexo-agent-orb").screenshot({ path: `${OUT}/orbe-parado.png` });

  await page.waitForSelector(".nexo-agent-orb canvas", { timeout: 30000 });
  // O boot do §6 leva ~600ms; medir antes disso pegaria a esfera ainda subindo.
  await page.waitForTimeout(1800);
  await page.locator(".nexo-agent-orb").screenshot({ path: `${OUT}/orbe-vivo.png` });

  const parado = await caixaDaEsfera(`${OUT}/orbe-parado.png`);
  const vivo = await caixaDaEsfera(`${OUT}/orbe-vivo.png`);

  if (!parado || !vivo) {
    check("as duas esferas foram encontradas na captura", false, `parado=${!!parado} vivo=${!!vivo}`);
  } else {
    const desvio = parado.d / vivo.d - 1;
    const dx = Math.abs(parado.cx - vivo.cx);
    const dy = Math.abs(parado.cy - vivo.cy);

    console.log("");
    console.log(`  esfera parada .... ${parado.d}px, centro (${parado.cx}, ${parado.cy})`);
    console.log(`  esfera viva ...... ${vivo.d}px, centro (${vivo.cx}, ${vivo.cy})`);
    console.log(`  desvio ........... ${(desvio * 100).toFixed(1)}% no diâmetro, ${dx}px / ${dy}px no centro`);
    console.log("");

    check(
      `o diâmetro bate dentro de ${(TOLERANCIA_DIAMETRO * 100).toFixed(0)}%`,
      Math.abs(desvio) <= TOLERANCIA_DIAMETRO,
      `${(desvio * 100).toFixed(1)}%`,
    );
    check(
      `o centro bate dentro de ${TOLERANCIA_CENTRO}px`,
      dx <= TOLERANCIA_CENTRO && dy <= TOLERANCIA_CENTRO,
      `${dx}px / ${dy}px`,
    );
  }

  check("sem erro de página", erros.length === 0, erros.join(" | "));
} finally {
  await browser.close();
}

if (falhas > 0) {
  console.error(`\n${falhas} falha(s). Capturas em ${OUT}/orbe-parado.png e ${OUT}/orbe-vivo.png.`);
  process.exit(1);
}
console.log("\nTudo certo.");
