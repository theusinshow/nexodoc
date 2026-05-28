# NexoDoc Audit Workspace - Design system

Este documento consolida as decisoes iniciais do design system do NexoDoc.

O objetivo e manter a experiencia principal em formato de chat, mas com uma estrutura visual de bancada tecnica para auditoria documental.

## 1. Direcao visual

O NexoDoc deve parecer uma ferramenta de trabalho para engenharia e auditoria documental, nao uma landing page. O painel inicial e um seletor operacional de modulos; o workspace de conferencia continua orientado a tarefa.

Direcao definida:

- SaaS tecnico e premium;
- tema dark;
- alta legibilidade;
- densidade moderada;
- geometria contida, com raio pequeno apenas onde ajuda toque e foco;
- acento verde-teal apenas para acao, estado e foco;
- status documental sempre visivel.

Nome interno do sistema visual:

```text
NexoDoc Audit Workspace
```

## 2. Painel de modulos

A rota `/` apresenta:

- acesso prioritario a `Conferencia documental` em `/audit`;
- acesso ativo a `Montagem de LDs` em `/ld`;
- modulos futuros visiveis, mas sem acao ativa;
- informacao compacta da sessao e acesso administrativo, quando aplicavel.

Os cards comunicam disponibilidade por texto e status, nao apenas por cor.

## 3. Layout principal da conferencia

O workspace `/audit` deve seguir tres areas:

- sidebar esquerda: marca, nova auditoria, resumo atual e historico da sessao;
- area central: chat dominante, upload, progresso e resposta estruturada;
- painel direito: inspecao analitica com resumo, achados e relatorio.

O chat continua sendo o fluxo principal do produto.

## 4. Paleta

Tokens principais:

```css
--background: #090c0e;
--foreground: #e1e7ea;
--nexodoc-panel: #121518;
--nexodoc-surface: #121518;
--card: #121518;
--primary: #00a693;
--border: #23282c;
--ring: #5bdac6;
```

Status:

```css
--status-ok: #7af7e1;
--status-ok-bg: rgb(0 166 147 / 0.14);
--status-warning: #ffb59e;
--status-warning-bg: rgb(220 120 88 / 0.14);
--status-critical: #ffb4ab;
--status-critical-bg: rgb(147 0 10 / 0.22);
```

## 5. Geometria

Regra geral:

- `border-radius` padrao de 4px;
- componentes em bloco com bordas discretas;
- botoes em estilo comando;
- estados ativos com borda teal e contraste de fundo;
- sombras discretas ou ausentes.

## 6. Componentes principais

### Sidebar

Deve conter:

- marca NexoDoc;
- indicador de modo mock quando ativo;
- botao Nova auditoria;
- informacoes da versao 0.1;
- resumo da auditoria atual;
- historico em memoria da sessao.

### Chat

Deve conter:

- estado vazio claro;
- mensagens do usuario;
- resultado estruturado do agente;
- progresso de auditoria;
- estados de erro e cancelamento.

### Composer

Deve conter:

- arquivos anexados;
- seletor de modo rapido/completo;
- campo de solicitacao;
- acao principal de auditoria;
- upload multiplo de PDFs.

### Painel analitico

Deve conter:

- status geral;
- modo selecionado;
- tempo de processamento;
- quantidade de PDFs;
- quantidade de achados;
- abas Resumo, Achados e Relatorio.

### Tooltip

- Baseado em Radix UI (`@radix-ui/react-tooltip`).
- Fundo `card`, borda `border`, fonte mono 12px, `shadow-subtle`.
- Delay de 300ms antes de exibir.
- Usado em botoes compactos sem texto visivel e labels tecnicos.

### Atalhos de teclado

- Modal com overlay `bg-black/60 backdrop-blur-sm`.
- Entrada `modal-scale-in` (200ms), saida `fade-out zoom-out-95`.
- Keycaps em `JetBrains Mono` 11px, borda `border`, fundo `muted`.
- Lista de atalhos com layout `flex justify-between` por linha.

## 7. Resposta do agente

A resposta renderizada deve preservar a estrutura definida para o agente auditor:

1. Projeto analisado
2. Status geral
3. Memorial
4. Pranchas
5. Incongruencias relevantes encontradas
6. Conclusao objetiva

As classificacoes permitidas continuam sendo:

- sem incongruencia relevante;
- com ponto de atencao;
- com incongruencia relevante.

## 8. Animacao e estados

Animacoes devem ser funcionais:

- transicoes entre 150 ms e 300 ms;
- entradas usam `cubic-bezier(0.22, 1, 0.36, 1)` (snappy);
- feedback usa `cubic-bezier(0.25, 1, 0.5, 1)` (smooth);
- saidas sao ~75% da duracao de entrada;
- apenas `transform` e `opacity` animados;
- `will-change` usado com parcimonia;
- sem decoracao excessiva;
- respeitar `prefers-reduced-motion`;
- progresso deve comunicar atividade sem prometer porcentagem exata.

Animacoes implementadas:

| Animacao | Duracao | Uso |
|----------|---------|-----|
| `nexodoc-enter` | 240ms | Dashboard, login, secoes |
| `nexodoc-message-in` | 180ms | Baloes de chat |
| `nexodoc-file-in` | 180ms | Arquivos anexados |
| `nexodoc-result-in` | 220ms | Resultado da auditoria |
| `sidebar-drawer-open` | 220ms | Sidebar mobile abrindo |
| `sidebar-drawer-closing` | 180ms | Sidebar mobile fechando |
| `backdrop-fade-in` | 200ms | Overlay de backdrop |
| `backdrop-fade-out` | 150ms | Overlay de backdrop |
| `modal-scale-in` | 200ms | Modal de atalhos |
| `dropdown-expand` | 180ms | Dropdown "Mais" admin |
| `audit-progress` | 1.4s loop | Barra de progresso |
| `nexodoc-status-pulse` | 1.8s loop | Indicadores de status |

## 9. Regras de implementacao

- Nao remover o chat do fluxo principal.
- Manter o dashboard como selecao funcional de modulos, sem linguagem promocional.
- Nao usar cards decorativos aninhados.
- Manter a interface escaneavel.
- Preservar upload, composer, progresso, resultado e historico.
- Evoluir exportacao e visualizacao de evidencias em etapas posteriores.
- Admin Nav usa `role=tablist` com `aria-selected` e navegacao por setas nos links.
- Abas excedentes colapsam em dropdown "Mais" com animacao `dropdown-expand`.
