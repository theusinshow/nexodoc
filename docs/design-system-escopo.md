# Design system do Nexo — escopo, inventário e direção

Levantado em 2026-07-30, lendo o que o projeto tem hoje. Serve de roteiro para
montar o sistema visual completo na ferramenta de design e para refatorar o que
já está em código.

## O ponto de partida (que não é zero)

O sistema **existe** e é melhor do que a média. O que falta não é criar: é
**reunir, completar e tornar visível**.

| Onde | O que tem | Estado |
| --- | --- | --- |
| `DESIGN.md` (397 linhas) | Famílias de cor com regra semântica, escala tipográfica, elevação, matriz de estados, specs de componente, iconografia | Escrito na era da auditoria — se intitula "NexoDoc Audit Workspace" |
| `docs/ui-references/ARQUITETURA.md` (46 KB) | Arquitetura da UI do Nexo: shell, composer, bolhas, vidro, primitivos novos | Cobre o Nexo, mas é doc de arquitetura, não de design |
| `app/globals.css` | 80 tokens executáveis (cor, raio, sombra, vidro, movimento, layout) | É a única verdade que o navegador obedece |
| `components/ui/` | 16 primitivos | Sem catálogo visual |
| `modules/nexo/components/` | 22 componentes compostos | Fora de qualquer spec de design |

**A consequência:** ninguém consegue VER o sistema. Para saber como é um badge de
status é preciso ler três arquivos. É por isso que a regra de status já foi
burlada à mão, e por isso que uma regra fora de `@layer` matou `border-*`
silenciosamente ([[nexodoc-css-cascade]]).

## A regra que decide tudo: fonte única

Este repositório já pagou caro por verdade duplicada — três cópias da regra do
nome de arquivo das separatrizes que discordavam entre si, duas listas de
módulos, capa e separatriz nomeando o mesmo documento de formas diferentes.

Um sistema de design numa ferramenta externa é **exatamente essa armadilha**, em
escala maior: um token que muda no desenho e não no CSS não é design system, é
ficção.

**A regra:** `app/globals.css` é a verdade. A ferramenta de design é onde o
sistema é **desenhado, visto e explorado**; quando uma decisão é tomada lá, ela
só existe de verdade depois de entrar no CSS e no `DESIGN.md`. Toda cor, raio,
sombra ou duração nova entra pelos dois lugares no mesmo commit.

## Direção visual: o orbe no centro

O orbe do agente deixa de ser um elemento da tela e passa a ser **a identidade**.
Hoje ele já existe em dois níveis, sem regra de quando usar cada um:

- `modules/nexo/components/agent-orb/` — orbe **completo**: React Three Fiber +
  shaders próprios, com estados de agente (`use-agent-state.ts`). ~26 KB de
  código + three.js.
- `agent-orb/OrbGlow.tsx` — redução em CSS (gradiente radial): fallback sem WebGL e placeholder do Canvas. (Era `NexoOrb.tsx`, apagado em 2026-08-13 — apesar do que esta linha dizia, ele não tinha um único uso; a marca da sidebar sempre foi o SVG estático.)

A direção pede uma **escada de reduções**, porque o orbe completo não cabe em
todo lugar (não existe favicon com shader):

1. **Orbe vivo (3D)** — palco/entrada. Presença, estado do agente, movimento.
2. **Orbe em CSS** — sidebar, bolhas, elementos inline. Mesma silhueta, custo zero.
3. **Orbe achatado (SVG)** — logo, favicon, impressão, fundo claro. Sem brilho,
   sem gradiente dependente de fundo escuro.

Cada nível precisa ser reconhecível como o mesmo objeto — é isso que transforma
um efeito bonito em marca. E o orbe centrado na entrada só funciona se ele
**disser algo**: parado = pronto; pulsando = pensando; deformado = trabalhando.
Um orbe que gira igual o tempo todo é decoração, e decoração o `DESIGN.md`
rejeita na primeira página.

## Cores: manter a gramática, ampliar o vocabulário

A força do sistema atual não são as cores, é a **regra**: teal = interativo,
os três sinais = status, rust/salmão = ênfase, e esses papéis nunca se cruzam.
Um teal é sempre algo em que se pode agir; nunca é um status.

Ampliar é bem-vindo — desde que cada cor nova **ganhe um trabalho**. Cor sem
função declarada é o que transforma sistema em paleta. Candidatos com trabalho
real hoje sem cor própria:

- **Informação/neutro-ativo** — avisos que não são status (dica, contexto do agente).
- **Legado/desativado** — as ferramentas antigas, o que está congelado.
- **Diferenciação de disciplina** — o canvas agrupa folhas por tomo/disciplina e
  hoje usa só borda; uma escala categórica resolveria (com a regra de nunca
  colidir com os sinais de status).
- **Escala de dado** — o donut de consumo e gráficos futuros precisam de uma
  rampa sequencial que não seja o teal interativo.

## A lista completa

### 1. Fundamentos (tokens)

- **Cor**: rampa teal (interativo) · 3 sinais (ok/warning/critical + fundos) ·
  rust/salmão (ênfase) · neutros e superfícies (`surface`, `panel`, `raised`,
  `recessed`, `tertiary`) · as cores novas acima, cada uma com seu papel escrito.
- **Tipografia**: IBM Plex Sans (display → headline → title → subtitle → body →
  caption) e IBM Plex Mono (dois eixos: rótulo e dado). Regra de quando é mono.
- **Raio**: `sm | md | lg | xl` e o que cada um veste.
- **Espaçamento**: a escala e as densidades (tabela densa vs. cartão).
- **Elevação**: camadas tonais + borda 1px + *edge highlight* (o brilho interno
  superior) + as duas sombras estruturais. Proibições: borda lateral, zebra.
