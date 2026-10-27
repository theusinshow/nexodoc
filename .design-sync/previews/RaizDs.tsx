import { Botao, RaizDs, Selo } from "nexo-ds";

export const Superficies = () => (
  <RaizDs style={{ padding: 24 }}>
    <div style={{ padding: 16, borderRadius: 18, background: "var(--ds-surface-sunken)", boxShadow: "var(--ds-edge)" }}>
      <div style={{ padding: 16, borderRadius: 16, background: "var(--ds-surface-card)", boxShadow: "var(--ds-edge)", display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="ds-code">117-25</span>
          <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.015em" }}>Muro de contenção da Rua Anita Garibaldi</span>
        </div>
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            background: "var(--ds-surface-raised)",
            boxShadow: "var(--ds-edge-strong)",
            fontSize: 14,
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <Selo tom="block" ponto>
            Bloqueia a emissão
          </Selo>
          Volumes divergentes entre memorial e quadro
          <span style={{ color: "var(--ds-text-tertiary)", fontSize: 12.5 }}>p. 14</span>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Botao>Agora não</Botao>
          <Botao variante="primary">Auditar</Botao>
        </div>
      </div>
    </div>
  </RaizDs>
);
