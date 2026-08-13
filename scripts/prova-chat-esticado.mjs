// O chat cabe na janela — prova de tela, sem gastar um token.
//
// O QUE ESTA PROVA IMPEDE DE VOLTAR
//
// O painel do copiloto crescia com o histórico da conversa. Com 40 mensagens
// numa janela de 900px ele media 8140px: o log parava de rolar por dentro
// (`scrollHeight === clientHeight`, sinal de que ele não é mais o que rola), o
// composer ia para `y=8078` — sete mil pixels abaixo da dobra — e quem rolava
// era a PÁGINA, arrastando a barra lateral e o canvas junto.
//
// A causa não estava no chat. Estava na colocação no grid do shell: as áreas
// não declaravam linha, e contavam com a barra do topo ocupar a primeira. Como
// `.nexo-shell__barra:empty` some do fluxo sempre que não há obra lida (o caso
// comum), as colunas caíam na linha `auto` — que não tem teto.
//
// POR QUE MEDIR A CAIXA, E NÃO O DOM
//
// Toda asserção de presença passava verde com o defeito de pé: o composer
// existia, o log existia, as classes estavam lá. O que estava errado era
// geometria. Por isso aqui se mede altura contra a janela, e se confere quem
// rola — o log ou o documento.
//
// Nenhuma chamada de modelo: a conversa é semeada no IndexedDB, como as outras
// provas fazem.
//
//   node scripts/prova-chat-esticado.mjs   (== npm run prova:chat-esticado)
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

/** As caixas que interessam, todas na mesma leitura para não competirem. */
async function medir(page) {
  return page.evaluate(() => {
    const caixa = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        y: Math.round(r.y),
        h: Math.round(r.height),
        fim: Math.round(r.bottom),
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
      };
    };
    const doc = document.documentElement;
    return {
      janela: { w: innerWidth, h: innerHeight },
      documento: { scrollH: doc.scrollHeight, clientH: doc.clientHeight },
      copilot: caixa(document.querySelector(".nexo-shell__copilot")),
      log: caixa(document.querySelector('[role="log"]')),
      composer: caixa(document.querySelector(".nexo-composer")),
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  await page.waitForTimeout(2000);

  // --- 1. semeia uma conversa LONGA ---------------------------------------
  /*
   * Quarenta mensagens é o número que faz a diferença aparecer: com poucas, o
   * conteúdo cabe na janela e o defeito não se manifesta — a linha `auto`
   * também mede pouco. O bug só se enxerga quando há mais conversa do que tela.
   */
  await page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const messages = [];
    for (let i = 0; i < 40; i++) {
      messages.push({
        id: `m${i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Mensagem ${i} — texto longo o bastante para empurrar a coluna. `.repeat(6),
        createdAt: agora + i,
      });
    }
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: "qa-chat-esticado",
        title: "QA CHAT ESTICADO",
        createdAt: agora,
        updatedAt: agora,
        messages,
        seloResults: [],
        results: [],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await page
    .getByText("QA CHAT ESTICADO", { exact: false })
    .first()
    .click({ timeout: 15000 });
  await page.waitForTimeout(1500);

  /*
   * ESTA CONVERSA NÃO TEM BARRA DO TOPO, e é de propósito: sem selo lido e sem
   * auditoria, `BarraDoNexo` devolve `null`. É exatamente a situação em que a
   * linha do grid sumia e o chat esticava. Provar com a barra presente esconde
   * o defeito.
   */
  const temBarra = await page.locator(".nexo-barra").count();
  check("o caso é o SEM barra do topo (o que esticava)", temBarra === 0, `count=${temBarra}`);

  // --- 2. a caixa, contra a janela ----------------------------------------
  const m = await medir(page);
  await page.screenshot({ path: `${OUT}/chat-1-quarenta-mensagens.png` });

  check("o copiloto tem caixa", Boolean(m.copilot));
  check(
    "o copiloto cabe na janela",
    m.copilot != null && m.copilot.h <= m.janela.h,
    `altura=${m.copilot?.h} janela=${m.janela.h}`,
  );
  check(
    "a página não rola: quem rola é o log",
    m.documento.scrollH <= m.documento.clientH + 1,
    `documento=${m.documento.scrollH} janela=${m.documento.clientH}`,
  );
  check(
    "o log rola por dentro",
    m.log != null && m.log.scrollH > m.log.clientH,
    `scrollH=${m.log?.scrollH} clientH=${m.log?.clientH}`,
  );
  check(
    "o composer está visível, no rodapé",
    m.composer != null && m.composer.fim <= m.janela.h && m.composer.y > m.janela.h / 2,
    `y=${m.composer?.y} fim=${m.composer?.fim} janela=${m.janela.h}`,
  );

  // --- 3. o composer cresce SEM levar o resto junto ------------------------
  /*
   * O campo tem auto-grow com teto (`max-h-32`). O que se confere aqui é que o
   * crescimento dele encolhe o log, e não empurra o rodapé para fora da tela —
   * a diferença entre um painel contido e um painel esticado.
   */
  const campo = page.locator(".nexo-composer textarea").first();
  await campo.fill("linha\n".repeat(12));
  await campo.dispatchEvent("input");
  await page.waitForTimeout(400);

  const cheio = await medir(page);
  await page.screenshot({ path: `${OUT}/chat-2-composer-cheio.png` });

  check(
    "o composer cresceu de verdade",
    cheio.composer != null && m.composer != null && cheio.composer.h > m.composer.h,
    `antes=${m.composer?.h} depois=${cheio.composer?.h}`,
  );
  check(
    "com o composer cheio, o rodapé continua dentro da janela",
    cheio.composer != null && cheio.composer.fim <= cheio.janela.h,
    `fim=${cheio.composer?.fim} janela=${cheio.janela.h}`,
  );
  check(
    "quem cedeu altura foi o log, não a janela",
    cheio.log != null && m.log != null && cheio.log.clientH < m.log.clientH,
    `log antes=${m.log?.clientH} depois=${cheio.log?.clientH}`,
  );
  check(
    "a página segue sem rolar",
    cheio.documento.scrollH <= cheio.documento.clientH + 1,
    `documento=${cheio.documento.scrollH}`,
  );

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/chat-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
