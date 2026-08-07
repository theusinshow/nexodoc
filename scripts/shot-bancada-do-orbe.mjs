// A BANCADA MEXE MESMO?
//
// Controle que gira e não muda nada é pior que controle nenhum: ele convence.
// Este portão não confere layout — confere que MEXER MUDA O PIXEL.
//
// O método é o único honesto para shader: fotografa, muda o controle,
// fotografa de novo, e compara os bytes dos dois PNGs. Igual = o controle é
// enfeite.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-bancada-do-orbe.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/bancada";
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader", "--use-gl=angle", "--use-angle=swiftshader"],
});
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
const page = await ctx.newPage();

try {
  await page.goto(`${BASE}/bancada-do-orbe`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  const palcoGrande = page.locator("main > div > div:first-child > div").first();
  await palcoGrande.locator("canvas").waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2500);

  async function foto(nome) {
    const arquivo = path.join(OUT, `${nome}.png`);
    await palcoGrande.screenshot({ path: arquivo });
    return fs.readFileSync(arquivo);
  }

  await page.screenshot({ path: path.join(OUT, "00-bancada-inteira.png") });

  const antes = await foto("01-original");
  check("a bancada desenha o orbe", antes.length > 8_000, `${antes.length} bytes`);

  /*
   * O miolo luminoso é a cor mais visível de todas — se alguma prova mudança,
   * é ela. Trocar para magenta é escolha de TESTE, não de marca: quero um
   * delta grande o suficiente para não depender de ruído de anti-aliasing.
   */
  const seletorDaCor = 'input[type="color"]';
  const campos = page.locator(seletorDaCor);
  check("seis controles de cor", (await campos.count()) === 6, `${await campos.count()}`);

  await campos.nth(3).evaluate((el) => {
    const input = el;
    input.value = "#ff00aa";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(1800);
  const depoisDaCor = await foto("02-miolo-magenta");

  check(
    "mexer no miolo muda o pixel",
    Buffer.compare(antes, depoisDaCor) !== 0,
    "os dois PNGs sao identicos — o controle de cor e enfeite",
  );

  // Volta ao original e prova que o botao desfaz de verdade.
  await page.getByRole("button", { name: /Voltar ao original/i }).click();
  await page.waitForTimeout(1800);
  const voltou = await foto("03-voltou");
  check(
    "'Voltar ao original' desfaz",
    Buffer.compare(voltou, depoisDaCor) !== 0,
    "continuou magenta",
  );

  // Os parametros a mao: marcados, o slider precisa mudar a cena.
  await page.getByRole("checkbox").first().check();
  await page.waitForTimeout(400);
  const antesDoParam = await foto("04-antes-do-param");

  const sliders = page.locator('input[type="range"]');
  const total = await sliders.count();
  // O ultimo bloco de 6 sliders sao os parametros; 'rim' e o 3o deles.
  const rim = sliders.nth(total - 4);
  await rim.evaluate((el) => {
    const input = el;
    input.value = String(Number(input.max));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(2000);
  const depoisDoParam = await foto("05-parametro-no-maximo");

  check(
    "slider de parametro muda o pixel",
    Buffer.compare(antesDoParam, depoisDoParam) !== 0,
    "os PNGs sao identicos — o ajuste nao chega na cena",
  );

  // A rota nao pode existir em producao.
  const guardaEmProducao = fs
    .readFileSync("app/bancada-do-orbe/page.tsx", "utf8")
    .includes('process.env.NODE_ENV === "production"');
  check("a rota se recusa em producao", guardaEmProducao);
} catch (err) {
  falhas++;
  console.error(`  FALHOU  o portao quebrou :: ${err.message}`);
  await page.screenshot({ path: path.join(OUT, "erro.png") }).catch(() => {});
} finally {
  await browser.close();
}

console.log(
  falhas === 0
    ? `\nTudo OK. Prints em ${path.resolve(OUT)}`
    : `\n${falhas} checagem(ns) falharam. Prints em ${path.resolve(OUT)}`,
);
process.exit(falhas === 0 ? 0 : 1);
