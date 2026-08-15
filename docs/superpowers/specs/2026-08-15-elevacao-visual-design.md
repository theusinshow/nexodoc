# Elevação visual do NexoDoc — o instrumento fica premium sem virar vitrine

> Spec de design, 15/08/2026. Origem: pedido do mantenedor para elevar a
> percepção visual usando a biblioteca React Bits como matéria-prima.
> Alvo declarado: **software profissional de engenharia + interface de IA
> premium**, nunca "site chamativo sobre inteligência artificial".

## 0. O que esta spec decide

Ela não redesenha o produto. Ela escolhe **onde** o movimento e a luz entram,
**com que intensidade**, e **o que fica de fora** — com o motivo de cada recusa
escrito, porque recusa sem motivo volta na sessão seguinte.

Três decisões do mantenedor abrem o trabalho e não são reabertas aqui:

1. **Onde o efeito colidir com o DESIGN.md, o efeito entra e o documento muda** —
   no mesmo commit, como o §12 da governança exige. A identidade muda de
   propósito, não por descuido.
2. **As dependências entram**: `motion`, `ogl` e `gsap`.
3. **O orbe é refinado por dentro** — sem anéis novos. O que já existe fica mais
   expressivo dentro da lei da rampa teal.

## 1. A auditoria: o que já existia

Metade do pedido já estava construída, e melhor especificada que o pedido.

**A máquina de estados do agente existe.** `agent-orb.types.ts` define nove
estados com ordem de prioridade — `error, dragging, reading, responding,
analyzing, auditing, complete, waiting, idle` — e cada um tem expressão visual
documentada: varredura contínua para `auditing`, vaivém senoidal para `reading`,
batimento duplo para `error`, meia cadência de respiro para `waiting`, arco de
1px que fecha 360° como **fração das folhas lidas**.

A lista sugerida no pedido (`uploading`, `comparing`, `generating`, `success`,
`warning`) é menor e reintroduz o que o sistema removeu com motivo escrito:
`uploading` e `hover` saíram porque a máquina nunca os produziu, e "estado
inalcançável no enum é promessa que o produto não cumpre". **Fica como está.**

**O sistema de motion existe.** Tokens em `app/globals.css:113-119`
(`--duration-fast|base|slow|shell`, `--ease-feedback|entrance`) e espelho em JS
em `modules/nexo/lib/motion.ts`, com `prefersReducedMotion()`. O gate em JS não é
redundância: a media query CSS não desliga `startViewTransition` nem FLIP.

**O reduced-motion existe**, com reset global em `globals.css:378`.

