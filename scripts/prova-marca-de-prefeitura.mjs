// A MARCA APARECE, COM A COR DA CIDADE E NO TAMANHO DA FORMA.
//
//   node scripts/prova-marca-de-prefeitura.mjs   (== npm run prova:marca)
//
// O que esta prova existe para pegar, e que nenhum teste de node cru pega:
//
//   1. `var(--prefeitura-*)` QUE NÃO RESOLVE. O núcleo devolve a string
//      `var(--prefeitura-criciuma-1)` e passa verde; se o token não estiver no
//      CSS que o navegador carregou, o segmento fica TRANSPARENTE e a marca
//      some sem nada acusar. Aqui se lê a cor computada, em rgb.
//   2. A MARCA FORA DA JANELA. Asserção de DOM passa verde com o elemento
//      inteiro fora da tela, e este projeto já pagou por isso. Mede-se a caixa
//      contra a janela.
//   3. A ALTURA DO CARTÃO FECHADO MUDANDO. O spec exigia que os 3px da marca
//      saíssem do `py-2` do botão, não somassem a ele. Se alguém devolver o
//      `py-2`, o cartão cresce e a barra inteira desce.
//   4. A MARCA MEDIDA PELA CAIXA, E NÃO PELA TINTA. O contêiner é um flex de
//      nível de bloco e ocupa a largura do cartão — a primeira versão desta
//      prova reprovou, com isso, um alinhamento que estava certo.
//
// SEM IA e SEM MODELO: a conversa é semeada no banco. Nenhuma chamada paga.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const CONV_ID = "qa-marca-de-prefeitura";
const EMAIL = "victor@prosul.com";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul", code: "063-26" },
  select: { id: true, code: true, client: true },
});
check("o 063-26 existe", Boolean(projeto), "rode npm run seed:dev");
if (!projeto) process.exit(1);

const agora = new Date();
await prisma.nexoConversation.upsert({
  where: { id: CONV_ID },
  create: {
    id: CONV_ID,
    userEmail: EMAIL,
    title: "Memorial",
    projectId: projeto.id,
    tipo: "auditoria",
    createdAt: agora,
    updatedAt: agora,
    data: {
      id: CONV_ID,
      title: "Memorial",
      createdAt: +agora,
      updatedAt: +agora,
      messages: [],
      seloResults: [],
      results: [],
    },
  },
  update: { projectId: projeto.id, updatedAt: agora },
});

const navegador = await chromium.launch();
const contexto = await navegador.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 900 },
});
const pagina = await contexto.newPage();
await entrarComo(pagina, EMAIL);
await pagina.goto("/nexo", { waitUntil: "networkidle" });

const cartao = pagina.getByText(`${projeto.code} · ${projeto.client}`).first();
await cartao.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
check("o cartão do 063-26 está na barra", (await cartao.count()) > 0);

/*
 * O SINAL do cartão. `data-marca-de-prefeitura` é o atributo que a primitiva
 * carimba — buscar pela classe do Tailwind quebraria na próxima refatoração de
 * utilitário, e buscar pelo texto não serve: a marca não tem texto de propósito.
 */
/*
 * ESCOPADO AO CARTÃO DO 063-26. `.first()` solto pega o primeiro sinal do DOM,
 * que é o do balde "A endereçar" — cinza, e a prova passaria verde medindo a
 * ausência enquanto se dizia medindo Criciúma.
 */
const cartaoDo063 = pagina
  .locator("[class*='nx-edge-6']")
  .filter({ hasText: `${projeto.code} · ${projeto.client}` })
  .first();
const sinal = cartaoDo063.locator('[data-marca-de-prefeitura="sinal"]').first();
await sinal.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
check("o sinal existe no cartão", (await sinal.count()) > 0);

