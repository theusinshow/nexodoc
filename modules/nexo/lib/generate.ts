/**
 * Helpers de GERAÇÃO no cliente (compartilhados pelo SelosPanel e pelo chat do
 * agente). Chamam as rotas determinísticas — a geração é o passo irreversível
 * que só acontece após confirmação. Centralizados aqui para os dois pontos de
 * entrada (botões do painel e cards do chat) usarem exatamente o mesmo caminho.
 */
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";

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
  numTomos?: number;
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
  tituloCapa?: string;
  /** arábico ("1","2"...); vazio/omitido = deriva do nome do arquivo. */
  volume?: string;
  numTomos?: number;
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
      tituloCapa: opts.tituloCapa,
      numTomos: opts.numTomos ?? 1,
      ...(opts.volume?.trim() ? { volume: opts.volume.trim() } : {}),
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
