# Propostas de evolução UX/UI — Nexo

**Data:** 2026-08-13
**Status:** PROPOSTA PARA AVALIAÇÃO — nada aqui é decisão. Cada item deve ser
avaliado contra o código e o DESIGN.md antes de virar execução.
**Audiência:** Claude Code (estudo e execução) e o mantenedor (aprovação).
**Numeração:** os IDs (1.1–1.6, 2.1–2.29) são estáveis — o mantenedor aprova
itens pelo número.

## Como ler este documento

Cada proposta tem: **o quê**, **por quê**, **onde mora** (arquivos prováveis —
confirmar antes de tocar), **notas** (riscos, dependências, o que verificar) e
**aceite** (como saber que ficou pronto).

Leis que valem para TODAS as propostas (não repetidas item a item):

- DESIGN.md §12: mudança visual entra em `app/globals.css` **e** em `DESIGN.md`
  no mesmo commit. Token novo nasce com nome, valor e trabalho declarado.
- Teal é interativo e nada mais (<10% da tela). Status só pelos tokens
  `--status-ok|warning|critical` e `<Badge variant>`. Rust/salmão só ênfase.
- Vidro só no cromo da lista fechada (§4). Dado é sempre matte.
- Movimento: só `transform`/`opacity`, tokens de duração existentes, e
  `prefers-reduced-motion` sempre respeitado.
- Chanfro (superior esquerdo + inferior direito) via `.nx-cut-*` / `.nx-edge-*`;
  nunca `clip-path` à mão.
- Nada de emoji, nada de cartão dentro de cartão, nada de faixa lateral > 1px,
  nada de spinner parado em região de conteúdo (skeleton da forma final).
- Dado estruturado em IBM Plex Mono com algarismos tabulares.

## Diagnóstico que originou as propostas

1. **O gargalo do negócio é onboarding, não beleza.** Só o mantenedor operou o
   software sozinho em trabalho real. As propostas 2.3, 2.4, 2.5 e 2.12 atacam
   isso diretamente.
2. **O software não explica qual caminho tomar** (Nexo vs. ferramentas antigas).
   As propostas 1.1, 2.27 e 2.28 resolvem sem apagar nada.
3. **A promessa do produto é "evidência verificável", mas ela só aparece na
   auditoria.** As propostas 1.2 e 1.3 levam essa linguagem ao cartão de
   confirmação, onde acontece a decisão.
4. **Artefatos não atravessam máquinas** (storage não decidido). A 1.6 dá um
   tratamento digno enquanto isso.

---

# Parte 1 — Transversais (valem para o produto inteiro)

## 1.1 — Command palette (`Ctrl+K`)

