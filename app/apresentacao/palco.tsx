"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import "./palco.css";

export interface Slide {
  /** Rótulo curto, para as notas e para o índice. */
  rotulo: string;
  /** O que aparece no trilho: "01".."19" no deck, "A".."F" no anexo. */
  numero: string;
  /** O bloco narrativo a que o slide pertence. Vazio na capa. */
  bloco?: string;
  /** O rótulo-título da folha, em caixa de frase (o CSS põe em caixa alta). Vazio na capa. */
  titulo?: string;
  /** Nome de arquivo ou subtítulo que acompanha o rótulo-título, sem caixa alta. */
  subtitulo?: string;
  /** O que o apresentador fala e o slide NÃO mostra. */
  notas: string;
  corpo: ReactNode;
}

/**
 * O MOTOR DE SLIDES. Teclado primeiro, porque é assim que se apresenta: a mão
 * fica no controle remoto ou na seta, nunca no mouse.
 *
 * `Espaço` e `PageDown` avançam junto com a seta porque é o que os apresentadores
 * remotos de sala emitem — um controle Logitech manda PageUp/PageDown, não setas,
 * e um deck que só ouve seta trava na mão de quem usa o controle da empresa.
 */
/** Largura do painel de notas. Precisa bater com `.ap-notas` no CSS. */
const LARGURA_DAS_NOTAS = 460;

/**
 * O TRILHO — os índices de todas as folhas, a corrente acesa e a marca ao lado.
 * Vive fora da <section> da folha: não dissolve na troca, só a marca desliza.
 * `aria-hidden` porque é o mesmo dado que a régua de controle já anuncia.
 */
function Trilho({
  folhas,
  indice,
}: {
  folhas: readonly Slide[];
  indice: number;
}) {
  return (
    <div className="ap-trilho" aria-hidden="true">
      <ol className="ap-trilho__indices">
        {folhas.map((f, i) => (
          <li
            key={f.numero}
            className={
              i === indice
                ? "ap-trilho__indice ap-trilho__indice--atual"
                : "ap-trilho__indice"
            }
          >
            {f.numero}
          </li>
        ))}
      </ol>
      <span
        className="ap-trilho__marca"
        style={{ transform: `translateY(${indice * 40}px)` }}
      />
      <span className="ap-trilho__bloco">{folhas[indice].bloco ?? ""}</span>
    </div>
  );
}

