"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import type { NexoDossieDraft, NexoSlotSuggestion } from "../types";
import {
  extractSelosFromFiles,
  extractSeloFromImage,
  chaveDaFolha,
  preencherTitulosFaltantes,
  seloNaoLido,
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
import { FaixaDeEstado } from "./FaixaDeEstado";
import { NexoShell } from "./NexoShell";
import { NexoSidebar } from "./NexoSidebar";
import { NexoCopilot } from "./NexoCopilot";
import type { Attachment } from "./NexoChat";
import { NexoCanvas } from "./NexoCanvas";
import { PalcoDoNexo } from "./PalcoDoNexo";
import { TourDoNexo } from "./TourDoNexo";
import { criarProjetoExemplo, ID_CONVERSA_EXEMPLO } from "../lib/projeto-exemplo";

/** Marca de quem já viu o passo a passo. Local ao navegador, como a conversa. */
const CHAVE_TOUR_VISTO = "nexo:tour-visto";
import { AuditoriaStoreProvider, useAuditoria } from "../state/auditoria-store";
import { NexoDebugDrawer } from "./NexoDebugDrawer";
import { useAgentState } from "./agent-orb/use-agent-state";
import {
  ehAvulsa,
  folhas,
  folhasRemovidas,
  ordenarPorPagina,
  type Ajuste,
  type Folha,
  type FolhaId,
} from "../lib/folhas";
import { codigoDaFolha } from "../lib/disciplina-da-folha";
import { useConexao } from "../lib/use-conexao";
import { duracaoLegivel, useSessaoExpirada } from "../lib/use-sessao-expirada";

/**
 * Workspace do Nexo (chat-first). "Anexar/soltar PDFs" LÊ os selos das pranchas
 * sozinho (o chat gera LD/capa/conferência/volume/auditoria a partir deles) e
 * separa o memorial (→ auditoria). O intake de projeto inteiro (Anexar pasta →
 * estrutura por volume) vive no `NexoDebugDrawer`, atrás da flag dev — não é
 * conversacional (caso raro). O antigo SelosPanel foi dissolvido (item 3): a
 * geração toda mora no chat.
 */
export function NexoWorkspace({
  isAdmin = false,
  nome,
}: {
  isAdmin?: boolean;
  /** Nome de quem está logado (da sessão) — a saudação da entrada usa o primeiro. */
  nome?: string | null;
}) {
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
            {/* A auditoria em curso é do PALCO, não do cartão que a disparou. */}
            <AuditoriaStoreProvider>
              <NexoWorkspaceInner isAdmin={isAdmin} nome={nome} />
            </AuditoriaStoreProvider>
          </ComposerControllerProvider>
        </ArtifactStoreProvider>
      </ConversationUsageProvider>
    </ConversationStoreProvider>
  );
}

