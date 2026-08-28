# Roadmap do pendente — traçado em 27/08/2026

> **Autoridade:** o Matheus mandou decidir e executar sem perguntar a cada
> bifurcação. As escolhas abaixo estão tomadas, com o motivo escrito. Onde uma
> escolha puder queimar dinheiro ou apagar trabalho, há portão — e só ali.

**Orçamento de modelo de HOJE: US$ 4,00** (de US$ 6,00 disponíveis). O plano de
gasto está na Fase 0 e é o único lugar deste documento que paga modelo.

---

## O que estava pendente, conferido no código em 27/08/2026

Três frentes, e nada foi commitado em 26/08 — o último commit é `1e9477e`, de
25/08.

| frente | de onde vem | estado real |
|---|---|---|
| Prova com token do chat advogado do diabo | `scripts/prova-chat-com-token.md` | escrita, **nunca rodada** |
| Lote de envio de achado (3 itens) | combinado em 25/08 | **nada feito**, nem desenho |
| UX: lotes 2 a 12 | `specs/2026-08-13-propostas-ux-ui-aprovadas.md` | abertos |
| Admin: A.8, A.6, A.9b | `specs/2026-08-13-admin-aprovado.md` | abertos |

**Reconferido item a item hoje, e três coisas mudaram de estado:**

- **O Lote 11 da spec de UX está MORTO.** Ele era "2.24, 2.25, 2.26 — admin:
  tabela de saúde, funil de calibração, custo por obra". A spec do admin
  substituiu os três: a 2.24 virou A.4 (feito, `lib/status-do-sistema.ts`), a
  2.26 virou A.7 (feito, `lib/custo-por-obra.ts`), e a 2.25 virou A.8 — o único
  pedaço que sobrou. **Não abrir plano para o Lote 11**; ele está inteiro dentro
  da Fase 6 deste roadmap. Isso tira um lote da fila sem trabalho nenhum.
- **Lote 0 e Lote 1 estão feitos** (`enquadramento-do-selo.ts` no
  `VisorDaFolha`), e A-I a A-VI também. A fila de UX real é: **2, 3, 4, 5, 6, 7,
  8, 9, 10, 12**.
- **A.10 (trilha de ações do admin) segue fora de escopo** até haver auth por
  pessoa. Registrar "quem tinha o token" dá aparência de trilha sem atribuição,
  e trilha em que não se pode confiar é pior que trilha nenhuma. Não reabrir.

## A lei que vale para toda fase deste roadmap

Herdada das duas specs e da lição de 15/08, e ela decide o que conta como
pronto:

1. **"Compila limpo" não é evidência de que roda.** `tsc` e `eslint` passaram
   verdes enquanto o servidor caía na inicialização. **Toda tela tocada é ABERTA
   antes de eu dizer que está pronta.**
2. **GREPE antes de construir.** As specs não registram o que foi feito; o
   código sim. Em 15/08 eu ia começar um item que estava pronto havia dois dias.
3. **Fato determinístico primeiro, IA por último.** Página e trecho saem sempre
   de ferramenta, nunca da cabeça do modelo.
4. **Commit direto na `main`, caminho por caminho**, nunca `git add -A`, sempre
   `git diff --cached --stat` antes.
5. **Teste novo entra no `package.json`** como `"test:<nome>"`.
6. Comentário e nome em **pt-BR**, explicando POR QUE.

---

# Fase 0 — HOJE: o que só o dinheiro responde ✅ FEITA EM 27/08/2026

**Por que primeiro:** o chat advogado do diabo está inteiro na `main` e
**não está provado**. Nove tarefas, sete suítes verdes, e ainda assim o que
está provado é que o mecanismo funciona — não que o auditor acerta. Enquanto a
prova com token não roda, a feature mais cara do mês é uma promessa. É o único
item da fila que dinheiro destrava, e é por isso que ele gasta o orçamento de
hoje antes de qualquer pixel.

## O plano de gasto, decidido com número medido

Medido hoje no banco (`AiUsageEvent`, 241 chamadas em 08/2026, US$ 12,33):

| corrida | modelo | custo real medido |
|---|---|---|
| auditoria de memorial **Padrão** | `gpt-5.6-terra` | **US$ 0,25** (0,131 global + 0,082 validação + 0,039 chunks) |
| auditoria de memorial **Profundo** | `gpt-5.6-sol` | **US$ 1,95** — 8x mais cara |
| turno de conversa | `terra` | US$ 0,005 em média |

