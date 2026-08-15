"use client";

/**
 * Bancada do ambiente — a luz, a lâmina e a grade numa tela só, com o volume na
 * mão.
 *
 * Existe pelo mesmo motivo das outras duas bancadas: os três efeitos moram em
 * lugares específicos do produto (o cartão de achado dentro de uma auditoria, a
 * tela de progresso enquanto ela roda, a área de upload), e avaliar intensidade
 * abrindo o produto exige reproduzir três situações diferentes. Aqui estão lado
 * a lado, sem login e sem disparar IA.
 *
 * O CONTROLE DE VOLUME é o ponto: `--motion-gain` foi feito para afinar o
 * sistema inteiro de um lugar só, e afinar sem ver não é afinar. O seletor
 * escreve o token no `<main>`, então tudo abaixo dele responde junto — que é
 * exatamente como ele se comporta no produto, onde quem escreve é o `:root`.
 */
import { useState } from "react";
import dynamic from "next/dynamic";

import { useSpotlight } from "@/lib/use-spotlight";

/*
 * `ssr: false` não é zelo: o `ogl` toca `window` ao carregar, e `"use client"`
 * NÃO impede o Next de executar o módulo no servidor — foi assim que o
 * `react-pdf` derrubou o servidor nesta base em 13/08.
 */
const CampoNeural = dynamic(
  () => import("@/components/ambiente/campo-neural").then((m) => m.CampoNeural),
  { ssr: false },
);

const VOLUMES = [
  { valor: 0, rotulo: "0 — desligado" },
  { valor: 0.5, rotulo: "0,5 — metade" },
  { valor: 1, rotulo: "1 — padrão" },
  { valor: 1.6, rotulo: "1,6 — exagerado" },
] as const;

/** Frases reais da tela de progresso da auditoria. */
const FRASES = [
  "Recebendo PDFs e preparando leitura",
  "Extraindo texto e identidade global",
  "Auditando LD, selos, pranchas e consistência do volume",
];

