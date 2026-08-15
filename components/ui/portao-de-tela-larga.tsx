/**
 * DIZER, EM VEZ DE DEGRADAR EM SILÊNCIO.
 *
 * O Nexo já tinha esta decisão e a escrevia bem: abaixo de 1024px ele não tenta
 * caber — avisa que é ferramenta de mesa e promete que o trabalho continua lá.
 * O resto do produto não tinha aplicado a mesma decisão nem contido o que não
 * cabe, e o resultado foi medido num telefone de 390px: `/projetos` rolava
 * 1171px para o lado, `/admin/users` 796px, `/ferramentas` 176px. Some pela
 * direita, sem aviso — que é exatamente o "parecer defeito, não decisão" que o
 * `NexoShell` evitou.
 *
 * Aqui a mesma técnica vira componente. Duas regras que valem a pena repetir:
 *
 * 1. **Quem decide é o CSS, não o cliente.** Medir a janela no React pinta a
 *    tela errada no primeiro quadro e pisca. A media query já sabe a largura
 *    antes da primeira pintura.
 * 2. **O recado é escrito por quem chama.** "Abra num computador" sem dizer o
 *    que se perde é desculpa; o texto tem que nomear a leitura que a coluna
 *    estreita entregaria pela metade — e prometer o que continua lá.
 *
 * NÃO substitui responsividade onde ela é possível: a visão geral do admin, a
 * home e `/volumes` cabem em 390px hoje e continuam cabendo. Isto é para a
 * densidade que não tem como encolher sem mentir (tabela de 1210px, ficha da
 * obra ao lado da lista do escritório).
 */
import type { ReactNode } from "react";

export function PortaoDeTelaLarga({
  titulo,
  children,
  aPartirDe = "1024px",
}: {
  /** O que se perde numa coluna só, e o que continua esperando. Uma frase. */
  titulo: string;
  children: ReactNode;
  /**
   * Só para documentar no texto qual é o limiar. O corte real é o da media
   * query em `globals.css` — um número em dois lugares divergiria, e este é o
   * que ninguém veria divergir.
   */
  aPartirDe?: string;
}) {
  return (
    <>
      <div className="nx-tela-larga">{children}</div>
      <div className="nx-tela-estreita" role="note">
        <p className="nx-tela-estreita__titulo">Esta tela pede mais largura</p>
        <p className="nx-tela-estreita__texto">
          {titulo} A partir de {aPartirDe} de largura. Abra num computador — nada
          se perde enquanto isso.
        </p>
      </div>
    </>
  );
}
