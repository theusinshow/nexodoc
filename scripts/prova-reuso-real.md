# Prova do reuso, com token — roda UMA vez

Os testes automatizados cobrem a decisão. Isto cobre o dinheiro.

**Antes de começar:** `NEXODOC_AUDIT_COBERTURA_TOTAL` precisa ter o MESMO valor
nas duas corridas. Mudá-la entre elas troca a versão do auditor e invalida o
reuso — de propósito. Isso também é uma prova válida, mas de outra coisa.

Use um memorial **pequeno**. O objetivo é provar o mecanismo, não a escala.

---

## 1. Primeira auditoria (a base)

Rode normalmente pelo Nexo, com um memorial pequeno
(ex.: `113_22_md_geral_a.pdf`).

Confira no log:

```
[audit] sem reuso: Primeira auditoria deste memorial: não há parecer anterior para comparar.
```

Anote o custo:

```bash
node scripts/gasto-da-auditoria.ts
```

## 2. Altere UM capítulo

Abra o PDF, mude uma frase de um capítulo do meio e salve **com o mesmo nome**.
O nome é o único elo entre as duas impressões digitais — arquivo com outro nome
cai em `outro-arquivo` e não reusa.

## 3. Segunda auditoria (a que economiza)

Rode de novo, **na mesma conversa**. O `auditIdAnterior` sai dali.

Confira no log:

```
[audit] reuso: N capítulo(s) para reler, M herdado(s), K achado(s) herdado(s)
```

Confira no parecer:

- a faixa **"Reauditoria — N capítulos relidos…"** no topo;
- o selo **`herdado · DD/MM`** em pelo menos um cartão;
- a página do achado herdado apontando para o lugar certo no documento novo.

Anote o custo de novo. **Esperado:** uma fração da primeira, e a diferença sai de
`audit-chunk` e `audit-global`.

## 4. Terceira corrida, sem alterar nada

Deve **recusar**, sem gastar:

> O documento é idêntico ao que foi auditado em DD/MM. Não há o que auditar.

Confirme que **nenhum evento novo** apareceu em `AiUsageEvent`. Se apareceu,
alguma passada rodou antes da recusa — e a recusa tem de vir antes de tudo.

## 5. O caso que NÃO pode recusar

Mude qualquer coisa que entre na versão do auditor — o mais fácil é
`NEXODOC_AUDIT_MEMORIAL_DEEP_CHUNK_MODEL` — e rode de novo com o documento
idêntico.

Deve **auditar inteiro**, não recusar:

```
[audit] sem reuso: O auditor mudou desde o parecer anterior (prompt, modelo ou recorte), então o documento foi lido inteiro.
```

É o portão que impede uma melhoria de prompt de nunca alcançar os memoriais já
auditados. Se esta corrida recusar, o reuso está preso ao passado.
