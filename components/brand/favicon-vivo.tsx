"use client";

/**
 * O FAVICON QUE SABE QUE HÁ TRABALHO.
 *
 * Uma auditoria leva de três a seis minutos, e ninguém fica olhando: a aba vai
 * para o fundo e a pessoa vai fazer outra coisa. Sem sinal nenhum ali, voltar a
 * tempo é sorte — e o produto que promete "o agente trabalha para você" fica
 * mudo justamente na hora em que ele está trabalhando.
 *
 * TROCA A REFERÊNCIA, não desenha nada. Os dois arquivos são estáticos
 * (`npm run marca:trabalhando` os gera a partir da mesma captura do orbe), e o
 * que muda é o `href` do `<link rel="icon">`. Compor a imagem no navegador
 * gastaria pintura para 32 pixels.
 *
 * E ELE DEVOLVE O ÍCONE ao terminar, inclusive quando o componente sai da tela.
 * Um favicon que fica com o ponto para sempre depois de uma auditoria vira
 * decoração — e decoração que parece estado é pior que estado nenhum.
 */

import { useEffect } from "react";

const TRABALHANDO = "/marca/orbe-trabalhando-32.png";

export function FaviconVivo({ trabalhando }: { trabalhando: boolean }) {
  useEffect(() => {
    if (!trabalhando) return;

    /*
     * DESLIGA OS QUE EXISTEM E PÕE UM SÓ — em vez de reescrever o `href` de
     * cada um.
     *
     * Medido em 29/08/2026: a página tem SEIS `<link rel="icon">` (o Next
     * declara 32 e 16, e o roteador os reinsere). Trocar o `href` dos que
     * existiam no instante do efeito deixava metade apontando para o ícone
     * antigo, e qual deles o navegador escolhe não é decisão nossa — o ponto
     * aparecia ou não conforme o tamanho pedido.
     *
     * Com um ícone só na cabeça, não há escolha a fazer. E como a troca é
     * reversível pelo cleanup, o estado original volta inteiro.
     */
    const antigos = Array.from(
      document.querySelectorAll<HTMLLinkElement>(
        'link[rel="icon"], link[rel="shortcut icon"]',
      ),
    );
    const relOriginal = antigos.map((l) => l.getAttribute("rel") ?? "icon");
    for (const l of antigos) l.setAttribute("rel", "nexodoc-icone-guardado");

    const nosso = document.createElement("link");
    nosso.rel = "icon";
    nosso.type = "image/png";
    nosso.href = TRABALHANDO;
    document.head.appendChild(nosso);

    /*
     * O NEXT REINSERE OS ÍCONES DEPOIS, e o navegador prefere o ÚLTIMO.
     *
     * Sem o observador, o efeito desligava os que existiam naquele instante e o
     * roteador acrescentava outros três logo em seguida — o nosso ficava em
     * primeiro e perdia. Medido em 29/08/2026, e a prova reprovava por isso.
     *
     * O observador apaga qualquer ícone novo e devolve o nosso ao fim da fila.
     * Ele para junto com o efeito; nada disso sobrevive ao estado de repouso.
     */
    const desligar = (l: HTMLLinkElement) => {
      if (l !== nosso) l.setAttribute("rel", "nexodoc-icone-guardado");
    };
    const observador = new MutationObserver(() => {
      document
        .querySelectorAll<HTMLLinkElement>(
          'link[rel="icon"], link[rel="shortcut icon"]',
        )
        .forEach(desligar);
      if (document.head.lastElementChild !== nosso)
        document.head.appendChild(nosso);
    });
    observador.observe(document.head, { childList: true });

    return () => {
      observador.disconnect();
      nosso.remove();
      antigos.forEach((l, i) => l.setAttribute("rel", relOriginal[i]));
      /*
       * Os que o roteador inseriu DURANTE o trabalho também voltam: eles não
       * estavam na lista original, e deixá-los desligados apagaria o ícone da
       * aba justamente quando o trabalho acaba.
       */
      document
        .querySelectorAll<HTMLLinkElement>('link[rel="nexodoc-icone-guardado"]')
        .forEach((l) => l.setAttribute("rel", "icon"));
    };
  }, [trabalhando]);

  return null;
}