**DECISÃO: a prova roda em Padrão.** As sete perguntas do roteiro medem se a
*página citada bate com o PDF* — isso é ferramenta determinística sobre o
`AuditText`, e a profundidade da leitura do motor não muda a resposta. Pagar
`sol` aqui seria comprar US$ 1,70 de nada.

    US$ 0,25   auditoria Padrão do memorial do kit
    US$ 0,50   as sete perguntas do roteiro, com folga de voltas
    ---------
    US$ 0,75   custo previsto
    US$ 3,25   RESERVA — cabe uma segunda corrida inteira se a primeira
               reprovar por defeito que eu consiga consertar na hora

**O teto do ambiente NÃO protege esta corrida**, e é bom estar escrito:
`NEXODOC_MONTHLY_BUDGET_USD` não está no `.env.local` (não há teto), e mesmo se
estivesse, `matheusmendes077@gmail.com` está em `NEXODOC_ADMIN_EMAILS` e
`isentoDoTeto()` o dispensa do bloqueio de propósito. **Quem segura os US$ 4 sou
eu, medindo.** Daí o passo 0.1.

## Passos

- [x] **0.1 — `scripts/gasto-de-hoje.ts`, o guarda-livros (sem token).**
      Soma `estimatedCostUsd` de hoje e do mês, quebrado por `flow` e `model`.
      Sem ele, "gastei US$ 4" é palpite. Registrar como `npm run gasto`.
      Rodar ANTES e DEPOIS de cada corrida paga, e colar a diferença aqui.

- [x] **0.2 — gerar o kit de memoriais** (sem token):
      `node scripts/gera-memoriais-defeituosos.mjs`. A pasta
      `docs/samples/_auditoria-teste/` é ignorada pelo git e **não existe nesta
      máquina agora** — precisa nascer. Conferir com
      `node scripts/confere-memoriais-defeituosos.ts`, que valida o gabarito
      sem pagar nada.

- [x] **0.3 — as sete suítes puras, antes de gastar.** Um defeito que um teste
      grátis pega não pode ser descoberto por uma corrida paga:

      npm run test:ancoragem && npm run test:memoria && npm run test:chat:ferramentas
      npm run test:chat:historico && npm run test:chat:laco && npm run test:chat:rota
      npm run test:chat:roteamento && npm run prova:chat-advogado

- [x] **0.4 — `npm run dev` RECÉM-INICIADO.** Um `next dev` velho dá falha de
      portão consistente e falsa. Reiniciar antes de acreditar em qualquer
      reprovação. Se o Chrome insistir em "X is not a function", só
      `Ctrl+Shift+R` resolve — apagar `.next` não.

- [x] **0.5 — a corrida paga**, seguindo `scripts/prova-chat-com-token.md`
      passo a passo. Arquivo escolhido: **`03-numerico-areas-e-unidades.pdf`** —
      o gabarito dele tem número conferível (813,98 × 1.480,00 × 902,45 m² nas
      páginas 6/13/28), e "em que página está X, e qual o valor?" tem UMA
      resposta certa. Um memorial de identidade não daria isso.

      **REPROVA sem apelação se a página citada não bater com o PDF.** Não
      arredondar o julgamento: página errada é o defeito que esta arquitetura
      inteira existe para impedir.

- [x] **0.6 — o número que fecha a feature.** O log traz uma linha por volta
      (`[ai] flow=audit-chat op=audit-chat-turn`). Anotar quantas voltas cada
      pergunta gastou e o custo da sessão, e então **decidir o teto de voltas**:
      hoje `NEXODOC_AUDIT_CHAT_MAX_TOOL_TURNS = 8` é palpite, e está escrito
      assim de propósito. Se a pergunta mais cara gastar 3, o teto vira 6 (o
      dobro do pior caso medido). Escrever o número medido no plano da feature.

- [x] **0.7 — fechar o estado.** Trocar, na spec do chat, "a prova com token
      ainda NÃO foi executada" pelo resultado e pela data. Commit.

**PORTÃO:** se a prova REPROVAR na página citada, a Fase 1 não começa. Um chat
que cita página errada é pior que chat nenhum, e vira o trabalho do dia
seguinte. Se reprovar em algo cosmético, anoto e sigo.

---

# Fase 1 — O lote de envio de achado ✅ FEITA EM 27/08/2026

**Por que aqui:** foi pedido em 25/08 e adiado por um dia que já passou. Não
paga modelo, e os três itens tocam o mesmo arquivo
(`components/audit-result.tsx`, fila `data-acoes-do-achado`, hoje
`[Marcar corrigido] [Decisao tecnica] [···]`). A dúvida que travava já foi
respondida.

