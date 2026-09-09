"use client";

/**
 * O CASCO DO WIDGET — a moldura que todos usam, e que nenhum redesenha.
 *
 * Existe por uma razão só: cinco widgets escritos por cinco caminhos viram
 * cinco cartões parecidos-mas-não-iguais, e "Seu espaço" passa a ler como um
 * agregado de coisas coladas. O casco fixa a única coisa que precisa ser igual
 * — superfície, chanfro, altura do cabeçalho, tamanho do rótulo — e deixa o
 * miolo inteiramente livre.
 *
 * MATTE, sem exceção (§4). Widget é cartão, cartão é dado, e o vidro desta tela
 * mora só na barra do topo. Nenhum `backdrop-filter` entra aqui.
 *
 * MENOR QUE O CARTÃO DE PROJETO, e é a hierarquia inteira desta seção: o rótulo
 * é 10px em versalete contra os 15px do nome da obra, e o widget não tem
 * trilho. Ele fica DEPOIS da lista, e não pode competir com ela — o operacional
 * é o produto, o widget é a ferramenta ao lado da bancada.
 */

import type * as React from "react";

import { cn } from "@/lib/utils";

export function Casco({
  titulo,
  acessorio,
  children,
  className,
}: {
  titulo: string;
  /** O que vive à direita do rótulo: contagem, estado, um controle pequeno. */
  acessorio?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("nx-edge-8 flex min-w-0 flex-1 flex-col self-start", className)}
      style={{ "--nx-fill": "var(--card)" } as React.CSSProperties}
    >
      <header className="flex min-h-[34px] shrink-0 items-center gap-3 px-4 pt-3.5">
        <h3 className="m-0 truncate font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {titulo}
        </h3>
        <div className="flex-1" />
        {acessorio}
      </header>

      <div className="min-w-0 flex-1 px-4 pb-4 pt-2.5">{children}</div>
    </section>
  );
}

/**
 * A LINHA VAZIA de um widget que buscou e não achou nada.
 *
 * Uma frase, no tom do resto: diz o que FARIA a linha aparecer, e não que está
 * vazio — a pessoa vê que está vazio sozinha. Mesma decisão do estado vazio da
 * lista de projetos.
 */
export function Nada({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 py-2 text-[12.5px] leading-relaxed text-muted-foreground">{children}</p>
  );
}

/**
 * "há 4 min", "há 3 h", "ontem", "12/08".
 *
 * A MESMA RÉGUA de `onde-voce-parou.tsx`, e a duplicação é deliberada: aquele
 * arquivo é a retomada, este é o pacote de widgets, e um import entre os dois
 * criaria dependência de um widget opcional para o bloco principal da tela.
 * São doze linhas; o dia em que virarem treze, viram módulo.
 */
export function quando(iso: string, agora = Date.now()): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";

  const min = Math.max(0, Math.round((agora - ms) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;

  const horas = Math.round(min / 60);
  if (horas < 24) return `há ${horas} h`;
  if (horas < 48) return "ontem";

  return new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
