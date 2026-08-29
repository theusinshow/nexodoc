"use client";

/**
 * Store HEADLESS da conversa ativa + histórico (item 4). Fonte única do DURÁVEL:
 * mensagens + selos lidos + (4B) resultados gerados. Persiste debounced no
 * IndexedDB (lib/nexo-db.ts) e serve a lista de conversas p/ a sidebar.
 *
 * Só o durável mora aqui — os arquivos de ENTRADA (pranchas/memorial) seguem
 * efêmeros no NexoWorkspace (não persistem). A refatoração de UI vem por cima
 * sem tocar nesta camada.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { SeloResult } from "../lib/selo-render";
import type {
  LdPreviewData,
  NexoAgentProposal,
  NexoArtifactKind,
  NexoChatMessage,
  NexoDossieDraft,
  NexoSlotRequest,
} from "../types";
import { tituloDaConversa, type IdentidadeLida } from "../lib/titulo-da-conversa";
import { summarizeSelos } from "../lib/agent-context";
import { aplicarAjuste, PREFIXO_AVULSA, type Ajuste, type FolhaId } from "../lib/folhas";
import { aplicarIdentidade, type IdentidadeDoProjeto } from "../lib/identidade";
import { nomeDoVolume, pastaDoProjeto } from "../lib/pasta-do-projeto";
import { anotarDecisao, type DecisoesDoProjeto } from "../lib/decisoes";
import { consultarAuditoria } from "../lib/audit";
import { escolherCopia } from "../lib/copia-mais-nova";
import { parecerARecuperar } from "../lib/parecer-a-recuperar";
import { removerResultado } from "../lib/results";
import { derivarTipoDeTrabalho } from "../lib/tipo-de-trabalho";
import {
  deleteConversation as dbDelete,
  getBlob,
  getConversation,
  listConversations,
  putBlob,
  putConversation,
  type ConversationSummary,
  type StoredConversation,
  type StoredResultMeta,
} from "../lib/nexo-db";
import {
  apagarNoServidor,
  gravarNoServidor,
  lerDoServidor,
  listarNoServidor,
  type EstadoDaSincronizacao,
} from "../lib/nexo-sync";
import { fundirListas } from "@/server/nexo/conversa-remota";

/** Um arquivo de resultado com object URL vivo (p/ download/preview). */
export interface SavedFile {
  label: string;
  name: string;
  mime: string;
  url: string;
  /** Chave no store de blobs (persistência/reidratação). */
  blobKey: string;
  primary?: boolean;
  /** Tamanho em bytes, lido do blob no momento de salvar. */
  sizeBytes?: number;
}

/** Resultado gerado (com URLs vivas) — reidratado do IndexedDB no restore. */
export interface SavedResult {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  canvas?: { label: string; detail?: string; titulo?: string; pageNumber?: number };
  files: SavedFile[];
  payload?: unknown;
  /** Quando foi gerado — alimenta o "gerada há 42 min" do estado pendente. */
  generatedAt?: number;
  /**
   * O artefato foi gerado, mas os BYTES não estão nesta máquina.
   *
   * Acontece quando a conversa veio do servidor: o registro atravessa a rede,
   * os arquivos não — eles vivem no `result_blobs` do navegador que os gerou, e
   * não há provedor de armazenamento (`NEXODOC_STORAGE_PROVIDER=none`).
   *
   * O código antes disto PULAVA o arquivo sem blob, e o artefato aparecia
   * simplesmente sem nada para baixar. Silêncio aqui é o defeito de sempre:
   * parece que funcionou. Com a marca, a tela pode dizer "gerar de novo".
   */
  bytesAusentes?: boolean;
}

/** Entrada de `saveResult`: os arquivos vêm como object URLs (o card já os tem). */
export interface SaveResultInput {
  artifactId: string;
  kind: NexoArtifactKind;
  summary: string;
  canvas?: { label: string; detail?: string; titulo?: string; pageNumber?: number };
  files: { label: string; name: string; mime: string; url: string; primary?: boolean }[];
  payload?: unknown;
}

