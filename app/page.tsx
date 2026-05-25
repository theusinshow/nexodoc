import { ChatWindow } from "@/components/chat-window";

export default function Home() {
  const isMockMode = process.env.NEXODOC_MOCK_MODE === "true";
  const allowDemoMode =
    process.env.NODE_ENV !== "production" ||
    process.env.NEXODOC_ALLOW_CLIENT_DEMO === "true" ||
    isMockMode;

  return <ChatWindow isMockMode={isMockMode} allowDemoMode={allowDemoMode} />;
}
