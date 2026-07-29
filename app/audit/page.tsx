import { redirect } from "next/navigation";

/**
 * `/audit` foi APOSENTADA — a auditoria mora no Nexo.
 *
 * Durante um tempo houve duas telas para o mesmo motor, e elas divergiram: a de
 * cá nunca ganhou progresso real, cancelar, gabarito completo nem retomada
 * depois de um F5. Manter as duas significava que metade dos clientes veria a
 * versão pior por acidente de link antigo.
 *
 * O redirecionamento preserva `?project=`: quem chegar por um link salvo cai no
 * lugar certo em vez de numa página que some. O HISTÓRICO não se perde — as
 * auditorias continuam no banco, e o painel administrativo (`/admin/audits`)
 * segue listando tudo.
 *
 * O componente de relatório (`components/audit-result`) NÃO era exclusivo desta
 * página: é o mesmo que o palco do Nexo monta. Por isso aposentar aqui não custa
 * o visor de PDF, a matriz por disciplina nem as camadas de confiança.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project } = await searchParams;
  redirect(project ? `/nexo?project=${encodeURIComponent(project)}` : "/nexo");
}
