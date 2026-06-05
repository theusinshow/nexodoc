import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ChatWindow } from "@/components/chat-window";
import { getUserAccess } from "@/lib/access-control";
import { getProjectContextForUser } from "@/lib/project-context";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive) {
    redirect("/login");
  }

  const isMockMode = process.env.NEXODOC_MOCK_MODE === "true";
  const allowDemoMode =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true" ||
    isMockMode;
  const { project } = await searchParams;
  const projectContext = await getProjectContextForUser(project, session.user);

  return (
    <ChatWindow
      isMockMode={isMockMode}
      allowDemoMode={allowDemoMode}
      isAdmin={access.isAdmin}
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image}
      projectId={project}
      projectContext={projectContext}
    />
  );
}
