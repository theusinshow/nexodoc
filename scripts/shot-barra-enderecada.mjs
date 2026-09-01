// O CARTÃO APARECE, E APARECE ENDEREÇADO.
//
//   node scripts/shot-barra-enderecada.mjs   (== npm run prova:barra)
//
// Semeia uma conversa de memorial JÁ VINCULADA ao 063-26 e prova que a barra
// mostra "063-26 · CRICIÚMA" — e não "A endereçar" nem "Sem código no carimbo".
//
// MEDE A CAIXA CONTRA A JANELA, não só a presença no DOM: asserção de DOM passa
// verde com o painel inteiro fora da tela, e este projeto já pagou por isso.
//
// SEM IA: a conversa é semeada no banco, nenhum modelo é chamado.
import { chromium } from "playwright";
import nextEnv from "@next/env";

import { entrarComo } from "./lib/atores-de-teste.mjs";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.BASE ?? process.env.SHOT_BASE ?? "http://localhost:3000";
const CONV_ID = "qa-barra-enderecada";
// O mesmo ator que a prova da fila usa. Exige `NEXODOC_DEV_AUTH=true`.
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
// `baseURL` no CONTEXTO: é o que `entrarComo` espera, e é como a prova da fila
// encena cada identidade sem reiniciar o servidor.
const contexto = await navegador.newContext({
  baseURL: BASE,
  viewport: { width: 1440, height: 900 },
});
const pagina = await contexto.newPage();
await entrarComo(pagina, EMAIL);
await pagina.goto("/nexo", { waitUntil: "networkidle" });

const alvo = pagina.getByText(`${projeto.code} · ${projeto.client}`).first();
await alvo.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});

check("o cartão traz código e prefeitura", (await alvo.count()) > 0);
check(
  "não sobrou rótulo de sem-endereço",
  (await pagina.getByText("Sem código no carimbo").count()) === 0,
);

/*
 * A CAIXA CONTRA A JANELA. Um elemento pode estar no DOM, "visível" para o
 * Playwright e ainda assim fora da tela — foi assim que uma prova anterior
 * passou verde com o painel inteiro fora do enquadramento.
 */
const caixa = await alvo.boundingBox();
const janela = pagina.viewportSize();
check(
  "o cartão está DENTRO da janela",
  Boolean(caixa) &&
    caixa.x >= 0 &&
    caixa.y >= 0 &&
    caixa.x + caixa.width <= janela.width &&
    caixa.y + caixa.height <= janela.height,
  JSON.stringify({ caixa, janela }),
);
check("o cartão tem altura de verdade", Boolean(caixa) && caixa.height > 8);

await pagina.screenshot({ path: "prova-barra-enderecada.png" });
console.log("\nprova-barra-enderecada.png");

await navegador.close();
await prisma.nexoConversation.delete({ where: { id: CONV_ID } }).catch(() => {});

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