if ((await sinal.count()) > 0) {
  const medida = await sinal.evaluate((el) => {
    const segmentos = [...el.children].map((c) => {
      const s = getComputedStyle(c);
      return {
        cor: s.backgroundColor,
        largura: c.getBoundingClientRect().width,
        altura: c.getBoundingClientRect().height,
      };
    });
    /*
     * A TINTA, NÃO A CAIXA. O contêiner é um flex de nível de bloco: ele ocupa
     * a largura do cartão e sua `boundingClientRect` inclui o `padding-left`.
     * Medir por ela dava 271px de "marca" e um `x` 10px à esquerda do primeiro
     * segmento — a primeira versão desta prova reprovou um alinhamento que
     * estava certo. O que se vê são os três segmentos.
     */
    const primeiro = el.children[0].getBoundingClientRect();
    const ultimo = el.children[el.children.length - 1].getBoundingClientRect();
    return {
      segmentos,
      caixa: {
        x: primeiro.x,
        y: primeiro.y,
        largura: ultimo.right - primeiro.x,
        altura: ultimo.bottom - primeiro.y,
      },
      opacidade: getComputedStyle(el).opacity,
    };
  });

  check("o sinal tem três segmentos", medida.segmentos.length === 3, JSON.stringify(medida.segmentos));

  /*
   * A COR RESOLVEU. `transparent` ou `rgba(0, 0, 0, 0)` aqui significa token
   * ausente do CSS — a marca renderizou, ocupou espaço, e não pintou nada.
   */
  const transparentes = medida.segmentos.filter(
    (s) => !s.cor || s.cor === "transparent" || s.cor === "rgba(0, 0, 0, 0)",
  );
  check(
    "as três cores resolveram — nenhum var() vazio",
    transparentes.length === 0,
    JSON.stringify(medida.segmentos.map((s) => s.cor)),
  );

  /*
   * CRICIÚMA É AMARELO. Não basta pintar: tem de pintar a cor DESTA cidade.
   * `#fdd116` = rgb(253, 209, 22). Um mapa que casasse errado pintaria um
   * cinza aqui e passaria em todas as checagens acima.
   */
  check(
    "a cor é a de Criciúma, e não um cinza de ausência",
    medida.segmentos[0]?.cor === "rgb(253, 209, 22)",
    `primeiro segmento: ${medida.segmentos[0]?.cor}`,
  );
  check(
    "a marca está em opacidade cheia — prefeitura conhecida",
    medida.opacidade === "1",
    `opacity: ${medida.opacidade}`,
  );

  // 9×3 por segmento, gap 2 → 31px de ponta a ponta.
  check(
    "a geometria do sinal é 9×3, e a soma dá 31px",
    Math.abs(medida.segmentos[0].largura - 9) < 0.6 &&
      Math.abs(medida.segmentos[0].altura - 3) < 0.6 &&
      Math.abs(medida.caixa.largura - 31) < 1.2,
    JSON.stringify(medida.caixa),
  );

  const janela = pagina.viewportSize();
  check(
    "a marca está DENTRO da janela",
    medida.caixa.x >= 0 &&
      medida.caixa.y >= 0 &&
      medida.caixa.x + medida.caixa.largura <= janela.width &&
      medida.caixa.y + medida.caixa.altura <= janela.height,
    JSON.stringify({ caixa: medida.caixa, janela }),
  );

  /*
   * O PRIMEIRO SEGMENTO NASCE ALINHADO COM O CHEVRON. É a razão de o `pl-2.5`
   * da marca ser o mesmo `px-2.5` do botão — desalinhar aqui faz a coluna
   * inteira parecer torta, e um pixel de sobra ninguém liga a um padding.
   */
  const chevron = await sinal.evaluate((el) => {
    const botao = el.parentElement?.querySelector("button");
    const svg = botao?.querySelector("svg");
    return svg ? svg.getBoundingClientRect().x : null;
  });
  check(
    "o primeiro segmento alinha com o chevron",
    chevron !== null && Math.abs(chevron - medida.caixa.x) < 1.5,
    `chevron x=${chevron} · marca x=${medida.caixa.x}`,
  );
}

/*
 * OS 3px DA MARCA SAÍRAM DO PADDING DO BOTÃO, não somaram a ele.
 *
 * O spec era explícito: `py-2` vira `pt-[5px] pb-2`, e 3 + 5 devolvem os 8px
 * que separavam a aresta da primeira linha — a altura do cartão FECHADO não
 * muda. Aferir a altura total do cartão não serve como prova: ela depende de o
 * cartão estar aberto e de quantas conversas ele lista. O que se afere é a
 * SOMA, que é a afirmação que o desenho fez.
 */
const soma = await sinal.evaluate((el) => {
  const botao = el.parentElement?.querySelector("button");
  return {
    marca: el.children[0].getBoundingClientRect().height,
    padding: botao ? parseFloat(getComputedStyle(botao).paddingTop) : null,
  };
});
check(
  "marca + padding do botão devolvem os 8px do `py-2`",
  soma.marca === 3 && soma.padding === 5,
  JSON.stringify(soma),
);

/*
 * A AUSÊNCIA TEM MARCA. O balde "A endereçar" agrega conversas de projetos
 * diferentes e não pode ter a cor de nenhum — mas some, e a linha fica mais
 * curta que a vizinha, que é a diferença que a marca existe para NÃO fazer.
 */
