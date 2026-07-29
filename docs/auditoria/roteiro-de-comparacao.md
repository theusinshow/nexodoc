# Roteiro: julgar a auditoria e comparar com o ChatGPT

**Para que serve:** transformar impressão em régua. Hoje as métricas de precisão e
recall são de fixtures sintéticas — elas provam que as regras fazem o que foi
codado, não que o produto acerta em documento real. Este roteiro produz o número
que falta, e o resultado preenchido vira gabarito versionado.

**Quem faz o quê:** a máquina diz o que encontrou; só o engenheiro diz se é
verdade. É por isso que esta parte não dá para automatizar.

---

## 0. Antes de começar

- [ ] `npm run dev` rodando, e a porta 3000 é do **nexodoc** (já houve confusão com
      outro projeto na mesma porta).
- [ ] Escolha o memorial. **Sugestão: 040-26** — é o caso em que o ChatGPT ganhou
      na comparação de 17/07. Ganhar no caso fácil não ensina nada.
- [ ] Tenha em mãos a **obra correta** (o nome como consta na capa). Sem isso a
      regra de identidade não tem baseline e o teste fica mais fraco do que o
      produto é.
- [ ] Nível **Profundo**. No Padrão a IA lê ~90k caracteres; no Profundo lê o
      documento inteiro, e é o Profundo que está sendo avaliado.

---

## 1. O que olhar na execução

| O quê | Onde | Por que importa |
|---|---|---|
| Veredito no topo | Herói do resultado | Se disser **ANÁLISE PARCIAL**, uma etapa abortou: **descarte a rodada** e rode de novo. Comparar uma análise incompleta contra o ChatGPT não mede nada |
| Tempo total | "N achados em 1 arquivo · Xs" | O Profundo leva ~3 a 6 min. Muito abaixo disso é sinal de que algo foi pulado |
| Contagens | Inconsistências críticas / Pontos de revisão | É o que decide emissão. O resto é contexto |
| Matriz por disciplina | Aba Achados | Mostra se a cobertura é ampla ou concentrada num capítulo |

**Anote também o que incomodar na tela.** Dois pontos já conhecidos, para
confirmar se atrapalham na prática:

- a etiqueta de status diz "aguardando envio" **enquanto a análise roda**;
- o rótulo "◻ Sugerido" significa duas coisas diferentes: na lista principal é
  "veio da IA", na camada recolhível é "rebaixado por baixa confiança".

---

## 2. Como julgar cada achado

Para **cada** achado, uma marca:

- **V — verdadeiro**: existe no documento e você agiria antes de emitir.
- **F — falso**: não existe, ou a leitura está errada. Anote em uma linha *por
  que* é falso — essa frase é o que vira regra ou trava depois.
- **I — irrelevante**: existe, mas ninguém agiria. Não é erro do motor; é ruído.

Ao julgar, confira três coisas no próprio achado:

1. **A evidência está ancorada?** O trecho citado existe mesmo no documento
   (use "Abrir PDF" no menu `⋯` do achado — ele pula para a página e destaca o
   termo).
2. **A página está certa?**
3. **O selo bate?** "✔ Verificado" é achado de regra determinística; "◻ Sugerido"
   veio da IA. Um erro num "Verificado" é mais grave: significa regra errada,
   não palpite.

> Se forem 30 achados e o tempo for curto, julgue primeiro os **críticos** e os
> **pontos de revisão** — são os que decidem emissão.

---

## 3. O mesmo documento no ChatGPT

Para a disputa ser justa, peça a mesma coisa. Prompt sugerido:

```
Você é auditor de documentação técnica de engenharia civil.
Analise este memorial descritivo e aponte:
1. Identidade divergente: nome de obra, unidade, município ou endereço que
   não pertençam a esta obra (texto reaproveitado de outro projeto).
2. Contradições entre capítulos distantes (hierarquia de prevalência,
   responsabilidade por serviços, escopo de construção x reforma).
3. Erros numéricos e de unidade (áreas, quantidades, cm x m).
4. Especificações incompatíveis entre si.

Para cada achado, diga: o trecho exato, a página, por que é um problema, e
o que fazer. Não invente: se não tiver certeza, diga que não tem.
```

Registre a resposta e julgue com o **mesmo** critério V/F/I. Sem isso a comparação
premia quem escreve mais bonito, não quem acerta mais.

---

## 4. A comparação que importa

Preencha:

| Métrica | Nexodoc | ChatGPT |
|---|---|---|
| Achados totais | | |
| **V** (verdadeiros) | | |
| **F** (falsos) | | |
| **I** (irrelevantes) | | |
| Verdadeiros que **só ele** pegou | | |
| Falsos que **só ele** inventou | | |
| Acertou o veredito de emissão? | | |

**O número que decide** é o penúltimo par. Achado verdadeiro exclusivo é o que
justifica o produto existir; falso exclusivo é o que destrói confiança — e
confiança perdida por alucinação foi o motivo do abandono anterior do projeto.

Registre também: **quanto tempo você levou para julgar**. Se auditar o relatório
custa mais que ler o memorial, o produto não economiza trabalho.

---

## 5. O que fazer com o resultado

- **Se o Nexodoc ganhar em verdadeiros exclusivos:** vira material de venda, e o
  gabarito deste memorial entra no repositório como caso de regressão.
- **Se perder:** os falsos e as ausências dizem exatamente onde atacar — regra
  nova (fato objetivo que tem de bater) ou prompt (contexto). A divisão de
  trabalho já decidida: regra = fato objetivo; IA = context-dependente.
- **Em qualquer caso:** os achados marcados **F** viram fixtures negativas em
  `scripts/audit-precision-recall.ts`, e aí a métrica passa a medir documento
  real em vez de sintético.
