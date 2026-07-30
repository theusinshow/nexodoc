> **Cópia de trabalho para a ferramenta de design.** Gerado em 2026-07-30 a
> partir de `docs/design-system-prompts.md` (commit bd93f83). A verdade é o
> repositório: se divergir, o arquivo de lá vence.
# Prompts para o Open Design

Um prompt mestre (contexto + regras) e nove prompts de lote. Cole o mestre
primeiro; depois um lote por vez. Pedir "gere o sistema inteiro" numa tacada
produz média, não sistema — e média é o oposto do que se quer aqui.

Cada prompt de lote repete os invariantes em uma linha, porque ferramenta perde
contexto entre sessões.

O inventário completo por trás destes prompts está em
[`design-system-briefing.md`](design-system-briefing.md); as regras, em
[`../DESIGN.md`](../DESIGN.md).

---

## PROMPT 0 — Contexto mestre (cole primeiro, em toda sessão nova)

```
Você é diretor de design de um sistema de design para o Nexo.

O PRODUTO
Nexo é o software de um escritório de engenharia civil brasileiro que produz a
documentação de projetos: lê o carimbo (selo) das pranchas em PDF e gera a Lista
de Documentos, as capas por prefeitura, as folhas separatrizes, monta o volume
final e audita o memorial descritivo contra o projeto. Quem usa é engenheiro
projetista, em sessões longas, com dezenas ou centenas de PDFs por projeto, sob
prazo de entrega para prefeitura. Um erro que passa vira volume impresso errado
entregue ao órgão público.

O produto é conversacional: o engenheiro solta os PDFs e conversa com um agente,
que propõe e gera os documentos. Toda geração é confirmada antes de acontecer.

NORTE CRIATIVO: "o instrumento calibrado, com um agente dentro"
Duas naturezas que convivem por território, nunca por mistura:
1. Instrumento de precisão. Linguagem de interface de terminal e de instrumento
   industrial de medição: escuro, contido, denso de informação, um único acento
   técnico. Cada pixel justifica o lugar. Cor é indicador funcional, nunca
   decoração. Tipografia impõe disciplina.
2. Um agente vivo. Existe uma presença aqui dentro — um orbe — e ela é a única
   coisa autorizada a respirar, brilhar e se mover continuamente.
A regra que resolve a tensão: o AMBIENTE pode respirar; o DADO nunca.

REJEITE (não negociável)
- Template de dashboard SaaS, cartões decorativos grandes, métrica-herói colorida.
- Gradiente roxo, azul ou neon. Texto com gradiente.
- Vidro/desfoque sobre qualquer dado (cartão, tabela, achado, documento).
- Ornamento sem função. Emoji na interface. Ilustração de estado vazio.
- Cartão dentro de cartão. Faixa lateral colorida como acento.
- Tom de marketing. Isto é ferramenta de trabalho, não landing page.

PALETA (fixa — use exatamente estes valores)
Interativo (só isto significa "clicável"): #00a693 technical-teal · #5bdac6
bright-teal · #7af7e1 luminous-teal
Status (só isto significa estado): #6ee7a3 ok · #e9b45c atenção · #ff9285 crítico
Ênfase (nunca status): #dc7858 rust-salmon · #ffb59e salmon-pink
Neutros: #0a0e11 fundo · #121518 painel · #06080a embutido · #1a1e21 elevado ·
#15191c secundário · #e1e7ea texto · #8e9ba3 texto secundário · #23282c borda ·
#2c3338 borda de campo

GRAMÁTICA DE COR (a regra mais importante do sistema)
As três famílias nunca se cruzam de significado:
- Teal = interativo. Sempre algo em que se pode agir. Nunca status, nunca
  decoração, nunca preenchimento passivo. Menos de 10% de qualquer tela.
- Os três sinais = status, e nada mais. Nunca em controle interativo. "Aprovado"
  é verde-menta, jamais teal, para nunca parecer clicável.
- Rust/salmão = ênfase. Nunca status, nunca fundo de página.

TIPOGRAFIA (fixa)
IBM Plex Sans para ler; IBM Plex Mono para dado estruturado — horário, nome de
arquivo, código, ID, contagem, rótulo de UI. Escala: display 40/600, headline
24/500, title 18/500, subtitle 16/500, body 14/400, caption 12/400; mono-label
12/500 com +0.05em, mono-data 13/400. Todo número é tabular.

GEOMETRIA E PROFUNDIDADE
Grade de 4px. Raio único de 8px (12px só no maior). Profundidade vem de camada
tonal e borda de 1px, não de sombra. Superfície elevada carrega um fio de luz
interno no topo (1px branco a 4%) — lê como usinagem, não como vidro. Sombra só
em elemento que flutua de verdade (dropdown, popover, modal).

A LINHA D'ÁGUA (regra do vidro)
Acima dela — o cromo — pode ter vidro (blur 12px, tint escuro a 62%): backdrop
de modal, dock do composer, wash da tela de boas-vindas, bolha do assistente,
cromo do visualizador de PDF, orbe. Lista fechada.
Abaixo dela — o dado — é sempre matte: cartões, tabelas, achados, molduras de
documento, caixas de confirmação. Nunca borrar o que se lê.

MOVIMENTO
Movimento significa mudança de estado, não decoração. 120ms para resposta de
interação, 180ms para revelação, 240ms para superfície grande, 320ms só para a
macrotransição do shell. Só transform e opacity. Sem coreografia de entrada por
elemento. Só o orbe se move continuamente.

IDIOMA: toda a interface é em português do Brasil.

Confirme que entendeu e aguarde o primeiro lote. Não gere nada ainda.
```

