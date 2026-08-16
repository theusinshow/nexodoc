---
target: auditoria e achados
total_score: 32
p0_count: 0
p1_count: 0
timestamp: 2026-08-16T04-31-16Z
slug: components-audit-result-tsx
---
# Crítica — Auditoria e achados · segunda passada

Primeira em 15/08 (30/40); esta em 16/08.

## Design Health Score

| # | Heurística | Nota | Antes | Questão principal |
|---|-----------|------|-------|-------------------|
| 1 | Visibilidade do estado | 3 | 2 | Os dois números viraram um: a aba, os cartões e o corpo contam a mesma coisa |
| 2 | Sistema ↔ mundo real | 4 | 4 | O vocabulário de severidade segue sendo o melhor texto do produto |
| 3 | Controle e liberdade | 3 | 3 | |
| 4 | Consistência e padrões | 3 | 2 | Contagem unificada; o seletor de vista interno ainda usa `rounded-sm` |
| 5 | Prevenção de erro | 3 | 3 | O veredito É a prevenção de erro do produto |
| 6 | Reconhecer > lembrar | 3 | 3 | **Não mudou:** "Arquivos analisados → Sem informação específica" |
| 7 | Flexibilidade e eficiência | 3 | 3 | |
| 8 | Estética e minimalismo | 3 | 3 | |
| 9 | Recuperação de erro | 3 | 3 | |
| 10 | Ajuda e documentação | 4 | 4 | O tour de 11 passos sobre projeto de exemplo |
| **Total** | **32/40** | **30/40** | | **Bom** |

## O que mudou

**A divergência 4/5 acabou.** A linha somava sólidos MAIS sugestões da IA —
apresentando como achado exatamente o que a validação rebaixou de propósito. Agora
conta o mesmo que o veredito, e as sugestões ganharam nome próprio.

**E o veredito parou de dizer "3 incongruência(s) crítica(s)".** É a frase mais
lida do produto.

## Questões prioritárias

- **[P2] "Arquivos analisados → Sem informação específica."** Um cabeçalho que
  promete e um vazio que não ensina. A auditoria conhece os arquivos.
  **Comando:** `$impeccable onboard components/audit-result.tsx`

- **[P3] O seletor de vista interno usa `rounded-sm`** (`audit-result.tsx`, ramo
  `!controlado`), num sistema cuja geometria é o chanfro.

- **[P3] `TEMPO` nunca tem valor.** Aparece `--` na listagem do admin também: o
  dado de duração parece não estar sendo gravado.