export function Palco({ slides }: { slides: readonly Slide[] }) {
  const [indice, setIndice] = useState(0);
  /*
   * A FOLHA QUE SAI. Fica montada por uma saída curta, por cima da que entra,
   * e depois some. Sem isto a troca é um corte seco — e um corte seco no meio de
   * uma fala parece falha de projetor, não decisão.
   *
   * Ela é renderizada na MESMA lista da folha atual, com a mesma `key` de
   * antes: o React mantém o DOM, e o que já estava no estado final (o número
   * que correu, a linha que se desenhou) continua lá durante a saída em vez de
   * recomeçar do zero por cima do fade.
   */
  const [saindo, setSaindo] = useState<Slide | null>(null);
  const indiceAtual = useRef(0);
  const [notasAbertas, setNotasAbertas] = useState(false);
  const [ponteiroParado, setPonteiroParado] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const moldura = useRef<HTMLDivElement>(null);
  const palco = useRef<HTMLDivElement>(null);

  const atual = slides[indice];

  const mostra = useCallback(
    (alvo: number) => {
      const de = indiceAtual.current;
      const para = Math.min(slides.length - 1, Math.max(0, alvo));
      if (para === de) return;
      indiceAtual.current = para;
      setIndice(para);
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        setSaindo(slides[de]);
      }
    },
    [slides],
  );

  const vai = useCallback(
    (passo: number) => mostra(indiceAtual.current + passo),
    [mostra],
  );

  /* A saída dura `--ap-curta`; o mesmo número mora em palco.css. */
  useEffect(() => {
    if (!saindo) return;
    const relogio = setTimeout(() => setSaindo(null), 260);
    return () => clearTimeout(relogio);
  }, [saindo]);

  /*
   * A ESCALA. `transform: scale()` no palco inteiro, calculada a cada resize e
   * uma vez no monte. Não é CSS puro porque `scale()` precisa de um número, e o
   * número depende de duas razões (largura e altura) das quais vale a MENOR —
   * `min()` com unidades de viewport chega perto, mas erra quando há barra de
   * rolagem ou barra de ferramentas do navegador em cima.
   */
  useEffect(() => {
    function ajusta() {
      const alvo = palco.current;
      if (!alvo) return;
      /*
       * As notas ROUBAM LARGURA do palco, e não podem cobri-lo: no ensaio se lê
       * o slide e a nota ao mesmo tempo, e um painel por cima do slide obriga a
       * fechar para conferir o que se ia dizer sobre ele. Visto na tela, com o
       * painel tapando a coluna esquerda de um slide em duas colunas.
       */
      const largura =
        window.innerWidth - (notasAbertas ? LARGURA_DAS_NOTAS : 0);
      const escala = Math.min(largura / 1920, window.innerHeight / 1080);
      alvo.style.transform = `scale(${escala})`;
      // A moldura assume o tamanho já escalado — ver o comentário em palco.css.
      if (moldura.current) {
        moldura.current.style.width = `${1920 * escala}px`;
        moldura.current.style.height = `${1080 * escala}px`;
      }
    }

    ajusta();
    window.addEventListener("resize", ajusta);
    return () => window.removeEventListener("resize", ajusta);
  }, [notasAbertas]);

  useEffect(() => {
    function tecla(evento: KeyboardEvent) {
      // Modificador pressionado é atalho do navegador, não do deck.
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;

      switch (evento.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          evento.preventDefault();
          vai(1);
          break;
        case "ArrowLeft":
        case "PageUp":
          evento.preventDefault();
          vai(-1);
          break;
        case "Home":
          evento.preventDefault();
          mostra(0);
          break;
        case "End":
          evento.preventDefault();
          mostra(slides.length - 1);
          break;
        case "n":
        case "N":
          setNotasAbertas((v) => !v);
          break;
        case "f":
        case "F":
          if (document.fullscreenElement) {
            void document.exitFullscreen();
          } else {
            void raiz.current?.requestFullscreen?.();
          }
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [slides.length, vai, mostra]);

  /* A régua some quando o ponteiro para. Três segundos: tempo de uma frase. */
  useEffect(() => {
    let relogio: ReturnType<typeof setTimeout>;

    function acorda() {
      setPonteiroParado(false);
      clearTimeout(relogio);
      relogio = setTimeout(() => setPonteiroParado(true), 3000);
    }

    acorda();
    window.addEventListener("mousemove", acorda);
    return () => {
      window.removeEventListener("mousemove", acorda);
      clearTimeout(relogio);
    };
  }, []);

  return (
    <div className="ap-raiz" data-notas={notasAbertas} ref={raiz}>
      <div className="ap-moldura" ref={moldura}>
        <div className="ap-palco" ref={palco}>
          <Trilho folhas={slides} indice={indice} />
          {(saindo && saindo !== atual ? [saindo, atual] : [atual]).map(
            (folha) => (
              <section
                key={folha.numero}
                aria-hidden={folha !== atual || undefined}
                className={["ap-folha", folha !== atual ? "ap-folha--sai" : ""]
                  .filter(Boolean)
                  .join(" ")}
              >
                {folha.titulo ? (
                  <h2 className="ap-rotulo-titulo">
                    <span>{folha.titulo}</span>
                    {folha.subtitulo ? (
                      <span className="ap-rotulo-titulo__sub">
                        {folha.subtitulo}
                      </span>
                    ) : null}
                  </h2>
                ) : null}
                {folha.corpo}
              </section>
            ),
          )}
        </div>
      </div>

      {notasAbertas ? (
        <aside className="ap-notas">
          <p className="ap-notas-rotulo">
            {atual.numero} · {atual.rotulo}
          </p>
          <h2>Notas do apresentador</h2>
          {/*
            AS NOTAS QUEBRAM EM PARÁGRAFOS. Desde que elas passaram a carregar as
            RÉPLICAS — o que o comprador diz quando a resposta não o satisfaz —
            uma nota tem três ou quatro blocos, e num `<p>` único eles viram uma
            parede de texto que ninguém acha no meio de uma frase. O painel é
            lido de relance, com a sala esperando.
          */}
          {atual.notas.split("\n\n").map((paragrafo) => (
            <p key={paragrafo}>{paragrafo}</p>
          ))}
        </aside>
      ) : null}

      <div className="ap-regua" data-oculta={ponteiroParado}>
        <span className="ap-posicao">
          {indice + 1}/{slides.length}
        </span>
        <span>
          <kbd>←</kbd> <kbd>→</kbd> navegar
        </span>
        <span>
          <kbd>N</kbd> notas
        </span>
        <span>
          <kbd>F</kbd> tela cheia
        </span>
      </div>
    </div>
  );
}
