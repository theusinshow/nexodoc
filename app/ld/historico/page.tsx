import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdHistoryWorkspace } from "@/components/ld/ld-history-workspace";

export default async function LdHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <LdHistoryWorkspace userName={session.user.name ?? "Usuário"} />;
}
