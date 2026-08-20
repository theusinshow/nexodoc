/**
 * A ORDEM ENTRE MONTAR, ENTREGAR E CONFERIR — e ela é uma regra, não um detalhe
 * de implementação.
 *
 * O volume existe no instante em que a fusão devolve o PDF. Tudo o que vier
 * depois — conferência, leitura de carimbo, identidade do selo — é opinião
 * SOBRE um documento que já existe, e opinião não pode segurar a entrega.
 *
 * Isto nasceu de um defeito medido em 20/08/2026 no volume 10 de 040-26 (20
 * pranchas CAD, 42 MB): `/api/nexo/volume` devolvia 200, o PDF ficava pronto na
 * memória do navegador, e a gravação vinha DEPOIS da conferência. A conferência
 * relê o volume inteiro no pdf.js e rasteriza cada prancha para recortar o
 * carimbo; passados dez minutos ela ainda moía. Resultado: nenhum volume
 * gravado, e uma tela dizendo apenas "MONTANDO…". O caminho feliz e o travado
 * eram indistinguíveis.
 *
 * A intenção certa já estava escrita no comentário do componente — "NÃO bloqueia
 * o download: quem decide o que fazer com o volume é ele; travar um PDF já
 * gerado só o empurraria a montar de novo às cegas". Faltava a ordem obedecer.
 *
 * Por que um núcleo puro e não três linhas trocadas de lugar: a ordem é a regra,
 * e regra que mora dentro de um componente de 2.700 linhas não tem como ser
 * testada. Aqui node cru a tranca — ver `scripts/test-entrega-do-volume.ts`.
 */

export interface EntregaDoVolume<Montado, Conferencia> {
  /** Funde as partes e devolve o volume. Se falhar, não há nada a entregar. */
  montar: () => Promise<Montado>;
  /**
   * Grava o volume. Chamado DUAS vezes de propósito: primeiro com
   * `conferencia: null` — o documento passa a existir para quem o pediu —, e de
   * novo quando a conferência termina. A segunda gravação é uma ATUALIZAÇÃO do
   * mesmo artefato, nunca um segundo volume.
   */
  salvar: (montado: Montado, conferencia: Conferencia | null) => Promise<void>;
  /** Confere o volume já entregue. Pode demorar, pode falhar; não pode barrar. */
  conferir: (montado: Montado) => Promise<Conferencia>;
  /**
   * O instante em que o volume passou a existir — é aqui que a tela sai de
   * "MONTANDO…". Sem este gancho o botão só se liberaria no fim da conferência,
   * e um volume já gravado continuaria parecendo um volume que não saiu.
   */
  aoEntregar?: (montado: Montado) => void;
  /**
   * Onde a falha da conferência aparece. Sem isto ela sumiria em silêncio, que é
   * o oposto do que se quer: o volume sai, mas com a ressalva à vista.
   */
  aoFalharConferencia?: (erro: unknown) => void;
}

/**
 * Monta, ENTREGA, e só então confere.
 *
 * Devolve o volume montado assim que ele está gravado e conferido (ou gravado e
 * com a conferência falhada). Quem precisa devolver o controle antes do fim da
 * conferência deve não esperar a promessa — a entrega já aconteceu quando a
 * primeira gravação resolveu.
 */
export async function entregarVolume<Montado, Conferencia>(
  deps: EntregaDoVolume<Montado, Conferencia>,
): Promise<Montado> {
  // Sem PDF não há entrega: deixamos a falha subir intacta para quem pediu.
  const montado = await deps.montar();

  // A ENTREGA. Deste ponto em diante o engenheiro tem o volume, aconteça o que
  // acontecer com a conferência.
  await deps.salvar(montado, null);
  deps.aoEntregar?.(montado);

  try {
    const conferencia = await deps.conferir(montado);
    await deps.salvar(montado, conferencia);
  } catch (erro) {
    deps.aoFalharConferencia?.(erro);
  }

  return montado;
}
