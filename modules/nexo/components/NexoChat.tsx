"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, FileText, X } from "lucide-react";
import type { NexoAgentTurn, NexoChatMessage, LdPreviewData } from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { useRegisterComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
import { useRevealText } from "../lib/use-reveal-text";
import { ConfirmationCard, type NexoTemplateOption } from "./ConfirmationCard";
import { QuickReplyChips, NextStepChips } from "./QuickReplyChips";
import { NexoComposer } from "./NexoComposer";

/** Status da leitura de selos (mostrado acima do composer). */
export interface ReadStatus {
  text: string;
  busy: boolean;
}

/** Anexo com preview imediato: imagem (miniatura via `url`) ou PDF (ícone). */
export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "pdf";
  /** Object URL da miniatura (só imagens). */
  url?: string;
}

/**
 * Chat do Nexo — caixa de conversa (log + composer docado). A identidade (orb +
 * saudação) vive ACIMA, no NexoCopilot; a largura é controlada pelo shell. O
 * agente devolve PROPOSTAS como `ConfirmationCard` READ-ONLY (C1); a geração só
 * no clique. `onSend` avisa o dono no 1º envio (latcheia `started` → slide).
 * `onAttach` abre o seletor de PDFs (o dono lê os selos sozinho). `readStatus`
 * mostra o progresso da leitura.
 */
export function NexoChat({
  selos,
  onSend,
  onAttach,
  readStatus,
  pranchaFiles,
  memorialFile,
  attachments = [],
  onRemoveAttachment,
  onTurnStatus,
}: {
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
  readStatus?: ReadStatus | null;
  /** Pranchas originais retidas (bytes p/ montar o volume). */
  pranchaFiles: File[];
  /** Memorial anexado (arquivo distinto) — alimenta a auditoria. */
  memorialFile: File | null;
  /** Anexos com preview imediato (imagem/PDF). */
  attachments?: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Reporta o estado do turno pro Nexo Core (analyzing/complete/error). */
  onTurnStatus?: (s: { thinking: boolean; error: boolean }) => void;
}) {
  const { messages, appendMessage } = useConversation();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NexoTemplateOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Id da resposta que chegou AO VIVO agora (revela com typewriter). Mensagens
  // restauradas do histórico têm id != revealId → aparecem inteiras. Só uma por
  // vez (o envio é bloqueado enquanto `busy`).
  const [revealId, setRevealId] = useState<string | null>(null);
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

  // Reporta o estado do turno pro Nexo Core (a esfera reage sem conhecer a IA).
  useEffect(() => {
    onTurnStatus?.({ thinking: busy, error: error != null });
  }, [busy, error, onTurnStatus]);

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    // Primeiro envio latcheia o shell (welcome→active). Idempotente no dono.
    onSend?.();
    setError(null);
    const userMsg: NexoChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    appendMessage(userMsg);
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
      const assistantId = crypto.randomUUID();
      setRevealId(assistantId); // recém-chegada → revela com typewriter
      appendMessage({
        id: assistantId,
        role: "assistant",
        content: payload.turn.reply,
        proposals: payload.turn.proposals,
        slotRequest: payload.turn.slotRequest,
        ldPreview: payload.ldPreview,
      });
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Log aberto — sem "card" embrulhando (respiro). Coluna de leitura central. */}
      <div
        ref={scrollRef}
        role="log"
        aria-label="Conversa com o Nexo"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto flex max-w-[46rem] flex-col gap-7 px-4 py-6">
          {messages.map((m, idx) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "nexodoc-message-in flex flex-col items-end gap-2"
                  : "nexodoc-message-in flex flex-col items-start gap-2"
              }
            >
              {m.role === "assistant" && (
                <span className="font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                  Nexo
                </span>
              )}
              <MessageBubble
                role={m.role}
                content={m.content}
                reveal={m.role === "assistant" && m.id === revealId}
              />
              {m.proposals?.map((p, i) => (
                <ConfirmationCard
                  key={`${m.id}-${i}`}
                  proposal={p}
                  selos={selos}
                  templates={templates}
                  ldPreview={m.ldPreview}
                  pranchaFiles={pranchaFiles}
                  memorialFile={memorialFile}
                />
              ))}
              {m.slotRequest && (
                <QuickReplyChips suggestions={m.slotRequest.suggestions} />
              )}
              {/* Próximos passos só na última resposta (não polui o histórico). */}
              {idx === messages.length - 1 && m.role === "assistant" && !busy && (
                <NextStepChips proposals={m.proposals} />
              )}
            </div>
          ))}
          {busy && (
            <div className="nexodoc-message-in flex flex-col items-start gap-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                Nexo
              </span>
              <div
                className="nexo-glass nexo-glass--weak flex items-center gap-1.5 rounded-2xl rounded-tl-md px-4 py-4"
                role="status"
                aria-label="Nexo está pensando"
              >
                <span className="nexo-typing-dot" aria-hidden />
                <span className="nexo-typing-dot" aria-hidden />
                <span className="nexo-typing-dot" aria-hidden />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-auto w-full max-w-[46rem] px-4">
          <div role="alert" className="mb-2 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        </div>
      )}

      {/* Composer = o único vidro "dock" do agente. */}
      <div className="px-4 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[46rem]">
          {attachments.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 px-1">
              {attachments.map((a) => (
                <AttachmentChip key={a.id} att={a} onRemove={onRemoveAttachment} />
              ))}
            </div>
          )}
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

/** Chip de anexo com preview: miniatura da imagem ou ícone de PDF, removível. */
function AttachmentChip({
  att,
  onRemove,
}: {
  att: Attachment;
  onRemove?: (id: string) => void;
}) {
  return (
    <div className="nexodoc-enter flex items-center gap-2 rounded-lg border border-border bg-[var(--nexodoc-recessed)] py-1 pl-1 pr-1.5">
      {att.kind === "image" && att.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={att.url}
          alt={att.name}
          className="h-8 w-8 rounded-md object-cover"
        />
      ) : (
        <span className="flex h-8 w-7 items-center justify-center rounded-md border border-border bg-card">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <span className="max-w-[10rem] truncate font-mono text-[11px] text-foreground">
        {att.name}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(att.id)}
          aria-label={`Remover ${att.name}`}
          className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Bolha da mensagem. Assistente = vidro fraco (chrome do agente); usuário =
 * recessed matte (dado). Cantos assimétricos discretos, sem borda gritante.
 */
function MessageBubble({
  role,
  content,
  reveal = false,
}: {
  role: "user" | "assistant";
  content: string;
  /** Revela o texto progressivamente (só respostas recém-chegadas). */
  reveal?: boolean;
}) {
  const isUser = role === "user";
  const shown = useRevealText(content, reveal);
  return (
    <div
      className={
        isUser
          ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--nexodoc-recessed)] px-4 py-2.5 text-sm text-foreground"
          : "nexo-glass nexo-glass--weak max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed"
      }
    >
      <span className="sr-only">{isUser ? "Você" : "Nexo"}: </span>
      {shown}
    </div>
  );
}
