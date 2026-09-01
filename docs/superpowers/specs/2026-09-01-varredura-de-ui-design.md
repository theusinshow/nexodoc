# Varredura de UI

**Data:** 2026-09-01
**Estado:** desenho aprovado, não implementado
**Sub-projeto 6 de 6** da revisão integrada pedida em 01/09/2026.

---

## O defeito relatado, e o que a medição diz

O pedido citava *"dropdowns com texto branco em fundo branco"*. Perguntado, o
Matheus confirmou: é a **lista que abre ao clicar na seta** — o popup nativo do
`<select>` —, e acontece em **vários lugares** do produto.

Medido no navegador em 01/09/2026, em `/admin/users`:

```
docColorScheme:     "normal"          ← o DOCUMENTO não declara esquema nenhum
selectColorScheme:  "dark"            ← só o primitivo Select declara, inline
optionBg:           rgb(18, 21, 24)   ← a regra `select option` resolve certo
optionColor:        rgb(225, 231, 234)
```

**Uma causa explica "vários, em diversas partes":** o documento não diz ao
navegador que o produto é escuro. Toda superfície nativa que o app não pinta é
desenhada clara, e o texto que ela herda é claro.

Isso alcança o popup de `<datalist>` (dois lugares: `FolhaNode.tsx:551` e
`app/admin/config/page.tsx:635`), a barra de rolagem, o preenchimento automático
do navegador, as setas de `type="number"`, o seletor de `type="color"` e o botão
de `type="file"`.

E é **decisão adiada**, escrita em `components/ui/select.tsx:25`:

> *"Fica aqui, e não global, para o raio de alcance ser este componente — mudar
> o esquema do documento inteiro mexeria também em barra de rolagem e em todo
> controle nativo, o que é outra decisão."*

Esta é essa outra decisão.

## O limite honesto deste trabalho

**O popup nativo do `<select>` não é capturável por automação.** Ele é desenhado
fora da página; o Playwright não o fotografa e nenhuma asserção de DOM o alcança.

Está verificado que o CSS resolve certo. O que **não** está — e não pode ser, por
nós — é como o Chrome do Matheus o pinta. Por isso o desenho ataca todos os
mecanismos plausíveis de uma vez, e a confirmação final é **manual, por ele**.

Nenhuma prova deste sub-projeto deve alegar ter visto o popup.

---

## O desenho

### Seção 1 — O documento declara que é escuro

`color-scheme: dark` no `:root` de `app/globals.css`.

O produto é escuro-único: há **um** `:root`, sem tema claro e sem
`prefers-color-scheme`. Declarar o esquema é dizer ao navegador a verdade que o
CSS já pratica.

A ressalva do comentário do `Select` — *"mexeria também em barra de rolagem e em
todo controle nativo"* — descreve o resultado **pretendido**, não um risco: um
app escuro com barra de rolagem clara é o defeito, não o cuidado. Aprovado pelo
Matheus sabendo disso.

O `style={{ colorScheme: "dark" }}` do primitivo **fica**. Ele deixou de ser a
única defesa e passa a ser redundante — e redundância aqui é barata: se alguém um
dia mexer no `:root`, o controle continua declarando o próprio esquema.

### Seção 2 — A regra do popup para de depender de `var()`

`app/globals.css:449` hoje:

```css
select option {
  background-color: var(--card);
  color: var(--foreground);
}
```

Passa a usar **os valores literais**, com o token citado em comentário, e passa a
cobrir também `optgroup` — que a regra atual não alcança, e que o seletor de
destinatário do parecer usa (`audit-result.tsx`).

**Por que literal:** o popup é uma superfície que o app **não possui**, e há
precedente registrado no projeto para exatamente isso. `lib/aviso-de-achados.ts`
declara a paleta do e-mail em hex cru com esta justificativa:

> *"Repetida aqui como literal, e NÃO lida dos tokens CSS: cliente de e-mail não
> resolve `var()`, e um token que chegasse cru pintaria texto de preto sobre
> preto."*

O mesmo raciocínio, outra superfície. Se o popup do Chrome não resolver a
variável, `background-color` cai para o padrão claro enquanto `color` continua
herdando o claro da página — que é **exatamente** o branco-no-branco relatado.

O valor literal e o token **não podem divergir em silêncio**: a prova de tokens
passa a conferir que o hex escrito na regra é o mesmo de `--card` e
`--foreground`.

### Seção 3 — O medidor de dívida passa a ver cor

