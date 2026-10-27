import { Botao, Girando } from "nexo-ds";

export const NoBotao = () => (
  <div style={{ padding: 24, display: "flex", gap: 16, alignItems: "center", color: "var(--ds-text-secondary)", fontSize: 14 }}>
    <Botao disabled>
      <Girando /> Salvando
    </Botao>
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <Girando tamanho={16} rotulo="Enviando" /> Enviando 3 pranchas
    </span>
  </div>
);
