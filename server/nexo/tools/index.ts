/**
 * Ferramentas headless do Nexo (Fase 0). Composicoes finas dos motores
 * deterministicos existentes, chamaveis pelo agente sem HTTP. Todas retornam
 * Buffers crus (base64 e responsabilidade da camada HTTP).
 */
export { generateCovers } from "./generate-covers";
export type {
  GenerateCoversInput,
  GenerateCoversOutput,
} from "./generate-covers";

/*
 * `generateSeparatrizes` saiu com a tela `/separatrizes`. Ela montava o ODT EM
 * CÓDIGO; o Nexo preenche o TEMPLATE oficial (`separatriz-template.ts`), que é
 * o que faz a folha sair com a identidade visual do escritório. Manter as duas
 * era manter dois resultados visuais possíveis para o mesmo documento.
 */

export { createLD } from "./create-ld";
export type { CreateLDInput, CreateLDOutput } from "./create-ld";

export { assembleVolume, orderVolumeParts } from "./assemble-volume";
export type {
  AssembleVolumeInput,
  AssembleVolumeOutput,
  VolumePart,
  VolumePartRole,
} from "./assemble-volume";
