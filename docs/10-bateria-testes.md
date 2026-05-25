# NexoDoc - Bateria de testes

Este documento registra a bateria inicial de testes do NexoDoc e define o roteiro para testes reais com API.

## 1. Estado atual

Data: 2026-05-21

Modo usado para testes sem custo:

```text
NEXODOC_MOCK_MODE=true
```

Servidor local:

```text
http://127.0.0.1:3001
```

## 2. Testes automatizados executados

### 2.1 Qualidade e build

Comandos executados:

```bash
npm run lint
npm run build
```

Resultado:

- lint aprovado;
- build aprovado;
- rota `/` gerada como pagina estatica;
- rota `/api/audit` mantida como dinamica.

### 2.2 API em modo mock

Testar os dois modos atuais:

- `memorial`;
- `volume`;

Resultado esperado:

- status HTTP `200`;
- `mock: true`;
- `auditMode` retornado igual ao modo enviado;
- resposta contendo a estrutura `1. Projeto analisado`;
- auditoria com multiplos arquivos contendo comparacoes efetivamente executadas;
- divergencias entre LD/prancha ou memorial/capa contendo `Categoria` e `Referência comparada`.

Resultado:

- todos aprovados.

### 2.3 Validacoes de erro da API

Cenarios testados:

- mensagem vazia;
- sem arquivo;
- arquivo invalido;
- mais de 5 PDFs.

Resultado esperado:

- status HTTP `400`;
- mensagem de erro objetiva.

Resultado:

- todos aprovados.

## 3. Testes manuais recomendados sem API

Executar com `NEXODOC_MOCK_MODE=true`.

### 3.1 Fluxo de demo

1. Abrir o app.
2. Selecionar modo `Memorial`.
3. Ativar `Modo demo`.
4. Conferir abas `Resumo`, `Achados`, `Evidências` e `Relatório`.
5. Repetir para modo `Volume`.

Critérios:

- a demo deve carregar sem upload;
- o histórico da sessão deve registrar a demo;
- o painel direito deve atualizar status, modo, PDFs e achados;
- a aba `Achados` deve renderizar cards legíveis;
- a aba `Evidências` deve exibir prévia esquemática.

### 3.2 Fluxo de upload sem custo

1. Anexar 1 PDF pequeno.
2. Confirmar que aparecem modelos de solicitação.
3. Clicar em `Checar volume`.
4. Confirmar que o modo muda para `Volume`.
5. Enviar auditoria.
6. Conferir resultado mock.

Critérios:

- modelos aparecem somente após anexar PDF;
- modelos preenchem o campo de mensagem;
- `Checar volume` e `Selo e LD` selecionam o modo `Volume`;
- envio retorna resposta mock sem custo.

## 4. Testes reais com API

Executar somente depois de mudar:

```text
NEXODOC_MOCK_MODE=false
```

### 4.1 Teste real pequeno

Entrada:

- 1 memorial pequeno;
- 1 conjunto pequeno de pranchas ou capa/LD.

Modo:

- `Memorial`.

Medir:

- tempo total;
- custo na plataforma OpenAI;
- qualidade da identificação do projeto;
- se a resposta respeitou a estrutura.

### 4.2 Teste real de Volume e comparacao cruzada

Entrada:

- capa;
- memorial;
- LD/lista de desenhos;
- pranchas.

Modo:

- `Volume`.

Medir:

- se identificou LD;
- se comparou LD x pranchas;
- se avaliou selo/carimbo;
- se retornou `Categoria`;
- se retornou `Referência comparada`;
- se a secao `Comparações entre arquivos` descreve confrontos realmente executados;
- custo total.

### 4.3 Teste real pesado

Entrada:

- volume completo acima de 100 paginas.

Modo:

- `Volume`;
- repetir com outro conjunto menor, se fizer sentido.

Medir:

- tempo;
- custo;
- se houve timeout;
- qualidade dos achados;
- falsos positivos;
- falsos negativos conhecidos.

### 4.4 Persistencia operacional

Com `DATABASE_URL` configurada, validar no painel `/admin/audits`:

- execucao aparece como `PROCESSING` enquanto a analise esta ativa;
- execucao concluida muda para `COMPLETED` e inclui relatorio;
- erro de API ou extracao muda para `FAILED`;
- cancelamento pelo chat muda para `CANCELED`.

## 5. Registro recomendado por teste real

Para cada teste real, registrar:

```text
Data:
Modo:
Quantidade de PDFs:
Total aproximado de paginas:
Tempo:
Custo:
Resultado geral:
Achados corretos:
Achados incorretos:
Erros conhecidos que o NexoDoc deixou passar:
Observacoes:
```
