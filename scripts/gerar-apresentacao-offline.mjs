// A CÓPIA QUE ABRE SEM SERVIDOR — um único `.html`, do disco, sem rede.
//
// POR QUE ELA EXISTE. O deck mora dentro do aplicativo (`/apresentacao`), e isso
// acopla a apresentação à saúde dele: um problema de deploy mataria o deck E a
// demonstração ao vivo no mesmo minuto. As folhas de reserva B1/B2 não salvam
// disso — também dependem do app estar de pé. Este arquivo é a última camada.
//
//   npm run dev                              (noutro terminal)
//   node scripts/gerar-apresentacao-offline.mjs
//
// POR QUE PELO NAVEGADOR, e não renderizando o React aqui. Duas razões:
//
//  1. O Next RECUSA `react-dom/server` no grafo do app ("You're importing a
//     component that imports react-dom/server"), então a rota que eu tentei
//     primeiro não compila. Não é contorno: é a regra da plataforma.
//  2. Mais importante — o que se quer no pen drive é o que o apresentador
//     ENSAIOU. Serializar o DOM da página real garante isso; uma segunda
//     renderização por outro caminho pode divergir sem avisar.
//
// NÃO GASTA TOKEN: só lê a tela que já existe.
//
// O QUE NÃO VAI JUNTO: as fontes. `next/font` auto-hospeda o IBM Plex, e embutir
// os `woff2` custaria centenas de KB por um caso degradado do caso degradado. O
// arquivo pede a fonte ao Google e cai na do sistema quando não há internet — o
// deck continua legível, só menos afinado, e isso está escrito no rodapé dele.
import fs from "node:fs";
import path from "node:path";

import nextEnv from "@next/env";
import { chromium } from "playwright";

nextEnv.loadEnvConfig(process.cwd());

const BASE = process.env.NEXODOC_BASE_URL ?? "http://localhost:3000";
const SAIDA = process.argv[2] ?? "scratchpad/nexodoc-apresentacao.html";

/** Lê um arquivo do disco como `data:` URI. */
function dataUri(arquivo, tipo) {
  const bytes = fs.readFileSync(path.join(process.cwd(), arquivo));
  return `data:${tipo};base64,${bytes.toString("base64")}`;
}

/**
 * Os tokens que o `globals.css` daria e que o arquivo solto não terá, mais a
 * regra da marca reduzida ao que a capa usa.
 */
const TOKENS = `
:root {
  --background: #0a0e11;
  --foreground: #e1e7ea;
  --card: #121518;
  --border: #23282c;
  --muted-foreground: #8e9ba3;
  --primary: #00a693;
  --nexodoc-accent: #5bdac6;
  --nexodoc-raised: #1a1e21;
  --status-ok: #6ee7a3;
  --status-ok-bg: rgb(110 231 163 / 0.13);
  --status-warning: #e9b45c;
  --status-critical: #ff9285;
  --status-critical-bg: rgb(255 146 133 / 0.14);
}
* { box-sizing: border-box; }
/*
 * A FAMILIA VAI NO BODY, e nao so na folha. O painel de notas vive FORA de
 * .ap-folha — no produto ele herda a fonte do globals.css, que o arquivo solto
 * nao tem, e as notas saiam em serifada enquanto o slide ao lado estava certo.
 * Visto na captura do arquivo aberto por file://.
 *
 * SEM CRASE NESTE COMENTARIO: ele mora dentro de um template literal, e a
 * primeira versao dele fechou a string no meio do CSS.
 */
body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: "IBM Plex Sans", system-ui, sans-serif;
}
.nx-marca {
  display: inline-block;
  position: relative;
  flex: 0 0 auto;
  background-image: var(--nx-marca-estatica);
  background-size: 100% 100%;
  background-repeat: no-repeat;
}
.ap-folha[hidden] { display: none; }
.ap-aviso {
  position: fixed; left: 24px; bottom: 20px;
  font-family: "IBM Plex Mono", ui-monospace, monospace;
  font-size: 12px; color: #3d474d;
}
`;

