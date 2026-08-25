"use client";

/**
 * A MALHA — o campo de pontos que responde à sonda.
 *
 * Referência: o `DotGrid` do React Bits. Como no [[campo-neural]], o que vem de
 * lá é a IDEIA (uma grade de pontos que acende e cede sob o ponteiro) e a
 * disciplina de performance; o desenho e a física são próprios. Os parâmetros da
 * demo — pontos gordos, roxo cheio, arremesso longo — leem como brinquedo, e
 * este produto não é um.
 *
 * POR QUE ELA PODE FICAR NA MESMA TELA QUE O ORBE, e o campo neural não:
 *
 *   EM REPOUSO ESTA MALHA NÃO SE MEXE. Nem um pixel, e o laço de animação nem
 *   está rodando — ele só liga quando o ponteiro entra e desliga sozinho quando
 *   o último ponto volta ao lugar.
 *
 * A regra do §6 é sobre movimento AUTÔNOMO (a emenda de 16/08/2026, citada em
 * `AgentOrb.tsx`): duas coisas que se mexem SOZINHAS disputam a atenção, e o
 * orbe é quem tem algo a dizer. Reação ao ponteiro é outro canal — é a pessoa
 * mexendo a própria mão, e ela sabe que foi ela. O hover da marca viva já vive
 * dessa mesma distinção.
 *
 * E ela é CANVAS 2D, não WebGL, de propósito: o orbe já gasta o contexto GL
 * desta tela, e o navegador conta quantos existem ao mesmo tempo.
 *
 * O ACENTO NÃO ENTRA AQUI. O ponto aceso sobe em LUMINÂNCIA, nunca em matiz —
 * teal significa interativo (§2, regra do acento único) e esta malha não se
 * clica. O instrumento ilumina onde a sonda passa; não pinta.
 */

import { useEffect, useRef } from "react";

type Ponto = {
  /** Origem na grade. É para cá que ele sempre volta. */
  ox: number;
  oy: number;
  /** Deslocamento atual e velocidade, em px. */
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  /** Brilho amortecido 0..1 — o que a sonda acende. */
  luz: number;
};

type Cor = [number, number, number, number];

/**
 * Lê uma cor do CSS e devolve `[r, g, b, a]`. Aceita as duas formas que os
 * tokens consumidos aqui usam: `#rrggbb` e `rgb(r g b / a)`.
 *
 * `oklab()`/`color-mix()` NÃO passam por este regex, e é uma armadilha conhecida
 * desta base. Se algum dos dois tokens virar função de cor, o padrão entra e o
 * efeito some em silêncio — por isso os padrões abaixo são os valores REAIS de
 * `globals.css`, e não zeros de cortesia.
 */
function lerCor(nome: string, padrao: Cor): Cor {
  if (typeof window === "undefined") return padrao;
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();

  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = Number.parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }

  const rgb =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/i.exec(v);
  if (rgb) {
    return [
      Number(rgb[1]),
      Number(rgb[2]),
      Number(rgb[3]),
      rgb[4] === undefined ? 1 : Number(rgb[4]),
    ];
  }

  return padrao;
}

/** Volume global de movimento. Em `prefers-reduced-motion` ele vale 0. */
function ganhoDeMovimento(): number {
  const v = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--motion-gain"),
  );
  return Number.isFinite(v) ? v : 1;
}

