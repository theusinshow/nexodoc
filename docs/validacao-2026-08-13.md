# Checklist de validação — o que mudou em 2026-08-13

## RESULTADO (validado à mão em 13/08, com banco e chave de IA reais)

Tudo abaixo foi conferido pelo mantenedor no navegador, contra o `.env.local` de
produção. **Cinco defeitos apareceram durante a validação** — nenhum deles tinha
sido pego por `tsc`, por `eslint` ou pelas provas:

| # | Defeito | Como apareceu |
|---|---|---|
| 1 | O campo do token sumia na **primeira tecla** — não dava para entrar no admin à mão em nenhuma das 7 telas | abrindo `/admin/config` pela primeira vez |
| 2 | Token **recusado** também recolhia o campo: "Acesso admin negado" sem campo para corrigir | digitando uma letra e apertando Enter |
| 3 | O carimbo abria enquadrado e **ilegível** — raster ampliado por CSS | abrindo uma prancha real de Chapecó |
| 4 | Falta de `OPENAI_ADMIN_KEY` derrubava a **página inteira** do consumo, escondendo o custo por obra, que vem do banco | ligando o `.env.local` real |
| 5 | As provas exigiam o ambiente semeado do autor e falhavam **sem defeito nenhum** | rodando contra o `.env.local` real |

O padrão dos cinco: cada um só aparece **na tela, com dado de verdade**. É a
mesma lição da abertura deste documento — compilador e linter não executam a
tela, e prova escrita contra um ambiente inventado não vale contra o real.

Também ficou registrado, sem virar tarefa: a tabela de **custo por obra** degrada
para custo por conversa quando as auditorias não estão em pasta de obra (é o caso
hoje), e **dispensar o tour apaga o projeto de exemplo**.

---


**Branch:** `theusinshow/kmi-adititonals`.
**Para quem:** o mantenedor, noutra máquina, conferindo à mão.

Este documento existe porque a sessão que produziu as mudanças descobriu, do
jeito ruim, que **`tsc` e `eslint` passam limpos com o servidor caindo na
inicialização** — nenhum dos dois executa o módulo. O que está marcado como
"nunca aberto" abaixo é literal.

## Antes de começar

```bash
git fetch origin
git checkout theusinshow/kmi-adititonals
npm ci
npx prisma generate      # sem isto, centenas de erros de tipo que não são reais
npm run dev
```

**Confira o `.env.local`.** Duas variáveis que barram tela sem dizer por quê:

| Variável | Sem ela |
|---|---|
| `NEXT_PUBLIC_NEXO_ENABLED=true` | `/nexo` faz kill-switch e some para `/` |
| `NEXODOC_ADMIN_EMAILS=<seu e-mail>` | `/admin` te trata como não-admin quando não há banco |

Para abrir o `/admin` numa máquina sem banco e sem Google, faltam mais três — e
sem elas o login não oferece atalho nenhum e o `/admin` devolve tela de
não-admin, sem dizer por quê:

```
NEXODOC_DEV_AUTH=true
NEXODOC_DEV_AUTH_EMAIL=dev@nexodoc.local   # tem de ser o MESMO de ADMIN_EMAILS
AUTH_SECRET=<qualquer coisa local>
```

## A validação em três comandos

**1. O que não precisa de nada** (regras puras, node cru, ~5s):

```bash
npm run test:admin
```

Cinco suítes, 50 casos: escritório, câmbio + custo por obra, meta + série
semanal, faixa de atenção, linha de status.

**2. O que precisa do servidor no ar** (navegador, sem gastar token):

```bash
NEXODOC_ADMIN_TOKEN=teste-local NEXODOC_ADMIN_EMAILS=dev@nexodoc.local \
NEXODOC_DEV_AUTH=true NEXODOC_DEV_AUTH_EMAIL=dev@nexodoc.local \
AUTH_SECRET=qualquer-coisa-local NEXT_PUBLIC_NEXO_ENABLED=true \
NEXODOC_CAMBIO_USD_BRL=5,42 \
NEXODOC_META_FALSO_POSITIVO=10 NEXODOC_META_COBERTURA=40 \
NEXODOC_ESCRITORIO_NOME="Engeplan Engenharia Ltda" \
NEXODOC_ESCRITORIO_ENDERECO="Rua Saldanha Marinho, 89, Centro - Florianópolis - SC" \
NEXODOC_ESCRITORIO_MUNICIPIO="Florianópolis" NEXODOC_ESCRITORIO_UF=SC \
npm run dev
```

