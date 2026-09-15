# Bateria de fluxos esquisitos — desenho

**Data:** 14/09/2026
**Status:** aprovado em conversa (as quatro decisões abaixo são do Matheus)

## Por que existe

Em 14/09/2026, uma única auditoria do 117_25 revelou sete defeitos em sequência, e nenhum tinha teste:

- a leitura global pendurava em produção;
- o parecer não gravava no banco;
- a contagem incompleta parecia o total;
- o botão de auditar não esperava a conferência das folhas;
- reauditar o mesmo documento mostrava o parecer antigo;
- "audita o memorial" ia ao chat e não virava cartão;
- o parecer novo sobrescrevia o anterior.

Todos estavam fora do caminho feliz: repetir, recarregar, falhar no meio, abrir conversa antiga.

O projeto tem 156 testes puros (`scripts/test-*.ts`) e 111 provas de navegador (`scripts/prova-*.mjs`, `scripts/shot-*.mjs`). **Não tem CI nem comando que rode tudo.** Teste que ninguém chama não protege nada; ver a memória "Teste que ninguém roda".

## Decisões (tomadas pelo Matheus em 14/09/2026)

| Pergunta | Decisão |
|---|---|
| Por onde começar | **Por largura**: poucos cenários por área, cobrindo a superfície toda, antes de aprofundar qualquer uma |
| Quanto gastar de IA | **Zero**: IA simulada no servidor |
| Quando achar defeito | **Consertar direto**, provar e subir na main; **perguntar só decisão de produto** |
| Onde roda | **Local agora** (`npm run bateria`), **CI (GitHub Actions) depois** que estabilizar |

## Decisões da segunda rodada (15/09/2026)

As três primeiras são do Matheus e respondem os cenários marcados **[decisão de produto]** no catálogo. Plano: `docs/superpowers/plans/2026-09-15-bateria-segunda-rodada.md`.

| Pergunta | Decisão |
|---|---|
| C1 — o mesmo memorial solto duas vezes | **Deduplicar por nome de arquivo**, a mesma regra que as pranchas já seguem (`NexoWorkspace.tsx`, "Dedup por nome"). Soltar de novo um memorial com o nome do memorial retido não cria chip nem as mensagens "Anexei o memorial"/"Li as primeiras páginas"; no máximo uma linha curta dizendo que esse memorial já está na conversa |
| C3 — duas abas na mesma conversa | **Recusar a aba desatualizada.** Cada aba guarda o `updatedAt` que leu ao abrir a conversa e o manda como base na gravação; o servidor responde 409 se a versão guardada mudou desde essa base; a aba avisa e oferece recarregar a conversa, sem sobrescrever. Sem mudança de schema |
| X2 — memorial sem código legível | **Criar o seletor de projeto.** O cartão de auditoria mostra um seletor com os projetos do escritório; escolher libera a auditoria; sem escolha, não gasta |

Decisões de planejamento da mesma data (sem mudar o esperado do catálogo):

| Pergunta | Decisão |
|---|---|
| Documentos de teste novos | **Gerados pela bateria** com pdf-lib, em memória, gravados em `scratchpad/bateria/fixtures/` (ignorado pelo git). O repositório é público: nada de dado de cliente, e a receita fica revisável como código em vez de binário |
| C3 — por onde viaja a base | A base viaja no cabeçalho `x-nexo-versao-base`, e não no corpo: o registro gravado no banco continua igual. A mesma regra (`gravacaoDesatualizada`) guarda também a gravação no IndexedDB, que as duas abas compartilham — senão a aba parada apagaria o parecer no disco antes de o servidor recusar |
| V2 — "leitura de selo volta vazia" | É a leitura que RODOU e voltou sem campo legível (JSON válido, tudo nulo), não a que falhou. O simulador devolve isso para a prancha cujo carimbo não tem texto — sem comportamento novo na fila, porque a ordem das chamadas de selo num lote não é garantida |
| V1 — "remontar resolve" | A jornada monta o estado de volume já montado pela conversa (o volume real exige capa com PDF, e o PDF depende de LibreOffice e do modelo da prefeitura, que nem o PC da bateria nem o CI garantem). Regerar a LD é gesto real; que remontar zera o aviso fica travado por `scripts/test-nexo-volumes-desatualizados.ts` ("peça com a mesma hora não denuncia nada") |
| A5 — linha `Audit` criada antes da recusa | A linha nasce em PROCESSING antes da extração por um motivo legítimo: um F5 durante a extração acha a auditoria em vez de "não encontrada". A recusa por documento idêntico passa a APAGAR essa linha (e o evento "Auditoria criada"), e o esperado "nenhuma auditoria nova no banco" continua valendo |
| A7 — `encaminhar_para_geracao` no simulador | **Fica de fora.** "audita o memorial" com parecer aberto não chega ao chat da auditoria: `pedeNovaAuditoria` desvia no cliente (14/09/2026). A jornada prova esse desvio |
| `/volumes`, tela clássica de LD, `ld-stamp-*`, `volume-*` | **Fora desta rodada**: nenhuma jornada do catálogo passa por eles |

