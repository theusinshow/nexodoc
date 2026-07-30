import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdHistoryWorkspace } from "@/components/ld/ld-history-workspace";
import { getUserAccess } from "@/lib/access-control";
import { redirectToLogin } from "@/lib/auth-redirect";

export default async function LdHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirectToLogin("/ld/historico");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/sem-acesso");
  }

  return <LdHistoryWorkspace userName={session.user.name ?? "Usuário"} isAdmin={access.isAdmin} />;
}
