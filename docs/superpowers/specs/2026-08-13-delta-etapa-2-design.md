# Reauditar só o que mudou — Etapa 2 — Design

Data: 2026-08-13
Status: aprovado no brainstorm, pronto para o plano de implementação

---

## 1. Problema e objetivo

No nível Profundo o motor **não fatia** o documento: manda o memorial inteiro
numa chamada só (até 700 000 chars, `getGlobalContextChars`) mais uma de
validação. São 2 chamadas de modelo, não 24.

O efeito prático: um memorial que voltou da prefeitura com **um capítulo
corrigido** é relido por inteiro. No 063-26 são 196 076 caracteres e 258
segundos de modelo para reencontrar o que já era conhecido. E medido no banco em
13/08/2026, `audit-global` é **~47% de todo o gasto de IA do projeto**.

A **etapa 1** (commits `19b5414` e `0ccc275`) entregou a capacidade de
*responder* o que mudou, sem economizar nada:

- toda auditoria grava `report.runtime.impressao` — o sha-256 do texto
  normalizado de cada capítulo (`lib/audit-fingerprint.ts`);
- `/api/audit/delta` compara o PDF novo com a auditoria anterior **sem chamada de
  modelo** e devolve `iguais` / `alterados` / `novos` / `sumidos`;
- o cartão mostra "32 iguais, 1 alterado, 1 novo — 95% do texto já foi lido
  antes", e diz explicitamente que **a auditoria ainda lê o documento inteiro**.

Medido nos memoriais reais (`scripts/medir-capitulos-do-memorial.ts`): 013-26 →
37 capítulos, 017-26 → 66, 040-26 → 91, 063-26 → 33, 083-25 → 148, **todos com
título detectado**, mediana de ~3 000 chars. Um capítulo alterado mais um volume
novo no 063-26 deixaria **5% do documento** para reler.

**O objetivo da etapa 2 é transformar esses 95% em economia** — sem que o
parecer resultante fique pior, mais curto ou mais difícil de usar do que o de uma
auditoria completa.

## 2. As quatro decisões que governam o desenho

Fechadas no brainstorm de 13/08/2026.

1. **O parecer sai completo, com achados reaproveitados.** Não é um relatório de
   diferenças. O engenheiro emite olhando uma lista só; obrigá-lo a abrir duas
   auditorias lado a lado transferiria para ele o trabalho que o software existe
   para fazer.
2. **A leitura recebe o delta em texto integral mais um mapa comprimido dos
   capítulos iguais.** Ler só o delta deixaria o capítulo novo do metálico
   contradizendo a fundação do capítulo 3 sem que ninguém veja.
3. **A síntese por capítulo é emitida pelo modelo na auditoria que já lê tudo.**
   Quem resume é quem entendeu.
4. **O cartão oferece o caminho barato; reler tudo continua o padrão.** Ninguém
   ganha economia sem pedir.

### 2.1 Uma correção ao que estava anotado

A nota de ontem registrava que a passada de validação serviria de rede contra
contradição entre capítulos distantes. **Não serve.** `validateFindingsWithModel`
julga candidatos que já existem — o prompt diz literalmente "Sua tarefa não é
procurar novos erros". Se a leitura não vir os dois lados da contradição, ninguém
vê. Daí a decisão 2 existir.

## 3. Arquitetura

### 3.1 O que muda em cada passada

| passada | hoje | no caminho barato |
|---|---|---|
| regras (identidade, coerência) | documento inteiro, local, sem token | **igual** — documento novo inteiro, sempre |
| `audit-global` | documento inteiro | delta em texto integral + mapa comprimido dos iguais |
| herança de achados | não existe | achados de IA dos capítulos iguais, reancorados |
| `audit-validation` | achados + recorte de 45k | **igual**, sobre o conjunto fundido |

As regras determinísticas **nunca** entram no delta. Elas não custam token, são o
núcleo que não alucina, e reprocessá-las por inteiro é de graça.

A validação rodar sobre o conjunto fundido não é detalhe: é ela que normaliza
gravidade e prosa entre achado herdado e achado fresco. Sem isso o parecer sai
com dois tons de escrita, e o leitor percebe.

