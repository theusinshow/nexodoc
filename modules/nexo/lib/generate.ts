/**
 * Helpers de GERAÇÃO no cliente (usados pelos cards do chat e pelo assembler de
 * volume). Chamam as rotas determinísticas — a geração é o passo irreversível
 * que só acontece após confirmação. Centralizados aqui para todos os pontos de
 * entrada usarem exatamente o mesmo caminho.
 */
import { conferirSessao } from "./sessao";
import { codigoDaFolha, rotuloDoCodigo } from "./disciplina-da-folha";
import { limparIdentidade, type IdentidadeDoProjeto } from "./identidade";
import type { Folha } from "./folhas";
import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import type { LightCheckResult } from "@/server/nexo/light-check-core";
import type { VolumePart } from "@/server/nexo/volume-parts";
import type { AuditReport } from "@/lib/audit-report";
import {
  runMemorialAudit,
  type MemorialAuditGabarito,
  type MemorialAuditLevel,
  type MemorialAuditOpcoes,
  type MemorialAuditResult,
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
  /** QUAL dos numTomos esta LD é (1-based): traz só as folhas daquele tomo. */
  tomoAtual?: number;
  /** Tomo específico (ex.: 4 = "(TOMO 04)"). 0 = usar numTomos. */
  tomoNumero?: number;
  /**
   * Ids (`arquivo#pagina`) das folhas deste tomo, decididos pelo canvas. Quando
   * vem, substitui a divisão por quantidade — é o que faz o grupo arrastado à mão
   * valer no PDF.
   */
  folhasDoTomo?: string[];
  /** Mantém a ordem recebida em vez de ordenar pelo número do carimbo. */
  respeitarOrdem?: boolean;
  /**
   * Total de folhas do conjunto dito à mão — o "24" de "05/24". Vence o carimbo.
   * Vem da correção feita no canvas, por disciplina.
   */
  referenceTotal?: number;
  /**
   * A identidade do projeto corrigida à mão. A LD imprime a mesma obra, código e
   * revisão que a capa — a correção vale nas duas.
   */
  identidade?: IdentidadeDoProjeto;
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
      tomoAtual: opts.tomoAtual ?? 0,
      tomoNumero: opts.tomoNumero ?? 0,
      ...(opts.folhasDoTomo ? { folhasDoTomo: opts.folhasDoTomo } : {}),
      ...(opts.respeitarOrdem ? { respeitarOrdem: true } : {}),
      ...(opts.referenceTotal && opts.referenceTotal > 0
        ? { referenceTotal: opts.referenceTotal }
        : {}),
      // Sem `secretaria`: ela é da capa (a LD não a imprime).
      ...limparIdentidade({ ...opts.identidade, secretaria: undefined }),
    }),
  });
  conferirSessao(res);
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
  /**
   * A identidade do projeto corrigida à mão (órgão, secretaria, obra, fase,
   * código, revisão). É o ESCAPE de quando o carimbo mente — sem ele, a única
   * saída era a tela `/capas`.
   */
  identidade?: IdentidadeDoProjeto;
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
      ...limparIdentidade(opts.identidade ?? {}),
      ...(opts.mes?.trim() ? { mes: opts.mes.trim() } : {}),
      ...(opts.ano?.trim() ? { ano: opts.ano.trim() } : {}),
    }),
  });
  conferirSessao(res);
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
 *
 * O BLOCO de cada folha vai junto, calculado AQUI com a mesma `codigoDaFolha`
 * que decide o volume e o plano. É o que faz a conferência enxergar o volume
 * como o escritório o emite — uma sequência de 1 a N POR DISCIPLINA. Sem isto,
 * o volume 10 de 040-26 (his 1-11, inc 1-5, spd 1-4) era conferido como uma
 * sequência única de 1 a 20, e um volume perfeito acusava nove folhas faltando
 * e cinco duplicadas. Vai do cliente porque a correção manual da disciplina só
 * existe aqui — o servidor nunca a vê.
 */
export async function postCheck(
  selos: SeloForLd[],
  templateId?: string,
  /**
   * Total de folhas por disciplina, corrigido à mão no canvas. Vai junto porque
   * é o MESMO número que a LD daquele bloco usa: sem ele, a LD numeraria
   * "05/11" e a conferência cobraria as 21 folhas do carimbo errado.
   */
  totais?: Record<string, number>,
): Promise<LightCheckResult> {
  const blocos = (selos as Folha[]).map((f) => codigoDaFolha(f));
  const rotulos: Record<string, string> = {};
  for (const codigo of blocos) {
    if (codigo && !rotulos[codigo]) rotulos[codigo] = rotuloDoCodigo(codigo);
  }

  const res = await fetch("/api/nexo/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selos,
      blocos,
      rotulos,
      ...(totais && Object.keys(totais).length > 0 ? { totais } : {}),
      ...(templateId?.trim() ? { templateId: templateId.trim() } : {}),
    }),
  });
  conferirSessao(res);
  const payload = (await res.json().catch(() => null)) as
    | { error?: string; result?: LightCheckResult }
    | null;
  if (!res.ok || !payload?.result) {
    throw new Error(payload?.error ?? "Falha na conferência.");
  }
  return payload.result;
}

/** Um arquivo gerado: base64 cru (p/ compor o volume) + object URL (p/ baixar). */
export interface SeparatrizFile {
  name: string;
  data: string;
  url: string;
}

