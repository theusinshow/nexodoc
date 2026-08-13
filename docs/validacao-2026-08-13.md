# Checklist de validação — o que mudou em 2026-08-13

**Branch:** `theusinshow/kmi-adititonals` (10 commits à frente da `main`).
**Para quem:** o mantenedor, noutra máquina, conferindo à mão.

Este documento existe porque a sessão que produziu as mudanças descobriu, do
jeito ruim, que **`tsc` e `eslint` passam limpos com o servidor caindo na
inicialização** — nenhum dos dois executa o módulo. O que está marcado como
"nunca aberto" abaixo é literal.

## Antes de começar

```bash
git fetch origin
git checkout theusinshow/kmi-adititonals
npm ci
npx prisma generate      # sem isto, centenas de erros de tipo que não são reais
npm run dev
```

**Confira o `.env.local`.** Duas variáveis que barram tela sem dizer por quê:

| Variável | Sem ela |
|---|---|
| `NEXT_PUBLIC_NEXO_ENABLED=true` | `/nexo` faz kill-switch e some para `/` |
| `NEXODOC_ADMIN_EMAILS=<seu e-mail>` | `/admin` te trata como não-admin quando não há banco |

Para abrir o `/admin` numa máquina sem banco e sem Google, faltam mais três — e
sem elas o login não oferece atalho nenhum e o `/admin` devolve tela de
não-admin, sem dizer por quê:

```
NEXODOC_DEV_AUTH=true
NEXODOC_DEV_AUTH_EMAIL=dev@nexodoc.local   # tem de ser o MESMO de ADMIN_EMAILS
AUTH_SECRET=<qualquer coisa local>
```

As provas automáticas, se quiser rodar antes:

```bash
npm run test:nexo:escala && npm run test:nexo:enquadramento \
  && npm run test:nexo:pins && npm run prova:tokens && npm run prova:glossario
```

---

## 1. Orbe — `/bancada-do-orbe` (não pede login)

**Estado de confiança:** visto rodando, com prova em PNG.

- [ ] O seletor lista **9 estados**. `auditing` e `waiting` existem; `hover` e
      `uploading` **não** (a máquina nunca os produziu — estavam no enum mentindo).
- [ ] A seção "Identidade Visual do Logotipo" **sumiu** (3 variantes aposentadas
      foram cortadas).
- [ ] Existe um controle **Ritmo do respiro** no painel de parâmetros.
- [ ] `waiting` × `idle`: mesma esfera, **metade da cadência**. Olhe por ~10s.
- [ ] `auditing`: a banda de varredura **sobe sempre** e recomeça no pé — nunca
      desce. (`npm run prova:varredura` mede isso: 139→323, quebra, 79→138.)
- [ ] `reading` com atividade ~0,7: **arco no aro** fechando ~70% da volta.
- [ ] `error`: **batimento duplo** no miolo. Nenhuma cor nova — a lei prende o
      orbe à rampa teal, então o erro se diz por ritmo.
- [ ] Recarregar a página: o **boot** — miolo acende do zero (~600ms), aro entra
      atrasado, giro nasce alto e assenta.

## 2. Login — `/login`

- [ ] Orbe **vivo** no painel da direita, acima do poster do workspace.
- [ ] Nenhum salto de layout quando o Canvas termina de carregar.
- [ ] O logotipo do cabeçalho continua sendo o **SVG estático** (a 48px o WebGL
      vira borrão — é por isso que o orbe vivo não foi para lá).

## 3. Nexo — `/nexo`

**Estado de confiança:** o orbe foi visto; **o visor de folha nunca foi aberto**
(ele derrubava o servidor até o commit `0d9e9c1`).

- [ ] **Anel de consumo** no rodapé da conversa: **azul**, não teal. Era
      `var(--ring)` — teal significa interativo, e fatia de gráfico não se clica.
- [ ] Focar o campo de texto: o **aro do orbe sobe** um pouco. Focar com o mouse
      em cima **não** dobra o efeito.
- [ ] Deixar o campo vazio por **6s** depois de uma resposta: o orbe entra em
      espera (respiro longo) e o rótulo diz **"aguardando você"**, sem reticência
      animada — esperar não é trabalhar.
- [ ] Digitar qualquer caractere: volta ao estado real.

### O visor de folha (modo selo) — o que mais precisa de olho

