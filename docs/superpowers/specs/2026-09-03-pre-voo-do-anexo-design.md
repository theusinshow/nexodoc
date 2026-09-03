# Pré-voo do anexo — decidir memorial ou prancha antes de ler

**Data:** 03/09/2026
**Origem:** o `114_19_VOLUME ÚNICO.pdf` foi anexado para auditar e o Nexo não
disse uma palavra (ver `2026-09-02-pagina-muda-design.md` e o commit `fa0c5ba`).
O aviso já entrou; o **roteamento** que produziu o silêncio continua igual.

## O fato

`isMemorialFile(nome)` é `parseFilename(nome).tipo === "memorial"`, e a partição
é binária: **memorial contra todo o resto**. Um arquivo que caia em `tipo:
"outro"` — nada reconhecido no nome — vai para o fluxo de prancha exatamente
como uma prancha vai. Ninguém olha o conteúdo antes de decidir.

Existe um classificador **por conteúdo** (`lib/audit-classify.ts`), e ele não
decide roteamento: só é chamado para extrair a identidade de algo que o nome já
disse ser memorial, e pela rota legada `/api/audit/classify`.

A rede de proteção é toda **depois do estrago**: `nao-e-prancha`
(`modules/nexo/lib/estado-do-anexo.ts`) só dispara quando as 31 páginas já
passaram pela leitura de selo e todas foram puladas.

## O acervo, medido

659 PDFs de `docs/`, tipo pelo nome (`parseFilename`):

```
prancha=520  separatriz=63  volume=33  capa=27  memorial=15  outro=1
```

Geometria e densidade de texto, por amostra de ~13 arquivos de cada tipo
(página 1 para as medidas de papel, média de caracteres das 3 primeiras):

| tipo (pelo nome) | maior lado | retrato | páginas | chars/página |
|---|---|---|---|---|
| memorial (n=15) | 842 | 15/15 | 11–258 | **1157–4590** |
| volume montado (n=17) | 842 | 17/17 | 13–42 | 198–**570** |
| capa (n=14) | 842 | 14/14 | 1 | 179–244 |
| separatriz (n=13) | 842 | 13/13 | 1 | 8–39 |
| prancha (n=13) | 842–3798 | 4/13 | 1–67 | 517–18848 |

**Há um vão limpo** entre o maior não-memorial (570 chars/pág) e o menor
memorial (1157).

### O que a medição revelou e eu não esperava

Os únicos arquivos em que a geometria acerta e **o nome erra** são os memoriais
do kit de erros plantados:

| arquivo | tipo pelo nome | é, de fato |
|---|---|---|
| `01-identidade-capa-x-corpo.pdf` | capa (a palavra "capa" no nome) | memorial, 67 págs, 5.533 chars/pág |
| `02-contratual-e-escopo.pdf` | prancha (o "02" virou folha) | memorial, 67 págs, 5.561 chars/pág |
| `06-capa-ilegivel.pdf` | capa | memorial, 52 págs, 5.487 chars/pág |
| `ESCOLA_JOSE_GIASSI_REV_A.pdf` | outro | memorial, 132 págs, 4.295 chars/pág |

No acervo de verdade a convenção acerta **656 de 659**. Ou seja: **o nome só
erra quando quem nomeou está fora da convenção do escritório** — que é
exatamente o arquivo que chega do cliente ou de outro escritório. É esse o caso
que este trabalho cobre, e é por isso que a convenção continua mandando onde ela
fala.

O único falso positivo da geometria no acervo é
`docs/security-audit/relatorio-auditoria-seguranca.pdf`: 18 páginas A4 de texto
corrido. Ele não é documento de projeto — a geometria diz "documento de texto",
não "memorial", e essa é a fronteira honesta da regra.

## Decisões

| Questão | Decisão |
|---|---|
| Quem manda quando nome e geometria discordam | **O nome é o palpite; a geometria pode contestar, mas nunca calada — discordou, pergunta** |
| Como a pergunta aparece | **Estado novo no chip do anexo**; o resto do lote segue |
| O que se lê no pré-voo | **Amostra espalhada** (primeira, meio, três quartos), não as 3 primeiras |
| Custo | **Zero IA.** Determinístico, no navegador, com o pdf.js que já está carregado |
| `parseFilename` | **Não muda.** A convenção segue autoritativa onde ela fala |

## Desenho

### 1. `modules/nexo/lib/pre-voo-do-anexo.ts` — os fatos

`medirAnexo(file): Promise<FatosDoAnexo>`, no cliente, com pdf.js:

```ts
interface FatosDoAnexo {
  paginas: number;
  maiorLado: number;        // pontos, da página 1
  retrato: boolean;
  charsPorPagina: number;   // média da amostra
  tintaMedia: number;       // só das folhas magras — distingue muda de vazia
  ancorasDeCarimbo: number; // da página 1
}
```

**Amostra espalhada, e não as 3 primeiras.** Um memorial que abre com capa +
sumário derruba a média das três primeiras, e o `116_25_md_ter_pav` já está no
fio da regra (1157 chars/pág, o menor do acervo). Primeira, meio e três quartos
custa o mesmo e não tem esse viés.

