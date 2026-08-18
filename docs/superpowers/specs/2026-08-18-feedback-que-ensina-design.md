# O feedback que ensina — Design

> Spec fechada por brainstorm (18/08/2026). O medo declarado pelo autor —
> *"meu medo é a IA se confundir"* — é o requisito central, não uma ressalva.

## 1. Problema

Existem **dois sistemas de aprendizado, e eles nunca se falam**.

`AuditFeedback` (Postgres) é rico e bem modelado: por achado, guarda veredito
(`CONFIRMED` · `FALSE_POSITIVE` · `WRONG_SEVERITY` · `MISSING_FINDING`), nota,
página, quem marcou, quando, e um `fingerprint` pensado para reencontrar o
achado entre versões. É o sinal real de quem revisa.

`AuditLearning` é um arquivo JSON em disco (`data/nexodoc-learnings.json`),
curado à mão, colado em **21 pontos de prompt**.

O arquivo está **vazio** (`[]`). Então hoje o motor recebe *"Nenhum aprendizado
ativo cadastrado"* em 21 lugares, e **todo o feedback do usuário morre no
Postgres sem nunca chegar ao parecer seguinte**.

### 1.1 Por que ligar o que existe seria pior que deixar desligado

O caminho atual injeta texto livre — até 20 aprendizados × 2.000 caracteres — em
todo prompt, sem evidência, sem escopo fino, sem nada que impeça dois
aprendizados de se contradizerem, e sem nada que meça se um deles piorou o
recall. Hoje ele não confunde porque está vazio. **Ligado como está,
confundiria.**

### 1.2 A falha silenciosa que ninguém veria

`chaveEntreVersoes` (`lib/diff-de-pareceres.ts:61`) é
`tipo | evidencia[0:120]`, e o `tipo` é redação livre do modelo. Medido nas três
corridas Deep do 117_25 em 18/08/2026:

| chave | reencontra na 2ª corrida | nas três | funde achados |
|---|---|---|---|
| **hoje** — `tipo \| evidencia120` | **16%** | 14% | 0 |
| `impressaoDoAchado` (a do dedupe) | **50%** | 34% | **0** |
| página + citação(12) | 60% | 47% | 2 |

**84% do feedback se perderia na reauditoria do mesmo documento.** O engenheiro
marcaria dez falsos positivos, oito voltariam sem marca, e a conclusão dele
seria "o sistema não aprende" — sem nada no log dizendo o contrário.

## 2. Decisões

| Tema | Decisão |
|---|---|
| O que o feedback ensina | **Só dois eixos**: não repetir falso positivo, e corrigir severidade errada. `MISSING_FINDING` e preferência de estilo ficam fora desta spec |
| Onde o aprendizado age | **Depois da auditoria, no pós-processamento.** Nada entra no prompt |
| O que acontece com o achado | **Volta rebaixado e carimbado.** Não some |
| Alcance | **A linhagem daquele documento.** Nunca cruza projeto |
| Chave | `impressaoDoAchado` — a mesma do dedupe |
| Severidade | **Fila de revisão**, não ajuste automático |
| Padrão repetido entre projetos | Vira **alerta de regra errada**, não mais supressão |

### Por que o aprendizado fica fora do prompt

É a resposta estrutural ao medo declarado. **A IA não pode se confundir com uma
instrução que ela não recebe.** A passada de descoberta roda idêntica, com o
mesmo prompt de hoje; o feedback só muda como o resultado é apresentado.

Isso também preserva a capacidade de medir: `varredura:deterministica`,
`recall-vs-benchmark` e `prova:evidencia-ancorada` continuam válidos sem
adaptação, porque a descoberta não mudou.

### Por que rebaixar e não suprimir

A doutrina do projeto, já paga em 12/08/2026: filtro que descarta em silêncio é
a próxima coisa a esconder achado. Um achado suprimido é invisível — se a
supressão estiver errada, ninguém descobre, e o parecer passa a afirmar ausência
de um defeito que ele deixou de procurar.

### Por que a marca não cruza projeto

Falso positivo marcado costuma ser sintoma de **regra errada**, e regra errada se
conserta na regra. Propagar a supressão pelo escritório trataria o sintoma e
deixaria a causa viva — calada — em todos os outros projetos. Foi exatamente
assim que os quatro falsos positivos de identidade do 113-22 sobreviveram até
hoje.

### Por que a severidade não se ajusta sozinha

`WRONG_SEVERITY` não tem onde ancorar em achado de IA: o `tipo` muda a cada
corrida. Em achado de **regra** ancora perfeitamente — mas três pessoas podem
errar pelo mesmo motivo, e uma régua que se move sozinha move-se também quando
está errada. A contagem entra na fila; o conserto é uma linha de código.

## 3. Arquitetura

```
auditoria roda IGUAL (mesmo prompt, mesma descoberta)
   ↓
dedupe → filtros → sortAuditFindings
   ↓
[NOVO]  aplicarDesfechosConhecidos(findings, desfechos)
   ↓                              ↑
relatório                    AuditFeedback do MESMO projeto,
                             casado por impressaoDoAchado
```

### 3.1 `lib/desfecho-conhecido.ts` — puro

