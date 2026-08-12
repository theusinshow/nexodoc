// PORTÃO DO "APAGAR A PASTA" E DO "NOVA A PARTIR DESTA" — medido no navegador.
//
// NÃO GASTA TOKEN. As conversas são SEMEADAS no IndexedDB, como em
// [[prova-barra-lateral.mjs]]: a barra renderiza como renderizaria de verdade,
// sem uma única chamada de modelo.
//
//   npm run dev                          (noutro terminal)
//   node scripts/prova-pasta-e-reuso.mjs
//
// O que ele prova, e por que cada um importa:
//   01 o botão da pasta existe e só aparece com o ponteiro em cima
//   02 a confirmação DIZ QUANTAS conversas vão embora (é o que dimensiona o
//      estrago — a pergunta de uma conversa só não serviria)
//   03 Cancelar não apaga nada
//   04 Apagar leva o grupo INTEIRO daquela seção...
//   05 ...e NÃO leva a pasta de mesmo nome da outra seção (o escopo é o que
//      está à vista)
//   06 o apagado NÃO VOLTA depois de um F5 — o modo de falhar caro aqui é a
//      conversa que a gravação pendente reescreve meio segundo depois
//   07 "nova a partir desta" cria uma conversa com os selos já lidos e sem as
//      mensagens da original
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.PROVA_OUT ?? "docs/provas/pasta-e-reuso";
fs.mkdirSync(OUT, { recursive: true });

const VIEW = { width: 1366, height: 768 };

let falhas = 0;
let ok = 0;
function checar(criterio, condicao, detalhe = "") {
  if (condicao) {
    ok++;
    console.log(`  ok   ${criterio}${detalhe ? ` — ${detalhe}` : ""}`);
  } else {
    falhas++;
    console.error(`FALHOU ${criterio}${detalhe ? ` — ${detalhe}` : ""}`);
  }
}

let n = 0;
async function shot(page, nome) {
  n++;
  const file = path.join(OUT, `${String(n).padStart(2, "0")}-${nome}.png`);
  await page.screenshot({ path: file });
  console.log(`       ${file}`);
}

/** Selo fabricado — a forma que a leitura do carimbo devolve. */
function selo(codigo, obra) {
  return {
    fileName: `${codigo}_arq_001_a.pdf`,
    pageNumber: 1,
    pageCount: 1,
    extraction: {
      disciplina: "ARQUITETURA",
      arquivo: `${codigo.replace("-", "_")}_arq_001_a`,
      conteudo: "PLANTA BAIXA",
      obra,
      numeroDaFolha: "01/01",
      totalDeFolhas: "01",
      data: null,
      logoOrgao: null,
      confianca: "alta",
    },
  };
}

