// O roteiro do teste ao vivo do STREAMING, feito no navegador — e sem gastar
// um token.
//
// O plano `docs/superpowers/plans/2026-07-24-nexo-streaming-orb-chat.md` termina
// com sete passos manuais. Seis deles são comportamento do CLIENTE: o texto que
// flui, o parar no meio, o card que só vem na cauda, o rolar que não é
// arrancado, o erro com "Tentar de novo", o contador de folhas com total fixo.
// Nenhum precisa do modelo — precisa de um SERVIDOR que transmita. Então o
// servidor é encenado aqui: `window.fetch` de `/api/nexo/agent` devolve um SSE
// real (ReadableStream, com atraso entre os pedaços e honrando o AbortSignal),
// e `/api/ld/extract-stamp` devolve um carimbo fabricado.
//
// O passo 2 do roteiro — que a cauda ```json nunca vaze para a tela — NÃO cabe
// no encenado: o corte acontece no SERVIDOR (`server/nexo/agent/split-stream.ts`)
// e encenar o servidor provaria só o encenador. Para ele existe o modo AO VIVO:
//
//   NEXO_STREAM_VIVO=1 node scripts/shot-nexo-streaming.mjs
//
// que mantém o carimbo fabricado (a leitura de selo é visão, cara) e deixa
// passar SÓ o turno do agente — uma chamada de modelo, a mais barata que prova
// o caminho inteiro. Ele também mede o SILÊNCIO INICIAL, que é a pergunta que o
// spec deixou em aberto (streaming encurta a espera; não zera).
//
//   npm run dev                          (noutro terminal)
//   node scripts/shot-nexo-streaming.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "./scratchpad/qa-streaming";
const VIVO = process.env.NEXO_STREAM_VIVO === "1";
fs.mkdirSync(OUT, { recursive: true });

// Marcador da conversa de QA. O banco local é o mesmo em que se trabalha: a
// limpeza do fim apaga por ESTE texto, nunca por "as mais recentes".
const MARCADOR = "QA AUTOMATICO STREAMING";

const PASTA = path.resolve(
  "docs/samples/040-26/10_his_inc_spd/arquivos separados/1_his",
);
const PRANCHAS = [1, 2, 3].map((i) =>
  path.join(PASTA, `040_26_his_${String(i).padStart(3, "0")}_a.pdf`),
);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/** Texto da ÚLTIMA bolha do log (a que está crescendo durante o turno). */
const ultimaBolha = () =>
  page.evaluate(() => {
    const log = document.querySelector('[role="log"]');
    const bolhas = log?.querySelectorAll(".nexodoc-message-in") ?? [];
    return bolhas.length ? bolhas[bolhas.length - 1].innerText : "";
  });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1500, height: 950 },
});

/*
 * O servidor encenado. Vive num addInitScript porque precisa existir antes do
 * primeiro fetch da página; o roteiro reconfigura o comportamento por cena
 * mexendo em `window.__QA`.
 */
