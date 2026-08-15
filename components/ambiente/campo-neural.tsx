"use client";

/**
 * O CAMPO — fios lentos correndo atrás do cromo.
 *
 * Referência: o `Threads` do React Bits. O shader aqui é próprio, e a diferença
 * não é orgulho: os parâmetros da demo (linhas grossas, branco cheio, amplitude
 * alta) leem como papel de parede de landing page, que é exatamente o que este
 * produto não é. O que fica dela é a ideia — fios de ruído atravessando a tela —
 * e a disciplina de performance (um triângulo, pausa fora da viewport).
 *
 * ONDE ELE PODE EXISTIR, e esta é a regra que manda:
 *
 *   NUNCA na mesma tela que o orbe vivo.
 *
 * O §6 do DESIGN.md diz que o orbe é o único elemento do sistema autorizado a
 * ser vivo, e a razão é de leitura, não de gosto: quando duas coisas se mexem, o
 * olho não sabe qual delas está dizendo algo. O orbe DIZ (é a máquina de estados
 * do agente); o campo é atmosfera e não diz nada. Postos juntos, o campo rouba
 * atenção de um sinal — e o sinal é o que o produto vende.
 *
 * Por isso ele vive onde o orbe não está: painel, projetos, volumes, estados
 * vazios grandes. Quem montar isto ao lado de um `<AgentOrb>` está contrariando
 * o sistema, e o comentário existe para essa pessoa.
 */

import { useEffect, useRef } from "react";

/** Vértice: um triângulo só cobrindo a tela. Nada a transformar. */
const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/**
 * Fragmento: N fios horizontais, cada um ondulado por ruído de valor.
 *
 * O ruído é `hash` + interpolação suave em vez de Perlin: a diferença não
 * aparece a 4% de opacidade, e o custo por pixel importa numa superfície que
 * ocupa a tela inteira.
 */
const FRAGMENT = /* glsl */ `
precision mediump float;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uColor;
uniform float uOpacity;

varying vec2 vUv;

const int FIOS = 22;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

/** Ruído de valor 1D, suave o bastante para uma linha não ter quinas. */
float ruido(float x) {
  float i = floor(x);
  float f = fract(x);
  float u = f * f * (3.0 - 2.0 * f);
  return mix(hash(i), hash(i + 1.0), u);
}

/** Três oitavas bastam: a quarta não sobrevive à opacidade. */
float onda(float x) {
  return ruido(x) * 0.5 + ruido(x * 2.17) * 0.3 + ruido(x * 4.31) * 0.2;
}

void main() {
  vec2 uv = vUv;
  float luz = 0.0;

  for (int i = 0; i < FIOS; i++) {
    float fi = float(i);
    /* Cada fio tem semente, velocidade e altura próprias. Sem isso eles andam
       em bloco e o campo vira listra. */
    float semente = fi * 13.37;
    float velocidade = 0.05 + hash(fi) * 0.07;
    /* O ESPACAMENTO E IRREGULAR. Distribuidos em passo exato, os fios saem
       como PAUTA — e pauta e o que se le, por mais que cada linha ondule. O
       empurrao de ate meio passo quebra a grade sem embolar os fios. */
    float base = (fi + 0.5) / float(FIOS) + (hash(fi + 303.0) - 0.5) / float(FIOS) * 0.9;

    /* AMPLITUDE E FREQUENCIA VARIAM POR FIO. A primeira versao dava a todos a
       mesma frequencia (uv.x * 2.6) e amplitude curta: eles saiam PARALELOS, e
       o campo lia como listra — o defeito que o proprio comentario abaixo
       prometia evitar. Ondas de periodos diferentes se cruzam, e e o cruzamento
       que faz a coisa parecer um campo em vez de um pentagrama. */
    float frequencia = 1.3 + hash(fi + 211.0) * 2.4;
    float amplitude = 0.05 + hash(fi + 91.0) * 0.11;
    float deslocamento = onda(uv.x * frequencia + semente + uTime * velocidade) - 0.5;
    float y = base + deslocamento * amplitude;

    /* A espessura acompanha a altura da tela para o fio não engordar em
       janela baixa. */
    /* FIO, NAO TUBO. Era ate 0,003 do lado da caixa, o que numa tela de mil
       pixels de altura vira uma linha de 3px com halo. Aqui o teto e a metade
       disso, e a maioria dos fios fica abaixo dele. */
    float espessura = 0.0006 + hash(fi + 47.0) * 0.0009;
    float d = abs(uv.y - y);
    float linha = smoothstep(espessura * 3.0, 0.0, d);

    /* Desvanece nas bordas laterais: fio cortado a meio caminho denuncia a
       caixa e faz o campo parecer colado por cima, não atrás. */
    float bordas = smoothstep(0.0, 0.18, uv.x) * smoothstep(1.0, 0.82, uv.x);

    luz += linha * bordas * (0.45 + hash(fi + 5.0) * 0.55);
  }

  /* NÃO SE DIVIDE PELO NÚMERO DE FIOS. A primeira versão dividia, e o campo
     saiu invisível na bancada: os fios são finos e não se cruzam, então a soma
     já vale no máximo ~1 num pixel que esteja sobre uma linha — dividir por 18
     levava o pico a 0,05 antes mesmo da opacidade. O que se quer é um TETO,
     para o raro pixel onde dois fios se encontram não estourar. */
  luz = min(luz, 1.0);

  /* DESVANECE NAS DUAS PONTAS. Sumir so para um lado deixava o campo ocupando
     dois tercos da tela de baixo -- e area grande de fundo animado e a definicao
     de papel de parede, que e o que o pedido recusa. Com as duas pontas
     apagadas ele vira uma FAIXA, e faixa se le como atmosfera. */
  luz *= smoothstep(1.0, 0.62, uv.y) * smoothstep(0.0, 0.22, uv.y);

  gl_FragColor = vec4(uColor, luz * uOpacity);
}
`;

