/**
 * A QUE PROJETO esta auditoria pertence.
 *
 * O centro de custo já é extraído dos documentos — [[cross-document-audit.ts]]
 * lê o código do projeto e a prefeitura para confrontar identidade ENTRE
 * arquivos. O que nunca foi feito com esse dado é decidir o ENDEREÇO da
 * auditoria: a que projeto do escritório ela se refere.
 *
 * TRÊS DESFECHOS, e o do meio é o que dá o desenho:
 *
 *  · `achado` — segue sem perguntar nada;
 *  · `desconhecido` — PARA. Não escolhe o mais parecido, não cria projeto;
 *  · `sem-codigo` — o documento não trouxe código legível; quem escolhe é gente.
 *
 * Anexar ao centro de custo errado contamina a fila de achados de outro
 * projeto, e o erro só aparece quando alguém recebe uma pendência que não é
 * dele — dias depois, sem nada que ligue uma coisa à outra. Por isso a
 * proximidade não vale: `099-26` não vira `099-25` por ser parecido.
 *
 * Puro: nenhum IO. Quem busca os projetos do escritório é quem chama.
 */
export type ProjetoConhecido = { id: string; code: string; client: string };

export type ResolucaoDeProjeto =
  | { tipo: "achado"; projeto: ProjetoConhecido }
  | { tipo: "desconhecido"; codigo: string }
  | { tipo: "sem-codigo" };

/**
 * "099/25", "099.25" e "CC 099-25" são o mesmo centro de custo escrito por três
 * pessoas diferentes. O separador varia entre carimbo, capa e memorial; o par
 * número-ano, não.
 *
 * O prefixo "CC" só cai quando é palavra inteira (`\bCC\b`): um código que
 * comece com essas letras — "CCB-12" — seria mutilado por uma regra mais frouxa,
 * e passaria a casar com o projeto errado.
 */
export function normalizarCentroDeCusto(valor: string): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/\bCC\b[\s:._-]*/g, "")
    .replace(/[./]/g, "-")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, "")
    .trim();
}

export function resolverProjeto(args: {
  codigoExtraido?: string;
  projetos: ProjetoConhecido[];
}): ResolucaoDeProjeto {
  const codigo = normalizarCentroDeCusto(args.codigoExtraido ?? "");

  if (!codigo) {
    return { tipo: "sem-codigo" };
  }

  /*
   * O código do PROJETO também passa pela normalização: quem cadastrou "099/25"
   * pela tela não deve deixar de casar com o "099-25" lido do documento. Comparar
   * o normalizado de um lado com o cru do outro seria exigir que duas pessoas
   * diferentes tivessem digitado igual.
   */
  const projeto = args.projetos.find(
    (p) => normalizarCentroDeCusto(p.code) === codigo,
  );

  return projeto ? { tipo: "achado", projeto } : { tipo: "desconhecido", codigo };
}
