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

### Lote 3 — os primitivos
| Onde | O que mudou |
|---|---|
| **Botão** | Rótulo em 13px + 0.02em (era 14px, fora da escala mono). Transição pelos tokens de movimento — era `duration-150 ease-out`, solto, e o botão respondia 30ms mais devagar que o resto da interface. Contorno passa a usar a borda de campo |
| **Badge** | Mono Label de verdade: 11px, **caixa alta**, +0.05em, altura fixa de 22px. Era 12px em caixa mista, que é estilo de dado — e badge é rótulo. Aparece em toda tela |
| **Chip** | Fundo `secondary` em vez de `card`: o chip fica sobre a bolha e sobre o palco, e no fundo de cartão sumia dentro deles. O fio do "sugerido" passou para o teal claro a 45% — o escuro a 30% não se via |
| **Campo** | Transição pelos tokens |

Visível nas capturas: os selos ("BETA", "ATIVO") em caixa alta, e os chips de
próximo passo destacados do fundo.

### Lote 4 — a conversa (parcial)
| Onde | O que mudou |
|---|---|
| **Caixa de confirmação** | A **borda inteira** passa a dizer o estado: âmbar quando o documento envelheceu, verde quando o que está na tela é o que foi gerado. Antes isso era um ponto de 1,5px no canto do cabeçalho — e "pendente" significa que o arquivo na mão do engenheiro está velho, o erro mais caro que esta tela comete |
| **Bolhas** | Raio do sistema (8px) no lugar dos 16px de aplicativo de mensagem — era o único lugar que inventava outro raio. Corpo em 14px (15px não é degrau da escala). A bolha do usuário foi para superfície elevada: no fundo embutido ela parecia campo desabilitado. Medida de leitura em 62ch |

**Falta do lote 4:** variantes do composer (herói/ancorado), estados do chip de
anexo, overlay de arrastar, e o miolo das seis caixas.

## Divergências registradas (o repositório venceu)

O handoff manda avisar em vez de "corrigir" o código quando a folha diverge das
regras já em produção. Aconteceu duas vezes:

1. **`.card` com `edge-highlight` em repouso** (`assets/nexo.css`). Não adotado:
   o `DESIGN.md` §4 limita o fio de luz a superfície elevada ou interativa
   (botão, cartão em hover, sobreposição) e o proíbe em painel plano parado. Se
   o sistema quiser mudar essa regra, a mudança é no DESIGN.md primeiro.
2. **`.chip:hover` com `#21262a`** — hex solto, que o próprio critério 6 do
   sistema proíbe ("nenhum valor solto"). Mantido `bg-accent`, que é o token
   equivalente.
3. **Composer em vidro puro + anel teal no foco.** Mantido o que está em
   `globals.css`, que documenta o porquê de duas tentativas anteriores: o vidro
   puro **some** sobre o fundo quase-preto da tela de boas-vindas (não há nada
   atrás para refratar), e o anel teal **virava neon** num campo dessa largura.
   Hoje o composer usa superfície elevada com borda de campo, e o foco só
   clareia a borda. Se o sistema quiser reverter, vale rever com a tela na
   frente — as duas decisões vieram de ver, não de supor.
