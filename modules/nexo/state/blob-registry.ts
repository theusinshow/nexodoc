/**
 * `blobRegistry` — armazém de binários pesados FORA do React (C5/§2 da
 * ARQUITETURA.md).
 *
 * Regra de peso: ArrayBuffers de pranchas, base64/Blob de capa/LD/volume e crops
 * NUNCA entram no estado React. Eles ficam AQUI, num `Map` de módulo, indexados
 * pelo `ArtifactId`. O estado React guarda só ids + metadados leves; quando
 * precisa dos bytes (montar volume — C5) ou de um object URL (download/preview),
 * consulta este registry.
 *
 * Ciclo de vida: `putBlob` cria o object URL; `revokeBlob` o revoga
 * (`revokeObjectURL`) e apaga a entrada — obrigatório no descarte do artefato
 * para não vazar URLs. `clearBlobs` faz o mesmo em lote (reset de sessão).
 *
 * Sem React de propósito: é estado mutável de módulo, não reativo. A UI reage ao
 * `NexoSession` (ids); os bytes são um detalhe de recurso, buscado sob demanda.
 */

/** Entrada do registry: os bytes crus + o object URL para download/preview. */
export interface BlobEntry {
  bytes: ArrayBuffer;
  url: string;
}

/** Map de módulo (singleton). Vive fora do ciclo de render do React. */
const registry = new Map<string, BlobEntry>();

/**
 * Guarda os bytes de um artefato e cria o object URL correspondente. Se já havia
 * uma entrada com o mesmo id, revoga o URL antigo antes de sobrescrever (não
 * vaza). Devolve a entrada criada.
 */
export function putBlob(id: string, bytes: ArrayBuffer, mime: string): BlobEntry {
  const existing = registry.get(id);
  if (existing) URL.revokeObjectURL(existing.url);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const entry: BlobEntry = { bytes, url };
  registry.set(id, entry);
  return entry;
}

/** Lê a entrada (bytes + url) de um artefato, ou `undefined` se não houver. */
export function getBlob(id: string): BlobEntry | undefined {
  return registry.get(id);
}

/**
 * Revoga o object URL e apaga a entrada. Chamar no descarte do artefato
 * (`ARTIFACT_DISMISSED`) para liberar o URL. No-op se o id não existir.
 */
export function revokeBlob(id: string): void {
  const entry = registry.get(id);
  if (!entry) return;
  URL.revokeObjectURL(entry.url);
  registry.delete(id);
}

/** Revoga todos os URLs e limpa o registry (reset de sessão). */
export function clearBlobs(): void {
  for (const entry of registry.values()) URL.revokeObjectURL(entry.url);
  registry.clear();
}
