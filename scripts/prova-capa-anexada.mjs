/**
 * PROVA DA CAPA ANEXADA (16/10/2026) — build de produção, banco de dev.
 *
 *   NEXODOC_BASE=http://localhost:3100 node scripts/prova-capa-anexada.mjs
 *
 * Task 8 do plano `docs/superpowers/plans/2026-10-16-capa-anexada.md`:
 *
 * 1. Fabrica uma "capa pronta" do 040-26: o modelo de Chapecó preenchido com
 *    dados reais pela MESMA substituição do gerador (`preencherCorpo`).
 * 2. Na tela: conversa no projeto 040-26, anexa o ODT, o card "Modelo de capa"
 *    aparece com código, data, tomo e volume reconhecidos; "Usar este modelo".
 * 3. Pela API, com a sessão da tela: a lista de modelos traz o do projeto na
 *    frente, e a capa gerada com `projeto:<id>` sai em 1 página com a obra e o
 *    título NOVOS no lugar dos antigos.
 *
 * Gasta UMA chamada `gpt-6-luna` (as linhas que as regras não reconhecem).
 * Apaga o modelo do projeto no começo e no fim: o 040-26 do dev volta como
 * estava.
 */
import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import pg from "pg";
import { PDFDocument } from "pdf-lib";
import { chromium } from "playwright";

