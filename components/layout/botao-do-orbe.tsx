"use client";

/**
 * O BOTÃO DO ORBE — a porta entre o painel e a conversa, no centro do cromo.
 *
 * É um só controle com dois sentidos: no painel ele leva ao Nexo, no Nexo ele
 * traz de volta ao painel. Por isso o destino não é prop — vem de `usePathname`.
 * Um botão que muda de destino conforme onde você está só é honesto se ele
 * mesmo souber onde está; passar isso de fora criaria dois lugares para errar.
 *
 * QUAL ORBE MORA AQUI, e por que não o vivo. A escada de reduções (DESIGN.md §6)
 * tem quatro degraus, e a lei ao lado dela é "um orbe vivo por tela, nunca
 * duas". O vivo é o do palco do Nexo. Se ele viesse para cá — que é cromo
 * PERSISTENTE, presente em toda rota — o produto montaria um canvas WebGL em
 * cada página e teria dois orbes vivos na tela do Nexo. Além disso o shader foi
 * calibrado com recuo de câmera para 223–308px: a 60px ele não é o objeto, é uma
 * mancha dele.
 *
 * O degrau certo é o CAPTURADO — `MarcaViva`, o quadro do orbe vivo que volta a
 * se mexer no hover por uma tira de 18 quadros, sem WebGL. E a emenda de
 * 16/08/2026 do §6 é o que autoriza isso ao lado do orbe vivo: a regra proíbe
 * movimento AUTÔNOMO, não reação a ponteiro — "o hover acontece onde a pessoa já
 * está olhando, porque foi ela que apontou".
 *
 * O VIDRO É LEGAL AQUI, mas cobrou uma emenda. A linha d'água (§4) permite vidro
 * só no cromo, e o cromo é lista fechada. O cabeçalho não estava nela; entrou
 * pela emenda de 25/08/2026, registrada no DESIGN.md junto desta mudança. Nada
 * de dado é borrado: o que este vidro cobre é o fundo da página, não conteúdo.
 *
 * A REAÇÃO AO PONTEIRO NÃO É `.nx-ima`, de propósito. O ímã é restrito a dois
 * CTAs no produto inteiro, e a restrição É o efeito — um terceiro consumidor
 * começaria a diluí-lo. Aqui o deslocamento é do próprio botão e anda junto com
 * uma escala, que o ímã não faz. Mesma mecânica (posição do cursor dentro do
 * controle → variáveis no `style`, sem passar pelo React), papel diferente.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { cn } from "@/lib/utils";

/** Quanto o botão se desloca na direção do ponteiro, em pixels. */
const ALCANCE = 3;

export function BotaoDoOrbe({
  /** Lado da caixa de vidro. O símbolo dentro acompanha. */
  tamanho = 60,
  className,
}: {
  tamanho?: number;
  className?: string;
}) {
  const caixa = useRef<HTMLAnchorElement | null>(null);
  const pendente = useRef<number | null>(null);

  /*
   * `startsWith` e não igualdade: `/nexo?auditoria=…` continua sendo o Nexo, e
   * quem chega por link de e-mail precisa da mesma porta de volta que os outros.
   */
  const noNexo = (usePathname() ?? "/").startsWith("/nexo");
  const destino = noNexo ? "/" : "/nexo";
  const rotulo = noNexo ? "Voltar ao painel" : "Falar com o Nexo";

  useEffect(
    () => () => {
      if (pendente.current !== null) cancelAnimationFrame(pendente.current);
    },
    [],
  );

  const mover = useCallback((ev: ReactPointerEvent<HTMLAnchorElement>) => {
    const alvo = ev.currentTarget;
    const { clientX, clientY } = ev;
    if (pendente.current !== null) return;
    pendente.current = requestAnimationFrame(() => {
      pendente.current = null;
      if (!alvo.isConnected) return;
      const r = alvo.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      // -1..1 a partir do centro, e daí para pixels.
      const dx = ((clientX - r.left) / r.width - 0.5) * 2;
      const dy = ((clientY - r.top) / r.height - 0.5) * 2;
      alvo.style.setProperty("--orbe-x", `${(dx * ALCANCE).toFixed(2)}px`);
      alvo.style.setProperty("--orbe-y", `${(dy * ALCANCE).toFixed(2)}px`);
    });
  }, []);

  const soltar = useCallback(() => {
    const alvo = caixa.current;
    if (!alvo) return;
    alvo.style.setProperty("--orbe-x", "0px");
    alvo.style.setProperty("--orbe-y", "0px");
  }, []);

  return (
    <Link
      ref={caixa}
      href={destino}
      aria-label={rotulo}
      title={rotulo}
      onPointerMove={mover}
      onPointerLeave={soltar}
      className={cn(
        /*
         * `.nexo-glass` é a fonte única do vidro (§4): tint, backdrop-filter e o
         * fio de luz, com as degradações para sem-suporte e
         * `prefers-reduced-transparency` já dentro dela. Aqui só se troca a
         * forma — redondo em vez do chanfro, porque o objeto lá dentro é uma
         * esfera e chanfrar a caixa de uma esfera briga com o que ela é.
         */
        "nexo-glass group relative grid shrink-0 place-items-center rounded-full",
        "transition-[transform,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-feedback)]",
        "hover:scale-[1.09] active:scale-[1.03]",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25",
        className,
      )}
      style={{
        width: tamanho,
        height: tamanho,
        /*
         * O deslocamento entra por `translate` e a ampliação por `scale`, as
         * duas propriedades independentes do `transform` — assim o hover do
         * Tailwind pode mexer só na escala sem apagar o que o ponteiro escreveu.
         */
        translate: "var(--orbe-x, 0px) var(--orbe-y, 0px)",
      }}
    >
      {/*
        O HALO. Fica atrás do vidro e só acende no hover: em repouso o botão é
        cromo discreto, e quem chega ganha a confirmação de que ali há um agente.
        `--motion-gain` multiplica porque isto é ambiente, não sinal — em
        movimento reduzido ele some e o botão continua dizendo tudo o que dizia.
      */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-3 rounded-full opacity-0 transition-opacity duration-[var(--duration-base)] group-hover:opacity-[calc(1*var(--motion-gain))]"
        style={{
          background: "radial-gradient(circle, rgb(0 166 147 / 0.34), transparent 70%)",
          filter: "blur(10px)",
        }}
      />
      <MarcaViva size={Math.round(tamanho * 0.8)} className="relative" />
    </Link>
  );
}