Noutro terminal:

```bash
npm run prova:admin
```

Três provas, 21 conferências. O `NEXODOC_DEV_AUTH_EMAIL` **tem de ser o mesmo**
do `NEXODOC_ADMIN_EMAILS`, senão o `/admin` responde tela de não-admin sem dizer
por quê.

**3. O que só o banco prova.** Três coisas ficam de fora dos comandos acima
porque dependem de dado gravado, e é onde o seu olho vale mais que qualquer
asserção:

| O quê | Onde | Precisa de |
|---|---|---|
| Tabela de custo por obra com linhas reais | `/admin/usage` | consumo gravado |
| Série semanal com semanas reais | `/admin/quality` | auditorias julgadas |
| Linha de status da home | `/admin` | banco (a rota exige) |

Com `DATABASE_URL` apontando para uma base de teste, aplique as três migrações
novas antes de abrir as telas:

```bash
npm run db:migrate    # CambioConfig, MetaQualidadeConfig
```

Depois refaça o passo 2 **com o banco ligado**: os botões "Declarar cotação" e
"Declarar metas" saem de desabilitado, e é aí
que se confere a gravação de verdade (salvar, recarregar a página, ver se o
valor voltou e se o selo virou "declarado no painel").

---

As provas antigas, se quiser rodar antes:

```bash
npm run test:nexo:escala && npm run test:nexo:enquadramento \
  && npm run test:nexo:pins && npm run prova:tokens && npm run prova:glossario
```

---

## 1. Orbe — `/bancada-do-orbe` (não pede login)

**Estado de confiança:** visto rodando, com prova em PNG.

- [ ] O seletor lista **9 estados**. `auditing` e `waiting` existem; `hover` e
      `uploading` **não** (a máquina nunca os produziu — estavam no enum mentindo).
- [ ] A seção "Identidade Visual do Logotipo" **sumiu** (3 variantes aposentadas
      foram cortadas).
- [ ] Existe um controle **Ritmo do respiro** no painel de parâmetros.
- [ ] `waiting` × `idle`: mesma esfera, **metade da cadência**. Olhe por ~10s.
- [ ] `auditing`: a banda de varredura **sobe sempre** e recomeça no pé — nunca
      desce. (`npm run prova:varredura` mede isso: 139→323, quebra, 79→138.)
- [ ] `reading` com atividade ~0,7: **arco no aro** fechando ~70% da volta.
- [ ] `error`: **batimento duplo** no miolo. Nenhuma cor nova — a lei prende o
      orbe à rampa teal, então o erro se diz por ritmo.
- [ ] Recarregar a página: o **boot** — miolo acende do zero (~600ms), aro entra
      atrasado, giro nasce alto e assenta.

## 2. Login — `/login`

- [ ] Orbe **vivo** no painel da direita, acima do poster do workspace.
- [ ] Nenhum salto de layout quando o Canvas termina de carregar.
- [ ] O logotipo do cabeçalho continua sendo o **SVG estático** (a 48px o WebGL
      vira borrão — é por isso que o orbe vivo não foi para lá).

## 3. Nexo — `/nexo`

**Estado de confiança:** o orbe foi visto; **o visor de folha nunca foi aberto**
(ele derrubava o servidor até o commit `0d9e9c1`).

- [ ] **Anel de consumo** no rodapé da conversa: **azul**, não teal. Era
      `var(--ring)` — teal significa interativo, e fatia de gráfico não se clica.
- [ ] Focar o campo de texto: o **aro do orbe sobe** um pouco. Focar com o mouse
      em cima **não** dobra o efeito.
- [ ] Deixar o campo vazio por **6s** depois de uma resposta: o orbe entra em
      espera (respiro longo) e o rótulo diz **"aguardando você"**, sem reticência
      animada — esperar não é trabalhar.
- [ ] Digitar qualquer caractere: volta ao estado real.

### O visor de folha (modo selo) — o que mais precisa de olho

