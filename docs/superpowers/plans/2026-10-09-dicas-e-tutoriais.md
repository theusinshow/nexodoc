# Plano: dicas e tutoriais do software (retomar em outra máquina)

Escrito em 09/10/2026. Este arquivo serve de passagem de bastão: a memória do
Claude fica só na máquina onde a conversa rodou, então tudo o que importa para
continuar está aqui.

## O pedido

Matheus: "refino dos tutoriais e dicas acerca do software todo — não quero
algo chato que pare o fluxo do usuário, mas que instrua ele". Ele não tem dado
de onde os usuários travam e deu carta branca: **decidir pela própria lógica,
implementar, provar e reportar a decisão em uma linha**. Perguntar só quando o
assunto é gasto de token, apagar dados ou algo externo.

Regras de desenho que valem para todo item abaixo:

1. **Ensinar na hora.** A dica aparece quando a pessoa está fazendo aquilo,
   ao lado do que explica, uma vez só. Usa `DicaDeUmaVez`
   (`components/telas/comum/dica-de-uma-vez.tsx`) e é guardada no navegador
   (`modules/nexo/lib/dicas-da-auditoria.ts`).
2. **Uma dica por vez.** Se duas podem aparecer juntas, a segunda espera a
   primeira com `quando={!useDica("primeira").mostrar}`.
3. **Texto curto.** No máximo duas ou três linhas. Uma frase diz o que é, a
   outra o que a pessoa faz. Nada de emoji ou tom de marketing.
4. **O passo a passo com holofote só abre quando pedido**, pelo "?" da tela. A
   exceção é o do resultado da auditoria, que abre sozinho uma vez. Um clique
   fora encerra o tour e guarda o passo, e o "?" passa a dizer "Continuar".
5. **O tour nunca clica em botão que grava**, só em troca de vista. Há teste
   para isso.

## Já feito (na main)

| Commit | O quê |
|---|---|
| `6ee8ef2` | Holofote no `TourDoNexo`: uma película desfocada com recorte em chanfro no alvo, capítulos, "Pular capítulo", retomada. Specs em `docs/superpowers/specs/2026-10-09-holofote-do-tour-design.md`. |
| `39e5aa3` | Volume: 4 dicas (`volume-plano`, `volume-canvas`, `volume-entrega`, `volume-teto`) e o passo a passo do mapa do volume (`passos-do-tour-do-volume.ts`). O canvas aproxima o nó do passo (`aproximar-no-tour.ts`). Spec em `docs/superpowers/specs/2026-10-09-dicas-do-volume-design.md`. |

## Como preparar a outra máquina

1. `git pull` na main e `npm install`.
2. O `.env.local` precisa ter `DATABASE_URL` (o banco `nexodoc_dev` no Neon é
   o mesmo para as duas máquinas), `AUTH_SECRET` e `NEXODOC_DEV_AUTH_EMAIL`.
3. **Testar sempre no build de produção.** O `next dev` recarrega sozinho,
   porque um programa externo regrava `DESIGN-MANIFEST.json`:
   ```bash
   NEXODOC_DIST_DIR=.next-bateria NEXT_PUBLIC_NEXO_ENABLED=true npx next build
   NEXODOC_DIST_DIR=.next-bateria npx next start -p 3000
   ```
   Deixe o log do servidor fora do repositório.
4. Provas (sem token). O login é assinado por `entrarSemTela`, em
   `scripts/lib/sessao-de-teste.mjs`, porque o build de produção não tem
   "Entrar como dev":
   ```bash
   node scripts/test-nexo-tour.ts
   NEXODOC_PROVA_AUDITORIA=c81540a1-6cce-4a15-8d56-1516974f84bc node scripts/prova-holofote-do-tour.mjs
   NEXODOC_PROVA_CONVERSA=f7b0f5fe-2855-477b-9893-44f13a0aa28b node scripts/prova-dicas-do-volume.mjs
   ```
   Os dois ids existem no banco de dev: o primeiro é uma auditoria COMPLETED,
   o segundo a conversa "ARQ" com volume montado e 16 folhas. As fotos saem em
   `tmp/` (ignorado pelo git). **Olhe as fotos**: as asserções de DOM não
   pegaram duas dicas tampando 25% do mapa, a foto pegou.