Solte PDFs de prancha. **Sem chave de IA a leitura de selo falha** — e é
esperado: as folhas entram no canvas com selo vazio, e o **Abrir** funciona
mesmo assim.

- [ ] Clicar **Abrir** num nó: a folha abre **enquadrada no carimbo**, não no
      topo da página.
- [ ] `←` `→` andam folha a folha **mantendo** o enquadramento.
- [ ] `S` alterna selo ↔ folha inteira. `Esc` fecha.
- [ ] Numa prancha sem âncoras de carimbo: mostra a **página inteira** e diz
      "carimbo não localizado nesta folha" em azul-informação. Ausência nunca
      vira conflito.

### Pins de achado no parecer

Precisa de uma auditoria concluída (**exige IA e banco** — pode não rodar
nesta máquina).

- [ ] Abrir "Ver no documento" num achado: **régua de pins** na margem esquerda.
- [ ] Cor por gravidade; o pin da página aberta **cresce** (3px→5px) em vez de
      mudar de cor.
- [ ] Achado sem página provável **não** vira pin.
- [ ] Clicar num pin leva à página.

## 4. Admin — `/admin` (token: o do seu `.env.local`)

**Estado de confiança: nenhuma destas telas tinha sido aberta**, e abrir a
primeira já cobrou o preço — ver o defeito abaixo. O resto continua conferido só
por compilador e leitura.

- [ ] **Digitar o token à mão funciona.** Estava quebrado: o recolhimento do
      token (`token && !editando`) fechava no PRIMEIRO caractere digitado, e o
      campo sumia com uma letra dentro — em todas as 7 telas. `tsc` e `eslint`
      passavam limpos. Corrigido em `admin-page-shell.tsx` (digitar agora conta
      como editar) e travado por `npm run prova:escritorio`.

- [ ] **Chanfro** em cartões, campos e nav — o admin deixa de parecer outro
      produto.
- [ ] Métrica com **algarismo tabular**: uma fileira de quatro cartões alinha em
      coluna (antes "1.204" e "87" dançavam).
- [ ] **Nav com os 7 links** visíveis num monitor largo. Estreite a janela: o
      "Mais" só aparece quando de fato não cabe.
- [ ] Ordem: Visão geral, **Consumo, Qualidade**, Auditorias, LDs, Usuários,
      Config. (Consumo e Qualidade estavam escondidos atrás de "Mais".)
- [ ] **Token recolhido**: `sessão admin · trocar · sair` no lugar do campo de
      senha. Em `/admin/usage`, o **seletor de período continua ali** — ele não é
      controle de autenticação e não pode sumir junto.
- [ ] `trocar` reabre o campo; `sair` limpa a sessão.
- [ ] **`/admin/users`**: "Tornar admin" pede confirmação **nomeando a pessoa**,
      na própria linha. Em lote, a pergunta **substitui** a barra de ações.
