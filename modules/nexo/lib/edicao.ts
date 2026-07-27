/**
 * Núcleo PURO da edição visual pelo canvas.
 *
 * A peça crítica é `descreverMudanca`: o que ela devolve vai para o HISTÓRICO da
 * conversa, e é a partir do histórico que o agente re-propõe os parâmetros no
 * turno seguinte. Se a frase não descrever a alteração real, o agente decide
 * sobre informação falsa — e o erro é invisível, porque o documento regerado
 * está certo. Por isso isto é função pura e testada, não texto montado no meio
 * de um componente.
 *
 * SEM IMPORTS (nem alias `@/`): roda no node cru do `test:nexo:session`.
 */

/** Valor exibível de um campo editável (tudo vira texto na frase). */
type Valor = string | number | undefined | null;

/** Rótulo em português de cada campo, por chave dos params. */
export type RotulosDeCampo = Record<string, string>;

function normalizar(v: Valor): string {
  return v == null ? "" : String(v).trim();
}

/**
 * Frase que descreve o que mudou, para entrar no histórico como mensagem do
 * engenheiro. `null` quando nada mudou — e aí nada é escrito, porque poluir o
 * histórico com "não mudei nada" faria o agente gastar contexto com ruído.
 *
 * Os valores saem entre aspas porque o título tem PARÁGRAFOS: sem delimitador, a
 * quebra de linha se confunde com o fim do campo e o agente lê o título pela
 * metade.
 */
export function descreverMudanca(
  antes: Record<string, Valor>,
  depois: Record<string, Valor>,
  rotulos: RotulosDeCampo,
): string | null {
  const linhas: string[] = [];

  for (const [chave, rotulo] of Object.entries(rotulos)) {
    const de = normalizar(antes[chave]);
    const para = normalizar(depois[chave]);
    if (de === para) continue;
    linhas.push(`${rotulo} = "${para}"`);
  }

  if (linhas.length === 0) return null;
  return `Alterei pelo canvas:\n${linhas.join("\n")}`;
}

/**
 * Ids que ficam ÓRFÃOS ao mudar a divisão em tomos.
 *
 * O tomo vive no id (`capa:017:t02`), então mudar de 2 para 3 tomos muda a
 * identidade de tudo: os documentos já gerados deixam de pertencer à divisão
 * atual. Este número é o que o aviso mostra antes de aplicar — trocar o número
 * de tomos sem saber quantos documentos vira resto é caro.
 *
 * `tomoDoArtefato` mora em `results.ts`; aqui recebemos os tomos já lidos para
 * este módulo continuar sem imports.
 */
export function orfaosAposDivisao(
  tomosDosArtefatos: number[],
  numTomos: number,
  tomoInicial: number,
): number {
  // Divisão nova: quais números de tomo passam a existir.
  const validos = new Set<number>();
  if (numTomos > 1) {
    for (let i = 0; i < numTomos; i++) validos.add(tomoInicial + i);
  } else {
    // Um tomo só: os artefatos não têm sufixo, logo tomo 0 é o válido.
    validos.add(0);
  }
  return tomosDosArtefatos.filter((t) => !validos.has(t)).length;
}
