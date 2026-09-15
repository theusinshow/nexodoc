"use client";

/**
 * A FAIXA DA ABA TRAVADA — as duas origens, e a recarga que não apaga calada.
 *
 * Decidido em 15/09/2026 (jornada c3): a aba desatualizada é recusada, avisa e
 * oferece recarregar, sem sobrescrever. Bloqueio, não notícia: sem `aoFechar`.
 *
 * Depois da segunda rodada, a trava ganhou duas origens (`lib/aba-travada.ts`).
 * Na PROVADA (outra aba ou máquina gravou), a frase é a de sempre e recarregar
 * vai direto: o servidor tem o trabalho de lá. Na SEM CONFERIR (409 com a base
 * aberta do disco sem conferir), a frase diz só o que se sabe, e "Recarregar do
 * servidor" confere antes as duas versões: se o disco desta máquina tem outra,
 * pede confirmação — "Continuar travada" deixa tudo como está. Nunca troca o
 * disco pela cópia do servidor sem a pessoa ter visto o que perde.
 *
 * A frase provada não diz "nada foi gravado" de propósito: na recusa do
 * servidor a gravação desta aba chega a passar pelo disco, mas a cópia do
 * servidor desce por cima dela (revisão, 15/09/2026) — ali, isso mentia.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { FaixaDeEstado } from "./FaixaDeEstado";
import { recargaPedeConfirmacao, textoDaFaixa } from "../lib/aba-travada";
import { useConversation } from "../state/conversation-store";

export function FaixaDaAbaTravada({
  aoRecarregar,
}: {
  /** Reabre a conversa pelo caminho do histórico (`selectConv`). */
  aoRecarregar: () => void | Promise<void>;
}) {
  const { origemDaTrava, compararComServidor, conversationId } =
    useConversation();
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [conferindo, setConferindo] = useState(false);
  if (!origemDaTrava) return null;
  const texto = textoDaFaixa(origemDaTrava);
  // A confirmação vale para a conversa em que foi pedida.
  const pedindoConfirmacao = confirmando === conversationId;

  async function recarregar() {
    if (origemDaTrava === "outra-aba") {
      void aoRecarregar();
      return;
    }
    setConferindo(true);
    try {
      const versoes = await compararComServidor();
      if (recargaPedeConfirmacao({ origem: "sem-conferir", ...versoes })) {
        setConfirmando(conversationId);
        return;
      }
    } finally {
      setConferindo(false);
    }
    void aoRecarregar();
  }

  if (pedindoConfirmacao) {
    return (
      <FaixaDeEstado
        tipo="documento"
        titulo={texto.titulo}
        acao={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setConfirmando(null);
                void aoRecarregar();
              }}
            >
              {texto.botaoConfirmar}
            </Button>
            <Button size="sm" onClick={() => setConfirmando(null)}>
              {texto.botaoCancelar}
            </Button>
          </div>
        }
      >
        {texto.confirmacao}
      </FaixaDeEstado>
    );
  }

  return (
    <FaixaDeEstado
      tipo="documento"
      titulo={texto.titulo}
      acao={
        <Button
          size="sm"
          variant="outline"
          loading={conferindo}
          onClick={() => void recarregar()}
        >
          {texto.botao}
        </Button>
      }
    >
      {texto.corpo}
    </FaixaDeEstado>
  );
}
