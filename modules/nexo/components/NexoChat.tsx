"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, FileText, X, Copy, Check } from "lucide-react";
import type { NexoAgentTurn, NexoChatMessage, LdPreviewData } from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { useRegisterComposer } from "../state/composer-controller";
import { useConversation } from "../state/conversation-store";
import { useConversationUsage } from "../state/use-conversation-usage";
import { useRevealText } from "../lib/use-reveal-text";
import {
  ConfirmationCard,
  idsBaseDosArtefatos,
  type NexoTemplateOption,
} from "./ConfirmationCard";
import { PlanoDeGeracao } from "./PlanoDeGeracao";
import { QuickReplyChips, NextStepChips } from "./QuickReplyChips";
import { NexoComposer } from "./NexoComposer";
import { UsageDonut } from "./UsageDonut";

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
  memorialFatos = null,
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
  /**
   * O que a classificação leu do memorial. Vai para o agente: sem isso ele não
   * tem fatos numa conversa sem pranchas e recusa o turno.
   */
  memorialFatos?: {
    fileName: string;
    obra?: string | null;
    municipio?: string | null;
    codigo?: string | null;
  } | null;
  /** Anexos com preview imediato (imagem/PDF). */
  attachments?: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Reporta o estado do turno pro Nexo Core (analyzing/responding/erro). */
  onTurnStatus?: (s: {
    thinking: boolean;
    error: boolean;
    responding: boolean;
  }) => void;
}) {
  const { messages, results, conversationId, appendMessage, appendDelta, finalizeMessage } =
    useConversation();
  const { data: usage, refresh: refreshUsage } = useConversationUsage();
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
  const abortRef = useRef<AbortController | null>(null);
  // Última mensagem do usuário — o "tentar de novo" reenvia esta.
  const [lastSent, setLastSent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/capas/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);

  // Só gruda no fim se o usuário JÁ estava no fim (margem de 64px p/ subpixel).
  // Quem rolou pra cima pra reler não é arrancado de lá.
  const [atBottom, setAtBottom] = useState(true);

  /*
   * Rola também quando um RESULTADO chega, não só quando chega mensagem.
   *
   * A auditoria termina sem escrever no log: o cartão é que cresce. Sem os
   * `results` aqui, o parecer nascia com o rodapé cortado na borda — e no caso
   * parcial o que ficava escondido era justamente o "Rodar de novo", a ação que
   * o veredito acabou de mandar executar.
   */
  useEffect(() => {
    if (!atBottom) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, results, atBottom]);

  // `responding` = já chegou texto (o modelo saiu do raciocínio e está escrevendo).
  const responding = busy && messages[messages.length - 1]?.role === "assistant";

  // Reporta o estado do turno pro Nexo Core (a esfera reage sem conhecer a IA).
  useEffect(() => {
    onTurnStatus?.({ thinking: busy, error: error != null, responding });
  }, [busy, error, responding, onTurnStatus]);

  function stop() {
    abortRef.current?.abort();
  }

  async function send(textArg?: string) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    // Primeiro envio latcheia o shell (welcome→active). Idempotente no dono.
    onSend?.();
    setError(null);
    const userMsg: NexoChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    appendMessage(userMsg);
    setLastSent(text);
    setInput("");
    setBusy(true);

    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    let started = false;

    try {
      const res = await fetch("/api/nexo/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: text,
          history,
          selos,
          // Sem isto o agente não sabe que há um memorial na conversa, e a
          // regra de fatos recusa o turno — que era o defeito original.
          memorial: memorialFatos,
          conversationId,
        }),
        signal: controller.signal,
      });

      const isStream = (res.headers.get("content-type") ?? "").includes("text/event-stream");

      // Caminho não transmitido (provider sem streaming): igual ao de sempre.
      if (!isStream) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; turn?: NexoAgentTurn; ldPreview?: LdPreviewData }
          | null;
        if (!res.ok || !payload?.turn) {
          throw new Error(payload?.error ?? "Falha ao conversar com o Nexo.");
        }
        setRevealId(assistantId); // sem streaming, o typewriter ainda vale
        appendMessage({
          id: assistantId,
          role: "assistant",
          content: payload.turn.reply,
          proposals: payload.turn.proposals,
          slotRequest: payload.turn.slotRequest,
          ldPreview: payload.ldPreview,
        });
        return;
      }

      if (!res.ok || !res.body) throw new Error("Falha ao conversar com o Nexo.");

      // Bolha vazia que vai crescendo com os deltas.
      appendMessage({ id: assistantId, role: "assistant", content: "" });
      started = true;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamError: string | null = null;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // SSE: eventos separados por linha em branco.
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice(6)) as
            | { type: "delta"; text: string }
            | {
                type: "done";
                proposals: NexoAgentTurn["proposals"];
                slotRequest?: NexoAgentTurn["slotRequest"] | null;
                ldPreview?: LdPreviewData;
                usage?: number;
              }
            | { type: "error"; error: string };

          if (event.type === "delta") {
            appendDelta(assistantId, event.text);
          } else if (event.type === "done") {
            finalizeMessage(assistantId, {
              proposals: event.proposals,
              ...(event.slotRequest ? { slotRequest: event.slotRequest } : {}),
              ...(event.ldPreview ? { ldPreview: event.ldPreview } : {}),
            });
          } else {
            streamError = event.error;
          }
        }
      }

      if (streamError) throw new Error(streamError);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      if (aborted) {
        // Parou: guarda o parcial marcado como interrompido, sem cards.
        if (started) finalizeMessage(assistantId, { interrupted: true });
      } else {
        setError(err instanceof Error ? err.message : "Erro na conversa.");
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      refreshUsage();
    }
  }

  function retry() {
    if (!lastSent || busy) return;
    setError(null);
    void send(lastSent);
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
        onScroll={(e) => {
          const el = e.currentTarget;
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 64);
        }}
        className="relative min-h-0 flex-1 overflow-y-auto"
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
              {m.interrupted && (
                <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
                  interrompido
                </span>
              )}
              {/* UM card para tudo que sai de capa/LD/separatriz — com tomos,
                  cada proposta virava vários cards e a tela virava fila de
                  botões iguais. Volume, auditoria e conferência seguem com card
                  próprio: dependem de outra coisa ou são decisão à parte. */}
              {m.proposals && m.proposals.length > 0 && (
                <PlanoDeGeracao
                  proposals={m.proposals}
                  selos={selos}
                  templates={templates}
                  idsBase={idsBaseDosArtefatos(selos)}
                />
              )}
              {m.proposals
                ?.filter((p) => !["capa", "ld", "separatriz"].includes(p.kind))
                .map((p, i) => (
                  <ConfirmationCard
                    key={`${m.id}-${i}`}
                    proposal={p}
                    selos={selos}
                    templates={templates}
                    ldPreview={m.ldPreview}
                    pranchaFiles={pranchaFiles}
                    memorialFile={memorialFile}
                    memorialFatos={memorialFatos}
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
          {busy && messages[messages.length - 1]?.role === "user" && (
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
        {!atBottom && (
          <button
            type="button"
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              setAtBottom(true);
            }}
            className="sticky bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-[var(--nexodoc-recessed)] px-3 py-1.5 text-xs text-foreground shadow-lg transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            ↓ novas mensagens
          </button>
        )}
      </div>

      {error && (
        <div className="mx-auto w-full max-w-[46rem] px-4">
          <div
            role="alert"
            className="mb-2 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={retry}
              className="shrink-0 rounded-sm px-2 py-1 text-xs font-medium underline underline-offset-2 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      {/* Composer = o único vidro "dock" do agente. */}
      <div className="px-4 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[46rem]">
          <Anexos attachments={attachments} onRemove={onRemoveAttachment} />
          {readStatus && (
            <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
              {readStatus.busy && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
              {readStatus.text}
            </div>
          )}
          <TitulosLidos selos={selos} />
          <NexoComposer
            variant="docked"
            value={input}
            onChange={setInput}
            onSubmit={() => void send()}
            onStop={stop}
            trailing={<UsageDonut data={usage} />}
            busy={busy}
            onAttach={onAttach}
            inputRef={inputRef}
          />
        </div>
      </div>
    </div>
  );
}

/** Acima disto a lista vira uma parede de chips e some com a conversa. */
const ANEXOS_VISIVEIS = 4;

/**
 * Anexos do turno. Um projeto real chega com dezenas de PDFs (uma prancha por
 * arquivo), e listar todos empurrava a conversa inteira para fora da tela — a
 * lista de arquivos virava a interface. Mostra os primeiros e resume o resto,
 * com a lista completa a um clique.
 */
function Anexos({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}) {
  const [expandido, setExpandido] = useState(false);

  if (attachments.length === 0) return null;

  const excedente = attachments.length - ANEXOS_VISIVEIS;
  const mostrados = expandido ? attachments : attachments.slice(0, ANEXOS_VISIVEIS);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
      {mostrados.map((a) => (
        <AttachmentChip key={a.id} att={a} onRemove={onRemove} />
      ))}
      {excedente > 0 && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
          className="rounded-lg border border-border bg-[var(--nexodoc-recessed)] px-2.5 py-2 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          {expandido ? "mostrar menos" : `+${excedente} arquivo${excedente > 1 ? "s" : ""}`}
        </button>
      )}
    </div>
  );
}

/**
 * O que foi LIDO como título em cada prancha, agrupado. O título documental
 * ainda não é derivado sozinho — o engenheiro decide —, então mostrar o que o
 * selo trouxe é o que explica de onde vem (ou por que falta) a sugestão.
 *
 * Agrupa por título em vez de listar 16 linhas iguais: o que interessa é ver se
 * as pranchas concordam entre si. Duas linhas aqui já contam uma história — o
 * lote tem folhas de seções diferentes.
 */
function TitulosLidos({ selos }: { selos: SeloForLd[] }) {
  if (selos.length === 0) return null;

  const porTitulo = new Map<string, number>();
  for (const s of selos) {
    const t = s.tituloSecao?.trim() || "";
    porTitulo.set(t, (porTitulo.get(t) ?? 0) + 1);
  }
  const linhas = [...porTitulo.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="mb-2 space-y-0.5 px-1">
      {linhas.map(([titulo, folhas]) => (
        <div key={titulo || "(vazio)"} className="flex items-baseline gap-2 text-xs">
          <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
            {folhas} folha{folhas > 1 ? "s" : ""}
          </span>
          <span
            className={
              titulo
                ? "truncate font-mono text-foreground"
                : "truncate font-mono italic text-muted-foreground"
            }
            title={titulo || "sem título no selo"}
          >
            {titulo || "sem título no selo"}
          </span>
        </div>
      ))}
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
 * A resposta do Nexo ganha "copiar" no hover — o engenheiro cola no e-mail.
 */
function MessageBubble({
  role,
  content,
  reveal = false,
}: {
  role: "user" | "assistant";
  content: string;
  /** Revela o texto progressivamente (só no caminho SEM streaming). */
  reveal?: boolean;
}) {
  const isUser = role === "user";
  const shown = useRevealText(content, reveal);
  const [copied, setCopied] = useState(false);

  // O "copiado" volta sozinho. setState em timeout (nunca no corpo do render).
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(id);
  }, [copied]);

  return (
    <div className="group/msg relative max-w-[85%]">
      <div
        className={
          isUser
            ? "whitespace-pre-wrap rounded-2xl rounded-br-md bg-[var(--nexodoc-recessed)] px-4 py-2.5 text-[15px] leading-[1.55] text-foreground"
            : "nexo-glass nexo-glass--weak whitespace-pre-wrap rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-[1.6] text-foreground"
        }
      >
        <span className="sr-only">{isUser ? "Você" : "Nexo"}: </span>
        {shown}
      </div>
      {!isUser && content.trim() !== "" && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(content).then(() => setCopied(true));
          }}
          aria-label="Copiar resposta"
          className="absolute -bottom-2 right-1 rounded-md border border-border bg-card px-1.5 py-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 group-hover/msg:opacity-100"
        >
          {copied ? (
            <Check className="h-3 w-3" aria-hidden />
          ) : (
            <Copy className="h-3 w-3" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
