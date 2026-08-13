# Roadmap da próxima sessão

Escrito em 13/08/2026, no fim da sessão da barra do topo.
Diagnóstico completo em [`2026-08-13-fila-de-tarefas-e-diagnostico.md`](./2026-08-13-fila-de-tarefas-e-diagnostico.md).

---

## Como abrir a sessão

Cole isto como primeira mensagem:

```
Leia docs/2026-08-13-roadmap-proxima-sessao.md e comece pela Etapa 1.
```

É só isso. O documento carrega o resto — o diagnóstico, as armadilhas e a ordem.
Se quiser começar por outra etapa, troque o número.

**Nome sugerido para a sessão:** `nexodoc — fila 1-10, etapa 1`

### Se você tiver o caso da auditoria perdida

Se até lá acontecer de novo de perder um parecer, abra assim:

```
Leia docs/2026-08-13-roadmap-proxima-sessao.md.
Perdi a auditoria da conversa "<TÍTULO DA CONVERSA>". Comece pela Etapa 0.
```

A Etapa 0 só existe se você tiver esse dado. Sem ele, ela não roda.

---

## Antes de qualquer coisa: as três regras desta base

1. **Reinicie o `next dev` antes de acreditar em falha de portão.** Um processo
   velho produz falhas consistentes e falsas — foi o que queimou a sessão
   passada. Sinal: corpo de 500 em HTML, `Jest worker ... exceeding retry limit`.
2. **Nunca `git add -A`.** Caminhos explícitos e `git diff --cached --stat`
   antes de commitar.
3. **Direto na `main`**, sem branch nem PR.

---

## Etapa 0 (condicional) — fechar o caso da auditoria perdida

**Só roda se houver o título/id de uma conversa que perdeu o parecer.**

- **Objetivo:** saber se o parecer está no Postgres e por que não voltou.
- **Primeiro movimento:** consultar `NexoConversation` por título, ver se
  `data.results[]` tem a auditoria com `payload.report`, e medir o tamanho do
  registro em bytes.
- **Hipótese principal:** o teto de 4 MB (`LIMITE_BYTES` em
  `server/nexo/conversa-remota.ts`) recusou o registro inteiro com 413, em
  silêncio. Se o registro passar de 4 MB, é isso.
- **Pronto quando:** a causa estiver nomeada. O conserto entra como etapa nova,
  não como remendo desta.
- **Não implementar a Tarefa 1 como escrita** — a auditoria já persiste em dois
  lugares; um terceiro caminho criaria mais uma verdade sobre o mesmo dado.

---

## Etapa 1 — Chat esticado (Tarefa 9)

- **Por que primeiro:** é layout puro. Não toca dado, nem IA, nem banco. Entrega
  visível no mesmo dia e sem risco de arrastar outra coisa junto.
- **Objetivo:** o painel do chat com altura contida, lista de mensagens rolando
  sozinha, input fixo no rodapé.
- **Primeiro movimento:** reproduzir no navegador e **medir a caixa** do painel
  contra a janela — asserção de DOM passa verde com elemento fora da tela.
- **Armadilhas já pagas nesta base:**
  - regra fora de `@layer` vence as utilities do Tailwind e mata `border-*` em
    silêncio;
  - no palco do Nexo o painel é estreito com a janela larga: `xl:` mente, usar
    `@container`.
- **Pronto quando:** existir um `scripts/prova-*.mjs` medindo a caixa, verde.

---

## Etapa 2 — Extração de texto e palavras partidas (Tarefa 2)

- **Por que segundo:** destrava a Tarefa 4. Calibrar o prompt de português antes
  de limpar a extração seria calibrar contra lixo.
- **Objetivo:** normalizar o texto pós-extração para juntar letras separadas por
  kerning ("r espingos", "d a pia", "P c D").
- **Primeiro movimento:** achar o ponto único de extração e conferir se a
  evidência salva no achado passa pelo mesmo caminho do texto enviado ao modelo.
  Se forem dois caminhos, normalizar no ponto comum, não nos dois.
- **Forma:** módulo puro em `modules/nexo/lib/` + teste em `scripts/` com os
  exemplos reais acima. O repo tem dezenas de moldes.
- **Cuidado:** normalização agressiva demais junta o que devia ficar separado
  (siglas, unidades, "P.C.D."). O teste precisa ter casos que **não** podem ser
  unidos.
- **Pronto quando:** o teste em node passar e a evidência num achado real sair
  legível.

---

## Etapa 3 — Granularidade dos erros de português (Tarefa 4)

- **Depende da Etapa 2.**
- **Duas coisas separadas, não confundir:**
  - **formato de saída** — hoje dezenas de ocorrências viram uma string corrida
    ("pág. 8...; pág. 23...; pág. 35..."). Cada uma tem de ser um achado com id,
    página, trecho e sugestão próprios;
  - **falsos positivos** — consequência da extração, resolvida na Etapa 2.
