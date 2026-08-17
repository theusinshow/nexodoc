# Reuso da auditoria — Design

> Spec fechada por brainstorm (17/08/2026). Liga o motor de reuso que já existe
> em `lib/audit-reuso.ts` e nunca foi chamado por ninguém.

## 1. Problema

Reauditar um memorial hoje **paga tudo de novo**. A impressão digital por
capítulo é gravada em todo parecer, `/api/audit/delta` já diz o que mudou sem
gastar token, e `planejarReuso` já decide o que herdar — mas as cinco funções de
`lib/audit-reuso.ts` têm **zero chamadas em produção**. A rota importa dali
apenas a constante `VERSAO_AUDITOR`.

O delta, portanto, é só uma **tela de decisão**: diz "86% é igual" e, se a pessoa
mandar reauditar, relê e recobra 100%.

Custo medido no `AiUsageEvent` (084_25, 218 páginas, 17/08/2026):

| passada | custo |
|---|---|
| leitura global (1 chamada, documento inteiro) | US$ 1,19 |
| blocos | ~US$ 2 quando funcionam |
| validação | US$ 0,34 |

## 2. Decisões

| Tema | Decisão |
|---|---|
| Escopo | Blocos **e** leitura global. A global recebe o texto dos capítulos mudados + os **resumos** (`runtime.sintese`) dos inalterados |
| Quem decide | **Automático**, e sempre declarado no parecer |
| Invalidação | Versão do auditor **derivada** da configuração real, por hash |
| Documento idêntico | **Recusa** — "o documento é idêntico, não há o que auditar" |
| Base parcial | Parecer com `passadas_incompletas` **não** serve de base |

## 3. Fluxo

O cliente já conhece `auditIdAnterior` (a última auditoria da conversa) e já o
envia para `/api/audit/delta`. Passa a enviá-lo também para `/api/audit`.

No servidor, **antes de qualquer token**:

1. Carrega o parecer anterior: `runtime.impressao`, `incongruencias`,
   `runtime.versao_auditor`, `runtime.passadas_incompletas`.
2. Recusa a base se ela for inelegível (§5).
3. `compararImpressoes(antes, agora)` → delta.
4. Se o delta não tem alterados nem novos **e** a versão do auditor bate →
   **recusa a auditoria** (§6).
5. `planejarReuso({ delta, capitulosAntes, achadosAntes, paginasAgora, versaoAnterior })`.
6. Regras determinísticas rodam **sempre**, sobre o documento novo. Custam zero e
   nunca são herdadas.
7. Blocos: só os capítulos de `plano.capitulosParaLer`.
8. Leitura global: texto integral dos capítulos mudados + `sintese` dos iguais.
9. Validação: recebe os achados **novos de IA** e **todos os de regra** — estes
   nasceram nesta corrida e nunca são herdados (§3.6), então precisam do mesmo
   crivo de sempre. Ficam de fora apenas os **herdados**: eles já foram validados
   na corrida que os produziu, e revalidá-los custa dinheiro e pode virar o
   veredito de um texto que não mudou.
10. Merge: `plano.achadosHerdados` + achados novos + achados de regra.

## 4. Versão do auditor derivada

`VERSAO_AUDITOR` era uma constante que alguém precisava lembrar de subir. Em
17/08/2026 o modelo dos blocos mudou de `sol` para `terra` e o agrupamento mudou
de 28k para 10k **sem** a constante subir — achado herdado seria de um auditor
que não existe mais.

Passa a ser derivada do que de fato produz o achado:

```
versaoDoAuditor(modo) = sha256(
  getAuditorPrompt(modo)        // o texto inteiro do prompt
  + modelo da leitura global
  + modelo dos blocos
  + modelo da validação
  + esforço de raciocínio
  + CHUNK_GROUP_CHARS
).slice(0, 12)
```

Mexeu em qualquer um deles, a chave muda sozinha e o próximo parecer relê tudo.
É o mesmo padrão do cache de leitura de selo, que já funciona assim no produto.

`planejarReuso` hoje compara `args.versaoAnterior` contra a constante importada
do próprio módulo. Passa a receber **as duas pontas** — `versaoAnterior` e
`versaoAtual` — em vez de ler a atual de uma constante global. Sem isso a função
deixaria de ser pura: ela passaria a depender de `process.env` e do prompt para
saber com o que comparar, e o teste em node cru morreria junto. O comportamento
interno (`diferente → achadosHerdados: []`) já está escrito e não muda.