export default function BancadaDoAmbiente() {
  const [gain, setGain] = useState<number>(1);
  const moverLuz = useSpotlight();

  return (
    <main
      className="flex min-h-screen flex-col gap-10 bg-background p-10"
      style={{ "--motion-gain": gain } as React.CSSProperties}
    >
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="font-mono text-xs font-medium uppercase tracking-[0.1em] text-muted-foreground">
          Bancada do ambiente
        </h1>
        <div className="flex flex-wrap gap-2" data-prova="volumes">
          {VOLUMES.map((v) => (
            <button
              key={v.valor}
              type="button"
              data-prova={`gain-${v.valor}`}
              aria-pressed={gain === v.valor}
              onClick={() => setGain(v.valor)}
              className={`nx-cut-4 px-3 py-1.5 font-mono text-xs tabular-nums transition-colors ${
                gain === v.valor
                  ? "bg-primary text-primary-foreground"
                  : "bg-[var(--nexodoc-raised)] text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.rotulo}
            </button>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          --motion-gain: {gain}
        </p>
      </header>

      {/* --- A LUZ ---------------------------------------------------------
          Dois pares: com chanfro e com raio. É a comparação que importa,
          porque o recorte da luz vem de fontes diferentes nos dois casos — o
          `clip-path` num, o `border-radius: inherit` no outro — e um deles
          falhando passa despercebido sem o vizinho ao lado. */}
      <section className="flex flex-col gap-3" data-prova="luz">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          A luz · passe o cursor
        </h2>
        <div className="flex flex-wrap gap-4">
          <article
            data-prova="luz-chanfro"
            onPointerMove={moverLuz}
            className="nx-edge-6 nx-spot h-40 w-72 p-4"
          >
            <p className="text-sm font-medium">Superfície com chanfro</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              O corte superior-esquerdo e inferior-direito recorta a luz sozinho:
              o <code className="font-mono">clip-path</code> vale para o elemento
              inteiro, pseudo-elemento incluído.
            </p>
          </article>

          <article
            data-prova="luz-raio"
            onPointerMove={moverLuz}
            className="nx-spot h-40 w-72 rounded-md border bg-card p-4"
          >
            <p className="text-sm font-medium">Superfície com raio</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              É o cartão de achado de hoje. Aqui quem recorta a luz é o{" "}
              <code className="font-mono">border-radius: inherit</code> — sem
              ele, o brilho sai quadrado sobre o canto redondo.
            </p>
          </article>

          <article
            data-prova="luz-ausente"
            className="h-40 w-72 rounded-md border bg-card p-4"
          >
            <p className="text-sm font-medium">Sem a luz</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              O controle. Se a diferença para os dois de cima não for visível, o
              efeito está fraco demais para existir.
            </p>
          </article>
        </div>
      </section>

      {/* --- A LÂMINA ------------------------------------------------------ */}
      <section className="flex flex-col gap-3" data-prova="lamina">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          A lâmina · trabalho em curso
        </h2>
        <div className="nx-edge-6 flex max-w-[620px] flex-col gap-2 p-4">
          {FRASES.map((frase) => (
            <p key={frase} data-prova="frase" className="nx-shiny font-medium text-foreground">
              {frase}
            </p>
          ))}
          <p className="mt-1 text-xs leading-snug text-muted-foreground">
            A frase tem de continuar legível com a lâmina longe dela — as pontas
            do gradiente são a cor do próprio texto, e é isso que impede que ela
            suma entre uma passada e outra.
          </p>
        </div>
      </section>

      {/* --- O CAMPO -------------------------------------------------------
          Duas caixas, e a segunda é a que importa: o campo com texto por cima.
          Um fundo que só é bonito vazio não serve — todo lugar do produto onde
          ele pode entrar tem conteúdo em cima. */}
      <section className="flex flex-col gap-3" data-prova="campo">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          O campo · atmosfera, nunca ao lado do orbe
        </h2>
        <div className="flex flex-wrap gap-4">
          <div
            data-prova="campo-vazio"
            className="nx-edge-6 relative h-56 w-[380px] overflow-hidden"
          >
            <CampoNeural />
            <p className="absolute bottom-3 left-4 font-mono text-[11px] text-muted-foreground">
              o campo sozinho
            </p>
          </div>

          <div
            data-prova="campo-com-texto"
            className="nx-edge-6 relative h-56 w-[380px] overflow-hidden p-5"
          >
            <CampoNeural />
            <div className="relative">
              <p className="text-base font-medium">Nenhum projeto por aqui ainda</p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                É o estado vazio: a tela ensina o que aparece aqui e como. Se o
                campo atrás atrapalhar a leitura desta frase, ele está forte
                demais — o número a mexer é a opacidade, não o texto.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* --- A GRADE ------------------------------------------------------- */}
      <section className="flex flex-col gap-3" data-prova="grade">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          A grade · área de documento
        </h2>
        <div className="flex flex-wrap gap-4">
          <div
            data-prova="grade-24"
            className="nx-dotgrid flex h-40 w-72 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
          >
            passo de 24px (o padrão)
          </div>
          <div
            data-prova="grade-16"
            style={{ "--dotgrid-step": "16px" } as React.CSSProperties}
            className="nx-dotgrid flex h-40 w-72 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground"
          >
            passo de 16px
          </div>
          <div
            data-prova="grade-sobre-texto"
            className="nx-dotgrid h-40 w-72 rounded-md border p-4"
          >
            <p className="text-sm font-medium">Grade sob texto</p>
            <p className="mt-1 text-xs leading-snug text-muted-foreground">
              A prova real da emenda à linha d&apos;água: se esta frase ficar mais
              difícil de ler do que a mesma frase sem grade, a emenda estava
              errada e a grade não desce até o dado.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
