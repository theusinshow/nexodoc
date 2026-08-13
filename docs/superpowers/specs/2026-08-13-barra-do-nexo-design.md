# A barra do Nexo — de resíduo a instrumento

Data: 2026-08-13
Estado: aprovado, pronto para plano de implementação

## O problema

Em `/nexo` a barra superior mostra a palavra "NEXO" e nada mais. Não é falta de
ideia: é resíduo. O `<header>` vem do `AppShell` genérico
(`components/layout/app-shell.tsx:38`), que serve `/volumes`, `/admin` e as
demais telas. Em `/nexo`, `moduleName="Nexo"` cai no `if` da linha 47 e o
breadcrumb some, deixando a faixa com sete letras num canto.

A tentação óbvia — pôr marca e conta ali — é errada, porque **a `NexoSidebar` já
faz as duas coisas, e melhor**:

- topo (`NexoSidebar.tsx:296-304`): `LogoNexo` + a palavra "Nexo", com pulso
  quando o agente trabalha;
- rodapé, camada 1 (`:929-953`): Projetos, Painel admin, Como funciona,
  Ferramentas antigas;
- rodapé, camada 2 (`:967-1017`): iniciais, nome, e-mail, Preferências, Sair.

Repetir isso no topo poria a palavra "Nexo" duas vezes a 40px de distância e
daria dois donos ao menu de conta.

**A decisão:** a barra ganha o único trabalho que a sidebar não pode fazer.
A sidebar é vertical e persistente; a barra é horizontal e efêmera. O que cabe
nela é o que muda com a conversa ativa — o contexto da obra — e o que muda com o
tempo — o trabalho pesado em curso.

## Restrições descobertas no código

Três fatos moldam o desenho e não são negociáveis.

**1. A barra, onde está, não alcança os dados.** Os providers do Nexo vivem em
`NexoWorkspace.tsx:144-151` (`ConversationStore` > `Usage` > `Artifact` >
`Composer` > `Auditoria`), portanto *dentro* do `children` do `AppShell`. O
`<header>` é irmão acima deles. Nenhum hook do Nexo é alcançável de lá.

**2. O contexto da obra nasce tarde.** Não existe `projectId` no módulo Nexo —
nada do `ProjectContext` de `/volumes` (`lib/project-context.ts:5`) chega aqui.
O que existe é derivado dos próprios PDFs:

- `IdentidadeDoProjeto` (`modules/nexo/lib/identidade.ts:23`): `orgao`,
  `secretaria`, `obra`, `bairro`, `fase`, `codigo`, `revisao` — todos opcionais;
- `folderKey` (`nexo-db.ts:90`): o código da obra dos selos, derivado em
  `conversation-store.tsx:267-274`;
- "prefeitura" **não é campo**: é derivada em tempo de render
  (`ConfirmationCard.tsx:2181-2185`), e só depois de gerar a capa ou ler o
  memorial.

Tudo isso só existe **depois do upload e da leitura dos selos**.

**3. Auditoria é barata; geração de documentos, não.**
`auditoria-store.tsx:24` já expõe `{nivel, arquivo, inicioMs, marcos, cancelar}`
num provider acima do palco — dá para ler sem refatoração. Já o estado de
"gerando capas / montando volume" é `useState` local dentro de cada
`ConfirmationCard` (`:649, 871, 1487, 2538`) e morre com o cartão.

## O desenho

### 1. Onde a barra mora

A barra sai do `AppShell` e passa a ser uma linha do `NexoShell`, dentro dos
providers.

- `AppShell` deixa de renderizar o `<header>` quando `fullBleed` é verdadeiro.
  `/volumes`, `/admin` e as outras telas seguem intocadas.
- `NexoShell` ganha uma faixa `nexo-shell__barra` acima do grid de três colunas,
  irmã de `__sidebar`, `__stage` e `__copilot`.

Efeito colateral bem-vindo: o `mx-auto max-w-5xl` de `app-shell.tsx:39`, que
hoje espreme o conteúdo da barra num miolo de 1024px dentro de uma tela
full-bleed, deixa de valer. A faixa nova nasce com a largura do shell.

### 2. Camada de repouso — o contexto da obra

Mostra a obra e o órgão da conversa ativa.

- **Obra:** `identidade.obra`; sem ela, não renderiza (ver estado vazio).
- **Órgão:** `identidade.orgao`, com `identidade.secretaria` como
  complemento quando houver.
- **Código:** `folderKey`, em mono, como marcador discreto.
- **Precedência:** a já fixada no produto — engenheiro > agente > carimbo >
  vazio. Empate não preenche.

### 3. Camada de trabalho — a auditoria em curso

Quando `useAuditoria().emCurso` existe *para a conversa ativa*, a faixa troca de
conteúdo: nível (Padrão/Profundo), nome do arquivo, o último marco recebido do
SSE e o botão cancelar (`cancelar` já vive no store). Ao terminar, a faixa
devolve o lugar à camada de repouso.

### 4. Estado vazio: a barra não existe ainda

Sem obra lida e sem trabalho em curso, a faixa **não renderiza**. O palco fica
com a altura inteira. Ela nasce quando os selos são lidos.

O preço aceito conscientemente: o layout desloca cerca de 40px no momento em que
a barra aparece. A alternativa — altura fixa com "Nenhum documento lido ainda" —
foi recusada porque deixaria a faixa passando a maior parte do tempo declarando
que não sabe nada, que é o mesmo defeito que ela veio corrigir.

### 5. Fora de escopo, explicitamente

Capas, LD e montagem de volume **não** entram na camada de trabalho agora. Não
há de onde ler seu progresso sem elevar o `busy` dos cartões para um store
próprio, e isso é um spec separado. A barra cobre auditoria e só.

## Correção que vem junto

`AuditoriaEmCursoInfo` (`auditoria-store.tsx:24`) não guarda `conversationId`.
Hoje, trocar de conversa no meio de uma auditoria deixa o `emCurso` vivo e o
exibe no palco da conversa nova. No palco isso passa; numa barra sempre visível
fica gritante.

Entra no escopo: adicionar `conversationId` ao objeto (`auditoria-store.tsx:24`),
preenchê-lo em `ConfirmationCard.tsx:2235`, e filtrar por ele tanto na barra
quanto no palco (`PalcoDoNexo.tsx:40`, `NexoWorkspace.tsx:168`).

## Como provar

Sem gastar token, pelo caminho já estabelecido (`AUDIT_REUSE=1` + semear o
IndexedDB, molde em `shot-audit-reconexao.mjs`):

1. Conversa nova, nada enviado: a barra não está no DOM e o palco ocupa a altura
   inteira.
2. Após a leitura dos selos: a barra aparece com obra, órgão e código corretos.
3. Auditoria disparada: a barra troca para o progresso, o marco avança, cancelar
   aborta.
4. Trocar de conversa durante a auditoria: a barra da conversa nova **não**
   mostra o progresso alheio.
5. Medir a caixa da barra contra a janela — asserção de DOM passa verde com o
   elemento fora da tela.
