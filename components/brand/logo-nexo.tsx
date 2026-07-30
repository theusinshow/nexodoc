import { cn } from "@/lib/utils";

/**
 * A marca do Nexo: o orbe do agente, achatado.
 *
 * SVG INLINE, não `<img>`, por um motivo: a marca precisa reagir ao mouse, e o
 * miolo de uma imagem externa é inalcançável por CSS. Aqui o nó gira devagar no
 * hover — o mesmo movimento do estado `idle` do orbe vivo, na mesma direção e
 * no mesmo ritmo, para as duas leituras serem reconhecidas como o mesmo objeto.
 *
 * Em repouso ele fica PARADO. Marca que se mexe sozinha vira decoração, e o
 * único elemento autorizado a respirar continuamente neste sistema é o orbe do
 * palco, que está dizendo o que o agente faz.
 *
 * `prefers-reduced-motion` desliga o giro — sem perder nada, porque o
 * movimento aqui não carrega informação.
 *
 * O arquivo `public/assets/logo.svg` continua existindo para favicon e
 * metadados, onde não há React nem CSS.
 */
export function LogoNexo({
  size = 32,
  className,
  /** Palavra "Nexo" ao lado do símbolo. */
  comPalavra = false,
  /** Liga o giro no hover. Desligue onde a marca não é interativa. */
  interativa = true,
}: {
  size?: number;
  className?: string;
  comPalavra?: boolean;
  interativa?: boolean;
}) {
  /*
   * O traço compensa o tamanho: em 16px o nó fecha e vira um borrão. A escala
   * do sistema é 1,5 (grande) · 1,75 (médio) · 2 (mínimo).
   */
  const traco = size >= 40 ? 1.5 : size >= 20 ? 1.75 : 2;

  const simbolo = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={traco}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Nexo"
      className={cn("shrink-0 text-[var(--nexodoc-accent)]", interativa && "nexo-logo")}
    >
      <circle cx="12" cy="12" r="10.25" />
      {/* O nó: é ele que gira. O círculo fica parado — é a esfera. */}
      <path
        className="nexo-logo__no"
        d="M12 12c-1.9-2.6-3.6-3.9-5-3.9-1.7 0-2.8 1.6-2.8 3.9s1.1 3.9 2.8 3.9c1.4 0 3.1-1.3 5-3.9Zm0 0c1.9-2.6 3.6-3.9 5-3.9 1.7 0 2.8 1.6 2.8 3.9s-1.1 3.9-2.8 3.9c-1.4 0-3.1-1.3-5-3.9Z"
      />
    </svg>
  );

  if (!comPalavra) {
    return <span className={className}>{simbolo}</span>;
  }

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {simbolo}
      <span
        className="font-semibold tracking-[-0.035em]"
        style={{ fontSize: Math.round(size * 0.72) }}
      >
        Nexo
      </span>
    </span>
  );
}
