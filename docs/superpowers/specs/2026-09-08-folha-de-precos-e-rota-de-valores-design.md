# A folha de preços e a rota dos valores

> **Decidido em 08/09/2026.** O deck ganha uma folha sobre preço que **não
> mostra preço** — mostra um botão. O botão abre `/apresentacao/valores`, uma
> apresentação separada de três folhas onde o valor finalmente aparece, ancorado
> no custo de construção e não no retorno mensal.

Este documento é o **desvio** de
`docs/superpowers/specs/2026-08-24-apresentacao-diretoria-design.md`, que
continua sendo a autoridade sobre o resto do deck. Onde os dois se contradizem,
este vence — e a seção do anexo naquele arquivo foi reescrita para apontar
para cá.

---

## A decisão que está sendo revertida, e por quê

O deck nasceu com uma regra explícita, escrita em três lugares
(`app/apresentacao/page.tsx`, `app/apresentacao/slides.tsx`, e o spec de
24/08):

> O anexo não mora aqui. Uma seta a mais no fim do deck não pode revelar a
> proposta comercial antes da hora.

O que essa regra protegia era o **momento**: o preço não pode escapar por
acidente, no meio de um argumento que ainda não terminou. O que ela custava era
o **alcance**: o valor vivia num arquivo `.html` solto em `docs/`, que o
`.dockerignore` exclui de produção — ou seja, num computador só, e não na
máquina de onde a apresentação de fato roda.

**A folha com botão preserva o momento e devolve o alcance.** Nada de valor
aparece por avançar a seta: a folha 21 mostra um título e um botão, e o botão
é um gesto deliberado — a mão sai do teclado e vai ao mouse, que é exatamente a
fricção que a regra antiga queria. A diferença é que agora o destino existe no
mesmo aplicativo, atrás do mesmo portão de admin, e sobrevive ao deploy.

---

## A âncora do preço: construção, nunca retorno mensal

Este é o ponto que decide o conteúdo da folha B, e ele apareceu ao somar os
números que já estão no deck:

| Número | Onde vive hoje | Quanto |
|---|---|---|
| Operar por mês | folha 12, medido | R$ 285 |
| Construir | folha 13, medido + estimativa | R$ 24.600 a 38.600 |
| O episódio devolvido | folha 14, medido | R$ 3.600 a 6.480 |
| Teto de licença mensal | **notas da folha 14, fora da tela** | ≈ R$ 500/mês |
| O piloto | anexo, fora do deck | R$ 10.000 / 6 meses |

R$ 10.000 em seis meses é **R$ 1.667 por mês** — 3,3× o teto de ~R$ 500 que a
folha 14 constrói. Se a página de valores puser as duas contas lado a lado, ela
arma o argumento contra o próprio preço, e o faz com números do próprio autor.

**A conta de retorno mensal fica FORA da página de valores.** Ela existe no
deck, ela continua nas notas da folha 14, e o diretor a deduz sozinho — que é o
que a decisão de 31/08 já queria. O que a folha B mostra é a outra âncora, a que
a folha 13 já enunciou em voz alta:

> O piloto não compra seis meses de acesso. Compra o que já está construído.

Contra R$ 24.600 a 38.600, o pedido de R$ 10.000 é **menos de metade**. Essa é a
única leitura que a folha B faz.

---

## As peças

### 1. A folha 21 do deck — "Quanto custa usar"

- **Bloco:** `O dinheiro`. O rótulo reaparece de propósito depois de "As
  perguntas difíceis": ele avisa a sala de que a conversa voltou ao dinheiro.
- **Posição:** logo após a folha 20 ("Então compramos você"). A objeção do valor
  acabou de ser respondida, e é onde a nota da folha 20 já mandava abrir o
  anexo. As antigas 21 e 22 passam a 22 e 23; o deck fecha em **23 folhas**, com
  "O que ela não é" ainda por último — a última coisa que a sala ouve continua
  sendo o limite, e não o preço.
