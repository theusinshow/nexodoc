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
- resumo com metricas de achados;
- projeto analisado em campos;
- memorial;
- pranchas;
- achados em cards estruturados;
- acoes recomendadas destacadas;
- conclusao objetiva;
- tempo decorrido;
- botao para copiar resposta completa;
- botao para copiar achados;
- botao para copiar acoes recomendadas;
- visualizacao alternativa em formato de relatorio;
- aba de evidencias com pre-visualizacao esquematica.

Essa camada melhora a leitura sem alterar o contrato do backend.

## 2.2 Historico em memoria

Status: implementado no MVP.

O NexoDoc mantem um historico local apenas durante a sessao aberta do navegador.

Esse historico permite:

- consultar auditorias ja executadas na sessao;
- reabrir o resultado estruturado;
- preservar modo escolhido, arquivos e status;
- manter o MVP sem banco de dados e sem historico persistente.

Ao recarregar a pagina, o historico em memoria pode ser perdido.

## 2.1 Modos de auditoria

Status: implementado no MVP.

O NexoDoc possui tres modos iniciais:

- auditoria rapida;
- checagem de volume;
- auditoria completa.

A auditoria rapida prioriza triagem, resposta curta e menor consumo esperado.

A checagem de volume prioriza capa, LD, lista de desenhos, pranchas, selos/carimbos, revisoes, disciplinas, volume/tomo e estrutura do pacote documental.

A auditoria completa prioriza comparacao documental mais cuidadosa, maior detalhamento e maior consumo esperado.

Os tres modos mantem a mesma estrutura obrigatoria da resposta para preservar a renderizacao no frontend.

## 3. Camada 2 - Dados estruturados

Status: parcialmente implementada.

A seção "Incongruências relevantes encontradas" já usa um subformato textual estruturado para cada achado:

```text
Achado N: título curto do problema
Documento: nome ou tipo do documento onde apareceu
Página provável: número da página, se visível; se não for possível, escrever "não identificada"
Local: capa, memorial, selo/carimbo, lista de desenhos, lista de documentos, cabeçalho, rodapé ou outro local visível
Evidência: texto ou informação encontrada
Conflito: qual informação diverge e com o que foi comparada
Ação recomendada: revisão objetiva a executar
Categoria: categoria documental do achado, quando aplicavel
Referência comparada: documento, item da LD, prancha ou campo usado na comparação, quando aplicavel
```

O frontend interpreta esses campos e renderiza cada achado em um bloco proprio. No modo Volume, os campos `Categoria` e `Referência comparada` ajudam a separar achados de estrutura, LD x prancha, selo x LD, selo x memorial, capa x memorial e reaproveitamento.

Proxima evolucao: migrar de texto estruturado para JSON.

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

Status: iniciada.

A evidencia visual deve ser implementada em etapas para evitar indicacoes imprecisas.

### Etapa 3.1 - Documento e pagina provavel

Status: implementada no frontend.

O agente deve informar:

- nome do documento;
- pagina provavel;
- local textual;
- evidencia encontrada;
- informacao conflitante.

O NexoDoc ja renderiza uma aba de evidencias com:

- documento;
- pagina provavel;
- local do problema;
- evidencia textual;
- pre-visualizacao esquematica do trecho.

Essa pre-visualizacao ainda nao marca a pagina real do PDF. Ela serve para preparar a experiencia sem gerar falsa precisao.

### Etapa 3.2 - Miniatura da pagina

Status: planejada.

O backend deve renderizar a pagina indicada do PDF como imagem.

A interface deve exibir:

- miniatura da pagina;
- documento;
- pagina;
- observacao do agente.

### Etapa 3.3 - Marcacao visual

Status: planejada.

Somente depois de validar a confiabilidade da localizacao, adicionar destaque visual na imagem:

- caixa sobre o trecho;
- destaque no selo/carimbo;
- destaque no trecho do memorial;
- legenda explicando o conflito.

## 5. Restricao importante

Nao marcar visualmente um ponto exato se a localizacao nao for confiavel.

Uma marcacao visual errada pode prejudicar a confianca no NexoDoc. Por isso, a evolucao deve priorizar primeiro documento, pagina provavel e local textual.
