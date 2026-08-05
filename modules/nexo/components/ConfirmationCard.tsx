"use client";

/**
 * ConfirmationCard (C1 / Apêndice A#1 da ARQUITETURA.md) — o card de proposta é
 * READ-ONLY. Nunca formulário. Mostra os parâmetros JÁ resolvidos (mono), a
 * prévia determinística das folhas (LD) e UM botão "Confirmar e gerar". Corrigir
 * NUNCA abre um campo: os chips "alterar <slot>" reabrem o slot EM CONVERSA
 * (escrevem no composer via `fill`), e o próximo turno do agente re-propõe com o
 * valor novo.
 *
 * A geração (passo irreversível) só acontece no clique, chamando a fachada
 * determinística (`generate.ts`) com os params da proposta. A IA nunca gera.
 *
 * Escopo PR4-UI: `ld`, `capa` e `conferencia` fecham ponta-a-ponta com os selos.
 * `separatriz`, `auditoria` e `volume` renderizam read-only, mas a geração plena
 * depende de contexto que chega depois (memorial no composer; bytes das partes no
 * blobRegistry/canvas) — PR5/PR6. Estado honesto, sem fingir.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  FileText,
  Layers,
  ScanLine,
  AlertTriangle,
  Loader2,
  Download,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { buildLdProposal, type SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { LightCheckResult } from "@/server/nexo/light-check-core";
import type { SeloIdentityResult } from "@/server/nexo/selo-identity-core";
import {
  getEmissionVerdict,
  groupFindingsByImpact,
  type AuditReport,
} from "@/lib/audit-report";
import type { MemorialAuditResult } from "../lib/audit";
import type {
  NexoAgentProposal,
  NexoLdProposalParams,
  NexoCapaProposalParams,
  NexoSeparatrizProposalParams,
  NexoAuditoriaProposalParams,
  LdPreviewData,
} from "../types";

export type { LdPreviewData };
import {
  postLd,
  postCapa,
  postCheck,
  postAudit,
  postSeparatriz,
  arquivosDaSeparatriz,
  ODT_MIME,
} from "../lib/generate";
import {
  assembleVolume,
  urlToBase64,
  type BlocoDoVolume,
} from "../lib/assemble-volume";
import { summarizeSelos } from "../lib/agent-context";
import { buildBalancedQuantities } from "@/lib/ld/ld-rules";
import { gruposDasFolhas, type Folha } from "../lib/folhas";
import {
  blocosDasFolhas,
  misturaDisciplinas,
  resumoDosBlocos,
  type Bloco,
} from "../lib/blocos";
import { codigoDaFolha, rotuloDoCodigo } from "../lib/disciplina-da-folha";
import { conferirIdentidadeDoSelo } from "../lib/selo-check";
import { lerVolumeMontado } from "../lib/volume-leitura";
import {
  alinharPartes,
  montarPlanoDePaginas,
  papeisEsperados,
  type BlocoDoPlano,
} from "@/server/nexo/volume-plano";
import {
  checkVolumeMontado,
  type VolumeCheckResult,
} from "@/server/nexo/volume-check-core";
import { corDaDisciplina } from "../lib/disciplina-cor";
import { assinaturaDoTomo, folhasDoTomo } from "../lib/drop-folhas";
import { fatosDaConversa } from "@/server/nexo/agent/fatos";
import { useAuditoria } from "../state/auditoria-store";
import { opcoesDoTomo } from "../lib/editar-artefato";
import { totalDoConjunto } from "../lib/totais";
import {
  consequenciaDaMudanca,
  haQuantoTempo,
  mudancasDoArtefato,
  tamanhoLegivel,
  type MudancaDeParametro,
} from "../lib/pendencia";
import { useComposer } from "../state/composer-controller";
import { useConversation, type SavedResult } from "../state/conversation-store";
import { baixarEditaveis, editaveisDosResultados } from "../lib/editaveis";
import {
  gerarEditaveisConsolidados,
  parametrosDaEntrega,
} from "../lib/editaveis-consolidados";
import { nomeDoVolume } from "../lib/nome-do-volume";
import { useConversationUsage } from "../state/use-conversation-usage";

const PDF_MIME = "application/pdf";

/** Id determinístico do artefato (deriva dos selos + params, não do resultado). */
function ldId(selos: SeloForLd[]): string {
  const s = summarizeSelos(selos);
  return `ld:${s.codigo ?? "x"}:${s.revisao ?? "x"}`;
}
/**
 * Id da capa. Deriva SÓ do código da obra, como os outros artefatos — a capa é
 * UMA por conversa e é ATUALIZADA no lugar quando muda volume, tomo ou título.
 *
 * Antes o volume entrava na chave. Isso fazia "altere a capa para VOL VI" gerar
 * um id diferente do `capa:<codigo>:auto` original, e o canvas ficava com DUAS
 * capas — editar virava criar.
 */
function capaId(selos: SeloForLd[]): string {
  return `capa:${summarizeSelos(selos).codigo ?? "x"}`;
}

/**
 * Prefixo das chaves ANTIGAS (`capa:<codigo>:<volume>`). Conversas gravadas
 * antes da correção guardaram a capa com esse formato; sem isto elas voltariam
 * do histórico como se nunca tivessem gerado capa nenhuma.
 */
function capaIdLegado(selos: SeloForLd[]): string {
  return `capa:${summarizeSelos(selos).codigo ?? "x"}:`;
}
function volumeId(selos: SeloForLd[]): string {
  return `volume:${summarizeSelos(selos).codigo ?? "x"}`;
}
function conferenciaId(selos: SeloForLd[]): string {
  return `conferencia:${summarizeSelos(selos).codigo ?? "x"}`;
}
function separatrizId(selos: SeloForLd[]): string {
  return `separatriz:${summarizeSelos(selos).codigo ?? "x"}`;
}
/**
 * Id do artefato de auditoria. O código sai dos selos quando há pranchas; numa
 * conversa só de memorial ele vem da classificação do próprio documento — sem
 * isso, toda auditoria sem prancha viraria o mesmo id ("auditoria:x") e uma
 * sobrescreveria a outra.
 */
function auditoriaId(selos: SeloForLd[], codigoDoMemorial?: string | null): string {
  const codigo = summarizeSelos(selos).codigo ?? codigoDoMemorial?.trim() ?? "x";
  return `auditoria:${codigo}`;
}

/**
 * Rótulo dos tomos no card. Com a contagem deslocada, "2" sozinho engana — o
 * engenheiro precisa ver que sairão TOMO 04 e 05, não 01 e 02.
 */
function rotuloTomos(numTomos: number, tomoInicial: number): string {
  if (tomoInicial <= 1) return String(numTomos);
  const ultimo = tomoInicial + numTomos - 1;
  const faixa =
    numTomos === 1
      ? String(tomoInicial).padStart(2, "0")
      : `${String(tomoInicial).padStart(2, "0")}–${String(ultimo).padStart(2, "0")}`;
  return `${numTomos} (TOMO ${faixa})`;
}

/**
 * Os tomos de uma proposta, 1-based, com o número REAL no volume.
 *
 * Cada tomo é um volume físico: com 2 tomos saem 2 capas, 2 LDs, 2 separatrizes
 * e 2 volumes — não um documento com duas partes dentro. Com um tomo devolve uma
 * entrada com `atual: 0`, que é o modo "documento único" de sempre: as chaves
 * dos artefatos ficam idênticas às de hoje e nada migra.
 */
function tomosDaProposta(
  numTomos: number,
  tomoInicial: number,
): { atual: number; numero: number; sufixo: string }[] {
  if (numTomos <= 1) return [{ atual: 0, numero: tomoInicial, sufixo: "" }];
  return Array.from({ length: numTomos }, (_, i) => {
    const numero = tomoInicial + i;
    return {
      atual: i + 1,
      numero,
      sufixo: `:t${String(numero).padStart(2, "0")}`,
    };
  });
}

/**
 * Quantos tomos o volume tem, deduzido do que JÁ foi gerado.
 *
 * As propostas de `separatriz` e `volume` não têm params próprios — a divisão em
 * tomos é decisão da LD e da capa. Em vez de duplicar o campo (e deixar os três
 * discordarem), lemos o `numTomos`/`tomoInicial` do primeiro artefato gerado que
 * os carrega. Sem nada gerado ainda, é um tomo só.
 */
/** Só o NÚMERO de tomos (a fatia precisa dele, não da lista). */
function tomosDoVolumeTotal(selos: SeloForLd[], results: SavedResult[]): number {
  return tomosDoVolume(selos, results).length;
}

function tomosDoVolume(
  selos: SeloForLd[],
  results: SavedResult[],
): { atual: number; numero: number; sufixo: string }[] {
  const comTomos = results.find(
    (r) =>
      (r.kind === "ld" || r.kind === "capa") &&
      typeof (r.payload as { numTomos?: unknown })?.numTomos === "number",
  );
  const p = comTomos?.payload as
    | { numTomos?: number; tomoInicial?: number }
    | undefined;
  return tomosDaProposta(p?.numTomos ?? 1, p?.tomoInicial ?? 1);
}

/** Os três estados de um artefato no card (§ "Estados das ações do Nexo"). */
export type EstadoArtefato = "proposta" | "pendente" | "aplicado";

/**
 * Em que estado está o artefato, comparando os params que o engenheiro acabou de
 * pedir com os que ORIGINARAM o resultado já gerado.
 *
 * Existe porque o id do artefato é estável de propósito (uma capa por conversa,
 * atualizada no lugar). Sem esta comparação o card via "já existe resultado" e
 * só oferecia o download — pedir "muda para o volume 6" mostrava o PDF do volume
 * I como se estivesse em dia.
 *
 * Resultado antigo sem params guardados (gerado antes disto existir): não dá
 * para provar que está em dia, então tratamos como PENDENTE — melhor oferecer
 * um "gerar de novo" desnecessário do que esconder uma alteração pedida.
 */
function estadoDoArtefato(
  saved: SavedResult | undefined,
  params: unknown,
): EstadoArtefato {
  if (!saved) return "proposta";
  if (saved.payload === undefined) return "pendente";
  return JSON.stringify(saved.payload) === JSON.stringify(params)
    ? "aplicado"
    : "pendente";
}

/**
 * Ids BASE (sem sufixo de tomo) dos três tipos que o plano gera. Exportado para
 * o card do plano cunhar exatamente as mesmas chaves que os cards individuais —
 * duas formas de cunhar id produziriam artefatos duplicados no canvas.
 */
export function idsBaseDosArtefatos(selos: SeloForLd[]) {
  return {
    capa: capaId(selos),
    ld: ldId(selos),
    separatriz: separatrizId(selos),
  };
}

/** Mapeia os arquivos salvos p/ o formato do ResultLinks. */
function toResultFiles(saved: SavedResult) {
  return saved.files.map((f) => ({
    label: f.label,
    url: f.url,
    name: f.name,
    primary: f.primary,
    sizeBytes: f.sizeBytes,
  }));
}