- **Na tela:** título, uma linha de corpo, um botão. **Nenhuma cifra.**
- **O botão** abre `/apresentacao/valores` em aba nova (`target="_blank"`).
  Fechar com `Ctrl+W` devolve o deck na folha 21, ainda em tela cheia, com o
  índice intacto. Navegar na mesma aba perderia a posição em 21 de 23.

### 2. A rota `/apresentacao/valores`

Mesmo motor (`Palco`), mesmo `palco.css`, mesmo portão de admin, mesma
`robots: noindex`. Três folhas:

- **A — O piloto.** Modalidade, prazo de 6 meses, **R$ 10.000**, o que inclui, o
  que não inclui, e o fecho dos seis meses. É o anexo A que já existia.
- **B — De onde sai esse número.** Construir (R$ 24.600 a 38.600, com
  `estimativa` em âmbar sobre a hora de dev), o episódio devolvido (R$ 3.600 a
  6.480), operar (R$ 285/mês). Fecho: o piloto pede menos de metade do que já
  foi construído.
- **C — Propriedade.** A declaração de autoria, uma frase, sem defensiva.

**Numeradas A · B · C**, e não 01..03. Um "01" ali dentro faria a página parecer
o começo de outro deck; a letra diz que é anexo.

### 3. `docs/anexo-proposta.html` é apagado

Ele passaria a repetir R$ 10.000 e a lista de inclusões num segundo lugar. A
regra do topo de `slides.tsx` é que um número desencontrado entre duas folhas
contamina os que estão certos, e duas fontes para o mesmo valor é como esse
desencontro nasce. A rota substitui; a cópia offline cobre o pen drive.

### 4. A cópia offline aprende o botão

`npm run apresentacao:offline` hoje serializa só `/apresentacao`. Com a folha
nova, o arquivo do pen drive sairia com um **link morto** — e só se descobriria
isso na sala, sem rede, que é precisamente o modo de falhar que aquele gerador
inteiro existe para evitar.

O gerador passa a:

1. capturar também as três folhas de `/apresentacao/valores`;
2. anexá-las ao fim do arquivo, depois da folha 23;
3. reescrever o `href` do botão para um **salto interno** ao índice da folha A;
4. **falhar** se o botão sobrar sem destino, do mesmo jeito que já falha quando
   sobra endereço de servidor.

As folhas de valores não entram na contagem visível do rodapé — chegar nelas
pelo `End` seria a seta a mais que a regra antiga proíbe. O motor offline ganha
um limite de navegação: `←`/`→` param na folha 23, e as de valores só se
alcançam pelo botão.

---

## O que NÃO muda

- O deck continua sem cifra nenhuma da folha 01 à 20.
- As notas da folha 20 continuam guardando o piso (seis meses por R$ 10.000) e
  a moeda de troca (custódia do código, em troca de prazo e nunca de desconto).
- A folha 22 (ex-21, "O que pode vir") e a 23 (ex-22, "O que ela não é")
  continuam no fim, nessa ordem.
- A rota fica fora da barra lateral, como a `/apresentacao`.

## Verificação

Nenhum destes é opcional; cada um já derrubou uma folha deste deck.

- [ ] Medir a caixa da folha 21 e das três folhas de valores contra 1080px,
      **esperando por asserção de opacidade e não por tempo** — captura no meio
      da animação devolve folha em branco que a asserção de DOM aprova.
- [ ] Abrir o botão e conferir que o deck permanece na 21 ao voltar.
- [ ] Rodar `npm run apresentacao:offline` e conferir do disco: 23 folhas na
      régua, o botão saltando para a folha A, e `End` parando na 23.
- [ ] Conferir que a cotação do dólar (R$ 5,18) continua a mesma nas folhas 12,
      13, 14 e na folha B dos valores. Mudou a cotação, mudam os cinco números.
