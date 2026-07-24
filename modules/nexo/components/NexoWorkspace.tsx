"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { flushSync } from "react-dom";
import type { NexoDossieDraft } from "../types";
import { extractSelosFromFiles, type SeloResult } from "../lib/selo-render";
import { summarizeSelos } from "../lib/agent-context";
import { partitionByRole } from "../lib/attachments";
import { runShellTransition } from "../lib/motion";
import { ComposerControllerProvider } from "../state/composer-controller";
import { ArtifactStoreProvider } from "../state/artifact-store";
import { NexoShell } from "./NexoShell";
import { NexoSidebar } from "./NexoSidebar";
import { NexoCopilot } from "./NexoCopilot";
import { NexoCanvas } from "./NexoCanvas";
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
  const [files, setFiles] = useState<File[]>([]);
  const [folderCount, setFolderCount] = useState(0);
  const [dossie, setDossie] = useState<NexoDossieDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Selos lidos das pranchas: o chat do agente propõe LD/capa a partir deles.
  const [seloResults, setSeloResults] = useState<SeloResult[]>([]);
  // Pranchas originais retidas (bytes p/ montar o volume) e memorial anexado
  // (arquivo distinto — alimenta a auditoria). Partição por tipo do nome.
  const [pranchaFiles, setPranchaFiles] = useState<File[]>([]);
  const [memorialFile, setMemorialFile] = useState<File | null>(null);
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
  const [readProgress, setReadProgress] = useState({ done: 0, total: 0 });

  // Leitura AUTOMÁTICA ao anexar/soltar PDFs. Parte os anexos por tipo do nome:
  // MEMORIAL (md_geral etc.) vai para a auditoria; PRANCHAS viram selos e ficam
  // retidas (bytes p/ o volume). Substitui o passo manual "Ler pranchas".
  async function readSelos(list: FileList | null) {
    const pdfs = list ? Array.from(list).filter((f) => /\.pdf$/i.test(f.name)) : [];
    if (pdfs.length === 0) return;
    const { memorials, pranchas } = partitionByRole(pdfs);
    setError(null);
    if (memorials.length > 0) setMemorialFile(memorials[0]);
    // Batelada só de memorial não mexe nos selos/pranchas já lidos.
    if (pranchas.length === 0) return;
    setPranchaFiles(pranchas);
    setReading(true);
    setReadProgress({ done: 0, total: pranchas.length });
    try {
      const collected: SeloResult[] = [];
      await extractSelosFromFiles(pranchas, (r) => {
        collected.push(r);
        setSeloResults([...collected]);
        setReadProgress({ done: collected.length, total: pranchas.length });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler as pranchas.");
    } finally {
      setReading(false);
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
        setSeloResults([]);
        setPranchaFiles([]);
        setMemorialFile(null);
        setError(null);
        setReading(false);
        setConvId((c) => c + 1);
      }),
    );
  };

  const okCount = seloResults.filter((r) => r.extraction).length;
  const seloText = reading
    ? `Lendo pranchas… ${readProgress.done}/${readProgress.total}`
    : okCount > 0
      ? `${okCount} folha(s) de selo lidas — pronto para gerar.`
      : null;
  const memoText = memorialFile ? `Memorial anexado: ${memorialFile.name}` : null;
  const readStatus =
    seloText || memoText
      ? { text: [seloText, memoText].filter(Boolean).join(" · "), busy: reading }
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
    reading,
    thinking: chatStatus.thinking,
    error: chatStatus.error,
  });

  // Contexto derivado dos selos (o que o Nexo já entendeu) — popover do orb.
  const agentContext = summarizeSelos(selos);

  return (
    <ComposerControllerProvider>
     <ArtifactStoreProvider>
      {/* Overlay de drag-and-drop (chrome imersivo → vidro permitido). */}
      {dragging && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
          aria-hidden
        >
          <div className="nexo-glass flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-ring px-10 py-8 text-center">
            <Upload className="h-8 w-8 text-primary" strokeWidth={1.5} />
            <p className="text-sm font-medium">Solte os PDFs para o Nexo ler</p>
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
      {/* Anexar do composer (chat) → LÊ os selos direto (chat-first). */}
      <input
        ref={attachInputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void readSelos(e.target.files);
          e.target.value = "";
        }}
      />

      <NexoShell
        started={started}
        sidebar={<NexoSidebar onNewConversation={reset} />}
        stage={<NexoCanvas pranchasCount={okCount} />}
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
     </ArtifactStoreProvider>
    </ComposerControllerProvider>
  );
}