- **Movimento**: `--duration-fast/base/slow/shell`, `--ease-entrance/feedback`.
  **Existe em código e não está documentado em lugar nenhum.**
- **Vidro**: `--glass-*` e a "linha de água" (moldura pode ter vidro; dado nunca).
  Hoje a regra vive como emenda escopada — precisa aparecer inteira num lugar só.
- **Layout**: larguras do shell (`--nexo-sidebar-w`, `--nexo-copilot-w`), grid,
  breakpoints.
- **Iconografia**: Lucide, tamanhos, peso, quando ícone sozinho é permitido.

### 2. Primitivos (os 16 que existem)

`button` · `badge` · `card` · `chip` · `checkbox` · `input` · `label` ·
`textarea` · `table` · `tooltip` · `separator` · `skeleton` · `dropdown` ·
`empty-state` · `glass-panel` · `agent-popover`

Cada um precisa de: variantes, tamanhos, **os sete estados da matriz** (repouso,
hover, foco, ativo, carregando, desabilitado, erro), exemplo de uso e
**anti-exemplo** — o "não faça assim" é o que impede o sistema de ser burlado.

### 3. Padrões compostos do Nexo (nada disso está especificado hoje)

- **Shell de três colunas** (sidebar | palco | copiloto) + splitter + estados
  welcome↔ativo.
- **Sidebar**: marca, nova conversa, busca, histórico em pastas por obra, rodapé
  de navegação.
- **Composer**: variantes hero e docked, anexos, envio, streaming, erro.
- **Bolhas de conversa**: usuário (matte) vs. assistente (vidro sutil).
- **Cartão de confirmação**: proposta → parâmetros somente-leitura → confirmar /
  corrigir → resultado com downloads. Inclui os três estados (proposta,
  pendente, aplicado) e o chip "alterar".
- **Chips de resposta rápida**.
- **Canvas**: nó de artefato (miniatura), nó de folha, fileiras de tomo,
  navegação, editor do nó, seleção e arraste.
- **Orbe**: os três níveis e os estados de agente.
- **Palco**: auditoria em curso, progresso, cancelar, retomada pós-F5.
- **Sobreposições**: drawer de detalhes, popover de configuração, dropdown de
  ações, modal (o único backdrop-blur permitido).
- **Consumo**: donut de tokens/custo.
- **Estados globais**: vazio, carregando (skeleton na forma final), erro,
  sem permissão, offline.

### 4. Superfícies herdadas

- **Resultado de auditoria**: achados, severidade, evidência, exportação. Já tem
  spec no `DESIGN.md` — precisa ser conferida contra o que a tela faz hoje.
- **Tabelas densas**: a LD e o histórico. Regra: ver muitas linhas de uma vez.
- **Ferramentas antigas**: precisam de um tratamento visual que diga "legado"
  sem parecer quebrado.

### 5. Conteúdo e voz

Não é enfeite: é o que faz a interface do agente ser confiável.

- "Afirma fatos, pergunta decisões" — o princípio do produto, ainda não escrito
  como regra de escrita.
- Rótulos e microcópia em pt-BR, sem jargão de software.
- Mensagens de erro que dizem o que fazer, não o que falhou.
- Como o agente admite que não sabe (o oposto de inventar um dado).

### 6. Acessibilidade

Anel de foco visível em tudo, contraste mínimo AA (inclusive sobre vidro), alvo
de toque, navegação por teclado e os atalhos existentes, `prefers-reduced-motion`
(o orbe precisa ter versão parada), `prefers-reduced-transparency`.

### 7. Marca

Símbolo (orbe achatado), lockup com a palavra "Nexo", favicon, tamanhos mínimos,
área de respiro, uso sobre fundo claro e escuro, e o que **não** fazer com o
orbe.

### 8. Governança

Como propor uma mudança, o checklist de revisão, e o que impede a divergência —
incluindo a lição do cascade CSS (regra fora de `@layer` vence as utilities e
mata `border-*` sem avisar).

## Contradições e lacunas achadas no caminho

1. O `DESIGN.md` se chama "NexoDoc Audit Workspace". O produto agora é o Nexo, o
   nome encurtou e a auditoria virou uma parte, não o todo.
2. A regra do vidro está partida: rejeição categórica na §1 e no final, emenda
   escopada no meio. Quem lê rápido conclui o oposto do que vale.
3. Movimento e larguras de layout existem em código e em nenhum documento.
4. Dois orbes, sem regra de qual usar onde.
5. Os 22 componentes do Nexo não têm spec — o módulo principal do produto é o
   menos especificado.

## Ordem sugerida

1. ~~**Unificar**~~ — **FEITO**. O `DESIGN.md` virou o documento único: nome novo,
   parte de design do `ARQUITETURA.md` absorvida (que agora aponta para ele), e
   as cinco contradições resolvidas — regra única do vidro ("linha d'água"),
   movimento e layout documentados, escada do orbe definida, componentes do Nexo
   especificados. As quatro vagas de cor entraram como vagas, sem valor: cor se
   decide vendo, não escolhendo no escuro.
2. **Fundamentos + orbe** — fechar tokens (incluindo as cores novas com papel) e
   a escada de reduções do orbe; daí sai a logo.
3. **Catálogo visual dos 16 primitivos**, com os sete estados.
4. **Padrões compostos do Nexo** — o maior bloco, e o que hoje não existe.
5. **Refatorar o código** para o que foi decidido, um primitivo por vez.
