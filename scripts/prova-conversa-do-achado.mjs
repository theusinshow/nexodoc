// A CONVERSA DO ACHADO, provada contra o banco.
//
//   node scripts/prova-conversa-do-achado.mjs   (== npm run prova:conversa-achado)
//
// Quatro perguntas que só o banco responde:
//   1. comentar num achado NUNCA atribuído cria a linha sem inventar veredito?
//   2. envolver e desenvolver deixam rastro na conversa?
//   3. apagar o achado leva conversa e envolvidos junto?
//   4. rodar duas vezes duplica alguma coisa?
//
// SEM IA e SEM NAVEGADOR.
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const { getPrisma } = await import("../lib/db.ts");
const { comentar, envolver, desenvolver, garantirLinhaDoAchado } = await import(
  "../lib/achado-compartilhado.ts"
);

const prisma = getPrisma();
const ORG = "org-prosul";
const AUTOR = { id: null, email: "victor@prosul.com" };

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas += 1;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

/*
 * O achado tem que EXISTIR no relatório: `garantirLinhaDoAchado` recusa id que
 * não está no parecer, e é de propósito — a conversa se pendura num achado
 * real, não num id digitado errado.
 */
const audit = await prisma.audit.findFirst({
  where: { project: { organizationId: ORG }, report: { not: null } },
  select: { id: true, report: true },
});
check("existe auditoria com parecer e projeto", Boolean(audit), "rode npm run seed:dev");
if (!audit) process.exit(1);

const FINDING = audit.report.incongruencias?.[0]?.id;
check("o parecer tem ao menos um achado", Boolean(FINDING));
if (!FINDING) process.exit(1);

await prisma.auditFeedback.deleteMany({ where: { auditId: audit.id, findingId: FINDING } });

const chave = { auditId_targetKey: { auditId: audit.id, targetKey: `finding:${FINDING}` } };

// 1. Comentar num achado que ninguém atribuiu.
const linha = await comentar({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
  autor: AUTOR,
  body: "isso é do estrutural, não meu",
});

const gravada = await prisma.auditFeedback.findUnique({
  where: chave,
  select: { id: true, verdict: true, resolvedAt: true, assigneeEmail: true, fingerprint: true },
});
check("a linha do achado nasceu", Boolean(gravada));
check(
  "comentar NÃO inventa veredito nem desfecho",
  gravada?.verdict === null && gravada?.resolvedAt === null,
  JSON.stringify(gravada),
);
check("comentar NÃO atribui a ninguém", gravada?.assigneeEmail === null);
check(
  "o fingerprint foi calculado do relatório, e não aceito de fora",
  Boolean(gravada?.fingerprint),
);

// 2. Envolver e desenvolver deixam rastro.
await envolver({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
  autor: AUTOR,
  email: "carla@prosul.com",
  nome: "Carla",
});
const comEnvolvido = await prisma.auditFindingWatcher.count({ where: { feedbackId: linha.id } });
check("a Carla entrou como envolvida", comEnvolvido === 1, `achei ${comEnvolvido}`);

await desenvolver({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
  autor: AUTOR,
  email: "carla@prosul.com",
  nome: "Carla",
});
const semEnvolvido = await prisma.auditFindingWatcher.count({ where: { feedbackId: linha.id } });
check("a Carla saiu dos envolvidos", semEnvolvido === 0, `achei ${semEnvolvido}`);

const kinds = (
  await prisma.auditFindingMessage.findMany({
    where: { feedbackId: linha.id },
    orderBy: { createdAt: "asc" },
    select: { kind: true },
  })
).map((m) => m.kind);
check(
  "sair dos envolvidos NÃO apaga o histórico de ter entrado",
  kinds.join(",") === "comentario,envolveu,desenvolveu",
  kinds.join(","),
);

// 3. Idempotência do `garantirLinhaDoAchado`.
const denovo = await garantirLinhaDoAchado({
  auditId: audit.id,
  findingId: FINDING,
  organizationId: ORG,
});
check("garantir a linha duas vezes devolve a MESMA", denovo.id === linha.id);
const quantas = await prisma.auditFeedback.count({
  where: { auditId: audit.id, findingId: FINDING },
});
check("existe UMA linha para o achado", quantas === 1, `achei ${quantas}`);

// 4. Cascade.
await prisma.auditFeedback.delete({ where: { id: linha.id } });
const msgs = await prisma.auditFindingMessage.count({ where: { feedbackId: linha.id } });
const wat = await prisma.auditFindingWatcher.count({ where: { feedbackId: linha.id } });
check("apagar o achado leva a conversa junto", msgs === 0, `sobraram ${msgs}`);
check("apagar o achado leva os envolvidos junto", wat === 0, `sobraram ${wat}`);

console.log(falhas === 0 ? "\nprova passou" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