Solte PDFs de prancha. **Sem chave de IA a leitura de selo falha** — e é
esperado: as folhas entram no canvas com selo vazio, e o **Abrir** funciona
mesmo assim.

- [ ] Clicar **Abrir** num nó: a folha abre **enquadrada no carimbo**, não no
      topo da página.
- [ ] `←` `→` andam folha a folha **mantendo** o enquadramento.
- [ ] `S` alterna selo ↔ folha inteira. `Esc` fecha.
- [ ] Numa prancha sem âncoras de carimbo: mostra a **página inteira** e diz
      "carimbo não localizado nesta folha" em azul-informação. Ausência nunca
      vira conflito.

### Pins de achado no parecer

Precisa de uma auditoria concluída (**exige IA e banco** — pode não rodar
nesta máquina).

- [ ] Abrir "Ver no documento" num achado: **régua de pins** na margem esquerda.
- [ ] Cor por gravidade; o pin da página aberta **cresce** (3px→5px) em vez de
      mudar de cor.
- [ ] Achado sem página provável **não** vira pin.
- [ ] Clicar num pin leva à página.

## 4. Admin — `/admin` (token: o do seu `.env.local`)

**Estado de confiança: nenhuma destas telas tinha sido aberta**, e abrir a
primeira já cobrou o preço — ver o defeito abaixo. O resto continua conferido só
por compilador e leitura.

- [ ] **Digitar o token à mão funciona.** Estava quebrado: o recolhimento do
      token (`token && !editando`) fechava no PRIMEIRO caractere digitado, e o
      campo sumia com uma letra dentro — em todas as 7 telas. `tsc` e `eslint`
      passavam limpos. Corrigido em `admin-page-shell.tsx` (digitar agora conta
      como editar) e travado por `npm run prova:escritorio`.

- [ ] **Chanfro** em cartões, campos e nav — o admin deixa de parecer outro
      produto.
- [ ] Métrica com **algarismo tabular**: uma fileira de quatro cartões alinha em
      coluna (antes "1.204" e "87" dançavam).
- [ ] **Nav com os 7 links** visíveis num monitor largo. Estreite a janela: o
      "Mais" só aparece quando de fato não cabe.
- [ ] Ordem: Visão geral, **Consumo, Qualidade**, Auditorias, LDs, Usuários,
      Config. (Consumo e Qualidade estavam escondidos atrás de "Mais".)
- [ ] **Token recolhido**: `sessão admin · trocar · sair` no lugar do campo de
      senha. Em `/admin/usage`, o **seletor de período continua ali** — ele não é
      controle de autenticação e não pode sumir junto.
- [ ] `trocar` reabre o campo; `sair` limpa a sessão.
- [ ] **`/admin/users`**: "Tornar admin" pede confirmação **nomeando a pessoa**,
      na própria linha. Em lote, a pergunta **substitui** a barra de ações.
