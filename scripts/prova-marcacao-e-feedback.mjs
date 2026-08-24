// A MARCAÇÃO DO TRECHO E O FEEDBACK VISUAL DO ACHADO — no navegador, sem token.
//
//   node scripts/prova-marcacao-e-feedback.mjs   (== npm run prova:marcacao-ui)
//
// Duas coisas que asserção de DOM sozinha deixa passar, e que foram apontadas
// numa auditoria real em 24/08/2026:
//
//  1. "a marcação dos trechos nas páginas está ficando imprecisa" — o visor
//     marcava CADA PALAVRA da evidência com 4 letras ou mais, span por span, e
//     a página inteira acendia. Contar `<mark>` prova isso: o número de marcas
//     tem que ser da ordem das palavras do trecho, não das ocorrências delas na
//     folha.
//  2. o julgamento do achado não tinha peso visual. Aqui se mede a COR do
//     cartão e a CAIXA do selo de cuidado contra a caixa do cartão — presença
//     no DOM já passou verde nesta casa com o elemento fora da tela.
//
// A rota de feedback é interceptada: o que se prova é a tela, e um `auditId`
// semeado não existe no banco.
import fs from "node:fs";

import { chromium } from "playwright";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL = process.env.AUDIT_PDF ?? "tests/117_25_md_geral_a.pdf";

fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/*
 * O TRECHO ESCOLHIDO A DEDO. A página 32 do 117_25 traz "Deverão ser seguidas
 * as Instruções de Serviço do DNIT"; "Serviço" e "DNIT" se repetem na mesma
 * folha (a tabela logo abaixo tem cinco linhas de DNIT), que é exatamente a
 * condição que fazia a folha acender.
 */
const TERMO = "Deverão ser seguidas as Instruções de Serviço do DNIT";
const PAGINA = 32;

const ACHADOS = [
  {
    id: "INC-001",
    prioridade: "Media",
    pagina: String(PAGINA),
    capitulo: "3. Projeto de terraplenagem",
    local: "3.4.7 Recomendações",
    tipo: "Escopo / contratual",
    descricao: "O memorial remete às Instruções de Serviço do DNIT sem listar quais se aplicam.",
    evidencia: TERMO,
    termo_busca: TERMO,
    conflito: "Quem executa não sabe qual instrução seguir.",
    sugestao_correcao: "Listar as IS aplicáveis com número e ano.",
    referencia_comparada: "Tabela de especificações da pág. 32.",
    categoria: "terraplenagem",
    confianca: "alta",
    origem: "ia",
    impacto: "tecnico_contratual",
  },
  {
    id: "INC-002",
    prioridade: "Baixa",
    pagina: String(PAGINA),
    capitulo: "3. Projeto de terraplenagem",
    local: "3.4.8 Quantidades",
    tipo: "Quantitativo",
    descricao: "Quantidades apresentadas sem memória de cálculo.",
    evidencia: "Cortes de 1a Categoria = 306 m3",
    termo_busca: "Cortes de 1a Categoria",
    conflito: "Não dá para conferir o volume.",
    sugestao_correcao: "Anexar a memória de cálculo.",
    referencia_comparada: "Item 3.4.8.",
    categoria: "terraplenagem",
    confianca: "media",
    origem: "ia",
    impacto: "revisao_editorial",
  },
];

const pdfB64 = fs.readFileSync(MEMORIAL).toString("base64");
const nomeDoPdf = MEMORIAL.split(/[\\/]/).pop();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

// A tela é o que se prova; a gravação tem prova própria.
await page.route("**/api/audits/*/feedback", (route) =>
  route.request().method() === "POST"
    ? route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
    : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ itens: [] }) }),
);

await pularTourGuiado(page);
await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });

if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL("**/nexo**", { timeout: 30000 });
}
await page.waitForTimeout(1500);

const convId = "qa-marcacao-e-feedback";

await page.evaluate(
  async ({ pdfB64, nomeDoPdf, achados, convId }) => {
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
    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA — marcacao e feedback",
        createdAt: agora,
        updatedAt: agora,
        messages: [
          { id: "m1", role: "user", content: `Anexei o memorial — ${nomeDoPdf}` },
          { id: "m2", role: "assistant", content: "Auditoria concluída." },
        ],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:qa-marcacao",
            kind: "auditoria",
            summary: "Auditoria do memorial",
            files: [],
            payload: {
              auditId: "qa-marcacao",
              texto: "RESULTADO DA AUDITORIA",
              report: {
                tipo_auditoria: "memorial",
                tipo_documento: "memorial descritivo",
                obra: "UBS Vila Manaus - Porte 1",
                codigo: "117-25",
                municipio: "Criciúma",
                data_documento: "",
                status_analise: "concluida",
                status_geral: "com pontos de revisão",
                total_incongruencias: achados.length,
                arquivos_analisados: [
                  {
                    arquivo: nomeDoPdf,
                    tipo_documento: "memorial descritivo",
                    paginas: 218,
                    caracteres_extraidos: 469053,
                    resumo: "Memorial descritivo geral.",
                  },
                ],
                comparacoes: [],
                conclusao: "Dois pontos de revisão.",
                incongruencias: achados,
              },
            },
          },
        ],
        memorial: { name: nomeDoPdf, blobKey: `${convId}:memorial` },
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  { pdfB64, nomeDoPdf, achados: ACHADOS, convId },
);

