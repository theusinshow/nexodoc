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
import { ApiUsageProvider, useApiUsage } from "../state/api-usage";
import { NexoShell } from "./NexoShell";
import { NexoSidebar } from "./NexoSidebar";
import { NexoCopilot } from "./NexoCopilot";
import type { Attachment } from "./NexoChat";
import { NexoCanvas, type PranchaInfo } from "./NexoCanvas";
import { NexoDebugDrawer } from "./NexoDebugDrawer";
import { useAgentState } from "./agent-orb/use-agent-state";

/**
 * Workspace do Nexo (chat-first). "Anexar/soltar PDFs" LÊ os selos das pranchas
 * sozinho (o chat gera LD/capa/conferência/volume/auditoria a partir deles) e
 * separa o memorial (→ auditoria). O intake de projeto inteiro (Anexar pasta →
 * estrutura por volume) vive no `NexoDebugDrawer`, atrás da flag dev — não é
 * conversacional (caso raro). O antigo SelosPanel foi dissolvido (item 3): a
 * geração toda mora no chat.
 */
export function NexoWorkspace() {
  // Providers: conversa (durável) > artefatos (canvas) > composer. O inner usa
  // o store da conversa (fonte única de mensagens + selos, persistidos).
  return (
    <ConversationStoreProvider>
      <ApiUsageProvider>
        <ArtifactStoreProvider>
          <ComposerControllerProvider>
            <NexoWorkspaceInner />
          </ComposerControllerProvider>
        </ArtifactStoreProvider>
      </ApiUsageProvider>
    </ConversationStoreProvider>
  );
}

function NexoWorkspaceInner() {
  const conv = useConversation();
  const { replaceArtifacts } = useArtifactStore();
  const { addTokens } = useApiUsage();
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
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
  // Anexos com preview imediato (imagem = miniatura; PDF = ícone). Só visual.
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dirRef = useRef<HTMLInputElement>(null);

  // SeloForLd[] (fileName + pageNumber + extração) que as rotas consomem.
  const selos = seloResults
    .filter((r) => r.extraction)
    .map((r) => ({ fileName: r.fileName, pageNumber: r.pageNumber, ...r.extraction! }));

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
      const total = pranchas.length + images.length;
      setReadProgress({ done: 0, total });
      try {
        // Pranchas = leitura FRESCA; imagens avulsas APPENDam ao contexto.
        const collected: SeloResult[] = pranchas.length > 0 ? [] : [...seloResults];
        if (pranchas.length > 0) {
          await extractSelosFromFiles(pranchas, (r) => {
            collected.push(r);
            addTokens(r.usage ?? 0); // consumo de IA da leitura do selo
            setSeloResults([...collected]);
            setReadProgress({ done: collected.length, total });
          });
        }
        for (const img of images) {
          const r = await extractSeloFromImage(img);
          collected.push(r);
          addTokens(r.usage ?? 0);
          setSeloResults([...collected]);
          setReadProgress({ done: collected.length, total });
        }
        const okSelos = collected.filter((r) => r.extraction);
        if (okSelos.length > 0) {
          appendSelosIntake(okSelos, [...pdfs, ...images], Boolean(memorial));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler os anexos.");
      } finally {
        setReading(false);
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
        setPranchaFiles([]);
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
        setPranchaFiles([]);
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
  const seloText = reading
    ? `Lendo pranchas… ${readProgress.done}/${readProgress.total}`
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
  const [chatStatus, setChatStatus] = useState({ thinking: false, error: false });
  const handleTurnStatus = useCallback(
    (s: { thinking: boolean; error: boolean }) => setChatStatus(s),
    [],
  );
  const agentState = useAgentState({
    dragging,
    reading: reading || readingMemorial,
    thinking: chatStatus.thinking,
    error: chatStatus.error,
  });

  // Contexto derivado dos selos (o que o Nexo já entendeu) — popover do orb.
  const agentContext = summarizeSelos(selos);

  // Info por prancha (folha + descrição lidas do carimbo pela IA) → canvas.
  const pranchaInfos = useMemo<PranchaInfo[]>(() => {
    const folhas = resolveSheetNumbers(
      seloResults.map((r) => ({
        fileName: r.fileName,
        pageNumber: r.pageNumber,
        arquivo: r.extraction?.arquivo,
        folha: r.extraction?.folha,
      })),
    );
    return seloResults
      .map((r, i) => ({
        folha: folhas[i],
        descricao: (r.extraction?.conteudo || r.extraction?.tituloSecao || "").trim(),
        disciplina: r.extraction?.disciplina ?? "",
      }))
      .filter((p) => p.folha != null || p.descricao)
      .sort((a, b) => (a.folha ?? 9999) - (b.folha ?? 9999));
  }, [seloResults]);

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
        stage={<NexoCanvas pranchasCount={okCount} pranchas={pranchaInfos} />}
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
