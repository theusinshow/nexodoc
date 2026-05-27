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
- geometria reta, sem cantos arredondados;
- detalhes em azul escuro;
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
--background: #0b101a;
--foreground: #eef3fb;
--nexodoc-panel: #101827;
--nexodoc-surface: #171c24;
--card: #171c24;
--primary: #17243e;
--border: #263244;
--ring: #2f5592;
```

Status:

```css
--status-ok: #75d69c;
--status-ok-bg: #102418;
--status-warning: #f2c96d;
--status-warning-bg: #2a220f;
--status-critical: #ff7a84;
--status-critical-bg: #2b1218;
```

## 5. Geometria

Regra geral:

- `border-radius: 0`;
- componentes em bloco com bordas retas;
- botoes em estilo comando;
- estados ativos com borda azul e contraste de fundo;
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
- sem decoracao excessiva;
- respeitar `prefers-reduced-motion`;
- progresso deve comunicar atividade sem prometer porcentagem exata.

## 9. Regras de implementacao

- Nao remover o chat do fluxo principal.
- Manter o dashboard como selecao funcional de modulos, sem linguagem promocional.
- Nao usar cards decorativos aninhados.
- Manter a interface escaneavel.
- Preservar upload, composer, progresso, resultado e historico.
- Evoluir exportacao e visualizacao de evidencias em etapas posteriores.
