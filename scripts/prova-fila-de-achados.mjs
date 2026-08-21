// A fila inteira, com DUAS pessoas ao mesmo tempo.
//
//   node scripts/prova-fila-de-achados.mjs   (== npm run prova:fila)
//
// Victor manda achados ao Milton, eles aparecem na home do Milton agrupados
// pelo projeto, e somem quando ele registra o desfecho. É o fluxo que o produto
// existe para fazer, e antes deste trabalho não havia como sequer encená-lo:
// o login dev entrava sempre como a mesma pessoa.
//
// SEMEIA A AUDITORIA direto no banco. Disparar uma de verdade custaria minutos
// de modelo e não mediria nada do que esta prova mede — o que se testa aqui é a
// fila, não o motor.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const AUDIT_ID = "qa-fila-de-achados";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const projeto = await prisma.project.findFirst({
  where: { organizationId: "org-prosul", code: "063-26" },
  select: { id: true },
});
check("o 063-26 existe", Boolean(projeto), "rode npm run seed:dev");

/*
 * O RELATÓRIO SEMEADO PRECISA SER VÁLIDO.
 *
 * `arquivos_analisados` e `comparacoes` são obrigatórios em `AuditReport`
 * (`lib/audit-report.ts`), e a primeira versão desta prova os omitiu. O parecer
 * abria e a tela quebrava inteira — "Cannot read properties of undefined
 * (reading 'map')" —, e o sintoma que a prova mostrava era "o link não leva à
 * auditoria", que apontava para o lugar errado.
 *
 * Fixture inválida testa o comportamento do sistema com dado que ele nunca
 * produz, e o erro que ela encontra é sobre a fixture.
 */
const relatorio = {
  tipo_auditoria: "memorial",
  tipo_documento: "memorial descritivo",
  obra: "Cancha de Bocha",
  codigo: "063-26",
  municipio: "Criciúma",
  status_analise: "concluida",
  status_geral: "NAO_EMITIR",
  total_incongruencias: 2,
  arquivos_analisados: [],
  comparacoes: [],
  conclusao: "Documento com pendências antes de emitir.",
  incongruencias: [
    {
      id: "INC-001",
      prioridade: "Alta",
      pagina: "12",
      capitulo: "PPCI",
      local: "item 4.2",
      tipo: "Saída de emergência sem largura declarada",
      descricao: "Falta a largura.",
      evidencia: "a saída de emergência deverá atender ao previsto",
      conflito: "NBR 9077 exige largura mínima declarada",
      sugestao_correcao: "Declarar a largura.",
      confianca: "alta",
      impacto: "critico_documental",
    },
    {
      id: "INC-002",
      prioridade: "Media",
      pagina: "31",
      capitulo: "Estrutural",
      local: "tabela 7",
      tipo: "Tabela de cargas sem unidade",
      descricao: "Sem unidade.",
      evidencia: "carga acidental de 250 na laje de cobertura",
      conflito: "unidade ausente",
      sugestao_correcao: "Informar kN/m².",
      confianca: "alta",
      impacto: "tecnico_contratual",
    },
  ],
};

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await prisma.audit.create({
  data: {
    id: AUDIT_ID,
    projectId: projeto.id,
    title: "Memorial 063-26 — prova da fila",
    projectName: "063-26",
    auditMode: "memorial",
    status: "COMPLETED",
    report: relatorio,
    totalFindings: 2,
  },
});

const browser = await chromium.launch();

// --- Victor envia os dois achados ao Milton.
const ctxVictor = await browser.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
pVictor.setDefaultTimeout(25000);
await entrarComo(pVictor, "victor@prosul.com");

const envio = await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001", "INC-002"], assigneeEmail: "milton@prosul.com" },
});
check("Victor envia dois achados", envio.status() === 201, `status ${envio.status()}`);

const linhas = await prisma.auditFeedback.findMany({ where: { auditId: AUDIT_ID } });
check("viraram duas linhas", linhas.length === 2, `${linhas.length}`);

