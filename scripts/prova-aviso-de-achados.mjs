// O AVISO POR E-MAIL, do botão até a mensagem gravada.
//
//   node scripts/prova-aviso-de-achados.mjs   (== npm run prova:aviso)
//
// Victor distribui achados a três pessoas, aperta UM botão, e cada uma recebe
// um e-mail com o que é dela. É a metade do produto que faltava: até aqui, quem
// era convidado e nunca entrou não tinha como saber que havia trabalho.
//
// NÃO MANDA E-MAIL DE VERDADE. Sem `RESEND_API_KEY`, fora de produção, o
// correio grava a mensagem em `scratchpad/qa/correio.jsonl` em vez de enviar
// (ver `lib/correio.ts`) — e é esse arquivo que a prova lê. Se alguém rodar
// isto com a chave configurada, o `check` do modo avisa antes de qualquer
// asserção depender do arquivo.
//
// SEMEIA A AUDITORIA direto no banco, como a prova da fila: o que se testa aqui
// é o aviso, não o motor de auditoria.
import fs from "node:fs";

import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const AUDIT_ID = "qa-aviso-de-achados";
const CAIXA = "./scratchpad/qa/correio.jsonl";

// Um ATIVO, um CONVIDADO (nunca entrou — o caso que este recurso existe para
// atender), e um terceiro ativo para a reatribuição no fim.
const MILTON = "milton@prosul.com";
const CARLA = "carla@prosul.com";

/*
 * O CONVIDADO É CRIADO POR ESTA PROVA, e não escolhido do seed.
 *
 * A primeira versão apontava para um convidado semeado — e a prova o LOGAVA no
 * fim, para medir o caminho do e-mail até o parecer. O login promove
 * `INVITED` a `ACTIVE`, então a segunda rodada encontrava um seed sem aquele
 * convidado e falhava numa asserção que descrevia o mundo corretamente na
 * primeira vez. Prova que estraga o próprio cenário passa uma vez e mente
 * depois.
 *
 * Este membro nasce e morre dentro da prova, e o `qa-` no endereço diz a quem
 * abrir o banco que ele não é gente de verdade.
 */
const CONVIDADO = "qa-convidado-do-aviso@prosul.com";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/** O que o correio gravou desde a última limpeza. */
function caixaDeEntrada() {
  if (!fs.existsSync(CAIXA)) return [];

  return fs
    .readFileSync(CAIXA, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((linha) => JSON.parse(linha));
}

function limparCaixa() {
  fs.mkdirSync("./scratchpad/qa", { recursive: true });
  fs.writeFileSync(CAIXA, "", "utf8");
}

const prisma = getPrisma();

check(
  "o correio esta em modo de desenvolvimento (nenhum e-mail sai daqui)",
  !process.env.RESEND_API_KEY?.trim(),
  "RESEND_API_KEY esta configurada — rode esta prova sem ela",
);

const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul", code: "063-26" },
  select: { id: true },
});
check("o 063-26 existe", Boolean(projeto), "rode npm run seed:dev");

const achado = (id, tipo, pagina, descricao) => ({
  id,
  prioridade: "Alta",
  pagina,
  capitulo: "9. Responsabilidade técnica",
  local: "Memorial descritivo",
  tipo,
  descricao,
  evidencia: `Pág. ${pagina}.`,
  sugestao: "Corrigir no memorial.",
});

const relatorio = {
  tipo_auditoria: "memorial",
  tipo_documento: "memorial descritivo",
  obra: "Cancha de Bocha",
  codigo: "063-26",
  municipio: "Criciúma",
  status_analise: "concluida",
  arquivos_analisados: [{ nome: "memorial.pdf", tipo: "memorial descritivo", paginas: 90 }],
  comparacoes: [],
  incongruencias: [
    achado("INC-001", "Escopo / contratual", "84", "PPCI e SPDA sem responsável técnico."),
    achado("INC-002", "Escopo / contratual", "85", "ART não referenciada no corpo do memorial."),
    achado("INC-003", "Divergência técnica", "31", "Diâmetro de recalque diverge da planilha."),
    achado("INC-004", "Revisão de texto", "12", "Nome da obra grafado de duas formas."),
  ],
};

