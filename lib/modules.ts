import {
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
 * O que sobrou das telas de módulo único, anteriores ao Nexo.
 *
 * Eram cinco; restou UMA. LD, capas e separatrizes foram aposentadas depois que
 * o Nexo passou a corrigir tudo que elas corrigiam — a razão de existirem era
 * ser a saída de emergência para o carimbo lido errado, e essa saída agora está
 * no canvas (nº da prancha, código, disciplina, total de referência, identidade
 * do projeto, criar e remover folha).
 *
 * `/volumes` fica, e não é dívida: a distância dela é de ESCOPO, não de
 * paridade. A mesa monta o projeto inteiro a partir de PDFs soltos; o Nexo monta
 * um volume do que ele mesmo gerou. Ver docs/nexo-paridade-telas.md.
 */
export const legacyModules: readonly ModuleDef[] = [
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
