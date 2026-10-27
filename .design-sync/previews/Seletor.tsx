import { Seletor } from "nexo-ds";

export const Ordem = () => (
  <div style={{ padding: 24, display: "flex", gap: 8 }}>
    <Seletor
      prefixo="Ordem"
      valor="gravidade"
      onTroca={() => {}}
      opcoes={[
        { valor: "gravidade", rotulo: "Gravidade" },
        { valor: "pagina", rotulo: "Página" },
        { valor: "disciplina", rotulo: "Disciplina" },
      ]}
    />
    <Seletor
      prefixo="Responsável"
      valor="todos"
      onTroca={() => {}}
      opcoes={[
        { valor: "todos", rotulo: "Todos" },
        { valor: "eu", rotulo: "Comigo" },
      ]}
    />
  </div>
);
