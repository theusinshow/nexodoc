---
target: auditoria e achados
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-08-15T18-19-02Z
slug: components-audit-result-tsx
---
# Crítica — Auditoria e achados

Alvo: `components/audit-result.tsx` (o parecer, 3000+ linhas) montado dentro do
palco do Nexo (`modules/nexo/components/PalcoDoNexo.tsx`). `/audit` está
aposentada e redireciona para `/nexo`.

## Design Health Score

| # | Heurística | Nota | Questão principal |
|---|-----------|------|-------------------|
| 1 | Visibilidade do estado | 2 | A tela mostra dois números diferentes para a mesma quantidade de achados |
| 2 | Sistema ↔ mundo real | 4 | "BLOQUEIA A EMISSÃO / EXIGE DECISÃO TÉCNICA / REVISÃO DE TEXTO" — severidade dita na língua de quem assina a prancha |
| 3 | Controle e liberdade | 3 | Abas, `Esc` no tour, exportar; nada prende |
| 4 | Consistência e padrões | 2 | 4 na aba, 5 no corpo, 4 na soma dos cartões; e o seletor de vista interno usa `rounded-sm` |
| 5 | Prevenção de erro | 3 | O veredito "NÃO EMITIR" é a prevenção de erro do produto inteiro |
| 6 | Reconhecer > lembrar | 3 | "Arquivos analisados → Sem informação específica" é um beco sem saída |
| 7 | Flexibilidade e eficiência | 3 | Exportar com menu, foco por `refId`, teclado no canvas |
| 8 | Estética e minimalismo | 3 | O painel de veredito é a melhor peça do produto; os três cartões de severidade sustentam |
| 9 | Recuperação de erro | 3 | Achado corrigido pelo engenheiro some por `refId`; reauditoria existe |
| 10 | Ajuda e documentação | 4 | Tour de 11 passos sobre um projeto de exemplo real, pulável, `Esc` sai |
| **Total** | | **30/40** | **Bom — base sólida, corrigir os pontos fracos** |

## Veredito de anti-padrões

**Avaliação própria.** Não parece feito por IA em nenhum ângulo. "NÃO EMITIR"
com bolinha coral e uma frase que diz o motivo é uma decisão de produto, não um
componente de biblioteca. Os três cartões de severidade poderiam ter sido
métricas-herói e não foram: o número é grande porque é a contagem que decide se
o volume sai, não porque dashboard tem número grande.

**Varredura determinística.** Nenhuma ocorrência em `components/audit-result.tsx`
nem em `modules/nexo/**`.

## O que está funcionando

1. **O vocabulário de severidade.** Três nomes que dizem o que fazer, não o que a
   IA achou. É a tradução de "critical/major/minor" para a mesa de trabalho, e é
   o melhor texto do produto.
2. **O veredito antes da lista.** A tela abre com a decisão ("NÃO EMITIR"), não
   com a tabela. Quem lê já sabe o que fazer antes de rolar.
3. **O tour anda sobre um projeto de exemplo de verdade** — selo lido, parecer
   com achados, tudo semeado — e apaga tudo ao terminar. Ensina fazendo, sem
   gastar token e sem sujar o banco.

## Questões prioritárias

- **[P1] "Achados 4" e "5 achados em 1 arquivo" na mesma tela, a 40px um do
  outro.** A aba conta só o nível principal
  (`PalcoDoNexo.tsx:224` — `classifyFindingTier(a) === "principal"`), o corpo
  conta tudo (`audit-result.tsx:2004` — `findings.length`), e a soma dos três
  cartões de severidade dá 4. O comentário em `PalcoDoNexo.tsx:215` já avisa que
  contar por outro critério "traria a divergência de volta pela porta dos fundos"
  — a divergência entrou pela outra porta.
  **Por que importa:** a proposta inteira do produto é contagem confiável. Um
  engenheiro que vê 4 e 5 na mesma tela deixa de confiar nos dois.
  **Correção:** uma função de contagem, usada nos dois lugares; se as duas
  contagens são legítimas, rotular a diferença ("4 principais de 5").
  **Comando:** `$impeccable clarify components/audit-result.tsx`

- **[P2] "Arquivos analisados → Sem informação específica."** Um cabeçalho que
  promete e um vazio que não ensina nada. **Correção:** ou listar os arquivos
  (a auditoria os conhece — o palco mostra "4 folhas no contexto"), ou não
  mostrar a seção.
  **Comando:** `$impeccable onboard components/audit-result.tsx`

- **[P2] O seletor de vista interno usa raio.** `audit-result.tsx:2009-2012`:
  `rounded-sm` no trilho e nos botões, dentro de um sistema cuja geometria
  declarada é o chanfro (o DESIGN.md lista os três únicos lugares onde raio
  sobrevive, e este não é um deles). Vale para o ramo `!controlado`.
  **Comando:** `$impeccable polish components/audit-result.tsx`

## Bandeiras por persona

**Riley (testador metódico).** Acha a divergência 4/5 em trinta segundos, e ela é
exatamente o tipo de coisa que ele documenta e leva para a reunião. Depois
pergunta o que "Sem informação específica" quer dizer e não encontra resposta na
tela.

**Alex (usuário avançado).** Bem servido — abas, exportar com menu, foco direto
num achado por `refId`, teclado no canvas.

## Observações menores

- "3 incongruência(s) crítica(s)" — plural por "(s)" outra vez, e desta vez
  dentro do veredito, que é a frase mais lida do produto.
- O tour abre em cima dos três cartões de severidade que ele está apresentando.
- `TEMPO` da auditoria aparece como `--` também na listagem do admin: o dado de
  duração parece nunca ter sido gravado.

## Perguntas que valem a pena

- Se o parecer já sabe dizer "NÃO EMITIR", por que a contagem de achados precisa
  aparecer em três lugares diferentes na mesma vista?
- O que o engenheiro faz com um achado de "REVISÃO DE TEXTO" quando o veredito é
  "NÃO EMITIR"? A tela ordena por severidade, mas não diz por onde começar.
- A divergência 4/5 é um defeito ou uma distinção real que nunca ganhou rótulo?
