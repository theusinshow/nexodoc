import { cn } from "@/lib/utils";

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
};

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cn(
          "max-w-[min(760px,100%)] rounded-lg border px-4 py-3 text-sm leading-6 shadow-[var(--shadow-panel)]",
          isUser
            ? "border-primary/40 bg-primary text-primary-foreground"
            : "border-border bg-card text-card-foreground",
        )}
      >
        <pre className="whitespace-pre-wrap break-words font-sans">{content}</pre>
      </article>
    </div>
  );
}
