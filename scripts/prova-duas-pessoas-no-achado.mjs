// DUAS PESSOAS NO MESMO ACHADO — o que este sub-projeto existe para fazer.
//
//   node --import ./scripts/lib/resolver-de-imports.mjs scripts/prova-duas-pessoas-no-achado.mjs
//   (== npm run prova:duas-pessoas)
//
// Victor manda um achado ao Milton COM RECADO; o Milton responde que não é
// dele; o Victor vê a resposta. Antes deste trabalho, o Milton só podia
// registrar um DESFECHO — fechar errado ou deixar apodrecer na fila.
//
// Dois contextos do Playwright, como em prova-fila-de-achados.mjs: o login dev
// resolve o usuário pelo e-mail, e cada contexto carrega uma identidade.
//
// SEM IA: a auditoria é a que o seed já deixou.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const VICTOR = "victor@prosul.com";
const MILTON = "milton@prosul.com";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: "org-prosul" }, report: { not: null } },
  select: { id: true, report: true },
});
check("existe auditoria com parecer", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const findingId = audit.report.incongruencias[0].id;
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id, findingId } });

const navegador = await chromium.launch();

// --- Victor atribui com recado, pela mesma rota que a tela usa ---
const ctxVictor = await navegador.newContext({ baseURL: BASE });
const pVictor = await ctxVictor.newPage();
await entrarComo(pVictor, VICTOR);

const atribuiu = await pVictor.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/atribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingIds: [fid],
        assigneeEmail: "milton@prosul.com",
        assigneeNome: "Milton",
        recado: "olha o item 14, acho que é o mesmo erro do 084",
      }),
    });
    return r.status;
  },
  [audit.id, findingId],
);
check("o Victor atribuiu com recado", atribuiu === 201, `HTTP ${atribuiu}`);

// --- Milton lê e responde ---
const ctxMilton = await navegador.newContext({ baseURL: BASE });
const pMilton = await ctxMilton.newPage();
await entrarComo(pMilton, MILTON);

const viuOMilton = await pMilton.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, { cache: "no-store" });
    return await r.json();
  },
  [audit.id, findingId],
);
check(
  "o Milton vê o recado do Victor",
  viuOMilton.linhas?.some((l) => l.body?.includes("item 14")),
  JSON.stringify(viuOMilton.linhas),
);
check(
  "o recado veio junto do evento de atribuição, e não solto",
  viuOMilton.linhas?.[0]?.frase === "atribuiu a Milton",
  viuOMilton.linhas?.[0]?.frase,
);
check(
  "o Milton é reconhecido como ele mesmo",
  viuOMilton.euSou === MILTON,
  viuOMilton.euSou,
);

const respondeu = await pMilton.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "isso é do estrutural, não meu" }),
    });
    return r.status;
  },
  [audit.id, findingId],
);
check("o Milton respondeu", respondeu === 201, `HTTP ${respondeu}`);

// --- Victor vê a resposta ---
const viuOVictor = await pVictor.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, { cache: "no-store" });
    return await r.json();
  },
  [audit.id, findingId],
);
check(
  "o Victor vê a resposta do Milton",
  viuOVictor.linhas?.some((l) => l.body === "isso é do estrutural, não meu"),
  JSON.stringify(viuOVictor.linhas),
);
check(
  "a conversa está em ordem: atribuição primeiro, resposta depois",
  viuOVictor.linhas?.length === 2 &&
    viuOVictor.linhas[0].kind === "atribuiu" &&
    viuOVictor.linhas[1].kind === "comentario",
  viuOVictor.linhas?.map((l) => l.kind).join(","),
);
check(
  "cada fala tem o nome de quem falou",
  viuOVictor.linhas?.[0]?.quem === "Victor" && viuOVictor.linhas?.[1]?.quem === "Milton",
  viuOVictor.linhas?.map((l) => l.quem).join(","),
);

// --- O Victor passa o achado para a Carla; o histórico guarda a passagem ---
const reatribuiu = await pVictor.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/atribuir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        findingIds: [fid],
        assigneeEmail: "carla@prosul.com",
        assigneeNome: "Carla",
      }),
    });
    return r.status;
  },
  [audit.id, findingId],
);
check("o Victor passou o achado adiante", reatribuiu === 201, `HTTP ${reatribuiu}`);

const depois = await pVictor.evaluate(
  async ([id, fid]) => {
    const r = await fetch(`/api/audits/${id}/achados/${fid}/conversa`, { cache: "no-store" });
    return await r.json();
  },
  [audit.id, findingId],
);
check(
  "o histórico diz DE QUEM saiu, e não só para quem foi",
  depois.linhas?.some((l) => l.frase === "passou de Milton para Carla"),
  depois.linhas?.map((l) => l.frase).join(" | "),
);

await navegador.close();
await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id, findingId } });

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
