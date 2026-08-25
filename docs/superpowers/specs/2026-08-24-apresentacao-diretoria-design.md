# Apresentação do NexoDoc à diretoria — spec de conteúdo

Documento de conteúdo para a apresentação à diretoria da PROSUL. Define cada
slide, o texto real, a fonte de cada número e o que o apresentador narra em vez
de projetar. O Claude Design executa a partir daqui.

- **Plateia:** diretor do departamento (decide a compra) e subdiretores de cada
  disciplina (julgam a técnica).
- **Duração:** reunião aberta, sem tempo fixo. 18 slides + 2 folhas de reserva
  (plano B) + anexo destacável, em arquivo separado.
- **Objetivo:** obter um piloto pago de 3 meses.
- **Postura:** engenheiro mostrando trabalho, não vendedor. Nenhum adjetivo
  onde couber um número. Nenhum número sem fonte.

## Regra que governa o deck inteiro

Todo número exibido é medido, e a fonte fica escrita no próprio slide em texto
pequeno. Onde não há medição, a palavra **premissa** aparece na tela. Um único
número inventado, detectado por um diretor, derruba a credibilidade de todos os
outros — inclusive dos que estão certos.

**Duas cartas foram deliberadamente retiradas:**

1. Não existe "auditoria externa" corroborando os achados. A segunda opinião do
   `117-25` veio de outra IA. Chamar aquilo de auditoria externa não sobrevive à
   pergunta "quem auditou?". A palavra não aparece no deck.
2. Não se afirma recall ("acha X% dos erros"). Recall nunca foi medido em
   documento real. O que foi medido é ancoragem, falso positivo e depuração.

---

# BLOCO 1 — FUNCIONA (slides 1-4)

Abre pelo produto rodando. O enquadramento do problema vem depois, e vem mais
forte porque a sala já viu a coisa funcionar.

## Slide 1 — Capa

**Título:** NexoDoc
**Subtítulo:** Conferência documental para projetos de engenharia
**Rodapé:** Apresentação à diretoria · 2026 · Matheus Mendes

Sóbrio. Sem imagem de banco de dados, sem ilustração de robô, sem tagline.

## Slide 2 — O que é, em uma frase

**Frase central, tipografia grande:**

> Um sistema que lê memoriais descritivos em PDF e devolve uma lista de
> inconsistências — cada uma com a transcrição literal do trecho e a página
> onde ela está.

**Três fatos secos abaixo, em linha:**

- Lê o documento inteiro, não uma amostra.
- Não altera o documento. Só aponta.
- Não substitui revisão técnica. Aponta o que um revisor conferiria.

## Slide 3 — Demonstração ao vivo

Slide-âncora da demonstração. Na tela, só o título **"Ao vivo"** e o código do
projeto **117-25**. O conteúdo é a aplicação real, projetada.

**Roteiro da demonstração (notas do apresentador, não vão na tela):**

1. Abrir o NexoDoc autenticado.
2. Anexar `117_25_md_geral_a.pdf` — o memorial geral, 218 páginas, versão de
   outubro/2025.
3. Selecionar nível Profundo.
4. Executar. **Enquanto processa (~6 minutos), passar aos slides 5-8** — o bloco
   do problema. A espera vira conteúdo em vez de silêncio.
5. Voltar quando terminar e abrir o resultado.

**Plano B — FEITO em 24/08/2026.** O slide traz duas miniaturas das telas reais
da corrida de 18/08 (a mesma de 57 achados que o slide 4 declara), e as capturas
em tamanho de leitura vivem em **duas folhas de reserva no fim do deck**, `B1`
(Resumo) e `B2` (Achados) — alcançadas pela tecla `End`.

Ficam no fim, e não no meio, porque numa demonstração que funciona ninguém deve
passar por elas. Diferente do anexo de valor, chegar lá por acidente não custa
nada: é a saída do próprio produto.

As imagens são servidas por **rota autenticada** (`/apresentacao/plano-b/[arquivo]`),
nunca por `public/` — elas mostram o parecer de um projeto real, com transcrição
literal do memorial, e `public/` é aberto a qualquer pessoa com o endereço. Os
arquivos moram em `assets-privados/apresentacao/`, fora de `public/` e fora de
`docs/` (que o `.dockerignore` exclui, o que apagaria o plano B em produção).

