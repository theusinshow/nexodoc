// CLICAR EM AUDITAR SEM O PDF NA ABA DIZ O PORQUÊ — não fica mudo.
//
//   npm run dev                                    (noutro terminal)
//   node scripts/prova-auditar-sem-arquivo.mjs
//   (== npm run prova:auditar-sem-arquivo)
//
// 17/09/2026, Urubici: a retenção do memorial (26,8 MB) ficou pendente, a
// conversa ficou sem o arquivo e o botão AUDITAR era um `return` silencioso.
// A conversa semeada aqui é exatamente esse estado: proposta de auditoria na
// tela, sem memorial retido.
import { chromium } from "playwright";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
};

const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ baseURL: BASE, viewport: { width: 1600, height: 1000 } });
  const pg = await ctx.newPage();
  await pularTourGuiado(pg);
  await pg.goto("/nexo");
  if (pg.url().includes("/login")) {
    await pg.getByRole("button", { name: /Entrar como dev/i }).click();
    await pg.waitForURL("**/nexo**", { timeout: 60_000 });
  }
  await pg.waitForLoadState("networkidle");

  await pg.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("nexo");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const agora = Date.now();
    const registro = {
      id: "sem-arquivo-0000-0000-000000000031",
      title: "ESCOLA MUNICIPAL VALDIRENE ARRUDA DA CUNHA BORGUEZAN",
      tipo: "auditoria",
      createdAt: agora - 600000,
      updatedAt: agora - 1000,
      folderKey: "031-26-URUBICI",
      identidade: { obra: "ESCOLA MUNICIPAL VALDIRENE ARRUDA DA CUNHA BORGUEZAN", orgao: "PREFEITURA MUNICIPAL DE URUBICI", codigo: "031-26" },
      // Sem `memorial`: é o estado em que a retenção não completou.
      messages: [
        { id: "m1", role: "user", content: "audita o memorial" },
        {
          id: "m2",
          role: "assistant",
          content: "Vou auditar o memorial descritivo.",
          proposals: [{ kind: "auditoria", params: { nivel: "deep" }, resumo: "Auditoria" }],
        },
      ],
      seloResults: [],
      results: [],
      auditorias: [],
    };
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put(registro);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  });
  await pg.reload({ waitUntil: "networkidle" });
  await pg.getByText(/ESCOLA MUNICIPAL VALDIRENE/).first().click();
  await pg.waitForTimeout(2500);

  const botao = pg.getByRole("button", { name: /^AUDITAR$/i }).first();
  await botao.waitFor({ state: "visible", timeout: 20_000 });
  check("o cartão de auditoria está na tela", await botao.isVisible());

  /*
   * O BOTÃO CONTINUA DESLIGADO — e é assim que tem de ser: sem o arquivo não há
   * o que auditar. O que a prova exige é que a TELA DIGA por quê, no lugar de um
   * botão que não responde e um texto cinza que ninguém lê.
   */
  check("o botão está desligado, e não mudo", (await botao.isEnabled()) === false);
  const aviso = pg.getByText(/não está nesta aba/i).first();
  check("a tela diz por que ele está desligado", (await aviso.count()) > 0);
  const caixa = await aviso.boundingBox().catch(() => null);
  const janela = pg.viewportSize();
  check(
    "e o aviso está DENTRO da janela",
    Boolean(caixa) && caixa.y >= 0 && caixa.y + caixa.height <= janela.height,
    JSON.stringify({ caixa, janela }),
  );
  const texto = await pg.locator("body").innerText();
  check("diz o que fazer para religá-lo", /Arraste o arquivo para o chat/i.test(texto));
  check("e nenhuma auditoria começou", !/analisando|lendo o documento/i.test(texto));
  await pg.screenshot({ path: "docs/provas/prova-auditar-sem-arquivo.png" }).catch(() => {});
} finally {
  await navegador.close();
}
console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
