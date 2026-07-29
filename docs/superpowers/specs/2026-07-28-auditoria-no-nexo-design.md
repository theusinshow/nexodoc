# Auditoria dentro do Nexo — arquitetura

**Data:** 2026-07-28
**Estado:** desenho aprovado nas decisões; pendente de revisão do spec

A auditoria de memorial deixa de ter tela própria e passa a ser conversada no
Nexo. Motivo do usuário: **é mais fácil de usar e de vender** — um assistente que
faz tudo, em vez de um menu de ferramentas.

## O que está quebrado hoje

Anexar um memorial no Nexo já funciona: a classificação determinística detecta
obra, município e tipo, e o chat oferece "Auditar o memorial" / "Auditoria
profunda". Clicar devolve:

> "Primeiro anexe as pranchas de uma disciplina e toque em 'Ler pranchas'."

A causa é uma guarda em `app/api/nexo/agent/route.ts:66`: sem selos, o agente
responde isso e **nunca chega a pensar**. Ela foi escrita quando o Nexo só fazia
LD e capa a partir de carimbos — e todo o raciocínio do agente é montado sobre
`buildLdProposal(selos)`. Um memorial não tem selos de prancha.

**O motor já está pronto:** `runMemorialAudit` reusa `/api/audit` com gabarito,
a proposta `auditoria` com nível standard/deep já existe no vocabulário do agente
e já é normalizada no servidor, e o canvas já sabe desenhar nó de auditoria.

## Decisões tomadas

| Tema | Decisão |
|---|---|
| Escopo | O Nexo absorve a /audit; ela vira legado |
| Arranjo da tela | O de hoje: histórico à esquerda, palco no centro, chat à direita |
| Início da auditoria | O chat mostra os fatos detectados e **pergunta o nível** antes de rodar |
| Gabarito | O chat exibe obra/prefeitura/endereço detectados e o usuário confirma ou corrige |
| Pranchas + memorial | Havendo selos lidos, a obra do **carimbo** é o gabarito (fonte independente) |
| Persistência | Conversa no navegador (como hoje) **e** auditoria no banco (como hoje) |
| Perguntas sobre achados | Encaminhadas para o respondedor da auditoria, que já tem relatório e evidências |
| Controles avançados | Viram conversa ("usa duas IAs"), com padrão sensato; sem painel |
| Vários arquivos | Mantida a capacidade atual: comparação de identidade entre os documentos |
| Aposentadoria da /audit | Sai do menu, continua por URL até a paridade; só então redireciona |

## Arquitetura

### 1. O centro vira palco

Hoje o centro do Nexo é "o canvas". Passa a ser um **palco com vistas**: o mapa do
volume (o que existe) e o relatório da auditoria. Quem decide a vista é o artefato
ativo da conversa — o `artifact-store` já espelha resultados no centro, então a
auditoria entra como mais um artefato, com a sua vista.

Nada se move na tela: histórico à esquerda, palco no centro, chat à direita. O que
muda é **o que o palco mostra**.

### 2. O agente ganha uma segunda fonte de fatos

A guarda cai, mas não some: passa a disparar só quando **não há nem selos nem
documento classificado** — o único caso em que o agente realmente não tem sobre o
que falar.

```
fatos do agente = selos das pranchas (quando houver)
                + classificação do memorial (quando houver)
```

Sem isso, remover a guarda deixaria o agente sem fatos e ele voltaria a inventar —
que é o defeito que o padrão "afirma-fato / pergunta-decisão" existe para evitar.

### 3. A conversa da auditoria

1. Usuário anexa o memorial.
2. A classificação determinística roda (já existe, e acerta obra/município/código/
   páginas com confiança alta).
3. O chat responde com **obra, prefeitura e endereço detectados** e faz **uma**
   pergunta que resolve duas coisas: está certo? e qual nível?
4. A confirmação vira o **gabarito**. A correção vira um gabarito melhor.
5. Dispara `runMemorialAudit` com o gabarito e o nível.
6. O relatório aparece no palco.

