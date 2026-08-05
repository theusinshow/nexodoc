/**
 * A IDENTIDADE DO PROJETO dita por uma pessoa — órgão, secretaria, obra, fase,
 * código e revisão.
 *
 * Estes seis campos não são decisão: são fatos do projeto, e o Nexo os deriva do
 * carimbo e do nome do arquivo de propósito ("afirma fatos, pergunta decisões").
 * Só que o carimbo erra, e até aqui não havia onde dizer que ele errou — a única
 * saída era abrir a tela `/capas`, que tem um passo inteiro para eles.
 *
 * Eles valem para a CONVERSA, não para um documento: a capa e a LD do mesmo
 * volume imprimem a mesma obra e o mesmo código, e corrigir só na capa faria os
 * dois documentos do mesmo conjunto discordarem entre si — o mesmo estrago que o
 * total de referência causava. Ver [[totais.ts]].
 *
 * PURO: nenhum import de runtime, para rodar em Node pelado no
 * `scripts/test-nexo-identidade.ts`.
 */

/**
 * Campo ausente ou vazio significa "use o que o carimbo disse". É a mesma regra
 * do `Ajuste` de uma folha: apagar o campo desfaz a correção.
 */
export interface IdentidadeDoProjeto {
  /** Órgão/cliente ("PREFEITURA MUNICIPAL DE CHAPECÓ"). */
  orgao?: string;
  /** Secretaria emissora ("SECRETARIA DE OBRAS"). */
  secretaria?: string;
  /** Nome da obra, como sai impresso na capa e na LD. */
  obra?: string;
  /**
   * Bairro da obra, subtítulo da capa ("BAIRRO JARDIM MARISTELA").
   *
   * É da OBRA, não do documento: vale para a conversa inteira, como o nome da
   * obra e o código. Só sai nos templates de capa que trazem `{{BAIRRO}}`.
   */
  bairro?: string;
  /** Fase do projeto ("PROJETO EXECUTIVO"). */
  fase?: string;
  /** Código do projeto ("040_26"). */
  codigo?: string;
  /** Revisão ("a", "b"...). */
  revisao?: string;
}

/** As chaves da identidade, na ordem em que aparecem na tela. */
export const CAMPOS_DA_IDENTIDADE = [
  "orgao",
  "secretaria",
  "obra",
  "bairro",
  "fase",
  "codigo",
  "revisao",
] as const;

export type CampoDaIdentidade = (typeof CAMPOS_DA_IDENTIDADE)[number];

/** Rótulos de exibição — usados no editor e na frase que vai ao histórico. */
export const ROTULOS_DA_IDENTIDADE: Record<CampoDaIdentidade, string> = {
  orgao: "Órgão",
  secretaria: "Secretaria",
  obra: "Obra",
  bairro: "Bairro",
  fase: "Fase",
  codigo: "Código",
  revisao: "Revisão",
};

/** Só o que tem conteúdo. Campo em branco não é correção — é o carimbo de volta. */
export function limparIdentidade(
  bruta: Readonly<Partial<Record<CampoDaIdentidade, string | undefined>>>,
): IdentidadeDoProjeto {
  const out: IdentidadeDoProjeto = {};
  for (const chave of CAMPOS_DA_IDENTIDADE) {
    const valor = bruta[chave]?.trim();
    if (valor) out[chave] = valor;
  }
  return out;
}

/**
 * Separa o que o editor devolveu em "identidade do projeto" e "o resto"
 * (título, prefeitura, tomos…).
 *
 * Existe porque os dois vivem em lugares diferentes: o resto são os params
 * DAQUELE documento, e a identidade é da conversa inteira. Misturá-los faria a
 * correção da obra durar só até a próxima geração pelo plano, que reconstrói os
 * params a partir da proposta do agente — a correção seria aceita e revertida
 * sem aviso.
 */
export function separarIdentidade(valores: Readonly<Record<string, string>>): {
  identidade: Record<string, string>;
  resto: Record<string, string>;
} {
  const identidade: Record<string, string> = {};
  const resto: Record<string, string> = {};
  const chaves = new Set<string>(CAMPOS_DA_IDENTIDADE);
  for (const [chave, valor] of Object.entries(valores)) {
    if (chaves.has(chave)) identidade[chave] = valor;
    else resto[chave] = valor;
  }
  return { identidade, resto };
}

/**
 * Acumula a correção sobre a que já havia. Campo vazio APAGA aquele campo —
 * é como se desfaz uma correção sem perder as outras.
 */
export function aplicarIdentidade(
  atual: Readonly<IdentidadeDoProjeto>,
  patch: Readonly<Record<string, string>>,
): IdentidadeDoProjeto {
  const proxima: IdentidadeDoProjeto = { ...atual };
  for (const chave of CAMPOS_DA_IDENTIDADE) {
    if (!(chave in patch)) continue;
    const valor = patch[chave]?.trim();
    if (valor) proxima[chave] = valor;
    else delete proxima[chave];
  }
  return proxima;
}