/*
 * A IMPRESSÃO DIGITAL é a asserção silenciosa mais importante daqui. Ela não
 * serve a nada hoje — serve à linhagem entre versões, que ainda não existe. Se
 * parar de ser gravada, ninguém nota até a reauditoria não reencontrar a
 * pendência, meses depois.
 */
check(
  "e cada uma guarda a impressao digital",
  linhas.every((l) => Boolean(l.fingerprint)),
  linhas.map((l) => l.fingerprint).join(" | "),
);
check(
  "que NAO e o id posicional",
  linhas.every((l) => !l.fingerprint?.includes("INC-")),
  linhas.map((l) => l.fingerprint).join(" | "),
);

// --- Milton vê na fila e na home.
const ctxMilton = await browser.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
pMilton.setDefaultTimeout(25000);
await entrarComo(pMilton, "milton@prosul.com");

const meu = await pMilton.request.get("/api/trabalho/meu");
const { pendencias } = await meu.json();
const doProjeto = (pendencias ?? []).find((p) => p.auditId === AUDIT_ID);
check("aparece na fila do Milton", Boolean(doProjeto), JSON.stringify(pendencias));
check("agrupado pelo projeto", doProjeto?.code === "063-26", doProjeto?.code);
check("com os dois achados", doProjeto?.total === 2, `${doProjeto?.total}`);

await pMilton.goto("/");
await pMilton.waitForLoadState("networkidle");
await pMilton.waitForTimeout(800);
const homeDoMilton = await pMilton.locator("body").innerText();
check("e a home mostra o 063-26", /063-26/.test(homeDoMilton));
check("dizendo de quem veio", /victor/i.test(homeDoMilton), homeDoMilton.slice(0, 160));

// --- O DEEP-LINK: clicar em ABRIR leva à auditoria de quem enviou.
//
// O Milton NÃO tem a conversa do Victor na máquina dele — as conversas moram no
// IndexedDB de quem as criou. É exatamente o caso que a fila existe para
// atender, e por isso o parecer vem do servidor.
//
// Sem esta asserção, o link ficava apontando para o Nexo genérico e a home
// prometia um caminho que não existia. Foi assim por três commits.
//
// O SELETOR mudou em 14/08 e a asserção NÃO. A home virou o painel de projetos
// (`Nexo - Painel v2`), onde não há um botão "Abrir": o cartão do projeto abre
// num acordeão e cada achado é a própria linha clicável. O que esta prova mede
// continua sendo o mesmo — que o caminho da home cai na AUDITORIA de quem
// enviou, e não no Nexo genérico.
// GARANTE ABERTO, e não alterna: o painel já abre sozinho o projeto que mais
// espera, e um clique cego fechava justamente o cartão que a prova queria ler.
const achadoNaHome = pMilton.locator("main section a[href*='auditoria=']").first();

if ((await achadoNaHome.count()) === 0) {
  await pMilton.locator("main section button[aria-expanded='false']").first().click();
}

await achadoNaHome.click();
await pMilton.waitForURL(/auditoria=/, { timeout: 20000 });
await pMilton.waitForLoadState("networkidle");
await pMilton.waitForTimeout(3500);

const telaDaAuditoria = await pMilton.locator("body").innerText();

/*
 * O parecer ABERTO, e não o Nexo genérico. A tela cai no RESUMO da auditoria —
 * a lista de achados fica na aba ao lado, a um clique. Medir aqui pelo resumo é
 * o honesto: é o que o link entrega hoje.
 */
check(
  "ABRIR leva a auditoria, e nao ao Nexo generico",
  /n[aã]o emitir|matriz de achados|achados/i.test(telaDaAuditoria) &&
    !/boa noite|boa tarde|bom dia/i.test(telaDaAuditoria),
  telaDaAuditoria.replace(/\s+/g, " ").slice(0, 160),
);

