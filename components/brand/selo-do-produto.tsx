"use client";

/**
 * O PRODUTO CARIMBA A SI MESMO.
 *
 * Este software existe para conferir carimbo de prancha; a porta de entrada
 * dele traz o seu. Não é ornamento: são os dados reais da instância — versão do
 * build e a data —, escritos no mesmo formato que o produto imprime.
 *
 * A DATA É LIDA DEPOIS DE MONTAR, e nunca no render. O servidor desenha esta
 * página antes do navegador e o fuso dele pode ser outro: "28/08" no HTML e
 * "29/08" na hidratação é erro de hidratação, dos que derrubam a árvore. É a
 * mesma razão pela qual a saudação do Nexo nasce vazia — e a solução é a mesma,
 * de propósito, para não haver dois jeitos de tratar o mesmo problema.
 *
 * ELE NÃO COMPETE COM O ORBE. Mono pequeno, cor apagada, no canto: o painel é
 * do orbe vivo (um por tela, §6), e um segundo objeto disputando o centro
 * quebraria a escada de reduções que a marca inteira sustenta.
 */

import { useEffect, useState } from "react";

export function SeloDoProduto({ versao }: { versao: string }) {
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const agora = new Date();
      setData(
        `${String(agora.getDate()).padStart(2, "0")}/${String(agora.getMonth() + 1).padStart(2, "0")}/${agora.getFullYear()}`,
      );
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-selo-do-produto
      aria-hidden
      className="nx-cut-6 pointer-events-none select-none border border-border/60 px-3 py-2 font-mono text-[10px] uppercase leading-[1.7] tracking-[0.09em] text-muted-foreground"
    >
      <p className="text-foreground/70">Nexo · plataforma documental</p>
      <p>
        rev {versao} · folha 1/1
        {/*
          A LARGURA É RESERVADA em CSS, e não com espaços.

          A primeira versão punha dez espaços no lugar da data — e HTML colapsa
          espaço, então a reserva não reservava nada: o carimbo nascia estreito
          e pulava de largura no quadro seguinte à hidratação. `inline-block`
          com largura mínima guarda o lugar de verdade.
        */}
        <span className="ml-2 inline-block min-w-[5.5rem]">{data ?? ""}</span>
      </p>
    </div>
  );
}
