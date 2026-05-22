export const DOCUMENT_TYPES = [
  "memorial",
  "capa",
  "separatriz",
  "ld",
  "pranchas",
  "outro",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type AuditFileAttachment = {
  id: string;
  file: File;
  documentType: DocumentType;
};

export function getDocumentTypeLabel(type: DocumentType) {
  const labels: Record<DocumentType, string> = {
    memorial: "Memorial",
    capa: "Capa",
    separatriz: "Separatriz",
    ld: "LD",
    pranchas: "Pranchas",
    outro: "Outro",
  };

  return labels[type];
}
