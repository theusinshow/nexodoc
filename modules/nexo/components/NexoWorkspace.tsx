"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { flushSync } from "react-dom";
import type { NexoDossieDraft, NexoSlotSuggestion } from "../types";
import {
  extractSelosFromFiles,
  extractSeloFromImage,
  type SeloResult,
} from "../lib/selo-render";
import { summarizeSelos } from "../lib/agent-context";
import { partitionByRole } from "../lib/attachments";
import { resolveSheetNumbers } from "@/server/nexo/parse-filename";
import { runShellTransition } from "../lib/motion";
import { ComposerControllerProvider } from "../state/composer-controller";
import { ArtifactStoreProvider, useArtifactStore } from "../state/artifact-store";
import {
  ConversationStoreProvider,
  useConversation,
} from "../state/conversation-store";
import {
  ConversationUsageProvider,
  useConversationUsage,
} from "../state/use-conversation-usage";
import { NexoShell } from "./NexoShell";
import { NexoSidebar } from "./NexoSidebar";
import { NexoCopilot } from "./NexoCopilot";
import type { Attachment } from "./NexoChat";
import { NexoCanvas } from "./NexoCanvas";
import { NexoDebugDrawer } from "./NexoDebugDrawer";
import { useAgentState } from "./agent-orb/use-agent-state";
import { folhas, type Ajuste, type FolhaId } from "../lib/folhas";

/**
 * Workspace do Nexo (chat-first). "Anexar/soltar PDFs" LÊ os selos das pranchas
 * sozinho (o chat gera LD/capa/conferência/volume/auditoria a partir deles) e
 * separa o memorial (→ auditoria). O intake de projeto inteiro (Anexar pasta →
 * estrutura por volume) vive no `NexoDebugDrawer`, atrás da flag dev — não é
 * conversacional (caso raro). O antigo SelosPanel foi dissolvido (item 3): a
 * geração toda mora no chat.
 */
export function NexoWorkspace() {
  // Providers: conversa (durável) > consumo de IA (lê o conversationId da
  // conversa) > artefatos (canvas) > composer. UMA instância de consumo,
  // compartilhada entre NexoChat (o anel), ConfirmationCard (refresh pós-
  // auditoria) e este workspace (refresh pós-leitura de selos) — item 2/3 da
  // revisão: cada consumidor tinha seu próprio hook, e o refresh de um não
  // movia o anel do outro.
  return (
    <ConversationStoreProvider>
      <ConversationUsageProvider>
        <ArtifactStoreProvider>
          <ComposerControllerProvider>
            <NexoWorkspaceInner />
          </ComposerControllerProvider>
        </ArtifactStoreProvider>
      </ConversationUsageProvider>
    </ConversationStoreProvider>
  );
}