## Abordagem escolhida: híbrida

1. **Jornada no navegador**: cada fluxo esquisito é um cenário Playwright sobre o app de verdade, com a IA simulada. É a camada que ACHA o defeito, porque os defeitos de 14/09 só aparecem com tudo junto: IndexedDB, servidor, gravação e duas abas.
2. **Teste puro**: cada regra que uma jornada revela vira um `scripts/test-*.ts` no estilo do repo (node cru, `node:assert`, sem framework). É a camada que TRAVA a regra e roda em milissegundos.
3. **Um comando só** roda as duas camadas e mostra o relatório.

Alternativas descartadas:
- **Teste de componente em node** (jest/vitest com React): não existe no repo, e não reproduz IndexedDB, duas abas nem reconexão.
- **Só jornada**: lenta demais para travar regra, e o defeito volta sem aviso quando a jornada é pulada.

## Fundação

### 1. Banco próprio: `nexodoc_teste`

- No mesmo projeto Neon do `nexodoc_dev`, criado uma vez. `CREATE DATABASE` não passa pelo pooler: tire `-pooler` do host.
- A URL fica em `.env.local` como `DATABASE_URL_BATERIA`, que nunca vai ao git.
- A cada rodada, a bateria aplica `prisma migrate deploy` (pelo host direto, ver `prisma.config.ts`) e apaga os dados das tabelas de trabalho. Usuários, escritório e prefeituras são semeados pelo próprio executor.
- A bateria **recusa rodar** se a URL apontar para `neondb` (produção) ou `nexodoc_dev`. A checagem é pelo nome do banco na URL, antes de qualquer escrita.

### 2. Servidor próprio: porta 3100

- O executor sobe `next dev -p 3100` com o ambiente da bateria e espera `GET /api/saude` responder 200.
- No fim, derruba o processo **pelo PID de quem escuta na porta**. Motivo: um `next dev` parado pelo npm deixa o `node` filho vivo, que continua respondendo com código velho (medido em 14/09/2026). Ver memórias "O dev server mente" e "Corte dos 350s".
- Se a porta 3100 já estiver ocupada ao começar, o executor derruba quem estiver nela antes de subir.
- Variáveis do servidor da bateria, que ganham do `.env.local` porque o Next não sobrescreve variável que já existe no processo:
  - `DATABASE_URL` = `DATABASE_URL_BATERIA`;
  - `NEXODOC_IA_SIMULADA=1`;
  - `NEXODOC_DEV_AUTH=true` (login "Entrar como dev");
  - `OPENAI_API_KEY=sk-simulada` (qualquer valor; nada sai para a rede);
  - `NEXT_PUBLIC_NEXO_ENABLED=true`.

### 3. IA simulada

**Onde entra:** em `lib/ai-runner.ts`, no começo de `executeOpenAiResponse` e de `executeOpenAiResponseStream`. É o ponto por onde passam todas as chamadas de modelo do produto. `lib/openai.ts` só é usado ali, e a busca em 14/09 confirmou 11 chamadores, todos pelo runner. Nesse ponto cada chamada tem `operation`, e é por ela que o simulador responde.

**Liga só com** `NEXODOC_IA_SIMULADA=1` **e** `NODE_ENV !== "production"`. As duas condições juntas: uma variável esquecida no Render não pode transformar a auditoria de um cliente em resposta inventada. O módulo do simulador é importado dinamicamente, então fora do modo de teste nem é carregado.

**Registra uso igual:** a chamada simulada passa pelo mesmo caminho do runner (`recordAiUsage`, `completeAiTask`), com uso e custo zero. Assim a telemetria e o anel de gasto da tela são exercitados também.

**Respostas sintéticas, não gravadas.** O simulador monta JSON válido pelo schema de cada operação a partir do próprio `input` da chamada, sem arquivo de gravação e sem custo para produzir:

| Operação | Resposta padrão |
|---|---|
| `audit-global` | até 3 achados de IA, cada um ancorado num trecho literal do texto enviado (primeiro, do meio e último trecho citável), com a página lida do marcador `--- PAGINA N ---`; `sintese` vazia |
| `audit-validation` | nenhuma decisão (`decisions: []`): os achados passam como vieram |
| `audit-chunk`, `audit-coherence`, `audit-identity` | `findings: []` |
| `audit-cross-document` | `comparisons: []`, `findings: []` |
| `audit-refutation` | `verdicts: []` |
| `audit-transcricao` | o texto "TEXTO TRANSCRITO PELA IA SIMULADA." |
| `nexo-agent-turn` | se o pedido do engenheiro fala em auditar, propõe auditoria no formato do agente real (prosa + bloco `json`), inclusive por streaming; senão, só conversa. LD, capa e volume entram na segunda rodada |
| `audit-chat-turn` | resposta curta sem ferramenta; `encaminhar_para_geracao` entra na segunda rodada (A7) |
| `nexo-selo`, `nexo-selo-image`, `nexo-selo-identidade`, `nexo-volume-check`, `volume-*` | **segunda rodada** (V1, V2): até lá, caem no erro de operação sem simulação |
| operação desconhecida | **erro explícito** "operação sem simulação: X", para que uma chamada nova no produto quebre a bateria em vez de passar calada |

A âncora nasce do texto real para os achados passarem pela trava anti-alucinação da rota como um achado de verdade passaria.

**Falha de propósito, por cenário.** Existe uma rota só do modo simulado, `POST /api/teste/ia`: a própria rota devolve 404 fora dele. Ela aceita uma fila de comportamentos por operação, consumidos na ordem:

```json
{ "operation": "audit-global", "comportamento": "abortar" }
```

| Comportamento | Efeito |
|---|---|
| `abortar` | lança o erro de aborto na hora, como o de 14/09 depois de 900s, sem esperar os 900s |
| `truncar` | resposta `status: "incomplete"`, `incomplete_details.reason: "max_output_tokens"` |
| `503` | erro com status 503 (transitório: exercita a retentativa) |
| `recusar` | resposta com `refusal` |
| `lento:<ms>` | responde normal depois de `<ms>` milissegundos (para F5 e cancelar no meio) |
| `json-invalido` | texto que não é JSON |

`DELETE /api/teste/ia` limpa a fila. O estado mora em `globalThis`, porque o servidor da bateria é um processo só.

### 4. Comando e relatório

- `npm run bateria` roda tudo; `npm run bateria -- auditoria` roda os testes puros e só as jornadas da área (ou do id, ex.: `a1`).
- `npm run bateria -- --so-puros` roda só os `scripts/test-*.ts`; `npm run bateria -- --so-jornadas auditoria` pula os puros.
- O banco é migrado antes de tudo. Os testes puros rodam primeiro, em paralelo de 6, porque vermelho de regra já explica muita jornada vermelha. Depois o banco é esvaziado de novo antes das jornadas.
- Cada teste puro sobe com `node` cru; se falhar por `ERR_MODULE_NOT_FOUND` de `@/`, tenta de novo com o hook mínimo de alias (`scripts/lib/so-o-alias.mjs`, criado pelo plano). Quem ainda falhar vai para o relatório como **apodrecido**, separado de **vermelho**.
- As jornadas rodam uma de cada vez. Duas abas numa jornada são duas páginas do mesmo navegador.
- Relatório no terminal por área, com verde, vermelho e apodrecido, e o motivo em uma linha.
- Artefatos em `scratchpad/bateria/<data-hora>/`: captura da tela e log do servidor de cada jornada que falhou.
- Código de saída diferente de zero se houver vermelho. É o que o CI vai ler depois.

## Catálogo — primeira rodada (largura)

Cada cenário diz o **gesto** e o **esperado**. O esperado segue o comportamento decidido até 14/09/2026. Onde não há decisão, o cenário está marcado **[decisão de produto]**: a bateria registra o que acontece e a sessão pergunta ao Matheus antes de consertar.

### Auditoria

| # | Cenário | Gesto | Esperado |
|---|---|---|---|
| A1 | Leitura da IA aborta | fila `audit-global: abortar`; auditar memorial | parecer com aviso vermelho "AUDITORIA INCOMPLETA — A IA NÃO LEU O DOCUMENTO", contagem "INCOMPLETA", `Audit` COMPLETED no banco |
| A2 | Revisão trunca | fila `audit-validation: truncar` | parecer sai, e "Revisão dos achados pela IA" aparece como etapa incompleta |
| A3 | Reauditar o mesmo memorial | auditar; clicar "Auditar de novo" | cartão novo com formulário; parecer anterior segue no cartão dele; ao terminar, palco mostra o novo e a faixa do que mudou |
| A4 | F5 no meio | fila `audit-global: lento:20000`; auditar; recarregar aos 5s | palco reconecta sozinho e mostra o parecer quando termina; bilhete some |
| A5 | Documento idêntico | auditar completo; auditar de novo o mesmo PDF | recusa "O documento é idêntico…" legível no cartão; nenhuma auditoria nova no banco |
| A6 | Folhas mudas | memorial com página só de imagem | botão "Conferindo páginas…" e depois "Transcrever e auditar"; após transcrever, parecer sem aviso de páginas |
| A7 | Pedido no chat com parecer aberto | com parecer no palco, digitar "audita o memorial" | vai ao agente (não ao chat da auditoria) e aparece cartão |

