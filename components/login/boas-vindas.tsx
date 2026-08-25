"use client";

/**
 * A APRESENTAÇÃO — o orbe e a frase que ele está dizendo.
 *
 * Os dois moram no mesmo componente porque são UMA coisa, e separá-los produzia
 * a versão errada disto: um orbe girando de um lado e um texto se animando do
 * outro, cada um no próprio ritmo, dois efeitos ao lado do outro.
 *
 * Aqui o texto é SAÍDA DO AGENTE. Enquanto a frase se decifra o orbe está em
 * `responding` com `activity` acompanhando o progresso — que é exatamente o que
 * `paramsForState` faz com esse estado no resto do produto (a distorção e o
 * pulso sobem com a cadência do texto que chega). Quando a frase assenta, ele
 * volta a `idle`. É o mesmo vocabulário que o copiloto usa quando o Nexo
 * responde de verdade; a tela de entrada só o está usando primeiro.
 *
 * E a conversa é de mão dupla: passar o ponteiro sobre a frase pede que ela seja
 * dita de novo, e o orbe responde junto. Não é um botão e não precisa ser — a
 * frase está inteira e legível o tempo todo, então quem nunca passar o mouse não
 * perde nada. Ver [[components/ambiente/texto-decifrado]].
 */

import { useCallback, useState } from "react";

import { TextoDecifrado } from "@/components/ambiente/texto-decifrado";
import { AgentOrb } from "@/modules/nexo/components/agent-orb";
import type { AgentState } from "@/modules/nexo/components/agent-orb";

const SAUDACAO = "Boas-vindas ao Nexo";

export function BoasVindas() {
  const [atividade, setAtividade] = useState(0);
  const [estado, setEstado] = useState<AgentState>("idle");

  const aoProgredir = useCallback((p: number) => {
    setAtividade(p);
    /* `responding` enquanto sai texto, `idle` quando termina. Nada de estado
       inventado para "está se apresentando": a máquina do agente tem nove
       estados e todos significam alguma coisa; um décimo só para esta tela
       seria vocabulário que o resto do produto não fala. */
    setEstado(p >= 1 ? "idle" : "responding");
  }, []);

  return (
    <div className="login-apresentacao">
      <AgentOrb
        size="hero"
        state={estado}
        activity={atividade}
        interactive={false}
      />

      <div className="login-saudacao">
        <p className="login-saudacao-titulo">
          <TextoDecifrado texto={SAUDACAO} onProgresso={aoProgredir} />
        </p>
        <p className="login-saudacao-copy">
          O agente está acordado, esperando o primeiro documento.
        </p>
      </div>
    </div>
  );
}
