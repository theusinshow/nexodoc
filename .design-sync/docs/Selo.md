---
category: rotulos
---

Pílula de 22px para estado e gravidade. `ponto` acrescenta o círculo de 6px. Tons:
- `neutro` (padrão), `line` (só contorno)
- `nexo` — violeta: o Nexo está presente/trabalhando ("Auditando")
- gravidade do achado: `block` (bloqueia a emissão, coral), `risco` (risco na execução), `decide` (exige decisão técnica, âmbar), `note` (observação), `texto` (redação e gramática, azul)
- `ok` — estado certo (gravado, corrigido)

A cor nunca vem sem o texto que diz o degrau.

```jsx
<Selo tom="block" ponto>Bloqueia a emissão</Selo>
<Selo tom="nexo" ponto>Auditando</Selo>
```