/** Ids das conversas no disco, na ordem em que a lista as devolve. */
async function idsNoDisco(page) {
  return page.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("nexo");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const tx = db.transaction("conversations", "readonly");
    const all = await new Promise((res, rej) => {
      const q = tx.objectStore("conversations").getAll();
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    return all.map((c) => ({
      id: c.id,
      folderKey: c.folderKey ?? null,
      tipo: c.tipo ?? null,
      selos: c.seloResults?.length ?? 0,
      mensagens: c.messages?.length ?? 0,
    }));
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
const page = await context.newPage();

try {
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});

  // ---------------------------------------------------------------- semeadura
  // 084-25 existe NAS DUAS seções — é o caso que separa "apagar o que está à
  // vista" de "apagar tudo que tem esse código".
  await page.evaluate(async (selos) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open("nexo");
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains("conversations")) {
          d.createObjectStore("conversations", { keyPath: "id" }).createIndex(
            "updatedAt",
            "updatedAt",
          );
        }
        if (!d.objectStoreNames.contains("result_blobs")) {
          d.createObjectStore("result_blobs", { keyPath: "key" });
        }
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
    const agora = Date.now();
    const base = (id, title, folderKey, t) => ({
      id,
      title,
      folderKey,
      createdAt: agora - t - 60000,
      updatedAt: agora - t,
      messages: [
        { id: `${id}-m1`, role: "user", content: title },
        { id: `${id}-m2`, role: "assistant", content: "Li 1 folha(s)." },
      ],
      seloResults: selos,
      results: [],
    });
    const registros = [
      { ...base("f-vol-1", "Reforma da praça — LD", "084-25", 1000), tipo: "volume" },
      { ...base("f-vol-2", "Reforma da praça — capa", "084-25", 2000), tipo: "volume" },
      { ...base("f-vol-3", "Reforma da praça — volume", "084-25", 3000), tipo: "volume" },
      { ...base("f-vol-outra", "Escola nova — LD", "013-26", 4000), tipo: "volume" },
      // MESMA pasta, OUTRA seção: não pode cair junto.
      { ...base("f-aud-1", "Reforma da praça — memorial", "084-25", 5000), tipo: "auditoria" },
    ];
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      for (const r of registros) tx.objectStore("conversations").put(r);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }, [selo("084-25", "REFORMA DA PRACA CENTRAL")]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const barra = page.getByRole("complementary", { name: "Navegação do Nexo" });
  await barra.waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);

  const antes = await idsNoDisco(page);
  checar("00 semeadura", antes.length === 5, `${antes.length} conversas no disco`);

  // ------------------------------------------------- 01 o botão só no ponteiro
  const botaoApagarPasta = barra
    .getByRole("button", { name: /Apagar a pasta 084-25 inteira/i })
    .first();
  checar("01a o botão da pasta existe no DOM", (await botaoApagarPasta.count()) === 1);
  const opacidadeEmRepouso = await botaoApagarPasta
    .evaluate((el) => getComputedStyle(el.parentElement).opacity)
    .catch(() => "?");
  checar(
    "01b em repouso ele é invisível",
    Number(opacidadeEmRepouso) === 0,
    `opacity=${opacidadeEmRepouso}`,
  );

  // O cabeçalho da PASTA da seção de volumes (o primeiro 084-25 da coluna).
  const cabecalhoPasta = barra.locator("summary").filter({ hasText: "084-25" }).first();
  await cabecalhoPasta.hover();
  await page.waitForTimeout(250);
  const opacidadeNoHover = await botaoApagarPasta.evaluate(
    (el) => getComputedStyle(el.parentElement).opacity,
  );
  checar(
    "01c com o ponteiro em cima ele aparece",
    Number(opacidadeNoHover) === 1,
    `opacity=${opacidadeNoHover}`,
  );
  // E é clicável de verdade: visível no DOM não basta se a caixa tem 0px.
  const caixa = await botaoApagarPasta.boundingBox();
  checar(
    "01d e tem área de clique",
    caixa && caixa.width >= 20 && caixa.height >= 20,
    caixa ? `${Math.round(caixa.width)}×${Math.round(caixa.height)}` : "sem caixa",
  );
  await shot(page, "botao-da-pasta-no-hover");

  // ------------------------------------------------- 02 a pergunta traz o número
  /*
   * O número é comparado com a CONTAGEM DO PRÓPRIO GRUPO, não com o tanto que
   * este script semeou: a lista funde o disco com o servidor, e conversas de
   * outra máquina (ou de uma prova anterior) entram no mesmo grupo. Fixar "3"
   * aqui testaria a semeadura, não a pergunta.
   */
  const rotuloDaPasta = (await cabecalhoPasta.innerText()).replace(/\s+/g, " ").trim();
  const contagemDoGrupo = Number(rotuloDaPasta.match(/(\d+)\s*$/)?.[1] ?? -1);
  await botaoApagarPasta.click();
  await page.waitForTimeout(300);
  const pergunta = await barra
    .getByText(/Apagar 084-25 e as \d+ conversas dentro dela/i)
    .first()
    .textContent();
  const naPergunta = Number((pergunta ?? "").match(/as (\d+) conversas/i)?.[1] ?? -2);
  checar(
    "02 a confirmação diz quantas conversas vão junto",
    contagemDoGrupo > 0 && naPergunta === contagemDoGrupo,
    `grupo diz ${contagemDoGrupo}, pergunta diz ${naPergunta}`,
  );
  /*
   * 02b O RÓTULO "APAGAR" PRECISA SER LEGÍVEL.
   *
   * O `.nx-edge-*` pinta a BORDA no fundo do elemento e o miolo num `::before`
   * inset. Com um miolo translúcido, ele compõe sobre a borda e o botão vira um
   * bloco salmão com o texto salmão em cima — foi assim que o botão mais
   * perigoso da coluna passou meses sem rótulo visível. Uma asserção de DOM
   * ("o texto está lá") passava verde o tempo todo; só a cor computada acusa.
   */
  const botaoApagar = barra.getByRole("button", { name: /^Apagar$/ }).first();
  const contraste = await botaoApagar.evaluate((el) => {
    /*
     * As duas cores passam pelo CANVAS antes de comparar. `getComputedStyle`
     * devolve `oklab(...)` para o `color-mix`, e ler os números daquela string
     * como se fossem RGB daria um contraste alto imaginário — o teste passaria
     * justamente no caso que ele existe para pegar.
     */
    const paraRgb = (cor) => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillStyle = cor;
      ctx.fillRect(0, 0, 1, 1);
      return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
    };
    const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const texto = paraRgb(getComputedStyle(el).color);
    const miolo = paraRgb(getComputedStyle(el, "::before").backgroundColor);
    return { texto, miolo, delta: Math.abs(lum(texto) - lum(miolo)) };
  });
  checar(
    "02b o rótulo Apagar contrasta com o miolo do botão",
    contraste.delta > 60,
    `delta de luminância ${Math.round(contraste.delta)}`,
  );
  await shot(page, "confirmacao-da-pasta");

  // ------------------------------------------------------- 03 cancelar não apaga
  await barra.getByRole("button", { name: /^Cancelar$/ }).first().click();
  await page.waitForTimeout(400);
  const depoisDoCancelar = await idsNoDisco(page);
  checar(
    "03 Cancelar não apaga nada",
    depoisDoCancelar.length === 5,
    `${depoisDoCancelar.length} conversas`,
  );

  // ------------------------------------------------------- 04/05 apagar o grupo
  await cabecalhoPasta.hover();
  await page.waitForTimeout(200);
  await botaoApagarPasta.click();
  await page.waitForTimeout(300);
  await barra.getByRole("button", { name: /^Apagar$/ }).first().click();
  await page.waitForTimeout(1200);

  const depois = await idsNoDisco(page);
  const ids = depois.map((c) => c.id).sort();
  checar(
    "04 as 3 conversas da pasta 084-25 (volumes) sumiram",
    !ids.includes("f-vol-1") && !ids.includes("f-vol-2") && !ids.includes("f-vol-3"),
    ids.join(", "),
  );
  checar(
    "05 a 084-25 da AUDITORIA e a 013-26 continuam",
    ids.includes("f-aud-1") && ids.includes("f-vol-outra"),
    ids.join(", "),
  );
  await shot(page, "depois-de-apagar-a-pasta");

  // ------------------------------------------------------- 06 não volta no F5
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await barra.waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  const depoisDoF5 = (await idsNoDisco(page)).map((c) => c.id);
  checar(
    "06 o apagado não ressuscita depois do F5",
    !depoisDoF5.includes("f-vol-1") &&
      !depoisDoF5.includes("f-vol-2") &&
      !depoisDoF5.includes("f-vol-3"),
    depoisDoF5.join(", "),
  );

  // ------------------------------------------------- 07 nova a partir desta
  // Os ids de ANTES: a cópia é achada por diferença, e não por "a que não é a
  // original" — cópias de execuções passadas ficam no disco e enganariam.
  const idsAntesDaCopia = new Set((await idsNoDisco(page)).map((c) => c.id));
  const linha = barra.getByRole("button", { name: /Escola nova — LD/ }).first();
  await linha.hover();
  await page.waitForTimeout(250);
  const botaoDuplicar = barra
    .getByRole("button", { name: /Nova conversa a partir de Escola nova/i })
    .first();
  checar("07a o botão de duplicar aparece na linha", (await botaoDuplicar.count()) === 1);
  await botaoDuplicar.click();
  await page.waitForTimeout(1500);

  const comCopia = await idsNoDisco(page);
  const copia = comCopia.find((c) => !idsAntesDaCopia.has(c.id));
  checar(
    "07b a cópia nasceu na mesma pasta",
    copia?.folderKey === "013-26",
    copia ? `${copia.id} · ${copia.folderKey}` : "não achei a cópia",
  );
  checar(
    "07c leva os selos já lidos (não relê nada)",
    (copia?.selos ?? 0) > 0,
    `${copia?.selos ?? 0} selo(s)`,
  );
  checar(
    "07d e NÃO leva as mensagens da original",
    copia?.mensagens === 0,
    `${copia?.mensagens ?? "?"} mensagem(ns)`,
  );
  await shot(page, "depois-de-duplicar");

  console.log(`\n${ok} ok, ${falhas} falha(s)`);
  process.exitCode = falhas > 0 ? 1 : 0;
} catch (err) {
  console.error("ERRO na prova:", err);
  await shot(page, "erro").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
