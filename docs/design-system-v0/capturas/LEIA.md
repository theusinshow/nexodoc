# Antes e depois

**Antes** (estado em `bec0898`, antes de qualquer lote):
[`docs/open-design-kit/telas/`](../../open-design-kit/telas/)

**Depois de cada lote:** as pastas `lote-N-depois/` daqui.

Os arquivos têm o mesmo nome nos dois lados — abra lado a lado.

Para regerar a qualquer momento, com o `npm run dev` rodando:

```
node scripts/shot-kit-design.mjs                        # sobrescreve o "antes"
KIT_OUT=docs/design-system-v0/capturas/lote-N-depois node scripts/shot-kit-design.mjs
```

## O que mudou visualmente em cada lote

### Lote 1 — tokens
Nada. Os tokens entraram no CSS mas nenhum componente os usava ainda. Lote de
fundação: o diff é só de adição, e a tela é idêntica. É esperado.

### Lote 2 — a cor certa em cada aviso
| Tela | O que mudou |
|---|---|
| `06-ferramentas-antigas` | As telas antigas ganharam a cor de LEGADO: moldura, caixa do ícone e um selo "Ferramenta antiga". Só na casca — o miolo de cada tela continua igual, porque ela funciona |
| `09-legado-ld` | O rótulo do cabeçalho passou a usar a cor de legado |
| `03-nexo-conversa-cartoes` | O link "Ferramentas antigas" da barra lateral saiu de cinza para a cor de legado |

Duas mudanças não aparecem nestas capturas porque dependem de estado que a
conversa semeada não tem:

- **Folha corrigida à mão** (canvas): a marca era âmbar e virou rust. "Corrigido
  à mão" é ênfase, não status — o valor não está errado nem certo, veio de uma
  pessoa em vez do carimbo.
- **Valor ausente** no cartão de confirmação (ex.: título não definido): era
  âmbar, virou rust. Marca sem julgar: não é erro, só ainda não foi dito.
- **Retomada pós-F5** na auditoria: era cinza-apagado e virou azul de
  informação. Em `muted` sumia, e o engenheiro não entendia por que as etapas
  não apareciam.