interface ConversationStoreValue {
  conversationId: string;
  title: string;
  messages: NexoChatMessage[];
  seloResults: SeloResult[];
  /** O que o usuário mudou à mão nas folhas. Vazio = a projeção é a identidade. */
  ajustes: Record<FolhaId, Ajuste>;
  /** Lista de conversas (resumos), mais recentes primeiro. */
  conversations: ConversationSummary[];
  /**
   * Como foi a última ida ao servidor.
   *
   * "desligada" é o normal de uma instalação sem banco. "falhou" precisa
   * aparecer na tela: o trabalho está a salvo no disco desta máquina, mas NÃO
   * subiu — e é justamente essa diferença que o testador não tem como adivinhar.
   */
  sincronizacao: EstadoDaSincronizacao;
  /**
   * Como foi a última gravação no DISCO desta máquina.
   *
   * Junto com `sincronizacao`, é o par que a barra lateral gradua: nenhuma
   * das duas sozinha diz se o trabalho está em risco. Disco falhando com o
   * servidor gravando é informação; as duas falhando é alarme.
   */
  gravacaoLocal: "ok" | "falhou";
  /** Resultados gerados (com URLs vivas) — reidratados do IndexedDB no restore. */
  results: SavedResult[];
  appendMessage: (m: NexoChatMessage) => void;
  /** Faz a última mensagem crescer (streaming). NÃO persiste — só memória. */
  appendDelta: (id: string, text: string) => void;
  /** Fecha o turno transmitido e persiste de uma vez. */
  finalizeMessage: (
    id: string,
    patch: {
      proposals?: NexoAgentProposal[];
      slotRequest?: NexoSlotRequest;
      ldPreview?: LdPreviewData;
      interrupted?: boolean;
      trace?: string;
    },
  ) => void;
  setSeloResults: (r: SeloResult[]) => void;
  /** Acumula um ajuste numa folha. Campo `undefined` no patch DESFAZ aquele campo. */
  ajustarFolha: (id: FolhaId, patch: Ajuste) => void;
  /** Vários ajustes numa tacada (um arrasto de seleção). Um `setState` só. */
  ajustarFolhas: (entradas: { id: FolhaId; patch: Ajuste }[]) => void;
  /** Ids das folhas criadas à mão. O conteúdo delas mora em `ajustes`. */
  avulsas: FolhaId[];
  /** Cria uma folha sem PDF por trás e devolve o id (para abrir a correção). */
  criarFolhaAvulsa: () => FolhaId;
  /** Apaga uma folha criada à mão — some junto com o ajuste dela. */
  excluirFolhaAvulsa: (id: FolhaId) => void;
  /**
   * Total de folhas de cada disciplina, dito por uma pessoa — o "24" de "05/24".
   *
   * Por DISCIPLINA porque é assim que o escritório numera: cada uma vai de 1 a N.
   * Sem este canal, o total saía do carimbo dominante, e um OCR que lesse "21"
   * onde estava "11" fazia a conferência acusar dez folhas faltando num volume
   * completo — e não havia onde dizer que o carimbo mentiu.
   */
  totaisPorDisciplina: Record<string, number>;
  /** Fixa (ou limpa, com `null`) o total de referência de uma disciplina. */
  definirTotal: (codigoDaDisciplina: string, total: number | null) => void;
  /**
   * Órgão, secretaria, obra, fase, código e revisão ditos por uma pessoa — o
   * escape de quando o carimbo mente. Vale para a CONVERSA, não para um
   * documento: capa e LD do mesmo volume imprimem os mesmos fatos.
   */
  identidade: IdentidadeDoProjeto;
  /** Acumula a correção. Campo com string vazia DESFAZ aquele campo. */
  corrigirIdentidade: (patch: Record<string, string>) => void;
  /**
   * As DECISÕES do documento (título, volume, data, tomos, prefeitura). Ao
   * contrário da identidade, o agente PROPÕE estes campos a cada turno — por
   * isso cada decisão guarda o valor dele que ela substituiu. Ver [[decisoes.ts]].
   */
  decisoes: DecisoesDoProjeto;
  /** Decide um campo. Vazio DESFAZ, como na identidade. */
  decidir: (campo: string, valor: string, propostoPeloAgente: string) => void;
  /**
   * Guarda as decisões que sobreviveram ao turno. Obrigatório depois de
   * mesclar: uma decisão que perdeu para o agente e continuasse guardada
   * voltaria a vencer quando ele repetisse o valor novo.
   */
  guardarDecisoesVivas: (vivas: DecisoesDoProjeto) => void;
  /** Quantos tomos o usuário declarou pelo canvas (0 = nenhum além dos gerados). */
  tomosDeclarados: number;
  /** Declara um tomo a mais: a fileira nasce vazia e vira destino de arrasto. */
  declararTomos: (n: number) => void;
  /**
   * Achados de auditoria que o engenheiro já corrigiu no memorial, por
   * `auditId`. É PROGRESSO DE TRABALHO, não conteúdo do parecer — por isso vive
   * aqui e não dentro do resultado: o relatório continua íntegro, e o que muda
   * é só o que já saiu da frente de quem está corrigindo.
   */
  achadosResolvidos: Record<string, string[]>;
  /**
   * Registra uma auditoria na conversa quando ela COMEÇA — o que põe o
   * `auditId` fora do caminho da falha de gravação.
   */
  registrarAuditoria: (auditId: string, artifactId: string) => void;
  marcarAchadoResolvido: (auditId: string, refId: string, resolvido: boolean) => void;
  /** Persiste um resultado gerado (blobs no IndexedDB) e o expõe reidratado. */
  saveResult: (input: SaveResultInput) => Promise<void>;
  /** Lê um resultado já gerado (nesta sessão ou restaurado). */
  getResult: (artifactId: string) => SavedResult | undefined;
  /**
   * Remove um resultado gerado: some do canvas (o espelho é automático) e deixa
   * de entrar no volume. O card volta ao estado de proposta, então regerar é um
   * clique. Os blobs no IndexedDB ficam — o que importa é sair do estado.
   */
  removeResult: (artifactId: string) => void;
  /**
   * A auditoria disparada e ainda sem resultado nesta conversa.
   *
   * Vive aqui, e não no store da auditoria, porque precisa ser DURÁVEL: é o que
   * permite voltar depois de um F5 e perguntar ao servidor o que aconteceu, em
   * vez de perder de 3 a 6 minutos de modelo já pagos.
   */
  auditoriaPendente: AuditoriaPendente | null;
  marcarAuditoriaPendente: (p: Omit<AuditoriaPendente, "inicioMs"> | null) => void;
  /**
   * Retém o PDF do memorial para que dê para auditar de novo depois.
   *
   * É a exceção à regra de que arquivos de entrada não persistem: sem ele, a
   * conversa restaurada não consegue cumprir a ordem que o próprio veredito dá
   * quando a análise volta parcial.
   */
  salvarMemorial: (file: File | null) => Promise<void>;
  /** Guarda a identidade lida do memorial junto dele (obra/órgão/município). */
  salvarDossieDoMemorial: (dossie: NexoDossieDraft | null) => void;
  /** Devolve o memorial retido desta conversa: bytes e fatos. */
  recuperarMemorial: () => Promise<{ file: File; dossie?: NexoDossieDraft } | null>;
  /**
   * Zera a conversa em memória. `descartar` larga a gravação pendente em vez de
   * cumpri-la — é o que impede uma conversa recém-apagada de voltar ao disco.
   */
  newConversation: (opts?: { descartar?: boolean }) => void;
  /** Carrega uma conversa; devolve o registro (p/ o dono restaurar o shell). */
  selectConversation: (id: string) => Promise<StoredConversation | null>;
  removeConversation: (id: string) => Promise<void>;
  /** Apaga uma pasta inteira: as conversas do grupo, numa tacada. */
  removeConversations: (ids: readonly string[]) => Promise<void>;
  /**
   * Copia uma conversa sem a história dela: os selos já lidos e o memorial
   * retido seguem, as mensagens e os documentos gerados não. É o que evita
   * subir e reler as mesmas pranchas para começar o volume seguinte da obra.
   */
  duplicarConversa: (id: string) => Promise<string | null>;
}

/** O bilhete que permite reconectar a uma auditoria já em curso no servidor. */
export type AuditoriaPendente = NonNullable<StoredConversation["auditoriaPendente"]>;

const ConversationStoreContext = createContext<ConversationStoreValue | null>(null);

const PERSIST_DEBOUNCE_MS = 500;

/** Título derivado: obra do selo > 1ª mensagem do usuário > "Nova conversa". */
/**
 * O título da conversa. A escada mora em [[titulo-da-conversa.ts]], pura e com
 * teste; aqui fica só a coleta das fontes que este store conhece.
 *
 * A IDENTIDADE DO MEMORIAL entrou como fonte em 17/08/2026. Sem ela, uma
 * conversa só de memorial — o caminho principal do produto — não tinha carimbo
 * de onde tirar obra, e o título caía na primeira frase digitada: o histórico
 * virava uma pilha de "Anexei o memorial — ..." indistinguíveis.
 */
function deriveTitle(
  current: string,
  messages: NexoChatMessage[],
  seloResults: SeloResult[],
  identidade?: IdentidadeLida,
): string {
  return tituloDaConversa({
    atual: current,
    primeiraFrase: messages.find((m) => m.role === "user")?.content,
    obraDosSelos: seloResults.find((r) => r.extraction?.obra?.trim())?.extraction?.obra ?? undefined,
    identidade,
  });
}

function newId(): string {
  return crypto.randomUUID();
}

