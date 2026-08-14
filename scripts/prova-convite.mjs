// O convite: existir no escritório antes de existir como conta.
//
//   node scripts/prova-convite.mjs   (== npm run prova:convite)
//
// POR QUE ESTE CICLO IMPORTA
//
// O convite nasce `INVITED`, sem `userId` — a pessoa pode nunca ter entrado. É
// isso que vai permitir ATRIBUIR um achado ao Victor antes do primeiro login
// dele, e o primeiro dia de uso é exatamente quando a coordenação quer
// distribuir trabalho. Modelar o responsável como `User` tornaria impossível.
//
// E o aceite não tem tela: para um escritório, ele já aconteceu fora do
// sistema, quando contrataram. O primeiro login é o que liga o vínculo à conta.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const NOVA = "carla@prosul.com";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

// Estado limpo: ela não existe nem como membro nem como conta.
await prisma.organizationMember.deleteMany({ where: { email: NOVA } });
await prisma.user.deleteMany({ where: { email: NOVA } });

const browser = await chromium.launch();

// --- Milton coordena, e convida.
const ctxMilton = await browser.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
pMilton.setDefaultTimeout(25000);
await entrarComo(pMilton, "milton@prosul.com");

const convite = await pMilton.request.post("/api/organizacao/membros", {
  data: { email: NOVA, name: "Carla", role: "MEMBER" },
});
check("coordenacao convida", convite.status() === 201, `status ${convite.status()}`);

const convidada = await prisma.organizationMember.findFirst({ where: { email: NOVA } });
check(
  "o convite nasce INVITED e SEM conta",
  convidada?.status === "INVITED" && convidada?.userId === null,
  `status=${convidada?.status} userId=${convidada?.userId}`,
);

// --- Victor é projetista, e não convida.
const ctxVictor = await browser.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
pVictor.setDefaultTimeout(25000);
await entrarComo(pVictor, "victor@prosul.com");

const tentativa = await pVictor.request.post("/api/organizacao/membros", {
  data: { email: "outro@prosul.com" },
});
check("MEMBER nao convida", tentativa.status() === 403, `status ${tentativa.status()}`);

// Mas ele VÊ quem é do escritório: saber com quem se trabalha não é privilégio
// de coordenação, e é o que torna possível escolher um responsável.
const listaDoVictor = await pVictor.request.get("/api/organizacao/membros");
check("MEMBER le a lista de membros", listaDoVictor.ok(), `status ${listaDoVictor.status()}`);

// --- Carla entra pela primeira vez.
const ctxCarla = await browser.newContext({ baseURL: BASE });
const pCarla = await ctxCarla.newPage();
pCarla.setDefaultTimeout(25000);
await entrarComo(pCarla, NOVA);

const ativada = await prisma.organizationMember.findFirst({ where: { email: NOVA } });
check(
  "o primeiro login ativa o convite",
  ativada?.status === "ACTIVE",
  `status ${ativada?.status}`,
);
check("e liga o vinculo a conta", Boolean(ativada?.userId), `userId ${ativada?.userId}`);

const projetosDaCarla = await pCarla.request.get("/api/projects");
check(
  "e ela ja ve os projetos da PROSUL",
  projetosDaCarla.ok(),
  `status ${projetosDaCarla.status()}`,
);

// --- Reconvite não rebaixa quem já entrou.
const reconvite = await pMilton.request.post("/api/organizacao/membros", {
  data: { email: NOVA, name: "Carla Souza" },
});
const depois = await prisma.organizationMember.findFirst({ where: { email: NOVA } });
check(
  "reconvite nao devolve alguem ativo para INVITED",
  reconvite.ok() && depois?.status === "ACTIVE",
  `status ${depois?.status}`,
);

// --- A OUTRA PORTA: o painel de plataforma.
//
// Quem opera a plataforma libera pelo /admin/users, e quem coordena o escritório
// convida pela rota da organização. São portas diferentes para a MESMA regra —
// e o que esta parte mede é justamente que produzem o mesmo estado. Se um dia
// divergirem, alguém vai liberar por uma porta e ficar sem entender por que a
// outra não vê.
const PELO_PAINEL = "dora@prosul.com";
await prisma.organizationMember.deleteMany({ where: { email: PELO_PAINEL } });

const TOKEN = process.env.NEXODOC_ADMIN_TOKEN?.trim() || "teste-local";
const comoAdmin = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

/*
 * QUEM ABRE ESTA PORTA É OUTRO ATOR.
 *
 * O Milton é `ADMIN` do ESCRITÓRIO — coordena a PROSUL, e não opera a
 * plataforma. `/api/admin/*` exige administrador de PLATAFORMA, e recusá-lo com
 * 403 é o comportamento certo: são dois eixos, e o painel não é do cliente.
 *
 * Sem e-mail, o login dev entra como o do ambiente, que é quem está em
 * `NEXODOC_ADMIN_EMAILS`.
 */
const ctxPlataforma = await browser.newContext({ baseURL: BASE });
const pPlataforma = await ctxPlataforma.newPage();
pPlataforma.setDefaultTimeout(25000);
await entrarComo(pPlataforma, "");

const negadoAoEscritorio = await pMilton.request.post("/api/admin/users/escritorio", {
  headers: comoAdmin,
  data: { email: PELO_PAINEL, acao: "liberar" },
});
check(
  "ADMIN do escritorio nao opera o painel da plataforma",
  negadoAoEscritorio.status() === 403,
  `status ${negadoAoEscritorio.status()}`,
);

const liberou = await pPlataforma.request.post("/api/admin/users/escritorio", {
  headers: comoAdmin,
  data: { email: PELO_PAINEL, acao: "liberar" },
});
check("o painel libera no escritorio", liberou.status() === 201, `status ${liberou.status()}`);

const peloPainel = await prisma.organizationMember.findFirst({ where: { email: PELO_PAINEL } });
check(
  "e o estado e o MESMO que o da rota da organizacao",
  peloPainel?.status === "INVITED" && peloPainel?.userId === null,
  `status=${peloPainel?.status} userId=${peloPainel?.userId}`,
);

// Sem o token do admin, a porta do painel não abre — mesmo com sessão válida.
const semToken = await pPlataforma.request.post("/api/admin/users/escritorio", {
  data: { email: PELO_PAINEL, acao: "liberar" },
});
check("sem o token do admin, o painel recusa", semToken.status() === 401, `status ${semToken.status()}`);

const removeu = await pPlataforma.request.post("/api/admin/users/escritorio", {
  headers: comoAdmin,
  data: { email: PELO_PAINEL, acao: "remover" },
});
const sumiu = await prisma.organizationMember.count({ where: { email: PELO_PAINEL } });
check("e remove o vinculo sem apagar a conta", removeu.ok() && sumiu === 0, `${sumiu} vinculo(s)`);

await browser.close();
console.log(falhas === 0 ? "\nOK  convite" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
