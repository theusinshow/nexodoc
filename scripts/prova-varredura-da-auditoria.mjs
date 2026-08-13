// A VARREDURA DA AUDITORIA SOBE SEMPRE — medido, não olhado.
//
// `auditing` se distingue de `reading` por UMA coisa: a banda de scan percorre
// numa direção só, em vez de ir e vir. Isso é invisível num print — um quadro
// mostra uma linha atravessada, e uma linha atravessada é o que os dois estados
// mostram. A diferença só existe no tempo.
//
// Então a prova amostra a cena em intervalos curtos, mede a ALTURA da banda em
// cada quadro (a linha de pixels mais acesa) e verifica que a sequência é
// monotônica — descontando o salto do recomeço, que é justamente o que
// diferencia "recomeça embaixo" de "volta descendo".
//
//   npm run dev                              (noutro terminal)
//   node scripts/prova-varredura-da-auditoria.mjs
//   SHOT_BASE=http://localhost:3001 node scripts/prova-varredura-da-auditoria.mjs
import { chromium } from "playwright";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const LADO = 400;
const QUADROS = 14;
const INTERVALO = 380; // ms — o ciclo é 2,2/0,35 ≈ 6,3s, então cabem ~2 voltas

const PASTA = path.resolve("app/prova-varredura-temporaria");
const ROTA = path.join(PASTA, "page.tsx");

/*
 * A cena montada CRUA, como faz `shot-orbe-parado.mjs`, e pelo mesmo motivo: o
 * `<AgentOrb>` trava o próprio tamanho e limita o dpr. Aqui o tamanho pequeno é
 * de propósito — a medição não precisa de resolução, precisa de quadros.
 */
const CONTEUDO = `"use client";

// GERADO POR scripts/prova-varredura-da-auditoria.mjs — apagado por ele no fim.
import { Canvas } from "@react-three/fiber";
import { AgentOrbScene } from "@/modules/nexo/components/agent-orb/AgentOrbScene";

export default function ProvaVarredura() {
  return (
    <div id="palco" style={{ width: ${LADO}, height: ${LADO}, background: "#000" }}>
      <style>{"html,body{background:#000 !important}"}</style>
      <Canvas
        dpr={1}
        gl={{ alpha: true, antialias: false, preserveDrawingBuffer: true }}
        camera={{ position: [0, 0, 4.25], fov: 42 }}
        style={{ width: "100%", height: "100%" }}
      >
        <AgentOrbScene
          state="auditing"
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

const browser = await chromium.launch({
  args: [
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--ignore-gpu-blocklist",
  ],
});

let falhou = false;
try {
  const ctx = await browser.newContext({
    viewport: { width: LADO + 40, height: LADO + 40 },
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/prova-varredura-temporaria`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });
  const palco = page.locator("#palco canvas");
  await palco.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1500);

  const alturas = [];
  for (let i = 0; i < QUADROS; i++) {
    const buf = await palco.screenshot({ type: "png" });
    const { data, info } = await sharp(buf)
      .raw()
      .toBuffer({ resolveWithObject: true });

    /*
     * A banda é a linha mais ACESA da imagem, e a soma por linha basta para
     * achá-la: ela atravessa o vidro de ponta a ponta, então a fileira que ela
     * ocupa soma muito mais que qualquer outra. A alma pulsa no meio e é
     * brilhante, mas é compacta — some na soma de uma linha inteira.
     *
     * Só o canal VERDE: a banda é teal e o fundo é preto, então o verde é onde
     * o contraste é maior e onde o ruído do vidro escuro pesa menos.
     */
    const canais = info.channels;
    let melhorY = -1;
    let melhorSoma = -1;
    for (let y = 0; y < info.height; y++) {
      let soma = 0;
      for (let x = 0; x < info.width; x++) {
        soma += data[(info.width * y + x) * canais + 1];
      }
      if (soma > melhorSoma) {
        melhorSoma = soma;
        melhorY = y;
      }
    }
    // Y da imagem cresce para BAIXO; invertido, o número cresce quando a banda sobe.
    alturas.push(info.height - melhorY);
    if (i < QUADROS - 1) await page.waitForTimeout(INTERVALO);
  }

  console.log(`  alturas da banda (maior = mais alto): ${alturas.join(" ")}`);

  /*
   * Uma banda que SOBE dá uma sequência crescente com quedas bruscas (o
   * recomeço). Uma banda que VAIVÉM dá subidas e descidas suaves e simétricas.
   * A distinção mecânica: contar passos para baixo que NÃO são o recomeço.
   *
   * O limiar de um terço da altura separa os dois: o recomeço atravessa a
   * esfera inteira de uma vez, e um vaivém nunca desce tanto entre dois quadros
   * consecutivos nesta cadência.
   */
  const limiarDoRecomeco = LADO / 3;
  const descidas = [];
  for (let i = 1; i < alturas.length; i++) {
    const passo = alturas[i] - alturas[i - 1];
    if (passo < 0 && Math.abs(passo) < limiarDoRecomeco) descidas.push(i);
  }

  const recomecos = alturas.filter(
    (a, i) => i > 0 && alturas[i - 1] - a >= limiarDoRecomeco,
  ).length;

  if (descidas.length > 2) {
    falhou = true;
    console.error(
      `FALHOU  a banda desceu ${descidas.length}x sem recomeçar — isso é vaivém, não percurso`,
    );
    console.error(`        (quadros ${descidas.join(", ")})`);
  } else {
    console.log(`  ok  a banda sobe (${descidas.length} descida(s) de ruído, tolerado ≤2)`);
  }

  if (recomecos === 0) {
    falhou = true;
    console.error(
      "FALHOU  nenhum recomeço em ~2 ciclos — a banda pode estar parada ou lenta demais",
    );
  } else {
    console.log(`  ok  ${recomecos} recomeço(s): a banda volta ao pé e sobe de novo`);
  }
} finally {
  await browser.close();
}

process.exit(falhou ? 1 : 0);