### Anexos e conversas

| # | Cenário | Gesto | Esperado |
|---|---|---|---|
| C1 | Mesmo memorial anexado duas vezes | anexar; anexar de novo o mesmo arquivo | um memorial só na conversa: um chip, uma "Anexei o memorial", uma "Li as primeiras páginas"; no máximo uma linha curta dizendo que esse memorial já está na conversa (decidido em 15/09/2026: deduplicar por nome) |
| C2 | Memorial e pranchas no mesmo drop | soltar memorial + 3 pranchas juntos | memorial vira memorial, pranchas vão à leitura de selo; nenhuma prancha lida como memorial |
| C3 | Duas abas na mesma conversa | aba 1 audita; aba 2 aberta antes, parada | depois de a aba 2 tentar gravar, servidor e disco seguem com o parecer da aba 1; a aba 2 avisa que a conversa mudou em outra aba e oferece recarregar, sem sobrescrever; o servidor responde 409 a gravação com base velha (decidido em 15/09/2026) |
| C4 | Conversa antiga (formato de antes de 14/09) | semear conversa com `auditoria:<código>` | abre, o parecer fica no cartão que o gerou, "Auditar de novo" aparece |
| C5 | Trocar de conversa durante a auditoria | auditar; abrir outra conversa; voltar | auditoria segue, parecer aparece na conversa certa e não na outra |

### Volume, LD e capa

| # | Cenário | Gesto | Esperado |
|---|---|---|---|
| V1 | Regenerar LD depois do volume montado | montar volume; regerar a LD | volume marcado como envelhecido; remontar resolve |
| V2 | Prancha sem selo legível | lote com uma prancha cuja leitura de selo volta vazia | prancha aparece como não lida, e não some do volume |

### Acesso

| # | Cenário | Gesto | Esperado |
|---|---|---|---|
| X1 | Sessão expira no meio | invalidar o cookie durante a auditoria | aviso de sessão expirada; nada é perdido ao entrar de novo |
| X2 | Memorial sem código legível | memorial sem centro de custo | o cartão mostra um seletor com os projetos do escritório antes de gastar; sem escolha não roda nem cria auditoria; escolher libera a auditoria no projeto escolhido (decidido em 15/09/2026) |

## Como uma jornada é escrita

- Um arquivo por cenário: `scripts/bateria/jornadas/<area>/<id>-<nome>.mjs`.
- Exporta por padrão `{ id, area, titulo, rodar(ctx) }`.
- `ctx` traz:
  - `page`, `base` (`http://localhost:3100`), `login()`, `abrirOutraAba()`;
  - `ia.fila(operation, comportamento)` e `ia.limpar()`;
  - `banco.consultar(sql, params)` no `nexodoc_teste`;
  - `indexeddb.gravarConversa(registro)` e `indexeddb.lerConversas()`;
  - `abrirConversa(titulo)`;
  - `anexar(caminhos)`, que usa o `input[type=file][accept="application/pdf,image/*"]`. A tela tem três inputs de arquivo, e o primeiro é o de classificação de pasta: armadilha medida em 14/09;
  - `esperarTexto(regex, ms)`, `esperarBotao(regex, ms)` (espera o botão habilitar) e `visivel(locator)`;
  - `verificar(nome, condição, detalhe)`, que registra sem abortar, para uma jornada relatar todas as falhas de uma vez.
- Documentos de teste: `tests/117_25_md_geral_a.pdf` (218 páginas, 14 mudas) e um memorial curto gerado pela bateria para os cenários que não precisam de 218 páginas.
- Visível **de verdade**: verificar a caixa do elemento contra a janela, não só a presença no DOM (memória "Provar que a UI aparece").

## Tratamento de defeito achado

1. A jornada fica vermelha com captura e log.
2. A sessão investiga a causa (skill `systematic-debugging`) antes de mexer.
3. Defeito claro (quebra, dado perdido, tela afirmando algo falso): escreve o teste puro que falha, conserta, roda a jornada até ficar verde, commit e push na main.
4. **[decisão de produto]**: para, descreve o que acontece e as opções, e pergunta ao Matheus.
5. Cada defeito consertado ganha uma linha em `docs/bateria/defeitos-achados.md`, com data, cenário, causa, commit e o teste que o trava.

## Fora do escopo desta rodada

- CI no GitHub Actions: vem depois que a bateria estiver estável em duas rodadas seguidas verdes.
- Qualidade dos achados da IA (recall e precisão). Isso é medido com IA real em `scripts/recall-vs-benchmark.ts`, e a simulada não diz nada sobre ela.
- Telas do admin e o deck `/apresentacao`.
