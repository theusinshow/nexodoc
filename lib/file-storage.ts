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