**Quando a conversa já tem selos lidos**, o passo 3 muda: a obra do carimbo é
proposta como gabarito, porque é fonte **independente do memorial**. É o caso mais
forte que o produto tem — pega o memorial emitido com o nome de outra obra, que é
o erro real que originou o projeto.

### 4. O relatório é o mesmo componente

`components/audit-result.tsx` passa a ser montado dentro do palco. Verificado: ele
recebe `{ content, auditId, elapsedMs, report, pdfSources }` e importa apenas
primitivos de UI e funções de `lib/audit-report` — sem router, sem sessão, sem
estado da página. **É reaproveitável como está.**

Reescrevê-lo custaria o visor de PDF embutido, a matriz por disciplina e tipo, as
duas camadas de confiança e a exportação — o que dá credibilidade ao resultado.

### 5. Persistência

Sem modelo novo: a conversa continua no IndexedDB e a auditoria continua sendo
gravada no banco pela própria `/api/audit`, ligada à conversa pelo
`conversationId` que `runMemorialAudit` já envia (é o que faz o anel de consumo
funcionar).

As 21 auditorias já gravadas aparecem no Nexo como **auditorias anteriores**,
somente leitura.

### 6. Perguntas sobre os achados

O Nexo reconhece que a pergunta é sobre um achado e encaminha para o respondedor
da auditoria (`audit-chat-answer`), que já tem o relatório e as evidências e
responde ancorado no texto. Para o usuário é a mesma conversa; por dentro, quem
sabe do assunto responde — e as travas anti-alucinação não são duplicadas.

## Decomposição

Quatro sub-projetos, cada um entregando sozinho:

| # | Entrega | Depende de |
|---|---|---|
| **A** | O agente entende memorial: guarda cai, fatos da classificação, gabarito confirmado no chat, auditoria roda e responde o veredito | — |
| **B** | O relatório no palco: `AuditResult` montado no centro, com a vista trocando conforme o artefato ativo | A |
| **C** | Paridade: perguntas sobre achados roteadas, controles por conversa, vários arquivos, auditorias anteriores no histórico | B |
| **D** | Aposentadoria: /audit sai do menu, redireciona quando a paridade estiver provada | C |

**A ordem é obrigatória:** B sem A é tela sem conteúdo; D antes de C é perder
recurso.

## Degradação

| Situação | Comportamento |
|---|---|
| Sem selos e sem documento | A guarda dispara, como hoje — é o único caso em que ela faz sentido |
| Memorial sem obra detectável | O chat pergunta a obra em vez de propor; sem resposta, audita sem gabarito e **avisa** que a checagem de identidade fica mais fraca |
| Auditoria degradada (passada abortou) | O veredito já se rebaixa a "ANÁLISE PARCIAL" (feito em 2026-07-28) e o palco mostra isso |
| Conversa restaurada do histórico | O relatório volta do banco; o PDF não é guardado, então o visor cai em "página + copiar termo", como na /audit |

## Testes

- **Pure:** o seletor de fatos do agente (selos, memorial, os dois, nenhum) — é a
  regra que substitui a guarda, e errar nela devolve o bug atual.
- **Navegador:** um irmão do `scripts/shot-audit.mjs` que roda o **mesmo roteiro
  pelo chat** e afere o mesmo: documento inteiro na IA, nenhuma passada abortada,
  as quatro identidades reaproveitadas do 017-26, veredito no topo.
- **Comparação:** os dois portões (tela e chat) precisam achar **o mesmo** no mesmo
  memorial. Divergência é regressão, não estilo.

## Riscos

**A guarda é a única proteção contra agente sem fato.** Trocá-la por uma regra mais
frouxa sem os fatos do memorial no lugar faz o agente voltar a inventar LD onde não
há prancha. Por isso A entrega as duas coisas juntas, não uma de cada vez.

**Duas telas de auditoria durante a transição.** Enquanto /audit existir por URL,
um defeito corrigido num lado pode não estar no outro. O teste de comparação acima
é o que mantém as duas honestas — e é também o que autoriza a aposentadoria.
