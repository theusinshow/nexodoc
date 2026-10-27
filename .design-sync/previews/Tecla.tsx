import { Tecla } from "nexo-ds";

const linha = { display: "flex", gap: 10, alignItems: "center", color: "var(--ds-text-secondary)", fontSize: 14 };

export const Atalhos = () => (
  <div style={{ padding: 24, display: "grid", gap: 12 }}>
    <span style={linha}>
      Buscar obra, código ou ação <Tecla>Ctrl K</Tecla>
    </span>
    <span style={linha}>
      Próximo achado <Tecla>J</Tecla> anterior <Tecla>K</Tecla>
    </span>
    <span style={linha}>
      Abrir no memorial <Tecla>↵</Tecla>
    </span>
  </div>
);