`npm run mede:divida` existe, cobre **cinco arquivos** e só espaçamento e escala
tipográfica. Achou 2 violações. **Não olha cor nenhuma.**

Passa a acusar hex cru em arquivo de UI, e o alcance cresce dos cinco frames para
`components/` e `modules/nexo/components/`.

**Três exclusões, e cada uma tem motivo:**

- `components/brand/*` — a marca. Cor ali é a identidade, não estilo.
- `modules/nexo/components/agent-orb/*` — WebGL. Cor é dado que vai para o
  shader, não classe de CSS.
- `app/bancada-*` — bancadas de afinação. Elas existem para experimentar valor
  cru; um fiscal ali proibiria o que a tela é.

Medido antes de escrever isto: **77 ocorrências de hex** em 12 arquivos, e boa
parte cai nessas três exclusões.

### Seção 4 — O contraste vira número, e o limite é o da casa

`DESIGN.md:431` já fixa: **texto ≥ 4,5:1**. `DESIGN.md:926` já fixa: campo
desabilitado cai a **50%**.

A prova lê as cores **computadas** dos primitivos em cada estado — normal, hover,
selecionado, desabilitado — e reprova o que não alcançar a razão. Nada de olhar
captura: é `getComputedStyle` e aritmética de luminância relativa.

Cobre os primitivos que a lista do pedido nomeia: `Button` (todas as variantes),
`Chip`, `Badge`, `Input`, `Select`, `Textarea` e o item do `Dropdown`.

**O desabilitado é medido contra a regra da casa, não contra 4,5:1.** Um controle
a 50% de opacidade não deve alcançar contraste de texto ativo — se alcançasse,
não pareceria desabilitado. A prova confere que ele está **abaixo** do normal e
**acima** de invisível.

### Seção 5 — Corrigir o que o medidor acusar, e só isso

Sem varredura de 77 hexadecimais no escuro. O medidor aponta, a lista é finita, e
cada correção troca o hex pelo token que já existe.

**Se algum hex não tiver token correspondente**, ele NÃO vira token novo aqui:
`DESIGN.md:283` cobra nome, trabalho declarado, entrada na tabela e
`npm run prova:tokens` para admitir cor nova. Um hex sem token é uma pergunta
para o design system, e ela fica registrada em vez de ser respondida de afogadilho.

### Seção 6 — Como se prova

**Puro, em node cru:**

- `contraste(a, b)` — a razão entre duas cores, pela fórmula de luminância
  relativa. Casos conhecidos: branco sobre preto é 21:1; a mesma cor contra ela
  mesma é 1:1; a ordem dos argumentos não muda o resultado.

**Ferramenta, contra o próprio código:**

- `mede:divida` acusa um hex plantado num arquivo de UI, e **não** acusa o mesmo
  hex em `components/brand/`.
- `prova:tokens` acusa quando o literal da regra do popup diverge do token.

**Navegador, medindo os estados:**

- cada primitivo, em cada estado, com a razão impressa e comparada a 4,5:1;
- o `:root` declara `color-scheme: dark`.

**Manual, e declarado como manual:** abrir uma lista de `<select>` — o seletor de
destinatário do parecer serve — e confirmar a olho que o popup está escuro. É a
única verificação deste sub-projeto que uma pessoa precisa fazer, e ela existe
porque a automação **não alcança** essa superfície.

---

## O que este sub-projeto NÃO faz

- **Não cria cor nem token novo.** Hex sem token vira registro, não vira token.
- **Não redesenha componente nenhum.** Contraste e estado, não forma.
- **Não toca a marca, o WebGL nem as bancadas.** Cor ali é conteúdo.
- **Não promete ter visto o popup nativo.** Ver a Seção "O limite honesto".

## Riscos aceitos

- **As barras de rolagem do produto inteiro escurecem.** É o efeito pretendido do
  `color-scheme: dark`, e foi aprovado sabendo disso. Se alguma tela depender da
  barra clara para leitura, isso aparece — e é informação, não regressão.
- **O medidor de cor pode acusar hex legítimo** fora das três exclusões. A
  correção é acrescentar a exclusão **com o motivo escrito**, e não afrouxar a
  regra.
- **A correção do popup pode não bastar.** Se o Chrome do Matheus continuar
  pintando claro depois disto, o mecanismo é outro e a investigação recomeça —
  com a vantagem de que `color-scheme` e o literal já terão sido eliminados como
  suspeitos.
