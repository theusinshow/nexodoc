/**
 * O TETO POR ARQUIVO — um número só, do navegador ao banco.
 *
 * 17/09/2026, memorial 031_26 (Urubici, 26,8 MB): a rota recusou com 400, o
 * navegador engoliu a recusa e o chat disse "Li as primeiras páginas: é o
 * memorial descritivo" sem ter lido nada. Sem identidade e sem motivo na tela, o
 * único caminho visível era "tratar como prancha" — e aí as 206 páginas do
 * memorial foram para a leitura de carimbo.
 *
 * O número morava em QUATRO lugares, e em dois valores diferentes: `25 * 1024 *
 * 1024` (26.214.400) nas três rotas e `25_000_000` no armazenamento. Um arquivo
 * entre os dois passava na rota e era recusado ao gravar.
 *
 * 40 MB desde 17/09/2026, por decisão do Matheus. O teto NÃO é sobre custo: é a
 * memória do container. Cada auditoria segura o PDF inteiro mais o que o pdfjs
 * constrói em cima dele — medido neste memorial, 229 MB de RSS para 26,8 MB de
 * arquivo. Por isso a vazão global caiu para 1 no `render.yaml`: no plano
 * `starter` (512 MB, heap 384) duas auditorias de 40 MB não cabem. TROCOU UM,
 * TROCA O OUTRO.
 *
 * PURO e sem imports: o navegador usa antes de subir, a rota usa ao receber e o
 * armazenamento usa ao gravar.
 */

export const LIMITE_DO_ARQUIVO_BYTES = 40 * 1024 * 1024;

/** "40 MB", "26,8 MB" — o mesmo jeito de escrever nos dois lados da frase. */
export function emMegabytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const casas = mb >= 10 ? 1 : 2;
  return `${mb.toFixed(casas).replace(".", ",").replace(/,0+$/, "")} MB`;
}

export function excedeOLimite(bytes: number): boolean {
  return bytes > LIMITE_DO_ARQUIVO_BYTES;
}

/**
 * A frase da recusa, com os DOIS números.
 *
 * "excede 25 MB" não diz quanto o arquivo tem, e quem lê não sabe se falta
 * pouco ou muito — nem o que fazer. Com os dois números e a saída (reexportar
 * comprimindo as imagens), a recusa vira instrução.
 */
export function motivoDeArquivoGrande(nome: string, bytes: number): string {
  // Sem nome quando quem recusa é a gravação, que recebe bytes, não arquivo.
  const qual = nome.trim() ? `O arquivo "${nome.trim()}"` : "O arquivo";
  return (
    `${qual} tem ${emMegabytes(bytes)} e o limite é ${emMegabytes(LIMITE_DO_ARQUIVO_BYTES)}. ` +
    `Exporte o PDF de novo comprimindo as imagens e solte outra vez.`
  );
}