/*
 * A TARJA DIZ "COM VOCÊ" PARA QUEM RECEBEU — e o nome, para todos os outros.
 *
 * É o buraco que o teste de 21/08 encontrou: o fluxo inteiro funcionava e a
 * única tela em que a pessoa TRABALHA o achado mostrava "com Milton" para o
 * próprio Milton. Notícia sobre um terceiro, na tela dele.
 *
 * As DUAS metades são medidas aqui, e de propósito. Só afirmar que o Milton lê
 * "com você" passaria verde numa tarja que dissesse "com você" para todo mundo
 * — que é o defeito oposto e o pior dos dois: aí o Victor acha que o achado
 * voltou para ele.
 */
async function tarjasDe(page) {
  await page.getByRole("button", { name: /achados/i }).first().click();
  await page.waitForTimeout(600);
  // O PALCO, e não `main`: a barra lateral também é um `main`, e ela lista as
  // conversas — texto que não tem nada a ver com a tarja e que só abriria porta
  // para casamento por acaso.
  return page.locator("main.nexo-shell__stage").innerText();
}

const achadosDoMilton = await tarjasDe(pMilton);
check(
  "para quem recebeu, a tarja diz COM VOCE",
  /com voc[eê]/i.test(achadosDoMilton),
  achadosDoMilton.replace(/\s+/g, " ").slice(0, 200),
);
check(
  "e nao o nome dele mesmo",
  !/com milton/i.test(achadosDoMilton),
  achadosDoMilton.replace(/\s+/g, " ").slice(0, 200),
);

await pVictor.goto(`/nexo?auditoria=${AUDIT_ID}`);
await pVictor.waitForLoadState("networkidle");
await pVictor.waitForTimeout(3500);
const achadosDoVictor = await tarjasDe(pVictor);
check(
  "para quem enviou, a tarja diz o nome de quem esta com ele",
  /com milton/i.test(achadosDoVictor),
  achadosDoVictor.replace(/\s+/g, " ").slice(0, 200),
);
check(
  "e nunca COM VOCE",
  !/com voc[eê]/i.test(achadosDoVictor),
  achadosDoVictor.replace(/\s+/g, " ").slice(0, 200),
);

// --- Decisão técnica sem nota é recusada pelo SERVIDOR.
const semNota = await pMilton.request.post(`/api/audits/${AUDIT_ID}/feedback`, {
  data: { findingId: "INC-001", resolutionKind: "ACCEPTED_RISK" },
});
check("decisao tecnica sem nota e recusada", semNota.status() === 400, `status ${semNota.status()}`);

const aindaAberto = await prisma.auditFeedback.findFirst({
  where: { auditId: AUDIT_ID, findingId: "INC-001" },
});
check("e nada foi gravado por engano", !aindaAberto?.resolvedAt, `${aindaAberto?.resolvedAt}`);

// --- Milton resolve um.
const resolveu = await pMilton.request.post(`/api/audits/${AUDIT_ID}/feedback`, {
  data: { findingId: "INC-001", resolutionKind: "FIXED_IN_DOC" },
});
check("Milton registra o desfecho", resolveu.ok(), `status ${resolveu.status()}`);

const depois = await (await pMilton.request.get("/api/trabalho/meu")).json();
const restante = (depois.pendencias ?? []).find((p) => p.auditId === AUDIT_ID);
check("sobra um achado na fila dele", restante?.total === 1, `${restante?.total}`);

// --- Quem ENVIOU também resolve (decisão A.5 do spec).
const peloRemetente = await pVictor.request.post(`/api/audits/${AUDIT_ID}/feedback`, {
  data: { findingId: "INC-002", resolutionKind: "FALSE_POSITIVE" },
});
check("quem enviou tambem resolve", peloRemetente.ok(), `status ${peloRemetente.status()}`);

