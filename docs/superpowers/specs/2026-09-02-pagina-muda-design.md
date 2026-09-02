# Página muda — recuperar o texto que o PDF esconde

**Data:** 02/09/2026
**Origem:** o memorial `114_19_VOLUME ÚNICO.pdf` (Passarela do Canal da Barra, PMFlorianópolis)
passou pela auditoria e quase nada foi encontrado.

## O fato medido

31 páginas, **7.470 caracteres extraídos** — 241 por página. Um memorial desses
entrega ~60 mil. Chegaram ~10%.

- **16 páginas (52%) com ZERO caractere.** 25 de 31 (81%) com menos de 200.
- As páginas mudas **não são escaneadas**. Rasterizadas, elas são texto nítido,
  perfeitamente legível. O texto está desenhado, não escrito:

| Página | Como o texto está na folha |
|---|---|
| 1–4, 21–31 | `beginText`/`setFont` — texto de verdade, a parte que a auditoria leu |
| p5, p7 e afins | `constructPath=74`, **zero** `beginText` — o texto virou **curva vetorial** |
| p9 e afins | `paintImageXObject=24` — cada linha virou **tira de imagem** (944×92 px) |

Não é limitação do nosso extrator: o `pdftotext` (poppler) nas páginas 7–9
devolve três caracteres de quebra de página. **O texto não existe como texto no
arquivo.** Nenhum ajuste em `lib/pdf-text.ts` recupera isso.

A página 5 é a *Lista de Figuras* inteira. A página 23 é prancha de cálculo com
os rótulos em vetor. São conteúdo, não decoração.

## O segundo defeito, que é pior

`app/api/audit/route.ts:3264` calcula o denominador da cobertura assim:

```ts
caracteres_totais: args.file.extracted.text.length,
```

O denominador é a própria extração. Neste documento: **7.470 / 7.470 = 100%**.
`coberturaCompleta()` passou verde, `status_analise` saiu `"concluida"` e o
parecer não disse nada — numa auditoria que leu 10% do memorial.

É exatamente o que `lib/resumo-do-esforco.ts` existe para impedir, e ele não
alcança este caso porque **não sabe que a página existe se a página não deu
texto**.

Este item vale sozinho: mesmo recusando toda transcrição, o sistema para de
mentir.

## Decisões

| Questão | Decisão |
|---|---|
| Como recuperar | **Visão do modelo** (não OCR local, não ler o `.odt` de origem) |
| Quando disparar | **Sempre perguntar antes** — nada gasta sem aval |
| Ancoragem do achado | **Na página, e dizer** — sem coordenada, não grifa |

## Desenho

### 1. O detector — `lib/pagina-muda.ts`

Puro: sem IA, sem rede, sem I/O. Classifica cada página cruzando dois sinais que
a extração já tem na mão:

- caracteres extraídos da página;
- **tinta na folha**: nº de ops de desenho (`constructPath`) + de imagem
  (`paintImage*`).

| chars | tinta | classe |
|---|---|---|
| ≥ limiar | — | `texto` |
| < limiar | tem | **`muda`** — paga transcrição |
| < limiar | não tem | `vazia` — separador, não paga |

O segundo sinal é o que impede pagar por folha em branco.

**Limiar: 120 caracteres**, calibrado no 114-19 — separa limpo as 6 páginas de
texto real (359 … 3.350) das 25 mudas (0 … 59). O número medido fica no
comentário, ao lado da constante.

`extractPdfText` ganha um campo **opcional** por página (`tinta?`) — mesmo padrão
de `tabelas?`, então os ~30 consumidores e as fixtures não mudam uma linha.

### 2. O portão, na porta

A pergunta acontece **antes do upload**, não no meio da auditoria. Motivo: o
motor é SSE com cancelamento e retomada pós-F5; pausar no meio para esperar um
clique é uma máquina de estados nova. O cliente já tem os bytes do PDF (ele
POSTa via `FormData`) e o pdf.js já roda no navegador (`VisorDaFolha`), então a
detecção cabe no cliente, de graça.

> *25 das 31 páginas deste documento não têm texto: o conteúdo está desenhado,
> não escrito. Transcrever por visão custa ~US$ 0,07.*
> **[ Transcrever ]  [ Auditar assim mesmo ]**

### 3. O transcritor — `lib/transcricao-por-visao.ts` + rota

Rasterização **no navegador**. Não é preferência: não há canvas no Node aqui
(sem `node-canvas`, sem `sharp`), e o projeto já resolveu isso do mesmo jeito —
`modules/nexo/lib/selo-render.ts` é client-only por esse exato motivo.

O cliente renderiza a página muda, POSTa a imagem para
`/api/audit/transcrever-pagina`, a rota chama o modelo e devolve o texto.

- **Modelo:** `gpt-5.6-luna` (US$ 0,20 entrada / 1,20 saída por M). 25 páginas
  ≈ 37k in + 50k out ≈ **US$ 0,07**. Fluxo novo `audit-transcricao`, ajustável
  pelo painel admin como todos os outros.
- **Cache** por checksum do PDF + página + `VERSAO_DO_TRANSCRITOR`, no mesmo
  IndexedDB e no mesmo padrão de `modules/nexo/lib/selo-cache.ts`. A versão sobe
  quando o prompt ou o modelo mudam.
- O texto recuperado sobe junto no `FormData` como campo novo
  (`textoRecuperado`, JSON `{ arquivo, pagina, texto }[]`); o servidor funde em
  `extracted` logo após `extractPdfText`. Raio de alcance mínimo.
- A página fica marcada com `origem: "visao"`.

### 4. A cobertura que para de mentir

`CoberturaDoArquivo` ganha dois campos opcionais:

```ts
paginas_mudas?: number;       // detectadas, sem texto próprio
paginas_transcritas?: number; // recuperadas por visão
```

Sobrou página muda não transcrita → `coberturaCompleta()` é falso, o
`resumoDoEsforco()` diz quantas folhas ficaram de fora, `status_analise` vai a
`"parcial"` e o `parecer-em-papel.ts:153` imprime a tarja que já sabe imprimir.

`status_analise` hoje é a constante `"concluida"` em `route.ts:4292`. Passa a
ser derivado da cobertura de todos os arquivos.

Os campos são **opcionais** porque parecer antigo não os tem — e para ele nada
muda, que é o mesmo tratamento dado a `blocos_planejados`.

### 5. Ancoragem

Achado de página transcrita ancora na **página**, não no trecho. O cartão marca
"transcrito por visão" e o visor abre na página certa sem tentar grifar.

Regra dura: **o grifo não inventa coordenada.** Sem coordenada, não grifa.

## Fora de escopo (anotado, não construído)

- **Ler o `.odt`/`.doc` de origem.** Texto perfeito de graça — o rodapé do PDF
  entrega o caminho (`MD_114_19_PCB.doc`) — mas depende do fonte existir, e
  audita o que foi escrito, não o que foi entregue.
- Reescrever o PDF com camada de texto invisível.
- OCR local (Tesseract): erro de OCR em número, numa auditoria que confere
  número.

## Provas

| Prova | O que fecha | Custa IA? |
|---|---|---|
| `test:pagina-muda` | as 3 classes em fixture; inclui a p5 (0 chars **com** tinta = muda) e folha branca de verdade (= vazia) | não |
| `test:resumo-esforco` (estendido) | o caso 7.470/7.470: cobertura **não** é completa, status é parcial | não |
| `prova:pagina-muda` | corrida real no 114-19, medindo quantos caracteres voltam | sim, ~US$ 0,07 |
