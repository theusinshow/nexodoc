import { NumeroQueChega } from "nexo-ds";

const rotulo = { fontSize: 13, color: "var(--ds-text-tertiary)" };
const numero = { fontSize: 32, fontWeight: 300, letterSpacing: "-0.035em", color: "var(--ds-text-primary)" };

export const Metricas = () => (
  <div style={{ padding: 24, display: "flex", gap: 40 }}>
    <div style={{ display: "grid", gap: 4 }}>
      <span style={numero}>
        <NumeroQueChega valor={1284} />
      </span>
      <span style={rotulo}>folhas lidas</span>
    </div>
    <div style={{ display: "grid", gap: 4 }}>
      <span style={numero}>
        <NumeroQueChega valor={37} />
      </span>
      <span style={rotulo}>achados confirmados</span>
    </div>
  </div>
);
