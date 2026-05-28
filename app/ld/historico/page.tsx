import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdHistoryWorkspace } from "@/components/ld/ld-history-workspace";
import { getUserAccess } from "@/lib/access-control";

export default async function LdHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  return <LdHistoryWorkspace userName={session.user.name ?? "Usuário"} />;
}
