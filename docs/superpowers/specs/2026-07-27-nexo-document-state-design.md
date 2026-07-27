# Nexo — Document State

**Data:** 2026-07-27
**Estado:** desenho aprovado, pronto para implementar

Segundo de cinco sub-projetos do canvas manipulável. Não entrega nada visível:
é a fundação de que os sub-projetos 3, 4 e 5 dependem.

| # | Sub-projeto | Depende de | Estado |
|---|---|---|---|
| 1 | Navegação | nada | **feito** (`0a40ebe`, `95311c2`) |
| 2 | **Document State** (este) | nada | a fazer |
| 3 | Página como nó | 2 | a fazer |
| 4 | Seleção tipo AutoCAD, arrastar, agrupar | 2 e 3 | a fazer |
| 5 | Montagem lendo ordem e grupos manuais | 2 e 4 | a fazer |

## O problema

Hoje `selos: SeloForLd[]` acumula dois papéis: é **o que o PDF diz** e é **a base
da montagem**. Tornar esse array mutável para permitir arrastar e renomear
destruiria a distinção entre "o selo dizia X" e "eu mudei para Y" — e a próxima
leitura de pranchas apagaria as edições manuais sem avisar.

## A separação

```
selos: SeloForLd[]                ← o que o PDF diz. Nunca escrito à mão.
ajustes: Record<FolhaId, Ajuste>  ← o que o usuário mudou. Só cresce por ação dele.

folhas(selos, ajustes) → Folha[]  ← projeção PURA. É isto que a montagem lê.
```

`FolhaId` = `` `${fileName}#${pageNumber}` ``. Chave natural do par arquivo/página,
estável entre releituras — é o que faz um ajuste sobreviver a reanexar pranchas.

### Por que isto implementa "o grupo manda"

A decisão do usuário foi: **o grupo manda; o automático vira só o palpite
inicial.** A divisão automática em tomos é uma *derivação* de `selos`; o grupo
desenhado à mão é um *ajuste*. Como a projeção aplica o ajuste por cima da
derivação, o manual vence sem nenhuma regra especial de precedência — e nenhuma
geração posterior desfaz o que o usuário arrastou.

Se fosse o contrário, o canvas mostraria uma organização que o PDF montado não
respeita: pior que não ter o recurso.

## O `Ajuste`

```ts
interface Ajuste {
  titulo?: string;      // "mudar nome / mudar titulo"
  disciplina?: string;  // "mudar classificação"
  grupo?: number;       // o tomo que o usuário decidiu
  ordem?: number;       // posição manual
}
```

Todo campo é **opcional**, e ausente significa "use o que o selo disse". Isso dá
de graça a propriedade que mais importa: `folhas(selos, {})` é igual a `selos`.

## A `Folha`

O que a projeção devolve: os campos do selo, mais

- `id: FolhaId`
- `editado: boolean` — se algum campo veio de ajuste. A interface precisa disso
  para marcar visualmente o que foi tocado à mão; sem a marca, o usuário não
  distingue o que o sistema leu do que ele mesmo mudou.

## Ordenação

`ordem` é um número esparso, não um índice denso. Reordenar uma folha não
renumera as outras — só grava a posição da que se moveu. Folhas sem `ordem`
mantêm a ordem natural (arquivo, página) e ficam intercaladas pela comparação
`ordem ?? posiçãoNatural`.

Índice denso obrigaria reescrever N ajustes a cada arrasto, e dois arrastos
concorrentes se sobreporiam.

## O que muda a jusante

LD, capa, separatriz e volume passam a ler `folhas(...)` no lugar de `selos`.
**É isto que faz a edição valer**: renomear uma prancha no canvas precisa
aparecer na LD gerada depois. Sem essa troca, editar seria enfeite.

A divisão em tomos (`faixasDosTomos`) passa a respeitar `grupo` quando ele
existe, e só cair no cálculo por quantidade quando não existe nenhum.

## Testes

Módulo puro, sem imports de runtime, no padrão `scripts/test-nexo-*.ts`:

- `folhas(selos, {})` devolve exatamente os selos, na ordem natural — **o teste
  mais importante do sub-projeto**, porque é o que prova que a fundação entrou
  sem regredir a montagem já validada;
- um ajuste de `titulo` troca só o título, e marca `editado`;
- `grupo` manual vence a divisão automática;
- ajuste de folha que não existe mais (prancha removida) é ignorado, não quebra;
- `ordem` esparsa intercala corretamente com as folhas sem ordem;
- reanexar pranchas preserva os ajustes das folhas que continuam existindo.

No navegador (`shot-nexo.mjs`): o fluxo inteiro de geração continua passando com
o comportamento de hoje. Sem ajustes, nada na tela pode mudar.

## Degradação

| Situação | Comportamento |
|---|---|
| Nenhum ajuste | Idêntico a hoje |
| Ajuste órfão (folha sumiu) | Ignorado na projeção; não é apagado (a prancha pode voltar) |
| `grupo` em algumas folhas só | As com grupo respeitam-no; as sem caem na divisão automática |
| Ajuste com string vazia | Tratado como ausente — evita título em branco na LD |

## Riscos

**Trocar `selos` por `folhas(...)` a jusante é o ponto de regressão.** São vários
pontos de chamada (LD, capa, separatriz, volume) e um esquecido produz um
documento montado a partir de dados velhos — exatamente a classe de defeito que
já apareceu antes, quando o volume do tomo 2 saiu com as 24 folhas por eu ter
fatiado `selos` mas não `pranchaFiles`. A verificação no navegador precisa
cobrir a montagem, não só a tela.
