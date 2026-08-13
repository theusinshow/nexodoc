// CONGELAR O ORBE VIVO E GUARDAR O QUADRO EM PNG.
//
// O orbe é WebGL com shaders próprios (`agent-orb.shaders.ts`) — ou seja, não
// existe "o desenho" em lugar nenhum: ele é calculado, quadro a quadro. Para
// virar marca, alguém precisa ESCOLHER um instante.
//
// Este script monta o orbe sozinho, grande, sobre fundo transparente, e guarda
// N instantes ao longo da animação. Escolher é seu; o script só não deixa a
// escolha depender de apertar PrintScreen na hora certa.
//
// Sai em PNG com canal alfa, no tamanho pedido — a captura é do CANVAS, não da
// janela, então não há barra, sombra nem fundo do site junto.
//
//   npm run dev                     (noutro terminal)
//   node scripts/shot-orbe-parado.mjs
//   node scripts/shot-orbe-parado.mjs --estado=complete --lado=2048 --quadros=12
//
// Estados: idle dragging reading analyzing responding complete error
// (a fonte é AGENT_STATES em agent-orb.types.ts — se divergir, o script mente)
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split("=")[1] : padrao;
};

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/orbe";
const ESTADO = arg("estado", "idle");
const LADO = Number(arg("lado", 1024));
const QUADROS = Number(arg("quadros", 8));
const INTERVALO = Number(arg("intervalo", 900)); // ms entre quadros

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const PASTA = path.resolve("app/orbe-parado-temporario");
const ROTA = path.join(PASTA, "page.tsx");

/*
 * O orbe roda com `ssr:false` e mede o próprio container. A rota abaixo o
 * coloca num quadrado do tamanho pedido, sem nada em volta: sem barra, sem
 * layout, sem fundo — o Canvas já vem com `alpha: true`, então o PNG sai
 * recortado, pronto para ir para cima de qualquer cor.
 */
/*
 * NÃO dá para usar o `<AgentOrb>` pronto aqui, e a tentativa de forçar valeu um
 * PNG de 6738px com um caco de lâmina no canto.
 *
 * Dois limites do componente, ambos certos para a tela e errados para marca:
 * ele trava o próprio tamanho em `clamp(223px, 27.6vh, 308px)`, e o Canvas
 * limita o `dpr` a 1,75 — teto de 539 pixels reais. `zoom` ou `transform` não
 * resolvem: ampliam o raster já rasterizado, ou esticam a caixa sem reenquadrar
 * a câmera.
 *
 * Então a rota monta a CENA DE VERDADE (`AgentOrbScene`, os mesmos shaders) num
 * Canvas próprio, com a mesma câmera do produto e `dpr` alto. O que sai é o
 * mesmo orbe, com resolução de arquivo.
 */
const CONTEUDO = `"use client";

// GERADO POR scripts/shot-orbe-parado.mjs — apagado por ele no fim.
import { Canvas } from "@react-three/fiber";
import { AgentOrbScene } from "@/modules/nexo/components/agent-orb/AgentOrbScene";

export default function OrbeParado() {
  return (
    <div
      id="palco-do-orbe"
      style={{ width: ${LADO}, height: ${LADO}, background: "transparent" }}
    >
      {/* O \`omitBackground\` do Playwright só tira o branco padrão do navegador.
          O fundo do PRODUTO é pintado no body pela globals.css, e sem apagá-lo
          ele entra no PNG — o recorte sairia com um quadrado quase-preto colado
          atrás, que é o oposto de um logo com alfa. */}
      <style>{"html,body{background:transparent !important}"}</style>
      <Canvas
        dpr={${Math.min(4, Math.max(1, Math.round((2048 / LADO) * 10) / 10)) || 2}}
        gl={{ alpha: true, antialias: true, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0, 4.25], fov: 42 }}
        style={{ width: "100%", height: "100%" }}
      >
        <AgentOrbScene
          state="${ESTADO}"
          activity={0.7}
          fileCount={0}
          hovered={false}
          pressed={false}
          reduced={false}
        />
      </Canvas>
    </div>
  );
}
`;

function limpar() {
  fs.rmSync(PASTA, { recursive: true, force: true });
}
process.on("exit", limpar);
process.on("SIGINT", () => {
  limpar();
  process.exit(130);
});

fs.mkdirSync(PASTA, { recursive: true });
fs.writeFileSync(ROTA, CONTEUDO, "utf8");

/*
 * WebGL em navegador sem tela: o Chromium headless cai no SwiftShader, e sem
 * esta flag ele RECUSA em vez de renderizar. Silenciosamente — o canvas viria
 * vazio e o PNG seria um quadrado transparente com cara de "deu certo".
 */
const browser = await chromium.launch({
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

try {
  const ctx = await browser.newContext({
    viewport: { width: LADO + 80, height: LADO + 80 },
    deviceScaleFactor: 2, // o dobro de pixels: sobra resolução para reduzir depois
  });
  const page = await ctx.newPage();

  page.on("console", (m) => {
    if (m.type() === "error") console.log(`     [navegador] ${m.text()}`);
  });

  await page.goto(`${BASE}/orbe-parado-temporario`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  const canvas = page.locator("#palco-do-orbe canvas");
  await canvas.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2500); // a cena entra amortecida; deixa assentar

  /*
   * A captura NÃO pode sair de `canvas.toDataURL()`.
   *
   * Um contexto WebGL sem `preserveDrawingBuffer: true` descarta o buffer assim
   * que o quadro é apresentado — e `toDataURL()` depois disso devolve um
   * retângulo limpo. Foi o que aconteceu na primeira tentativa: seis PNGs de
   * 66 KB, todos em branco, e a checagem de "veio vazio" passou verde porque
   * media o TAMANHO da string, que um PNG grande e vazio também tem.
   *
   * `locator.screenshot` lê a composição da página, onde o WebGL já está
   * desenhado. `omitBackground` mantém o alfa.
   */
  for (let i = 1; i <= QUADROS; i++) {
    const arquivo = path.join(OUT, `orbe-${ESTADO}-${String(i).padStart(2, "0")}.png`);

    await canvas.screenshot({ path: arquivo, omitBackground: true });

    const kb = Math.round(fs.statSync(arquivo).size / 1024);
    console.log(`  ${String(i).padStart(2, "0")}  ${path.basename(arquivo)}  (${kb} KB)`);

    if (i < QUADROS) await page.waitForTimeout(INTERVALO);
  }

  /*
   * "Tem pixel?" medido no PNG, não na intenção. Um PNG uniforme — transparente
   * inteiro — comprime a quase nada; o do orbe não. O limiar é grosseiro de
   * propósito: ele existe só para o vazio não passar por sucesso, e quem julga
   * de verdade é quem abre o arquivo.
   */
  const primeiro = path.join(OUT, `orbe-${ESTADO}-01.png`);
  const bytes = fs.statSync(primeiro).size;
  if (bytes < 12_000) {
    throw new Error(
      `O primeiro quadro tem só ${bytes} bytes — cara de canvas vazio. ` +
        "O WebGL provavelmente não renderizou nesta máquina.",
    );
  }

  console.log(`\n  ${QUADROS} instantes em ${path.resolve(OUT)}`);
  console.log("  Escolha um e me diga o número.");
} finally {
  await browser.close();
  limpar();
}