- [ ] A pergunta diz a **consequência** ("passam a ver custo, configuração de
      provedores, e a poder promover outras"), não a operação.
- [ ] **`/admin/usage`**: as barras do uso diário são **azuis**, e o texto abaixo
      não fala mais em "barras azuis" descrevendo barras teal.

## 5. Escritório emissor — `/admin/config` (A.9a)

**Estado de confiança:** o núcleo tem prova em node cru
(`npm run test:escritorio`, 10 casos) e a tela foi aberta no navegador
(`npm run prova:escritorio`, 10 conferências — precisa do servidor no ar com as
variáveis do escritório; o cabeçalho do script traz a linha pronta).

O que a regra faz: declarado o escritório, a linha dele é **subtraída** do texto
antes do casamento cidade→template. Sem escritório declarado, nada muda.

- [ ] A seção **Escritório emissor** é a primeira da tela, com os 6 campos.
- [ ] O selo à direita diz `não declarado` (azul-informação) numa base limpa.
- [ ] Sem `DATABASE_URL`: o botão fica **desabilitado** e o motivo aparece ao
      lado — não some sem explicação.
- [ ] Preencher só o município, sem UF: aparece o aviso e o salvar trava.
- [ ] Endereço impresso sem município: idem. Tudo **vazio** é válido.
- [ ] Com banco: salvar → o selo vira `declarado no painel` e aparece `salvo`.
- [ ] Sem banco, dá para semear pelo ambiente:
      `NEXODOC_ESCRITORIO_NOME`, `_ENDERECO`, `_MUNICIPIO`, `_UF`,
      `_RESPONSAVEL`, `_CREA` — o selo passa a dizer `vindo do ambiente`.

**A prova que interessa** (precisa de pranchas reais): um lote cujo carimbo
traga o endereço do escritório junto do órgão. Com o escritório declarado, a
prefeitura tem de casar pelo **cliente**, não pela cidade do escritório.

## 6. Câmbio e custo por obra — `/admin/config` + `/admin/usage` (A.7)

**Estado de confiança:** conversão e agrupamento com prova em node cru
(`npm run test:cambio`, 13 casos); as telas foram abertas
(`npm run prova:cambio`, 7 conferências). **A tabela por obra com linhas de
verdade nunca foi vista** — exige banco com consumo gravado.

A cotação é **declarada**, não buscada: cotação buscada envelhece em silêncio, e
o número que precifica o trabalho é o do contador, não o do mercado à vista.

- [ ] `/admin/config`: seção **Cotação do dólar**, com o selo dizendo de quando
      é o número (`cotação declarada há 3 dias: R$ 5,42 por US$ 1`).
- [ ] Digitar `5,42` **com vírgula** funciona. `5420` é recusado na hora.
- [ ] Campo vazio apaga a cotação — e o consumo volta a ficar só em dólar.
- [ ] Cotação com mais de 30 dias: o selo acrescenta **"vale revisar"**.
- [ ] `/admin/usage`: a **linha de procedência** aparece no topo, com link para
      Configurações, **mesmo quando a consulta à OpenAI falha**.
- [ ] Cartão **Gasto**: o `≈ R$` aparece colado no dólar, nunca no lugar dele.
- [ ] Sem cotação declarada: **nenhum real na tela** — nem `R$ 0,00`.
- [ ] Seção **Custo por obra**: a obra é a pasta da conversa; conversa fora de
      pasta vira obra de uma conversa só.
- [ ] Consumo **sem conversa** e de **conversa apagada** aparecem como linhas
      próprias, no fim da tabela, apagados. A soma da tabela tem de bater com o
      total do período — é por isso que eles não somem.
- [ ] Com mais de 500 eventos no período, aparece o selo **"amostra: os 500
      eventos mais recentes"**. Sem ele, a tabela leria como o mês inteiro.

O item "barras azuis" do A.7 **já estava feito** num commit anterior desta
branch (as barras são azuis e o texto não fala mais em teal).

## 7. Léxico e cor — espalhado

- [ ] **`/nexo`**, barra do parecer: a terceira vista chama-se **"Parecer"** (era
      "Relatório", dentro do próprio parecer).
- [ ] **`/projetos`** e **`/projetos/[id]`**: "Arquivos enviados" no lugar de
      "Uploads"; "conferir" no lugar de "validar".

---

## O que sabidamente NÃO funciona nesta validação

- Leitura de selo, auditoria, geração de documento — **exigem chave de IA**.
- Qualquer tela que consulte banco — **exige `DATABASE_URL`**.
- Isso não invalida o checklist: quase tudo acima é interface, e a interface
  responde sem os dois.

## O que ainda não foi feito

Ver `docs/superpowers/specs/2026-08-13-propostas-ux-ui-aprovadas.md` (lotes 2–12)
e `...-admin-aprovado.md` (A.4, A.6, A.8, A.9b, A.10).

O **A.9a** (seção 5) e o **A.7** (seção 6) saíram. O próximo da ordem do spec é
o **A.8** — Quality com série semanal e meta declarada.

Uma ressalva do A.7 que ficou registrada: a spec previa que o custo por obra
pudesse exigir schema. **Não exigiu.** `AiUsageEvent.conversationId` já era
gravado e a conversa já carrega a pasta — era uma junção que ninguém tinha
feito. O que entrou de schema foi só a cotação (`CambioConfig`).

Fica registrado o que o A.9a **não** fez: a cidade do escritório continua sendo
casável como cliente quando aparece sozinha, e é de propósito — apagá-la
destruiria o trabalho feito PARA a prefeitura da própria cidade. O caso
"escritório e cliente na mesma cidade" segue sendo pergunta ao engenheiro.
