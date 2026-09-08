"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * AS PEÇAS COMPARTILHADAS DAS APRESENTAÇÕES.
 *
 * POR QUE EXISTE. `/apresentacao` e `/apresentacao/valores` são dois decks
 * distintos que precisam parecer o MESMO documento — a página de valores entra
 * na projeção logo depois do deck, e uma diferença de dois pixels no rótulo ou
 * um cinza um passo mais claro a denunciariam como outro arquivo. Uma segunda
 * redação das mesmas escalas divergiria na primeira correção.
 *
 * O QUE MORA AQUI: tipografia base, a entrada escalonada e as duas peças de
 * conteúdo que os dois decks usam. O que é específico de uma folha — o diagrama
 * do motor, a folha do contraditório, o número que corre — continua em
 * `slides.tsx`, junto de quem o usa.
 */

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const rotulo: CSSProperties = {
  fontFamily: MONO,
  fontSize: 23,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "#5f6b72",
};

export const paragrafo: CSSProperties = {
  margin: 0,
  fontSize: 27,
  lineHeight: 1.45,
  color: "var(--foreground)",
  textWrap: "pretty",
};

export const secundario: CSSProperties = {
  ...paragrafo,
  fontSize: 25,
  color: "var(--muted-foreground)",
};

/**
 * Entrada escalonada. O atraso é a ORDEM DE LEITURA tornada visível: o olho
 * chega em cada peça no instante em que a anterior terminou de ser lida.
 */
export function Entra({
  atraso = 0,
  children,
  style,
}: {
  atraso?: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="ap-entra" style={{ animationDelay: `${atraso}ms`, ...style }}>
      {children}
    </div>
  );
}

/** Uma linha de tabela: rótulo à esquerda, valor em mono à direita. */
export function Linha({
  chave,
  valor,
  atraso,
}: {
  chave: string;
  valor: ReactNode;
  atraso: number;
}) {
  return (
    <Entra
      atraso={atraso}
      style={{
        display: "grid",
        gridTemplateColumns: "340px 1fr",
        gap: "0 48px",
        alignItems: "baseline",
        padding: "24px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <span style={{ ...rotulo, fontSize: 22 }}>{chave}</span>
      <span style={{ fontFamily: MONO, fontSize: 38, color: "var(--foreground)" }}>{valor}</span>
    </Entra>
  );
}

/** Um marcador de lista: a afirmação em destaque, a explicação embaixo. */
export function Marcador({
  titulo,
  texto,
  atraso,
  cor = "var(--muted-foreground)",
}: {
  titulo: string;
  texto?: string;
  atraso: number;
  cor?: string;
}) {
  return (
    <Entra atraso={atraso} style={{ padding: "22px 0", borderTop: "1px solid var(--border)" }}>
      <p
        style={{
          margin: texto ? "0 0 8px" : 0,
          fontSize: 30,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.3,
          color: "var(--foreground)",
          textWrap: "pretty",
        }}
      >
        {titulo}
      </p>
      {texto ? (
        <p style={{ margin: 0, fontSize: 24, lineHeight: 1.45, color: cor, textWrap: "pretty" }}>
          {texto}
        </p>
      ) : null}
    </Entra>
  );
}
