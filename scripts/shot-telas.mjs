// LOTE 7 do sistema de design: as telas montadas, capturadas para conferência.
//
// Os lotes 1-6, 8 e 9 mexeram em tokens, primitivos e regiões. O 7 não gera
// nada: ele OLHA o resultado montado, que é onde as decisões de cada lote se
// contradizem. É a última folha do handoff e a que nunca tinha rodado.
//
// Também é a conferência de que a aposentadoria das telas antigas não deixou
// buraco: a home e a página de ferramentas listavam cinco módulos e agora
// listam menos.
//
// Não faz asserção de aparência — isso é olho. Faz duas checagens objetivas em
// cada tela (não quebrou, não rolou na horizontal) e guarda o print.
//
//   npm run dev                    (noutro terminal)
//   node scripts/shot-telas.mjs
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-telas";
fs.mkdirSync(OUT, { recursive: true });

/** As telas que sobraram, na ordem em que alguém as encontra. */
const TELAS = [
  { rota: "/", nome: "home" },
  { rota: "/ferramentas", nome: "ferramentas-antigas" },
  { rota: "/nexo", nome: "nexo-boas-vindas" },
  { rota: "/projetos", nome: "projetos" },
  { rota: "/volumes", nome: "volumes" },
  { rota: "/admin", nome: "admin" },
  { rota: "/admin/usuarios", nome: "admin-usuarios" },
  { rota: "/admin/lds", nome: "admin-lds" },
  { rota: "/admin/auditorias", nome: "admin-auditorias" },
  { rota: "/admin/consumo", nome: "admin-consumo" },
  { rota: "/admin/qualidade", nome: "admin-qualidade" },
  { rota: "/admin/config", nome: "admin-config" },
];

/** Larguras: a de trabalho e a estreita (o critério 5 do fechamento). */
const LARGURAS = [
  { w: 1600, h: 1000, sufixo: "" },
  { w: 900, h: 1000, sufixo: "-estreita" },
];

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push(`${page.url()}: ${e}`));

try {
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.screenshot({ path: `${OUT}/login.png`, fullPage: true });
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30000 });
  }
  check("login entra", !page.url().includes("/login"));

  for (const tela of TELAS) {
    for (const { w, h, sufixo } of LARGURAS) {
      await page.setViewportSize({ width: w, height: h });
      const resposta = await page.goto(`${BASE}${tela.rota}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(900);

      const status = resposta?.status() ?? 0;
      const texto = await page.locator("body").innerText();
      const quebrou =
        status >= 500 ||
        /Application error|Unhandled Runtime Error|Internal Server Error/i.test(texto);
      check(`${tela.nome}${sufixo} carrega`, !quebrou, `status ${status}`);

      /*
       * Rolagem HORIZONTAL é defeito de layout, não gosto: significa conteúdo
       * saindo pela direita. Tolerância de 2px para arredondamento de zoom.
       */
      const vazando = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${tela.nome}${sufixo} não vaza para o lado`, vazando <= 2, `${vazando}px`);

      await page.screenshot({
        path: `${OUT}/${tela.nome}${sufixo}.png`,
        fullPage: true,
      });
    }
  }

  check("nenhum erro de runtime em tela nenhuma", erros.length === 0, erros[0] ?? "");
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
} finally {
  await browser.close();
}

console.log(
  falhas === 0 ? `\nTudo OK. Prints em ${OUT}` : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