- [ ] A pergunta diz a **consequência** ("passam a ver custo, configuração de
      provedores, e a poder promover outras"), não a operação.
- [ ] **`/admin/usage`**: as barras do uso diário são **azuis**, e o texto abaixo
      não fala mais em "barras azuis" descrevendo barras teal.

## 5. Escritório emissor — CONSTANTE, sem tela (A.9a)

**Estado de confiança:** prova em node cru (`npm run test:escritorio`, 12 casos),
dois deles contra a constante real. **Não há tela para conferir — e é o ponto.**

O que a regra faz: a linha do escritório é **subtraída** do texto antes do
casamento cidade→template. O que sobra é o que fala do cliente.

Isto foi formulário no admin durante seis horas, em 13/08. Saiu por um argumento
do mantenedor que derruba o desenho: **o escritório é um só** — o produto é feito
para a PROSUL. E formulário tem um defeito fatal para este dado: enquanto ninguém
preenchesse, a subtração não acontecia e o modo de falha continuava solto.
Constante em `lib/escritorio.ts` protege desde o primeiro boot.

- [ ] `/admin/config` **não tem mais** seção de escritório.
- [ ] Um lote cujo carimbo traga o órgão do cliente **e** o endereço da PROSUL
      resolve pelo **cliente**, sem virar pergunta. É a prova que precisa de
      pranchas reais.
- [ ] Mudança de endereço = commit na constante. `NEXODOC_ESCRITORIO_*` continua
      sobrepondo, para o dia em que mudar antes de haver deploy.
- [ ] **Responsável técnico e CREA saíram**: não são do escritório, são de quem
      assina *aquele* projeto, e podem mudar por disciplina. Congelá-los numa
      constante arriscaria imprimir capa com o engenheiro errado.

## 6. Câmbio e custo por obra — `/admin/config` + `/admin/usage` (A.7)

**Estado de confiança:** conversão e agrupamento com prova em node cru
(`npm run test:cambio`, 13 casos); as telas foram abertas
(`npm run prova:cambio`, 7 conferências). **A tabela por obra com linhas de
verdade nunca foi vista** — exige banco com consumo gravado.

A cotação é **declarada**, não buscada: cotação buscada envelhece em silêncio, e
o número que precifica o trabalho é o do contador, não o do mercado à vista.

- [ ] `/admin/config`: seção **Cotação do dólar**, com o selo dizendo de quando
      é o número (`cotação declarada há 3 dias: R$ 5,42 por US$ 1`).
- [ ] Digitar `5,42` **com vírgula** funciona. `5420` é recusado na hora.
- [ ] Campo vazio apaga a cotação — e o consumo volta a ficar só em dólar.
- [ ] Cotação com mais de 30 dias: o selo acrescenta **"vale revisar"**.
- [ ] `/admin/usage`: a **linha de procedência** aparece no topo, com link para
      Configurações, **mesmo quando a consulta à OpenAI falha**.
- [ ] Cartão **Gasto**: o `≈ R$` aparece colado no dólar, nunca no lugar dele.
- [ ] Sem cotação declarada: **nenhum real na tela** — nem `R$ 0,00`.
- [ ] Seção **Custo por obra**: a obra é a pasta da conversa; conversa fora de
      pasta vira obra de uma conversa só.
- [ ] Consumo **sem conversa** e de **conversa apagada** aparecem como linhas
      próprias, no fim da tabela, apagados. A soma da tabela tem de bater com o
      total do período — é por isso que eles não somem.
- [ ] Com mais de 500 eventos no período, aparece o selo **"amostra: os 500
      eventos mais recentes"**. Sem ele, a tabela leria como o mês inteiro.

O item "barras azuis" do A.7 **já estava feito** num commit anterior desta
branch (as barras são azuis e o texto não fala mais em teal).

## 7. Meta e série semanal — `/admin/quality` (A.8)

**Estado de confiança:** meta e série com prova em node cru
(`npm run test:meta-qualidade`, 10 casos) e a seção de metas aberta no navegador
(`npm run prova:meta-qualidade`, 5 conferências). **A série com semanas de
verdade nunca foi vista** — exige banco com auditorias julgadas.

- [ ] `/admin/config`: seção **Metas de qualidade**, com os dois campos.
- [ ] Sem meta: o selo diz **"meta não declarada — o painel não julga"**, e
      nenhuma célula da série ganha cor. Sem meta não é aprovação.
- [ ] `/admin/quality`: seção **Semana a semana**, tabela mono (sem gráfico
      decorativo — o `DESIGN.md` proíbe métrica-herói).
- [ ] Com meta declarada: dentro fica verde, fora fica âmbar.
- [ ] A taxa de falso positivo divide pelos achados **julgados**. Confira num
      período em que alguém deixou de revisar: a taxa não pode melhorar por isso.
- [ ] Semana sem auditoria **não vira linha** — férias não é queda de qualidade.
- [ ] A linha de tendência só aparece com **duas** semanas julgadas; com uma, não
      há seta nenhuma (em vez de uma seta plana que ninguém mediu).

Fica registrado o que o A.8 **não** entregou: a taxa **por regra de auditoria**
(texto da 2.25 original). O feedback guarda `targetKey`/`findingId`, mas não a
regra que gerou o achado — os achados têm `origem: "regra" | "ia"` dentro do
relatório, e cruzar as duas coisas é trabalho próprio, não um ajuste de tela.

## 8. Hierarquia do Config — `/admin/config` (A.6)

**Estado de confiança:** faixa com prova em node cru (`npm run test:atencao`, 6
casos) e a ordem medida no navegador (`npm run prova:config`, 6 conferências —
a hierarquia é conferida por **coordenada**, não por ordem no arquivo).

- [ ] A **faixa de atenção** abre a tela, acima de qualquer seção.
- [ ] Instância saudável: uma linha verde dizendo que **não há nada a fazer** —
      silêncio ali seria ambíguo.
- [ ] Sem `DATABASE_URL`: linha crítica dizendo que **nada é gravado e o
      histórico não persiste** (a consequência maior, não só a de tela).
- [ ] Escritório/cotação/metas **não declarados NÃO entram na faixa**. São
      opcionais; listá-los ensinaria a ignorar a faixa.
- [ ] Ordem das seções: **atenção → provedores e modelos → declarações →
      referência** (Runtime, Limites, Chaves).
- [ ] A seção **"Últimos incidentes de provedor" sumiu**: era a segunda lista do
      mesmo `lastFailures` já mostrado na coluna "Última falha".
- [ ] A coluna "Última falha" agora mostra **quando** (`há 12 min`) — nenhuma das
      duas listas mostrava, e sem isso não dá para saber se ainda importa.
- [ ] As duas linhas de procedência do status (de onde vem, quanto dura)
      sobreviveram, agora no cabeçalho do painel de provedores.

## 9. Linha de status na home — `/admin` (A.4)

**Estado de confiança:** veredito com prova em node cru
(`npm run test:status-do-sistema`, 9 casos). **A linha nunca foi vista no
navegador** — a home exige `DATABASE_URL`, como a tabela por obra e a série
semanal.

A 2.24 (trocar cartões por tabela mono) fica **retirada**, como o spec já
mandava: era rearranjo. O que faltava era veredito, não layout.

- [ ] A linha abre a home:
      `operacional · 3 auditorias/24h · sem falhas de provedor · ≈ R$ 14,20 no mês`.
- [ ] **Parado** (vermelho) quando não há chave de provedor nenhuma — e o motivo
      aparece embaixo.
- [ ] **Degradado** (âmbar) com auditoria falhada nas últimas 24h, incidente de
      provedor, ou fluxo sem chave. O veredito é conservador: qualquer dúvida
      rebaixa.
- [ ] Sem cotação declarada, o custo sai em **US$** — não some, nem vira R$ 0,00.
- [ ] Sem consumo no mês, a parcela de custo **não aparece** (nulo não é zero).

## 10. Léxico e cor — espalhado

- [ ] **`/nexo`**, barra do parecer: a terceira vista chama-se **"Parecer"** (era
      "Relatório", dentro do próprio parecer).
- [ ] **`/projetos`** e **`/projetos/[id]`**: "Arquivos enviados" no lugar de
      "Uploads"; "conferir" no lugar de "validar".

---

## O que sabidamente NÃO funciona nesta validação

- Leitura de selo, auditoria, geração de documento — **exigem chave de IA**.
- Qualquer tela que consulte banco — **exige `DATABASE_URL`**.
- Isso não invalida o checklist: quase tudo acima é interface, e a interface
  responde sem os dois.

## O que ainda não foi feito

Ver `docs/superpowers/specs/2026-08-13-propostas-ux-ui-aprovadas.md` (lotes 2–12)
e `...-admin-aprovado.md` (A.9b, A.10).

Saíram **A.9a** (seção 5), **A.7** (seção 6), **A.8** (seção 7), **A.6**
(seção 8) e **A.4** (seção 9). Do admin restam:

- **A.9b** — preferências da pessoa (acabamento).
- **A.10** — trilha, que continua **desaconselhada** até haver auth por pessoa:
  sem atribuição verificável ela produz aparência de trilha, e alguém vai
  confiar nela.

Uma ressalva do A.7 que ficou registrada: a spec previa que o custo por obra
pudesse exigir schema. **Não exigiu.** `AiUsageEvent.conversationId` já era
gravado e a conversa já carrega a pasta — era uma junção que ninguém tinha
feito. O que entrou de schema foi só a cotação (`CambioConfig`).

Fica registrado o que o A.9a **não** fez: a cidade do escritório continua sendo
casável como cliente quando aparece sozinha, e é de propósito — apagá-la
destruiria o trabalho feito PARA a prefeitura da própria cidade. O caso
"escritório e cliente na mesma cidade" segue sendo pergunta ao engenheiro.
