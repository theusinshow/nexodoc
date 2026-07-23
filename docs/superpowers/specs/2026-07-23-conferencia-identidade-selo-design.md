# Conferência de Identidade do Selo — Design

> Spec gerada por brainstorm (2026-07-23). Feature do módulo Nexo.
> Portão final sobre o volume fechado que confere se a identidade dos selos das
> pranchas bate com a prefeitura-alvo declarada, antes de emitir/enviar.

## 1. Problema e objetivo

O escritório teve prejuízo real recente: um projeto foi enviado a uma prefeitura
**com o logo/identidade de outra**. É um erro caríssimo quando passa até o fim.
Hoje a conferência leve (`checkSeloFacts`) compara código/obra/revisão/disciplina/
folhas entre pranchas, mas **não confere identidade** (órgão, endereço, data,
logo).

**Objetivo:** um **portão final sobre o volume fechado** que confere 4 dimensões
de identidade do selo contra a **prefeitura-alvo declarada** e barra a emissão
quando algo não bate — com destaque para o **logo**, a dor central.

**Não-objetivo:** conferir o conteúdo/desenho das pranchas (isso é outra coisa);
gerar ou alterar documentos; decidir o logo automaticamente.

## 2. Decisões travadas (do brainstorm)

1. **Roda no volume fechado** (portão final antes de emitir), não por prancha na
   entrada.
2. **Gabarito = prefeitura-alvo declarada** do projeto, **exibida e confirmada**
   no momento do check. NUNCA inferida da capa/documento (que pode estar
   contaminado — se a capa também está errada, inferir dela não pega o erro).
3. **4 dimensões:** órgão/prefeitura (nome), endereço, data, logo.
4. **Autoridade por dimensão** (princípio "afirma fatos, pergunta decisões"):
   - **nome / endereço / data** = fatos determinísticos → **veredito automático** ✓/✗.
   - **logo** = visual/fuzzy, custo altíssimo se errar → **sempre confirmação
     humana** (par carimbo ↔ referência lado a lado; nunca aprovado no escuro).
5. **Referência de comparação por dimensão:**
   - **nome** → gabarito (prefeitura-alvo).
   - **endereço / data** → **coerência interna** (todas as pranchas concordam
     entre si; pega a prancha intrusa de outra obra ou de revisão antiga). Sem
     gabarito externo na v1 (evolução futura: comparar contra endereço/data
     oficial registrado, se um dia existir confiável).
   - **logo** → logo de referência curado da prefeitura-alvo.

## 3. Mecânica

### 3.1 Logo de referência (curado uma vez)
Os templates de capa (`templates/capas/<pref>/modelo*.odt`) embutem o brasão de
cada prefeitura, mas várias imagens são compartilhadas (logo da PROSUL /
decoração) — então **não se auto-adivinha** qual Picture é o brasão. Processo:
extrair uma vez o brasão de cada prefeitura, **humano confere**, salvar como
asset de referência (ex.: `templates/logos/<pref>.png`) + mapa no registro de
templates. São ~5 prefeituras → curadoria barata e confiável. Esse conjunto é o
gabarito visual.

### 3.2 Motor de comparação — `checkSeloIdentity` (PURO)
Irmã da `checkSeloFacts`. Recebe os **fatos de identidade** lidos dos selos +
a prefeitura-alvo; devolve **veredito por dimensão** (nome/endereço/data ✓/✗ +
os itens que destoam) **+ a lista de pares de logo a confirmar**. Sem IO, sem
geração, sem decidir logo — só apura fatos e monta o que o humano precisa ver.
Testável com node cru (padrão `test:nexo:*`).

### 3.3 Campos novos do selo (extensão aditiva)
`endereco` e `data` entram no `StampExtraction` (schema JSON + prompt da rota
`extract-stamp`). O selo já lê `cliente` (=prefeitura/órgão) e `secretaria` →
o check de nome já é quase de graça. Extensão **aditiva** (não quebra quem já
consome o selo).

