export interface TemplateConfig {
  id: string;
  name: string;
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
