# NexoDoc - Testes reais

Este documento registra testes reais realizados com o MVP do NexoDoc.

O objetivo e manter evidencias praticas sobre desempenho, custo, qualidade da resposta e utilidade da ferramenta em casos proximos ao uso interno da empresa.

## 1. Criterios observados

Cada teste deve registrar:

- data do teste;
- tipo de documento;
- quantidade de arquivos;
- tamanho ou quantidade aproximada de paginas;
- mensagem enviada pelo usuario;
- tempo aproximado de resposta;
- custo aproximado na OpenAI API;
- qualidade da resposta;
- observacoes sobre erros, limites ou melhorias necessarias.

## 2. Teste real 01 - Documento tecnico extenso

### Data

21 de maio de 2026.

### Entrada

- Quantidade de arquivos: 1 PDF.
- Documento: projeto/documento tecnico extenso.
- Quantidade aproximada de paginas: 218 paginas.

### Objetivo do teste

Verificar se o NexoDoc conseguiria analisar um documento grande e identificar incongruencias documentais conhecidas previamente pelo usuario.

### Mensagem enviada

```text
Identifique o projeto analisado e verifique se ha incongruencia documental relevante.
```

### Tempo de resposta

Tempo registrado no backend:

```text
POST /api/audit 200 in 69s
```

Tempo aproximado: 69 segundos.

### Custo aproximado

Custo observado no painel da OpenAI API:

```text
US$ 0,04
```

### Resultado observado

O NexoDoc analisou o documento e retornou corretamente os pontos que precisavam de ajuste.

Segundo validacao manual do usuario, o documento ja possuia erros conhecidos e a resposta do agente apontou exatamente os itens relevantes a corrigir.

### Avaliacao qualitativa

- O fluxo completo funcionou: upload, backend, OpenAI API e resposta na interface.
- O custo foi baixo para um documento de 218 paginas.
- A resposta foi considerada correta em relacao aos erros previamente conhecidos.
- O tempo de resposta foi aceitavel para um documento extenso.

### Conclusao do teste

O teste indica viabilidade tecnica inicial do NexoDoc para auditoria documental de arquivos grandes.

O resultado reforca que o MVP pode gerar valor pratico em revisoes documentais internas, especialmente quando comparado ao uso manual ou ao uso nao padronizado de uma interface generica de IA.

## 3. Pontos de atencao identificados

- A interface deve melhorar a experiencia durante analises longas.
- E recomendavel adicionar tempo decorrido durante o processamento.
- E recomendavel implementar auto-scroll para a resposta final.
- E recomendavel manter registro manual de custo por teste durante a fase piloto.
- Testes futuros devem incluir conjuntos com multiplos PDFs, como memorial, capa, pranchas e lista de documentos.

## 4. Proximos testes recomendados

### Teste 02 - Memorial e pranchas

Entrada sugerida:

- 1 memorial em PDF;
- 1 PDF de pranchas ou capa.

Objetivo:

- verificar consistencia entre memorial, capa, selo e identificacao das pranchas.

### Teste 03 - Conjunto com erro conhecido

Entrada sugerida:

- conjunto documental com bairro, obra, numero de projeto ou orgao divergente.

Objetivo:

- avaliar se o agente identifica a incongruencia sem inventar problemas.

### Teste 04 - Multiplos PDFs

Entrada sugerida:

- memorial;
- tomo ou volume;
- lista de documentos;
- pranchas.

Objetivo:

- validar comportamento do NexoDoc em um fluxo mais proximo do uso real da empresa.

