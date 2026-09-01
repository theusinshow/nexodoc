"use client";

/**
 * ABRIR UMA AUDITORIA POR LINK — `/nexo?auditoria=<id>`.
 *
 * É o que a home promete quando alguém clica em ABRIR numa pendência. Sem isto,
 * o link levava ao Nexo genérico e a pessoa tinha que procurar sozinha a
 * auditoria em que os achados dela estavam.
 *
 * POR QUE NÃO BASTA PROCURAR NO INDEXEDDB
 *
 * As conversas moram no navegador de quem as criou. O Milton, recebendo achados
 * do Victor, NÃO tem a conversa do Victor na máquina dele — e é justamente esse
 * o caso que a fila existe para atender. Então o parecer vem do servidor, pelo
 * mesmo caminho que a reconexão já usa (`consultarAuditoria`), e vira artefato
 * numa conversa nova.
 *
 * O parecer entra na conversa ATUAL — que, para quem chega por link, é uma
 * conversa nova recém-criada pelo store. Tentar criar outra antes de salvar
 * introduzia uma corrida: a troca de conversa é estado, e a gravação seguinte
 * ainda via o id antigo.
 *
 * Se a auditoria já estiver aberta, não faz nada — recarregar a página não deve
 * duplicar o artefato nem trocar de conversa por baixo de quem estava lendo.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { lerLinkDoAchado } from "@/lib/link-do-achado";

import { consultarAuditoria } from "../lib/audit";
import { useConversation } from "../state/conversation-store";

export type AberturaPorLink = {
  /** Enquanto busca o parecer no servidor. */
  carregando: boolean;
  /** Por que não deu. */
  falha: string | null;
  /** O parecer está aqui e pode ser mostrado. */
  abriu: boolean;
  /** O achado que o link pediu, ou nulo. */
  achadoEmFoco: string | null;
};

export function useAbrirAuditoriaPorLink(params: {
  auditoria: string | null;
  achado: string | null;
}): AberturaPorLink {
  /*
   * OS DOIS PARÂMETROS, lidos pela MESMA regra que monta o link no e-mail
   * ([[lib/link-do-achado.ts]]). Achado sem auditoria é descartado: focar um
   * achado exige saber de qual parecer ele é.
   */
  const { auditId, findingId } = lerLinkDoAchado(params);
  const { getResult, saveResult } = useConversation();

  /*
   * O DESFECHO da tentativa, e não o "carregando".
   *
   * `carregando` é DERIVADO na renderização — há um id para abrir, e ainda não
   * houve desfecho. Marcá-lo dentro do efeito seria escrever estado de forma
   * síncrona ali, que é o que `react-hooks/set-state-in-effect` proíbe, e com
   * razão: a renderização já tem a informação, e duplicá-la num estado abre a
   * porta para os dois discordarem.
   */
  const [desfecho, setDesfecho] = useState<{ id: string; falha: string | null } | null>(null);

  /*
   * Uma tentativa por id. O efeito depende de funções do store que mudam de
   * identidade quando a conversa muda — e a própria abertura muda a conversa.
   * Sem esta trava, salvar o artefato dispararia o efeito de novo, que salvaria
   * de novo.
   */
  const jaTentou = useRef<string | null>(null);

  const abrir = useCallback(
    async (id: string) => {
      try {
        const resposta = await consultarAuditoria(id);

        if (resposta.situacao === "rodando") {
          setDesfecho({
            id,
            falha: "Esta auditoria ainda está rodando. Tente de novo em alguns minutos.",
          });
          return;
        }

        if (resposta.situacao !== "pronta") {
          setDesfecho({ id, falha: resposta.motivo });
          return;
        }

        const parecer = resposta.resultado;

        /*
         * SALVA NA CONVERSA ATUAL, e não numa nova.
         *
         * A primeira versão chamava `newConversation()` antes — e o parecer
         * sumia. `newConversation` troca o id por ESTADO, e o `saveResult` logo
         * em seguida ainda enxergava o id antigo: o artefato ia para a conversa
         * anterior e a nova nascia vazia. A tela ficava no Nexo genérico, com
         * uma conversa a mais na barra a cada clique no link.
         *
         * Quem chega por link chega numa conversa nova de qualquer forma — o
         * store começa uma ao montar. Grafar aqui é o caminho sem corrida.
         */
        await saveResult({
          artifactId: `auditoria:${id}`,
          kind: "auditoria",
          summary: `Auditoria — ${parecer.report.status_geral}`,
          files: [],
          payload: parecer,
          canvas: {
            label: "Auditoria",
            detail: `${parecer.report.status_geral} · ${parecer.report.total_incongruencias} achado(s)`,
          },
        });

        setDesfecho({ id, falha: null });
      } catch {
        setDesfecho({ id, falha: "Não deu para abrir esta auditoria." });
      }
    },
    [saveResult],
  );

  const jaEstaAberta = Boolean(auditId) && Boolean(getResult(`auditoria:${auditId}`));

  useEffect(() => {
    if (!auditId || jaTentou.current === auditId || jaEstaAberta) {
      if (auditId && jaEstaAberta) jaTentou.current = auditId;
      return;
    }

    jaTentou.current = auditId;
    void abrir(auditId);
  }, [auditId, abrir, jaEstaAberta]);

  return {
    carregando: Boolean(auditId) && !jaEstaAberta && desfecho?.id !== auditId,
    falha: desfecho?.id === auditId ? desfecho.falha : null,
    /*
     * `abriu` existe porque salvar o parecer não basta: a tela de boas-vindas
     * do Nexo só sai quando alguém "começa", e quem chega por link nunca
     * digitou nada. Sem este sinal, o artefato ficava gravado na conversa e a
     * pessoa continuava olhando o "Boa noite".
     */
    abriu: jaEstaAberta || (desfecho?.id === auditId && desfecho.falha === null),
    /*
     * O ACHADO A FOCAR. Só faz sentido depois de o parecer abrir, e por isso
     * acompanha `abriu` na mesma resposta — mandá-lo antes faria a tela procurar
     * um cartão que ainda não existe.
     */
    achadoEmFoco: findingId,
  };
}
