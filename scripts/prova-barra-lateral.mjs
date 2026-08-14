// PORTÃO DA BARRA LATERAL v2 — os oito critérios de aceite do handoff, medidos
// no navegador de verdade.
//
// NÃO GASTA TOKEN. As conversas são SEMEADAS direto no IndexedDB — o mesmo
// caminho que a aplicação usa ao restaurar depois de um F5 —, então a coluna
// renderiza exatamente como renderizaria de verdade, sem uma única chamada de
// modelo.
//
//   npm run dev                          (noutro terminal)
//   node scripts/prova-barra-lateral.mjs
//
// O que ele NÃO faz: julgar beleza. Ele mede o que uma asserção de DOM sozinha
// deixaria passar — tamanho computado do texto, caixa contra a janela, e se o
// menu que "abre para cima" realmente cabe na tela.
import { chromium } from "playwright";
import nextEnv from "@next/env";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

/*
 * O SERVIDOR TAMBÉM CONTA, desde que esta máquina passou a ter banco.
 *
 * A prova semeia seis conversas no IndexedDB e confere que a barra mostra seis.
 * Isso valia quando não havia `DATABASE_URL` aqui: sem banco, `/api/nexo/conversas`
 * devolvia lista vazia e a semeadura era tudo que existia. Com banco, a barra
 * sincroniza o que já está gravado e o total passa a incluir conversas de
 * execuções anteriores — a prova quebrava sem que nada da barra tivesse mudado.
 *
 * Limpar antes é o que devolve a determinação: a asserção é sobre o que ESTA
 * prova semeou, e não sobre o histórico da máquina.
 */
nextEnv.loadEnvConfig(process.cwd());

if (process.env.DATABASE_URL) {
  const { getPrisma, isDatabaseConfigured } = await import("../lib/db.ts");
  if (isDatabaseConfigured()) {
    await getPrisma().nexoConversation.deleteMany({});
  }
}

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.PROVA_OUT ?? "docs/provas/barra-lateral";
fs.mkdirSync(OUT, { recursive: true });

