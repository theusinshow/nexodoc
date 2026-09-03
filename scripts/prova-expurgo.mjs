// O EXPURGO, de ponta a ponta — contra o banco e contra as rotas de verdade.
//
//   node scripts/prova-expurgo.mjs   (== npm run prova:expurgo)
//
// As regras puras já estão provadas em `npm run test:expurgo`. O que ELAS não
// alcançam é justamente o que mais assusta aqui: se o `deleteMany` leva mesmo
// os cascades, se o `StoredFile` compartilhado sobrevive, e se a lápide chega
// ao cliente e fecha a corrida do re-upload. Isso só se prova com banco.
//
// A CENA É MONTADA E DESMONTADA por esta prova. Ela cria uma obra "999-99" com
// conversa, auditoria, achado, arquivo guardado — e uma SEGUNDA obra que
// aponta para o MESMO checksum, que é o caso que o expurgo não pode quebrar.
//
// Sem navegador: são chamadas HTTP com um pote de cookies à mão. O token admin
// vem do ambiente e nunca é impresso.
//
// Exige `NEXODOC_DEV_AUTH=true`, `NEXODOC_ADMIN_TOKEN` e o servidor de pé.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const ORG = "org-prosul";
const ADMIN = (process.env.NEXODOC_ADMIN_EMAILS ?? "").split(",")[0].trim().toLowerCase();
const TOKEN = process.env.NEXODOC_ADMIN_TOKEN?.trim() ?? "";

// Prefixo de tudo que esta prova cria, para a limpeza não ter que adivinhar.
const MARCA = "prova-expurgo";
const CHECKSUM = "0".repeat(60) + "cafe";
const CONVERSA = `${MARCA}-conversa`;

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

/* ─────────────────────────── a limpeza, dos dois lados ─────────────────── */

async function limpar() {
  await prisma.nexoConversation.deleteMany({ where: { id: { startsWith: MARCA } } });
  await prisma.conversaExpurgada.deleteMany({ where: { id: { startsWith: MARCA } } });
  await prisma.audit.deleteMany({ where: { title: { startsWith: MARCA } } });
  await prisma.projectUpload.deleteMany({ where: { fileName: { startsWith: MARCA } } });
  await prisma.storedFile.deleteMany({ where: { checksumSha256: CHECKSUM } });
  await prisma.project.deleteMany({ where: { code: { startsWith: "999-9" } } });
  await prisma.acaoAdministrativa.deleteMany({
    where: { alcance: { startsWith: "obra:" }, resumo: { path: ["rotulo"], string_contains: MARCA } },
  });
}

await limpar();

/* ─────────────────────────────── a cena ────────────────────────────────── */

const obra = await prisma.project.create({
  data: {
    organizationId: ORG,
    ownerEmail: ADMIN,
    code: "999-99",
    name: `${MARCA} obra alvo`,
  },
});

// A obra VIZINHA, que aponta para o mesmo arquivo. É ela que prova que os bytes
// compartilhados não morrem junto.
const vizinha = await prisma.project.create({
  data: {
    organizationId: ORG,
    ownerEmail: ADMIN,
    code: "999-98",
    name: `${MARCA} obra vizinha`,
  },
});

await prisma.storedFile.create({
  data: {
    checksumSha256: CHECKSUM,
    organizationId: ORG,
    mimeType: "application/pdf",
    sizeBytes: 12345,
    bytes: Buffer.from("memorial de mentira"),
  },
});

const auditoria = await prisma.audit.create({
  data: {
    projectId: obra.id,
    title: `${MARCA} memorial`,
    projectName: obra.name,
    auditMode: "memorial",
    status: "COMPLETED",
    totalFindings: 1,
  },
});

await prisma.auditFile.create({
  data: {
    auditId: auditoria.id,
    fileName: `${MARCA}.pdf`,
    documentType: "memorial",
    checksumSha256: CHECKSUM,
  },
});

await prisma.auditFeedback.create({
  data: { auditId: auditoria.id, targetKey: "finding:INC-001", verdict: "CONFIRMED" },
});

const agora = new Date();
await prisma.nexoConversation.create({
  data: {
    id: CONVERSA,
    userEmail: ADMIN,
    title: `${MARCA} montagem`,
    projectId: obra.id,
    createdAt: agora,
    updatedAt: agora,
    tipo: "auditoria",
    data: {
      id: CONVERSA,
      title: `${MARCA} montagem`,
      createdAt: agora.getTime(),
      updatedAt: agora.getTime(),
      auditorias: [{ auditId: auditoria.id, artifactId: "art-1" }],
    },
  },
});

/* ───────────────────────────── entrar como admin ───────────────────────── */

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

const { csrfToken } = await (await pedir("/api/auth/csrf")).json();
await pedir("/api/auth/callback/nexodoc-dev", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ csrfToken, email: ADMIN, json: "true", redirect: "false" }),
});

const sessao = await (await pedir("/api/auth/session")).json();
if (sessao?.user?.email !== ADMIN) {
  console.error("\nFALHOU  expurgo :: sem sessão de admin não há o que medir");
  await limpar();
  await prisma.$disconnect();
  process.exit(1);
}

console.log("expurgo, ponta a ponta\n");

/* ──────────────────────────── a lista e a prévia ───────────────────────── */

const lista = await (await pedir("/api/admin/dados", { headers: comToken() })).json();
const naLista = (lista.conversas ?? []).find((c) => c.id === CONVERSA);
check("a conversa aparece na tela de Dados", Boolean(naLista));
check(
  "com o rótulo legível da obra, não o id do projeto",
  naLista?.rotulo === `999-99 · ${MARCA} obra alvo`,
  naLista?.rotulo,
);

