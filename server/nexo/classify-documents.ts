import { extractPdfText } from "@/lib/pdf-text";
import { classifyDocument } from "@/lib/audit-classify";
import type {
  NexoDossieDraft,
  NexoFileClassification,
  NexoVolumeGroup,
} from "@/modules/nexo/types";
import { parseFilename, TIPO_LABEL, type ParsedFilename } from "./parse-filename";
import { disciplinaLabel } from "./disciplinas";

export interface ClassifyDocumentsInput {
  fileName: string;
  buffer: Buffer;
  /** Caminho relativo (pastas) de upload de diretorio — enriquece volume/blocos. */
  relPath?: string;
  /**
   * Trata o arquivo como memorial mesmo que o NOME nao siga a convencao.
   *
   * A identidade (obra/orgao/municipio) so era extraida quando o nome dizia
   * "memorial" — entao um `ESCOLA_JOSE_GIASSI_REV_A.pdf` ficava sem identidade
   * nenhuma, e corrigir o papel na tela nao adiantava nada: a auditoria seguia
   * sem regua. Quem sabe o papel e o usuario; o nome e so um palpite.
   */
  forcarMemorial?: boolean;
}

export interface ClassifyNamesInput {
  fileName: string;
  relPath?: string;
}

const CONFIANCA_RANK: Record<NexoFileClassification["confianca"], number> = {
  alta: 3,
  media: 2,
  baixa: 1,
};

/** Identidade extraida do conteudo (so faz sentido para o memorial). */
interface ContentIdentity {
  obra: string;
  municipio: string;
  orgao: string;
  codigo: string;
  pageCount: number;
  charCount: number;
  confianca: NexoFileClassification["confianca"];
  precisaOcr: boolean;
  sinais: string[];
}

function toClassification(
  fileName: string,
  relPath: string | undefined,
  parsed: ParsedFilename,
  content?: ContentIdentity,
): NexoFileClassification {
  return {
    fileName,
    relPath,
    tipo: parsed.tipo,
    tipoLabel: TIPO_LABEL[parsed.tipo],
    foraDeEscopo: parsed.foraDeEscopo,
    assinado: parsed.assinado,
    obra: content?.obra ?? "",
    municipio: content?.municipio ?? "",
    orgao: content?.orgao ?? "",
    // filename e autoritativo; conteudo so como fallback.
    codigo: parsed.codigo || content?.codigo || "",
    revisao: parsed.revisao,
    disciplinas: parsed.disciplinas,
    folha: parsed.folha,
    volume: parsed.volume,
    pageCount: content?.pageCount ?? 0,
    charCount: content?.charCount ?? 0,
    // Sem conteudo, a confianca vem do parser (nome e altamente estruturado).
    confianca: content?.confianca ?? "alta",
    precisaOcr: content?.precisaOcr ?? false,
    sinais: content?.sinais ?? [],
  };
}

/**
 * Intake do Nexo (Fase 0), FILENAME-FIRST. O nome carrega os fatos objetivos
 * (codigo, revisao, tipo, disciplinas, folha) — autoritativos. O conteudo do PDF
 * so e lido para o MEMORIAL (fonte de obra/orgao/municipio) — pranchas/capas nao
 * precisam e seriam caras (600+ arquivos). Orcamento = fora de escopo.
 */
export async function classifyDocuments(
  files: ClassifyDocumentsInput[],
): Promise<NexoDossieDraft> {
  const arquivos: NexoFileClassification[] = [];

  for (const file of files) {
    const parsed = parseFilename(file.fileName, file.relPath);

    // Le conteudo apenas do memorial em escopo (identidade do projeto) — ou de
    // quem o usuario declarou memorial, corrigindo o palpite do nome.
    const ehMemorial = file.forcarMemorial || parsed.tipo === "memorial";
    let content: ContentIdentity | undefined;
    if (!parsed.foraDeEscopo && ehMemorial) {
      const extracted = await extractPdfText(file.buffer);
      const doc = classifyDocument(file.fileName, extracted, "memorial");
      content = {
        obra: doc.obra,
        municipio: doc.municipio,
        orgao: doc.orgao,
        codigo: doc.codigo,
        pageCount: doc.pageCount,
        charCount: doc.charCount,
        confianca: doc.confianca,
        precisaOcr: doc.precisaOcr,
        sinais: doc.sinais,
      };
    }

    arquivos.push(
      toClassification(
        file.fileName,
        file.relPath,
        // O papel declarado tambem corrige o TIPO: senao o dossie diria
        // "prancha" para o arquivo de que acabou de extrair a identidade.
        file.forcarMemorial ? { ...parsed, tipo: "memorial" as const } : parsed,
        content,
      ),
    );
  }

  return aggregate(arquivos);
}

