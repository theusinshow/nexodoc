/**
 * Tipos do modulo Nexo (assistente conversacional que orquestra os demais
 * modulos do NexoDoc). Primeira versao do "Dossie do Projeto": o objeto unico
 * de estado que o agente vai construindo ao longo da conversa e que alimenta
 * cada ferramenta (LD, capas, separatrizes, volume, auditoria) sem redigitacao.
 *
 * Fase 0 do roadmap (docs/nexo-roadmap.md). Ainda vai evoluir — nao tratar como
 * contrato estavel.
 */

/** Arquivo enviado pelo usuario, antes/depois de classificado. */
export interface NexoInputFile {
  id: string;
  name: string;
  sizeBytes: number;
  /** Disciplina detectada pela classificacao (ex.: "HIDROSSANITARIO"), quando houver. */
  disciplinaDetectada?: string;
  /** Numero de pranchas/paginas detectadas, quando aplicavel. */
  paginas?: number;
}

/** Fato do dossie: valor + origem + se ja foi confirmado pelo usuario. */
export interface NexoFact<T> {
  value: T;
  /** Como o valor chegou: extraido de arquivo, herdado de projeto, ou digitado. */
  origem: "extraido" | "projeto" | "usuario" | "sugerido";
  /** Fatos de alto risco so entram no documento apos confirmacao explicita. */
  confirmado: boolean;
}

/** Estado consolidado que o agente monta e cada ferramenta consome. */
export interface NexoDossie {
  id: string;
  projectId?: string;
  obra?: NexoFact<string>;
  orgao?: NexoFact<string>;
  codigo?: NexoFact<string>;
  revisao?: NexoFact<string>;
  fase?: NexoFact<string>;
  disciplinas: string[];
  arquivos: NexoInputFile[];
  /** Artefatos ja produzidos pelas ferramentas nesta sessao. */
  artefatos: NexoArtifact[];
}

export type NexoArtifactKind =
  | "ld"
  | "capa"
  | "separatriz"
  | "volume"
  | "auditoria"
  | "conferencia";

/**
 * Modelo único de problema/erro (C7/§7 da ARQUITETURA.md). Mínimo na v1; o
 * vocabulário de `recovery` e a taxonomia de codes crescem no PR6.
 */
export type NexoIssueSeverity = "info" | "aviso" | "critico";
export interface NexoIssue {
  id: string;
  scope: string;
  severity: NexoIssueSeverity;
  code: string;
  title: string;
  detail: string;
  evidence?: string;
}

/**
 * Prévia leve de um artefato gerado (§4). Detalhada no PR5 (worker react-pdf).
 * PDFs anexados pelo usuário NUNCA têm preview (invariante Artifact vs Attachment).
 */
export interface ArtifactPreview {
  objectUrl?: string;
  pageNumber?: number;
  variante?: "frame" | "volume";
}

/**
 * Id determinístico cunhado pelo CLIENTE de campos ESTRUTURADOS
 * (`${kind}:${codigo}:${revisao}:${disciplinaKey}`), nunca do resumo string.
 */
export type ArtifactId = string;

/**
 * Sub-máquina de estado por artefato (C2). `params`/`result` são `unknown` na v1
 * (o PR2 tipa forte por kind: LD -> NexoLdProposalParams+LdGenResult; etc.).
 * `generating` mantém `prevResult` para o download antigo seguir válido.
 */
export type NexoArtifactStatus =
  | { status: "proposed"; params: unknown }
  | { status: "generating"; params: unknown; prevResult?: unknown }
  | { status: "ready"; params: unknown; result: unknown }
  | { status: "error"; params: unknown; error: NexoIssue };

export interface NexoArtifactMeta {
  id: ArtifactId;
  kind: NexoArtifactKind;
  /** Mensagem do assistente que originou este artefato. */
  messageId: string;
  preview?: ArtifactPreview;
}

/**
 * Artefato gerado pelo motor. Reescrito no PR0 (a forma inerte anterior —
 * kind/status/label/url — não carregava id/params/result que estado, prévia e
 * transições por artefato pressupõem).
 */
export type NexoArtifact = NexoArtifactMeta & NexoArtifactStatus;

/**
 * Resultado da classificacao deterministica de UM arquivo no intake (sem IA).
 * Composto por `classifyDocument` (tipo/identidade) + `classifyPageAsset`
 * (disciplina). Alimenta o "afirma fatos, pergunta decisoes".
 */
export interface NexoFileClassification {
  fileName: string;
  /** Caminho relativo quando veio de upload de pasta (blocos/tomos). */
  relPath?: string;
  /** NexoDocTipo do parser: memorial | capa | separatriz | prancha | volume | orcamento | outro. */
  tipo: string;
  tipoLabel: string;
  /** true = orcamento (fora do escopo do Nexo); conteudo nem e lido. */
  foraDeEscopo: boolean;
  /** versao assinada (duplicata do documento). */
  assinado: boolean;
  obra: string;
  municipio: string;
  orgao: string;
  /** Do nome do arquivo (autoritativo), com fallback no conteudo. */
  codigo: string;
  revisao: string;
  /** Codigos de disciplina do nome/pasta (multi). */
  disciplinas: string[];
  folha?: string;
  volume?: string;
  pageCount: number;
  charCount: number;
  confianca: "alta" | "media" | "baixa";
  precisaOcr: boolean;
  sinais: string[];
}

/** Contagem de documentos por papel dentro de um volume. */
export interface NexoVolumeCounts {
  memoriais: number;
  capas: number;
  separatrizes: number;
  pranchas: number;
  volumes: number;
  outros: number;
}

