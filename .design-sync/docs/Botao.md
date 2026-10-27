---
category: acoes
---

Botão em pílula (34px; `tamanho="sm"` = 28px). Três variantes:
- `primary` — **papel claro** (`#f2f3f5`, texto quase preto). É a ação principal: **no máximo uma por tela**. Nunca violeta.
- `ghost` (padrão) — contorno de luz; a alternativa ou a recusa ao lado da principal.
- `quiet` — só texto secundário, para ações de baixa ênfase em barras e linhas.

`icone` deixa o botão quadrado (só ícone; dê `aria-label`). Ícones lucide-react 16px vão como filho, antes do texto. Afunda 3% no aperto; desabilitado fica a 45%.

```jsx
<div style={{ display: "flex", gap: 8 }}>
  <Botao variante="primary">Confirmar e gerar</Botao>
  <Botao>Ajustar escopo</Botao>
  <Botao variante="quiet" tamanho="sm">Agora não</Botao>
</div>
```
