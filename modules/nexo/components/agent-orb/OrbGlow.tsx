"use client";

/**
 * O ORBE PARADO — o degrau CAPTURADO da escada de reduções (DESIGN.md §6).
 *
 * Serve de fallback (sem WebGL) e de placeholder (enquanto o Canvas carrega).
 *
 * ERA O DEGRAU CSS, e era um objeto diferente. O desenho anterior deste arquivo
 * era um gradiente radial teal — uma bola sólida e acesa —, e o orbe vivo é o
 * contrário disso: uma esfera ESCURA de vidro com o nó aceso por dentro e um
 * aro fino. Quem entrava no Nexo via, nesta ordem: a marca escura no painel, uma
 * bola teal chapada por ~300ms, e então a esfera. Três objetos, não um.
 *
 * A lei do §6 é justamente essa: os degraus "todos têm de ser reconhecíveis como
 * o MESMO OBJETO — é isso que transforma efeito em identidade". Um gradiente
 * desenhado à mão nunca é o mesmo objeto que um shader; é uma lembrança dele. A
 * emenda de 15/08/2026 já tinha resolvido essa mesma discussão para a marca, e a
 * conclusão vale aqui sem mudar uma vírgula: capturar elimina a divergência na
 * origem.
 *
 * Então o placeholder passa a ser o QUADRO do próprio orbe vivo, em repouso — o
 * mesmo arquivo que a `MarcaViva` serve no botão do painel. A viagem inteira
 * vira um objeto só: o orbe do cromo cresce, a página troca, o mesmo orbe está
 * lá maior, e o vivo acende por cima dele.
 *
 * O ARQUIVO É O DE 512, e não o de 2048. Este degrau aparece em `hero`
 * (223–308px) e em `compact` (198px); 512 cobre os dois com folga de retina e
 * pesa 254KB contra 2,2MB. O de 2048 existe para peça impressa.
 *
 * O `inset` DE 12,5% NÃO É CHUTE — é o que faz as duas esferas nascerem do mesmo
 * tamanho, e ele foi MEDIDO, não estimado. O PNG traz 8% de folga em volta da
 * silhueta, e a esfera viva ocupa outra fração do canvas por causa do recuo de
 * câmera do shader; as duas frações não têm por que bater sozinhas. Contando
 * pixels sobre as duas capturas: a 16% (o valor do gradiente antigo) a parada
 * nascia pequena demais, a 10% nascia 7,3% maior que a viva, e a 12,5% elas
 * batem com o centro a 0px de deslocamento.
 *
 * QUEM MEXER NO RECUO DE CÂMERA do `AgentOrbCanvas` desfaz isto, e a tela não
 * vai reclamar — o salto de tamanho só aparece no quadro da troca. O portão
 * `npm run prova:orbe-parado` compara os dois diâmetros e acusa.
 *
 * Continua com custo zero de JS: nenhum three.js, nenhum shader, nenhum estado.
 */
export function OrbGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-[12.5%] rounded-full"
      style={{
        backgroundImage: 'url("/marca/orbe-512.png")',
        backgroundSize: "contain",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}
