# Achado navegável

**Data:** 2026-09-01
**Estado:** desenho aprovado, não implementado
**Sub-projeto 3 de 6** da revisão integrada pedida em 01/09/2026.
**Depende de:** sub-projetos 1 e 2, ambos na main.

---

## O problema, e por que ele não é de UI

O pedido original dizia:

> "Adicionar um botão **Ver achado** que abra diretamente o PDF na página/local
> correspondente. Hoje essa possibilidade existe ou está parcialmente
> implementada, mas está escondida/pouco acessível."

O diagnóstico estava certo, e incompleto.

### 1. A capacidade existe e funciona

`openInlinePdf` (`components/audit-result.tsx:2296`) abre o PDF **na página do
achado e grifa o trecho**. Hoje ela vive como item "Abrir PDF" dentro do menu de
reticências (`aria-label="Ações do achado"`, linha 3622) e num ícone ao lado do
número da página. Não há motor a construir.

### 2. Mas ela não existe para quem recebe o e-mail

`modules/nexo/components/PalcoDoNexo.tsx:196`:

```ts
const podeVerNoDocumento = Boolean(report && memorialPdf);
```

E `memorialPdf` vem de `recuperarMemorial()` — o **IndexedDB da própria
máquina**. Logo:

- **Victor**, que rodou a auditoria, tem o memorial local → o botão aparece;
- **Milton**, que chegou pelo link do e-mail, **não tem** → `podeVerNoDocumento`
  é falso, e o botão não existe.

O botão falta exatamente para a pessoa para quem a funcionalidade foi pedida. O
docblock do próprio palco já diz o que está em jogo: *"o achado era uma afirmação
sem como conferir, que é justamente o que uma auditoria não pode ser."*

**Isso não é problema de UI. É de onde o documento mora.**

### 3. Nada nunca gravou byte nenhum

`lib/file-storage.ts` tem 64 linhas e só **descreve**: calcula chave, checksum e
URL, e devolve `storageProvider: "none"`. É um esqueleto para um provedor que
nunca foi construído.

### 4. Mas os bytes já passam pelo lugar certo

`lib/audit-persistence.ts:170` chama `createStoredProjectUpload` com
`data: file.buffer` — o memorial inteiro, em memória, na hora de gravar o
parecer. A costura existe e está no lugar certo; ela apenas descarta o conteúdo.

**Não há upload novo a construir.**

## As medições que decidiram o desenho

Memoriais reais em `docs/samples` (01/09/2026):

```
113-22  1,6 MB     116-25  4,6 MB     040-26  5,0 a 5,2 MB (5 revisões assinadas)
```

Banco de dev, hoje:

```
nexodoc_dev inteiro ....... 11 MB
maior tabela (AiUsageEvent)  416 kB
```

**Um único memorial é maior que o banco inteiro hoje.** A ~200 auditorias por
ano, cerca de **1 GB/ano**.

---

## O desenho

### Seção 1 — Onde os bytes ficam

Postgres, e não armazenamento de objetos. Decidido com o Matheus em 01/09/2026,
sabendo do custo: sem vendor novo, sem credencial nova, no mesmo backup do resto.
`lib/file-storage.ts` continua sendo a costura, então trocar para R2/S3 depois é
substituir um provedor — não reescrever.

```prisma
model StoredFile {
  /// A CHAVE É O CONTEÚDO. Reauditar o mesmo memorial não grava de novo, e
  /// `ProjectUpload.checksumSha256` já é calculado e já aponta para cá.
  checksumSha256 String   @id
  /// O escopo de quem pode ler. Mesma regra de `lib/audit-access.ts`.
  organizationId String
  mimeType       String
  sizeBytes      Int
  bytes          Bytes
  createdAt      DateTime @default(now())

  @@index([organizationId, createdAt])
}
```

Cinco revisões assinadas do mesmo memorial são cinco arquivos diferentes e
ocupam cinco vagas. É o comportamento certo: são documentos diferentes de
verdade, e o parecer de cada um cita páginas do seu.

**Teto por arquivo**, recusando com motivo — o modo de falhar que este projeto
mais evita é o silencioso. `storageProvider` passa a gravar `"postgres"` em vez
de `"none"`; o campo já existe e o resto do sistema já o lê.

**Só o memorial auditado.** Pranchas e volumes ficam de fora, e é a decisão que
segura o custo: o memorial tem 1,6 a 5,2 MB, e um volume passa de 20 MB com 88%
de JPEG.

### Seção 2 — Como o documento chega a quem não o tem