/**
 * A PASTA e o NOME da conversa de VOLUME, derivados dos selos.
 *
 * `deriveFolderKey` devolvia só o CÓDIGO (`084_25`) — uma pasta que não
 * identifica o projeto, porque dois municípios podem ter o mesmo número de
 * contrato. Agora a pasta é o CENTRO DE CUSTO (`084-25-CRICIUMA`), e é a mesma
 * chave que a auditoria de memorial usa: o volume e a auditoria do MESMO
 * projeto passam a cair no MESMO lugar. Ver [[pasta-do-projeto.ts]].
 */
function derivarDoProjeto(seloResults: SeloResult[]): {
  folderKey: string;
  nome: string;
} {
  if (seloResults.length === 0) return { folderKey: "", nome: "" };
  const facts = seloResults.map((r) => ({
    fileName: r.fileName,
    arquivo: r.extraction?.arquivo ?? null,
    disciplina: r.extraction?.disciplina ?? null,
    obra: r.extraction?.obra ?? null,
  }));
  /*
   * A prefeitura vem do campo CLIENTE do carimbo — a mesma evidência que
   * `casarPrefeituraDoCarimbo` usa para escolher o modelo da capa. Não é uma
   * segunda leitura: é a mesma, servindo agora também para nomear a pasta.
   */
  const prefeitura = seloResults.find((r) => r.extraction?.cliente?.trim())?.extraction
    ?.cliente;
  return {
    folderKey: pastaDoProjeto(summarizeSelos(facts).codigo, prefeitura),
    nome: nomeDoVolume(seloResults.map((r) => r.extraction?.disciplina)),
  };
}

