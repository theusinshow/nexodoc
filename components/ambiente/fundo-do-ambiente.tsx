"use client";

/**
 * O campo como FUNDO DE TELA, para as páginas que são componentes de servidor.
 *
 * Duas coisas que este invólucro resolve e que não cabem na página:
 *
 *  · `next/dynamic` com `ssr: false` não é permitido em componente de servidor,
 *    e `ogl` precisa dele — o módulo toca `window` ao carregar;
 *  · o campo se posiciona em `absolute inset-0`, o que cobre o ANCESTRAL
 *    posicionado. Numa página cujo conteúdo rola, o ancestral é a caixa do
 *    conteúdo e o campo rolaria junto. Aqui ele fica preso à janela.
 *
 * `-z-10` o põe atrás do conteúdo e à frente do fundo da página. Não use isto em
 * tela que tenha orbe vivo: ver a regra em [[campo-neural]].
 */

import dynamic from "next/dynamic";

const CampoNeural = dynamic(
  () => import("./campo-neural").then((m) => m.CampoNeural),
  { ssr: false },
);

export function FundoDoAmbiente({ opacidade }: { opacidade?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <CampoNeural opacidade={opacidade} />
    </div>
  );
}