### 3.4 Custo em volume grande (decisão de perf)
- **Texto** (nome/endereço/data): reusa os selos **já lidos na sessão** (de graça
  se o volume foi montado no fluxo); se for volume "dropado" sem sessão, lê os
  selos das páginas.
- **Logo por visão** (caro): roda numa **amostra representativa**, porque o logo
  é do **volume inteiro** — o caso "tudo foi pra prefeitura errada" aparece em
  qualquer página. O caso "**uma prancha intrusa** de outra obra" **já é pego
  pelo texto** (endereço/data destoam). Assim não se gasta visão em 200 páginas.

### 3.5 Comparação do logo
Reusa o pipeline existente: o crop do carimbo já é renderizado no cliente e
enviado a um modelo de visão (a rota `extract-stamp` já é visual). Envia-se o
**crop do carimbo + a referência** perguntando "é este brasão?"; depois
**mostra-se o par para o humano confirmar**. A máquina só localiza e emparelha.

## 4. UI

Não é o canvas FigJam inteiro — é um **cartão de conferência focado**, na mesma
superfície conversacional:
- **Checklist das 4 dimensões:** nome ✓ / endereço ✓ / data ✓ / **logo: [confirmar]**.
- **Passo de confirmação visual do logo:** carimbo ↔ referência lado a lado,
  botões "bate / não bate".
- **Veredito final tipo semáforo:** 🟢 identidade OK / 🔴 revisar antes de emitir.
- Divergências de texto listam os **itens que destoam** (ex.: "p.88: endereço
  'Rua X, Xanxerê' difere das demais 'Rua Y, Chapecó'").

## 5. Estados de borda

| Estado | Tratamento |
|---|---|
| **Prefeitura-alvo não confirmada** | Bloqueia o check; pede confirmar o alvo primeiro. |
| **Logo de referência ausente** (prefeitura sem asset curado) | Degrada honesto: check de texto roda; logo vira "referência indisponível — confira manualmente". |
| **Selo sem endereço/data legível** | Campo marcado "não lido" (não conta como divergência). |
| **Modelo de visão off** | Logo cai para confirmação 100% manual (mostra só o crop do carimbo + referência, sem palpite). |
| **Nome diverge do alvo** | 🔴 crítico — é o caso "foi pra prefeitura errada". |
| **Intruso de texto** (1 prancha destoa) | Aviso apontando a página divergente. |

## 6. Reuso vs novo

**Reusar sem tocar:** `extract-stamp` (pipeline de selo visual; só estende schema),
`selo-render.ts` (crop do carimbo), o padrão de `checkSeloFacts` /
`light-check-core.ts`, o registro de templates.

**Novo:** `checkSeloIdentity` (função pura + teste), `endereco`/`data` no
`StampExtraction`, curadoria dos logos de referência + mapa, o passo de
comparação de logo por visão, o cartão de conferência + confirmação visual.

## 7. Plano (engine-first)

Motor congelado intocado (extensão só aditiva). Igual à auditoria visual:
- **Construível já:** `checkSeloIdentity` (puro) + extensão do `StampExtraction`.
- **Depois:** curadoria dos logos, passo de visão, UI de confirmação.
Feature própria, com seu próprio plano de implementação.

## 8. Riscos

- **Curadoria do logo de referência:** precisa de humano marcando o brasão certo
  por prefeitura (auto-extração pode pegar o logo da PROSUL). Mitigação: são ~5,
  faz-se uma vez.
- **Amostragem do logo:** checar amostra pode, em teoria, perder uma prancha
  intrusa com logo trocado mas texto certo (raro). Mitigação: o texto pega a
  maioria dos intrusos; documentar o limite; permitir "checar todas" sob demanda.
- **Leitura de endereço/data pelo OCR:** campos novos podem vir ruidosos.
  Mitigação: "não lido" não conta como divergência; coerência tolera ausências.