Tipo: `versaoAnterior?: string` e `versaoAtual: string`. Pareceres antigos,
gravados com o número `1`, nunca casam com um hash de 12 caracteres — não são
reusados, que é o desfecho correto.

## 5. Quando a base NÃO serve

O reuso é seguro porque só herda de capítulo byte a byte idêntico. Mas a BASE
precisa de portão próprio:

| Condição | Motivo |
|---|---|
| `passadas_incompletas` não vazio | **A corrida de 17/08 é o caso real**: 20 dos 25 blocos truncaram. Herdar dela congelaria o buraco — cada reauditoria confirmaria o vazio da anterior, e a cobertura nunca voltaria |
| `status !== COMPLETED` | parecer que falhou não afirma nada |
| Versão do auditor diferente | §4 |
| Sem `runtime.impressao` | não há o que comparar |
| Arquivo com outro nome | `impressao` é por arquivo; casar por nome é o único elo |
| Auditoria de outro projeto | contaminaria o centro de custo alheio |

Base inelegível **não é erro**: a auditoria roda inteira, como sempre rodou, e o
parecer diz por que não houve reuso.

## 6. Documento idêntico

Delta sem alterados nem novos, e versão do auditor batendo: não há trabalho a
fazer. A rota **recusa antes de gastar**, com a frase e o ponteiro para o parecer
que já existe:

> O documento é idêntico ao que foi auditado em 17/08. Não há o que auditar.

Atenção ao caso que **não** é recusa: documento idêntico com versão do auditor
DIFERENTE. Ali o texto é o mesmo mas o auditor não é, e a releitura completa é
justamente o que se quer. Confundir os dois faria uma melhoria de prompt nunca
alcançar os memoriais já auditados.

## 7. O que aparece na tela

**Faixa no topo do parecer**, quando houve reuso:

> Reauditoria — 5 de 56 capítulos relidos. 51 idênticos ao parecer de 17/08; os
> achados deles foram herdados.

**Selo no cartão do achado herdado:** `herdado · 17/08`, com a página reancorada
(`p. 47`, antes `p. 44`).

O parecer é a peça que sustenta uma decisão de emitir projeto. Achado que não foi
produzido nesta corrida precisa dizer isso — esconder seria afirmar um trabalho
que não houve, que é o mesmo defeito das auditorias parciais silenciosas.

## 8. Superfície de mudança

| Onde | O quê |
|---|---|
| `lib/audit-reuso.ts` | `VERSAO_AUDITOR` → `versaoDoAuditor(config)` derivada |
| `lib/audit-report.ts` | `runtime.reuso` e `herdado_de` no achado |
| `app/api/audit/route.ts` | recebe `auditIdAnterior`; portão da base; recusa de idêntico; restringe blocos e global; merge |
| `lib/audit-validation-prompt.ts` | contexto global com resumo dos capítulos iguais |
| `components/audit-result.tsx` | faixa de reauditoria + selo no cartão |
| `modules/nexo/lib/audit.ts` | envia `auditIdAnterior` |

**Novo:** nada de domínio. O motor de decisão já existe e tem teste.

## 9. Testes

Sem token, em node cru:

- versão derivada muda quando prompt/modelo/esforço/tamanho mudam, e **só** então;
- parecer parcial não é aceito como base;
- documento idêntico recusa; idêntico com versão nova **não** recusa;
- achado de regra nunca é herdado;
- âncora que falha promove o capítulo inteiro para releitura;
- merge não duplica achado que existe herdado e novo.

Com token, uma vez: `scripts/prova-bloco-cabe.ts` já provou que o bloco cabe;
para o reuso, uma reauditoria real de memorial com um capítulo alterado, medindo
o custo no `AiUsageEvent` contra a corrida completa.

## 10. Riscos

- **Resumo pior que o texto.** A global passa a ver os capítulos inalterados pelo
  resumo. Um defeito que só aparece no texto integral e atravessa capítulos pode
  escapar. Mitigação: os capítulos inalterados já foram lidos integralmente na
  corrida que os resumiu, e os achados de lá são herdados.
- **Reancoragem errada.** Página herdada que aponta para o lugar errado é pior que
  achado ausente. `planejarReuso` já trata: sem âncora, o capítulo inteiro volta
  para leitura.
- **Base envenenada.** Coberto pelo §5, e é o risco que a corrida de hoje tornou
  concreto.
