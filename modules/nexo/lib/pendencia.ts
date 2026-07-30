/**
 * O que mudou desde que o documento foi gerado — e há quanto tempo.
 *
 * O card sabia que os parâmetros mudaram (comparação literal do payload), mas
 * não sabia dizer O QUÊ mudou nem QUANDO o arquivo saiu. "Alteração pendente"
 * sem isso é um aviso que não ajuda a decidir: o engenheiro tem um PDF na mão,
 * possivelmente já protocolado, e precisa saber se a diferença importa.
 *
 * PURO e sem imports: roda no node cru se merecer teste.
 */

export interface MudancaDeParametro {
  /** Nome legível do campo, como aparece na linha de resumo. */
  campo: string;
  /** Valor com que o documento foi gerado. */
  antes: string;
  /** Valor atual da proposta. */
  depois: string;
}

/** Rótulos dos parâmetros que o engenheiro reconhece. Chave desconhecida é ignorada. */
const ROTULOS: Record<string, string> = {
  tituloLd: "Título",
  tituloCapa: "Título",
  titulo: "Título",
  templateId: "Prefeitura",
  volume: "Volume",
  numTomos: "Tomos",
  tomoInicial: "Tomo inicial",
  mes: "Mês",
  ano: "Ano",
  nivel: "Nível",
  titulos: "Disciplinas",
  folhas: "Folhas",
};

function texto(valor: unknown): string {
  if (valor === undefined || valor === null || valor === "") return "—";
  if (Array.isArray(valor)) return valor.join(", ");
  return String(valor);
}

/**
 * Compara o payload gravado com os params atuais e devolve só o que mudou, na
 * ordem dos rótulos. Campos sem rótulo conhecido (`tomo`, assinatura de folhas)
 * ficam de fora: eles disparam a pendência, mas não são o que o engenheiro lê.
 */
export function mudancasDoArtefato(
  gravado: unknown,
  atual: unknown,
): MudancaDeParametro[] {
  if (!gravado || typeof gravado !== "object") return [];
  if (!atual || typeof atual !== "object") return [];
  const antes = gravado as Record<string, unknown>;
  const depois = atual as Record<string, unknown>;

  const mudancas: MudancaDeParametro[] = [];
  for (const [chave, campo] of Object.entries(ROTULOS)) {
    if (!(chave in antes) && !(chave in depois)) continue;
    const a = texto(antes[chave]);
    const d = texto(depois[chave]);
    if (a !== d) mudancas.push({ campo, antes: a, depois: d });
  }
  return mudancas;
}

/** "há 42 min", "há 3 h", "ontem". Sem libs. */
export function haQuantoTempo(quando: number, agora: number): string {
  const min = Math.floor((agora - quando) / 60000);
  if (min < 1) return "agora há pouco";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ontem" : `há ${dias} dias`;
}

/** "96 KB", "18,4 MB". O engenheiro decide o que anexar por peso. */
export function tamanhoLegivel(bytes: number | undefined): string {
  if (bytes === undefined || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1).replace(".", ",")} MB`;
}

/**
 * A frase de consequência: o que essa mudança significa para um documento que
 * pode já ter saído do escritório. É o que transforma "mudou" em "importa".
 */
export function consequenciaDaMudanca(
  kind: string,
  mudancas: MudancaDeParametro[],
): string {
  const campos = mudancas.map((m) => m.campo);
  if (campos.includes("Prefeitura")) {
    return "O modelo de capa é diferente por órgão — o documento precisa sair de novo.";
  }
  if (campos.includes("Título")) {
    return "Se este arquivo já foi para a prefeitura, ele não bate com o protocolo atual.";
  }
  if (campos.includes("Tomos") || campos.includes("Tomo inicial")) {
    return "A divisão em tomos mudou: a numeração do documento não corresponde mais ao volume.";
  }
  if (kind === "volume") {
    return "As partes mudaram depois da montagem — o volume na sua mão não tem o mesmo conteúdo.";
  }
  return "O documento que você baixou não corresponde mais ao que está na tela.";
}
