/**
 * Máquina de estados da conversa/sessão do Nexo (§2 da ARQUITETURA.md).
 *
 * Este módulo é PURO: sem IO, sem React, sem `Date.now()`/`Math.random()` — só
 * transições determinísticas e imutáveis sobre `NexoSession`. Segue o mesmo
 * contrato de testabilidade do `normalize.ts`: dá pra carregar no `node` cru e
 * travar a tabela de transições por teste (`node scripts/test-nexo-session.ts`).
 *
 * Regra de peso (§2): binários pesados (ArrayBuffers de pranchas, base64 de
 * capa/LD/volume, crops) NUNCA entram aqui — vivem no `blobRegistry` fora do
 * React (ver ./blob-registry.ts). O estado guarda só ids + metadados leves.
 *
 * Só `import type` — nada disto carrega runtime (o `node` apaga por completo os
 * imports de tipo), então zero risco de puxar `@/` ou IO por transitividade.
 */
import type {
  ArtifactId,
  ArtifactPreview,
  NexoAgentProposal,
  NexoAgentTurn,
  NexoArtifact,
  NexoArtifactKind,
  NexoArtifactMeta,
  NexoDossie,
  NexoInputFile,
  NexoIssue,
  NexoMessage,
} from "../types";
// SeloForLd é o tipo já cunhado no builder de LD — REUSO, não redefino (§5).
import type { SeloForLd } from "../../../server/nexo/build-ld-proposal";

// ---------------------------------------------------------------------------
// Tipos de estado
// ---------------------------------------------------------------------------

/** Chave de um conjunto de selos por disciplina (§5). Hoje é a própria disciplina. */
export type DisciplinaKey = string;

/** Id de um slot de decisão humana (§3). */
export type SlotId = string;

/**
 * Estado de UM slot preenchido. Mínimo na v1 — o SlotResolver (§3) e o vocabulário
 * de origem/validação crescem no PR3. Aqui só guardamos o valor confirmado.
 */
export interface SlotState {
  value: string;
}

/** Progresso da leitura de selos (debounced pelo hook, não pelo reducer). */
export interface NexoIntakeProgress {
  done: number;
  total: number;
}

/** Fatia efêmera do intake (classificação + leitura de selos). */
export interface NexoIntakeState {
  status: "idle" | "classifying" | "reading-selos" | "ready" | "error";
  progress?: NexoIntakeProgress;
  paused?: boolean;
}

/** Fatia efêmera do turno do agente — isolada do durável (não persiste). */
export interface NexoTurnState {
  status: "idle" | "thinking" | "error";
  error?: NexoIssue;
}

/**
 * Estado raiz da sessão (§2). É a ÚNICA fonte de verdade durável do workspace;
 * `dossie.artefatos` é legado — o mapa `artifacts` (C2) é a fonte dos artefatos.
 */
export interface NexoSession {
  started: boolean;
  messages: NexoMessage[];
  dossie: NexoDossie;
  seloSets: Record<DisciplinaKey, SeloForLd[]>;
  artifacts: Record<ArtifactId, NexoArtifact>;
  activeArtifactId: ArtifactId | null;
  slots: Record<SlotId, SlotState>;
  intake: NexoIntakeState;
  turn: NexoTurnState;
  diagnostics: NexoIssue[];
}

/** Dossiê vazio determinístico (id fixo — sem random, o reducer é puro). */
function initDossie(): NexoDossie {
  return { id: "", disciplinas: [], arquivos: [], artefatos: [] };
}

/** Estado inicial da sessão. Usado por `useReducer(..., undefined, initNexoSession)`. */
export function initNexoSession(): NexoSession {
  return {
    started: false,
    messages: [],
    dossie: initDossie(),
    seloSets: {},
    artifacts: {},
    activeArtifactId: null,
    slots: {},
    intake: { status: "idle" },
    turn: { status: "idle" },
    diagnostics: [],
  };
}

// ---------------------------------------------------------------------------
// Alfabeto de eventos (FECHADO — a tabela de transições é testada)
// ---------------------------------------------------------------------------

/**
 * União fechada de eventos (§2). É o alfabeto EXATO: nada muda o estado fora
 * daqui. Ids de mensagem chegam NO evento (o reducer não cunha timestamps).
 */