const aEnderecar = pagina.getByText("A endereçar").first();
if ((await aEnderecar.count()) > 0) {
  const cinza = await aEnderecar.evaluate((el) => {
    const cartaoEl = el.closest("[class*='nx-edge-6']");
    const marca = cartaoEl?.querySelector('[data-marca-de-prefeitura="sinal"]');
    if (!marca) return null;
    return {
      opacidade: getComputedStyle(marca).opacity,
      cor: getComputedStyle(marca.children[0]).backgroundColor,
      // A tinta, não a caixa — o contêiner ocupa a largura do cartão.
      largura:
        marca.children[2].getBoundingClientRect().right -
        marca.children[0].getBoundingClientRect().x,
    };
  });
  check("o balde 'A endereçar' também tem marca", cinza !== null);
  if (cinza) {
    check(
      "e ela é cinza a 50%, no mesmo espaço da conhecida",
      cinza.opacidade === "0.5" &&
        cinza.cor === "rgb(74, 84, 89)" &&
        Math.abs(cinza.largura - 31) < 1.2,
      JSON.stringify(cinza),
    );
  }
} else {
  console.log("  --      sem balde 'A endereçar' nesta base; ausência não medida aqui");
}

/*
 * ---------------------------------------------------------------------------
 * A PALETA (Ctrl+K) — o BASTÃO, e o vão que a ação recebe no lugar dele.
 * ---------------------------------------------------------------------------
 * O bastão substitui um rótulo que não existe: quem tem bastão é conversa, quem
 * não tem é ação. Se o vão de 3px sumir, os rótulos das duas espécies deixam de
 * cair na mesma vertical e a lista passa a parecer duas.
 */
await pagina.keyboard.press("Control+k");
const paleta = pagina.locator("[data-paleta]");
await paleta.waitFor({ state: "visible", timeout: 8_000 }).catch(() => {});
check("a paleta abriu", await paleta.isVisible().catch(() => false));