/** O convidado desta prova, sempre recém-nascido e sempre `INVITED`. */
async function semearConvidado() {
  await prisma.organizationMember.deleteMany({
    where: { organizationId: "org-prosul", email: CONVIDADO },
  });
  await prisma.organizationMember.create({
    data: {
      organizationId: "org-prosul",
      email: CONVIDADO,
      name: "Convidada de Teste",
      status: "INVITED",
      role: "MEMBER",
    },
  });
}

/*
 * E o USUÁRIO que o login dele criou na rodada anterior vai junto. Sem isto, o
 * membro nasce `INVITED` mas a conta já existe, e o primeiro login o promove
 * antes da prova medir o que queria medir.
 */
async function limparConvidado() {
  await prisma.organizationMember.deleteMany({
    where: { organizationId: "org-prosul", email: CONVIDADO },
  });
  await prisma.user.deleteMany({ where: { email: CONVIDADO } });
}

await limparConvidado();
await semearConvidado();

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.audit.create({
  data: {
    id: AUDIT_ID,
    projectId: projeto.id,
    title: "Memorial 063-26 — prova do aviso",
    projectName: "063-26",
    auditMode: "memorial",
    status: "COMPLETED",
    report: relatorio,
    totalFindings: 4,
  },
});

limparCaixa();

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 1000 } });
const pVictor = await ctx.newPage();
pVictor.setDefaultTimeout(25000);
await entrarComo(pVictor, "victor@prosul.com");

// --- Sem ninguém atribuído, não há a quem avisar.
const semNinguem = await pVictor.request.get(`/api/audits/${AUDIT_ID}/avisar`);
const semNinguemCorpo = await semNinguem.json();
check(
  "sem atribuicao, ninguem esta pendente de aviso",
  (semNinguemCorpo.pendentes ?? []).length === 0,
  JSON.stringify(semNinguemCorpo),
);

// --- Victor distribui: dois para o Milton, um para quem nunca entrou.
await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001", "INC-002"], assigneeEmail: MILTON },
});
await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-003"], assigneeEmail: CONVIDADO },
});

/*
 * O QUARTO ACHADO É ATRIBUÍDO E JÁ RESOLVIDO.
 *
 * É o caso que a terceira condição de `PENDENTE_DE_AVISO` existe para cobrir:
 * se a pessoa corrigiu antes de o aviso sair, avisar seria mandá-la olhar
 * trabalho que ela mesma fechou. Sem esta linha, a condição podia ser apagada
 * sem nenhuma prova reclamar.
 */
await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-004"], assigneeEmail: CARLA },
});
await prisma.auditFeedback.updateMany({
  where: { auditId: AUDIT_ID, targetKey: "finding:INC-004" },
  data: { resolvedAt: new Date(), resolutionKind: "FIXED_IN_DOC" },
});

const pendentes = await (await pVictor.request.get(`/api/audits/${AUDIT_ID}/avisar`)).json();
const lista = pendentes.pendentes ?? [];
check("duas pessoas ficam pendentes de aviso", lista.length === 2, JSON.stringify(lista));
check(
  "quem ja resolveu NAO entra na lista",
  !lista.some((p) => p.email === CARLA),
  JSON.stringify(lista),
);
check(
  "e quem tem mais achados vem primeiro",
  lista[0]?.email === MILTON && lista[0]?.quantidade === 2,
  JSON.stringify(lista),
);
check(
  "quem nunca entrou vem marcado como convidado",
  lista.find((p) => p.email === CONVIDADO)?.convidado === true,
  JSON.stringify(lista),
);

// --- O BOTÃO na tela.
await pVictor.goto(`/nexo?auditoria=${AUDIT_ID}`);
await pVictor.waitForLoadState("networkidle");
await pVictor.waitForTimeout(3500);

const botao = pVictor.getByRole("button", { name: /avisar por e-mail/i });
check("o cabecalho oferece AVISAR", (await botao.count()) > 0);
check(
  "e o rotulo diz quantas pessoas",
  /avisar\s+2\s+envolvidos/i.test(await botao.first().innerText()),
  await botao.first().innerText().catch(() => "—"),
);