```ts
type DesfechoConhecido = {
  impressao: string;      // impressaoDoAchado no momento da marcação
  desfecho: "FALSE_POSITIVE";
  por: string;            // e-mail de quem marcou
  em: string;             // ISO
  nota?: string;
};

function aplicarDesfechosConhecidos(
  findings: AuditFinding[],
  conhecidos: DesfechoConhecido[],
): { findings: AuditFinding[]; marcados: number };
```

O achado que casa recebe `tier: "sugestao"`, `confianca: "baixa"`,
`impacto: "revisao_editorial"` e um campo novo `ja_julgado` com quem, quando e a
nota. **Nenhum achado é removido da lista.**

Só `FALSE_POSITIVE` entra. `FIXED_IN_DOC` e `ACCEPTED_RISK` dizem respeito ao
trabalho, não à qualidade da auditoria — e tratá-los como julgamento da IA
contaminaria o benchmark, que é o defeito que `desfecho-do-achado.ts` já existe
para evitar.

### 3.2 A chave

`impressaoDoAchado` (`lib/impressao-do-achado.ts`) passa a ser gravada no
`fingerprint` do `AuditFeedback`, no lugar de `chaveEntreVersoes`.

**Migração:** as linhas já gravadas têm a chave antiga e não casam com a nova.
Elas não são recalculáveis (o parecer da época pode ter sumido). O tratamento é
não tratar: as antigas ficam órfãs e param de casar — o que já é o
comportamento de hoje em 84% dos casos. Nenhum dado é apagado.

`chaveEntreVersoes` continua existindo para `diff-de-pareceres`, e **passa a
delegar para `impressaoDoAchado`**: o diff sofre da mesma fragilidade de 16% e
melhora pelo mesmo motivo.

### 3.3 A leitura dos desfechos

A rota busca em `AuditFeedback` os registros com `verdict = FALSE_POSITIVE` cujo
`Audit` tenha o **mesmo `projectId`** da auditoria em curso. `AuditFeedback` não
tem `projectId` próprio — a ligação é `AuditFeedback.auditId → Audit.projectId`,
que é opcional no schema. **Auditoria sem projeto não lê desfecho nenhum**: sem
projeto não há linhagem, e casar por chave solta atravessaria obras diferentes.

O corte por projeto é feito **na consulta**, não depois — o dado de outro projeto
nunca chega a ser carregado.

**Projeto é o pré-filtro; o arquivo é o corte fino.** `impressaoDoAchado` começa
pelo nome do arquivo, então um desfecho marcado no memorial não alcança um achado
do tomo estrutural do mesmo projeto, ainda que a página e o trecho coincidissem.
Os dois cortes são necessários: o de projeto porque é o que a decisão de alcance
pede, o de arquivo porque é o que a chave já garante.

### 3.4 Severidade na fila

`WRONG_SEVERITY` sobre achado de **origem regra** é agregado por regra e exposto
em `fila:regras-contestadas`, ao lado das contestações da validação por IA. É a
mesma fila e a mesma leitura: uma marcação pode ser a pessoa errando; a mesma
regra rebaixada muitas vezes é a régua errada.

Achado de origem IA não entra — não há identidade estável para agregar.

## 4. Como isso pode falhar, e o que cada falha faz

| Falha | Consequência | Guarda |
|---|---|---|
| Chave casa achado errado | Um achado real volta carimbado como já julgado | `impressaoDoAchado` mede **zero** fusão indevida nas três corridas |
| Chave não casa | O falso positivo volta sem marca | É o comportamento de hoje. Sai de 16% para 50% |
| Regra errada suprimida por marcação | Sintoma some, causa fica | A marca não cruza projeto, e o padrão repetido vira alerta |
| Feedback de má-fé ou engano | Um achado real fica rebaixado | Nada some; `ja_julgado` diz **quem** marcou e **quando** |

## 5. Testes

**Puro, sem IO** (`test:desfecho-conhecido`):
- achado que casa é rebaixado e ganha `ja_julgado`;
- achado que casa **não é removido** da lista;
- achado que não casa passa intacto;
- `FIXED_IN_DOC` e `ACCEPTED_RISK` não rebaixam nada;
- lista vazia de desfechos devolve os achados idênticos.

**Contra dado real** (`prova:feedback-sobrevive`): usando os três pareceres do
117_25 já versionados, mede quantos achados da corrida 1 são reencontrados na 2
e na 3 pela chave nova. Falha se cair abaixo de 45% — o número medido é 50%, e a
margem existe para acusar regressão sem disparar por ruído.

## 6. Fora de escopo, e por quê

- **`MISSING_FINDING`** — é o mais valioso e o mais perigoso: vira instrução em
  texto para o modelo (o que esta spec recusa) ou vira pedido de regra nova (o
  que é trabalho de escrever regra, não de feedback). Merece spec própria.
- **Preferência de redação/estilo** — é o `AuditLearning` de hoje, e é o desenho
  de maior risco de confundir e menor valor medido. Fica desligado.
- **Ajuste automático de severidade** — ver §2.
- **Propagação entre projetos** — ver §2.

## 7. O que esta spec assume e não prova

Os 50% de sobrevivência vêm de **um documento**, o 117_25, em três corridas. A
ordem de grandeza é confiável (3× melhor que os 16%), mas o número exato pode
variar por documento. `prova:feedback-sobrevive` existe para que isso seja
medido de novo a cada memorial que entrar no acervo, e não estimado.
