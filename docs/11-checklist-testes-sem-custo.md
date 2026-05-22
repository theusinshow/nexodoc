# NexoDoc - Checklist de testes sem custo

Use este roteiro com `NEXODOC_MOCK_MODE=true` para validar a interface sem consumir tokens.

## 1. Preparacao

- Confirmar que o backend Render esta em mock mode.
- Abrir o app pela Vercel.
- Anexar um PDF pequeno qualquer.
- Executar uma auditoria de Memorial.
- Repetir com modo Volume.

## 2. Resultado

Verificar:

- status usa `com inconsistencias criticas`, `com pontos de revisao` ou `sem achados criticos`;
- nao aparece a frase `sem incongruencia relevante`;
- aba `Resumo` mostra contadores corretos;
- aba `Achados` separa criticos documentais e pontos de revisao tecnica;
- aba `Roteiro` agrupa por arquivo e pagina;
- aba `Evidencias` mostra documento, pagina, local e termo de busca;
- aba `Relatorio` continua copiavel.

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

## 6. Erros esperados

Testar:

- enviar sem PDF;
- enviar sem mensagem;
- anexar arquivo nao PDF;
- anexar mais de 5 PDFs;
- recarregar a pagina depois de uma auditoria e confirmar que PDFs locais deixam de abrir, pois ainda nao ha storage persistente.
