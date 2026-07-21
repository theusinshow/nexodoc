import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";
import { isNexoEnabled } from "@/lib/feature-flags";
import { PageHeader } from "@/components/layout/page-header";
import { NexoWorkspace } from "@/modules/nexo";

export default async function NexoPage() {
  // Kill-switch: com a flag desligada, a rota nem existe pro usuario.
  if (!isNexoEnabled()) {
    redirect("/");
  }

  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/nexo");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <PageHeader
        backHref="/"
        title="Nexo"
        description="Assistente que orquestra LD, capas, volume e auditoria a partir dos PDFs do projeto. Em construcao: hoje aceita os arquivos; o agente chega na proxima fase."
      />
      <NexoWorkspace />
    </div>
  );
}
