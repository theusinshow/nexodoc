import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdWorkspace } from "@/components/ld/ld-workspace";

export default async function LdPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { draft } = await searchParams;

  return <LdWorkspace initialDraftId={draft} />;
}
