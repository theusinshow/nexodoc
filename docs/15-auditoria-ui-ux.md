# NexoDoc - Auditoria UI/UX

Data: 2026-05-28

Esta auditoria segue o registro visual definido para o produto: ferramenta tecnica, escura, precisa, minimalista e orientada a tarefa.

## Principios aplicados

- Uma acao principal clara por etapa.
- Controles avancados sob demanda.
- Menos texto instrucional repetido.
- Estados visiveis sem depender apenas de cor.
- Foco acessivel em links, botoes e campos.
- Sem salvar PDFs anexados no banco.

## Achados principais

1. Montagem de LDs concentra muitos comandos na revisao.
   - Impacto: usuario piloto pode perder o caminho principal.
   - Acao aplicada: filtros e triagem ficaram visiveis; ordenacao, densidade, mock, adicionar linha e acoes em massa foram movidos para "Ajustes avancados".

2. Dashboard tinha duas entradas admin concorrentes.
   - Impacto: duvida entre painel geral e operacao de LDs.
   - Acao aplicada: ficou apenas "Abrir controles", deixando o painel admin centralizar as rotas internas.

3. O foco por teclado ainda era mais forte em botoes do que em campos.
   - Impacto: navegacao por teclado ficava pouco evidente em formularios longos.
   - Acao aplicada: foco global para links, botoes, campos e summaries com borda/ring consistente.

4. A direcao visual pedia menos decoracao.
   - Impacto: detalhe radial decorativo do dashboard competia com a leitura operacional.
   - Acao aplicada: removido o brilho radial, mantendo apenas a grade tecnica sutil.

5. Painel admin repetia cabecalho, token, erro e metricas em varias telas.
   - Impacto: ajustes visuais e de comportamento ficariam caros e inconsistentes.
   - Acao aplicada: criado shell admin compartilhado para cabecalho, formulario de token, erro e metricas compactas.

6. Filtros de auditoria tinham grade fixa.
   - Impacto: experiencia ruim em telas menores e risco de overflow visual.
   - Acao aplicada: filtros passaram a ser responsivos e a tabela recebeu largura minima com rolagem horizontal controlada.

## Melhorias recomendadas para a proxima rodada

- Transformar tabelas admin em listas responsivas no mobile, evitando scroll horizontal excessivo.
- Separar a Montagem de LDs em subetapas visuais mais curtas: importar, revisar, tomos, gerar.
- Padronizar empty states em todos os paineis admin.
- Criar um pequeno guia interno de microcopy para mensagens de erro, pendencia e sucesso.

## Checklist visual do piloto

- Abrir dashboard e confirmar que existe uma entrada clara para cada modulo.
- Abrir `/ld` e validar se a etapa atual fica evidente sem ler toda a tela.
- Importar PDFs de teste e confirmar que pendencias aparecem em resumo unico.
- Revisar pranchas usando triagem antes de abrir ajustes avancados.
- Abrir `/admin` e confirmar que "Centro de controle" serve como ponto unico para usuarios, LDs, auditorias, consumo e configuracao.
- Testar navegacao por teclado em campos, filtros e botoes.