## Armadilhas já descobertas

- **`backdrop-filter` com `saturate()` e o prefixo `-webkit-` some do CSS
  compilado.** Use só `blur()`.
- **A aba do Chrome da extensão fica `hidden`.** O `requestAnimationFrame`
  congela e o balão do tour nunca aparece. Meça com Playwright, não com a
  extensão. O clique da extensão também não chegava ao React; `element.click()`
  via JS chegava.
- **`.ds` aplica `zoom: 1.125`.** O tour vai por portal no `body` e mede pela
  janela. Não ponha a película dentro do `.ds`.
- **O aviso "Algo falhou do nosso lado (#0001)" num parecer local** é a falta
  da `NEXODOC_COFRE_CHAVE` (a miniatura do PDF não decifra). É ambiente, não
  defeito.
- Arquivos com CRLF misturado: editar com o Edit ou normalizar `\r\n` antes de
  procurar texto.

## O que falta (em ordem)

### 1. Conferir ao vivo os passos que a prova não viu — FEITO em 10/10 (sem commit)

`conferencia` visto ao vivo na conversa EST `f09e2fbf-8a5f-48b5-82a9-0b01eb1eb7da`
(6 tomos). `teto` visto por `scripts/prova-teto-do-volume.mjs`: copia a EST para
o IndexedDB da prova com o tomo 1 declarado com 21 MB e barra toda gravação no
servidor (nenhum tomo real do banco passa de 20 MB). A aproximação passou a ter
como piso o zoom da pessoa, não o do passo anterior (o "Dividir" saía cortado).
A rodada achou e consertou:
- a contagem pulava número ("6 de 8" → "8 de 8") quando um passo saía por
  `soSeExistir`: agora conta só os que aparecem (`semOsAusentes`,
  `ausentesPrevistos` em `capitulos-do-tour.ts`, com teste);
- `aproximar` fazia `fitView` no NÓ (a fileira inteira) e o "Montar" saía com
  50px: agora centra o próprio alvo, até 1:1;
- a doca cobria a coluna da conferência: com área ≥ 900px centra no mapa; no
  palco estreito fica onde estava e a lista ganha folga embaixo;
- **perda de dados**: abrir uma conversa num navegador sem os bytes dos
  arquivos e gravar qualquer coisa apagava as referências (`files`) no disco e
  no servidor. A EST ficou com 0 de 54; reparada pela irmã `2ddeedc9` (backup
  do antes no scratchpad da sessão). Consertado no store
  (`arquivosAusentes`) e travado pela jornada `c8`.

