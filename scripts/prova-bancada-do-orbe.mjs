// A BANCADA AINDA ABRE — e oferece exatamente os estados que existem.
//
// A bancada é a ferramenta de afinação da marca (DESIGN.md §6): é nela que se
// decide, vendo, quanto vale cada parâmetro do orbe. Uma bancada quebrada não
// derruba o produto, então ninguém descobre que ela quebrou até precisar dela —
// que é sempre no meio de uma decisão de marca, o pior momento possível.
//
// A prova é dupla, e a segunda metade é a que importa: além de abrir, o seletor
// de estados tem de listar os MESMOS estados que `AGENT_STATES` declara. A lista
// da bancada já foi uma cópia escrita à mão, e ela divergiu — oferecia `hover` e
// `uploading`, dois estados que a máquina do agente nunca produz. Afinar um
// estado que o produto não alcança é afinar no vazio.
//
//   npm run dev                        (noutro terminal)
//   node scripts/prova-bancada-do-orbe.mjs
//   node scripts/prova-bancada-do-orbe.mjs --png=./scratchpad/bancada.png
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const arg = (nome, padrao) => {
  const achado = process.argv.find((a) => a.startsWith(`--${nome}=`));
  return achado ? achado.split("=")[1] : padrao;
};

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const PNG = arg("png", null);

/*
 * A lista esperada sai do CÓDIGO-FONTE, não de uma cópia aqui.
 *
 * Copiar os sete nomes para dentro desta prova recriaria exatamente o problema
 * que ela existe para pegar: mais uma lista à mão, divergindo em silêncio. Ler o
 * arquivo e extrair o bloco é feio e é certo.
 */
const fonte = readFileSync(
  new URL("../modules/nexo/components/agent-orb/agent-orb.types.ts", import.meta.url),
  "utf8",
);
const bloco = fonte.match(/AGENT_STATES[^=]*=\s*\[([^\]]*)\]/);
if (!bloco) {
  console.error("FALHOU  não achei AGENT_STATES em agent-orb.types.ts");
  process.exit(1);
}
const esperados = [...bloco[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort();

// WebGL sem tela: sem estas flags o Chromium headless RECUSA em vez de renderizar,
// e o canvas viria vazio com cara de sucesso.
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
    viewport: { width: 1500, height: 1000 },
    deviceScaleFactor: 1.5,
  });
  const page = await ctx.newPage();

  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") erros.push(m.text());
  });

  await page.goto(`${BASE}/bancada-do-orbe`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await page.locator("canvas").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2500); // a cena entra amortecida; deixa assentar

  const oferecidos = (
    await page.locator("select").first().locator("option").allTextContents()
  )
    .map((t) => t.trim())
    .sort();

  const faltando = esperados.filter((e) => !oferecidos.includes(e));
  const sobrando = oferecidos.filter((o) => !esperados.includes(o));

  if (faltando.length || sobrando.length) {
    falhou = true;
    console.error("FALHOU  o seletor da bancada não bate com AGENT_STATES");
    if (faltando.length) console.error(`  faltando: ${faltando.join(" ")}`);
    if (sobrando.length) console.error(`  sobrando: ${sobrando.join(" ")}`);
  } else {
    console.log(`  ok  ${oferecidos.length} estados: ${oferecidos.join(" ")}`);
  }

  /*
   * A ESFERA CONTINUA SENDO A ESFERA — inclusive no erro.
   *
   * O §6 exige que os três níveis de redução sejam reconhecíveis como o MESMO
   * objeto, e o estado de erro passou muito tempo violando isso sem que nada
   * reclamasse: o jitter deslocava os vértices em 0,4 de um raio 1, e a casca
   * virava um ouriço de espinhos que ultrapassava até o aro de 1,14 que mede o
   * progresso da leitura. Erro que destrói a identidade da marca não é
   * expressão de erro; é falha de desenho.
   *
   * Esta prova MEDE A SILHUETA, e não um parâmetro: copia o canvas do WebGL
   * para um 2D e acha a caixa dos pixels acesos. É a diferença entre provar que
   * a constante está certa e provar que a esfera está inteira — a mesma lição
   * que a lâmina do texto deu nesta sessão.
   */
  const silhueta = () =>
    page.evaluate(() => {
      const gl = document.querySelector("canvas");
      if (!gl) return null;
      const c = document.createElement("canvas");
      c.width = gl.width;
      c.height = gl.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(gl, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, maxX = -1, minY = c.height, maxY = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          const i = (y * c.width + x) * 4;
          if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 28) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      return maxX < 0 ? null : { largura: maxX - minX, altura: maxY - minY };
    });

  /*
   * MEDE-SE O PICO, e não um instante qualquer — o tremor do erro é regido pelo
   * batimento (duas contrações e uma pausa, ciclo de 1,6s), então a maior parte
   * do tempo a casca está quase em repouso. Uma amostra só cai na pausa e
   * aprova uma esfera que se despedaça duas vezes por segundo. Doze amostras
   * cobrem mais de um ciclo inteiro.
   */
  const maiorSilhueta = async (amostras = 12) => {
    let maior = null;
    for (let i = 0; i < amostras; i++) {
      const s = await silhueta();
      if (s && (!maior || s.largura * s.altura > maior.largura * maior.altura)) maior = s;
      await page.waitForTimeout(150);
    }
    return maior;
  };

  const seletor = page.locator("select").first();
  await seletor.selectOption("idle");
  await page.waitForTimeout(1800);
  const emRepouso = await maiorSilhueta(4);
  await seletor.selectOption("error");
  await page.waitForTimeout(1200);
  const noErro = await maiorSilhueta();

  if (!emRepouso || !noErro) {
    falhou = true;
    console.error("FALHOU  não deu para medir a silhueta do orbe");
  } else {
    /*
     * 12% de folga: o tremor DEVE aparecer na borda — é o que o corpo lê como
     * instabilidade —, então exigir silhueta idêntica mataria o estado. O que
     * não pode é a casca sair de esfera. Antes da correção a diferença passava
     * de 25%.
     */
    const maior = Math.max(noErro.largura / emRepouso.largura, noErro.altura / emRepouso.altura);
    if (maior > 1.12) {
      falhou = true;
      console.error(
        `FALHOU  o erro DESPEDAÇA a esfera: ${Math.round((maior - 1) * 100)}% maior que em repouso ` +
          `(repouso ${emRepouso.largura}x${emRepouso.altura}, erro ${noErro.largura}x${noErro.altura})`,
      );
    } else {
      console.log(
        `  ok  a esfera continua esfera no erro (${Math.round((maior - 1) * 100)}% de variação)`,
      );
    }
  }

  if (erros.length) {
    falhou = true;
    console.error(`FALHOU  ${erros.length} erro(s) no navegador:`);
    for (const e of erros.slice(0, 5)) console.error(`  ${e}`);
  } else {
    console.log("  ok  nenhum erro no console");
  }

  if (PNG) {
    await page.screenshot({ path: PNG, fullPage: true });
    console.log(`  png  ${PNG}`);
  }
} finally {
  await browser.close();
}

process.exit(falhou ? 1 : 0);