/* 1366 × 768 é a tela do critério 07 — o notebook do escritório, não o monitor
   do desenvolvedor. É nela que 300px de coluna precisam caber sem barra
   horizontal, e é nela que o menu da conta precisa abrir sem sair da janela. */
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
      folha: 1,
      total: 1,
      numeroFolha: "01/01",
      arquivo: `${codigo.replace("-", "_")}_arq_001_a`,
      conteudo: "PLANTA BAIXA",
      cliente: "PREFEITURA MUNICIPAL DE CHAPECO",
      secretaria: null,
      obra,
      fase: "PROJETO EXECUTIVO",
      tituloSecao: null,
      confianca: "alta",
    },
  };
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
  // Seis conversas: duas que geraram VOLUME, duas que geraram AUDITORIA, uma
  // com memorial anexado e nada gerado (regra 03), e uma LEGADA — gravada antes
  // do campo `tipo` existir, que é o critério 08.
  await page.evaluate(async (selos) => {
    const db = await new Promise((res, rej) => {
      // SEM VERSÃO de propósito: abre a que existir. Fixar `1` aqui fazia o
      // semeador morrer com VersionError assim que a aplicação subiu o banco
      // para a v2 (o store do cache de leitura) — a semeadura roda DEPOIS de a
      // página abrir, então quem manda na versão é a aplicação, não o teste.
      const req = indexedDB.open("nexo");
      // Num contexto novo o banco ainda não existe: abrir sem criar os stores
      // devolveria um banco VAZIO, e a transação seguinte morreria com
      // "object store not found". Espelha o `openDb` da aplicação.
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
      messages: [{ id: `${id}-m`, role: "user", content: title }],
      seloResults: [],
      results: [],
    });

    const registros = [
      {
        ...base("p-vol-1", "Revitalização da Feira", "040-26", 1000),
        tipo: "volume",
        seloResults: selos,
        results: [
          {
            artifactId: "a1",
            kind: "ld",
            summary: "LD Arquitetura",
            files: [],
          },
        ],
      },
      {
        ...base("p-vol-2", "Escola do bairro Cruzeiro", "013-26", 2000),
        tipo: "volume",
        results: [
          { artifactId: "a2", kind: "volume", summary: "Volume 1", files: [] },
        ],
      },
      {
        ...base("p-aud-1", "Escola — memorial descritivo", "013-26", 3000),
        tipo: "auditoria",
        results: [
          {
            artifactId: "a3",
            kind: "auditoria",
            summary: "Parecer do memorial",
            files: [],
          },
        ],
      },
      {
        ...base("p-aud-2", "Centro comunitário — PPCI", "017-26", 4000),
        tipo: "auditoria",
        results: [
          { artifactId: "a4", kind: "auditoria", summary: "Parecer", files: [] },
        ],
      },
      {
        // Regra 03: memorial anexado, nada gerado ainda.
        ...base("p-aud-3", "Anexei o memorial", undefined, 5000),
        tipo: "auditoria",
        memorial: { name: "memorial.pdf", blobKey: "p-aud-3:memorial" },
      },
      {
        // CRITÉRIO 08: registro gravado ANTES do campo `tipo`. Sem `tipo`
        // nenhum, de propósito — é o que existe no disco de quem já usava.
        ...base("p-legado", "Conversa antiga (sem tipo)", "084-25", 6000),
      },
    ];

    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      for (const r of registros) tx.objectStore("conversations").put(r);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }, [selo("040-26", "REVITALIZACAO DA FEIRA MUNICIPAL")]);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const barra = page.getByRole("complementary", { name: "Navegação do Nexo" });
  await barra.waitFor({ timeout: 15000 });
  await page.waitForTimeout(800);

  // ------------------------------------------------------- 01 duas seções
  const secaoVolumes = barra.getByText("Montagem de volumes", { exact: true });
  const secaoAuditorias = barra.getByText("Auditoria de memoriais", { exact: true });
  checar(
    "01 conversas de tipos diferentes caem em seções diferentes",
    (await secaoVolumes.count()) === 1 && (await secaoAuditorias.count()) === 1,
  );

  // As duas conversas de volume + a legada = 3; as três de auditoria = 3.
  const tabTudo = barra.getByRole("tab", { name: /Tudo/ });
  const tabVolumes = barra.getByRole("tab", { name: /Volumes/ });
  const tabAuditorias = barra.getByRole("tab", { name: /Auditorias/ });
  const numeros = async () => ({
    tudo: (await tabTudo.innerText()).replace(/\D/g, ""),
    volumes: (await tabVolumes.innerText()).replace(/\D/g, ""),
    auditorias: (await tabAuditorias.innerText()).replace(/\D/g, ""),
  });
  const antes = await numeros();
  checar(
    "01 as contagens batem com a semeadura",
    antes.tudo === "6" && antes.volumes === "3" && antes.auditorias === "3",
    JSON.stringify(antes),
  );

  // -------------------------------------------- 08 a conversa legada é volume
  // Pelo TEXTO, não pelo papel: `getByRole("button", {name:/Conversa antiga/})`
  // casaria também com o gatilho de apagar, cujo aria-label cita o título.
  const legada = barra.getByText("Conversa antiga (sem tipo)", { exact: true });
  checar(
    "08 conversa sem o campo `tipo` abre e aparece na lista",
    (await legada.count()) === 1,
  );
  // EM QUAL seção ela mora, provado pelo recorte em vez da estrutura do DOM: em
  // "Auditorias" ela some, em "Volumes" ela fica.
  await barra.getByRole("tab", { name: /Auditorias/ }).click();
  await page.waitForTimeout(300);
  const somemNasAuditorias = (await legada.count()) === 0;
  await barra.getByRole("tab", { name: /Volumes/ }).click();
  await page.waitForTimeout(300);
  const ficaNosVolumes = (await legada.count()) === 1;
  checar(
    "08 a conversa antiga cai em Montagem de volumes",
    somemNasAuditorias && ficaNosVolumes,
  );
  await barra.getByRole("tab", { name: /Tudo/ }).click();
  await page.waitForTimeout(300);
  await shot(page, "tudo");

  // ------------------------------------------- 02 o filtro esconde a SEÇÃO
  await tabVolumes.click();
  await page.waitForTimeout(300);
  const depois = await numeros();
  checar(
    "02 o filtro esconde a seção inteira",
    (await secaoAuditorias.count()) === 0 && (await secaoVolumes.count()) === 1,
  );
  checar(
    "02 as contagens NÃO mudam ao filtrar",
    depois.tudo === antes.tudo &&
      depois.volumes === antes.volumes &&
      depois.auditorias === antes.auditorias,
    JSON.stringify(depois),
  );
  await shot(page, "filtro-volumes");

  // ------------------------------------------------- setas ←/→ navegam o filtro
  await tabVolumes.focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(250);
  checar(
    "03 setas ←/→ navegam o filtro",
    (await tabAuditorias.getAttribute("aria-selected")) === "true",
  );

  // ------------------------------------------ 03 o filtro sobrevive ao F5
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await barra.waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  checar(
    "03 o filtro sobrevive a recarregar a página",
    (await barra.getByRole("tab", { name: /Auditorias/ }).getAttribute("aria-selected")) ===
      "true",
  );

  // ------------------------- seção única não oferece recolher (estado §7.4)
  const cabecalhoUnico = barra
    .getByText("Auditoria de memoriais", { exact: true })
    .locator("xpath=..");
  checar(
    "§7 a única seção visível não oferece chevron de recolher",
    (await cabecalhoUnico.evaluate((el) => el.tagName.toLowerCase())) === "div",
  );

  // Volta para "Tudo" para as medidas seguintes.
  await barra.getByRole("tab", { name: /Tudo/ }).click();
  await page.waitForTimeout(300);

  // ------------------------------------------------ 04 piso de 11,5px
  const miudos = await barra.evaluate((aside) => {
    const achados = [];
    for (const el of aside.querySelectorAll("*")) {
      // Só elementos com texto PRÓPRIO: o tamanho de um contêiner sem texto não
      // é lido por ninguém, e contá-lo produziria falha falsa.
      const proprio = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join("");
      if (!proprio) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const px = parseFloat(cs.fontSize);
      if (px < 11.5) {
        achados.push({ texto: proprio.slice(0, 30), px, classe: el.className });
      }
    }
    return achados;
  });
  checar(
    "04 nenhum texto da barra lateral abaixo de 11,5px",
    miudos.length === 0,
    miudos.length ? JSON.stringify(miudos.slice(0, 5)) : "medido no computed style",
  );

  // -------------------------------- 05 os ícones do rodapé têm nome e dica
  const nav = barra.getByRole("navigation", { name: "Resto do software" });
  const rotulos = ["Projetos", "Como funciona", "Ferramentas antigas"];
  let comNome = 0;
  for (const r of rotulos) {
    const b = nav.getByLabel(r, { exact: true });
    if ((await b.count()) === 1) comNome++;
  }
  checar(
    "05 os botões de ícone do rodapé têm aria-label",
    comNome === rotulos.length,
    `${comNome}/${rotulos.length}`,
  );

  // Tooltip: aparece no hover, com o MESMO texto do rótulo antigo.
  await nav.getByLabel("Projetos", { exact: true }).hover();
  await page.waitForTimeout(700);
  const dica = page.getByRole("tooltip").filter({ hasText: "Projetos" });
  checar("05 o ícone mostra tooltip com o rótulo", (await dica.count()) >= 1);

  // Foco visível: o anel do chanfro vive no ::before, então o que se mede é se
  // o elemento REALMENTE recebe foco pelo teclado.
  const focou = await nav.getByLabel("Projetos", { exact: true }).evaluate((el) => {
    el.focus();
    return document.activeElement === el;
  });
  checar("05 a navegação por teclado alcança os botões de ícone", focou);
  await shot(page, "rodape-icones");

  // ------------------------------ 06 o menu da conta abre PARA CIMA e cabe
  const gatilho = barra.locator('[aria-haspopup="menu"]');
  checar("06 o bloco da conta renderiza com a sessão", (await gatilho.count()) === 1);
  await gatilho.first().click();
  await page.waitForTimeout(400);
  const menu = page.getByRole("menu");
  const caixaMenu = await menu.first().boundingBox();
  const caixaGatilho = await gatilho.first().boundingBox();
  checar(
    "06 o menu abre PARA CIMA",
    caixaMenu && caixaGatilho && caixaMenu.y + caixaMenu.height <= caixaGatilho.y + 2,
    caixaMenu ? `menu termina em ${Math.round(caixaMenu.y + caixaMenu.height)}, gatilho começa em ${Math.round(caixaGatilho.y)}` : "sem caixa",
  );
  checar(
    "06 o menu não sai da viewport",
    caixaMenu &&
      caixaMenu.y >= 0 &&
      caixaMenu.x >= 0 &&
      caixaMenu.y + caixaMenu.height <= VIEW.height &&
      caixaMenu.x + caixaMenu.width <= VIEW.width,
    caixaMenu ? `x ${Math.round(caixaMenu.x)} y ${Math.round(caixaMenu.y)} ${Math.round(caixaMenu.width)}×${Math.round(caixaMenu.height)}` : "sem caixa",
  );
  checar(
    "06 o menu contém Sair",
    (await menu.getByRole("menuitem", { name: /Sair/ }).count()) === 1,
  );
  await shot(page, "menu-da-conta");
  await page.keyboard.press("Escape");

  // ------------------------ 07 a 300px, nada estoura em 1366 × 768
  const larguraColuna = await barra.evaluate(
    (el) => Math.round(el.getBoundingClientRect().width),
  );
  const estouro = await page.evaluate(() => ({
    doc: document.documentElement.scrollWidth,
    janela: window.innerWidth,
  }));
  checar(
    "07 a coluna mede 300px",
    larguraColuna === 300,
    `${larguraColuna}px`,
  );
  checar(
    "07 sem barra horizontal em 1366 × 768",
    estouro.doc <= estouro.janela,
    `scrollWidth ${estouro.doc} vs innerWidth ${estouro.janela}`,
  );

  // A coluna está DENTRO da janela — a asserção de DOM sozinha passaria verde
  // com ela fora da tela.
  const caixaBarra = await barra.boundingBox();
  checar(
    "07 a coluna está visível dentro da janela",
    caixaBarra && caixaBarra.x >= 0 && caixaBarra.x + caixaBarra.width <= VIEW.width,
    caixaBarra ? `x ${Math.round(caixaBarra.x)} w ${Math.round(caixaBarra.width)}` : "sem caixa",
  );
  await shot(page, "1366x768");

  // ------------------------------------------------- busca + filtro juntos
  await barra.getByRole("tab", { name: /Auditorias/ }).click();
  await barra.getByRole("textbox").fill("zzz-nao-existe");
  await page.waitForTimeout(400);
  const vazio = await barra.innerText();
  checar(
    "§7 busca sem resultado cita o filtro ativo",
    /Nenhuma auditoria com/.test(vazio),
    vazio.split("\n").find((l) => /Nenhuma/.test(l)) ?? "",
  );
  await shot(page, "busca-sem-resultado");
} finally {
  await context.close();
  await browser.close();
}

console.log(`\n${ok} verificações ok, ${falhas} falhas`);
if (falhas > 0) process.exitCode = 1;
