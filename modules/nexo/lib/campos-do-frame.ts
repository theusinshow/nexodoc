/**
 * De onde vem cada marcador do modelo.
 *
 * O frame desenha o que o modelo manda; esta tabela diz o que cada marcador
 * SIGNIFICA: se é decisão do engenheiro (campo editável), fato derivado do
 * carimbo/arquivo/divisão (cinza, com a procedência) ou identidade do projeto
 * (editável, mas guardada na conversa e não no documento).
 *
 * Marcador que não estiver aqui vira texto livre no frame e sai pelo canal de
 * extras na geração — é o que torna verdadeira a promessa de que acrescentar um
 * campo ao ODT basta.
 *
 * PURO: só `import type`.
 */
import type { CampoDoFrame } from "../components/FrameDoDocumento";
import type { IdentidadeDoProjeto } from "./identidade";

export const CAMPOS_DO_FRAME: CampoDoFrame[] = [
  { marcador: "NOME_OBRA", rotulo: "Obra", placeholder: "nome da obra" },
  { marcador: "BAIRRO", rotulo: "Bairro", placeholder: "bairro (opcional)" },
  {
    marcador: "TITULO_CAPA",
    rotulo: "Título",
    placeholder: "disciplina do projeto",
  },
  { marcador: "SECRETARIA", rotulo: "Secretaria", placeholder: "secretaria" },
  { marcador: "ORGAO", rotulo: "Órgão", derivadoDe: "do modelo" },
  { marcador: "FASE", rotulo: "Fase", derivadoDe: "do modelo" },
  { marcador: "VOLUME", rotulo: "Volume", derivadoDe: "do arquivo" },
  { marcador: "TOMO", rotulo: "Tomo", derivadoDe: "da divisão" },
  { marcador: "CODIGO_EXIBIDO", rotulo: "Código", derivadoDe: "do carimbo" },
  { marcador: "MES_ANO", rotulo: "Data", derivadoDe: "do mês corrente" },
  { marcador: "DISCIPLINA", rotulo: "Disciplina", derivadoDe: "do carimbo" },
];

/** Marcadores que são IDENTIDADE do projeto (valem para a conversa inteira). */
export const DA_IDENTIDADE: Record<string, keyof IdentidadeDoProjeto> = {
  NOME_OBRA: "obra",
  BAIRRO: "bairro",
  ORGAO: "orgao",
  SECRETARIA: "secretaria",
  FASE: "fase",
  CODIGO_EXIBIDO: "codigo",
};

/** Marcadores que são PARAMS do documento (decisões por artefato). */
export const DOS_PARAMS: Record<string, string> = {
  TITULO_CAPA: "tituloCapa",
  VOLUME: "volume",
};

/** Os marcadores que o frame desenha em cinza — fatos, não decisões. */
const DERIVADOS = new Set(
  CAMPOS_DO_FRAME.filter((c) => c.derivadoDe).map((c) => c.marcador),
);

/**
 * O que foi DECIDIDO por marcador: a correção à mão, ou o param do documento.
 *
 * O derivado do carimbo NÃO entra aqui — ele viaja separado, como texto
 * fantasma. Misturado ao valor, o campo não podia ser apagado: limpar devolvia
 * "" ao estado e o derivado reaparecia no mesmo render, com o controle brigando
 * com quem digitava. E vazio é justamente o que significa "vale o carimbo".
 */
export function valoresDoFrame(args: {
  identidade: IdentidadeDoProjeto;
  params: Record<string, string>;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const campo of CAMPOS_DO_FRAME) {
    const daIdentidade = DA_IDENTIDADE[campo.marcador];
    const doParam = DOS_PARAMS[campo.marcador];
    out[campo.marcador] =
      (daIdentidade ? (args.identidade[daIdentidade] ?? "").trim() : "") ||
      (doParam ? (args.params[doParam] ?? "").trim() : "");
  }
  return out;
}

/**
 * Separa o que o frame devolveu nos três destinos: identidade (da conversa),
 * params (do documento) e extras (marcadores que o modelo tem e o Nexo não
 * conhece).
 *
 * Misturá-los faria a correção da obra durar só até a próxima geração pelo
 * plano, que reconstrói os params a partir da proposta do agente — aceita e
 * revertida sem aviso. É o mesmo motivo de `separarIdentidade` existir.
 */
export function separarParaGerar(valores: Record<string, string>): {
  identidade: Record<string, string>;
  params: Record<string, string>;
  extras: Record<string, string>;
} {
  const identidade: Record<string, string> = {};
  const params: Record<string, string> = {};
  const extras: Record<string, string> = {};

  for (const [marcador, valor] of Object.entries(valores)) {
    // Derivado não se envia: ele se recalcula do carimbo a cada geração.
    if (DERIVADOS.has(marcador)) continue;
    const chaveDaIdentidade = DA_IDENTIDADE[marcador];
    const chaveDoParam = DOS_PARAMS[marcador];
    if (chaveDaIdentidade) identidade[chaveDaIdentidade] = valor;
    else if (chaveDoParam) params[chaveDoParam] = valor;
    else extras[marcador] = valor;
  }
  return { identidade, params, extras };
}
