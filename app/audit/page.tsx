import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ChatWindow } from "@/components/chat-window";
import { isAdminEmail } from "@/lib/access-control";

export default async function AuditPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const isMockMode = process.env.NEXODOC_MOCK_MODE === "true";
  const allowDemoMode =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true" ||
    isMockMode;

  return (
    <ChatWindow
      isMockMode={isMockMode}
      allowDemoMode={allowDemoMode}
      isAdmin={isAdminEmail(session.user.email)}
      userName={session.user.name}
      userEmail={session.user.email}
      userImage={session.user.image}
    />
  );
}