// O MESMO caminho de `shot-cartao-de-achado.mjs`: recarrega, abre a conversa
// pela barra lateral e vai para a aba dos achados. Navegar por `?c=` não
// hidrata o parecer.
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

await page
  .locator("aside button, [class*=sidebar] button")
  .filter({ hasText: /marcacao e feedback/i })
  .first()
  .click();
await page.waitForTimeout(2500);

const abaAchados = page.getByRole("button", { name: /^Achados/i });
if ((await abaAchados.count()) > 0) await abaAchados.first().click();
await page.waitForTimeout(1500);

await page.waitForSelector("[data-achado]", { timeout: 60000 });
await page.waitForTimeout(1200);

const cartoes = page.locator("[data-achado]");
check("os dois achados aparecem", (await cartoes.count()) === 2, `veio ${await cartoes.count()}`);

// ---------------------------------------------------------------------------
// 1. O FEEDBACK VISUAL — primeiro, porque o visor é um portal que cobre a lista
// ---------------------------------------------------------------------------
const primeiro = cartoes.first();
await primeiro.scrollIntoViewIfNeeded();

const corAntes = await primeiro.evaluate((el) => getComputedStyle(el).backgroundColor);

await primeiro.getByRole("button", { name: /^Falso positivo$/i }).click();
await page.waitForTimeout(1000);

const corDepois = await primeiro.evaluate((el) => getComputedStyle(el).backgroundColor);
check(
  "o cartao MUDA DE COR ao ser marcado falso positivo",
  corAntes !== corDepois,
  `antes ${corAntes} / depois ${corDepois}`,
);

const rgb = (corDepois.match(/[\d.]+/g) ?? []).map(Number);
check(
  "a cor nova e ambar (vermelho e verde acima do azul)",
  rgb.length >= 3 && rgb[0] > rgb[2] && rgb[1] > rgb[2],
  `rgb ${JSON.stringify(rgb)}`,
);

const selo = primeiro.locator("[data-selo-de-cuidado]");
check("o selo de cuidado existe", (await selo.count()) === 1);

if ((await selo.count()) === 1) {
  const medida = await primeiro.evaluate((cartao) => {
    const marca = cartao.querySelector("[data-selo-de-cuidado]");
    const svg = marca?.querySelector("svg");
    if (!marca || !svg) return null;
    const c = cartao.getBoundingClientRect();
    const s = svg.getBoundingClientRect();
    return {
      cartao: { w: Math.round(c.width), h: Math.round(c.height) },
      svg: { w: Math.round(s.width), h: Math.round(s.height) },
      dentro:
        s.left >= c.left - 1 && s.right <= c.right + 1 && s.top >= c.top - 1 && s.bottom <= c.bottom + 1,
      opacidade: Number(getComputedStyle(svg).opacity),
      cliqueAtravessa: getComputedStyle(marca).pointerEvents === "none",
    };
  });

  console.log(`
  selo: ${JSON.stringify(medida)}
`);
  check("o selo esta DENTRO do cartao", medida?.dentro === true, JSON.stringify(medida));
  check(
    "o selo toma o cartao (>= 35% da altura)",
    medida && medida.svg.h / medida.cartao.h >= 0.35,
    `${medida?.svg.h} de ${medida?.cartao.h}`,
  );
  check(
    "o selo e transparente (nao tapa o texto)",
    medida && medida.opacidade > 0 && medida.opacidade <= 0.25,
    `opacidade ${medida?.opacidade}`,
  );
  check("o clique atravessa o selo", medida?.cliqueAtravessa === true);
}

const area = primeiro.locator("[data-veredito-do-achado]");
check(
  'a area de feedback registra "FALSE_POSITIVE"',
  (await area.getAttribute("data-veredito-do-achado")) === "FALSE_POSITIVE",
);

await page.screenshot({ path: `${OUT}/feedback-falso-positivo.png` });

// --- o CONFIRMADO, no outro cartao ------------------------------------------
const segundo = cartoes.nth(1);
await segundo.scrollIntoViewIfNeeded();
await segundo.getByRole("button", { name: /^Correto$/i }).click();
await page.waitForTimeout(1000);

const areaOk = segundo.locator("[data-veredito-do-achado]");
check(
  'a area de feedback registra "CONFIRMED"',
  (await areaOk.getAttribute("data-veredito-do-achado")) === "CONFIRMED",
);

