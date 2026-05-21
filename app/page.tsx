import { ChatWindow } from "@/components/chat-window";

export default function Home() {
  const isMockMode =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXODOC_MOCK_MODE === "true";

  return <ChatWindow isMockMode={isMockMode} />;
}
