---
category: base
---

Raiz obrigatória do sistema ds. Todo o `styles.css` mora sob a classe `.ds`: fora da `RaizDs` nenhum componente tem estilo e a fonte cai para a do sistema. Envolva a tela inteira **uma vez**; ela pinta o fundo `--ds-surface-page` (grafite `#08090b`), põe a Geist e o texto primário.

```jsx
<RaizDs style={{ padding: 32 }}>
  <Botao variante="primary">Auditar</Botao>
</RaizDs>
```
