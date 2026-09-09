# O volume que envelheceu, e a oferta de remontar

> **Decidido em 09/09/2026.** Quando uma peça do volume (capa, separatriz, LD) é
> gerada de novo **depois** da montagem, o volume já montado passa a dizer que
> envelheceu, e a conversa oferece **remontar e baixar** num clique — em vez de
> exigir três pedidos ao chat.

## O caso real que originou isto

O engenheiro montou um volume completo, baixou, e só no PDF pronto viu que o
título da LD estava errado. O que ele teve de fazer:

1. "arruma a LD para o título tal" — o chat arrumou;
2. "monta o volume de novo" — montou;
3. "baixa de novo" — baixou.

**Nada disso falhou.** O mecanismo de remontar já existe e já faz a coisa certa:
o `artifactId` do volume é estável, então remontar **grava por cima** do mesmo
artefato, e a montagem reaproveita a LD/capa/separatriz já geradas. O que falta
não é mecanismo — é o Nexo **se antecipar**. Foram três pedidos para uma
correção que o sistema tinha como oferecer sozinho no primeiro.

Pior: enquanto ele não pedia, **nada na tela dizia que o volume tinha
envelhecido**. O card seguia anunciando "Gerado", com a LD velha dentro. É a
classe de defeito de sempre nesta casa — o caminho errado e o certo
indistinguíveis.

---

## Por que o volume não percebe hoje

O volume grava no payload o que o define (`ConfirmationCard.tsx:1959`):

```
payload: { tomo, folhas: assinaturaDoTomo(...), conferencia }
```

E o card compara (`ConfirmationCard.tsx:1740`):

```
estadoDoArtefato(saved, { tomo, folhas: assinaturaDoTomo(...) })
```

Duas consequências, e as duas são defeito:

**1. Trocar o título da LD não mexe em `folhas`.** A assinatura de folhas pega
folha arrastada, folha removida, tomo redividido — tudo que muda *o conjunto*.
Não pega o que muda *o conteúdo de uma peça*. O título é conteúdo. Por isso o
volume não envelhece quando a LD é corrigida.

**2. A comparação já estava quebrada.** `conferencia` está no que se **grava** e
não está no que se **compara** — chaves diferentes, `JSON.stringify` diferente,
`estadoDoArtefato` devolve `"pendente"` **sempre**. Pelo código, a moldura do
card de volume é âmbar desde que ele passou a gravar payload, em toda conversa,
em todo tomo. A marca que deveria gritar "envelheceu" está gritando desde
sempre, o que é o mesmo que não gritar.

`conferencia` é **resultado**, não parâmetro: ela descreve o volume depois de
pronto, e nunca deveria ter entrado na conta do que o originou.

---

## O que o volume passa a guardar

Ao montar, o volume grava as **peças que entraram nele e de quando elas eram**:

```
payload: {
  tomo,
  folhas,
  partes: [{ id: <artifactId>, em: <generatedAt> }, ...],
  conferencia,
}
```

Uma entrada por peça consumida — capa, e a separatriz e a LD de cada bloco. A
lista sai **ordenada por `id`**, porque a comparação da casa é `JSON.stringify`
literal e ordem instável faria todo volume nascer pendente (é a armadilha que
`payload-do-item.ts` já documenta).

`generatedAt` já existe em todo `SavedResult` (`conversation-store.tsx:928`) e é
reescrito a cada `saveResult` — inclusive quando o artefato é regerado por cima.
É o carimbo de tempo certo, e é deterministicamente comparável.

**Por que a hora, e não os parâmetros da peça.** Comparar params seria mais
preciso (não avisaria quando a peça saiu igual), mas hoje há **dois escritores
com formatos diferentes** para o payload da LD: o plano de geração
(`payloadDoItem`) grava `{...params, tituloLd, bloco, tomo, folhas}`, e a
montagem, quando gera a LD de um bloco na hora, grava `{tituloLd, tomo, folhas}`
(`ConfirmationCard.tsx:1894`). Comparar dois formatos diferentes deixa aviso
escapar, e aviso que escapa é exatamente o defeito que este trabalho existe para
matar. A hora é uma verdade só.

O preço é um falso positivo possível: regerar uma peça e sair conteúdo idêntico
marca o volume como velho. Aceito — remontar é barato, e o card diz o motivo com
todas as letras ("a LD METALÚRGICO foi gerada de novo depois deste volume"), de
modo que o engenheiro julga. Errar avisando é a direção certa.

E a comparação do card passa a incluir `partes` e a excluir `conferencia`.

---

## O juízo: um núcleo puro

`modules/nexo/lib/volumes-desatualizados.ts` — só `import type`, no molde do
`volumes-prontos.ts` que está ao lado, para rodar em node pelado:
`node scripts/test-nexo-volumes-desatualizados.ts`.

```ts
export interface ParteDoVolume { id: string; em: number }

export interface VolumeDesatualizado {
  artifactId: string;
  tomo?: number;
  /**
   * O que o card mostra: "TOMO 02 · METALÚRGICO" quando há tomo e disciplina,
   * "TOMO 02" quando só há tomo, "Volume" quando é indiviso. A disciplina sai
   * do nome do PDF montado (`nomeDoVolume` já a escreve lá), nunca de uma
   * segunda derivação a partir dos selos.
   */
  rotulo: string;
  /** Uma frase por peça envelhecida, com o nome dela. */
  motivos: string[];
}

export function volumesDesatualizados(
  results: readonly SavedResult[],
): VolumeDesatualizado[];
```

