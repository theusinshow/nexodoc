import { Segmento } from "nexo-ds";

export const Periodo = () => (
  <div style={{ padding: 24 }}>
    <Segmento
      rotulo="Período"
      valor="30"
      onTroca={() => {}}
      opcoes={[
        { valor: "7", rotulo: "7 dias" },
        { valor: "14", rotulo: "14 dias" },
        { valor: "30", rotulo: "30 dias" },
      ]}
    />
  </div>
);

export const Vista = () => (
  <div style={{ padding: 24 }}>
    <Segmento
      rotulo="Vista do resultado"
      valor="fila"
      onTroca={() => {}}
      opcoes={[
        { valor: "resumo", rotulo: "Resumo" },
        { valor: "fila", rotulo: "Fila" },
        { valor: "documento", rotulo: "No documento" },
      ]}
    />
  </div>
);
