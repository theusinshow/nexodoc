import { getPrisma } from "@/lib/db";
import { getChecksumSha256 } from "@/lib/project-store";

type StorableData = Buffer | Uint8Array | string;

export type StorageDescriptor = {
  storageProvider: string;
  storageKey: string | null;
  downloadUrl: string | null;
  sizeBytes: number;
  checksumSha256: string;
};

export function getStorageProvider() {
  return process.env.NEXODOC_STORAGE_PROVIDER?.trim() || "none";
}

export function describeStoredFile(input: {
  data: StorableData;
  module: string;
  projectId?: string | null;
  fileName: string;
}): StorageDescriptor {
  const buffer = toBuffer(input.data);
  const provider = getStorageProvider();
  const safeFileName = input.fileName.replace(/[^\w.-]+/g, "_");
  const storageKey =
    provider === "none"
      ? null
      : [
          input.module,
          input.projectId ?? "unassigned",
          `${Date.now()}-${safeFileName}`,
        ].join("/");

  return {
    storageProvider: provider,
    storageKey,
    downloadUrl: buildDownloadUrl(storageKey),
    sizeBytes: buffer.byteLength,
    checksumSha256: getChecksumSha256(buffer),
  };
}

function toBuffer(data: StorableData) {
  if (typeof data === "string") {
    return Buffer.from(data, "utf8");
  }

  return Buffer.from(data);
}

function buildDownloadUrl(storageKey: string | null) {
  if (!storageKey) {
    return null;
  }

  const baseUrl = process.env.NEXODOC_STORAGE_BASE_URL?.trim();

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl.replace(/\/+$/, "")}/${encodeURI(storageKey)}`;
}

/**
 * O TETO POR ARQUIVO.
 *
 * Memorial real tem 1,6 a 5,2 MB (medido em `docs/samples`). 25 MB é folga
 * generosa para o caso torto sem deixar um arquivo qualquer entrar. O que ele
 * evita não é o custo — é estourar em algum lugar mais fundo, sem motivo que
 * chegue a quem tentou.
 */
export const LIMITE_DO_ARQUIVO = 25_000_000;

export class ArquivoRecusado extends Error {
  /*
   * Campo declarado e atribuído à mão, e não propriedade de parâmetro: o node
   * roda os scripts em modo strip-only, que apaga tipos sem transformar sintaxe.
   * Mesmo motivo de `AchadoRecusado` em [[achado-compartilhado.ts]].
   */
  readonly motivo: string;

  constructor(motivo: string) {
    super(motivo);
    this.name = "ArquivoRecusado";
    this.motivo = motivo;
  }
}

/**
 * GUARDA OS BYTES — o primeiro caminho de escrita que este módulo já teve.
 *
 * `describeStoredFile`, acima, só descreve: calcula chave e checksum e devolve
 * `provider: "none"`. Era um esqueleto para um provedor que nunca foi
 * construído, e por isso o memorial chegava ao servidor e era descartado — e
 * quem recebia um achado por e-mail não tinha como conferi-lo no documento.
 *
 * IDEMPOTENTE POR CONSTRUÇÃO: a chave primária é o checksum, então gravar o
 * mesmo conteúdo duas vezes é `update` de nada. Não há "já existe?" a perguntar
 * antes — e é isso que faz duas pessoas auditando o mesmo memorial ao mesmo
 * tempo não virar um erro de banco.
 */
export async function guardarArquivo(args: {
  data: StorableData;
  organizationId: string;
  mimeType: string;
}): Promise<{ checksumSha256: string; sizeBytes: number }> {
  const buffer = toBuffer(args.data);

  if (buffer.byteLength > LIMITE_DO_ARQUIVO) {
    const tamanho = (buffer.byteLength / 1_000_000).toFixed(1);
    const teto = (LIMITE_DO_ARQUIVO / 1_000_000).toFixed(0);
    throw new ArquivoRecusado(`Arquivo grande demais: ${tamanho} MB (teto ${teto} MB).`);
  }

  const checksumSha256 = getChecksumSha256(buffer);

  await getPrisma().storedFile.upsert({
    where: { checksumSha256 },
    create: {
      checksumSha256,
      organizationId: args.organizationId,
      mimeType: args.mimeType,
      sizeBytes: buffer.byteLength,
      bytes: buffer,
    },
    /*
     * Nada. O conteúdo é a chave — se o checksum bate, os bytes são os mesmos, e
     * reescrever 5 MB para gravar o que já está lá seria trabalho por nada.
     */
    update: {},
  });

  return { checksumSha256, sizeBytes: buffer.byteLength };
}
