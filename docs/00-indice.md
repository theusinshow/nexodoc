# NexoDoc - Indice da documentacao

Este indice organiza a documentacao do NexoDoc.

Os documentos numerados abaixo sao os do DESENHO INICIAL, escritos antes do MVP
existir. Eles continuam valendo como registro da intencao, mas nao descrevem o
software de hoje: para o estado implementado, use as fontes listadas em "Fonte
de verdade". Esta pasta tem mais arquivos do que este indice lista.

## Documentos principais

1. [Visao geral](01-visao-geral.md)
2. [Escopo do MVP](02-escopo-mvp.md)
3. [Agente auditor](03-agente-auditor.md)
4. [Arquitetura tecnica](04-arquitetura-tecnica.md)
5. [Interface UI](05-interface-ui.md)
6. [Roadmap](06-roadmap.md)
7. [Testes reais](07-testes-reais.md)
8. [Saida estruturada e evidencias](08-saida-estruturada.md)
9. [Design system](09-design-system.md)
10. [Bateria de testes](10-bateria-testes.md)
11. [Checklist de testes sem custo](11-checklist-testes-sem-custo.md)
12. [Piloto controlado da Montagem de LDs](12-piloto-controlado-ld.md)
13. [Checklist do banco piloto para LDs](13-checklist-banco-piloto-ld.md)
14. [Execucao do checklist do banco piloto para LDs](14-execucao-checklist-banco-piloto-ld.md)
15. [Auditoria UI/UX](15-auditoria-ui-ux.md)
16. [Roadmap software solido, IA e UI](16-roadmap-software-solido-ia-ui.md)
17. [Roadmap de agentes de IA e economia de tokens](17-roadmap-agentes-ia-economia.md)

## Propostas de evolução (2026-08)

- [Propostas de evolução UX/UI](propostas-evolucao-ux-ui.md) — transversais e por tela, numeradas (1.1–2.29). Status: em avaliação.
- [Evolução do Orbe — Nexo Core](propostas-orbe.md) — 10 propostas (O.1–O.10). Status: aprovadas para execução, ordem na Parte 3.

## Fonte de verdade

O arquivo [NexoDoc_contexto_principal.md](NexoDoc_contexto_principal.md) registra o contexto inicial do produto. Para o estado implementado, use o README, o roadmap e a bateria de testes.

## Regra de escopo atual

A base atual preserva o chat como fluxo principal, mas ja incorpora recursos operacionais:

- com login Google;
- com historico persistente opcional via PostgreSQL;
- com painel administrativo protegido por token;
- com comparacao entre documentos em auditorias com multiplos PDFs;
- com Montagem de LDs, historico por usuario e painel administrativo de LDs;
- com painel admin central e gestao basica de usuarios por e-mail;
- sem armazenamento permanente dos binarios PDF/ODT/ZIP da LD;
- sem exportacao DOCX;
- com exportacao Markdown do relatorio.