const alcance = { tipo: "obra", chave: obra.id };

const previa = (
  await (
    await pedir("/api/admin/dados/previa", {
      method: "POST",
      headers: comToken({ "content-type": "application/json" }),
      body: JSON.stringify({ alcance }),
    })
  ).json()
).previa;

check("a prévia conta a conversa", previa?.conversas === 1, previa?.conversas);
check("a prévia conta a auditoria", previa?.auditorias === 1, previa?.auditorias);
check("a prévia conta o achado", previa?.achados === 1, previa?.achados);
// SOZINHO, o arquivo morre — é o único que aponta para aqueles bytes.
check(
  "sozinha, a obra leva os bytes junto",
  previa?.arquivos === 1 && previa?.bytes === 12345,
  `arquivos=${previa?.arquivos} bytes=${previa?.bytes}`,
);

/* ───────── o arquivo compartilhado: a regra que não pode quebrar ───────── */

// A vizinha aponta para o MESMO checksum. Enquanto ela existir, os bytes ficam.
await prisma.projectUpload.create({
  data: {
    projectId: vizinha.id,
    userEmail: ADMIN,
    module: "auditoria",
    fileName: `${MARCA}-vizinha.pdf`,
    mimeType: "application/pdf",
    checksumSha256: CHECKSUM,
  },
});

const previaComVizinha = (
  await (
    await pedir("/api/admin/dados/previa", {
      method: "POST",
      headers: comToken({ "content-type": "application/json" }),
      body: JSON.stringify({ alcance }),
    })
  ).json()
).previa;

// E o outro sentido, que é o que impede o acidente: assim que ALGUÉM MAIS
// aponta para o mesmo conteúdo, a prévia para de prometer apagá-lo.
check(
  "com a vizinha apontando, a prévia para de prometer os bytes",
  previaComVizinha?.arquivos === 0 && previaComVizinha?.bytes === 0,
  `arquivos=${previaComVizinha?.arquivos} bytes=${previaComVizinha?.bytes}`,
);

/* ──────────────────────────── a confirmação ────────────────────────────── */

const recusado = await pedir("/api/admin/dados/expurgo", {
  method: "POST",
  headers: comToken({ "content-type": "application/json" }),
  body: JSON.stringify({ alcance, rotulo: naLista?.rotulo, confirmacao: "CONFIRMAR" }),
});
check("a palavra errada é recusada pelo SERVIDOR, não só pela tela", recusado.status === 400);

const aindaViva = await prisma.nexoConversation.findUnique({ where: { id: CONVERSA } });
check("e nada foi apagado na recusa", Boolean(aindaViva));

/* ───────────────────────────── o expurgo ───────────────────────────────── */

const feito = await pedir("/api/admin/dados/expurgo", {
  method: "POST",
  headers: comToken({ "content-type": "application/json" }),
  // Sem acento e em caixa baixa: a confirmação não pode depender de digitação
  // perfeita, e a regra normaliza os dois lados.
  body: JSON.stringify({ alcance, rotulo: naLista?.rotulo, confirmacao: `999-99 · ${MARCA} obra alvo`.toLowerCase() }),
});
check("o expurgo executa com a palavra do alvo", feito.status === 200, String(feito.status));

check(
  "a conversa saiu do banco",
  (await prisma.nexoConversation.findUnique({ where: { id: CONVERSA } })) === null,
);
check(
  "a auditoria saiu",
  (await prisma.audit.findUnique({ where: { id: auditoria.id } })) === null,
);
check(
  "o achado saiu junto, por cascade — ninguém o apagou à mão",
  (await prisma.auditFeedback.count({ where: { auditId: auditoria.id } })) === 0,
);
check(
  "O ARQUIVO COMPARTILHADO SOBREVIVEU: a obra vizinha ainda o usa",
  (await prisma.storedFile.findUnique({ where: { checksumSha256: CHECKSUM } })) !== null,
);

/* ──────────────────────── a lápide e a trilha ──────────────────────────── */

const lapide = await prisma.conversaExpurgada.findUnique({ where: { id: CONVERSA } });
check("a lápide foi gravada, com autor", lapide?.expurgadaPor === ADMIN, lapide?.expurgadaPor);

const acao = await prisma.acaoAdministrativa.findFirst({
  where: { acao: "expurgo", alcance: `obra:${obra.id}` },
  orderBy: { quando: "desc" },
});
check("a trilha registrou quem mandou", acao?.quem === ADMIN, acao?.quem);

/* ─────────── a lápide chega ao cliente, e fecha a corrida ──────────────── */

const conversas = await (await pedir("/api/nexo/conversas")).json();
check(
  "a lápide viaja junto da lista de conversas",
  (conversas.expurgadas ?? []).includes(CONVERSA),
  JSON.stringify(conversas.expurgadas ?? []),
);

// O re-upload que desfazia o expurgo em silêncio.
const reSubida = await pedir("/api/nexo/conversas", {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    id: CONVERSA,
    title: `${MARCA} montagem`,
    createdAt: agora.getTime(),
    updatedAt: Date.now(),
  }),
});
check("re-subir a conversa expurgada é recusado com 410", reSubida.status === 410, String(reSubida.status));
check(
  "e ela continua fora do banco",
  (await prisma.nexoConversation.findUnique({ where: { id: CONVERSA } })) === null,
);

/* ───────────────────────────── desmontar ───────────────────────────────── */

await limpar();
await prisma.$disconnect();

if (falhas > 0) {
  console.error(`\n${falhas} FALHA(S)`);
  process.exit(1);
}

console.log("\nexpurgo provado de ponta a ponta");
