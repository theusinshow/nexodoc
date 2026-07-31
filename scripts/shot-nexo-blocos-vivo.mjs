// O volume de VÁRIAS DISCIPLINAS, ao vivo, com os PDFs reais do escritório.
//
// `shot-nexo-blocos.mjs` prova a INTERFACE com selos fabricados no IndexedDB —
// barato, repetível, e cego para tudo que acontece antes da tela: a leitura do
// carimbo, a disciplina saindo do nome do arquivo, a LD e a separatriz de cada
// bloco nascendo de verdade, e o PDF final saindo na ordem do escritório. Este
// aqui fecha essa lacuna: sobe as pranchas de `docs/samples/040-26/
// 10_his_inc_spd/arquivos separados`, deixa o Nexo ler os selos e monta o
// volume — e depois ABRE O PDF montado e confere a sequência página a página.
//
// A prova que importa não é o texto na tela, é o documento: uma capa e, depois
// dela, três blocos (his, inc, spd), cada um com a sua separatriz e a sua LD.
//
// CUSTA IA: uma chamada de leitura de selo POR PRANCHA, mais os turnos do
// agente. Por isso o padrão é 2 pranchas por disciplina (6 leituras) — o
// suficiente para os três blocos existirem. Ajuste com NEXO_BLOCOS_PRANCHAS.
//
//   npm run dev                            (noutro terminal)
//   node scripts/shot-nexo-blocos-vivo.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
// `/scratchpad` (ignorado pelo git), e NÃO `docs/ui-references`: as capturas
// daqui mostram as pranchas reais de `docs/samples`, que são dados
// confidenciais de projeto — o mesmo motivo de aquela pasta ser ignorada. As
// capturas versionadas do volume misto vêm do irmão semeado, que é fabricado.
const OUT = process.env.SHOT_OUT ?? "./scratchpad";
const POR_DISCIPLINA = Number(process.env.NEXO_BLOCOS_PRANCHAS ?? 2);
const PREFEITURA = "Chapeco";
const TITULO = "PROJETO TESTE BLOCOS";

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados",
);

/** As três disciplinas do volume 10, como o escritório as nomeia nas pastas. */
const DISCIPLINAS = [
  { codigo: "his", pasta: "1_his", rotulo: "Hidrossanitario" },
  { codigo: "inc", pasta: "2_inc", rotulo: "Preventivo contra incendio" },
  { codigo: "spd", pasta: "3_spd", rotulo: "SPDA" },
];

const PRANCHAS = DISCIPLINAS.flatMap((d) =>
  Array.from({ length: POR_DISCIPLINA }, (_, i) =>
    path.join(
      PASTA,
      d.pasta,
      `040_26_${d.codigo}_${String(i + 1).padStart(3, "0")}_a.pdf`,
    ),
  ),
);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/** Texto de cada página do PDF montado — é nele que a prova final se apoia. */
async function paginasDoPdf(bytes) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableWorker: true,
  }).promise;
  const paginas = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    paginas.push(
      content.items
        .map((it) => ("str" in it && typeof it.str === "string" ? it.str : ""))
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  await doc.destroy();
  return paginas;
}

