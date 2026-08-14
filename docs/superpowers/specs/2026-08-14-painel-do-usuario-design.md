# Painel do usuário — descrição de design

> **Para que serve este documento:** descrever as telas, os estados e o conteúdo
> com detalhe suficiente para o desenho visual ser feito a partir dele. Não é
> plano de implementação e não contém código.

**Data:** 14/08/2026
**Decisões tomadas por:** Matheus (mantenedor)

---

## 1. Por que estas telas existem

Em 13 e 14/08/2026 o NexoDoc ganhou um substrato que ele não tinha: **o projeto
passou a pertencer ao escritório** (e não a uma pessoa), **toda rota de API passou
a exigir vínculo com o escritório**, **auditoria passou a exigir projeto**, e
**achado virou pendência que uma pessoa envia a outra**.

Isso criou capacidades sem tela. Hoje:

- **convidar alguém só existe como API** — não há interface;
- **a fila aparece só como uma lista na home**, e não há lugar nenhum que mostre
  o que **você** enviou para os outros;
- a home continua sendo uma grade de cartões de módulo, desenhada para um mundo
  em que o produto era um conjunto de ferramentas soltas.

Este documento descreve o painel que substitui essa home, e as duas telas de
apoio que a decisão de acesso exige.

---

## 2. Os dois papéis

O sistema passa a ter **exatamente dois estados de pessoa**. Isso substitui os
três eixos que existiam (papel de plataforma, papel de escritório, e lista de
e-mails por variável de ambiente).

### Usuário

Todo mundo que trabalha no NexoDoc. Pode:

- conversar com o Nexo e rodar auditoria;
- **criar projeto anexando documento** — o centro de custo é lido do PDF;
- receber achados, dar desfecho, enviar achados a outra pessoa;
- montar volume, gerar capa, gerar LD;
- ver os projetos do escritório.

### Admin

**Uma pessoa: o Matheus.** Além de tudo o que o Usuário faz:

- **liberar e remover acessos** (tela nova, seção 6);
- ver uso de tokens e custo de IA (`/admin/usage`, já existe);
- ver histórico dos usuários e do sistema (`/admin/users`, `/admin/audits`,
  `/admin/lds`, `/admin/quality`, já existem);
- configurar modelos de IA (`/admin/config`, já existe).

**Consequência de projeto:** a alçada de cadastrar projeto deixa de existir como
conceito, porque o formulário de cadastro manual sai da interface (seção 8.2).

---

## 3. A porta de entrada: lista de permitidos

**Regra:** só entra quem o Admin colocou na lista. Não há autoatendimento.

Isto **reverte** o vínculo automático que foi ligado em 14/08/2026, no qual
qualquer conta Google que abrisse o site virava membro. O automático não deve
ficar disponível como padrão — desligá-lo por variável de ambiente seria uma
armadilha esperando alguém apagar a variável.

**Fluxo de quem chega:**

1. A pessoa faz login com Google.
2. O sistema verifica se o e-mail está na lista de acessos.
3. **Está:** entra no painel (seção 4).
4. **Não está:** vê a tela "sem acesso" (seção 7). Não vê projeto, não vê fila,
   não vê nada do escritório.

---

## 4. Tela principal: o Painel

**Rota:** `/` (a raiz, depois do login)
**Substitui:** a grade de cartões de módulo que existe hoje.

### 4.1 Estrutura

Três colunas de **peso igual**, lado a lado, com uma barra fina no topo.

```
┌──────────────────────────────────────────────────────────────┐
│  NexoDoc      Projetos   Volumes            Matheus · PROSUL │
├────────────────────┬────────────────────┬────────────────────┤
│                    │                    │                    │
│   PARA VOCÊ        │       ORBE         │  ONDE VOCÊ PAROU   │
│   (cards)          │      (grande)      │  VOCÊ ENVIOU       │
│                    │                    │  GERADOS POR VOCÊ  │
│                    │   "Fale com o      │  ANOTAÇÕES         │
│                    │       Nexo"        │                    │
│                    │                    │                    │
└────────────────────┴────────────────────┴────────────────────┘
```

### 4.2 Barra de topo

Contém a marca, dois destinos (**Projetos** e **Volumes**) e a identificação da
pessoa com o escritório. Projetos e Volumes ficam aqui, e não como widget, porque
são **lugares**, não números.

Para o Admin, a barra ganha um terceiro destino: **Admin**.

### 4.3 Coluna da esquerda — "Para você"

A fila de achados que outras pessoas enviaram para esta pessoa. **É uma lista,
não um kanban**: não se arrasta nada.

**Cabeçalho:** o rótulo "Para você" e a contagem à direita.

**Cada card contém:**

- **título do achado** (ex.: "Cota divergente") — em destaque;
- **quem enviou** ("de Milton");
- **o projeto**, como etiqueta (ex.: `063-26`);
- **há quanto tempo está parado** ("ontem", "2 dias", "parado há 9 dias").

