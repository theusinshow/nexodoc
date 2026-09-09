"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

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
    <div
      className="ap-entra"
      style={{ animationDelay: `${atraso}ms`, ...style }}
    >
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
      <span
        style={{ fontFamily: MONO, fontSize: 38, color: "var(--foreground)" }}
      >
        {valor}
      </span>
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
    <Entra
      atraso={atraso}
      style={{ padding: "22px 0", borderTop: "1px solid var(--border)" }}
    >
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
        <p
          style={{
            margin: 0,
            maxWidth: "72ch",
            fontSize: 24,
            lineHeight: 1.45,
            color: cor,
            textWrap: "pretty",
          }}
        >
          {texto}
        </p>
      ) : null}
    </Entra>
  );
}

/* ───────────────────────────────────────────────────────── peças de movimento */

/**
 * O número corre até o valor. Não é enfeite: o valor É o argumento, e vê-lo
 * chegar prende o olho nele por um segundo a mais do que vê-lo já parado.
 *
 * Respeita movimento reduzido — quem pediu para nada se mexer recebe o número
 * final, e não uma contagem congelada no zero.
 */
export function Contador({
  ate,
  duracao = 900,
  atraso = 0,
  style,
}: {
  ate: number;
  duracao?: number;
  atraso?: number;
  style?: CSSProperties;
}) {
  const [valor, setValor] = useState(0);

  useEffect(() => {
    let quadro = 0;
    let inicio = 0;

    /*
     * A decisão sobre movimento reduzido mora DENTRO do temporizador, e não no
     * corpo do efeito. Não é preciosismo: `setState` síncrono num efeito dispara
     * renderização em cascata, e o lint do projeto recusa — com razão. Aqui a
     * chamada já nasce assíncrona, que é o contrato que a regra pede.
     */
    const relogio = setTimeout(() => {
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setValor(ate);
        return;
      }

      const passo = (agora: number) => {
        if (!inicio) inicio = agora;
        const t = Math.min(1, (agora - inicio) / duracao);
        // Desaceleração cúbica: chega devagar, como um ponteiro assentando.
        setValor(Math.round(ate * (1 - Math.pow(1 - t, 3))));
        if (t < 1) quadro = requestAnimationFrame(passo);
      };
      quadro = requestAnimationFrame(passo);
    }, atraso);

    return () => {
      clearTimeout(relogio);
      cancelAnimationFrame(quadro);
    };
  }, [ate, atraso, duracao]);

  return <span style={style}>{valor}</span>;
}

/* ───────────────────────────────────────────────────── revelação por máscara */

/**
 * LINHAS REVELADAS POR MÁSCARA, uma de cada vez. É a entrada de título e de
 * fecho: o texto nasce na própria linha de base, em vez de flutuar até ela.
 *
 * As quebras são DELIBERADAS — cada item do array é uma linha, e a quebra é
 * decisão editorial, não acidente de largura. O palco tem 1920px fixos, então
 * o que se ensaia é o que se projeta. Uma linha que ainda assim quebrar por
 * conta própria é defeito de quem a escreveu, e a prova de tela pega.
 */
export function Linhas({
  linhas,
  atraso = 0,
  passo = 110,
  style,
}: {
  linhas: readonly string[];
  atraso?: number;
  /** Intervalo entre uma linha e a seguinte. */
  passo?: number;
  style?: CSSProperties;
}) {
  return (
    <>
      {linhas.map((linha, i) => (
        <span key={linha} className="ap-mascara" style={style}>
          <span
            className="ap-linha"
            style={{ animationDelay: `${atraso + i * passo}ms` }}
          >
            {linha}
          </span>
        </span>
      ))}
    </>
  );
}

/** O título da folha, revelado por máscara. Uma linha só, por regra. */
export function Titulo({
  children,
  atraso = 0,
  style,
}: {
  children: string;
  atraso?: number;
  style?: CSSProperties;
}) {
  return (
    <h2 className="ap-titulo" style={style}>
      <Linhas linhas={[children]} atraso={atraso} />
    </h2>
  );
}

/**
 * O FECHO — a frase em teal que fecha a folha, quebrada onde o argumento
 * respira. Linha a linha, com um passo maior que o das listas: é a frase que
 * se lê devagar, e a entrada acompanha a leitura.
 */
export function Fecho({
  linhas,
  atraso = 0,
  tamanho = 44,
  cor = "var(--nexodoc-accent)",
  style,
}: {
  linhas: readonly string[];
  atraso?: number;
  tamanho?: number;
  cor?: string;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: tamanho,
        fontWeight: 500,
        letterSpacing: "-0.022em",
        lineHeight: 1.22,
        color: cor,
        ...style,
      }}
    >
      <Linhas linhas={linhas} atraso={atraso} passo={140} />
    </p>
  );
}