`GET /api/arquivos/<checksum>` devolve os bytes, com o escopo de escritório de
`lib/audit-access.ts`.

**404 e não 403** para quem é de fora. "Existe, mas não é seu" já entrega que
existe.

No `PalcoDoNexo`, `memorialPdf` ganha um degrau: **primeiro o IndexedDB local,
depois o servidor.** O local vem primeiro porque é instantâneo e não gasta rede —
quem rodou a auditoria não perde nada. Quem chegou pelo link ganha o que hoje não
tem.

Sem nenhum dos dois, a tela **diz isso**, em vez de esconder o botão. Botão
ausente não se distingue de funcionalidade inexistente, e o produto já pagou por
esse modo de falhar.

### Seção 3 — O link que vai até o achado

`lib/aviso-de-achados.ts:233` monta hoje:

```
/nexo?auditoria=<id>
```

Passa a montar:

```
/nexo?auditoria=<id>&achado=<findingId>
```

As duas metades já existem: `use-abrir-auditoria-por-link.ts` sabe abrir o
parecer a partir do servidor, e `AuditResult` já tem `achadoEmFoco`, que troca
para a aba Achados, rola até o cartão e o faz piscar uma vez
(`audit-result.tsx:1224`). Falta ligar o parâmetro da URL nessa prop.

Com a Seção 2 no lugar, o achado abre **com o PDF disponível** — porque o
documento passa a existir para quem chegou.

### Seção 4 — "Ver achado" como ação principal

Hoje: item "Abrir PDF" no menu de reticências, e um ícone ao lado do número da
página.

Passa a ser **botão nomeado no cartão do achado**, ao lado de "Marcar corrigido"
— que é onde a decisão sobre o achado acontece. O item no menu sai, para não
haver dois caminhos para a mesma coisa.

**Não redesenho o cartão.** Um botão a mais, com a palavra escrita, no lugar em
que as outras ações já moram. A hierarquia e a densidade do parecer são o
sub-projeto 5.

### Seção 5 — O e-mail de resposta NÃO é automático

O sub-projeto 2 deixou este item para cá, e a decisão é **não fazer**.

O aviso hoje é ato explícito, e o docblock de `lib/aviso-de-achados.ts` explica
por quê: a distribuição acontece aos poucos, e e-mail a cada passo mandaria cinco
avisos para a mesma pessoa em dez minutos. E-mail automático a cada resposta
desfaz essa decisão pela porta dos fundos — uma conversa de seis mensagens vira
seis e-mails, e o sexto diz menos que o primeiro.

No lugar: **o botão de avisar passa a alcançar quem tem resposta não lida**, pela
mesma regra de `notifiedAt` que já governa o resto. Um ato, uma mensagem.

### Seção 6 — Como se prova

**Puro, em node cru:**

- a escolha da fonte do PDF — local, servidor, ou nenhuma — e o que a tela diz em
  cada caso;
- a leitura dos parâmetros da URL, incluindo achado sem auditoria e ids tortos.

**Banco, sem navegador:**

- gravar duas vezes o mesmo checksum não duplica nem estoura o unique;
- arquivo acima do teto é recusado **com motivo**;
- escritório de fora recebe **404**, e o corpo não diz que o arquivo existe.

**Navegador, duas pessoas:** o Milton entra pelo link do e-mail, cai no achado
certo, e **abre o PDF que nunca esteve na máquina dele**. É a prova que resume o
sub-projeto — e é exatamente o caso que hoje não funciona.

---

## O que este sub-projeto NÃO faz

- **Guardar pranchas e volumes.** Só o memorial auditado. É o que segura o custo.
- **Redesenhar o cartão do achado ou a tela do parecer.** Sub-projeto 5.
- **E-mail automático a cada resposta.** Ver a Seção 5.
- **Armazenamento de objetos.** A costura fica pronta para receber R2/S3; a troca
  é de provedor, e acontece quando o acervo justificar.
- **Retenção e expurgo.** Nada é apagado por idade nesta versão. Quando o acervo
  crescer, `StoredFile.createdAt` está lá para sustentar a regra.

## Riscos aceitos

- **O banco muda de ordem de grandeza** — de "texto e metadados" para "arquivos".
  `npm run db:backup` fica proporcionalmente mais lento e mais pesado, e restaurar
  passa a mover gigabytes. Aceito conscientemente; o plano do Neon não foi
  verificado e pode custar alguns dólares por mês.
- **Servir 5 MB por requisição carrega os bytes em memória** no processo do Next.
  Aceito nesta escala: um escritório de um dígito de pessoas, abrindo um documento
  por vez.
