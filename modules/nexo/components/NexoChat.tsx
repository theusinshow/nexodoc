"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, FileText, X, Copy, Check, ArrowDown } from "lucide-react";
import type { NexoAgentTurn, NexoChatMessage, LdPreviewData } from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  useRegisterComposer,
  usePublicarFocoDoComposer,
} from "../state/composer-controller";
import type { AuditReport } from "@/lib/audit-report";
import { auditoriaMaisRecente } from "../lib/audit";
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
import { useConexao } from "../lib/use-conexao";
import { estadoDoAnexo, type EstadoDoAnexo, type SeloLido } from "../lib/estado-do-anexo";
import { siglaDaDisciplina } from "../lib/disciplina-cor";
import { NexoComposer } from "./NexoComposer";
import { UsageDonut } from "./UsageDonut";
import { BarraDeLeitura } from "./BarraDeLeitura";
import { ZonaDeSolta } from "./ZonaDeSolta";

/** Status da leitura de selos (mostrado acima do composer). */
export interface ReadStatus {
  text: string;
  busy: boolean;
  /** Folhas já analisadas — alimenta a barra segmentada. */
  done?: number;
  /** Folhas do lote. 0 enquanto os PDFs ainda estão sendo contados. */
  total?: number;
}

/** Anexo com preview imediato: imagem (miniatura via `url`) ou PDF (ícone). */
export interface Attachment {
  id: string;
  name: string;
  kind: "image" | "pdf";
  /** Object URL da miniatura (só imagens). */
  url?: string;
  /**
   * Papel LIDO do nome do arquivo — e por isso corrigível à mão.
   *
   * A partição usa a convenção de nome (`md`/`memorial`). Um memorial batizado
   * fora da convenção virava prancha, ia para o OCR de selo e a auditoria nunca
   * era oferecida — sem erro, sem aviso, sem saída. Mostrar o papel e deixar
   * trocá-lo é o que impede que um nome de arquivo tranque a função principal.
   */
  papel?: "memorial" | "prancha";
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
  arrastando = false,
  readStatus,
  pranchaFiles,
  memorialFile,
  memorialFatos = null,
  attachments = [],
  onRemoveAttachment,
  onTrocarPapelAnexo,
  onTurnStatus,
}: {
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
  /** Arrasto em curso: a zona de solta sai do caminho do overlay de tela cheia. */
  arrastando?: boolean;
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
    /** Prefeitura/órgão emissor lido do próprio memorial. */
    orgao?: string | null;
    municipio?: string | null;
    codigo?: string | null;
    /** Endereço da caracterização da obra — distingue obras de mesmo nome. */
    endereco?: string | null;
  } | null;
  /** Anexos com preview imediato (imagem/PDF). */
  attachments?: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Corrige o papel lido do nome do arquivo (memorial ↔ prancha). */
  onTrocarPapelAnexo?: (id: string) => void;
  /** Reporta o estado do turno pro Nexo Core (analyzing/responding/erro). */
  onTurnStatus?: (s: {
    thinking: boolean;
    error: boolean;
    responding: boolean;
  }) => void;
}) {
  const {
    messages,
    results,
    conversationId,
    seloResults: selosLidos,
    decisoes,
    appendMessage,
    appendDelta,
    finalizeMessage,
    saveResult,
  } = useConversation();
  /*
   * O PARECER NO PALCO decide a porta do turno. Com parecer, a pergunta vai
   * para o chat que RELÊ o memorial; sem ele, para o roteador de intenção do
   * Nexo, exatamente como sempre foi.
   *
   * A regra de QUAL parecer é a da tela tem um dono só (`auditoriaMaisRecente`)
   * — repeti-la aqui faria o chat responder sobre uma revisão e o palco
   * mostrar outra.
   */
  const auditoriaAtual = useMemo(() => auditoriaMaisRecente(results), [results]);
  const { data: usage, refresh: refreshUsage } = useConversationUsage();
  const { online } = useConexao();
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
  const publicarFoco = usePublicarFocoDoComposer();
  /*
   * O FOCO É REF, não estado: ele só existe para ser publicado junto com o
   * texto, e guardá-lo em `useState` re-renderizaria o chat inteiro a cada
   * entrada e saída do cursor — sem nada nesta árvore mudar de aparência.
   */
  const focadoRef = useRef(false);
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
   * A CONVERSA NÃO PULA PARA O FIM SOZINHA.
   *
   * Antes, toda mensagem e todo resultado arrastavam a vista para baixo enquanto
   * o Nexo escrevia — quem estava lendo a proposta anterior perdia a linha, e
   * uma resposta longa passava correndo. A leitura é em ORDEM: quem quer o fim
   * pede o fim, pelo botão abaixo.
   *
   * A exceção é a mensagem do PRÓPRIO usuário: mandar algo e não ver o que
   * mandou aparecer é a única situação em que ficar parado parece defeito.
   */
  const ultima = messages[messages.length - 1];
  const ultimaEhDoUsuario = ultima?.role === "user";
  useEffect(() => {
    if (!ultimaEhDoUsuario) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, ultimaEhDoUsuario]);

  // `responding` = já chegou texto (o modelo saiu do raciocínio e está escrevendo).
  const responding = busy && messages[messages.length - 1]?.role === "assistant";

  // Reporta o estado do turno pro Nexo Core (a esfera reage sem conhecer a IA).
  useEffect(() => {
    onTurnStatus?.({ thinking: busy, error: error != null, responding });
  }, [busy, error, responding, onTurnStatus]);

  function stop() {
    abortRef.current?.abort();
  }

  /**
   * O turno que vai para o CHAT DA AUDITORIA.
   *
   * Consome o mesmo contrato SSE do agente (`delta`/`done`/`error`) mais dois
   * eventos: `ferramenta`, que mostra o que ele está lendo enquanto lê, e
   * `achado`, que traz o parecer inteiro já com a linha nova.
   *
   * O `ferramenta` não é enfeite: o laço pode dar até oito idas ao modelo, e sem
   * ele o engenheiro olha para uma bolha vazia esse tempo todo.
   */
  async function perguntarSobreAuditoria(args: {
    text: string;
    history: { role: "user" | "assistant"; content: string }[];
    assistantId: string;
    controller: AbortController;
    marcarIniciado: () => void;
  }) {
    const alvo = auditoriaAtual;
    if (!alvo) return;

    const res = await fetch("/api/audit/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        question: args.text,
        history: args.history,
        report: alvo.salvo.report,
        auditId: alvo.salvo.auditId,
      }),
      signal: args.controller.signal,
    });

    if (!res.ok || !res.body) throw new Error("Falha ao conversar sobre a auditoria.");

    appendMessage({ id: args.assistantId, role: "assistant", content: "" });
    args.marcarIniciado();

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamError: string | null = null;
    let encaminhado: string | null = null;

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
          | { type: "ferramenta"; nome: string; resumo: string }
          | { type: "achado"; achado: unknown; report: AuditReport }
          | { type: "encaminhar"; pedido: string }
          | { type: "done"; voltas: number; parouPorTeto: boolean }
          | { type: "error"; error: string };

        if (event.type === "delta") {
          appendDelta(args.assistantId, event.text);
        } else if (event.type === "ferramenta") {
          onTurnStatus?.({ thinking: true, error: false, responding: false });
        } else if (event.type === "achado") {
          /*
           * O parecer persiste em DOIS lugares (banco e IndexedDB) e os dois
           * precisam concordar. O servidor já gravou o dele; aqui regravamos o
           * artefato NO LUGAR — mesmo `artifactId`, então canvas, fila e
           * feedback enxergam o achado novo de graça, sem alteração.
           */
          void saveResult({
            artifactId: alvo.artifactId,
            kind: "auditoria",
            summary: `Auditoria — ${event.report.status_geral}`,
            files: [],
            payload: { ...alvo.salvo, report: event.report },
            canvas: {
              label: "Auditoria",
              detail: `${event.report.status_geral} · ${event.report.total_incongruencias} achado(s)`,
            },
          });
        } else if (event.type === "encaminhar") {
          encaminhado = event.pedido;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      }
    }

    if (streamError) throw new Error(streamError);
    finalizeMessage(args.assistantId, {});

    /*
     * O engenheiro pediu para GERAR, e não para perguntar. O turno vai ao Nexo
     * com o corpo de sempre, e o card de confirmação aparece igual. O `true`
     * força a outra porta: sem ele, voltaria para cá em laço.
     */
    if (encaminhado) await send(encaminhado, true);
  }

  /**
   * `forcarNexo` existe por um laço real: `encaminhar_para_geracao` chama
   * `send` de volta, e ali `auditoriaAtual` continua preenchido — sem esta
   * saída o turno voltaria ao chat da auditoria para sempre, e a tela travaria.
   */
  async function send(textArg?: string, forcarNexo = false) {
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
    // O campo esvaziou por um caminho que não passa pelo `onChange` — sem isto,
    // o orbe continuaria achando que há texto escrito depois de enviado.
    publicarFoco({ focado: focadoRef.current, temTexto: false });
    setBusy(true);

    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    let started = false;

    try {
      // A PORTA. Com parecer no palco, quem responde é quem tem o documento.
      if (auditoriaAtual?.salvo.report && !forcarNexo) {
        await perguntarSobreAuditoria({
          text,
          history,
          assistantId,
          controller,
          marcarIniciado: () => {
            started = true;
          },
        });
        return;
      }

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
          /*
           * O que o engenheiro decidiu no frame do documento. Sem isto o
           * resolvedor de slots pergunta de novo, no chat, o título que ele
           * acabou de digitar no card.
           */
          decisoes: Object.fromEntries(
            Object.entries(decisoes).map(([campo, d]) => [campo, d.valor]),
          ),
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
        {/*
         * O LOG VAZIO É A ZONA DE SOLTA.
         *
         * O shell já reservava esta altura na entrada e ela ficava em branco —
         * ~40% da tela dizendo nada, enquanto o subtítulo mandava "solte as
         * pranchas" e a única afordância era um clipe de 12px no rodapé. A
         * DESIGN.md §8 pede zona de solta VISÍVEL; ela vive aqui, e some sozinha
         * quando a primeira mensagem chega, sem deslocar o composer.
         */}
        {messages.length === 0 && (
          <div className="mx-auto h-full max-w-[46rem] px-4 py-6">
            <ZonaDeSolta onAnexar={onAttach} arrastando={arrastando} />
          </div>
        )}
        {/*
          O respiro do fim (`pb-16`) existe para o botão "ir para as últimas
          mensagens": ele é sticky no rodapé do log e ficava POR CIMA da última
          bolha, que é justamente a que se está tentando ler. Sem a folga, o
          atalho para chegar ao fim atrapalhava quem já estava chegando lá.
        */}
        <div className="mx-auto flex max-w-[46rem] flex-col gap-7 px-4 pb-16 pt-6">
          {messages.map((m, idx) => (
            <div
              key={m.id}
              // Âncora do tour guiado: a resposta do Nexo é onde ele conta o
              // que leu dos selos.
              data-tour={m.role === "assistant" ? "resposta" : undefined}
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
                  /* A prévia das folhas voltava do servidor todo turno e não
                     tinha para onde ir desde que este card assumiu a LD. */
                  ldPreview={m.ldPreview}
                  /* Gerar no meio da leitura sai curto e calado: a última
                     disciplina do volume perde as folhas que ainda não
                     chegaram. O card tranca o botão enquanto isso. */
                  leitura={{
                    lendo: Boolean(readStatus?.busy),
                    lidas: readStatus?.done ?? 0,
                    total: readStatus?.total ?? 0,
                  }}
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
                className="nexo-glass nexo-glass--weak nx-cut-8 flex items-center gap-1.5 px-4 py-4"
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
        {/*
          IR PARA AS ÚLTIMAS MENSAGENS. Discreto de propósito: ele fica sobre a
          conversa o tempo todo em que há algo abaixo, e um botão de contraste
          alto nessa posição competiria com o que está sendo lido. Ganha nitidez
          no hover, que é quando alguém o está procurando.
        */}
        {!atBottom && (
          <button
            type="button"
            aria-label="Ir para as últimas mensagens"
            onClick={() => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
              setAtBottom(true);
            }}
            /* Era pilula. O anel interno de 5px continua redondo -- ele e um
               indicador, nao um controle. */
            className="nx-edge-5 sticky bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 py-1.5 pl-1.5 pr-3 text-xs text-muted-foreground/70 opacity-70 backdrop-blur transition-all focus-visible:outline-none [--nx-edge:var(--border)] [--nx-fill:var(--nexodoc-recessed)] hover:text-foreground hover:opacity-100"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full border border-current">
              <ArrowDown className="h-3 w-3" aria-hidden />
            </span>
            ir para as últimas mensagens
          </button>
        )}
      </div>

      {error && (
        <div className="mx-auto w-full max-w-[46rem] px-4">
          <div
            role="alert"
            /* Sem camada, pela mesma razao do badge: borda E fundo translucidos
               nao compoem em duas formas. */
            className="nx-cut-6 mb-2 flex items-center justify-between gap-3 border-0 bg-destructive/8 px-3 py-2 text-sm text-destructive"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={retry}
              className="nx-edge-5 shrink-0 px-2 py-1 text-xs font-medium underline underline-offset-2 focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] focus-visible:[--nx-fill:var(--accent)]"
            >
              Tentar de novo
            </button>
          </div>
        </div>
      )}

      {/* Composer = o único vidro "dock" do agente. */}
      <div className="px-4 pb-6 pt-2">
        <div className="mx-auto w-full max-w-[46rem]">
          <Anexos
            attachments={attachments}
            onRemove={onRemoveAttachment}
            onTrocarPapel={onTrocarPapelAnexo}
            selosLidos={selosLidos}
            lendo={Boolean(readStatus?.busy)}
          />
          {readStatus && (
            <div className="mb-2 space-y-1.5 px-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {readStatus.busy && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                )}
                {readStatus.text}
              </div>
              {/*
                A barra só enquanto se LÊ. Depois de pronta ela seria uma fita
                cheia dizendo o que a frase acima já diz, ocupando a linha que o
                próximo passo vai usar.
              */}
              {readStatus.busy && (readStatus.total ?? 0) > 0 && (
                <BarraDeLeitura
                  done={readStatus.done ?? 0}
                  total={readStatus.total ?? 0}
                />
              )}
            </div>
          )}
          <TitulosLidos selos={selos} />
          <NexoComposer
            variant="docked"
            value={input}
            onChange={(v) => {
              setInput(v);
              publicarFoco({ focado: focadoRef.current, temTexto: v.trim().length > 0 });
            }}
            onFoco={(focado) => {
              focadoRef.current = focado;
              publicarFoco({ focado, temTexto: input.trim().length > 0 });
            }}
            onSubmit={() => void send()}
            onStop={stop}
            trailing={<UsageDonut data={usage} />}
            busy={busy}
            onAttach={onAttach}
            inputRef={inputRef}
            motivoDesabilitado={
              online
                ? undefined
                : "Sem conexão — o que você escrever fica guardado, mas o envio espera a rede voltar."
            }
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
  onTrocarPapel,
  selosLidos = [],
  lendo = false,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  onTrocarPapel?: (id: string) => void;
  /** Selos já lidos — amarram resultado e anexo pelo nome do arquivo. */
  selosLidos?: readonly SeloLido[];
  lendo?: boolean;
}) {
  const [expandido, setExpandido] = useState(false);

  if (attachments.length === 0) return null;

  const excedente = attachments.length - ANEXOS_VISIVEIS;
  const mostrados = expandido ? attachments : attachments.slice(0, ANEXOS_VISIVEIS);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
      {mostrados.map((a) => (
        <AttachmentChip
          key={a.id}
          att={a}
          onRemove={onRemove}
          onTrocarPapel={onTrocarPapel}
          estado={estadoDoAnexo(a.name, selosLidos, lendo, siglaDaDisciplina)}
        />
      ))}
      {excedente > 0 && (
        <button
          type="button"
          onClick={() => setExpandido((v) => !v)}
          aria-expanded={expandido}
          className="nx-edge-6 px-2.5 py-2 font-mono text-[11px] text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:var(--border)] [--nx-fill:var(--nexodoc-recessed)] hover:text-foreground"
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
  onTrocarPapel,
  estado = { tipo: "nenhum" },
}: {
  att: Attachment;
  onRemove?: (id: string) => void;
  onTrocarPapel?: (id: string) => void;
  estado?: EstadoDoAnexo;
}) {
  const viraMemorial = att.papel === "prancha";
  return (
    <div className="nexodoc-enter nx-edge-6 flex items-center gap-2 py-1 pl-1 pr-1.5 [--nx-fill:var(--nexodoc-recessed)]">
      {att.kind === "image" && att.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={att.url}
          alt={att.name}
          className="nx-cut-5 h-8 w-8 object-cover"
        />
      ) : (
        <span className="nx-edge-5 flex h-8 w-7 items-center justify-center">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        </span>
      )}
      <span className="max-w-[10rem] truncate font-mono text-[11px] text-foreground">
        {att.name}
      </span>
      {/*
        O estado DESTE arquivo. O progresso agregado ("6 de 24 folhas") não
        responde a pergunta que se faz olhando a tela com oito PDFs na fila:
        este aqui já foi? deu certo?
      */}
      {estado.tipo === "na-fila" && (
        <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground/70">
          na fila
        </span>
      )}
      {estado.tipo === "lido" && (
        <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
          {[estado.sigla, estado.folha].filter(Boolean).join(" · ")}
        </span>
      )}
      {estado.tipo === "ilegivel" && (
        <span
          className="font-mono text-[10px] uppercase tracking-[0.07em]"
          style={{ color: "var(--status-warning)" }}
          title="O carimbo não pôde ser lido nesta prancha."
        >
          selo ilegível
        </span>
      )}
      {/*
        O PAPEL só aparece quando NÃO há como trocá-lo. Com o botão ao lado, os
        dois juntos davam "PRANCHA  é o memorial" — um estado e uma ação
        encostados, sem nada distinguindo qual era qual. O verbo do botão já diz
        o papel atual por oposição.
      */}
      {att.papel && estado.tipo !== "lido" && !onTrocarPapel && (
        <span className="font-mono text-[10px] uppercase tracking-[0.07em] text-muted-foreground">
          {att.papel}
        </span>
      )}
      {/*
        O CONVITE SOME QUANDO O CARIMBO FOI LIDO.

        Carimbo lido é a prova de que o PDF é prancha — perguntar ali se ele é o
        memorial é oferecer uma dúvida que o próprio documento já resolveu. Fica
        de pé enquanto a folha está na fila e quando o selo sai ilegível, que é
        justamente quando a dúvida existe: memorial é texto, e um memorial
        batizado fora da convenção cai no OCR e nunca chega à auditoria.

        Antes ele aparecia SEMPRE, inclusive na folha já lida com sucesso — e
        escrito no indicativo ("é o memorial"), que se lê como afirmação do
        estado e não como o convite que é.
      */}
      {att.papel && onTrocarPapel && estado.tipo !== "lido" && (
        <button
          type="button"
          onClick={() => onTrocarPapel(att.id)}
          title={
            viraMemorial
              ? "Tratar este PDF como o memorial (auditar em vez de ler o selo)"
              : "Tratar este PDF como prancha (ler o selo)"
          }
          className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
        >
          {viraMemorial ? "tratar como memorial" : "tratar como prancha"}
        </button>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(att.id)}
          aria-label={`Remover ${att.name}`}
          className="nx-edge-4 p-0.5 text-muted-foreground transition-colors focus-visible:outline-none [--nx-edge:transparent] [--nx-fill:transparent] hover:text-destructive focus-visible:[--nx-fill:var(--accent)]"
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
    /*
     * 72ch. A medida de leitura clássica vai de 66 a 75 caracteres, e 62 estava
     * abaixo dela — apertado o bastante para a primeira resposta, que carrega o
     * nome da obra por extenso, quebrar em três linhas numa caixa estreita. O
     * limite continua existindo (linha longa cansa, e aqui se lê parágrafo
     * técnico, não frase de chat); ele só parou de ser mais severo do que a
     * tipografia pede.
     */
    <div className="group/msg relative max-w-[72ch]">
      {/*
       * Raio do sistema (8px), não os 16px arredondados de aplicativo de
       * mensagem: o DESIGN.md tem UM raio, e a bolha era o único lugar que
       * inventava outro. O corpo é Body (14px) — 15px não é degrau da escala.
       *
       * A bolha do usuário fica em `secondary`, superfície ELEVADA: é a fala
       * dele, e no fundo embutido ela parecia um campo desabilitado.
       */}
      <div
        className={
          isUser
            ? "nx-edge-8 whitespace-pre-wrap px-4 py-2.5 text-sm leading-[1.55] text-foreground [--nx-fill:var(--secondary)]"
            : "nexo-glass nexo-glass--weak nx-cut-8 whitespace-pre-wrap px-4 py-3 text-sm leading-[1.55] text-foreground"
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
          className="nx-edge-5 absolute -bottom-2 right-1 px-1.5 py-1 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 focus-visible:outline-none hover:text-foreground group-hover/msg:opacity-100"
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