Nunca demonstrar ao vivo sem rede.

## Slide 4 — O resultado bruto

Números grandes, sem comentário e sem adjetivo:

| | |
|---|---|
| Documento | Memorial geral 117-25 — UBS Vila Manaus, Criciúma/SC |
| Páginas | 218 |
| Achados | 57 |
| Tempo | 6 min 15 s |
| Custo da execução | US$ 1,49 |

*Fonte na tela, texto pequeno:* execução real de 18/08/2026, `auditId`
`58afd1b4`. Custo lido de `AiUsageEvent`, não estimado.

**Nota:** estes são os números da execução gravada. Se a execução ao vivo
devolver um total diferente, isso não é falha — é exatamente a variação que o
slide 12 declara, e reconhecê-la na hora reforça o slide seguinte em vez de
enfraquecê-lo.

---

# BLOCO 2 — O PROBLEMA (slides 5-8)

Roda enquanto a auditoria ao vivo processa.

## Slide 5 — Como a conferência acontece hoje

**Três linhas:**

- Cada projetista confere o próprio projeto.
- Não há tempo dedicado para isso.
- Quando acontece, leva de 1 a 2 horas por memorial.

**Frase de fechamento, destacada:**

> Isto não é um processo caro para substituir. É um controle que hoje não existe.

Essa frase é o eixo da apresentação. Ela impede que a conversa vire "quantas
horas você economiza", uma discussão que o NexoDoc perde e não precisa travar.

## Slide 6 — Por que escapa

**Duas causas, lado a lado:**

**Quem confere o próprio trabalho não enxerga o próprio erro.**
Não é falta de competência. É como a leitura funciona: relemos o que quisemos
escrever, não o que está escrito. Por isso revisão editorial é feita por outra
pessoa em qualquer editora do mundo.

**O memorial-padrão propaga o mesmo erro para todos os projetos.**
O texto-base é reaproveitado. Um defeito nele não erra um projeto: erra todos,
até que alguém o encontre.

## Slide 7 — Quando escapou

Slide quase mudo. Três linhas, muito espaço, tipografia grande:

> Projeto devolvido.
> Procuradoria acionada.
> Três responsáveis, três dias.

**O apresentador narra.** Sem detalhar quem, sem nomear disciplina. Todos na
sala sabem qual foi o caso — e é justamente o `117-25` que está rodando na tela
ao lado, na versão que foi devolvida.

## Slide 8 — A conta

**Coluna esquerda — a aritmética, com a palavra `premissa` visível:**

- 3 responsáveis × 3 dias × 8 h = **72 horas**
- Valor-hora de engenheiro *(premissa: R$ 80 a R$ 150)*
- **Custo direto: R$ 5.760 a R$ 10.800**

**Coluna direita — o que não entra na conta:**

- A confiança do cliente na entrega seguinte.
- A posição de quem apresentou o projeto.
- O nível percebido da empresa e dos profissionais.

*Nota na tela:* a faixa de valor-hora é premissa; substitua pelo número real da
PROSUL antes de apresentar, se preferir.

---

# BLOCO 3 — A PROVA (slides 9-12)

Retorna à demonstração ao vivo, agora concluída.

## Slide 9 — Os achados, por disciplina

O slide dos subdiretores. Cada linha traz a **transcrição literal** do memorial,
em fonte monoespaçada, com a página. Não se discute com uma citação literal.

| Disciplina | Achado | Trecho literal | Pág. |
|---|---|---|---|
| Elétrico | Unidade de espessura mil vezes menor que a real | "espessura de 0,254 microns" | 115 |
| Terraplenagem / Urbanização | Unidade dimensional incompatível com o perfil | "postes de aço de 60x40m altura 1,58m" | 47 |
| Terraplenagem / Urbanização | Espessura de tubo conflitante na mesma frase | "tubos de aço galvanizado ø 1'' 1/2 (e=3,81) com espessura de 3mm" | 49 |
| Arquitetura | Norma citada não trata do requisito exigido | sinalização de porta de vidro vinculada à "ABNT NBR ISO 9050:2022 — Determinação da transmissão de lu[minosidade]" | 74 |
| Hidrossanitário | Referência de outro município, sem justificativa | "Seguiram o cálculo conforme manual COMCAP." | 109 |
| Climatização | Premissa de ocupação divergente entre disciplinas | "1 sala de inalação atendendo 4 pessoas simultaneamente" × "Número de Pessoas : 3" | 12 e 195 |
| Geral / Documental | Texto de outro empreendimento dentro do memorial | "Por exigência do Shopping, todos os sistemas que atendem a loja deverão ser intertravados eletricamente" | 211 |