export interface NexoTemplateOption {
  id: string;
  nome: string;
  grupo?: string;
  variante?: string;
}

const LABEL_CLASS =
  "font-mono text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground";

const KIND_META: Record<
  NexoAgentProposal["kind"],
  { title: string; icon: typeof FileText }
> = {
  ld: { title: "LD", icon: FileText },
  capa: { title: "Capa", icon: FileText },
  separatriz: { title: "Separatriz", icon: FileText },
  auditoria: { title: "Auditoria", icon: AlertTriangle },
  conferencia: { title: "Conferência", icon: ScanLine },
  volume: { title: "Volume", icon: Layers },
};

export function ConfirmationCard({
  proposal,
  selos,
  templates,
  ldPreview,
  pranchaFiles = [],
  memorialFile = null,
  memorialFatos = null,
}: {
  proposal: NexoAgentProposal;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
  ldPreview?: LdPreviewData;
  /** Pranchas originais retidas (bytes p/ montar o volume). */
  pranchaFiles?: File[];
  /** Memorial anexado (arquivo distinto) — alimenta a auditoria. */
  memorialFile?: File | null;
  /** O que a classificação leu do memorial — vira o gabarito quando não há selos. */
  memorialFatos?: {
    obra?: string | null;
    orgao?: string | null;
    municipio?: string | null;
    codigo?: string | null;
    /** Endereço da caracterização da obra — distingue obras de mesmo nome. */
    endereco?: string | null;
  } | null;
}) {
  const { results } = useConversation();
  switch (proposal.kind) {
    case "ld":
      return (
        <>
          {tomosDaProposta(proposal.params.numTomos, proposal.params.tomoInicial).map(
            (t) => (
              <LdConfirmation
                key={t.sufixo || "unico"}
                params={proposal.params}
                resumo={proposal.resumo}
                selos={selos}
                ldPreview={t.atual === 0 ? ldPreview : undefined}
                tomo={t}
              />
            ),
          )}
        </>
      );
    case "capa":
      return (
        <>
          {tomosDaProposta(proposal.params.numTomos, proposal.params.tomoInicial).map(
            (t) => (
              <CapaConfirmation
                key={t.sufixo || "unico"}
                params={proposal.params}
                resumo={proposal.resumo}
                selos={selos}
                templates={templates}
                tomo={t}
              />
            ),
          )}
        </>
      );
    case "conferencia":
      return (
        <ConferenciaConfirmation
          resumo={proposal.resumo}
          selos={selos}
          pranchaFiles={pranchaFiles}
          templates={templates}
        />
      );
    case "volume":
      return (
        <VolumesDoConjunto
          tomos={tomosDoVolume(selos, results)}
          resumo={proposal.resumo}
          selos={selos}
          pranchaFiles={pranchaFiles}
          templates={templates}
        />
      );
    case "auditoria":
      return (
        <AuditoriaConfirmation
          resumo={proposal.resumo}
          params={proposal.params}
          selos={selos}
          memorialFile={memorialFile}
          memorialFatos={memorialFatos}
        />
      );
    case "separatriz":
      return (
        <>
          {tomosDoVolume(selos, results).map((t) => (
            <SeparatrizConfirmation
              key={t.sufixo || "unico"}
              resumo={proposal.resumo}
              params={proposal.params}
              selos={selos}
              tomo={t}
            />
          ))}
        </>
      );
    default:
      return null;
  }
}

/* ---------------------------------------------------------------- Casca ---- */

const ESTADO_LABEL: Record<EstadoArtefato, string> = {
  proposta: "Proposta",
  pendente: "Alteração pendente",
  aplicado: "Aplicado",
};

/**
 * O aviso do documento envelhecido: o que mudou, de quando é o arquivo que o
 * engenheiro tem, e por que isso importa. Só aparece no estado pendente.
 */
function AvisoDePendencia({
  kind,
  mudancas,
  geradoEm,
}: {
  kind: NexoAgentProposal["kind"];
  mudancas: MudancaDeParametro[];
  geradoEm?: number;
}) {
  /*
   * O relógio fica no estado, não numa chamada durante o render: `Date.now()`
   * no corpo do componente é impuro (o React pode re-renderizar quando quiser e
   * o texto mudaria sozinho). E "há 42 min" precisa mesmo andar — o engenheiro
   * deixa o card aberto enquanto trabalha, então atualizamos de minuto em minuto.
   */
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (mudancas.length === 0) return null;
  return (
    <div className="border-b border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] px-3 py-2.5">
      <p className="font-mono text-[11px] uppercase tracking-[0.07em] text-[var(--status-warning)]">
        O documento que você baixou está velho
      </p>
      <div className="mt-2 grid gap-1">
        {mudancas.map((m) => (
          <div key={m.campo} className="flex items-baseline gap-2 text-xs">
            <span className={`${LABEL_CLASS} w-20 shrink-0`}>{m.campo}</span>
            {/* O valor antigo riscado e o novo ao lado: sem os dois, "mudou" não
                diz se a diferença importa. */}
            <span className="font-mono text-muted-foreground line-through decoration-muted-foreground/50">
              {m.antes}
            </span>
            <span aria-hidden className="text-muted-foreground">
              →
            </span>
            <span className="font-mono text-foreground">{m.depois}</span>
          </div>
        ))}
      </div>
      {geradoEm !== undefined && (
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Gerado {haQuantoTempo(geradoEm, agora)}
        </p>
      )}
      <p className="mt-1.5 text-xs leading-5 text-[var(--status-warning)]">
        {consequenciaDaMudanca(kind, mudancas)}
      </p>
    </div>
  );
}

function CardShell({
  kind,
  resumo,
  children,
  estado = "proposta",
  tomo = 0,
  pendencia,
}: {
  kind: NexoAgentProposal["kind"];
  resumo: string;
  children: ReactNode;
  /** Proposta / alteração pendente / aplicado — o card diz em que pé está. */
  estado?: EstadoArtefato;
  /** Nº do tomo quando o volume é dividido; 0 = documento único. */
  tomo?: number;
  /** O que mudou desde a geração + quando foi gerado (só no estado pendente). */
  pendencia?: { mudancas: MudancaDeParametro[]; geradoEm?: number };
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  /*
   * A BORDA INTEIRA diz em que pé o documento está.
   *
   * Antes o estado vivia num ponto de 1,5px no canto do cabeçalho. "Pendente"
   * significa que o arquivo na mão do engenheiro está velho — é o erro mais
   * caro que esta tela pode cometer, e ele estava anunciado por um ponto que
   * some no meio de quatro cards. Agora a moldura inteira muda: âmbar quando o
   * documento envelheceu, verde quando o que está na tela é o que foi gerado.
   */
  const borda =
    estado === "pendente"
      ? "border-[var(--status-warning)]/45"
      : estado === "aplicado"
        ? "border-[var(--status-ok)]/30"
        : "border-border";
  return (
    <div
      data-state={estado}
      className={`nexodoc-enter rounded-md border ${borda} bg-card`}
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className={LABEL_CLASS}>
          {ESTADO_LABEL[estado]} · {meta.title}
          {/* Com o volume dividido, cada card É um tomo — sem isto os cards
              ficam idênticos e não dá pra saber qual é qual. */}
          {tomo > 0 && ` · TOMO ${String(tomo).padStart(2, "0")}`}
        </span>
        {estado === "pendente" && (
          <span
            className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--status-warning)]"
            aria-hidden
          />
        )}
      </div>
      {estado === "pendente" && pendencia && (
        <AvisoDePendencia
          kind={kind}
          mudancas={pendencia.mudancas}
          geradoEm={pendencia.geradoEm}
        />
      )}
      <div className="space-y-3 p-3">
        <p className="text-sm text-muted-foreground">{resumo}</p>
        {children}
      </div>
    </div>
  );
}

