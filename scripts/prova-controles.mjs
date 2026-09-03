// OS CONTROLES DA PLATAFORMA — a escada contra a rota de verdade.
//
//   node scripts/prova-controles.mjs   (== npm run prova:controles)
//
// As guardas já estão provadas em `npm run test:controles`, puras. O que falta
// é o caminho inteiro: a rota recusa o valor fora da faixa? O que se declara
// aqui VENCE a variável de ambiente? "Voltar ao ambiente" apaga a linha em vez
// de congelar o valor atual? E o freio do cadastro guarda os três estados?
//
// Deixa o banco como encontrou.
//
// Exige `NEXODOC_DEV_AUTH=true`, `NEXODOC_ADMIN_TOKEN` e o servidor de pé.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ADMIN = (process.env.NEXODOC_ADMIN_EMAILS ?? "").split(",")[0].trim().toLowerCase();
const TOKEN = process.env.NEXODOC_ADMIN_TOKEN?.trim() ?? "";

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

if (!ADMIN || !TOKEN) {
  console.error("FALTA  NEXODOC_ADMIN_EMAILS e NEXODOC_ADMIN_TOKEN no .env.local");
  process.exit(1);
}

const prisma = getPrisma();
const CHAVES = ["teto.mensal.usd", "vazao.global", "limites.blocosPorArquivo", "escritorio.padrao"];

// O que havia antes desta prova, para devolver no fim.
const antes = await prisma.configuracaoDaPlataforma.findMany({
  where: { chave: { in: CHAVES } },
});

async function restaurar() {
  await prisma.configuracaoDaPlataforma.deleteMany({ where: { chave: { in: CHAVES } } });
  for (const linha of antes) {
    await prisma.configuracaoDaPlataforma.create({ data: linha });
  }
}

await prisma.configuracaoDaPlataforma.deleteMany({ where: { chave: { in: CHAVES } } });

const pote = new Map();
const cookies = () => [...pote.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

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

const comToken = (extra = {}) => ({ Authorization: `Bearer ${TOKEN}`, ...extra });
const patch = (corpo) =>
  pedir("/api/admin/controles", {
    method: "PATCH",
    headers: comToken({ "content-type": "application/json" }),
    body: JSON.stringify(corpo),
  });

const { csrfToken } = await (await pedir("/api/auth/csrf")).json();
await pedir("/api/auth/callback/nexodoc-dev", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, email: ADMIN, json: "true", redirect: "false" }),
});

const sessao = await (await pedir("/api/auth/session")).json();
if (sessao?.user?.email !== ADMIN) {
  console.error("\nFALHOU  controles :: sem sessão de admin não há o que medir");
  await restaurar();
  await prisma.$disconnect();
  process.exit(1);
}

console.log("controles da plataforma, ponta a ponta\n");

const acha = (retrato, chave) => (retrato.controles ?? []).find((c) => c.chave === chave);

/* ─────────────────────────── o estado inicial ──────────────────────────── */

let retrato = await (await pedir("/api/admin/controles", { headers: comToken() })).json();
const tetoInicial = acha(retrato, "teto.mensal.usd");
check(
  "sem linha no banco, o teto não vem do banco",
  tetoInicial?.origem !== "banco",
  tetoInicial?.origem,
);

/* ──────────────────────────── a guarda ─────────────────────────────────── */

const foraDaFaixa = await patch({ chave: "vazao.global", valor: 999 });
check("valor fora da faixa é recusado pelo SERVIDOR", foraDaFaixa.status === 400);
check(
  "e a mensagem diz qual é a faixa",
  /1 a 50/.test((await foraDaFaixa.json())?.error ?? ""),
);

const zero = await patch({ chave: "teto.mensal.usd", valor: 0 });
check("zero NÃO é aceito como 'desligar' — é um teto que recusa tudo", zero.status === 400);

const inventado = await patch({ chave: "teto.inventado", valor: 10 });
check("controle desconhecido é recusado, não ignorado", inventado.status === 400);

/* ─────────────────────────── declarar e valer ──────────────────────────── */

retrato = await (await patch({ chave: "teto.mensal.usd", valor: "42,5" })).json();
const teto = acha(retrato, "teto.mensal.usd");
check("o teto declarado passa a vir do banco", teto?.origem === "banco", teto?.origem);
check("com vírgula decimal aceita", teto?.valor === 42.5, String(teto?.valor));

const gravado = await prisma.configuracaoDaPlataforma.findUnique({
  where: { chave: "teto.mensal.usd" },
});
check("e ficou registrado quem declarou", gravado?.declaradaPor === ADMIN, gravado?.declaradaPor);

/* ─────────── vazio DESLIGA, e vence a variável de ambiente ─────────────── */

retrato = await (await patch({ chave: "teto.mensal.usd", valor: "" })).json();
const desligado = acha(retrato, "teto.mensal.usd");
check(
  "vazio DESLIGA o teto — e continua vindo do banco, que é a decisão",
  desligado?.valor === null && desligado?.origem === "banco",
  `valor=${desligado?.valor} origem=${desligado?.origem}`,
);

const linhaNula = await prisma.configuracaoDaPlataforma.findUnique({
  where: { chave: "teto.mensal.usd" },
});
check("o nulo é uma LINHA, não a ausência dela", linhaNula !== null);

/* ───────────────────── voltar ao ambiente apaga a linha ────────────────── */

retrato = await (await patch({ acao: "esquecer", chave: "teto.mensal.usd" })).json();
check(
  "voltar ao ambiente APAGA a linha, em vez de congelar o valor",
  (await prisma.configuracaoDaPlataforma.findUnique({ where: { chave: "teto.mensal.usd" } })) ===
    null,
);
check(
  "e o controle deixa de vir do banco",
  acha(retrato, "teto.mensal.usd")?.origem !== "banco",
);

/* ──────────────────────────── o freio ──────────────────────────────────── */

for (const [estado, esperado] of [
  ["convite", null],
  ["prosul", "org-prosul"],
]) {
  retrato = await (await patch({ acao: "freio", estado })).json();
  check(
    `o freio guarda o estado "${estado}"`,
    retrato.freio?.estado === estado && retrato.freio?.organizationId === esperado,
    JSON.stringify(retrato.freio),
  );
}

const semId = await patch({ acao: "freio", estado: "outra", organizationId: "  " });
check('"outro escritório" sem id é recusado, não vira PROSUL', semId.status === 400);

/* ─────────────────────────── a trilha ──────────────────────────────────── */

const acao = await prisma.acaoAdministrativa.findFirst({
  where: { acao: "escritorio-padrao" },
  orderBy: { quando: "desc" },
});
check("a mudança do freio ficou na trilha, com autor", acao?.quem === ADMIN, acao?.quem);

/* ───────────────────────────── desmontar ───────────────────────────────── */

await restaurar();
await prisma.$disconnect();

if (falhas > 0) {
  console.error(`\n${falhas} FALHA(S)`);
  process.exit(1);
}

console.log("\ncontroles provados de ponta a ponta");
