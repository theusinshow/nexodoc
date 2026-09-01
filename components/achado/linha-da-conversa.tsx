"use client";

/**
 * UMA LINHA da conversa do achado — fala ou evento.
 *
 * As duas moram na mesma cronologia (ver [[lib/conversa-do-achado.ts]]), e a
 * diferença é de PESO, não de lugar: o evento é uma nota discreta, a fala tem
 * corpo. Separá-las em duas listas contaria a história em duas colunas que o
 * leitor teria que costurar sozinho.
 *
 * A atribuição com recado é os dois ao mesmo tempo — a frase do evento e o texto
 * da pessoa — e por isso os dois campos são renderizados sem `else`.
 */
import type { LinhaLegivel } from "@/lib/conversa-do-achado";

function quando(ms: number): string {
  return new Date(ms).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LinhaDaConversa({ linha }: { linha: LinhaLegivel }) {
  return (
    <li className="list-none border-l border-border pl-3">
      <p className="m-0 text-[11.5px] leading-5 text-muted-foreground">
        <span className="text-foreground">{linha.quem}</span>
        {linha.frase ? ` ${linha.frase}` : ""}
        <span className="ml-2 font-mono text-[10.5px]">{quando(linha.createdAt)}</span>
      </p>
      {linha.body ? (
        <p className="m-0 mt-1 whitespace-pre-wrap text-[12.5px] leading-5 text-foreground">
          {linha.body}
        </p>
      ) : null}
    </li>
  );
}
