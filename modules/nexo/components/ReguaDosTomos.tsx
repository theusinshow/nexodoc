"use client";

/**
 * A RÉGUA DOS TOMOS (16/10/2026): todas as pranchas do volume numa linha só,
 * na ordem da montagem, com uma marca onde cada tomo termina. Arrastar a marca
 * escolhe o corte — o "5 + 10, depois + 10" que pedia arrastar prancha por
 * prancha entre fileiras.
 *
 * O canvas desenha uma fileira por tomo, cada uma em grade: ali não existe
 * linha reta onde um corte deslize. A régua é essa linha.
 * Desenho: docs/superpowers/specs/2026-10-16-corte-dos-tomos-design.md
 */
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { cn } from "@/lib/utils";

import {
  criarCorte,
  cortesDasFaixas,
  faixasDosCortes,
  moverCorte,
  patchesDosCortes,
  pesoDasFaixas,
  removerCorte,
} from "../lib/corte-dos-tomos";
import { TETO_DO_TOMO_BYTES, formatarMb } from "../lib/entrega-do-volume";

export interface CelulaDaRegua {
  id: string;
  /** Cor da disciplina (o mesmo fio de cor do nó da folha). */
  cor: string;
  /** "05 · PLANTA BAIXA" — o que o title mostra. */
  rotulo: string;
}

export function ReguaDosTomos({
  faixas,
  onCortar,
  bytesDe,
}: {
  /** As folhas de cada tomo, na ordem da montagem. */
  faixas: readonly (readonly CelulaDaRegua[])[];
  /** O tomo de TODA folha — a divisão congela, como no arrasto de prancha. */
  onCortar: (patches: { id: string; patch: { grupo: number } }[]) => void;
  /** Bytes estimados de uma folha; `null` = desconhecido (a régua omite o peso). */
  bytesDe: (id: string) => number | null;
}) {
  const celulas = useMemo(() => faixas.flat(), [faixas]);
  const { sequencia, cortes } = useMemo(() => cortesDasFaixas(faixas.map((f) => f.map((c) => c.id))), [faixas]);
  const total = sequencia.length;
  const trilho = useRef<HTMLDivElement>(null);
  /** O corte na mão: qual, e em que vão está agora. */
  const [arrasto, setArrasto] = useState<{ i: number; pos: number } | null>(null);

  const cortesVistos = arrasto ? moverCorte(cortes, arrasto.i, arrasto.pos, total) : cortes;
  const faixasVistas = faixasDosCortes(sequencia, cortesVistos);
  const pesos = pesoDasFaixas(faixasVistas, bytesDe);

  if (total < 2) return null;

  const largura = 100 / total;
  const vaoDoPonteiro = (clientX: number) => {
    const r = trilho.current?.getBoundingClientRect();
    if (!r || r.width === 0) return 0;
    return Math.max(0, Math.min(total, Math.round(((clientX - r.left) / r.width) * total)));
  };

  const aplicar = (novos: number[]) => {
    if (novos.length === cortes.length && novos.every((c, i) => c === cortes[i])) return;
    onCortar(patchesDosCortes(sequencia, novos));
  };

  const aoApertar = (i: number) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrasto({ i, pos: cortes[i] });
  };
  const aoMover = (e: PointerEvent<HTMLButtonElement>) => {
    if (!arrasto) return;
    const pos = vaoDoPonteiro(e.clientX);
    if (pos !== arrasto.pos) setArrasto({ ...arrasto, pos });
  };
  const aoSoltar = () => {
    if (!arrasto) return;
    aplicar(moverCorte(cortes, arrasto.i, arrasto.pos, total));
    setArrasto(null);
  };
  const aoTeclar = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      aplicar(moverCorte(cortes, i, cortes[i] + (e.key === "ArrowLeft" ? -1 : 1), total));
    } else if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      aplicar(removerCorte(cortes, i));
    }
  };

  // Onde cada marca é DESENHADA: a arrastada segue o ponteiro mesmo quando vai juntar.
  const marcas = cortes.map((c, i) => (arrasto?.i === i ? arrasto.pos : c));

  return (
    <div className="nx-regua nodrag nopan" aria-label="Régua dos tomos">
      <ol className="nx-regua-tomos" aria-live="polite">
        {faixasVistas.map((faixa, t) => {
          const peso = pesos[t];
          const acima = peso !== null && peso > TETO_DO_TOMO_BYTES;
          return (
            <li key={t} className={cn("nx-regua-tomo", acima && "nx-regua-tomo--acima")} style={{ flexGrow: faixa.length }}>
              <span className="nx-regua-nome">Tomo {String(t + 1).padStart(2, "0")}</span>
              <span>
                {faixa.length} {faixa.length === 1 ? "folha" : "folhas"}
                {peso !== null && ` · ${formatarMb(peso)}`}
              </span>
            </li>
          );
        })}
      </ol>
      <div ref={trilho} className="nx-regua-trilho">
        {celulas.map((c, i) => (
          <button
            key={c.id}
            type="button"
            className="nx-regua-celula"
            style={{ width: `${largura}%`, background: c.cor }}
            title={i === 0 ? c.rotulo : `${c.rotulo}\nClique para começar um tomo aqui`}
            aria-label={i === 0 ? c.rotulo : `Começar um tomo em ${c.rotulo}`}
            tabIndex={-1}
            disabled={i === 0 || cortes.includes(i)}
            onClick={() => aplicar(criarCorte(cortes, i, total))}
          />
        ))}
        {marcas.map((pos, i) => (
          <button
            key={i}
            type="button"
            role="slider"
            aria-label={`Fim do tomo ${String(i + 1).padStart(2, "0")}`}
            aria-valuemin={1}
            aria-valuemax={total - 1}
            aria-valuenow={pos}
            aria-valuetext={`${pos} folhas antes do corte`}
            title="Arraste para mudar onde o tomo termina · encoste na vizinha para juntar · Delete tira o corte"
            className={cn("nx-regua-marca", arrasto?.i === i && "nx-regua-marca--na-mao")}
            style={{ left: `${(pos / total) * 100}%` }}
            onPointerDown={aoApertar(i)}
            onPointerMove={aoMover}
            onPointerUp={aoSoltar}
            onPointerCancel={() => setArrasto(null)}
            onKeyDown={aoTeclar(i)}
          />
        ))}
      </div>
    </div>
  );
}