export function MalhaDeSondagem({
  /**
   * Distância entre pontos e raio do ponto, em px. Os dois saíram de uma conta,
   * não do olho — e a conta é o que impede esta malha de ser um downgrade.
   *
   * A grade que ela substituiu eram duas famílias de linha de 1px a cada 56px,
   * a 13,5% de alfa efetivo: 3,54% dos pixels cobertos, TINTA ≈ 0,0048. A
   * primeira versão daqui (28px, raio 1,2) dava 0,58% de cobertura e tinta
   * 0,0011 — um QUARTO do que havia antes. Numa tela que o pedido chamou de
   * vazia, isso é andar para trás, e aparece: em repouso não se via nada.
   *
   * 24px com raio 1,6 dá 1,40% de cobertura, e a 30% de alfa do
   * `--nexodoc-grid` fecha em tinta 0,0042 — paridade com a grade antiga.
   *
   * Este é o motivo de a densidade estar aqui em números e não num palpite:
   * intensidade fina eu não escolho por captura de tela (as fotos desta máquina
   * mentem sobre alfa baixo), mas COBERTURA é geometria, e geometria se mede.
   * O que sobra de gosto — o quanto o campo inteiro pesa — mora na `opacity` do
   * `.login-malha`, que é o único botão a girar, e num monitor de verdade.
   */
  espacamento = 24,
  raio = 1.6,
  /** Alcance da sonda, em px. Fora dele o ponto não sabe que o ponteiro existe. */
  alcance = 132,
  className,
}: {
  espacamento?: number;
  raio?: number;
  alcance?: number;
  className?: string;
}) {
  const caixa = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const alvo = caixa.current;
    if (!alvo) return;

    const canvas = document.createElement("canvas");
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    alvo.appendChild(canvas);

    let pontos: Ponto[] = [];
    let largura = 0;
    let altura = 0;

    const base = lerCor("--nexodoc-grid", [60, 70, 75, 0.3]);
    const aceso = lerCor("--muted-foreground", [142, 155, 163, 1]);

    /* Ponteiro em coordenadas da caixa. `-1e4` é "longe de tudo": o repouso
       precisa de um valor que nenhum ponto alcance, e não de um `null` que cada
       conta do laço teria de checar. */
    let px = -1e4;
    let py = -1e4;
    let dentro = false;

    const medir = () => {
      const r = alvo.getBoundingClientRect();
      largura = Math.max(1, Math.round(r.width));
      altura = Math.max(1, Math.round(r.height));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(largura * dpr);
      canvas.height = Math.round(altura * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      /* A grade é CENTRADA na caixa, não ancorada no canto: com o painel
         mudando de largura entre breakpoints, ancorar à esquerda faria a coluna
         de pontos deslizar sob o orbe a cada resize. */
      const colunas = Math.floor(largura / espacamento) + 2;
      const linhas = Math.floor(altura / espacamento) + 2;
      const sobraX = (largura - (colunas - 1) * espacamento) / 2;
      const sobraY = (altura - (linhas - 1) * espacamento) / 2;

      pontos = [];
      for (let l = 0; l < linhas; l++) {
        for (let c = 0; c < colunas; c++) {
          pontos.push({
            ox: sobraX + c * espacamento,
            oy: sobraY + l * espacamento,
            dx: 0,
            dy: 0,
            vx: 0,
            vy: 0,
            luz: 0,
          });
        }
      }
    };

    const corDeRepouso = `rgba(${base[0]}, ${base[1]}, ${base[2]}, ${base[3]})`;
    const TAU = Math.PI * 2;

    /**
     * O DESENHO É EM DOIS PASSES, e não um `fill` por ponto.
     *
     * A 24px de passo um painel de 1485×1440 tem ~3.800 pontos, e a esmagadora
     * maioria deles está apagada e no lugar em qualquer quadro — só o punhado
     * sob a sonda difere. Todos os apagados compartilham a MESMA cor, então
     * cabem num caminho só, com um `fillStyle` e um `fill`. Só os acesos pagam
     * chamada individual.
     *
     * Sem isso a densidade que a conta de tinta pede (acima) custaria 3.800
     * trocas de estado por quadro, e a malha viraria justamente o que ela não
     * pode ser nesta tela: um segundo consumidor de quadro ao lado do orbe.
     */
    const pintar = () => {
      ctx.clearRect(0, 0, largura, altura);

      ctx.fillStyle = corDeRepouso;
      ctx.beginPath();
      for (const p of pontos) {
        if (p.luz > 0.004) continue;
        ctx.moveTo(p.ox + p.dx + raio, p.oy + p.dy);
        ctx.arc(p.ox + p.dx, p.oy + p.dy, raio, 0, TAU);
      }
      ctx.fill();

      for (const p of pontos) {
        const t = p.luz;
        if (t <= 0.004) continue;
        /* Só a LUMINÂNCIA e o alfa sobem — o ponto aceso e o ponto em repouso
           são a mesma família neutra. Ver o cabeçalho. */
        const r = base[0] + (aceso[0] - base[0]) * t;
        const g = base[1] + (aceso[1] - base[1]) * t;
        const b = base[2] + (aceso[2] - base[2]) * t;
        const a = base[3] + (aceso[3] - base[3]) * t;
        ctx.beginPath();
        ctx.arc(p.ox + p.dx, p.oy + p.dy, raio + t * 1.1, 0, TAU);
        ctx.fillStyle = `rgba(${r.toFixed(0)}, ${g.toFixed(0)}, ${b.toFixed(0)}, ${a.toFixed(3)})`;
        ctx.fill();
      }
    };

    let quadro = 0;
    let rodando = false;
    let anterior = 0;

    const passo = (agora: number) => {
      const dt = Math.min((agora - anterior) / 1000, 0.05);
      anterior = agora;

      let inquieto = false;
      const alcance2 = alcance * alcance;

      for (const p of pontos) {
        const ax = p.ox + p.dx - px;
        const ay = p.oy + p.dy - py;
        const d2 = ax * ax + ay * ay;

        /* Alvo de luz: 1 sob o ponteiro, 0 na borda do alcance, com queda
           quadrática — a queda linear deixa um contorno de disco visível, e
           instrumento não tem contorno de foco. */
        let alvoLuz = 0;
        if (dentro && d2 < alcance2) {
          const k = 1 - Math.sqrt(d2) / alcance;
          alvoLuz = k * k;

          /* O ponto CEDE, não foge: poucos pixels para fora, proporcionais à
             proximidade. É a superfície reconhecendo a sonda, não o campo se
             desmanchando. */
          const d = Math.max(Math.sqrt(d2), 0.001);
          const forca = k * k * 260;
          p.vx += (ax / d) * forca * dt;
          p.vy += (ay / d) * forca * dt;
        }

        /* Acender é rápido (a sonda chegou); apagar é lento (o rastro é o que
           conta a passagem). Uma taxa só faria as duas metades mentirem. */
        const taxa = alvoLuz > p.luz ? 14 : 4.5;
        p.luz += (alvoLuz - p.luz) * Math.min(1, taxa * dt);

        /* Mola de volta à origem, com atrito alto: o ponto volta sem oscilar,
           que é a diferença entre um instrumento e uma gelatina. */
        p.vx += -p.dx * 190 * dt;
        p.vy += -p.dy * 190 * dt;
        p.vx *= Math.exp(-9 * dt);
        p.vy *= Math.exp(-9 * dt);
        p.dx += p.vx * dt;
        p.dy += p.vy * dt;

        if (
          p.luz > 0.002 ||
          Math.abs(p.dx) > 0.05 ||
          Math.abs(p.dy) > 0.05 ||
          Math.abs(p.vx) > 0.5 ||
          Math.abs(p.vy) > 0.5
        ) {
          inquieto = true;
        } else {
          p.dx = 0;
          p.dy = 0;
          p.vx = 0;
          p.vy = 0;
          p.luz = 0;
        }
      }

      pintar();

      /* O LAÇO SE DESLIGA SOZINHO, e é esta linha que sustenta a afirmação do
         cabeçalho: em repouso não há `rAF` pendente. Sem ela a malha seria
         movimento autônomo de baixa amplitude — exatamente o que o §6 proíbe ao
         lado do orbe — e ainda cobraria bateria numa tela que fica aberta. */
      if (inquieto || dentro) {
        quadro = requestAnimationFrame(passo);
      } else {
        rodando = false;
        pintar();
      }
    };

    const acordar = () => {
      if (rodando || document.hidden) return;
      rodando = true;
      anterior = performance.now();
      quadro = requestAnimationFrame(passo);
    };

    /* Ponteiro no WINDOW, não no canvas: a caixa é `pointer-events: none` para
       não roubar clique nenhum do painel, e um elemento que não recebe evento
       também não recebe `pointermove`. */
    const mover = (e: PointerEvent) => {
      /* MOVIMENTO REDUZIDO DEIXA A GRADE PARADA. Ela não some — aqui a malha é a
         textura do painel, não um efeito extra como o campo neural; some a
         REAÇÃO, que é o que foi pedido. */
      if (ganhoDeMovimento() === 0) return;
      /* PAINEL ESCONDIDO NAO CUSTA NADA. Abaixo de 1024px o `.login-media-panel`
         e `display: none` e a caixa mede zero, entao a malha nao esta na tela —
         mas o ouvinte esta no `window` e ouviria cada movimento do dedo. */
      if (largura <= 1) return;
      const r = alvo.getBoundingClientRect();
      px = e.clientX - r.left;
      py = e.clientY - r.top;
      dentro =
        px >= -alcance && px <= largura + alcance && py >= -alcance && py <= altura + alcance;
      if (dentro) acordar();
    };

    const sair = () => {
      dentro = false;
      px = -1e4;
      py = -1e4;
    };

    medir();
    pintar();

    const observadorDeTamanho = new ResizeObserver(() => {
      medir();
      if (!rodando) pintar();
    });
    observadorDeTamanho.observe(alvo);
    window.addEventListener("pointermove", mover, { passive: true });
    document.addEventListener("pointerleave", sair);
    window.addEventListener("blur", sair);

    return () => {
      cancelAnimationFrame(quadro);
      observadorDeTamanho.disconnect();
      window.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", sair);
      window.removeEventListener("blur", sair);
      canvas.remove();
    };
  }, [espacamento, raio, alcance]);

  return (
    <div
      ref={caixa}
      aria-hidden
      data-malha-de-sondagem=""
      className={className}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}