---

## PROMPT 1 — Fundamentos e tokens

```
LOTE 1 de 9: fundamentos.
Invariantes: gramática de cor (teal=interativo, 3 sinais=status, rust=ênfase),
linha d'água do vidro, grade 4px, raio 8px, escuro por padrão.

Gere as páginas de fundamento do sistema:

1. COR — a paleta fixa organizada pelas três famílias, cada valor com nome,
   token e o trabalho que faz. Mais QUATRO cores novas que não existem ainda,
   cada uma com valor proposto, fundo tingido correspondente e justificativa:
   a) informação / neutro-ativo — aviso que NÃO é status (hoje vira âmbar por
      falta de opção, e isso dilui o significado de "atenção");
   b) legado / congelado — telas antigas que ainda funcionam mas não devem ser
      usadas no dia a dia;
   c) disciplina — escala CATEGÓRICA de 8 passos para agrupar folhas de projeto,
      que não pode ser confundida com nenhum dos três sinais de status;
   d) dado — escala SEQUENCIAL de 5 passos para gráficos, que não pode ser a
      rampa teal (teal significa interativo).
   Entregue também a matriz de contraste texto/fundo (mínimo 4,5:1).

2. TIPOGRAFIA — os 8 estilos aplicados em texto real de engenharia (nome de
   obra, código de projeto "040-26", revisão, número de prancha "05/24").

3. ESPAÇAMENTO E GRADE — escala 4/8/12/16/24, densidade de tabela vs. cartão.

4. ELEVAÇÃO — os 5 níveis lado a lado, mostrando que a diferença é tonal:
   fundo #0a0e11, painel #121518, elevado #1a1e21, embutido #06080a, e a
   sobreposição flutuante (única com sombra). Mais o fio de luz no topo.

5. VIDRO — os tokens e a demonstração da linha d'água: a MESMA tela com o cromo
   em vidro e o dado matte, e o contra-exemplo do que é proibido (dado borrado).

6. MOVIMENTO — os quatro tempos e as duas curvas, com o que cada um veste.

7. ÍCONES — lucide, traço 1.5, nos tamanhos 14/16/20/24, e a regra de cor
   (teal só quando o ícone É a ação; cinza quando passivo; cor de sinal quando
   carrega status).
```

---

## PROMPT 2 — A marca: o orbe

