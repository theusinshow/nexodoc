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
          "max-w-[min(760px,100%)] rounded-lg border px-4 py-3 text-sm leading-6 shadow-[var(--shadow-subtle)]",
          isUser
            ? "border-primary/35 bg-primary/90 text-primary-foreground"
            : "border-border bg-card/85 text-card-foreground",
        )}
      >
        <pre className="whitespace-pre-wrap break-words font-sans">{content}</pre>
      </article>
    </div>
  );
}
