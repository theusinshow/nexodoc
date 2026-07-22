# Referências de UI — Frontend do Nexo (Fase 3)

Pasta-âncora para **acertar a arquitetura do frontend do Nexo** antes de construir.
Aqui juntamos referências de UI de chatbots/assistentes que gostamos, extraímos os
padrões, e **adaptamos** à fundação de design que já existe (não copiamos telas).

> Regra de ouro: referência inspira o **padrão** (layout, interação, hierarquia);
> a **execução** usa nossos tokens e primitivos. Ver "Fundação" abaixo.

## Como adicionar uma referência
1. Solte a imagem em [`chatbots/`](chatbots/) com nome descritivo em kebab-case:
   `chatgpt-empty-state.png`, `claude-artifact-split.png`, `perplexity-sources.png`.
2. Anote numa linha no índice abaixo (ferramenta • o que é bom • onde se aplica no Nexo).
3. Se for um fluxo (várias telas), prefixe: `01-`, `02-` para manter a ordem.

Formatos: PNG/JPG (screenshots) ou `.url.txt` com um link + 1 linha do porquê.

## Índice de referências
<!-- ferramenta — o que observar — aplicação no Nexo -->
- _(vazio — adicione as suas aqui)_

## O que extrair de cada referência
Para cada uma, olhamos:
- **Layout / reflow** — como o chat se posiciona (centralizado vs lateral), quando
  desloca, onde entram prévia e download.
- **Estados** — vazio (boas-vindas + sugestões), carregando/streaming, resultado,
  erro.
- **Entrada** — composer (anexos, chips de opção, atalhos), como pede arquivos.
- **Prévia / artefatos** — painel lateral, cards, preview renderizado, download.
- **Hierarquia e densidade** — tipografia, espaçamento, o que é primário.

---

## Fundação que já temos (adaptar, não recriar)
- [`DESIGN.md`](../../DESIGN.md) — princípios (raio 8px universal, tipografia, tokens).
- [`docs/09-design-system.md`](../09-design-system.md) — design system do produto.
- [`docs/05-interface-ui.md`](../05-interface-ui.md) — diretrizes de UI.
- **Primitivos** em [`components/ui/`](../../components/ui/): Button, Card, Badge,
  Input, Textarea, Dropdown, EmptyState, Table, Tooltip, Skeleton, Separator…
- **Nexo hoje**: `modules/nexo/components/` (NexoChat = cards de proposta;
  NexoWorkspace/SelosPanel = painel de teste). O reflow vai reorganizar isso.

## Arquitetura-alvo do frontend do Nexo (rascunho vivo)
O reflow que o engenheiro desenhou, em fases de tela:

1. **Boas-vindas (chat centralizado)** — mensagem inicial + chips de sugestão
   ("gerar LD + capa", "conferir volume", "auditar memorial").
2. **Coleta** — o chat pede os arquivos; dropzone/anexos no composer.
3. **Trabalho (split)** — o chat desloca pro lado; a **prévia renderizada** dos
   artefatos ocupa o centro enquanto processa (ler selos → propor → gerar).
4. **Entrega** — chat volta ao centro; painel lateral de **download** (LD, capa,
   separatriz, volume, relatório de auditoria).

**Fase 3 (encadeamento)** — a conversa orquestra o motor já pronto: ler selos →
LD + capa + separatriz → montar volume → auditoria, com confirmação nos pontos
irreversíveis. Inclui o **interleave multi-tomo** (capa+sep+LD+pranchas por tomo).

### Decisões de arquitetura (a preencher conforme decidirmos)
- [ ] Layout shell: como o split é montado (grid? painéis redimensionáveis?).
- [ ] Máquina de estados da conversa (fases acima) — onde mora (hook? store?).
- [ ] Prévia renderizada: viewer de PDF (usa o LibreOffice→PDF + render no client?).
- [ ] Composer: anexos + chips + atalhos.
- [ ] Reuso vs novo: o que herda de NexoChat/NexoWorkspace.

## Próximos passos
1. Você joga as referências em `chatbots/` e anota no índice.
2. Eu analiso, extraio os padrões e proponho a arquitetura (shell + estados +
   componentes), alinhada à fundação.
3. Fechada a arquitetura, construímos o reflow + a Fase 3.
