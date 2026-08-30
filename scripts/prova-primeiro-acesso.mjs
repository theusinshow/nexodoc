// O PRIMEIRO pedido de quem entra pela primeira vez.
//
//   node scripts/prova-primeiro-acesso.mjs   (== npm run prova:primeiro-acesso)
//
// Esta prova existe porque a outra não conseguia pegar o defeito. A
// `prova-escritorio-automatico.mjs` entra pelo navegador, e entrar pelo
// navegador CARREGA UMA PÁGINA — e toda página do app chama `getUserAccess` no
// servidor antes de renderizar. Quando ela finalmente chamava a API, o vínculo
// já tinha sido criado na chamada anterior, pela página. A asserção estava
// certa; o que faltava era chegar à API antes de qualquer página.
//
// O defeito que ela escondia: `getUserAccess` criava a conta e DEVOLVIA, sem
// passar pelo escritório automático. Resultado — o primeiro pedido autenticado
// de uma conta nova encontrava conta criada e nenhum vínculo, e o portão
// recusava com "Você não faz parte de nenhum escritório.". O segundo pedido
// passava, porque aí a conta já existia e o automático rodava.
//
// Um 403 que some ao recarregar é pior que um 403 fixo: parece azar, some
// quando alguém vai olhar, e a pessoa que o viu jura que o sistema recusou.
//
// Sem navegador de propósito: são quatro `fetch` com um pote de cookies à mão,
// e é isso que garante que o pedido medido seja mesmo o PRIMEIRO.
//
// Exige `NEXODOC_DEV_AUTH=true` e o servidor de pé (`npm run dev`).
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ORG = "org-prosul";
const NOVATA = "primeiro.acesso@teste.local";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

const prisma = getPrisma();

// Conta nova de verdade: sem User e sem vínculo, como quem nunca entrou.
await prisma.organizationMember.deleteMany({ where: { email: NOVATA } });
await prisma.user.deleteMany({ where: { email: NOVATA } });

const pote = new Map();

function cookies() {
  return [...pote.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function pedir(caminho, init = {}) {
  const res = await fetch(BASE + caminho, {
    ...init,
    redirect: "manual",
    headers: { ...(init.headers ?? {}), cookie: cookies() },
  });

  for (const bruto of res.headers.getSetCookie?.() ?? []) {
    const [par] = bruto.split(";");
    const corte = par.indexOf("=");
    pote.set(par.slice(0, corte), par.slice(corte + 1));
  }

  return res;
}

const { csrfToken } = await (await pedir("/api/auth/csrf")).json();

await pedir("/api/auth/callback/nexodoc-dev", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, email: NOVATA, json: "true", redirect: "false" }),
});

const sessao = await (await pedir("/api/auth/session")).json();
check("o atalho de dev abriu sessão", sessao?.user?.email === NOVATA, sessao?.user?.email);

if (sessao?.user?.email !== NOVATA) {
  console.error("\nFALHOU  primeiro acesso :: sem sessão não há o que medir");
  console.error("        confira NEXODOC_DEV_AUTH=true e o servidor em " + BASE);
  await prisma.$disconnect();
  process.exit(1);
}

// O PEDIDO QUE IMPORTA. Nenhuma página foi carregada até aqui.
const primeiro = await pedir("/api/audits/recent");
const corpo = await primeiro.text();

check(
  "o PRIMEIRO pedido autenticado já passa",
  primeiro.status === 200,
  `HTTP ${primeiro.status} ${corpo.slice(0, 80)}`,
);

const vinculo = await prisma.organizationMember.findFirst({
  where: { email: NOVATA },
  select: { organizationId: true, role: true, status: true, userId: true },
});

check("com vínculo criado no mesmo pedido", Boolean(vinculo));
check("na PROSUL", vinculo?.organizationId === ORG, vinculo?.organizationId);
check("como MEMBER, e não com alçada", vinculo?.role === "MEMBER", vinculo?.role);
check("já ATIVO", vinculo?.status === "ACTIVE", vinculo?.status);
check("ligado à conta que acabou de nascer", Boolean(vinculo?.userId));

await prisma.organizationMember.deleteMany({ where: { email: NOVATA } });
await prisma.user.deleteMany({ where: { email: NOVATA } });
await prisma.$disconnect();

if (falhas > 0) {
  console.error(`\nFALHOU  primeiro acesso (${falhas})`);
  process.exit(1);
}

console.log("\nOK  primeiro acesso");
