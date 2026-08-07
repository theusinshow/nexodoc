# Fatos do selo: parar de perguntar o que já está no carimbo

Data: 2026-08-07
Status: aprovado para planejamento

## O problema

O Nexo pergunta quatro coisas que estão escritas em todo carimbo do volume:
título da capa, título da LD, data e prefeitura. O engenheiro anexa 24 pranchas
que dizem `PREFEITURA MUNICIPAL DE FLORIANÓPOLIS` e `AGOSTO/2026` em cada folha,
e ainda assim responde as quatro perguntas antes de gerar a capa.

O princípio declarado do produto é **"afirma fatos, pergunta decisões"**. Esses
quatro slots estão marcados `decision: true` em
`server/nexo/agent/requirements.ts` — classificados como decisão humana. São
fato. É a classificação que está errada, não o mecanismo.

O mecanismo para consertar já existe: `deriveFrom(facts)` resolve um slot a
partir dos fatos e ele nunca chega a ser perguntado.

**A prefeitura já usa esse mecanismo e está resolvida** (ver Peça 2). Sobram
três: título de capa, título de LD e data. Os dois títulos têm a fonte pronta e
só precisam ser ligados; a data é a única que ainda não é lida do carimbo.

## Decisões

1. **Afirmar, e deixar visível.** O Nexo não pergunta, mas mostra o que afirmou
   e de onde tirou, editável num clique. Resolver em silêncio é o que produziu a
   capa com a data errada (ver Cicatrizes).
2. **A data vem do selo**, não do relógio. Um volume montado hoje com pranchas
   de junho sai `JUNHO/2026`.
3. **Os títulos vêm da disciplina**, pelo registro de `disciplinas.ts`, não do
   texto livre do carimbo.
4. **Divergência entre folhas: afirma a maioria e avisa.** O campo é marcado
   como divergente, com a contagem de quem discorda. Não trava o fluxo.
   **Empate não é maioria**: sem valor vencedor, o fato não é afirmado — o slot
   `required` (`templateId`) volta a ser perguntado com os empatados como
   opções, e o não-required (`mes`/`ano`) cai no padrão do builder.
5. **Os fatos aparecem no card de confirmação**, acima do botão de gerar — o
   último ponto antes de virar PDF.

## Arquitetura

### Peça 1 — ler a data do selo

A única das quatro que exige mexer no que vai ao modelo.

- `app/api/ld/extract-stamp/route.ts`: campo `data` no schema e no prompt. O
  rótulo `DATA` **continua** na lista de rótulos que não podem contaminar o
  campo CONTEÚDO; a mudança é passar a capturá-lo como campo próprio.
- Módulo puro novo `server/nexo/data-do-selo.ts`: normaliza os formatos reais de
  carimbo (`JUNHO/2026`, `JUN/26`, `06/2026`, `12/06/2026`) para `{mes, ano}`.
  O `normalizarMes` de `build-capa-proposal.ts` só faz número→nome e não serve.
  Puro (sem imports) para rodar em node cru, como os demais núcleos testáveis.
- Agregação pela moda entre as folhas, com o mesmo `mode()` que o builder já usa
  para código e disciplina.

**Custo: nenhuma chamada nova.** É um campo a mais na chamada de visão que já
roda uma vez por prancha.

### Peça 2 — prefeitura: JÁ IMPLEMENTADA, nada a fazer

Correção a uma leitura errada da primeira versão deste spec: a prefeitura **já é
resolvida pelo carimbo**. `casarPrefeituraDoCarimbo`
(`server/nexo/agent/normalize.ts:130`) conta o campo `cliente` de todas as
folhas, casa o valor dominante contra os templates via `matchPrefeitura`, e é
chamada em produção no único caminho que monta `SlotFacts`
(`slot-request.ts:135`).

Quando ela ainda pergunta, é por um destes motivos — e todos são o
comportamento correto, não defeito:

- **Nenhuma folha trouxe `cliente`** → `undefined` → pergunta;
- **`plausibleCount === 0`**: o texto não casou com template nenhum, ou não
  passou em `nomeiaOrgao`;
