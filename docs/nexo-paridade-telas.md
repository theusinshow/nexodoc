# Paridade: o que as telas standalone editam e o Nexo não

Levantado em 2026-07-30, lendo o código das quatro telas e do Nexo. Serve para
decidir a ORDEM de remoção do plano de aposentar as telas standalone — passo 1
(persistência) fechado em `bc64c0a`, passo 2 é este, passo 3 é remover.

## O critério

Paridade **não** é copiar campo por campo. O Nexo deriva os fatos do carimbo de
propósito ("afirma fatos, pergunta decisões") — um formulário com 8 campos que
o selo já respondeu seria regressão, não paridade.

O critério é outro: **quando o carimbo mente, o engenheiro consegue corrigir sem
sair do Nexo?** Onde a resposta for "não", a tela standalone é a única saída — e
é isso, e só isso, que impede a remoção.

## O que o Nexo edita hoje

| Onde | Campos |
| --- | --- |
| Card da LD | Título, Nº de tomos, Tomo inicial |
| Card da capa | Título, Prefeitura, Volume, Nº de tomos, Tomo inicial, Mês, Ano |
| Card da separatriz | Título — **somente leitura** (herda da capa, de propósito) |
| Nó de folha (canvas) | Título/descrição da prancha; arrastar define tomo (`grupo`) e `ordem` |

`Ajuste` (`modules/nexo/lib/folhas.ts`) já tem `disciplina`, sem UI. A rota da
capa já aceita `secretaria`, sem UI.

## /ld — 5.265 linhas · distância MÉDIA

Seis passos: Importar PDFs · Dados da LD · Tabela de revisão · Ajuste de tomos ·
Resumo final · Arquivos gerados.

| A tela edita | O Nexo | Bloqueia? |
| --- | --- | --- |
| `sheet` (nº da prancha) por linha | não tem | **SIM** — é o campo com o pior histórico de OCR (os "vários 16", a inversão 16/05) |
| `file` (código da prancha, coluna ARQUIVOS) por linha | não tem | **SIM** — em PDF combinado o campo ARQUIVO às vezes não é lido |
| `description` por linha | tem (Corrigir no nó) | não |
| Adicionar / remover linha | não tem | **SIM** — prancha não lida não vira linha, e não há como criar à mão |
| Reprocessar UMA linha (re-OCR) | só relê tudo | não (contornável) |
| Ordenar por folha | arrasto no canvas | não |
| Total de referência + total manual | dominante do carimbo, sem override | **SIM** — é o que inventa "folhas faltando" |
| 8 campos de `LdData` (código, código exibido, disciplina, revisão, título, órgão, obra, fase) com rastro de origem | só o Título | parcial — os outros 7 vêm do selo; vira bloqueio quando o selo erra |
| Título/faixa por tomo (`Tomo.title/start/end`) | rótulo automático "TOMO n" + faixas por quantidade/arrasto | não |
| Modelo alternativo (.odt próprio) | `templateBase64` existe em `CreateLDInput`, nada envia | não (raro) |
| Autosave de rascunho, reabrir, duplicar | grava `LdDraft` ao gerar (b7abab2), sem rascunho contínuo | não |

**Essencial**: nº da prancha, código do arquivo, adicionar/remover folha, total
de referência. Os quatro cabem no mecanismo `Ajuste` + o popover "Corrigir" que
já existem.

## /capas — 1.932 linhas · distância MÉDIA

| A tela edita | O Nexo | Bloqueia? |
| --- | --- | --- |
| `GeneralData`: órgão, secretaria, obra, fase, código interno, código exibido, sigla do arquivo, revisão | derivados do selo + template | **SIM quando o selo erra** — hoje não há escape |
| Título, disciplina, volume por grupo | tem (um card por disciplina) | não |
| N grupos de capa numa tacada | um card por vez | não (o fluxo do Nexo é por disciplina, de propósito) |
| `tomoMode: "list"` — nomes de tomo explícitos | só quantidade + inicial | não (raro) |
| Prévia antes de gerar | gera e mostra | não |

## /separatrizes — 320 linhas · distância PEQUENA

| A tela edita | O Nexo | Bloqueia? |
| --- | --- | --- |
| Lista de títulos, um por linha = uma folha (+ DisciplineQuickPick) | UMA folha, título herdado da capa | **SIM** para volume multi-disciplina |
| Código e revisão do arquivo | nome fixo `separatriz.pdf` | **SIM** — o arquivo sai sem identidade |
| Saída ODT (editável) + PDF + ZIP | só PDF | **SIM** — sem ODT não dá para ajustar o texto no LibreOffice |

Três itens pequenos, todos no mesmo lugar. É a menor distância das quatro.

## /volumes — 3.823 linhas (componentes) · distância GRANDE

A `lib/` do volume-builder (1.843 linhas) **fica de qualquer jeito** — o Nexo
importa `buildRowPdf` dela. O que sairia é a mesa de montagem.

| A tela faz | O Nexo | Bloqueia? |
| --- | --- | --- |
| Metadados do volume (8 campos: código, projeto, cliente, cidade, nº do volume, tomo, revisão, data) | derivados | sim |
| Importar N PDFs → páginas classificadas → mandar página para capa/LD/documentos | recorta faixa de página pelo selo | **SIM** |
| Montar N volumes, cada um com blocos por disciplina | UM volume, uma disciplina | **SIM** |
| Sugestão automática de montagem | não tem | sim |
| Validação por IA da montagem | conferência leve (determinística, outra coisa) | parcial |
| Exportar PDFs + ZIP + relatório .md | um PDF | sim |

Não é um punhado de campos faltando: é outro produto. O Nexo monta o volume de
UMA disciplina a partir do que ele mesmo gerou; a mesa monta o projeto inteiro a
partir de PDFs soltos.

## Ordem recomendada

1. **/separatrizes** — 3 itens pequenos, todos numa tela só. Aposenta 320 linhas
   e prova o caminho de remoção com risco baixo.
2. **/ld** — 4 itens essenciais, todos no `Ajuste`/nó de folha que já existem.
   Maior ganho: 5.265 linhas, e é a tela que o plano já apontava.
3. **/capas** — 1 item (escape para os campos de identidade quando o selo erra).
4. **/volumes** — **não aposentar por ora.** A distância não é de paridade, é de
   escopo. Reavaliar só depois que o Nexo montar projeto multi-disciplina.

## Como isto foi levantado

Leitura direta de: `components/ld/ld-workspace.tsx` (steps, `LdData`,
`updateRow`, tomos, template), `modules/cover-generator/components/*`
(`StepGeneralData`, `StepCoverGroups`, tipos `GeneralData`/`CoverGroup`),
`modules/volume-builder/components/volume-builder-page.tsx` +
`volume-metadata-form.tsx`, `modules/separator-generator/components/SeparatorGeneratorFlow.tsx`;
e do lado do Nexo `modules/nexo/lib/editar-artefato.ts` (`camposDoArtefato`),
`modules/nexo/components/FolhaNode.tsx`, `modules/nexo/lib/folhas.ts` (`Ajuste`),
`modules/nexo/lib/generate.ts` (`LdOptions`/`CapaOptions`).