if (await paleta.isVisible().catch(() => false)) {
  /*
   * A BUSCA POR CIDADE — o caso que a seção 04 do mapa foi escrita para
   * melhorar, e que estava QUEBRADO até 01/09/2026.
   *
   * A barra achava os projetos por "criciuma" (ela filtra por código e cliente)
   * e a paleta não achava NADA: ela buscava por `groupConversations`, que só
   * olhava título e `folderKey` — vazio nas conversas que já têm `projectId`.
   * Duas buscas, o mesmo texto, respostas diferentes. Agora as duas chamam
   * `filtrarCartoes` sobre os mesmos cartões.
   */
  await pagina.keyboard.type("criciuma");
  const bastao = paleta.locator('[data-marca-de-prefeitura="bastao"]').first();
  await bastao.waitFor({ state: "attached", timeout: 8_000 }).catch(() => {});
  check(
    "buscar a CIDADE na paleta acha conversa — não mais zero",
    (await bastao.count()) > 0,
  );

  if ((await bastao.count()) > 0) {
    const b = await bastao.evaluate((el) => {
      const seg = el.children[0].getBoundingClientRect();
      const ultimo = el.children[2].getBoundingClientRect();
      const linha = el.closest("[data-item-da-paleta]");
      return {
        cor: getComputedStyle(el.children[0]).backgroundColor,
        largura: seg.width,
        altura: seg.height,
        alturaTotal: ultimo.bottom - seg.y,
        direcao: getComputedStyle(el).flexDirection,
        opacidade: getComputedStyle(el).opacity,
        // O último SPAN, e não o último filho: no item sob o cursor o último
        // filho é o `CornerDownLeft`, e um svg não tem texto.
        pasta: (() => {
          const spans = linha ? [...linha.querySelectorAll("span")] : [];
          return spans.length ? (spans[spans.length - 1].textContent ?? "").trim() : "";
        })(),
      };
    });
    check(
      "o bastão é 3×4 EMPILHADO, e soma 14px de altura",
      b.direcao === "column" &&
        Math.abs(b.largura - 3) < 0.6 &&
        Math.abs(b.altura - 4) < 0.6 &&
        Math.abs(b.alturaTotal - 14) < 1.2,
      JSON.stringify(b),
    );
    /*
     * E ELE É AMARELO, não cinza. Era o segundo defeito do mesmo buraco: a cor
     * vinha da `pasta` (o `folderKey` vazio), então o bastão nascia cinza mesmo
     * com o projeto resolvido. Agora vem do `cliente` do cartão.
     */
    check(
      "e traz a COR DE CRICIÚMA — não o cinza de ausência",
      b.cor === "rgb(253, 209, 22)" && b.opacidade === "1",
      JSON.stringify({ cor: b.cor, opacidade: b.opacidade }),
    );
    check(
      "o texto da direita é a pasta, e não um cuid de banco",
      /CRICIUMA/i.test(b.pasta) && !/^c[a-z0-9]{20,}$/i.test(b.pasta),
      `direita: ${b.pasta}`,
    );
  }

  /*
   * A FOTO SAI AQUI, com a busca por cidade na tela — é o estado que estava
   * quebrado, e a prova é a única que o encena: fora dela este banco não tem
   * NENHUMA conversa com projeto, e "criciuma" devolveria "nada com esse nome"
   * com toda a razão.
   */
  await pagina.screenshot({ path: "prova-paleta-cidade.png" });

  /*
   * QUEM TEM BASTÃO É CONVERSA, QUEM NÃO TEM É AÇÃO — e é a distinção inteira
   * que o desenho comprou. Se a ação ganhasse bastão, o sinal deixaria de
   * separar as duas espécies e viraria enfeite.
   *
   * A BUSCA MUDA AQUI, e de propósito: "criciuma" devolve só conversas (nenhuma
   * ação se chama assim), e a lista misturada é justamente o que esta checagem
   * precisa ver. Uma letra devolve as duas.
   */
  for (let i = 0; i < "criciuma".length; i += 1) {
    await pagina.keyboard.press("Backspace");
  }
  await pagina.keyboard.type("a");
  await pagina.waitForTimeout(300);

  const especies = await paleta.evaluate(() => {
    const linhas = [...document.querySelectorAll("[data-item-da-paleta]")];
    let comBastao = 0;
    let semBastao = 0;
    const xs = new Set();
    for (const l of linhas) {
      if (l.querySelector('[data-marca-de-prefeitura="bastao"]')) comBastao += 1;
      else semBastao += 1;
      const rotulo = l.querySelector("span[class*='flex-1']");
      if (rotulo) xs.add(Math.round(rotulo.getBoundingClientRect().x));
    }
    return { comBastao, semBastao, xs: [...xs] };
  });
  check(
    "a lista mistura as duas espécies — há conversa E ação",
    especies.comBastao > 0 && especies.semBastao > 0,
    JSON.stringify(especies),
  );
  /*
   * A AÇÃO FICA COM O VÃO DE 3px, e não com nada: sem ele os rótulos das duas
   * espécies deixam de cair na mesma vertical, e a lista passa a parecer duas.
   */
  check(
    "conversa e ação alinham o rótulo na MESMA vertical",
    especies.xs.length === 1,
    JSON.stringify(especies.xs),
  );

  await pagina.screenshot({ path: "prova-marca-paleta.png" });
  await pagina.keyboard.press("Escape");
}

/*
 * ---------------------------------------------------------------------------
 * /projetos — o SELO, e a dívida paga: o `client` passa a aparecer.
 * ---------------------------------------------------------------------------
 */
await pagina.goto("/projetos", { waitUntil: "networkidle" });
const selo = pagina.locator('[data-marca-de-prefeitura="selo"]').first();
await selo.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
check("o cartão de /projetos tem selo", (await selo.count()) > 0);

if ((await selo.count()) > 0) {
  const m = await selo.evaluate((el) => {
    const seg = el.children[0].getBoundingClientRect();
    const ultimo = el.children[2].getBoundingClientRect();
    return {
      largura: seg.width,
      altura: seg.height,
      total: ultimo.right - seg.x,
      linha: el.parentElement?.textContent?.trim() ?? "",
    };
  });
  check(
    "o selo é 13×5 e soma 43px",
    Math.abs(m.largura - 13) < 0.6 &&
      Math.abs(m.altura - 5) < 0.6 &&
      Math.abs(m.total - 43) < 1.2,
    JSON.stringify(m),
  );
  /*
   * A DÍVIDA. O cartão tinha `client` no dado, filtrava por ele na busca e não
   * o mostrava — quem procurava por "criciuma" recebia uma lista que não
   * explicava por que aqueles projetos vieram.
   */
  check(
    "e a linha agora mostra o cliente, não só o código",
    /·/.test(m.linha),
    `linha: ${m.linha}`,
  );
  await pagina.screenshot({ path: "prova-marca-projetos.png" });
}

await pagina.goto("/nexo", { waitUntil: "networkidle" });
await pagina.screenshot({ path: "prova-marca-de-prefeitura.png" });
console.log("\nprova-marca-de-prefeitura.png");

await navegador.close();
await prisma.nexoConversation.delete({ where: { id: CONV_ID } }).catch(() => {});

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
