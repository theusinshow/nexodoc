"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Waypoints, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { NexoAgentProposal, NexoAgentTurn, NexoSlotRequest } from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { useRegisterComposer } from "../state/composer-controller";
import {
  ConfirmationCard,
  type LdPreviewData,
  type NexoTemplateOption,
} from "./ConfirmationCard";
import { QuickReplyChips } from "./QuickReplyChips";
import { NexoComposer } from "./NexoComposer";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposals?: NexoAgentProposal[];
  /** Pedido de slot do turno (§3): pré-respostas renderizam abaixo da bolha. */
  slotRequest?: NexoSlotRequest;
  ldPreview?: LdPreviewData;
}

/**
 * Chat do agente Nexo. O usuário conversa; o agente afirma os fatos dos selos e
 * devolve PROPOSTAS que renderizam como `ConfirmationCard` READ-ONLY (C1) — nunca
 * formulário. A geração — passo irreversível — só acontece ao clicar "Confirmar e
 * gerar" no card, que chama a rota determinística. Corrigir reabre o slot em
 * conversa (chips `alterar`, que escrevem no composer via ComposerController).
 *
 * O `ComposerControllerProvider` vive ACIMA (no NexoShell/NexoWorkspace), para os
 * SuggestionCards do welcome também alcançarem o composer. `onSend` avisa o dono
 * do shell no primeiro envio, latcheando `started` (welcome→active).
 */
export function NexoChat({
  selos,
  onSend,
  variant = "docked",
  onAttach,
}: {
  selos: SeloForLd[];
  onSend?: () => void;
  /** `hero` no welcome (só o composer visível); `docked` na conversa. */
  variant?: "hero" | "docked";
  onAttach?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NexoTemplateOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const registerComposer = useRegisterComposer();
  const isHero = variant === "hero";

  useEffect(() => {
    fetch("/api/capas/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    // Primeiro envio latcheia o shell (welcome→active). Idempotente no dono.
    onSend?.();
    setError(null);
    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/nexo/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, selos }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; turn?: NexoAgentTurn; ldPreview?: LdPreviewData }
        | null;
      if (!res.ok || !payload?.turn) {
        throw new Error(payload?.error ?? "Falha ao conversar com o Nexo.");
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: payload.turn!.reply,
          proposals: payload.turn!.proposals,
          slotRequest: payload.turn!.slotRequest,
          ldPreview: payload.ldPreview,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conversa.");
    } finally {
      setBusy(false);
    }
  }

  // Publica os controles reais do composer para os chips (fill/send/focus). Sem
  // deps → re-registra a cada render, sempre com o `send`/`setInput` mais novos.
  useEffect(() => {
    registerComposer({
      fill: (text) => {
        setInput(text);
        // Foca e leva o cursor ao FIM (as frases dos chips "alterar" são
        // andaimes que o usuário completa — selecionar tudo apagaria o andaime).
        requestAnimationFrame(() => {
          const el = inputRef.current;
          if (!el) return;
          el.focus();
          const n = el.value.length;
          el.setSelectionRange(n, n);
        });
      },
      send: (text) => void send(text),
      focus: () => inputRef.current?.focus(),
    });
    return () => registerComposer(null);
  });

  const semSelos = selos.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col",
        variant === "docked"
          ? "min-h-[280px] rounded-md border border-border bg-card"
          : "gap-3",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between border-b border-border px-4 py-3",
          isHero && "hidden",
        )}
      >
        <div className="flex items-center gap-2">
          <Waypoints className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="font-mono text-xs font-medium uppercase tracking-[0.05em] text-muted-foreground">
            Conversa
          </span>
        </div>
        <Badge variant="warning">Beta</Badge>
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversa com o Nexo"
        className={cn(
          "flex-1 space-y-3 overflow-y-auto px-4 py-4",
          isHero && "hidden",
        )}
      >
        {messages.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            label="Converse com o Nexo"
            description={
              semSelos
                ? "Anexe as pranchas de uma disciplina e peça, por exemplo: “cria a LD e a capa dessas pranchas”."
                : "Selos lidos. Peça, por exemplo: “gera a LD e a capa da Prefeitura de Chapecó”."
            }
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className="space-y-2">
              <MessageBubble role={m.role} content={m.content} />
              {m.proposals?.map((p, i) => (
                <ConfirmationCard
                  key={`${m.id}-${i}`}
                  proposal={p}
                  selos={selos}
                  templates={templates}
                  ldPreview={m.ldPreview}
                />
              ))}
              {m.slotRequest && (
                <QuickReplyChips suggestions={m.slotRequest.suggestions} />
              )}
            </div>
          ))
        )}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Pensando…
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="border-t border-border px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className={cn(variant === "docked" && "border-t border-border p-3")}>
        <NexoComposer
          variant={variant}
          value={input}
          onChange={setInput}
          onSubmit={() => void send()}
          busy={busy}
          onAttach={onAttach}
          inputRef={inputRef}
        />
      </div>
    </div>
  );
}

function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-md rounded-br-sm bg-primary/10 px-3 py-2 text-sm"
            : "nexo-glass nexo-glass--weak max-w-[85%] whitespace-pre-wrap rounded-md rounded-bl-sm px-3 py-2 text-sm"
        }
      >
        <span className="sr-only">{isUser ? "Você" : "Nexo"}: </span>
        {content}
      </div>
    </div>
  );
}