export type NexoSessionEvent =
  | { type: "USER_SUBMITTED_MESSAGE"; id: string; content: string }
  | { type: "AGENT_TURN_STARTED" }
  | {
      type: "AGENT_TURN_SUCCEEDED";
      /** Id da mensagem do assistente que origina os artefatos. */
      messageId: string;
      turn: NexoAgentTurn;
      /** Prévias leves alinhadas às `turn.proposals` por índice. */
      previews?: ArtifactPreview[];
    }
  | { type: "AGENT_TURN_FAILED"; error?: NexoIssue }
  | { type: "FILES_ATTACHED"; files: NexoInputFile[] }
  | { type: "INTAKE_CLASSIFIED"; dossie: NexoDossie }
  | { type: "SELO_PROGRESS"; progress: NexoIntakeProgress }
  | { type: "SELO_PAUSED" }
  | { type: "SELO_RESUMED" }
  | { type: "SELOS_READ"; key: DisciplinaKey; selos: SeloForLd[] }
  | { type: "SLOT_FILLED"; id: SlotId; value: string }
  | { type: "ARTIFACT_GENERATE_REQUESTED"; id: ArtifactId }
  | { type: "ARTIFACT_GENERATE_SUCCEEDED"; id: ArtifactId; result: unknown }
  | { type: "ARTIFACT_GENERATE_FAILED"; id: ArtifactId; issue: NexoIssue }
  | { type: "ARTIFACT_FOCUSED"; id: ArtifactId }
  | { type: "ARTIFACT_DISMISSED"; id: ArtifactId };

// ---------------------------------------------------------------------------
// Cunhagem determinística do ArtifactId (C2)
// ---------------------------------------------------------------------------