**A tarja de esquecimento:** quando um card passa de um limiar de dias sem
desfecho, ele ganha destaque visual próprio — borda e texto em cor de alerta, e o
tempo escrito por extenso ("parado há 9 dias"). O alerta fica **junto do item**,
e não num widget de canto, porque alerta ao lado da coisa é o que a pessoa vê.

**Ao clicar num card:** abre a auditoria de origem já com aquele achado em foco.
Esse comportamento já existe hoje como link direto.

**Ordenação:** os parados há mais tempo primeiro.

### 4.4 Coluna do meio — o orbe

O orbe é a identidade do produto e ocupa o eixo central da tela. É grande, mas
não maior que as colunas laterais — as três têm o mesmo peso.

**Abaixo dele:** uma chamada em duas linhas — "Fale com o Nexo" e, mais discreta,
"ou solte um PDF em qualquer lugar da tela".

**Ao clicar no orbe:** vai para o Nexo, a conversa.

**Arrastar arquivo:** a **tela inteira** é alvo de soltar, não só o orbe. Quando o
usuário arrasta um arquivo sobre qualquer parte do painel, o orbe reage
visualmente e a área de soltar se torna evidente. Soltar inicia o fluxo de
auditoria — que é como o projeto nasce agora.

Não existe um widget separado de "solte um documento": dois alvos de arrastar na
mesma tela fazem a pessoa não saber onde soltar.

### 4.5 Coluna da direita — quatro widgets

Nesta ordem, de cima para baixo. A ordem é por frequência de uso, não por
importância.

**1. Onde você parou**
Três a quatro linhas com as auditorias mais recentes desta pessoa: nome e há
quanto tempo. Clicar abre a auditoria. É o primeiro gesto do dia: a pessoa
raramente chega para começar algo novo, ela chega para continuar.

**2. Você enviou · esperando**
Os achados que **esta pessoa** enviou a outras e que ainda não voltaram. Cada
linha traz o achado e para quem foi ("Prancha 04 → Victor"). Cobre um buraco
real: hoje quem atribui fica cego, e cobrar depende de memória.

**3. Gerados por você**
Histórico dos documentos que esta pessoa gerou — capa, volume, LD — com nome e
quando. **Atenção, ver seção 9.3:** hoje o sistema cataloga os arquivos mas não
guarda os bytes, então **não é possível baixar de novo**. Enquanto isso não
mudar, clicar numa linha leva ao projeto ou à auditoria de origem, não ao
arquivo.

**4. Anotações**
Um bloco de texto livre, salvo automaticamente, um por pessoa. É o menos
importante e o mais usado. Fica por último porque não tem pressa e pode sumir no
celular sem prejuízo.

---

## 5. Estados do Painel

### 5.1 Vazio — pessoa nova, sem projeto e sem pendência

- **Esquerda:** "Nada com você" — uma frase curta e calma, sem ilustração de
  celebração. A ausência de trabalho não é conquista, é o estado inicial.
- **Meio:** o orbe, com a chamada mudada para convidar o primeiro documento —
  este é o único momento em que o centro fala mais alto que as laterais.
- **Direita:** "Onde você parou" e "Gerados por você" **não aparecem**. Widget que
  mostra caixa vazia ensina a pessoa a ignorar aquele canto da tela. "Anotações"
  aparece, porque funciona desde o primeiro minuto.

### 5.2 Carregando

As três colunas mostram a própria estrutura em estado de espera (esqueleto), e
não um giro central. O orbe **não** vira indicador de carregamento — ele é a
identidade e precisa estar presente e estável desde o primeiro quadro.

### 5.3 Erro

Se a fila ou os widgets falharem ao carregar, a coluna afetada mostra a falha e
um caminho de tentar de novo. **O orbe continua funcionando**: falha em widget
não pode impedir a pessoa de trabalhar.

---

## 6. Tela nova: Acessos (só Admin)

**Rota sugerida:** `/admin/acessos`

O Admin abre esta tela, digita o e-mail de quem vai ter acesso, e essa pessoa
passa a conseguir entrar. Quem não está na lista não entra.

**A tela tem duas partes:**

**Liberar acesso** — um campo de e-mail e um botão. Aceita um e-mail por vez.
Após liberar, a pessoa aparece na lista abaixo, marcada como quem ainda não
entrou.

**Quem tem acesso** — a lista, com uma linha por pessoa:

- e-mail;
- nome, quando já existir (ele só existe depois do primeiro login);
- **estado**: "aguardando primeiro acesso" ou "ativo";
- **desde quando** tem acesso;
- **último acesso** — a informação que revela conta esquecida;
- **remover acesso**, com confirmação.

**Regras de conteúdo:**

- remover acesso **não apaga** o histórico da pessoa: as auditorias e os
  documentos que ela produziu continuam existindo e atribuídos a ela;
- o próprio Admin não pode remover a si mesmo — a tela não oferece o botão na
  linha dele;
- e-mail repetido não cria linha nova nem reverte alguém que já está ativo.

**As demais telas de admin não mudam:** `/admin/usage`, `/admin/users`,
`/admin/audits`, `/admin/lds`, `/admin/quality` e `/admin/config` continuam como
estão.

