"use client";

/**
 * O RELÓGIO DO CROMO — hora e data como UM texto só.
 *
 * Antes eram dois: a hora em 16px semibold clara e a data em 11px maiúscula
 * apagada, encostadas uma na outra. Duas tipografias e dois pesos para o mesmo
 * fato criam uma hierarquia que não existe — ninguém precisa da hora MAIS do que
 * do dia num cabeçalho, e o contraste entre as duas fazia o bloco brigar por
 * atenção com o nome da pessoa ao lado. Agora é uma linha, um peso, uma família,
 * uma cor: o relógio informa e não pede nada.
 *
 * O DÍGITO ROLA QUANDO MUDA, e só quando muda. É a versão defensável do "texto
 * passando": o §5 abre com "movimento significa mudança de estado, não
 * decoração", e um embaralhamento em laço seria exatamente decoração — cromo
 * inquieto para sempre, ao lado de um orbe cujo trabalho é ser a única coisa da
 * tela que se mexe para dizer algo. Aqui o movimento acontece uma vez por
 * minuto, no caractere que de fato virou, e é a mudança de estado em pessoa.
 *
 * O gate de movimento reduzido é em JS de propósito: a Web Animations API não
 * obedece à media query CSS, a mesma armadilha que o §5 documenta para
 * `startViewTransition`.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

import { DURATION, EASE, prefersReducedMotion } from "@/modules/nexo/lib/motion";

/** 20s: mostra hora e minuto, e errar o minuto por 20s ninguém vê. */
const PASSO = 20_000;

function assinar(avisar: () => void) {
  const i = setInterval(avisar, PASSO);
  return () => clearInterval(i);
}

/*
 * A leitura devolve a FATIA de 20s, e não o instante: `useSyncExternalStore`
 * re-renderiza enquanto o valor mudar, e `Date.now()` mudaria a cada chamada.
 */
const lerFatia = () => Math.floor(Date.now() / PASSO);

/** No servidor não há relógio: `null` reserva o espaço sem texto. */
const semRelogioNoServidor = () => null;

function formatar(fatia: number) {
  const agora = new Date(fatia * PASSO);
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const data = agora
    .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
    .replace(/\.$/, "");

  return `${hora} · ${data}`.toUpperCase();
}

export function RelogioDoTopo({ className }: { className?: string }) {
  const fatia = useSyncExternalStore(assinar, lerFatia, semRelogioNoServidor);

  /*
   * O texto do quadro anterior. Ref e não estado: ele existe só para descobrir
   * QUAIS caracteres mudaram, e guardá-lo em estado provocaria a re-renderização
   * que ele deveria apenas observar.
   */
  const anterior = useRef<string>("");
  const letras = useRef<(HTMLSpanElement | null)[]>([]);

  const texto = fatia === null ? "" : formatar(fatia);

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = texto;

    // A primeira pintura no cliente não rola: o relógio nasce, não muda.
    if (!antes || !texto || prefersReducedMotion()) return;

    texto.split("").forEach((c, i) => {
      if (c === antes[i]) return;
      /*
       * Só a ENTRADA é animada. O caractere que saiu já não está no DOM — o
       * React o substituiu — e tentar animá-lo exigiria manter uma segunda
       * camada por posição. O que o olho lê é o dígito novo subindo para o
       * lugar, que é o efeito inteiro.
       */
      letras.current[i]?.animate(
        [
          { transform: "translateY(0.85em)", opacity: 0 },
          { transform: "translateY(0)", opacity: 1 },
        ],
        { duration: DURATION.base, easing: EASE.entrance },
      );
    });
  }, [texto]);

  return (
    <span
      className={className}
      // `role="timer"` sem `aria-live`: a hora está na tela para ser lida quando
      // se quer, não para ser anunciada a cada minuto por cima do trabalho.
      role="timer"
      aria-label={fatia === null ? undefined : texto}
    >
      <span
        aria-hidden
        className="inline-flex items-center font-mono text-xs font-medium tracking-[0.1em] text-muted-foreground tabular-nums"
      >
        {/* Sem hora ainda (servidor / primeira pintura): o mesmo número de
            caracteres, invisíveis, para o cabeçalho não pular na hidratação. */}
        {(texto || "00:00 · SEG, 00 DE XXX").split("").map((c, i) => (
          <span
            key={i}
            ref={(el) => {
              letras.current[i] = el;
            }}
            /*
              O SEPARADOR RECUA. Ele não é hora nem data — é a costura entre as
              duas — e, no mesmo tom dos dígitos, lia como mais um caractere da
              leitura. Isto NÃO reabre a hierarquia que o cabeçalho deste arquivo
              rejeita: hora e data continuam no mesmo peso, na mesma família e na
              mesma cor. Quem apaga é a pontuação entre elas.
            */
            className={
              c === "·"
                ? "inline-block overflow-hidden px-[1px] opacity-55"
                : "inline-block overflow-hidden"
            }
            style={{ opacity: texto ? undefined : 0 }}
          >
            {c === " " ? " " : c}
          </span>
        ))}
      </span>
    </span>
  );
}
