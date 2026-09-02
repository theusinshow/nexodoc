/**
 * O estado de leitura de CADA anexo, derivado do que já foi lido.
 *
 * O progresso existia só em agregado ("6 de 24 folhas"), acima do composer. Com
 * oito PDFs na fila, isso não responde a pergunta que o engenheiro faz olhando
 * a tela: *este* arquivo aqui já foi lido? deu certo? Ele ficava esperando sem
 * saber se um arquivo específico tinha travado.
 *
 * Nada de novo precisou ser guardado: os selos lidos já trazem o `fileName`, e
 * é isso que amarra resultado e anexo.
 *
 * PURO e sem imports: roda no node cru.
 */

export type EstadoDoAnexo =
  | { tipo: "na-fila" }
  | { tipo: "lendo" }
  | { tipo: "lido"; sigla: string; folha: string }
  | { tipo: "ilegivel" }
  /**
   * NENHUMA folha foi lida porque nenhuma parecia prancha — e são folhas demais
   * para isso ser normal. Quase certamente um memorial que entrou pelo fluxo
   * errado. Ver `PISO_PARA_DESCONFIAR`.
   */
  | { tipo: "nao-e-prancha"; paginas: number }
  | { tipo: "nenhum" };

export interface SeloLido {
  fileName: string;
  extraction: { disciplina?: string | null; numeroFolha?: string | null } | null;
  /**
   * A página foi PULADA de propósito (capa, separatriz, índice) — o campo
   * `ignorada` de `SeloResult`, que já existia e não chegava até aqui.
   *
   * Sem ele, "pulei esta folha porque não é prancha" e "tentei ler e falhei"
   * chegavam idênticos: `extraction: null`. Os dois viravam "selo ilegível", e
   * foi essa frase que um memorial de 31 folhas recebeu no lugar de "isto não é
   * uma prancha".
   */
  ignorada?: string;
}

/**
 * Acima de quantas folhas puladas o silêncio deixa de ser normal.
 *
 * MEDIDO, não chutado: nos 515 PDFs de prancha de `docs/`, 68 pulam 100% das
 * páginas — são LDs e capas, e pulá-las é o comportamento certo. A MAIOR delas
 * tem 4 folhas. Nenhuma prancha real do acervo dispara este aviso.
 *
 * Do outro lado, o `114_19_VOLUME ÚNICO.pdf` tem 31 folhas puladas como "capa".
 * Um documento de 31 capas não é uma capa.
 *
 * Errar para cima cala o aviso onde ele é necessário; errar para baixo põe um
 * alarme em toda montagem de volume, e alarme que toca sempre não avisa nada.
 */
export const PISO_PARA_DESCONFIAR = 4;

/**
 * `lendo` é o estado GLOBAL da leitura: sem ele, um arquivo ainda não lido
 * ficaria indistinguível de um arquivo que ninguém vai ler (o memorial, por
 * exemplo, que não passa pelo OCR de selo).
 */
export function estadoDoAnexo(
  fileName: string,
  selos: readonly SeloLido[],
  lendo: boolean,
  siglaDe: (disciplina: string | null | undefined) => string,
): EstadoDoAnexo {
  const doArquivo = selos.filter((s) => s.fileName === fileName);

  if (doArquivo.length === 0) return lendo ? { tipo: "na-fila" } : { tipo: "nenhum" };

  const comLeitura = doArquivo.filter((s) => s.extraction);
  if (comLeitura.length === 0) {
    /*
     * TUDO PULADO É OUTRA COISA, e não "ilegível".
     *
     * Ilegível pede segunda tentativa: alguém tentou ler o carimbo e não
     * conseguiu. Pulado é o contrário — ninguém tentou, porque a página não
     * parecia prancha. Num arquivo grande isso não é uma capa mal formatada:
     * é um documento que não pertence a este fluxo.
     */
    const puladas = doArquivo.filter((s) => s.ignorada).length;
    if (puladas === doArquivo.length && doArquivo.length > PISO_PARA_DESCONFIAR) {
      return { tipo: "nao-e-prancha", paginas: doArquivo.length };
    }
    // Capa e LD pulam por completo e é assim que deve ser: nada a dizer.
    if (puladas === doArquivo.length) return { tipo: "nenhum" };
    return { tipo: "ilegivel" };
  }

  const primeiro = comLeitura[0].extraction!;
  return {
    tipo: "lido",
    sigla: siglaDe(primeiro.disciplina),
    // O número vem do carimbo como "05/24"; sem ele, o total ainda informa.
    folha: (primeiro.numeroFolha ?? "").trim(),
  };
}

/**
 * Os arquivos em que NENHUMA folha foi lida e que são grandes demais para isso
 * ser normal — quase certamente memoriais que entraram pelo fluxo de prancha.
 *
 * Existe separado de `estadoDoAnexo` porque os dois consumidores são
 * diferentes: o chip fala de UM anexo, e a mensagem da conversa precisa nomear
 * QUAIS arquivos, no fim de um lote de oito PDFs. A regra é a mesma nos dois, e
 * mora aqui uma vez só — duas noções de "isto não é prancha" divergiriam, e a
 * divergência apareceria como um chip aceso sem mensagem nenhuma, ou o inverso.
 *
 * PURA e sem imports, como o resto do módulo: roda no node cru.
 */
export function arquivosQueNaoSaoPrancha(
  selos: readonly SeloLido[],
): { fileName: string; paginas: number }[] {
  const porArquivo = new Map<string, { total: number; puladas: number; lidas: number }>();

  for (const s of selos) {
    const atual = porArquivo.get(s.fileName) ?? { total: 0, puladas: 0, lidas: 0 };
    atual.total += 1;
    if (s.ignorada) atual.puladas += 1;
    if (s.extraction) atual.lidas += 1;
    porArquivo.set(s.fileName, atual);
  }

  const suspeitos: { fileName: string; paginas: number }[] = [];
  for (const [fileName, c] of porArquivo) {
    // `lidas === 0` E tudo pulado: uma única folha lida já prova que o arquivo
    // pertence a este fluxo, por pior que o resto tenha saído.
    if (c.lidas === 0 && c.puladas === c.total && c.total > PISO_PARA_DESCONFIAR) {
      suspeitos.push({ fileName, paginas: c.total });
    }
  }
  return suspeitos;
}
