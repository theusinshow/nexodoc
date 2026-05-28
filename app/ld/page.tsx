import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdWorkspace } from "@/components/ld/ld-workspace";
import { getUserAccess } from "@/lib/access-control";

export default async function LdPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  const { draft } = await searchParams;

  return <LdWorkspace initialDraftId={draft} isAdmin={access.isAdmin} />;
}
