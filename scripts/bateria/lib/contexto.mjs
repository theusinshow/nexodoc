// O `ctx` de uma jornada. `verificar` registra e segue: uma jornada relata
// todas as falhas de uma vez, em vez de parar na primeira e esconder as outras.
import path from "node:path";

import { pularTourGuiado } from "../../lib/sessao-de-teste.mjs";
import { consultar } from "./banco.mjs";

export async function criarContexto({ browser, base }) {
  const contexto = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await contexto.newPage();
  const falhas = [];
  const erros = [];
  page.on("pageerror", (e) => erros.push(String(e)));
  await pularTourGuiado(page);

  async function abrirBanco() {
    return page.evaluate(
      () =>
        new Promise((res, rej) => {
          const r = indexedDB.open("nexo");
          r.onsuccess = () => {
            r.result.close();
            res(true);
          };
          r.onerror = () => rej(r.error);
        }),
    );
  }

  const ctx = {
    page,
    base,
    falhas,
    erros,

    async login() {
      await page.goto(`${base}/nexo`, { waitUntil: "domcontentloaded" });
      if (page.url().includes("/login")) {
        await page.getByRole("button", { name: /Entrar como dev/i }).click();
        await page.waitForURL("**/nexo**", { timeout: 60_000 });
      }
      await page.waitForTimeout(1500);
      // A rota da fila exige sessão (401 sem login): limpar AQUI, depois de logado,
      // é o que evita que uma falha enfileirada por uma jornada vaze para a próxima.
      await ctx.ia.limpar();
    },

    async abrirOutraAba() {
      const outra = await contexto.newPage();
      await pularTourGuiado(outra);
      await outra.goto(`${base}/nexo`, { waitUntil: "domcontentloaded" });
      return outra;
    },

    ia: {
      async fila(operation, comportamento) {
        const r = await page.request.post(`${base}/api/teste/ia`, { data: { operation, comportamento } });
        if (!r.ok()) throw new Error(`fila da IA simulada recusou (${r.status()}): ${await r.text()}`);
      },
      async limpar() {
        const r = await page.request.delete(`${base}/api/teste/ia`);
        if (!r.ok()) throw new Error(`limpar a fila da IA simulada falhou (${r.status()}): ${await r.text()}`);
      },
    },

    banco: { consultar },

    indexeddb: {
      async gravarConversa(registro) {
        await abrirBanco();
        await page.evaluate(async (reg) => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("nexo");
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          await new Promise((res, rej) => {
            const tx = db.transaction("conversations", "readwrite");
            tx.objectStore("conversations").put(reg);
            tx.oncomplete = () => res();
            tx.onerror = () => rej(tx.error);
          });
          db.close();
        }, registro);
      },
      async lerConversas() {
        return page.evaluate(async () => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open("nexo");
            r.onsuccess = () => res(r.result);
            r.onerror = () => rej(r.error);
          });
          const todas = await new Promise((res, rej) => {
            const q = db.transaction("conversations").objectStore("conversations").getAll();
            q.onsuccess = () => res(q.result);
            q.onerror = () => rej(q.error);
          });
          db.close();
          return todas;
        });
      },
    },

    async abrirConversa(titulo) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2000);
      await page.getByText(titulo).first().click({ timeout: 30_000 });
      await page.waitForTimeout(2500);
    },

    /** O input de ANEXO DO CHAT. O primeiro input da página é o de pasta. */
    async anexar(caminhos) {
      const absolutos = caminhos.map((c) => path.resolve(c));
      await page.locator('input[type="file"][accept="application/pdf,image/*"]').first().setInputFiles(absolutos);
    },

    async esperarTexto(regex, ms = 60_000) {
      await page.getByText(regex).first().waitFor({ timeout: ms });
    },

    async esperarBotao(regex, ms = 60_000) {
      const botao = page.getByRole("button", { name: regex }).last();
      await botao.waitFor({ timeout: ms });
      const fim = Date.now() + ms;
      while (Date.now() < fim && (await botao.isDisabled())) await page.waitForTimeout(500);
      return botao;
    },

    /** Visível DE VERDADE: a caixa dentro da janela, não só presente no DOM. */
    async visivel(locator) {
      const caixa = await locator.first().boundingBox().catch(() => null);
      if (!caixa) return false;
      const janela = page.viewportSize();
      return caixa.width > 0 && caixa.height > 0 && caixa.y < janela.height && caixa.x < janela.width && caixa.y + caixa.height > 0;
    },

    verificar(nome, condicao, detalhe = "") {
      if (condicao) console.log(`      ok  ${nome}`);
      else {
        console.log(`      FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
        falhas.push(`${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
      }
    },

    async fechar() {
      await contexto.close();
    },
  };

  return ctx;
}
