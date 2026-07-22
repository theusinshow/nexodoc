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

export { generateSeparatrizes } from "./generate-separatrizes";
export type {
  GenerateSeparatrizesInput,
  GenerateSeparatrizesOutput,
} from "./generate-separatrizes";

export { createLD } from "./create-ld";
export type { CreateLDInput, CreateLDOutput } from "./create-ld";

export { assembleVolume, orderVolumeParts } from "./assemble-volume";
export type {
  AssembleVolumeInput,
  AssembleVolumeOutput,
  VolumePart,
  VolumePartRole,
} from "./assemble-volume";
