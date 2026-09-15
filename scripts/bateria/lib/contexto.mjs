// O `ctx` de uma jornada. `verificar` registra e segue: uma jornada relata
// todas as falhas de uma vez, em vez de parar na primeira e esconder as outras.
import path from "node:path";

import { pularTourGuiado } from "../../lib/sessao-de-teste.mjs";
import { consultar } from "./banco.mjs";
import { garantirFixtures } from "./fixtures.mjs";

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

    // Rola até o elemento antes de medir: um texto fora da dobra passaria em
    // `count()` sem nunca ter chegado aos olhos de quem lê a tela.
    async visivelRolando(locator) {
      await locator.first().scrollIntoViewIfNeeded().catch(() => {});
      return ctx.visivel(locator);
    },

    /** Os documentos sintéticos da segunda rodada (ver fixtures.mjs). */
    fixtures: garantirFixtures,

    /** Escreve no composer do chat e envia com Enter, como o engenheiro faz. */
    async escrever(texto, pagina = page) {
      const campo = pagina.locator('[data-tour="composer"] textarea').last();
      await campo.waitFor({ timeout: 30_000 });
      await campo.fill(texto);
      await campo.press("Enter");
    },

    /**
     * A conversa SOB TESTE é a que o produto lembra como aberta — não "a de
     * `updatedAt` mais alto", que numa bateria com mais conversas pode ser
     * outra (o falso positivo do projeto de exemplo, agosto de 2026).
     */
    async conversaAberta(pagina = page) {
      return pagina.evaluate(() => localStorage.getItem("nexo:ultima-conversa"));
    },

    async lerConversa(id) {
      if (!id) return null;
      return (await ctx.indexeddb.lerConversas()).find((c) => c.id === id) ?? null;
    },

    /**
     * As linhas de "Audit" que ESTA conversa criou, pelos `auditId` que ela
     * registrou na largada (`registrarAuditoria`). Nunca por relógio: em
     * 14/09/2026 `"createdAt" >= inicio` deixou a auditoria da a1 entrar na a3,
     * e o `now()` do banco estava 29s atrás da máquina.
     */
    async auditoriasDaConversa(id) {
      const registradas = (await ctx.lerConversa(id))?.auditorias ?? [];
      const linhas =
        registradas.length === 0
          ? []
          : await consultar(
              `select id, status, "projectId", report->'runtime'->'passadas_incompletas' as passadas from "Audit" where id = any($1::text[])`,
              [registradas.map((a) => a.auditId)],
            );
      return { registradas, linhas };
    },

    /** Anexa o memorial, espera a leitura e pede a auditoria pelo chip. */
    async abrirCartaoDeAuditoria(caminho) {
      await ctx.anexar([caminho]);
      await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
      await (await ctx.esperarBotao(/Auditar o memorial/, 30_000)).click();
    },

    /**
     * O "Auditar" do cartão mais novo. `esperarBotao` espera habilitar: o botão
     * nasce "Conferindo páginas…" e desabilitado até o diagnóstico das folhas
     * voltar (ConfirmationCard, 14/09/2026 17:49).
     */
    async auditarNoCartao() {
      await (await ctx.esperarBotao(/^Auditar$/, 120_000)).click();
    },

    async esperarParecer(quantos = 1, ms = 300_000) {
      const ver = page.getByRole("button", { name: /Ver o parecer/ });
      await ver.nth(quantos - 1).waitFor({ timeout: ms });
      return ver;
    },

    /**
     * Um texto que passa pela tela por um instante ("Conferindo páginas…" num
     * memorial de quatro páginas) não é pego por `waitFor` depois do fato. O
     * observador fica na página e anota a primeira vez que o texto aparece.
     */
    async vigiar(nome, texto, pagina = page) {
      await pagina.evaluate(
        ({ nome, texto }) => {
          const w = window;
          w.__bateriaVistos ??= {};
          if (document.body.textContent.includes(texto)) {
            w.__bateriaVistos[nome] = true;
            return;
          }
          w.__bateriaVistos[nome] = false;
          const obs = new MutationObserver(() => {
            if (document.body.textContent.includes(texto)) {
              w.__bateriaVistos[nome] = true;
              obs.disconnect();
            }
          });
          obs.observe(document.body, { subtree: true, childList: true, characterData: true });
        },
        { nome, texto },
      );
    },

    async viu(nome, pagina = page) {
      return pagina.evaluate((n) => Boolean(window.__bateriaVistos?.[n]), nome);
    },

    /** Conta as requisições que passam no filtro, até `parar()`. */
    contarRequisicoes(filtro, pagina = page) {
      let n = 0;
      const ouvir = (req) => {
        if (filtro(req)) n++;
      };
      pagina.on("request", ouvir);
      return { total: () => n, parar: () => pagina.off("request", ouvir) };
    },

    /** A barra lateral marca a conversa aberta com `aria-current` (CartaoDeProjeto.tsx). */
    async marcadaNaBarra(titulo, pagina = page) {
      const marcada = pagina.locator('button[aria-current="true"]');
      const n = await marcada.count();
      const texto = n > 0 ? await marcada.first().innerText() : "";
      return { ok: n === 1 && texto.includes(titulo), detalhe: `marcadas=${n} texto=${JSON.stringify(texto.slice(0, 80))}` };
    },

    /** Repete a condição até ela valer ou o prazo acabar; devolve a última leitura. */
    async esperar(condicao, ms, passo = 1000) {
      const fim = Date.now() + ms;
      while (Date.now() < fim) {
        if (await condicao()) return true;
        await page.waitForTimeout(passo);
      }
      return Boolean(await condicao());
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
