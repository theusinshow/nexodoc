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
    id: "memorial-pranchas",
    title: "Memorial x pranchas",
    description: "Conferir identificação principal entre memorial e pranchas.",
    prompt:
      "Confira a consistência documental entre memorial, capa e pranchas. Verifique nome da obra, código do projeto, endereço, bairro, município, órgão/cliente, disciplina e sinais de reaproveitamento de outro projeto.",
  },
  {
    id: "volume",
    title: "Checar volume",
    description: "Avaliar estrutura do volume, LD, pranchas e selos.",
    auditMode: "volume",
    prompt:
      "Faça uma checagem de volume documental. Identifique capa, memorial, lista de desenhos/lista de documentos e pranchas. Verifique se a LD corresponde às pranchas, se há pranchas ausentes ou fora da lista, e se selos/carimbos estão coerentes com código, título, revisão, disciplina, volume e tomo.",
  },
  {
    id: "selo-ld",
    title: "Selo e LD",
    description: "Focar em selo/carimbo, lista de desenhos e revisões.",
    auditMode: "volume",
    prompt:
      "Verifique especificamente selos/carimbos das pranchas em comparação com a lista de desenhos ou lista de documentos. Aponte divergências de número da prancha, título, revisão, disciplina, código do projeto, órgão/cliente, volume ou tomo.",
  },
  {
    id: "reaproveitamento",
    title: "Reaproveitamento",
    description: "Procurar indícios de texto, selo ou capa de outro projeto.",
    prompt:
      "Procure sinais de reaproveitamento indevido de outro projeto. Foque em nomes de obra conflitantes, bairros, municípios, códigos, órgãos, selos, capas, rodapés, cabeçalhos e referências residuais incompatíveis com o conjunto analisado.",
  },
  {
    id: "identificacao",
    title: "Identificação",
    description: "Checar campos essenciais de identificação documental.",
    prompt:
      "Confira apenas os campos essenciais de identificação documental: nome da obra, número/código do projeto, endereço, bairro, município, secretaria/órgão/cliente, volume, tomo e disciplina. Aponte somente divergências relevantes.",
  },
];
