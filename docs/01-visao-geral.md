# NexoDoc - Visao geral

> Documento de visao inicial. O estado implementado ja inclui persistencia opcional e paineis administrativos; consulte `README.md` e `06-roadmap.md`.

## 1. Objetivo do produto

NexoDoc e uma aplicacao web para auditoria documental de projetos de engenharia civil.

O produto deve oferecer uma experiencia semelhante a um chat, permitindo que o usuario envie documentos tecnicos em PDF e receba uma analise padronizada sobre a consistencia documental do conjunto.

A aplicacao nao tem como objetivo treinar um modelo proprio. O NexoDoc usa a OpenAI API no backend para interpretar memoriais, pranchas, capas, listas de documentos, listas de desenhos e demais arquivos tecnicos enviados pelo usuario.

## 2. Problema que o NexoDoc resolve

Projetos de engenharia civil frequentemente possuem conjuntos documentais extensos, com memoriais, pranchas, selos, capas, volumes, tomos e listas de documentos.

Erros de identificacao podem ocorrer quando documentos sao reaproveitados de outro projeto ou quando diferentes arquivos apresentam informacoes conflitantes.

O NexoDoc deve ajudar a identificar inconsistencias documentais relevantes, especialmente em:

- nome da obra;
- numero ou codigo do projeto;
- endereco;
- bairro;
- municipio;
- secretaria, orgao ou cliente;
- volume;
- tomo;
- disciplina;
- capa;
- selo ou carimbo;
- lista de desenhos;
- lista de documentos;
- sinais de reaproveitamento indevido de outro projeto.

## 3. Fluxo principal

O fluxo inicial do produto deve ser simples:

```text
Usuario acessa a pagina
Usuario anexa um ou mais PDFs
Usuario escreve uma solicitacao no chat
Frontend envia mensagem e arquivos para o backend
Backend chama a OpenAI API com o prompt fixo do agente auditor
Backend retorna a analise
Frontend exibe a resposta padronizada na tela
```

## 4. Principios da versao inicial

A versao inicial deve priorizar clareza, simplicidade e validacao do fluxo principal.

Principios:

- manter o produto em pagina unica;
- evitar funcionalidades administrativas no inicio;
- manter o prompt do agente fixo no backend;
- nao expor a chave da OpenAI no frontend;
- exibir a resposta de forma clara e copiavel;
- nao persistir historico;
- nao depender de banco de dados;
- nao exigir login.

## 5. Escopo de uso

O NexoDoc deve apoiar a conferencia documental, nao substituir revisao tecnica completa.

Nesta fase, o produto deve focar em identidade documental e coerencia entre arquivos. A aplicacao nao deve ser tratada como ferramenta de calculo estrutural, dimensionamento, aprovacao tecnica ou emissao de laudo.

## 6. Stack definida

A stack inicial do NexoDoc e:

- Next.js;
- TypeScript;
- Tailwind CSS;
- shadcn/ui;
- OpenAI API;
- Vercel.
