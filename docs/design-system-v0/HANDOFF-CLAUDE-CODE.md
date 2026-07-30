# Handoff — do sistema de design para o código

Este arquivo é o briefing do Claude Code. Copie a pasta inteira para
`docs/design-system-v0/` dentro do repositório e cole o prompt da seção 2.

---

## 1. O que veio junto

| Arquivo | O que é | Como o Claude Code usa |
|---|---|---|
| `index.html` | Visão geral, invariantes, os 7 critérios de fechamento | Ler primeiro. É o contrato. |
| `assets/nexo.css` | Todos os tokens com o **nome exato** de `app/globals.css`, mais os primitivos em CSS puro | Referência de valor. **Não** importar no app. |
| `assets/tokens-novos.css` | Os 19 tokens novos, em dois blocos prontos para colar | É o único arquivo que vira código diretamente. |
| `01-fundamentos.html` | Cor, tipografia, grade, elevação, vidro, movimento, ícones + matriz de contraste | Base de tudo. |
| `02-marca-orbe.html` | Orbe em 3 reduções × 7 estados + logo | Especificação para o R3F e para o SVG. |
| `03-componentes-base.html` | Os 16 primitivos × 8 estados | `components/ui/*` |
| `04-conversa.html` | Composer, bolhas, chips, as 6 caixas × 3 estados, plano de geração | O coração. Maior superfície de mudança. |
| `05-canvas.html` | Nós de artefato e de folha, fileiras, editor, navegação | O canvas. |
| `06-shell-navegacao.html` | Shell, sidebar, copiloto, divisor, auditoria em curso | `components/layout/*` |
| `07-telas.html` | As 19 telas nos estados listados | Conferência de montagem. |
| `08-auditoria.html` | Progresso, achados, evidência, visualizador, feedback | `components/audit-*` |
| `09-estados-transversais.html` | Os 9 estados que valem para toda tela | Conferência final. |

**Regra de precedência:** o repositório vence. Se um valor destas páginas divergir
de `app/globals.css` ou de `DESIGN.md`, o arquivo do repositório está certo e a
página está desatualizada — avise em vez de "corrigir" o código.

---

## 2. Prompt para colar no Claude Code

```
Leia docs/design-system-v0/index.html e docs/design-system-v0/01-fundamentos.html
antes de escrever qualquer linha.

Contexto: este é o sistema de design do Nexo, produzido a partir de
docs/open-design-kit/. Ele redesenha a EXECUÇÃO das regras já em produção, não
as regras. A paleta, a gramática de cor (teal=interativo, os 3 sinais=status,
rust=ênfase), a linha d'água do vidro, a família tipográfica, a grade de 4px e
o orbe como identidade NÃO estão abertos a mudança.

Faça o lote 1 e pare. Não siga para o lote 2 sem eu conferir.

LOTE 1 — tokens:
1. Abra docs/design-system-v0/assets/tokens-novos.css.
2. Cole o BLOCO A no fim do :root de app/globals.css, antes do }.
3. Cole o BLOCO B no fim do @theme inline, antes do }.
4. Não altere nenhum valor existente. Nenhum. O diff deve ser só de adição.
5. Rode o typecheck e o build. Me mostre o diff antes de commitar.

Critério de pronto: `git diff app/globals.css` mostra apenas linhas adicionadas,
e `bg-signal-info`, `text-legacy`, `border-discipline-arq` e `bg-data-3`
resolvem no Tailwind.
```

Depois de conferir, o lote seguinte:

```
LOTE 2 — aplicar --signal-info onde hoje é âmbar indevido.

Procure no código todo uso de --status-warning / text-warning / bg-warning e
classifique cada um contra a matriz de docs/design-system-v0/09-estados-transversais.html §2:

- continua ÂMBAR: documento envelheceu, sem conexão, passou do tempo previsto,
  sessão expirada, selo sem título.
- vira INFO: modo independente, "autosave pronto", retomada pós-F5, sem
  permissão, contexto do sistema, disciplina não anexada.

Me mostre a lista classificada ANTES de editar. Não troque nada que você não
tenha certeza — na dúvida, deixa em âmbar e me pergunta.
```

E daí em diante, um lote por vez, na ordem: 3 (primitivos) → 4 (conversa) →
5 (canvas) → 6 (shell) → 8 (auditoria) → 9 (transversais) → 7 (conferência das
telas montadas).

---

## 3. Os 7 critérios de fechamento

Cole no fim de cada lote. É a mesma lista de `docs/open-design-kit/02-lotes.md`.

```
Antes de dizer que terminou, confira:
1. Tem os oito estados (repouso, hover, foco, pressionado, selecionado,
   desabilitado, carregando, erro) — ou justifica por escrito os que não se aplicam.
2. Teal só em coisa interativa; os três sinais só em status; rust só em ênfase.
3. Vidro só no cromo da lista fechada; todo dado matte.
4. Contraste de texto ≥4,5:1, medido, não estimado.
5. Comportamento definido em tela estreita.
6. Nenhum valor solto: só tokens de cor, tamanho, raio e duração.
7. O anti-exemplo da folha correspondente não acontece no código.
```

---

## 4. O que este handoff NÃO resolve

- **O orbe vivo.** `02-marca-orbe.html` especifica cor, brilho e ritmo dos 7
  estados; a redução CSS é a prova de que os estados se distinguem. A execução
  em R3F continua sendo trabalho de código.
- **A logo em arquivo.** O SVG está inline nas páginas do lote 2. Extrair para
  `public/` e gerar os favicons 16/32/180 é uma tarefa à parte.
- **Nenhuma página foi vista renderizada.** Foram conferidas estaticamente.
  Abra `index.html` no navegador antes de tratar qualquer detalhe visual como
  decisão fechada.
