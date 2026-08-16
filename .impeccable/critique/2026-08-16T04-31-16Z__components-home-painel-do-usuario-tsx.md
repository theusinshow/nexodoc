---
target: painel do usuario + projetos
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-08-16T04-31-16Z
slug: components-home-painel-do-usuario-tsx
---
# Crítica — Painel do usuário + Projetos · segunda passada

Primeira em 15/08 (25/40); esta em 16/08.

## Design Health Score

| # | Heurística | Nota | Antes | Questão principal |
|---|-----------|------|-------|-------------------|
| 1 | Visibilidade do estado | 3 | 3 | "parado há 9 dias", "Onde você parou" |
| 2 | Sistema ↔ mundo real | 4 | 2 | Acentos corrigidos, `ACTIVE` virou "Em andamento", plural resolvido |
| 3 | Controle e liberdade | 3 | 3 | Filtro limpa, projeto abre |
| 4 | Consistência e padrões | 3 | 2 | `/projetos` parou de ser outro produto — falta o mesmo chanfro dos cartões |
| 5 | Prevenção de erro | 2 | 2 | **Não mudou:** validação só depois do envio |
| 6 | Reconhecer > lembrar | 3 | 3 | |
| 7 | Flexibilidade e eficiência | 3 | 3 | |
| 8 | Estética e minimalismo | 3 | 2 | Cartão aninhado eliminado; o nome da obra parou de truncar |
| 9 | Recuperação de erro | 3 | 2 | Mensagens acentuadas e específicas |
| 10 | Ajuda e documentação | 3 | 3 | |
| **Total** | **30/40** | **25/40** | | **Bom** |

## Medido

Contraste: **zero falhas** nas duas telas (era 2,58:1 no rótulo do painel).
Transbordo em 390px: **zero** (era 1171px em `/projetos`).
Detector: `painel-do-usuario.tsx` saiu da lista (eram 3 cores fora do sistema).

## Questões prioritárias

- **[P2] A validação só fala depois do envio.** "Código e nome são obrigatórios."
  aparece quando o formulário já foi mandado. Campo obrigatório vazio pode dizer
  isso antes, ao sair do campo.
  **Comando:** `$impeccable harden components/projects`

- **[P3] `/projetos` ainda usa `Card` com raio**, enquanto o painel usa chanfro.
  As duas telas estão mais perto do que estavam, mas não são a mesma língua.
  **Comando:** `$impeccable polish components/projects`

- **[P3] O painel usa 40% da altura da janela.** Sobra mais tela do que se usa.

## Perguntas que ficam

- O painel e `/projetos` deveriam ser a mesma tela? O primeiro lista obras com
  achados; o segundo lista obras.
- Se todo documento pertence a um centro de custo de uma prefeitura, o cartão do
  projeto não deveria mostrar a prefeitura?