/*
 * CLICAR NÃO ENVIA. É a asserção que protege o único controle irreversível do
 * produto: se um dia alguém trocar o `setConfirmandoAviso` por um envio direto,
 * esta linha falha antes de o commit sair da máquina.
 */
await botao.first().click();
await pVictor.waitForTimeout(600);
check("clicar NAO envia nada", caixaDeEntrada().length === 0, `${caixaDeEntrada().length} mensagens`);

const painel = await pVictor.locator("body").innerText();
check("abre o painel de confirmacao", /2 pessoas ser[aã]o avisadas/i.test(painel));
check("com o nome de quem recebe", /milton/i.test(painel), painel.slice(0, 200));
check("e quantos achados sao de cada um", /2 achados/i.test(painel));
check(
  "marcando quem nunca entrou",
  /convidado\s*[—-]\s*ainda n[aã]o entrou/i.test(painel),
  painel.replace(/\s+/g, " ").slice(0, 300),
);
check(
  "e dizendo que o teor do achado nao sai do sistema",
  /n[aã]o sai do sistema/i.test(painel),
);

// --- Confirmar.
await pVictor.getByRole("button", { name: /confirmar e enviar/i }).click();
await pVictor.waitForTimeout(2500);

const caixa = caixaDeEntrada();
check("dois e-mails, um por pessoa", caixa.length === 2, `${caixa.length}`);
check(
  "e nenhum deles para quem ja tinha resolvido",
  !caixa.some((m) => m.para === CARLA),
  caixa.map((m) => m.para).join(", "),
);

const paraMilton = caixa.find((m) => m.para === MILTON);
const paraConvidado = caixa.find((m) => m.para === CONVIDADO);
check("o Milton recebeu", Boolean(paraMilton));
check("o convidado recebeu", Boolean(paraConvidado));
check(
  "o assunto traz a contagem e o projeto",
  /2 achados esperam por voc[eê]/i.test(paraMilton?.assunto ?? "") &&
    /063-26/.test(paraMilton?.assunto ?? ""),
  paraMilton?.assunto,
);
check(
  "e concorda no singular quando e um so",
  /^1 achado espera por voc[eê]/i.test(paraConvidado?.assunto ?? ""),
  paraConvidado?.assunto,
);
check(
  "o corpo leva o link para ESTA auditoria",
  (paraMilton?.html ?? "").includes(`/nexo?auditoria=${AUDIT_ID}`) &&
    (paraMilton?.texto ?? "").includes(`/nexo?auditoria=${AUDIT_ID}`),
  (paraMilton?.texto ?? "").slice(0, 200),
);
check(
  "e diz quem enviou",
  /victor/i.test(paraMilton?.texto ?? ""),
  (paraMilton?.texto ?? "").slice(0, 120),
);
/*
 * O TEOR DO MEMORIAL NÃO SAI. A asserção procura a descrição do achado no corpo
 * — ela não pode estar lá. É a promessa que o painel de confirmação faz a quem
 * aperta o botão, e a única aqui que protege documento de cliente.
 */
check(
  "e NAO leva o teor do achado",
  !/PPCI|SPDA|recalque/i.test(`${paraMilton?.html ?? ""}${paraMilton?.texto ?? ""}`),
  (paraMilton?.texto ?? "").slice(0, 200),
);
check(
  "a alternativa em texto puro nao vem vazia",
  (paraMilton?.texto ?? "").trim().length > 40,
  `${(paraMilton?.texto ?? "").length} caracteres`,
);
check(
  "e a chamada muda para quem nunca entrou",
  /entre com sua conta/i.test(paraConvidado?.texto ?? ""),
  (paraConvidado?.texto ?? "").slice(0, 160),
);

