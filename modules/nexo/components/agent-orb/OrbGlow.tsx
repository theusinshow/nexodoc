"use client";

/**
 * A REDUÇÃO EM CSS do orbe (DESIGN.md §6, degrau do meio da escada).
 *
 * Serve de fallback (sem WebGL) e de placeholder (enquanto o Canvas carrega),
 * e é o degrau que o §6 manda usar onde não pode haver um segundo orbe vivo —
 * bolhas, marca inline, qualquer lugar em que three.js seria absurdo.
 *
 * NASCEU INLINE, e havia um segundo desenho do mesmo objeto: `NexoOrb.tsx`,
 * outro gradiente radial teal, sem um único uso no aplicativo. Dois desenhos da
 * mesma coisa é como uma identidade se perde — um deles é afinado, o outro não,
 * e ninguém sabe qual está na tela. O `NexoOrb` foi apagado; este é o degrau
 * CSS oficial, num arquivo que se pode importar.
 *
 * Zero custo: nenhum three.js, nenhum shader, nenhum estado.
 */
export function OrbGlow() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-[16%] rounded-full"
      style={{
        background:
          "radial-gradient(circle at 40% 35%, #5bdac6 0%, #00a693 46%, color-mix(in srgb, #00a693 24%, transparent) 70%, transparent 100%)",
        boxShadow: "0 0 24px color-mix(in srgb, #00a693 40%, transparent)",
      }}
    />
  );
}
