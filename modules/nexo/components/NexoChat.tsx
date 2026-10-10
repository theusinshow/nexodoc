"use client";

import { Orbe } from "@/components/ds/basicos";
import { Cronometro, Trelica } from "@/components/ds/micro";
import { textoComRotulos } from "@/lib/rotulo-do-achado";
import { lerPerguntaSobreAchado, textoDaPergunta, type AchadoArrastado } from "@/lib/pergunta-sobre-achado";
import { registrarAlvoDoAchado } from "@/components/achado/arrasto-do-achado";
import { RotuloDaPergunta } from "@/components/achado/rotulo-da-pergunta";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, FileText, X, Copy, Check, ArrowDown } from "lucide-react";
import type { NexoAgentTurn, NexoChatMessage, LdPreviewData } from "../types";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import {
  useRegisterComposer,
  usePublicarFocoDoComposer,
} from "../state/composer-controller";
import type { AuditReport } from "@/lib/audit-report";
import { traceDoTurno } from "../lib/trace-do-turno";
import { auditoriaMaisRecente } from "../lib/audit";
import { useConversation } from "../state/conversation-store";
import { useConversationUsage } from "../state/use-conversation-usage";
import { useRevealText } from "../lib/use-reveal-text";
import {
  ConfirmationCard,
  idsBaseDosArtefatos,
  MontadoresDoVolume,
  type NexoTemplateOption,
} from "./ConfirmationCard";
import { PlanoDeGeracao } from "./PlanoDeGeracao";
import { LinhaDoPensamento, type PensamentoDoTurno } from "./LinhaDoPensamento";
import { VolumesDesatualizados } from "./VolumesDesatualizados";
import { FichaDoDropCard } from "./FichaDoDrop";
import { FichaDoMemorialCard } from "./FichaDoMemorial";
import { CadastroDaObraCard } from "./CadastroDaObra";
import { QuickReplyChips, NextStepChips } from "./QuickReplyChips";
import { useConexao } from "../lib/use-conexao";
import { estadoDoAnexo, type EstadoDoAnexo, type SeloLido } from "../lib/estado-do-anexo";
import { siglaDaDisciplina } from "../lib/disciplina-cor";
import { NexoComposer } from "./NexoComposer";
import { UsageDonut } from "./UsageDonut";
import { BarraDeLeitura } from "./BarraDeLeitura";
import { ZonaDeSolta } from "./ZonaDeSolta";
import { pedeNovaAuditoria } from "../lib/auditoria-da-proposta";
import { detalheDoParecer, resumoDoParecer } from "@/lib/auditoria-incompleta";
import type { PranchaNaSessao } from "../lib/pranchas-guardadas";

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
   * Papel do anexo: palpite do NOME, corrigido pelo PRÉ-VOO, e corrigível à mão.
   *
   * A partição usava só a convenção de nome (`md`/`memorial`). Um memorial
   * batizado fora da convenção virava prancha, ia para o OCR de selo e a
   * auditoria nunca era oferecida — sem erro, sem aviso, sem saída. Mostrar o
   * papel e deixar trocá-lo é o que impede que um nome de arquivo tranque a
   * função principal.
   *
   * `indeciso` é o estado que faltava, e ele chega do pré-voo: o nome diz uma
   * coisa e o conteúdo diz outra. Escolher em silêncio trocaria um erro raro e
   * visível por um raro e invisível — a convenção acerta 656 de 659 no acervo.
   * Ver [[modules/nexo/lib/papel-do-anexo.ts]].
   */
  papel?: "memorial" | "prancha" | "indeciso";
  /** Por que o papel ficou indeciso — a frase que o chip mostra. */
  porque?: string;
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
  tarefa = null,
  onUsarExemplo,
  readStatus,
  pranchas,
  memorialFile,
  memorialFatos = null,
  attachments = [],
  onRemoveAttachment,
  onTrocarPapelAnexo,
  onDefinirPapelAnexo,
  onTurnStatus,
}: {
  selos: SeloForLd[];
  onSend?: () => void;
  onAttach?: () => void;
  /** Arrasto em curso: a zona de solta sai do caminho do overlay de tela cheia. */
  arrastando?: boolean;
  /** A tela da tarefa escolhida — a zona de soltar fala dela. */
  tarefa?: { pede: string; faz: string; botao: string } | null;
  /** A oferta do memorial de exemplo na zona de soltar (M1 do doc 08). */
  onUsarExemplo?: () => void;
  readStatus?: ReadStatus | null;
  /** Pranchas originais retidas (bytes p/ montar o volume). */
  pranchas: PranchaNaSessao[];
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
    /** De onde veio a obra (capa, projeto, corpo, usuário) — o cartão diz. */
    origemDaObra?: string | null;
  } | null;
  /** Anexos com preview imediato (imagem/PDF). */
  attachments?: Attachment[];
  onRemoveAttachment?: (id: string) => void;
  /** Corrige o papel lido do nome do arquivo (memorial ↔ prancha). */
  onTrocarPapelAnexo?: (id: string) => void;
  /**
   * DEFINE o papel de um anexo indeciso — diferente de trocar.
   *
   * Trocar inverte um papel que existe, e o verbo do botão já diz qual é por
   * oposição. No indeciso não há papel atual: um botão só esconderia metade da
   * resposta, então são dois, e cada um diz o que faz.
   */
  onDefinirPapelAnexo?: (id: string, papel: "memorial" | "prancha") => void;
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
    podeGastar,
    motivoParaNaoGastar,
    conferirAntesDeGastar,
  } = useConversation();
  /** A ficha do memorial mais recente: a dica da obra aparece só nela. */
  const ultimaFicha = messages.findLast((m) => m.fichaDoMemorial)?.id;
  /** O plano de geração mais recente: a dica do plano aparece só nele. */
  const ultimoPlano = messages.findLast((m) => m.proposals?.some((p) => p.kind === "capa"))?.id;
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
  /*
   * O ACHADO SOLTO NO CHAT (08/10/2026): arrastado da fila, ele fica preso
   * acima do campo, e a próxima pergunta digitada sai como pergunta sobre ele
   * — o mesmo texto do chat do visor (`textoDaPergunta`).
   */
  const [achadoAnexado, setAchadoAnexado] = useState<AchadoArrastado | null>(null);
  const [soltandoAchado, setSoltandoAchado] = useState(false);
  // Chegando pela fenda: o chip nasce escondido até a animação o revelar.
  const [chipChegando, setChipChegando] = useState(false);
  const colunaRef = useRef<HTMLDivElement>(null);
  const chipRef = useRef<HTMLDivElement>(null);
  // A coluna é o alvo do arrasto; a fenda e o chip são coreografados lá (arrasto-do-achado.ts).
  useEffect(() => {
    const el = colunaRef.current;
    if (!el) return;
    return registrarAlvoDoAchado({
      el,
      sobrevoar: setSoltandoAchado,
      receber: (achado) => {
        setChipChegando(true);
        setAchadoAnexado(achado);
        inputRef.current?.focus();
        // Dois quadros: o React desenha o chip e o layout assenta antes de medir.
        return new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => ok(chipRef.current))));
      },
      chegou: () => setChipChegando(false),
    });
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<NexoTemplateOption[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Id da resposta que chegou AO VIVO agora (revela com typewriter). Mensagens
  // restauradas do histórico têm id != revealId → aparecem inteiras. Só uma por
  // vez (o envio é bloqueado enquanto `busy`).
  const [revealId, setRevealId] = useState<string | null>(null);
  /*
   * O PENSAMENTO DE CADA TURNO desta sessão (a Linha do Pensamento do lab):
   * quando saiu, quando chegou a primeira palavra e os passos que de fato
   * aconteceram. Só na memória: uma conversa reaberta mostra a resposta, não o
   * pensamento de ontem.
   */
  const [pensamentos, setPensamentos] = useState<Record<string, PensamentoDoTurno>>({});
  const [idDaVez, setIdDaVez] = useState<string | null>(null);
  const passoDoTurno = (id: string, texto: string) =>
    setPensamentos((p) => (p[id] ? { ...p, [id]: { ...p[id], passos: [...p[id].passos, texto] } } : p));
  const primeiraPalavra = (id: string) =>
    setPensamentos((p) => (p[id] && !p[id].primeira ? { ...p, [id]: { ...p[id], primeira: Date.now() } } : p));
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
  /*
   * ABRIR UMA CONVERSA É CHEGAR NO FIM DELA (07/10/2026, U13). Quem voltava a
   * uma auditoria pelo "Continuar" via a ficha do memorial no topo e não a
   * fala final, com o veredito e os achados que travam. A regra acima continua
   * valendo para o que chega DEPOIS; isto é só a posição de abertura, uma vez.
   */
  const ultimaFichaSemParecer =
    Boolean(ultima?.fichaDoMemorial) &&
    !results.some((r) => r.kind === "auditoria" && r.artifactId.endsWith(`:${ultima.id}`));
  const abriuNoFim = useRef(false);
  useEffect(() => {
    if (abriuNoFim.current || messages.length === 0) return;
    // A guarda é marcada dentro do quadro: marcada antes, um quadro cancelado deixaria a conversa no topo.
    const raf = requestAnimationFrame(() => {
      abriuNoFim.current = true;
      const log = scrollRef.current;
      if (!log) return;
      /*
       * A FICHA AINDA A CONFERIR abre no topo dela (10/10/2026): o fim era o
       * botão "Conferi — auditar", e a linha "Obra" — a que mais pede conferência,
       * com a dica dela — ficava acima da dobra. Com parecer, vale o fim.
       */
      const fichas = ultimaFichaSemParecer ? log.querySelectorAll(".nx-ficha") : null;
      const ficha = fichas?.[fichas.length - 1];
      if (ficha) {
        log.scrollTo({ top: log.scrollTop + ficha.getBoundingClientRect().top - log.getBoundingClientRect().top - 12 });
        return;
      }
      log.scrollTo({ top: log.scrollHeight });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

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
          primeiraPalavra(args.assistantId);
          appendDelta(args.assistantId, event.text);
        } else if (event.type === "ferramenta") {
          // O que ele está lendo agora vira um passo do pensamento.
          if (event.resumo?.trim()) passoDoTurno(args.assistantId, event.resumo.trim());
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
            summary: resumoDoParecer(event.report),
            files: [],
            payload: { ...alvo.salvo, report: event.report },
            canvas: {
              label: "Auditoria",
              detail: detalheDoParecer(event.report),
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
    const digitado = (textArg ?? input).trim();
    // O achado preso só vale para o que foi DIGITADO: chip e "tentar de novo" mandam o texto deles.
    const sobre = textArg === undefined ? achadoAnexado : null;
    const text = sobre && digitado ? textoDaPergunta(sobre, sobre.pagina, digitado) : digitado;
    if (!text || busy) return;
    // Aba travada (conversa mudada em outra aba) não chama o agente: o turno
    // seria pago e descartado pela fila. O campo já diz o porquê.
    if (!podeGastar) return;
    /*
     * Nem o PRIMEIRO turno de uma aba parada (15/09/2026): a trava de cima só
     * acende depois de uma gravação recusada. Pergunta ao servidor antes; a
     * recusa acende a faixa e trava o campo, e o texto fica escrito nele.
     */
    // O controle nasce ANTES da conferência: "parar" durante ela cancela o envio.
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    // Recusado, o texto fica no campo: nada foi enviado nem gasto.
    const conferencia = await conferirAntesDeGastar();
    if (!conferencia.pode || controller.signal.aborted) {
      setBusy(false);
      if (abortRef.current === controller) abortRef.current = null;
      return;
    }
    // Primeiro envio latcheia o shell (welcome→active). Idempotente no dono.
    onSend?.();
    setError(null);
    const userMsg: NexoChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    appendMessage(userMsg);
    setLastSent(text);
    setInput("");
    if (sobre) setAchadoAnexado(null);
    // O campo esvaziou por um caminho que não passa pelo `onChange` — sem isto,
    // o orbe continuaria achando que há texto escrito depois de enviado.
    publicarFoco({ focado: focadoRef.current, temTexto: false });

    const assistantId = crypto.randomUUID();
    let started = false;
    setIdDaVez(assistantId);
    setPensamentos((p) => ({ ...p, [assistantId]: { inicio: Date.now(), passos: ["Lendo a pergunta"] } }));

    try {
      /*
       * A PORTA. Com parecer no palco, quem responde é quem tem o documento —
       * MENOS quando o pedido é auditar de novo. Esse ia ao chat da auditoria e
       * dependia do modelo decidir repassar: em 14/09/2026 o "audita o
       * memorial" voltou duas vezes como "Encaminhei a nova auditoria", sem
       * cartão. Ver `pedeNovaAuditoria`.
       */
      if (auditoriaAtual?.salvo.report && !forcarNexo && !pedeNovaAuditoria(text)) {
        passoDoTurno(assistantId, "Consultando o parecer desta auditoria");
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

      /*
       * O relógio começa ANTES da chamada, e não quando o primeiro delta chega:
       * o que o engenheiro sente como demora inclui a espera pelo primeiro
       * caractere, e um número que ignora justamente a parte lenta seria
       * transparência ao contrário.
       */
      const inicioDoTurno = Date.now();
      // O que vai junto com a pergunta: são os fatos sobre os quais ele responde.
      if (selos.length > 0) passoDoTurno(assistantId, `Juntando os ${selos.length} carimbos lidos`);
      if (memorialFatos) passoDoTurno(assistantId, "Juntando o memorial anexado");
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
        primeiraPalavra(assistantId);
        setRevealId(assistantId); // sem streaming, o typewriter ainda vale
        const trace = traceDoTurno({
          selosLidos: selos.length,
          propostas: (payload.turn.proposals ?? []).map((p) => p.kind),
          duracaoMs: Date.now() - inicioDoTurno,
        });
        appendMessage({
          id: assistantId,
          role: "assistant",
          content: payload.turn.reply,
          proposals: payload.turn.proposals,
          slotRequest: payload.turn.slotRequest,
          ldPreview: payload.ldPreview,
          ...(trace ? { trace } : {}),
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
            primeiraPalavra(assistantId);
            appendDelta(assistantId, event.text);
          } else if (event.type === "done") {
            // O trace fecha JUNTO com a mensagem: no `done` o turno inteiro já
            // aconteceu, e é o único momento em que as três parcelas existem.
            const trace = traceDoTurno({
              selosLidos: selos.length,
              propostas: (event.proposals ?? []).map((p) => p.kind),
              duracaoMs: Date.now() - inicioDoTurno,
            });
            finalizeMessage(assistantId, {
              proposals: event.proposals,
              ...(event.slotRequest ? { slotRequest: event.slotRequest } : {}),
              ...(event.ldPreview ? { ldPreview: event.ldPreview } : {}),
              ...(trace ? { trace } : {}),
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
      // Sem palavra nenhuma (só cartão, erro ou parada), o pensamento fecha no fim.
      primeiraPalavra(assistantId);
      setIdDaVez(null);
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
    <div
      ref={colunaRef}
      className={`cx nx-chat flex h-full min-h-0 flex-col${soltandoAchado ? " nx-chat--soltando-achado" : ""}`}
    >
      {/* Quem sabe montar cada tomo — sem tela; o canvas e o cartão curto chamam. */}
      <MontadoresDoVolume selos={selos} pranchas={pranchas} templates={templates} />
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
            <ZonaDeSolta onAnexar={onAttach} arrastando={arrastando} tarefa={tarefa} onUsarExemplo={onUsarExemplo} />
          </div>
        )}
        {/*
          O respiro do fim (`pb-16`) existe para o botão "ir para as últimas
          mensagens": ele é sticky no rodapé do log e ficava POR CIMA da última
          bolha, que é justamente a que se está tentando ler. Sem a folga, o
          atalho para chegar ao fim atrapalhava quem já estava chegando lá.
        */}
        <div className="cx-fio nx-fio">
          {messages.map((m, idx) =>
            m.role === "user" ? (
              /* Você: um bloco suave à direita (Conversa v2). */
              <div key={m.id} className="nx-turno nx-turno--voce">
                <MessageBubble role="user" content={m.content} />
                {m.interrupted && <span className="nx-turno-nota">interrompido</span>}
              </div>
            ) : (
              /*
               * O Nexo: texto limpo, sem caixa, o orbe na margem. Âncora do
               * tour guiado: a resposta é onde ele conta o que leu dos selos.
               */
              <div key={m.id} data-tour="resposta" className="cx-nexo nx-turno">
                <span className="cx-nexo-marca" aria-hidden>
                  <Orbe tamanho={16} />
                </span>
                <div className="cx-nexo-corpo">
                  {/*
                    O TRACE ANTES DA RESPOSTA: é a assinatura do turno, o que
                    aquele Nexo fez para responder — a pergunta que ele responde
                    ("por que ele propôs isso?") nasce antes de a resposta ser lida.
                  */}
                  {m.trace && (
                    <span data-trace-do-turno className="cx-passo">
                      {m.trace}
                    </span>
                  )}
                  {/* Resposta antiga do Nexo cita INC-014; a sigla que se lê é ACH (lib/rotulo-do-achado.ts). */}
                  {/* A resposta já nasceu e a primeira palavra ainda não chegou: o turno não fica mudo. */}
                  {busy && idx === messages.length - 1 && !m.content.trim() ? (
                    pensamentos[m.id] ? <LinhaDoPensamento pensamento={pensamentos[m.id]} pensando /> : <Pensando />
                  ) : (
                    <>
                      {/* Depois da resposta: "Pensou por 1,8 s", que abre nos passos. */}
                      {pensamentos[m.id]?.primeira && <LinhaDoPensamento pensamento={pensamentos[m.id]} pensando={false} />}
                      <MessageBubble role="assistant" content={textoComRotulos(m.content)} reveal={m.id === revealId} />
                    </>
                  )}
                  {m.interrupted && <span className="nx-turno-nota">interrompido</span>}
                  {/* A ficha do anexo: de que projeto são as folhas que entraram.
                      Abaixo do texto e acima dos botões — a ordem em que se
                      decide: leia o que entrou, confira de quem é, então escolha. */}
                  {m.ficha && <FichaDoDropCard ficha={m.ficha} />}
                  {/* A ficha do memorial: o que a capa trouxe, cada linha corrigível. */}
                  {m.fichaDoMemorial && <FichaDoMemorialCard mensagemId={m.id} ficha={m.fichaDoMemorial} ultima={m.id === ultimaFicha} />}
                  {/* A obra corrigida na ficha: levar também ao cadastro do projeto? */}
                  {m.cadastroDaObra && <CadastroDaObraCard mensagemId={m.id} oferta={m.cadastroDaObra} />}
                  {/* UM plano para tudo que sai de capa/LD/separatriz; volume,
                      auditoria e conferência seguem com cartão próprio. */}
                  {m.proposals && m.proposals.length > 0 && (
                    <PlanoDeGeracao
                      proposals={m.proposals}
                      selos={selos}
                      templates={templates}
                      idsBase={idsBaseDosArtefatos(selos)}
                      ldPreview={m.ldPreview}
                      ultimo={m.id === ultimoPlano}
                      /* Gerar no meio da leitura sai curto e calado: o plano
                         tranca o botão enquanto as folhas chegam. */
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
                        pranchas={pranchas}
                        memorialFile={memorialFile}
                        memorialFatos={memorialFatos}
                        mensagemId={m.id}
                      />
                    ))}
                  {/*
                    PERGUNTA JÁ RESPONDIDA SAI (06/10/2026): "Volume 1…4" ficava
                    embaixo da capa já gerada com 6 tomos — botão que preenche um
                    campo de um documento que já existe. Gerado o documento a que
                    a pergunta se refere, o lugar de mudar é o plano, não o chip.
                    O número do VOLUME nunca vira chip: ele se decide no campo
                    âmbar da capa (canvas e plano) — o lápis não dizia nada.
                  */}
                  {m.slotRequest && m.slotRequest.slotId !== "volume" && !results.some((r) => r.kind === m.slotRequest?.taskKind) && (
                    <QuickReplyChips suggestions={m.slotRequest.suggestions} />
                  )}
                  {/* Próximos passos só na última resposta (não polui o histórico). */}
                  {idx === messages.length - 1 && !busy && <NextStepChips proposals={m.proposals} />}
                </div>
              </div>
            ),
          )}
          {/*
            O VOLUME QUE ENVELHECEU — derivado, no fim da conversa.
            Fica FORA do laço de mensagens de propósito: ele nasce quando uma
            peça é regerada depois do volume e some quando o volume é
            remontado. Preso a uma mensagem, ficaria congelado no histórico
            mentindo depois de resolvido.
          */}
          <VolumesDesatualizados selos={selos} temPranchas={pranchas.length > 0} />
          {busy && messages[messages.length - 1]?.role === "user" && (
            <div className="cx-nexo nx-turno">
              <span className="cx-nexo-marca" aria-hidden>
                <Orbe tamanho={16} estado="trabalhando" />
              </span>
              <div className="cx-nexo-corpo">
                {/* A mesma linha de quando a resposta já nasceu vazia: a espera tem um desenho só. */}
                {idDaVez && pensamentos[idDaVez] ? <LinhaDoPensamento pensamento={pensamentos[idDaVez]} pensando /> : <Pensando />}
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
            className="cx-descer nx-descer"
          >
            <ArrowDown size={13} aria-hidden />
            ir para as últimas mensagens
          </button>
        )}
      </div>

      {error && (
        <div className="nx-chat-erro">
          <p role="alert" className="cx-erro">
            {error}
            <button type="button" className="cx-erro-botao" onClick={retry}>
              Tentar de novo
            </button>
          </p>
        </div>
      )}

      {/* O campo, no pé da coluna (Conversa v2). */}
      <div className="nx-chat-pe">
        <div className="nx-chat-pe-dentro">
          <Anexos
            attachments={attachments}
            onRemove={onRemoveAttachment}
            onTrocarPapel={onTrocarPapelAnexo}
            onDefinirPapel={onDefinirPapelAnexo}
            selosLidos={selosLidos}
            lendo={Boolean(readStatus?.busy)}
          />
          {/*
            SÓ ENQUANTO LÊ (teste real de 02/10/2026). Depois da leitura, "7
            folhas de selo lidas — pronto para gerar" ficava aqui com a LD, a
            capa e o volume já prontos: a frase envelhecia no lugar mais visto
            da coluna. O resultado da leitura já está no fio (a resposta do
            Nexo) e no mapa; o memorial anexado, no chip dele.
          */}
          {readStatus?.busy && (
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
          {soltandoAchado && !achadoAnexado && (
            <p className="nx-solta-achado" aria-hidden>
              Solte para perguntar ao Nexo sobre este achado
            </p>
          )}
          {achadoAnexado && (
            <div className={`nx-achado-anexado${chipChegando ? " nx-achado-anexado--chegando" : ""}`} ref={chipRef}>
              <RotuloDaPergunta achado={{ ...achadoAnexado, pergunta: "" }} />
              <button
                type="button"
                className="nx-achado-anexado-tirar"
                aria-label={`Tirar o ${achadoAnexado.id} da pergunta`}
                title="Tirar o achado"
                onClick={() => setAchadoAnexado(null)}
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          )}
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
              !podeGastar
                ? (motivoParaNaoGastar ?? undefined)
                : online
                  ? undefined
                  : "Sem conexão — o que você escrever fica guardado, mas o envio espera a rede voltar."
            }
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Acima disto a lista vira uma parede de chips e some com a conversa. Três, e
 * não quatro (teste real de 02/10/2026): na coluna do chat cabem dois chips por
 * linha, e a bandeja tem duas linhas — com quatro, o "+N arquivos" caía numa
 * terceira, cortada, e sete pranchas pareciam duas.
 */
const ANEXOS_VISIVEIS = 3;

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
  onDefinirPapel,
  selosLidos = [],
  lendo = false,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
  onTrocarPapel?: (id: string) => void;
  onDefinirPapel?: (id: string, papel: "memorial" | "prancha") => void;
  /** Selos já lidos — amarram resultado e anexo pelo nome do arquivo. */
  selosLidos?: readonly SeloLido[];
  lendo?: boolean;
}) {
  const [expandido, setExpandido] = useState(false);

  if (attachments.length === 0) return null;

  const excedente = attachments.length - ANEXOS_VISIVEIS;
  const mostrados = expandido ? attachments : attachments.slice(0, ANEXOS_VISIVEIS);

  return (
    <div className="nx-anexos mb-2 flex flex-wrap items-center gap-2 px-1">
      {mostrados.map((a) => (
        <AttachmentChip
          key={a.id}
          att={a}
          onRemove={onRemove}
          onTrocarPapel={onTrocarPapel}
          onDefinirPapel={onDefinirPapel}
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
          <span className="ds-num shrink-0 text-muted-foreground">
            {folhas} folha{folhas > 1 ? "s" : ""}
          </span>
          <span
            className={
              titulo
                ? "truncate text-foreground"
                : "truncate italic text-muted-foreground"
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
  onDefinirPapel,
  estado = { tipo: "nenhum" },
}: {
  att: Attachment;
  onRemove?: (id: string) => void;
  onTrocarPapel?: (id: string) => void;
  onDefinirPapel?: (id: string, papel: "memorial" | "prancha") => void;
  estado?: EstadoDoAnexo;
}) {
  const viraMemorial = att.papel === "prancha";
  const indeciso = att.papel === "indeciso";
  return (
    <div className="nx-anexo nexodoc-enter nx-edge-6 flex items-center gap-2 py-1 pl-1 pr-1.5 [--nx-fill:var(--nexodoc-recessed)]">
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
        NENHUMA FOLHA LIDA, E FOLHAS DEMAIS PARA ISSO SER NORMAL.

        O caso que trouxe isto (02/09/2026): o `114_19_VOLUME ÚNICO.pdf` é um
        memorial, mas o nome não diz "md" — o roteamento é pelo nome, então ele
        entrou pelo fluxo de prancha. Lá, as 31 folhas A4 retrato sem texto
        foram todas classificadas como "capa" e puladas: zero chamada de modelo,
        zero erro, e a tela dizia "selo ilegível" — que descreve outro problema
        e não aponta saída nenhuma. O engenheiro só descobriu renomeando o
        arquivo no escuro.

        A frase agora diz o que aconteceu, e o botão ao lado ("tratar como
        memorial") é a saída, sem precisar renomear nada.
      */}
      {/*
        MEMORIAL OU PRANCHA? — a pergunta, antes de qualquer leitura.

        O `nao-e-prancha` logo abaixo é o MESMO problema descoberto tarde: ele
        só acorda depois de as 31 folhas terem sido puladas. Este aqui vem do
        pré-voo, e por isso aparece antes de o arquivo ser lido — e o arquivo
        NÃO é lido enquanto ele estiver aceso.

        Âmbar, e não teal: é pendência, e o teal é só do interativo.
      */}
      {indeciso && (
        <span
          className="font-mono text-[10px] uppercase tracking-[0.07em]"
          style={{ color: "var(--status-warning)" }}
          title={
            att.porque
              ? `${att.porque} Escolha ao lado para eu poder continuar.`
              : "Não deu para saber se este PDF é o memorial ou uma prancha. Escolha ao lado."
          }
        >
          memorial ou prancha?
        </span>
      )}
      {estado.tipo === "nao-e-prancha" && (
        <span
          className="font-mono text-[10px] uppercase tracking-[0.07em]"
          style={{ color: "var(--status-warning)" }}
          title={`Nenhuma das ${estado.paginas} folhas parece prancha — nenhum carimbo foi lido. Se este PDF for o memorial, use "tratar como memorial" ao lado para auditá-lo.`}
        >
          não parece prancha
        </span>
      )}
      {/*
        O PAPEL só aparece quando NÃO há como trocá-lo. Com o botão ao lado, os
        dois juntos davam "PRANCHA  é o memorial" — um estado e uma ação
        encostados, sem nada distinguindo qual era qual. O verbo do botão já diz
        o papel atual por oposição.
      */}
      {att.papel && !indeciso && estado.tipo !== "lido" && !onTrocarPapel && (
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
      {/*
        NO INDECISO SÃO DOIS BOTÕES, e não um.

        O botão de trocar tem um verbo só porque existe um papel atual, e o
        verbo diz o outro por oposição ("tratar como memorial" = hoje é
        prancha). No indeciso não há papel atual: um botão só ofereceria metade
        da resposta e a outra metade não teria como ser dita.
      */}
      {indeciso && onDefinirPapel && estado.tipo !== "lido" ? (
        <>
          <button
            type="button"
            onClick={() => onDefinirPapel(att.id, "memorial")}
            title="Tratar este PDF como o memorial (auditar em vez de ler o selo)"
            className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            tratar como memorial
          </button>
          <button
            type="button"
            onClick={() => onDefinirPapel(att.id, "prancha")}
            title="Tratar este PDF como prancha (ler o selo)"
            className="rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25"
          >
            tratar como prancha
          </button>
        </>
      ) : att.papel && !indeciso && onTrocarPapel && estado.tipo !== "lido" ? (
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
      ) : null}
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
 * O NEXO PENSANDO (desenho do lab, ref. Lattice Loader do React Bits): a
 * treliça varrendo, a palavra e o tempo correndo desde que o turno começou.
 * Some quando a primeira palavra chega — é o mesmo lugar onde ela vai entrar.
 */
function Pensando() {
  const [desde] = useState(() => Date.now());
  return (
    <span className="cx-pensando" role="status" aria-label="Nexo está respondendo">
      <Trelica />
      <span>Pensando</span>
      <Cronometro desde={desde} />
    </span>
  );
}

/**
 * O NEGRITO DO MODELO. A resposta vem em markdown leve, e o `**destaque**`
 * aparecia com os asteriscos na tela (teste real de 02/10/2026). Só o negrito
 * vira marcação: o resto continua texto, quebra de linha incluída — um
 * renderizador de markdown inteiro aqui seria superfície demais para um campo
 * que mostra o que um modelo escreveu. Par de asteriscos sem fechar fica como
 * veio (durante o streaming, o fechamento ainda não chegou).
 */
function TextoComNegrito({ texto }: { texto: string }) {
  const partes = texto.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {partes.map((parte, i) =>
        parte.length > 4 && parte.startsWith("**") && parte.endsWith("**") ? <b key={i}>{parte.slice(2, -2)}</b> : parte,
      )}
    </>
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

  /*
   * Conversa v2: a sua fala é um bloco suave (`cx-voce`); a do Nexo é texto
   * limpo (`cx-texto`), sem caixa, e ganha "Copiar resposta" ao passar o
   * mouse — o engenheiro cola no e-mail. A medida de leitura fica em 72ch.
   */
  if (isUser) {
    // A pergunta feita no visor sobre um achado: o rótulo inteiro, não a frase crua.
    const sobre = lerPerguntaSobreAchado(content);
    return (
      <div className="cx-voce nx-voce">
        {sobre && <RotuloDaPergunta achado={sobre} />}
        <p>
          <span className="sr-only">Você: </span>
          {sobre ? sobre.pergunta : shown}
        </p>
      </div>
    );
  }
  return (
    <div className="nx-resposta">
      <p className="cx-texto nx-texto">
        <span className="sr-only">Nexo: </span>
        <TextoComNegrito texto={shown} />
      </p>
      {content.trim() !== "" && (
        <div className="cx-nexo-acoes">
          <button type="button" onClick={() => void navigator.clipboard.writeText(content).then(() => setCopied(true))} aria-label="Copiar resposta">
            <span>
              {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
              {copied ? "Copiado" : "Copiar resposta"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
