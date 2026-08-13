import { NextResponse } from "next/server";

import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { projetoDaAuditoria, tituloDaAuditoria } from "@/lib/audit-identity";
import { getAiConfiguration, getLastProviderFailures } from "@/lib/ai-providers";
import { carregarCotacao } from "@/lib/cambio-config";
import { statusDoSistema } from "@/lib/status-do-sistema";

export const runtime = "nodejs";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function ensureAdmin(request: Request) {
  const adminToken = process.env.NEXODOC_ADMIN_TOKEN?.trim();

  if (!adminToken) return jsonError("NEXODOC_ADMIN_TOKEN não configurado.", 500);
  if (getBearerToken(request) !== adminToken) return jsonError("Acesso admin negado.", 401);
  if (!isDatabaseConfigured()) return jsonError("DATABASE_URL não configurada.", 500);

  return null;
}

function sinceDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export async function GET(request: Request) {
  const adminError = ensureAdmin(request);
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
   * As 24h saem de duas contagens novas; o gasto do mês, da soma do consumo
   * gravado. `estimatedCostUsd` pode ser nulo por evento, e a soma devolve null
   * quando não há evento nenhum — que é diferente de zero e chega assim na
   * linha, de propósito.
   */
  const ultimasVinteQuatro = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const [auditorias24h, auditoriasFalhadas24h, consumoDoMes, cotacao] = await Promise.all([
    prisma.audit.count({ where: { createdAt: { gte: ultimasVinteQuatro } } }),
    prisma.audit.count({
      where: { status: "FAILED", createdAt: { gte: ultimasVinteQuatro } },
    }),
    prisma.aiUsageEvent.aggregate({
      _sum: { estimatedCostUsd: true },
      where: { createdAt: { gte: inicioDoMes } },
    }),
    carregarCotacao(),
  ]);

  const ai = getAiConfiguration();
  /*
   * Os fluxos que hoje existem. Havia um `ldExtraction.fallback` aqui até a
   * `main` unificar o provedor ("o software passa a ter um provedor só, e os
   * dois que sobravam já estavam mortos") — contar um fluxo morto faria o
   * veredito acusar chave faltando para sempre.
   */
  const fluxos = [ai.audit, ai.auditChat, ai.ldExtraction.primary];
  const status = statusDoSistema(
    {
      fluxosComChave: fluxos.filter((fluxo) => fluxo.keyConfigured).length,
      fluxosTotais: fluxos.length,
      databaseConfigured: true,
      auditorias24h,
      auditoriasFalhadas24h,
      falhasDeProvedor: getLastProviderFailures().length,
      gastoDoMesUsd: consumoDoMes._sum.estimatedCostUsd ?? null,
    },
    cotacao,
  );

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