export function ConversationStoreProvider({ children }: { children: ReactNode }) {
  const [conversationId, setConversationId] = useState<string>(() => newId());
  const [title, setTitle] = useState("Nova conversa");
  const [messages, setMessages] = useState<NexoChatMessage[]>([]);
  const [seloResults, setSeloResultsState] = useState<SeloResult[]>([]);
  const [ajustes, setAjustes] = useState<Record<FolhaId, Ajuste>>({});
  const [avulsas, setAvulsas] = useState<FolhaId[]>([]);
  const [totaisPorDisciplina, setTotaisPorDisciplina] = useState<Record<string, number>>({});
  const [identidade, setIdentidade] = useState<IdentidadeDoProjeto>({});
  const [decisoes, setDecisoes] = useState<DecisoesDoProjeto>({});
  const [tomosDeclarados, setTomosDeclarados] = useState(0);
  const [achadosResolvidos, setAchadosResolvidos] = useState<Record<string, string[]>>({});
  /** Auditorias disparadas nesta conversa, registradas na LARGADA. */
  const [auditorias, setAuditorias] = useState<{ auditId: string; artifactId: string }[]>([]);
  /** Artefatos que o usuário apagou de propósito — a recuperação os respeita. */
  const [artefatosApagados, setArtefatosApagados] = useState<string[]>([]);
  const [results, setResults] = useState<SavedResult[]>([]);
  const [auditoriaPendente, setAuditoriaPendente] =
    useState<AuditoriaPendente | null>(null);
  const [memorialMeta, setMemorialMeta] =
    useState<StoredConversation["memorial"] | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);

  // Snapshot mais novo p/ o persist debounced (evita closure velha). Sincronizado
  // num effect — o React Compiler proíbe tocar ref.current durante o render.
  const snapshotRef = useRef({
    conversationId,
    title,
    messages,
    seloResults,
    ajustes,
    avulsas,
    totaisPorDisciplina,
    identidade,
    decisoes,
    tomosDeclarados,
    achadosResolvidos,
    auditorias,
    artefatosApagados,
    results,
    auditoriaPendente,
    memorialMeta,
    createdAt: 0,
  });
  useEffect(() => {
    snapshotRef.current = {
      ...snapshotRef.current,
      conversationId,
      title,
      messages,
      seloResults,
      ajustes,
      avulsas,
      totaisPorDisciplina,
      identidade,
      decisoes,
      tomosDeclarados,
      achadosResolvidos,
      auditorias,
      artefatosApagados,
      results,
      auditoriaPendente,
      memorialMeta,
      createdAt: snapshotRef.current.createdAt || Date.now(),
    };
  });

  /*
   * A lista do SERVIDOR, guardada à parte.
   *
   * `refreshList` roda depois de toda gravação (ou seja, o tempo todo) e precisa
   * continuar barato: ele relê o disco e funde com o que o servidor disse por
   * último. Ir à rede a cada tecla seria absurdo — quem vai ao servidor é o
   * `refreshRemote`, na montagem e depois de apagar.
   */
  const remotasRef = useRef<ConversationSummary[]>([]);
  const [sincronizacao, setSincronizacao] = useState<EstadoDaSincronizacao>({
    estado: "desligada",
  });
  /**
   * Como foi a última gravação NO DISCO.
   *
   * Existe porque `putConversation` engolia a própria falha — `.catch(() => {})`
   * logo abaixo do comentário que a chama de "a gravação que vale no instante".
   * Enquanto ela falhava calada, perder trabalho era indistinguível de nunca ter
   * trabalhado, e o diagnóstico virava dedução.
   */
  const [gravacaoLocal, setGravacaoLocal] = useState<"ok" | "falhou">("ok");

  const refreshList = useCallback(() => {
    listConversations()
      .then((locais) => setConversations(fundirListas(locais, remotasRef.current)))
      .catch(() => {});
  }, []);

  const refreshRemote = useCallback(() => {
    listarNoServidor()
      .then(({ conversas, sincronizando }) => {
        remotasRef.current = conversas;
        if (!sincronizando) setSincronizacao({ estado: "desligada" });
        refreshList();
      })
      .catch(() => {
        // Lista remota indisponível não é erro de tela: o histórico local
        // continua inteiro. O que NÃO pode é a gravação falhar em silêncio —
        // isso o `persistNow` reporta.
      });
  }, [refreshList]);

  useEffect(() => {
    refreshList();
    refreshRemote();
  }, [refreshList, refreshRemote]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Esta conversa já foi ao disco — daqui em diante, mantê-la em dia. */
  const jaPersistiu = useRef(false);

  // Grava o snapshot atual AGORA (base do debounce E do flush ao trocar conversa).
  const persistNow = useCallback(() => {
    const s = snapshotRef.current;
    const vazia =
      s.messages.length === 0 &&
      s.seloResults.length === 0 &&
      s.results.length === 0 &&
      // Uma auditoria em voo já é conteúdo: sem isto, a conversa que só disparou
      // a análise não seria gravada, e o `auditId` para reconectar se perderia.
      !s.auditoriaPendente;
    /*
     * A guarda existe para não CRIAR conversa vazia — não para impedir de
     * ATUALIZAR uma que já está no disco. Sem a segunda metade, limpar o
     * bilhete de uma conversa cujo único conteúdo era a auditoria não gravava
     * nada: o bilhete ressuscitava no disco e todo F5 futuro reabria a mesma
     * conversa, para sempre.
     */
    if (vazia && !jaPersistiu.current) {
      return;
    }
    jaPersistiu.current = true;
    const resultsMeta: StoredResultMeta[] = s.results.map((r) => ({
      artifactId: r.artifactId,
      kind: r.kind,
      summary: r.summary,
      ...(r.canvas ? { canvas: r.canvas } : {}),
      files: r.files.map((f) => ({
        label: f.label,
        name: f.name,
        mime: f.mime,
        blobKey: f.blobKey,
        ...(f.primary ? { primary: true } : {}),
        ...(f.sizeBytes !== undefined ? { sizeBytes: f.sizeBytes } : {}),
      })),
      ...(r.payload !== undefined ? { payload: r.payload } : {}),
      ...(r.generatedAt !== undefined ? { generatedAt: r.generatedAt } : {}),
    }));
    const { folderKey: doVolume, nome: nomeDoConjunto } = derivarDoProjeto(s.seloResults);
    /*
     * O MEMORIAL CAI NA PASTA DO MESMO PROJETO.
     *
     * A conversa de auditoria não tem selo nenhum, então `derivarDoProjeto`
     * devolve vazio — e ela ia para "Sem pasta" enquanto o volume do MESMO
     * projeto tinha a sua. Reunir os dois é a RAZÃO de a pasta existir.
     *
     * A identidade vem da classificação do memorial, que já roda antes de a
     * auditoria começar, e passa pela MESMA `pastaDoProjeto`: duas derivações
     * do mesmo nome é como as duas metades do produto discordam sobre onde um
     * projeto mora.
     */
    const folderKey =
      doVolume ||
      pastaDoProjeto(s.identidade?.codigo, s.identidade?.orgao);
    /*
     * A SEÇÃO da sidebar, derivada na mesma passada que a pasta e o título.
     *
     * Reavaliada a cada gravação de propósito: a conversa que começa vazia cai
     * em "volume" e se corrige sozinha no instante em que anexa um memorial ou
     * dispara a auditoria — sem migração e sem ninguém escolher nada.
     */
    const tipo = derivarTipoDeTrabalho({
      results: s.results,
      auditoriaPendente: s.auditoriaPendente,
      memorial: s.memorialMeta,
      seloResults: s.seloResults,
    });
    const rec: StoredConversation = {
      id: s.conversationId,
      /*
       * DENTRO DA PASTA, a conversa se chama pelo que ELA é: as siglas das
       * disciplinas do volume (`MET · HIS · INC`), ou `Memorial` na auditoria.
       * O nome do projeto já está no cabeçalho da pasta — repeti-lo na linha
       * gastaria a coluna com o que o cabeçalho acabou de dizer.
       *
       * FORA de pasta o nome longo volta: sem cabeçalho de projeto, `Memorial`
       * sozinho não distingue duas auditorias na mesma lista.
       */
      title: folderKey
        ? nomeDoConjunto || (s.memorialMeta ? "Memorial" : s.title)
        : s.title,
      createdAt: s.createdAt,
      updatedAt: Date.now(),
      ...(folderKey ? { folderKey } : {}),
      tipo,
      messages: s.messages,
      seloResults: s.seloResults,
      ...(Object.keys(s.ajustes).length > 0 ? { ajustes: s.ajustes } : {}),
      ...(s.avulsas.length > 0 ? { avulsas: s.avulsas } : {}),
      ...(Object.keys(s.totaisPorDisciplina).length > 0
        ? { totaisPorDisciplina: s.totaisPorDisciplina }
        : {}),
      ...(Object.keys(s.identidade).length > 0 ? { identidade: s.identidade } : {}),
      ...(Object.keys(s.decisoes).length > 0 ? { decisoes: s.decisoes } : {}),
      ...(s.tomosDeclarados > 0 ? { tomosDeclarados: s.tomosDeclarados } : {}),
      ...(Object.keys(s.achadosResolvidos).length > 0
        ? { achadosResolvidos: s.achadosResolvidos }
        : {}),
      ...(s.auditorias.length > 0 ? { auditorias: s.auditorias } : {}),
      ...(s.artefatosApagados.length > 0 ? { artefatosApagados: s.artefatosApagados } : {}),
      ...(s.auditoriaPendente ? { auditoriaPendente: s.auditoriaPendente } : {}),
      ...(s.memorialMeta ? { memorial: s.memorialMeta } : {}),
      results: resultsMeta,
    };
    /*
     * O DISCO PRIMEIRO, SEMPRE.
     *
     * O IndexedDB é a gravação que vale no instante: é síncrono o bastante,
     * funciona sem rede e é o que faz um F5 não perder nada. O servidor vem
     * depois, e é o que faz o trabalho sobreviver a trocar de máquina.
     */
    putConversation(rec)
      .then(() => {
        setGravacaoLocal("ok");
        refreshList();
      })
      /*
       * A FALHA CONTA. Era `.catch(() => {})`, e o silêncio dela é o que fez o
       * parecer do 084_25 sumir sem ninguém saber por quê: quota estourada,
       * transação abortada ou despejo por pressão de armazenamento produziam
       * exatamente o mesmo nada. Quem grava e não avisa que não gravou está
       * dizendo que gravou.
       */
      .catch(() => setGravacaoLocal("falhou"));

    gravarNoServidor(rec).then((estado) => {
      /*
       * "desligada" não vira alarme: é a resposta de instalação sem banco, e o
       * Nexo funcionou assim a vida inteira. Falha de verdade FICA na tela — o
       * modo de falhar caro deste projeto é o que parece ter dado certo.
       */
      setSincronizacao(estado);
    });
  }, [refreshList]);

  // Debounce: grava 500ms após a última mudança.
  const schedulePersist = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persistNow, PERSIST_DEBOUNCE_MS);
  }, [persistNow]);

  // Flush: grava JÁ, antes de trocar/limpar a conversa. Sem isso, um debounce
  // pendente seria CANCELADO e a última mudança se perderia (bug #1 da revisão).
  const flushPersist = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    persistNow();
  }, [persistNow]);

  const appendMessage = useCallback(
    (m: NexoChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, m];
        setTitle((t) => deriveTitle(t, next, snapshotRef.current.seloResults, snapshotRef.current.memorialMeta?.dossie));
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  // Crescimento por delta: mexe SÓ no estado em memória. Persistir a cada token
  // viraria centenas de gravações no IndexedDB por resposta — o `finalizeMessage`
  // grava uma vez, no fim.
  const appendDelta = useCallback((id: string, text: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, content: m.content + text } : m)),
    );
  }, []);

  const finalizeMessage = useCallback(
    (
      id: string,
      patch: {
        proposals?: NexoAgentProposal[];
        slotRequest?: NexoSlotRequest;
        ldPreview?: LdPreviewData;
        interrupted?: boolean;
        trace?: string;
      },
    ) => {
      setMessages((prev) => {
        const next = prev.map((m) => (m.id === id ? { ...m, ...patch } : m));
        setTitle((t) => deriveTitle(t, next, snapshotRef.current.seloResults, snapshotRef.current.memorialMeta?.dossie));
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const setSeloResults = useCallback(
    (r: SeloResult[]) => {
      setSeloResultsState(r);
      setTitle((t) => deriveTitle(t, snapshotRef.current.messages, r, snapshotRef.current.memorialMeta?.dossie));
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * ÚNICO escritor de ajustes. `aplicarAjuste` é puro e já testado: acumula sem
   * mutar, e apaga a entrada quando o ajuste fica vazio — desfazer não pode
   * deixar lixo ocupando o estado.
   */
  const ajustarFolha = useCallback(
    (id: FolhaId, patch: Ajuste) => {
      setAjustes((prev) => aplicarAjuste(prev, id, patch));
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * Um arrasto de 30 folhas são 30 ajustes. Chamar `ajustarFolha` num laço
   * funcionaria — `aplicarAjuste` é puro e compõe —, mas seriam 30 renders e 30
   * agendamentos de persistência para um único gesto.
   */
  const ajustarFolhas = useCallback(
    (entradas: { id: FolhaId; patch: Ajuste }[]) => {
      if (entradas.length === 0) return;
      setAjustes((prev) =>
        entradas.reduce((acc, e) => aplicarAjuste(acc, e.id, e.patch), prev),
      );
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * A folha que não foi lida — porque o PDF não veio, ou porque a prancha ainda
   * está sendo desenhada. Nasce VAZIA, e o popover "Corrigir" (o mesmo das
   * outras) é quem a preenche: assim existe um lugar só para editar folha.
   *
   * O id é gerado aqui, no manipulador, e não no render: `crypto.randomUUID` no
   * corpo do componente é justamente o que o React Compiler barra.
   */
  const criarFolhaAvulsa = useCallback((): FolhaId => {
    const id = `${PREFIXO_AVULSA}${newId()}`;
    setAvulsas((prev) => [...prev, id]);
    schedulePersist();
    return id;
  }, [schedulePersist]);

  /*
   * Folha criada à mão se apaga de vez — não há selo por trás para "restaurar",
   * e guardá-la removida deixaria um fantasma na lista de restauração.
   */
  const excluirFolhaAvulsa = useCallback(
    (id: FolhaId) => {
      setAvulsas((prev) => prev.filter((x) => x !== id));
      setAjustes((prev) => {
        if (!prev[id]) return prev;
        const proximo = { ...prev };
        delete proximo[id];
        return proximo;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * O total de referência dito por uma pessoa. `null` limpa e devolve o carimbo —
   * a mesma regra de todo campo do popover: vazio desfaz.
   */
  const definirTotal = useCallback(
    (codigoDaDisciplina: string, total: number | null) => {
      const chave = codigoDaDisciplina.trim().toLowerCase();
      setTotaisPorDisciplina((atual) => {
        const proximo = { ...atual };
        if (total === null || !Number.isFinite(total) || total <= 0) delete proximo[chave];
        else proximo[chave] = Math.trunc(total);
        return proximo;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * A identidade do projeto dita à mão. Acumula campo a campo (`aplicarIdentidade`
   * é puro e testado): corrigir a obra não pode apagar o código corrigido antes,
   * e limpar um campo devolve o que o carimbo dizia.
   */
  const corrigirIdentidade = useCallback(
    (patch: Record<string, string>) => {
      setIdentidade((atual) => aplicarIdentidade(atual, patch));
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * Uma decisão do engenheiro sobre o documento. Guarda junto o que o agente
   * propunha na hora — é esse par que deixa a mescla saber, no turno seguinte,
   * se o agente mudou de ideia ou apenas repetiu o mesmo valor.
   */
  const decidir = useCallback(
    (campo: string, valor: string, propostoPeloAgente: string) => {
      setDecisoes((atual) => anotarDecisao(atual, campo, valor, propostoPeloAgente));
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * As decisões que sobreviveram ao turno. Guardar de volta é obrigatório: uma
   * decisão que perdeu para o agente e continuasse guardada voltaria a vencer
   * no turno seguinte, quando ele repetisse o valor novo.
   */
  const guardarDecisoesVivas = useCallback(
    (vivas: DecisoesDoProjeto) => {
      setDecisoes(vivas);
      schedulePersist();
    },
    [schedulePersist],
  );

  /*
   * O usuário declarou mais um tomo pelo canvas. Fica no durável porque a fileira
   * vazia precisa sobreviver ao F5 — senão o destino do arrasto some junto com o
   * recarregamento, e o tomo novo vira um clique que não durou nada.
   */
  /*
   * Marcar/desmarcar é IDEMPOTENTE e nunca perde o resto: a lista de um
   * `auditId` é reescrita sem tocar nas outras auditorias da mesma conversa.
   * Desmarcar tem que continuar possível — quem risca item de lista erra, e
   * uma marca sem volta faria o engenheiro evitar usá-la.
   */
  const marcarAchadoResolvido = useCallback(
    (auditId: string, refId: string, resolvido: boolean) => {
      if (!auditId || !refId) return;
      setAchadosResolvidos((atual) => {
        const lista = new Set(atual[auditId] ?? []);
        if (resolvido) lista.add(refId);
        else lista.delete(refId);
        const proximo = { ...atual };
        if (lista.size === 0) delete proximo[auditId];
        else proximo[auditId] = [...lista];
        return proximo;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const declararTomos = useCallback(
    (n: number) => {
      setTomosDeclarados((atual) => Math.max(atual, Math.max(0, Math.floor(n))));
      schedulePersist();
    },
    [schedulePersist],
  );

  // Persiste os blobs de um resultado e o expõe reidratado (URLs vivas).
  const saveResult = useCallback(
    async (input: SaveResultInput) => {
      const convId = snapshotRef.current.conversationId;
      const files: SavedFile[] = [];
      for (const f of input.files) {
        const blobKey = `${convId}:${input.artifactId}:${f.label}`;
        // O tamanho sai do blob que já buscamos para persistir — nenhuma
        // requisição a mais só para saber quantos KB o arquivo tem.
        let sizeBytes: number | undefined;
        try {
          const blob = await fetch(f.url).then((r) => r.blob());
          sizeBytes = blob.size;
          await putBlob(blobKey, blob);
        } catch {
          /* persistência é best-effort; o download da sessão segue válido */
        }
        files.push({
          label: f.label,
          name: f.name,
          mime: f.mime,
          url: f.url,
          blobKey,
          ...(f.primary ? { primary: true } : {}),
          ...(sizeBytes !== undefined ? { sizeBytes } : {}),
        });
      }
      const saved: SavedResult = {
        artifactId: input.artifactId,
        kind: input.kind,
        summary: input.summary,
        ...(input.canvas ? { canvas: input.canvas } : {}),
        files,
        ...(input.payload !== undefined ? { payload: input.payload } : {}),
        generatedAt: Date.now(),
      };
      setResults((prev) => {
        const i = prev.findIndex((r) => r.artifactId === saved.artifactId);
        if (i === -1) return [...prev, saved];
        const next = [...prev];
        // Regerar o mesmo artefato → revoga os URLs antigos antes de trocar (#4).
        prev[i].files.forEach((f) => URL.revokeObjectURL(f.url));
        next[i] = saved;
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const getResult = useCallback(
    (artifactId: string) => results.find((r) => r.artifactId === artifactId),
    [results],
  );

  const removeResult = useCallback(
    (artifactId: string) => {
      setResults((prev) => {
        const { restantes, removido } = removerResultado(prev, artifactId);
        // Revoga as URLs do que saiu: sem isto cada exclusão deixa um blob preso
        // na memória da aba, e o vazamento é invisível.
        removido?.files.forEach((f) => URL.revokeObjectURL(f.url));
        return restantes;
      });
      /*
       * A EXCLUSÃO FICA REGISTRADA, e não é burocracia: a recuperação pelo
       * `auditId` (ver [[parecer-a-recuperar.ts]]) traria este parecer de volta
       * na próxima abertura, e de novo na seguinte. Apagar precisa continuar
       * sendo apagar.
       */
      const apagados = snapshotRef.current.artefatosApagados.includes(artifactId)
        ? snapshotRef.current.artefatosApagados
        : [...snapshotRef.current.artefatosApagados, artifactId];
      setArtefatosApagados(apagados);
      snapshotRef.current = { ...snapshotRef.current, artefatosApagados: apagados };
      schedulePersist();
    },
    [schedulePersist],
  );

  /**
   * REGISTRA uma auditoria na conversa, no instante em que ela COMEÇA.
   *
   * O `auditId` só vivia dentro do `payload` do artefato — o mesmo artefato
   * que se perde quando a gravação falha. Guardá-lo na largada é o que permite
   * pedir o parecer de volta ao servidor depois: o backend grava a auditoria
   * por conta própria, e sem o id não há como encontrá-la.
   *
   * O bilhete `auditoriaPendente` não serve: ele é apagado no fim da corrida.
   */
  const registrarAuditoria = useCallback(
    (auditId: string, artifactId: string) => {
      const atuais = snapshotRef.current.auditorias;
      if (atuais.some((a) => a.auditId === auditId)) return;
      const proximas = [...atuais, { auditId, artifactId }];
      setAuditorias(proximas);
      // Como o bilhete: o snapshot só acompanha o estado depois do render, e
      // esta gravação precisa valer AGORA — é ela que sobrevive à falha.
      snapshotRef.current = { ...snapshotRef.current, auditorias: proximas };
      flushPersist();
    },
    [flushPersist],
  );

  /**
   * Larga a gravação pendente SEM gravar.
   *
   * Só existe para um caso: a conversa aberta acabou de ser apagada. O flush
   * normal a escreveria de volta no disco meio segundo depois — apagada da
   * lista, viva no banco, e de volta na próxima sincronização.
   */
  const descartarPendente = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const newConversation = useCallback((opts?: { descartar?: boolean }) => {
    if (opts?.descartar) descartarPendente();
    else flushPersist(); // grava a conversa atual antes de largar (#1)
    setConversationId(newId());
    setTitle("Nova conversa");
    setMessages([]);
    setSeloResultsState([]);
    setAjustes({});
    setAvulsas([]);
    setTotaisPorDisciplina({});
    setIdentidade({});
    setTomosDeclarados(0);
    setAuditoriaPendente(null);
    setMemorialMeta(null);
    // Conversa nova ainda não existe no disco: volta a valer a guarda de vazia.
    jaPersistiu.current = false;
    // Revoga os object URLs dos resultados antes de largar (evita vazamento).
    setResults((prev) => {
      prev.forEach((r) => r.files.forEach((f) => URL.revokeObjectURL(f.url)));
      return [];
    });
    snapshotRef.current.createdAt = Date.now();
  }, [flushPersist, descartarPendente]);

  const selectConversation = useCallback(
    async (id: string): Promise<StoredConversation | null> => {
      flushPersist(); // grava a conversa atual antes de trocar (#1)
      /*
       * Disco preferido, MAS o desempate é a data.
       *
       * O disco continua vindo primeiro porque é ele que tem os BYTES dos
       * artefatos, e trocar por uma cópia sem arquivo em nome de "fonte da
       * verdade" seria perda disfarçada de correção.
       *
       * O que mudou: antes a escolha era por PRESENÇA — o disco tinha algo,
       * então vencia. Uma gravação de disco que falhasse deixava ali uma versão
       * velha, e ela eclipsava a cópia boa do servidor em toda reabertura. Este
       * mesmo comentário já dizia qual era o critério certo ("é resolvida na
       * lista, por `updatedAt`"); ele só nunca tinha descido até aqui.
       *
       * Comparar não custa requisição: `remotasRef` já está em memória. E se a
       * lista remota ainda não carregou, a abertura NÃO espera por ela —
       * bloquear toda abertura de conversa por um caso raro trocaria uma perda
       * rara por lentidão constante.
       */
      const doDisco = await getConversation(id);
      const remoto = remotasRef.current.find((c) => c.id === id) ?? null;
      let rec = doDisco;
      if (escolherCopia(doDisco, remoto) === "servidor") {
        const doServidor = await lerDoServidor(id);
        // Desce para este disco, senão toda reabertura pagaria a rede de novo e
        // um F5 offline a perderia.
        if (doServidor) {
          rec = doServidor;
          await putConversation(doServidor).catch(() => {});
        }
      }
      if (!rec) return null;
      // Reidrata os resultados: busca cada blob e cria URLs vivas.
      const restored: SavedResult[] = [];
      for (const meta of rec.results) {
        const files: SavedFile[] = [];
        let faltouByte = false;
        for (const fm of meta.files) {
          const blob = await getBlob(fm.blobKey);
          if (!blob) {
            // NÃO some: a marca sobe para o resultado e a tela diz que o
            // arquivo não está nesta máquina.
            faltouByte = true;
            continue;
          }
          files.push({
            label: fm.label,
            name: fm.name,
            mime: fm.mime,
            url: URL.createObjectURL(blob),
            blobKey: fm.blobKey,
            ...(fm.primary ? { primary: true } : {}),
            // Registro antigo não tem o tamanho gravado: o blob está aqui, então
            // ele é lido agora em vez de a linha ficar sem o dado para sempre.
            sizeBytes: fm.sizeBytes ?? blob.size,
          });
        }
        restored.push({
          artifactId: meta.artifactId,
          kind: meta.kind,
          summary: meta.summary,
          ...(meta.canvas ? { canvas: meta.canvas } : {}),
          files,
          ...(meta.payload !== undefined ? { payload: meta.payload } : {}),
          ...(meta.generatedAt !== undefined ? { generatedAt: meta.generatedAt } : {}),
          ...(faltouByte ? { bytesAusentes: true } : {}),
        });
      }
      /*
       * A REDE POR BAIXO — o que traz de volta o parecer já perdido.
       *
       * Se nenhuma das duas cópias trouxe o artefato de uma auditoria que esta
       * conversa registrou na largada, o trabalho pago ainda existe: o backend
       * grava o parecer no Postgres por conta própria (`persistCompletedAudit`),
       * sem passar por gravação nenhuma do cliente. Buscar é barato e só
       * acontece quando de fato falta algo.
       *
       * Falhar aqui não pode travar a abertura: sem rede, a conversa abre como
       * abriria de qualquer forma.
       */
      const faltando = parecerARecuperar({
        results: restored,
        auditorias: rec.auditorias,
        artefatosApagados: rec.artefatosApagados,
      });
      if (faltando) {
        const resposta = await consultarAuditoria(faltando.auditId).catch(() => null);
        if (resposta?.situacao === "pronta") {
          restored.push({
            artifactId: faltando.artifactId,
            kind: "auditoria",
            summary: `Auditoria — ${resposta.resultado.report.status_geral}`,
            files: [],
            payload: resposta.resultado,
            canvas: {
              label: "Auditoria",
              detail: `${resposta.resultado.report.status_geral} · ${resposta.resultado.report.total_incongruencias} achado(s)`,
            },
            generatedAt: Date.now(),
          });
          /*
           * Gravar o que foi recuperado, e SÓ nesse caso.
           *
           * Sem isto a recuperação se repetiria em toda abertura — pagando a
           * rede de novo, e deixando a conversa sem parecer justamente quando
           * ela fosse aberta offline. Com isto, o servidor é consultado uma vez
           * e o disco volta a bastar.
           *
           * Só quando houve recuperação: abrir uma conversa íntegra não deve
           * mexer no `updatedAt` dela.
           */
          schedulePersist();
        }
      }
      // Veio do disco: manter em dia, mesmo que fique "vazia" ao limpar campos.
      jaPersistiu.current = true;
      setConversationId(rec.id);
      setTitle(rec.title);
      setMessages(rec.messages);
      setSeloResultsState(rec.seloResults);
      // Conversa gravada antes deste campo existir não tem `ajustes`.
      setAjustes(rec.ajustes ?? {});
      setAvulsas(rec.avulsas ?? []);
      setTotaisPorDisciplina(rec.totaisPorDisciplina ?? {});
      setIdentidade(rec.identidade ?? {});
      setDecisoes(rec.decisoes ?? {});
      setTomosDeclarados(rec.tomosDeclarados ?? 0);
      setAchadosResolvidos(rec.achadosResolvidos ?? {});
      setAuditorias(rec.auditorias ?? []);
      setArtefatosApagados(rec.artefatosApagados ?? []);
      // A auditoria em voo volta com a conversa — quem reconecta é o palco.
      setAuditoriaPendente(rec.auditoriaPendente ?? null);
      setMemorialMeta(rec.memorial ?? null);
      /*
       * O snapshot só acompanha o estado no próximo render, e o dono chama
       * `recuperarMemorial()` logo em seguida — que lê do snapshot. Sem esta
       * linha ele leria o memorial da conversa ANTERIOR.
       */
      snapshotRef.current = { ...snapshotRef.current, memorialMeta: rec.memorial ?? null };
      // Revoga os URLs da conversa anterior antes de trocar (evita vazamento).
      setResults((prev) => {
        prev.forEach((r) => r.files.forEach((f) => URL.revokeObjectURL(f.url)));
        return restored;
      });
      snapshotRef.current.createdAt = rec.createdAt;
      return rec;
    },
    [flushPersist, schedulePersist],
  );

  const removeConversation = useCallback(
    async (id: string) => {
      await dbDelete(id);
      refreshList();
      /*
       * O servidor é apagado depois, e a falha não desfaz nada: a pessoa mandou
       * sumir e o local já sumiu. `refreshRemote` conta a verdade em seguida —
       * se a rede tiver caído, a conversa volta na lista marcada como do
       * servidor, e uma nova tentativa a apaga.
       */
      await apagarNoServidor(id);
      refreshRemote();
    },
    [refreshList, refreshRemote],
  );

  /**
   * Apaga uma PASTA inteira — as conversas que a sidebar mostrou naquele grupo.
   *
   * Não é um laço de `removeConversation` por dois motivos. O disco primeiro e
   * a lista UMA vez no fim: refrescar por conversa redesenharia a barra sete
   * vezes, e cada redesenho reordena o que a pessoa está olhando. E o servidor
   * em paralelo, depois — sete idas em fila somariam sete latências para um
   * trabalho que já sumiu daqui.
   */
  const removeConversations = useCallback(
    async (ids: readonly string[]) => {
      if (ids.length === 0) return;
      for (const id of ids) await dbDelete(id).catch(() => {});
      refreshList();
      await Promise.all(ids.map((id) => apagarNoServidor(id).catch(() => {})));
      refreshRemote();
    },
    [refreshList, refreshRemote],
  );

  /**
   * Cria uma conversa NOVA a partir de outra: leva o que custou para descobrir,
   * deixa o que é história.
   *
   * VAI: selos lidos, ajustes de folha, avulsas, totais, identidade, decisões,
   * a pasta — e o memorial retido, com os bytes copiados para a chave nova.
   * FICA: mensagens, documentos gerados, achados resolvidos e a auditoria em
   * voo. Levar as mensagens faria a conversa começar ecoando a si mesma, e os
   * artefatos apontariam para blobs de outra conversa — a exclusão de uma
   * arrastaria os arquivos da outra junto.
   *
   * Devolve o id novo; quem chama restaura a tela pelo caminho de sempre.
   */
  const duplicarConversa = useCallback(
    async (id: string): Promise<string | null> => {
      flushPersist(); // a conversa atual vai para o disco antes de largarmos ela
      const rec = (await getConversation(id)) ?? (await lerDoServidor(id));
      if (!rec) return null;
      const novoId = newId();
      const agora = Date.now();
      let memorial = rec.memorial;
      if (memorial) {
        // Os bytes são COPIADOS, não referenciados: `deleteConversation` varre
        // por prefixo de id, então apagar a original levaria junto o memorial
        // da cópia se as duas dividissem a mesma chave.
        const blob = await getBlob(memorial.blobKey).catch(() => null);
        if (blob) {
          const blobKey = `${novoId}:memorial`;
          await putBlob(blobKey, blob);
          memorial = { ...memorial, blobKey };
        } else {
          memorial = undefined;
        }
      }
      const novo: StoredConversation = {
        ...rec,
        id: novoId,
        createdAt: agora,
        updatedAt: agora,
        messages: [],
        results: [],
      };
      delete novo.auditoriaPendente;
      delete novo.achadosResolvidos;
      // A cópia não herda as auditorias da original: aquele `auditId` é do
      // trabalho dela, e recuperá-lo aqui poria o parecer de uma conversa
      // dentro de outra.
      delete novo.auditorias;
      delete novo.artefatosApagados;
      delete novo.memorial;
      if (memorial) novo.memorial = memorial;
      await putConversation(novo);
      refreshList();
      // O servidor também: uma cópia que ninguém tocar nunca dispararia o
      // `persistNow`, e só existiria nesta máquina.
      gravarNoServidor(novo).then(setSincronizacao);
      return novoId;
    },
    [flushPersist, refreshList],
  );

  const marcarAuditoriaPendente = useCallback(
    // A hora é carimbada AQUI: `Date.now()` no corpo de um componente é chamada
    // impura durante o render, e o lint do React Compiler barra — com razão.
    (p: Omit<AuditoriaPendente, "inicioMs"> | null) => {
      const valor = p ? { ...p, inicioMs: Date.now() } : null;
      setAuditoriaPendente(valor);
      /*
       * Escreve no snapshot À MÃO antes de gravar.
       *
       * O snapshot só acompanha o estado num effect, depois do render — e a
       * gravação aqui é imediata, sem debounce (um F5 no segundo seguinte ao
       * clique não pode encontrar a conversa sem o bilhete). Sem esta linha as
       * duas coisas corriam soltas: ao RESOLVER a auditoria, o flush gravava o
       * valor velho e o bilhete ressuscitava, fazendo todo F5 futuro reabrir a
       * mesma conversa para sempre.
       */
      snapshotRef.current = { ...snapshotRef.current, auditoriaPendente: valor };
      flushPersist();
    },
    [flushPersist],
  );

  const salvarMemorial = useCallback(
    async (file: File | null) => {
      const meta = file
        ? { name: file.name, blobKey: `${snapshotRef.current.conversationId}:memorial` }
        : null;
      // Os bytes primeiro: gravar a referência antes do blob deixaria uma
      // conversa apontando para um arquivo que não existe.
      if (file && meta) await putBlob(meta.blobKey, file);
      setMemorialMeta(meta);
      // Mesmo motivo do bilhete da auditoria: o snapshot só acompanha o estado
      // depois do render, e aqui a gravação é imediata.
      snapshotRef.current = { ...snapshotRef.current, memorialMeta: meta };
      flushPersist();
    },
    [flushPersist],
  );

  const salvarDossieDoMemorial = useCallback(
    (dossie: NexoDossieDraft | null) => {
      const atual = snapshotRef.current.memorialMeta;
      // Sem memorial retido não há onde pendurar os fatos — e guardá-los soltos
      // criaria um gabarito órfão, que sobreviveria a trocar de documento.
      if (!atual) return;
      const meta = { ...atual, ...(dossie ? { dossie } : {}) };
      setMemorialMeta(meta);
      snapshotRef.current = { ...snapshotRef.current, memorialMeta: meta };
      /*
       * O TÍTULO MUDA AQUI, e não na próxima mensagem.
       *
       * A identidade acaba de ser lida do memorial — é o instante em que a
       * conversa deixa de ser "Nova conversa" e passa a ser `084_25-CRICIUMA`.
       * Esperar o próximo `appendMessage` deixaria a barra lateral mostrando o
       * nome velho justamente enquanto o chat exibe os fatos detectados.
       */
      setTitle((t) =>
        deriveTitle(t, snapshotRef.current.messages, snapshotRef.current.seloResults, dossie),
      );
      flushPersist();
    },
    [flushPersist],
  );

  const recuperarMemorial = useCallback(async () => {
    const meta = snapshotRef.current.memorialMeta;
    if (!meta) return null;
    const blob = await getBlob(meta.blobKey);
    if (!blob) return null;
    return {
      file: new File([blob], meta.name, { type: blob.type || "application/pdf" }),
      dossie: meta.dossie,
    };
  }, []);

  const value = useMemo<ConversationStoreValue>(
    () => ({
      conversationId,
      title,
      messages,
      seloResults,
      ajustes,
      conversations,
      sincronizacao,
      gravacaoLocal,
      results,
      appendMessage,
      appendDelta,
      finalizeMessage,
      setSeloResults,
      ajustarFolha,
      ajustarFolhas,
      avulsas,
      criarFolhaAvulsa,
      excluirFolhaAvulsa,
      totaisPorDisciplina,
      definirTotal,
      identidade,
      corrigirIdentidade,
      decisoes,
      decidir,
      guardarDecisoesVivas,
      tomosDeclarados,
      declararTomos,
      achadosResolvidos,
      marcarAchadoResolvido,
      registrarAuditoria,
      saveResult,
      getResult,
      removeResult,
      auditoriaPendente,
      marcarAuditoriaPendente,
      salvarMemorial,
      salvarDossieDoMemorial,
      recuperarMemorial,
      newConversation,
      selectConversation,
      removeConversation,
      removeConversations,
      duplicarConversa,
    }),
    [
      conversationId,
      title,
      messages,
      seloResults,
      ajustes,
      conversations,
      sincronizacao,
      gravacaoLocal,
      results,
      appendMessage,
      appendDelta,
      finalizeMessage,
      setSeloResults,
      ajustarFolha,
      ajustarFolhas,
      avulsas,
      criarFolhaAvulsa,
      excluirFolhaAvulsa,
      totaisPorDisciplina,
      definirTotal,
      identidade,
      corrigirIdentidade,
      decisoes,
      decidir,
      guardarDecisoesVivas,
      tomosDeclarados,
      declararTomos,
      achadosResolvidos,
      marcarAchadoResolvido,
      registrarAuditoria,
      saveResult,
      getResult,
      removeResult,
      auditoriaPendente,
      marcarAuditoriaPendente,
      salvarMemorial,
      salvarDossieDoMemorial,
      recuperarMemorial,
      newConversation,
      selectConversation,
      removeConversation,
      removeConversations,
      duplicarConversa,
    ],
  );

  return (
    <ConversationStoreContext.Provider value={value}>
      {children}
    </ConversationStoreContext.Provider>
  );
}

/** Lê o store da conversa. Lança fora do provider (uso deliberado no workspace). */
export function useConversation(): ConversationStoreValue {
  const ctx = useContext(ConversationStoreContext);
  if (!ctx) {
    throw new Error("useConversation precisa estar dentro de <ConversationStoreProvider>.");
  }
  return ctx;
}