---

## 7. Tela: Sem acesso

**Rota:** `/sem-acesso` (já existe, precisa de conteúdo novo)

Quem faz login com um e-mail que não está na lista chega aqui.

**Conteúdo:**

- uma frase que explica sem acusar: o acesso ao NexoDoc é liberado pelo
  responsável, e este e-mail ainda não foi liberado;
- **o e-mail com que a pessoa entrou**, visível — para ela perceber se entrou com
  a conta errada, que é a causa mais comum;
- como pedir acesso (o contato do Admin);
- um botão de sair, para trocar de conta.

**Não deve conter:** nome do escritório, lista de projetos, nem qualquer dado do
sistema. A tela é vista por quem ainda não foi autorizado.

---

## 8. Mudanças em telas que já existem

### 8.1 A home antiga

A grade de cartões de módulo deixa de existir como tela inicial. Os três módulos
que restavam se distribuem assim:

| Módulo | Para onde vai |
|---|---|
| Nexo | é o orbe, no centro do painel |
| Projetos | destino na barra de topo |
| Volumes | destino na barra de topo |

### 8.2 Projetos

**O formulário de cadastrar projeto sai da interface.** Projeto passa a nascer
por um caminho só: **anexando documento**, com o centro de custo lido do PDF.

A página `/projetos` continua existindo como **lista e consulta**: ver as pastas
do escritório, entrar numa e ver o que há dentro.

**Por quê:** o código lido do documento é a fonte confiável; o código digitado à
mão num campo é onde nasce a pasta paralela (`O63-26` com a letra O) que manda
achado para a fila errada.

---

## 9. De onde vem cada informação

### 9.1 Já existe — é só consultar

- fila "Para você" e os desfechos;
- auditorias recentes da pessoa;
- projetos do escritório;
- lista de quem tem acesso;
- catálogo dos documentos gerados (nome, tipo, data).

### 9.2 Existe, mas a consulta é nova

- **"Você enviou · esperando"** — inverte a consulta da fila: em vez de "o que
  está comigo", "o que eu mandei e ainda não voltou";
- **tempo parado de cada achado** — a diferença entre o envio e agora;
- **último acesso** de cada pessoa, para a tela de acessos.

### 9.3 Precisa de coisa que não existe

- **Anotações** — um texto por pessoa. É a única estrutura de dados nova, e é
  minúscula.
- **Baixar de novo um documento gerado** — **não é possível hoje.** O sistema
  guarda o catálogo (nome, tamanho, checksum), mas não os bytes: o provedor de
  armazenamento não está configurado e todos os registros existentes ficaram sem
  arquivo. Habilitar isso é trabalho de infraestrutura (um provedor de
  armazenamento e as variáveis correspondentes), não de tela. **Enquanto não
  existir, o widget "Gerados por você" é histórico, não repositório.**

---

## 10. Comportamento em tela estreita

Quando não couberem três colunas, elas empilham nesta ordem:

1. **Para você** (os cards)
2. **Orbe**
3. **Widgets**

O orbe perde o topo de propósito: quem abre o NexoDoc no celular está conferindo
pendência, não montando volume.

Dentro dos widgets empilhados, "Anotações" é o último e pode ser recolhido.

**Observação para quem for desenhar:** o painel do Nexo tem histórico de largura
enganosa — a janela pode ser larga enquanto o painel é estreito. As decisões de
empilhamento devem responder à **largura do container**, não à da janela.

---

## 11. O que ficou de fora, e por quê

| Ideia | Por que não |
|---|---|
| Kanban com arrastar | exige o estado "estou fazendo", que não existe no sistema. Ele serve para evitar que duas pessoas peguem a mesma tarefa — problema que um escritório pequeno não tem. Card parado em "fazendo" há três semanas vira mentira na tela |
| Widget "solte um documento" | o orbe já é o alvo, e a tela inteira aceita o arquivo |
| Widget contador "Para você" | a coluna da esquerda já é isso |
| Widget "parado há mais tempo" | virou **tarja no próprio card**, que é onde o alerta é visto |
| Ritmo do escritório, "Na PROSUL hoje", tempo médio até resolver | medem pessoas. Num escritório onde todos se conhecem, painel de produtividade vira vigilância sem ninguém ter decidido isso |
| Relógio, clima, cotação do dólar | nenhum é um problema que o NexoDoc resolve |
| Achados por consequência | depende da materialização de todos os achados, que nunca foi construída |

---

## 12. Em aberto

1. **O limiar da tarja de esquecimento.** A partir de quantos dias um achado
   parado ganha destaque? A sugestão é começar com algo entre 3 e 5 dias e
   ajustar com o uso.
2. **Armazenamento de arquivo.** Enquanto não houver, "Gerados por você" é
   histórico. Vale decidir se isso entra agora ou depois.
3. **O que acontece com quem perde o acesso enquanto tem achado na fila.** As
   pendências dela continuam apontando para uma pessoa que não entra mais. A
   decisão pode ser deixar como está (o histórico é honesto) ou oferecer
   reatribuição na hora de remover.
