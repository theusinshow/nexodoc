import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdWorkspace } from "@/components/ld/ld-workspace";

export default async function LdPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <LdWorkspace />;
}
