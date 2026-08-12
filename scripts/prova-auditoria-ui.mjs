// A UI DO RESULTADO DA AUDITORIA, na escala real: 45 achados em 28 páginas de
// um memorial de verdade. Nenhum token — o parecer é semeado.
//
// Nasceu como repro do "piscando" e virou o portão das três mudanças:
//   · a BARRA DE VISTAS manda (Resumo / Achados / Relatório / No documento) e
//     não sobrou um segundo seletor de vista dentro do parecer;
//   · o HOVER não apaga a cena — antes, tocar um card mandava 21 das 56 arestas
//     para 15% de opacidade, e atravessar a grade era uma sequência de apagões;
//   · o CLIQUE num achado abre o parecer nele.
//
// Ele não julga beleza. Mede o que uma asserção de DOM deixaria passar: brilho
// computado antes e depois do ponteiro, e remontagem de miniatura.
//
//   npm run prova:auditoria   (node scripts/prova-auditoria-ui.mjs)
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NEXO - TESTES\\Memoriais\\013_26_md_geral_a.pdf";

fs.mkdirSync(OUT, { recursive: true });

/*
 * 45 achados em 28 páginas — as mesmas ordens de grandeza do print: várias
 * páginas com 2 e 3 achados, o resto com um. O texto da evidência não precisa
 * existir no PDF: sem trecho localizado o nó ainda desenha, e o que está sendo
 * medido é a remontagem da miniatura, não o pin.
 */
const PAGINAS = [2, 8, 11, 12, 13, 14, 17, 19, 20, 21, 23, 24, 26, 27, 29, 30, 32, 34, 36, 37, 39, 40, 44, 48, 52, 58, 71, 76];
const ACHADOS = [];
for (let i = 0; i < 45; i++) {
  const pagina = PAGINAS[i % PAGINAS.length];
  ACHADOS.push({
    pagina: String(pagina),
    tipo: ["Quantitativo", "Norma", "Especificação / material", "Redação / editorial"][i % 4],
    evidencia: `trecho de conferência ${i + 1} na página ${pagina}`,
  });
}

