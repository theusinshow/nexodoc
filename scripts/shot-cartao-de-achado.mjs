// O CARTÃO DE ACHADO reorganizado, e o resumo — sem gastar um token.
//
//   node scripts/shot-cartao-de-achado.mjs   (== npm run shot:achado)
//
// Semeia um parecer no IndexedDB (mesmo caminho de `prova-auditoria-ui.mjs`) com
// três achados escolhidos para exercitar o que mudou:
//
//   · um MULTI-PÁGINA, com as páginas escondidas na prosa de
//     `referencia_comparada` — é o caso que a tela descartava num `||`;
//   · um de UMA página só, que não pode ganhar fita nem "ver trechos";
//   · um CRÍTICO, para a faixa bloqueadora do resumo ter conteúdo.
//
// Mede o que asserção de DOM deixa passar: que a etiqueta diz "4 páginas" e não
// "página 8", que a fita tem os quatro números, e que o cartão não rola na
// horizontal dentro da caixa do Nexo — que é estreita mesmo com a janela larga.
import fs from "node:fs";

import { chromium } from "playwright";

import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NexoDoc\\NEXO - TESTES\\Memoriais\\013_26_md_geral_a.pdf";

fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const ACHADOS = [
  {
    id: "INC-001",
    prioridade: "Alta",
    pagina: "84",
    capitulo: "9. Responsabilidade técnica",
    local: "Atribuição dos responsáveis por disciplina",
    tipo: "Escopo / contratual",
    descricao:
      "O memorial atribui responsável técnico a 4 disciplinas e deixa “Projeto Estrutural de Concreto”, “Preventivo Contra Incêndio” e “SPDA” sem atribuição.",
    evidencia:
      "A pág. 84 relaciona “Projeto Arquitetônico”, “Projetos de Estruturas Metálicas”, “Hidrossanitário e Preventivo”, “Elétrico” e “Topografia”.",
    termo_busca: "Projetos de Estruturas Metálicas",
    conflito:
      "A prefeitura devolve o memorial sem a atribuição expressa por disciplina na análise de conformidade — atrasa a aprovação e trava a emissão do volume.",
    sugestao_correcao:
      "Acrescentar as três linhas faltantes com nome e título do responsável conforme ART/RRT antes de gerar o documento.",
    referencia_comparada: "Disciplinas declaradas na pág. 84.",
    categoria: "responsabilidade técnica",
    confianca: "alta",
    origem: "regra",
    impacto: "critico_documental",
  },
  {
    id: "INC-002",
    prioridade: "Media",
    pagina: "8",
    capitulo: "2. Quadro de áreas",
    local: "Memorial descritivo · itens 2.1 a 7.4",
    tipo: "Quantitativo",
    descricao: "“m²” e “metros quadrados” aparecem no mesmo documento, em 11 lugares.",
    evidencia: "área total de intervenção de 1.240 m², conforme levantamento topográfico.",
    termo_busca: "m²",
    conflito:
      "A prefeitura devolve memorial com unidade inconsistente na análise de conformidade — atrasa a aprovação.",
    sugestao_correcao:
      "Adotar “m²” nas 4 ocorrências por extenso. É a forma predominante: 7 das 11.",
    // AQUI está o caso: as outras páginas moram nesta frase, e a tela as jogava fora.
    referencia_comparada:
      "Unidade predominante inferida: m² (7 ocorrência(s), páginas 8, 60, 71, 105).",
    categoria: "padronização de unidades",
    confianca: "alta",
    origem: "regra",
    impacto: "tecnico_contratual",
  },
  {
    id: "INC-003",
    prioridade: "Baixa",
    pagina: "12",
    capitulo: "3. Objeto",
    local: "Capa e item 3.2 do memorial",
    tipo: "Redação / editorial",
    descricao:
      "A capa traz “Reforma da Cancha de Bocha” e o item 3.2 traz “Reforma da Quadra de Bocha”.",
    evidencia: "objeto: Reforma da Quadra de Bocha, conforme projeto arquitetônico.",
    termo_busca: "Reforma da Quadra de Bocha",
    conflito:
      "Divergência interna do documento: não há base para afirmar reprovação, mas a descrição do objeto deixa de bater com a capa.",
    sugestao_correcao:
      "Conferir com o responsável pelo contrato qual denominação é a oficial e aplicar a mesma nos dois lugares.",
    referencia_comparada: "Nome da capa: Reforma da Cancha de Bocha.",
    categoria: "identidade do documento",
    confianca: "media",
    origem: "ia",
    impacto: "revisao_editorial",
  },
];

