# NexoDoc - Saida estruturada e evidencias

Este documento define a evolucao planejada para a saida de resposta do NexoDoc.

O objetivo e transformar a resposta do agente em um resultado de auditoria mais claro, rastreavel e adequado para apresentacao interna.

## 1. Objetivo

A resposta do NexoDoc deve permitir que o usuario entenda rapidamente:

- qual projeto foi analisado;
- qual e o status geral;
- quais documentos estao coerentes;
- quais incongruencias foram encontradas;
- onde cada problema provavelmente aparece;
- qual acao de revisao deve ser tomada.

## 2. Camada 1 - Renderizacao estruturada

Status: implementada no MVP.

A resposta textual do agente continua seguindo a estrutura obrigatoria:

```text
1. Projeto analisado
2. Status geral
3. Memorial
4. Pranchas
5. Incongruências relevantes encontradas
6. Conclusão objetiva
```

No frontend, essa resposta passa a ser renderizada em blocos visuais:

- resultado da auditoria;
- status geral destacado;
- projeto analisado;
- memorial;
- pranchas;
- incongruencias relevantes;
- conclusao objetiva;
- tempo decorrido;
- botao para copiar resposta completa.

Essa camada melhora a leitura sem alterar o contrato do backend.

## 3. Camada 2 - Dados estruturados

Status: planejada.

Evoluir a resposta para incluir dados estruturados em JSON, mantendo uma resposta humana copiavel.

Formato alvo:

```json
{
  "projeto_analisado": {
    "nome_obra": "Escola Municipal Exemplo",
    "codigo_projeto": "NX-001/2026"
  },
  "status_geral": "com incongruência relevante",
  "memorial": {
    "resumo": "Memorial apresenta referência residual a outro bairro."
  },
  "pranchas": {
    "resumo": "Selo da prancha A-02 apresenta código divergente."
  },
  "incongruencias": [
    {
      "tipo": "código do projeto divergente",
      "documento": "Pranchas.pdf",
      "pagina": 12,
      "local": "selo/carimbo",
      "evidencia": "Código ABC-123",
      "comparado_com": "Memorial indica XYZ-456",
      "classificacao": "com incongruência relevante",
      "acao_recomendada": "Revisar o código no selo da prancha A-02."
    }
  ],
  "conclusao": "conjunto com incongruência relevante e necessidade de revisão"
}
```

## 4. Camada 3 - Evidencia visual

Status: planejada.

A evidencia visual deve ser implementada em etapas para evitar indicacoes imprecisas.

### Etapa 3.1 - Documento e pagina provavel

O agente deve informar:

- nome do documento;
- pagina provavel;
- local textual;
- evidencia encontrada;
- informacao conflitante.

### Etapa 3.2 - Miniatura da pagina

O backend deve renderizar a pagina indicada do PDF como imagem.

A interface deve exibir:

- miniatura da pagina;
- documento;
- pagina;
- observacao do agente.

### Etapa 3.3 - Marcacao visual

Somente depois de validar a confiabilidade da localizacao, adicionar destaque visual na imagem:

- caixa sobre o trecho;
- destaque no selo/carimbo;
- destaque no trecho do memorial;
- legenda explicando o conflito.

## 5. Restricao importante

Nao marcar visualmente um ponto exato se a localizacao nao for confiavel.

Uma marcacao visual errada pode prejudicar a confianca no NexoDoc. Por isso, a evolucao deve priorizar primeiro documento, pagina provavel e local textual.