- [x] **1.1 — o portão CAIU, por decisão do Matheus.** Ele deu autonomia para
      fechar as atividades sem perguntar a cada passo, e um desenho para
      aprovação era exatamente a pergunta que ele mandou parar de fazer. Fui ao
      código e mostrei o resultado — `npm run prova:envio`.

- [x] **1.2 — "pop" de achado enviado.** Hoje o retorno é o `feedbackNotice`,
      mono pequeno perto da barra, e some no ruído. **Componente novo, não
      reuso:** `components/ui/` não tem toast e nenhum arquivo usa
      sonner/snackbar — conferido hoje, a pasta tem 19 primitivos e nenhum
      deles serve.

- [x] **1.3 — seleção em massa.** "Selecionar todos", ou todos os do FILTRO
      atual (todos os críticos, todos de hidrossanitário). Hoje são 22 cliques
      para mandar 22 achados. **Não é falta de função:** o envio em lote já
      existe — a etiqueta "Ref. INC-00x" é caixa de seleção e a barra do rodapé
      manda todos numa requisição só. O que falta é marcar rápido.

      **RECUSADO de propósito:** mandar o mesmo achado para várias pessoas. Um
      achado tem UM dono; reatribuir passa de mão, não soma. Duas pessoas dariam
      duas respostas possíveis para "com você" e para o desfecho.

- [x] **1.4 — botão ENVIAR ao lado de "Decisão técnica".** Hoje "Enviar para
      alguém" só existe dentro do `···` (`audit-result.tsx:3089`). Promover a
      irmão dos outros dois, **mantendo o comportamento**: o botão MARCA o
      achado e a barra do rodapé escolhe a pessoa. Um segundo seletor seria uma
      segunda regra de quem pode receber, e as duas discordariam no primeiro
      dia.

      Cuidado medido: a fila já quebra em duas linhas no painel estreito do Nexo
      com três controles. Com quatro, resolver a quebra faz parte do item.

- [x] **1.5 — a dívida cosmética junto:** a barra de envio do rodapé quebra em
      duas linhas no painel do Nexo e o "LIMPAR" cai sozinho embaixo
      (`ml-auto` + `flex-wrap`). Está anotada desde 25/08 e é a mesma tela.

- [x] **1.6 — abrir a tela** (lei 1) e commitar.

---

# Fase 2 — Lote 2 da UX: as duas metades que fecham ✅ FEITA EM 27/08/2026

**Por que aqui:** são as duas linhas da "Parte C" da spec — meio caminho já
andado, uma tarde cada, e a primeira apaga um defeito que a tela confessa.

- [x] **2.1 — o botão Regenerar (item 1.6).** Conferido hoje:
      `modules/nexo/components/NexoCanvas.tsx:200` diz "Gere de novo antes de
      montar o volume" e **não existe botão nenhum** que faça isso — a string
      "Regenerar" não aparece em lugar nenhum do produto. A tela manda fazer
      algo e não oferece o gesto.

      **Não depende de decisão de storage:** o caminho determinístico de
      regeneração já existe; o botão só o chama.

- [x] **2.2 — recibo do drop (item 2.11).** `NexoWorkspace.tsx:545-551` já
      nomeia as folhas que falharam e `lib/estado-do-anexo.ts` dá estado por
      arquivo. Falta só o formato de recibo: `200 recebidos · 198 lidos · 2
      falharam`.

---

# Fase 3 — Lote 3: fechar o loop de valor da auditoria ✅ FEITA EM 27-28/08/2026

Itens **2.19, 2.20, 2.21**. A lei 2 (GREPE antes de construir) pagou o dia
inteiro aqui: **dos três, só um era trabalho.**

- [x] **2.19 — delta entre auditorias: JÁ ESTAVA FEITO.** `lib/diff-de-pareceres.ts`
      compara dois pareceres pelo TIPO do defeito e pelo TRECHO citado (nunca
      pelo id, que é posicional, nem pela página, que é o dado que mais se move
      entre revisões), e `PalcoDoNexo.tsx:372` já mostra o resumo no topo do
      parecer, sumindo quando não há auditoria anterior — exatamente o aceite da
      proposta, inclusive o "sem estado vazio constrangedor".

