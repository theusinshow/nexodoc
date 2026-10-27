---
category: acoes
---

Botão que abre um menu de **ações** (cada item faz algo: Exportar, Mais ações). Cresce a partir do botão; Esc e clique fora fecham. Item aceita `dica` (linha secundária) e `icone`.

```jsx
<Menu rotulo="Exportar" itens={[
  { rotulo: "Parecer em PDF", dica: "O documento para a prefeitura" },
  { rotulo: "Planilha de achados", dica: "Uma linha por achado" },
]} />
```
