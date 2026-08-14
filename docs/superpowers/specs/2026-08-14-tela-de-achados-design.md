# Tela de achados — descrição de design

> **Para que serve este documento:** descrever como o achado deve ser
> apresentado e como os textos dele devem ser escritos, com detalhe suficiente
> para o desenho visual e o ajuste do motor saírem daqui. Não é plano de
> implementação e não contém código.

**Data:** 14/08/2026
**Decisões tomadas por:** Matheus (mantenedor)
**Companheiro:** `2026-08-14-painel-do-usuario-design.md`

---

## 1. O problema, em uma frase

A tela mostra "página 8" para um achado que vive nas páginas 8, 60, 71 e 105 —
e os três textos que explicam o achado dizem a mesma coisa três vezes, sem dizer
o que acontece se ninguém corrigir.

---

## 2. Diagnóstico

### 2.1 As páginas cruzadas existem, e a tela descarta

O motor tem uma regra explícita de **não** juntar ocorrências: *"UMA OCORRÊNCIA,
UM ACHADO. (…) NUNCA junte várias numa frase só ('pág. 8 …; pág. 23 …')"*. Ele
abre exceção só quando **uma decisão resolve todas** — convenção de unidade,
nomenclatura, regra de prevalência.

Nessa exceção, as páginas **são** capturadas: as regras determinísticas escrevem
em `referencia_comparada` frases como *"Identidade predominante: X (7
ocorrências, páginas 8, 60, 71, 105)"*.

E então a tela joga fora. Em `components/audit-result.tsx:2736`:

```
{finding.conflito || finding.referencia}
```

Como `conflito` quase sempre está preenchido, `referencia_comparada` — onde estão
as outras páginas — **nunca chega ao olho de ninguém**. O dado foi calculado e
descartado por um operador lógico.

**Consequência real:** quem lê corrige a página 8, marca como resolvido, e o
documento continua errado em três lugares.

### 2.2 Os textos não têm instrução

As instruções que o motor recebe para os três campos de texto são:

| Campo | Instrução atual |
|---|---|
| `descricao` | "descrição objetiva" |
| `conflito` | "por que diverge" |
| `sugestao_correcao` | "correção sugerida" |

São **rótulos, não especificações**. Nada sobre tamanho, estrutura, público, ou o
que faz uma boa resposta. O modelo improvisa — e improvisa diferente a cada
chamada.

No mesmo JSON, um campo vizinho tem instrução de verdade — *"menor trecho exato
para localizar no PDF via Ctrl+F"* — e produz resultado consistente. A diferença
de qualidade entre os campos acompanha a diferença de instrução.

### 2.3 A causa estrutural da bagunça visual

`components/audit-result.tsx` tem **2.810 linhas** e **23 estados** no componente
principal. O segundo maior arquivo de `components/` tem 146 linhas.

O arquivo faz cinco trabalhos ao mesmo tempo: interpretar o parecer, gerar texto
para exportar, ser o visualizador de PDF, ser a fila de atribuição, e desenhar a
tela. Quando cinco responsabilidades moram juntas, ninguém enxerga a tela inteira
de uma vez — e cada função nova vira mais um controle empilhado num canto.

**A bagunça visual é o sintoma; o arquivo é a causa.** Esta observação não é
escopo deste documento, mas quem for implementar o que está descrito aqui vai
esbarrar nela.

---

## 3. O cartão de achado

### 3.1 Achado de um lugar só — não muda

Sem fita de páginas, sem "ver trechos", etiqueta com o número da página como
hoje. A novidade só aparece quando há mais de um lugar; do contrário, 90% dos
cartões ganhariam enfeite.

### 3.2 Achado de vários lugares — fechado

É o estado que a pessoa vê na lista. Precisa ser **varrível**: numa auditoria com
30 achados, quatro linhas de trecho em cada um viram 120 linhas e ninguém acha
nada.

**Anatomia, de cima para baixo:**

- **Título** do achado, e à direita a etiqueta — que passa a dizer **"4 páginas"**
  em vez de "página 8". Esta é a mudança mais barata da tela e a que mais muda
  comportamento: avisa, antes de qualquer texto, que corrigir um lugar não
  encerra o assunto.
- **O que está errado** — uma frase.
- **Onde aparece** — a fita: a página principal em destaque, as demais ao lado.
  Cada número é clicável e abre o PDF naquela página, com o trecho realçado.
- **Por que importa** — uma frase.
- **O que fazer** — uma frase.
- **"▸ ver os trechos de cada página"** — só aparece quando os trechos existem.

### 3.3 Achado de vários lugares — aberto

O mesmo cartão, com um bloco **Trechos** entre a fita e a ação. Uma linha por
ocorrência: número da página (clicável) e o texto encontrado ali, com o termo
divergente em destaque.