/*
 * O CAMINHO INTEIRO, DESLOGADO — a promessa do recurso, medida ponta a ponta.
 *
 * Um contexto de navegador NOVO, sem sessão nenhuma, entrando pelo link que o
 * e-mail acabou de gravar. É o que acontece com quem foi convidado e nunca
 * entrou: o clique cai no login ANTES do parecer, e o destino tem que
 * sobreviver a essa ida e volta.
 *
 * Esta asserção nasceu de um defeito real: `app/nexo/page.tsx` mandava
 * `redirectToLogin("/nexo")` e a query morria no caminho. O e-mail prometia um
 * parecer e entregava o Nexo genérico -- e ninguém notava, porque quem já
 * estava logado nunca passava por ali.
 */
const ctxLimpo = await browser.newContext({ baseURL: BASE });
const pDeslogado = await ctxLimpo.newPage();
pDeslogado.setDefaultTimeout(25000);

const linkDoEmail = (paraConvidado?.texto ?? "").match(/https?:\/\/\S+/)?.[0] ?? "";
check("o texto do e-mail tem um link absoluto", linkDoEmail.startsWith("http"), linkDoEmail);

await pDeslogado.goto(linkDoEmail);
await pDeslogado.waitForLoadState("networkidle");
check(
  "deslogado, o link do e-mail cai no login",
  /\/login/.test(pDeslogado.url()),
  pDeslogado.url(),
);
check(
  "E O DESTINO SOBREVIVE ao desvio (senao o e-mail promete um parecer e entrega o Nexo vazio)",
  decodeURIComponent(pDeslogado.url()).includes(`/nexo?auditoria=${AUDIT_ID}`),
  pDeslogado.url(),
);

/*
 * ENTRA NA PRÓPRIA PÁGINA ONDE O LINK CAIU, e NÃO com `entrarComo`.
 *
 * O helper faz `page.goto("/login")` e joga fora o `callbackUrl` que o desvio
 * acabou de montar -- a prova mediria o login com destino em branco e diria que
 * o produto perdeu o parecer. É a diferença entre "quem clicou no e-mail volta
 * ao parecer" e "quem abre o login do zero vai para a home", e só a primeira é
 * o que este recurso promete.
 */
await pDeslogado.locator("#login-dev-email-input").fill(CONVIDADO);
await pDeslogado.getByRole("button", { name: /entrar como dev/i }).click();
await pDeslogado.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 25000 });
await pDeslogado.waitForLoadState("networkidle");
await pDeslogado.waitForTimeout(3500);
check(
  "e depois de entrar, a pessoa esta no parecer que o e-mail prometeu",
  pDeslogado.url().includes(`auditoria=${AUDIT_ID}`),
  pDeslogado.url(),
);
check(
  "com o parecer certo aberto, e nao o Nexo vazio",
  /cancha de bocha/i.test(await pDeslogado.locator("body").innerText()),
  (await pDeslogado.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 250),
);

// A aba ACHADOS é onde mora o trabalho que o e-mail prometeu. O parecer abre no
// Resumo, e parar ali provaria só que a página carregou.
await pDeslogado.getByRole("button", { name: /achados/i }).first().click();
await pDeslogado.waitForTimeout(1500);
check(
  "e o achado dela esta la",
  /recalque/i.test(await pDeslogado.locator("body").innerText()),
  (await pDeslogado.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 250),
);
await ctxLimpo.close();

const carimbadas = await prisma.auditFeedback.findMany({
  where: { auditId: AUDIT_ID },
  select: { targetKey: true, assigneeEmail: true, notifiedAt: true },
});
check(
  "as tres linhas avisadas ficam carimbadas",
  carimbadas.filter((l) => l.notifiedAt).length === 3,
  carimbadas.map((l) => `${l.targetKey}=${l.notifiedAt ? "sim" : "nao"}`).join(" "),
);
check(
  "e a do achado ja resolvido NAO",
  !carimbadas.find((l) => l.targetKey === "finding:INC-004")?.notifiedAt,
);

// --- A tela conta o que aconteceu, sem fingir que o e-mail saiu.
const depois = await pVictor.locator("body").innerText();
check(
  "a tela diz que foi modo de desenvolvimento, e nao 'avisados'",
  /modo de desenvolvimento/i.test(depois) && /nenhum e-mail saiu/i.test(depois),
  depois.replace(/\s+/g, " ").slice(0, 300),
);