/** Uma linha read-only do resumo: rótulo mono + valor mono. */
function SummaryRow({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${LABEL_CLASS} w-24 shrink-0`}>{label}</span>
      {/* `whitespace-pre-line`: o título documental tem PARÁGRAFOS ("PROJETO
          ESTRUTURAL CONCRETO / IMPLANTAÇÃO / TOMO 04"). Numa linha só o
          engenheiro não consegue conferir se as quebras estão onde ele pediu. */}
      {/* Valor ausente é ÊNFASE, não status: marca sem julgar. Não é erro — só
          ainda não foi dito. Em âmbar, "defina o título" parecia um defeito. */}
      <span
        className={
          missing
            ? "whitespace-pre-line font-mono text-sm italic text-[var(--nexodoc-tertiary-strong)]"
            : "whitespace-pre-line font-mono text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Chip "alterar <slot>": reabre o slot em conversa (escreve a frase no composer). */
function AlterChip({
  label,
  phrase,
  highlight,
}: {
  label: string;
  phrase: string;
  highlight?: boolean;
}) {
  const composer = useComposer();
  return (
    <Chip
      variant={highlight ? "suggest" : "quiet"}
      aria-label={`Alterar ${label} pela conversa`}
      onClick={() => composer.fill(phrase)}
    >
      alterar {label}
    </Chip>
  );
}

function ConfirmButton({
  busy,
  disabled,
  label = "Confirmar e gerar",
  busyLabel = "Gerando…",
  onConfirm,
  pendente,
}: {
  busy: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  onConfirm: () => void;
  /** Responde a um documento envelhecido: o botão vira âmbar, não teal. */
  pendente?: boolean;
}) {
  return (
    <Button
      size="sm"
      onClick={onConfirm}
      disabled={busy || disabled}
      /*
       * Âmbar quando é RESPOSTA a um estado pendente: teal significa "ação
       * primária nova", e regerar não é ação nova — é consertar o que
       * envelheceu. Mantê-lo teal fazia o card pendente parecer igual ao card
       * de proposta, que é justamente a confusão que custa caro aqui.
       */
      className={
        pendente && !busy
          ? "border-[var(--status-warning)] bg-[var(--status-warning)] text-[#2b1d05] hover:bg-[var(--status-warning)]/90"
          : undefined
      }
    >
      {busy ? (
        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      )}
      {busy ? busyLabel : label}
    </Button>
  );
}

function CardError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ LD ---- */

function LdConfirmation({
  params,
  resumo,
  selos,
  ldPreview,
  tomo,
}: {
  params: NexoLdProposalParams;
  resumo: string;
  selos: SeloForLd[];
  ldPreview?: LdPreviewData;
  tomo: { atual: number; numero: number; sufixo: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getResult, saveResult, totaisPorDisciplina, identidade } = useConversation();
  const id = ldId(selos) + tomo.sufixo;
  const saved = getResult(id);

  const titulo = params.tituloLd.trim();
  const semTitulo = titulo === "";
  /*
   * ESTA LD COBRE VÁRIAS DISCIPLINAS?
   *
   * A proposta escolhe a disciplina MAJORITÁRIA das pranchas e usa o título
   * dela. Num volume misto — que é a maioria dos volumes reais do escritório —
   * isso põe as folhas das outras disciplinas sob um título que não é o delas,
   * e o PDF sai assim, sem aviso. A regra do escritório é uma LD por
   * disciplina; a montagem do volume já faz isso, e aqui se diz por quê, na
   * hora em que o engenheiro olha a LD e estranha a contagem.
   */
  const blocos = useMemo(
    () => blocosDasFolhas(selos as Folha[], codigoDaFolha, rotuloDoCodigo),
    [selos],
  );
  const misto = misturaDisciplinas(blocos);
  // O tomo entra na comparação: gerar o tomo 1 não deixa o tomo 2 "aplicado".
  const paramsAtuais = {
    ...params,
    tomo: tomo.numero,
    folhas: assinaturaDoTomo(opcoesDoTomo(selos, params.numTomos, tomo.atual).doTomo),
  };
  const estado = estadoDoArtefato(saved, paramsAtuais);
  const pendencia = {
    mudancas: mudancasDoArtefato(saved?.payload, paramsAtuais),
    geradoEm: saved?.generatedAt,
  };
  const podeGerar = estado !== "aplicado";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      // A MESMA decisão do plano e do canvas: quais folhas são deste tomo. Este
      // caminho ficou de fora do sub-projeto 5 e voltava a fatiar por quantidade.
      const { doTomo, opts } = opcoesDoTomo(selos, params.numTomos, tomo.atual);
      /*
       * O total corrigido à mão, quando este documento é de uma disciplina só.
       * Vai pelas folhas DO TOMO quando há divisão — é delas que a LD fala.
       */
      const referenceTotal = totalDoConjunto(
        (doTomo.length > 0 ? doTomo : (selos as Folha[])),
        totaisPorDisciplina,
        codigoDaFolha,
      );
      const r = await postLd(selos, {
        tituloLd: titulo,
        numTomos: params.numTomos,
        tomoInicial: params.tomoInicial,
        tomoAtual: tomo.atual,
        ...(referenceTotal ? { referenceTotal } : {}),
        // A LD imprime a mesma obra/código/revisão que a capa.
        identidade,
        ...opts,
      });
      await saveResult({
        artifactId: id,
        kind: "ld",
        // Params que originaram o resultado — o card compara para saber se a
        // proposta mudou desde a geração (ver estadoDoArtefato). A assinatura das
        // folhas entra junto: é ela que denuncia o documento envelhecido.
        payload: { ...params, tomo: tomo.numero, folhas: assinaturaDoTomo(doTomo) },
        summary: `LD ${r.resumo.disciplina} · ${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas${
          r.warnings.length ? ` · ${r.warnings.length} aviso(s)` : ""
        }`,
        canvas: {
          label: `LD ${r.resumo.disciplina}`,
          detail: `${r.resumo.codigo} · rev ${r.resumo.revisao} · ${r.resumo.totalFolhas} folhas`,
          titulo,
          pageNumber: 1,
        },
        files: [
          { label: "ODT", name: r.odtName, mime: ODT_MIME, url: r.odtUrl },
          ...(r.pdfUrl ? [{ label: "PDF", name: r.pdfName!, mime: PDF_MIME, url: r.pdfUrl }] : []),
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a LD.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell
      kind="ld"
      resumo={resumo}
      estado={estado}
      tomo={tomo.atual > 0 ? tomo.numero : 0}
      pendencia={pendencia}
    >
      {ldPreview && <FolhaPreview data={ldPreview} />}

      {podeGerar && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Título"
              value={semTitulo ? "defina o título →" : titulo}
              missing={semTitulo}
            />
            <SummaryRow
              label="Tomos"
              value={rotuloTomos(params.numTomos, params.tomoInicial)}
            />
          </div>
          {misto && (
            <div className="rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)]/40 px-3 py-2 text-xs">
              <p className="text-foreground">
                As pranchas são de {blocos.filter((b) => b.codigo).length}{" "}
                disciplinas: {resumoDosBlocos(blocos)}.
              </p>
              <p className="mt-1 text-muted-foreground">
                Esta LD cobre todas sob o título{" "}
                <span className="text-foreground">{titulo || "—"}</span>. Ao
                montar o volume, cada disciplina ganha a sua separatriz e a sua
                LD, como o escritório entrega.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            <AlterChip
              label="título"
              highlight={semTitulo}
              phrase={semTitulo ? "O título da LD é " : `Muda o título para ${titulo}`}
            />
            <AlterChip label="tomos" phrase="Divide em 2 tomos" />
            <AlterChip label="tomo inicial" phrase="Começando no tomo " />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={semTitulo}
              onConfirm={confirm}
              label={saved ? "Aplicar alteração" : undefined}
            />
            {semTitulo && (
              <span className="text-xs text-muted-foreground">
                O título é decisão sua — defina pela conversa.
              </span>
            )}
          </div>
        </>
      )}

      {saved && (
        <ResultLinks
          summary={
            estado === "pendente"
              ? `Versão atual (antes da alteração) — ${saved.summary}`
              : saved.summary
          }
          files={toResultFiles(saved)}
        />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/** Prévia das folhas que vão para a LD — o engenheiro confere antes de gerar. */
function FolhaPreview({ data }: { data: LdPreviewData }) {
  const faltando =
    data.referenceTotal != null && data.totalFolhas < data.referenceTotal;
  return (
    <div className="rounded-md border border-border bg-[var(--nexodoc-recessed)]">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <span className={LABEL_CLASS}>
          Folhas na LD ({data.totalFolhas}
          {data.referenceTotal != null ? ` de ${data.referenceTotal}` : ""})
        </span>
        {faltando && (
          <span className="font-mono text-[11px] text-[var(--status-warning)]">
            faltam folhas?
          </span>
        )}
      </div>
      <div className="max-h-40 overflow-y-auto">
        <table className="w-full text-xs">
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={`${r.sheet}-${i}`} className="border-b border-border/60 last:border-0">
                <td className="whitespace-nowrap px-3 py-1 font-mono tabular-nums">
                  {r.sheet || "—"}
                </td>
                <td className="px-3 py-1 text-muted-foreground">{r.description || "—"}</td>
              </tr>
            ))}
            {data.rows.length === 0 && (
              <tr>
                <td className="px-3 py-2 text-muted-foreground">Nenhuma folha lida.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Capa ---- */

function CapaConfirmation({
  params,
  resumo,
  selos,
  templates,
  tomo,
}: {
  params: NexoCapaProposalParams;
  resumo: string;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
  tomo: { atual: number; numero: number; sufixo: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getResult, saveResult, results, identidade } = useConversation();
  const id = capaId(selos) + tomo.sufixo;
  // Capa gerada antes da correção da chave: acha pelo prefixo antigo.
  const saved =
    getResult(id) ?? results.find((r) => r.artifactId.startsWith(capaIdLegado(selos)));

  const template = templates.find((t) => t.id === params.templateId);
  const prefeituraNome = template
    ? (template.grupo ?? template.nome) + (template.variante ? ` — ${template.variante}` : "")
    : params.templateId
      ? "carregando…"
      : "";
  const semPrefeitura = params.templateId.trim() === "";
  // Título é decisão do engenheiro (igual ao da LD): sem ele, não gera.
  const semTitulo = params.tituloCapa.trim() === "";
  const paramsAtuais = { ...params, tomo: tomo.numero };
  const estado = estadoDoArtefato(saved, paramsAtuais);
  const pendencia = {
    mudancas: mudancasDoArtefato(saved?.payload, paramsAtuais),
    geradoEm: saved?.generatedAt,
  };
  const podeGerar = estado !== "aplicado";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await postCapa(selos, {
        templateId: params.templateId,
        tituloCapa: params.tituloCapa,
        volume: params.volume,
        // Este card É um tomo: gera UMA capa, a daquele tomo.
        numTomos: tomo.atual > 0 ? 1 : params.numTomos,
        tomoInicial: params.tomoInicial,
        tomoNumero: tomo.atual > 0 ? tomo.numero : 0,
        // O escape de quando o carimbo mente (órgão, obra, código, revisão).
        identidade,
      });
      await saveResult({
        artifactId: id,
        kind: "capa",
        // Guarda os params que ORIGINARAM este resultado. É o que deixa o card
        // saber, no próximo turno, que a proposta mudou e precisa ser regerada
        // — sem isto ele mostraria o download antigo achando que está em dia.
        payload: { ...params, tomo: tomo.numero },
        summary: `Capa ${r.resumo.prefeitura} · ${r.resumo.codigo} · vol ${r.resumo.volume}${
          r.resumo.tomos > 1 ? ` · ${r.resumo.tomos} tomos` : ""
        }${r.pdfError ? " · PDF indisponível" : ""}`,
        canvas: {
          label: `Capa ${r.resumo.prefeitura}`,
          detail: `${r.resumo.codigo} · vol ${r.resumo.volume}`,
          titulo: params.tituloCapa,
          pageNumber: 1,
        },
        files: [
          { label: "ZIP", name: r.zipName, mime: "application/zip", url: r.zipUrl, primary: true },
          { label: "ODT", name: r.odtName, mime: ODT_MIME, url: r.odtUrl },
          ...(r.pdfUrl ? [{ label: "PDF", name: r.pdfName!, mime: PDF_MIME, url: r.pdfUrl }] : []),
        ],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a capa.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell
      kind="capa"
      resumo={resumo}
      estado={estado}
      tomo={tomo.atual > 0 ? tomo.numero : 0}
      pendencia={pendencia}
    >
      {podeGerar && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Prefeitura"
              value={semPrefeitura ? "escolha a prefeitura →" : prefeituraNome}
              missing={semPrefeitura}
            />
            <SummaryRow
              label="Título"
              value={params.tituloCapa.trim() || "diga qual título →"}
              missing={semTitulo}
            />
            <SummaryRow label="Volume" value={params.volume.trim() || "auto (do arquivo)"} />
            <SummaryRow label="Tomos" value={rotuloTomos(params.numTomos, params.tomoInicial)} />
            <SummaryRow label="Mês/ano" value="atual" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip
              label="prefeitura"
              highlight={semPrefeitura}
              phrase="A prefeitura é "
            />
            <AlterChip
              label="título"
              highlight={semTitulo}
              phrase="O título da capa é "
            />
            <AlterChip label="volume" phrase="É o volume " />
            <AlterChip label="tomos" phrase="Divide em 2 tomos" />
            <AlterChip label="mês" phrase="A capa é de " />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={semPrefeitura || semTitulo}
              onConfirm={confirm}
              label={saved ? "Aplicar alteração" : undefined}
            />
            {(semPrefeitura || semTitulo) && (
              <span className="text-xs text-muted-foreground">
                {semPrefeitura
                  ? "A capa precisa da prefeitura — diga qual pela conversa."
                  : "Falta o título da capa — diga qual pela conversa."}
              </span>
            )}
          </div>
        </>
      )}

      {saved && (
        <ResultLinks
          summary={
            estado === "pendente"
              ? `Versão atual (antes da alteração) — ${saved.summary}`
              : saved.summary
          }
          files={toResultFiles(saved)}
        />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/* ---------------------------------------------------------- Conferência ---- */

function ConferenciaConfirmation({
  resumo,
  selos,
  pranchaFiles = [],
  templates,
}: {
  resumo: string;
  selos: SeloForLd[];
  pranchaFiles?: File[];
  templates: NexoTemplateOption[];
}) {
  const [busy, setBusy] = useState(false);
  const [busySelo, setBusySelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getResult, saveResult, results, conversationId, totaisPorDisciplina } =
    useConversation();
  const id = conferenciaId(selos);
  const result = getResult(id)?.payload as LightCheckResult | undefined;
  const identidade = getResult(`${id}:identidade`)?.payload as
    | SeloIdentityResult
    | undefined;

  /*
   * O GABARITO é a intenção DECLARADA — a prefeitura que o engenheiro escolheu
   * para a capa —, nunca o que o selo diz. Inferir o alvo do próprio documento
   * conferiria o selo contra ele mesmo: um volume inteiro com o brasão errado
   * passaria, porque estaria coerentemente errado.
   */
  const templateIdDaCapa = results
    .filter((r) => r.kind === "capa")
    .map((r) => (r.payload as { templateId?: unknown } | undefined)?.templateId)
    .find((t): t is string => typeof t === "string" && t.trim().length > 0);
  const orgaoAlvo = templates.find((t) => t.id === templateIdDaCapa)?.nome ?? "";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      /*
       * Os totais corrigidos à mão vão junto: é o MESMO número que a LD de cada
       * bloco usa para numerar. Sem eles a LD diria "05/11" e a conferência
       * cobraria as 21 folhas do carimbo mal lido — dois documentos do mesmo
       * conjunto discordando entre si, que é pior que o defeito original.
       */
      const r = await postCheck(selos, undefined, totaisPorDisciplina);
      await saveResult({
        artifactId: id,
        kind: "conferencia",
        summary: `Conferência — ${r.veredito}`,
        files: [],
        payload: r,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conferência.");
    } finally {
      setBusy(false);
    }
  }

  async function conferirSelo() {
    setBusySelo(true);
    setError(null);
    try {
      const r = await conferirIdentidadeDoSelo({
        selos,
        pranchaFiles,
        orgaoAlvo,
        conversationId,
      });
      await saveResult({
        artifactId: `${id}:identidade`,
        kind: "conferencia",
        summary: `Selo — ${r.result.veredito} · ${r.result.amostras} folha(s)`,
        files: [],
        payload: r.result,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na conferência do selo.");
    } finally {
      setBusySelo(false);
    }
  }

  const semPranchas = pranchaFiles.length === 0;

  return (
    <CardShell kind="conferencia" resumo={resumo}>
      {!result && (
        <>
          <p className="text-xs text-muted-foreground">
            Confere se as pranchas batem entre si (código/obra/revisão/folhas), disciplina
            por disciplina. Sem memorial e sem IA.
          </p>
          <ConfirmButton
            busy={busy}
            label="Conferir"
            busyLabel="Conferindo…"
            onConfirm={confirm}
          />
        </>
      )}

      {result && <CheckResult result={result} />}

      {/*
        A conferência do SELO é o segundo passo, e é separada de propósito: ela
        custa IA e responde a outra pergunta. A de cima pergunta se o volume
        está íntegro; esta pergunta para QUEM ele está indo — foi um projeto
        enviado com o brasão de outra prefeitura que a motivou.
      */}
      {result && (
        <div className="space-y-2 border-t border-border pt-3">
          {!identidade && (
            <>
              <p className="text-xs text-muted-foreground">
                Confere o selo por dentro: endereço da obra, brasão e numeração da
                prancha, contra{" "}
                {orgaoAlvo ? (
                  <span className="text-foreground">{orgaoAlvo}</span>
                ) : (
                  "a prefeitura da capa"
                )}
                . Lê uma folha por disciplina, num modelo pequeno.
              </p>
              <div className="flex items-center gap-2">
                <ConfirmButton
                  busy={busySelo}
                  disabled={semPranchas || !orgaoAlvo}
                  label="Conferir o selo"
                  busyLabel="Lendo os selos…"
                  onConfirm={conferirSelo}
                />
                {(semPranchas || !orgaoAlvo) && (
                  <span className="text-xs text-muted-foreground">
                    {semPranchas
                      ? "Anexe as pranchas para conferir o selo."
                      : "Gere a capa antes — é a prefeitura dela que serve de gabarito."}
                  </span>
                )}
              </div>
            </>
          )}

          {identidade && (
            <CheckResult
              result={identidade}
              titulo={`Selo · ${identidade.amostras} folha(s) conferida(s)`}
            />
          )}
        </div>
      )}
      <CardError message={error} />
    </CardShell>
  );
}

function CheckResult({
  result,
  titulo,
}: {
  result: LightCheckResult;
  titulo?: string;
}) {
  const variant =
    result.veredito === "critico"
      ? "critical"
      : result.veredito === "aviso"
        ? "warning"
        : "ok";
  /*
   * Sem emoji no rótulo de status: quem carrega a cor é o `variant` do Badge, e
   * o emoji além de violar o DESIGN.md duplicava o sinal — em preto e branco, ou
   * num leitor de tela, "🔴" vira ruído e não informação.
   */
  const label =
    result.veredito === "critico"
      ? "Não emitir"
      : result.veredito === "aviso"
        ? "Revisar"
        : "Consistente";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-muted-foreground">
          {titulo ? `${titulo} · ` : ""}
          {result.findings.length} achado(s)
        </span>
      </div>
      {result.findings.length > 0 && (
        <ul className="space-y-1.5">
          {result.findings.map((f, i) => (
            <li key={i} className="text-xs">
              <span
                className={
                  f.severidade === "critico"
                    ? "font-medium text-destructive"
                    : f.severidade === "aviso"
                      ? "font-medium text-[var(--status-warning)]"
                      : "font-medium text-muted-foreground"
                }
              >
                [{f.campo}]
              </span>{" "}
              {f.mensagem}
              {f.detalhe && (
                <span className="block pl-2 text-muted-foreground">{f.detalhe}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- Volume ----- */

/**
 * Um achado que explica por que a conferência do volume não pôde acontecer.
 * Vira AVISO, e não silêncio: o volume está pronto, e quem o receber precisa
 * saber que ninguém o conferiu.
 */
function conferenciaNaoRodou(motivo: string, detalhe?: string): VolumeCheckResult {
  return {
    veredito: "aviso",
    paginasConferidas: 0,
    findings: [{ severidade: "aviso", campo: "leitura", mensagem: motivo, detalhe }],
  };
}

/**
 * Confere o volume recém-montado contra o plano que o gerou.
 *
 * O passo delicado é ligar cada PARTE devolvida pela montagem ao seu BLOCO: o
 * servidor devolve papel, nome e páginas, mas não a disciplina. Em vez de
 * reconstituir por contagem — que erra em silêncio se alguma parte for pulada —,
 * a lista de papéis é remontada aqui pela MESMA regra de `buildVolumeParts`
 * (parte sem dados não entra) e CONFERIDA contra o que voltou. Discordou, não se
 * chuta: a conferência não roda e diz por quê. Atribuir páginas ao bloco errado
 * produziria achados apontando para a disciplina errada, que é pior do que não
 * conferir.
 */
async function conferirVolume(args: {
  r: { url: string; pageCount?: number; partes?: { role: string; name: string; paginas: number }[] };
  montaveis: BlocoDoVolume[];
  blocos: { codigo: string; ids: string[] }[];
  capaPdf64: string | null;
  selosDoTomo: Folha[];
  totaisPorDisciplina: Record<string, number>;
  orgaoAlvo: string;
  conversationId?: string | null;
}): Promise<VolumeCheckResult> {
  try {
    const devolvidas = args.r.partes ?? [];
    if (devolvidas.length === 0) {
      return conferenciaNaoRodou(
        "O volume foi montado, mas a montagem não informou as páginas de cada parte.",
      );
    }

    // A ordem canônica, remontada e CONFERIDA no núcleo puro — a regra e as
    // suas travas moram lá, onde node cru as testa.
    const esperadas = papeisEsperados(
      Boolean(args.capaPdf64),
      args.montaveis.map((m, i) => ({
        codigo: args.blocos[i]?.codigo ?? "",
        temSeparatriz: Boolean(m.separatrizPdf64),
        temLd: Boolean(m.ldPdf64),
        pranchas: m.pranchaFiles.length,
      })),
    );
    const partes = alinharPartes(esperadas, devolvidas);
    if (!partes) {
      return conferenciaNaoRodou(
        "O volume foi montado, mas não deu para saber a que disciplina cada página pertence.",
        `esperava [${esperadas.map((e) => e.papel).join(", ")}]; a montagem devolveu [${devolvidas.map((d) => d.role).join(", ")}]`,
      );
    }

    /*
     * O gabarito de cada bloco são as linhas da LD dele — a MESMA chamada que
     * gerou a LD encadernada, com os mesmos parâmetros. Recalcular aqui em vez
     * de guardar as linhas evita uma segunda verdade sobre o que a LD diz.
     */
    const blocosDoPlano: BlocoDoPlano[] = args.montaveis.map((m, i) => {
      const codigo = args.blocos[i]?.codigo ?? "";
      const proposta = buildLdProposal(args.selosDoTomo, {
        folhasDoTomo: args.blocos[i]?.ids,
        respeitarOrdem: true,
        ...(args.totaisPorDisciplina[codigo]
          ? { referenceTotal: args.totaisPorDisciplina[codigo] }
          : {}),
      });
      return {
        codigo,
        folhas: proposta.input.rows.map((linha) => ({
          folha: parseInt(linha.sheet.split("/")[0] ?? "", 10) || null,
          total: parseInt(linha.sheet.split("/")[1] ?? "", 10) || null,
          codigo: linha.file || null,
          titulo: linha.description || null,
        })),
      };
    });

    const esperado = montarPlanoDePaginas(partes, blocosDoPlano);
    const lido = await lerVolumeMontado({
      pdfBase64: await urlToBase64(args.r.url),
      esperado,
      conversationId: args.conversationId,
    });
    return checkVolumeMontado(esperado, lido, {
      orgao: args.orgaoAlvo,
      pageCount: args.r.pageCount ?? esperado.length,
    });
  } catch (err) {
    // Conferência que falha NÃO derruba a montagem: o volume está pronto e é
    // dele que o engenheiro precisa. O que não pode é a falha sumir.
    return conferenciaNaoRodou(
      "O volume foi montado, mas a conferência não pôde rodar.",
      err instanceof Error ? err.message : "erro desconhecido",
    );
  }
}

/**
 * Monta o volume juntando as partes JÁ geradas nesta conversa (capa + LD do
 * artifact-store) com as pranchas originais retidas. Pré-condições honestas:
 * sem pranchas, botão desabilitado. Capa/LD ausentes (não geradas ou sem PDF)
 * simplesmente não entram — o card mostra o que será incluído.
 */
/**
 * Os volumes do conjunto — um card por tomo, e um botão que monta todos.
 *
 * Montar de um em um é o gesto certo para um volume; para seis é trabalho
 * braçal que a máquina devia fazer. O laço é SEQUENCIAL e cada tomo é tentado
 * dentro do seu próprio `try`: a montagem carrega dezenas de megabytes por
 * volume, e um tomo que falha não pode levar os outros junto nem deixar o
 * engenheiro sem saber quantos PDFs tem na mão. É a mesma regra do
 * `gerarTudo` do plano, pelo mesmo motivo.
 */
function VolumesDoConjunto({
  tomos,
  ...props
}: {
  tomos: { atual: number; numero: number; sufixo: string }[];
  resumo: string;
  selos: SeloForLd[];
  pranchaFiles: File[];
  templates: NexoTemplateOption[];
}) {
  const montadores = useRef(new Map<string, () => Promise<string | null>>());
  const registrar = useCallback(
    (chave: string, montar: (() => Promise<string | null>) | null) => {
      if (montar) montadores.current.set(chave, montar);
      else montadores.current.delete(chave);
    },
    [],
  );
  const [montando, setMontando] = useState<number | null>(null);
  const [falhas, setFalhas] = useState<{ rotulo: string; motivo: string }[]>([]);
  const { results, identidade } = useConversation();
  const [baixando, setBaixando] = useState(false);
  const [erroDoZip, setErroDoZip] = useState<string | null>(null);

  /*
   * Os EDITÁVEIS do conjunto — capa, LD e separatriz de todos os tomos. O PDF é
   * o que se envia; o ODT é o que se conserta, e juntá-los um a um num volume de
   * seis tomos são dezenas de cliques.
   */
  const editaveis = useMemo(() => editaveisDosResultados(results), [results]);
  const selosDaConversa = props.selos;
  const identidadeDaConversa = identidade;

  async function baixarTodosOsEditaveis() {
    setBaixando(true);
    setErroDoZip(null);
    try {
      /*
       * Os TRÊS CONSOLIDADOS vão na raiz do ZIP: uma capa com uma página por
       * tomo, uma LD com os tomos como seções, uma separatriz. É o que se abre
       * no LibreOffice para mexer numa vírgula — vinte arquivos soltos, não.
       *
       * Os por-tomo continuam nas pastas: eles são o que entrou DENTRO de cada
       * volume, e conferir o que foi encadernado é outra necessidade.
       */
      const params = parametrosDaEntrega(results);
      const { editaveis: consolidados, falhas } = await gerarEditaveisConsolidados({
        selos: selosDaConversa,
        params,
        identidade: identidadeDaConversa,
      });
      await baixarEditaveis([...consolidados, ...editaveis], "editaveis-do-volume.zip");
      if (falhas.length > 0) {
        setErroDoZip(
          `O ZIP saiu, mas ${falhas.length} consolidado(s) não foram gerados: ${falhas.join("; ")}. Os por-tomo estão lá.`,
        );
      }
    } catch (err) {
      setErroDoZip(err instanceof Error ? err.message : "Falha ao juntar os editáveis.");
    } finally {
      setBaixando(false);
    }
  }

  async function montarTodos() {
    setFalhas([]);
    const coletadas: { rotulo: string; motivo: string }[] = [];
    try {
      for (let i = 0; i < tomos.length; i++) {
        const chave = tomos[i].sufixo || "unico";
        const montar = montadores.current.get(chave);
        if (!montar) continue;
        setMontando(i);
        const rotulo = `TOMO ${String(tomos[i].numero).padStart(2, "0")}`;
        try {
          const motivo = await montar();
          if (motivo) coletadas.push({ rotulo, motivo });
        } catch (err) {
          // Rede de segurança: o card devolve o motivo em vez de lançar, mas um
          // erro fora do `try` dele (render, por exemplo) não pode parar o laço.
          coletadas.push({
            rotulo,
            motivo: err instanceof Error ? err.message : "erro desconhecido",
          });
        }
      }
    } finally {
      setMontando(null);
      setFalhas(coletadas);
    }
  }

  return (
    <>
      {tomos.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <ConfirmButton
            busy={montando !== null}
            label={`Montar os ${tomos.length} volumes`}
            busyLabel={
              montando !== null
                ? `Montando ${montando + 1} de ${tomos.length}…`
                : "Montando…"
            }
            onConfirm={montarTodos}
          />
          {falhas.length > 0 && (
            <p className="text-xs text-[var(--destructive)]">
              {falhas.length} volume(s) não montaram:{" "}
              {falhas.map((f) => `${f.rotulo} (${f.motivo})`).join("; ")}. Os outros
              estão prontos.
            </p>
          )}
        </div>
      )}
      {/*
        Os EDITÁVEIS, num ZIP só. Fica fora do `tomos.length > 1` porque juntar
        capa, LD e separatriz num arquivo já vale para um volume — e é onde o
        engenheiro vai quando precisa mexer numa vírgula no LibreOffice.
      */}
      {editaveis.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            disabled={baixando}
            onClick={baixarTodosOsEditaveis}
          >
            {baixando
              ? "Gerando os consolidados…"
              : "Baixar os editáveis (3 ODTs + por tomo)"}
          </Button>
          {erroDoZip && (
            <p className="text-xs text-[var(--destructive)]">{erroDoZip}</p>
          )}
        </div>
      )}
      {tomos.map((t) => (
        <VolumeConfirmation
          key={t.sufixo || "unico"}
          {...props}
          tomo={t}
          chave={t.sufixo || "unico"}
          registrar={registrar}
        />
      ))}
    </>
  );
}

function VolumeConfirmation({
  resumo,
  selos,
  pranchaFiles,
  templates,
  tomo,
  chave,
  registrar,
}: {
  resumo: string;
  selos: SeloForLd[];
  pranchaFiles: File[];
  templates: NexoTemplateOption[];
  tomo: { atual: number; numero: number; sufixo: string };
  /** Identidade deste card para o pai; ausente = card solto, sem "montar todos". */
  chave?: string;
  /**
   * Entrega ao pai a função que monta ESTE tomo. Ela devolve o MOTIVO da falha
   * (ou `null` quando deu certo) em vez de lançar — ver `confirm`.
   */
  registrar?: (
    chave: string,
    montar: (() => Promise<string | null>) | null,
  ) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    results,
    getResult,
    saveResult,
    totaisPorDisciplina,
    identidade,
    conversationId,
  } = useConversation();
  const id = volumeId(selos) + tomo.sufixo;
  const saved = getResult(id);
  /** A conferência do volume gravada junto com o PDF, quando já rodou. */
  const conferenciaDoVolume = (
    saved?.payload as { conferencia?: VolumeCheckResult } | undefined
  )?.conferencia;

  // As partes DESTE tomo: cada tomo é um volume físico com as suas.
  const capa = results.find((r) => r.artifactId === capaId(selos) + tomo.sufixo);
  const ld = results.find((r) => r.artifactId === ldId(selos) + tomo.sufixo);
  const separatriz = results.find(
    (r) => r.artifactId === separatrizId(selos) + tomo.sufixo,
  );
  const capaPdfUrl = capa?.files.find((f) => f.mime === PDF_MIME)?.url;
  const ldPdfUrl = ld?.files.find((f) => f.mime === PDF_MIME)?.url;
  const sepPdfUrl = separatriz?.files.find((f) => f.mime === PDF_MIME)?.url;
  /*
   * Título da separatriz. Antes vinha do rótulo do canvas ("LD ESTRUTURAL"),
   * então a folha saía SEMPRE com a sigla crua da disciplina — o mesmo texto
   * para "Estrutural Concreto" e "Estrutural Concreto Implantação", que é
   * justamente o que a separatriz existe para distinguir dentro do volume.
   *
   * Agora usa o TÍTULO que o engenheiro decidiu na LD (guardado nos params do
   * resultado), com o rótulo do canvas como último recurso para resultados
   * gerados antes disso existir.
   */
  const ldParams = ld?.payload as NexoLdProposalParams | undefined;
  const capaParams = capa?.payload as NexoCapaProposalParams | undefined;

  /*
   * As folhas DESTE tomo. Cada tomo é um volume físico com a sua fatia — antes
   * o volume levava todas as folhas, e dois tomos produziam dois PDFs
   * idênticos com o projeto inteiro dentro de cada.
   *
   * A fatia usa a MESMA divisão da LD (`gruposDasFolhas`), senão a lista de
   * documentos e o volume discordariam sobre o que está lá dentro. Era
   * `faixasDosTomos` — divisão por quantidade, que ignora o grupo arrastado à
   * mão e fazia o volume sair diferente do que o canvas mostrava.
   */
  const selosDoTomo = useMemo(() => {
    if (tomo.atual === 0) return selos;
    const total = tomosDoVolumeTotal(selos, results);
    const projecao = selos as Folha[];
    const divisao = gruposDasFolhas(projecao, total, buildBalancedQuantities);
    const doTomo = folhasDoTomo(projecao, divisao, tomo.atual);
    return doTomo.length > 0 ? doTomo : selos;
  }, [selos, results, tomo.atual]);

  /*
   * Os ARQUIVOS deste tomo, não só os selos.
   *
   * `assembleVolume` itera sobre os `pranchaFiles` e, quando um arquivo não tem
   * faixa de páginas nos selos recebidos, entra INTEIRO como fallback (o caso
   * legítimo do arquivo cujo selo não foi lido). Com um PDF por prancha, fatiar
   * só os selos não bastava: os 24 arquivos continuavam entrando, e o volume do
   * tomo 02 saía com a LD certa (13-24) e as folhas 01-24. Filtrar os arquivos é
   * o que de fato separa os documentos.
   */
  const pranchaFilesDoTomo = useMemo(() => {
    if (tomo.atual === 0) return pranchaFiles;
    const doTomo = new Set(selosDoTomo.map((s) => s.fileName));
    return pranchaFiles.filter((f) => doTomo.has(f.name));
  }, [pranchaFiles, selosDoTomo, tomo.atual]);

  const semPranchas = pranchaFilesDoTomo.length === 0;

  /*
   * OS BLOCOS DO VOLUME — a regra do escritório, lida dos projetos reais: uma
   * capa, e depois dela um bloco por disciplina (separatriz → LD → pranchas).
   * O volume 10 de 040-26 tem uma capa e TRÊS separatrizes e TRÊS LDs.
   *
   * Até aqui o volume era montado como se fosse sempre de uma disciplina só: a
   * proposta da LD escolhia a majoritária e as outras entravam caladas sob
   * aquele título. Não faltava um aviso — o documento saía errado.
   */
  const blocos = useMemo(
    () => blocosDasFolhas(selosDoTomo as Folha[], codigoDaFolha, rotuloDoCodigo),
    [selosDoTomo],
  );
  const misto = misturaDisciplinas(blocos);

  const sepTitle =
    capaParams?.tituloCapa?.trim() ||
    ldParams?.tituloLd?.trim() ||
    ld?.canvas?.label.replace(/^LD\s+/i, "").trim() ||
    "";

  /*
   * O volume não tem params próprios: o que o define são as partes deste tomo —
   * e QUAIS FOLHAS entraram nele. Sem a assinatura, arrastar uma folha deixava
   * este volume descrevendo um conjunto que não existe mais, em silêncio.
   */
  const estado = estadoDoArtefato(saved, {
    tomo: tomo.numero,
    folhas: assinaturaDoTomo(selosDoTomo as Folha[]),
  });
  /*
   * Montar de novo segue SEMPRE disponível: o volume é derivado das partes e
   * refazê-lo é barato. Antes disto o `estado` era sempre "pendente" (o volume
   * não gravava payload); agora ele grava, e travar o botão quando nada mudou
   * seria uma mudança de comportamento que ninguém pediu. `estado` aqui serve à
   * marca de desatualizado.
   */
  const podeGerar = true;

  /*
   * O GABARITO da identidade é a intenção DECLARADA, nunca o que o selo diz.
   * Primeiro o órgão corrigido à mão; senão a prefeitura escolhida para a capa.
   * Inferir o alvo do próprio documento conferiria o selo contra ele mesmo, e
   * um volume inteiro coerentemente errado passaria.
   */
  const templateIdDaCapa = (capa?.payload as { templateId?: unknown } | undefined)
    ?.templateId;
  const orgaoAlvo =
    identidade.orgao?.trim() ||
    (typeof templateIdDaCapa === "string"
      ? (templates.find((t) => t.id === templateIdDaCapa)?.nome ?? "")
      : "");

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const capaPdf64 = capaPdfUrl ? await urlToBase64(capaPdfUrl) : null;
      const ldPdf64 = ldPdfUrl ? await urlToBase64(ldPdfUrl) : null;

      /*
       * A separatriz é GARANTIDA aqui, não esperada.
       *
       * Ao promovê-la a artefato, ela passou a depender de o agente PROPOR
       * `kind: "separatriz"` — coisa que ele só faz se pedirem explicitamente.
       * O volume saía sem ela e ninguém percebia. Agora a montagem gera a que
       * faltar e a REGISTRA como artefato, então ela continua visível no canvas
       * e conferível: visibilidade sem perder a confiabilidade de antes.
       */
      const ident = summarizeSelos(selos);
      const porId = new Map((selosDoTomo as Folha[]).map((f) => [f.id, f]));

      /*
       * UM BLOCO POR DISCIPLINA. Com uma disciplina só, o laço roda uma vez e
       * usa exatamente os artefatos já conferidos nesta conversa — a montagem
       * de sempre, sem regra especial para o caso simples.
       *
       * Com várias, cada bloco precisa da SUA separatriz e da SUA LD. O que
       * faltar é gerado aqui e REGISTRADO como artefato, seguindo o que já se
       * fazia com a separatriz: é geração determinística (não custa modelo), e
       * registrar mantém cada folha visível e conferível no canvas em vez de
       * nascer escondida dentro do volume.
       */
      const montaveis: BlocoDoVolume[] = [];
      for (const bloco of blocos) {
        const unico = blocos.length === 1;
        const chave = unico ? "" : `:${bloco.codigo || "sem"}`;
        const doBloco = bloco.ids
          .map((fid) => porId.get(fid))
          .filter((f): f is Folha => f !== undefined);
        const arquivos = new Set(doBloco.map((f) => f.fileName));
        // O título do bloco é o da disciplina. Com um bloco só, continua sendo
        // o que o engenheiro decidiu na LD — mudar isso reescreveria a capa de
        // volumes que já saíram certos.
        const titulo = unico ? sepTitle : bloco.rotulo.toUpperCase() || sepTitle;

        let separatrizPdf64 = unico && sepPdfUrl ? await urlToBase64(sepPdfUrl) : null;
        const sepDoBloco = unico
          ? null
          : results.find((r) => r.artifactId === separatrizId(selos) + chave + tomo.sufixo);
        const sepUrlDoBloco = sepDoBloco?.files.find((f) => f.mime === PDF_MIME)?.url;
        if (!separatrizPdf64 && sepUrlDoBloco) {
          separatrizPdf64 = await urlToBase64(sepUrlDoBloco);
        }
        if (!separatrizPdf64 && titulo) {
          const sep = await postSeparatriz(titulo, {
            // Como no card da separatriz: o código corrigido manda no nome.
            codigo: identidade.codigo ?? ident.codigo ?? "",
            revisao: identidade.revisao ?? ident.revisao ?? "",
          });
          // Sem LibreOffice não há PDF, e é o PDF que entra no volume: a folha
          // fica registrada como artefato (o ODT existe) e a montagem segue sem
          // ela, como já fazia. Perder o volume inteiro por isso seria pior.
          separatrizPdf64 = sep.pdf?.data ?? null;
          await saveResult({
            artifactId: separatrizId(selos) + chave + tomo.sufixo,
            kind: "separatriz",
            payload: { titulo, tomo: tomo.numero },
            summary: `Separatriz ${titulo}`,
            canvas: { label: "Separatriz", titulo, pageNumber: 1 },
            files: arquivosDaSeparatriz(sep),
          });
        }

        let ldDoBloco64 = unico ? ldPdf64 : null;
        if (!unico) {
          const artefato = results.find(
            (r) => r.artifactId === ldId(selos) + chave + tomo.sufixo,
          );
          const url = artefato?.files.find((f) => f.mime === PDF_MIME)?.url;
          if (url) ldDoBloco64 = await urlToBase64(url);
          else {
            /*
             * `folhasDoTomo` leva os ids exatos do bloco: sem eles a rota
             * dividiria por quantidade e a LD do bloco listaria folhas de
             * outra disciplina. `respeitarOrdem` mantém a ordem do escritório.
             */
            const ld = await postLd(selosDoTomo, {
              tituloLd: titulo,
              folhasDoTomo: bloco.ids,
              respeitarOrdem: true,
              // A LD deste BLOCO fala de uma disciplina só: o total corrigido
              // dela é o que vale, e é por isso que ele é guardado por código.
              ...(totaisPorDisciplina[bloco.codigo]
                ? { referenceTotal: totaisPorDisciplina[bloco.codigo] }
                : {}),
              identidade,
            });
            ldDoBloco64 = ld.pdfUrl ? await urlToBase64(ld.pdfUrl) : null;
            await saveResult({
              artifactId: ldId(selos) + chave + tomo.sufixo,
              kind: "ld",
              payload: {
                tituloLd: titulo,
                tomo: tomo.numero,
                folhas: assinaturaDoTomo(doBloco),
              },
              summary: `LD ${titulo} · ${doBloco.length} folha(s)`,
              canvas: { label: `LD ${titulo}`, titulo, pageNumber: 1 },
              files: [
                { label: "ODT", name: ld.odtName, mime: ODT_MIME, url: ld.odtUrl },
                ...(ld.pdfUrl && ld.pdfName
                  ? [
                      {
                        label: "PDF",
                        name: ld.pdfName,
                        mime: PDF_MIME,
                        url: ld.pdfUrl,
                        primary: true,
                      },
                    ]
                  : []),
              ],
            });
          }
        }

        montaveis.push({
          selos: doBloco,
          pranchaFiles: pranchaFilesDoTomo.filter((f) => arquivos.has(f.name)),
          separatrizPdf64,
          ldPdf64: ldDoBloco64,
        });
      }

      const r = await assembleVolume({
        capaPdf64,
        blocos: montaveis,
        fileName: nomeDoVolume(selosDoTomo, identidade, tomo),
      });

      /*
       * A CONFERÊNCIA DO VOLUME roda SOZINHA, logo depois de montar.
       *
       * Não fica atrás de um botão porque montar é irreversível na prática — o
       * engenheiro manda o PDF —, e conferência que depende de alguém lembrar
       * de clicar é conferência que não existe. E NÃO bloqueia o download: quem
       * decide o que fazer com o volume é ele; travar um PDF já gerado só o
       * empurraria a montar de novo às cegas.
       */
      const conferencia = await conferirVolume({
        r,
        montaveis,
        blocos,
        capaPdf64,
        selosDoTomo: selosDoTomo as Folha[],
        totaisPorDisciplina,
        orgaoAlvo,
        conversationId,
      });

      await saveResult({
        artifactId: id,
        kind: "volume",
        // Quais folhas entraram neste volume — é o que o canvas compara depois
        // para saber que ele envelheceu.
        payload: {
          tomo: tomo.numero,
          folhas: assinaturaDoTomo(selosDoTomo as Folha[]),
          conferencia,
        },
        summary: `Volume montado${r.pageCount != null ? ` · ${r.pageCount} páginas` : ""}`,
        canvas: {
          label: "Volume",
          detail: r.pageCount != null ? `${r.pageCount} páginas` : undefined,
          pageNumber: 1,
        },
        files: [{ label: "PDF do volume", name: r.name, mime: PDF_MIME, url: r.url, primary: true }],
      });
      return null;
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "Erro ao montar o volume.";
      setError(motivo);
      /*
       * O motivo VOLTA em vez de virar exceção. O botão individual liga
       * `onClick={onConfirm}` e deixa a promessa solta: lançar daqui viraria
       * rejeição não tratada no console a cada falha. O pai, que precisa contar
       * quais tomos falharam no "montar todos", lê o retorno.
       */
      return motivo;
    } finally {
      setBusy(false);
    }
  }

  /*
   * O pai (`VolumesDoConjunto`) dispara ESTA montagem quando o engenheiro pede
   * todos os volumes de uma vez. O ref carrega sempre a versão atual de
   * `confirm`: registrar a função direto congelaria os selos e os artefatos do
   * primeiro render, e o botão montaria o conjunto de antes.
   */
  const confirmRef = useRef<() => Promise<string | null>>(() => Promise.resolve(null));
  useEffect(() => {
    confirmRef.current = confirm;
  });
  useEffect(() => {
    if (!registrar || !chave) return;
    registrar(chave, () => confirmRef.current());
    return () => registrar(chave, null);
  }, [registrar, chave]);

  return (
    <CardShell kind="volume" resumo={resumo} estado={estado} tomo={tomo.atual > 0 ? tomo.numero : 0}>
      {podeGerar && (
        <>
          {/* O que vai para dentro do volume — as DECISÕES, antes das partes.
              Montar é irreversível na prática (o engenheiro manda o PDF), então
              ele confere aqui em vez de descobrir no documento pronto. */}
          <div className="space-y-1.5">
            <SummaryRow
              label="Folhas"
              value={`${selosDoTomo.length} folha${selosDoTomo.length === 1 ? "" : "s"}`}
            />
            {/* Mesma razão do plano: no volume misto o título é POR BLOCO, e
                um título global aqui mandaria conferir um campo que não sai em
                documento nenhum. */}
            {!misto && (
              <SummaryRow
                label="Título"
                value={sepTitle || "defina o título na LD →"}
                missing={!sepTitle}
              />
            )}
            {ldParams && (
              <SummaryRow
                label="Tomos"
                value={rotuloTomos(ldParams.numTomos, ldParams.tomoInicial)}
              />
            )}
            {capaParams && (
              <SummaryRow
                label="Volume"
                value={capaParams.volume.trim() || "auto (do arquivo)"}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <PartRow label="Capa" ok={Boolean(capaPdfUrl)} />
            {/*
              Com uma disciplina só, as partes seguem listadas uma a uma — é o
              volume simples, e transformá-lo numa lista de um item seria
              cerimônia. Com várias, o que importa é a SEQUÊNCIA de blocos: é
              ela que o engenheiro precisa conferir antes de mandar o PDF.
            */}
            {misto ? (
              <BlocosDoVolume blocos={blocos} />
            ) : (
              <>
                <PartRow
                  label="Separatriz"
                  ok={Boolean(sepPdfUrl)}
                  detail={sepPdfUrl ? sepTitle : "não gerada — peça a separatriz"}
                />
                <PartRow label="LD" ok={Boolean(ldPdfUrl)} />
              </>
            )}
            <PartRow
              label="Pranchas"
              ok={!semPranchas}
              detail={
                semPranchas ? "nenhuma" : `${pranchaFilesDoTomo.length} arquivo(s)`
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {misto
              ? "Junta as partes num PDF único: a capa e, depois dela, um bloco por disciplina (separatriz · LD · folhas). A separatriz e a LD que faltarem em cada bloco são geradas agora."
              : "Junta as partes num PDF único (ordem: capa · separatriz · LD · folhas). As partes sem PDF ficam de fora."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip label="título" phrase="Muda o título para " />
            <AlterChip label="tomos" phrase="Começando no tomo " />
            <AlterChip label="volume" phrase="É o volume " />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={semPranchas || !capaPdfUrl || (!misto && !ldPdfUrl)}
              label="Montar volume"
              busyLabel="Montando…"
              onConfirm={confirm}
            />
            {/* Um volume sem capa ou sem LD não é entregável: antes ele montava
                assim mesmo e o PDF saía incompleto sem aviso. No volume misto a
                LD não é uma: são N, uma por bloco, e a montagem gera as que
                faltarem — exigir a LD única aqui travaria o botão para sempre. */}
            {(semPranchas || !capaPdfUrl || (!misto && !ldPdfUrl)) && (
              <span className="text-xs text-muted-foreground">
                {semPranchas
                  ? "Anexe as pranchas para montar o volume."
                  : !capaPdfUrl
                    ? "Gere a capa deste tomo antes de montar."
                    : "Gere a LD deste tomo antes de montar."}
              </span>
            )}
          </div>
        </>
      )}

      {saved && <ResultLinks summary={saved.summary} files={toResultFiles(saved)} />}
      {/* A conferência do volume montado, logo abaixo do PDF. Crítico pinta o
          semáforo, e o link de baixar continua acima, ativo: quem decide o que
          fazer com o volume é o engenheiro. */}
      {conferenciaDoVolume && (
        <CheckResult result={conferenciaDoVolume} titulo="Volume montado" />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/**
 * A SEQUÊNCIA DE BLOCOS de um volume de várias disciplinas.
 *
 * Numerada porque a ordem é o que se confere: o volume 3 de 040-26 é
 * topografia → sondagem → geométrico → terraplenagem → drenagem →
 * pavimentação, e um bloco fora de lugar é um volume devolvido pela
 * prefeitura. A contagem de folhas vem junto porque é o outro erro comum —
 * a disciplina que entrou com metade das pranchas.
 */
function BlocosDoVolume({ blocos }: { blocos: readonly Bloco[] }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${LABEL_CLASS} w-24 shrink-0`}>Blocos</span>
      <ol className="min-w-0 flex-1 space-y-0.5">
        {blocos.map((bloco, i) => (
          <li key={bloco.codigo || "sem"} className="flex items-baseline gap-2 text-xs">
            <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
            {/*
              A cor é secundária à palavra, como no canvas: quem não distingue
              matiz continua lendo "Drenagem". Disciplina fora das oito famílias
              não ganha cor — sem cor é melhor que cor errada.
            */}
            <span
              className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ background: corDaDisciplina(bloco.rotulo) ?? "var(--border)" }}
              aria-hidden
            />
            <span
              className={
                bloco.rotulo ? "text-foreground" : "text-[var(--status-warning)]"
              }
            >
              {bloco.rotulo || "Sem disciplina lida"}
            </span>
            <span className="text-muted-foreground">
              · {bloco.ids.length} folha{bloco.ids.length === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Uma linha de "parte presente" do volume (capa/LD/pranchas). */
function PartRow({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className={`${LABEL_CLASS} w-24 shrink-0`}>{label}</span>
      <span
        className={
          ok
            ? "font-mono text-sm text-foreground"
            : "font-mono text-sm italic text-muted-foreground"
        }
      >
        {ok ? `✓ ${detail ?? "pronta"}` : `— ${detail ?? "sem PDF"}`}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ Auditoria ----- */

/**
 * Auditoria do memorial (caso raro) — reusa o motor completo `/api/audit` com
 * gabarito automático (obra dos selos + prefeitura da capa gerada, se houver).
 * Precisa do memorial anexado (o composer o separa das pranchas por tipo do nome).
 */
function AuditoriaConfirmation({
  resumo,
  params,
  selos,
  memorialFile,
  memorialFatos = null,
}: {
  resumo: string;
  params: NexoAuditoriaProposalParams;
  selos: SeloForLd[];
  memorialFile: File | null;
  memorialFatos?: {
    obra?: string | null;
    orgao?: string | null;
    municipio?: string | null;
    codigo?: string | null;
    /** Endereço da caracterização da obra — distingue obras de mesmo nome. */
    endereco?: string | null;
  } | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, getResult, saveResult, conversationId, marcarAuditoriaPendente } =
    useConversation();
  const { refresh: refreshUsage } = useConversationUsage();
  const auditoria = useAuditoria();
  const id = auditoriaId(selos, memorialFatos?.codigo);
  const result = getResult(id)?.payload as MemorialAuditResult | undefined;

  /*
   * O GABARITO da auditoria: a obra do CARIMBO quando há pranchas (fonte
   * independente do memorial), senão a que a classificação leu do próprio
   * documento. Antes saía só de `summarizeSelos(selos)` — numa conversa só de
   * memorial isso é vazio, e a auditoria rodava sem régua de identidade,
   * comparando o documento consigo mesmo.
   */
  const fatos = fatosDaConversa(
    selos,
    memorialFatos ? { fileName: "", ...memorialFatos } : null,
  );
  const obra = fatos.gabarito.obra ?? undefined;
  /*
   * A RÉGUA completa, das fontes que a conversa realmente tem.
   *
   * A prefeitura saía só do rótulo "Capa <x>" de um resultado de capa — que numa
   * conversa de memorial sozinho nunca existe. E o município, que a rota aceita
   * há tempos, simplesmente não era enviado. A auditoria rodava com um terço da
   * régua tendo os três campos em mãos.
   *
   * A capa continua valendo como fonte, e vem PRIMEIRO: quando ela existe, a
   * prefeitura foi escolhida pelo engenheiro, o que é mais forte do que o órgão
   * lido do documento sob suspeita.
   */
  const prefeituraDaCapa = results
    .find((r) => r.kind === "capa")
    ?.canvas?.label.replace(/^Capa\s+/i, "")
    .trim();
  const prefeitura = prefeituraDaCapa || memorialFatos?.orgao?.trim() || undefined;
  const municipio = fatos.gabarito.municipio ?? undefined;
  const endereco = memorialFatos?.endereco?.trim() || "";

  async function confirm() {
    if (!memorialFile) return;
    setBusy(true);
    setError(null);
    /*
     * Avisa o PALCO. Sem isto o centro da tela segue mostrando o mapa do volume
     * durante os 3 a 6 minutos da análise, e o usuário não tem sinal nenhum de
     * que o agente está trabalhando.
     */
    const controle = new AbortController();
    /*
     * O id nasce AQUI, antes da chamada. É o que deixa a auditoria reencontrável:
     * gravado junto da conversa, sobrevive a um F5 e à troca de conversa, e o
     * palco volta e pergunta ao servidor o que aconteceu — em vez de descartar
     * 3 a 6 minutos de modelo que já foram pagos.
     */
    const auditId = crypto.randomUUID();
    marcarAuditoriaPendente({
      auditId,
      artifactId: id,
      nivel: params.nivel,
      arquivo: memorialFile.name,
    });
    auditoria.iniciar({
      nivel: params.nivel,
      arquivo: memorialFile.name,
      cancelar: () => controle.abort(),
    });
    try {
      const r = await postAudit(
        memorialFile,
        { obra, prefeitura, municipio },
        params.nivel,
        conversationId,
        { onMarco: auditoria.marcar, signal: controle.signal, auditId },
      );
      await saveResult({
        artifactId: id,
        kind: "auditoria",
        summary: `Auditoria — ${r.report.status_geral}`,
        files: [],
        /*
         * O envelope inteiro, não só o relatório: o texto alimenta o Exportar e o
         * `auditId` é o que dá onde gravar o feedback por achado. Guardar apenas
         * o objeto perderia os dois na primeira restauração da conversa.
         */
        payload: r,
        canvas: {
          label: "Auditoria",
          detail: `${r.report.status_geral} · ${r.report.total_incongruencias} achado(s)`,
        },
      });
      refreshUsage();
    } catch (err) {
      // Desistir é escolha, não falha: um erro em vermelho depois de o próprio
      // usuário cancelar acusaria o sistema de algo que ele não fez.
      const cancelou = err instanceof DOMException && err.name === "AbortError";
      if (!cancelou) {
        setError(err instanceof Error ? err.message : "Erro na auditoria do memorial.");
      }
    } finally {
      setBusy(false);
      auditoria.terminar();
      // Fechou o ciclo nesta aba: não há mais o que reconectar. Se a aba morreu
      // antes daqui, o bilhete fica e o palco assume ao voltar.
      marcarAuditoriaPendente(null);
    }
  }

  /*
   * Uma auditoria PARCIAL não é uma auditoria concluída.
   *
   * Quando uma passada aborta, o veredito rebaixa para "NÃO USE PARA EMITIR" e
   * manda rodar de novo — mas o cartão escondia o botão assim que existia um
   * resultado qualquer. A instrução mais importante do sistema era justamente a
   * única que a interface não deixava cumprir.
   */
  const parcial = (result?.report.runtime?.passadas_incompletas?.length ?? 0) > 0;
  const podeAuditar = !result || parcial;

  return (
    <CardShell kind="auditoria" resumo={resumo}>
      {podeAuditar && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Memorial"
              value={memorialFile ? memorialFile.name : "arraste o PDF do memorial →"}
              missing={!memorialFile}
            />
            <SummaryRow label="Obra (gabarito)" value={obra ?? "—"} missing={!obra} />
            <SummaryRow
              label="Prefeitura"
              value={prefeitura ?? "—"}
              missing={!prefeitura}
            />
            <SummaryRow label="Município" value={municipio ?? "—"} missing={!municipio} />
            {/*
              O ENDEREÇO vem da seção "Caracterização da obra" do memorial,
              lido sem IA. É o campo que distingue duas obras de MESMO NOME — e
              o programa de UBS produz exatamente isso: várias "Unidade Básica
              de Saúde" no mesmo município. Nome não serve de gabarito ali;
              endereço serve.

              Só aparece quando existe: linha vazia num cartão de conferência é
              ruído, e memorial de outro escritório pode não ter a seção.
            */}
            {endereco && <SummaryRow label="Endereço" value={endereco} />}
            <SummaryRow label="Nível" value={params.nivel === "deep" ? "profunda" : "padrão"} />
          </div>
          {/*
            De ONDE veio a régua muda o peso do que a auditoria vai dizer. Obra
            saída do CARIMBO é fonte independente do memorial — é ela que denuncia
            texto reaproveitado. Saída do próprio memorial, a checagem confere o
            documento consigo mesmo, e isso precisa estar dito.
          */}
          {obra && (
            <p className="text-xs text-muted-foreground">
              {fatos.gabarito.origem === "selos"
                ? "Obra lida do carimbo das pranchas — fonte independente do memorial."
                : "Obra lida do próprio memorial — sem prancha para confrontar."}
            </p>
          )}
          {parcial && (
            <p className="text-xs text-[var(--status-warning)]">
              A análise anterior voltou incompleta
              {result?.report.runtime?.passadas_incompletas?.length
                ? ` (${result.report.runtime.passadas_incompletas
                    .map((p) => p.passada)
                    .join(", ")})`
                : ""}
              . Rode de novo antes de decidir.
            </p>
          )}
          {/*
            Sem obra de referência a auditoria roda comparando o documento
            consigo mesmo. Não bloqueia — mas diz, antes dos minutos gastos.
          */}
          {!obra && memorialFile && (
            <p className="text-xs text-muted-foreground">
              Sem obra de referência, a checagem de identidade fica mais fraca.
            </p>
          )}
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={!memorialFile}
              label={parcial ? "Rodar de novo" : "Auditar"}
              busyLabel="Auditando…"
              onConfirm={confirm}
            />
            {!memorialFile && (
              <span className="text-xs text-muted-foreground">
                Anexe o memorial (o Nexo o separa das pranchas).
              </span>
            )}
          </div>
        </>
      )}

      {result && <AuditoriaAncora report={result.report} onVer={auditoria.verNoPalco} />}
      <CardError message={error} />
    </CardShell>
  );
}

/**
 * A ÂNCORA no chat: veredito, contagem por impacto e o caminho para o parecer.
 *
 * Antes esta caixa listava 8 dos N achados como `[prioridade] descrição` e
 * terminava em "relatório completo no módulo Auditoria" — apontando para a tela
 * que o Nexo veio substituir. Era o pior dos dois mundos: prosa demais para o
 * log da conversa, dado de menos para decidir emitir. O parecer legível é o do
 * palco; aqui fica só o que uma linha de conversa precisa dizer.
 */
function AuditoriaAncora({
  report,
  onVer,
}: {
  report: AuditReport;
  onVer: () => void;
}) {
  const verdict = getEmissionVerdict(
    report.incongruencias,
    report.runtime?.passadas_incompletas ?? [],
  );
  const variant =
    verdict.emoji === "🔴" ? "critical" : verdict.emoji === "🟢" ? "ok" : "warning";
  const porImpacto = groupFindingsByImpact(report.incongruencias);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant}>{verdict.label}</Badge>
        <span className="text-xs text-muted-foreground">
          {report.total_incongruencias} achado(s) · obra {report.obra || "?"}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{porImpacto.critico_documental.length} crítico documental</span>
        <span>{porImpacto.tecnico_contratual.length} técnico contratual</span>
        <span>{porImpacto.revisao_editorial.length} revisão editorial</span>
      </div>
      <div>
        <Chip onClick={onVer}>
          <ShieldCheck aria-hidden />
          Ver o parecer
        </Chip>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Separatriz ------- */

/**
 * A separatriz vive dentro do fluxo de volume (é montada como parte dele) — não
 * tem geração avulsa no chat. Read-only, honesto quanto ao próximo passo.
 */
/**
 * Separatriz — a folha que nomeia a disciplina dentro do volume.
 *
 * Antes ela nascia ESCONDIDA: `assembleVolume` a gerava na hora e usava o PDF
 * sem guardar nada, então ela não tinha card, não aparecia no canvas e ninguém
 * conferia o texto. Foi assim que ela saiu com a sigla crua da disciplina
 * ("ESTRUTURAL") em vez do título do documento, e só se percebeu com o volume
 * pronto. Agora é artefato como os outros: gerada antes, visível, conferível.
 *
 * O título NÃO é campo próprio — é o mesmo `tituloLd` já decidido na LD. Dois
 * títulos para o mesmo documento divergiriam.
 *
 * A EXCEÇÃO é o volume de várias disciplinas: quando o engenheiro lista as
 * disciplinas ("as separatrizes de elétrica, CFTV e SPDA"), o agente preenche
 * `titulos` e a lista MANDA — ali ele não está nomeando a capa desta conversa,
 * está pedindo as folhas de rosto do volume inteiro. Era o único uso que ainda
 * exigia a tela `/separatrizes`.
 */
function SeparatrizConfirmation({
  resumo,
  params,
  selos,
  tomo,
}: {
  resumo: string;
  params: NexoSeparatrizProposalParams;
  selos: SeloForLd[];
  tomo: { atual: number; numero: number; sufixo: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, getResult, saveResult, identidade } = useConversation();
  const id = separatrizId(selos) + tomo.sufixo;
  const saved = getResult(id);

  /*
   * O título da separatriz é o MESMO da capa do tomo. A separatriz e a capa
   * nomeiam o mesmo documento dentro do volume — se divergissem, a folha de
   * rosto diria uma coisa e a capa outra, no mesmo tomo.
   */
  const capa = results.find((r) => r.artifactId === capaId(selos) + tomo.sufixo);
  const capaParams = capa?.payload as NexoCapaProposalParams | undefined;
  // Título da capa viva > o que ficou gravado quando esta separatriz foi gerada.
  const savedParams = saved?.payload as { titulo?: string } | undefined;
  const daCapa = capaParams?.tituloCapa?.trim() || savedParams?.titulo?.trim() || "";
  // A lista pedida na conversa vence a herança da capa (ver o comentário acima).
  const listados = (params.titulos ?? []).map((t: string) => t.trim()).filter(Boolean);
  const titulos = listados.length > 0 ? listados : daCapa ? [daCapa] : [];
  const titulo = titulos[0] ?? "";
  const semTitulo = titulos.length === 0;
  const capaSumiu = Boolean(saved) && !capa && listados.length === 0;

  /*
   * `titulos` só entra no payload quando há mais de uma disciplina: com uma só,
   * a chave a mais faria toda separatriz já gerada parecer desatualizada — o
   * estado do card é comparação literal do payload com os params.
   */
  const payload = {
    titulo,
    tomo: tomo.numero,
    ...(titulos.length > 1 ? { titulos } : {}),
  };
  const estado = estadoDoArtefato(saved, payload);
  const podeGerar = estado !== "aplicado";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      /*
       * O nome do arquivo leva o código e a revisão CORRIGIDOS quando existem.
       * Sem isto, a separatriz de um projeto cujo carimbo foi corrigido sairia
       * com o código velho no nome — dentro do mesmo volume em que a capa e a LD
       * já levam o novo.
       */
      const ident = summarizeSelos(selos);
      const r = await postSeparatriz(titulos, {
        codigo: identidade.codigo ?? ident.codigo ?? "",
        revisao: identidade.revisao ?? ident.revisao ?? "",
      });
      const quantas = r.folhas > 1 ? ` · ${r.folhas} folhas` : "";
      await saveResult({
        artifactId: id,
        kind: "separatriz",
        payload,
        summary: `Separatriz ${titulo}${quantas}${r.pdfError ? " · PDF indisponível" : ""}`,
        canvas: { label: "Separatriz", titulo, pageNumber: 1 },
        files: arquivosDaSeparatriz(r),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar a separatriz.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="separatriz" resumo={resumo} estado={estado} tomo={tomo.atual > 0 ? tomo.numero : 0}>
      {podeGerar && (
        <>
          <div className="space-y-1.5">
            {titulos.length > 1 ? (
              <SummaryRow
                label={`Disciplinas (${titulos.length} folhas)`}
                value={titulos.join(" · ")}
              />
            ) : (
              <SummaryRow
                label="Título"
                value={semTitulo ? "defina o título na capa →" : titulo}
                missing={semTitulo}
              />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip label="título" phrase="Muda o título para " />
            <AlterChip label="disciplinas" phrase="As separatrizes são de " />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={semTitulo}
              onConfirm={confirm}
              label={saved ? "Aplicar alteração" : undefined}
            />
            {semTitulo && (
              <span className="text-xs text-muted-foreground">
                A separatriz usa o título da capa — defina lá primeiro.
              </span>
            )}
          </div>
        </>
      )}

      {capaSumiu && (
        <p className="text-xs text-muted-foreground">
          A capa que deu o título a esta separatriz não existe mais.
        </p>
      )}

      {saved && (
        <ResultLinks
          summary={
            estado === "pendente"
              ? `Versão atual (antes da alteração) — ${saved.summary}`
              : saved.summary
          }
          files={toResultFiles(saved)}
        />
      )}
      <CardError message={error} />
    </CardShell>
  );
}

/* ------------------------------------------------------------- Downloads ---- */

function ResultLinks({
  summary,
  files,
}: {
  summary: string;
  files: {
    label: string;
    url: string;
    name: string;
    primary?: boolean;
    sizeBytes?: number;
  }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <p className="text-sm">{summary}</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f) => {
          /* O peso do arquivo é decisão prática: o engenheiro escolhe o que
             anexa no e-mail da prefeitura por tamanho, e descobrir 18 MB só
             depois de baixar é tarde. */
          const peso = tamanhoLegivel(f.sizeBytes);
          return (
            <Button key={f.label} size="sm" variant={f.primary ? "default" : "outline"} asChild>
              <a href={f.url} download={f.name}>
                <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                {f.label}
                {peso && (
                  <span className="ml-1.5 text-[11px] font-normal opacity-70">
                    {peso}
                  </span>
                )}
              </a>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
