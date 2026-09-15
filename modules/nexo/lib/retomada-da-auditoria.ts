/**
 * QUANDO RETOMAR SOZINHO A AUDITORIA EM VOO.
 *
 * A retomada existe para o F5: a página nasce noutra conversa (um id novo, ou a
 * última lembrada) enquanto uma auditoria segue rodando no servidor, e a tela
 * precisa voltar para ela. Ela é da CARGA da página — e só da carga.
 *
 * 15/09/2026, jornada c5: auditar em A, abrir B com a análise em voo. B ficava
 * marcada por ~1s e a tela voltava sozinha para A. A guarda antiga só se dava
 * por decidida quando retomava; com A já aberta na carga (ou sem bilhete nenhum
 * ainda), a decisão ficava pendurada, e o primeiro clique para longe de A era
 * tratado como se fosse a carga.
 *
 * "Carga" é a primeira vez que a lista de conversas chega (ela vem do disco,
 * assíncrona): até lá nada se decide. Nessa primeira lista decide-se uma vez,
 * retomando ou não; dali em diante, trocar de conversa é escolha de quem usa.
 *
 * Lista vazia conta como "ainda não chegou": quem não tem conversa nenhuma
 * também não tem auditoria a retomar, e a primeira lista com conteúdo decide.
 *
 * `abrindo` é a conversa que a própria carga já mandou abrir (a última lembrada,
 * ou a da URL), cuja abertura é assíncrona. 15/09/2026, fim da c5: F5 de volta
 * para A com o bilhete de A no disco — a lista chegava com a conversa nova ainda
 * aberta, e a retomada abria A uma SEGUNDA vez. O chat remontava ~0,5s depois de
 * aparecer, com a rolagem de volta ao topo. Se ela já está sendo aberta, não há
 * o que retomar.
 *
 * PURO e sem imports: roda no node cru.
 */
export function decidirRetomada(args: {
  jaDecidiu: boolean;
  conversas: readonly { id: string; temAuditoriaPendente?: boolean }[];
  aberta: string;
  abrindo?: string | null;
}): { decidiu: boolean; retomar: string | null } {
  if (args.jaDecidiu || args.conversas.length === 0) {
    return { decidiu: false, retomar: null };
  }
  const pendente = args.conversas.find((c) => c.temAuditoriaPendente);
  const jaEmCaminho =
    pendente !== undefined &&
    (pendente.id === args.aberta || pendente.id === args.abrindo);
  const retomar = pendente && !jaEmCaminho ? pendente.id : null;
  return { decidiu: true, retomar };
}