// --- Segundo clique não repete.
limparCaixa();
const deNovo = await pVictor.request.post(`/api/audits/${AUDIT_ID}/avisar`);
const corpoDeNovo = await deNovo.json();
check("avisar de novo nao manda nada", caixaDeEntrada().length === 0);
check("e diz que nao ha a quem avisar", corpoDeNovo.estado === "nada-a-avisar", JSON.stringify(corpoDeNovo));

await pVictor.reload();
await pVictor.waitForLoadState("networkidle");
await pVictor.waitForTimeout(3500);
check(
  "e o botao some da tela",
  (await pVictor.getByRole("button", { name: /avisar por e-mail/i }).count()) === 0,
);

/*
 * REATRIBUIR VOLTA A DEIXAR PENDENTE.
 *
 * O buraco que este bloco fecha: o INC-001 carrega o `notifiedAt` do e-mail que
 * foi mandado AO MILTON. Sem zerar, a Carla ficaria com um achado que o sistema
 * jura ter avisado — e ela nunca saberia que ele existe.
 */
limparCaixa();
await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001"], assigneeEmail: CARLA },
});
const reatribuido = await (await pVictor.request.get(`/api/audits/${AUDIT_ID}/avisar`)).json();
check(
  "reatribuir deixa o achado pendente de aviso de novo",
  (reatribuido.pendentes ?? []).length === 1 &&
    reatribuido.pendentes[0].email === CARLA &&
    reatribuido.pendentes[0].quantidade === 1,
  JSON.stringify(reatribuido),
);

const segundoEnvio = await (await pVictor.request.post(`/api/audits/${AUDIT_ID}/avisar`)).json();
check("e o novo dono e avisado", caixaDeEntrada().some((m) => m.para === CARLA));
check(
  "so ele, e nao o dono antigo de novo",
  caixaDeEntrada().length === 1,
  caixaDeEntrada().map((m) => m.para).join(", "),
);
check("o envio se declara gravado, e nao enviado", segundoEnvio.estado === "gravado", JSON.stringify(segundoEnvio));

// --- O PORTÃO: auditoria de outro escritório não avisa ninguém.
limparCaixa();
const outroEscritorio = await prisma.organization.findFirst({
  where: { id: { not: "org-prosul" } },
  select: { id: true },
});

if (outroEscritorio) {
  const projetoDeFora = await prisma.project.findFirst({
    where: { organizationId: outroEscritorio.id },
    select: { id: true },
  });

  if (projetoDeFora) {
    await prisma.audit.deleteMany({ where: { id: `${AUDIT_ID}-fora` } });
    await prisma.audit.create({
      data: {
        id: `${AUDIT_ID}-fora`,
        projectId: projetoDeFora.id,
        title: "Parecer de outro escritorio",
        projectName: "fora",
        auditMode: "memorial",
        status: "COMPLETED",
        report: relatorio,
        totalFindings: 4,
      },
    });
    await prisma.auditFeedback.create({
      data: {
        auditId: `${AUDIT_ID}-fora`,
        targetKey: "finding:INC-001",
        findingId: "INC-001",
        assigneeEmail: MILTON,
        assignedAt: new Date(),
      },
    });

    const invasao = await pVictor.request.post(`/api/audits/${AUDIT_ID}-fora/avisar`);
    check("auditoria de outro escritorio e recusada", invasao.status() === 404, `status ${invasao.status()}`);
    check("e nenhum e-mail sai", caixaDeEntrada().length === 0);

    const intacta = await prisma.auditFeedback.findFirst({
      where: { auditId: `${AUDIT_ID}-fora` },
      select: { notifiedAt: true },
    });
    check("e nada foi carimbado la", intacta?.notifiedAt === null);

    await prisma.auditFeedback.deleteMany({ where: { auditId: `${AUDIT_ID}-fora` } });
    await prisma.audit.deleteMany({ where: { id: `${AUDIT_ID}-fora` } });
  }
}

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await limparConvidado();
limparCaixa();
await browser.close();
console.log(falhas === 0 ? "\nOK  aviso de achados" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
