import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { projetoDaAuditoria, tituloDaAuditoria } from "@/lib/audit-identity";
import { coletarStatusDoSistema } from "@/lib/fatos-do-sistema";
import { checkAdminRequest } from "@/lib/admin-gate";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

async function ensureAdmin(request: Request) {
  /*
   * O PORTAO DE PLATAFORMA + o token, em [[lib/admin-gate.ts]]. Antes daqui a
   * checagem era so o Bearer: quem tivesse o token entrava sem sessao alguma.
   */
  const portao = await checkAdminRequest(request);

  return portao.ok ? null : jsonError(portao.message, portao.status);
}

function sinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function GET(request: Request) {
  const adminError = await ensureAdmin(request);
  if (adminError) return adminError;

  const prisma = getPrisma();
  const lastSevenDays = sinceDate(7);
  const [
    users,
    activeUsers,
    admins,
    audits,
    failedAudits,
    recentAudits,
    ldDrafts,
    generatedLds,
    recentLds,
    ldEvents,
    recentLdEvents,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
    prisma.audit.count(),
    prisma.audit.count({ where: { status: "FAILED" } }),
    prisma.audit.count({ where: { createdAt: { gte: lastSevenDays } } }),
    prisma.ldDraft.count(),
    prisma.ldDraft.count({ where: { status: "GENERATED" } }),
    prisma.ldDraft.count({ where: { updatedAt: { gte: lastSevenDays } } }),
    prisma.ldDraftEvent.count(),
    /*
     * O cartao "Eventos LD" mostrava o total historico com o detalhe "N LD(s)
     * recentes" embaixo — dois numeros sem relacao colados, e a tela lia como
     * contradicao: "600 eventos · 0 recentes". Cada detalhe tem que qualificar
     * o numero que esta em cima dele.
     */
    prisma.ldDraftEvent.count({ where: { createdAt: { gte: lastSevenDays } } }),
  ]);
  const latestAudits = await prisma.audit.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      projectName: true,
      status: true,
      auditMode: true,
      analysisLevel: true,
      createdAt: true,
      totalFindings: true,
      // O relatório entra só para NOMEAR auditoria antiga, gravada antes de o
      // Nexo enviar identidade. Sem ele, o histórico é uma lista de "sem
      // identificação" — inútil para o que o histórico existe.
      report: true,
    },
  });
  const latestLds = await prisma.ldDraft.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      projectCode: true,
      workName: true,
      status: true,
      userEmail: true,
      uploadedFileCount: true,
      updatedAt: true,
    },
  });

  /*
   * A LINHA DE STATUS (A.4). Substitui a 2.24, que queria trocar cartão por
   * tabela — rearranjo. O que faltava na home era veredito, não layout.
   *
   * A COLETA MORA EM [[lib/fatos-do-sistema.ts]] desde que o trilho passou a
   * mostrar o veredito em toda tela: duas coletas separadas dariam, mais cedo
   * ou mais tarde, dois vereditos diferentes na mesma tela.
   */
  const status = await coletarStatusDoSistema();

  return NextResponse.json({
    status,
    totals: {
      users,
      activeUsers,
      admins,
      audits,
      failedAudits,
      recentAudits,
      ldDrafts,
      generatedLds,
      recentLds,
      ldEvents,
      recentLdEvents,
    },
    latestAudits: latestAudits.map(({ report, ...audit }) => ({
      ...audit,
      // Resolvido no servidor para que todo consumidor veja o mesmo nome, e o
      // `report` inteiro (que é grande) não viaje até a tela só por causa disso.
      title: tituloDaAuditoria({ title: audit.title, report }),
      projectName: projetoDaAuditoria({ projectName: audit.projectName, report }),
      createdAt: audit.createdAt.toISOString(),
    })),
    latestLds: latestLds.map((ld) => ({
      ...ld,
      updatedAt: ld.updatedAt.toISOString(),
    })),
    generatedAt: new Date().toISOString(),
  });
}