*Fonte na tela:* `docs/benchmarks/117-25/planilha-de-precisao.md`.

**A coluna Disciplina usa o RÓTULO do produto, não a chave da planilha.** A
planilha agrupa por chave interna (`terraplenagem`), e a regra dessa disciplina
casa `urbaniza` de propósito — `DISCIPLINE_LABELS` em `lib/audit-report.ts` a
exibe como "Terraplenagem / Urbanização". Copiar a chave para o slide faria um
subdiretor conferir a página 47 no capítulo de urbanização e achar divergência
onde não há. Conferido em 24/08/2026: não é defeito de classificação.

**Enquadramento obrigatório, escrito no slide:**

> Nenhum destes é erro de quem escreveu. São erros que sobrevivem porque
> ninguém, hoje, tem a tarefa de procurá-los.

## Slide 10 — Onze achados não são do projeto: são do modelo

**Fato central:**

Três defeitos aparecem em **texto idêntico** nos memoriais analisados:

- **Prevalência contratual contraditória — em 5 de 5 projetos.** A página 16 diz
  que os projetos prevalecem sobre as especificações; a página 20 diz o
  contrário.
- **Especificação de ferragens contraditória — em 3 de 3.**
- **Parágrafo repetido dentro do mesmo documento — em 3 de 3.**

**Consequência, destacada:**

> Consertar o memorial-padrão uma vez elimina os onze em todos os projetos
> futuros — e nos que já saíram.

**Linha de fechamento:** o texto corrigido já está redigido, em
`docs/correcoes-do-memorial-padrao.html`. Esse ganho independe de contrato.

## Slide 11 — Como sei que ele não inventa

A pergunta que o diretor vai fazer, respondida antes de ser feita. Três
medições, três colunas:

**1. A evidência existe no documento.**
Hospital 113-22, nível Profundo: **58 das 59 evidências** ancoram na página
declarada, com transcrição literal. Nenhuma inventada.

**2. Ele reconhece o próprio erro.**
Com falsos positivos plantados de propósito, a etapa de validação capturou
**4 de 4** — inclusive os que só se refutam lendo uma página distante do miolo.

**3. Eu caço os meus falsos positivos.**
Rodando todas as regras contra os 5 memoriais reais do acervo, o total caiu de
**41 para 23 achados**. Quatro classes de falso positivo foram lidas uma a uma e
corrigidas; uma regra inteira foi aposentada por estar errada.

*Fonte na tela:* `docs/analise-arquitetura-auditoria-2026-08-17.md`, seções 12.2
a 12.5.

**Nota do apresentador (narrada, não projetada):** houve um caso em que a
validação por IA contestou uma regra minha e estava certa — a cláusula que a
invalidava estava quarenta páginas adiante, e eu havia lido as ocorrências uma a
uma sem vê-la.

## Slide 12 — O que ele ainda não faz bem

Dito por você, antes de perguntarem. Este slide compra mais credibilidade que
qualquer outro do deck.

- **A lista varia entre execuções.** Três corridas do mesmo documento: 58, 57 e
  55 achados. O total é estável; os achados de borda entram e saem.
- **A precisão dos achados exclusivos ainda não foi julgada.** Ela depende do
  veredito de quem projeta. Ninguém além dos senhores pode dá-lo — e é
  exatamente isso que estou pedindo no piloto.
- **Não lê PDF escaneado.** Sem OCR, documento digitalizado como imagem não é
  auditado.
- **Não audita prancha.** Hoje o alvo é o memorial descritivo e a documentação
  de identidade do projeto.

---

# BLOCO 4 — COMO FUNCIONA (slides 13-15)

## Slide 13 — O caminho de um documento