/** minúsculas sem acento — o léxico do escritório também está sem acento. */
function normalizar(texto) {
  return texto
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

try {
  // --- login ---------------------------------------------------------------
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  check("abriu /nexo autenticado", page.url().includes("/nexo"));

  // --- anexar as pranchas REAIS --------------------------------------------
  // Pelo clipe, como o engenheiro faz: é o único input que dispara a leitura
  // dos selos.
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);
  console.log(`\n  lendo ${PRANCHAS.length} pranchas reais…`);

  await page
    .getByText(/folha\(s\) de selo lidas/i)
    .first()
    .waitFor({ timeout: 300000 });
  check("leu os selos das pranchas reais", true);
  await page.screenshot({ path: `${OUT}/vivo-1-leitura.png`, fullPage: true });

  // --- pedir capa, LD e separatriz -----------------------------------------
  const composer = page.locator("textarea").first();
  await composer.fill(
    `Crie a Capa, a LD e a Separatriz para a prefeitura de ${PREFEITURA}, o titulo e ${TITULO}`,
  );
  await composer.press("Enter");

  const cardPlano = page.getByText(/Vou gerar · \d+ documentos?/i);
  await cardPlano.first().waitFor({ timeout: 180000 });
  const textoPlano = await page.evaluate(() => document.body.innerText);

  // O PLANO tem de ver as três disciplinas — e essa leitura vem do NOME DO
  // ARQUIVO e do carimbo lido de verdade, não de selo semeado.
  check(
    "o plano diz que as pranchas são de 3 disciplinas",
    /pranchas são de 3 disciplinas/i.test(textoPlano),
  );
  for (const d of DISCIPLINAS) {
    check(
      `o plano conta ${POR_DISCIPLINA} folha(s) em ${d.rotulo}`,
      new RegExp(`${d.rotulo} \\(${POR_DISCIPLINA}\\)`, "i").test(textoPlano),
      "linha Disciplinas: " +
        (textoPlano.match(/Disciplinas\s+(.+)/)?.[1] ?? "(não achei)"),
    );
    check(
      `o plano tem LD e separatriz de ${d.rotulo}`,
      new RegExp(`LD · ${d.rotulo}`, "i").test(textoPlano) &&
        new RegExp(`Separatriz · ${d.rotulo}`, "i").test(textoPlano),
    );
  }
  // Uma capa + três LDs + três separatrizes.
  check(
    "o botão anuncia os 7 documentos",
    /Gerar os 7\b/.test(textoPlano),
    (textoPlano.match(/Gerar os \d+/) ?? ["(nenhum)"])[0],
  );
  await page.screenshot({ path: `${OUT}/vivo-2-plano.png`, fullPage: true });

  // --- gerar os sete --------------------------------------------------------
  await page.getByRole("button", { name: /Gerar os \d+/i }).first().click();
  await page
    .getByText(/Prontos no canvas/i)
    .first()
    .waitFor({ timeout: 300000 });
  check("gerou os documentos do plano", true);

  // --- pedir o volume -------------------------------------------------------
  await composer.fill("Monta o volume");
  await composer.press("Enter");

  const botaoMontar = page.getByRole("button", { name: /Montar volume/i }).first();
  await botaoMontar.waitFor({ timeout: 180000 });

  const textoVolume = await page.evaluate(() => document.body.innerText);
  // `\s*` entre o nome e a contagem: a lista é um flex, e cada span vira item
  // de bloco — o `innerText` os separa por QUEBRA DE LINHA, não por espaço.
  check(
    "o card do volume lista a sequência de blocos",
    DISCIPLINAS.every((d) =>
      new RegExp(`${d.rotulo}\\s*·\\s*${POR_DISCIPLINA} folhas?`, "i").test(
        textoVolume,
      ),
    ),
    "trecho BLOCOS: " +
      JSON.stringify(
        textoVolume.slice(
          textoVolume.indexOf("BLOCOS"),
          textoVolume.indexOf("BLOCOS") + 160,
        ),
      ),
  );
  check(
    "o card avisa que gera a separatriz e a LD que faltarem em cada bloco",
    /um bloco por disciplina/i.test(textoVolume),
  );
  await page.screenshot({ path: `${OUT}/vivo-3-volume.png`, fullPage: true });

  await botaoMontar.click();
  const linkDoVolume = page.getByRole("link", { name: /PDF do volume/i }).first();
  await linkDoVolume.waitFor({ timeout: 300000 });
  check("montou o volume", true);
  await page.screenshot({ path: `${OUT}/vivo-4-montado.png`, fullPage: true });

  // --- A PROVA: o PDF montado ----------------------------------------------
  // Tudo acima é o que a tela DIZ. O que vai para a prefeitura é o arquivo, e
  // é ele que se abre aqui.
  const href = await linkDoVolume.getAttribute("href");
  const b64 = await page.evaluate(async (url) => {
    const buf = new Uint8Array(await (await fetch(url)).arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 8192) {
      bin += String.fromCharCode(...buf.subarray(i, i + 8192));
    }
    return btoa(bin);
  }, href);
  const bytes = Buffer.from(b64, "base64");
  const destino = path.join(OUT, "volume-misto-vivo.pdf");
  writeFileSync(destino, bytes);
  console.log(`\n  volume montado salvo em ${destino} (${bytes.length} bytes)`);

  const paginas = await paginasDoPdf(bytes);
  console.log(`  ${paginas.length} páginas no volume`);

  /*
   * Classifica cada página pelo que ela DIZ. A separatriz é uma folha só com o
   * nome da disciplina; a LD carrega "LISTA DE DOCUMENTOS" no cabeçalho; a capa
   * traz o título e a prefeitura. O que sobra é prancha.
   */
  const marcos = paginas.map((texto, i) => {
    const t = normalizar(texto);
    const disciplina = DISCIPLINAS.find((d) =>
      t.includes(normalizar(d.rotulo)),
    );
    if (t.includes("lista de documentos")) {
      return { pagina: i + 1, tipo: "ld", codigo: disciplina?.codigo ?? "?" };
    }
    // A separatriz é curta: só o nome da disciplina numa folha vazia. A prancha
    // que cita a disciplina no carimbo tem texto de projeto em volta.
    if (disciplina && texto.length < 200) {
      return { pagina: i + 1, tipo: "separatriz", codigo: disciplina.codigo };
    }
    if (t.includes(normalizar(TITULO)) && t.includes("chapeco")) {
      return { pagina: i + 1, tipo: "capa", codigo: "" };
    }
    return { pagina: i + 1, tipo: "prancha", codigo: disciplina?.codigo ?? "" };
  });

  console.log("\n  sequência do PDF:");
  for (const m of marcos) {
    console.log(
      `    p.${String(m.pagina).padStart(2, " ")}  ${m.tipo}${m.codigo ? ` · ${m.codigo}` : ""}`,
    );
  }

  check(
    "o volume começa pela capa",
    marcos[0]?.tipo === "capa",
    `página 1 é "${marcos[0]?.tipo}" :: ${paginas[0]?.slice(0, 120)}`,
  );
  check(
    "só existe UMA capa (ela não se multiplica por bloco)",
    marcos.filter((m) => m.tipo === "capa").length === 1,
  );
  check(
    "há três separatrizes, uma por disciplina",
    DISCIPLINAS.every(
      (d) =>
        marcos.filter((m) => m.tipo === "separatriz" && m.codigo === d.codigo)
          .length === 1,
    ),
    marcos.filter((m) => m.tipo === "separatriz").map((m) => m.codigo).join(","),
  );
  check(
    "há três LDs, uma por disciplina",
    DISCIPLINAS.every(
      (d) =>
        marcos.filter((m) => m.tipo === "ld" && m.codigo === d.codigo).length === 1,
    ),
    marcos.filter((m) => m.tipo === "ld").map((m) => m.codigo).join(","),
  );

  // A ORDEM é o que a prefeitura devolve quando está errada: capa, e então
  // separatriz → LD → pranchas, disciplina a disciplina.
  const esperada = ["capa"];
  for (const d of DISCIPLINAS) {
    esperada.push(`separatriz:${d.codigo}`, `ld:${d.codigo}`);
  }
  const obtida = marcos
    .filter((m) => m.tipo !== "prancha")
    .map((m) => (m.tipo === "capa" ? "capa" : `${m.tipo}:${m.codigo}`));
  check(
    "a ordem é capa e, depois, separatriz → LD por disciplina",
    obtida.join(" | ") === esperada.join(" | "),
    `obtida: ${obtida.join(" | ")}`,
  );

  // Cada bloco tem de levar as SUAS pranchas, e todas elas.
  for (const d of DISCIPLINAS) {
    const iSep = marcos.findIndex(
      (m) => m.tipo === "separatriz" && m.codigo === d.codigo,
    );
    const proximo = marcos.findIndex(
      (m, i) => i > iSep && m.tipo === "separatriz",
    );
    const fim = proximo === -1 ? marcos.length : proximo;
    const pranchas = marcos
      .slice(iSep, fim)
      .filter((m) => m.tipo === "prancha").length;
    check(
      `o bloco de ${d.rotulo} leva as suas ${POR_DISCIPLINA} pranchas`,
      pranchas === POR_DISCIPLINA,
      `${pranchas} páginas de prancha entre a separatriz e o bloco seguinte`,
    );
  }

  // --- CONFERÊNCIA: determinística e, depois, a do selo --------------------
  // Aqui é onde o volume misto quebrava a conferência: cada disciplina numera
  // as suas folhas de 1 a N, e conferir as 6 como uma sequência só acusava
  // duplicatas (1 e 2, três vezes cada) num conjunto perfeitamente normal.
  await composer.fill("Confere as folhas");
  await composer.press("Enter");

  const botaoConferir = page.getByRole("button", { name: /^Conferir$/i }).first();
  await botaoConferir.waitFor({ timeout: 180000 });
  await botaoConferir.click();
  await page
    .getByText(/achado\(s\)/i)
    .first()
    .waitFor({ timeout: 60000 });
  await page.waitForTimeout(500);

  const textoConf = await page.evaluate(() => document.body.innerText);
  check(
    "a conferência NÃO acusa folha duplicada (cada bloco numera do 1)",
    !/duplicado/i.test(textoConf),
    (textoConf.match(/.*duplicado.*/i) ?? [""])[0],
  );
  check(
    "a conferência anuncia a composição do volume misto",
    /3 disciplinas/i.test(textoConf),
  );
  check(
    "o que ela acusa de sequência vem NOMEADO pelo bloco",
    !/sequ/i.test(textoConf) ||
      /(Hidrossanitario|Preventivo contra incendio|SPDA):/i.test(textoConf),
  );
  await page.screenshot({ path: `${OUT}/vivo-5-conferencia.png`, fullPage: true });

  // A conferência do SELO: uma chamada de visão num modelo pequeno, sobre uma
  // folha por disciplina. Custa pouco e responde a outra pergunta — para QUEM
  // este volume está indo.
  const botaoSelo = page.getByRole("button", { name: /Conferir o selo/i }).first();
  await botaoSelo.waitFor({ timeout: 30000 });
  check("o botão da conferência do selo está habilitado", await botaoSelo.isEnabled());
  await botaoSelo.click();
  await page
    .getByText(/folha\(s\) conferida\(s\)/i)
    .first()
    .waitFor({ timeout: 180000 });

  const textoSelo = await page.evaluate(() => document.body.innerText);
  // O que a IA leu e o que a regra concluiu, na saída: um teste que só afirma
  // "não deu crítico" passaria igual com o modelo devolvendo tudo vazio.
  const trecho = textoSelo.slice(textoSelo.indexOf("Selo ·"));
  console.log(`\n  conferência do selo:\n${trecho.slice(0, 700).replace(/^/gm, "    ")}`);

  const amostras = textoSelo.match(/Selo · (\d+) folha\(s\) conferida\(s\)/i);
  check(
    "leu uma amostra de selos — uma folha por disciplina",
    amostras != null && Number(amostras[1]) === DISCIPLINAS.length,
    amostras ? `${amostras[1]} folha(s)` : "(não achei o resumo)",
  );
  // O gabarito é Chapecó e as pranchas SÃO de Chapecó: o achado crítico de
  // órgão/brasão não pode aparecer. Se aparecer, ou a leitura está ruim ou a
  // regra está apertada demais — os dois são defeito.
  check(
    "não acusa órgão nem brasão de outra prefeitura (as pranchas são de Chapecó)",
    !/\[orgao\]/i.test(textoSelo) && !/Brasão de outro órgão/i.test(textoSelo),
    (textoSelo.match(/.*(orgao|Brasão de outro).*/i) ?? [""])[0],
  );
  await page.screenshot({ path: `${OUT}/vivo-6-selo.png`, fullPage: true });

  check(
    "nenhum erro de runtime no console",
    errosDeConsole.length === 0,
    errosDeConsole.slice(0, 2).join(" | "),
  );
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
  await page
    .screenshot({ path: `${OUT}/vivo-erro.png`, fullPage: true })
    .catch(() => {});
} finally {
  await browser.close();
}

console.log(
  falhas === 0
    ? `\nTUDO OK. Capturas e PDF em ${OUT}\n`
    : `\n${falhas} FALHA(S). Capturas em ${OUT}\n`,
);
process.exit(falhas === 0 ? 0 : 1);
