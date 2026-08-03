import {
  FolderCog,
  FolderKanban,
  Layers3,
  type LucideIcon,
  Waypoints,
} from "lucide-react";

/**
 * Os módulos do software, em UM lugar só.
 *
 * A home e a página de ferramentas antigas descrevem os mesmos módulos com
 * ênfases diferentes; com duas listas, uma renomeação em cima da outra passaria
 * despercebida — foi assim que a "Conferência documental" continuou anunciada
 * depois de ter virado parte do Nexo.
 */

export type ModuleDef = {
  title: string;
  description: string;
  href: string;
  label: string;
  icon: LucideIcon;
  emphasis: boolean;
  status: "active" | "planned";
  shortcut: string | null;
  beta?: boolean;
};

export const nexoModule: ModuleDef = {
  title: "Nexo",
  description:
    "Solte os PDFs e diga o que precisa: o assistente orquestra LD, capas, volume e auditoria, sempre confirmando cada passo.",
  href: "/nexo",
  label: "Abrir Nexo",
  icon: Waypoints,
  emphasis: true,
  status: "active",
  shortcut: null,
  beta: true,
};

export const projetosModule: ModuleDef = {
  title: "Projetos",
  description:
    "Acompanhe projetos, uploads, documentos, artefatos e eventos consolidados no banco.",
  href: "/projetos",
  label: "Abrir projetos",
  icon: FolderKanban,
  emphasis: true,
  status: "active",
  shortcut: null,
};

/**
 * As telas de módulo único, anteriores ao Nexo. Continuam funcionando e
 * continuam alcançáveis — mas saíram da entrada, porque duas maneiras de fazer
 * a mesma coisa é como o produto ganha a fama de confuso, e porque o caminho
 * bom passou a ser o outro.
 *
 * Não são para evoluir: existem como saída de emergência para o que o Nexo
 * ainda não sabe corrigir (o nº da prancha lido errado, por exemplo).
 * Ver docs/nexo-paridade-telas.md.
 */
export const legacyModules: readonly ModuleDef[] = [
  {
    title: "Montagem de capas",
    description:
      "Gere capas padronizadas em ODT, PDF ou ZIP a partir de templates por prefeitura.",
    href: "/capas",
    label: "Abrir capas",
    icon: FolderCog,
    emphasis: false,
    status: "active",
    shortcut: null,
  },
  {
    title: "Organização de volumes",
    description: "Junção, ordenação e conferência final dos volumes de projeto.",
    href: "/volumes",
    label: "Abrir volumes",
    icon: Layers3,
    emphasis: false,
    status: "active",
    shortcut: null,
  },
];
