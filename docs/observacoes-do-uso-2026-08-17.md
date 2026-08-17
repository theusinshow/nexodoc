# Observações de uso — 17/08/2026

> Levantadas pelo Matheus usando o produto de verdade, para virar um pacote de
> implementação. **Nada aqui foi implementado.** Cada item guarda o que foi
> observado, a leitura do problema e o que já se sabe do código — para o
> brainstorm começar com contexto, não do zero.

---

## 1. O chat devolve os fatos do projeto em texto corrido

**O que ele viu** (ao anexar `084_25_md_geral_a.pdf`):

> Li as primeiras páginas: é o memorial descritivo — Reforma e Adequação da Emeb
> (escola Municipal de Ensino Básico) · PREFEITURA MUNICIPAL DE CRICIÚMA ·
> Criciúma · código 084-25.
>
> Vou auditar usando essa obra como referência. Se o nome estiver errado, me diga
> o correto — é ele que denuncia texto reaproveitado de outro projeto.

**O que ele disse:** *"esse texto corrido não tá funcionando, tem que ter algo
mais claro, mais separado."*

**A leitura:** são **quatro fatos distintos** — obra, órgão, município, código —
espremidos numa frase e separados por `·`. O `·` é pontuação de lista, mas dentro
de um parágrafo ele não cria colunas: o olho precisa varrer a linha inteira para
achar o município, e o nome da obra (longo, com parêntese) empurra o resto para
fora do campo de visão.

O pedido logo abaixo — *"se o nome estiver errado, me diga o correto"* — depende
de a pessoa **conferir campo a campo**. A forma escolhida trabalha contra a ação
que ela mesma pede.

Isto não é preferência estética: este bloco é o **gabarito da auditoria**. Um
município errado passando despercebido aqui contamina todo o parecer.

**O que já se sabe do código:**

- Nasce em `modules/nexo/components/NexoWorkspace.tsx`, no `appendMessage` que
  monta a frase `Li as primeiras páginas: ...` com o `detail` da classificação.
- O cartão de confirmação da auditoria (`ConfirmationCard.tsx`) **já resolve isso
  bem**, com `SummaryRow` por campo (Memorial, Obra, Prefeitura, Município,
  Endereço, Centro de custo). O chat e o cartão dizem a mesma coisa de duas
  formas, e a boa está no cartão.
- Há um primitivo pronto para reusar; não precisa inventar componente.

**Detalhe menor, mas real:** o chat escreve **`código 084-25`** (hífen) enquanto
o título da conversa e o histórico usam **`084_25`** (sublinhado, preservado do
documento — ver `centroDeCustoDaAuditoria`). O mesmo centro de custo aparece com
duas grafias em duas partes da tela.

**Perguntas para o brainstorm:**

- O chat deve mostrar os campos, ou apenas anunciar e deixar a conferência para o
  cartão — que já é onde a ação acontece?
- Se mostrar: os mesmos campos do cartão, ou só os que decidem o gabarito?
- O que fazer quando um campo vem vazio — omitir a linha ou mostrá-la marcada
  como ausente? (O cartão já tem `missing`.)

---

## 2. O histórico precisa de rearrumação completa

**O que ele disse:** *"precisamos dar uma rearrumada no histórico de forma
completa, deixar um UI e UX mais organizado, coisas mais bem declaradas e
organizadas."*

**O que a tela mostra** (25 conversas, agrupadas por centro de custo):

```
  Anexei o memorial — ...        11/08     ← solta, fora de grupo
∨ 999-26                             2
    QA AUTOMATICO FOL...       11/08
    QA AUTOMATICO FOL...       11/08
∨ 017-26                             6
    CENTRO COMUNITÁR...        11/08
    CENTRO COMUNITÁR...        11/08
    CENTRO COMUNITÁR...        03/08
    CENTRO COMUNITÁR...        03/08
    CENTRO COMUNITÁR...        03/08
∨ 084-25                             4
    REFORMA E AMPLIAÇ...       11/08
    REFORMA E AMPLIAÇ...       11/08
    REFORMA E AMPLIAÇ...       11/08
    Nova conversa              11/08
```

### O problema central: dentro do grupo, o título repete o grupo

As seis conversas do `017-26` mostram **o mesmo texto truncado**. O agrupamento
por centro de custo já disse de que projeto elas são; o título gasta a linha
inteira repetindo isso, e o truncamento corta exatamente onde a diferença
estaria. O resultado: seis linhas indistinguíveis para o olho.