/** Lê uma cor `#rrggbb` do CSS e devolve em 0..1, que é o que o shader quer. */
function corDoToken(nome: string, padrao: [number, number, number]): [number, number, number] {
  if (typeof window === "undefined") return padrao;
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(valor);
  if (!m) return padrao;
  const n = Number.parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function CampoNeural({
  /**
   * Teto de opacidade do fio mais aceso. O `--motion-gain` multiplica isto.
   *
   * 0,55 e o piso do que se ENXERGA, e a distancia ate la surpreende: 0,16 nao
   * aparecia na bancada, 0,34 tambem nao. O fio tem 1px e chega ao olho ja
   * atenuado duas vezes — pelo peso do proprio fio e pelo desvanecimento
   * vertical —, entao a opacidade NOMINAL nao e a que se ve. O valor efetivo
   * no fio mais aceso fica perto de 0,25, que e o que se pretende.
   */
  opacidade = 0.22,
  className,
}: {
  opacidade?: number;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo) return;

    /* MOVIMENTO REDUZIDO NÃO MONTA NADA. Não é "anima mais devagar": um campo
       parado ainda é uma superfície a mais para o olho processar, e quem pediu
       menos movimento pediu menos, não outro. */
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let vivo = true;
    let quadro = 0;
    let renderer: { gl: WebGLRenderingContext; setSize: (w: number, h: number) => void; render: (o: unknown) => void } | null =
      null;
    let desmontar: (() => void) | null = null;

    /* `ogl` entra por import dinâmico: ele toca `window` na carga, e "use client"
       NÃO impede o Next de executar o módulo no SSR — a lição que o `react-pdf`
       já deu nesta base (DOMMatrix is not defined). */
    void import("ogl").then(({ Renderer, Program, Mesh, Triangle }) => {
      if (!vivo || !alvo) return;

      const r = new Renderer({
        alpha: true,
        antialias: false,
        // Teto de 1.5: acima disso são mais pixels do que o olho registra num
        // campo a 16% de opacidade, e o custo é quadrático.
        dpr: Math.min(window.devicePixelRatio || 1, 1.5),
      });
      renderer = r as unknown as typeof renderer;
      const gl = r.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.canvas.style.width = "100%";
      gl.canvas.style.height = "100%";
      gl.canvas.style.display = "block";
      alvo.appendChild(gl.canvas);

      const programa = new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uResolution: { value: [1, 1] },
          uColor: { value: corDoToken("--ring", [0.357, 0.855, 0.776]) },
          uOpacity: { value: opacidade },
        },
      });
      const malha = new Mesh(gl, { geometry: new Triangle(gl), program: programa });

      const medir = () => {
        const l = alvo.clientWidth || 1;
        const a = alvo.clientHeight || 1;
        r.setSize(l, a);
        programa.uniforms.uResolution.value = [l, a];
      };
      medir();
      const observadorDeTamanho = new ResizeObserver(medir);
      observadorDeTamanho.observe(alvo);

      /* O VOLUME É LIDO A CADA QUADRO, e de propósito: `--motion-gain` pode
         mudar em tempo de execução (a bancada faz isso), e um valor capturado
         na montagem deixaria o seletor sem efeito sobre o campo. É uma leitura
         de propriedade computada por quadro — barata perto do shader. */
      const ganho = () => {
        const v = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--motion-gain"),
        );
        return Number.isFinite(v) ? v : 1;
      };

      let visivel = true;
      let tocando = false;
      let relogio = 0;
      let anterior = performance.now();

      const desenhar = (agora: number) => {
        quadro = requestAnimationFrame(desenhar);
        const dt = Math.min((agora - anterior) / 1000, 0.05);
        anterior = agora;
        /* O TEMPO É INTEGRADO, não lido do relógio. Mesma razão do respiro do
           orbe: com o relógio valendo centenas de segundos, mudar a velocidade
           saltaria o ruído para outro ponto qualquer e o campo daria um pulo. */
        relogio += dt;
        programa.uniforms.uTime.value = relogio;
        programa.uniforms.uOpacity.value = opacidade * ganho();
        r.render({ scene: malha });
      };

      const acertarLaco = () => {
        const deveria = visivel && !document.hidden;
        if (deveria && !tocando) {
          tocando = true;
          anterior = performance.now();
          quadro = requestAnimationFrame(desenhar);
        } else if (!deveria && tocando) {
          tocando = false;
          cancelAnimationFrame(quadro);
        }
      };

      const observadorDeVista = new IntersectionObserver((entradas) => {
        visivel = entradas.some((e) => e.isIntersecting);
        acertarLaco();
      });
      observadorDeVista.observe(alvo);
      document.addEventListener("visibilitychange", acertarLaco);
      acertarLaco();

      desmontar = () => {
        cancelAnimationFrame(quadro);
        observadorDeTamanho.disconnect();
        observadorDeVista.disconnect();
        document.removeEventListener("visibilitychange", acertarLaco);
        gl.canvas.remove();
        // Devolve o contexto: o navegador limita quantos existem ao mesmo tempo,
        // e trocar de tela várias vezes esgotaria a conta.
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
    });

    return () => {
      vivo = false;
      desmontar?.();
      renderer = null;
    };
  }, [opacidade]);

  return (
    <div
      ref={caixa}
      aria-hidden
      data-campo-neural=""
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
