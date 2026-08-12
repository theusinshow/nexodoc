// Prova de que a CONVERSA DO NEXO sobrevive a trocar de máquina.
//
// Até agora a conversa vivia só no IndexedDB do navegador de quem usa: trocar de
// máquina perdia o trabalho, limpar dados do site perdia o trabalho sem aviso, e
// não havia como olhar o que um beta tester fez.
//
// A prova é em DUAS SESSÕES DE NAVEGADOR SEPARADAS. A segunda tem IndexedDB
// virgem — é o que "outra máquina" significa aqui, e é a única forma de mostrar
// que a conversa veio do servidor e não de um cache local.
//
// NÃO CUSTA IA: nenhuma chamada de modelo. A conversa é semeada no IndexedDB
// como o projeto de exemplo faz, e o envio ao servidor é disparado pelo gesto
// real ("Nova conversa" faz o flush da conversa atual).
//
//   npm run dev                              (noutro terminal)
//   node scripts/shot-nexo-conversa-servidor.mjs
//
// O registro de teste é APAGADO no fim (só ele, por id). KEEP=1 mantém.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import pg from "pg";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const KEEP = process.env.KEEP === "1";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) {
    console.log(`  OK      ${nome}`);
  } else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(".env.local", "utf8");
  const linha = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!linha) throw new Error("DATABASE_URL nao encontrada no .env.local");
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const db = new pg.Client({ connectionString: databaseUrl() });
await db.connect();

// Id fixo e reconhecível: a limpeza no fim apaga por ele, e o banco de dev é o
// mesmo em que o engenheiro trabalha.
const ID = "00000000-dead-beef-0000-provadeconv";
const TITULO = "PROVA DE CONVERSA NO SERVIDOR";

/**
 * A LINHA da conversa no histórico.
 *
 * Não é `getByRole("button", {name: TITULO})`: o gatilho de apagar carrega o
 * mesmo título no `aria-label`, e o seletor ingênuo casa com os dois. Aqui a
 * linha é identificada pelo título como TEXTO, dentro do item da lista.
 */
function linhaDaConversa(page) {
  return page.locator("li").filter({ hasText: TITULO }).locator("button").first();
}

/** Entra com o atalho de dev e chega no Nexo. */
async function abrirNexo(context) {
  const page = await context.newPage();
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  return page;
}

const browser = await chromium.launch();
let criou = false;