A informação que **distinguiria** uma da outra — o que foi feito ali (auditoria?
volume? LD?), como terminou (aprovado, parcial, com achados críticos), quanto
custou — não aparece em lugar nenhum.

**A lista mostra CONVERSAS; a cabeça do usuário pensa em TRABALHOS.** É a raiz de
quase todos os sintomas abaixo.

### Sintomas observados

| # | Sintoma | Leitura |
|---|---|---|
| a | Títulos idênticos e truncados dentro do mesmo grupo | o título é redundante com o grupo |
| b | Data sem hora (`11/08` cinco vezes) | não separa conversas do mesmo dia |
| c | Conversa solta no topo, fora de qualquer grupo | sem código lido, não tem onde entrar |
| d | `Nova conversa` vazia ocupando linha | conversa sem trabalho nenhum deveria sumir ou ser descartável |
| e | Nada declara o ESTADO do trabalho | não dá para ver auditoria parcial, concluída ou com crítico |
| f | Nada declara o custo | o gasto existe por conversa (`AiUsageEvent`) e não aparece |
| g | Ícones do rodapé sem rótulo | quatro alvos sem nome |
| h | Grupo usa `084-25`, título usará `084_25-CRICIUMA` | duas grafias do mesmo centro de custo (ver item 1) |

### O que já se sabe do código

- `modules/nexo/components/NexoSidebar.tsx` — agrupamento, filtros por tipo
  (`TUDO`/`VOLUMES`/`AUDITORIAS`), busca, ações de duplicar/apagar no hover.
- A chave do grupo vem de `deriveFolderKey` (`conversation-store.tsx`), que usa o
  código dominante dos **selos**. Conversa só de memorial não tem selo — é por
  isso que a de cima ficou solta.
- O **tipo** da conversa é derivado no cliente e a lista do servidor não o enxerga
  (limitação já conhecida do projeto).
- O título passou a ser `084_25-CRICIUMA` em 17/08 — **isso piora o sintoma (a)**:
  dentro do grupo `084-25`, todas as conversas passarão a se chamar
  `084_25-CRICIUMA`, exatamente iguais. A correção do histórico resolveu o caso
  "conversa sem nome" e agravou o caso "conversas indistinguíveis".
- O estado existe no dado: `Audit.status`, `runtime.passadas_incompletas`,
  `total_incongruencias`, e o consumo por conversa.

### Perguntas para o brainstorm

- A linha deve nomear a **conversa** ou o **trabalho** (a auditoria, o volume)?
  Uma conversa pode ter vários trabalhos.
- Dentro de um grupo, o que deve ocupar a linha, já que o projeto é conhecido:
  o tipo do trabalho + desfecho? a data com hora? o número de achados?
- Conversa vazia deve aparecer na lista?
- Desfecho merece cor (crítico/parcial/liberado) ou isso é acento demais numa
  lista longa? (§2, Regra do Acento Único.)

---

## 3. O anel de consumo não abre — e faltam métricas POR ARQUIVO AUDITADO

**O que ele disse:** *"botão clicável no ring azul não está funcionando, criar um
botão no topo para ver métricas da IA mais detalhadas sobre o arquivo auditado."*

São **duas coisas diferentes**, e vale não confundi-las.

### 3a. BUG — o popover do anel não abre

No print, o anel do rodapé do chat mostra `78k · $0.257` (o dinheiro já apareceu,
então a mudança de 17/08 está no ar). Clicar nele não abre a quebra.

**Suspeitas, em ordem:**

1. **Regressão do próprio 17/08.** O `<svg>` do chevron foi adicionado DENTRO do
   `<button>` sem `pointer-events: none`; um clique que aterrisse nele pode não
   chegar ao handler. O `aria-hidden` esconde do leitor de tela, não do ponteiro.
2. `AgentPopover` com `open`/`onClose` controlado — verificar se ele fecha sozinho
   no mesmo clique que abre (o `onClick` alterna e um listener de "clique fora"
   pode contar o mesmo evento).
3. O anel vive no `trailing` do composer (`NexoChat.tsx:555`); algum
   `stopPropagation` do composer pode estar comendo o evento.

**Reproduzir antes de consertar** — é barato: basta clicar com o console aberto.
Não assumir a causa 1 só porque é a mais recente.

### 3b. PEDIDO — métricas da IA sobre O ARQUIVO auditado