const pdfB64 = fs.readFileSync(MEMORIAL).toString("base64");
const nomeDoPdf = MEMORIAL.split(/[\\/]/).pop();

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

  const titulo = "QA — canvas piscando";
  await page.evaluate(
    async ({ pdfB64, nomeDoPdf, achados, titulo }) => {
      const convId = "qa-canvas-piscando";
      const bytes = Uint8Array.from(atob(pdfB64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo");
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction("result_blobs", "readwrite");
        tx.objectStore("result_blobs").put({ key: `${convId}:memorial`, blob });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      const agora = Date.now();
      const report = {
        tipo_auditoria: "memorial",
        tipo_documento: "memorial descritivo",
        obra: "Revitalização do Centro de Convivência da Costeira",
        codigo: "013-26",
        municipio: "Florianópolis",
        data_documento: "",
        status_analise: "concluida",
        status_geral: "com inconsistências críticas",
        total_incongruencias: achados.length,
        arquivos_analisados: [],
        comparacoes: [],
        conclusao: "Parecer semeado para medir o piscar.",
        incongruencias: achados.map((a, i) => ({
          id: `INC-${String(i + 1).padStart(3, "0")}`,
          prioridade: i % 5 === 0 ? "Alta" : "Media",
          pagina: a.pagina,
          capitulo: "",
          local: "",
          tipo: a.tipo,
          descricao: "Achado semeado.",
          evidencia: a.evidencia,
          conflito: "Diverge do declarado.",
          sugestao_correcao: "Conferir e corrigir.",
          confianca: "alta",
          origem: i % 3 === 0 ? "regra" : "ia",
          impacto: i % 5 === 0 ? "critico_documental" : "tecnico_contratual",
        })),
      };
      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: titulo,
          createdAt: agora,
          updatedAt: agora,
          messages: [
            { id: "m1", role: "user", content: `Anexei o memorial — ${nomeDoPdf}` },
            { id: "m2", role: "assistant", content: "Auditoria concluída." },
          ],
          seloResults: [],
          results: [
            {
              artifactId: "auditoria:qa-piscando",
              kind: "auditoria",
              summary: "Auditoria do memorial",
              files: [],
              payload: { auditId: "qa-piscando", texto: "RESULTADO DA AUDITORIA", report },
            },
          ],
          memorial: { name: nomeDoPdf, blobKey: `${convId}:memorial` },
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    { pdfB64, nomeDoPdf, achados: ACHADOS, titulo },
  );

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page
    .locator("aside button, [class*=sidebar] button")
    .filter({ hasText: /canvas piscando/i })
    .first()
    .click();
  await page.waitForTimeout(2500);

  const chipAuditoria = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chipAuditoria.count()) > 0) await chipAuditoria.first().click();
  await page.waitForTimeout(800);

  // ------------------------------------------------ a barra de vistas
  /*
   * As quatro vistas num degrau só. O que se prova aqui não é beleza: é que a
   * barra MANDA — clicar em cada aba troca o conteúdo — e que não sobrou um
   * segundo seletor de vista dentro do parecer, que era a hierarquia dupla.
   */
  const aba = (nome) => page.getByRole("button", { name: nome }).first();
  const vistas = ["Resumo", "Achados", "Relatório", "No documento"];
  const achou = [];
  for (const v of vistas) achou.push((await aba(new RegExp(`^${v}`, "i")).count()) > 0);
  console.log("\n  BARRA DE VISTAS:");
  console.log(`    as quatro vistas na barra: ${vistas.filter((_, i) => achou[i]).join(", ")}`);

  await aba(/^Achados/i).click();
  await page.waitForTimeout(700);
  const emAchados = await page.locator("[data-achado]").count();
  await aba(/^Relatório/i).click();
  await page.waitForTimeout(700);
  const emRelatorio = await page.locator("[data-achado]").count();
  await aba(/^Resumo/i).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/piscando-0-barra-de-vistas.png` });
  console.log(`    Achados mostra os cartões:  ${emAchados} cartão(ões)`);
  console.log(`    Relatório troca o conteúdo: ${emRelatorio === 0 ? "sim" : "NÃO"}`);
  // O controle segmentado antigo (Resumo/Achados/Relatório dentro do parecer)
  // não pode coexistir com a barra: é a hierarquia dupla que se foi.
  const tituloAntigo = await page.getByText("Resultado da auditoria", { exact: true }).count();
  console.log(`    seletor duplicado no parecer: ${tituloAntigo === 0 ? "não" : "AINDA EXISTE"}`);
  /*
   * O observador entra ANTES do clique. A primeira medição olhava só o repouso
   * e dava tudo verde — a carga, que é onde 28 miniaturas do MESMO PDF entram
   * uma a uma, ficava fora do quadro. Medir depois de assentar é medir depois
   * do sintoma.
   */
  await page.evaluate(() => {
    window.__carga = { esqueletosEntraram: 0, esqueletosSairam: 0, canvasEntraram: 0, linha: [] };
    const conta = (n, sel) =>
      n instanceof HTMLElement ? (n.matches?.(sel) ? 1 : (n.querySelectorAll?.(sel).length ?? 0)) : 0;
    window.__obsCarga = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          window.__carga.esqueletosEntraram += conta(n, "[data-slot=skeleton], .animate-pulse");
          window.__carga.canvasEntraram += conta(n, "canvas");
        }
        for (const n of m.removedNodes) {
          window.__carga.esqueletosSairam += conta(n, "[data-slot=skeleton], .animate-pulse");
        }
      }
    });
    window.__obsCarga.observe(document.body, { childList: true, subtree: true });
    window.__amostraCarga = setInterval(() => {
      window.__carga.linha.push([
        document.querySelectorAll(".react-flow__viewport canvas").length,
        document.querySelectorAll(".react-flow__viewport [data-slot=skeleton], .react-flow__viewport .animate-pulse").length,
      ]);
    }, 500);
  });

  await page.getByRole("button", { name: /No documento/i }).first().click();

  console.log("  medindo a CARGA por 25s…");
  await page.waitForTimeout(25000);
  const carga = await page.evaluate(() => {
    window.__obsCarga.disconnect();
    clearInterval(window.__amostraCarga);
    const l = window.__carga.linha;
    return {
      ...window.__carga,
      linha: l.map(([c, e]) => `${c}/${e}`).join(" "),
      segundosAteOUltimo: (l.findIndex(([c]) => c >= 28) + 1) / 2,
    };
  });
  console.log("\n  DURANTE A CARGA (25s):");
  console.log(`    esqueletos que entraram: ${carga.esqueletosEntraram}`);
  console.log(`    esqueletos que saíram:   ${carga.esqueletosSairam}`);
  console.log(`    canvas que entraram:     ${carga.canvasEntraram}`);
  console.log(`    até a última miniatura:  ${carga.segundosAteOUltimo}s`);
  console.log(`    canvas/esqueleto a cada 0,5s:\n      ${carga.linha}`);
  await page.screenshot({ path: `${OUT}/piscando-1-assentado.png` });

  // ------------------------------------------------------ medição, mouse parado
  const medida = await page.evaluate(() => {
    return new Promise((resolve) => {
      const alvo = document.querySelector(".react-flow__viewport") ?? document.body;
      let canvasAdicionados = 0;
      let canvasRemovidos = 0;
      let esqueletos = 0;
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.addedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            canvasAdicionados += n.matches?.("canvas") ? 1 : n.querySelectorAll?.("canvas").length ?? 0;
            esqueletos += n.className?.toString?.().includes?.("animate-pulse") ? 1 : 0;
          }
          for (const n of m.removedNodes) {
            if (!(n instanceof HTMLElement)) continue;
            canvasRemovidos += n.matches?.("canvas") ? 1 : n.querySelectorAll?.("canvas").length ?? 0;
          }
        }
      });
      obs.observe(alvo, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve({
          canvasAdicionados,
          canvasRemovidos,
          esqueletos,
          canvasNaTela: document.querySelectorAll(".react-flow__viewport canvas").length,
          nos: document.querySelectorAll(".react-flow__node").length,
        });
      }, 10000);
    });
  });

  console.log("\n  COM O MOUSE PARADO, 10s depois de assentar:");
  console.log(`    canvas montados:   ${medida.canvasAdicionados}`);
  console.log(`    canvas removidos:  ${medida.canvasRemovidos}`);
  console.log(`    esqueletos novos:  ${medida.esqueletos}`);
  console.log(`    canvas na tela:    ${medida.canvasNaTela} (nós: ${medida.nos})`);
  console.log(
    medida.canvasAdicionados + medida.canvasRemovidos > 0
      ? "    → PISCA SOZINHO: as miniaturas remontam sem ninguém tocar."
      : "    → parado. O piscar deve vir da interação (hover), não do repouso.",
  );

  // ------------------------------------------------------ medição, um hover só
  const antes = await page.locator(".react-flow__viewport canvas").count();
  const card = page.locator(".react-flow__node").nth(3);
  await card.hover().catch(() => {});
  await page.waitForTimeout(400);
  const noHover = await page.evaluate(() => {
    return new Promise((resolve) => {
      const alvo = document.querySelector(".react-flow__viewport") ?? document.body;
      let removidos = 0;
      let adicionados = 0;
      const obs = new MutationObserver((muts) => {
        for (const m of muts) {
          for (const n of m.removedNodes)
            if (n instanceof HTMLElement)
              removidos += n.matches?.("canvas") ? 1 : n.querySelectorAll?.("canvas").length ?? 0;
          for (const n of m.addedNodes)
            if (n instanceof HTMLElement)
              adicionados += n.matches?.("canvas") ? 1 : n.querySelectorAll?.("canvas").length ?? 0;
        }
      });
      obs.observe(alvo, { childList: true, subtree: true });
      setTimeout(() => {
        obs.disconnect();
        resolve({ removidos, adicionados });
      }, 3000);
    });
  });
  console.log("\n  DEPOIS DE UM HOVER num nó:");
  console.log(`    canvas antes:      ${antes}`);
  console.log(`    canvas removidos:  ${noHover.removidos}`);
  console.log(`    canvas montados:   ${noHover.adicionados}`);
  await page.screenshot({ path: `${OUT}/piscando-2-pos-hover.png` });

  // ------------------------------ medição, o ponteiro ATRAVESSANDO a vista
  /*
   * É assim que se olha o documento: arrastando o olho (e o ponteiro) pela
   * grade. Cada nó que o ponteiro toca apaga TODOS os outros e reacende ao
   * sair — com 32 nós, atravessar a tela é uma sequência de apagões.
   */
  /*
   * A primeira versão varria coordenadas fixas e media a opacidade do primeiro
   * filho de cada nó — passava ao lado dos nós e olhava o elemento errado. Agora
   * o ponteiro entra em nós DE VERDADE (locator.hover), e o que se conta é o
   * escurecimento REAL: quantas ARESTAS caem para 0,15 e quantos cartões para
   * 0,3, que é o apagão que se enxerga.
   */
  /*
   * O que se mede é a MUDANÇA, não o valor absoluto. Contar "arestas abaixo de
   * 0,5" comparava contra um limiar arbitrário e mudava de significado junto
   * com o desenho. O olho não vê opacidade: vê o que MUDOU de um quadro para o
   * outro — e uma piscada é justamente meia cena mudando de brilho ao mesmo
   * tempo.
   */
  const fotografar = () =>
    page.evaluate(() => {
      const arestas = [...document.querySelectorAll(".react-flow__edge path")].map((p) =>
        Number(getComputedStyle(p).opacity).toFixed(2),
      );
      const nos = [...document.querySelectorAll(".react-flow__node")].map((n) => {
        const alvo = n.querySelector("[style*=opacity]") ?? n.firstElementChild;
        return alvo ? Number(getComputedStyle(alvo).opacity).toFixed(2) : "1.00";
      });
      return { arestas, nos };
    });
  /*
   * E a mudança tem SINAL. Realçar o par acende alguns elementos; o apagão
   * escurece dezenas. Só o segundo é piscada — por isso o que conta são os que
   * ESCURECERAM, não a quantidade de mexidas.
   */
  const diferenca = (a, b) => {
    const conta = (x, y, cmp) =>
      x.reduce((n, v, i) => n + (cmp(Number(y[i]), Number(v)) ? 1 : 0), 0);
    const menor = (novo, velho) => novo < velho - 0.001;
    const maior = (novo, velho) => novo > velho + 0.001;
    return {
      escureceram:
        conta(a.arestas, b.arestas, menor) + conta(a.nos, b.nos, menor),
      clarearam: conta(a.arestas, b.arestas, maior) + conta(a.nos, b.nos, maior),
    };
  };

  const foto0 = await fotografar();
  const medirCena = async () => {
    const f = await fotografar();
    return {
      arestas: f.arestas.length,
      nos: f.nos.length,
      ...diferenca(foto0, f),
      apagadas: f.arestas.filter((o) => Number(o) < 0.5).length,
      escuros: f.nos.filter((o) => Number(o) < 0.9).length,
    };
  };

  const repouso = await medirCena();
  /*
   * Os CARDS, não as páginas. `acender` só reage a nó com `achadoId`/`achadoIds`
   * — passar o ponteiro por uma página não acende nada, e foi por isso que a
   * medição anterior deu tudo zero. Os cards vêm depois das páginas na lista.
   */
  const total = await page.locator(".react-flow__node").count();
  const primeiroCard = await page.locator(".react-flow__node").count().then(() => 28);
  const quantos = Math.min(6, total - primeiroCard);
  const passos = [];
  for (let i = 0; i < quantos; i++) {
    await page
      .locator(".react-flow__node")
      .nth(primeiroCard + i)
      .hover({ force: true })
      .catch(() => {});
    await page.waitForTimeout(250);
    passos.push(await medirCena());
  }
  const universo = repouso.arestas + repouso.nos;
  console.log("\n  O PONTEIRO ENTRANDO EM 6 NÓS, UM APÓS O OUTRO:");
  console.log(`    universo:          ${repouso.arestas} arestas + ${repouso.nos} nós`);
  for (const [i, p] of passos.entries()) {
    console.log(
      `    hover no nó ${i + 1}:    ${p.escureceram} escureceram, ${p.clarearam} acenderam (de ${universo})`,
    );
  }
  const pior = Math.max(...passos.map((p) => p.escureceram));
  console.log(
    pior > 2
      ? `    → APAGÃO: um único hover escurece ${pior} elementos. Atravessar a grade é uma sequência de apagões.`
      : `    → REALCE LOCAL: nada escurece (pior caso: ${pior}). O hover só acende o par.`,
  );

  // ------------------------------------- o clique abre o achado no parecer
  await page.locator(".react-flow__node").nth(primeiroCard).click({ force: true });
  await page.waitForTimeout(1200);
  const drawer = page.getByRole("dialog", { name: /parecer completo/i });
  const abriu = (await drawer.count()) > 0;
  const focado = await page.locator("[data-em-foco]").count();
  const rotuloDoFoco = focado
    ? (await page.locator("[data-em-foco]").first().innerText()).replace(/\s+/g, " ").slice(0, 80)
    : "";
  console.log("\n  CLICANDO NA CAIXA DE UM ACHADO:");
  console.log(`    drawer do parecer abriu:   ${abriu ? "sim" : "NÃO"}`);
  console.log(`    cartão em foco na lista:   ${focado} ${rotuloDoFoco ? `· ${rotuloDoFoco}` : ""}`);
  await page.screenshot({ path: `${OUT}/piscando-3-clique-no-achado.png` });

  if (erros.length > 0) {
    console.log("\n  erros de página:");
    for (const e of erros.slice(0, 5)) console.log(`    ${e.slice(0, 160)}`);
  }
} catch (err) {
  console.error("ERRO no repro:", err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
