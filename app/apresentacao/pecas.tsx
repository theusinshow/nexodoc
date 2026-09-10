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
     *
     * E O ATRASO NÃO VALE em movimento reduzido. Sem isto o "57 achados" da
     * folha 05 ficava escrito "0" por 2,7 segundos — o tempo que a contagem
     * levaria para começar — e um zero no lugar de um número é o único estado
     * pior do que uma animação indesejada. Visto na captura reduzida.
     */
    const reduzido = !!window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches;
    const espera = reduzido ? 0 : atraso;
    const relogio = setTimeout(() => {
      if (reduzido) {
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
    }, espera);

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

/* ═══════════════════════════════════════════════════════ os arquétipos (10/09) */

export type LinhaDeLeitura = { texto: string; chave?: boolean };

/**
 * A LEITURA — a conclusão da folha, na base, como a leitura de um instrumento.
 * Linha fina, rótulo LEITURA e a frase em Sans 600 48, linha a linha por
 * máscara. Qual linha é a CHAVE (em teal) é decisão editorial por folha.
 */
export function Leitura({
  linhas,
  atraso = 900,
  rotuloDo = "Leitura",
}: {
  linhas: readonly LinhaDeLeitura[];
  atraso?: number;
  rotuloDo?: string;
}) {
  return (
    <div className="ap-leitura">
      <Entra atraso={atraso}>
        <span className="ap-mono-rotulo">{rotuloDo}</span>
      </Entra>
      <p className="ap-leitura__frase">
        {linhas.map((l, i) => (
          <span
            key={l.texto}
            className={
              l.chave ? "ap-mascara ap-leitura__linha--chave" : "ap-mascara"
            }
          >
            <span
              className="ap-linha"
              style={{ animationDelay: `${atraso + 160 + i * 140}ms` }}
            >
              {l.texto}
            </span>
          </span>
        ))}
      </p>
    </div>
  );
}

export type Fato = {
  /** Título em linhas deliberadas. */
  titulo: readonly string[];
  texto?: ReactNode;
  /** Cor do título (padrão: foreground). */
  cor?: string;
  /** O que vem depois do texto: uma frase colorida, uma lista Mono. */
  extra?: ReactNode;
};

/**
 * ESCALA HORIZONTAL — fatos em linha, ticks embaixo. A linha se desenha, os
 * ticks aparecem, e só então os fatos assentam, em cascata da esquerda para a
 * direita.
 */
export function EscalaHorizontal({
  fatos,
  atraso = 200,
  tracejada = false,
  compacta = false,
  style,
}: {
  fatos: readonly Fato[];
  atraso?: number;
  tracejada?: boolean;
  compacta?: boolean;
  style?: CSSProperties;
}) {
  const classes = [
    "ap-escala-h",
    tracejada ? "ap-escala-h--tracejada" : "",
    compacta ? "ap-escala-h--compacta" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} style={style}>
      {fatos.map((f, i) => (
        <div key={f.titulo.join(" ")} className="ap-escala-h__fato">
          <p
            className="ap-escala-h__titulo"
            style={f.cor ? { color: f.cor } : undefined}
          >
            <Linhas linhas={f.titulo} atraso={atraso + 320 + i * 160} />
          </p>
          {f.texto ? (
            <Entra atraso={atraso + 440 + i * 160}>
              <p className="ap-escala-h__texto">{f.texto}</p>
            </Entra>
          ) : null}
          {f.extra ? (
            <Entra atraso={atraso + 560 + i * 160}>{f.extra}</Entra>
          ) : null}
          <span
            aria-hidden="true"
            className="ap-escala-h__tick ap-escala-h__tick--inicio ap-surge"
            style={{ animationDelay: `${atraso + 200}ms` }}
          />
          {i === fatos.length - 1 ? (
            <span
              aria-hidden="true"
              className="ap-escala-h__tick ap-escala-h__tick--fim ap-surge"
              style={{ animationDelay: `${atraso + 200}ms` }}
            />
          ) : null}
        </div>
      ))}
      <span
        aria-hidden="true"
        className="ap-escala-h__linha ap-risca"
        style={{ animationDelay: `${atraso}ms` }}
      />
    </div>
  );
}

export type ItemDaEscala = { titulo: string; texto?: string; cor?: string };