O anel existente é **por CONVERSA**. Ele soma turnos de chat, leitura de selo e
auditoria no mesmo número — e por isso não responde *"quanto custou auditar ESTE
memorial, e no quê"*.

O que ele quer é **por AUDITORIA**: um botão no **topo do palco**, à direita das
abas `Resumo · Achados · Parecer · No documento` (marcado em vermelho no print),
abrindo as métricas daquela auditoria.

**O dado já existe e já está separado:** `AiUsageEvent.taskId` recebe o `auditId`
(a rota passa `taskId: args.auditId` em toda chamada). Filtrar por ele dá
exatamente o recorte pedido, com a mesma agregação por operação que o painel de
consumo passou a fazer em 17/08.

**O que caberia nesse painel, além do que o anel já mostra:**

- custo e tokens **por passada** (leitura global, blocos, validação), com o que
  falhou em linha própria — já pronto em `aggregateUsage`;
- os **modelos por papel** (`runtime.modelos_operacionais`) e o esforço de
  raciocínio (`runtime.esforco_raciocinio`) — hoje gravados no relatório e nunca
  mostrados;
- **duração** (`runtime.duracao_ms`), páginas e caracteres lidos;
- quantas **passadas não completaram** (`runtime.passadas_incompletas`);
- na reauditoria, o que foi **relido × herdado** (`runtime.reauditoria`).

Ou seja: quase tudo já é gravado e nada disso chega à tela. É um problema de
**exposição**, não de instrumentação.

### Perguntas para o brainstorm

- Um painel só, com abas (consumo × esforço × cobertura), ou o custo no anel e o
  resto no botão do topo?
- O anel por conversa continua existindo, ou vira "gasto desta auditoria" e o
  total da conversa migra para outro lugar?
- Isso é do palco da auditoria (por auditoria) ou do `/admin/usage` (por
  escritório)? As duas perguntas existem e têm donos diferentes.

---

## 4. Saiu da auditoria sem querer e perdeu o parecer pago — GRAVE

**O que ele disse:** *"sai sem querer da auditoria, quando voltei não tinha nada
salvo, tenho que auditar de novo e gastar de novo."*

**O que o print mostra ao voltar para a conversa `084-25-CRICIUMA`:**

| Sobreviveu | Perdeu |
|---|---|
| a conversa e o título na barra lateral | o **parecer** (palco vazio, estado inicial) |
| todas as mensagens do chat | o **memorial retido** ("arraste o PDF do memorial →") |
| o consumo: `78k · $0.257` | o **gabarito**: obra, prefeitura e município em `—` |

### O que isso significa

O anel ainda mostra `$0.257`. **O dinheiro foi gasto, a auditoria rodou, e o
relatório está gravado no Postgres** (`persistCompletedAudit` grava `report`,
`result` e os arquivos). O que se perdeu foi a cópia do NAVEGADOR.

**A situação real, então, não é "o trabalho sumiu" — é "o trabalho existe no
servidor e o produto não sabe mostrá-lo".** Isso muda completamente o conserto: o
problema não é gravar melhor, é conseguir LER de volta.

### Hipóteses da causa, para investigar (não assumir)

1. **O blob do memorial não foi gravado.** `NexoWorkspace.tsx:774` faz
   `void conv.salvarMemorial(memorial)` — *fire-and-forget*. Se o `putBlob`
   rejeitar (o `084_25_md_geral_a.pdf` tem **5,1 MB**), a rejeição some, o
   `memorialMeta` nunca é gravado, e a conversa restaurada volta sem arquivo e
   sem dossiê. **É a mesma causa provável do item 2 da lista original** (o botão
   "Abrir PDF" que não aparecia no cartão do achado) — dois sintomas, uma raiz.
2. **O artefato do parecer não foi gravado.** `saveResult` guarda o envelope da
   auditoria no IndexedDB; um estouro ali deixaria o palco vazio do mesmo jeito
   silencioso.
3. **Saiu antes de terminar.** Se ele saiu com a análise em curso, existe o
   bilhete `auditoriaPendente` + `useReconectarAuditoria` para retomar. Verificar
   se o bilhete foi gravado e por que o palco não reconectou.

O ponto comum das três: **falham em silêncio**. Nenhuma avisa que não gravou.

### O que já existe e não está sendo usado

