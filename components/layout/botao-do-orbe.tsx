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
 *
 * O PRESSIONAR CRESCE, e antes ele encolhia (26/08/2026). Encolher no `:active`
 * é o idioma de BOTÃO — a tecla que afunda. Este controle não é uma tecla: é a
 * presença do agente, e o que ele promete ao ser tocado é que a conversa vai
 * ABRIR. Crescer sob o dedo é a mesma frase do gesto que vem depois, e o alcance
 * do ponteiro continua ativo por baixo — as duas coisas moram em propriedades
 * diferentes (`scale` e `translate`), então uma nunca apaga a outra.
 *
 * TUDO AQUI ESCALA COM `tamanho`. O botão nasceu com 60px e hoje o painel o
 * pede com 128; um deslocamento fixo de 3px, que era nítido no pequeno, some no
 * grande, e um halo de `-inset-3` vira um fio colado na borda. Alcance, halo e
 * desfoque saem do lado da caixa em vez de constantes — assim o mesmo componente
 * atende os dois tamanhos sem que ninguém precise reafinar à mão.
 */

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

import { MarcaViva } from "@/components/brand/marca-viva";
import { cn } from "@/lib/utils";
import { DURATION, prefersReducedMotion } from "@/modules/nexo/lib/motion";

/**
 * Quanto o botão se desloca na direção do ponteiro, em pixels.
 *
 * Proporcional ao lado, com piso: 5,5% dá 3px nos 60px de origem e 7px nos 128
 * do painel — o mesmo GESTO nos dois, e não o mesmo número.
 */
const alcanceDe = (tamanho: number) => Math.max(3, Math.round(tamanho * 0.055));

/**
 * Quanto dura a PARTIDA — o painel saindo de cena.
 *
 * Era `--duration-shell` a 75% (240ms), enquanto a saída ainda GATILHAVA a
 * navegação e precisava caber a viagem inteira. Desde que os dois passaram a
 * correr juntos, esta duração é só o que o olho vê, e 240ms viraram lentidão
 * gratuita no caminho de quem só quer chegar. `--duration-base` é a revelação
 * de conteúdo da §5, que é exatamente o que isto é.
 */
const PARTIDA = DURATION.base;