### 3.2 Dado novo no parecer

Ao lado de `runtime.impressao`, passa a ser gravada em **toda** auditoria uma
síntese por capítulo:

```
runtime.sintese: [{ arquivo, capitulos: [{ hash, resumo }] }]
```

O `resumo` é uma linha com as afirmações que prendem o projeto — sistema
estrutural, fck, responsável pela terraplenagem, norma declarada. Vem da leitura
global, como campo adicional da resposta.

A chave é o **hash**, não o índice nem o título: é o hash que sobrevive a
capítulo inserido no meio, e é por hash que o casamento já funciona.

**Numa reauditoria barata a leitura global não vê o documento inteiro**, então
ela só produz síntese dos capítulos que leu. A síntese dos capítulos iguais é
**copiada do parecer anterior**, pelo hash. Sem isso, a terceira auditoria do
mesmo memorial perderia o mapa que a segunda deixou de gerar, e o benefício
duraria uma rodada só.

Custo: ~1 000 a 4 500 tokens de saída por auditoria (33 a 148 capítulos),
$0,03 a $0,13 no `sol`. Pago em toda auditoria, inclusive nas que nunca serão
reauditadas. É o preço de a segunda auditoria ser barata.

**O teto de saída precisa subir junto.** A leitura global do Profundo já devolve
muitos achados e o teto é dimensionado para eles; somar uma linha por capítulo
sem mexer no teto convida o JSON a truncar. Truncar hoje já degrada alto (a
checagem de `status: incomplete` entrou em `a1680b9` e o teto foi a 6 000 em
`9dc4b86`), então o sintoma seria barulhento — mas o certo é não provocá-lo.

JSON schemaless, sem migração — mesma decisão que a impressão digital já tomou.

### 3.3 Módulos

- **`lib/audit-fingerprint.ts` — não muda.** A comparação já está pronta e o
  casamento (hash, depois título) já erra para o lado seguro.
- **`lib/audit-reuso.ts` — novo, puro.** Recebe `(delta, parecerAnterior,
  extraídoNovo)` e devolve `{ capitulosParaLer, achadosHerdados,
  naoReancorados }`. Sem `@/` no caminho de valor e com extensão `.ts` nos
  imports relativos, para rodar em node cru — mesmo padrão de `lib/ai-precos.ts`
  e `lib/audit-validation-prompt.ts`.
- **`lib/audit-validation-prompt.ts`** — ganha o construtor do mapa comprimido,
  que é irmão do `buildValidationContext` que já mora ali.
- **`app/api/audit/route.ts`** — fia as peças e escolhe o prompt da global.
- **`modules/nexo/components/ConfirmationCard.tsx`** — o segundo botão.

Regra que guiou a divisão: **toda decisão de reuso é determinística e testável
sem token.** O modelo só entra para ler o que mudou.

## 4. Reancoragem e herança

### 4.1 O que é herdado

Só achado com `origem === "ia"` de capítulo `igual`. Achado de regra nunca —
as regras reprocessam tudo de graça, e herdá-lo duplicaria. Capítulo `alterado`
vai ao modelo e produz achado fresco. Capítulo `sumido` leva os seus embora.

### 4.2 Qual achado pertence a qual capítulo

Por **página**, dentro da faixa `[startPage, endPage]` da impressão anterior.
**Não** pelo campo `capitulo`: o texto dele é ambíguo — "1 - APRESENTAÇÃO"
aparece três vezes nesses memoriais, e emparelhar pelo título traria o achado do
capítulo errado.

### 4.3 Os dois caminhos da âncora

1. **Aritmética.** Capítulo casado por hash é byte a byte idêntico. Se ocupa o
   mesmo número de páginas antes e agora, o deslocamento é uniforme:
   `agora.startPage − antes.startPage`, somado à página do achado. Determinístico,
   sem busca, sem token. Cobre o caso que motivou o projeto — entrou capítulo no
   meio, tudo depois andou junto.
2. **Busca pelo `termo_busca`.** Se o capítulo passou a ocupar outro número de
   páginas, as quebras internas mudaram e a aritmética mente. Procura-se o termo
   no texto novo; cada achado já carrega esse campo e o visor de PDF já o usa.