export interface SeparatrizGenResult {
  /** aviso quando o LibreOffice está off (o PDF pode faltar; o ODT não). */
  pdfError?: string;
  /** Quantas folhas saíram — uma por disciplina. */
  folhas: number;
  odt: SeparatrizFile;
  /** Ausente quando o LibreOffice não respondeu. */
  pdf?: SeparatrizFile;
  zip: SeparatrizFile;
}

export interface SeparatrizOptions {
  /** Código do projeto, para o nome do arquivo. Vazio = nome sem código. */
  codigo?: string;
  revisao?: string;
}

/**
 * Gera as folhas separatrizes (nome da disciplina no meio da página) que entram
 * no volume. Aceita VÁRIAS disciplinas — uma folha para cada, na ordem dada —
 * porque é assim que o volume real é: elétrica, CFTV, SPDA, cada uma com sua
 * folha de rosto.
 *
 * NÃO lança quando falta o PDF: o ODT é documento de verdade, e recusar a
 * entrega inteira porque o LibreOffice está off seria jogar fora o que deu
 * certo. Quem precisa dos bytes do PDF (a montagem do volume) checa `pdf`.
 */
export async function postSeparatriz(
  titulos: string | string[],
  opts: SeparatrizOptions = {},
): Promise<SeparatrizGenResult> {
  const lista = (Array.isArray(titulos) ? titulos : [titulos])
    .map((t) => t.trim())
    .filter(Boolean);
  const res = await fetch("/api/nexo/separatriz", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titulos: lista,
      ...(opts.codigo?.trim() ? { codigo: opts.codigo.trim() } : {}),
      ...(opts.revisao?.trim() ? { revisao: opts.revisao.trim() } : {}),
    }),
  });
  conferirSessao(res);
  const payload = (await res.json().catch(() => null)) as
    | {
        error?: string;
        pdfError?: string;
        folhas?: number;
        odt?: { name: string; data: string };
        pdf?: { name: string; data: string } | null;
        zip?: { name: string; data: string };
      }
    | null;
  if (!res.ok || !payload?.odt || !payload.zip) {
    throw new Error(payload?.error ?? "Falha ao gerar a separatriz.");
  }
  const comUrl = (f: { name: string; data: string }, mime: string) => ({
    name: f.name,
    data: f.data,
    url: base64ToUrl(f.data, mime),
  });
  return {
    pdfError: payload.pdfError,
    folhas: payload.folhas ?? lista.length,
    odt: comUrl(payload.odt, ODT_MIME),
    pdf: payload.pdf ? comUrl(payload.pdf, "application/pdf") : undefined,
    zip: comUrl(payload.zip, "application/zip"),
  };
}

/**
 * Os arquivos da separatriz no formato dos cards. ZIP como principal, igual à
 * capa: é o pacote completo. O ODT vem junto porque é o único jeito de ajustar
 * o texto sem refazer a folha — era o que ainda prendia o engenheiro à tela
 * `/separatrizes`.
 */
export function arquivosDaSeparatriz(r: SeparatrizGenResult) {
  return [
    { label: "ZIP", name: r.zip.name, mime: "application/zip", url: r.zip.url, primary: true },
    { label: "ODT", name: r.odt.name, mime: ODT_MIME, url: r.odt.url },
    ...(r.pdf
      ? [{ label: "PDF", name: r.pdf.name, mime: "application/pdf", url: r.pdf.url }]
      : []),
  ];
}

/** O que a rota de conferência devolve por página. `null` = o modelo não leu. */
export interface LeituraDoCarimbo {
  pagina: number;
  numeracaoTexto: string;
  folha: number | null;
  total: number | null;
  codigo: string;
  titulo: string;
  disciplina: string;
  orgao: string;
  obra: string;
  erro?: string;
}

/**
 * Manda um lote de recortes de carimbo do volume MONTADO e devolve as leituras.
 *
 * Um lote por chamada, e a rota limita o tamanho: o que liga cada leitura à sua
 * página é a ORDEM das imagens, e lote grande demais faz o modelo perdê-la.
 */
export async function postVolumeCheck(
  paginas: { pagina: number; imageDataUrl: string }[],
  conversationId?: string | null,
): Promise<LeituraDoCarimbo[]> {
  const res = await fetch("/api/nexo/volume-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ paginas, conversationId }),
  });
  conferirSessao(res);
  if (!res.ok) {
    const p = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(p?.error ?? "Falha ao conferir o volume.");
  }
  const json = (await res.json()) as { leituras: LeituraDoCarimbo[] };
  return json.leituras;
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
  /**
   * Quantas páginas cada parte contribuiu, na ORDEM em que entraram no PDF.
   * É o que permite montar a expectativa por página e conferir o volume depois
   * de pronto — sem isto, saber que a página 9 deveria ser a folha 3 do bloco
   * de estrutura exigiria recontar tudo no browser.
   */
  partes?: { role: string; name: string; paginas: number }[];
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
  conferirSessao(res);
  const payload = (await res.json().catch(() => null)) as
    | {
        error?: string;
        pdf?: { name: string; data: string } | null;
        pageCount?: number;
        partes?: { role: string; name: string; paginas: number }[];
      }
    | null;
  if (!res.ok || !payload?.pdf) {
    throw new Error(payload?.error ?? "Falha ao montar o volume.");
  }
  return {
    url: base64ToUrl(payload.pdf.data, "application/pdf"),
    name: payload.pdf.name,
    pageCount: payload.pageCount,
    partes: payload.partes,
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
  opcoes: MemorialAuditOpcoes = {},
): Promise<MemorialAuditResult> {
  return runMemorialAudit(memorial, gabarito, level, conversationId, opcoes);
}