const falso = await prisma.auditFeedback.findFirst({
  where: { auditId: AUDIT_ID, findingId: "INC-002" },
});
check(
  "e o falso positivo marca os DOIS eixos",
  falso?.verdict === "FALSE_POSITIVE" && Boolean(falso?.resolvedAt),
  `verdict=${falso?.verdict} resolvedAt=${falso?.resolvedAt}`,
);

const corrigido = await prisma.auditFeedback.findFirst({
  where: { auditId: AUDIT_ID, findingId: "INC-001" },
});
check(
  "e corrigir NAO julga a IA",
  corrigido?.verdict === null,
  `verdict=${corrigido?.verdict}`,
);

const vazia = await (await pMilton.request.get("/api/trabalho/meu")).json();
check(
  "a fila do Milton esvazia",
  !(vazia.pendencias ?? []).some((p) => p.auditId === AUDIT_ID),
);

// --- Mandar para quem nunca entrou.
await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.organizationMember.updateMany({
  where: { email: "ana@prosul.com" },
  data: { status: "INVITED", userId: null },
});
await prisma.user.deleteMany({ where: { email: "ana@prosul.com" } });

const paraConvidada = await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001"], assigneeEmail: "ana@prosul.com" },
});
check(
  "da para enviar a quem nunca entrou",
  paraConvidada.status() === 201,
  `status ${paraConvidada.status()}`,
);

const ctxAna = await browser.newContext({ baseURL: BASE });
const pAna = await ctxAna.newPage();
pAna.setDefaultTimeout(25000);
await entrarComo(pAna, "ana@prosul.com");
const daAna = await (await pAna.request.get("/api/trabalho/meu")).json();
check(
  "e no primeiro login dela o achado esta la",
  (daAna.pendencias ?? []).some((p) => p.auditId === AUDIT_ID),
  JSON.stringify(daAna.pendencias),
);

// --- Quem foi DESLIGADO não recebe.
//
// Encontrado em 21/08, olhando o seletor "Enviar para": ele oferecia dois
// vínculos DISABLED, e o servidor aceitava. O achado ia para uma fila que
// ninguém mais abre, e quem enviou via "1 achado enviado" e ia embora.
//
// O cenário é semeado AQUI: depender de outra prova ter passado antes é o
// buraco com aparência de cobertura que este arquivo já documenta duas vezes.
await prisma.organizationMember.upsert({
  where: { organizationId_email: { organizationId: "org-prosul", email: "exfuncionario@prosul.com" } },
  create: {
    organizationId: "org-prosul",
    email: "exfuncionario@prosul.com",
    name: "Ex Funcionario",
    role: "MEMBER",
    status: "DISABLED",
  },
  update: { status: "DISABLED" },
});

const paraDesligado = await pVictor.request.post(`/api/audits/${AUDIT_ID}/atribuir`, {
  data: { findingIds: ["INC-001"], assigneeEmail: "exfuncionario@prosul.com" },
});
check(
  "quem foi desligado nao recebe achado",
  paraDesligado.status() === 400,
  `status ${paraDesligado.status()}`,
);

const paraNinguem = await prisma.auditFeedback.count({
  where: { assigneeEmail: "exfuncionario@prosul.com" },
});
check("e nada foi gravado para ele", paraNinguem === 0, `${paraNinguem} linha(s)`);

/*
 * E O SELETOR NEM O OFERECE — o servidor recusar não basta se a tela convida.
 *
 * A barra de envio só existe com achado marcado, então a prova marca um: ler a
 * lista sem isso devolveria zero opções e passaria verde por ausência, que é o
 * jeito mais fácil de escrever uma asserção que não mede nada.
 */
await pVictor.goto(`/nexo?auditoria=${AUDIT_ID}`);
await pVictor.waitForLoadState("networkidle");
await pVictor.waitForTimeout(3500);
await pVictor.getByRole("button", { name: /achados/i }).first().click();