const pdfB64 = fs.readFileSync(MEMORIAL).toString("base64");
const nomeDoPdf = MEMORIAL.split(/[\\/]/).pop();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

await pularTourGuiado(page);
await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });

if (page.url().includes("/login")) {
  await page.getByRole("button", { name: /Entrar como dev/i }).click();
  await page.waitForURL("**/nexo**", { timeout: 20000 });
}

await page.waitForTimeout(1500);

await page.evaluate(
  async ({ pdfB64, nomeDoPdf, achados }) => {
    const convId = "qa-cartao-de-achado";
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
    const report = {
      tipo_auditoria: "memorial",
      tipo_documento: "memorial descritivo",
      obra: "Reforma da Cancha de Bocha do Parque dos Imigrantes",
      codigo: "063-26",
      municipio: "Criciúma",
      data_documento: "",
      status_analise: "concluida",
      status_geral: "com inconsistências críticas",
      total_incongruencias: achados.length,
      arquivos_analisados: [
        {
          arquivo: nomeDoPdf,
          tipo_documento: "memorial descritivo",
          paginas: 132,
          caracteres_extraidos: 248310,
          resumo:
            "Memorial descritivo geral da reforma, com quadro de áreas, especificações de materiais e responsabilidade técnica por disciplina.",
        },
      ],
      comparacoes: [
        "Nome da obra na capa confrontado com o item 3.2 do corpo do memorial.",
        "Quadro de áreas do item 2.1 confrontado com as áreas citadas nos itens 4.2 e 7.4.",
        "Disciplinas listadas na responsabilidade técnica confrontadas com as disciplinas efetivamente descritas.",
      ],
      conclusao:
        "O memorial está tecnicamente consistente na maior parte do escopo.\n\nA responsabilidade técnica incompleta impede a emissão até que as três disciplinas faltantes sejam atribuídas.",
      incongruencias: achados,
    };

    await new Promise((res, rej) => {
      const tx = db.transaction("conversations", "readwrite");
      tx.objectStore("conversations").put({
        id: convId,
        title: "QA — cartao de achado",
        createdAt: agora,
        updatedAt: agora,
        messages: [
          { id: "m1", role: "user", content: `Anexei o memorial — ${nomeDoPdf}` },
          { id: "m2", role: "assistant", content: "Auditoria concluída." },
        ],
        seloResults: [],
        results: [
          {
            artifactId: "auditoria:qa-cartao",
            kind: "auditoria",
            summary: "Auditoria do memorial",
            files: [],
            payload: { auditId: "qa-cartao", texto: "RESULTADO DA AUDITORIA", report },
          },
        ],
        memorial: { name: nomeDoPdf, blobKey: `${convId}:memorial` },
      });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  },
  { pdfB64, nomeDoPdf, achados: ACHADOS },
);

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

await page
  .locator("aside button, [class*=sidebar] button")
  .filter({ hasText: /cartao de achado/i })
  .first()
  .click();
await page.waitForTimeout(2500);

const chipAuditoria = page.getByRole("button", { name: /^Auditoria$/i });
if ((await chipAuditoria.count()) > 0) await chipAuditoria.first().click();
await page.waitForTimeout(1200);

// ---------------------------------------------------------------- O RESUMO
const faixas = page.locator("[data-faixa-resumo]");
await faixas.first().waitFor({ state: "visible", timeout: 20000 });
check("o resumo mostra as TRES faixas", (await faixas.count()) === 3, `${await faixas.count()}`);

const textoDoResumo = await page.locator("main, body").first().innerText();
check(
  "e a faixa bloqueadora tem o achado critico",
  /BLOQUEIA A EMISSÃO/i.test(textoDoResumo),
  textoDoResumo.slice(0, 120),
);
// `i` porque as etiquetas são Badge, e o Badge desta casa escreve em maiúscula.
check(
  "o arquivo virou ficha, com as etiquetas",
  /132 páginas/i.test(textoDoResumo) && /248\.310 caracteres/i.test(textoDoResumo),
  textoDoResumo.replace(/\s+/g, " ").slice(0, 160),
);

await page.screenshot({ path: `${OUT}/achado-resumo.png`, fullPage: true });
console.log(`  foto: ${OUT}/achado-resumo.png`);

// --------------------------------------------------------------- OS CARTOES
await page.getByRole("button", { name: /^Achados/i }).first().click();
await page.waitForTimeout(1200);

const cartoes = page.locator("[data-achado]");
await cartoes.first().waitFor({ state: "visible", timeout: 20000 });
check("os tres cartoes aparecem", (await cartoes.count()) === 3, `${await cartoes.count()}`);

const textoDosCartoes = await page.locator("[data-achado]").first().innerText();
check(
  "o cartao tem os tres rotulos novos",
  /O que está errado/i.test(textoDosCartoes) &&
    /Por que importa/i.test(textoDosCartoes) &&
    /O que fazer/i.test(textoDosCartoes),
  textoDosCartoes.replace(/\s+/g, " ").slice(0, 130),
);

// O CASO QUE MOTIVOU TUDO: 8 + 60 + 71 + 105, escondidos na prosa.
const multi = page.locator('[data-achado="INC-002"]');
const textoMulti = await multi.innerText();
// Sem `i`: a etiqueta é um Badge, e o Badge desta casa escreve em maiúscula.
// A asserção mede o TEXTO, não a caixa alta.
check(
  "o achado cruzado diz '4 paginas', e nao 'pagina 8'",
  /4 páginas/i.test(textoMulti),
  textoMulti.replace(/\s+/g, " ").slice(0, 130),
);
check("e a fita traz as outras tres", /60/.test(textoMulti) && /71/.test(textoMulti) && /105/.test(textoMulti));
check("com 'Onde aparece' como titulo da fita", /Onde aparece/i.test(textoMulti));

// O de uma pagina so NAO pode ganhar fita nem "ver trechos".
const simples = page.locator('[data-achado="INC-001"]');
const textoSimples = await simples.innerText();
check(
  "o achado de uma pagina diz 'pagina 84'",
  /página 84/i.test(textoSimples),
  textoSimples.replace(/\s+/g, " ").slice(0, 100),
);
check("e NAO ganha fita de paginas", !/Onde aparece/i.test(textoSimples));
check("nem oferece 'ver os trechos'", !/ver os trechos/i.test(textoSimples));

/*
 * NADA PODE PASSAR DA BORDA DIREITA do cartão — e a medida é essa, e não
 * `scrollWidth`.
 *
 * A primeira versão comparava `scrollWidth > clientWidth` e acusava 636 × 1041
 * num cartão que, na foto, cabia inteiro. O motivo: numa flex que QUEBRA LINHA,
 * o `scrollWidth` soma os filhos como se estivessem lado a lado. A fita de
 * etiquetas do cabeçalho quebra em duas linhas, e por isso reportava 792 num
 * espaço de 580 sem nada estar errado.
 *
 * Medir a borda direita de cada descendente responde à pergunta que interessa —
 * "algum pedaço saiu da caixa?" — e não confunde quebra de linha com estouro.
 *
 * A caixa do parecer dentro do Nexo é ESTREITA mesmo com a janela larga, e é
 * por isso que este teste roda aqui e não numa página cheia.
 */
const caixa = await cartoes.first().evaluate((el) => {
  const limite = el.getBoundingClientRect().right;
  const forasteiros = [];

  for (const filho of el.querySelectorAll("*")) {
    const daFilho = filho.getBoundingClientRect();
    // Elemento sem caixa (recolhido, display:none) não vaza nada.
    if (daFilho.width === 0) continue;

    if (daFilho.right > limite + 2) {
      forasteiros.push(
        `${filho.tagName}.${String(filho.className).slice(0, 44)} +${Math.round(
          daFilho.right - limite,
        )}px`,
      );
    }
  }

  return { cliente: el.clientWidth, forasteiros: forasteiros.slice(0, 4) };
});
check(
  "nada vaza da borda do cartao dentro do palco",
  caixa.forasteiros.length === 0,
  `caixa de ${caixa.cliente}px :: ${caixa.forasteiros.join(" | ")}`,
);

await page.screenshot({ path: `${OUT}/achado-cartoes.png`, fullPage: true });
console.log(`  foto: ${OUT}/achado-cartoes.png`);

/*
 * O CARTÃO CRUZADO, sozinho e com os trechos abertos — é o que a mudança
 * inteira existe para produzir, e uma foto da página inteira o deixa pequeno
 * demais para alguém conferir.
 */
await multi.scrollIntoViewIfNeeded();
const verTrechos = multi.getByRole("button", { name: /ver os trechos/i });
if (await verTrechos.count()) {
  await verTrechos.first().click();
  await page.waitForTimeout(400);
  check("os trechos abrem", /esconder os trechos/i.test(await multi.innerText()));
}
await multi.screenshot({ path: `${OUT}/achado-multipagina.png` });
console.log(`  foto: ${OUT}/achado-multipagina.png`);

await browser.close();

if (falhas > 0) {
  console.error(`\nFALHOU  cartao de achado (${falhas})`);
  process.exit(1);
}

console.log("\nOK  cartao de achado");