function NexoWorkspaceInner({
  isAdmin,
  nome,
}: {
  isAdmin: boolean;
  nome?: string | null;
}) {
  const auditandoAgora = Boolean(useAuditoria().emCurso);
  const { online } = useConexao();
  const { expirada: sessaoExpirada, desdeMs } = useSessaoExpirada();
  // Os bytes de cada anexo, por id do chip — é o que permite REFAZER a leitura
  // quando o papel lido do nome do arquivo é corrigido à mão.
  const arquivosPorAnexo = useRef(new Map<string, File>());
  /*
   * Geração da leitura em curso. Corrigir o papel de um anexo INVALIDA a leitura
   * anterior: sem isto, o OCR de selo disparado sobre um memorial mal nomeado
   * seguia rodando depois da correção e despejava as 132 páginas do documento no
   * contexto como se fossem pranchas. O estrago não era só desperdício — com
   * selos falsos na conversa, o cartão passava a dizer "obra lida do carimbo das
   * pranchas, fonte independente do memorial" sobre o próprio memorial.
   */
  const geracaoDaLeitura = useRef(0);
  /**
   * A leitura em voo. Um segundo lote solto no meio da primeira leitura ESPERA
   * a anterior terminar, em vez de correr junto com ela.
   *
   * Sem a fila, a segunda leitura bumpava a geração e invalidava a primeira: as
   * folhas já lidas eram descartadas no meio do caminho, e cada uma delas é uma
   * chamada de modelo que já foi paga.
   */
  const leituraEmVoo = useRef<Promise<void>>(Promise.resolve());
  const conv = useConversation();
  const { refresh: refreshUsage } = useConversationUsage();
  const { replaceArtifacts } = useArtifactStore();
  // Selos lidos (fonte única = store da conversa; persistem e restauram).
  const seloResults = conv.seloResults;
  const setSeloResults = conv.setSeloResults;
  /*
   * Espelho dos selos para quem roda DEPOIS do render que o criou — a leitura
   * enfileirada começa minutos após o drop, e a closure dela veria a lista de
   * antes. É o mesmo motivo do `readSelosRef`.
   */
  const selosRef = useRef(seloResults);
  useEffect(() => {
    selosRef.current = seloResults;
  });

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
  /** Formato recusado no último drop. Some sozinho: é aviso, não estado. */
  const [recusa, setRecusa] = useState<string | null>(null);
  /**
   * Leitura de selos que parou no meio. Guarda os ARQUIVOS para poder retomar —
   * sem eles, "retomar" só poderia oferecer começar de novo, que é o custo que
   * a retomada existe para evitar.
   */
  const [leituraIncompleta, setLeituraIncompleta] = useState<{
    arquivos: File[];
    imagens: File[];
    lidas: number;
    total: number;
    motivo: string;
  } | null>(null);
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
      /*
       * A ORDEM DO PAPEL entra AQUI, e não na leitura.
       *
       * Aqui é o ponto único por onde todo mundo enxerga as folhas, então
       * ordenar neste lugar conserta o canvas, a divisão em tomos e a montagem
       * de uma vez — e também as conversas JÁ SALVAS com a ordem embaralhada,
       * que uma correção lá na leitura não alcançaria.
       */
      ordenarPorPagina(seloResults)
        /*
         * A folha que FALHOU entra assim mesmo, com o selo vazio.
         *
         * Filtrá-la fora era o "pulou prancha": a página cuja leitura caía no
         * timeout desaparecia do conjunto, sem erro na tela, e a conversa
         * anunciava "Li 14 folha(s)" de um PDF de 16. Aqui a folha existe, a
         * contagem fecha, e o popover "Corrigir" resolve o resto.
         *
         * A página IGNORADA continua de fora, e é o oposto: capa, separatriz e
         * índice não são folha nenhuma, e inventar linha para elas na LD seria
         * o defeito na direção contrária.
         */
        .filter((r) => r.extraction ?? (r.error && !r.ignorada))
        .map((r) => ({
          fileName: r.fileName,
          pageNumber: r.pageNumber,
          ...(r.extraction ?? seloNaoLido()),
        })),
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
  const selos = useMemo(
    () => folhas(selosLidos, conv.ajustes, conv.avulsas),
    [selosLidos, conv.ajustes, conv.avulsas],
  );

  /*
   * As folhas tiradas do conjunto. Saem da projeção (não entram em documento
   * nenhum) mas continuam existindo aqui, para a barra do canvas poder
   * desfazer — remoção sem volta obrigaria a reler as pranchas, e reler custa
   * uma chamada de modelo por página.
   */
  const removidas = useMemo(
    () => folhasRemovidas(selosLidos, conv.ajustes),
    [selosLidos, conv.ajustes],
  );

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
    arquivosPorAnexo.current.delete(id);
    setAttachments((prev) => {
      const a = prev.find((x) => x.id === id);
      if (a?.url) URL.revokeObjectURL(a.url);
      return prev.filter((x) => x.id !== id);
    });
  }

  /**
   * Corrige o papel de um PDF quando o nome do arquivo mentiu.
   *
   * A partição usa a convenção (`md`/`memorial`): um `ESCOLA_JOSE_GIASSI_REV_A.pdf`
   * que é memorial vira prancha, entra no OCR de selo e a auditoria nunca é
   * oferecida — sem erro e sem saída. Trocar o papel REFAZ a leitura pelo
   * caminho certo, porque um rótulo novo sobre a leitura errada não muda nada:
   * o que decide a auditoria é o que foi lido, não como o chip está escrito.
   */
  async function trocarPapelAnexo(id: string) {
    const file = arquivosPorAnexo.current.get(id);
    const att = attachments.find((a) => a.id === id);
    if (!file || !att?.papel) return;
    const viraMemorial = att.papel === "prancha";
    setError(null);
    /*
     * Invalida a leitura em voo ANTES de qualquer coisa.
     *
     * Sem isto, o OCR disparado sobre o arquivo mal classificado continuava e
     * seguia empurrando resultados: as páginas do memorial entravam no contexto
     * como pranchas, e aí o cartão passava a anunciar "obra lida do carimbo das
     * pranchas — fonte independente do memorial" sobre o próprio memorial. Uma
     * independência que não existe é pior do que gabarito vazio.
     */
    geracaoDaLeitura.current++;
    setReading(false);
    setAttachments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, papel: viraMemorial ? "memorial" : "prancha" } : a,
      ),
    );

    if (viraMemorial) {
      // Sai do conjunto de pranchas e some do contexto de selos: manter o selo
      // de um documento que não é prancha sujaria a LD e o volume.
      setPranchaFiles((prev) => prev.filter((f) => f.name !== file.name));
      setSeloResults(seloResults.filter((r) => r.fileName !== file.name));
      setMemorialFile(file);
      void conv.salvarMemorial(file);
      setReadingMemorial(true);
      try {
        const lido = await classifyMemorial(file, true);
        setDossie(lido);
        // Os fatos vão para o disco junto do arquivo: retê-lo sem a identidade
        // devolveria, na conversa restaurada, um "Auditar" com gabarito vazio.
        conv.salvarDossieDoMemorial(lido);
        appendMemorialIntake(file, lido);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao ler o memorial.");
      } finally {
        setReadingMemorial(false);
      }
      return;
    }

    // Virou prancha: deixa de ser o memorial e passa pela leitura de selo.
    setMemorialFile(null);
    void conv.salvarMemorial(null);
    setDossie(null);
    setPranchaFiles((prev) => [...prev, file]);
    setReading(true);
    setReadProgress({ done: 0, total: 0 });
    try {
      const colhidos: SeloResult[] = [...seloResults];
      await extractSelosFromFiles(
        [file],
        (r) => {
          colhidos.push(r);
          setSeloResults([...colhidos]);
          setReadProgress({ done: colhidos.length, total: colhidos.length });
        },
        conv.conversationId,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao ler o selo.");
    } finally {
      setReading(false);
      refreshUsage();
    }
  }

  // Lê a IDENTIDADE do memorial (obra/código/município) pelo conteúdo — reusa a
  // classificação determinística da rota de intake (lê as primeiras páginas).
  async function classifyMemorial(
    file: File,
    // Quando o papel foi corrigido À MÃO, o nome do arquivo não vale como
    // palpite: sem isto a rota não lê o conteúdo e devolve identidade vazia.
    forcarMemorial = false,
  ): Promise<NexoDossieDraft | null> {
    const form = new FormData();
    form.append("files", file);
    form.append("relPaths", JSON.stringify([""]));
    if (forcarMemorial) form.append("forcarMemorial", "1");
    const res = await fetch("/api/nexo/classify", { method: "POST", body: form });
    if (!res.ok) return null;
    const payload = (await res.json().catch(() => null)) as { dossie?: NexoDossieDraft } | null;
    return payload?.dossie ?? null;
  }

  // Intake conversacional das PRANCHAS: o anexo vira mensagem + opções clicáveis.
  function appendSelosIntake(
    okSelos: SeloResult[],
    files: File[],
    hasMemorial: boolean,
    /**
     * O que NÃO virou folha lida. Chega separado porque a mensagem é o único
     * lugar em que o engenheiro fica sabendo — e antes ela contava só os
     * acertos: "Li 14 folha(s)" de um PDF de 16, sem uma palavra sobre as
     * outras duas. Uma contagem que só conta o que deu certo é a forma mais
     * cara de esconder um defeito.
     */
    naoLidas: { falhas: SeloResult[]; ignoradas: SeloResult[] } = { falhas: [], ignoradas: [] },
  ) {
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

    /*
     * As duas ressalvas dizem coisas diferentes e por isso não se juntam. A
     * capa pulada é o comportamento CERTO e só precisa ser transparente; a
     * folha que falhou é um problema, ela está no canvas em branco, e a frase
     * tem de dizer o que fazer com ela.
     */
    const ressalvas: string[] = [];
    if (naoLidas.ignoradas.length > 0) {
      ressalvas.push(
        `${naoLidas.ignoradas.length} página(s) não são prancha (capa, separatriz ou índice) e ficaram de fora`,
      );
    }
    if (naoLidas.falhas.length > 0) {
      const quais = naoLidas.falhas
        .slice(0, 3)
        .map((r) => `${r.fileName} p.${r.pageNumber}`)
        .join(", ");
      ressalvas.push(
        `${naoLidas.falhas.length} folha(s) não deram para ler (${quais}${naoLidas.falhas.length > 3 ? " …" : ""}) — estão no canvas em branco, dá para corrigir à mão ou tentar de novo`,
      );
    }
    const ressalva = ressalvas.length > 0 ? ` ${ressalvas.join("; ")}.` : "";

    start();
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "user",
      content: `Anexei ${okSelos.length} folha(s) — ${nameStr}`,
    });
    conv.appendMessage({
      id: crypto.randomUUID(),
      role: "assistant",
      content: `Li ${okSelos.length} folha(s)${detail ? ` — ${detail}` : ""}.${ressalva} O que você quer que eu faça?`,
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
    /*
     * Só os campos que a classificação LÊ de fato: obra, órgão, município e
     * código. O desenho falava também em endereço — o classificador não extrai
     * endereço, e afirmar um dado que não foi lido é pior do que não mostrá-lo.
     */
    const detail = [
      dossie?.obra,
      dossie?.orgao,
      dossie?.municipio,
      dossie?.codigo ? `código ${dossie.codigo}` : "",
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
      content:
        `Li as primeiras páginas: é o memorial descritivo${detail ? ` — ${detail}` : ""}.\n\n` +
        `Vou auditar usando essa obra como referência. Se o nome estiver errado, ` +
        `me diga o correto — é ele que denuncia texto reaproveitado de outro projeto.`,
      slotRequest: {
        slotId: "memorial",
        taskKind: "auditoria",
        prompt: "O que fazer com o memorial",
        optional: true,
        suggestions: [
          { label: "Auditar o memorial", value: "audita o memorial", commit: "send" },
          { label: "Auditoria profunda", value: "audita o memorial em profundidade", commit: "send" },
          // `fill` escreve no composer e deixa o cursor: corrigir a obra exige
          // texto, e é a correção que transforma o gabarito em régua confiável.
          { label: "A obra está errada", value: "a obra correta é ", commit: "fill" },
        ],
      },
    });
  }

  // Leitura AUTOMÁTICA ao anexar/soltar. PDFs: parte por tipo do nome — MEMORIAL
  // (md_geral) → identifica + propõe auditar; PRANCHAS → selos + File[] retidas
  // (volume). IMAGENS (foto de carimbo) → OCR pela mesma rota. Preview imediato.
  /**
   * Retoma a leitura de onde parou: relê SÓ as folhas que faltaram.
   *
   * O conjunto de já-lidas vem dos selos que estão no estado — cada um carrega
   * o arquivo e a página, então a chave é exata. Sem isso, "tentar de novo"
   * pagaria de novo por tudo que já deu certo.
   */
  async function retomarLeitura() {
    const pendente = leituraIncompleta;
    if (!pendente) return;
    setLeituraIncompleta(null);
    setError(null);
    const jaLidas = new Set(
      seloResults.map((r) => chaveDaFolha(r.fileName, r.pageNumber)),
    );
    await lerPranchas(pendente.arquivos, pendente.imagens, null, jaLidas);
  }

  async function readSelos(list: FileList | null) {
    const all = list ? Array.from(list) : [];
    const pdfs = all.filter((f) => /\.pdf$/i.test(f.name));
    const images = all.filter(isImageFile);

    /*
     * ARQUIVO RECUSADO. Antes, soltar um .dwg não fazia NADA — sem aviso, sem
     * erro, sem pista. O engenheiro concluía que o software tinha travado, e a
     * verdade é que ele exportou do CAD e soltou o arquivo errado, que é um
     * engano de dez segundos quando alguém avisa.
     */
    const recusados = all.filter((f) => !pdfs.includes(f) && !images.includes(f));
    if (recusados.length > 0) {
      const exts = [
        ...new Set(
          recusados.map((f) => (f.name.split(".").pop() ?? "").toUpperCase()),
        ),
      ].filter(Boolean);
      setRecusa(
        `${exts.join(", ") || "Este formato"} não é aceito. O Nexo lê o carimbo de PDF — exporte a prancha em PDF e solte de novo.`,
      );
    } else {
      setRecusa(null);
    }

    if (pdfs.length === 0 && images.length === 0) return;
    setError(null);

    // Preview imediato (imagem = miniatura; PDF = ícone).
    const papelLido = new Set(partitionByRole(pdfs).memorials.map((f) => f.name));
    const atts: Attachment[] = [
      ...pdfs.map((f) => {
        // Guarda o File por id: sem isso, corrigir o papel depois não teria com
        // o que refazer a leitura — só repintaria o rótulo.
        const id = crypto.randomUUID();
        arquivosPorAnexo.current.set(id, f);
        return {
          id,
          name: f.name,
          kind: "pdf" as const,
          papel: papelLido.has(f.name) ? ("memorial" as const) : ("prancha" as const),
        };
      }),
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
    if (memorial) {
      setMemorialFile(memorial);
      // Retido para poder auditar DE NOVO depois — inclusive numa conversa
      // restaurada, que é onde o veredito parcial manda rodar outra vez.
      void conv.salvarMemorial(memorial);
    }

    /*
     * Caso A: pranchas e/ou imagens → lê selos + intake das pranchas.
     *
     * ENFILEIRADO. Soltar um segundo lote antes de o primeiro terminar é o que o
     * engenheiro faz quando lembra da outra disciplina — e antes isso descartava
     * a leitura em curso, jogando fora as folhas já pagas. Agora a segunda
     * espera a primeira e SOMA a ela (ver `lerPranchas`).
     */
    if (pranchas.length > 0 || images.length > 0) {
      const anterior = leituraEmVoo.current;
      const minha = (async () => {
        await anterior.catch(() => {});
        await lerPranchas(pranchas, images, memorial);
      })();
      leituraEmVoo.current = minha;
      await minha;
      return;
    }

    // Caso B: só memorial → lê as primeiras páginas, identifica e propõe auditar.
    if (memorial) {
      await lerSoMemorial(memorial);
    }
  }

  /**
   * A leitura dos selos, num lugar só — para o caminho normal e para a RETOMADA.
   *
   * `jaLidas` chega vazio na primeira vez e preenchido quando se retoma: as
   * folhas ali dentro não são relidas, e cada uma delas é uma chamada de modelo
   * que não acontece.
   */
  async function lerPranchas(
    pranchas: File[],
    images: File[],
    memorial: File | null,
    jaLidas?: ReadonlySet<string>,
  ) {
    /*
     * O QUE JÁ FOI LIDO NUNCA É RELIDO — nem na retomada de uma leitura que
     * quebrou, nem num segundo lote solto por cima do primeiro. Os dois casos
     * são o mesmo: há folhas na conversa, e reler qualquer uma delas é pagar
     * duas vezes pela mesma página.
     *
     * Vem de `selosRef` e não da closure porque a leitura enfileirada roda
     * depois — a lista da closure seria a de antes do lote anterior.
     */
    const base =
      jaLidas ??
      new Set(selosRef.current.map((r) => chaveDaFolha(r.fileName, r.pageNumber)));
    const retomando = base.size > 0;
    jaLidas = base;
    /*
     * As pranchas SOMAM. Antes o segundo lote substituía o primeiro, e o
     * engenheiro que soltasse HIS e depois INC ficava com os chips das duas
     * disciplinas na tela e os selos de uma só — a montagem via meio volume.
     * Dedup por nome: soltar o mesmo arquivo de novo não o duplica.
     */
    if (pranchas.length > 0) {
      setPranchaFiles((prev) => {
        if (!retomando) return pranchas;
        const nomes = new Set(prev.map((f) => f.name));
        return [...prev, ...pranchas.filter((f) => !nomes.has(f.name))];
      });
    }
    setReading(true);
    // Esta leitura vale enquanto ninguém corrigir o papel de um anexo.
    const geracao = ++geracaoDaLeitura.current;
    const atual = () => geracaoDaLeitura.current === geracao;
    /*
     * Declarados FORA do `try` de propósito: é o `catch` que precisa saber
     * quantas folhas entraram antes da falha, e é isso que a retomada usa.
     * Dentro do bloco, esse número morria junto com o erro.
     *
     * Retomando, `collected` começa com o que já foi lido — senão o progresso
     * voltaria a "0 de 24" numa leitura que já tem 17 folhas prontas.
     */
    const collected: SeloResult[] =
      retomando || pranchas.length === 0 ? [...selosRef.current] : [];
    let totalDeFolhas = images.length;
    setReadProgress({ done: collected.length, total: 0 });
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
        if (pranchas.length > 0) {
          await extractSelosFromFiles(
            pranchas,
            (r) => {
              if (!atual()) return;
              collected.push(r);
              /*
               * O espelho é atualizado AQUI, não pelo effect: o lote seguinte
               * começa assim que este termina, e o effect só roda depois do
               * render. Confiar nele deixava a base da soma uma ou duas folhas
               * atrasada — e a folha que faltava sumia da conversa.
               */
              selosRef.current = [...collected];
              setSeloResults([...collected]);
              setReadProgress({ done: collected.length, total: totalDeFolhas });
            },
            conv.conversationId,
            (folhas) => {
              if (!atual()) return;
              totalDeFolhas = folhas + images.length;
              setReadProgress({ done: collected.length, total: totalDeFolhas });
            },
            jaLidas,
          );
        }
        for (const img of images) {
          if (!atual()) break;
          const r = await extractSeloFromImage(img, conv.conversationId);
          collected.push(r);
          selosRef.current = [...collected];
          setSeloResults([...collected]);
          setReadProgress({ done: collected.length, total: totalDeFolhas });
        }
        // Leitura invalidada por uma correção de papel: nada dela entra no
        // contexto, nem como mensagem, nem como selo.
        if (!atual()) return;

        /*
         * O TÍTULO QUE FALTOU é preenchido pela geometria do carimbo, de graça.
         *
         * O modelo erra o campo CONTEÚDO em algumas folhas de todo projeto
         * grande — no primeiro real, sete de 71 —, e título vazio é linha vazia
         * na coluna DESCRIÇÃO da LD. Aqui os arquivos ainda estão em mãos e o
         * texto já foi lido: custa uma releitura de texto, nenhuma chamada de
         * modelo.
         */
        if (pranchas.length > 0) {
          try {
            const n = await preencherTitulosFaltantes(pranchas, collected);
            if (n > 0 && atual()) {
              selosRef.current = [...collected];
              setSeloResults([...collected]);
            }
          } catch {
            // Preencher é um bônus: falhar aqui não pode derrubar a leitura
            // inteira, que já custou uma chamada por página.
          }
        }
        const okSelos = collected.filter((r) => r.extraction);
        const naoLidas = {
          falhas: collected.filter((r) => !r.extraction && !r.ignorada),
          ignoradas: collected.filter((r) => r.ignorada),
        };
        // Basta UMA folha ter falhado para a mensagem valer: o caso ruim é
        // justamente o das zero leituras boas, em que antes não se dizia nada.
        if (okSelos.length > 0 || naoLidas.falhas.length > 0) {
          appendSelosIntake(okSelos, [...pranchas, ...images], Boolean(memorial), naoLidas);
        }
        /*
         * Vindo memorial junto das pranchas, ele TAMBÉM é classificado.
         *
         * Antes a classificação só rodava quando o memorial chegava sozinho — na
         * conversa mista, a auditoria ia sem prefeitura e sem município. É o
         * caso mais valioso justamente porque a obra do carimbo é fonte
         * independente: o confronto entre as duas leituras é o que denuncia
         * memorial reaproveitado de outro projeto.
         */
        if (memorial) {
          const lidoDoMemorial = await classifyMemorial(memorial);
          setDossie(lidoDoMemorial);
          conv.salvarDossieDoMemorial(lidoDoMemorial);
        }
      } catch (err) {
        if (atual()) {
          const motivo = err instanceof Error ? err.message : "Erro ao ler os anexos.";
          setError(motivo);
          /*
           * O QUE JÁ FOI LIDO NÃO SE PERDE.
           *
           * Ler o selo é uma chamada de modelo POR PÁGINA. Uma leitura de 24
           * pranchas que quebra na 18ª custou 17 chamadas — recomeçar do zero
           * as joga fora e cobra de novo. Guardamos os arquivos e o que já
           * entrou para retomar exatamente de onde parou.
           */
          setLeituraIncompleta({
            arquivos: pranchas,
            imagens: images,
            lidas: collected.length,
            total: totalDeFolhas,
            motivo,
          });
        }
      } finally {
        // Quem invalidou já assumiu o `reading` do próprio caminho — desligá-lo
        // aqui apagaria o progresso da leitura nova.
        if (atual()) setReading(false);
        // Selo é o passo mais caro de tokens do fluxo (§3 da spec): o anel não
        // pode ficar mudo até o próximo turno do chat.
        refreshUsage();
      }
  }

  /** Caso B: só memorial → lê as primeiras páginas e propõe auditar. */
  async function lerSoMemorial(memorial: File) {
    {
      setReadingMemorial(true);
      try {
        const lido = await classifyMemorial(memorial);
        /*
         * GUARDAR, e não só anunciar.
         *
         * A classificação era lida numa const local: o chat dizia "é o memorial
         * do Centro Comunitário Primeira Linha" e, dois cliques depois, o cartão
         * mostrava obra "?" — porque o estado seguia vazio. A auditoria então
         * rodava SEM gabarito, comparando o documento consigo mesmo, cega
         * exatamente para o erro que originou este produto: memorial emitido com
         * o nome de outra obra.
         */
        setDossie(lido);
        // E no disco, junto do arquivo — senão a conversa restaurada oferece
        // auditar com o gabarito vazio, que é o mesmo defeito por outra porta.
        conv.salvarDossieDoMemorial(lido);
        appendMemorialIntake(memorial, lido);
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
        /*
         * Auditoria em voo também "começa" a conversa. Sem isto o shell abria no
         * layout de boas-vindas, que não tem palco — e a análise retomada não
         * teria onde aparecer, mesmo tendo sido recuperada com sucesso.
         */
        setStarted(
          rec.messages.length > 0 ||
            rec.seloResults.length > 0 ||
            Boolean(rec.auditoriaPendente),
        );
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
    /*
     * Traz de volta os BYTES do memorial, se esta conversa os reteve.
     *
     * Fora da transição do shell de propósito: é leitura assíncrona do
     * IndexedDB, e prender o slide a ela deixaria a troca de conversa travada
     * esperando um arquivo que nem sempre existe. O chip de anexo não volta —
     * ele pertence ao momento do envio; o que volta é a capacidade de auditar
     * de novo, que é a ordem que o veredito parcial dá.
     */
    const memorialRetido = await conv.recuperarMemorial();
    if (memorialRetido) {
      setMemorialFile(memorialRetido.file);
      // A identidade volta junto: é ela que vira o gabarito da auditoria.
      if (memorialRetido.dossie) setDossie(memorialRetido.dossie);
    }
  };

  /*
   * Ao abrir, retoma a conversa que tem AUDITORIA EM VOO.
   *
   * O F5 caía numa conversa nova em branco: o bilhete com o `auditId` ficava
   * gravado na conversa anterior e ninguém o lia — a análise seguia rodando no
   * servidor sem ter para onde voltar, e os minutos de modelo já pagos iam para
   * o lixo do mesmo jeito. Só se retoma quando há trabalho pago pendurado; nos
   * outros casos abrir em branco continua sendo o certo.
   */
  /*
   * O TOUR GUIADO — o primeiro contato de quem nunca abriu o produto.
   *
   * Ele roda sobre um PROJETO DE EXEMPLO semeado, porque na tela vazia não há o
   * que apontar: sem selo lido, sem documento gerado, sem parecer, os balões
   * falariam de coisas invisíveis. Ao sair, o exemplo é apagado e a tela volta
   * limpa — quem chegou para trabalhar não herda a obra fictícia na sidebar.
   */
  const [tourAtivo, setTourAtivo] = useState(false);
  const iniciarTour = useCallback(async () => {
    const id = await criarProjetoExemplo();
    // `selectConv` é o MESMO caminho do clique na sidebar: o exemplo entra na
    // tela como qualquer conversa restaurada, e o `started` vem do registro.
    await selectConv(id);
    setTourAtivo(true);
    // `selectConv` é recriada a cada render; o disparo é único por guarda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const encerrarTour = useCallback(() => {
    setTourAtivo(false);
    try {
      window.localStorage.setItem(CHAVE_TOUR_VISTO, "1");
    } catch {
      // Navegador sem storage (aba anônima restrita): o tour volta a aparecer,
      // e isso é melhor do que quebrar a tela por causa de uma preferência.
    }
    /*
     * A ORDEM é o que faz isto funcionar, e ela não é nada óbvia.
     *
     * `reset()` grava a conversa atual antes de largá-la (o flush que existe
     * para não perder a última mensagem) — e roda dentro de uma view transition,
     * cujo callback o navegador chama DEPOIS, quando já tirou o instantâneo da
     * tela. Então apagar o exemplo primeiro não adianta: a gravação atrasada o
     * ressuscitava, e o tour terminava com a obra fictícia ainda na sidebar.
     *
     * Sair do exemplo primeiro (`newConversation`, síncrono), apagar em seguida
     * e só então animar a volta resolve: quando o flush da transição rodar, a
     * conversa ativa já é a nova e vazia, que a guarda do store não grava.
     */
    void (async () => {
      conv.newConversation();
      await new Promise((r) => setTimeout(r, 0));
      await conv.removeConversation(ID_CONVERSA_EXEMPLO);
      reset();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Primeiro acesso: ninguém pede o tour: ele se oferece uma vez só.
  const tourRef = useRef(false);
  useEffect(() => {
    if (tourRef.current) return;
    tourRef.current = true;
    let jaViu = true;
    try {
      jaViu = window.localStorage.getItem(CHAVE_TOUR_VISTO) === "1";
    } catch {
      jaViu = true;
    }
    if (jaViu || conv.conversations.length > 0) return;
    const quadro = requestAnimationFrame(() => void iniciarTour());
    return () => cancelAnimationFrame(quadro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.conversations.length]);

  const retomouRef = useRef(false);
  useEffect(() => {
    if (retomouRef.current) return;
    const pendente = conv.conversations.find((c) => c.temAuditoriaPendente);
    if (!pendente || pendente.id === conv.conversationId) return;
    retomouRef.current = true;
    /*
     * Adiado um quadro: `selectConv` mexe em vários estados de uma vez (é o
     * mesmo caminho do clique na sidebar), e disparar isso no corpo do effect
     * encadeia renders — o lint do React Compiler barra, com razão. Aqui não há
     * pressa nenhuma: é a retomada de uma análise que já leva minutos.
     */
    const quadro = requestAnimationFrame(() => void selectConv(pendente.id));
    return () => cancelAnimationFrame(quadro);
    // `selectConv` é recriada a cada render; a guarda de reentrada é o `ref`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.conversations, conv.conversationId]);

  const okCount = seloResults.filter((r) => r.extraction).length;
  const busyReading = reading || readingMemorial;

  /*
   * Folhas SEM TÍTULO, e o conserto de graça.
   *
   * O preenchimento por geometria roda sozinho ao fim de toda leitura nova, mas
   * uma conversa lida ANTES dele existir fica congelada: `jaLidas` nunca relê
   * uma página, que é o que torna a retomada barata. Sem esta saída, a única
   * seria pagar uma chamada de modelo por página outra vez.
   */
  const semTitulo = seloResults.filter(
    (r) => r.extraction && !r.extraction.conteudo?.trim(),
  ).length;
  const [preenchendo, setPreenchendo] = useState(false);

  async function preencherTitulos() {
    setPreenchendo(true);
    try {
      const copia = seloResults.map((r) => ({ ...r }));
      const n = await preencherTitulosFaltantes(pranchaFiles, copia);
      if (n > 0) {
        selosRef.current = copia;
        setSeloResults(copia);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não deu para ler os títulos.");
    } finally {
      setPreenchendo(false);
    }
  }
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
        ? /*
           * Título faltando é linha vazia na coluna DESCRIÇÃO da LD — o
           * engenheiro precisa saber ANTES de gerar, não ao abrir o PDF.
           */
          semTitulo > 0
          ? `${okCount} folha(s) lidas · ${semTitulo} sem título`
          : `${okCount} folha(s) de selo lidas — pronto para gerar.`
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
    // A auditoria roda fora do turno do chat, mas é trabalho do agente: sem
    // isto a esfera fica parada em `idle` durante toda a análise.
    thinking: chatStatus.thinking || auditandoAgora,
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
        folhaManual: f.folhaManual,
      })),
    );
    const mapa: Record<FolhaId, number | null> = {};
    selos.forEach((f, i) => {
      mapa[f.id] = resolvidos[i] ?? null;
    });
    return mapa;
  }, [selos]);

  /*
   * O TOTAL que cada folha exibe — o "/24" de "05/24".
   *
   * Sai do carimbo, mas a correção à mão vence, e ela é guardada por
   * DISCIPLINA: quem digita "11" numa folha está corrigindo o conjunto, e as
   * outras folhas daquela disciplina têm de mudar junto na tela. Sem esta
   * derivação a correção valia no documento gerado e não aparecia em nó nenhum
   * — o engenheiro digitava, via o número velho de volta e não tinha como
   * saber que a correção pegou.
   */
  const totaisDasFolhas = useMemo(() => {
    const mapa: Record<FolhaId, number | null> = {};
    for (const f of selos) {
      const doBloco = conv.totaisPorDisciplina[codigoDaFolha(f)];
      mapa[f.id] = typeof doBloco === "number" && doBloco > 0 ? doBloco : (f.total ?? null);
    }
    return mapa;
  }, [selos, conv.totaisPorDisciplina]);

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
    (
      id: FolhaId,
      patch: {
        titulo?: string;
        numero?: string;
        total?: string;
        arquivo?: string;
        disciplina?: string;
      },
    ) => {
      const numero = Number(patch.numero);
      conv.ajustarFolha(id, {
        titulo: patch.titulo?.trim() ? patch.titulo : undefined,
        arquivo: patch.arquivo?.trim() ? patch.arquivo.trim() : undefined,
        // A disciplina decide em que BLOCO do volume a folha entra. Vazia,
        // volta a valer o nome do arquivo — que é a convenção do escritório.
        disciplina: patch.disciplina?.trim() ? patch.disciplina.trim() : undefined,
        // Número inválido ou vazio LIMPA o ajuste — volta a valer o carimbo.
        numero: Number.isFinite(numero) && numero > 0 ? Math.trunc(numero) : undefined,
      });

      /*
       * O TOTAL não é da folha: é do conjunto. Todas as pranchas de uma
       * disciplina imprimem o mesmo "/24", então corrigi-lo numa vale para
       * todas — e é por disciplina que ele viaja até a LD e a conferência.
       *
       * Escrito DEPOIS do ajuste, e lendo a disciplina do patch: quem corrige
       * as duas coisas na mesma janela está dizendo "esta folha é de drenagem, e
       * drenagem tem 11 folhas" — gravar o total na disciplina velha poria o
       * número no bloco errado.
       */
      if (patch.total !== undefined) {
        const folha = selos.find((f) => f.id === id);
        const codigo = patch.disciplina?.trim()
          ? codigoDaFolha({ ...folha, disciplina: patch.disciplina.trim() } as Folha)
          : folha
            ? codigoDaFolha(folha)
            : "";
        const total = Number(patch.total);
        conv.definirTotal(
          codigo,
          Number.isFinite(total) && total > 0 ? Math.trunc(total) : null,
        );
      }
    },
    [conv, selos],
  );

  /*
   * Remover uma folha lida é AJUSTE (`removida`), e ela volta pela barra do
   * canvas; remover uma criada à mão a apaga de vez, porque não há selo por trás
   * para restaurar. Os dois gestos são o mesmo botão — o nó sabe qual é qual e
   * diz isso na confirmação.
   */
  const removerFolha = useCallback(
    (id: FolhaId) => {
      if (ehAvulsa(id)) conv.excluirFolhaAvulsa(id);
      else conv.ajustarFolha(id, { removida: true });
    },
    [conv],
  );

  const criarFolha = useCallback(() => {
    conv.criarFolhaAvulsa();
  }, [conv]);

  const restaurarFolhas = useCallback(() => {
    if (removidas.length === 0) return;
    conv.ajustarFolhas(removidas.map((r) => ({ id: r.id, patch: { removida: undefined } })));
  }, [conv, removidas]);

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
  // "+ Tomo": declara a fileira nova. Ela nasce vazia — com a divisão congelada
  // nenhuma folha migra sozinha para lá, e é o arrasto que a preenche.
  const criarTomo = useCallback(
    (proximo: number) => conv.declararTomos(proximo),
    [conv],
  );

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
            <p className="text-sm font-medium">Solte as pranchas aqui</p>
            {/* Diz o que aceita ANTES da recusa: a regra na hora de soltar evita
                o erro em vez de explicá-lo depois. */}
            <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-muted-foreground">
              PDF ou imagem do carimbo
            </p>
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

      {/*
        Sem conexão: ÂMBAR, não coral. A rede volta, e o trabalho não se perdeu —
        e é isso que a primeira frase diz. Falar da rede antes de falar do que
        está em risco faz o engenheiro achar que perdeu o que escreveu.
      */}
      {!online && (
        <FaixaDeEstado tipo="offline" titulo="Sem conexão">
          O que você escreveu e os documentos já gerados estão guardados neste
          navegador. Nada foi perdido — o envio volta sozinho quando a rede voltar.
        </FaixaDeEstado>
      )}

      {/*
        Sessão expirada: NUNCA devolve a um login zerado. Sessão longa é a norma
        aqui — o engenheiro abre de manhã, sai para a obra, volta à tarde na
        mesma aba. A garantia vem COM NÚMERO, porque "seu trabalho está salvo"
        sem contagem é a frase que todo software diz antes de perder tudo.
      */}
      {/*
        LEITURA INCOMPLETA. Antes, o erro da leitura de selos só aparecia no
        drawer de dev — na prática, invisível: o progresso parava e pronto. E
        "tentar de novo" recomeçaria do zero, pagando outra vez por cada folha
        que já tinha dado certo.
      */}
      {leituraIncompleta && (
        <FaixaDeEstado
          tipo="offline"
          titulo="A leitura parou no meio"
          acao={
            <Button size="sm" variant="outline" onClick={() => void retomarLeitura()}>
              Retomar da folha {leituraIncompleta.lidas + 1}
            </Button>
          }
        >
          {leituraIncompleta.lidas} de {leituraIncompleta.total} folhas já foram
          lidas e estão salvas — retomar lê só as que faltam.{" "}
          <span className="text-muted-foreground">{leituraIncompleta.motivo}</span>
        </FaixaDeEstado>
      )}

      {/*
        TÍTULO FALTANDO. Toda leitura nova já preenche sozinha; esta faixa é para
        a conversa que foi lida ANTES disso existir e ficou congelada — `jaLidas`
        nunca relê uma página, e é essa economia que tornaria o conserto caro.
        O botão custa ZERO: lê o texto do PDF, não chama modelo nenhum.
      */}
      {semTitulo > 0 && !busyReading && pranchaFiles.length > 0 && (
        <FaixaDeEstado
          tipo="documento"
          titulo={`${semTitulo} folha(s) sem título`}
          acao={
            <Button
              size="sm"
              variant="outline"
              disabled={preenchendo}
              onClick={() => void preencherTitulos()}
            >
              {preenchendo ? "Lendo…" : "Preencher pelo carimbo"}
            </Button>
          }
        >
          Título vazio vira linha vazia na coluna DESCRIÇÃO da LD. O carimbo
          dessas folhas tem o título — dá para lê-lo direto do PDF, sem gastar
          leitura de IA.
        </FaixaDeEstado>
      )}

      {recusa && (
        <FaixaDeEstado
          tipo="offline"
          titulo="Formato não aceito"
          acao={
            <Button size="sm" variant="ghost" onClick={() => setRecusa(null)}>
              Entendi
            </Button>
          }
        >
          {recusa}
        </FaixaDeEstado>
      )}

      {sessaoExpirada && online && (
        <FaixaDeEstado
          tipo="sessao"
          titulo="Sessão expirada"
          acao={
            <Button asChild size="sm" variant="outline">
              <a href={`/login?callbackUrl=${encodeURIComponent("/nexo")}`}>
                Entrar e continuar de onde parei
              </a>
            </Button>
          }
        >
          Você ficou {duracaoLegivel(desdeMs)} sem atividade e o acesso caducou.{" "}
          {conv.results.length > 0
            ? `A conversa e ${
                conv.results.length === 1
                  ? "o documento já gerado continuam salvos"
                  : `os ${conv.results.length} documentos já gerados continuam salvos`
              }`
            : "A conversa continua salva"}{" "}
          neste navegador — entrar de novo devolve você a este mesmo ponto.
        </FaixaDeEstado>
      )}

      {tourAtivo && <TourDoNexo aoSair={encerrarTour} />}

      <NexoShell
        started={started}
        sidebar={
          <NexoSidebar
            onNewConversation={reset}
            conversations={conv.conversations}
            activeId={conv.conversationId}
            onSelect={selectConv}
            onDelete={conv.removeConversation}
            isAdmin={isAdmin}
            onVerTour={iniciarTour}
            /*
             * A marca da barra lateral respira enquanto o agente trabalha. Ela
             * está sempre visível, e o orbe grande não: sai de vista quando se
             * rola a conversa ou se olha o canvas.
             */
            trabalhando={agentState !== "idle" && agentState !== "complete"}
          />
        }
        stage={
          <PalcoDoNexo
            mapa={
          <NexoCanvas
            folhas={selos}
            numeros={numerosDasFolhas}
            arquivosDisponiveis={arquivosDisponiveis}
            onAbrirFolha={abrirFolha}
            totais={totaisDasFolhas}
            onCorrigirFolha={corrigirFolha}
            onRemoverFolha={removerFolha}
            onMoverFolhas={moverFolhas}
            onVoltarAoAutomatico={voltarAoAutomatico}
            onCriarTomo={criarTomo}
            onCriarFolha={criarFolha}
            removidas={removidas}
            onRestaurarFolhas={restaurarFolhas}
            tomosDeclarados={conv.tomosDeclarados}
          />
            }
          />
        }
        copilot={
          <NexoCopilot
            key={convId}
            started={started}
            nome={nome}
            selos={selos}
            onSend={start}
            onAttach={() => attachInputRef.current?.click()}
            arrastando={dragging}
            readStatus={readStatus}
            agentState={agentState}
            fileCount={okCount}
            activity={orbActivity}
            context={agentContext}
            pranchaFiles={pranchaFiles}
            memorialFile={memorialFile}
            memorialFatos={
              memorialFile
                ? {
                    fileName: memorialFile.name,
                    obra: dossie?.obra ?? null,
                    // `orgao` é a PREFEITURA lida do próprio memorial. O cartão a
                    // raspava do rótulo "Capa <x>" de um resultado de capa — que
                    // numa conversa só de memorial nunca existe. Resultado: a
                    // auditoria ia sem prefeitura e sem município tendo os dois.
                    orgao: dossie?.orgao ?? null,
                    municipio: dossie?.municipio ?? null,
                    codigo: dossie?.codigo ?? null,
                    endereco: dossie?.caracterizacao?.endereco ?? null,
                  }
                : null
            }
            attachments={attachments}
            onRemoveAttachment={removeAttachment}
            onTrocarPapelAnexo={trocarPapelAnexo}
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

