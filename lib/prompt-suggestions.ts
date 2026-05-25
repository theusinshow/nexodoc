import type { AuditMode } from "@/lib/audit-mode";

export type PromptSuggestion = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  auditMode?: AuditMode;
};

export const PROMPT_SUGGESTIONS: PromptSuggestion[] = [
  {
    id: "memorial-identificacao",
    title: "Identificação do memorial",
    description: "Conferir campos principais e referências residuais.",
    auditMode: "memorial",
    prompt:
      "Cheque o memorial descritivo. Verifique nome da obra, código do projeto, endereço, bairro, município, órgão/cliente, disciplina e referências residuais de outro projeto. Aponte apenas incongruências documentais relevantes.",
  },
  {
    id: "memorial-reaproveitamento",
    title: "Reaproveitamento",
    description: "Buscar trechos herdados de outro projeto.",
    auditMode: "memorial",
    prompt:
      "Procure sinais de reaproveitamento indevido no memorial descritivo. Foque em nomes de obra conflitantes, bairros, municípios, endereços, códigos, órgãos e referências residuais incompatíveis com a identificação principal.",
  },
  {
    id: "volume-ld-pranchas",
    title: "LD x pranchas",
    description: "Comparar lista, selos, títulos e revisões.",
    auditMode: "volume",
    prompt:
      "Cheque o volume de projeto. Compare LD/lista de desenhos com as pranchas anexadas, verificando número da prancha, título, revisão, disciplina, código do projeto, volume e tomo.",
  },
  {
    id: "volume-estrutura",
    title: "Estrutura do volume",
    description: "Conferir capa, separatriz, LDs e pacote.",
    auditMode: "volume",
    prompt:
      "Verifique se o volume de projeto está coerente: capa, separatriz, LDs/listas e pranchas. Aponte pranchas ausentes, extras, fora do volume ou com selo/carimbo divergente.",
  },
];