/*
 * O CAMINHO COM A PALAVRA ESCRITA.
 *
 * Enviar sempre foi possível marcando a etiqueta "Ref. INC-001", que é uma
 * caixa de seleção — mas nada na tela dizia isso, e a palavra "enviar" só
 * aparecia DEPOIS de marcar. Quem não sabia da caixa não tinha como descobrir
 * metade do produto.
 *
 * A prova entra pelo menu, e não pela caixa: é o caminho de quem NÃO sabe.
 * Marcar direto testaria o que já funcionava.
 */
await pVictor.getByRole("button", { name: /Ações do achado/i }).first().click();
const itemEnviar = pVictor.getByRole("menuitem", { name: /enviar para alguém/i }).first();
const temItem = (await itemEnviar.count()) > 0;
check("o menu do achado oferece ENVIAR com todas as letras", temItem);

if (temItem) {
  await itemEnviar.click();
} else {
  await pVictor.getByLabel(/Selecionar INC-001 para enviar/i).check();
}

check(
  "e clicar nele abre a barra de envio",
  (await pVictor.locator("#destinatario-do-envio").count()) > 0,
);

const nomesNoSeletor = await pVictor.locator("#destinatario-do-envio option").allTextContents();
check(
  "e o seletor nem o oferece",
  nomesNoSeletor.length > 1 && !nomesNoSeletor.some((n) => /ex funcionario/i.test(n)),
  `${nomesNoSeletor.length} opcoes`,
);
// A lista tem que trazer QUEM PODE: sem isto, "não oferece o desligado" passaria
// verde numa lista vazia — e uma tela sem destinatário nenhum é pior defeito.
check(
  "mas oferece quem pode",
  nomesNoSeletor.some((n) => /milton/i.test(n)),
  nomesNoSeletor.slice(0, 6).join(" | "),
);

// --- Fora do escritório, nada.
//
// O cenário é semeado AQUI, e não herdado de `prova:escritorio`. Uma asserção
// que pula quando outra prova não rodou antes é um buraco com aparência de
// cobertura: ela aparece verde na lista e não mediu nada.
await prisma.organization.upsert({
  where: { slug: "fantasma" },
  create: {
    id: "org-fantasma",
    name: "Escritório Fantasma",
    slug: "fantasma",
    ownerEmail: "ninguem@fantasma.com",
  },
  update: {},
});

const projetoAlheio = await prisma.project.upsert({
  where: { organizationId_code: { organizationId: "org-fantasma", code: "999-99" } },
  create: {
    organizationId: "org-fantasma",
    code: "999-99",
    name: "Projeto de outro escritório",
    client: "OUTRA",
    ownerEmail: "ninguem@fantasma.com",
  },
  update: {},
  select: { id: true },
});

const AUDIT_ALHEIA = "qa-fila-alheia";
await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ALHEIA } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ALHEIA } });
await prisma.audit.create({
  data: {
    id: AUDIT_ALHEIA,
    projectId: projetoAlheio.id,
    title: "Memorial de outro escritório",
    projectName: "999-99",
    auditMode: "memorial",
    status: "COMPLETED",
    report: relatorio,
    totalFindings: 2,
  },
});

const tentativa = await pVictor.request.post(`/api/audits/${AUDIT_ALHEIA}/atribuir`, {
  data: { findingIds: ["INC-001"], assigneeEmail: "milton@prosul.com" },
});
check(
  "auditoria de outro escritorio nao recebe atribuicao",
  tentativa.status() === 404,
  `status ${tentativa.status()}`,
);

const vazouAlgo = await prisma.auditFeedback.count({ where: { auditId: AUDIT_ALHEIA } });
check("e nada foi gravado la", vazouAlgo === 0, `${vazouAlgo} linha(s)`);

await prisma.audit.deleteMany({ where: { id: AUDIT_ALHEIA } });

// --- A home SEM pendência não vira tela vazia.
//
// É a metade que se esquece de medir: a home só se justifica por mostrar
// trabalho, e quem não tem nenhum precisa achar o caminho para auditar. Se esta
// asserção quebrar, a home virou a "parada no caminho" que o comentário de
// `app/page.tsx` diz para não criar.
await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });

const ctxSemNada = await browser.newContext({ baseURL: BASE });
const pSemNada = await ctxSemNada.newPage();
pSemNada.setDefaultTimeout(25000);
await entrarComo(pSemNada, "carla@prosul.com");
await pSemNada.goto("/");
await pSemNada.waitForLoadState("networkidle");
await pSemNada.waitForTimeout(800);

const semPendencia = await pSemNada.locator("body").innerText();

/*
 * SEM PENDÊNCIA, A HOME NÃO INVENTA TRABALHO.
 *
 * A versão anterior desta asserção procurava a palavra "COM VOCÊ" — e essa
 * palavra NÃO EXISTE em lugar nenhum da tela desde que a home virou o painel de
 * projetos, em 14/08. Ela não podia ficar vermelha: passava verde num banco
 * vazio, num banco cheio, e passaria com a home em branco.
 *
 * É o mesmo erro que o comentário do link para o Nexo, trinta linhas abaixo,
 * descreve — e ele estava a trinta linhas de distância. O que esta asserção
 * quer dizer é "a Carla não vê o projeto do Milton", então é o CÓDIGO DO
 * PROJETO que se procura: ele aparece na home de quem tem pendência (asserção
 * lá em cima) e não pode aparecer na de quem não tem.
 */
check(
  "sem pendencia, a home nao mostra o projeto de outra pessoa",
  !/063-26/.test(semPendencia),
  semPendencia.replace(/\s+/g, " ").slice(0, 160),
);

/*
 * O CAMINHO PARA O NEXO, medido como LINK e não como palavra.
 *
 * A versão anterior desta asserção procurava /nexo|auditoria|projetos/ no texto
 * da página — e passava verde enquanto o aplicativo estava quebrado: a palavra
 * "Nexo" aparece no cabeçalho de toda tela. Quando o redirect da raiz saiu, a
 * home ficou sem NENHUM caminho para a ferramenta principal, e esta prova não
 * viu. Foi o usuário que viu.
 *
 * Uma asserção que não consegue ficar vermelha é pior que asserção nenhuma:
 * ela dá confiança sem dar cobertura.
 */
const linkParaONexo = await pSemNada.locator('a[href="/nexo"]').count();
check("e oferece um link para o Nexo", linkParaONexo > 0, `${linkParaONexo} link(s)`);
/*
 * DESTAQUE MEDIDO, e não procurado como palavra.
 *
 * Esta asserção procurava o texto "abrir nexo" — o rótulo do cartão de módulo
 * enfatizado. Em 14/08 a home virou o painel de projetos e o cartão deixou de
 * existir: o caminho para o Nexo passou a ser o ORBE, que não tem rótulo nenhum.
 *
 * Trocar o texto procurado por outro texto repetiria o erro que o comentário
 * acima descreve. O que "em destaque" quer dizer é TAMANHO, então é o tamanho
 * que se mede: entre os caminhos para o Nexo na tela, o maior tem que ser
 * grande de verdade, e não a marca de 20px do cabeçalho.
 */
const caixasDoNexo = await pSemNada.locator('a[href="/nexo"]').evaluateAll((links) =>
  links.map((l) => {
    const r = l.getBoundingClientRect();
    return Math.min(r.width, r.height);
  }),
);
const maiorCaminho = Math.max(0, ...caixasDoNexo);
check(
  "com o caminho em destaque, e nao perdido na lista",
  maiorCaminho >= 160,
  `maior lado menor: ${Math.round(maiorCaminho)}px`,
);

await prisma.auditFeedback.deleteMany({ where: { auditId: AUDIT_ID } });
await prisma.audit.deleteMany({ where: { id: AUDIT_ID } });
await browser.close();
console.log(falhas === 0 ? "\nOK  fila de achados" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