/** Um volume do projeto, com seus arquivos e disciplinas. */
export interface NexoVolumeGroup {
  numero?: string;
  rotulo: string;
  disciplinas: string[];
  contagem: NexoVolumeCounts;
  arquivos: NexoFileClassification[];
}

/** Dossie parcial montado pelo intake: fatos agregados + estrutura + por-arquivo. */
export interface NexoDossieDraft {
  obra?: string;
  orgao?: string;
  municipio?: string;
  codigo?: string;
  revisao?: string;
  disciplinas: string[];
  /** Estrutura por volume (agrupa pranchas/capas/separatrizes). */
  volumes: NexoVolumeGroup[];
  /** Arquivos sem volume identificado (memorial geral, avulsos). */
  semVolume: NexoFileClassification[];
  arquivos: NexoFileClassification[];
}

/** Papel de cada mensagem no chat do Nexo. */
export type NexoRole = "user" | "assistant";

/**
 * Parâmetros que o agente PROPÕE para uma LD (nada gerado ainda). São decisões
 * editáveis: o engenheiro confirma/corrige no card antes de gerar.
 */
export interface NexoLdProposalParams {
  /** Título da seção (varia por projeto). Vazio = engenheiro decide. */
  tituloLd: string;
  /** Divide as folhas em N tomos. Default 1. */
  numTomos: number;
}

/** Parâmetros propostos para uma capa. Editáveis antes de gerar. */
export interface NexoCapaProposalParams {
  /** Template (prefeitura + variante) que fornece órgão/secretaria/formato. */
  templateId: string;
  /** Volume arábico ("1","2"...); "" = deriva do nome do arquivo. */
  volume: string;
  /** Divide em N tomos (uma capa por tomo). Default 1. */
  numTomos: number;
}

/** Parâmetros propostos para uma separatriz. */
export interface NexoSeparatrizProposalParams {
  /** Template (prefeitura) que fornece órgão/secretaria/formato. */
  templateId: string;
  /** Divide em N tomos. Default 1. */
  numTomos: number;
}

/** Parâmetros propostos para a auditoria do memorial. */
export interface NexoAuditoriaProposalParams {
  /** Profundidade da análise. */
  nivel: "standard" | "deep";
}

/**
 * Proposta estruturada do agente. O ConfirmationCard renderiza os params
 * READ-ONLY + [Confirmar e gerar]; corrigir reabre o slot em conversa (C1).
 * A geração (irreversível) só acontece no clique, chamando as rotas
 * determinísticas — a IA nunca gera o documento.
 *
 * Estendido no PR0 (aditivo): conferencia | volume | separatriz | auditoria.
 * `conferencia`/`volume` não têm decisão editável do usuário na v1.
 */
export type NexoAgentProposal =
  | { kind: "ld"; resumo: string; params: NexoLdProposalParams }
  | { kind: "capa"; resumo: string; params: NexoCapaProposalParams }
  | { kind: "separatriz"; resumo: string; params: NexoSeparatrizProposalParams }
  | { kind: "auditoria"; resumo: string; params: NexoAuditoriaProposalParams }
  | { kind: "conferencia"; resumo: string; params: Record<string, never> }
  | { kind: "volume"; resumo: string; params: Record<string, never> };

/** fill = escreve no composer (usuário edita e envia); send = envia direto. */
export type NexoSlotCommit = "fill" | "send";

/** Pré-resposta (chip) de um slot. Renderiza abaixo da bolha, nunca formulário. */
export interface NexoSlotSuggestion {
  label: string;
  value: string;
  commit: NexoSlotCommit;
}

/**
 * Pedido de UM slot faltante (§3). O SlotResolver determinístico decide O QUE
 * falta; a IA só redige `prompt` e gera `suggestions`.
 */
export interface NexoSlotRequest {
  slotId: string;
  taskKind: NexoArtifactKind;
  prompt: string;
  optional: boolean;
  suggestions: NexoSlotSuggestion[];
}

/** Valor de slot extraído do texto livre do usuário no turno. */
export interface NexoSlotFill {
  slotId: string;
  value: string;
}

/**
 * Um turno de resposta do agente: texto conversacional + propostas (0+).
 * Estendido no PR0 (C3/§3): `slotRequest` (o que perguntar) e `slotFills`
 * (o que o modelo entendeu do texto livre). Opcionais — degrada gracioso.
 */
export interface NexoAgentTurn {
  reply: string;
  proposals: NexoAgentProposal[];
  slotRequest?: NexoSlotRequest;
  slotFills?: NexoSlotFill[];
}

export interface NexoMessage {
  id: string;
  role: NexoRole;
  content: string;
  /** Propostas anexadas a uma mensagem do assistente (renderizam como cards). */
  proposals?: NexoAgentProposal[];
}

/**
 * Prévia determinística das folhas que vão para a LD (vem da rota /agent). Vive
 * aqui (tipo de domínio, serializável) para o chat, os cards e a persistência
 * compartilharem sem acoplar a componentes.
 */
export interface LdPreviewData {
  rows: { sheet: string; file: string; description: string }[];
  totalFolhas: number;
  referenceTotal: number | null;
}

/**
 * Mensagem renderizada no chat do Nexo (log + cards). Serializável (JSON) — é o
 * que a persistência guarda por conversa. Superset "de UI" do NexoMessage: além
 * de role/content, carrega a `slotRequest` e a `ldPreview` do turno.
 */
export interface NexoChatMessage {
  id: string;
  role: NexoRole;
  content: string;
  proposals?: NexoAgentProposal[];
  slotRequest?: NexoSlotRequest;
  ldPreview?: LdPreviewData;
}