Os passos `teto` (tomo acima de 20 MB) e `conferencia` (coluna "Conferência da
LD") do tour do volume foram pulados pelo `soSeExistir`, porque o volume de
teste não tinha nenhum dos dois.
- Procure no banco uma conversa com resultado `conferencia` (a consulta está
  no fim deste arquivo). Para o teto, monte um tomo grande ou semeie um volume
  com mais de 20 MB.
- Rode `prova-dicas-do-volume.mjs` com essa conversa e olhe as fotos.
- Confira também se o `aproximar` enquadra os botões Comprimir/Dividir.

### 2. Primeiro acesso: M1 e M2 do doc 08 — FEITO em 10/10 (sem commit)

Prova: `node scripts/prova-exemplo-e-ficha.mjs` (21 asserções, build de produção
na 3000). O que saiu, além do desenho abaixo:
- A oferta só aparece com tarefa "auditar" para quem não tem conversa de
  auditoria na barra (fora os exemplos); a primeira auditoria real a apaga.
- O exemplo é a conversa `nexo-exemplo-memorial`, semeada como a do tour. O
  "Conferi — auditar" grava `resultadoDoMemorialDeExemplo()` sem rede; o
  cartão esconde as perguntas que iriam ao modelo; o palco mostra o selo
  "Exemplo"; a barra o põe em "Exemplos e testes" (`ehConversaDeExemplo`, pelo
  id); e ele é apagado ao sair da conversa ou recarregar.
- A fala da ficha ficou curta (`FALA_DA_FICHA`): o porquê do nome da obra
  passou para a dica de uma vez.
- Conversa aberta cuja última fala é ficha sem parecer abre NO TOPO da ficha
  (antes ia ao fim e a linha "Obra" ficava acima da dobra — a foto pegou).
- `pularTourGuiado` passou a marcar também `tour-do-resultado`: desde o
  holofote ele segurava o clique e 5 jornadas de auditoria estavam vermelhas.


O desenho está em `docs/ux-audit-memorial/08-tutorial-redesign.md`. M3–M5 já
existem.
- **M1, estado vazio educativo.** Dentro da `ZonaDeSolta`
  (`modules/nexo/components/ZonaDeSolta.tsx`, montada em `NexoChat.tsx:667`),
  quando a tarefa é auditar e a pessoa nunca auditou, um texto curto de "como
  funciona" e o botão **"Usar um memorial de exemplo"**. Esse botão reaproveita
  `modules/nexo/lib/projeto-exemplo.ts`, que já gera o PDF do memorial de
  exemplo e o parecer pronto. **Não pode gastar IA.**
- **M2, a ficha.** Na primeira ficha de memorial (o cartão com "Conferi —
  auditar", `ConfirmationCard.tsx:~3054`), uma dica de uma vez ancorada na
  linha "Obra": "Confira principalmente o nome da obra: é por ele que o Nexo
  descobre trecho copiado de outro projeto. Errado? Corrija no lápis."
- Ids novos em `dicas-da-auditoria.ts`, na lista `IDS`.
- Prova: navegador limpo, nenhum balão sozinho, e a conversa de exemplo só
  nasce com o clique.

### 3. Defeito pequeno: a dica do plano repetida — FEITO em 10/10 (`ultimo` no plano com capa)

Se uma conversa tiver mais de um `PlanoDeGeracao` no log, a `volume-plano`
aparece em cada um até o primeiro "Entendi". Mostre só no plano mais recente:
passe uma prop `ultimo` do `NexoChat` e use `quando={ultimo}`.

### 4. Uma camada comum: o "?" em toda tela — DECIDIDO em 10/10: não fazer

Painel, Projetos, Achados e Administração não ganham "?" nem tour: "Ajuda" já
está fixa na barra de cima, essas telas são de consulta, e os estados vazios
delas já seguem a DESIGN.md §7 (rótulo, uma linha, uma ação). Reabrir se
aparecer dado de onde as pessoas travam.

A frente 4 da conversa, que ficou para depois. Hoje há "?" no resultado e no
mapa do volume.
- Avaliar o "?" nas telas de fora do Nexo: Painel, Projetos, Achados e
  Administração.
- Antes de escrever, auditar contra a `DESIGN.md` e a `/ajuda`
  (`components/telas/ajuda/dados.ts`), que já descreve as tarefas passo a
  passo. O "?" pode só levar à tarefa certa da Ajuda em vez de abrir mais um
  tour.
- Toda tela nova de tour precisa de: roteiro em `modules/nexo/lib/passos-do-tour-*.ts`
  com `capitulo`, entrada no `ROTEIROS` de `scripts/test-nexo-tour.ts`, um
  teste de que ele só clica em troca de vista, e uma prova no navegador nos
  moldes das duas que existem.

### 5. Revisar as dicas antigas da auditoria — FEITO em 10/10

Curtas, citam botões que existem e não aparecem juntas (a primeira encerrada
apaga a `primeira-revisao`; a dos atalhos só vem depois de três). Corrigida a
promessa falsa "Falso positivo ensina o motor" (aqui e na Ajuda, "Procede e
Gravidade errada ensinam o motor"): o veredito só alimenta a medida de acerto do
painel de qualidade; nada no motor o lê.

`primeira-revisao` e `atalhos` (`components/telas/resultado/fila-a/fila-a.tsx:124`)
são anteriores ao holofote. Confira se continuam curtas e se não aparecem
junto do tour do resultado. Hoje o tour marca `primeira-revisao` como vista,
em `PalcoDoNexo.tsx`.

## Consulta útil (banco de dev)

```js
// node --no-warnings, com dotenv lendo .env.local, e pg
select id, title, data::jsonb->'results' r
from "NexoConversation" where tipo = 'volume' order by "updatedAt" desc limit 40
// filtre em JS pelos kinds: "volume", "conferencia", "capa", "ld"
```
