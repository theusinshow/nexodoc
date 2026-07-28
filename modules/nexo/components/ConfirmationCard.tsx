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

import { useMemo, useState, type ReactNode } from "react";
import {
  FileText,
  Layers,
  ScanLine,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { LightCheckResult } from "@/server/nexo/light-check-core";
import type { AuditReport } from "@/lib/audit-report";
import type {
  NexoAgentProposal,
  NexoLdProposalParams,
  NexoCapaProposalParams,
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
  ODT_MIME,
} from "../lib/generate";
import { assembleVolume, urlToBase64 } from "../lib/assemble-volume";
import { summarizeSelos } from "../lib/agent-context";
import { buildBalancedQuantities } from "@/lib/ld/ld-rules";
import { gruposDasFolhas, type Folha } from "../lib/folhas";
import { assinaturaDoTomo, folhasDoTomo } from "../lib/drop-folhas";
import { opcoesDoTomo } from "../lib/editar-artefato";
import { useComposer } from "../state/composer-controller";
import { useConversation, type SavedResult } from "../state/conversation-store";
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
function auditoriaId(selos: SeloForLd[]): string {
  return `auditoria:${summarizeSelos(selos).codigo ?? "x"}`;
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
}: {
  proposal: NexoAgentProposal;
  selos: SeloForLd[];
  templates: NexoTemplateOption[];
  ldPreview?: LdPreviewData;
  /** Pranchas originais retidas (bytes p/ montar o volume). */
  pranchaFiles?: File[];
  /** Memorial anexado (arquivo distinto) — alimenta a auditoria. */
  memorialFile?: File | null;
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
      return <ConferenciaConfirmation resumo={proposal.resumo} selos={selos} />;
    case "volume":
      return (
        <>
          {tomosDoVolume(selos, results).map((t) => (
            <VolumeConfirmation
              key={t.sufixo || "unico"}
              resumo={proposal.resumo}
              selos={selos}
              pranchaFiles={pranchaFiles}
              tomo={t}
            />
          ))}
        </>
      );
    case "auditoria":
      return (
        <AuditoriaConfirmation
          resumo={proposal.resumo}
          params={proposal.params}
          selos={selos}
          memorialFile={memorialFile}
        />
      );
    case "separatriz":
      return (
        <>
          {tomosDoVolume(selos, results).map((t) => (
            <SeparatrizConfirmation
              key={t.sufixo || "unico"}
              resumo={proposal.resumo}
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

function CardShell({
  kind,
  resumo,
  children,
  estado = "proposta",
  tomo = 0,
}: {
  kind: NexoAgentProposal["kind"];
  resumo: string;
  children: ReactNode;
  /** Proposta / alteração pendente / aplicado — o card diz em que pé está. */
  estado?: EstadoArtefato;
  /** Nº do tomo quando o volume é dividido; 0 = documento único. */
  tomo?: number;
}) {
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <div className="nexodoc-enter rounded-md border border-border bg-card">
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
      <span
        className={
          missing
            ? "whitespace-pre-line font-mono text-sm italic text-[var(--status-warning)]"
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
}: {
  busy: boolean;
  disabled?: boolean;
  label?: string;
  busyLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <Button size="sm" onClick={onConfirm} disabled={busy || disabled}>
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
  const { getResult, saveResult } = useConversation();
  const id = ldId(selos) + tomo.sufixo;
  const saved = getResult(id);

  const titulo = params.tituloLd.trim();
  const semTitulo = titulo === "";
  // O tomo entra na comparação: gerar o tomo 1 não deixa o tomo 2 "aplicado".
  const estado = estadoDoArtefato(saved, {
    ...params,
    tomo: tomo.numero,
    folhas: assinaturaDoTomo(opcoesDoTomo(selos, params.numTomos, tomo.atual).doTomo),
  });
  const podeGerar = estado !== "aplicado";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      // A MESMA decisão do plano e do canvas: quais folhas são deste tomo. Este
      // caminho ficou de fora do sub-projeto 5 e voltava a fatiar por quantidade.
      const { doTomo, opts } = opcoesDoTomo(selos, params.numTomos, tomo.atual);
      const r = await postLd(selos, {
        tituloLd: titulo,
        numTomos: params.numTomos,
        tomoInicial: params.tomoInicial,
        tomoAtual: tomo.atual,
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
    <CardShell kind="ld" resumo={resumo} estado={estado} tomo={tomo.atual > 0 ? tomo.numero : 0}>
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
  const { getResult, saveResult, results } = useConversation();
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
  const estado = estadoDoArtefato(saved, { ...params, tomo: tomo.numero });
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
    <CardShell kind="capa" resumo={resumo} estado={estado} tomo={tomo.atual > 0 ? tomo.numero : 0}>
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
}: {
  resumo: string;
  selos: SeloForLd[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getResult, saveResult } = useConversation();
  const id = conferenciaId(selos);
  const result = getResult(id)?.payload as LightCheckResult | undefined;

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await postCheck(selos);
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

  return (
    <CardShell kind="conferencia" resumo={resumo}>
      {!result && (
        <>
          <p className="text-xs text-muted-foreground">
            Confere se as pranchas batem entre si (código/obra/revisão/folhas). Sem memorial.
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
      <CardError message={error} />
    </CardShell>
  );
}

function CheckResult({ result }: { result: LightCheckResult }) {
  const variant =
    result.veredito === "critico"
      ? "critical"
      : result.veredito === "aviso"
        ? "warning"
        : "ok";
  const label =
    result.veredito === "critico"
      ? "🔴 Não emitir"
      : result.veredito === "aviso"
        ? "🟡 Revisar"
        : "🟢 Consistente";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>{label}</Badge>
        <span className="text-xs text-muted-foreground">
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
 * Monta o volume juntando as partes JÁ geradas nesta conversa (capa + LD do
 * artifact-store) com as pranchas originais retidas. Pré-condições honestas:
 * sem pranchas, botão desabilitado. Capa/LD ausentes (não geradas ou sem PDF)
 * simplesmente não entram — o card mostra o que será incluído.
 */
function VolumeConfirmation({
  resumo,
  selos,
  pranchaFiles,
  tomo,
}: {
  resumo: string;
  selos: SeloForLd[];
  pranchaFiles: File[];
  tomo: { atual: number; numero: number; sufixo: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, getResult, saveResult } = useConversation();
  const id = volumeId(selos) + tomo.sufixo;
  const saved = getResult(id);

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
      let separatrizPdf64 = sepPdfUrl ? await urlToBase64(sepPdfUrl) : null;
      if (!separatrizPdf64 && sepTitle) {
        const sep = await postSeparatriz(sepTitle);
        separatrizPdf64 = sep.data;
        await saveResult({
          artifactId: separatrizId(selos) + tomo.sufixo,
          kind: "separatriz",
          payload: { titulo: sepTitle, tomo: tomo.numero },
          summary: `Separatriz ${sepTitle}`,
          canvas: { label: "Separatriz", titulo: sepTitle, pageNumber: 1 },
          files: [
            { label: "PDF", name: sep.name, mime: PDF_MIME, url: sep.url, primary: true },
          ],
        });
      }
      const r = await assembleVolume({
        // Só as folhas DESTE tomo entram no volume dele.
        selos: selosDoTomo,
        pranchaFiles: pranchaFilesDoTomo,
        capaPdf64,
        ldPdf64,
        separatrizPdf64,
        ...(tomo.atual > 0
          ? { fileName: `volume-tomo-${String(tomo.numero).padStart(2, "0")}.pdf` }
          : {}),
      });
      await saveResult({
        artifactId: id,
        kind: "volume",
        // Quais folhas entraram neste volume — é o que o canvas compara depois
        // para saber que ele envelheceu.
        payload: { tomo: tomo.numero, folhas: assinaturaDoTomo(selosDoTomo as Folha[]) },
        summary: `Volume montado${r.pageCount != null ? ` · ${r.pageCount} páginas` : ""}`,
        canvas: {
          label: "Volume",
          detail: r.pageCount != null ? `${r.pageCount} páginas` : undefined,
          pageNumber: 1,
        },
        files: [{ label: "PDF do volume", name: r.name, mime: PDF_MIME, url: r.url, primary: true }],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao montar o volume.");
    } finally {
      setBusy(false);
    }
  }

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
            <SummaryRow
              label="Título"
              value={sepTitle || "defina o título na LD →"}
              missing={!sepTitle}
            />
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
            <PartRow
              label="Separatriz"
              ok={Boolean(sepPdfUrl)}
              detail={sepPdfUrl ? sepTitle : "não gerada — peça a separatriz"}
            />
            <PartRow label="LD" ok={Boolean(ldPdfUrl)} />
            <PartRow
              label="Pranchas"
              ok={!semPranchas}
              detail={
                semPranchas ? "nenhuma" : `${pranchaFilesDoTomo.length} arquivo(s)`
              }
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Junta as partes num PDF único (ordem: capa · separatriz · LD ·
            folhas). As partes sem PDF ficam de fora.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip label="título" phrase="Muda o título para " />
            <AlterChip label="tomos" phrase="Começando no tomo " />
            <AlterChip label="volume" phrase="É o volume " />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={semPranchas || !capaPdfUrl || !ldPdfUrl}
              label="Montar volume"
              busyLabel="Montando…"
              onConfirm={confirm}
            />
            {/* Um volume sem capa ou sem LD não é entregável: antes ele montava
                assim mesmo e o PDF saía incompleto sem aviso. */}
            {(semPranchas || !capaPdfUrl || !ldPdfUrl) && (
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
      <CardError message={error} />
    </CardShell>
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
}: {
  resumo: string;
  params: NexoAuditoriaProposalParams;
  selos: SeloForLd[];
  memorialFile: File | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, getResult, saveResult, conversationId } = useConversation();
  const { refresh: refreshUsage } = useConversationUsage();
  const id = auditoriaId(selos);
  const result = getResult(id)?.payload as AuditReport | undefined;

  const obra = summarizeSelos(selos).obra ?? undefined;
  // Prefeitura best-effort: do rótulo "Capa <prefeitura>" do resultado de capa.
  const prefeitura = results
    .find((r) => r.kind === "capa")
    ?.canvas?.label.replace(/^Capa\s+/i, "")
    .trim();

  async function confirm() {
    if (!memorialFile) return;
    setBusy(true);
    setError(null);
    try {
      const r = await postAudit(
        memorialFile,
        { obra, prefeitura },
        params.nivel,
        conversationId,
      );
      await saveResult({
        artifactId: id,
        kind: "auditoria",
        summary: `Auditoria — ${r.status_geral}`,
        files: [],
        payload: r,
      });
      refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na auditoria do memorial.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CardShell kind="auditoria" resumo={resumo}>
      {!result && (
        <>
          <div className="space-y-1.5">
            <SummaryRow
              label="Memorial"
              value={memorialFile ? memorialFile.name : "arraste o PDF do memorial →"}
              missing={!memorialFile}
            />
            <SummaryRow label="Obra (gabarito)" value={obra ?? "?"} />
            <SummaryRow label="Nível" value={params.nivel === "deep" ? "profunda" : "padrão"} />
          </div>
          <div className="flex items-center gap-2">
            <ConfirmButton
              busy={busy}
              disabled={!memorialFile}
              label="Auditar"
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

      {result && <AuditResult report={result} />}
      <CardError message={error} />
    </CardShell>
  );
}

function AuditResult({ report }: { report: AuditReport }) {
  const variant =
    report.status_geral === "sem achados críticos"
      ? "ok"
      : report.status_geral === "com pontos de revisão"
        ? "warning"
        : "critical";
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={variant}>{report.status_geral}</Badge>
        <span className="text-xs text-muted-foreground">
          {report.total_incongruencias} achado(s) · obra {report.obra || "?"}
        </span>
      </div>
      {report.conclusao && (
        <p className="text-sm text-muted-foreground">{report.conclusao}</p>
      )}
      {report.incongruencias.length > 0 && (
        <ul className="space-y-1.5">
          {report.incongruencias.slice(0, 8).map((f) => (
            <li key={f.id} className="text-xs">
              <span className="font-mono text-[10px] uppercase text-muted-foreground">
                [{f.prioridade}]
              </span>{" "}
              {f.descricao}
            </li>
          ))}
          {report.incongruencias.length > 8 && (
            <li className="text-xs text-muted-foreground">
              +{report.incongruencias.length - 8} outro(s). Relatório completo no
              módulo Auditoria.
            </li>
          )}
        </ul>
      )}
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
 */
function SeparatrizConfirmation({
  resumo,
  selos,
  tomo,
}: {
  resumo: string;
  selos: SeloForLd[];
  tomo: { atual: number; numero: number; sufixo: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { results, getResult, saveResult } = useConversation();
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
  const titulo = capaParams?.tituloCapa?.trim() || savedParams?.titulo?.trim() || "";
  const semTitulo = titulo === "";
  const capaSumiu = Boolean(saved) && !capa;

  const estado = estadoDoArtefato(saved, { titulo, tomo: tomo.numero });
  const podeGerar = estado !== "aplicado";

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await postSeparatriz(titulo);
      await saveResult({
        artifactId: id,
        kind: "separatriz",
        payload: { titulo, tomo: tomo.numero },
        summary: `Separatriz ${titulo}${r.pdfError ? " · PDF indisponível" : ""}`,
        canvas: { label: "Separatriz", titulo, pageNumber: 1 },
        files: [{ label: "PDF", name: r.name, mime: PDF_MIME, url: r.url, primary: true }],
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
            <SummaryRow
              label="Título"
              value={semTitulo ? "defina o título na capa →" : titulo}
              missing={semTitulo}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AlterChip label="título" phrase="Muda o título para " />
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
  files: { label: string; url: string; name: string; primary?: boolean }[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-[var(--nexodoc-recessed)] p-3">
      <p className="text-sm">{summary}</p>
      <div className="flex flex-wrap gap-2">
        {files.map((f) => (
          <Button key={f.label} size="sm" variant={f.primary ? "default" : "outline"} asChild>
            <a href={f.url} download={f.name}>
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {f.label}
            </a>
          </Button>
        ))}
      </div>
    </div>
  );
}