Conclusão: a Etapa 2 do pedido ("preparar motion tokens, reduced-motion, estado
do agente") é sobretudo **ligar o que existe**, não construir de novo. O único
token novo que esta spec cria é o de intensidade (§3).

## 2. As quatro colisões, e como cada uma foi resolvida

| Pedido | Regra que ele quebra | Decisão |
|---|---|---|
| Gradient Text | §11 "Não use texto com gradiente" | **Entra em UM lugar só** — o nome *NexoAgent*, tratado como assinatura institucional. O §11 passa a dizer "só na assinatura do agente". Em heading comum continua proibido. |
| Magic Rings no orbe | §11 "Não coloque dois orbes vivos na mesma tela"; e o aro **é medida**, não enfeite | **Não entra em produção.** O mantenedor escolheu refinar o orbe por dentro. Fica disponível em `/bancada-do-orbe` se um dia quiser comparar. |
| Animated Content como base das microtransições | §5 "nunca em cascata pelos filhos" | **Entra como escada curta e limitada**: no máximo 5 filhos, 24ms de passo, só em lista recém-chegada. O §5 ganha essa exceção nomeada. Cascata em lista de 45 achados continua proibida — ela custaria 45×24ms = mais de um segundo até o último item. |
| Threads / Dot Grid como fundo | §4 linha d'água: "dado é sempre matte" | **Threads só no cromo** (boas-vindas, login, empty state grande). **Dot Grid entra também sob dado**, porque é estático: a linha d'água proíbe *borrão* sob o que se lê, e uma grade parada a 3% não borra nada. O §4 passa a distinguir fundo **animado** de fundo **estático**. |

A distinção do último item é a que sustenta o resto: **o que a linha d'água
protege é a legibilidade, não a ausência de textura.**

## 3. O sistema de intensidade

O pedido quer poder baixar a intensidade global depois sem caçar componentes.
Os tokens de duração e curva já fazem metade disso. Falta o **volume**.

Token novo, em `globals.css` e no **§5** do DESIGN.md. Não no §2: o `prova:tokens`
fiscaliza só as famílias de **vocabulário de cor** (`--status-`, `--signal-`,
`--legacy`, `--discipline-`, `--data-`, `--nexo-marca-`), e o próprio fiscal
explica por quê — "neutro, raio e duração são gramática; mudam sem mudar o que o
produto DIZ". Intensidade é gramática de movimento, e o §5 é a casa dela.

| Token | Valor | Trabalho |
|---|---|---|
| `--motion-gain` | `1` | Multiplicador global de intensidade decorativa: opacidade de fundo animado, alcance do ímã, brilho do spotlight. `0` desliga a decoração e **não toca** em nada funcional. |

Regra: `--motion-gain` governa só o que é **ambiente**. Feedback de interação
(hover, clique, foco) e sinal de estado (orbe, progresso) **nunca** dependem
dele — do contrário baixar a intensidade desligaria informação.

Sob `prefers-reduced-motion: reduce`, `--motion-gain` vai a `0` e o reset global
já existente cuida do resto.

## 4. O que entra, onde, e por quê

### P0 — alto impacto

**1. Spotlight nos cartões.** `audit-result.tsx` (achados), `painel-do-usuario.tsx`
(projetos), artefatos do Nexo. CSS puro com `--mx/--my` atualizados no
`pointermove`, sem estado React.

O detalhe que faz parecer nativo: **o brilho tem de ser recortado pelo chanfro**.
Os cartões usam `.nx-cut-*` / `.nx-edge-*`, e um radial-gradient retangular vaza
luz exatamente nos dois cantos cortados — que são a assinatura geométrica da
casa. O spotlight herda o mesmo `clip-path`, de um lugar só.

Degradação: `@media (hover: hover) and (pointer: fine)`. Em toque, não existe.

**2. Shiny Text no processamento.** As frases de trabalho em curso ganham um
brilho lento na rampa teal. Não é efeito cromado: é o mesmo gesto do
`skeleton-shimmer` que já existe (1,8s, `--ease-feedback`), aplicado a texto.

Isso resolve uma violação que já estava lá: `audit-progress.tsx:47` estaciona um
`Loader2 animate-spin` numa região de conteúdo, e o §11 diz "não estacione
spinner numa região de conteúdo; use esqueleto". O texto que brilha **é** o
indicador; o spinner sai.

**3. Dot Grid técnico.** Dropzone (`file-dropzone.tsx`), canvas de auditoria,
áreas de documento. Estático, `radial-gradient` repetido, ~3% de opacidade, custo
zero de runtime. É o item que mais entrega "CAD, coordenada, precisão" pelo menor
preço — foi promovido de P1 para P0 por isso.

**4. Threads no cromo.** Boas-vindas do Nexo (`nexo-shell--welcome`, que já tem
*wash* autorizado no §4), login, empty states grandes. Opacidade governada por
`--motion-gain`, e **reduzida quando há conteúdo na tela** — o pedido pede isso e
o §5 concorda: fundo animado atrás de trabalho é ruído.

**5. Escada de entrada curta.** Substitui a proposta de "Animated Content em
tudo". Onde uma lista chega inteira de uma vez (resultados, arquivos anexados),
os primeiros cinco itens entram com 24ms de passo. Do sexto em diante, todos
juntos. O `reveal` único continua sendo a regra para bloco isolado.

### P1 — refinamento

**6. Magnet em dois controles.** Alcance ≤2px, governado por `--motion-gain`.
Não pode brigar com o `translateY(1px)` do clique, que é o feedback canônico.

**7. True Focus nas etapas — com uma ressalva séria.** Ver §5 abaixo.

**8. Orbe por dentro.** Sem anéis. O trabalho é de expressão: intensidade e
cadência dos estados que já existem, dentro da lei que prende o orbe à rampa
teal.

### P2 — pontual

**9. Split Text** no título de boas-vindas, uma vez por sessão.
**10. Gradient Text** na assinatura *NexoAgent*, e em nenhum outro lugar.

### Recusado

**Strands.** Concorre com o orbe: `auditing` já tem varredura própria, e o §11
proíbe dois elementos vivos disputando a mesma leitura na mesma tela. Um feixe de
fios ao lado de uma esfera que já varre não acrescenta informação — divide
atenção.

**Hyperspeed, Galaxy, Lightning e equivalentes.** Fora da identidade. O pedido já
os excluía.

## 5. O problema do True Focus, que a auditoria descobriu

`components/audit-progress.tsx:17-35` decide a etapa exibida **pelo tempo
decorrido**:

```
seconds < 3   → "Recebendo PDFs e preparando leitura"
seconds < 8   → "Extraindo texto e identidade global"
seconds < 30  → "Auditando ..."
senão         → "Analisando blocos em paralelo"
```

Não é o estado do pipeline. É uma estimativa por cronômetro — e ela mente sempre
que o servidor sai do ritmo esperado.

Aplicar True Focus aqui **melhora a mentira**: um stepper elegante, com foco
deslizando de etapa em etapa, comunica "o sistema sabe em que passo está" com
muito mais autoridade do que uma linha de texto. Quanto melhor o desenho, pior a
promessa falsa.

Dois caminhos, e a escolha é do mantenedor:

- **(a) Ligar no estado real.** A rota de auditoria passa a emitir a etapa, e o
  True Focus mostra o que está acontecendo. É o caminho certo e custa trabalho de
  servidor, fora do escopo visual.
- **(b) Manter honesto.** O componente para de fingir etapas: mostra tempo
  decorrido e uma frase de fase aproximada, sem stepper. Ganha o Shiny Text (que
  comunica "trabalhando" sem afirmar posição no processo) e perde o spinner.

**Esta spec adota (b) como padrão** e deixa (a) registrado como o próximo passo
com valor real. Fazer o inverso — desenho de precisão sobre dado inventado — é
exatamente o oposto do que este produto vende.

## 6. Performance

- Um só canvas WebGL por tela. O orbe já ocupa esse lugar no palco do Nexo;
  portanto **Threads não roda junto com o orbe vivo** — ele existe nas telas onde
  o orbe está na redução em CSS.
- Fundo animado pausa fora da viewport (`IntersectionObserver`) e com a aba
  oculta (`visibilitychange`).
- `ogl` entra por `dynamic(ssr:false)` — o `react-pdf` já ensinou nesta base que
  `"use client"` não impede o Next de executar o módulo no SSR.
- Telas com muitos cartões: o spotlight é CSS com variável, sem re-render; a
  escada de entrada tem teto de 5.

## 7. Acessibilidade

- `prefers-reduced-motion: reduce` → `--motion-gain: 0`, fundo animado não monta,
  escada de entrada vira aparição única, ímã desligado. Feedback e estado
  permanecem.
- Nenhuma informação existe só no movimento. O orbe já obedece a isso; o
  Shiny Text acompanha o texto, não o substitui.
- Contraste: o brilho do spotlight soma luz sobre superfície escura e não pode
  baixar o contraste do texto — teto de opacidade verificado no cartão mais claro.

## 8. Como se fiscaliza

| Prova | O que passa a recusar |
|---|---|
| `prova:tokens` | `--motion-gain` sem verbete no §2 do DESIGN.md |
| `prova:glossario` | palavra de interface fora do léxico do §13 |
| nova, a criar | spotlight sem o `clip-path` do chanfro; fundo animado montado junto com orbe vivo |

O contrato visual — geometria, estado, contraste — continua sendo revisão
humana, e este documento é o que ela lê.
