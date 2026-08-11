/**
 * PROVA: dá para baixar a LD EDITÁVEL (.odt) sem montar volume.
 *
 * O sintoma relatado: gerar só a LD e não achar o arquivo do LibreOffice --
 * o único botão que entregava ODT vivia no card de VOLUME, e ainda regerava a
 * LD consolidada no servidor.
 *
 * O ODT sempre existiu: `lib/ld/ld-generation.ts` produz ODT e o PDF é DERIVADO
 * dele. Ele ia para o IndexedDB e nenhuma tela oferecia. Então a prova mede o
 * que uma asserção de "o botão existe" não distingue:
 *
 *   1. existe um `<a download>` terminado em .odt no card do PLANO;
 *   2. o href é object URL VIVO e traz bytes -- não um link morto que abre uma
 *      aba em branco;
 *   3. baixar NÃO dispara requisição ao gerador -- se disparasse, o botão
 *      estaria regerando (custo de servidor) em vez de entregar o que já está
 *      no navegador. É a diferença entre este botão e o do card de volume.
 *
 * SEMEIA E GERA NO PRÓPRIO CONTEXTO, de propósito: o IndexedDB é por perfil do
 * navegador, e a lista de conversas vem do SERVIDOR enquanto os bytes ficam na
 * máquina que gerou. Uma prova que abrisse uma conversa semeada por outro
 * script cairia no caso "bytes ausentes" e mediria a tela errada.
 *
 * Não gasta token: a geração da LD é determinística (selos -> ODT), sem IA.
 *
 *   npm run dev                    (noutro terminal)
 *   npm run test:ld-editavel
 */
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CONV = "qa-ld-editavel";

const falhas = [];
function conferir(nome, condicao, detalhe) {
  if (condicao) {
    console.log(`OK    ${nome}`);
  } else {
    falhas.push(`${nome} — ${detalhe}`);
    console.log(`FALHA ${nome} — ${detalhe}`);
  }
}

