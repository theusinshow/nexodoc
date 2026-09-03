/**
 * SEMEIA uma home de quem já usa o NexoDoc — só para OLHAR a disposição.
 *
 * Cinco obras em estados diferentes, porque é a variedade que revela o layout:
 * uma com achado recebido e velho (tarja de esquecimento), uma com achado
 * enviado esperando outra pessoa, uma só com auditoria e nenhuma pendência,
 * uma recém-mexida, e uma sem cidade cadastrada (a marca cinza).
 *
 * Tudo com o prefixo SIM- para a limpeza não precisar adivinhar.
 */
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");
const prisma = getPrisma();

const ORG = "org-prosul";
const EU = (process.env.NEXODOC_ADMIN_EMAILS ?? "").split(",")[0].trim().toLowerCase();
const VICTOR = "victor@prosul.com";
const CARLA = "carla@prosul.com";
const MARCA = "SIM-";

const diasAtras = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function limpar() {
  await prisma.nexoConversation.deleteMany({ where: { id: { startsWith: MARCA } } });
  await prisma.auditFeedback.deleteMany({ where: { targetKey: { startsWith: MARCA } } });
  await prisma.audit.deleteMany({ where: { title: { startsWith: MARCA } } });
  await prisma.documentArtifact.deleteMany({ where: { fileName: { startsWith: MARCA } } });
  await prisma.project.deleteMany({ where: { code: { startsWith: "SIM" } } });
}

await limpar();

if (process.argv.includes("--limpar")) {
  console.log("cena removida");
  await prisma.$disconnect();
  process.exit(0);
}

const eu = await prisma.user.findUnique({ where: { email: EU } });

// Quem recebe e quem manda precisa existir no escritório para a tela nomear.
for (const email of [VICTOR, CARLA]) {
  await prisma.organizationMember.upsert({
    where: { organizationId_email: { organizationId: ORG, email } },
    create: { organizationId: ORG, email, name: email.split("@")[0], role: "MEMBER", status: "ACTIVE" },
    update: {},
  });
}

const OBRAS = [
  { code: "SIM118-25", name: "Ginásio Municipal do Bairro Cristo Redentor", client: "CRICIÚMA", dias: 0 },
  { code: "SIM117-25", name: "Unidade Básica de Saúde da Rua São Francisco", client: "CRICIÚMA", dias: 2 },
  { code: "SIM088-25", name: "Revitalização da Feira Municipal", client: "CHAPECÓ", dias: 6 },
  { code: "SIM063-26", name: "Pavimentação da Avenida Centenário", client: "IÇARA", dias: 11 },
  { code: "SIM040-26", name: "Reforma do Centro de Convivência", client: "", dias: 19 },
];

const criadas = [];
for (const obra of OBRAS) {
  const projeto = await prisma.project.create({
    data: {
      organizationId: ORG,
      ownerEmail: EU,
      ownerId: eu?.id ?? null,
      code: obra.code,
      name: obra.name,
      client: obra.client,
      clientKey: obra.client.toLowerCase(),
      updatedAt: diasAtras(obra.dias),
    },
  });
  criadas.push({ ...obra, id: projeto.id });
}

/** Uma auditoria concluída por obra — é o que traz o projeto para a lista. */
async function auditar(projeto, achados, dias) {
  return prisma.audit.create({
    data: {
      projectId: projeto.id,
      userId: eu?.id ?? null,
      title: `${MARCA}${projeto.name}`,
      projectName: projeto.name,
      auditMode: "memorial",
      analysisLevel: dias > 7 ? "deep" : "standard",
      status: "COMPLETED",
      totalFindings: achados,
      elapsedMs: 180000 + dias * 1000,
      createdAt: diasAtras(dias),
      completedAt: diasAtras(dias),
    },
  });
}

async function pendencia(audit, { titulo, para, de, dias }) {
  await prisma.auditFeedback.create({
    data: {
      auditId: audit.id,
      targetKey: `${MARCA}finding:${Math.random().toString(36).slice(2, 8)}`,
      findingLabel: titulo,
      verdict: "CONFIRMED",
      assigneeEmail: para,
      assignedById: de === EU ? eu?.id ?? null : null,
      assignedAt: diasAtras(dias),
      createdAt: diasAtras(dias),
    },
  });
}

