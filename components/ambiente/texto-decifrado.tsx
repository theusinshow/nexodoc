"use client";

/**
 * TEXTO DECIFRADO — a frase que chega embaralhada e assenta.
 *
 * Referência: o `DecryptedText` do React Bits. Foi ele o escolhido entre as
 * animações de texto da biblioteca por uma razão de voz, não de gosto: este
 * produto fala em IBM Plex Mono e em linguagem de instrumento (§1), e um texto
 * que se resolve caractere a caractere é o gesto de um terminal decodificando —
 * não uma palavra deslizando de baixo para cima, que é o mesmo efeito de
 * qualquer landing page.
 *
 * O ALFABETO É PRÓPRIO. A demo embaralha com letras e símbolos ruidosos; aqui
 * os glifos são os de um mostrador técnico, e o comprimento da linha nunca muda
 * porque cada caractere é trocado no lugar, nunca inserido ou removido.
 *
 * ELE NÃO ESCONDE CONTEÚDO, e essa é a regra que desenhou o resto do arquivo.
 * O estado inicial é a frase INTEIRA, já legível; o embaralhado é uma camada que
 * entra por cima, no primeiro quadro, e só quando há JavaScript e movimento
 * permitido. Uma versão que começasse vazia ou embaralhada deixaria a tela de
 * entrada em branco em tudo que não pinta quadro — renderizador sem script, aba
 * de fundo, captura headless.
 */

import { useEffect, useState } from "react";

/** Glifos de mostrador: dígitos, maiúsculas e os sinais de um terminal. */
const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/\|<>[]{}=+*#%";

/** Quanto tempo a frase inteira leva para assentar, em ms por caractere. */
const MS_POR_CARACTERE = 44;
/** Intervalo entre dois sorteios de glifo. Abaixo disso vira cintilação. */
const MS_POR_SORTEIO = 28;

function ganhoDeMovimento(): number {
  const v = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--motion-gain"),
  );
  return Number.isFinite(v) ? v : 1;
}

function sortear() {
  return ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
}

export function TextoDecifrado({
  texto,
  className,
  /**
   * Chamado com o progresso 0..1, e com 1 no fim.
   *
   * É por aqui que o orbe fica sabendo. A frase não é legenda de uma animação
   * decorativa: é o agente produzindo texto, e quem lê tem de ver as duas
   * coisas acontecendo no mesmo ritmo. Ver [[components/login/boas-vindas]].
   *
   * Quem passa esta função DEVE memorizá-la (`useCallback`): ela entra nas
   * dependências do efeito, e uma função nova a cada render reiniciaria a
   * decifração para sempre.
   */
  onProgresso,
}: {
  texto: string;
  className?: string;
  onProgresso?: (progresso: number) => void;
}) {
  /* O estado inicial é a FRASE INTEIRA. Sem JavaScript, com movimento reduzido
     ou num renderizador que nunca chega a pintar um quadro, é ela que fica na
     tela — o embaralhado é uma camada por cima, nunca o conteúdo. */
  const [visto, setVisto] = useState(texto);
  const [rodada, setRodada] = useState(0);

  useEffect(() => {
    const parado =
      ganhoDeMovimento() === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (parado) {
      /* Nada de `setVisto` aqui: `visto` JÁ é o texto final. Chamar o setter
         com o valor que o estado tem seria render em cascata a troco de nada. */
      onProgresso?.(1);
      return;
    }

    /*
     * O LAÇO É POR `rAF` E POR TEMPO DECORRIDO, não por `setInterval` contando
     * passos. Duas razões, e nenhuma é estilo:
     *
     *  · um `setInterval` de 26ms empurrando estado do React entrega quadros
     *    que o navegador descarta, e em aba de fundo ele acumula disparos que
     *    chegam todos juntos na volta;
     *  · o progresso derivado do relógio faz a frase levar o mesmo tempo em
     *    qualquer máquina — e é esse progresso que o orbe está seguindo.
     *
     * O primeiro embaralhado acontece DENTRO do primeiro quadro, e não no corpo
     * do efeito: a frase certa fica visível por um quadro só, e o React não
     * recebe `setState` síncrono na montagem.
     */
    const total = Math.max(1, texto.length * MS_POR_CARACTERE);
    let inicio = 0;
    let ultimoSorteio = -Infinity;
    let quadro = 0;

    const passo = (agora: number) => {
      if (!inicio) inicio = agora;
      const progresso = Math.min(1, (agora - inicio) / total);

      if (progresso >= 1) {
        setVisto(texto);
        onProgresso?.(1);
        return;
      }

      if (agora - ultimoSorteio >= MS_POR_SORTEIO) {
        ultimoSorteio = agora;
        /* `assentados` conta da ESQUERDA: a frase se resolve na direção da
           leitura. Resolver em posições aleatórias parece falha de
           renderização, não decodificação. */
        const assentados = Math.floor(progresso * texto.length);
        setVisto(
          texto
            .split("")
            .map((c, i) => (i < assentados || !c.trim() ? c : sortear()))
            .join(""),
        );
        onProgresso?.(progresso);
      }

      quadro = requestAnimationFrame(passo);
    };

    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [texto, rodada, onProgresso]);

  return (
    <span
      className={className}
      /* O texto REAL para quem lê por leitor de tela; o embaralhado é pintura, e
         `aria-hidden` o mantém fora da árvore de acessibilidade. Sem isto o
         leitor anunciaria lixo a cada sorteio. */
      aria-label={texto}
      /* Passar o ponteiro pede a frase de novo, e o orbe responde junto. Não é
         um botão e não precisa ser: a frase está inteira e legível o tempo
         todo, então quem nunca passar o mouse não perde conteúdo nenhum. */
      onPointerEnter={() => setRodada((r) => r + 1)}
    >
      <span aria-hidden="true">{visto}</span>
    </span>
  );
}