```
LOTE 2 de 9: identidade.
Invariante: o orbe é a presença do agente e a única coisa viva do sistema. A
iridescência é SÓ teal → luminous → neutro. Nunca rust, roxo ou neon.

O orbe é uma esfera que representa o agente. Ele diz o que o agente está
fazendo — orbe que gira igual o tempo todo é decoração, e decoração este sistema
rejeita.

Gere:

1. A ESCADA DE REDUÇÕES — o mesmo objeto em três níveis, reconhecíveis entre si:
   a) vivo: esfera com profundidade e movimento, para o centro da tela (~200px);
   b) plano: redução em gradiente, para a barra lateral e uso inline (20-32px);
   c) achatado: silhueta vetorial sem brilho, que funciona em 16px, em preto e
      branco e sobre fundo claro — é dela que sai a logo.

2. OS SETE ESTADOS, cada um com uma leitura clara e distinta:
   idle (pronto) · dragging (arquivo sendo arrastado sobre a tela — atento,
   receptivo) · reading (lendo os carimbos das pranchas — trabalho de entrada) ·
   analyzing (pensando) · responding (escrevendo a resposta) · complete (pulso
   breve de 1,2s ao terminar) · error (instabilidade curta de 2,2s, depois
   estabiliza).
   Para cada um: como muda forma, brilho e movimento. E a versão CONGELADA de
   cada estado, para quem tem movimento reduzido ativado — precisa ser legível
   parada, não pode ser um piscar.

3. A LOGO — símbolo (orbe achatado) + a palavra "Nexo" em IBM Plex Sans 600.
   Lockup horizontal, versão empilhada, símbolo isolado, favicon 16/32/180,
   versão monocromática, versão para fundo claro, área de respiro, tamanho
   mínimo, e a lista do que não fazer.
```

---

## PROMPT 3 — Os 16 componentes base

```
LOTE 3 de 9: primitivos.
Invariantes: raio 8px, foco é sempre o MESMO anel (borda #5bdac6 + anel de 3px
a 25%), desabilitado é sempre 50% de opacidade, rótulo de botão em mono.

Gere cada componente com TODAS as variantes × OITO estados: repouso, hover,
foco (teclado), pressionado, selecionado, desabilitado, carregando, erro.
Componente sem os oito estados está incompleto.

1. Botão — variantes: primário (fundo teal sólido, texto escuro), destrutivo,
   contorno, secundário, fantasma. Tamanhos: 40px (padrão), 36px, 44px, só-ícone.
   Carregando: mantém a largura e troca o rótulo por spinner ("Gerando…").
2. Badge — default, secundário, contorno, e os três de status (ok, atenção,
   crítico) no padrão borda 30% + fundo tingido + texto na cor do sinal.
3. Chip (pílula) — variantes por INTENÇÃO, não por cor: "sugerido" (só um fio
   teal na borda), "comum", "silencioso".
4. Cartão — padrão, com cabeçalho, com divisores internos. Nunca aninhado.
5. Campo de texto — 40px e 32px, com prefixo/sufixo, com erro (borda coral +
   texto de ajuda crítico embaixo, nunca só a cor do anel mudando).
6. Área de texto · 7. Rótulo (sans e mono) · 8. Caixa de seleção (marcada,
   desmarcada, indeterminada) · 11. Separador · 13. Menu suspenso (item, item
   com ícone, destrutivo, separador, desabilitado).
9. Tabela — superfície primária deste produto: compacta por padrão, ~40px por
   linha, cabeçalho em mono maiúsculo fixo ao rolar, SÓ réguas horizontais (sem
   divisor vertical, sem zebra), coluna numérica à direita em mono tabular,
   status em badge. Mais: linha hover, linha selecionada, skeleton, tabela vazia.
10. Tooltip — quatro posições, atraso de 300ms. Obrigatório em todo botão
    só-ícone.
12. Skeleton — linha, bloco, cartão, linha de tabela, miniatura. Sempre na FORMA
    do que vai chegar; nunca um spinner no meio da tela.
14. Estado vazio — ensina a interface: um rótulo mono nomeando a região, uma
    linha explicando o que vai aparecer ali e como fazer aparecer, e no máximo
    uma ação. Sem ilustração, sem emoji.
15. Painel de vidro — tint padrão, tint fraco, e o fallback sólido.
16. Popover do agente — ancorado a um elemento, com formulário curto.
```

---

## PROMPT 4 — Os elementos do chat (o coração do produto)

