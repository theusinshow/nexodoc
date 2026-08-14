// A auditoria VISTA NO DOCUMENTO — e sem gastar um token.
//
// Semeia no IndexedDB uma conversa com o memorial real e um parecer cujos cinco
// achados são os erros de identidade CONFERIDOS À MÃO no 017_26 (páginas 11,
// 112, 114, 115 e 118). Abre a conversa, troca para "No documento" e exige que
// cada achado vire um pin sobre a miniatura da sua página.
//
// Nenhuma chamada de modelo: o parecer é semeado, o PDF vem do disco. O que se
// prova aqui é a FIAÇÃO — miniatura → camada de texto → locateTermOnPage → pin —
// que nenhum teste puro alcança.
//
//   node scripts/shot-audit-canvas.mjs
import { chromium } from "playwright";
import { pularTourGuiado } from "./lib/sessao-de-teste.mjs";
import fs from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = "./scratchpad/qa";
const MEMORIAL =
  process.env.AUDIT_PDF ??
  "C:\\Users\\matheus.mendes\\Desktop\\NexoDoc\\NEXO - TESTES\\Memoriais\\017_26_md_geral_c_assinado.pdf";

fs.mkdirSync(OUT, { recursive: true });

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// Erros reais do memorial, com a página conferida à mão. `evidencia` é o texto
// como está escrito no documento — é o que o pin tem de achar.
const ACHADOS = [
  // A DISCIPLINA entrou na semeadura para a sigla do card ter o que mostrar.
  // Duas familias distintas e uma vazia: e o terceiro caso que importa, porque
  // a disciplina e LIDA do cabecalho da pagina e muitas vezes nao existe.
  { pagina: "11", tipo: "Nome da obra divergente", evidencia: "Cidade do Autista", disciplina: "Arquitetura" },
  { pagina: "112", tipo: "Nome da obra divergente", evidencia: "Centro Dia do Idoso" },
  { pagina: "114", tipo: "Nome da obra divergente", evidencia: "Centro Dia do Idoso" },
  { pagina: "115", tipo: "Ocupação divergente", evidencia: "unidade básica de saúde", disciplina: "Estrutural de concreto" },
  { pagina: "118", tipo: "Nome da obra divergente", evidencia: "Centro Comunitário Boa Vista" },
];

