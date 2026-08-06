# Briefing de redesenho — onde o Nexo está, e o que ainda incomoda

Escrito em 2026-08-06, conferido contra o código e contra os documentos reais do
escritório. Serve para retomar o desenho numa sessão à parte sem redescobrir o
que já foi decidido nem repropor o que acabou de ser consertado.

**Leve junto:** `PRODUCT.md` e `DESIGN.md` (530 linhas, é a lei). Este arquivo
não os repete — ele diz o que está construído, o que mudou e o que está aberto.

---

## 1. O que o software faz, sem marketing

Um engenheiro de escritório de projetos recebe dezenas ou centenas de pranchas em
PDF. Ele precisa entregar **volumes**: uma capa, uma folha separatriz e uma lista
de documentos (LD) por disciplina, mais as pranchas, em PDFs por tomo.

O Nexo lê o **carimbo** (selo) de cada prancha, descobre disciplina, obra,
código, revisão e número da folha, e produz esses documentos a partir de modelos
ODT por prefeitura. Também audita o memorial descritivo contra a obra declarada.

**O ciclo real:** soltar PDFs → ele lê os selos → propõe os documentos → o
engenheiro confere e corrige → gera → monta o volume → confere o volume montado.

---

## 2. As superfícies

O shell tem três colunas: `barra lateral (240px) | palco | copiloto (520px)`,
com divisor arrastável. Dois modos — **boas-vindas** (orbe e composer centrados)
e **ativo** (as três colunas).

| Superfície | O que é | Estado |
|---|---|---|
| **Entrada** | orbe, saudação, zona de solta, composer | revisada 2026-08-06 |
| **Copiloto** (direita) | a conversa + o card "Vou gerar" | o card virou o documento desenhado |
| **Palco** (centro) | canvas dos artefatos e folhas; auditoria em curso | **nunca revisado a fundo** |
| **Barra lateral** | marca, nova conversa, busca, histórico, rodapé | revisada 2026-08-06 |
| **Portões** | `/login`, `/sem-acesso` | revisados 2026-08-06 |
| **Fora do Nexo** | `/projetos`, `/volumes`, `/ferramentas`, `/admin` (6 telas) | **nunca revisadas** |

---

## 3. O que mudou nos últimos dias — não repropor

- **O card "Vou gerar" É o documento.** Deixou de ser lista de rótulo/valor: ele
  desenha a capa a partir do **modelo ODT real** (ordem, alinhamento e corpo saem
  do `content.xml`). Editar o modelo basta; o frame acompanha.
- **A LD entra empilhada** abaixo da capa, com as três primeiras folhas e a
  conferência do total contra o carimbo.
- **O título deixou de ser pergunta.** A disciplina sai do nome do arquivo e do
  carimbo, e cada uma tem nome padrão — a capa sugere uma linha por disciplina.
- **A marca é o orbe estático de vidro**, afinado por faixa de tamanho.
- **A entrada ganhou zona de solta**; o "beta" saiu da barra superior.
- **Sobreposições medem contra quem recorta**, nos dois eixos.

---

## 4. Invariantes — não se discutem sem decisão explícita

1. **Teal significa interativo.** Só. Nunca status, nunca decoração. Menos de
   10% de qualquer tela. Os três sinais (ok/atenção/crítico) são de status e
   nunca aparecem em controle.
2. **A separatriz existe para separar disciplinas dentro de um volume**, dizendo
   qual é qual. Regra rígida do escritório: N disciplinas = 1 capa + N
   separatrizes + N LDs.
3. **A capa usa o nome curto da disciplina; a separatriz e a LD usam o longo.**
   Sete das 24 divergem.
4. **Um orbe vivo por tela.** O da barra lateral respira só enquanto o agente
   trabalha — movimento significa estado, nunca decoração.
5. **Vidro só acima da linha d'água** (cromo). Dado é sempre matte.
6. **Vazio significa "vale o carimbo".** Valor derivado entra como texto
   fantasma, nunca como valor de campo — como valor, o campo não pode ser
   apagado.

---

## 5. O que eu vejo em aberto

Não é lista de tarefas: são perguntas de produto que o desenho não resolve
sozinho. Marcadas com o que já sei.

**a. O que uma "conversa" é.** No histórico, três conversas da mesma obra
aparecem como `REFORMA E AMPL…`, `REFORMA E AMPL…`, `REFORMA E AMPL…`. A pasta
já diz o código da obra, então o título repetir a obra não distingue nada — só a
data distingue. Uma conversa deveria se chamar pelo que **fez** (o volume, a
disciplina, a auditoria)?

**b. A entrada não tem noção de projeto.** O trabalho é organizado por projeto
(084-25, 040-26), e a barra lateral agrupa as conversas em pasta de obra **depois
que elas existem**. Mas quem entra cai numa conversa em branco. No dia a dia
ninguém começa do zero: continua um volume.

**c. O palco nunca foi desenhado como superfície.** Com duas folhas ele é 90%
grade vazia; com 71, não sei. E há duas fileiras cuja relação não está clara —
`TOMO 01` aparece vazia ao lado de `FORA DA DIVISÃO` com as folhas dentro.

**d. A largura do copiloto.** São 520px por spec, com divisor arrastável. Agora
que o card é o documento, o frame trabalha em ~413px úteis. O padrão ainda é o
certo?

**e. Fundir disciplinas não tem gesto.** O escritório às vezes emite uma
separatriz para duas (`PROJETO DE GEOMETRIA E TERRAPLENAGEM`). A regra existe,
tem teste e tem nome de par — falta o gesto, provavelmente no canvas.

**f. Estados de erro nunca foram olhados.** Falha de geração, falha de leitura de
selo, conversão de PDF indisponível.

---

## 6. Armadilhas técnicas que afetam o desenho

- A flag do Nexo é `NEXT_PUBLIC_*`: **embutida na compilação**, não é chave de
  tempo de execução.
- `size="sm"` do `Button` é letra morta — `min-h-10` vence, tudo mede 40px.
- `strokeWidth={1.5}` **não** é global como a §7 afirma; o padrão do lucide (2)
  vale em quem não declara.
- Regra de CSS fora de `@layer` vence as utilities do Tailwind e mata `border-*`
  em silêncio. Já aconteceu.

---

## 7. Como verificar qualquer proposta

Este projeto já perdeu tempo com auditoria que passa verde em coisa quebrada.
Três defeitos recentes só apareceram no print, e dois só ao ler o PDF gerado.

- **Painel:** medir a caixa contra a janela **e contra o container que recorta**.
- **Documento:** ler o PDF que sai, não o DOM.
- **Tela:** abrir o print, em duas larguras. Asserção nenhuma pega rótulo
  encavalando campo.

Moldes prontos em `scripts/shot-nexo-*.mjs` — todos encenam o servidor e não
gastam token.
