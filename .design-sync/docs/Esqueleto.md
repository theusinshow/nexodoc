---
category: estado
---

Bloco que antecipa a forma do conteúdo enquanto carrega (aparece só após 120 ms; uma luz varre a tela inteira). Dê largura e altura do que vem.

```jsx
<div style={{ display: "grid", gap: 8 }}>
  <Esqueleto largura={220} altura={16} />
  <Esqueleto largura="100%" />
</div>
```
