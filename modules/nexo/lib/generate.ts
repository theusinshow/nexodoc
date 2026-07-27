/**
 * Helpers de GERAÇÃO no cliente (usados pelos cards do chat e pelo assembler de
 * volume). Chamam as rotas determinísticas — a geração é o passo irreversível
 * que só acontece após confirmação. Centralizados aqui para todos os pontos de
 * entrada usarem exatamente o mesmo caminho.
 */
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { LightCheckResult } from "@/server/nexo/light-check-core";
import type { VolumePart } from "@/server/nexo/volume-parts";
import type { AuditReport } from "@/lib/audit-report";
import {
  runMemorialAudit,
  type MemorialAuditGabarito,
  type MemorialAuditLevel,
} from "./audit";

export const ODT_MIME = "application/vnd.oasis.opendocument.text";

export interface LdGenResult {
  resumo: { disciplina: string; codigo: string; revisao: string; totalFolhas: number };
  warnings: string[];
  odtUrl: string;
  odtName: string;
  pdfUrl?: string;
  pdfName?: string;
}

export interface CapaGenResult {
  resumo: {
    prefeitura: string;
    disciplina: string;
    codigo: string;
    volume: string;
    tomos: number;
  };
  pdfError?: string;
  zipUrl: string;
  zipName: string;
  odtUrl: string;
  odtName: string;
  pdfUrl?: string;
  pdfName?: string;
}

/** base64 -> object URL (para download sem trafegar o binário de novo). */
export function base64ToUrl(base64: string, mime: string): string {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}

export interface LdOptions {
  tituloLd?: string;
  /** Divide as folhas em N tomos. Default 1. */
  numTomos?: number;
  /** A partir de qual tomo contar (default 1). A numeração é do VOLUME. */
  tomoInicial?: number;
  /** Tomo específico (ex.: 4 = "(TOMO 04)"). 0 = usar numTomos. */
  tomoNumero?: number;
}

export async function postLd(
  selos: SeloForLd[],
  opts: LdOptions = {},
): Promise<LdGenResult> {
  const res = await fetch("/api/nexo/ld", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selos,
      tituloLd: opts.tituloLd,
      numTomos: opts.numTomos ?? 1,
      tomoInicial: opts.tomoInicial ?? 1,
      tomoNumero: opts.tomoNumero ?? 0,
    }),
  });
  const payload = (await res.json().catch(() => null)) as
    | {
        error?: string;
        resumo?: LdGenResult["resumo"];
        warnings?: string[];
        files?: {
          odt: { name: string; data: string };
          pdf: { name: string; data: string } | null;
        } | null;
      }
    | null;
  if (!res.ok || !payload?.files) {
    throw new Error(payload?.error ?? "Falha ao gerar a LD.");
  }
  return {
    resumo: payload.resumo!,
    warnings: payload.warnings ?? [],
    odtName: payload.files.odt.name,
    odtUrl: base64ToUrl(payload.files.odt.data, ODT_MIME),
    pdfName: payload.files.pdf?.name,
    pdfUrl: payload.files.pdf
      ? base64ToUrl(payload.files.pdf.data, "application/pdf")
      : undefined,
  };
}

export interface CapaOptions {
  templateId: string;
  /** Título documental da capa; vazio = o builder usa obra/disciplina do selo. */
  tituloCapa?: string;
  /** arábico ("1","2"...); vazio/omitido = deriva do nome do arquivo. */
  volume?: string;
  /** Divide em N tomos (uma capa por tomo). Default 1. */
  numTomos?: number;
  /** A partir de qual tomo contar (default 1). A numeração é do VOLUME. */
  tomoInicial?: number;
  /** Tomo específico (ex.: 4 = "TOMO 04"). 0 = usar numTomos. */
  tomoNumero?: number;
  /** override da secretaria; vazio = carimbo -> padrão do template. */
  secretaria?: string;
  /** override do mês/ano da capa; vazio = mês/ano atual. */
  mes?: string;
  ano?: string;
}