/** O motor, em JavaScript comum. As MESMAS teclas do `palco.tsx`. */
const MOTOR = `
(function () {
  var folhas = [].slice.call(document.querySelectorAll('.ap-folha'));
  var palco = document.getElementById('palco');
  var moldura = document.getElementById('moldura');
  var raiz = document.getElementById('raiz');
  var notas = document.getElementById('notas');
  var notasTexto = document.getElementById('notas-texto');
  var notasRotulo = document.getElementById('notas-rotulo');
  var posicao = document.getElementById('posicao');
  var i = 0, notasAbertas = false;

  function escala() {
    var largura = window.innerWidth - (notasAbertas ? 460 : 0);
    var k = Math.min(largura / 1920, window.innerHeight / 1080);
    palco.style.transform = 'scale(' + k + ')';
    // A moldura assume o tamanho ja escalado — ver o comentario em palco.css.
    moldura.style.width = 1920 * k + 'px';
    moldura.style.height = 1080 * k + 'px';
  }
  function mostra(n) {
    i = Math.max(0, Math.min(folhas.length - 1, n));
    folhas.forEach(function (f, k) { f.hidden = k !== i; });
    posicao.textContent = (i + 1) + '/' + folhas.length;
    // A nota chega com os paragrafos separados por linha em branco, e cada um
    // vira um <p> — do mesmo jeito que o painel do produto os mostra.
    notasTexto.textContent = '';
    (folhas[i].getAttribute('data-notas') || '').split('\\n\\n').forEach(function (bloco) {
      if (!bloco) return;
      var p = document.createElement('p');
      p.textContent = bloco;
      notasTexto.appendChild(p);
    });
    notasRotulo.textContent = folhas[i].getAttribute('data-rotulo') || '';
  }
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); mostra(i + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); mostra(i - 1); }
    else if (e.key === 'Home') { e.preventDefault(); mostra(0); }
    else if (e.key === 'End') { e.preventDefault(); mostra(folhas.length - 1); }
    else if (e.key === 'n' || e.key === 'N') {
      notasAbertas = !notasAbertas;
      notas.hidden = !notasAbertas;
      raiz.setAttribute('data-notas', String(notasAbertas));
      escala();
    } else if (e.key === 'f' || e.key === 'F') {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (raiz.requestFullscreen) raiz.requestFullscreen();
    }
  });
  window.addEventListener('resize', escala);
  escala();
  mostra(0);
})();
`;