- **`plausibleCount > 1`**: a mesma cidade tem variantes de template. A decisão
  é humana de propósito — ela diz para QUEM o volume vai, que é o erro que este
  produto existe para impedir.

**Ação desta peça: nenhuma mudança de código.** Se o slot continuar aparecendo
depois das Peças 1 e 3, o diagnóstico é olhar qual dos três casos ocorreu, com
os selos reais em mãos. Incluir isso na verificação final.

### Peça 3 — títulos pela disciplina

- `tituloCapa.deriveFrom` → `nomeNaCapa(disciplina)` → `PROJETO ESTRUTURAL`
- `tituloLd.deriveFrom` → `nomeNoDocumento(disciplina)` → `PROJETO DE ESTRUTURAS`

Os dois registros já existem em `server/nexo/disciplinas.ts`, e
`build-capa-proposal.ts:251` **já cai em `nomeNaCapa`** quando o título chega
vazio. A capacidade existe e está bloqueada atrás de um slot `required`.

Ambos deixam de ser `required`.

### Peça 4 — o card: quase tudo já existe

Segunda correção à primeira versão deste spec. **O card já afirma e já deixa
editável.** `FrameDoDocumento` desenha o modelo ODT e recebe `derivados` como
texto FANTASMA nos campos (`PlanoDeGeracao.tsx:558-577`) — `TITULO_CAPA` já vem
de `tituloSugerido`, que já usa `nomeNaCapa`; `MES_ANO` já vem de `dataDaCapa`.
O fantasma preserva a regra "vazio = vale o carimbo", então digitar por cima
vence o derivado sem que o controle brigue com quem digita.

Não há bloco novo a construir. Com as Peças 1 e 3, esses campos passam a ser
alimentados pelo selo em vez de ficarem vazios.

**O que falta é só a marca de divergência**: dizer, no próprio fantasma da data,
quantas folhas discordam do valor dominante. Sem ela, a folha intrusa entra sem
ninguém ver — que é o custo de afirmar em vez de perguntar.

## O que continua sendo perguntado

Número de tomos, tomo inicial, número do volume e nível da auditoria. São
decisões de verdade: não estão no selo.

## Cicatrizes a respeitar

**A data já foi derivada e foi revertida.** O `deriveFrom` do slot `mes` puxava
do relógio; a capa saía com a data de hoje e o engenheiro só descobria abrindo o
PDF — inclusive depois de ter pedido outra data na conversa. A remoção está
documentada em `requirements.ts`.

O que muda agora: a fonte passa a ser o documento, não o relógio, e o valor fica
**visível** antes de gerar. As duas condições precisam valer juntas — derivar do
selo sem mostrar repetiria o mesmo defeito com outra fonte.

**O endereço do escritório mora nas pranchas.** Um volume de Criciúma saiu como
Florianópolis porque `Rua Saldanha Marinho... Centro - Florianópolis - SC` está
impresso nas 71 folhas. `nomeiaOrgao` existe por causa disso e não pode ser
afrouxada ao passar a ler o órgão do selo.

## Testes

- `data-do-selo.ts`: os quatro formatos de carimbo, lixo em volta, mês inválido,
  ano de dois dígitos. Node cru, como `test:nexo:check`.
- `requirements`/`slot-resolver`: com selos completos, `nextMissing` não devolve
  nenhum dos quatro; com selos sem data, `mes` volta à fila; com dois órgãos
  plausíveis, `templateId` volta a ser perguntado.
- Divergência: maioria vence e o campo sai marcado.
- Regressão da cicatriz: sem data em nenhum selo, a capa continua caindo no mês
  corrente e o slot continua perguntável.
- Guarda do endereço: **já coberta** por `scripts/test-nexo-agent.ts:88`, que
  afirma que o endereço da PROSUL não casa prefeitura nenhuma. Não escrever de
  novo; só garantir que continua verde.

## Fora de escopo

- Centro de custo e endereço por prancha: ausentes do fluxo, mas não são o que
  bloqueia a montagem hoje. Entram depois, pelo mesmo caminho.
- A etapa de identificação pela primeira prancha: é outro desenho, e este não
  depende dela.
- Renomear os editáveis (`084_25_est_capas_a`): trabalho separado, já decidido.
