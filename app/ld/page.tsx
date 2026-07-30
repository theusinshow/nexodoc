import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LdWorkspace } from "@/components/ld/ld-workspace";
import { getUserAccess } from "@/lib/access-control";
import { buildCallbackPath, redirectToLogin } from "@/lib/auth-redirect";
import { getProjectContextForUser } from "@/lib/project-context";

export default async function LdPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; project?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user) {
    redirectToLogin(buildCallbackPath("/ld", params));
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/sem-acesso");
  }

  const { draft, project } = params;
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
