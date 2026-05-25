# NexoDoc - Indice da documentacao

Este indice organiza a documentacao inicial do NexoDoc antes da implementacao do MVP.

## Documentos principais

1. [Visao geral](C:/Dev/trabalho/empresa/nexodoc/docs/01-visao-geral.md)
2. [Escopo do MVP](C:/Dev/trabalho/empresa/nexodoc/docs/02-escopo-mvp.md)
3. [Agente auditor](C:/Dev/trabalho/empresa/nexodoc/docs/03-agente-auditor.md)
4. [Arquitetura tecnica](C:/Dev/trabalho/empresa/nexodoc/docs/04-arquitetura-tecnica.md)
5. [Interface UI](C:/Dev/trabalho/empresa/nexodoc/docs/05-interface-ui.md)
6. [Roadmap](C:/Dev/trabalho/empresa/nexodoc/docs/06-roadmap.md)
7. [Testes reais](C:/Dev/trabalho/empresa/nexodoc/docs/07-testes-reais.md)
8. [Saida estruturada e evidencias](C:/Dev/trabalho/empresa/nexodoc/docs/08-saida-estruturada.md)
9. [Design system](C:/Dev/trabalho/empresa/nexodoc/docs/09-design-system.md)
10. [Bateria de testes](C:/Dev/trabalho/empresa/nexodoc/docs/10-bateria-testes.md)
11. [Checklist de testes sem custo](C:/Dev/trabalho/empresa/nexodoc/docs/11-checklist-testes-sem-custo.md)

## Fonte de verdade

O arquivo [NexoDoc_contexto_principal.md](C:/Dev/trabalho/empresa/nexodoc/docs/NexoDoc_contexto_principal.md) registra o contexto inicial do produto. Para o estado implementado, use o README, o roadmap e a bateria de testes.

## Regra de escopo atual

A base atual preserva o chat como fluxo principal, mas ja incorpora recursos operacionais:

- sem login;
- com historico persistente opcional via PostgreSQL;
- com painel administrativo protegido por token;
- com comparacao entre documentos em auditorias com multiplos PDFs;
- sem exportacao PDF ou DOCX;
- com exportacao Markdown do relatorio.