O diagrama para leigo. **Não usar notação UML formal** — nem classes, nem
cardinalidade, nem losango. Três faixas horizontais empilhadas, lidas de cima
para baixo, cada uma com uma pergunta como título:

**Faixa 1 — O que a pessoa faz** *(3 caixas)*
`Escolhe o projeto` → `Anexa o PDF` → `Escolhe o nível: Padrão ou Profundo`

**Faixa 2 — O que o sistema faz** *(5 caixas, a faixa larga)*
`Extrai o texto e mapeia as páginas` → `Aplica as regras determinísticas` →
`Lê o documento com o modelo de IA` → `Uma segunda passada valida cada achado e
descarta o que não se sustenta` → `Monta o parecer com página e transcrição`

*Legenda sob a faixa 2:* regra determinística é conta e comparação — não
alucina, e a IA não pode apagá-la. A IA lê o que regra nenhuma alcança. A
validação é a etapa que remove achado sem sustentação.

**Faixa 3 — Onde o dado fica** *(3 caixas, e uma quarta em cor de alerta)*
`O parecer fica no banco` · `Os metadados do arquivo ficam` · `O custo de cada
execução fica registrado` · **`O PDF anexado NÃO é armazenado`**

A quarta caixa usa a cor de status crítico do sistema, invertida: aqui ela
marca uma decisão deliberada, não um erro. É o ponto que o diretor vai querer
ouvir.

## Slide 14 — O que já existe hoje

Seis módulos, em cartões. Cada um com uma linha do que faz e uma marca de
maturidade honesta:

| Módulo | O que faz | Estado |
|---|---|---|
| Conferência Documental | Audita memorial e documentos de identidade do projeto | Medido em projeto real |
| Montagem de LDs | Lê selos das pranchas e monta a Lista de Documentos, com ODT, PDF e ZIP | Piloto controlado documentado |
| Volumes | Confere e organiza a montagem dos volumes | Funcional |
| Capas | Gera capas com os dados do escritório | Funcional |
| Projetos | Pasta por centro de custo, histórico e fila de achados | Funcional |
| Painel administrativo | Usuários, uso de IA, custo por obra, qualidade | Funcional |

## Slide 15 — Controle e privacidade

O slide que responde "e se der problema?".

- **Nenhum PDF anexado é armazenado.** Decisão de projeto, não limitação. Para
  reprocessar, o arquivo é reenviado.
- **A chave de IA vive só no servidor.** Nunca chega ao navegador.
- **Acesso por login Google**, restrito a quem for autorizado; papéis de
  administrador e membro.
- **Cada execução registra provedor, modelo, tokens, custo e duração.** O painel
  mostra custo por obra.
- **Teto de gasto mensal configurável**, que recusa a chamada ao ser atingido.

---

# BLOCO 5 — O DINHEIRO (slides 16-17)

## Slide 16 — Quanto custa para ter

**Custo medido por execução** *(três corridas reais do 117-25, 18/08/2026)*:

| Corrida | Achados | Custo |
|---|---|---|
| 1 | 58 | US$ 0,91 |
| 2 | 57 | US$ 1,49 |
| 3 | 55 | US$ 1,45 |

**Projeção para o volume real da PROSUL:**

| Item | Base | Mensal |
|---|---|---|
| Auditoria profunda de memorial | 16 memoriais/mês × US$ 1,50 | US$ 24,00 |
| Montagem de LDs e volumes | frações de centavo por leitura de selo (US$ 0,0011 medido) | < US$ 1,00 |
| Infraestrutura | servidor (US$ 7) + banco (camada gratuita) | US$ 7,00 |
| **Total** | | **≈ US$ 32/mês ≈ R$ 170/mês** |

*Câmbio — premissa declarada na tela: R$ 5,50/US$. **Atualizar a cotação do dia
antes de apresentar**, e corrigir também o slide 17, que deriva dela.*

*Fonte na tela:* custos lidos de `AiUsageEvent`; volume mensal informado pela
diretoria (4 projetos × ~4 memoriais gerais).

## Slide 17 — A comparação

Duas barras, mesma escala. É o slide que decide.

- **Um ano de operação do NexoDoc:** ≈ US$ 384 (≈ R$ 2.046 na premissa de
  câmbio de R$ 5,30/US$).
