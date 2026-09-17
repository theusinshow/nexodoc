/**
 * O CABEÇALHO DO PARECER: obra, órgão, município e código.
 *
 * 17/09/2026, auditoria 5cb5b3b2 do 027-24. O cartão mandou a obra da capa como
 * gabarito, e o parecer saiu com a linha "OBRA :" de uma tabela de drenagem como
 * obra, a secretaria e a obra coladas no órgão, e "Antônio Carlos" (a jazida de
 * empréstimo) como município. `inferProjectFields` era a terceira leitura de
 * identidade do sistema e a única que não olhava o que foi DECLARADO nem a CAPA.
 *
 * A precedência é a mesma do resto do sistema desde esse dia:
 *   1. o gabarito — o que a pessoa confirmou no cartão antes de auditar;
 *   2. a capa — [[leitura-da-capa.ts]];
 *   3. a leitura solta do texto — o que havia antes, agora só fallback.
 *
 * PURO.
 */
import { lerCapa } from "./leitura-da-capa.ts";

export type IdentidadeDoParecer = {
  obra: string;
  orgao: string;
  municipio: string;
  codigo: string;
};

export type GabaritoDeclarado = {
  obra?: string;
  prefeitura?: string;
  municipio?: string;
  centroCusto?: string;
};

function titulo(valor: string): string {
  const menores = new Set(["de", "da", "do", "das", "dos", "e"]);
  return valor
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && menores.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

const declarado = (v: string | undefined) => (v ?? "").trim();

export function identidadeDoParecer(args: {
  gabarito?: GabaritoDeclarado;
  texto: string;
  inferido: IdentidadeDoParecer;
}): IdentidadeDoParecer {
  const g = args.gabarito ?? {};
  const capa = lerCapa(args.texto, [declarado(g.municipio)]);

  return {
    obra: declarado(g.obra) || capa?.obra || args.inferido.obra,
    orgao: declarado(g.prefeitura) || capa?.orgao || args.inferido.orgao,
    municipio:
      declarado(g.municipio) || (capa?.municipio ? titulo(capa.municipio) : "") || args.inferido.municipio,
    codigo: declarado(g.centroCusto) || capa?.codigo || args.inferido.codigo,
  };
}
