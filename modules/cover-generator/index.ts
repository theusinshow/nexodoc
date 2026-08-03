export {
  TEMPLATES,
  MARKERS,
  MESES,
  VOLUME_OPTIONS,
  VOLUME_OPTIONS_ROMAN,
  VOLUME_OPTIONS_NUMERIC,
  FIELD_BASE,
} from "./constants";
export type {
  TemplateConfig,
  GeneralData,
  CoverGroup,
  CoverPage,
  ModuleStep,
} from "./types";
/*
 * A TELA saiu (a capa se faz no Nexo). O que fica deste módulo é o MOTOR:
 * constantes, tipos e os helpers de formatação — `generatePages` monta as
 * páginas da capa e é chamado por `build-capa-proposal.ts`. Eles nunca foram
 * da tela; a tela é que era deles.
 */
export {
  formatVolume,
  formatMesAno,
  formatTomo,
  getFileName,
  generatePages,
  formatDisplayCode,
} from "./hooks/helpers";