- **Um único episódio como o que já aconteceu:** R$ 5.760 a R$ 10.800 em horas
  paradas — sem contar a devolução do projeto e o desgaste com o cliente.

**Frase de fechamento:**

> Mesmo na hipótese mais conservadora, o ano inteiro de operação cabe dentro de
> um terço de um episódio. E o episódio não custou só dinheiro.

A barra do episódio mostra a FAIXA: trecho sólido até R$ 5.760 (valor-hora de
R$ 80), hachurado até R$ 10.800 (R$ 150). A frase compara pela ponta
conservadora de propósito — ganhar com o número menor é ganhar sem discussão.

---

# BLOCO 6 — O PEDIDO (slide 18)

## Slide 18 — Piloto de 3 meses

**O que eu proponho:**

- **Escopo:** Conferência Documental, Montagem de LDs, Volumes e Capas.
- **Usuários:** a definir com a diretoria.
- **Duração:** 3 meses.

**O que eu entrego:** acesso, acompanhamento próximo, correção dos problemas que
aparecerem e o memorial-padrão corrigido.

**O que eu peço em troca — e é a peça que falta no produto:** que cada subdiretor
julgue os achados da própria disciplina como verdadeiro, duvidoso ou falso. A
planilha já existe e está pronta para receber esse veredito. É o julgamento de
vocês que transforma a única medida em aberto em número.

**Critérios de sucesso, escritos agora:**

- Nenhum achado com evidência inexistente no documento.
- Precisão dos achados exclusivos julgada por disciplina.
- LDs reais montadas sem perda de trabalho.
- Custo mensal dentro do projetado.

**Fechamento, com as palavras do próprio autor:**

> Se for ruim, não usamos. Se for bom, conversamos sobre valores.

---

# ANEXO DESTACÁVEL — A proposta

Slides separados do deck principal. O apresentador decide na hora se e quando
mostrar. **Não numerar em sequência com o deck** e não referenciá-los antes.

## Anexo A — Valor do piloto

Estrutura da proposta comercial dos 3 meses. **O valor em si fica em branco
neste documento** e é preenchido pelo autor antes de apresentar.

| Item | Conteúdo |
|---|---|
| Modalidade | Licença de uso durante o piloto |
| Prazo | 3 meses |
| Valor | *(a definir pelo autor)* |
| Inclui | Os quatro módulos, acompanhamento, correções e o memorial-padrão corrigido |
| Não inclui | Desenvolvimento de módulo novo sob demanda; OCR; auditoria de prancha |
| Ao fim dos 3 meses | Se não atender, encerra. Se atender, renovação negociada. |

## Anexo B — Propriedade

Uma linha, sem defensiva, sem justificativa longa:

> O NexoDoc é de autoria e propriedade de Matheus Mendes, desenvolvido fora do
> vínculo empregatício, em equipamento, tempo e licenças próprios. O que se
> propõe aqui é licença de uso.

---

# Onde o deck vive

**A rota `/apresentacao`, neste repositório, é a fonte única.**
`app/apresentacao/` traz o motor de slides (`palco.tsx`), o conteúdo
(`slides.tsx`) e o estilo (`palco.css`). A rota é fechada a **administrador** e
fica fora da barra lateral: o conteúdo cita um episódio real e lista achados por
disciplina, e projetista da PROSUL não deve tropeçar nele.

Teclado: `←` `→` (também `PageUp`/`PageDown` e espaço, que é o que um controle
remoto de sala emite), `Home`/`End`, `N` para as notas do apresentador, `F` para
tela cheia. `End` é também o atalho do plano B: as duas folhas de reserva são as
últimas do deck.

**O anexo NÃO está na rota** e não deve entrar. Ele vive no arquivo do Claude
Design (`Nexo - Anexo proposta.dc.html`), separado, e se abre por decisão de
quem apresenta.

## A terceira camada: a cópia que abre sem servidor

`npm run apresentacao:offline` serializa a página real num `.html` único, com a
marca e as capturas embutidas como `data:` URI e um motor de slides em
JavaScript comum — as mesmas teclas. Abre do disco, sem app, sem rede.

