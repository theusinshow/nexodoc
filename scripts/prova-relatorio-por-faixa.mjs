/*
 * Prova, NO NAVEGADOR e sem gastar token, que o relatório de auditoria entrega o
 * que o escritório pediu: os bloqueadores primeiro, e o resto classificado
 * embaixo.
 *
 * A regra de "pecar pelo excesso" fez a lista sair de 28 para 36 achados. Isso
 * só é melhora se a tela souber ordenar — 36 achados numa lista plana são piores
 * que 28. O motor foi medido; a TELA nunca tinha sido olhada.
 *
 * Reabre uma auditoria já concluída do histórico (a de 36 achados do 063-26).
 * Não roda IA.
 *
 *   npm run dev            (noutro terminal)
 *   node scripts/prova-relatorio-por-faixa.mjs
 *
 * Mede GEOMETRIA, não só DOM: asserção de presença passa verde com o bloco fora
 * da tela ou com altura zero.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
fs.mkdirSync(OUT, { recursive: true });

/** ordem de leitura esperada na tela */
const ORDEM = ["critico_documental", "tecnico_contratual", "revisao_editorial"];

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) {
    console.log(`  OK      ${nome}`);
  } else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const erros = [];
page.on("pageerror", (e) => erros.push(String(e)));

try {
  await page.goto(`${BASE}/audit`, { waitUntil: "domcontentloaded" });

  // /audit redireciona para /nexo: a auditoria foi absorvida pelo Nexo.
  const entrar = page.getByRole("button", { name: /Entrar como dev/i });
  if ((await entrar.count()) > 0) {
    await entrar.click();
    await page.waitForURL(/\/(audit|nexo)/, { timeout: 30000 });
  }
  await page.waitForTimeout(2500);
  check("abriu autenticado", page.url().includes("/audit") || page.url().includes("/nexo"));

  /*
   * Reabre a conversa da auditoria de 36 achados do 063-26 (rodada `medium` das
   * 12:14). A lateral v2 lista conversa por anexo, não por "Memorial · Profundo
   * · concluída" como a versão antiga do harness supunha.
   */
  const alvo = process.env.PROVA_CONVERSA ?? "063_26_md_geral_a.pdf";
  const conversa = page.locator("aside button", { hasText: alvo }).first();
  await conversa.waitFor({ timeout: 30000 });
  check(`histórico tem a conversa de ${alvo}`, true);

  await conversa.click();
  await page.waitForTimeout(6000);

  // Rola até o parecer: a conversa abre no topo e o relatório fica no fim.
  await page.keyboard.press("End");
  await page.waitForTimeout(2000);

  // O parecer abre na aba "Resumo"; as faixas vivem na aba "Achados".
  const abaAchados = page.getByRole("button", { name: /^Achados$/i }).first();
  if ((await abaAchados.count()) > 0) {
    await abaAchados.click();
    await page.waitForTimeout(1500);
    check("abriu a aba Achados", true);
  } else {
    check("abriu a aba Achados", false, "aba não encontrada");
  }

  /*
   * O veredito e a matriz precisam contar a MESMA coisa. Duas fontes de faixa
   * faziam o cartão NÃO EMITIR dizer "3 incongruências críticas" enquanto a
   * seção BLOQUEIA A EMISSÃO mostrava 2.
   */
  const corpo = await page.locator("body").innerText();
  const doVeredito = /(\d+)\s+incongru[êe]ncia\(s\)\s+cr[íi]tica/i.exec(corpo)?.[1];
  const daMatriz = /BLOQUEIA A EMISS[ÃA]O\s*\((\d+)\)/i.exec(corpo)?.[1];

  if (doVeredito && daMatriz) {
    check(
      "veredito e matriz contam os mesmos bloqueadores",
      doVeredito === daMatriz,
      `veredito=${doVeredito} · matriz=${daMatriz}`,
    );
  } else {
    console.log(`     (contagens não comparáveis: veredito=${doVeredito} matriz=${daMatriz})`);
  }

  await page.screenshot({ path: `${OUT}/relatorio-faixas-topo.png` });
  await page.screenshot({ path: `${OUT}/relatorio-faixas-inteiro.png`, fullPage: true });

  // --- as três faixas aparecem? ---------------------------------------------
  const rotulos = [
    { chave: "bloqueia", re: /bloqueia a emiss[ãa]o|cr[íi]tico documental|impedem a emiss/i },
    { chave: "tecnico", re: /exige decis[ãa]o t[ée]cnica|t[ée]cnico\s*\/?\s*contratual/i },
    { chave: "editorial", re: /revis[ãa]o de texto|revis[ãa]o editorial/i },
  ];

  const caixas = {};

  // Só se cobra o cabeçalho da faixa que REALMENTE tem achado neste relatório:
  // um memorial sem nenhum ponto editorial não deve exibir a seção vazia.
  const faixasPresentes = new Set(
    await page.locator("article[data-impacto]").evaluateAll((nos) =>
      nos.map((no) => no.getAttribute("data-impacto")),
    ),
  );
  const CHAVE_PARA_FAIXA = {
    bloqueia: "critico_documental",
    tecnico: "tecnico_contratual",
    editorial: "revisao_editorial",
  };

  for (const rotulo of rotulos) {
    if (!faixasPresentes.has(CHAVE_PARA_FAIXA[rotulo.chave])) {
      console.log(`     (faixa "${rotulo.chave}" não tem achado neste relatório — nada a exibir)`);
      continue;
    }

    const alvo = page.getByText(rotulo.re).first();
    const existe = (await alvo.count()) > 0;
    const box = existe ? await alvo.boundingBox() : null;
    caixas[rotulo.chave] = box;

    check(
      `faixa "${rotulo.chave}" visível na tela`,
      Boolean(box) && box.height > 0 && box.y >= 0 && box.y < 6000,
      box ? `y=${Math.round(box.y)} h=${Math.round(box.height)}` : "ausente do DOM",
    );
  }

  // --- ordem: bloqueador ANTES do técnico, técnico ANTES do editorial --------
  if (caixas.bloqueia && caixas.tecnico) {
    check(
      "bloqueadores aparecem ACIMA dos técnicos",
      caixas.bloqueia.y < caixas.tecnico.y,
      `bloqueia y=${Math.round(caixas.bloqueia.y)} · tecnico y=${Math.round(caixas.tecnico.y)}`,
    );
  }
  if (caixas.tecnico && caixas.editorial) {
    check(
      "técnicos aparecem ACIMA dos editoriais",
      caixas.tecnico.y < caixas.editorial.y,
      `tecnico y=${Math.round(caixas.tecnico.y)} · editorial y=${Math.round(caixas.editorial.y)}`,
    );
  }

  // --- a ORDEM da lista, lida do DOM e não do texto do cabeçalho -------------
  const faixas = await page.locator("article[data-impacto]").evaluateAll((nos) =>
    nos.map((no) => no.getAttribute("data-impacto")),
  );

  check(`a lista tem cartões com faixa (${faixas.length})`, faixas.length > 0);

  if (faixas.length > 0) {
    check("primeiro achado da lista é bloqueador", faixas[0] === "critico_documental", `faixa=${faixas[0]}`);

    // Nenhum bloqueador pode aparecer depois de um técnico/editorial.
    const posicoes = faixas.map((f) => ORDEM.indexOf(f));
    const monotonica = posicoes.every((valor, i) => i === 0 || valor >= posicoes[i - 1]);
    check(
      "faixas não se intercalam (bloqueador → técnico → editorial)",
      monotonica,
      faixas.join(" · ").slice(0, 160),
    );
  }

  check("sem erro de página", erros.length === 0, erros.slice(0, 2).join(" | "));
} finally {
  await browser.close();
}

console.log(falhas === 0 ? "\nTUDO OK" : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