const corOk = await areaOk.evaluate((el) => getComputedStyle(el).backgroundColor);
const rgbOk = (corOk.match(/[\d.]+/g) ?? []).map(Number);
check(
  "a area do confirmado e VERDE (verde acima de vermelho)",
  rgbOk.length >= 3 && rgbOk[1] > rgbOk[0],
  `rgb ${JSON.stringify(rgbOk)}`,
);

check(
  "o cartao do confirmado NAO ganha selo de cuidado",
  (await segundo.locator("[data-selo-de-cuidado]").count()) === 0,
);

await page.screenshot({ path: `${OUT}/feedback-confirmado.png` });

// ---------------------------------------------------------------------------
// 2. A MARCAÇÃO DO TRECHO, no visor
// ---------------------------------------------------------------------------
const verNoDocumento = page.getByRole("button", { name: /Ver no documento/i });
check("o botao 'Ver no documento' existe", (await verNoDocumento.count()) > 0);

if ((await verNoDocumento.count()) > 0) {
  await verNoDocumento.first().click();
  // O react-pdf baixa o worker e renderiza a camada de texto; nao ha evento.
  await page.waitForSelector(".react-pdf__Page__textContent", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(4000);

  const visor = page.locator(".react-pdf__Page__textContent").first();

  if ((await visor.count()) === 0) {
    check("o visor de PDF abriu", false, "nenhuma camada de texto do react-pdf na tela");
    await page.screenshot({ path: `${OUT}/marcacao-visor-nao-abriu.png` });
  } else {
    const marcas = visor.locator("mark");
    const total = await marcas.count();
    const textos = await marcas.allInnerTexts();

    console.log(`
  marcas na pagina: ${total}`);
    console.log(`  conteudo: ${JSON.stringify(textos.slice(0, 24))}
`);

    /*
     * O TRECHO TEM 9 PALAVRAS. Com a marcacao por palavra solta, "Servico" e
     * "DNIT" sozinhos ja rendiam mais de 15 marcas nesta folha. O teto de 12
     * deixa folga para o pdf.js fatiar as 9 palavras em mais spans que o
     * esperado, e ainda assim reprova o espalhamento.
     */
    check(
      "A PAGINA NAO ACENDE INTEIRA — marcas na ordem do trecho, nao das ocorrencias",
      total > 0 && total <= 12,
      `${total} marcas`,
    );

    const juntado = textos.join(" ").replace(/\s+/g, " ").toLowerCase();
    check(
      "o que esta marcado e o trecho citado",
      juntado.includes("instru") && juntado.includes("servi"),
      juntado.slice(0, 200),
    );

    /*
     * A MEDIDA QUE PEGA O DEFEITO DE VERDADE.
     *
     * As 9 marcas acima SÃO as 9 palavras do trecho — o pdf.js entrega uma por
     * span, e todas marcadas é o resultado certo. O que distingue "marcou o
     * trecho" de "acendeu a folha" é o resto da página: esta folha tem cinco
     * linhas de tabela com "DNIT" e três outras com "Serviço", e nenhuma delas
     * pode estar marcada.
     *
     * Contamos os spans da camada de texto que contêm a palavra e quantos deles
     * saíram marcados. Antes: todos. Agora: só o que está dentro do trecho.
     */
    const repetidas = await visor.evaluate((camada) => {
      const conta = (palavra) => {
        const spans = [...camada.querySelectorAll("span")].filter(
          (s) => !s.querySelector("span") && s.textContent?.includes(palavra),
        );
        return {
          naPagina: spans.length,
          marcados: spans.filter((s) => s.querySelector("mark")).length,
        };
      };
      return { dnit: conta("DNIT"), servico: conta("Serviço") };
    });

    console.log(`  repeticoes: ${JSON.stringify(repetidas)}
`);

    check(
      "a folha REPETE as palavras do trecho (senao a prova nao prova nada)",
      repetidas.dnit.naPagina >= 4,
      `so ${repetidas.dnit.naPagina} spans com DNIT`,
    );
    check(
      "A FOLHA NAO ACENDE: das N ocorrencias de 'DNIT', so a do trecho esta marcada",
      repetidas.dnit.marcados === 1,
      `${repetidas.dnit.marcados} de ${repetidas.dnit.naPagina} marcados`,
    );
    check(
      "idem para 'Servico'",
      repetidas.servico.marcados <= 1,
      `${repetidas.servico.marcados} de ${repetidas.servico.naPagina} marcados`,
    );

    await page.screenshot({ path: `${OUT}/marcacao-do-trecho.png` });
  }
}

await browser.close();

console.log(`\n${falhas === 0 ? "TODAS AS PROVAS PASSARAM" : `${falhas} PROVA(S) FALHARAM`}`);
console.log(`imagens em ${OUT}`);
process.exit(falhas === 0 ? 0 : 1);
