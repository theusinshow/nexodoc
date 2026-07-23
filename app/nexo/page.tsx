import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";
import { isNexoEnabled } from "@/lib/feature-flags";
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

  // Full-bleed: o NexoWorkspace gerencia o próprio layout de 3 colunas full-height
  // (sidebar | stage | copiloto). O "voltar" mora na sidebar.
  return <NexoWorkspace />;
}