function NexoWorkspaceInner() {
  const conv = useConversation();
  const { refresh: refreshUsage } = useConversationUsage();
  const { replaceArtifacts } = useArtifactStore();
  // Selos lidos (fonte única = store da conversa; persistem e restauram).
  const seloResults = conv.seloResults;
  const setSeloResults = conv.setSeloResults;

  // Espelha os resultados gerados (durável) no store do canvas — caminho único
  // p/ geração ao vivo E restore. SUBSTITUI o conjunto (não acumula), então o
  // canvas reflete só a conversa ATIVA — sem artefatos de conversas anteriores (#2).
  useEffect(() => {
    replaceArtifacts(
      conv.results
        .filter((r) => r.canvas)
        .map((r) => {
          const pdf = r.files.find((f) => f.mime === "application/pdf");
          return {
            id: r.artifactId,
            kind: r.kind,
            label: r.canvas!.label,
            detail: r.canvas!.detail,
            titulo: r.canvas!.titulo,
            pdfUrl: pdf?.url,
            pageNumber: r.canvas!.pageNumber ?? 1,
          };
        }),
    );
  }, [conv.results, replaceArtifacts]);

  const [files, setFiles] = useState<File[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [dossie, setDossie] = useState<NexoDossieDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Pranchas originais retidas (bytes p/ montar o volume) e memorial anexado
  // (arquivo distinto — alimenta a auditoria). Partição por tipo do nome.
  const [pranchaFiles, setPranchaFiles] = useState<File[]>([]);
  // Object URLs das pranchas abertas pelo canvas, um por arquivo.
  const urlsDasPranchas = useRef(new Map<string, string>());
  // Limpa as pranchas e os object URLs que elas geraram, sem vazar.
  const limparPranchas = useCallback(() => {
    urlsDasPranchas.current.forEach((url) => URL.revokeObjectURL(url));
    urlsDasPranchas.current.clear();
    setPranchaFiles([]);
  }, []);
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
  // Anexos com preview imediato (imagem = miniatura; PDF = ícone). Só visual.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  // SeloForLd[] (fileName + pageNumber + extração) que as rotas consomem.
  /*
   * MEMOIZADO de propósito: esta lista desce até o canvas e entra nas
   * dependências do `useMemo` que monta os nós. Recalculada a cada render, ela
   * recriava TODOS os nós continuamente — o React Flow remontava, a seleção se
   * perdia e o popover de edição fechava no mesmo instante em que abria.
   */
  const selosLidos = useMemo(
    () =>
      seloResults
        .filter((r) => r.extraction)
        .map((r) => ({ fileName: r.fileName, pageNumber: r.pageNumber, ...r.extraction! })),
    [seloResults],
  );

  /*
   * PONTO ÚNICO da projeção. Tudo a jusante — LD, capa, separatriz, volume,
   * canvas — recebe `selos` daqui, então os ajustes manuais entram uma vez só.
   * Aplicá-los em cada consumidor traria de volta a classe de defeito que já
   * mordeu: fatiar um caminho (`selos`) e esquecer o outro (`pranchaFiles`),
   * montando o volume com dados velhos.
   *
   * `conv.ajustes` vem do `useState` do store, então é referência ESTÁVEL entre
   * renders. Um objeto literal aqui recriaria o memo a cada render e remontaria
   * todos os nós do canvas — que foi exatamente o bug do popover que fechava
   * sozinho.
   */
  const selos = useMemo(() => folhas(selosLidos, conv.ajustes), [selosLidos, conv.ajustes]);

  // webkitdirectory nao e prop tipada no React; setar via atributo.
  useEffect(() => {
    if (dirRef.current) {
      dirRef.current.setAttribute("webkitdirectory", "");
      dirRef.current.setAttribute("directory", "");
    }
  }, []);

  async function classifyContent(nextFiles: File[]) {
    if (nextFiles.length === 0) {
      setDossie(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      for (const file of nextFiles) form.append("files", file);
      form.append(
        "relPaths",
        JSON.stringify(
          nextFiles.map(
            (f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || "",
          ),
        ),
      );
      const res = await fetch("/api/nexo/classify", { method: "POST", body: form });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Falha ao ler os arquivos.");
      }
      const payload = (await res.json()) as { dossie: NexoDossieDraft };
      setDossie(payload.dossie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao classificar.");
    } finally {
      setLoading(false);
    }
  }

  async function classifyFolder(list: FileList) {
    const pdfs = Array.from(list).filter((f) => /\.pdf$/i.test(f.name));
    if (pdfs.length === 0) {
      setError("Nenhum PDF na pasta.");
      return;
    }
    setFiles([]); // pasta nao mantem lista por-arquivo (pode ter centenas)
    setFolderCount(pdfs.length);
    setLoading(true);
    setError(null);
    try {
      const items = pdfs.map((f) => ({
        fileName: f.name,
        relPath: (f as File & { webkitRelativePath?: string }).webkitRelativePath || "",
      }));
      const res = await fetch("/api/nexo/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const p = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(p?.error ?? "Falha ao ler a pasta.");
      }
      const payload = (await res.json()) as { dossie: NexoDossieDraft };
      setDossie(payload.dossie);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler a pasta.");
    } finally {
      setLoading(false);
    }
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFolderCount(0);
    const next = [...files, ...Array.from(list)];
    setFiles(next);
    void classifyContent(next);
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    void classifyContent(next);
  }

  // Nova conversa: limpa o estado efêmero e REMONTA o chat (via convId → key).
  const [convId, setConvId] = useState(0);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);
  const [readingMemorial, setReadingMemorial] = useState(false);
  const [readProgress, setReadProgress] = useState({ done: 0, total: 0 });

  const isImageFile = (f: File) =>
    /^image\//i.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(f.name);

  function removeAttachment(id: string) {
    setAttachments((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a?.url) URL.revokeObjectURL(a.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  // Lê a IDENTIDADE do memorial (obra/código/município) pelo conteúdo — reusa a
  // classificação determinística da rota de intake (lê as primeiras páginas).
  async function classifyMemorial(file: File): Promise<NexoDossieDraft | null> {
    const form = new FormData();
    form.append("files", file);
    form.append("relPaths", JSON.stringify([""]));
    const res = await fetch("/api/nexo/classify", { method: "POST", body: form });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { dossie?: NexoDossieDraft } | null;
    return payload?.dossie ?? null;
  }

  // Intake conversacional das PRANCHAS: o anexo vira mensagem + opções clicáveis.
  function appendSelosIntake(okSelos: SeloResult[], files: File[], hasMemorial: boolean) {
    const ctx = summarizeSelos(
      okSelos.map((r) => ({
        fileName: r.fileName,
        arquivo: r.extraction?.arquivo ?? null,
        disciplina: r.extraction?.disciplina ?? null,
        obra: r.extraction?.obra ?? null,
      })),
    );
    const names = files.map((f) => f.name);
    const nameStr =
      names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`;
    const detail = [
      ctx.disciplinas.join(", "),
      ctx.codigo ? `código ${ctx.codigo}` : "",
      ctx.obra ? `obra ${ctx.obra}` : "",
    ]
      .filter(Boolean)
      .join(" · ");

    const suggestions: NexoSlotSuggestion[] = [
      { label: "Criar a LD e a capa", value: "cria a LD e a capa dessas pranchas", commit: "send" },
      { label: "Só a LD", value: "cria a LD dessas pranchas", commit: "send" },
      { label: "Conferir as folhas", value: "confere as folhas", commit: "send" },
    ];
    if (hasMemorial) {
      suggestions.push({ label: "Auditar o memorial", value: "audita o memorial", commit: "send" });
    }

    start();
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: `Anexei ${okSelos.length} folha(s) — ${nameStr}`,
    });
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Li ${okSelos.length} folha(s)${detail ? ` — ${detail}` : ""}. O que você quer que eu faça?`,
      slotRequest: {
        slotId: "intake",
        taskKind: "ld",
        prompt: "O que fazer com as pranchas anexadas",
        optional: true,
        suggestions,
      },
    });
  }

  // Intake conversacional do MEMORIAL: identifica e já propõe auditar/conferir.
  function appendMemorialIntake(memorial: File, dossie: NexoDossieDraft | null) {
    const detail = [
      dossie?.obra,
      dossie?.codigo ? `código ${dossie.codigo}` : "",
      dossie?.municipio,
    ]
      .filter(Boolean)
      .join(" · ");
    start();
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: `Anexei o memorial — ${memorial.name}`,
    });
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Li as primeiras páginas e confirmo: é o memorial descritivo${
        detail ? ` — ${detail}` : ""
      }. Quer que eu audite contra a obra das pranchas?`,
      slotRequest: {
        slotId: "memorial",
        taskKind: "auditoria",
        prompt: "O que fazer com o memorial",
        optional: true,
        suggestions: [
          { label: "Auditar o memorial", value: "audita o memorial", commit: "send" },
          { label: "Auditoria profunda", value: "audita o memorial em profundidade", commit: "send" },
        ],
      },
    });
  }

  // Leitura AUTOMÁTICA ao anexar/soltar. PDFs: parte por tipo do nome — MEMORIAL
  // (md_geral) → identifica + propõe auditar; PRANCHAS → selos + File[] retidas
  // (volume). IMAGENS (foto de carimbo) → OCR pela mesma rota. Preview imediato.
  async function readSelos(list: FileList | null) {
    const all = list ? Array.from(list) : [];
    const pdfs = all.filter((f) => /\.pdf$/i.test(f.name));
    const images = all.filter(isImageFile);
    if (pdfs.length === 0 && images.length === 0) return;
    setError(null);

    // Preview imediato (imagem = miniatura; PDF = ícone).
    const atts: Attachment[] = [
      ...pdfs.map((f) => ({ id: crypto.randomUUID(), name: f.name, kind: "pdf" as const })),
      ...images.map((f) => ({
        id: crypto.randomUUID(),
        name: f.name,
        kind: "image" as const,
        url: URL.createObjectURL(f),
      })),
    ];
    setAttachments((prev) => [...prev, ...atts]);

    const { memorials, pranchas } = partitionByRole(pdfs);
    const memorial = memorials[0] ?? null;
    if (memorial) setMemorialFile(memorial);

    // Caso A: pranchas e/ou imagens → lê selos + intake das pranchas.
    if (pranchas.length > 0 || images.length > 0) {
      if (pranchas.length > 0) setPranchaFiles(pranchas);
      setReading(true);
      setReadProgress({ done: 0, total: 0 });
      try {
        /*
         * O total é em FOLHAS, não em arquivos: um PDF traz N pranchas, e cada
         * uma vira um resultado.
         *
         * Ele é contado ANTES de começar a ler (`onTotalFolhas`), numa passada
         * que só abre a estrutura dos PDFs. Antes o total crescia junto com o
         * progresso — a tela mostrava "19 de 19", depois "20 de 20", e não havia
         * como saber quando ia acabar.
         */
        // Pranchas = leitura FRESCA; imagens avulsas APPENDam ao contexto.
        const collected: SeloResult[] = pranchas.length > 0 ? [] : [...seloResults];
        let totalDeFolhas = images.length;
        if (pranchas.length > 0) {
          await extractSelosFromFiles(
            pranchas,
            (r) => {
              collected.push(r);
              setSeloResults([...collected]);
              setReadProgress({ done: collected.length, total: totalDeFolhas });
            },
            conv.conversationId,
            (folhas) => {
              totalDeFolhas = folhas + images.length;
              setReadProgress({ done: collected.length, total: totalDeFolhas });
            },
          );
        }
        for (const img of images) {
          const r = await extractSeloFromImage(img, conv.conversationId);
          collected.push(r);
          setSeloResults([...collected]);
          setReadProgress({ done: collected.length, total: totalDeFolhas });
        }
        const okSelos = collected.filter((r) => r.extraction);
        if (okSelos.length > 0) {
          appendSelosIntake(okSelos, [...pdfs, ...images], Boolean(memorial));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler os anexos.");
      } finally {
        setReading(false);
        // Selo é o passo mais caro de tokens do fluxo (§3 da spec): o anel não
        // pode ficar mudo até o próximo turno do chat.
        refreshUsage();
      }
      return;
    }

    // Caso B: só memorial → lê as primeiras páginas, identifica e propõe auditar.
    if (memorial) {
      setReadingMemorial(true);
      try {
        const dossie = await classifyMemorial(memorial);
        appendMemorialIntake(memorial, dossie);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler o memorial.");
      } finally {
        setReadingMemorial(false);
      }
    }
  }

  // Latch do shell: o 1º envio desliza welcome→active (chat vai pra direita, o
  // canvas entra no centro). `reset` (Nova conversa) volta ao welcome. Ambos
  // animam pela macro-transição (flushSync p/ o browser tirar os snapshots).
  const [started, setStarted] = useState(false);
  const start = () => {
    if (started) return;
    runShellTransition(() => flushSync(() => setStarted(true)));
  };
  const reset = () => {
    runShellTransition(() =>
      flushSync(() => {
        setStarted(false);
        setFiles([]);
        setFolderCount(0);
        setDossie(null);
        conv.newConversation(); // limpa mensagens + selos no store durável
        limparPranchas();
        setMemorialFile(null);
        setAttachments((prev) => {
          prev.forEach((a) => a.url && URL.revokeObjectURL(a.url));
          return [];
        });
        setError(null);
        setReading(false);
        setConvId((c) => c + 1);
      }),
    );
  };

  // Trocar de conversa (histórico): carrega o registro e restaura o shell.
  const selectConv = async (id: string) => {
    const rec = await conv.selectConversation(id);
    if (!rec) return;
    runShellTransition(() =>
      flushSync(() => {
        setStarted(rec.messages.length > 0 || rec.seloResults.length > 0);
        setFiles([]);
        setFolderCount(0);
        setDossie(null);
        limparPranchas();
        setMemorialFile(null);
        setAttachments((prev) => {
          prev.forEach((a) => a.url && URL.revokeObjectURL(a.url));
          return [];
        });
        setError(null);
        setReading(false);
        setConvId((c) => c + 1);
      }),
    );
  };

  const okCount = seloResults.filter((r) => r.extraction).length;
  const busyReading = reading || readingMemorial;
  /*
   * Fases da leitura, em linguagem de DOCUMENTO. "Abrindo" é o intervalo real
   * entre o clique e a primeira folha voltar (o PDF sendo aberto e paginado):
   * antes ficava mudo, parecendo travado. Depois disso, o que importa é quantas
   * folhas já foram analisadas — não quantos arquivos, nem tokens.
   */
  const seloText = reading
    ? readProgress.total === 0
      ? "Contando as folhas…"
      : `Lendo os selos — ${readProgress.done} de ${readProgress.total} folhas analisadas`
    : readingMemorial
      ? "Lendo o memorial…"
      : okCount > 0
        ? `${okCount} folha(s) de selo lidas — pronto para gerar.`
        : null;
  const memoText =
    memorialFile && !readingMemorial ? `Memorial anexado: ${memorialFile.name}` : null;
  const readStatus =
    seloText || memoText
      ? { text: [seloText, memoText].filter(Boolean).join(" · "), busy: busyReading }
      : null;

  // Ferramentas antigas (intake completo) só com a flag dev.
  const DEBUG = process.env.NEXT_PUBLIC_NEXO_DEBUG === "1";

  // Dropzone global: soltar PDFs em qualquer lugar LÊ OS SELOS. Ref p/ o handler
  // mais novo (evita closure velha sem re-assinar os listeners a cada render).
  const [dragging, setDragging] = useState(false);
  const readSelosRef = useRef(readSelos);
  useEffect(() => {
    readSelosRef.current = readSelos;
  });
  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const fl = e.dataTransfer?.files;
      if (fl && fl.length) void readSelosRef.current(fl);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  // Sinais do app → estado visual do Nexo Core (a esfera reage sem conhecer a IA).
  const [chatStatus, setChatStatus] = useState({
    thinking: false,
    error: false,
    responding: false,
  });
  const handleTurnStatus = useCallback(
    (s: { thinking: boolean; error: boolean; responding: boolean }) => setChatStatus(s),
    [],
  );
  // Cadência do texto que chega: cada delta empurra pra 1, e decai no silêncio.
  // Não existe "fração" no streaming (não se sabe o tamanho final da resposta).
  const [replyPulse, setReplyPulse] = useState(0);
  useEffect(() => {
    if (!chatStatus.responding) {
      // O reset é adiado (rAF): setState SÍNCRONO no corpo do effect encadeia
      // renders — mesma regra do transiente em `use-agent-state`.
      const raf = requestAnimationFrame(() => setReplyPulse(0));
      return () => cancelAnimationFrame(raf);
    }
    const id = setInterval(() => {
      setReplyPulse((p) => (p > 0.55 ? 0.35 : 0.85));
    }, 420);
    return () => clearInterval(id);
  }, [chatStatus.responding]);

  const agentState = useAgentState({
    dragging,
    reading: reading || readingMemorial,
    thinking: chatStatus.thinking,
    responding: chatStatus.responding,
    error: chatStatus.error,
  });

  // Leitura = progresso REAL (done/total). Resposta = cadência do texto.
  const orbActivity =
    reading || readingMemorial
      ? readProgress.total > 0
        ? readProgress.done / readProgress.total
        : 0
      : replyPulse;

  // Contexto derivado dos selos (o que o Nexo já entendeu) — popover do orb.
  const agentContext = summarizeSelos(selos);

  // Número da folha (resolvido entre arquivos) por id — derivação dos selos, não
  // ajuste: por isso mora aqui e não no módulo puro da projeção.
  const numerosDasFolhas = useMemo(() => {
    const resolvidos = resolveSheetNumbers(
      selos.map((f) => ({
        fileName: f.fileName,
        pageNumber: f.pageNumber,
        arquivo: f.arquivo,
        folha: f.folha,
      })),
    );
    const mapa: Record<FolhaId, number | null> = {};
    selos.forEach((f, i) => {
      mapa[f.id] = resolvidos[i] ?? null;
    });
    return mapa;
  }, [selos]);

  // Quais pranchas ainda têm bytes em memória. Numa conversa restaurada isto é
  // vazio: os PDFs de ENTRADA não persistem, só os gerados.
  const arquivosDisponiveis = useMemo(
    () => new Set(pranchaFiles.map((f) => f.name)),
    [pranchaFiles],
  );

  /*
   * Object URL por ARQUIVO, retido num cache. Revogar logo depois do `open`
   * mataria a aba antes de ela carregar o PDF; o cache é limpo no mesmo ponto em
   * que `pranchaFiles` é zerado (nova conversa / trocar de conversa).
   */
  const abrirFolha = useCallback(
    (id: FolhaId) => {
      const folha = selos.find((f) => f.id === id);
      if (!folha) return;
      const file = pranchaFiles.find((f) => f.name === folha.fileName);
      if (!file) return;
      let url = urlsDasPranchas.current.get(file.name);
      if (!url) {
        url = URL.createObjectURL(file);
        urlsDasPranchas.current.set(file.name, url);
      }
      window.open(`${url}#page=${folha.pageNumber ?? 1}`, "_blank", "noopener,noreferrer");
    },
    [selos, pranchaFiles],
  );

  /*
   * Texto vazio DESFAZ o ajuste: `aplicarAjuste` apaga o campo quando o patch traz
   * `undefined`, e a folha volta a mostrar o que o selo dizia. A projeção também
   * trata string em branco como ausente — as duas defesas existem porque um título
   * vazio na LD é pior do que um título errado: some do documento sem avisar.
   */
  const corrigirFolha = useCallback(
    (id: FolhaId, titulo: string) => {
      conv.ajustarFolha(id, { titulo: titulo.trim() ? titulo : undefined });
    },
    [conv],
  );

  /*
   * O arrasto no canvas escreve `grupo` e `ordem`, e a montagem lê a projeção —
   * então regerar sai na organização desenhada à mão. A lista chega inteira
   * porque um arrasto de seleção grande não pode virar 30 gravações.
   */
  const moverFolhas = useCallback(
    (entradas: { id: FolhaId; patch: Ajuste }[]) => {
      conv.ajustarFolhas(entradas);
    },
    [conv],
  );

  /*
   * Desfaz a divisão desenhada à mão. Apaga SÓ o `grupo`: a ordem e os títulos
   * corrigidos ficam, porque não são divisão — quem desfaz o agrupamento não
   * está pedindo para perder o texto que reescreveu.
   */
  const voltarAoAutomatico = useCallback(() => {
    const comGrupo = selos.filter((f) => f.grupo !== undefined);
    if (comGrupo.length === 0) return;
    conv.ajustarFolhas(comGrupo.map((f) => ({ id: f.id, patch: { grupo: undefined } })));
  }, [conv, selos]);

  return (
    <>
      {/* Overlay de drag-and-drop (chrome imersivo → vidro permitido). */}
      {dragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          aria-hidden
        >
          <div className="nexo-glass flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ring px-10 py-8 text-center">
            <Upload className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <p className="text-sm font-medium">Solte PDFs ou imagens para o Nexo ler</p>
          </div>
        </div>
      )}

      {/* Inputs de arquivo SEMPRE montados: welcome e stage compartilham os refs. */}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={dirRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void classifyFolder(e.target.files);
          e.target.value = "";
        }}
      />
      {/* Anexar do composer (chat) → LÊ os selos direto (PDF ou imagem de carimbo). */}
      <input
        ref={attachInputRef}
        type="file"
        accept="application/pdf,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void readSelos(e.target.files);
          e.target.value = "";
        }}
      />

      <NexoShell
        started={started}
        sidebar={
          <NexoSidebar
            onNewConversation={reset}
            conversations={conv.conversations}
            activeId={conv.conversationId}
            onSelect={selectConv}
            onDelete={conv.removeConversation}
          />
        }
        stage={
          <NexoCanvas
            folhas={selos}
            numeros={numerosDasFolhas}
            arquivosDisponiveis={arquivosDisponiveis}
            onAbrirFolha={abrirFolha}
            onCorrigirFolha={corrigirFolha}
            onMoverFolhas={moverFolhas}
            onVoltarAoAutomatico={voltarAoAutomatico}
          />
        }
        copilot={
          <NexoCopilot
            key={convId}
            started={started}
            selos={selos}
            onSend={start}
            onAttach={() => attachInputRef.current?.click()}
            readStatus={readStatus}
            agentState={agentState}
            fileCount={okCount}
            activity={orbActivity}
            context={agentContext}
            pranchaFiles={pranchaFiles}
            memorialFile={memorialFile}
            attachments={attachments}
            onRemoveAttachment={removeAttachment}
            onTurnStatus={handleTurnStatus}
          />
        }
      />

      {DEBUG && (
        <NexoDebugDrawer
          files={files}
          folderCount={folderCount}
          dossie={dossie}
          loading={loading}
          error={error}
          onPickFiles={() => inputRef.current?.click()}
          onPickFolder={() => dirRef.current?.click()}
          onRemoveFile={removeFile}
        />
      )}
    </>
  );
}