- **O quê:** palette global que busca conversas, obras/projetos e ações
  ("montar volume", "auditar memorial", "abrir painel de custo", "gerar capa de
  Chapecó"), incluindo comandos que iniciam uma conversa do Nexo com a intenção
  preenchida. Substitui/engloba a busca atual da sidebar.
- **Por quê:** resolve "qual caminho eu tomo" sem redesenhar navegação; é o
  padrão de software de ferramenta premium (Linear, Vercel, Raycast). Maior
  salto de valor percebido por esforço.
- **Onde mora:** componente novo em `modules/nexo/components/` (ou
  `components/layout/` se servir fora do Nexo); integrar com o histórico de
  conversas (`conversation-store.tsx`) e com as rotas de `lib/modules`.
  Conflito potencial com atalhos existentes (`Ctrl+G/A/L`, `?` — ver
  `components/keyboard-shortcuts-help.tsx`): registrar `Ctrl+K` na ajuda.
- **Notas:** verificar se Radix/shadcn já tem `Command` no projeto
  (`components.json`, `components/ui/`) antes de escrever do zero. Ações destrutivas
  nunca na palette. Respeitar `prefers-reduced-motion` na entrada (180ms, escala
  + fade).
- **Aceite:** abre com `Ctrl+K` de qualquer tela; busca conversa por nome de
  obra; toda ação da palette também existe por mouse; ajuda de atalhos (`?`)
  atualizada.

## 1.2 — Proveniência como linguagem

- **O quê:** todo valor lido de um selo (número de folha, revisão, código do
  projeto, disciplina) carrega um marcador discreto; no hover, um tooltip diz a
  fonte: `lido da folha 07 · canto inferior direito`. Começa pelo cartão de
  confirmação e pelos nós do canvas.
- **Por quê:** transforma "a IA disse" em "conferi em 2 segundos". É a promessa
  central do produto (evidência verificável) finalmente visível na superfície
  onde se decide.
- **Onde mora:** `ConfirmationCard.tsx` (parâmetros somente-leitura),
  `FolhaNode.tsx`. A extração precisa já estar guardando origem por campo —
  **verificar primeiro** se a origem por campo existe no pipeline de leitura
  (`modules/nexo/lib/`, `server/`) ou se só existe por folha. Se não existir,
  essa proposta tem uma etapa de backend.
- **Notas:** marcador não pode poluir: um ponto/diamante de 6px em muted que
  acende no hover, nunca uma segunda linha de texto permanente. Ausência de
  origem (campo corrigido à mão) também é informação: `editado por você · 14:32`.
- **Aceite:** todo campo de cartão de confirmação gerado a partir de leitura
  mostra fonte no hover; campo manual mostra marca de edição manual.

## 1.3 — Confiança de extração por campo

- **O quê:** usar a calibração real (código 98%, revisão 87%, disciplina 98%)
  para marcar, no cartão de confirmação, os campos que historicamente merecem
  olho humano (revisão!). Sinal sutil, não status: um indicador muted com
  tooltip "este campo costuma precisar de conferência".
- **Por quê:** instrumento calibrado mostra a própria margem de erro. Honestidade
  de medição é o que separa ferramenta profissional de brinquedo — e reduz o erro
  mais provável sem alarmar os campos confiáveis.
- **Onde mora:** `ConfirmationCard.tsx`; as taxas vivem em
  `docs/07-testes-reais.md` / painel de qualidade (`app/admin/quality`) —
  verificar se existe fonte de dado consumível ou se a taxa entra como
  constante documentada por enquanto.
- **Notas:** NÃO usar `--status-warning` para isso — não é status, é informação.
  É exatamente a vaga "informação / neutro-ativo" do DESIGN.md §2: se esta
  proposta e a 2.9 forem aprovadas, a vaga de cor deve ser preenchida uma vez só
  e usada pelas duas.
- **Aceite:** campo "revisão" aparece com o indicador em todo cartão de
  proposta de LD; nenhum campo com taxa ≥97% mostra o indicador.

## 1.4 — Favicon vivo

- **O quê:** quando há auditoria ou geração em andamento em outra aba, o
  favicon ganha o ponto teal do orbe; volta ao estático ao concluir.
- **Por quê:** detalhe pequeno que faz o produto parecer habitado; sinal real de
  estado (não decoração).
- **Onde mora:** troca dinâmica de `<link rel="icon">` num client component do
  shell (`app/layout.tsx` ou `NexoShell`); estados vêm dos stores existentes
  (`auditoria-store.tsx`).
- **Notas:** o favicon com ponto é a redução SVG do orbe (§6 "escada de
  reduções") + indicador — desenhar como variação afinada, não um segundo
  desenho. Gerar os assets estaticamente e só alternar a referência.
- **Aceite:** com auditoria rodando e aba em segundo plano, o favicon muda; ao
  concluir ou cancelar, volta.

## 1.5 — Microcopy do ofício

- **O quê:** auditoria de vocabulário em toda a UI: o software fala "lote",
  "folha", "tomo", "conferência", "selo" — nunca "arquivo processado com
  sucesso" ou jargão de SaaS. Registrar o glossário em `DESIGN.md`.
- **Por quê:** software caro fala a língua de quem usa; consistência de termos é
  metade da sensação de "bem feito".
- **Onde mora:** varredura em `modules/nexo/components/`, `components/`,
  `app/**/page.tsx`; glossário novo em `DESIGN.md` (seção curta, junto às regras
  nomeadas).
- **Notas:** mudança de texto, não de layout — commit barato, revisão humana
  obrigatória (microcopy é voz do produto).
- **Aceite:** glossário existe no DESIGN.md; nenhuma string de UI usa
  "upload concluído", "processar arquivo" ou equivalentes fora do glossário.

## 1.6 — Artefato expirado digno + Regenerar

- **O quê:** quando os bytes de um artefato não existem nesta máquina, o cartão
  diz `artefato não disponível neste computador` e oferece **Regenerar** — que
  reroda a geração determinística com os mesmos parâmetros registrados na
  conversa.
- **Por quê:** a limitação de storage é conhecida e não decidida; hoje o
  usuário vê um cartão sem download e sem explicação. Como a geração é
  determinística (princípio 1 do produto), regenerar é quase grátis e
  transforma limitação em recurso.
- **Onde mora:** `ResultLinks.tsx`, `ConfirmationCard.tsx` (estado aplicado),
  `artifact-store.tsx`; verificar como a API de geração recebe parâmetros
  (`app/api/`) para expor o caminho de reexecução.
- **Notas:** regenerar NUNCA pode chamar IA de novo — só o gerador
  determinístico. Se os parâmetros não estiverem completos na conversa, o botão
  fica desabilitado com o motivo no tooltip (mesma regra do nó não-abrível,
  DESIGN.md §12 exceção 4).
- **Aceite:** artefato sem bytes mostra estado claro + Regenerar funcional;
  artefato com bytes inalterado.

---

# Parte 2 — Por tela

## Login

### 2.1 — O selo do próprio produto

- **O quê:** ao lado do formulário, um carimbo técnico renderizado com os dados
  do software: `NEXO · PLATAFORMA DOCUMENTAL · REV x.y · FOLHA 1/1`, data e
  horário local em mono. É a identidade do produto aplicada ao formato que ele
  produz.
- **Por quê:** o produto é sobre carimbos; a porta de entrada carimba a si
  mesma. Primeira impressão de domínio e craft.
- **Onde mora:** `app/login/page.tsx`; a ilustração atual do login é um dos três
  lugares do sistema com raio (DESIGN.md §"rounded") — decidir se o selo
  substitui ou coexiste.
- **Aceite:** login mostra o selo com dados reais (versão do build, data);
  nada de ilustração nova fora dessa.

### 2.2 — Fundo de gabarito

- **O quê:** linhas de margem de prancha A1 e cruzes de registro em 1px, 4–6%
  de opacidade, como fundo do login. Sem gradiente.
- **Onde mora:** `app/login/page.tsx` (já existe um padrão de grade no
  `app/page.tsx` legado — reutilizar a técnica, trocar o desenho).
- **Aceite:** textura lê como gabarito de prancha a 3 metros; contraste do
  formulário inalterado (≥4,5:1).

## Boas-vindas / primeira corrida (o gargalo real)

### 2.3 — Projeto de demonstração embutido

- **O quê:** um lote de exemplo versionado com o produto ("Residencial Aurora —
  12 pranchas + memorial"), acessível da tela de boas-vindas. A primeira
  conversa É o tutorial: leitura de selo → LD → capa → auditoria, em ~3
  minutos, sem arriscar obra real.
- **Por quê:** é a resposta direta ao maior problema conhecido — ninguém além
  do mantenedor operou sozinho. Tour de balões (`TourDoNexo.tsx`) explica; demo
  deixa fazer.
- **Onde mora:** assets em `docs/samples/` (verificar o que já existe lá!) ou
  `public/`; entrada em `SaudacaoDoNexo.tsx`; o modo demo já tem linguagem
  visual própria (rust/salmão é o acento de modo demo, DESIGN.md §2).
- **Notas:** checar `docs/samples/` antes de produzir PDFs novos. O demo deve
  rodar o pipeline REAL (sem mocks) — se for caro demais, limitar o lote a
  poucas folhas. Decidir se o TourDoNexo sobrevive ou é absorvido.
- **Aceite:** usuário novo conclui o fluxo completo sem intervenção; o modo demo
  é visualmente distinguível (rust) em todas as telas que toca.

### 2.4 — Checklist de ativação

- **O quê:** três passos com estado real na boas-vindas: `leu os selos de um
  projeto` → `gerou a primeira LD` → `rodou a primeira auditoria`. Some ao
  completar; dispensável.
- **Onde mora:** `SaudacaoDoNexo.tsx` / `NexoWorkspace.tsx` (modo boas-vindas);
  estado persistido por usuário (verificar schema Prisma — pode ser flag simples
  ou derivado do histórico real).
- **Notas:** derivar do histórico real quando possível (quem já usou não vê
  checklist). Não é cartão decorativo: cada passo é um botão que inicia a ação.
- **Aceite:** usuário zerado vê os 3 passos; cada um marca ao acontecer de
  verdade; usuário veterano nunca vê.

### 2.5 — Saudação com sugestões de partida

- **O quê:** três comandos na saudação ("Montar um volume", "Auditar um
  memorial", "Conferir uma LD") que abrem a conversa já pedindo o anexo certo.
- **Onde mora:** `SaudacaoDoNexo.tsx`, `QuickReplyChips.tsx` (reusar o padrão
  de chips "preencher/enviar").
- **Aceite:** clicar numa partida inicia a conversa com a instrução correta sem
  o usuário digitar nada.

## Barra lateral

### 2.6 — Trabalho em andamento visível

- **O quê:** conversa com auditoria/geração rodando mostra pulso discreto
  (`status-pulse`, 1,8s, já existe) no item da sidebar.
- **Onde mora:** `NexoSidebar.tsx` + `auditoria-store.tsx`.
- **Aceite:** dá para sair da conversa e voltar vendo que o trabalho continua;
  o pulso para ao concluir/cancelar.

### 2.7 — Saúde da obra na pasta

- **O quê:** cada pasta de obra mostra em mono pequeno o estado da última
  auditoria (`2 críticos · 12/08`) — apenas texto mono, sem ícone colorido.
- **Onde mora:** `NexoSidebar.tsx` (agrupamento por obra já existe); dado vem
  do histórico de auditorias (`app/api/`, Prisma).
- **Notas:** risco de estourar orçamento de cor — avaliar mostrar severidade só
  em texto (`2 críticos`) e não em badge. Verificar custo da query (N+1 por
  pasta).
- **Aceite:** pastas refletem a última auditoria sem query extra por render.

### 2.8 — Custo do mês no rodapé

- **O quê:** `R$ 14,20 · ago` em mono muted no rodapé da sidebar, linkando para
  `/admin/usage`. Só para quem tem papel de ver custo.
- **Onde mora:** `NexoSidebar.tsx`; dados de `app/admin/usage` /
  `use-conversation-usage.tsx`.
- **Aceite:** visível apenas para admin/dono; link funciona; zero cor de status.

## Copiloto

### 2.9 — Trace do agente

- **O quê:** linha mono de 11px acima de cada resposta do assistente:
  `leu 23 selos · 2 falharam · propôs LD · 8,4s`.
- **Por quê:** transparência de bastidor é o que faz engenheiro confiar em
  automação; registra na conversa o que o orbe só sinaliza ao vivo.
- **Onde mora:** `NexoChat.tsx` (bolha do assistente); os dados existem no
  pipeline do turno — verificar o que `session-reducer.ts` já registra por
  turno.
- **Notas:** candidata a usar a vaga de cor "informação / neutro-ativo" (§2) —
  mesma decisão da 1.3, resolver uma vez. Nunca mostrar internals de API; é
  linguagem de trabalho, não de debug (o `NexoDebugDrawer.tsx` já cobre debug).
- **Aceite:** toda resposta do assistente mostra o trace com dados reais do
  turno; turno simples ("olá") não mostra trace vazio.

### 2.10 — Diff no estado pendente

- **O quê:** o cartão pendente mostra campo a campo o que mudou desde a geração
  (`revisão: B → C`) e a ação única "Gerar de novo com estas correções".
- **Por quê:** o próprio DESIGN.md §8 define "documento velho passando por novo"
  como o erro mais caro da tela. Hoje o pendente é visível; o QUE envelheceu
  não é.
- **Onde mora:** `ConfirmationCard.tsx` (o componente já conhece os três
  estados e os params atuais vs. gerados — confirmar se o snapshot da geração
  está persistido; se não, persiste-lo é a etapa 1).
- **Aceite:** pendente lista exatamente os campos divergentes com antes/depois
  em mono tabular; o botão re-gera e move o cartão para aplicado.

### 2.11 — Recibo de recebimento

- **O quê:** após o drop, um cartão-lista na conversa: `200 recebidos · 198
  lidos · 2 falharam`, nomeando as falhas e o que fazer com cada uma.
- **Onde mora:** `NexoChat.tsx` / `ZonaDeSolta.tsx` (drop) + leitura
  (`BarraDeLeitura.tsx` já sinaliza falha no canvas — o recibo registra na
  conversa, onde fica o histórico).
- **Aceite:** todo drop gera recibo; falha nomeia o arquivo e o motivo em
  linguagem do ofício.

### 2.12 — Chips que conhecem o fluxo

- **O quê:** sugestões contextuais por etapa do volume: após gerar LD →
  "Conferir LD contra as pranchas", "Gerar a capa"; após capa → "Montar o
  volume". O produto diz qual é a próxima etapa.
- **Onde mora:** `QuickReplyChips.tsx` + estado da sessão
  (`session-reducer.ts` sabe o que já foi gerado).
- **Aceite:** os chips mudam conforme o que já existe na sessão; nunca oferecem
  etapa já concluída.

## Palco — Canvas

### 2.13 — Minimapa

- **O quê:** `MiniMap` do xyflow estilizado no tema (matte, borda 1px, sem
  vidro), canto inferior do canvas.
- **Onde mora:** `NexoCanvas.tsx`.
- **Aceite:** com 200 nós, o mapa reflete fileiras e seleção; clique navega.

### 2.14 — Zoom semântico

- **O quê:** três densidades conforme o zoom — longe: fileiras de tomo com
  contagens; médio: número da folha + revisão; perto: todos os campos do selo.
- **Por quê:** é a linguagem de instrumento aplicada ao canvas; resolve o
  problema de 200 folhas sem virar sopa de texto.
- **Onde mora:** `FolhaNode.tsx` + zoom do xyflow (`useViewport`); decidir os
  dois limiares de zoom como constantes nomeadas.
- **Notas:** performance: render condicional por nível, não CSS que esconde
  (200 nós × DOM oculto pesa). Manter a marca de "corrigido à mão" visível em
  todos os níveis.
- **Aceite:** os três níveis funcionam com 200 nós a 60fps de pan/zoom.

### 2.15 — Modo conferência (LD × canvas)

- **O quê:** a LD como coluna lateral sincronizada com o canvas: cada nó marcado
  conforme bate ou não com a linha da LD; clicar na linha seleciona o nó; clicar
  no nó rola a coluna.
- **Por quê:** a conferência deixa de ser relatório e vira gesto — é o trabalho
  que a prefeitura faz, oferecido antes dela.
- **Onde mora:** `NexoCanvas.tsx`, `BlocoDaLd.tsx`, `PlanoDeGeracao.tsx`
  (verificar onde a LD gerada vive na sessão). A comparação LD×pranchas já
  existe como "conferência leve" no backend (`modules/ld-interop/`,
  `modules/volume-builder/`) — reutilizar o resultado, não recomputar no
  cliente.
- **Notas:** candidata natural a estrear a vaga "disciplina (escala
  categórica)" do §2 para tingir fileiras — nunca colidir com os três sinais.
  Escopo: esta proposta é a coluna + sincronização; tingimento por disciplina é
  item separado se aprovado.
- **Aceite:** divergência LD×folha aparece no nó e na linha; navegação
  bidirecional funciona com 200 folhas.

### 2.16 — Navegação por teclado no canvas

- **O quê:** setas andam nó a nó (ordem de leitura: tomo, disciplina, folha),
  `E` abre o editor do nó, `Enter` abre o PDF naquela folha. Registrar na ajuda
  (`?`).
- **Onde mora:** `NexoCanvas.tsx`, `EditorDoNo.tsx`,
  `components/keyboard-shortcuts-help.tsx`.
- **Aceite:** conferir um lote inteiro sem tocar no mouse; foco visível no nó
  selecionado (anel único do sistema).

## Palco — Visor de PDF

### 2.17 — Modo selo

- **O quê:** abrir a folha já enquadrando o canto inferior direito (o carimbo) e
  navegar folha a folha (setas) mantendo o enquadramento.
- **Por quê:** confere-se o carimbo, não a prancha inteira; transforma a tarefa
  mais repetitiva no gesto mais rápido do software. Os commits recentes ("o
  visor abre onde o olho está") já apontam para cá — esta proposta é o destino.
- **Onde mora:** `components/audit-pdf-viewer-internal.tsx` e o visor do palco
  (verificar qual componente o Nexo usa — `PalcoDoNexo.tsx`). Enquadramento por
  porcentagem da página (canto inferior direito ~25%×~20%) com fallback para
  página inteira se a geometria falhar.
- **Aceite:** abrir qualquer folha pelo canvas/recibo cai no selo; setas mantêm
  o recorte entre folhas A1 e A0.

### 2.18 — Pins de achado na margem do PDF

- **O quê:** achados de auditoria como marcadores na régua/margem da página do
  visor, clicáveis para o cartão do achado (padrão de review do Figma).
- **Onde mora:** visor de PDF + `audit-result.tsx` (o parecer já tem página
  provável por achado — a posição vertical do pin deriva dela).
- **Aceite:** pin abre o achado correspondente; achado sem página provável não
  vira pin (ausência nunca é conflito — princípio 1).

## Auditoria (parecer)

### 2.19 — Delta entre auditorias no topo do parecer

- **O quê:** `desde 08/08: 2 críticos resolvidos · 1 novo · §4.2 reescrito` no
  cabeçalho do resultado, usando a impressão digital capítulo a capítulo já
  persistida (commits 19b5414, 0ccc275).
- **Por quê:** o escritório vende revisão; mostrar progresso entre revisões
  justifica rodar de novo e é o painel que o mantenedor abre para um cliente.
- **Onde mora:** `audit-result.tsx` + `use-delta-do-memorial.ts` (já existe!).
  Esta proposta pode ser quase só exibição — verificar o que o hook já entrega.
- **Aceite:** segunda auditoria do mesmo memorial mostra o delta; primeira
  auditoria não mostra nada (sem estado vazio constrangedor).

### 2.20 — Custo antes do Profundo

- **O quê:** ao selecionar o nível Profundo, mostrar estimativa `~R$ 3,40 · ~6
  min` antes de confirmar.
- **Por quê:** "decisão humana informada" é princípio do produto — aqui aplicado
  ao próprio software. Profundo "custa mais" sem número é ansiedade, não
  informação.
- **Onde mora:** seleção de nível (componente de chips/segmentado do modo de
  auditoria) + dados de `app/admin/usage` para calibrar a estimativa por tamanho
  de documento.
- **Notas:** estimativa honesta com "~" — melhor uma faixa certa que um número
  errado. Rust é a cor do modo Profundo ativo (§2), manter.
- **Aceite:** nenhuma execução Profunda começa sem o usuário ter visto custo e
  tempo estimados.

### 2.21 — Parecer impresso (PDF exportado)

- **O quê:** exportar o parecer em PDF com identidade própria: mono, chanfro,
  selo do produto no rodapé, sumário, achados com evidência e página.
- **Por quê:** o engenheiro entrega papel para o escritório; o papel é marketing
  ambulante do Nexo.
- **Onde mora:** `audit-result.tsx` + geração server-side (o projeto já tem
  pipeline ODT→PDF com LibreOffice — verificar `render-service/` e
  `modules/cover-generator/` para reusar o caminho).
- **Aceite:** o PDF exportado lê como peça do sistema (não como print de tela)
  e inclui evidência + ação recomendada por achado.

## Barra de leitura

### 2.22 — Índice do lote

- **O quê:** separadores visuais por disciplina na régua; tooltip por segmento
  (`folha 07 · estrutural · rev B`); clique seleciona o nó no canvas e abre o
  visor; playhead marcando a folha aberta.
- **Onde mora:** `BarraDeLeitura.tsx`.
- **Notas:** depende da escala categórica de disciplina (§2) se for tingir —
  sem a cor, separadores de 1px + tooltip já entregam o valor.
- **Aceite:** régua navega (não só mede); folha com falha continua assinalada e
  clicável.

## Orbe

### 2.23 — Estado "aguardando você"

- **O quê:** quando o agente pergunta e a resposta não vem em N segundos, pulso
  lento e longo; cessa ao primeiro caractere digitado.
- **Por quê:** hoje o orbe diz o que o agente faz; falta dizer quando a bola
  está com o humano — metade dos turnos deste produto.
- **Onde mora:** `agent-orb/` + `use-agent-state.ts` (adicionar estado na
  máquina, com prioridade abaixo de error/dragging/reading).
- **Notas:** cumprir a tabela de prioridade de estados do DESIGN.md §6; o novo
  estado entra na tabela (governança: CSS + DESIGN.md no mesmo commit).
- **Aceite:** pergunta sem resposta por N s → pulso; digitar ou interagir →
  volta ao estado real; reduced-motion congela legível.

## /admin

### 2.24 — Home de saúde (não métricas-herói)

- **O quê:** a home do admin vira uma tabela mono das últimas 24h: auditorias
  rodadas, taxa de falha de leitura de selo, custo, execuções por fluxo.
  Tabela, não cartões coloridos (DESIGN.md já proíbe métrica-herói).
- **Onde mora:** `app/admin/page.tsx`.
- **Aceite:** uma olhada responde "o motor está saudável?"; zero gráfico
  decorativo.

### 2.25 — Quality como funil de calibração

- **O quê:** taxa de falso positivo por regra de auditoria + meta explícita
  (ex.: revisão 87% → 95%), alimentada pelos feedbacks de achado (correto /
  falso positivo / gravidade).
- **Onde mora:** `app/admin/quality/` + o endpoint que registra feedback de
  achados.
- **Aceite:** cada regra mostra sua taxa e a meta; feedback novo muda o número.

### 2.26 — Custo por obra

- **O quê:** visão de custo agregada por projeto/obra (`Residencial Aurora ·
  R$ 31,80 · agosto`), não só por fluxo.
- **Onde mora:** `app/admin/usage/` — verificar se o registro de uso já carrega
  vínculo com obra/conversa (se não, é etapa de schema).
- **Aceite:** responde "quanto custa entregar um projeto?" sem planilha externa.

## Ferramentas antigas

### 2.27 — Preencher a vaga de cor "legado"

- **O quê:** ocupar a vaga aberta do DESIGN.md §2: um tom frio dessaturado para
  cabeçalhos das ferramentas antigas — "arquivado, funcional", nunca quebrado.
- **Onde mora:** `app/ferramentas/`, `app/ld/`, `app/capas/`,
  `app/separatrizes/`, `app/volumes/` + token novo em `globals.css` e DESIGN.md
  (mesmo commit, §12).
- **Aceite:** as quatro telas legadas compartilham o mesmo tratamento; o tom
  não é confundível com nenhum sinal a 3 metros.

### 2.28 — Banner com deep-link para o Nexo

- **O quê:** topo de cada ferramenta antiga: "Este fluxo agora acontece na
  conversa — **[Continuar no Nexo]**", e o botão abre o chat com a intenção
  preenchida ("quero gerar uma LD").
- **Por quê:** mata o problema "o software não explica qual caminho tomar" sem
  apagar as saídas de emergência.
- **Onde mora:** telas legadas + rota `/nexo` aceitando intenção inicial
  (verificar se já existe suporte a prompt inicial via query/param em
  `app/nexo/page.tsx` / `NexoWorkspace.tsx`; se não, essa é a etapa 1 e serve
  também às sugestões da 2.5).
- **Aceite:** cada ferramenta antiga leva ao Nexo com a conversa já iniciada no
  assunto certo.

## Projetos

### 2.29 — Página da obra como prontuário

- **O quê:** `/projetos/[id]` vira o prontuário da obra: linha do tempo (LD
  gerada, auditoria, volume montado), artefatos, pendências e próximo passo
  sugerido pelo agente.
- **Onde mora:** `app/projetos/[id]/` + dados de conversas/auditorias por obra.
- **Notas:** escopo grande — quebrar em fases (fase 1: linha do tempo +
  artefatos; fase 2: pendências e sugestão). Artefatos dependem da decisão de
  storage (mesma da 1.6).
- **Aceite (fase 1):** a página da obra conta o que já aconteceu com datas e
  links para as conversas/artefatos correspondentes.

---

# Parte 3 — Priorização sugerida

Ordem de execução recomendada (cada linha é independente o suficiente para virar
um PR):

| # | Proposta(s) | Justificativa |
|---|-------------|---------------|
| 1 | 2.3 + 2.4 + 2.5 | Onboarding: o gargalo do negócio. Demo + checklist + partidas. |
| 2 | 1.1 | Command palette: resolve "qual caminho tomar" e dá o salto de valor percebido. |
| 3 | 1.2 + 1.3 | Proveniência e confiança: a promessa do produto visível na superfície de decisão. Verificar antes se a origem por campo existe no pipeline. |
| 4 | 2.10 | Diff do pendente: o erro mais caro da tela, segundo o próprio DESIGN.md. |
| 5 | 2.17 | Modo selo: a tarefa mais repetitiva vira o gesto mais rápido. |
| 6 | 2.19 + 2.20 | Delta de auditorias + custo do Profundo: fecham o loop de valor da auditoria. |
| 7 | 1.6 | Artefato expirado digno: barato, remove uma vergonha conhecida. |
| 8 | 2.27 + 2.28 | Legado com cara de legado + ponte para o Nexo. |

Dependências mapeadas: 1.3 e 2.9 dividem a mesma decisão de cor (vaga
"informação" do §2) — resolver uma vez. 2.15 e 2.22 dependem (opcionalmente) da
vaga "disciplina". 2.29 fase 2 e 1.6 dependem da decisão de storage. 2.5 e 2.28
dependem do mesmo suporte a intenção inicial na rota `/nexo`.

## O que este documento NÃO propõe

- Nenhuma cor nova fora das quatro vagas já abertas no DESIGN.md §2.
- Nenhuma mudança de stack, de modelo de IA ou de pipeline de geração.
- Nenhum tema claro. Nenhum dashboard de métricas-herói. Nenhum emoji.
- Nada que viole os três princípios do produto (fato determinístico; afirma
  fatos e pergunta decisões; nada irreversível sem confirmação).
