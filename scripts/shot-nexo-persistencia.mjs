// Prova de que capa, volume e separatriz gerados no Nexo entram no BANCO.
//
// Existe porque persistência não se verifica por tipo nem por lint: a rota pode
// compilar, responder 200 e não gravar nada. A única prova é contar o banco
// antes e depois.
//
// NÃO CUSTA IA: os três motores são determinísticos (nenhuma chamada de modelo
// em buildCapaProposal, assembleVolume ou na separatriz). Os selos são
// fabricados aqui — é justamente por não precisar do OCR que esta prova é
// barata de repetir.
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-persistencia.mjs
//
// Os registros de teste são APAGADOS no fim (só os que este script criou, por
// id). Use KEEP=1 para mantê-los e inspecionar à mão.
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { PDFDocument } from "pdf-lib";
import pg from "pg";

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

// --- banco -----------------------------------------------------------------
// DATABASE_URL mora no .env.local (gitignored); lemos direto porque o script
// roda fora do Next e não tem o carregamento de env dele.
function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = readFileSync(".env.local", "utf8");
  const linha = env.split(/\r?\n/).find((l) => l.startsWith("DATABASE_URL="));
  if (!linha) throw new Error("DATABASE_URL nao encontrada no .env.local");
  return linha.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
}

const db = new pg.Client({ connectionString: databaseUrl() });
await db.connect();