await context.addInitScript(
  ({ marcador, vivo }) => {
    const original = window.fetch.bind(window);
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));

    window.__QA = {
      // no modo ao vivo o turno do agente NÃO é encenado: vai ao modelo.
      vivo,
      // cena do agente: "normal" | "offline"
      modo: "normal",
      deltas: ["Pronto."],
      intervalo: 150,
      propostas: [],
      // quantos selos já foram pedidos (o carimbo fabricado numera a folha)
      selosPedidos: 0,
      atrasoDoSelo: 600,
    };

    window.fetch = async (entrada, init = {}) => {
      const url = typeof entrada === "string" ? entrada : entrada.url;

      // --- OCR do carimbo: fabricado, instantâneo em dinheiro ---------------
      if (url.includes("/api/ld/extract-stamp")) {
        const cfg = window.__QA;
        const corpo = JSON.parse(init.body ?? "{}");
        const pagina = corpo?.metadata?.pageNumber ?? 1;
        const arquivo = corpo?.metadata?.fileName ?? "";
        const n = /_(\d{3})_/.exec(arquivo)?.[1] ?? String(pagina).padStart(3, "0");
        await espera(cfg.atrasoDoSelo);
        cfg.selosPedidos += 1;
        return new Response(
          JSON.stringify({
            disciplina: "HIS",
            folha: Number(n),
            total: 11,
            numeroFolha: `${n}/11`,
            arquivo: arquivo.replace(/\.pdf$/i, ""),
            conteudo: `FOLHA ${Number(n)} — ${marcador}`,
            cliente: "PREFEITURA MUNICIPAL DE CRICIUMA",
            secretaria: "SECRETARIA DE OBRAS",
            obra: marcador,
            fase: "EXECUTIVO",
            tituloSecao: "PROJETO HIDROSSANITARIO",
            confianca: "alta",
            usage: { totalTokens: 0 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // --- turno do agente: SSE de verdade, encenado ------------------------
      if (url.includes("/api/nexo/agent") && !window.__QA.vivo) {
        const cfg = window.__QA;
        if (cfg.modo === "offline") {
          // O que o navegador faz quando a rede cai: TypeError, não AbortError.
          throw new TypeError("Failed to fetch");
        }
        const sinal = init.signal;
        const enc = new TextEncoder();
        const corpo = new ReadableStream({
          async start(controller) {
            let morto = false;
            const abortar = () => {
              morto = true;
              try {
                controller.error(
                  new DOMException("The user aborted a request.", "AbortError"),
                );
              } catch {}
            };
            if (sinal) {
              if (sinal.aborted) return abortar();
              sinal.addEventListener("abort", abortar, { once: true });
            }
            const manda = (o) =>
              controller.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`));
            for (const texto of cfg.deltas) {
              await espera(cfg.intervalo);
              if (morto) return;
              manda({ type: "delta", text: texto });
            }
            await espera(cfg.intervalo);
            if (morto) return;
            manda({
              type: "done",
              proposals: cfg.propostas,
              slotRequest: null,
              ldPreview: null,
              usage: 0,
            });
            controller.close();
          },
        });
        return new Response(corpo, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8" },
        });
      }

      return original(entrada, init);
    };
  },
  { marcador: MARCADOR, vivo: VIVO },
);

const page = await context.newPage();
const errosDeConsole = [];
page.on("pageerror", (e) => errosDeConsole.push(String(e)));

try {
  // --- login ---------------------------------------------------------------
  await pularTourGuiado(page);
  await page.goto(`${BASE}/nexo`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    await page.getByRole("button", { name: /Entrar como dev/i }).click();
    await page.waitForURL("**/nexo**", { timeout: 30000 });
  }
  await page.waitForLoadState("networkidle").catch(() => {});
  check("abriu /nexo autenticado", page.url().includes("/nexo"));

  // =========================================================================
  // PASSO 5 — o contador da leitura acompanha N/M com M fixo
  // =========================================================================
  console.log("\nPasso 5 — a varredura das folhas");
  const [seletor] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: /Anexar PDFs/i }).first().click(),
  ]);
  await seletor.setFiles(PRANCHAS);

  // Amostra o status enquanto lê: o defeito que este passo persegue é o total
  // CRESCENDO junto com o progresso ("1 de 1", "2 de 2").
  const amostras = new Set();
  const limite = Date.now() + 30000;
  while (Date.now() < limite) {
    const t = await page
      .locator("text=/Lendo os selos|Contando as folhas|folha\\(s\\) de selo lidas/")
      .first()
      .textContent()
      .catch(() => null);
    if (t) amostras.add(t.trim());
    if (t && /folha\(s\) de selo lidas/i.test(t)) break;
    await page.waitForTimeout(120);
  }
  const progressos = [...amostras]
    .map((t) => /(\d+)\s+de\s+(\d+)\s+folhas analisadas/.exec(t))
    .filter(Boolean)
    .map((m) => [Number(m[1]), Number(m[2])]);
  check(
    "o progresso da leitura aparece com N de M",
    progressos.length > 0,
    [...amostras].join(" | "),
  );
  check(
    "M é fixo e igual ao nº de folhas (3)",
    progressos.every(([, m]) => m === 3),
    JSON.stringify(progressos),
  );
  check(
    "N avança (a varredura acompanha, não é um número parado)",
    new Set(progressos.map(([n]) => n)).size > 1,
    JSON.stringify(progressos),
  );
  await page
    .getByText(/folha\(s\) de selo lidas/i)
    .first()
    .waitFor({ timeout: 60000 });
  check("terminou a leitura das 3 folhas", true);
  await page.screenshot({ path: `${OUT}/1-varredura.png`, fullPage: true });

  // =========================================================================
  // PASSO 2 (só no modo AO VIVO) — a cauda de dados não vaza para a tela
  // =========================================================================
  if (VIVO) {
    console.log("\nPasso 2 — AO VIVO: uma chamada de modelo de verdade");
    const composerVivo = page.locator("textarea").first();
    await composerVivo.fill(
      "Cria a LD com o titulo PROJETO TESTE AUTOMATICO, em um tomo",
    );
    const t0 = Date.now();
    await composerVivo.press("Enter");

    // Silêncio inicial = do Enter até o primeiro caractere na bolha. É o número
    // que o spec deixou em aberto; sem medir, não há como decidir se ainda vale
    // mexer no esforço de raciocínio.
    let primeiroToken = null;
    const prazo = Date.now() + 120000;
    const crescimento = [];
    while (Date.now() < prazo) {
      const t = await ultimaBolha();
      const limpo = t.replace(/^NEXO\s*/i, "").trim();
      if (!primeiroToken && limpo.length > 0) primeiroToken = Date.now() - t0;
      crescimento.push(limpo.length);
      if (await page.getByText(/Vou gerar · \d+ documentos?/i).count()) break;
      await page.waitForTimeout(150);
    }
    const subidas = crescimento.filter((n, i) => i > 0 && n > crescimento[i - 1]).length;
    const respostaViva = (await ultimaBolha()).replace(/Vou gerar[\s\S]*$/, "");

    check("o modelo respondeu", Boolean(primeiroToken));
    console.log(`       silêncio inicial: ${primeiroToken} ms`);
    check(
      "o texto do modelo chega em partes",
      subidas >= 3,
      `cresceu ${subidas}x`,
    );
    check(
      "NENHUMA cerca ``` chegou à tela",
      !respostaViva.includes("```"),
      respostaViva.slice(0, 200),
    );
    check(
      "NENHUMA chave { } de JSON chegou à tela",
      !/[{}]/.test(respostaViva),
      respostaViva.slice(0, 200),
    );
    check(
      "a proposta veio na cauda (card presente)",
      (await page.getByText(/Vou gerar · \d+ documentos?/i).count()) === 1,
    );
    await page.screenshot({ path: `${OUT}/vivo-turno-real.png`, fullPage: true });
    console.log("\n  (modo ao vivo: as cenas encenadas 1/3/4/6/7 não rodam)");
  } else {

  // =========================================================================
  // PASSOS 1 e 4 — o texto FLUI, e o card só chega na cauda
  // =========================================================================
  console.log("\nPassos 1 e 4 — o texto flui e o card vem no fim");
  await page.evaluate(() => {
    window.__QA.modo = "normal";
    window.__QA.intervalo = 220;
    window.__QA.deltas = [
      "Li as três folhas de HIS. ",
      "Vou preparar a lista de documentos ",
      "com o título que você pediu, ",
      "em um tomo só. ",
      "Confira os parâmetros no card ",
      "antes de eu gerar o arquivo.",
    ];
    window.__QA.propostas = [
      {
        kind: "ld",
        resumo: "LD de HIS, 3 folhas",
        params: { tituloLd: "PROJETO HIDROSSANITARIO", numTomos: 1, tomoInicial: 1 },
      },
    ];
  });

  const composer = page.locator("textarea").first();
  /*
   * `exact: true` não é preciosismo: os chips de resposta rápida se chamam
   * "Enviar: <opção>", e o casamento por SUBSTRING do Playwright dava o botão
   * de enviar como presente no meio de um turno — o roteiro seguia em cima de
   * uma conversa ocupada e a cena seguinte não acontecia.
   */
  const botaoEnviar = page.getByRole("button", { name: "Enviar", exact: true });
  await composer.fill("Cria a LD");
  await composer.press("Enter");

  // Amostra o tamanho do texto da bolha enquanto ele chega.
  const tamanhos = [];
  const fim = Date.now() + 15000;
  while (Date.now() < fim) {
    tamanhos.push((await ultimaBolha()).length);
    if (await page.getByText(/Vou gerar · \d+ documentos?/i).count()) break;
    await page.waitForTimeout(120);
  }
  const crescimentos = tamanhos.filter((n, i) => i > 0 && n > tamanhos[i - 1]).length;
  check(
    "o texto CHEGA EM PARTES (a bolha cresce várias vezes)",
    crescimentos >= 3,
    `cresceu ${crescimentos}x — amostras: ${tamanhos.join(",")}`,
  );

  const cardPlano = page.getByText(/Vou gerar · \d+ documentos?/i);
  await cardPlano.first().waitFor({ timeout: 15000 });
  check("o card de confirmação aparece no turno completo", (await cardPlano.count()) === 1);

  const textoDoTurno = await ultimaBolha();
  check(
    "a resposta chegou inteira",
    textoDoTurno.includes("antes de eu gerar o arquivo."),
    textoDoTurno.slice(0, 120),
  );
  check(
    "nenhuma cerca ou chave na bolha da resposta",
    !/```|[{}]/.test(textoDoTurno.replace(/Vou gerar[\s\S]*$/, "")),
    textoDoTurno.slice(0, 200),
  );
  await page.screenshot({ path: `${OUT}/2-turno-completo.png`, fullPage: true });

  // =========================================================================
  // PASSO 3 — parar no meio: o parcial fica, marcado, e SEM card
  // =========================================================================
  console.log("\nPasso 3 — parar no meio");
  const cardsAntes = await cardPlano.count();
  await page.evaluate(() => {
    window.__QA.intervalo = 350;
    window.__QA.deltas = Array.from(
      { length: 20 },
      (_, i) => `Parágrafo ${i + 1} da resposta que vai ser interrompida no meio. `,
    );
  });
  await composer.fill("Explica o processo inteiro");
  await composer.press("Enter");

  const botaoParar = page.getByRole("button", { name: "Parar", exact: true });
  await botaoParar.waitFor({ timeout: 10000 });
  check("o enviar vira PARAR enquanto o turno corre", true);
  // Espera chegar texto de verdade antes de parar.
  await page.waitForTimeout(1400);
  const parcialAntes = await ultimaBolha();
  await botaoParar.click();
  await page.waitForTimeout(900);
  const parcialDepois = await ultimaBolha();

  check(
    "o texto parcial FICA na tela",
    parcialDepois.includes("Parágrafo 1"),
    parcialDepois.slice(0, 120),
  );
  check(
    "o texto para de crescer depois do parar",
    parcialDepois.replace(/interrompido/i, "").trim().length <=
      parcialAntes.length + 120,
    `${parcialAntes.length} → ${parcialDepois.length}`,
  );
  check("o parcial é marcado como interrompido", /interrompido/i.test(parcialDepois));
  check(
    "turno interrompido NÃO deixa card",
    (await cardPlano.count()) === cardsAntes,
    `${await cardPlano.count()} cards (antes: ${cardsAntes})`,
  );
  check("o parar devolve o botão de enviar", (await botaoEnviar.count()) > 0);
  await page.screenshot({ path: `${OUT}/3-interrompido.png`, fullPage: true });

  // =========================================================================
  // PASSO 6 — rolar pra cima durante a resposta não é arrancado
  // =========================================================================
  console.log("\nPasso 6 — rolar durante a resposta");
  await page.evaluate(() => {
    window.__QA.intervalo = 300;
    window.__QA.deltas = Array.from(
      { length: 16 },
      (_, i) =>
        `Trecho ${i + 1}: texto longo o bastante para a conversa transbordar a área visível e obrigar a rolagem a existir. `,
    );
    window.__QA.propostas = [];
  });
  await composer.fill("Escreve bastante");
  await composer.press("Enter");
  await page.waitForTimeout(1500);

  // Rola pro topo NO MEIO da resposta.
  await page.evaluate(() => {
    document.querySelector('[role="log"]').scrollTo({ top: 0 });
    document.querySelector('[role="log"]').dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(700);
  const topoDepoisDeRolar = await page.evaluate(
    () => document.querySelector('[role="log"]').scrollTop,
  );
  const botaoNovas = page.getByRole("button", { name: /novas mensagens/i });
  check("aparece o atalho ‘↓ novas mensagens’", (await botaoNovas.count()) === 1);

  await page.waitForTimeout(1200); // mais deltas chegam enquanto estamos em cima
  const topoDepoisDeMaisDeltas = await page.evaluate(
    () => document.querySelector('[role="log"]').scrollTop,
  );
  check(
    "a rolagem NÃO é arrancada de volta pro fim",
    Math.abs(topoDepoisDeMaisDeltas - topoDepoisDeRolar) < 80,
    `${topoDepoisDeRolar} → ${topoDepoisDeMaisDeltas}`,
  );
  await page.screenshot({ path: `${OUT}/4-rolagem.png`, fullPage: true });

  await botaoNovas.click();
  await page.waitForTimeout(900);
  const noFim = await page.evaluate(() => {
    const el = document.querySelector('[role="log"]');
    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  });
  check("o atalho leva de volta ao fim da conversa", noFim);
  // Deixa o turno terminar antes da próxima cena.
  await botaoEnviar.first().waitFor({ timeout: 30000 });

  // =========================================================================
  // PASSO 7 — rede fora: erro com "Tentar de novo" FUNCIONAL
  // =========================================================================
  console.log("\nPasso 7 — sem rede, e o tentar de novo");
  await page.evaluate(() => {
    window.__QA.modo = "offline";
  });
  await composer.fill("Isso aqui vai falhar");
  await composer.press("Enter");

  /*
   * O alerta é procurado PELA AÇÃO que ele tem de oferecer. Um `[role="alert"]`
   * solto também casa com o indicador de problemas do dev overlay do Next — e
   * um erro sem "Tentar de novo" é exatamente o defeito que este passo procura,
   * então não pode contar como sucesso.
   */
  const tentarDeNovo = page.getByRole("button", { name: /Tentar de novo/i });
  const alerta = page
    .locator('[role="alert"]')
    .filter({ has: page.getByRole("button", { name: /Tentar de novo/i }) });
  await alerta.first().waitFor({ timeout: 15000 });
  check("a falha de rede vira erro visível", (await alerta.count()) === 1);
  check("o erro oferece ‘Tentar de novo’", (await tentarDeNovo.count()) === 1);
  await page.screenshot({ path: `${OUT}/5-erro-de-rede.png`, fullPage: true });

  // A rede volta e o botão tem de REENVIAR a mesma mensagem.
  await page.evaluate(() => {
    window.__QA.modo = "normal";
    window.__QA.intervalo = 120;
    window.__QA.deltas = ["Voltei. ", "A mensagem foi reenviada."];
  });
  await tentarDeNovo.click();
  await page
    .getByText(/A mensagem foi reenviada\./)
    .first()
    .waitFor({ timeout: 15000 });
  check("‘Tentar de novo’ reenvia e a resposta chega", true);
  check("o aviso de erro some depois do sucesso", (await alerta.count()) === 0);
  await page.screenshot({ path: `${OUT}/6-recuperado.png`, fullPage: true });

  } // fim das cenas encenadas

  check(
    "nenhum erro de runtime no console",
    errosDeConsole.length === 0,
    errosDeConsole.slice(0, 2).join(" | "),
  );
} catch (err) {
  falhas++;
  console.error("FALHOU (exceção):", err instanceof Error ? err.message : err);
  await page.screenshot({ path: `${OUT}/erro.png`, fullPage: true }).catch(() => {});
} finally {
  // Limpeza: apaga SÓ as conversas com o marcador de QA. O banco do navegador
  // em dev é o mesmo do trabalho de verdade.
  const apagadas = await page
    .evaluate(async (marcador) => {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open("nexo", 1);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      const todas = await new Promise((res) => {
        const tx = db.transaction("conversations", "readonly");
        const r = tx.objectStore("conversations").getAll();
        r.onsuccess = () => res(r.result ?? []);
        r.onerror = () => res([]);
      });
      const alvos = todas.filter((c) => JSON.stringify(c).includes(marcador));
      await Promise.all(
        alvos.map(
          (c) =>
            new Promise((res) => {
              const tx = db.transaction("conversations", "readwrite");
              tx.objectStore("conversations").delete(c.id);
              tx.oncomplete = () => res();
              tx.onerror = () => res();
            }),
        ),
      );
      return alvos.length;
    }, MARCADOR)
    .catch(() => -1);
  console.log(`\n  conversas de QA apagadas: ${apagadas}`);
  await browser.close();
}

console.log(
  falhas === 0
    ? `\nTudo OK. Prints em ${OUT}`
    : `\n${falhas} checagem(ns) falharam. Prints em ${OUT}`,
);
process.exit(falhas === 0 ? 0 : 1);