async function main() {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 } });

  await pagina.goto(`${BASE}/apresentacao`, { waitUntil: "domcontentloaded" });

  if (pagina.url().includes("/login")) {
    await pagina.getByRole("button", { name: /Entrar como dev/i }).click();
    await pagina.waitForURL("**/apresentacao**", { timeout: 30000 });
  }

  await pagina.waitForSelector(".ap-folha", { timeout: 20000 });

  /*
   * O ORBE DEMORA A MONTAR: o canvas dele entra por `next/dynamic`, e a primeira
   * versão deste gerador serializava a capa antes disso — o arquivo saía com o
   * halo e um buraco no meio. Esperar o elemento existir é a diferença entre um
   * plano de emergência e uma capa quebrada.
   */
  await pagina.waitForSelector(".nexo-agent-orb", { timeout: 8000 }).catch(() => {
    console.warn("   aviso: o orbe não montou a tempo; a capa sai sem a marca.");
  });
  await pagina.waitForTimeout(600);

  const total = Number((await pagina.textContent(".ap-posicao"))?.split("/")[1] ?? 0);
  if (!total) throw new Error("Não achei o contador de slides — a rota mudou?");

  /*
   * UMA FOLHA DE CADA VEZ, porque o palco só monta a corrente. Avança pela MESMA
   * tecla que o apresentador usa: se a navegação quebrar, o gerador quebra junto
   * — e é melhor descobrir aqui do que na sala.
   */
  const folhas = [];
  for (let i = 0; i < total; i += 1) {
    const folha = await pagina.evaluate(() => {
      const secao = document.querySelector(".ap-folha");
      if (!secao) return null;
      const numero = secao.querySelector(".ap-numero")?.textContent ?? "";

      /*
       * O ORBE VIVO NÃO SOBREVIVE À SERIALIZAÇÃO. Ele é um canvas WebGL, e
       * `outerHTML` devolve a tag vazia: a capa do arquivo offline abriria com
       * um buraco no lugar da marca — e só se descobriria isso no dia em que o
       * arquivo fosse preciso.
       *
       * Trocado por um marcador, que vira o quadro estático do próprio orbe lá
       * no Node. É a mesma imagem que a `MarcaViva` usa no produto: a captura
       * do orbe vivo. Perde o movimento, mantém a identidade.
       */
      const clone = secao.cloneNode(true);
      for (const orbe of clone.querySelectorAll(".nexo-agent-orb")) {
        const marcador = document.createElement("span");
        marcador.setAttribute("data-orbe-estatico", "");
        // Medida com recuo: o orbe já apareceu medindo 0 aqui, e o arquivo saiu
        // com uma imagem de 0x0 — presente no HTML, invisível na tela. 298 é o
        // lado que o `hero` assume numa janela de 1080.
        const lado = Math.round(orbe.getBoundingClientRect().width) || 298;
        marcador.setAttribute("style", `display:block;width:${lado}px;height:${lado}px`);
        orbe.replaceWith(marcador);
      }

      return { html: clone.outerHTML, numero };
    });
    if (!folha) throw new Error(`Folha ${i + 1} não renderizou.`);

    folhas.push({ ...folha, rotulo: "", notas: "" });

    if (i < total - 1) {
      await pagina.keyboard.press("ArrowRight");
      await pagina.waitForFunction(
        (esperado) => document.querySelector(".ap-posicao")?.textContent?.startsWith(`${esperado}/`),
        i + 2,
        { timeout: 5000 },
      );
    }
  }

  // As notas vivem no React, e o painel só existe quando está aberto. Abre uma
  // vez e relê tudo — mais barato que abrir e fechar a cada folha.
  await pagina.keyboard.press("Home");
  await pagina.keyboard.press("n");
  for (let i = 0; i < total; i += 1) {
    folhas[i].rotulo = (await pagina.textContent(".ap-notas-rotulo")) ?? "";
    /*
     * TODOS OS PARÁGRAFOS, e não `p:last-of-type`.
     *
     * O seletor antigo funcionava enquanto cada nota era um parágrafo só. No dia
     * em que as notas passaram a carregar as RÉPLICAS — o que o comprador diz
     * quando a resposta não o satisfaz — elas viraram quatro e cinco blocos, e a
     * cópia do pen drive passou a levar apenas o ÚLTIMO. Perdiam-se justamente
     * as réplicas, que são a parte que não se improvisa.
     *
     * O modo de falhar era o pior possível: a autoconferência exigia só que a
     * nota tivesse mais de 20 caracteres, e o último parágrafo sempre tem. O
     * arquivo saía verde e só se descobriria mutilado na emergência.
     */
    folhas[i].notas = (
      await pagina.$$eval(".ap-notas p:not(.ap-notas-rotulo)", (nós) =>
        nós.map((nó) => nó.textContent?.trim() ?? "").filter(Boolean),
      )
    ).join("\n\n");
    if (i < total - 1) await pagina.keyboard.press("ArrowRight");
  }

  await navegador.close();

  const palcoCss = fs.readFileSync("app/apresentacao/palco.css", "utf8");
  const orbe = dataUri("public/marca/orbe-512.png", "image/png");
  // A `MarcaViva` escolhe o arquivo pelo tamanho pedido: o diagrama usa o de
  // 180. Trocar só o de 512 deixava um endereço de servidor para trás.
  const marcaPorTamanho = {
    "/marca/orbe-512.png": orbe,
    "/marca/orbe-180.png": dataUri("public/marca/orbe-180.png", "image/png"),
    "/marca/orbe-64.png": dataUri("public/marca/orbe-64.png", "image/png"),
    "/marca/orbe-32.png": dataUri("public/marca/orbe-32.png", "image/png"),
  };

  const corpo = folhas
    .map(({ html, rotulo, notas }, i) => {
      const atributos =
        `${i === 0 ? "" : " hidden"}` +
        ` data-rotulo="${escapar(rotulo)}" data-notas="${escapar(notas)}"`;
      return html.replace(/^<section/, `<section${atributos}`);
    })
    .join("\n");

  let html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>NexoDoc — Apresentação à diretoria</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style>${TOKENS}${palcoCss}</style>
