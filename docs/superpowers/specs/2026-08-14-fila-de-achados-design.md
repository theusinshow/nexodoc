# Fila de achados — mandar trabalho a alguém, e ver o que é seu

**Data:** 2026-08-14
**Origem:** o fluxo de uso descrito pelo mantenedor, e `docs/arquitetura-revisao-colaborativa.md` (Grok).
**Depende de:** `docs/superpowers/specs/2026-08-13-substrato-de-escritorio-design.md`, já construído.
**Status:** SPEC. É daqui que o plano de implementação argumenta.

Este documento cobre a **fatia vertical fina**: o achado vira pendência de
alguém, aparece na home dessa pessoa, e fecha com um desfecho. É o menor recorte
que faz o Milton→Victor rodar de ponta a ponta — que é o que os compradores
curtiram.

---

## Por que menos do que o documento do Grok

Aquele documento desenha o sistema inteiro: `FindingOccurrence` materializado,
máquina de estados com validação, gate de emissão, `WorkSession`, linhagem entre
versões, notificações em canal próprio. Está certo como destino.

Como primeiro passo, está grande — e grande demais para o que este produto
precisa provar agora. Cada corte abaixo é deliberado e reversível: nada do que
fica de fora exige desfazer o que entra.

---

## As leis, que valem para tudo

- Núcleo puro (só `import type`) mora em `lib/` e ganha teste `scripts/test-*.ts`
  que roda em node cru. Prova de navegador é `scripts/prova-*.mjs` (Playwright), e
  sai com código 1 quando falha.
- Toda rota sob `app/api/` passa por `requireActor()` ou `checkAdminRequest()`.
  `scripts/prova-nenhuma-rota-aberta.mjs` reprova quem esquecer.
- A rota `app/api/audit/route.ts` **não cresce**. Domínio novo nasce em `lib/`.
- Provas rodam com `BASE` **e** `SHOT_BASE` apontando para a porta certa — a 3000
  costuma ser de outro worktree.
- `.env.local` nunca recebe `DATABASE_URL` de produção. Ele vence o `.env`, e as
  provas daqui apagam dados.

---

## Parte A — Decisões fechadas

Tomadas pelo mantenedor. O plano não as reabre.

| # | Decisão | Consequência |
|---|---|---|
| A.1 | A auditoria **cria o projeto** quando lê um centro de custo que não existe | Sem confirmação, sem selo de provisório |
| A.2 | O ciclo vai até **resolver com desfecho**, sem validação | Três desfechos; ninguém aprova o trabalho de ninguém |
| A.3 | A home existe sempre, e `/` **deixa de redirecionar** | Um clique a mais para quem não tem pendência |
| A.4 | Notificação é a própria home | Sem sino, sem e-mail, sem tabela de evento |
| A.5 | **Qualquer um dos dois resolve** — destinatário ou remetente | Sem hierarquia; evita pendência presa com quem saiu de férias |

Sobre A.1, o risco aceito, escrito para não virar surpresa: se a IA ler o código
torto num documento ruim (`O63-26` com letra O), nasce um projeto paralelo e os
achados vão para a pasta errada. Fica visível na lista com quem criou, e é
apagável. O mantenedor preferiu isso ao atrito de confirmar.

---

## Parte B — O que muda no que já foi construído

Duas pontas foram fechadas do jeito oposto, porque a decisão anterior era outra.

### B.1 A alçada de cadastrar projeto deixa de valer no caminho do Nexo

`POST /api/projects` continua exigindo `ADMIN` da organização — é a tela de
projetos, e lá o cadastro é digitado à mão.

A auditoria **passa por cima**: ela cria o projeto a partir do código lido do
documento, para qualquer membro. Não é exceção esquecida, é a decisão A.1, e a
diferença tem razão: na tela alguém **inventa** um código; na auditoria o código
é **extraído** do PDF.

`scripts/prova-alcada.mjs` continua valendo para a tela, e ganha a asserção
espelhada: pelo Nexo, `MEMBER` cria.

### B.2 `resolverProjeto` deixa de parar no desconhecido

O núcleo puro (`lib/resolucao-de-projeto.ts`) e o teste continuam iguais: ele
responde `achado`, `desconhecido` ou `sem-codigo`, e não decide nada. Quem muda é
quem chama — `desconhecido` passa a **criar** em vez de recusar.

`sem-codigo` continua perguntando: documento sem código legível não vira projeto
sem nome.

---

## Parte C — O desenho

### C.1 O achado não vira tabela nova

O Grok manda materializar `FindingOccurrence`: uma linha para cada achado de cada
auditoria. Isso serve ao gate de emissão e às métricas por projeto — nenhum dos
dois está no escopo.

Só existe pendência para o achado que **alguém enviou a alguém**. E já existe uma
tabela linha-por-achado que a interface escreve: `AuditFeedback`, com
`(auditId, targetKey)` único, `verdict`, `resolvedAt` e `note`.

**A atribuição cria a linha.**

