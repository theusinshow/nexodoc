export interface TemplateConfig {
  id: string;
  name: string;
  grupo?: string;
  variante?: string;
  volumeFormat?: "roman" | "numeric";
  tomoFormat?: "parenthesized-padded" | "parenthesized" | "plain-padded" | "plain";
  coverTitleMode?: "items" | "volume-title-items";
  defaults: {
    orgao: string;
    secretaria: string;
    fase: string;
  };
  campos: string[];
}

export interface GeneralData {
  templateId: string;
  orgao: string;
  secretaria: string;
  nomeObra: string;
  /**
   * Subtítulo da obra, entre o nome e o volume ("BAIRRO JARDIM MARISTELA").
   *
   * Opcional: só os templates que trazem `{{BAIRRO}}` no ODT o imprimem. Foi o
   * único campo que separava a capa feita à mão do escritório do template que
   * já existia — todo o resto do layout já batia.
   */
  bairro?: string;
  fase: string;
  mes: string;
  ano: string;
  codigoInterno: string;
  codigoExibido: string;
  siglaArquivo: string;
  revisao: string;
}

export interface CoverGroup {
  id: string;
  tituloCapa: string;
  disciplina: string;
  volume: string;
  tomoMode: "quantity" | "list";
  tomoQuantity: number;
  tomoList: string[];
}

export interface CoverPage {
  id: string;
  groupId: string;
  tituloCapa: string;
  disciplina: string;
  tomo: string;
  volume: string;
  pageNumber: number;
}

export type ModuleStep =
  | "template"
  | "dados"
  | "grupos"
  | "previa"
  | "resumo"
  | "resultado";