**Quando os dois falham** — sem `termo_busca` ou termo não encontrado — o
capítulo **sai de "iguais" e vai para "ler"**. O modelo o lê e produz achados
frescos, com página certa. O erro cai para o lado seguro (gastar, não perder),
que é o mesmo critério do casamento por hash. Se muitos falharem, a reauditoria
degrada suavemente na direção do comportamento de hoje, que é reler tudo.

### 4.4 Invalidação

A chave de reuso carrega uma **versão do auditor**: uma constante no código,
**gravada em `runtime` de toda auditoria**, subida à mão quando o prompt ou o
modelo da leitura global mudam. Gravada é o que permite comparar — a constante
sozinha diz o que o código é hoje, não o que produziu o parecer de ontem.

Mesmo padrão do cache de leitura de selo, e pela mesma razão: achado velho foi
produzido por outro auditor, e servi-lo depois de melhorar o prompt é servir
leitura vencida. O reuso só é permitido quando a versão gravada no parecer
anterior é igual à do código que está rodando; diferente é tratado como
incomparável, não como "compatível o bastante".

Parecer sem a versão — todos os anteriores a 13/08/2026 — não é reaproveitável.
Falta de dado é "não dá para comparar", nunca "nada mudou".

## 5. Fluxo na tela

O cartão já mostra o delta. Ele ganha um segundo botão:

- **"Auditar"** — o de sempre, relê tudo. Continua o padrão.
- **"Auditar só o que mudou (5% do documento)"** — o caminho barato, com o número
  medido pelo próprio delta.

O botão barato só aparece quando a comparação é possível: existe auditoria
anterior no mesmo arquivo, com impressão e com versão do auditor compatível. Fora
disso ele simplesmente não existe, e nada é explicado ao usuário sobre uma opção
que ele não tem.

## 6. Erro e degradação

- **Falhar a comparação nunca vira erro.** Sem impressão, sem versão, arquivo
  diferente: o botão não aparece e a auditoria roda inteira, como sempre rodou.
- **A leitura global continua best-effort.** Se falhar, os achados
  determinísticos seguem valendo e a degradação entra em `passadas_incompletas`,
  como hoje.
- **O parecer registra o caminho**, em `runtime.reauditoria`: qual auditoria
  serviu de base, quantos capítulos foram lidos, quantos herdados, quantos
  achados vieram de antes, e a versão do auditor.
- **E isso aparece na tela**, em linha própria do "como ler" — *"esta reauditoria
  leu 2 de 33 capítulos; 28 achados vieram da auditoria de 12/08"*. **Não** em
  `passadas_incompletas`: aquilo é para quando algo falhou, e aqui nada falhou,
  foi escolha. Economia silenciosa é o mesmo defeito das auditorias parciais
  silenciosas, do outro lado.

## 7. Provas

Todas sem token, porque `lib/audit-reuso.ts` é puro:

- capítulo inserido no meio → deslocamento aritmético correto;
- capítulo que passou a ocupar outro número de páginas → cai na busca por
  `termo_busca`;
- termo não encontrado → o capítulo sai de "iguais" e vai para "ler";
- achado de regra **nunca** é herdado;
- achado mapeado por página, não por título — com o caso real de
  "1 - APRESENTAÇÃO" repetido três vezes;
- parecer sem versão do auditor → nada é herdado;
- capítulo `sumido` → seus achados não aparecem no parecer novo.

E a prova que fecha a promessa: `scripts/prova-delta-do-memorial.mjs` já mede o
delta no 063-26 real. É estendida para medir **quantos caracteres efetivamente
iriam ao modelo** no caminho novo — o número que o commit vai alegar, medido e
não estimado.

## 8. Fora de escopo, de propósito

- **A auditoria Padrão.** O caminho quente é o Profundo: `modules/nexo/lib/audit.ts`
  manda `auditMode` fixo em "memorial", e é lá que está o gasto.
- **Múltiplos arquivos com delta.** A impressão já é por arquivo, mas o reuso
  começa com um só.
- **Reauditar em lote as auditorias antigas.** Assunto separado, com custo
  próprio, e ainda não decidido.