```prisma
enum FindingResolutionKind {
  FIXED_IN_DOC      // corrigi no memorial
  FALSE_POSITIVE    // não era erro — atualiza também o verdict
  ACCEPTED_RISK     // decisão técnica assumida; nota obrigatória
}

model AuditFeedback {
  // já existe
  auditId, targetKey, findingId, findingLabel, page
  verdict, resolvedAt, note

  // entra agora
  fingerprint     String?
  assigneeEmail   String?
  assignedById    String?
  assignedAt      DateTime?
  resolutionKind  FindingResolutionKind?
  resolvedById    String?

  @@index([assigneeEmail, resolvedAt])
}
```

**Uma linha por achado, e não duas.** A atribuição usa o **mesmo** `targetKey` que
a interface já grava — `finding:INC-014`, montado em
`app/api/audits/[id]/feedback/route.ts`. Se ela inventasse uma chave própria, o
mesmo achado teria duas linhas: uma com o veredito que alguém deu na tela, outra
com a pendência — e as duas discordariam na primeira vez que alguém marcasse
corrigido. O `@@unique([auditId, targetKey])` que já existe é o que garante isso,
e por isso a atribuição é um `upsert`, nunca um `create`.

**`assigneeEmail`, e não `assigneeId`.** Mesmo motivo do convite: dá para mandar
trabalho a quem ainda não entrou no sistema, e é no primeiro dia que a
coordenação mais distribui.

**Só se atribui achado de auditoria que tem projeto.** A home agrupa por projeto,
e auditoria legada do Nexo não tem um. Elas continuam legíveis (é o portão de
leitura, não daqui), e o botão de enviar simplesmente não aparece nelas. Toda
auditoria nova tem endereço desde o substrato, então isto se resolve sozinho com
o tempo.

**`fingerprint` gravado no envio, mesmo com a linhagem fora do escopo.** O
`targetKey` é `finding:INC-014`, e o `INC-014` é **posicional** — na reauditoria
vira `INC-009` sem nada ter acontecido com o achado. Sem a impressão digital
gravada no instante do envio, o `_audit2` não terá como saber que aquela pendência
é o mesmo problema. Custa uma coluna hoje; custaria dado perdido depois. O valor é
o `chaveEntreVersoes` de `lib/diff-de-pareceres.ts`, que já existe e já tem teste.

**O que isso dá de graça:** "minhas pendências" é uma consulta —
`assigneeEmail = eu AND resolvedAt IS NULL`. Sem tabela de tarefa, sem duas
fontes de verdade para sincronizar.

**O que custa:** não dá para perguntar "quantos críticos abertos há no 063-26",
porque só o enviado vira linha. Quando o gate de emissão entrar, a materialização
completa nasce ao lado, sem desfazer isto.

**Os três desfechos caem nos dois eixos que o schema já separa:**
`FIXED_IN_DOC` marca `resolvedAt`; `FALSE_POSITIVE` marca `resolvedAt` **e** o
`verdict`, alimentando a qualidade do motor; `ACCEPTED_RISK` marca `resolvedAt` e
exige `note` não vazia.

### C.2 Enviar e resolver

**Enviar reusa o padrão de lote de `/admin/users`** — caixa por linha, barra de
ação que aparece com a seleção, confirmação no próprio lugar em vez de diálogo
por cima. Não é padrão novo.

```text
☑ INC-003  Material das ferragens contraditório       Estrutural
☑ INC-007  Saída de emergência sem largura declarada  PPCI
☐ INC-011  Tabela de cargas sem unidade               Estrutural

  2 achados selecionados    Enviar para ▾
                            ├ Milton  coordenação
                            ├ Victor  projetista
                            └ Ana     convidada
```

A lista de pessoas sai de `GET /api/organizacao/membros`, que já existe e já tem
prova — inclusive o convidado que nunca entrou.

**O cartão do achado ganha uma tarja e um desfecho, e nada mais.** Ele já tem
"Marcar corrigido", já tem "Procede / Falso positivo / Severidade errada", e já
grava em `AuditFeedback`:

- **`com Milton · há 2h`** quando atribuído. Some ao resolver.
- **`Decisão técnica`** ao lado dos existentes, com **nota obrigatória**. Sem nota
  não fecha: decisão técnica sem justificativa escrita é a que ninguém defende
  seis meses depois, na frente da prefeitura.

Não mudam: as faixas por impacto, o visor do PDF, o deep-link, os botões de
veredito. Funcionam e têm prova.

**Qualquer um dos dois resolve** (A.5) — quem recebeu e quem enviou. Sem
hierarquia.

**Onde quem enviou vê o desfecho:** na própria auditoria, na tarja do cartão —
`com Milton` vira `corrigido por Milton` ou `falso positivo · Milton`. **Não** há
uma lista "enviados por mim" na home. A home é o que exige ação SUA; o que você
delegou não exige, e transformá-la em caixa de saída faria a tela crescer com
informação que ninguém precisa ver todo dia. Quem quiser conferir abre o projeto —
que é onde a pergunta nasce.