/**
 * Classificacao SO por nome/caminho (sem ler PDF). Para upload de pasta inteira:
 * o browser manda os nomes+relPaths (leve), e a estrutura do projeto sai daqui.
 * Nao extrai identidade (obra/orgao) — isso exige o conteudo do memorial.
 */
export function classifyFilenames(items: ClassifyNamesInput[]): NexoDossieDraft {
  const arquivos = items.map((it) =>
    toClassification(it.fileName, it.relPath, parseFilename(it.fileName, it.relPath)),
  );
  return aggregate(arquivos);
}

/** Escolhe o valor do arquivo de maior confianca que tem o campo preenchido. */
function pickByConfidence(
  arquivos: NexoFileClassification[],
  key: "obra" | "municipio" | "codigo" | "orgao" | "revisao",
): string | undefined {
  const withValue = arquivos.filter((a) => !a.foraDeEscopo && a[key]?.trim());
  if (withValue.length === 0) return undefined;
  return [...withValue].sort(
    (a, b) => CONFIANCA_RANK[b.confianca] - CONFIANCA_RANK[a.confianca],
  )[0][key];
}

function aggregate(arquivos: NexoFileClassification[]): NexoDossieDraft {
  const emEscopo = arquivos.filter((a) => !a.foraDeEscopo);

  const codes = new Set<string>();
  for (const a of emEscopo) for (const c of a.disciplinas) codes.add(c);
  const disciplinas = Array.from(codes, (c) => disciplinaLabel(c) ?? c.toUpperCase());

  const { volumes, semVolume } = buildVolumes(emEscopo);

  return {
    obra: pickByConfidence(arquivos, "obra"),
    orgao: pickByConfidence(arquivos, "orgao"),
    municipio: pickByConfidence(arquivos, "municipio"),
    codigo: pickByConfidence(arquivos, "codigo"),
    revisao: pickByConfidence(arquivos, "revisao"),
    disciplinas,
    volumes,
    semVolume,
    arquivos,
  };
}

/** Agrupa por volume (parser.volume); memorial/avulsos ficam sem volume. */
function buildVolumes(arquivos: NexoFileClassification[]): {
  volumes: NexoVolumeGroup[];
  semVolume: NexoFileClassification[];
} {
  const map = new Map<string, NexoFileClassification[]>();
  const semVolume: NexoFileClassification[] = [];

  for (const a of arquivos) {
    if (a.volume) {
      const list = map.get(a.volume) ?? [];
      list.push(a);
      map.set(a.volume, list);
    } else {
      semVolume.push(a);
    }
  }

  const volumes: NexoVolumeGroup[] = Array.from(map, ([numero, files]) => {
    const codes = new Set<string>();
    for (const f of files) for (const c of f.disciplinas) codes.add(c);
    return {
      numero,
      rotulo: `Volume ${numero}`,
      disciplinas: Array.from(codes, (c) => disciplinaLabel(c) ?? c.toUpperCase()),
      contagem: {
        memoriais: files.filter((f) => f.tipo === "memorial").length,
        capas: files.filter((f) => f.tipo === "capa").length,
        separatrizes: files.filter((f) => f.tipo === "separatriz").length,
        pranchas: files.filter((f) => f.tipo === "prancha").length,
        volumes: files.filter((f) => f.tipo === "volume").length,
        outros: files.filter((f) => f.tipo === "outro").length,
      },
      arquivos: files,
    };
  }).sort((a, b) => Number(a.numero) - Number(b.numero));

  return { volumes, semVolume };
}
