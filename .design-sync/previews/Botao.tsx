import { Botao, Girando } from "nexo-ds";

const quadro = { padding: 24, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" as const };

export const Variantes = () => (
  <div style={quadro}>
    <Botao variante="primary">Confirmar e gerar</Botao>
    <Botao>Ajustar escopo</Botao>
    <Botao variante="quiet">Agora não</Botao>
  </div>
);

export const Pequenos = () => (
  <div style={quadro}>
    <Botao variante="primary" tamanho="sm">Auditar</Botao>
    <Botao tamanho="sm">Exportar</Botao>
    <Botao variante="quiet" tamanho="sm">Limpar filtros</Botao>
  </div>
);

export const Estados = () => (
  <div style={quadro}>
    <Botao variante="primary" disabled>Gerar volume</Botao>
    <Botao disabled>
      <Girando /> Salvando
    </Botao>
    <Botao icone aria-label="Mais ações">⋯</Botao>
  </div>
);
