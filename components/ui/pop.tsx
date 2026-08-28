"use client";

import * as React from "react";
import { Check, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * POP — o desfecho de uma ação em lote, dito onde a mão acabou de estar.
 *
 * PRIMITIVO NOVO, e não reuso: `components/ui/` tem dezenove arquivos e nenhum
 * deles serve. Não há toast no projeto (nada de sonner, nada de snackbar), e o
 * retorno do envio de achados era o `feedbackNotice` — mono 12px cinza, do
 * mesmo peso do texto ao lado, encostado numa barra que some no mesmo instante.
 * Quem mandava vinte e dois achados não via nada acontecer.
 *
 * ELE NÃO SE POSICIONA — e isso é decisão, não descuido. Nada de `fixed` aqui
 * dentro: o parecer é renderizado DENTRO do painel estreito do Nexo, onde um
 * elemento fixo escaparia do painel e flutuaria sobre o aplicativo inteiro,
 * longe da lista que ele comenta. Quem chama diz onde ele mora; um primitivo
 * que decide isso sozinho não serviria na segunda tela.
 *
 * SUCESSO SOME, FALHA ESPERA. Um aviso de êxito que exige clique cobra trabalho
 * por uma notícia boa; um erro que sai sozinho leva embora a única explicação
 * de por que nada aconteceu. São dois comportamentos porque são duas coisas.
 *
 * Geometria pelo §7: `.nx-cut-8` com fundo explícito, e não `.nx-edge-8` — a
 * camada de contorno reage a `:has(:focus-visible)`, e num painel que guarda o
 * botão de fechar o anel de foco subiria para a moldura inteira. Quem o separa
 * do fundo é a sombra do `.nx-elev` num pai não recortado.
 */
export interface PopProps {
  /** `ok` sai sozinho; `falha` fica até alguém fechar. */
  tom: "ok" | "falha";
  /** O que aconteceu, em uma frase. */
  children: React.ReactNode;
  /** Fechar — o pop nunca se apaga do estado sozinho, ele pede. */
  onFechar: () => void;
  /** Segundos até sumir sozinho. Só vale para `ok`. */
  segundos?: number;
  className?: string;
}

export function Pop({
  tom,
  children,
  onFechar,
  segundos = 6,
  className,
}: PopProps) {
  /*
   * O temporizador reinicia a cada `children` novo: dois envios seguidos são
   * dois pops, e o segundo não pode herdar o relógio já gasto do primeiro —
   * ele sumiria antes de ser lido.
   */
  React.useEffect(() => {
    if (tom !== "ok") return;
    const t = setTimeout(onFechar, segundos * 1000);
    return () => clearTimeout(t);
  }, [tom, segundos, onFechar, children]);

  const Icone = tom === "ok" ? Check : TriangleAlert;

  return (
    <div className={cn("nx-elev nexodoc-section-reveal", className)}>
      <div
        /*
         * `status` + `polite`: o leitor de tela anuncia quando terminar a frase
         * corrente. `alert` interromperia a leitura da lista de achados para
         * dizer que o envio deu certo — urgência que a notícia não tem.
         */
        role="status"
        aria-live="polite"
        data-pop={tom}
        className="nx-cut-8 flex items-start gap-3 bg-card px-4 py-3"
      >
        <Icone
          aria-hidden
          className="mt-0.5 size-4 shrink-0"
          style={{
            color: tom === "ok" ? "var(--status-ok)" : "var(--status-critical)",
          }}
        />
        <p className="min-w-0 flex-1 text-sm text-foreground">{children}</p>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar aviso"
          className="-mr-1 -mt-1 shrink-0 p-1 text-muted-foreground outline-none transition-colors duration-[var(--duration-fast)] hover:text-foreground focus-visible:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