// 118-25 — mexida hoje, um achado RECEBIDO fresco
const a118 = await auditar(criadas[0], 6, 0);
await pendencia(a118, { titulo: "Cobertura metálica sem especificação de pintura", para: EU, de: VICTOR, dias: 0 });

// 117-25 — dois recebidos, um deles já parado há 9 dias (tarja)
const a117 = await auditar(criadas[1], 30, 2);
await pendencia(a117, { titulo: "Divergência entre memorial e planilha no item 4.2", para: EU, de: CARLA, dias: 9 });
await pendencia(a117, { titulo: "Espessura de laje ausente no capítulo de estrutura", para: EU, de: CARLA, dias: 2 });

// 088-25 — ENVIADO: está com o Victor, esperando ele
const a088 = await auditar(criadas[2], 18, 6);
await pendencia(a088, { titulo: "Rodapé da LD com a secretaria errada", para: VICTOR, de: EU, dias: 6 });
await pendencia(a088, { titulo: "Selo da prancha 12 sem data", para: VICTOR, de: EU, dias: 6 });

// 063-26 — auditada, SEM pendência (o caso que a home mostra mesmo assim)
await auditar(criadas[3], 47, 11);

// 040-26 — sem cidade, e parada há muito
const a040 = await auditar(criadas[4], 12, 19);
await pendencia(a040, { titulo: "Quantitativo de piso divergente", para: EU, de: VICTOR, dias: 19 });

/** As conversas: é delas que saem "onde você parou" e os projetos recentes. */
for (const [i, obra] of criadas.entries()) {
  const quando = diasAtras(obra.dias);
  await prisma.nexoConversation.create({
    data: {
      id: `${MARCA}conv-${i}`,
      userEmail: EU,
      title: i === 0 ? "Montagem do volume — MET" : obra.name,
      projectId: obra.id,
      folderKey: `${obra.code}-${obra.client || "SEM-CIDADE"}`,
      tipo: i % 2 === 0 ? "volume" : "auditoria",
      createdAt: quando,
      updatedAt: quando,
      data: {
        id: `${MARCA}conv-${i}`,
        title: obra.name,
        createdAt: quando.getTime(),
        updatedAt: quando.getTime(),
        results: i === 0 ? [{ kind: "volume" }, { kind: "capa" }] : [{ kind: "auditoria" }],
      },
    },
  });
}

/*
 * A SEXTA OBRA, e a razão de esta cena existir: só se montou volume nela.
 *
 * Sem auditoria e sem achado, ela não aparece em `AuditFeedback` nem em
 * `Audit` — as duas fontes que alimentavam a lista da esquerda. Ela vivia
 * exclusivamente na coluna "Trabalho recente", e foi ela que provou que as duas
 * listas da home não eram a mesma lista. Quem mexer nesta tela precisa dela na
 * frente para não apagá-la de novo.
 */
const soMontagem = await prisma.project.create({
  data: {
    organizationId: ORG, ownerEmail: EU, code: "SIM099-26",
    name: "Praça da Juventude — só montagem", client: "TUBARÃO", clientKey: "tubarao",
    updatedAt: diasAtras(3),
  },
});
await prisma.nexoConversation.create({
  data: {
    id: `${MARCA}conv-volume`, userEmail: EU, title: "Montagem do volume — HID",
    projectId: soMontagem.id, folderKey: "SIM099-26-TUBARAO", tipo: "volume",
    createdAt: diasAtras(3), updatedAt: diasAtras(3),
    data: { id: `${MARCA}conv-volume`, title: "Montagem do volume — HID",
            createdAt: diasAtras(3).getTime(), updatedAt: diasAtras(3).getTime(),
            results: [{ kind: "volume" }] },
  },
});

/** Artefatos: o que a pessoa gerou e pode querer baixar de novo. */
for (const [i, obra] of criadas.slice(0, 3).entries()) {
  await prisma.documentArtifact.create({
    data: {
      projectId: obra.id,
      userEmail: EU,
      module: "volume",
      kind: "VOLUME_PDF",
      fileName: `${MARCA}${obra.code}-volume.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 4_000_000 + i * 1_000_000,
      createdAt: diasAtras(obra.dias),
    },
  });
}

console.log("cena semeada:", criadas.length + 1, "obras (5 auditadas + 1 só montagem)");
await prisma.$disconnect();
