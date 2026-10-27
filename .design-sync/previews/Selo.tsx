import { Selo } from "nexo-ds";

const quadro = { padding: 24, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const };

export const Gravidade = () => (
  <div style={quadro}>
    <Selo tom="block" ponto>Bloqueia a emissão</Selo>
    <Selo tom="risco" ponto>Risco na execução</Selo>
    <Selo tom="decide" ponto>Exige decisão técnica</Selo>
    <Selo tom="note" ponto>Observação</Selo>
    <Selo tom="texto" ponto>Redação</Selo>
  </div>
);

export const Estado = () => (
  <div style={quadro}>
    <Selo tom="nexo" ponto>Auditando</Selo>
    <Selo tom="ok" ponto>Volume montado</Selo>
    <Selo>12 folhas</Selo>
    <Selo tom="line">Revisão B</Selo>
  </div>
);
