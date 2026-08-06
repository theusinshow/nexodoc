"use client";

/**
 * A ENTRADA: o Nexo cumprimenta e pergunta o que vai ser feito, escrevendo a
 * frase letra a letra enquanto o orbe "fala".
 *
 * Por que a hora NÃO é lida no render: o servidor renderiza esta tela antes do
 * navegador, e o fuso dele pode ser outro — "Boa noite" no HTML e "Boa tarde" na
 * hidratação é um erro de hidratação, dos que estouram no console e derrubam a
 * árvore. Então a frase nasce vazia e a hora é lida depois de montar, num rAF
 * (que é também o que o lint do React Compiler exige: nada de `setState`
 * síncrono no corpo do effect, nem `new Date()` durante o render).
 *
 * O typewriter é o `useRevealText` — o MESMO que revela a resposta do agente no
 * chat. Um segundo typewriter divergiria do primeiro na primeira vez que alguém
 * mexesse na cadência.
 *
 * Havia aqui um subtítulo explicando as duas portas ("solte as pranchas… solte
 * o memorial…"). Ele saiu quando a ZONA DE SOLTA passou a existir: os dois
 * diziam a mesma coisa com palavras diferentes, e a zona diz no lugar em que se
 * age. A segunda linha da saudação já nomeia as duas portas — "montar ou
 * auditar?" — então nada se perdeu.
 */

import { useEffect, useState } from "react";

import { useRevealText } from "../lib/use-reveal-text";
import { montarSaudacao } from "../lib/saudacao";

export function SaudacaoDoNexo({
  nome,
  onDigitando,
}: {
  nome?: string | null;
  /** Avisa o dono enquanto a frase está sendo escrita (o orbe reage). */
  onDigitando?: (digitando: boolean) => void;
}) {
  const [frase, setFrase] = useState<string | null>(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      setFrase(montarSaudacao(new Date().getHours(), nome)),
    );
    return () => cancelAnimationFrame(raf);
  }, [nome]);

  /*
   * O revelador só é MONTADO quando a frase existe.
   *
   * `useRevealText` decide no mount se vai animar (`doneRef = !enabled`), então
   * ligá-lo depois não anima nada — a frase apareceria inteira, de uma vez. E
   * ela só pode existir depois do primeiro quadro, porque depende do relógio do
   * navegador. Montar o filho na hora certa resolve os dois sem tocar no hook
   * que o chat também usa.
   */
  return (
    <div className="space-y-1.5">
      {/*
        A altura é RESERVADA (duas linhas do título). Sem isso a frase empurraria
        o composer para baixo enquanto se escreve, e a tela inteira andaria
        durante a entrada — movimento que não significa nada, que é exatamente o
        que a DESIGN.md proíbe.
      */}
      {frase === null ? (
        <h2 className="min-h-[4.4rem]" aria-hidden />
      ) : (
        <FraseEscrita texto={frase} onDigitando={onDigitando} />
      )}
    </div>
  );
}

function FraseEscrita({
  texto,
  onDigitando,
}: {
  texto: string;
  onDigitando?: (digitando: boolean) => void;
}) {
  const escrito = useRevealText(texto, true);
  const digitando = escrito.length < texto.length;

  useEffect(() => {
    onDigitando?.(digitando);
    // Ao desmontar (a conversa começou), o orbe não pode ficar preso em
    // "respondendo" por causa de uma saudação que saiu da tela.
    return () => onDigitando?.(false);
  }, [digitando, onDigitando]);

  return (
    <>
      <h2 className="min-h-[4.4rem] whitespace-pre-line text-2xl font-medium leading-[1.35] tracking-[-0.01em]">
        {escrito}
        {/*
          O cursor NÃO pisca. Piscar é movimento contínuo, e aqui só o orbe tem
          esse direito; sólido, ele diz "ainda escrevendo" do mesmo jeito e some
          quando a frase termina.
        */}
        {digitando && (
          <span
            aria-hidden
            className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] rounded-[1px] bg-[var(--primary)] align-baseline"
          />
        )}
      </h2>
    </>
  );
}