- `/api/audits/[id]` — lê a auditoria gravada no servidor.
- `modules/nexo/components/use-abrir-auditoria-por-link.ts` — já sabe abrir uma
  auditoria pelo id. A peça de recuperação **existe**; falta um caminho na
  interface até ela.
- `/admin/audits` lista todas as auditorias gravadas, com data e status.

### O que provavelmente falta

- **Reabrir do servidor.** Toda auditoria gravada deveria ser reabrível a partir
  do histórico, sem depender do IndexedDB. É o conserto de raiz: o navegador
  vira cache, não fonte.
- **Gravação que reclama.** `void promessa` em gravação de arquivo pago é a
  forma de perder trabalho sem ninguém saber. Precisa de `catch` e de aviso na
  tela.
- **Não deixar auditar de novo sem dizer que já existe.** Se há parecer gravado
  para aquele arquivo, o cartão deveria oferecer "abrir o que já foi feito" antes
  de oferecer "gastar de novo".

### Perguntas para o brainstorm

- O parecer deve ser SEMPRE lido do servidor, com o IndexedDB só como cache?
- O que fazer quando os bytes do PDF se perdem mas o parecer existe: mostrar o
  parecer sem o visor de documento, ou pedir o arquivo de novo?
- Falha de gravação deve interromper o fluxo ou avisar e seguir?

---

## 5. Comparação com o benchmark do ChatGPT — 084_25

Dois relatórios do MESMO memorial (218 páginas): `chatgpt.md` (25 achados de
referência, AUD-001..025) e `nexodoc-auditoria.md` (25 achados, INC-001..025).

### Placar

| | |
|---|---|
| Achados de referência | 25 |
| Encontrados pelo Nexodoc | **6** |
| **Recall** | **24%** |
| Falsos positivos do Nexodoc | **3** (e são os que produzem o veredito) |
| Achados **só** do Nexodoc, reais | ~12 |

### O que o Nexodoc ACERTOU (6)

| Referência | Nexodoc | Nota |
|---|---|---|
| AUD-003 hierarquia documental p.25/29 | INC-005 | idêntico, com as duas citações |
| AUD-019 16.710 × 16.840 m³/h | INC-007 | idêntico |
| AUD-020 "frequência de 185 µm" | INC-008 | **melhor**: sugere 185 nm |
| AUD-021 numeração 1.1.x no cap. 17 | INC-016 | **melhor**: propõe 17.6.2.1–4 |
| AUD-022 remissão 1.5.1.2 quebrada | INC-013 | **melhor**: identifica o alvo 17.6.1.2 |
| AUD-023 responsabilidade técnica p.218 | INC-017 | **melhor**: nomeia climatização |

Nos seis, a **qualidade da evidência do Nexodoc é superior**: página, trecho
citado, conflito e ação corretiva concreta. O ChatGPT descreve; o Nexodoc manda
o que fazer.

### O que o Nexodoc PERDEU — e dói

Os dois mais graves do documento inteiro:

- **AUD-004 — "Atende? Não" no Bloco H (p.188).** O próprio memorial declara
  não conformidade de saída de emergência. É o achado de maior prioridade
  possível: a não conformidade está escrita no documento, não é inferência.
- **AUD-001/002 — "EEB Rubens de Arruda Ramos, bairro Ceará" (p.37 e 48).**
  Identidade errada em duas disciplinas, com **bairro de outro projeto**. É a
  prova de reaproveitamento mais forte do documento.

E mais 13: quadro de áreas com três valores conflitantes (AUD-009/010/011),
transformador 455,81 A × disjuntor 450 A (AUD-008), motobomba × dimensionamento
(AUD-006/007), parquinho fora do escopo × drenagem (AUD-014), CBUQ 5 × 4 cm
(AUD-015), 405 m³ × 1,30 ≈ 527 m³ (AUD-017), títulos 3.4.7/3.4.8 duplicados
(AUD-018), drenagem em propriedade privada (AUD-024), ocupação mista (AUD-005).

### A CAUSA MAIS PROVÁVEL: ele leu 16% do documento

O relatório declara **"Nível: Padrão"** e **modelo `gpt-5.6-terra`**. No Padrão:

- a leitura global recebe **90.000 caracteres de 547.855 — 16%**, amostrados em
  cabeça/meio/cauda;
- a leitura por capítulo cobre **8 blocos**, não todos.