```
LOTE 4 de 9: conversa. É a tela onde o engenheiro passa o dia.
Invariantes: a bolha do assistente pode ser vidro sutil como INVÓLUCRO, mas todo
dado dentro dela é matte. Chip nunca é formulário: é sempre uma ação de conversa.

ENTRADA
- Composer: duas variantes da mesma instância — HERÓI (centrado na tela de
  boas-vindas, com o orbe acima) e ANCORADO (rodapé, quando a conversa começou).
  Estados: vazio, digitando, com anexos, enviando, desabilitado, erro.
- Zona de solta: repouso, arrastando sobre a tela (overlay de tela cheia
  convidando a soltar), soltando, arquivo recusado.
- Chip de anexo: enfileirado, lendo (com progresso), lido, erro, papel corrigido
  à mão, removível. Um PDF de prancha mostra disciplina e número de folha.

CONVERSA
- Bolha do usuário: matte. Curta, longa, com anexos.
- Bolha do assistente: vidro sutil como invólucro. Escrevendo (streaming, com
  cursor), completa, cancelada, erro.
- Chips de resposta rápida: sugerido, comum, silencioso. Dois compromissos
  diferentes — um PREENCHE o campo para o engenheiro editar, outro ENVIA direto.

AS CAIXAS DE CONFIRMAÇÃO — o padrão central do produto
Fluxo: o agente propõe → os parâmetros aparecem SOMENTE PARA LEITURA → o
engenheiro confirma e o documento é gerado → aparecem os downloads. Corrigir
NUNCA abre formulário dentro da caixa: reabre a decisão na conversa.

Gere as peças compartilhadas (valem para todas as caixas): moldura com selo de
tomo, linha de resumo rótulo/valor (com a variante "faltando", em destaque),
chip de alterar, botão de confirmar (repouso, ocupado, "aplicar alteração"),
faixa de erro, bloco de downloads (com arquivo principal destacado).

E as SEIS caixas, cada uma em TRÊS estados — proposta (ainda não gerado),
PENDENTE (os parâmetros mudaram desde a geração: o documento na mão do
engenheiro está velho — este estado precisa gritar, é o erro mais caro que esta
tela pode cometer) e aplicado:
1. LD — título, nº de tomos, tomo inicial, e uma prévia das linhas da lista.
2. Capa — título, prefeitura, volume, tomos, mês, ano.
3. Separatriz — título herdado da capa, ou uma lista de disciplinas quando em lote.
4. Volume — uma linha por parte (capa, separatriz, LD, pranchas), na ordem, com
   contagem de páginas.
5. Conferência — veredito ok/atenção/crítico e a lista de achados.
6. Auditoria — nível (padrão ou profunda), memorial anexado, resultado resumido.

E o PLANO DE GERAÇÃO: a lista do que será gerado antes de confirmar em lote,
com cada linha em pendente, gerando, gerado ou falhou.
```

---

## PROMPT 5 — O canvas de artefatos

```
LOTE 5 de 9: canvas.
Contexto: depois de gerar, os documentos aparecem num quadro tipo FigJam. As
folhas (pranchas) são arrastadas entre fileiras para decidir a divisão em tomos.
Um projeto pode ter 200 folhas — o nó de folha é texto puro, sem miniatura, de
propósito.

Gere:
- Nó de artefato: com miniatura do PDF. Estados: repouso, selecionado,
  DESATUALIZADO (o parâmetro mudou depois de gerar), sem prévia, gerando.
- Miniatura: carregando (skeleton na forma final), renderizada, erro, sem PDF.
- Nó de folha: número da prancha e título. Estados: repouso, selecionado,
  corrigido à mão (marca discreta), sem número, não abrível.
- Rótulo de fileira (tomo).
- Ações do nó selecionado (abrir, corrigir), habilitadas e desabilitadas com o
  motivo visível.
- Editor do nó: popover com os campos, aviso quando a mudança tem custo
  ("3 documentos já gerados saem da divisão"), aplicar e cancelar.
- Navegação do canvas: ir entre tomos, criar tomo, voltar ao automático.
- Fileira: vazia, com folhas, recebendo um arraste.
- Seleção múltipla e arraste: marca de seleção, fantasma arrastado, alvo de solta.
```

---

## PROMPT 6 — Shell e navegação

