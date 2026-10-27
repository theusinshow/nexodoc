import { Esqueleto } from "nexo-ds";

export const Lista = () => (
  <div style={{ padding: 24, display: "grid", gap: 14, width: 360 }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{ display: "grid", gap: 8, padding: 14, borderRadius: 12, background: "var(--ds-surface-card)", boxShadow: "var(--ds-edge)" }}>
        <Esqueleto largura={220} altura={14} />
        <Esqueleto largura="100%" altura={10} />
        <Esqueleto largura={140} altura={10} />
      </div>
    ))}
  </div>
);
