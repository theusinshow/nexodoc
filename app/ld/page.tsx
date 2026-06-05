import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdWorkspace } from "@/components/ld/ld-workspace";
import { getUserAccess } from "@/lib/access-control";
import { getProjectContextForUser } from "@/lib/project-context";

export default async function LdPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; project?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  const { draft, project } = await searchParams;
  const projectContext = await getProjectContextForUser(project, session.user);

  return (
    <LdWorkspace
      initialDraftId={draft}
      projectId={project}
      projectContext={projectContext}
      isAdmin={access.isAdmin}
    />
  );
}