```
LOTE 6 de 9: estrutura da tela.
Layout de três colunas: barra lateral 240px | palco (centro) | copiloto 520px,
com divisor arrastável.

Gere:
- Os DOIS modos do shell: BOAS-VINDAS (orbe grande centrado, composer herói,
  sem colunas laterais de trabalho) e ATIVO (as três colunas). E a transição
  entre eles (320ms) — é a única macrotransição do sistema.
- Barra lateral: marca (orbe pequeno + "Nexo"), botão de nova conversa, busca
  (vazia, com resultado, sem resultado), histórico agrupado em pastas por obra
  (aberta, fechada, item ativo, excluir), e o rodapé com Projetos, painel admin,
  conta e — por último e menor — "Ferramentas antigas".
- Copiloto: painel direito com o orbe e o estado do agente.
- Palco: vazio, com o canvas, com uma auditoria em curso.
- Auditoria em curso: progresso, etapa atual, tempo decorrido, cancelar, o aviso
  de "passou do tempo previsto", e a retomada depois que a página foi recarregada.
- Donut de consumo (tokens e custo).
- Divisor arrastável: repouso, hover, arrastando.
- Cabeçalho de aplicação: marca + módulo + rótulo de versão.
```

---

## PROMPT 7 — As telas

```
LOTE 7 de 9: telas completas, montadas com os componentes dos lotes anteriores.

- /nexo (a principal): boas-vindas · ativo com canvas · ativo com auditoria ·
  lendo os carimbos · erro · em tela estreita.
- /login: repouso, entrando, erro, sem permissão.
- /ferramentas: as telas antigas, com tratamento visual de "congelado" — precisam
  parecer legado sem parecer quebradas.
- /projetos e /projetos/[id]: lista (cheia, vazia, carregando) e o console do
  projeto com artefatos e eventos.
- /admin e as seis subpáginas (usuários, LDs, auditorias, consumo, qualidade,
  configuração): cada uma com tabela cheia, vazia e carregando.
```

---

## PROMPT 8 — A auditoria

```
LOTE 8 de 9: a superfície mais densa do produto.
Contexto: o software compara o memorial descritivo com o projeto e lista
incongruências. Cada achado tem severidade, evidência (o trecho onde está) e
ação sugerida. É o que o engenheiro lê com mais atenção — e o que mais precisa
de hierarquia.

Gere:
- Barra de progresso da análise: etapas, tempo, indeterminada.
- Cabeçalho do resultado: badge de status geral, resumo (achados, arquivos,
  tempo), a próxima ação como título, abas segmentadas.
- Grade de métricas: 2 a 4 cartões compactos.
- Cartão de achado, nas três severidades: UM contêiner com seções internas
  separadas por borda — evidência, conflito e ação como blocos adjacentes.
  Nunca cartões aninhados.
- Evidência: o trecho do documento com a marcação, e a versão exportável como
  imagem.
- Visualizador de PDF: o cromo (pode ter vidro), página, navegação, busca.
- Formulário curto de "o software não identificou este erro".
```

---

## PROMPT 9 — Estados transversais

```
LOTE 9 de 9: os estados que valem para toda tela. Entregue como página de
padrões, com um exemplo real de cada.

vazio · carregando (esqueleto na forma final, nunca spinner solto) · erro de
conteúdo · erro de campo · offline / servidor fora · sem permissão · sessão
expirada · movimento reduzido (o que congela) · transparência reduzida (o vidro
vira sólido).

Regra que atravessa todos: um estado vazio é NEUTRO e ensina o que vai aparecer
ali; uma falha usa o vocabulário do status crítico. Os dois nunca se parecem.
```

---

## Fechamento (cole ao final de cada lote)

```
Antes de entregar, confira cada item contra estes critérios:
1. Tem os oito estados (ou justifica por escrito os que não se aplicam).
2. Teal só em coisa interativa; os três sinais só em status; rust só em ênfase.
3. Vidro só no cromo da lista fechada; todo dado matte.
4. Contraste de texto ≥4,5:1, medido.
5. Comportamento definido em tela estreita.
6. Nenhum valor solto: só tokens de cor, tamanho, raio e duração.
7. Cada componente vem com um anti-exemplo ("não faça assim").
Devolva os tokens com o NOME EXATO das variáveis já usadas no código:
--status-ok, --status-warning, --status-critical, --glass-tint, --glass-blur,
--duration-fast/base/slow/shell, --ease-entrance, --ease-feedback,
--edge-highlight, --nexo-sidebar-w, --nexo-copilot-w.
```

