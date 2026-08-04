// Prova LIMPA da reconexão — e sem gastar um token.
//
// Reusa uma auditoria que JÁ está concluída no banco: semeia no IndexedDB uma
// conversa com o bilhete apontando para ela, recarrega, e exige que a aplicação
// retome a conversa sozinha e traga o parecer do servidor.
//
// É o mesmo caminho do F5 de verdade — bilhete durável → retomada automática →
// consulta ao servidor → artefato — só que sem pagar a análise de novo.
//
//   node scratchpad/qa-reconexao-limpa.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";

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

  // Qual auditoria já existe pronta no banco?
  const auditId = await page.evaluate(async () => {
    const r = await fetch("/api/audits/recent?limit=20").then((x) => x.json());
    const pronta = (r.audits ?? []).find((a) => a.status === "COMPLETED");
    return pronta?.id ?? null;
  });
  check("há auditoria concluída no banco para reusar", Boolean(auditId), "rode uma antes");
  if (!auditId) throw new Error("sem auditoria concluída");
  console.log(`       reusando ${auditId}`);

  // Semeia a conversa com o bilhete, como se a aba tivesse morrido no meio.
  const convId = await page.evaluate(async (auditId) => {
    const convId = `qa-reconexao-${auditId.slice(0, 8)}`;
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
        title: "QA — reconexão",
        createdAt: agora,
        updatedAt: agora,
        messages: [],
        seloResults: [],
        results: [],
        auditoriaPendente: {
          auditId,
          artifactId: "auditoria:qa",
          nivel: "standard",
          arquivo: "017_26_md_geral_c_assinado.pdf",
          inicioMs: agora - 60000,
        },
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    return convId;
  }, auditId);
  console.log(`       conversa semeada: ${convId}`);

  // O F5. A aplicação tem que achar o bilhete sozinha.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/y1-apos-retomada.png` });

  await page.getByText(/RESULTADO DA AUDITORIA/i).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/y2-parecer-do-servidor.png` });

  const texto = await page.locator("body").innerText();
  check("a aplicação retomou a conversa sozinha", /QA — reconexão/i.test(texto));
  check("o parecer veio do servidor", /RESULTADO DA AUDITORIA/i.test(texto));
  check("com veredito", /NÃO EMITIR|REVISAR|LIBERADO|ANÁLISE PARCIAL/i.test(texto));

  // O bilhete tem que sumir: resolvido é resolvido. Sem isto, todo F5 futuro
  // reabriria esta conversa para sempre.
  const aindaPendente = await page.evaluate(async (convId) => {
    const db = await new Promise((res) => {
      const req = indexedDB.open("nexo", 1);
      req.onsuccess = () => res(req.result);
    });
    const rec = await new Promise((res) => {
      const tx = db.transaction("conversations", "readonly");
      const r = tx.objectStore("conversations").get(convId);
      r.onsuccess = () => res(r.result);
    });
    return Boolean(rec?.auditoriaPendente);
  }, convId);
  check("o bilhete é consumido ao resolver", !aindaPendente);

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/y-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