try {
  // =========================================================================
  // MÁQUINA A — a conversa nasce aqui e sobe
  // =========================================================================
  const ctxA = await browser.newContext();
  const pageA = await abrirNexo(ctxA);
  check("A: autenticado", pageA.url().includes("/nexo"), pageA.url());

  // Semeia a conversa direto no IndexedDB, como `criarProjetoExemplo` faz.
  // Repare no que NÃO é semeado: o blob do artefato. Ele existe do lado de cá
  // (o registro cita o `blobKey`), e é justamente o que não atravessa a rede.
  await pageA.evaluate(
    async ([id, titulo]) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("nexo");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const agora = Date.now();
      const registro = {
        id,
        title: titulo,
        createdAt: agora,
        updatedAt: agora,
        folderKey: "999-26",
        messages: [
          { id: "p1", role: "user", content: "montei o volume da prova" },
          { id: "p2", role: "assistant", content: "Volume montado: 4 folhas." },
        ],
        seloResults: [],
        identidade: { obra: "OBRA DA PROVA", codigo: "999-26" },
        results: [
          {
            artifactId: "prova-capa",
            kind: "capa",
            summary: "Capa do volume 1",
            files: [
              {
                label: "PDF",
                name: "prova_capa.pdf",
                mime: "application/pdf",
                blobKey: `${id}:prova-capa:PDF`,
                primary: true,
                sizeBytes: 12345,
              },
            ],
            generatedAt: agora,
          },
        ],
      };
      // Os bytes do artefato existem NESTA máquina.
      await new Promise((res, rej) => {
        const tx = db.transaction(["conversations", "result_blobs"], "readwrite");
        tx.objectStore("conversations").put(registro);
        tx.objectStore("result_blobs").put({
          key: `${id}:prova-capa:PDF`,
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: "application/pdf" }),
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    [ID, TITULO],
  );

  await pageA.reload({ waitUntil: "domcontentloaded" });
  const linhaA = linhaDaConversa(pageA);
  await linhaA.waitFor({ timeout: 15000 });
  check("A: a conversa semeada aparece no histórico", await linhaA.isVisible());

  /*
   * O GESTO REAL, não uma chamada à rota.
   *
   * Abrir a conversa e depois pedir "Nova conversa" faz o store dar flush na
   * conversa atual — o mesmo caminho de toda gravação. Chamar o PUT à mão
   * provaria a rota e não a fiação, e fiação esquecida já foi o defeito de três
   * entregas neste projeto.
   */
  await linhaA.click();
  await pageA.waitForTimeout(600);
  await pageA.getByRole("button", { name: /Nova conversa/i }).first().click();
  await pageA.waitForTimeout(1500);

  const { rows } = await db.query(
    `SELECT id, "userEmail", title, "folderKey", "auditoriaPendente", data
       FROM "NexoConversation" WHERE id = $1`,
    [ID],
  );
  criou = rows.length > 0;
  check("A: a conversa chegou ao Postgres", rows.length === 1, `${rows.length} linha(s)`);
  if (rows[0]) {
    /*
     * `folderKey` NÃO entra aqui: ele é DERIVADO dos selos a cada gravação
     * (`deriveFolderKey`), e esta conversa é semeada sem selos. Cobrar a pasta
     * seria cobrar do servidor um dado que o cliente recalcula — o teste
     * passaria a testar o seed, não a sincronização.
     */
    check(
      "A: com dono e título nas colunas",
      Boolean(rows[0].userEmail) && rows[0].title === TITULO,
      `${rows[0].userEmail} / ${rows[0].title}`,
    );
    check(
      "A: o miolo foi inteiro (mensagens, identidade, artefato)",
      rows[0].data?.messages?.length === 2 &&
        rows[0].data?.identidade?.codigo === "999-26" &&
        rows[0].data?.results?.[0]?.artifactId === "prova-capa",
      JSON.stringify(rows[0].data).slice(0, 160),
    );
    check(
      "A: os BYTES do artefato não foram junto (só a referência)",
      typeof rows[0].data?.results?.[0]?.files?.[0]?.blobKey === "string" &&
        !JSON.stringify(rows[0].data).includes("base64"),
    );
  }
  await ctxA.close();

  // =========================================================================
  // MÁQUINA B — contexto novo, IndexedDB virgem
  // =========================================================================
  const ctxB = await browser.newContext();
  const pageB = await abrirNexo(ctxB);

  const vazio = await pageB.evaluate(
    () =>
      new Promise((res) => {
        const r = indexedDB.open("nexo");
        r.onsuccess = () => {
          const tx = r.result.transaction("conversations", "readonly");
          const c = tx.objectStore("conversations").count();
          c.onsuccess = () => res(c.result);
        };
        r.onerror = () => res(-1);
      }),
  );
  check("B: o IndexedDB desta sessão começou vazio", vazio === 0, `${vazio} conversa(s)`);

  const linhaB = linhaDaConversa(pageB);
  await linhaB.waitFor({ timeout: 15000 });
  check("B: a conversa apareceu, vinda do servidor", await linhaB.isVisible());

  // A marca de "do servidor": a conversa abre, mas os arquivos gerados não
  // estão aqui. Sem ela, um card sem botão de baixar parece defeito.
  const marca = linhaB.locator(
    '[aria-label*="não estão nesta máquina"], svg[aria-label*="não estão nesta máquina"]',
  );
  check("B: veio MARCADA como do servidor", (await marca.count()) > 0);

  await linhaB.click();
  /*
   * ESPERAR PELO TEXTO, não por um relógio.
   *
   * Abrir uma conversa que só existe no servidor passa por uma ida à rede antes
   * de qualquer render. Um `waitForTimeout` curto reprovava isto como se a
   * fiação estivesse quebrada — e um `waitForTimeout` longo o bastante para
   * "resolver" o problema esconderia uma lentidão de verdade no dia em que ela
   * aparecesse.
   */
  let voltou = true;
  try {
    await pageB.getByText("montei o volume da prova").waitFor({ timeout: 15000 });
    await pageB.getByText(/Volume montado/).first().waitFor({ timeout: 5000 });
  } catch {
    voltou = false;
  }
  check("B: as mensagens da conversa voltaram", voltou);

  const estado = await pageB.evaluate(
    ([id]) =>
      new Promise((res) => {
        const r = indexedDB.open("nexo");
        r.onsuccess = () => {
          const tx = r.result.transaction(["conversations", "result_blobs"], "readonly");
          const c = tx.objectStore("conversations").get(id);
          const b = tx.objectStore("result_blobs").get(`${id}:prova-capa:PDF`);
          tx.oncomplete = () =>
            res({ baixou: Boolean(c.result), blob: Boolean(b.result) });
        };
        r.onerror = () => res({ baixou: false, blob: false });
      }),
    [ID],
  );
  check("B: a conversa desceu para este disco (F5 offline não a perde)", estado.baixou);
  /*
   * A condição que faz o card dizer "gerado em outra máquina". Ela é o ponto:
   * o registro atravessou, o blob não — e o código antes disto PULAVA o arquivo
   * sem blob, deixando o artefato mudo.
   */
  check("B: os bytes do artefato NÃO estão aqui — é o caso do aviso", !estado.blob);

  await pageB.screenshot({
    path: "scripts/out/nexo-conversa-servidor.png",
    fullPage: false,
  });
  console.log("\n  print: scripts/out/nexo-conversa-servidor.png");

  await ctxB.close();
} catch (err) {
  falhas++;
  console.error(`  FALHOU  execucao :: ${err.message}`);
} finally {
  await browser.close();
  if (criou && !KEEP) {
    await db.query(`DELETE FROM "NexoConversation" WHERE id = $1`, [ID]);
    const { rows } = await db.query(
      `SELECT COUNT(*)::int AS n FROM "NexoConversation" WHERE id = $1`,
      [ID],
    );
    check("banco voltou ao estado inicial", rows[0].n === 0);
  }
  await db.end();
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
