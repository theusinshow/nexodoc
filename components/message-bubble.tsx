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
          "max-w-[min(760px,100%)] rounded-md border px-4 py-3 text-sm leading-6",
          isUser
            ? "border-primary/20 bg-primary/8 text-foreground"
            : "border-border bg-card text-card-foreground",
        )}
      >
        <pre className="whitespace-pre-wrap break-words font-sans">{content}</pre>
      </article>
    </div>
  );
}
