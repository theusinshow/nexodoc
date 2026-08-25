import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { buildCallbackPath, redirectToLogin } from "@/lib/auth-redirect";
import { isNexoEnabled } from "@/lib/feature-flags";
import { NexoWorkspace } from "@/modules/nexo";

export default async function NexoPage({
  searchParams,
}: {
  searchParams: Promise<{ auditoria?: string; conversa?: string; projeto?: string }>;
}) {
  // Kill-switch: com a flag desligada, a rota nem existe pro usuario.
  if (!isNexoEnabled()) {
    redirect("/");
  }

  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    /*
     * O DESTINO INTEIRO, e não só `/nexo`.
     *
     * Esta linha era `redirectToLogin("/nexo")`, e a query morria no caminho:
     * quem chegava em `/nexo?auditoria=xyz` sem sessão voltava do login no Nexo
     * GENÉRICO, sem o parecer que foi buscar. Ninguém notava, porque quem já
     * estava logado nunca passava por aqui.
     *
     * Passou a importar quando o aviso por e-mail ([[lib/aviso-de-achados]])
     * começou a mandar exatamente esse endereço para gente que NUNCA ENTROU no
     * sistema — a pessoa para quem o link é a única forma de encontrar o
     * trabalho é justamente a que sempre cai no login primeiro. O e-mail
     * prometia um parecer e entregava uma tela vazia.
     *
     * `buildCallbackPath` é o que o `/volumes` já usava para o mesmo problema.
     */
    redirectToLogin(buildCallbackPath("/nexo", params));
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/sem-acesso");
  }

  // Full-bleed: o NexoWorkspace gerencia o próprio layout de 3 colunas full-height
  // (sidebar | stage | copiloto). O resto do software (Projetos, admin,
  // ferramentas antigas) mora no rodapé da sidebar — esta é a entrada.
  // O nome vem da SESSÃO (servidor): a saudação da entrada usa o primeiro, e o
  // bloco da conta (rodapé da barra lateral) usa nome + e-mail.
  return (
    <NexoWorkspace
      isAdmin={access.isAdmin}
      nome={session.user.name}
      email={session.user.email}
    />
  );
}
