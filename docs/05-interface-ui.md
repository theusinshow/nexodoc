# NexoDoc - Interface UI

## 1. Direcao visual

A interface do NexoDoc deve ser limpa, tecnica e profissional.

O produto deve lembrar uma ferramenta de trabalho para engenharia, com foco em leitura, envio de documentos e resposta objetiva. A interface nao deve parecer uma landing page comercial.

## 2. Tela inicial

A versao 0.1 deve ter pagina unica.

Elementos principais:

- sidebar simples com o nome NexoDoc;
- botao "Nova auditoria";
- area central de conversa;
- area para upload multiplo de PDFs;
- lista de arquivos anexados;
- seletor de modo rapido ou completo;
- campo de mensagem;
- botao "Auditar documentos";
- area de resposta do agente;
- botao "Copiar resposta".

## 3. Layout recomendado

Estrutura visual:

```text
┌────────────────────┬────────────────────────────────────┐
│ Sidebar            │ Area de chat                        │
│                    │                                    │
│ NexoDoc            │ Mensagens e resposta do agente      │
│ Nova auditoria     │                                    │
│                    │ Upload + composer no rodape         │
└────────────────────┴────────────────────────────────────┘
```

Em telas menores, a sidebar pode ser reduzida ou empilhada, mantendo prioridade para a area de chat e envio.

## 4. Componentes previstos

Componentes previstos para a fase de implementacao:

- `ChatWindow`;
- `MessageBubble`;
- `Composer`;
- `FileUpload`;
- `AttachedFiles`;
- `AuditResultActions`.

Esses componentes ainda nao devem ser criados nesta etapa de documentacao.

## 5. Comportamentos esperados

### Upload de arquivos

O usuario deve conseguir:

- selecionar multiplos PDFs;
- ver nome e tamanho dos arquivos anexados;
- remover arquivo antes do envio;
- receber erro claro ao anexar arquivo invalido.

### Envio

O botao de auditoria deve:

- ficar indisponivel durante o carregamento;
- exigir pelo menos um PDF;
- enviar mensagem e arquivos ao backend;
- indicar que a analise esta em andamento.

### Modo de auditoria

A interface deve permitir escolher:

- auditoria rapida: triagem objetiva, menor custo esperado e resposta mais curta;
- auditoria completa: conferencia mais cuidadosa, maior detalhe e maior custo esperado.

O modo selecionado deve ser visivel antes do envio e enviado ao backend.

### Resposta

A resposta deve:

- aparecer na area de chat;
- preservar quebras de linha;
- manter a estrutura obrigatoria do agente;
- permitir copia em um clique.

## 6. Linguagem de interface

A linguagem da interface deve ser objetiva.

Textos recomendados:

- "NexoDoc";
- "Nova auditoria";
- "Anexar PDFs";
- "Arquivos anexados";
- "Auditar documentos";
- "Copiar resposta";
- "Analisando documentos";
- "Remover arquivo".

Evitar:

- linguagem promocional;
- emojis;
- textos longos de explicacao;
- termos que indiquem conclusao tecnica absoluta;
- promessas de aprovacao ou validacao completa.

## 7. Estados da interface

A interface deve prever:

- estado vazio;
- arquivos anexados;
- carregamento;
- resposta recebida;
- erro de validacao;
- erro de API;
- envio bloqueado por ausencia de PDF.

## 8. Estilo visual

Diretrizes:

- fundo neutro;
- tipografia limpa;
- contraste adequado;
- botoes claros;
- cards discretos para arquivos anexados;
- baixa densidade decorativa;
- foco na leitura da resposta;
- layout responsivo para desktop e notebook.

## 9. Prioridade da versao 0.1

A prioridade da interface e tornar o fluxo principal evidente:

```text
anexar PDFs -> escrever solicitacao -> auditar -> ler resposta
```

Qualquer elemento que nao ajude esse fluxo deve ficar fora da versao inicial.
