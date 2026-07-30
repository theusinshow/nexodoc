"use client";

/**
 * A conexão com a rede, como estado observável.
 *
 * O Nexo é usado em escritório de engenharia com Wi-Fi que cai — e o turno do
 * agente leva minutos. Sem esta camada, perder a rede no meio produzia um erro
 * genérico ("falha ao enviar") que não diz o que o engenheiro tem em risco. E o
 * que ele tem em risco é NADA: a conversa está no IndexedDB deste navegador.
 *
 * Por isso o vocabulário é ÂMBAR e não coral (matriz do lote 9): é reversível,
 * nada se perdeu, e a primeira frase diz exatamente isso.
 */

import { useEffect, useState } from "react";

export function useConexao(): { online: boolean } {
  /*
   * Começa OTIMISTA (`true`), não com `navigator.onLine`: no primeiro render do
   * servidor não existe `navigator`, e assumir offline faria a faixa piscar em
   * toda carga de página. O valor real chega no efeito, no cliente.
   */
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sincronizar = () => setOnline(navigator.onLine);
    sincronizar();
    window.addEventListener("online", sincronizar);
    window.addEventListener("offline", sincronizar);
    return () => {
      window.removeEventListener("online", sincronizar);
      window.removeEventListener("offline", sincronizar);
    };
  }, []);

  return { online };
}