/**
 * ESCALA VERTICAL — leituras numeradas de altura igual. A linha desce
 * (`ap-desce`), os ticks aparecem, e as leituras assentam de cima para baixo.
 */
export function EscalaVertical({
  itens,
  atraso = 200,
  inicio = 1,
  numerada = true,
  style,
}: {
  itens: readonly ItemDaEscala[];
  atraso?: number;
  inicio?: number;
  numerada?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className="ap-escala-v" style={style}>
      <span
        aria-hidden="true"
        className="ap-escala-v__linha ap-desce"
        style={{ animationDelay: `${atraso}ms` }}
      />
      {itens.map((item, i) => (
        <div key={item.titulo} className="ap-escala-v__item">
          <span
            className="ap-escala-v__numero ap-surge"
            style={{ animationDelay: `${atraso + 200}ms`, color: item.cor }}
          >
            {numerada ? String(inicio + i).padStart(2, "0") : ""}
          </span>
          <span
            aria-hidden="true"
            className="ap-escala-v__tick ap-surge"
            style={{
              animationDelay: `${atraso + 200}ms`,
              background: item.cor,
            }}
          />
          <div className="ap-escala-v__corpo">
            <p
              className="ap-escala-v__titulo"
              style={item.cor ? { color: item.cor } : undefined}
            >
              <Linhas linhas={[item.titulo]} atraso={atraso + 320 + i * 160} />
            </p>
            {item.texto ? (
              <Entra atraso={atraso + 440 + i * 160}>
                <p className="ap-escala-v__texto">{item.texto}</p>
              </Entra>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * O CONFRONTO — a folha de objeção. A pergunta, com as palavras do comprador,
 * em Mono à esquerda (mono é o que os OUTROS dizem); as respostas como leituras
 * numeradas à direita; a leitura final na base. Sem `pergunta`, a esquerda traz
 * o título e a linha fina (a folha 16 afirma em vez de responder).
 */
export function Confronto({
  pergunta,
  titulo,
  linhaFina,
  respostas,
  leitura,
}: {
  pergunta?: string;
  titulo?: string;
  linhaFina?: string;
  respostas: readonly (readonly [string, string])[];
  leitura: readonly LinhaDeLeitura[];
}) {
  const longa = (pergunta?.length ?? 0) > 160;
  return (
    <>
      <div className="ap-confronto">
        <div className="ap-confronto__esquerda">
          {pergunta ? (
            <>
              <Entra atraso={0}>
                <span className="ap-mono-rotulo">A pergunta</span>
              </Entra>
              <Entra atraso={120}>
                <p
                  className={
                    longa
                      ? "ap-confronto__pergunta ap-confronto__pergunta--longa"
                      : "ap-confronto__pergunta"
                  }
                >
                  {`“${pergunta}”`}
                </p>
              </Entra>
            </>
          ) : (
            <>
              <p className="ap-titulo-de-fato">
                <Linhas linhas={[titulo ?? ""]} atraso={0} />
              </p>
              {linhaFina ? (
                <Entra atraso={140}>
                  <p className="ap-texto" style={{ marginTop: 16 }}>
                    {linhaFina}
                  </p>
                </Entra>
              ) : null}
            </>
          )}
        </div>
        <div className="ap-confronto__direita">
          <EscalaVertical
            atraso={300}
            itens={respostas.map(([t, x]) => ({ titulo: t, texto: x }))}
          />
        </div>
      </div>
      <Leitura
        linhas={leitura}
        atraso={300 + 320 + respostas.length * 160 + 200}
      />
    </>
  );
}

/** O MOSTRADOR — um valor em Mono 80 sobre o rótulo, com a régua de 1 px à esquerda. */
export function Mostrador({
  valor,
  rotuloDo,
  cor,
  atraso,
}: {
  valor: ReactNode;
  rotuloDo: string;
  cor?: string;
  atraso: number;
}) {
  return (
    <div className="ap-mostrador">
      <span
        className="ap-mascara ap-mostrador__valor"
        style={cor ? { color: cor } : undefined}
      >
        <span className="ap-linha" style={{ animationDelay: `${atraso}ms` }}>
          {valor}
        </span>
      </span>
      <Entra atraso={atraso + 120}>
        <span
          className="ap-mono-rotulo"
          style={{ display: "block", marginTop: 16 }}
        >
          {rotuloDo}
        </span>
      </Entra>
    </div>
  );
}
