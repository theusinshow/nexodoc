"use client";

/**
 * O QUE MUDOU no memorial desde a última auditoria — perguntado ao servidor,
 * que compara texto e não gasta modelo nenhum.
 *
 * Existe para a decisão que hoje é cega: reauditar um memorial que voltou com
 * um volume novo relê o documento inteiro (196 mil caracteres do 063-26 numa
 * chamada só, 258s medidos), e não havia como saber, antes de pagar, que 86%
 * daquilo já tinha sido lido.
 *
 * Um pedido por par (memorial × auditoria anterior). O arquivo é identificado
 * por nome+tamanho+data: dois PDFs diferentes com o mesmo nome — que é a regra
 * na revisão de memorial, não a exceção — precisam de comparações diferentes.
 */

import { useEffect, useState } from "react";

export interface DeltaDoMemorial {
  comparavel: boolean;
  /*
   * `outro-arquivo` entrou em 02/09/2026, quando o delta passou a usar a MESMA
   * busca de base que a auditoria (`acharPorNomeOuChave`). Antes ele caía no
   * primeiro arquivo da base e nunca recusava — anunciando economia que a
   * auditoria em seguida não entregava.
   */
  motivo?: "sem-banco" | "sem-auditoria-anterior" | "sem-impressao" | "outro-arquivo";
  base?: {
    auditId: string;
    arquivo: string;
    quando: string;
    /** A base saiu da BUSCA no projeto, não da conversa atual. */
    deOutraConversa?: boolean;
    /** Quem rodou a base — pode ser um colega do escritório. */
    autor?: string;
  };
  resumo?: string;
  fracaoJaLida?: number;
  paginas?: number;
  caracteres?: number;
  delta?: {
    iguais: number;
    alterados: number;
    novos: number;
    sumidos: number;
    titulosAlterados: string[];
    titulosNovos: string[];
    titulosSumidos: string[];
  };
}

export type EstadoDoDelta =
  | { estado: "ausente" }
  | { estado: "carregando" }
  | { estado: "pronto"; dados: DeltaDoMemorial };

export function useDeltaDoMemorial(
  memorial: File | null,
  auditIdAnterior: string | null,
  /**
   * O PROJETO, que abre a busca por conta própria.
   *
   * Sem ele o hook só compara quando a conversa atual já tem uma auditoria — e
   * era esse o limite: corrigir os erros e voltar numa conversa nova relia 100%
   * do memorial, sem dizer que havia base. Com o projeto, o servidor procura a
   * última auditoria DESTE documento no projeto, venha ela de onde vier.
   */
  projectId?: string | null,
): EstadoDoDelta {
  /*
   * O estado guardado é SÓ a resposta, carimbada com a chave que a produziu.
   * "carregando" e "ausente" são derivados dela — guardá-los obrigaria a chamar
   * `setState` dentro do corpo do efeito, que é render em cascata (e o lint do
   * React Compiler barra, com razão).
   */
  const [resposta, setResposta] = useState<{
    chave: string;
    dados: DeltaDoMemorial | null;
  } | null>(null);

  /*
   * BASTA UM DOS DOIS. Antes a chave exigia `auditIdAnterior`, e sem ele o hook
   * nem chegava a perguntar — que é exatamente o caso da conversa nova.
   */
  const chave =
    memorial && (auditIdAnterior || projectId)
      ? `${auditIdAnterior ?? ""}|${projectId ?? ""}|${memorial.name}|${memorial.size}|${memorial.lastModified}`
      : null;

  useEffect(() => {
    if (!chave || !memorial) return;
    let vivo = true;
    const form = new FormData();
    form.append("file", memorial, memorial.name);
    // O id da conversa tem PRECEDÊNCIA: quando ele existe, a base é a que o
    // engenheiro já viu nesta conversa, e não uma que a busca escolheu por ele.
    if (auditIdAnterior) form.append("auditIdAnterior", auditIdAnterior);
    if (projectId) form.append("projectId", projectId);
    fetch("/api/audit/delta", { method: "POST", body: form })
      .then((r) => (r.ok ? (r.json() as Promise<DeltaDoMemorial>) : null))
      .then((dados) => {
        /*
         * Falhar aqui não vira erro na tela: isto é um CONFORTO antes de
         * decidir, não um pré-requisito da auditoria. Sem resposta, o cartão
         * volta a ser o de sempre e a análise roda inteira, como sempre rodou.
         */
        if (vivo) setResposta({ chave, dados });
      })
      .catch(() => {
        if (vivo) setResposta({ chave, dados: null });
      });
    return () => {
      vivo = false;
    };
    // `memorial` entra pela `chave`: o objeto File é recriado a cada render do
    // dono, e depender dele refaria o pedido para sempre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  if (!chave) return { estado: "ausente" };
  if (resposta?.chave !== chave) return { estado: "carregando" };
  return resposta.dados
    ? { estado: "pronto", dados: resposta.dados }
    : { estado: "ausente" };
}
