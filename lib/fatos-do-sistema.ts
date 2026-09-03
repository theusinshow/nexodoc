/**
 * OS FATOS QUE O VEREDITO CONSOME, num lugar só.
 *
 * `statusDoSistema` é puro e continua sendo — ele recebe fatos e devolve
 * julgamento. Quem os COLETAVA era o corpo de `/api/admin/overview`, inline, e
 * isso bastava enquanto o veredito aparecia numa tela só.
 *
 * Deixou de bastar quando o trilho passou a mostrá-lo em todas: ou a coleta
 * saía dali, ou o trilho chamaria a rota de visão geral inteira — dez contagens
 * e uma lista de auditorias — para desenhar uma linha de texto.
 *
 * O CUSTO É CONHECIDO: quatro contagens, uma soma e a cotação. É o mínimo que o
 * veredito precisa, e é por isso que a rota `/api/admin/status` pode ser
 * chamada em toda navegação sem pesar.
 */
import { getLastProviderFailures, getAiConfiguration } from "@/lib/ai-providers";
import { carregarCotacao } from "@/lib/cambio-config";
import { getPrisma, isDatabaseConfigured } from "@/lib/db";
import { statusDoSistema, type StatusDoSistema } from "@/lib/status-do-sistema";

export async function coletarStatusDoSistema(): Promise<StatusDoSistema> {
  const ultimasVinteQuatro = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const prisma = getPrisma();
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
   * `main` unificar o provedor — contar um fluxo morto faria o veredito acusar
   * chave faltando para sempre.
   */
  const fluxos = [ai.audit, ai.auditChat, ai.ldExtraction.primary];

  return statusDoSistema(
    {
      fluxosComChave: fluxos.filter((fluxo) => fluxo.keyConfigured).length,
      fluxosTotais: fluxos.length,
      databaseConfigured: isDatabaseConfigured(),
      auditorias24h,
      auditoriasFalhadas24h,
      falhasDeProvedor: getLastProviderFailures().length,
      gastoDoMesUsd: consumoDoMes._sum.estimatedCostUsd ?? null,
    },
    cotacao,
  );
}