/** Normaliza um campo do id: trim, minúsculo, espaços viram hífen. */
function normPart(part: string): string {
  return part.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * Cunha o `ArtifactId` de campos ESTRUTURADOS (nunca do resumo string, C2):
 * `${kind}:${codigo}:${revisao}:${disciplinaKey}` normalizado. Determinístico:
 * as mesmas entradas dão sempre o mesmo id (base do dedup de spawn).
 */
export function mintArtifactId(fields: {
  kind: NexoArtifactKind;
  codigo: string;
  revisao: string;
  disciplinaKey: string;
}): ArtifactId {
  return [fields.kind, fields.codigo, fields.revisao, fields.disciplinaKey]
    .map(normPart)
    .join(":");
}

/**
 * Deriva os campos estruturados de identidade de uma proposta a partir do
 * dossiê. Código/revisão são fatos do dossiê; a disciplina, na v1, é a primeira
 * do dossiê (a desambiguação multi-disciplina por proposta é adiada — §5).
 */
function proposalIdentity(proposal: NexoAgentProposal, dossie: NexoDossie) {
  return {
    kind: proposal.kind,
    codigo: dossie.codigo?.value ?? "",
    revisao: dossie.revisao?.value ?? "",
    disciplinaKey: dossie.disciplinas[0] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Guarda de pré-condição — REGRA ÚNICA (§2)
// ---------------------------------------------------------------------------

/**
 * ÚNICO lugar da regra: montar um `volume` exige capa + separatriz + LD já em
 * `ready` no estado. A guarda vive NO reducer (transição ilegal, testável), não
 * só no botão — assim a UI e qualquer outro chamador respeitam a mesma pré-
 * condição. Resolve o conflito das três casas propostas na spec.
 */
const VOLUME_REQUER: NexoArtifactKind[] = ["capa", "separatriz", "ld"];

function volumePreCondicaoOk(artifacts: Record<ArtifactId, NexoArtifact>): boolean {
  const prontos = Object.values(artifacts);
  return VOLUME_REQUER.every((kind) =>
    prontos.some((a) => a.kind === kind && a.status === "ready"),
  );
}

/** Diagnóstico determinístico da guarda de volume (id derivado, sem random). */
function volumeGuardIssue(id: ArtifactId): NexoIssue {
  return {
    id: `precondicao:volume:${id}`,
    scope: "volume",
    severity: "aviso",
    code: "VOLUME_PRECONDICAO",
    title: "Volume ainda não pode ser montado",
    detail:
      "Gerar o volume exige capa, separatriz e LD prontos (ready) na sessão.",
  };
}

/** Empurra um issue em diagnostics dedupando por id (idempotente). */
function pushIssue(list: NexoIssue[], issue: NexoIssue): NexoIssue[] {
  return [...list.filter((i) => i.id !== issue.id), issue];
}

// ---------------------------------------------------------------------------
// Spawn/replace de artefatos (dedup, §2)
// ---------------------------------------------------------------------------

/** Metadados leves de um artefato (sem a fatia de status). */
function metaOf(a: NexoArtifact): NexoArtifactMeta {
  return a.preview
    ? { id: a.id, kind: a.kind, messageId: a.messageId, preview: a.preview }
    : { id: a.id, kind: a.kind, messageId: a.messageId };
}

/** Cria um artefato novo em `proposed` a partir de uma proposta. */
function makeProposed(
  id: ArtifactId,
  proposal: NexoAgentProposal,
  messageId: string,
  preview: ArtifactPreview | undefined,
): NexoArtifact {
  const meta: NexoArtifactMeta = preview
    ? { id, kind: proposal.kind, messageId, preview }
    : { id, kind: proposal.kind, messageId };
  return { ...meta, status: "proposed", params: proposal.params };
}

/** Primeiro id livre `${base}#N` (N≥2) — para não sobrescrever trabalho pronto. */
function nextFreeId(
  artifacts: Record<ArtifactId, NexoArtifact>,
  base: ArtifactId,
): ArtifactId {
  let n = 2;
  while (artifacts[`${base}#${n}`]) n += 1;
  return `${base}#${n}`;
}

/**
 * Spawn/replace determinístico (§2): para cada proposta computa o id (C2).
 * - id livre           → cria artefato `proposed`.
 * - id em `proposed`   → ATUALIZA params (mesmo id; a proposta se refinou).
 * - id em ready/gen/err → cria NOVO id (`#N`): não sobrescreve trabalho pronto.
 * `activeArtifactId` passa a ser o último artefato tocado (dirige o STAGE).
 */
function spawnArtifacts(
  state: NexoSession,
  proposals: NexoAgentProposal[],
  messageId: string,
  previews: ArtifactPreview[] | undefined,
): Pick<NexoSession, "artifacts" | "activeArtifactId"> {
  const artifacts: Record<ArtifactId, NexoArtifact> = { ...state.artifacts };
  let active = state.activeArtifactId;

  proposals.forEach((proposal, index) => {
    const baseId = mintArtifactId(proposalIdentity(proposal, state.dossie));
    const preview = previews?.[index];
    const existing = artifacts[baseId];

    if (!existing) {
      artifacts[baseId] = makeProposed(baseId, proposal, messageId, preview);
      active = baseId;
      return;
    }
    if (existing.status === "proposed") {
      // Dedup: a mesma proposta ainda editável — atualiza params (mesmo id).
      artifacts[baseId] = {
        ...metaOf(existing),
        ...(preview ? { preview } : {}),
        status: "proposed",
        params: proposal.params,
      };
      active = baseId;
      return;
    }
    // ready | generating | error: não mexe no que já foi trabalhado — novo id.
    const newId = nextFreeId(artifacts, baseId);
    artifacts[newId] = makeProposed(newId, proposal, messageId, preview);
    active = newId;
  });

  return { artifacts, activeArtifactId: active };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Reducer PURO e imutável da sessão. Toda transição devolve um novo objeto (ou
 * o mesmo, se a transição for no-op/ilegal). Nunca faz IO.
 */
export function nexoSessionReducer(
  state: NexoSession,
  event: NexoSessionEvent,
): NexoSession {
  switch (event.type) {
    case "USER_SUBMITTED_MESSAGE": {
      const msg: NexoMessage = {
        id: event.id,
        role: "user",
        content: event.content,
      };
      return { ...state, started: true, messages: [...state.messages, msg] };
    }

    case "AGENT_TURN_STARTED":
      return { ...state, turn: { status: "thinking" } };

    case "AGENT_TURN_SUCCEEDED": {
      // Atômico (§2): append msg + spawn/replace artefatos + turn→idle.
      const { proposals, reply } = event.turn;
      const msg: NexoMessage = {
        id: event.messageId,
        role: "assistant",
        content: reply,
        ...(proposals.length ? { proposals } : {}),
      };
      const spawned = spawnArtifacts(
        state,
        proposals,
        event.messageId,
        event.previews,
      );
      return {
        ...state,
        started: true,
        messages: [...state.messages, msg],
        artifacts: spawned.artifacts,
        activeArtifactId: spawned.activeArtifactId,
        turn: { status: "idle" },
      };
    }

    case "AGENT_TURN_FAILED":
      return {
        ...state,
        turn: event.error
          ? { status: "error", error: event.error }
          : { status: "error" },
      };

    case "FILES_ATTACHED":
      return {
        ...state,
        dossie: {
          ...state.dossie,
          arquivos: [...state.dossie.arquivos, ...event.files],
        },
        intake: { ...state.intake, status: "classifying" },
      };

    case "INTAKE_CLASSIFIED":
      // v1: substitui o dossiê pelo classificado. O MERGE com proveniência
      // (NexoFact) é refinado no PR3 — aqui só ativamos o formato de linha.
      return { ...state, dossie: event.dossie, intake: { status: "ready" } };

    case "SELO_PROGRESS":
      return {
        ...state,
        intake: {
          ...state.intake,
          status: "reading-selos",
          progress: event.progress,
        },
      };

    case "SELO_PAUSED":
      return { ...state, intake: { ...state.intake, paused: true } };

    case "SELO_RESUMED":
      return { ...state, intake: { ...state.intake, paused: false } };

    case "SELOS_READ":
      return {
        ...state,
        seloSets: { ...state.seloSets, [event.key]: event.selos },
      };

    case "SLOT_FILLED":
      return {
        ...state,
        slots: { ...state.slots, [event.id]: { value: event.value } },
      };

    case "ARTIFACT_GENERATE_REQUESTED": {
      const artifact = state.artifacts[event.id];
      if (!artifact) return state; // no-op seguro: id inexistente.

      // GUARDA (§2): volume exige capa+separatriz+LD ready. Transição ILEGAL
      // não muda o artefato — empurra um diagnóstico e para aqui.
      if (
        artifact.kind === "volume" &&
        !volumePreCondicaoOk(state.artifacts)
      ) {
        return {
          ...state,
          diagnostics: pushIssue(state.diagnostics, volumeGuardIssue(artifact.id)),
        };
      }

      const prevResult =
        artifact.status === "ready" ? artifact.result : undefined;
      const generating: NexoArtifact = {
        ...metaOf(artifact),
        status: "generating",
        params: artifact.params,
        ...(prevResult !== undefined ? { prevResult } : {}),
      };
      return {
        ...state,
        artifacts: { ...state.artifacts, [artifact.id]: generating },
        activeArtifactId: artifact.id,
      };
    }

    case "ARTIFACT_GENERATE_SUCCEEDED": {
      const artifact = state.artifacts[event.id];
      if (!artifact) return state;
      const ready: NexoArtifact = {
        ...metaOf(artifact),
        status: "ready",
        params: artifact.params,
        result: event.result,
      };
      return {
        ...state,
        artifacts: { ...state.artifacts, [artifact.id]: ready },
      };
    }

    case "ARTIFACT_GENERATE_FAILED": {
      const artifact = state.artifacts[event.id];
      if (!artifact) return state;
      const errored: NexoArtifact = {
        ...metaOf(artifact),
        status: "error",
        params: artifact.params,
        error: event.issue,
      };
      return {
        ...state,
        artifacts: { ...state.artifacts, [artifact.id]: errored },
      };
    }

    case "ARTIFACT_FOCUSED":
      if (!state.artifacts[event.id]) return state;
      return { ...state, activeArtifactId: event.id };

    case "ARTIFACT_DISMISSED": {
      if (!state.artifacts[event.id]) return state;
      const artifacts = { ...state.artifacts };
      delete artifacts[event.id];
      return {
        ...state,
        artifacts,
        activeArtifactId:
          state.activeArtifactId === event.id ? null : state.activeArtifactId,
      };
    }

    default: {
      // Exaustividade: se um novo evento entrar no alfabeto sem case, o tsc
      // acusa aqui (o `never` deixa de ser atribuível).
      const _exhaustive: never = event;
      return state;
    }
  }
}