Os achados perdidos estão em p.14, 21-22, 37, 40, 48, 50-52, 140, 166-167, 175,
180-181, 188 — quase todos **no miolo**, exatamente o que a amostragem descarta.
Os acertos concentram-se em p.25-29 (cabeça) e 207-218 (cauda).

**Não é recall de motor; é recall de COBERTURA.** Comparar Padrão contra um
benchmark que leu tudo mede a amostragem, não a inteligência.

> **Refazer a comparação com cobertura total antes de qualquer conclusão sobre
> qualidade do motor.** Este número (24%) não é o teto do produto.

### BUG — o relatório mente sobre o esforço

O texto diz: *"leitura de identidade, leitura global por IA e **98 blocos** de
leitura por capítulo"*. No Padrão o teto é **8**. A frase usa
`chunkPdfByChapter(...).length` (total de capítulos do documento) em vez de
`chunks.length` (os que foram lidos) — `app/api/audit/route.ts`, montagem do
`resumo` em `arquivos_analisados`.

O relatório sustenta decisão de emitir projeto e está afirmando um esforço
**12× maior** do que houve. Mesma família do defeito das auditorias parciais
silenciosas. **Conserto de uma linha, e urgente.**

### 3 FALSOS POSITIVOS — e são eles que fecham o veredito

O veredito é *"🔴 NÃO EMITIR — 4 incongruências críticas"*. **Três das quatro
são falsas:**

- **INC-003 e INC-004 — "Escola Geral" (p.181).** Não é nome de obra: é a
  **classificação de ocupação do PPCI** (`Grupo E – Escola Geral E-1`), termo da
  norma de incêndio. A regra leu uma tabela normativa como identidade de
  empreendimento. INC-003 ainda usa o rótulo mais grave que existe
  ("Documento diverge da obra declarada no gabarito").
- **INC-002 — "Escola Rubens de Arruda Ramos" (p.124).** É a MESMA obra, com
  "Escola" no lugar de "EMEB".

**Por que a correção de 17/08 não pegou o INC-002:** o conserto compara o nome
próprio citado contra o gabarito inteiro. Mas o gabarito desta corrida é
`"Reforma e Adequação da Emeb (escola Municipal de Ensino Básico)"` — **sem
"Rubens de Arruda Ramos"**. A extração da obra cortou o nome próprio no
fecha-parêntese.

**A raiz subiu de lugar:** não está mais na regra de identidade, está na
**leitura da obra**. Com o gabarito truncado, nenhuma comparação de identidade
pode funcionar — e ela é o alicerce do produto.

**A ironia amarga:** o Nexodoc acusou identidade errada em duas páginas onde
está certa (124, 181) e **não viu** a identidade errada de verdade nas páginas
37 e 48 (`EEB` + `bairro Ceará`).

### O que só o Nexodoc encontrou — e tem valor real

O ChatGPT **não achou nenhum** destes:

- **INC-001 — marca sem "ou similar" (p.110), Lei 14.133 art. 41.** Conformidade
  legal de licitação pública. É o achado de maior valor comercial do relatório e
  o benchmark passou batido.
- INC-006 — ferragens alumínio × inox (p.66/105).
- INC-012 — piso tátil 12 mm × 7 mm (p.96-97).
- INC-009 — escopo do instalador × projeto executivo (p.212).
- INC-014/015 — NB 3/90, EB-224/81 e outras normas sem vigência (p.207).
- INC-018 — parágrafo duplicado.
- INC-019/020/022/023/024/025 — seis erros de português com correção pronta.

**Leitura honesta:** onde o Nexodoc olha, ele olha melhor e entrega acionável. O
problema é **onde ele não olha** — e um veredito construído sobre três falsos
positivos.

### Pacote que sai daqui

| Prioridade | Item |
|---|---|
| 1 | **Extração da obra corta no parêntese** — o gabarito nasce truncado |
| 2 | **Termo de norma lido como nome de obra** ("Escola Geral", PPCI Grupo E) |
| 3 | **Relatório mente sobre blocos lidos** (98 declarados × 8 lidos) |
| 4 | **Refazer a comparação com cobertura total** antes de julgar o motor |
| 5 | Regra para **não conformidade declarada** ("Atende? Não", "não conforme") — sugestão do próprio benchmark |
| 6 | Reconciliação de **quadro de áreas** entre texto e tabelas |
| 7 | Conferência numérica entre **equipamento especificado × dimensionamento** (bomba, disjuntor) |

---

<!-- Próximas observações entram abaixo. -->