- [x] **2.20 — custo antes do Profundo: MORTO, e não por preguiça.** Não há
      Profundo para preceder. O slot `nivel` foi removido em 17/08/2026 com
      argumento medido (`server/nexo/agent/requirements.ts:442`): no 156-25, os
      dois níveis custavam os MESMOS US$ 0,82, e o "Padrão" amostrava 25% do
      documento — não era barato-contra-caro, era ler contra não ler pelo mesmo
      preço. A auditoria tem um nível só, `/audit` só redireciona para `/nexo`, e
      nenhuma tela oferece a escolha. **Se um dia voltar a haver escolha, que
      seja entre coisas diferentes de verdade** (auditoria completa × reconferir
      só o que mudou) — e aí este item renasce com outro enunciado.

- [x] **2.21 — o parecer impresso.** Era o único trabalho de verdade, e está
      feito em três camadas:
      `lib/parecer-em-papel.ts` (estrutura, quebra e paginação — puro, com o
      medidor INJETADO, `npm run test:parecer-papel`, 13 asserções),
      `server/pdf/parecer.ts` (o desenho com `pdf-lib`) e
      `app/api/nexo/parecer` (a rota). No menu **Exportar**, em primeiro lugar.

## O que o parecer em papel decidiu, e por quê

- **`pdf-lib`, e não o caminho ODT→LibreOffice.** O `render-service` converte
  ODT que veio de um MODELO; o parecer não tem modelo, e criar um empurraria a
  identidade da peça para dentro de um binário que ninguém revisa em diff.
- **As 14 fontes padrão.** Embutir a IBM Plex exigiria o arquivo da fonte no
  repositório mais o `fontkit`. O que a identidade pede aqui é a HIERARQUIA —
  texto proporcional, dado monoespaçado —, e Helvetica/Courier a entregam. O dia
  em que a Plex entrar, só `server/pdf/parecer.ts` muda.
- **`paraWinAnsi`, e é o detalhe que teria quebrado em produção.** As fontes
  padrão codificam em WinAnsi e `drawText` **lança** fora dela. Um memorial que
  escreve "largura ≥ 1,20 m" derrubaria a exportação inteira. A troca é por
  equivalente legível (`>=`), nunca por vazio — apagar o sinal mudaria o sentido
  da evidência que o parecer está citando. Está na prova.
- **O cabeçalho de um achado nunca fica órfão no pé da página**, e o rótulo
  ("EVIDÊNCIA") desce junto com o texto dele. Quem confere papel lê o achado
  inteiro de um golpe ou não confia nele.
- **A moldura chanfrada só na primeira folha.** Repetida em todas viraria borda
  de formulário; assinatura que se repete deixa de ser lida.
- **O rodapé em toda página**, com obra, código e `n/total`: folha solta de
  parecer circula sozinha no escritório, e a que chega à mesa do fiscal pode ser
  a página 4.
- **Análise parcial é dita no papel**, logo abaixo do veredito. Um parecer
  incompleto impresso sem essa linha é a pior peça que este sistema poderia
  produzir.
- **Sugestão da IA não vai para o papel.** A validação a rebaixou; imprimi-la ao
  lado de um achado sólido apagaria a distinção que a validação existe para fazer.

**Provas:** `npm run test:parecer-papel` (13, puro) · `npm run prova:parecer`
(gera o PDF e **relê com pdfjs** — 14 asserções, sem servidor) ·
`npm run prova:parecer-tela` (a rota recusa sem sessão, devolve `%PDF-` com
sessão, e o item existe no menu — 11 asserções).

**Duas armadilhas que a prova pegou e valem registro:** a primeira versão da
asserção do menu passava lendo o cabeçalho do próprio parecer, porque a obra
semeada se chamava "Prova do parecer em PDF" — nome de fixture não pode conter o
texto que a prova procura. E o `Dropdown` sai por **portal no `document.body`**:
ler o palco depois do clique devolve a tela sem o menu.

---

# Fase 4 — Lote 4: o canvas vira conferível — 2.16 FEITO EM 28/08/2026

Itens **2.16, 2.14, 2.15**, nesta ordem e por este motivo: **teclado primeiro**
(barato e independente de tudo), zoom depois, coluna da LD por último.

- [x] **2.16 — navegação por teclado.** Setas andam nó a nó, `E` abre a
      correção do carimbo, `Enter` abre a página original. A decisão de "qual nó
      a seta seleciona" é pura (`modules/nexo/lib/navegacao-por-teclado.ts`,
      `npm run test:teclado`, 9 asserções) e o resto é provado no navegador
      (`npm run prova:teclado`, 14 asserções).
