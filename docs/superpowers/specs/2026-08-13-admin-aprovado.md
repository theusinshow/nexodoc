# Admin — spec corrigida contra o código

**Data:** 2026-08-13
**Origem:** avaliação das 7 telas do `/admin` (A.1–A.10).
**Status:** SPEC. Complementa `2026-08-13-propostas-ux-ui-aprovadas.md`, que já
tinha 2.24–2.26 no Lote 11 — este documento **absorve** os três e os substitui.

## O que a avaliação acertou, verificado no código

Cada afirmação abaixo foi conferida antes de virar tarefa.

| Afirmação | Verificado |
|---|---|
| "Nenhuma tela do admin usa o chanfro" | **Confirmado.** `grep nx-cut-\|nx-edge-` em `app/admin/**` e `components/admin/**` não retorna nada |
| "`VISIBLE_COUNT = 4` esconde Consumo/Qualidade/Config" | **Confirmado.** `components/admin/admin-nav.tsx:30`, fatiado em `:105-106` |
| "`onPreferencias` nunca é passado" | **Confirmado.** Existe só em `NexoSidebar.tsx:134,167,1002` — nenhum chamador o fornece, então o item do menu nunca renderiza |
| "Formulário de token no topo de cada tela" | **Confirmado.** `admin-page-shell.tsx:51-75`, `type="password"` no header compartilhado |
| "'Tornar admin' em lote sem confirmação" | **Confirmado.** `app/admin/users/page.tsx:304` (lote) e `:389` (individual) chamam direto |
| "Bug de copy: barras azuis" | **Confirmado.** `app/admin/usage/page.tsx:351` diz "Barras azuis mostram tokens" |
| "Config duplica a última falha" | **Confirmado.** `config/page.tsx:583` (coluna da tabela) e `:748` ("Últimos incidentes") |
| "Quality não tem tendência nem meta" | **Confirmado.** Nenhuma ocorrência de meta/série/semana em `quality/page.tsx` |
| "Usage não tem R$" | **Confirmado.** Nenhum `BRL`/`R$` em `app/admin/**` |

Nove por nove. É a avaliação mais precisa das três que chegaram.

## Uma correção de contexto (não de fato)

**A dívida do chanfro no admin é conhecida e datada, não um descuido.** O plano
`2026-08-11-chanfro-como-sistema.md` excluiu `app/admin/**` do escopo por
decisão registrada na spec daquele trabalho. A.1 não está consertando um
esquecimento — está fechando um escopo que foi adiado de propósito.

## Duas discordâncias

### A 2.24 estava errada, e o A.4 a corrige

Eu tinha classificado a 2.24 ("home vira tabela mono em vez de cartões") como
baixo retorno, e mantenho: trocar cartão por tabela é rearranjo. **O A.4 é outra
proposta** — uma *linha de status derivada* dos dados que já existem
(`operacional · 3 auditorias/24h · 0 falhas de provider · R$ 14,20`). Isso é
instrumento, não layout. **A 2.24 fica retirada; o A.4 a substitui.**

### O A.10 faria mal antes de fazer bem

Registrar "quem tinha o token" numa tabela de eventos produz a **aparência** de
trilha sem a atribuição. Trilha em que não se pode confiar é pior que trilha
nenhuma, porque alguém vai confiar — e o dia em que importar será o dia de uma
disputa sobre quem promoveu quem.

**Recomendação:** fazer o **A.5** (confirmação) agora, que resolve o problema
real (ação irreversível sem anteparo), e segurar o A.10 até a decisão de auth
por pessoa. Se o mantenedor quiser o A.10 assim mesmo, ele entra **rotulado**:
a tela precisa dizer "registro local, sem atribuição verificada".

## Uma promoção

**O A.9 sobe na ordem por causa de uma frase da própria avaliação:** "o endereço
do escritório impresso em toda prancha — o dado que já mordeu uma vez (o bug
Criciúma/Florianópolis)". Isso não é conveniência de preferências; é um **modo
de falha conhecido que hoje é implícito**. Transformá-lo em entrada explícita do
sistema vale mais que metade dos itens acima dele.

Dividir em dois: **A.9a** (dados do escritório — o que alimenta capas) tem
prioridade alta; **A.9b** (preferências da pessoa) é acabamento.

## Os lotes

| lote | itens | por quê |
|---|---|---|
| **A-I** | **A.1** | O sistema visual no admin: chanfro, `<Badge>` com tokens de status, tabelas no padrão §7. É a mudança que mais paga por pixel, e é onde mora quem paga a conta |
| **A-II** | **A.2** + **A.3** | O header devolve o melhor lugar das 7 telas (token colapsa), e a nav para de enterrar custo e qualidade. Medir a largura, não `VISIBLE_COUNT = 4` |
| **A-III** | **A.4** | A linha de status do sistema. Substitui a 2.24 |
| **A-IV** | **A.5** | Confirmação de privilégio, no padrão de cartão do produto — não `confirm()` nativo. Fecha uma violação do princípio 3 na tela mais sensível |
| **A-V** | **A.9a** | Dados do escritório: nome, endereço impresso, CREA/responsável. Fecha um modo de falha conhecido |
| **A-VI** | **A.7** | Usage: consertar o "barras azuis", ≈ R$ com câmbio configurável, custo por obra (era a 2.26) |
| **A-VII** | **A.8** | Quality com série semanal e meta declarada (era a 2.25) |
| **A-VIII** | **A.6** | Config com hierarquia de atenção; fundir a "última falha" duplicada numa fonte só |
| **A-IX** | **A.9b** | Preferências da pessoa |
| **A-X** | **A.10** | Trilha — **só depois** da decisão de auth, ou rotulada como registro sem atribuição |

## Dependências

- **A.7 depende de câmbio configurável**, e câmbio é config — então o campo
  nasce em `/admin/config`, não em `usage`.
- **A.7 (custo por obra) pode exigir schema:** verificar se o registro de uso
  carrega vínculo com obra/conversa. Se não, é etapa de Prisma. Era a mesma
  ressalva da 2.26.
- **A.4 consome o que A.7 produzir** (o R$ do mês). Sem ele, a linha nasce sem a
  parcela de custo e a ganha depois.
- **A.1 antes de tudo:** cada tela tocada depois herda o tratamento em vez de
  ganhar um retrabalho.

## Fora de escopo

- Trocar o token compartilhado por auth por pessoa (decisão maior, não é UI).
- Gráfico decorativo em qualquer tela do admin. A série do A.8 é tabela mono ou
  sparkline de 1px.
- Métrica-herói colorida (o `DESIGN.md` já proíbe).
