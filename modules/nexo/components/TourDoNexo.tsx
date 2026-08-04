"use client";

/**
 * O TOUR GUIADO: balão ancorado + anel no alvo, caminhando por um projeto de
 * exemplo real.
 *
 * Não é modal (DESIGN.md §11 manda esgotar o inline antes): a tela não é
 * escurecida nem bloqueada — o anel destaca o alvo, o balão explica ao lado, e
 * o app continua ali, vivo, atrás. Quem quiser sair sai com Esc.
 *
 * O tour DIRIGE a tela clicando nos mesmos controles que o usuário clicaria
 * (`clicarAntes`), em vez de mexer no estado por dentro: o que ele mostra é o
 * comportamento de verdade, e não uma encenação que pode divergir do produto.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { posicaoDoBalao, type Retangulo } from "../lib/posicao-do-balao";
import { PASSOS_DO_TOUR } from "../lib/passos-do-tour";

const LARGURA_BALAO = 340;

export function TourDoNexo({ aoSair }: { aoSair: () => void }) {
  const [indice, setIndice] = useState(0);
  const [alvo, setAlvo] = useState<Retangulo | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const balaoRef = useRef<HTMLDivElement | null>(null);

  const passo = PASSOS_DO_TOUR[indice];
  const ultimo = indice === PASSOS_DO_TOUR.length - 1;

  const sair = useCallback(() => {
    aoSair();
  }, [aoSair]);

  // O clique que leva a tela ao estado do passo. Roda ANTES de medir: medir um
  // alvo que só nasce depois do clique devolveria zero.
  useEffect(() => {
    if (!passo.clicarAntes) return;
    const controle = document.querySelector<HTMLElement>(passo.clicarAntes);
    controle?.click();
  }, [passo]);

  /*
   * A medição do alvo. `useLayoutEffect` porque o balão precisa nascer no lugar
   * certo — medir depois da pintura faria o balão aparecer num canto e pular
   * para o outro, que é o tipo de movimento sem significado que a DESIGN.md
   * proíbe.
   */
  useLayoutEffect(() => {
    let vivo = true;
    let quadro = 0;

    const medir = () => {
      if (!vivo) return;
      if (!passo.alvo) {
        setAlvo(null);
        setPos(null);
        return;
      }
      const el = document.querySelector(passo.alvo);
      if (!el) {
        // O alvo pode ainda não ter sido montado (a vista acabou de trocar).
        // Insistir por alguns quadros é mais honesto que pular o passo.
        quadro = requestAnimationFrame(medir);
        return;
      }
      const r = el.getBoundingClientRect();
      const retangulo = { x: r.left, y: r.top, largura: r.width, altura: r.height };
      setAlvo(retangulo);
      const alturaBalao = balaoRef.current?.offsetHeight ?? 180;
      setPos(
        posicaoDoBalao(
          retangulo,
          { largura: LARGURA_BALAO, altura: alturaBalao },
          { largura: window.innerWidth, altura: window.innerHeight },
          passo.lado ?? "abaixo",
        ),
      );
    };

    // Um quadro de espera: o clique do passo anterior pode ter trocado a vista.
    quadro = requestAnimationFrame(medir);
    window.addEventListener("resize", medir);
    return () => {
      vivo = false;
      cancelAnimationFrame(quadro);
      window.removeEventListener("resize", medir);
    };
  }, [passo]);

  const avancar = useCallback(() => {
    if (ultimo) sair();
    else setIndice((i) => i + 1);
  }, [ultimo, sair]);

  const voltar = useCallback(() => setIndice((i) => Math.max(0, i - 1)), []);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") sair();
      else if (e.key === "ArrowRight" || e.key === "Enter") avancar();
      else if (e.key === "ArrowLeft") voltar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [avancar, voltar, sair]);

  const estiloDoBalao = pos
    ? { left: pos.x, top: pos.y }
    : {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      };

  return (
    <>
      {/*
        O anel do alvo. `pointer-events-none` para não roubar o clique do que
        está embaixo: durante o tour a aplicação continua utilizável.
      */}
      {alvo && (
        <div
          aria-hidden
          data-tour-anel
          className="pointer-events-none fixed z-[60] rounded-md border border-[var(--ring)] transition-[top,left,width,height] duration-200 ease-out motion-reduce:transition-none"
          style={{
            left: alvo.x - 4,
            top: alvo.y - 4,
            width: alvo.largura + 8,
            height: alvo.altura + 8,
            boxShadow: "0 0 0 4px color-mix(in oklab, var(--ring) 25%, transparent)",
          }}
        />
      )}

      <div
        ref={balaoRef}
        role="dialog"
        aria-label="Passo a passo do Nexo"
        data-tour-balao
        className={cn(
          "fixed z-[61] flex flex-col gap-2 rounded-md border border-border bg-card p-4",
          "shadow-[var(--shadow-overlay)] transition-[top,left] duration-200 ease-out motion-reduce:transition-none",
        )}
        style={{ width: LARGURA_BALAO, ...estiloDoBalao }}
      >
        <p className="font-mono text-xs font-medium uppercase tabular-nums tracking-[0.05em] text-muted-foreground">
          {indice + 1} de {PASSOS_DO_TOUR.length}
        </p>
        <h2 className="text-base font-medium leading-tight">{passo.titulo}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{passo.corpo}</p>

        <div className="mt-1 flex items-center gap-2">
          <Button size="sm" onClick={avancar} data-tour-proximo>
            {ultimo ? "Começar" : "Próximo"}
          </Button>
          {indice > 0 && !ultimo && (
            <Button size="sm" variant="ghost" onClick={voltar}>
              Voltar
            </Button>
          )}
          {!ultimo && (
            <Button size="sm" variant="ghost" className="ml-auto" onClick={sair}>
              Pular
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