A regra, inteira: para cada resultado `kind: "volume"`, ler `payload.partes`;
para cada parte, achar o artefato de hoje pelo `artifactId`; se o `generatedAt`
de hoje for **maior** que o registrado, o volume é mais velho que aquela peça. O
nome da peça no motivo sai do `canvas.label` dela, que é o mesmo rótulo que o
engenheiro vê no canvas.

**Dois limites assumidos:**

- **Peça que nasceu depois** (um bloco novo que ganhou LD própria) não é pega
  por aqui, porque ela não estava na lista. Mas bloco novo muda o conjunto de
  folhas, e a assinatura de folhas — que continua na comparação — já pega.
- **Volume montado antes disto existir** não tem `partes` no payload e **não
  grita**. Tratá-lo como suspeito marcaria toda conversa antiga para sempre, sem
  conserto possível; avisar sempre é o mesmo que não avisar. (É uma exceção
  deliberada à regra de `estadoDoArtefato`, que trata payload ausente como
  pendente — lá o aviso tem conserto: gerar de novo. Aqui não teria.)

---

## A oferta: um card derivado, no fim da conversa

O card **não é uma mensagem**. Ele é derivado de `results` e renderiza no fim do
`NexoChat`, depois da lista de mensagens — nasce no instante em que vira verdade
e some no instante em que o volume é remontado. Card injetado no histórico
ficaria congelado lá, mentindo depois de resolvido.

```
┌─ Volumes desatualizados ─────────┐
│ ⚠ 2 volumes usam a LD antiga     │
│   · TOMO 02 · METALÚRGICO        │
│   · TOMO 03 · METALÚRGICO        │
│        [Remontar e baixar os 2]  │
└──────────────────────────────────┘
```

Um card só, listando os afetados, com um botão — não um card por tomo. Seis
tomos velhos empilhariam seis cards iguais, que é o mesmo motivo pelo qual o
`PlanoDeGeracao` já unificou capa/LD/separatriz num card só.

O card do volume lá em cima na conversa **também** fica âmbar, pela comparação
corrigida. É o mesmo fato dito em dois lugares: quem está olhando o card antigo
vê, e quem está no fim da conversa não precisa rolar até ele.

---

## O botão: um caminho de montagem só

O registro de montadores que hoje vive dentro de `VolumesDoConjunto`
(`ConfirmationCard.tsx:1398`) sobe para um registro **da conversa**, chaveado
pelo `artifactId` do volume. Os cards de volume seguem se registrando como já
fazem — a mudança é onde o mapa mora, não quem o alimenta. O card novo apenas
**chama** os montadores dos volumes velhos.

Isto é o que evita a duplicação que estragaria tudo: reconstruir a lista de
tomos, os selos do tomo e as peças fora do card seria uma **segunda via de
montagem**, e duas vias divergem. A montagem continua uma só, com as suas travas
(`motivoParaNaoMontar`, `entregarVolume`, a conferência que roda sozinha sem
bloquear o download).

O laço é **sequencial**, cada volume no seu `try`, e as falhas são coletadas e
mostradas — a mesma regra do "montar todos", pelo mesmo motivo: cada volume
carrega dezenas de megabytes, e um que falha não pode levar os outros junto nem
sumir em silêncio.

Terminada a montagem, **o download dispara sozinho**: um volume baixa o PDF;
dois ou mais, o ZIP (`baixarArquivosEmZip`). O clique no botão é o gesto do
usuário que o navegador exige — não há bloqueio de download aqui.

**Quando não dá para remontar.** Os bytes das pranchas vivem em memória
(`pranchaFiles`, estado do `NexoWorkspace`): depois de um F5 ou numa conversa
retomada de outra máquina, eles não existem mais. O card então **diz isso** e não
desenha um botão que não funciona — "os arquivos das pranchas não estão nesta
máquina; anexe a pasta de novo para remontar". A trava é a mesma
`motivoParaNaoMontar` que o card de volume já consulta.

---

## Como provo

**Núcleo puro, node cru** (`scripts/test-nexo-volumes-desatualizados.ts`): peça
mais nova que o volume; peça com a mesma hora; peça que sumiu dos resultados;
volume legado sem `partes`; volume com peças de dois blocos, uma velha e uma
nova; ordenação estável da lista de `partes`.

**A comparação corrigida** entra no teste do estado do artefato: volume recém
montado = `aplicado` (é o que está quebrado hoje); LD regerada = `pendente`.

**No navegador, sem gastar token:** semear o IndexedDB com um volume montado e
sua LD (molde em `shot-audit-reconexao.mjs`), regravar a LD com `generatedAt`
maior, e medir que o card nasce — **medindo a caixa contra a janela**, não só a
presença no DOM.

---

## Fora de escopo, anotado

**O nome do ZIP do chat.** `baixarTodosOsVolumes` usa o nome fixo
`"volumes-montados.zip"` (`ConfirmationCard.tsx:1438`) — sem código de obra, sem
disciplina, sem volume. O ajuste de 09/09 que renomeou o ZIP para
`084_25_met_vol_12.zip` foi feito em `generateZipFileName`, que serve a tela
`/volumes`, **não** o caminho do chat. Os dados para montar o mesmo nome estão
todos à mão no card (código do selo, disciplina do bloco, `volume` dos params da
capa). Conserto separado, mesmo dia.
