// O ORBE SOBRE UMA COR — a peça que faltava entre o quadro congelado e o uso.
//
//   node scripts/compor-orbe-em-fundo.mjs scratchpad/orbe/orbe-idle-03.png
//
// `shot-orbe-parado.mjs` entrega o orbe em PNG COM ALFA, e é o certo: assim o
// mesmo quadro serve a qualquer fundo. Mas dois usos precisam do orbe já
// composto, e nenhum aceita transparência:
//
//  · a FOTO DE PERFIL do e-mail do produto — o Gmail põe fundo BRANCO atrás de
//    PNG com alfa, e o orbe é desenhado para o escuro. Sai lavado;
//  · o CABEÇALHO DO E-MAIL de aviso — cliente de e-mail não compõe alfa contra
//    a cor da célula de forma confiável, e o que aparece é um quadrado.
//
// Por isso o fundo é PINTADO aqui, e não deixado para quem exibe.
//
// O ENQUADRAMENTO SAI DO CANAL ALFA, e não de número escolhido a olho: o halo
// do orbe muda de raio conforme o instante, e recorte fixo faria a marca mudar
// de tamanho entre um quadro e outro.
import fs from "node:fs";
import path from "node:path";

import { chromium } from "playwright";

const ORIGEM = process.argv[2];

if (!ORIGEM || !fs.existsSync(ORIGEM)) {
  console.error("uso: node scripts/compor-orbe-em-fundo.mjs <quadro.png>");
  console.error("     (gere os quadros com scripts/shot-orbe-parado.mjs)");
  process.exit(1);
}

/*
 * FOLGA DIFERENTE POR USO, e é o único parâmetro que muda entre os dois.
 *
 * O avatar ganha 12% porque o Gmail o recorta em CÍRCULO: com o orbe encostando
 * na borda, o aro luminoso — que é a identidade — é a primeira coisa cortada. O
 * do e-mail aparece inteiro, num quadrado, e 6% já respira.
 */
const SAIDAS = [
  {
    arquivo: "public/marca/orbe-preto-1024.png",
    lado: 1024,
    fundo: "#000000",
    folga: 1.12,
    para: "foto de perfil (Gmail recorta em círculo)",
  },
  {
    arquivo: "public/marca/orbe-faixa-256.png",
    lado: 256,
    fundo: "#0a0e11",
    folga: 1.06,
    para: "cabeçalho do e-mail de aviso",
  },
];

const browser = await chromium.launch();
const page = await browser.newPage();

// Vai como data URL: a página em branco tem origem `about:blank`, e o navegador
// recusa decodificar `file://` ali.
const fonte = `data:image/png;base64,${fs.readFileSync(ORIGEM).toString("base64")}`;

for (const saida of SAIDAS) {
  const feito = await page.evaluate(
    async ([href, lado, fundo, folga]) => {
      const img = new Image();
      img.src = href;
      await img.decode();

      const leitura = document.createElement("canvas");
      leitura.width = img.naturalWidth;
      leitura.height = img.naturalHeight;
      const lctx = leitura.getContext("2d");
      lctx.drawImage(img, 0, 0);

      const { data } = lctx.getImageData(0, 0, leitura.width, leitura.height);
      let x0 = leitura.width, y0 = leitura.height, x1 = -1, y1 = -1;

      // Limiar 8, e não 0: o halo morre num degradê longo, e alfa 1 a duzentos
      // pixels do corpo esticaria a moldura até a borda do quadro.
      for (let y = 0; y < leitura.height; y++) {
        for (let x = 0; x < leitura.width; x++) {
          if (data[(y * leitura.width + x) * 4 + 3] > 8) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
        }
      }

      if (x1 < 0) return null;

      const largura = x1 - x0 + 1;
      const altura = y1 - y0 + 1;
      const cx = x0 + largura / 2;
      const cy = y0 + altura / 2;
      const meio = (Math.max(largura, altura) / 2) * folga;

      const c = document.createElement("canvas");
      c.width = lado;
      c.height = lado;
      const ctx = c.getContext("2d");
      ctx.fillStyle = fundo;
      ctx.fillRect(0, 0, lado, lado);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(leitura, cx - meio, cy - meio, meio * 2, meio * 2, 0, 0, lado, lado);

      const canto = ctx.getImageData(1, 1, 1, 1).data;

      return {
        url: c.toDataURL("image/png"),
        conteudo: `${largura}x${altura} de ${leitura.width}`,
        canto: `rgb(${canto[0]},${canto[1]},${canto[2]})`,
      };
    },
    [fonte, saida.lado, saida.fundo, saida.folga],
  );

  if (!feito) {
    console.error(`  ${saida.arquivo} — quadro sem conteúdo (alfa todo zero)`);
    process.exitCode = 1;
    continue;
  }

  fs.mkdirSync(path.dirname(saida.arquivo), { recursive: true });
  fs.writeFileSync(
    saida.arquivo,
    Buffer.from(feito.url.replace(/^data:image\/png;base64,/, ""), "base64"),
  );

  const kb = (fs.statSync(saida.arquivo).size / 1024).toFixed(0);
  console.log(
    `  ${saida.arquivo}  ${saida.lado}px  ${kb} KB  canto ${feito.canto}  — ${saida.para}`,
  );
}

await browser.close();
console.log(`\n  orbe de ${path.basename(ORIGEM)}, conteúdo enquadrado pelo canal alfa`);