async function contarArtefatos() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total FROM "DocumentArtifact"`,
  );
  return rows[0].total;
}

// --- PDF de brinquedo (para as partes do volume) ---------------------------
async function pdfDeTeste(texto, paginas = 1) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`${texto} ${i + 1}`, { x: 60, y: 780, size: 18 });
  }
  return Buffer.from(await doc.save()).toString("base64");
}

// Marcadores que identificam SÓ o que este script criou (usados na limpeza).
// O código sai do nome fabricado das pranchas ("999_26_..."), que nenhum projeto
// real usa — é ele, e não o nome da obra, que sobrevive a qualquer normalização
// que o builder da capa faça no texto.
const MARCADOR_CODIGO = "999-26";
const MARCADOR_OBRA = "PROVA DE PERSISTENCIA DO NEXO";
const MARCADOR_TITULO = "PROVA DE PERSISTENCIA";
const MARCADOR_VOLUME = "prova-persistencia.pdf";

// Selos fabricados: duas pranchas da mesma obra/disciplina, como sairiam do OCR.
const SELOS = [1, 2].map((n) => ({
  fileName: `999_26_arq_${String(n).padStart(3, "0")}_a.pdf`,
  pageNumber: n,
  disciplina: "ARQUITETURA",
  folha: n,
  total: 2,
  numeroFolha: `0${n}/02`,
  arquivo: `999_26_arq_${String(n).padStart(3, "0")}_a`,
  conteudo: "PLANTA BAIXA",
  cliente: "PREFEITURA MUNICIPAL DE CHAPECO",
  secretaria: null,
  obra: MARCADOR_OBRA,
  fase: "PROJETO BASICO",
  tituloSecao: null,
}));

const antes = await contarArtefatos();
const inicio = new Date();
console.log(`\nDocumentArtifact antes: ${antes}`);

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
let criados = [];

try {
  // --- login (dev) ---------------------------------------------------------
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 20000 });
  }
  check("autenticado", page.url().includes("/nexo"), page.url());

  // As chamadas vão pelo `context.request`: mesma sessão do navegador, sem
  // passar pela interface — o que está sob prova é a ROTA, não a tela.
  const api = context.request;

  // --- capa ----------------------------------------------------------------
  const capa = await api.post(`${BASE}/api/nexo/capa`, {
    data: {
      selos: SELOS,
      templateId: "prefchap",
      tituloCapa: MARCADOR_TITULO,
      numTomos: 1,
    },
  });
  const capaJson = await capa.json();
  check("capa gerada", capa.ok() && Boolean(capaJson.files?.odt), JSON.stringify(capaJson).slice(0, 200));

  // --- separatriz (LOTE: uma folha por disciplina) --------------------------
  const DISCIPLINAS = [MARCADOR_TITULO, "PROJETO DE CFTV", "PROJETO DE SPDA"];
  const sep = await api.post(`${BASE}/api/nexo/separatriz`, {
    data: { titulos: DISCIPLINAS, codigo: MARCADOR_CODIGO, revisao: "a" },
  });
  const sepJson = await sep.json();
  check(
    "separatriz gerada (ODT+PDF)",
    sep.ok() && Boolean(sepJson.odt) && Boolean(sepJson.pdf),
    sepJson.pdfError ?? JSON.stringify(sepJson).slice(0, 200),
  );
  check(
    "nome do arquivo com codigo e revisao",
    sepJson.odt?.name === "999-26_separatrizes_a.odt" &&
      sepJson.pdf?.name === "999-26_separatrizes_a.pdf",
    `${sepJson.odt?.name} / ${sepJson.pdf?.name}`,
  );
  // A prova do lote: 3 disciplinas TÊM de virar 3 folhas. Contar as páginas do
  // PDF é o único jeito de saber que a quebra de página aconteteu de verdade —
  // um ODT com os 3 títulos empilhados numa página só passaria em tudo o resto.
  let paginasSep = null;
  if (sepJson.pdf) {
    const doc = await PDFDocument.load(Buffer.from(sepJson.pdf.data, "base64"));
    paginasSep = doc.getPageCount();
  }
  check(
    "uma folha por disciplina (3 paginas)",
    paginasSep === DISCIPLINAS.length,
    `paginas=${paginasSep}`,
  );

  // --- volume --------------------------------------------------------------
  const vol = await api.post(`${BASE}/api/nexo/volume`, {
    data: {
      fileName: MARCADOR_VOLUME,
      parts: [
        { role: "capa", name: "capa.pdf", data: await pdfDeTeste("CAPA") },
        { role: "ld", name: "ld.pdf", data: await pdfDeTeste("LD") },
        { role: "prancha", name: "pranchas.pdf", data: await pdfDeTeste("PRANCHA", 2) },
      ],
    },
  });
  const volJson = await vol.json();
  check("volume montado", vol.ok() && Boolean(volJson.pdf), JSON.stringify(volJson).slice(0, 200));
  check("volume com 4 paginas", volJson.pageCount === 4, `pageCount=${volJson.pageCount}`);

  // --- o que entrou no banco ----------------------------------------------
  // Filtro pelos MARCADORES de teste, não por "artefatos recentes": este script
  // apaga o que encontra aqui, e o banco de dev é o mesmo em que o engenheiro
  // trabalha. Levar junto uma capa de verdade gerada no minuto anterior seria
  // um estrago silencioso.
  const { rows } = await db.query(
    `SELECT id, module, kind, "fileName", "sizeBytes", metadata, "userEmail"
       FROM "DocumentArtifact"
      WHERE metadata->>'origem' = 'nexo'
        AND "createdAt" >= $1
        AND (metadata->>'codigo' = $2
             OR metadata->>'titulo' = $3
             OR "fileName" = $4)
      ORDER BY "createdAt" ASC`,
    [inicio, MARCADOR_CODIGO, MARCADOR_TITULO, MARCADOR_VOLUME],
  );
  criados = rows.map((r) => r.id);

  const depois = await contarArtefatos();
  console.log(`DocumentArtifact depois: ${depois} (+${depois - antes})\n`);
  for (const r of rows) {
    console.log(
      `  ${r.module.padEnd(13)} ${r.kind.padEnd(11)} ${String(r.sizeBytes).padStart(8)} B  ${r.fileName}`,
    );
  }
  console.log("");

  const porModulo = (m) => rows.filter((r) => r.module === m);
  const capaRows = porModulo("capas");
  check(
    "capa registrada (ODT+PDF+ZIP)",
    capaRows.length === 3 &&
      ["COVER_ODT", "COVER_PDF", "COVER_ZIP"].every((k) =>
        capaRows.some((r) => r.kind === k),
      ),
    capaRows.map((r) => r.kind).join(","),
  );
  check(
    "capa com a identidade certa",
    capaRows[0]?.metadata?.codigo === MARCADOR_CODIGO &&
      capaRows[0]?.metadata?.obra === MARCADOR_OBRA &&
      capaRows[0]?.metadata?.prefeitura?.toLowerCase().includes("chapec"),
    JSON.stringify(capaRows[0]?.metadata),
  );
  const sepRows = porModulo("separatrizes");
  check(
    "separatriz registrada (ODT+PDF, 3 folhas)",
    sepRows.length === 2 &&
      sepRows[0].metadata?.folhas === DISCIPLINAS.length &&
      sepRows[0].metadata?.titulo === MARCADOR_TITULO,
    `${sepRows.length} linha(s) :: ${JSON.stringify(sepRows[0]?.metadata)}`,
  );
  const volRows = porModulo("volumes");
  check(
    "volume registrado com as partes",
    volRows.length === 1 &&
      volRows[0].kind === "VOLUME_PDF" &&
      volRows[0].metadata?.pageCount === 4 &&
      volRows[0].metadata?.partes?.prancha === 1,
    JSON.stringify(volRows[0]?.metadata),
  );
  check(
    "artefatos com dono e tamanho",
    rows.length > 0 && rows.every((r) => r.userEmail && r.sizeBytes > 0),
  );
} catch (err) {
  falhas++;
  console.error(`  FALHOU  execucao :: ${err.message}`);
} finally {
  await browser.close();

  if (criados.length > 0 && !KEEP) {
    await db.query(`DELETE FROM "DocumentArtifact" WHERE id = ANY($1::text[])`, [criados]);
    const final = await contarArtefatos();
    console.log(`\nLimpeza: ${criados.length} registros de teste removidos (total voltou a ${final}).`);
    check("banco voltou ao estado inicial", final === antes, `${final} != ${antes}`);
  }

  await db.end();
}

console.log(falhas === 0 ? "\nTUDO OK\n" : `\n${falhas} FALHA(S)\n`);
process.exit(falhas === 0 ? 0 : 1);
