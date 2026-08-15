---
target: painel do usuario + projetos
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-08-15T18-19-02Z
slug: components-home-painel-do-usuario-tsx
---
# Crítica — Painel do usuário + Projetos

Alvo: `components/home/painel-do-usuario.tsx` (a home) e `/projetos`
(`app/projetos/page.tsx` + `components/projects/project-console.tsx`).

## Design Health Score

| # | Heurística | Nota | Questão principal |
|---|-----------|------|-------------------|
| 1 | Visibilidade do estado | 3 | "parado há 9 dias", "Onde você parou" e o relógio dizem o estado sem ser pedidos |
| 2 | Sistema ↔ mundo real | 2 | `ACTIVE` em inglês; `DOCS/UPLOADS/ARTEFATOS/EVENTOS`; e acentos faltando na cópia em português |
| 3 | Controle e liberdade | 3 | Filtro limpa, projeto abre, nada prende |
| 4 | Consistência e padrões | 2 | São dois produtos: a home fala chanfro + mono; `/projetos` fala cartão aninhado + inglês |
| 5 | Prevenção de erro | 2 | Validação só depois do envio ("Codigo e nome sao obrigatorios.") |
| 6 | Reconhecer > lembrar | 3 | O que existe está visível; o achado carrega de quem é e há quanto tempo parou |
| 7 | Flexibilidade e eficiência | 3 | Filtro por código/nome/cliente, atalhos globais de teclado |
| 8 | Estética e minimalismo | 2 | A home é excelente e usa 40% da tela; `/projetos` empilha cartão dentro de cartão com quatro zeros |
| 9 | Recuperação de erro | 2 | Mensagem genérica, sem acento, longe do campo |
| 10 | Ajuda e documentação | 3 | "Crie o dossie para vincular auditoria, LD, capas e volumes ao mesmo registro" ensina o modelo mental |
| **Total** | | **25/40** | **Aceitável — a home puxa a nota para cima, `/projetos` puxa para baixo** |

## Veredito de anti-padrões

**Avaliação própria.** A home NÃO parece feita por IA: densidade escolhida,
hierarquia por peso e não por caixa, âmbar só onde há atraso. `/projetos` parece
outro autor — e cai em dois anti-padrões: **cartões aninhados** (quatro células
com borda dentro do cartão do projeto, todas mostrando 0) e **grid de cartões
idênticos**.

**Varredura determinística.** 3 ocorrências em `painel-do-usuario.tsx`, todas
"cor fora do DESIGN.md": `#171410` (:431) e `#d9a13b` (:446, :453). O âmbar
documentado é `signal-warning: #e9b45c` — o painel inventou um segundo.

**Contraste (medido).** `/projetos`: zero falhas. Home: uma —
"mais parados primeiro" a **2,58:1** (mínimo 4,5), `text-[#4c565c]` cravado em
`painel-do-usuario.tsx:177`, 11px.

## O que está funcionando

1. **A home responde à pergunta certa.** Não abre com "bem-vindo": abre com o que
   está parado, ordenado por quanto tempo está parado. Um painel que sabe o que o
   escritório perde dinheiro deixando de olhar.
2. **O âmbar é usado com parcimônia e significado.** Só a obra parada recebe
   tinta. Nada mais na tela compete.
3. **Nenhuma métrica-herói.** Cinco números poderiam ter virado dashboard; viraram
   uma lista com nome de obra e nome de gente.

## Questões prioritárias

- **[P1] `/projetos` rola 1171px de lado num telefone de 390px.** Medido com
  rolagem real: `scrollWidth` 1561 contra viewport 390 — quatro vezes a tela. O
  formulário "Novo projeto" trava em 462px e o grid não recua.
  **Por que importa:** é a tela de cadastro do escritório, e no telefone metade
  dela fica fora do mundo, sem nenhum aviso. O Nexo, ao lado, RECUSA abaixo de
  1024px com uma frase educada. Duas filosofias no mesmo produto.
  **Correção:** ou o mesmo portão do Nexo, ou uma coluna só abaixo de `lg`.
  **Comando:** `$impeccable adapt app/projetos`

- **[P1] A cópia em português está sem acento na tela de cadastro.**
  "Codigo" (`project-console.tsx:125`, `project-detail-actions.tsx:144`),
  "Observacoes" (:152, :160), "Orgao, prefeitura ou contratante" (:148),
  "Filtrar por codigo, nome ou cliente" (:188), "gerados pelos modulos"
  (`app/projetos/page.tsx:76`) e a mensagem de erro "Codigo e nome sao
  obrigatorios." (`project-detail-actions.tsx:69`).
  **Por que importa:** o produto vende rigor documental para engenharia. A
  primeira tela de cadastro escrevendo sem acento contradiz a promessa antes de
  qualquer auditoria rodar. **Correção:** acentuar; é texto literal, não i18n.
  **Comando:** `$impeccable clarify components/projects`

- **[P2] Cartão dentro de cartão, com quatro zeros.** Cada projeto mostra
  DOCS/UPLOADS/ARTEFATOS/EVENTOS em quatro células com borda própria, todas em 0.
  Quatro números vazios ocupam o melhor terço do cartão. **Correção:** uma linha
  de texto só quando houver algo ("3 docs · 2 artefatos"), e nada quando for zero.
  **Comando:** `$impeccable distill components/projects`

- **[P2] `ACTIVE` no cartão do projeto.** `project-console.tsx:222` imprime
  `{project.status}` cru. Mesmo defeito do admin, mesma cura.
  **Comando:** `$impeccable clarify components/projects`

- **[P2] Título truncado com a mesa vazia ao lado.** "Memorial descritivo —
  Cancha d…" corta num grid que tem uma coluna inteira livre à direita.
  **Comando:** `$impeccable layout components/projects`

- **[P3] "mais parados primeiro" a 2,58:1.** `painel-do-usuario.tsx:177`, hex
  cravado `#4c565c` fora do DESIGN.md. Se é rótulo, precisa de 4,5:1; se é
  controle de ordenação, precisa parecer um.
  **Comando:** `$impeccable audit components/home`

## Bandeiras por persona

**Jordan (primeira vez).** Chega na home e entende: obra, achado, quem, há quanto
tempo. Vai bem até `/projetos`, onde encontra "Codigo", "Observacoes" e um
`ACTIVE` que não significa nada para quem desenha drenagem.

**Casey (telefone).** A home funciona em 390px. `/projetos` some pela direita sem
avisar, e o botão "CRIAR PROJETO" fica fora do alcance do polegar depois de cinco
campos.

## Observações menores

- "3 de 3 projeto(s)" — o mesmo plural por "(s)" do admin.
- Segundo âmbar não documentado (`#d9a13b`) convivendo com `signal-warning`.
- A home termina aos ~430px de uma janela de 1000. Sobra mais tela do que se usa.
- "parado há 9 dias" aparece duas vezes a 40px de distância (linha da obra e
  linha do achado).

## Perguntas que valem a pena

- A home e `/projetos` deveriam ser a mesma tela? A home já lista obras com
  achados; `/projetos` lista obras com zeros.
- Se todo documento pertence a um centro de custo de uma prefeitura, o cartão do
  projeto não deveria mostrar a prefeitura em vez de quatro contadores em zero?
- O que "ACTIVE" quer dizer para um projetista — que a obra está em contrato, que
  a pasta aceita upload, ou que alguém mexeu nela esse mês?
