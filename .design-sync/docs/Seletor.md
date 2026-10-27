---
category: acoes
---

Botão fantasma pequeno que abre um menu para **escolher um valor** (o escolhido ganha check violeta). `prefixo` aparece em terciário antes do valor ("Ordem: Gravidade").

```jsx
<Seletor prefixo="Ordem" valor="gravidade" onTroca={() => {}} opcoes={[
  { valor: "gravidade", rotulo: "Gravidade" },
  { valor: "pagina", rotulo: "Página" },
]} />
```
