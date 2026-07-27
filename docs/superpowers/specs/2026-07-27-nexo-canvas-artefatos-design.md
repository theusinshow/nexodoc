# Nexo — canvas como área de trabalho: separatriz visível, exclusão e seleção

**Data:** 2026-07-27
**Estado:** desenho aprovado, pronto para virar plano de implementação

## Problema

O canvas do Nexo mostra o que foi gerado, mas não deixa agir sobre nada. Três
consequências concretas, todas vistas no primeiro teste real de ponta a ponta:

1. **A separatriz é invisível.** Ela nasce dentro de `assembleVolume`, entra no
   PDF e morre lá — nunca vira card nem nó. Por isso saiu com a sigla crua da
   disciplina ("ESTRUTURAL") em vez do título do documento, e ninguém percebeu
   até o volume ficar pronto.
2. **Não dá para remover nada.** Uma capa gerada com o parâmetro errado fica no
   canvas e continua entrando no volume. O único jeito de sair dela é começar
   outra conversa.
3. **Não dá para selecionar.** `elementsSelectable={false}` em
   `NexoCanvas.tsx:246` desliga a seleção, então não existe onde pendurar ação
   nenhuma sobre um nó.

## Decisões tomadas

| Decisão | Escolha | Por quê |
|---|---|---|
| Onde vive o estado | **No navegador**, estendendo `conversation-store`/IndexedDB | O Nexo já é uma bancada de UMA sessão; servidor exigiria migração, rotas e sincronização sem consumidor hoje |
| Pranchas anexadas | **Somente leitura** — não se excluem, não se reordenam | Decisão do usuário. Some junto o conflito de renumeração: nada renumera, e o "04 / 16" é exibição do que o selo diz |
| Excluir artefato gerado | Sai do canvas e do volume; o card volta a **PROPOSTA** | Reversível: regerar é um clique, nada se perde de verdade |
| `Project/Volume/Cover/LD/Sheet[]/Order` | **Fora de escopo** | Com pranchas somente-leitura e ordem canônica, essas entidades não teriam consumidor — seriam estrutura esperando um uso que não existe |

## O que já existe (verificado, não presumido)

O canvas usa React Flow, e boa parte do P2 já está lá:

| Pedido | Estado |
|---|---|
| scroll, pan, zoom | Existe: `panOnScroll`, `zoomOnScroll`, `minZoom={0.3}`, `maxZoom={1.5}`, `<Controls />` |
| preview ampliado | Existe: clique no nó abre o PDF |
| número de ordem da folha | Existe: a pilha de pranchas lista numerada |
| edição | Existe: "editar no chat" escreve no composer |
| seleção | **Desligada** em `NexoCanvas.tsx:246` |
| exclusão | **Não existe** |

## Arquitetura

### 1. Separatriz vira artefato de primeira classe

Hoje `assembleVolume` chama `postSeparatriz` inline e usa o PDF sem guardar nada.
Passa a existir um `SeparatrizConfirmation` com o mesmo formato dos outros cards
(params read-only, chips de alteração, `PROPOSTA/PENDENTE/APLICADO`), salvando o
resultado em `results` com `artifactId = separatriz:<codigo>` e `payload` com os
params — o mesmo contrato de capa e LD.

`assembleVolume` deixa de gerar a separatriz: passa a **receber** o PDF dela como
as outras partes. Se não houver separatriz gerada, o volume sai sem ela, como já
acontece hoje quando a geração falha.

**O título da separatriz é o mesmo campo já resolvido para a LD** (`tituloLd`).
Não se cria um campo próprio: dois títulos para o mesmo documento divergiriam, que
é o defeito que o `tomoInicial` compartilhado já corrigiu em outro lugar. Os
params PRÓPRIOS da separatriz continuam sendo os que já existem em
`NexoSeparatrizProposalParams` (`templateId`, `numTomos`); o título entra no card
como fato exibido, vindo da LD, não como campo editável ali.

