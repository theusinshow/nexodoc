import { Botao, Menu } from "nexo-ds";

export const Acoes = () => (
  <div style={{ padding: 24, display: "flex", gap: 8, alignItems: "center" }}>
    <Menu
      rotulo="Exportar"
      itens={[
        { rotulo: "Parecer em PDF", dica: "O documento para a prefeitura" },
        { rotulo: "Planilha de achados", dica: "Uma linha por achado" },
      ]}
    />
    <Menu rotulo="Mais ações" variante="quiet" itens={[{ rotulo: "Reauditar" }, { rotulo: "Arquivar obra" }]} />
    <Botao variante="primary" tamanho="sm">
      Marcar corrigido
    </Botao>
  </div>
);
