# NexoDoc - Checklist de testes sem custo

Use este roteiro para validar a interface sem consumir tokens. O caminho mais rapido e o botao `Demo local`, que injeta um resultado demonstrativo no navegador sem chamar API. O modo `NEXODOC_MOCK_MODE=true` continua util para testar o backend em mock.

## 1. Preparacao

- Abrir o app.
- Clicar em `Demo local`.
- Conferir que o resultado aparece sem upload e sem chamada de API.
- Trocar o modo para `Volume` e clicar em `Demo local` novamente.
- Confirmar que o historico da sessao registra as duas demos.
- Opcional: com `NEXODOC_MOCK_MODE=true`, anexar um PDF pequeno e executar uma auditoria mock pelo backend.

## 2. Resultado

Verificar:

- status usa `com inconsistencias criticas`, `com pontos de revisao` ou `sem achados criticos`;
- nao aparece a frase `sem incongruencia relevante`;
- aba `Resumo` mostra contadores corretos;
- aba `Achados` separa criticos documentais e pontos de revisao tecnica;
- aba `Roteiro` agrupa por arquivo e pagina;
- aba `Evidencias` mostra documento, pagina, local e termo de busca;
- aba `Relatorio` continua copiavel.
- em auditoria com mais de um arquivo, a secao de comparacoes identifica os documentos confrontados.
- a demo de Volume mostra comparacoes entre LD, pranchas e capa;
- a demo de Memorial mostra achados internos e uma conclusao objetiva.

## 3. Localizacao no PDF

Verificar:

- botao `Abrir pagina no PDF` abre uma nova aba;
- quando ha pagina provavel, a URL inclui `#page=`;
- botao `Copiar termo` copia o termo de busca;
- termo de busca e curto o suficiente para usar no Ctrl+F.

## 4. Exportacao e copia

Verificar:

- `Copiar resposta`;
- `Baixar .md`;
- `Copiar achados`;
- `Copiar roteiro`;
- `Copiar acoes`;
- conteudo copiado nao perde Documento, Pagina, Local, Evidencia, Termo de busca e Acao.

## 5. Admin sem custo

Verificar:

- `/admin/usage` abre com token admin;
- `/admin/config` abre com token admin;
- `/admin/config` mostra modelo, mock mode, origins, limites e chaves configuradas;
- nenhuma chave secreta e exibida.
- configuracao indica se o demo iniciado pelo navegador esta permitido.

## 6. Historico persistente

Com banco configurado e uma auditoria real:

- confirmar transicao `PROCESSING` para `COMPLETED`;
- provocar falha controlada e confirmar `FAILED`;
- cancelar uma auditoria em andamento e confirmar `CANCELED`.

## 7. Erros esperados

Testar:

- enviar sem PDF;
- enviar sem mensagem;
- anexar arquivo nao PDF;
- anexar mais de 5 PDFs;
- anexar arquivo acima de 25 MB;
- erro de API mostra acao para abrir a demo local;
- recarregar a pagina depois de uma auditoria e confirmar que PDFs locais deixam de abrir, pois ainda nao ha storage persistente.

## 8. Responsividade sem custo

Testar com dados da demo local:

- notebook 1366 px: chat e composer continuam legiveis;
- largura menor que `lg`: sidebar some e header movel mostra acoes principais;
- largura `2xl`: painel de inspecao aparece sem esmagar o resultado;
- textos monoespacados em botoes, labels e nomes de arquivos nao quebram o layout.
