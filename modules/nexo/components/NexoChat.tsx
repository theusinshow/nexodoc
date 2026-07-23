"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { NexoOrb } from "./NexoOrb";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  proposals?: NexoAgentProposal[];
  slotRequest?: NexoSlotRequest;
  ldPreview?: LdPreviewData;
}

/** Status da leitura de selos (mostrado acima do composer). */
export interface ReadStatus {
  text: string;
  busy: boolean;
}

/**
 * Chat do Nexo — coluna única centralizada, estilo ChatGPT (largura de leitura,
 * greeting no vazio, composer fixo embaixo). O agente devolve PROPOSTAS que
 * renderizam como `ConfirmationCard` READ-ONLY (C1); a geração — irreversível —
 * só no clique. Correção reabre o slot em conversa (chips `alterar`).
 *
 * `onAttach` abre o seletor de PDFs (o dono lê os selos automaticamente).
 * `readStatus` mostra o progresso da leitura. O `ComposerControllerProvider`
 * vive acima (NexoWorkspace).
 */
export function NexoChat({
  selos,
  onAttach,
  readStatus,
}: {
  selos: SeloForLd[];
  onAttach?: () => void;
  readStatus?: ReadStatus | null;
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
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversa com o Nexo"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
              <NexoOrb className="w-16" />
              <div className="space-y-1.5">
                <h2 className="text-2xl font-medium tracking-[-0.01em]">
                  O que vamos montar?
                </h2>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  {semSelos
                    ? "Solte os PDFs das pranchas e peça em texto — eu leio os selos, proponho e monto."
                    : "Selos lidos. Peça, por exemplo: “gera a LD e a capa da Prefeitura de Chapecó”."}
                </p>
              </div>
            </div>
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
      </div>

      {error && (
        <div className="mx-auto w-full max-w-3xl px-4">
          <div role="alert" className="border-t border-border py-2 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      <div className="border-t border-border">
        <div className="mx-auto w-full max-w-3xl px-4 py-3">
          {readStatus && (
            <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              {readStatus.busy && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              {readStatus.text}
            </div>
          )}
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
