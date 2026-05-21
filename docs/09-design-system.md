# NexoDoc - Design system

Este documento define a direcao visual e os padroes iniciais do design system do NexoDoc.

O objetivo e manter o aplicativo com aparencia tecnica, profissional e consistente, sem perder o fluxo principal em formato de chat.

## 1. Decisao de produto

O NexoDoc deve continuar sendo uma aplicacao estilo chat.

O design system anexado em `design-system/` sera usado como referencia de componentes shadcn/ui, tokens e estrutura visual, mas nao deve substituir a experiencia principal.

Fluxo prioritario:

```text
anexar PDFs -> escolher modo -> enviar mensagem -> acompanhar progresso -> receber auditoria estruturada
```

## 2. Principios visuais

- Tecnico e direto.
- Interface de trabalho, nao landing page.
- Alta legibilidade.
- Pouco ruido visual.
- Densidade moderada para uso recorrente.
- Hierarquia clara entre chat, auditoria e relatorio.
- Status documental sempre visivel.
- Evidencias e acoes recomendadas com destaque maior que textos explicativos.

## 3. Paleta inicial

Base:

- fundo: neutro muito claro;
- texto: grafite;
- superficie principal: branco;
- painel lateral: neutro frio;
- bordas: cinza claro;
- acento: azul-petroleo tecnico.

Status:

- sem incongruencia relevante: verde tecnico;
- com ponto de atencao: amarelo/ambar;
- com incongruencia relevante: vermelho controlado;
- processamento: azul-petroleo.

## 4. Tokens CSS

Tokens especificos do NexoDoc:

```css
--nexodoc-surface
--nexodoc-panel
--nexodoc-panel-foreground
--nexodoc-accent
--nexodoc-accent-foreground
--status-ok
--status-ok-bg
--status-warning
--status-warning-bg
--status-critical
--status-critical-bg
```

Esses tokens devem complementar os tokens shadcn existentes, nao substitui-los sem necessidade.

## 5. Componentes principais

### Sidebar

Deve conter:

- marca NexoDoc;
- botao Nova auditoria;
- resumo da auditoria atual;
- historico em memoria da sessao.

### Composer

Deve conter:

- seletor rapido/completo;
- campo de mensagem;
- upload de PDFs;
- botao Auditar documentos;
- estados desabilitados durante processamento.

### Resultado de auditoria

Deve conter:

- status geral em destaque;
- tempo de conclusao;
- projeto analisado;
- memorial;
- pranchas;
- incongruencias relevantes;
- acoes recomendadas;
- conclusao objetiva;
- visualizacao de relatorio.

### Achado

Cada achado deve exibir:

- titulo;
- documento;
- pagina provavel;
- local;
- evidencia;
- conflito;
- acao recomendada.

## 6. Estados obrigatorios

- vazio;
- arquivos anexados;
- processando;
- concluido;
- erro;
- cancelado;
- historico vazio.

## 7. Regras de implementacao

- Manter chat como tela principal.
- Nao criar landing page no lugar da aplicacao.
- Nao remover upload e composer.
- Nao substituir a resposta estruturada por dashboard isolado.
- Componentes do design system podem ser incorporados gradualmente.
- Toda mudanca visual deve preservar a legibilidade da auditoria.