Serve para a pessoa ver o padrão sem abrir o PDF quatro vezes.

### 3.4 A ordem de entrega, que este desenho permite

A fita usa dado **que já existe e está sendo descartado** — entrega sem tocar em
prompt nenhum. Os trechos exigem que regra e IA passem a devolver uma ocorrência
por linha.

Com este desenho, o segundo chega depois **sem redesenhar nada**: o cartão
fechado é idêntico, e "ver os trechos" apenas não aparece nos achados que ainda
não têm.

---

## 4. Os três textos

Sem campo novo e sem mudança de banco. Os três campos já existem e a tela já os
renderiza. O que muda é **a instrução no motor** e **o rótulo na tela**, para o
leitor saber qual pergunta cada bloco responde.

### 4.1 O que está errado (`descricao`)

Só o **fato observável**, como um fiscal anotaria. Sem "foi identificado", sem
"verifica-se que", sem adjetivo. Uma frase.

Teste: se dá para discordar do fato, ele está escrito errado.

- ❌ "Foi identificada inconsistência na utilização de unidades de medida ao
  longo do documento."
- ✅ "'m²' e 'metros quadrados' aparecem no mesmo documento, em 11 lugares."

### 4.2 Por que importa (`conflito`)

A **consequência concreta** de deixar como está: quem reprova, o que atrasa, o
que se paga a mais. Uma frase.

É o campo que hoje não existe de verdade — e é o único que faz a pessoa decidir
se corrige agora ou depois.

- ❌ "As unidades divergem entre si." (repete o fato)
- ✅ "A prefeitura devolve memorial com unidade inconsistente na análise de
  conformidade — atrasa a aprovação."

Quando a consequência for apenas editorial, dizer isso com todas as letras em vez
de inflar.

### 4.3 O que fazer (`sugestao_correcao`)

Ação executável, **com o valor decidido quando o documento permitir decidir**.

- ❌ "Recomenda-se padronizar as unidades de medida."
- ✅ "Adotar 'm²' nas 4 ocorrências por extenso. É a forma predominante: 7 das 11."

Quando os dados **não** permitirem escolher, dizer o que conferir e com quem —
nunca inventar o valor certo.

### 4.4 O freio, que precisa vir junto

Pedir "a consequência concreta" convida o modelo a **inventar consequência** — a
afirmar que a prefeitura reprova quando ninguém verificou isso.

A instrução precisa trazer o limite no mesmo fôlego: **sem base para afirmar a
consequência, escrever a que se sustenta** ("divergência interna do documento")
em vez da que impressiona. O campo de confiança continua sendo o lugar de admitir
dúvida.

---

## 5. Rótulos na tela

Os blocos passam a ser rotulados pela pergunta que respondem, e não pelo nome
técnico do campo:

| Campo | Rótulo hoje | Rótulo novo |
|---|---|---|
| `descricao` | (sem rótulo, texto solto) | **O que está errado** |
| `conflito` | "Conflito" | **Por que importa** |
| `sugestao_correcao` | "Ação recomendada" | **O que fazer** |
| páginas | "Página" | **Onde aparece** |

---

## 6. Custo

**A instrução vive na entrada.** Descrever bem os três campos custa algumas
centenas de tokens de prompt, uma vez por chamada. Entrada é a parte barata;
saída é a cara.

**A saída encolhe.** "Foi identificada inconsistência na utilização de unidades
de medida ao longo do documento" é mais longo que a versão boa — e diz menos.
Enrolação é o que se paga hoje. Limitar cada campo a uma frase corta exatamente a
parte cara.

**A fita de páginas custa zero de IA.** As regras determinísticas já contam as
páginas; só o achado vindo da IA precisaria passar a devolver o campo em forma de
lista.

---

## 7. O que não muda

- o schema do banco e os campos do parecer;
- a regra "uma ocorrência, um achado" do motor — ela continua valendo, e é
  justamente ela que torna o achado multi-lugar uma exceção significativa;
- pareceres já gravados: sem trechos e possivelmente sem lista de páginas, eles
  aparecem como achado de um lugar só, que é o que sempre foram.

---

## 8. Em aberto

1. **Quantas páginas cabem na fita antes de virar "e mais 6".** Um achado que
   aparece em 30 lugares não pode empurrar o resto do cartão para fora da tela.
2. **Se o trecho de cada ocorrência vem da regra, da IA, ou dos dois.** As regras
   determinísticas conseguem extraí-lo sem custo; a IA precisaria devolver um
   item por ocorrência.
3. **Se "por que importa" deve variar por prefeitura.** A consequência real
   depende de quem analisa — e o sistema já conhece as exigências de quatro
   prefeituras.