### C.3 A home

`/` redireciona para `/nexo` hoje, com motivo escrito em `app/page.tsx`: *"um menu
com um item só é uma parada no caminho, então quem entra já entra trabalhando"*.
Isso continua certo, e a home nova **não pode virar essa parada**.

Ela existe porque tem trabalho a mostrar.

```text
COM VOCÊ

063-26 · CRICIÚMA          Memorial descritivo
5 achados                  enviados por Milton, há 2h
▸ 2 críticos                                    [ ABRIR ]

099-25 · CRICIÚMA          Reforma da UBS Central
1 achado                   enviado por Ana, ontem       [ ABRIR ]

─────────────────────────────────────────────────────────

[ + AUDITAR UM DOCUMENTO ]

Projetos recentes   040-26 · 099-25 · 063-26
```

**Agrupado por projeto**, com quem enviou e há quanto tempo. Não é uma lista de 40
achados soltos: é uma lista de projetos que esperam por você.

**ABRIR leva à mesma auditoria de quem enviou**, com os achados atribuídos
destacados no topo e a auditoria completa abaixo. Ver só o que é seu levaria a
corrigir um achado sem saber o que mais existe no documento.

**A notificação é a home** (A.4). Notificação é evento passado, e exige regras de
leitura, agrupamento e expiração — nada disso ajuda a fechar um documento. A
pendência aparece quando existe e some quando resolve. Se um dia o pessoal
perder coisa por estar fora do sistema, o e-mail entra sabendo o que resolve.

**A reversão, explícita:** `/` deixa de redirecionar. Quem não tem pendência ganha
um clique a mais até o Nexo. A alternativa — redirecionar só quando não há
pendência — faria a entrada do produto mudar de lugar dependendo do dia, o que é
pior. O atalho de teclado continua, e "Auditar um documento" é o elemento mais
forte da tela quando não há nada com você.

### C.4 O projeto nasce da auditoria

O fluxo dos dois cenários descritos pelo mantenedor:

```text
Victor arrasta o memorial no orbe
  → a classificação lê o documento: código 063-26, prefeitura CRICIÚMA
  → resolverProjeto contra os projetos da PROSUL
      achado       → anexa, e a barra mostra 063-26 · CRICIÚMA
      desconhecido → CRIA Projeto(063-26, CRICIÚMA), e anexa
      sem-codigo   → pergunta em qual projeto
  → a auditoria roda com endereço
```

Na segunda vez, e para qualquer outro artefato (LD, capa, volume), o mesmo
caminho leva à mesma pasta: é o cruzamento por centro de custo que faz "tudo
sobre o 063-26 fica junto" acontecer sem ninguém organizar nada à mão.

`Project.createdById` registra quem trouxe o documento que criou a pasta.

---

## Parte D — O que NÃO entra nesta fatia

Fica para depois, nesta ordem, e nada aqui exige desfazer o que entra:

1. **Histórico com pasta, subpasta e autor.** Pedido explicitamente: nome claro de
   cada atividade e quem a fez. Os dados já existem (`ProjectEvent` tem tipo, ator
   e projeto); falta a tela. É a próxima fatia, e é pequena.
2. **`_audit2` — a linhagem entre versões.** A parte mais difícil de tudo: casar
   achado por achado entre pareceres, decidir o que herda resolução e o que
   reabre. O casamento já existe (`chaveEntreVersoes`); a decisão de herança é
   onde se erra em silêncio. Por isso é a última, não por ser menos importante.
3. **Gate de emissão e métricas por projeto.** Exigem a materialização completa
   que C.1 dispensou.
4. **`WorkSession` / anti-duplicata.** Ninguém pediu ainda.
5. **Notificação em canal próprio** (sino, e-mail, Teams).

---

## Parte E — As provas

| Prova | O que exige |
|---|---|
| `test-desfecho-do-achado.ts` | núcleo puro: `ACCEPTED_RISK` sem nota é recusado; `FALSE_POSITIVE` marca os dois eixos |
| `prova-fila-de-achados.mjs` | Victor envia 2 achados ao Milton; aparecem na home do Milton, agrupados pelo projeto |
| `prova-fila-de-achados.mjs` | Milton resolve um; sai da home dele, e o Victor vê o desfecho |
| `prova-fila-de-achados.mjs` | quem enviou também resolve (A.5) |
| `prova-fila-de-achados.mjs` | achado enviado a quem nunca entrou aparece no primeiro login |
| `prova-home.mjs` | sem pendência, a home oferece auditar; com pendência, mostra o projeto |
| `prova-projeto-nasce-da-auditoria.mjs` | código desconhecido cria a pasta; a segunda auditoria do mesmo código cai na mesma |
| `prova-alcada.mjs` | ampliada: pela tela, `MEMBER` não cadastra; pelo Nexo, cria |

Todas com dois atores — `scripts/lib/atores-de-teste.mjs`, que já existe.

---

**Fim da especificação.**
Próximo passo: plano de implementação (`superpowers:writing-plans`).