Tudo o que ele precisa já existe: `loadPdfjs` e `medirTinta`
(`pagina-muda-render.ts`), `acharCaixaDoSelo` (`server/nexo/selo-regiao.ts`).

**PDF que não abre não vira prancha.** Qualquer falha aqui devolve fatos
incompletos, e o julgamento cai em "não sei" — que pergunta. O modo de falha
antigo (assumir prancha em silêncio) é o defeito que este trabalho remove.

### 2. `modules/nexo/lib/papel-do-anexo.ts` — o julgamento

**PURO e sem imports**, como `estado-do-anexo.ts` e `attachments-core.ts` — roda
no node cru, e é aí que os limiares ficam prováveis sem navegador e sem banco.

```
papelPelaGeometria(fatos):
  âncoras de carimbo na p.1 ......................... "prancha"
  maiorLado > 900 (A3+) ou paisagem ................. "prancha"
  A4 retrato + >=10 páginas + >=1000 chars/pág ...... "memorial"
  A4 retrato + >=10 páginas + texto ~nulo + tinta ... "nao-sei"   <- o 114_19
  <=2 páginas + pouco texto ......................... "prancha"   (capa/separatriz)
  resto ............................................. "nao-sei"
```

A folha **muda** (texto desenhado) é o caso que a densidade não alcança: o
`114_19` tem 241 chars/página porque o texto virou curva vetorial. Chamar isso
de "não é memorial" repetiria o defeito de origem com outra roupa; chamar de
memorial adivinharia. Ele pergunta, e a `tinta` é o que separa essa folha da
folha realmente vazia.

E a precedência, numa função só:

| nome diz | geometria diz | resultado |
|---|---|---|
| memorial | qualquer | memorial |
| prancha / capa / volume / separatriz | o mesmo, ou não sei | segue o nome |
| prancha / capa / volume / separatriz | **memorial** | **indeciso** |
| outro | memorial ou prancha | segue a geometria |
| outro | não sei | indeciso |

`decidirPapel` devolve o papel **e o porquê** — a frase que o chip mostra. Sem
ela, o estado indeciso seria um alarme sem conteúdo, e o certo aqui é dizer o
fato medido: *"o nome diz prancha, mas são 67 folhas A4 de texto corrido"*.

**Os limiares desta seção são do sample (≈13 por tipo). O plano remede contra os
659 antes de travar qualquer número** — mesma disciplina do
`PISO_PARA_DESCONFIAR = 4`, cujas duas primeiras regras candidatas pareciam
óbvias e a medição derrubou.

### 3. O chip e o fluxo

`Attachment.papel` passa a aceitar `"indeciso"`, ao lado de `"memorial"` e
`"prancha"`.

Os chips aparecem **na hora**, pelo nome, como hoje — o pré-voo corrige em
seguida. Inverter isso (esperar a medição para desenhar) trocaria um chip que se
corrige em menos de um segundo por uma tela parada com oito PDFs invisíveis.

O indeciso **não é lido**: nem selo, nem auditoria. Os outros arquivos do lote
seguem normalmente. O botão de decidir é o `tratar como memorial / tratar como
prancha` que já existe ao lado do chip (`NexoChat.tsx:968`) — e é ele que
transforma a pergunta em resposta.

No fim do lote, o agente **nomeia quem ficou sem decisão**, no mesmo lugar e com
a mesma forma da mensagem de `arquivosQueNaoSaoPrancha`. Sem isso, um indeciso
num lote de oito é um chip âmbar que ninguém olha.

### 4. O que NÃO entra

- **IA no roteamento.** O pré-voo é determinístico e de graça. Visão é o último
  recurso da transcrição de folha muda, não da decisão de para onde vai o
  arquivo.
- **`parseFilename`.** A convenção não muda, não perde regra e não ganha regra.
- **`lib/audit-classify.ts` no caminho do Nexo.** Ele lê o documento inteiro no
  servidor para extrair identidade; o pré-voo precisa de quatro páginas no
  cliente, antes do upload. São perguntas diferentes.
- **O defeito anotado do `parsed.folha`** — já corrigido no commit `15859db`,
  não é escopo daqui.

## Provas

| Prova | O que trava |
|---|---|
| `npm run test:papel-do-anexo` (node cru) | a tabela de precedência inteira e cada limiar, com fatos de mentira |
| medição sobre os 659 PDFs de `docs/` | que os limiares escolhidos não têm falso positivo no acervo — e o número vai para o comentário do código |
| `scripts/test-nexo-attachments.ts` | que a partição existente não regrediu |
| navegador | o chip indeciso aparece, o lote continua, e o botão resolve |

## Riscos

- **Prancha escaneada em A4 retrato.** Sem texto e sem âncora de carimbo, cai em
  "não sei" e pergunta — o que é o comportamento certo, mas gera pergunta onde
  hoje há silêncio que funciona. A medição sobre os 659 dirá quantas são.
- **O pré-voo abre o PDF uma segunda vez.** `lerPranchas` abre logo depois. É o
  mesmo arquivo já em memória e o custo é de parse, não de rede; se a medição
  mostrar que pesa em lote grande, a saída é passar o `PDFDocumentProxy` adiante,
  não desistir do pré-voo.