export async function postCapa(
  selos: SeloForLd[],
  opts: CapaOptions,
): Promise<CapaGenResult> {
  const res = await fetch("/api/nexo/capa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selos,
      templateId: opts.templateId,
      numTomos: opts.numTomos ?? 1,
      tomoInicial: opts.tomoInicial ?? 1,
      tomoNumero: opts.tomoNumero ?? 0,
      ...(opts.tituloCapa?.trim() ? { tituloCapa: opts.tituloCapa.trim() } : {}),
      ...(opts.volume?.trim() ? { volume: opts.volume.trim() } : {}),
      ...(opts.secretaria?.trim() ? { secretaria: opts.secretaria.trim() } : {}),
      ...(opts.mes?.trim() ? { mes: opts.mes.trim() } : {}),
      ...(opts.ano?.trim() ? { ano: opts.ano.trim() } : {}),
    }),
  });
  const payload = (await res.json().catch(() => null)) as
    | {
        error?: string;
        resumo?: CapaGenResult["resumo"];
        pdfError?: string;
        files?: {
          odt: { name: string; data: string };
          pdf: { name: string; data: string } | null;
          zip: { name: string; data: string };
        } | null;
      }
    | null;
  if (!res.ok || !payload?.files) {
    throw new Error(payload?.error ?? "Falha ao gerar a capa.");
  }
  return {
    resumo: payload.resumo!,
    pdfError: payload.pdfError,
    odtName: payload.files.odt.name,
    odtUrl: base64ToUrl(payload.files.odt.data, ODT_MIME),
    zipName: payload.files.zip.name,
    zipUrl: base64ToUrl(payload.files.zip.data, "application/zip"),
    pdfName: payload.files.pdf?.name,
    pdfUrl: payload.files.pdf
      ? base64ToUrl(payload.files.pdf.data, "application/pdf")
      : undefined,
  };
}

/**
 * Conferência leve (light check): porta de qualidade determinística, sem IA.
 * Confere se pranchas/LD/capa são internamente consistentes. `templateId`
 * (opcional) casa a prefeitura da capa. Devolve o veredito + achados.
 */
export async function postCheck(
  selos: SeloForLd[],
  templateId?: string,
): Promise<LightCheckResult> {
  const res = await fetch("/api/nexo/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selos,
      ...(templateId?.trim() ? { templateId: templateId.trim() } : {}),
    }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; result?: LightCheckResult }
    | null;
  if (!res.ok || !payload?.result) {
    throw new Error(payload?.error ?? "Falha na conferência.");
  }
  return payload.result;
}

export interface SeparatrizGenResult {
  /** aviso quando o LibreOffice está off (PDF pode faltar). */
  pdfError?: string;
  /** base64 cru do PDF — é o que entra como parte do volume. */
  data: string;
  name: string;
  /** object URL para download/preview (não trafega o binário de novo). */
  url: string;
}

/**
 * Gera UMA folha separatriz (nome da disciplina no meio da página) para entrar
 * no volume. A rota só usa o `title`; devolvemos o base64 (p/ compor o volume) e
 * um object URL (p/ download). Lança se o PDF não veio (LibreOffice off) — o
 * chamador que trata a separatriz como best-effort captura e segue sem ela.
 */
export async function postSeparatriz(title: string): Promise<SeparatrizGenResult> {
  const res = await fetch("/api/nexo/separatriz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  const payload = (await res.json().catch(() => null)) as
    | {
        error?: string;
        pdfError?: string;
        pdf?: { name: string; data: string } | null;
      }
    | null;
  if (!res.ok || !payload?.pdf) {
    throw new Error(payload?.error ?? "Falha ao gerar a separatriz.");
  }
  return {
    pdfError: payload.pdfError,
    data: payload.pdf.data,
    name: payload.pdf.name,
    url: base64ToUrl(payload.pdf.data, "application/pdf"),
  };
}

export interface VolumeOptions {
  /** nome do PDF final; default "volume.pdf" na rota. */
  fileName?: string;
  /** reordena canonicamente na rota; por padrão a ordem enviada é respeitada. */
  reorder?: boolean;
}

export interface VolumeGenResult {
  url: string;
  name: string;
  pageCount?: number;
}

/**
 * Monta o volume final: recebe as partes JÁ na ordem canônica (use
 * `buildVolumeParts`) como PDFs em base64, funde num único PDF e devolve object
 * URL + contagem de páginas. A ordem enviada é respeitada (`reorder:false`).
 */
export async function postVolume(
  parts: VolumePart[],
  opts: VolumeOptions = {},
): Promise<VolumeGenResult> {
  const res = await fetch("/api/nexo/volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parts,
      ...(opts.fileName?.trim() ? { fileName: opts.fileName.trim() } : {}),
      ...(opts.reorder ? { reorder: true } : {}),
    }),
  });
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; pdf?: { name: string; data: string } | null; pageCount?: number }
    | null;
  if (!res.ok || !payload?.pdf) {
    throw new Error(payload?.error ?? "Falha ao montar o volume.");
  }
  return {
    url: base64ToUrl(payload.pdf.data, "application/pdf"),
    name: payload.pdf.name,
    pageCount: payload.pageCount,
  };
}

/**
 * Auditoria do memorial (caso raro): centraliza o caminho da fachada reusando o
 * motor completo (`runMemorialAudit` -> `/api/audit`) com gabarito automático.
 * Devolve o AuditReport do motor existente.
 */
export async function postAudit(
  memorial: File,
  gabarito: MemorialAuditGabarito = {},
  level: MemorialAuditLevel = "standard",
  conversationId?: string | null,
): Promise<AuditReport> {
  return runMemorialAudit(memorial, gabarito, level, conversationId);
}