**Sem LD gerada, a separatriz não gera.** O botão fica desabilitado com "Defina o
título na LD primeiro", pelo mesmo motivo que a capa não gera sem prefeitura: o
título é decisão do engenheiro e a separatriz existe justamente para nomear a
disciplina dentro do volume. Excluir a LD depois devolve a separatriz a esse
estado — ela passa a exibir o título que ficou gravado no seu próprio `payload`,
e o card avisa que a LD que o originou não existe mais.

### 2. Remoção de artefato gerado

`conversation-store` ganha:

```ts
removeResult: (artifactId: string) => void;
```

Ele revoga os object URLs do resultado (senão vazam), tira do array, persiste, e
o espelho existente (`results` → `replaceArtifacts`) faz o nó sumir do canvas
sozinho — sem código novo de sincronização.

O card correspondente volta a **PROPOSTA** automaticamente: `estadoDoArtefato`
já devolve `"proposta"` quando não há resultado salvo.

**Os blobs no IndexedDB não são apagados.** Removê-los exigiria varrer chaves por
prefixo e a economia é irrelevante; o que importa é que o resultado sai do estado
e do volume. A limpeza real acontece quando a conversa é apagada.

### 3. Seleção e ações no canvas

`elementsSelectable` passa a `true`. O nó selecionado revela uma barra com
`[Editar] [Excluir]`:

- **Editar** reusa o caminho existente (escreve a frase no composer).
- **Excluir** pede confirmação **inline no próprio nó** ("Excluir? Sim / Não").
  Sem diálogo modal: a ação é reversível e um modal custaria mais atenção do que
  a decisão merece.

A pilha de pranchas não recebe barra de ações — pranchas são entrada
somente-leitura.

### 4. Splitter redimensionável

Independente do resto: um separador arrastável entre canvas e chat, com largura
mínima dos dois lados e a preferência em `localStorage`. Não lê nem escreve
estado documental, então pode ser construído em qualquer ordem.

Teclado obrigatório: setas movem o separador (é um `separator` com
`aria-valuenow`), senão a única forma de usar é o mouse.

## Degradação

| Situação | Comportamento |
|---|---|
| Excluir artefato que já sumiu | No-op silencioso (o card volta a PROPOSTA de qualquer forma) |
| Volume montado sem separatriz | Sai sem ela, como hoje quando a geração falha |
| `localStorage` indisponível | Splitter usa a largura padrão; nada quebra |
| Conversa restaurada do histórico | Artefatos voltam como estão gravados. A separatriz de conversas antigas **não** existe como resultado, e o volume passa a sair **sem ela** até ser gerada — um clique no card, que agora fica visível na lista de partes marcado como ausente. Regenerá-la escondida na montagem manteria viva justamente o caminho invisível que causou o defeito do texto errado. |

## Testes

Puros, no padrão `scripts/test-nexo-*.ts`:

- **remoção**: remover um artefato tira só ele e preserva a ordem dos demais;
  remover um id inexistente não altera nada e não lança.
- **partes do volume**: com a separatriz agora vindo de fora, `buildVolumeParts`
  continua respeitando a ordem canônica e pulando a parte ausente — o teste que
  já existe cobre isso e passa a valer para o caminho novo.

Interação de canvas e splitter não têm cobertura automatizada neste repositório;
vão para a verificação manual no fim do plano.

## Riscos

**O maior é a separatriz mudar de dono.** Ela sai de "gerada na montagem" para
"gerada antes, como artefato". Um volume montado numa conversa antiga não terá o
artefato, e a montagem precisa continuar funcionando nesse caso — senão a
mudança quebra conversas já existentes em vez de melhorá-las.

**O segundo é o vazamento de object URL na remoção.** Se `removeResult` tirar o
resultado sem revogar as URLs, cada exclusão deixa um blob preso na memória da
aba. É uma linha, e é invisível quando esquecida.
