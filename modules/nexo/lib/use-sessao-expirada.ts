"use client";

import { useEffect, useState } from "react";

import { EVENTO_SESSAO_EXPIRADA, inicioDaInatividade } from "./sessao";

/**
 * Escuta o sino da sessão expirada e devolve há quanto tempo a aba estava
 * parada. O tempo importa: "você ficou 8 horas sem atividade" explica o que
 * aconteceu; "sua sessão expirou" soa como defeito do software.
 */
export function useSessaoExpirada(): { expirada: boolean; desdeMs: number } {
  const [expirada, setExpirada] = useState(false);
  const [desdeMs, setDesdeMs] = useState(0);

  useEffect(() => {
    const aoExpirar = () => {
      setDesdeMs(Date.now() - inicioDaInatividade());
      setExpirada(true);
    };
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
    return () => window.removeEventListener(EVENTO_SESSAO_EXPIRADA, aoExpirar);
  }, []);

  return { expirada, desdeMs };
}

/** "8 horas", "40 minutos". Para a frase que explica o porquê. */
export function duracaoLegivel(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 60) {
    // O plural concorda com o número EXIBIDO, não com o medido: abaixo de um
    // minuto mostramos "1 minuto", e "1 minutos" denuncia a régua por trás.
    const exibido = Math.max(1, min);
    return `${exibido} ${exibido === 1 ? "minuto" : "minutos"}`;
  }
  const horas = Math.round(min / 60);
  return `${horas} ${horas === 1 ? "hora" : "horas"}`;
}