Sai da página REAL de propósito: o que vai no pen drive é o que foi ensaiado.
Uma segunda redação do mesmo conteúdo divergiria na primeira correção.

O gerador **se confere sozinho** antes de terminar: reabre o arquivo por
`file://`, exige as 20 folhas, navega com `End`, abre as notas e mede se o slide
cabe na janela. Se sobrar qualquer endereço de servidor, ele falha em vez de
entregar um arquivo que só se descobriria quebrado na emergência.

Não leva as fontes: sem internet, o IBM Plex cai para a do sistema. O deck
continua legível, e o próprio arquivo avisa isso no rodapé.

# Antes de apresentar — verificação

Nenhum destes é opcional. Cada um já derrubou uma apresentação de alguém.

- [ ] **Cotação do dólar do dia** substituída nos slides 16 e 17.
- [ ] **Valor-hora real da PROSUL** no slide 8, se preferir ao intervalo-premissa.
- [ ] **Ambiente de pé e testado no mesmo dia**, com o caminho exato da
      demonstração percorrido do início ao fim. Compilar limpo não é evidência
      de que roda.
- [x] ~~**Capturas de plano B** geradas e embutidas.~~ FEITO em 24/08/2026:
      miniaturas no slide 3, tamanho de leitura nas folhas `B1` e `B2` (tecla
      `End`). Vieram do parecer gravado, sem gastar uma chamada de IA nova.
- [ ] **`117_25_md_geral_a.pdf` na máquina**, na versão de outubro/2025 — a que
      foi devolvida, não a corrigida.
- [ ] **Teto de gasto do mês conferido**, para a demonstração não esbarrar nele
      na frente do diretor.
- [ ] **Anexo separado do deck principal**, em arquivo próprio, e nunca aberto
      por acidente.
- [ ] **Gerar a cópia offline e levá-la no pen drive:** `npm run apresentacao:offline`
      (com o `npm run dev` de pé) escreve um `.html` único de ~0,65 MB, que abre
      do disco sem servidor. Ele se confere sozinho antes de terminar. **Refazer
      sempre que um slide mudar** — a cópia é uma fotografia, não um espelho.

---

# Direção visual para o Claude Design

O deck usa a identidade do próprio produto, para que os slides e a
demonstração ao vivo pareçam a mesma coisa.

**Formato:** 16:9, tema escuro.

**Cores** *(de `DESIGN.md`)*:

- Fundo: `#0a0e11` · Superfície de cartão: `#121518` · Superfície elevada: `#1a1e21`
- Texto: `#e1e7ea` · Texto secundário: `#8e9ba3` · Bordas: `#23282c`
- Ação e destaque primário: `#00a693` (teal técnico) · realce: `#5bdac6`
- Status: OK `#6ee7a3` · atenção `#e9b45c` · crítico `#ff9285`

**Tipografia:** IBM Plex Sans para todo o texto; **IBM Plex Mono para toda
transcrição literal de memorial, código de projeto, página e valor monetário**.
A distinção tipográfica entre "o que o memorial diz" e "o que eu digo" é
funcional, não decorativa.

**Anti-referências:** sem gradiente exuberante, sem cartão colorido, sem ícone
decorativo, sem foto de banco de imagens, sem ilustração de robô ou de cérebro.
Nada que faça a apresentação parecer material de venda. A referência estética é
relatório técnico, não pitch deck.

**Densidade:** um argumento por slide. Os slides 7 e 17 são deliberadamente
vazios — o espaço em branco é o efeito.

**O palco não pode transbordar.** `transform: scale()` encolhe o desenho e não a
caixa; com `overflow: hidden` no contêiner, o navegador desiste de centralizar o
que não cabe e encosta no início. Medido em 1600x900 em 24/08/2026: o rodapé da
capa caía 23px abaixo da borda, em TODOS os slides, e nenhuma asserção de DOM
notava — o elemento existia, só não dava para vê-lo. A moldura
(`.ap-moldura`) recebe o tamanho já escalado e devolve a centralização. Há
asserção de caixa no gerador offline para impedir a volta.

**Diagrama do slide 13:** caixas retangulares, cantos levemente arredondados,
setas finas, sem sombra. Três faixas com fundo `#121518` e rótulo em mono sobre
a borda superior.
