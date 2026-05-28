export interface LdIntegrationData {
  codigoInterno?: string;
  codigoExibido?: string;
  revisao?: string;
  nomeObra?: string;
  fase?: string;
  orgao?: string;
  tituloLd?: string;
  tomos?: string[];
  volume?: string;
}

export const LD_PARAM_PREFIX = "ld_";
