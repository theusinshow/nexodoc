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
    title: "Identificacao do memorial",
    description: "Conferir campos principais e referencias residuais.",
    auditMode: "memorial",
    prompt:
      "Cheque o memorial descritivo. Verifique nome da obra, codigo do projeto, endereco, bairro, municipio, orgao/cliente, disciplina e referencias residuais de outro projeto. Aponte apenas incongruencias documentais relevantes.",
  },
  {
    id: "memorial-reaproveitamento",
    title: "Reaproveitamento",
    description: "Buscar trechos herdados de outro projeto.",
    auditMode: "memorial",
    prompt:
      "Procure sinais de reaproveitamento indevido no memorial descritivo. Foque em nomes de obra conflitantes, bairros, municipios, enderecos, codigos, orgaos e referencias residuais incompatíveis com a identificacao principal.",
  },
  {
    id: "volume-ld-pranchas",
    title: "LD x pranchas",
    description: "Comparar lista, selos, titulos e revisoes.",
    auditMode: "volume",
    prompt:
      "Cheque o volume de projeto. Compare LD/lista de desenhos com as pranchas anexadas, verificando numero da prancha, titulo, revisao, disciplina, codigo do projeto, volume e tomo.",
  },
  {
    id: "volume-estrutura",
    title: "Estrutura do volume",
    description: "Conferir capa, separatriz, LDs e pacote.",
    auditMode: "volume",
    prompt:
      "Verifique se o volume de projeto esta coerente: capa, separatriz, LDs/listas e pranchas. Aponte pranchas ausentes, extras, fora do volume ou com selo/carimbo divergente.",
  },
];