/** Três folhas de uma disciplina só: o caso "quero apenas a LD". */
const SELOS = [1, 2, 3].map((n) => {
  const nome = `999_26_his_${String(n).padStart(3, "0")}_a.pdf`;
  return {
    fileName: nome,
    pageNumber: 1,
    pageCount: 1,
    extraction: {
      disciplina: "HIDROSSANITARIO",
      folha: n,
      total: 3,
      numeroFolha: n,
      arquivo: nome.replace(/\.pdf$/, ""),
      conteudo: "PLANTA BAIXA",
      cliente: "PREFEITURA MUNICIPAL DE CHAPECO",
      secretaria: null,
      obra: "QA — LD EDITAVEL",
      fase: "PROJETO BASICO",
      tituloSecao: null,
      confianca: "alta",
    },
  };
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

/* Toda ida ao gerador da LD é anotada, para separar GERAR de BAIXAR. */
const chamadasAoGerador = [];
page.on("request", (r) => {
  if (r.url().includes("/api/nexo/ld")) chamadasAoGerador.push(r.method());
});

try {
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL(/\/nexo/, { timeout: 30_000 });
  }
  await pularTourGuiado(page);

  /* A conversa: pranchas lidas e UMA proposta de LD. Sem volume nenhum -- é
     exatamente o cenário que não tinha como entregar o editável. */
  await page.evaluate(
    async ({ selos, convId }) => {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo", 1);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const agora = Date.now();
      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: "QA — LD editavel",
          createdAt: agora,
          updatedAt: agora,
          seloResults: selos,
          results: [],
          messages: [
            { id: "m1", role: "user", content: "Gera só a LD dessas pranchas." },
            {
              id: "m2",
              role: "assistant",
              content: "Li 3 pranchas. Proponho a LD:",
              proposals: [
                {
                  kind: "ld",
                  resumo: "LD do projeto hidrossanitario",
                  params: { tituloLd: "HIDROSSANITARIO", numTomos: 1, tomoInicial: 1 },
                },
              ],
            },
          ],
        });
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
      });
    },
    { selos: SELOS, convId: CONV },
  );

  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  await page.getByText("QA — LD editavel", { exact: false }).first().click();
  await page.waitForTimeout(2000);

  /* Antes de gerar não pode haver download nenhum: o card só oferece arquivo
     que existe. Se passasse aqui, o botão estaria mentindo. */
  const antesDeGerar = await page.locator('a[data-prova="baixar-artefato"]').count();
  conferir("antes de gerar, nenhum download é oferecido", antesDeGerar === 0, `${antesDeGerar} link(s)`);

  const botaoGerar = page
    .getByRole("button", { name: /Gerar|Confirmar e gerar/i })
    .first();
  await botaoGerar.click();
  /* Geração determinística: sem IA, mas o LibreOffice do PDF pode demorar. */
  await page
    .locator('a[data-prova="baixar-artefato"]')
    .first()
    .waitFor({ timeout: 120_000 })
    .catch(() => {});

  /* --- 1. O card do plano oferece o editável --- */
  const links = await page.evaluate(() =>
    [...document.querySelectorAll('a[data-prova="baixar-artefato"]')].map((a) => ({
      nome: a.getAttribute("download") ?? "",
      href: a.getAttribute("href") ?? "",
    })),
  );
  const odts = links.filter((l) => l.nome.toLowerCase().endsWith(".odt"));

  conferir(
    `o card do plano oferece download (${links.map((l) => l.nome).join(", ") || "nenhum"})`,
    links.length > 0,
    "nenhum <a data-prova=baixar-artefato> na tela",
  );
  conferir(
    `existe um .odt para baixar (${odts.map((o) => o.nome).join(", ") || "nenhum"})`,
    odts.length > 0,
    `só ${links.map((l) => l.nome).join(", ")}`,
  );

  /* --- 2. O href é object URL vivo, e traz bytes --- */
  if (odts.length > 0) {
    const alvo = odts[0];
    conferir("o link do .odt é object URL", alvo.href.startsWith("blob:"), `href ${alvo.href.slice(0, 60)}`);
    const bytes = await page.evaluate(async (href) => {
      try {
        const r = await fetch(href);
        const b = await r.blob();
        return { ok: true, tamanho: b.size, tipo: b.type };
      } catch (e) {
        return { ok: false, erro: String(e) };
      }
    }, alvo.href);
    conferir(
      `o .odt tem bytes (${bytes.tamanho ?? 0} B, ${bytes.tipo ?? "?"})`,
      bytes.ok && bytes.tamanho > 1000,
      bytes.ok ? `só ${bytes.tamanho} B` : bytes.erro,
    );
    conferir("o mime é OpenDocument", (bytes.tipo ?? "").includes("opendocument"), `veio ${bytes.tipo}`);
  }

  /* --- 3. Baixar não regera nada --- */
  const antes = chamadasAoGerador.length;
  if (odts.length > 0) {
    await page.locator('a[data-prova="baixar-artefato"]').first().click({ force: true });
    await page.waitForTimeout(1500);
  }
  conferir(
    "baixar não chama o gerador da LD",
    chamadasAoGerador.length === antes,
    `${chamadasAoGerador.length - antes} requisicao(oes) a /api/nexo/ld depois do clique`,
  );

  await page.screenshot({ path: "scratchpad/prova-ld-editavel.png", fullPage: false });
} finally {
  /* Não deixa lixo na lista do servidor. */
  await page
    .evaluate(async (convId) => {
      const db = await new Promise((res) => {
        const req = indexedDB.open("nexo", 1);
        req.onsuccess = () => res(req.result);
      });
      await new Promise((res) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").delete(convId);
        tx.oncomplete = res;
        tx.onerror = res;
      });
    }, CONV)
    .catch(() => {});
  await browser.close();
}

console.log(`\n=== ${falhas.length === 0 ? "PASSOU" : `${falhas.length} FALHA(S)`} ===`);
if (falhas.length) for (const f of falhas) console.log(`  · ${f}`);
process.exit(falhas.length ? 1 : 0);