import { desembrulharCamposDeUsuario, preencherCorpo } from "../server/odt/marcadores.ts";
import { entrarSemTela, pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.NEXODOC_BASE ?? "http://localhost:3100";
const PROJETO = process.env.NEXODOC_PROVA_PROJETO ?? "cmt2xkihn0007ksetqz0ezvqe";
const SAIDA = process.env.NEXODOC_PROVA_SAIDA ?? path.join(process.cwd(), "tmp", "prova-capa-anexada");
fs.mkdirSync(SAIDA, { recursive: true });

let falhas = 0;
const confere = (ok, msg) => {
  console.log(`${ok ? "  ok " : "FALHOU"}  ${msg}`);
  if (!ok) falhas++;
};

// ── banco: o modelo do projeto some antes e depois ─────────────────────────
const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l))
    .filter(Boolean)
    .map(([, k, v]) => [k, v.replace(/^["']|["']$/g, "")]),
);
if (!/nexodoc_dev/.test(env.DATABASE_URL ?? "")) throw new Error("A prova só roda no nexodoc_dev.");
const banco = new pg.Client({ connectionString: env.DATABASE_URL });
await banco.connect();
const apagarModelo = () => banco.query('DELETE FROM "ModeloDeCapaDoProjeto" WHERE "projectId" = $1', [PROJETO]);
await apagarModelo();

// ── 1. a capa pronta ───────────────────────────────────────────────────────
const escapar = (v) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<text:line-break/>");
const zip = await JSZip.loadAsync(fs.readFileSync("templates/capas/prefchap/modelo-capa.odt"));
const xml = desembrulharCamposDeUsuario(await zip.file("content.xml").async("string"));
const abre = /<office:text\b[^>]*>/.exec(xml);
const ini = abre.index + abre[0].length;
const fim = xml.indexOf("</office:text>");
const corpo = preencherCorpo(
  xml.slice(ini, fim),
  {
    gerais: {
      "{{ORGAO}}": "PREFEITURA MUNICIPAL DE CHAPECÓ",
      "{{SECRETARIA}}": "SECRETARIA DE PLANEJAMENTO E DESENVOLVIMENTO",
      "{{NOME_OBRA}}": "REVITALIZAÇÃO DA FEIRA MUNICIPAL DE CHAPECÓ",
      "{{FASE}}": "PROJETO EXECUTIVO",
      "{{BAIRRO}}": "",
      "{{MES_ANO}}": "JUNHO/2026",
      "{{CODIGO_EXIBIDO}}": "040_26",
    },
    tituloCapa: "PROJETO ESTRUTURAL CONCRETO\nIMPLANTAÇÃO",
    extras: {},
    disciplina: "",
    tomo: "(TOMO 04)",
    volume: "VII",
  },
  escapar,
);
zip.file("content.xml", xml.slice(0, ini) + corpo + xml.slice(fim));
const odtPath = path.join(SAIDA, "040_26_capa_est_a.odt");
fs.writeFileSync(odtPath, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));

// ── 2. na tela ─────────────────────────────────────────────────────────────
const browser = await chromium.launch();
const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await entrarSemTela(contexto, BASE);
const page = await contexto.newPage();
await pularTourGuiado(page);
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await page.goto(`${BASE}/nexo?projeto=${PROJETO}`);
  await page.waitForSelector(".nx-zona", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.locator('input[type=file][accept*=".odt"][accept*="image"]').first().setInputFiles(odtPath);

  const card = page.locator('section[aria-label="Modelo de capa"]').last();
  await card.waitFor({ timeout: 90_000 });
  await page.screenshot({ path: path.join(SAIDA, "1-card.png"), fullPage: false });

  const linhas = await card.locator(".nx-modelo-linha").evaluateAll((els) =>
    els.map((el) => ({
      texto: el.querySelector(".nx-modelo-texto")?.textContent?.trim() ?? "",
      campo: el.querySelector("select")?.value ?? el.querySelector(".nx-ficha-valor")?.textContent?.trim() ?? "",
    })),
  );
  console.log(linhas.map((l) => `      ${l.texto}  →  ${l.campo}`).join("\n"));
  const campoDe = (t) => linhas.find((l) => l.texto === t)?.campo;
  confere(campoDe("040_26") === "CODIGO_EXIBIDO", "código reconhecido");
  confere(campoDe("JUNHO/2026") === "MES_ANO", "mês/ano reconhecido");
  confere(campoDe("(TOMO 04)") === "TOMO", "tomo reconhecido");
  confere(/\[Volume\]/.test(campoDe("Vol. VII") ?? ""), "volume reconhecido com o rótulo fixo");
  confere(campoDe("PROJETO EXECUTIVO") === "FASE", "fase reconhecida");
  confere(campoDe("PREFEITURA MUNICIPAL DE CHAPECÓ") === "FIXO", "órgão fica texto fixo");

  // O título da IA pode errar: o engenheiro corrige no card — é o que o card existe para fazer.
  for (const t of ["PROJETO ESTRUTURAL CONCRETO", "IMPLANTAÇÃO"]) {
    const sel = card.locator(".nx-modelo-linha", { hasText: t }).locator("select");
    if ((await sel.inputValue()) !== "TITULO_CAPA") {
      console.log(`      (corrigindo à mão: "${t}" veio como ${await sel.inputValue()})`);
      await sel.selectOption("TITULO_CAPA");
    }
  }
  const obra = card.locator(".nx-modelo-linha", { hasText: "REVITALIZAÇÃO" }).locator("select");
  if ((await obra.inputValue()) !== "NOME_OBRA") {
    console.log(`      (corrigindo à mão: obra veio como ${await obra.inputValue()})`);
    await obra.selectOption("NOME_OBRA");
  }

  await card.getByRole("button", { name: "Usar este modelo" }).click();
  const pronto = page.getByText("Pronto: as capas deste projeto saem deste modelo.");
  const recusa = card.locator('[role="alert"]');
  await pronto.or(recusa).first().waitFor({ timeout: 180_000 });
  await page.screenshot({ path: path.join(SAIDA, "2-gravado.png"), fullPage: false });
  const motivo = (await recusa.count()) > 0 ? await recusa.textContent() : null;
  confere(!motivo, `modelo gravado pela tela${motivo ? ` — recusado: ${motivo}` : ""}`);

  // ── 3. pela API, com a sessão da tela ────────────────────────────────────
  const cab = { "x-nexo-projeto": PROJETO, "Content-Type": "application/json" };
  const lista = await (await page.request.get(`${BASE}/api/capas/templates`, { headers: cab })).json();
  confere(lista.templates?.[0]?.id === `projeto:${PROJETO}`, "a lista de modelos traz o do projeto na frente");

  const selo = {
    fileName: "040_26_hid_001_a.pdf",
    disciplina: "HID",
    folha: 1,
    total: 1,
    numeroFolha: "01/01",
    arquivo: null,
    conteudo: "PLANTA",
    cliente: "PREFEITURA MUNICIPAL DE CHAPECÓ",
    secretaria: null,
    obra: "CENTRO DE EVENTOS ARENA BELVEDERE",
    fase: null,
    tituloSecao: null,
    data: "OUTUBRO/2026",
  };
  const res = await page.request.post(`${BASE}/api/nexo/capa`, {
    headers: cab,
    data: {
      selos: [selo],
      templateId: `projeto:${PROJETO}`,
      tituloCapa: "PROJETO HIDROSSANITÁRIO - REDE DE ESGOTO",
      numTomos: 1,
      tomoNumero: 2,
      volume: "9",
    },
  });
  const capa = await res.json();
  confere(res.ok(), `a capa gera com o modelo do projeto (${res.status()} ${capa.error ?? ""})`);
  if (res.ok()) {
    const odt = await JSZip.loadAsync(Buffer.from(capa.files.odt.data, "base64"));
    const texto = (await odt.file("content.xml").async("string")).replace(/<[^>]+>/g, " ");
    fs.writeFileSync(path.join(SAIDA, "capa-gerada.odt"), Buffer.from(capa.files.odt.data, "base64"));
    confere(/ARENA BELVEDERE/.test(texto), "a obra NOVA está na capa");
    confere(/HIDROSSANIT/.test(texto) && !/ESTRUTURAL CONCRETO/.test(texto), "o título novo entrou e o antigo saiu");
    confere(!/\{\{/.test(texto), "nenhum marcador sobrou");
    confere(/PREFEITURA MUNICIPAL DE CHAPEC/.test(texto), "o texto fixo continua");
    if (capa.files.pdf) {
      const pdf = Buffer.from(capa.files.pdf.data, "base64");
      fs.writeFileSync(path.join(SAIDA, "capa-gerada.pdf"), pdf);
      const paginas = (await PDFDocument.load(pdf)).getPageCount();
      confere(paginas === 1 && capa.paginasAMais === 0, `1 página, sem transbordo (${paginas}, a mais: ${capa.paginasAMais})`);
    } else {
      console.log(`      (sem PDF: ${capa.pdfError ?? "conversor indisponível"})`);
    }
  }
  confere(erros.length === 0, `sem erro de página${erros.length ? `: ${erros.join(" | ")}` : ""}`);
} finally {
  await browser.close();
  await apagarModelo();
  await banco.end();
}

console.log(falhas === 0 ? "\nPROVA OK" : `\n${falhas} FALHA(S)`);
process.exitCode = falhas === 0 ? 0 : 1;