const pdfB64 = fs.readFileSync(MEMORIAL).toString("base64");
const nomeDoPdf = MEMORIAL.split(/[\\/]/).pop();

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

  const titulo = "QA — canvas da auditoria";
  await page.evaluate(
    async ({ pdfB64, nomeDoPdf, achados, titulo }) => {
      const convId = "qa-canvas-auditoria";
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
        obra: "Centro Comunitário Primeira Linha",
        codigo: "017-26",
        municipio: "Criciúma",
        data_documento: "",
        status_analise: "concluida",
        status_geral: "com inconsistências críticas",
        total_incongruencias: achados.length,
        arquivos_analisados: [],
        comparacoes: [],
        conclusao: "Parecer semeado para prova de UI.",
        incongruencias: achados.map((a, i) => ({
          id: `A${i + 1}`,
          prioridade: "Alta",
          pagina: a.pagina,
          capitulo: "",
          local: "",
          tipo: a.tipo,
          descricao: "Texto reaproveitado de outro projeto.",
          evidencia: a.evidencia,
          conflito: "Diverge da obra declarada.",
          sugestao_correcao: "Corrigir para a obra deste projeto.",
          confianca: "alta",
          origem: "regra",
          disciplina: a.disciplina,
        })),
      };

      await new Promise((res, rej) => {
        const tx = db.transaction("conversations", "readwrite");
        tx.objectStore("conversations").put({
          id: convId,
          title: titulo,
          createdAt: agora,
          updatedAt: agora,
          /*
           * A conversa PRECISA ter mensagens: o shell só abre o palco (onde vive
           * o canvas) quando a conversa começou de fato. Uma auditoria real
           * sempre escreve no chat, então isto é fidelidade ao caminho normal,
           * não um truque.
           */
          messages: [
            { id: "m1", role: "user", content: `Anexei o memorial — ${nomeDoPdf}` },
            { id: "m2", role: "assistant", content: "Auditoria concluída." },
          ],
          seloResults: [],
          results: [
            {
              artifactId: "auditoria:qa",
              kind: "auditoria",
              summary: "Auditoria do memorial",
              files: [],
              payload: { auditId: "qa-canvas", texto: "RESULTADO DA AUDITORIA", report },
            },
          ],
          memorial: { name: nomeDoPdf, blobKey: `${convId}:memorial` },
        });
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    },
    { pdfB64, nomeDoPdf, achados: ACHADOS, titulo },
  );

  // Recarrega e abre a conversa semeada pela sidebar — o caminho de quem volta.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const item = page.locator("aside button, [class*=sidebar] button").filter({
    hasText: /canvas da auditoria/i,
  });
  check("a conversa semeada aparece na sidebar", (await item.count()) > 0);
  if ((await item.count()) > 0) {
    await item.first().click();
    await page.waitForTimeout(2500);
  }

  const chipAuditoria = page.getByRole("button", { name: /^Auditoria$/i });
  if ((await chipAuditoria.count()) > 0) {
    await chipAuditoria.first().click();
    await page.waitForTimeout(1200);
  }
  await page.screenshot({ path: `${OUT}/c1-parecer.png` });

  const chipDoc = page.getByRole("button", { name: /No documento/i });
  check("a vista 'No documento' é oferecida", (await chipDoc.count()) > 0);
  if ((await chipDoc.count()) === 0) throw new Error("sem a vista do documento");
  await chipDoc.first().click();

  // As miniaturas são PDF de verdade: renderizar 5 páginas leva alguns segundos.
  // O pin é marca visual: fora da árvore de acessibilidade (o card diz tudo),
  // então o gancho é o `data-pin` — nunca o rótulo.
  const pins = page.locator("[data-pin]");
  await pins.first().waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/c2-no-documento.png` });

  const corpo = await page.locator("body").innerText();
  check("o veredito acompanha a vista", /NÃO EMITIR/i.test(corpo), corpo.slice(0, 200));
  check("uma página por achado distinto", /5 páginas com achado/i.test(corpo));

  const quantosPins = await pins.count();
  check(`os 5 achados viraram pin (achou ${quantosPins})`, quantosPins === ACHADOS.length);

  // O pin tem de estar DENTRO da miniatura: percentual fora de 0-100% põe a
  // marca fora da página, que é o mesmo que não ter pin.
  const foraDaPagina = await pins.evaluateAll((els) =>
    els.filter((el) => {
      const pai = el.parentElement?.getBoundingClientRect();
      const meu = el.getBoundingClientRect();
      if (!pai) return true;
      return (
        meu.left < pai.left - 8 ||
        meu.right > pai.right + 8 ||
        meu.top < pai.top - 8 ||
        meu.bottom > pai.bottom + 8
      );
    }).length,
  );
  check("todo pin caiu dentro da sua página", foraDaPagina === 0, `${foraDaPagina} fora`);

  // Nenhum achado pode ter sobrado sem trecho: no 017_26 os cinco ancoram.
  check("nenhum achado ficou 'sem trecho'", !/sem trecho/i.test(corpo));

  /*
   * O PIN RESPONDE AO PONTEIRO (onda 1 do spec do canvas).
   *
   * Ele era `pointer-events-none`: a pessoa mirava o ponto exato do erro sobre a
   * página e não acontecia nada — a interação só existia no card lá embaixo.
   *
   * A medida é `pointerEvents`, e não a presença do atributo `onClick`: só o
   * estilo computado responde se o clique CHEGA no elemento.
   */
  const eventosNoPin = await pins
    .first()
    .evaluate((el) => getComputedStyle(el).pointerEvents);
  check("o pin aceita o ponteiro", eventosNoPin !== "none", eventosNoPin);

  /*
   * E CLICAR NELE ABRE O ACHADO. O drawer do parecer é a prova de que o pin
   * chegou ao mesmo destino do card — "o pin é clicável" sozinho não diz nada
   * sobre onde o clique leva.
   */
  await pins.first().click();
  await page.waitForTimeout(900);
  const parecerPeloPin = page.getByRole("dialog", { name: /Parecer completo/i });
  check("e clicar no pin abre o parecer", (await parecerPeloPin.count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Esc devolve o documento", (await parecerPeloPin.count()) === 0);

  // --- Card, pilha, linha e o par que acende --------------------------------
  /*
   * "Centro Dia do Idoso" aparece nas páginas 112 e 114 com a mesma evidência:
   * é UM erro espalhado, e vira pilha. Sobram três achados soltos, com card.
   */
  const RECORRENTES = 2;
  const SOLTOS = ACHADOS.length - RECORRENTES;

  const cards = page.locator('.react-flow__node[data-id^="a-"]');
  check(`os achados soltos viraram card (achou ${await cards.count()})`, (await cards.count()) === SOLTOS);

  const pilhas = page.locator('.react-flow__node[data-id^="g-"]');
  check(`o erro repetido virou UMA pilha (achou ${await pilhas.count()})`, (await pilhas.count()) === 1);
  check("a pilha conta as ocorrências", /×2/.test(corpo), corpo.slice(0, 200));

  // 3 linhas de card + 2 linhas da pilha (uma por página onde o erro aparece).
  const linhas = page.locator(".react-flow__edge");
  check(
    `cada achado está ligado à sua página (achou ${await linhas.count()})`,
    (await linhas.count()) === SOLTOS + RECORRENTES,
  );

  // O card diz O QUÊ — sem ele a vista dependia do tooltip do pin, que some
  // quando o cursor sai.
  check("o card mostra o tipo do achado", /Ocupação divergente/i.test(corpo));

  /*
   * A DISCIPLINA NO CARD — de quem é o erro (onda 1 do spec do canvas).
   *
   * O canvas dizia tipo, trecho e página, e não dizia a quem cobrar. A sigla é
   * o portador primário; a cor só acompanha, e por isso a prova mede a SIGLA.
   *
   * "Estrutural de concreto" tem de virar EST e "Arquitetura" tem de virar ARQ —
   * a redução de vinte e três códigos para oito famílias é o que faz a escala
   * caber num card de 200px.
   */
  const siglas = await page.locator("[data-disciplina]").evaluateAll((els) =>
    els.map((el) => el.getAttribute("data-disciplina")),
  );
  check("o card mostra a sigla da disciplina", siglas.includes("EST"), siglas.join(","));

  /*
   * E O ACHADO SEM DISCIPLINA NÃO GANHA ETIQUETA NENHUMA.
   *
   * É o caso que mais acontece: a disciplina é LIDA do cabeçalho da página e
   * fica vazia quando a página não trouxe um reconhecível. Inventar uma sigla
   * ali seria pior que não ter — o card estaria afirmando de quem é o erro sem
   * base. Dos cinco achados semeados, dois têm disciplina; um deles virou pilha.
   */
  check(
    "e o achado sem disciplina fica sem sigla",
    siglas.length < ACHADOS.length,
    `${siglas.length} siglas para ${ACHADOS.length} achados`,
  );

  /*
   * O REALCE MUDOU DE MECANISMO, e estas asserções ficaram medindo o antigo.
   *
   * Elas exigiam que o card sob o cursor ficasse em opacidade > 0.9 e que "os
   * outros apagam" (< 0.5). Isso era o HOLOFOTE — e o holofote foi removido de
   * propósito: com 45 achados em 28 páginas, atravessar a grade apagava 21 das
   * 56 arestas a cada card tocado, e a tela virava um estroboscópio. O realce
   * passou a ser ADITIVO: acende o par, não apaga ninguém.
   *
   * Com isso, `opacity` é 1 em tudo, sempre — a asserção não tinha como passar,
   * e ninguém viu porque esta prova depende de um PDF que não está no
   * repositório. O que carrega o destaque hoje é a MOLDURA (`--nx-edge` vira
   * `--ring`), e é ela que se mede.
   */
  /*
   * O valor computado é a COR FINAL (`#5bdac6`), e não o nome do token — por
   * isso a comparação é contra `--ring` e `--border` lidos da raiz, em vez de
   * procurar a palavra "ring" no texto.
   */
  const tokens = await page.evaluate(() => {
    const raiz = getComputedStyle(document.documentElement);
    return {
      ring: raiz.getPropertyValue("--ring").trim(),
      border: raiz.getPropertyValue("--border").trim(),
    };
  });

  const molduraDo = (loc) =>
    loc
      .locator("> div")
      .first()
      .evaluate((el) => getComputedStyle(el).getPropertyValue("--nx-edge").trim());

  const primeiro = cards.first();
  const segundo = cards.nth(1);
  await primeiro.hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/c3-par-aceso.png` });
  const molduraAcesa = await molduraDo(primeiro);
  const molduraApagada = await molduraDo(segundo);
  check(
    "o card sob o cursor ganha a moldura de foco",
    molduraAcesa === tokens.ring,
    `${molduraAcesa} (esperado ${tokens.ring})`,
  );
  /*
   * O card não-aceso NÃO define `--nx-edge`: ele cai no padrão do `.nx-edge-6`,
   * que já é `var(--border)`. Vazio aqui é o comportamento certo, e o que se
   * cobra é o que importa — ele não ganhou a moldura de foco, e continua na
   * tela.
   */
  check(
    "e os outros continuam VISÍVEIS, sem a moldura de foco",
    molduraApagada !== tokens.ring &&
      (await segundo.locator("> div").first().isVisible()),
    `${molduraApagada || "(padrão: " + tokens.border + ")"}`,
  );

  /*
   * Acender o par NÃO pode remontar os PDFs: o destaque passa pelos dados dos
   * nós, então um erro aqui faria cada hover recarregar todas as miniaturas.
   */
  const canvasesAntes = await page.locator("canvas.react-pdf__Page__canvas").count();
  await segundo.hover();
  await page.waitForTimeout(800);
  const canvasesDepois = await page.locator("canvas.react-pdf__Page__canvas").count();
  check(
    "passar o cursor não remonta as miniaturas",
    canvasesAntes === canvasesDepois && canvasesDepois === ACHADOS.length,
    `${canvasesAntes} → ${canvasesDepois}`,
  );

  /*
   * SAIR DO CARD apaga o foco e não deixa rastro: nenhuma moldura de anel fica
   * acesa depois que o cursor vai embora. Media opacidade — mesma correção das
   * asserções acima.
   */
  await page.mouse.move(5, 5);
  await page.waitForTimeout(400);
  const molduraDepoisDeSair = await molduraDo(segundo);
  check(
    "saindo do card, o foco se apaga",
    molduraDepoisDeSair !== tokens.ring,
    molduraDepoisDeSair || "(padrão)",
  );

  // A pilha acende o GRUPO: os pins das duas páginas do erro repetido, e nenhum
  // outro. Um destaque que acendesse só um deles negaria o próprio motivo da
  // pilha existir.
  await pilhas.first().hover();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/c4-pilha-acesa.png` });
  /*
   * Mede `data-aceso` e a ESCALA, e não opacidade — mesmo motivo das duas
   * asserções acima: nada mais apaga, então contar quem está em opacidade 1
   * contava todos os cinco pins e a asserção não tinha como passar.
   *
   * A escala entra junto para o atributo não virar decoração: `data-aceso` sem
   * efeito visual passaria verde com o destaque quebrado.
   */
  const acesos = await page.locator("[data-pin][data-aceso]").count();
  check(`a pilha acende as ${RECORRENTES} páginas do erro (acesos ${acesos})`, acesos === RECORRENTES);

  if (acesos > 0) {
    const cresceu = await page
      .locator("[data-pin][data-aceso]")
      .first()
      .evaluate((el) => {
        /*
         * `scale`, e não `transform`: o Tailwind v4 usa as propriedades
         * individuais (`translate`, `scale`, `rotate`), então a escala NÃO
         * aparece na matriz do `transform` — medir lá devolvia 1 com o pin
         * crescendo na tela.
         */
        const s = getComputedStyle(el).scale;
        if (!s || s === "none") return 1;
        const escala = Number.parseFloat(s.split(" ")[0]);
        return Number.isFinite(escala) ? escala : 1;
      });
    check("e o pin aceso cresce de verdade", cresceu > 1.2, `escala ${cresceu}`);
  }

  /*
   * A PILHA NÃO SE MEXE MAIS — e esta é a mesma proteção de antes, cobrada de
   * um jeito mais forte.
   *
   * As duas asserções que viviam aqui mediam o ciclo de 6s: que o cursor o
   * PAUSAVA, e que `prefers-reduced-motion` o CONGELAVA. As duas existiam pelo
   * mesmo motivo — "ler a lista de páginas não pode ser perseguir uma camada em
   * movimento". Com o ciclo removido (onda 1 do spec do canvas), isso passou a
   * valer por construção, e o que se mede agora é a ausência: nenhuma animação,
   * em nenhum estado, sem depender de o cursor estar em cima.
   */
  const animacaoDaPilha = await pilhas
    .first()
    .locator('[data-pilha="topo"]')
    .evaluate((el) => getComputedStyle(el).animationName);
  check("a pilha nao anima", animacaoDaPilha === "none", animacaoDaPilha);

  const listaDePaginas = await pilhas.first().innerText();
  check("a pilha diz em que páginas o erro está", /112/.test(listaDePaginas) && /114/.test(listaDePaginas), listaDePaginas);

  /*
   * E AS PÁGINAS VIRARAM CAMINHO. Eram texto: quem queria conferir a página 114
   * tinha de achá-la à mão no canvas. A pílula move a câmera até lá.
   *
   * A medida é o TRANSFORM do painel do React Flow antes e depois — "o botão
   * existe" passaria verde com o clique não fazendo nada.
   */
  const painel = page.locator(".react-flow__viewport").first();
  const antesDoSalto = await painel.evaluate((el) => getComputedStyle(el).transform);
  const pilula = pilhas.first().getByRole("button", { name: /Ir para a página 114/i });
  check("a pilha oferece a pílula da página", (await pilula.count()) > 0);

  if ((await pilula.count()) > 0) {
    await pilula.first().click();
    await page.waitForTimeout(900);
    const depoisDoSalto = await painel.evaluate((el) => getComputedStyle(el).transform);
    check(
      "e clicar nela move a câmera",
      antesDoSalto !== depoisDoSalto,
      `${antesDoSalto} -> ${depoisDoSalto}`,
    );
    await page.screenshot({ path: `${OUT}/c5-pilula-saltou.png` });
  }

  check("e a pilha continua contando as ocorrências", /×2/.test(await page.locator("body").innerText()));

  // --- O parecer por cima, sem largar o documento ---------------------------
  const miniaturasAntes = await page.locator("canvas.react-pdf__Page__canvas").count();
  await page.getByRole("button", { name: /Ver parecer completo/i }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/c6-parecer-no-drawer.png` });

  const drawer = page.getByRole("dialog", { name: /Parecer completo/i });
  check("o drawer abre com o parecer", (await drawer.count()) === 1);
  check(
    "e traz o parecer de verdade, não um resumo",
    /RESULTADO DA AUDITORIA|Centro Comunitário Primeira Linha/i.test(await drawer.innerText()),
  );

  /*
   * A razão de o drawer existir: ler o parecer NÃO pode custar as miniaturas.
   * Trocar de vista pelo chip desmonta o canvas e refaz todas — com 122
   * páginas seriam ~13s a cada consulta, e o enquadramento se perde junto.
   */
  const miniaturasComDrawer = await page.locator("canvas.react-pdf__Page__canvas").count();
  check(
    "abrir o parecer não desmonta o documento",
    miniaturasComDrawer === miniaturasAntes && miniaturasAntes === ACHADOS.length,
    `${miniaturasAntes} → ${miniaturasComDrawer}`,
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  check("Esc fecha o parecer", (await drawer.count()) === 0);
  check(
    "e o documento continua lá, intacto",
    (await page.locator("canvas.react-pdf__Page__canvas").count()) === ACHADOS.length,
  );

  // --- O custo de sair da vista para ler o parecer --------------------------
  /*
   * O chip TROCA a vista: o canvas desmonta e, na volta, cada miniatura é
   * refeita do zero. Medido aqui para o drawer não ser opinião.
   */
  const miniaturas = page.locator("canvas.react-pdf__Page__canvas");
  await page.getByRole("button", { name: /^Parecer$/i }).first().click();
  await page.waitForTimeout(600);
  const durante = await miniaturas.count();
  const t1 = Date.now();
  await page.getByRole("button", { name: /No documento/i }).first().click();
  await miniaturas.first().waitFor({ timeout: 30000 }).catch(() => {});
  while (Date.now() - t1 < 30000 && (await miniaturas.count()) < ACHADOS.length) {
    await page.waitForTimeout(200);
  }
  console.log(
    `       ida e volta pelo chip: ${((Date.now() - t1) / 1000).toFixed(1)}s para refazer ${await miniaturas.count()} miniaturas (no parecer sobravam ${durante})`,
  );

  check("nenhum erro de runtime", erros.length === 0, erros[0] ?? "");
} catch (e) {
  falhas++;
  console.error("EXPLODIU:", e.message);
  await page.screenshot({ path: `${OUT}/c-erro.png`, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  console.log(falhas === 0 ? "\nTudo OK" : `\n${falhas} falha(s)`);
  process.exit(falhas === 0 ? 0 : 1);
}