- [x] **2.14 — zoom semântico.** Três densidades, com os dois limiares como
      constantes nomeadas (`modules/nexo/lib/densidade-do-canvas.ts`,
      `npm run test:densidade`, 8 asserções) e a travessia provada no navegador
      (`npm run prova:zoom`, 16 asserções).
- [x] **2.15 — modo conferência (LD × canvas).** FEITO em 28/08/2026, pelos
      três passos que o bloqueio abaixo indicava. **A Fase 4 está fechada.**

## 2.14 — o que a implementação decidiu

- **O nível "longe" já tinha metade pronta.** A proposta pede "fileiras de tomo
  com contagens" no zoom de conjunto, e o `RotuloNode` já desenha "Tomo NN" com
  a contagem ao lado de cada fileira. O que faltava era o oposto: as FOLHAS
  ficarem quietas nessa distância.
- **`useStore` com o seletor mapeando zoom→densidade, e não `useViewport`.**
  `useViewport()` devolve um número novo a cada quadro do gesto, e cada quadro
  reenderizaria os duzentos nós — o oposto do que o zoom semântico existe para
  resolver. Mapeando para um dos três NOMES antes da comparação, o nó só volta a
  renderizar quando a faixa muda: duas vezes num gesto inteiro, não sessenta.
- **Render condicional, não CSS que esconde** — é a nota da própria proposta, e
  DOM oculto em duzentos nós pesa igual.
- **A marca de "corrigido à mão" sobrevive aos três níveis**, e a prova a mede
  no zoom em que todo o resto sumiu: é o único aviso de que aquele valor veio de
  uma pessoa, e escondê-la de longe faria a varredura mentir justamente sobre o
  que a máquina não leu.
- **O aviso da folha avulsa vira PONTO de longe, em vez de sumir.** "Sem código
  · não sai na LD" é defeito de verdade; a varredura de conjunto é exatamente
  aquela em que ele passaria batido.
- **As ações do nó selecionado somem no zoom de longe.** Lá os rótulos viram
  fiapo de 4px e o nó selecionado ficava três vezes mais alto que os vizinhos —
  a escada que o comentário das cinco linhas existe para evitar, recriada pela
  própria seleção. Quem navega por teclado não perde nada: `E` e `Enter` fazem o
  mesmo. **A prova mede as alturas** e exige que a grade continue regular.

## 2.15 — o bloqueio que foi apurado ANTES de escrever uma linha, e resolvido

A spec manda **reusar** o resultado da conferência leve em vez de recomputar no
cliente — e está certa. Só que **o resultado reusável não serve para marcar o
nó**, e isso precisa ser resolvido antes:

