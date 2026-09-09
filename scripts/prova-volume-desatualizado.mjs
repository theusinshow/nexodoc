// A PROVA de que o volume envelhecido aparece — e sem gastar um token.
//
// Semeia no IndexedDB uma conversa que já tem um volume montado e a LD dele,
// com a LD gerada DEPOIS do volume (é exatamente o que acontece quando o
// engenheiro pede "arruma o título da LD" com o volume já baixado). Recarrega,
// e exige que o card de volumes desatualizados nasça sozinho, com o motivo
// escrito e DENTRO DA JANELA.
//
// A medida da caixa contra a janela não é preciosismo: asserção de DOM passa
// verde com o painel fora da tela, e "aparece no DOM" não é "o engenheiro vê".
//
//   node scripts/prova-volume-desatualizado.mjs
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
  await page.waitForTimeout(1500);

  const convId = await page.evaluate(async () => {
    const convId = `qa-volume-velho-${Date.now()}`;
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const MONTADO_EM = agora - 600000; // o volume saiu há 10 min
    const LD_CORRIGIDA_EM = agora - 60000; // a LD foi refeita há 1 min

    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA — volume velho",
        createdAt: agora,
        updatedAt: agora,
        tipo: "volume",
        messages: [
          { id: "m1", role: "user", content: "monta o volume" },
          { id: "m2", role: "assistant", content: "Volume montado." },
        ],
        seloResults: [],
        results: [
          {
            artifactId: "ld:qa",
            kind: "ld",
            summary: "LD METALÚRGICO · 27 folhas",
            canvas: { label: "LD METALÚRGICO", titulo: "METALÚRGICO", pageNumber: 1 },
            payload: { tituloLd: "PROJETO ESTRUTURAL METÁLICO", tomo: 2 },
            // O que denuncia o volume: a LD é MAIS NOVA que ele.
            generatedAt: LD_CORRIGIDA_EM,
            files: [],
          },
          {
            artifactId: "vol:qa",
            kind: "volume",
            summary: "Volume montado · 31 páginas",
            canvas: { label: "Volume", pageNumber: 1 },
            payload: {
              tomo: 2,
              folhas: "a|b",
              partes: [{ id: "ld:qa", em: MONTADO_EM }],
              conferencia: null,
            },
            generatedAt: MONTADO_EM,
            files: [],
          },
        ],
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    // "Onde eu parei": é assim que o F5 de verdade reabre a conversa, e é o
    // caminho que o engenheiro percorre ao voltar do almoço com o volume já
    // montado na tela.
    localStorage.setItem("nexo:ultima-conversa", convId);
    return convId;
  });
  console.log(`       conversa semeada: ${convId}`);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const aviso = page.getByText(/Volume desatualizado/i).first();
  await aviso.waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/vd-1-card.png` });

  const texto = await page.locator("body").innerText();
  check("o card nasce sozinho, sem ninguém pedir", /Volume desatualizado/i.test(texto));
  check(
    "o motivo diz QUAL peça envelheceu, com o nome dela",
    /LD METALÚRGICO foi gerada de novo depois deste volume/i.test(texto),
    texto.slice(0, 400),
  );
  check("o rótulo identifica o tomo", /TOMO 02 · METALÚRGICO/i.test(texto));

  /*
   * DENTRO DA JANELA. A caixa medida contra o viewport — sem isto a asserção
   * de DOM passa com o card empurrado para fora da tela.
   */
  const caixa = await aviso.boundingBox();
  const vp = page.viewportSize();
  check("o card está DENTRO da janela", Boolean(caixa), "sem caixa = não renderizou");
  if (caixa) {
    console.log(
      `       caixa: x=${Math.round(caixa.x)} y=${Math.round(caixa.y)} ${Math.round(caixa.width)}×${Math.round(caixa.height)} | janela ${vp.width}×${vp.height}`,
    );
    check("  x dentro", caixa.x >= 0 && caixa.x + caixa.width <= vp.width);
    check("  y dentro", caixa.y >= 0 && caixa.y + caixa.height <= vp.height);
    check("  tem altura de verdade", caixa.height > 8);
  }

  /*
   * SEM AS PRANCHAS não há botão. Os bytes vivem em memória: nesta conversa
   * retomada eles não existem, e um botão que entregasse um volume com capa,
   * LD e nada dentro seria pior do que botão nenhum.
   */
  check(
    "sem os bytes das pranchas, o card explica em vez de fingir um botão",
    /arquivos das pranchas não estão nesta máquina/i.test(texto),
  );
  check(
    "e não desenha o botão de remontar",
    !/Remontar e baixar/i.test(texto),
  );

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/vd-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