</head>
<body>
<div class="ap-raiz" id="raiz">
  <div class="ap-moldura" id="moldura">
    <div class="ap-palco" id="palco">
${corpo}
    </div>
  </div>
</div>
<aside class="ap-notas" id="notas" hidden>
  <p class="ap-notas-rotulo" id="notas-rotulo"></p>
  <h2>Notas do apresentador</h2>
  <div id="notas-texto"></div>
</aside>
<div class="ap-regua">
  <span class="ap-posicao" id="posicao"></span>
  <span><kbd>←</kbd> <kbd>→</kbd> navegar</span>
  <span><kbd>N</kbd> notas</span>
  <span><kbd>F</kbd> tela cheia</span>
</div>
<p class="ap-aviso">cópia offline · sem internet a fonte cai para a do sistema</p>
<script>${MOTOR}</script>
</body>
</html>`;

  for (const [endereco, uri] of Object.entries(marcaPorTamanho)) {
    html = html.replaceAll(endereco, uri);
  }
  // O marcador deixado na serialização vira o quadro estático do orbe.
  html = html.replace(
    /<span data-orbe-estatico(?:=""|)\s+style="([^"]*)"><\/span>/g,
    (_todo, estilo) =>
      `<img src="${orbe}" alt="NexoDoc" style="${estilo};border-radius:50%">`,
  );

  const restou = ["/marca/", "/_next/"].filter((p) => html.includes(p));
  if (restou.length) {
    throw new Error(
      `Sobrou endereço de servidor no arquivo (${restou.join(", ")}) — ele não abriria do disco.`,
    );
  }

  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  /*
   * O GUARDA CONTRA A NOTA MUTILADA. Não é sobre tamanho — o seletor errado
   * devolvia um parágrafo inteiro e válido, e por isso passou. É sobre a FORMA:
   * o deck tem folhas cuja nota é feita de vários blocos (as réplicas do bloco
   * das perguntas difíceis), e se NENHUMA chegar aqui com mais de um bloco, foi
   * a extração que regrediu, não o conteúdo que mudou.
   */
  const comVariosBlocos = folhas.filter(({ notas }) => notas.includes("\n\n")).length;
  if (comVariosBlocos < 3) {
    throw new Error(
      `Só ${comVariosBlocos} folhas trouxeram nota com mais de um parágrafo. ` +
        "O deck tem várias — o seletor das notas regrediu.",
    );
  }

  fs.writeFileSync(SAIDA, html, "utf8");

  await conferirNoDisco(path.resolve(SAIDA), folhas.length);

  console.log(`OK — ${folhas.length} folhas, ${(html.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   ${path.resolve(SAIDA)}`);
}

/**
 * ABRE O ARQUIVO DO DISCO e confere que ele funciona ali — `file://`, sem
 * servidor nenhum de pé.
 *
 * Escrever o arquivo não é prova de que ele abre: a lição desta casa é que
 * "compila limpo" não é evidência de que roda, e aqui o modo de falhar seria
 * silencioso — um endereço que sobrou, um script que não executa sob `file://`,
 * uma folha que não aparece. Um arquivo de emergência que só se descobre quebrado
 * na emergência é pior que não ter arquivo nenhum.
 */
async function conferirNoDisco(arquivo, esperadas) {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage({ viewport: { width: 1920, height: 1080 } });

  const falhas = [];
  pagina.on("pageerror", (erro) => falhas.push(String(erro)));
  // Sob `file://` qualquer pedido de rede que sobrasse falharia aqui.
  pagina.on("requestfailed", (req) => {
    if (!req.url().startsWith("https://fonts.")) falhas.push(`pedido falhou: ${req.url()}`);
  });

  await pagina.goto(`file://${arquivo.replaceAll("\\", "/")}`, { waitUntil: "load" });

  const contador = await pagina.textContent(".ap-posicao");
  if (contador !== `1/${esperadas}`) {
    throw new Error(`Contador do arquivo diz "${contador}", esperava "1/${esperadas}".`);
  }

  const visiveis = await pagina.locator(".ap-folha:not([hidden])").count();
  if (visiveis !== 1) throw new Error(`${visiveis} folhas visíveis ao abrir; esperava 1.`);

  /*
   * O SLIDE INTEIRO PRECISA CABER NA JANELA. Foi assim que o defeito do
   * transbordo apareceu: o rodapé da capa caía 23px abaixo da borda, em toda
   * folha, e nenhuma asserção de DOM notava — o elemento existia, só não dava
   * para vê-lo. Mede-se a caixa, não a existência.
   */
  const transborda = await pagina.evaluate(() => {
    const folha = document.querySelector(".ap-folha:not([hidden])");
    if (!folha) return "sem folha";
    const c = folha.getBoundingClientRect();
    const fora = c.bottom > window.innerHeight + 1 || c.right > window.innerWidth + 1 ||
      c.top < -1 || c.left < -1;
    return fora
      ? `folha em ${Math.round(c.left)},${Math.round(c.top)} até ${Math.round(c.right)},${Math.round(c.bottom)} numa janela de ${window.innerWidth}x${window.innerHeight}`
      : null;
  });
  if (transborda) throw new Error(`O slide não cabe na janela: ${transborda}`);

  // A tecla precisa navegar — é o único jeito de passar os slides ali.
  await pagina.keyboard.press("End");
  const fim = await pagina.textContent(".ap-posicao");
  if (fim !== `${esperadas}/${esperadas}`) {
    throw new Error(`\`End\` levou a "${fim}", esperava "${esperadas}/${esperadas}".`);
  }

  /*
   * E as notas precisam sair do atributo PARA A TELA, INTEIRAS. Voltando do fim
   * ao começo com o painel aberto, alguma folha tem de mostrar vários
   * parágrafos: é onde moram as réplicas, e é o que a versão anterior deste
   * arquivo perdia em silêncio. De quebra, a volta exercita a navegação para
   * trás, que até aqui ninguém conferia.
   */
  await pagina.keyboard.press("n");
  let maiorNota = 0;
  let blocosNaMaior = 0;
  for (let i = 0; i < esperadas; i += 1) {
    const bloco = await pagina.$$eval("#notas-texto p", (nós) => ({
      blocos: nós.length,
      caracteres: nós.reduce((soma, nó) => soma + (nó.textContent ?? "").length, 0),
    }));
    if (bloco.caracteres > maiorNota) maiorNota = bloco.caracteres;
    if (bloco.blocos > blocosNaMaior) blocosNaMaior = bloco.blocos;
    if (i < esperadas - 1) await pagina.keyboard.press("ArrowLeft");
  }
  if (maiorNota < 20) throw new Error("O painel de notas abriu vazio.");
  if (blocosNaMaior < 3) {
    throw new Error(
      `A nota mais longa do arquivo tem ${blocosNaMaior} parágrafo(s). ` +
        "As réplicas não chegaram ao pen drive.",
    );
  }
  const inicio = await pagina.textContent(".ap-posicao");
  if (inicio !== `1/${esperadas}`) {
    throw new Error(`Voltando com \`←\` cheguei a "${inicio}", esperava "1/${esperadas}".`);
  }

  await navegador.close();

  if (falhas.length) {
    throw new Error(`O arquivo não é autossuficiente:\n  ${falhas.join("\n  ")}`);
  }

  console.log(
    `   conferido do disco: ${esperadas} folhas, ida e volta pelo teclado, e a nota mais longa com ${blocosNaMaior} parágrafos.`,
  );
}

function escapar(texto) {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