export function BotaoDoOrbe({
  /** Lado da caixa de vidro. O símbolo dentro acompanha. */
  tamanho = 60,
  className,
  /**
   * Avisa a PÁGINA que a partida começou, para ela sair de cena junto.
   *
   * Sem isto o botão só sabe crescer sozinho no meio de uma tela intacta, que
   * é o oposto do que a transição quer dizer. Quem apaga o trabalho é quem o
   * desenhou — este componente não conhece o painel e não deveria conhecer.
   *
   * A AUSÊNCIA DESLIGA A COREOGRAFIA, de propósito: onde ninguém passa o
   * `aoPartir` o botão volta a ser um `<Link>` comum, e navegar continua
   * funcionando. É o mesmo motivo de a checagem de movimento reduzido não
   * cair para "sem animação, sem navegação".
   */
  aoPartir,
}: {
  tamanho?: number;
  className?: string;
  aoPartir?: () => void;
}) {
  const caixa = useRef<HTMLAnchorElement | null>(null);
  const pendente = useRef<number | null>(null);
  const router = useRouter();
  const [partindo, setPartindo] = useState(false);

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

  const mover = useCallback(
    (ev: ReactPointerEvent<HTMLAnchorElement>) => {
      const alvo = ev.currentTarget;
      const { clientX, clientY } = ev;
      // Partiu: o orbe deixa de seguir o ponteiro. Durante a saída ele não é
      // mais um controle sob a mão, é a única coisa que ficou na tela.
      if (partindo) return;
      if (pendente.current !== null) return;
      pendente.current = requestAnimationFrame(() => {
        pendente.current = null;
        if (!alvo.isConnected) return;
        const r = alvo.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        /*
         * -1..1 a partir do centro, e daí para pixels. A conta é sobre a caixa
         * MEDIDA, e por isso continua honesta enquanto o `:active` a infla: o
         * `scale` é uniforme, então o centro visual continua caindo em 0,5 e o
         * orbe não salta no instante do clique.
         */
        const dx = ((clientX - r.left) / r.width - 0.5) * 2;
        const dy = ((clientY - r.top) / r.height - 0.5) * 2;
        const alcance = alcanceDe(tamanho);
        alvo.style.setProperty("--orbe-x", `${(dx * alcance).toFixed(2)}px`);
        alvo.style.setProperty("--orbe-y", `${(dy * alcance).toFixed(2)}px`);
      });
    },
    [partindo, tamanho],
  );

  const soltar = useCallback(() => {
    const alvo = caixa.current;
    if (!alvo) return;
    alvo.style.setProperty("--orbe-x", "0px");
    alvo.style.setProperty("--orbe-y", "0px");
  }, []);

  /**
   * A PARTIDA — a única coisa deste arquivo que não é sobre o botão em si.
   *
   * O clique deixa de ser uma navegação instantânea e passa a ser uma SAÍDA: a
   * página se apaga e o orbe cresce, aceso, sozinho no escuro.
   *
   * A NAVEGAÇÃO COMEÇA NO MESMO INSTANTE, e a primeira versão disto errava
   * exatamente aqui. Ela pedia a rota num `setTimeout(240)`, para que a saída
   * nunca fosse cortada — e o resultado foi o oposto do pretendido: 240ms de
   * espera em que NADA era buscado, e só depois o Nexo começava a montar
   * three.js, a barra lateral e o histórico. Os dois tempos ficavam em fila, e
   * o que se sentia era a tela travar depois da animação.
   *
   * Agora eles correm juntos. `startTransition` é o que torna isso possível: a
   * navegação vira atualização não urgente, então o React mantém o painel na
   * tela — ainda animando — enquanto prepara o Nexo, e troca quando estiver
   * pronto. O custo aceito é que numa rota já quente a saída pode ser cortada
   * pela metade; e isso é BOM, porque quem clica quer chegar, não assistir. O
   * corte fica invisível porque a chegada entra em fade (`.nexo-shell`).
   *
   * QUATRO SAÍDAS SEM COREOGRAFIA, e as quatro devolvem o `<Link>` intacto:
   * modificador de teclado ou botão que não é o principal (abrir em nova aba
   * tem de continuar abrindo em nova aba), voltar do Nexo para o painel (a
   * partida é a ida, não a volta), movimento reduzido, e página que não passou
   * `aoPartir`.
   */
  function partir(ev: ReactMouseEvent<HTMLAnchorElement>) {
    if (ev.defaultPrevented || ev.button !== 0) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    if (!aoPartir || noNexo || prefersReducedMotion()) return;

    ev.preventDefault();
    if (partindo) return;

    /*
     * A encenação é URGENTE e a viagem não. Nesta ordem: o painel tem de
     * começar a se apagar no primeiro quadro depois do clique — é o que
     * responde à mão —, e a rota pode levar o tempo que precisar por baixo.
     */
    setPartindo(true);
    soltar();
    aoPartir();
    startTransition(() => router.push(destino));
  }

  return (
    <Link
      ref={caixa}
      href={destino}
      aria-label={rotulo}
      title={rotulo}
      onClick={partir}
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
        "transition-[scale,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-feedback)]",
        /*
         * O PRESSIONAR É MAIOR QUE O HOVER, e é essa ordem que carrega o
         * sentido: aproximar acende, tocar abre. `scale` e não `transform`
         * porque o `translate` do ponteiro mora na propriedade vizinha e as
         * duas precisam conviver.
         */
        "hover:scale-[1.06] active:scale-[1.17]",
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
        /*
         * A PARTIDA VENCE O HOVER porque é `style`, e `style` ganha de classe.
         * Sem isso, tirar o ponteiro do botão no meio da saída faria a esfera
         * encolher de volta a caminho do Nexo. Fora da partida o campo é
         * `undefined` e quem manda voltam a ser as classes.
         */
        ...(partindo
          ? {
              scale: "1.45",
              transition: `scale ${PARTIDA}ms var(--ease-entrance)`,
              /*
               * O VIDRO DESLIGA JUNTO. `.nexo-glass` traz `backdrop-filter`, e
               * um desfoque de fundo dentro de um elemento que ESTÁ ESCALANDO é
               * o pior caso do compositor: a cada quadro ele reamostra o que
               * está atrás, numa área que cresce 45%. E não custa nada abrir
               * mão dele aqui — atrás do orbe, nesse instante, só existe o véu,
               * que é uma cor sólida. Borrar cor sólida devolve a mesma cor.
               */
              backdropFilter: "none",
              WebkitBackdropFilter: "none",
            }
          : null),
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
        className={cn(
          "pointer-events-none absolute rounded-full opacity-0",
          "transition-opacity duration-[var(--duration-base)]",
          "group-hover:opacity-[calc(0.85*var(--motion-gain))]",
          // Tocar acende o halo por inteiro: o crescimento não vem sozinho.
          "group-active:opacity-[calc(1*var(--motion-gain))]",
        )}
        style={{
          inset: -Math.round(tamanho * 0.16),
          background: "radial-gradient(circle, rgb(0 166 147 / 0.34), transparent 70%)",
          filter: `blur(${Math.max(10, Math.round(tamanho * 0.13))}px)`,
          /*
             NA PARTIDA O HALO FICA ACESO, e sem `--motion-gain`. Ele deixa de
             ser ambiente no instante em que a tela se apaga: passa a ser a
             única coisa que diz "o Nexo está vindo" durante os 240ms em que não
             há mais nada para olhar. Ambiente é o que se pode desligar sem
             perder informação, e aqui já não é o caso. O gate de movimento
             reduzido continua valendo — em `partir()`, antes de tudo: quem pede
             menos movimento não chega a ver esta saída.
          */
          ...(partindo
            ? { opacity: 1, transition: `opacity ${PARTIDA}ms var(--ease-entrance)` }
            : null),
        }}
      />
      <MarcaViva size={Math.round(tamanho * 0.8)} className="relative" />
    </Link>
  );
}
