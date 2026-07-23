"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
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
 * Chat do agente Nexo — caixa delimitada (log + composer docado), sem cabeçalho
 * próprio: a identidade (orb + saudação) vive acima, no NexoCopilot. O usuário
 * conversa; o agente devolve PROPOSTAS como `ConfirmationCard` READ-ONLY (C1). A
 * geração — irreversível — só no clique "Confirmar e gerar". Correção reabre o
 * slot em conversa (chips `alterar` via ComposerController).
 *
 * `onSend` avisa o dono do shell no 1º envio (latcheia `started`). O
 * `ComposerControllerProvider` vive acima (NexoWorkspace).
 */
export function NexoChat({
  selos,
  onSend,
  onAttach,
}: {
  selos: SeloForLd[];
  onSend?: () => void;
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-md border border-border bg-card">
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversa com o Nexo"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
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

      <div className="border-t border-border p-3">
        <NexoComposer
          variant="docked"
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
