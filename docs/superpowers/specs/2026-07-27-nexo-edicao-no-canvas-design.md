# Nexo — editar o documento pelo canvas

**Data:** 2026-07-27
**Estado:** desenho aprovado, pronto para implementar

## Problema

Alterar qualquer parâmetro exige conversar: "muda o título para X", esperar o
turno, conferir o card, confirmar. Para o ajuste fino — corrigir uma palavra do
título, trocar o mês — isso é lento e indireto. O engenheiro está olhando para o
documento no canvas e quer mexer nele ali.

## A tensão, declarada

O módulo tem uma regra documentada (C1 / Apêndice A#1 da ARQUITETURA.md, citada
no cabeçalho de `ConfirmationCard.tsx`):

> o card de proposta é READ-ONLY. **Nunca formulário.** Corrigir NUNCA abre um
> campo: os chips reabrem o slot EM CONVERSA.

A razão não é estética: a **conversa é a fonte única**. O agente re-propõe os
params a partir do histórico a cada turno. Um editor que grave só no artefato
cria um segundo dono do mesmo valor, e o próximo turno sobrescreve a edição sem
avisar.

Esta feature abre a exceção **de propósito**, com a condição que a torna segura:
toda edição visual **volta para a conversa**.

## Decisão

Editar no nó, e a conversa registra. Ao aplicar:

1. o artefato é **regerado** já com os valores novos;
2. uma **mensagem do usuário** entra no histórico dizendo o que mudou
   ("Muda o título da capa para: …");
3. **nenhum turno de IA é disparado** — a mensagem existe para que o PRÓXIMO
   turno enxergue a decisão. Disparar um turno aqui gastaria tokens para
   reconfirmar algo que o engenheiro acabou de decidir.

Se o agente, num turno seguinte, propuser algo diferente, o card entra em
**ALTERAÇÃO PENDENTE** — o conflito fica visível em vez de silencioso. É a mesma
mecânica que já existe.

## O que é editável, por tipo de nó

| Nó | Campos |
|---|---|
| **Capa** | título (multilinha), volume, nº de tomos, tomo inicial, prefeitura (lista), mês/ano |
| **LD** | título (multilinha), nº de tomos, tomo inicial |
| **Separatriz** | título em **somente leitura** — herda o da capa; editar ali criaria a divergência que a herança resolveu |
| **Volume** | nada — é derivado das partes |
| **Pranchas** | nada — entrada somente leitura |

## Arquitetura

**`EditorDoNo`** — popover ancorado no nó selecionado, reusando o primitivo
`AgentPopover` que já existe. Campos conforme a tabela; título em `textarea`
(tem parágrafos). Botões: **Aplicar** e **Cancelar**.

**Aplicar** chama uma função por tipo (`aplicarCapa`, `aplicarLd`) que:
faz o `post*` correspondente com os params novos → `saveResult` com o mesmo
`artifactId` (substitui no lugar) → `appendMessage` de papel `user` com a frase
da mudança.

**O texto da mensagem é gerado por uma função PURA e testável**: dados os params
antigos e os novos, devolve a frase que descreve exatamente o que mudou. É a
peça que garante que o histórico não minta — se a frase divergir da alteração, o
próximo turno do agente decide errado.

## O perigo: mudar o número de tomos

Trocar `numTomos` **recria o conjunto de artefatos**: os ids carregam o tomo
(`capa:017:t02`), então 2 → 3 tomos muda todos, e os documentos já gerados viram
"fora da divisão".

Por isso, esse campo específico:

- pede **confirmação explícita** no editor, dizendo quantos artefatos ficarão
  órfãos ("3 documentos já gerados vão sair da divisão");
- **não regenera nada sozinho** — só registra a decisão na conversa e deixa os
  cards novos aparecerem. Regerar N documentos sem o engenheiro pedir seria
  gastar IA e tempo por uma tecla apertada sem querer.

Os demais campos (título, volume, mês, prefeitura) regeneram na hora: são
baratos, reversíveis e não mudam a identidade de nada.

## Degradação

| Situação | Comportamento |
|---|---|
| Artefato sem `payload` (gerado antes disto) | O editor abre com os campos vazios e avisa que não conhece os params originais; aplicar grava os novos |
| Geração falha ao aplicar | Mensagem de erro no próprio popover; nada é gravado e a mensagem não entra no histórico |
| Prefeituras ainda carregando | O campo aparece desabilitado, com os demais utilizáveis |

## Testes

Puros, no padrão `scripts/test-nexo-*.ts`:

- **frase da mudança**: um campo alterado gera a frase daquele campo; vários
  campos geram uma frase que cita todos; nada alterado devolve `null` (e então
  não se escreve no histórico).
- **título multilinha** entra na frase com as quebras preservadas.
- **números órfãos**: dado o nº de tomos antigo e o novo, quantos artefatos
  ficam fora da divisão (é o número que o aviso mostra).

A interação do popover não tem cobertura automatizada neste repositório.

## Riscos

**O maior é a frase mentir.** Se a mensagem gravada no histórico não descrever a
alteração real, o agente decide a partir de uma informação falsa — e o erro é
invisível, porque o artefato regerado está certo. Daí a função ser pura e
testada.

**O segundo é o editor virar o caminho padrão.** Se editar pelo nó ficar mais
cômodo que conversar, a conversa vira registro e o produto deixa de ser
chat-first sem ninguém ter decidido isso. Vale reavaliar depois de usar.