- **Mais o filtro de categoria** na UI: "Ortografia / Redação" separado de
  "Técnico / Incongruência".
- **Pronto quando:** um achado de português for navegável e resolvível
  individualmente.

---

## Etapa 4 — Disciplina pelo cabeçalho da folha (Tarefa 3)

- **Objetivo:** a disciplina do achado vem do cabeçalho da página onde o trecho
  está, não de inferência de contexto.
- **Princípio da casa:** isto é fato objetivo, portanto é **regra**, não IA.
- **Primeiro movimento:** conferir se a extração já segmenta por página antes de
  propor parser novo.
- **Pronto quando:** o achado carregar a disciplina da sua página no payload, com
  fallback só para página sem cabeçalho.

---

## Etapa 5 — Validação de achados (Tarefa 10)

- **Metade já existe:** `achadosResolvidos` por `auditId` e
  `marcarAchadoResolvido` no `conversation-store`.
- **Falta:** "procedente" e "falso positivo", o badge de estado, e a persistência
  no banco — hoje o resolvido vive só na conversa.
- **Primeiro movimento:** conferir se `AuditFeedback`
  (`prisma/schema.prisma:294-310`) e `app/api/audits/[id]/feedback/route.ts`
  servem, antes de criar tabela nova.
- **Pronto quando:** a decisão sobreviver a trocar de máquina.

---

## Etapa 6 — Matriz de severidade (Tarefa 8)

- **Aviso de histórico:** já houve uma rodada em que endurecer regra virou
  **esconder achado** — quatro regras que mandavam calar foram removidas em
  12/08/2026, e a decisão foi "reportar tudo e classificar por consequência".
  Apertar severidade não pode desfazer isso.
- **O que salva:** o campo `severity_reason` pedido na tarefa. Torna o critério
  auditável em vez de opaco.
- **Pronto quando:** houver um conjunto de achados conhecidos e a classificação
  bater com o gabarito — usar o kit de erros plantados.

---

## Etapa 7 — Visualizador de PDF (Tarefa 7)

- **Confira antes de construir.** `AuditResult` já recebe `pdfSources` e sabe
  abrir a página exata e grifar o trecho; o palco já passa o memorial retido
  (`PalcoDoNexo.tsx:52-68`).
- **Provavelmente falta só** a barra de zoom, a navegação por número de página e
  o modo de rolagem contínua — não um leitor novo.
- **Primeiro movimento:** abrir um achado no visor atual e listar o que falta de
  fato. Só depois decidir o tamanho do trabalho.

---

## Etapa 8 — Canvas como carro-chefe (Tarefa 6)

- **Por último de propósito:** é a maior, e várias das anteriores mudam o que ela
  mostra (disciplina da Etapa 4, estados da Etapa 5, granularidade da Etapa 3).
  Fazer o canvas antes seria refazê-lo depois.
- **A queixa de "achado aparece num e some no outro" precisa ser reproduzida
  antes de "unificar a fonte de dados"** — pode ser filtro, não divergência de
  estado. O canvas foi entregue no PR7 com pin, cards, pilhas e drawer.
- **Depois disso:** filtros por disciplina/gravidade/categoria e o polimento
  visual.

---

## Etapa 9 — Re-auditoria e diff entre versões (Tarefa 5)

- **Já existe base:** o delta do memorial (`prova:delta`) e a auditoria
  incremental. Conferir o que a etapa 2 do delta já entrega antes de desenhar
  versionamento novo.
- **Fica por último** porque depende de a persistência estar entendida (Etapa 0)
  — versionar em cima de um caminho de gravação mal compreendido é construir no
  escuro.

---

## Resumo da ordem

| # | Tarefa | Toca IA? | Toca banco? | Tamanho |
|---|---|---|---|---|
| 0 | Auditoria perdida (condicional) | não | leitura | pequeno |
| 1 | Chat esticado (T9) | não | não | pequeno |
| 2 | Extração de texto (T2) | não | não | médio |
| 3 | Granularidade português (T4) | sim | não | médio |
| 4 | Disciplina por cabeçalho (T3) | não | não | médio |
| 5 | Validação de achados (T10) | não | sim | médio |
| 6 | Matriz de severidade (T8) | sim | não | médio |
| 7 | Visualizador de PDF (T7) | não | não | a medir |
| 8 | Canvas (T6) | não | não | grande |
| 9 | Re-auditoria (T5) | sim | sim | grande |

Começar pelas que não tocam IA nem banco é deliberado: elas entregam sem custo de
token e sem risco de migração, e limpam o terreno para as que dependem delas.