`LightCheckFinding` (`server/nexo/light-check-core.ts:17`) tem `severidade`,
`campo`, `mensagem` e `detalhe` — **e nenhuma referência a uma folha**. As
mensagens são agregadas por construção ("Pranchas com códigos de projeto
divergentes (…)", "Folha(s) faltando na sequência 1..N: 3, 7"). O aceite da
proposta é "divergência LD×folha aparece **no nó** e na linha"; com o que existe
hoje, dá para pintar a COLUNA inteira de aviso e não dá para dizer QUAL nó.

**As duas saídas, e a escolha:**

1. **Acrescentar a folha ao achado** — um campo opcional em `LightCheckFinding`
   apontando as folhas envolvidas. É onde a informação já está (a checagem sabe
   quais pranchas entraram em cada grupo, ela só descarta isso ao formatar a
   frase), o módulo é PURO e já tem teste, e um campo opcional não quebra
   nenhum consumidor. **É esta.**
2. Recomputar no cliente — a spec proíbe, e com razão: seriam duas verdades
   sobre a mesma conferência, divergindo na primeira regra nova.

**Foi essa a ordem executada:**

**(a) O core passou a dizer quais.** `LightCheckFinding.folhas?: string[]`, com
o mesmo `label` que já entrava no `SeloFact` — o nome do arquivo, que os dois
lados já usam. Nenhum consumidor mudou (campo opcional). Cinco asserções novas
em `npm run test:nexo:check`, e duas delas registram as decisões que importam:

- **TODAS as envolvidas, não "a errada".** Numa divergência de código ninguém
  sabe qual grupo é o intruso; eleger a minoria como culpada seria palpite com
  cara de fato.
- **A folha FALTANDO não aponta nó nenhum.** Ela não está no conjunto — marcar
  um vizinho seria acusar o inocente. A ausência do campo é informação.

**(b) A tradução do agregado para a folha** vive em
`modules/nexo/lib/conferencia-por-folha.ts` (`npm run test:conferencia-folha`,
7 asserções). A regra que a prova defende: **a pior severidade vence**, mesmo
quando o aviso vem primeiro na lista — rebaixar ali esconderia o problema na
única tela em que ele seria visto.

**(c) A coluna e a sincronização nos dois sentidos.** As linhas saem dos MESMOS
nós, na MESMA ordem: montar a lista de outra fonte criaria duas ordens para a
mesma coisa, e as duas discordariam justamente quando alguém reordenasse um
tomo. Clicar na linha seleciona o nó; andar de seta move a linha — a segunda
metade reusa a seleção por id que o 2.16 montou, e sem ela quem confere pelo
teclado veria a coluna parada.

**Três decisões de desenho, e a terceira veio de olhar a tela:**

- **Sem verde.** "Sem divergência" é o normal, e o normal é mudo: duzentos
  pontos verdes apagariam os três coloridos que importam.
- **A conta em número, não em cor** ("2 de 4 com divergência") — lê-se igual em
  preto e branco e por quem não distingue matiz. E o zero é dito, porque "nada
  aqui" e "não conferido" são coisas diferentes.
- **A coluna OCUPA espaço, não flutua.** Na primeira versão ela era um painel
  absoluto e cobria a barra do canvas ("+ Folha", "+ Tomo") e a dica dos
  atalhos — e o `fitView` seguia enquadrando o volume POR BAIXO dela, então
  parte das folhas nascia escondida. Como irmã do fluxo, o canvas só fica mais
  estreito. **Isso só apareceu na captura**, não nas asserções: a prova passava
  com a coluna por cima de tudo.

## O que o teclado obrigou a mudar, e por quê

**O estado do formulário de correção SAIU do nó e foi para o canvas.** Era local
ao `FolhaNode` e só abria pelo botão — e o teclado não tem como apertar um botão
que só existe dentro de um nó. Com a decisão no canvas, mouse e `E` passam pela
mesma porta.

**E os campos deixaram de ser SEMEADOS no clique.** Eles eram preenchidos no
`onClick` do botão "Corrigir"; aberto por outro caminho, o formulário nasceria em
branco e salvar **apagaria o que o OCR tinha lido certo**. Agora derivam do dado
(`texto ?? data.titulo`), e o passo que só um dos caminhos dava deixou de
existir. A prova mede exatamente isso: "o formulário nasce PREENCHIDO".

**`disableKeyboardA11y` no ReactFlow.** A a11y de teclado do xyflow move o NÓ
com as setas — e aqui a posição é derivada do arranjo em fileiras, então mover
por tecla escrevia uma coordenada que o próximo render descartava. Gesto sem
efeito, competindo com a navegação que a conferência precisa.

**A guarda de digitação virou uma só.** `NavegacaoDoCanvas` já tinha a sua cópia
(para os atalhos `+`, `-`, `0`, `1-9`), e faltava `SELECT` nela. As duas agora
importam `ehDigitacao` — era exatamente o caso de "duas cópias da mesma regra
divergem na primeira lembrança de um caso novo".

**A dica aparece com `focus-within`**, não permanente: sobre duzentas folhas ela
seria ruído, e atrás de um "?" que ninguém abre seria documentação para ninguém.

## O defeito que só o navegador viu

`emCorrecao: noEmCorrecao === id` comparava o id do **nó** (`folha:<id>`) com o
id da **folha** (`<id>`). O `E` chegava ao canvas e não abria nada — silêncio que
parece tecla morta. Nenhum teste puro veria isso: a decisão estava certa, o
casamento é que não acontecia. **É o argumento inteiro a favor de abrir a tela.**

E duas armadilhas do lado da prova, ambas de seletor: `page.locator("textarea").last()`
caía no **compositor da conversa**, não no campo do formulário (a asserção
acusava "nasce em branco" um formulário correto); e a prova dependia do projeto
de exemplo, que não estava semeado — semear a própria conversa deixou a prova
dona do que ela mede.

---

# Fase 5 — Lote 5: proveniência e trace

Itens **1.2, 1.3, 2.9**. Destravado — o Lote 0 já documentou `--signal-info`
como a cor de "informação", e **não há decisão de cor pendente**.

**Entregar a versão de três origens** (nome do arquivo / carimbo / mão), NÃO
`folha 07 · canto inferior direito`. Hoje `classify-documents.ts` guarda
confiança por *arquivo*; origem por campo não existe, e inventar precisão que o
dado não tem é o pior desfecho possível aqui.

---

# Fase 6 — Admin: A.8, A.6, A.9b (e o enterro do Lote 11)

**Por que só agora:** o admin é onde mora quem paga a conta, mas A-I a A-VI já
entregaram o que importa — sistema visual, header, linha de status, confirmação
de privilégio, dados do escritório e custo por obra. O que sobra é acabamento.

- [ ] **6.1 — A.8 (era A-VII, e engole a 2.25 do Lote 11):** `/admin/quality`
      com série semanal e **meta declarada**. Sem meta, série é enfeite.
      **Gráfico decorativo é fora de escopo:** tabela mono ou sparkline de 1px,
      e o `DESIGN.md` já proíbe métrica-herói colorida.
- [ ] **6.2 — A.6 (A-VIII):** `/admin/config` com hierarquia de atenção, e
      **fundir a "última falha" duplicada numa fonte só**. Dois lugares dizendo
      a mesma coisa vão discordar.
- [ ] **6.3 — A.9b (A-IX):** preferências da pessoa. Acabamento declarado como
      tal na própria spec.
- [ ] **6.4 — riscar o Lote 11 da spec de UX**, com o motivo, para ninguém
      abrir plano para ele de novo.

---

# Fase 7 — Lote 7: onboarding, e o suporte que destrava dois lotes

Itens **2.4, 2.5, 2.3+** — checklist, partidas e ampliação do projeto de
demonstração (`lib/projeto-exemplo.ts`, 375 linhas, já existe com outra forma).

**Esta é a fase-gargalo do fim do roadmap:** o suporte a **intenção inicial na
rota `/nexo`** nasce aqui, e **2.5, 2.28 e 1.1 dependem dele**. É por isso que 7
vem antes de 8 e de 10 — inverter significa construir o mesmo suporte duas
vezes.

---

# Fase 8 — Lotes 8 e 10, sobre a intenção inicial

- [ ] **8.1 — Lote 8 / item 1.1: command palette.** Componente **do zero**: não
      há `Command` de biblioteca no projeto (A.5 da spec).
- [ ] **8.2 — Lote 10 / item 2.28: banner de ponte para o Nexo.** **Uma tela
      só** — a premissa de "quatro ferramentas antigas" está errada, restou uma
      (A.2 da spec).

---

# Fase 9 — Lote 9 e Lote 12: o acabamento

- [ ] **9.1 — Lote 9 / item 2.22:** a régua vira índice, **respeitando A.4**: a
      barra de leitura não sinaliza falha, e isso é de propósito. Não
      transformar índice em alarme.
- [ ] **9.2 — Lote 12:** favicon vivo, selo e gabarito do login, orbe
      "aguardando você" (**1.4, 2.1, 2.2, 2.23**).

---

## O que este roadmap NÃO vai fazer, e por quê

Escrito para eu não reabrir sozinho no meio do caminho:

- **2.13 minimapa** — rejeitado com autópsia: o `MiniMapNode` do xyflow descarta
  nó sem dimensão declarada e o mapa saía vazio. Não reabrir sem resolver isso
  primeiro.
- **2.29 prontuário da obra** — retirado pelo mantenedor.
- **A.10 trilha do admin** — só depois de auth por pessoa.
- **Lote 11** — morto, absorvido pela Fase 6.
- Cor nova fora dos quatro tokens; tema claro; dashboard de métrica-herói;
  emoji; mudança de stack, de modelo de IA ou de pipeline de geração.

## Verificação, ao fim de cada fase

    npx tsc --noEmit && npm run lint && npm run prova:rotas

E **a tela aberta**, sempre — porque `tsc` verde já conviveu com servidor caído.

Se `tsc` acusar centenas de erros de `@prisma/client` e `lucide-react` que não
fazem sentido, o `node_modules` deste worktree é cópia parcial (SWC com 6 MB em
vez de 136 MB). Cura: `rm -rf node_modules .next && npm ci && npx prisma generate`.

---

## Registro de gasto — preencher durante a Fase 0

| quando | corrida | US$ | acumulado |
|---|---|---|---|
| 27/08 | auditoria standard do 117-25 + 6 perguntas | 0,6019 | 0,60 |
| 27/08 | só as perguntas (`PROVA_AUDIT_ID`) | 0,3296 | 0,93 |
| 27/08 | só as perguntas | 0,4381 | 1,37 |
| 27/08 | só as perguntas — **PROVA OK, 15/15** | 0,3016 | **1,67** |

**Sobrou US$ 2,33 do teto de hoje.** As quatro corridas foram necessárias
porque as três primeiras reprovaram **no conferidor, não no produto**: markdown
(`**`) e aspas curvas não removidos antes de comparar, um regex que casava o
texto ENTRE duas citações, e uma asserção que proibia citar página numa resposta
em que citar era o certo (o chat negou "escada rolante" e apontou a escada FIXA
que existe). Cada correção está escrita no script, no lugar onde estava o erro.

**Nenhuma das reprovações foi do produto.** Todas as citações do chat foram
conferidas à mão contra o gabarito e todas existiam.

**Teto de hoje: US$ 4,00** — fechou em US$ 1,67. Nenhuma fase de 1 a 9 precisa
de token.

## O que a Fase 0 deixou pronto para o resto

- `npm run prova:chat-token` (com `PROVA_PAGA=1`) é agora uma prova de regressão
  repetível, não um roteiro manual. Com `PROVA_AUDIT_ID` custa ~US$ 0,33.
- **O teto de 8 voltas está medido** e escrito no `run-chat-turn.ts`.
- `npm run gasto:auditoria` passou a somar o chat junto com o motor.
- **PORTÃO ABERTO:** a prova passou, então a Fase 1 pode começar.


---

# O que a execução de 27/08 acrescentou ao registro

## Fase 1 — provada na tela: `npm run prova:envio`

17 asserções, todas verdes. Semeia a auditoria no banco, abre o parecer no
painel do Nexo e mede o que só existe no navegador.

**A quebra em três linhas ACONTECEU**, como a spec previa, e foi medida em vez
de julgada por captura: a fila tem **274px** (254 de conteúdo) e os quatro
controles somavam **433px**. Duas mudanças a resolveram, nesta ordem:

1. `@container` na fila, e os ícones de "Marcar corrigido" e "Enviar" saem
   abaixo de 21rem. Ícone vale ~22px com o gap; o rótulo é o que não pode sair
   ("Decisão técnica" sem texto é um quadrado mudo). Ficou em 385px.
2. **A ordem passou a ser por frequência de uso** — "Marcar corrigido" e
   "Enviar" primeiro, "Decisão técnica" e `···` depois. Não é só hierarquia: com
   os números acima, 144+8+72 = 224 cabe na primeira linha com folga, enquanto a
   ordem antiga empurrava o `···` sozinho para uma terceira linha, vinte e duas
   vezes por parecer.

A prova mede as linhas pelas caixas dos botões, e não por captura — julgar isso
a olho já deu falso positivo nesta tela.

## Fase 2 — um defeito latente que ninguém tinha visto

O `ResultLinks` saía com `return null` quando **não havia arquivo** — e o caso
mais comum de bytes ausentes é justamente esse: conversa aberta noutra máquina
não tem blob nenhum, o restaurador pula todos e marca `bytesAusentes`. **O aviso
que o componente existe para dar nunca chegava à tela** no único caso que o
pedia. A regra virou `modules/nexo/lib/links-do-resultado.ts`, provada em
`npm run test:links`.

O botão Regenerar está ligado em cinco lugares (LD, capa, volume, separatriz e
cada item do plano). No plano foi preciso extrair `gerarUmItem` de `gerarTudo`:
refazer o plano inteiro gastaria de novo os documentos que estão íntegros.

**O QUE NÃO FOI PROVADO NA TELA, e precisa ser dito:** o botão Regenerar não foi
exercitado num card real com bytes ausentes. Chegar a esse estado exige uma
conversa gerada em OUTRA máquina, e a fixture para forjá-la (selos + proposta +
artifactId derivado de `idsBaseDosArtefatos`) custa mais que o que provaria. O
que está provado: a regra de visibilidade (node), os tipos (`tsc`), e que o
`onRegerar` é o mesmo `confirm()` que gerou da primeira vez. **Quando aparecer
um caso real de bytes ausentes, abrir e conferir.**

## Duas lições de processo desta sessão

**`prettier --write` num arquivo que não estava formatado reescreve o mundo.**
O `audit-result.tsx` tinha 988 linhas fora do padrão, e o commit da feature
nasceu com 2596 linhas mexidas — ilegível. Foi separado em dois: um commit só de
formatação, outro com as 443 linhas que são a mudança. **Confira
`prettier --check` no arquivo ORIGINAL antes de rodar `--write`;** se ele já
estiver sujo, formate em commit próprio primeiro.

**Cinco erros de `react-hooks/rules-of-hooks` em
`modules/nexo/lib/largura-do-copiloto.ts` são PRÉ-EXISTENTES** (`usarLargura…`
não começa com "use"). `npm run lint` nunca fecha em zero hoje; não os confunda
com dano novo.
