# Bateria de fluxos esquisitos: segunda rodada

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`) para acompanhamento.

**Objetivo:** cobrir o resto do catálogo (A2, A4, A5, A6, A7, C1, C2, C3, C5, V1, V2, X1, X2) com jornadas que rodam sem gastar token, e consertar ou construir o que elas acusarem: três decisões do Matheus (C1, C3, X2) e os defeitos que a leitura do código já aponta (A5, C5, V2, X1).

**Arquitetura:**
- O simulador (`lib/ia-simulada.ts`) ganha as operações que esta rodada toca: leitura de selo, conferência de identidade, conferência do volume e propostas de LD e volume.
- Os documentos de teste são sintéticos: um módulo da bateria os gera com pdf-lib e grava em `scratchpad/bateria/fixtures/`. Um teste puro prova, com o pdf.js e as regras do produto, que cada PDF tem a propriedade de que a jornada depende.
- O `ctx` das jornadas ganha os gestos que se repetem (escrever no chat, abrir o cartão de auditoria, achar as auditorias da conversa, vigiar um texto passageiro, contar requisições).
- Cada cenário é uma jornada. Onde o esperado exige produto novo ou conserto, a tarefa seguinte escreve o teste puro que falha, implementa o mínimo e roda a jornada até ficar verde.

**Tecnologia:** Node 24 (TypeScript nativo), Playwright 1.61, pdf-lib 1.17, pdfjs-dist 5.7, Prisma + Postgres, Next 16.

**Desenho:** `docs/superpowers/specs/2026-09-14-bateria-de-fluxos-design.md`. Leia o "Catálogo", "Como uma jornada é escrita", "Tratamento de defeito achado" e as "Decisões da segunda rodada (15/09/2026)" antes de começar. O plano anterior (`docs/superpowers/plans/2026-09-14-bateria-de-fluxos-fundacao.md`) está executado; o código real da bateria mudou durante a execução, e é o código real que vale.

## Restrições globais

- Zero token: nenhuma jornada chega à OpenAI de verdade. A IA simulada só liga com `NEXODOC_IA_SIMULADA=1` **e** `NODE_ENV !== "production"`.
- Banco: só `nexodoc_teste`. Porta do servidor da bateria: `3100`, host `127.0.0.1`, pasta de build `.next-bateria`. E-mail do usuário da bateria: `bateria@nexodoc.local`.
- Testes puros no estilo do repo: `node scripts/test-*.ts`, `node:assert/strict`, sem framework. Módulo importado por teste em node cru usa caminho relativo com extensão (`.ts`/`.mjs`), ou o teste roda com `--import ./scripts/lib/resolver-de-imports.mjs`.
- Comentários e textos em pt-BR. O comentário explica o PORQUÊ, com a data e o caso medido.
- Commit direto na `main`, um por tarefa. Mensagem em pt-BR, minúscula, dizendo o que mudou para quem usa, terminando com o rodapé:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF
  ```
- Nunca `git add -A`: adicione os arquivos pelo nome. Antes de commitar: `git diff --cached --stat`.
- Rota nova em `app/api` precisa chamar `requireActor(` (`npm run prova:rotas`). Esta rodada não cria rota; ela altera `app/api/nexo/conversas/route.ts` e `app/api/audit/route.ts`, que já chamam.
- No Playwright, o input de anexo do chat é `input[type="file"][accept="application/pdf,image/*"]` (use `ctx.anexar`).
- **Formatação:** os arquivos grandes do repo não estão formatados pelo prettier. Medido em 15/09/2026 com `git show HEAD:<arquivo> | npx prettier --check --stdin-filepath <arquivo>`: só `modules/nexo/components/use-reconectar-auditoria.ts` e `scripts/test-nexo-audit-desconexao.ts`, entre os que este plano toca, estão limpos. Nos outros, **edite à mão e não rode `prettier --write`**: ele reescreveria o arquivo inteiro. Vale em especial para `modules/nexo/state/conversation-store.tsx`.
- Nunca `npx prisma generate` com `next dev` no ar. Esta rodada não muda o schema.
- `npm run lint` nunca fecha em zero (5 erros pré-existentes em `modules/nexo/lib/largura-do-copiloto.ts`). Rode o eslint só nos arquivos tocados.
- Tipos: `npx tsc --noEmit -p . 2>&1 | grep "error TS" | grep -v "\.next" | wc -l` tem de imprimir `0`. Não confie em `$?` depois de pipe: ele lê o último comando.
- Jornadas: verificação de tela prova visibilidade de verdade (`ctx.visivelRolando`); verificação de banco acha as linhas pelos `auditId` que a conversa registrou, nunca por `createdAt >= new Date()`; a conversa sob teste é a de `nexo:ultima-conversa`; toda verificação carrega na condição a contagem que a torna não vazia; o banco NÃO é esvaziado entre jornadas.
- **Defeito que não se reproduz:** nas tarefas de conserto, a hipótese vem do código lido em 15/09/2026, sem execução. Se a jornada ficar verde antes do conserto, ou se a captura mostrar outra causa, **pare a tarefa**: mantenha a jornada, anote a evidência em "Suspeitas abertas" de `docs/bateria/defeitos-achados.md` e siga para a próxima tarefa. Confira sempre, pela captura, qual conversa estava aberta: neste repo, log e fixture já confirmaram tese falsa antes.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/ia-simulada.ts` (alterar) | selo, identidade do selo, conferência do volume, propostas de LD e volume |
| `scripts/test-ia-simulada.ts` (alterar) | trava as operações novas |
| `scripts/bateria/lib/fixtures.mjs` (novo) | gera os PDFs sintéticos e os grava em `scratchpad/bateria/fixtures/` |
| `scripts/test-fixtures-da-bateria.ts` (novo) | prova, pelo pdf.js e pelas regras do produto, o que cada PDF é |
| `scripts/bateria/lib/contexto.mjs` (alterar) | gestos novos do `ctx` |
| `scripts/bateria/jornadas/auditoria/a2-revisao-trunca.mjs` (novo) | A2 |
| `scripts/bateria/jornadas/auditoria/a4-f5-no-meio.mjs` (novo) | A4 |
| `scripts/bateria/jornadas/auditoria/a5-documento-identico.mjs` (novo) | A5 |
| `lib/auditoria-recusada.ts` (novo) + `scripts/test-auditoria-recusada.ts` (novo) | apaga a linha de uma auditoria recusada antes de começar |
| `app/api/audit/route.ts` (alterar) | a recusa por documento idêntico apaga a linha que acabou de criar |
| `scripts/bateria/jornadas/auditoria/a6-folhas-mudas.mjs` (novo) | A6 |
| `scripts/bateria/jornadas/auditoria/a7-pedido-no-chat-com-parecer.mjs` (novo) | A7 |
| `scripts/bateria/jornadas/conversas/c1-mesmo-memorial-duas-vezes.mjs` (novo) | C1 |
| `modules/nexo/lib/memorial-repetido.ts` (novo) + `scripts/test-memorial-repetido.ts` (novo) | a regra da deduplicação do memorial |
| `modules/nexo/components/NexoWorkspace.tsx` (alterar) | C1 (dedup no anexo) e C3 (faixa da conversa desatualizada) |
| `scripts/bateria/jornadas/conversas/c2-memorial-e-pranchas.mjs` (novo) | C2 |
| `scripts/bateria/jornadas/conversas/c5-trocar-de-conversa.mjs` (novo) | C5 |
| `modules/nexo/lib/destino-do-parecer.ts` (novo) + `scripts/test-destino-do-parecer.ts` (novo) | onde o parecer que chega é gravado |
| `modules/nexo/components/ConfirmationCard.tsx` (alterar) | C5 (parecer na conversa de origem) e X2 (seletor de projeto) |
| `modules/nexo/state/conversation-store.tsx` (alterar) | C5 (`conversaAberta`) e C3 (base da versão, recusa, `conflitoDeVersao`) |
| `scripts/bateria/jornadas/conversas/c3-duas-abas.mjs` (novo) | C3 |
| `server/nexo/conversa-remota.ts` (alterar) + `scripts/test-nexo-conversa-remota.ts` (alterar) | `gravacaoDesatualizada` |
| `app/api/nexo/conversas/route.ts` (alterar) | 409 para base velha |
| `modules/nexo/lib/nexo-sync.ts` (alterar) | manda a base; lê o 409 |
| `scripts/bateria/jornadas/volume/v1-regerar-ld-depois-do-volume.mjs` (novo) | V1 |
| `scripts/bateria/jornadas/volume/v2-prancha-sem-selo.mjs` (novo) | V2 |
| `modules/nexo/lib/estado-do-anexo.ts` (alterar) + `scripts/test-leitura-do-selo-vazia.ts` (novo) | leitura de selo sem campo legível |
| `modules/nexo/lib/selo-render.ts` (alterar) | leitura vazia vira folha não lida |
| `scripts/bateria/jornadas/acesso/x1-sessao-expira.mjs` (novo) | X1 |
| `modules/nexo/lib/audit.ts` (alterar) + `scripts/test-nexo-audit-desconexao.ts` (alterar) | 401 vira sessão expirada, na largada e na reconexão |
| `modules/nexo/components/use-reconectar-auditoria.ts` (alterar) | para de perguntar sem sessão, e guarda o bilhete |
| `modules/nexo/components/use-abrir-auditoria-por-link.ts` (alterar) | trata o desfecho `sem-sessao` de `consultarAuditoria` |
| `scripts/bateria/jornadas/acesso/x2-memorial-sem-codigo.mjs` (novo) | X2 |
| `lib/resolucao-de-projeto.ts` (alterar) + `scripts/test-resolucao-de-projeto.ts` (alterar) | as opções do seletor |
| `docs/bateria/defeitos-achados.md` (alterar) | uma linha por defeito consertado |
| `docs/bateria/rodar-no-pc-de-casa.md` (alterar) | próximo passo: CI |

**Ordem das tarefas.** Simulador e fixtures primeiro, porque todas as jornadas dependem deles. Depois a auditoria (A2, A4, A5, A6, A7): são os cenários de menor risco e estreiam os gestos novos do `ctx`. C5 vem antes de C3 porque as duas mexem no `conversation-store`, e C3 muda o coração da gravação: melhor que ela entre com o parecer de C5 já no lugar certo. V1 depois de C3, porque a jornada semeia o disco com a aba aberta (a recusa de C3 é o que impede a aba de apagar a semente). X1 depois de A4, que prova a reconexão que X1 altera.

---

### Tarefa 1: IA simulada lê selo, confere identidade e volume, e propõe LD e volume

**Arquivos:**
- Alterar: `lib/ia-simulada.ts` (bloco `case "nexo-agent-turn"` de `corpoDaOperacao`, e funções novas logo acima de `function corpoDaOperacao`)
- Alterar: `scripts/test-ia-simulada.ts` (testes novos antes do `console.log` final)

**Interfaces:**
- Consome: `textoDoPedido(request)` e `pedidoDoEngenheiro(texto)`, que já existem em `lib/ia-simulada.ts`.
- Produz (comportamento de `respostaSimulada`, usado pelas jornadas C2, V1 e V2):
  - `nexo-selo` e `nexo-selo-image` devolvem os 14 campos de `extractionSchema` (`app/api/ld/extract-stamp/route.ts:34`). O valor sai do texto depois de `TEXTO EXTRAÍDO:` (o marcador de `buildTextPrompt`, na mesma rota): `ARQUIVO`, `CONTEÚDO`, `PRANCHA`, `CLIENTE` e `OBRA`, na mesma linha do rótulo ou na de baixo. Sem nenhum desses, todos os campos saem `null` e `confianca: "baixa"`: é a "leitura que volta vazia" de V2.
  - `nexo-selo-identidade` devolve `{ leituras }` com uma leitura nula por `input_image` do pedido (schema em `app/api/nexo/selo-check/route.ts:46`).
  - `nexo-volume-check` devolve `{ leituras }` com uma leitura nula por `input_image` do pedido (campos em `app/api/nexo/volume-check/route.ts:298`).
  - `nexo-agent-turn`: pedido com "audit" continua propondo auditoria, como antes. Pedido com "LD" propõe `{ kind: "ld", resumo: "LD", tituloLd, numTomos: 1, tomoInicial: 1 }`, campos soltos, que é o formato que `normalizeProposals` lê (`server/nexo/agent/normalize.ts:415`). `tituloLd` sai de "título X" no fim do pedido. "monta o volume" propõe `{ kind: "volume", resumo: "Volume" }`.

**Fora desta tarefa, de propósito:**
- `ld-stamp-visual-extraction`/`ld-stamp-text-extraction` (tela clássica de LD), `volume-assembly-suggestion`/`volume-batch-analysis` (`/volumes`): nenhuma jornada do catálogo passa por eles. Continuam caindo em "operação sem simulação", que é o alarme certo se uma jornada futura os tocar.
- `audit-chat-turn` com `encaminhar_para_geracao`: A7 não chega lá (ver a decisão no desenho).
- Nenhum comportamento novo na fila (`vazio`): num lote, a ordem das chamadas de selo não é garantida, e "a segunda chamada volta vazia" não diria qual prancha. A prancha sem texto no carimbo volta vazia por conta própria.

- [ ] **Passo 1: escrever os testes que falham**

Em `scripts/test-ia-simulada.ts`, logo antes da linha `console.log(\`\n${passed} teste(s) passaram\`);`, acrescente:

```ts
/** O pedido da rota do selo: prompt, texto extraído do PDF e o recorte. */
function pedidoDeSelo(textoExtraido: string | null) {
  const prompt =
    "Você lê carimbos. Exemplo: ARQUIVO: 040_26_est_imp_001_a" +
    (textoExtraido === null ? "" : `\n\nTEXTO EXTRAÍDO:\n${textoExtraido}`);
  return {
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: "data:image/png;base64,AA==", detail: "high" },
        ],
      },
    ],
  };
}

const CAMPOS_DO_SELO = [
  "disciplina", "folha", "total", "numeroFolha", "arquivo", "conteudo", "cliente",
  "secretaria", "obra", "fase", "tituloSecao", "data", "logoOrgao", "confianca",
];

await test("selo legível sai do texto extraído, com os 14 campos do schema", async () => {
  const texto = [
    "REGIAO DO SELO (medida pelos rotulos do carimbo):",
    "CLIENTE:",
    "PREFEITURA MUNICIPAL DE CIDADE FICTICIA",
    "CONTEÚDO:",
    "PLANTA DE FORMAS DO BLOCO A",
    "PRANCHA:",
    "01/03",
    "ARQUIVO:",
    "990_26_est_001_a",
    "",
    "PAGINA COMPLETA:",
    "CLIENTE:",
  ].join("\n");
  const r = await respostaSimulada({ operation: "nexo-selo", model: "m", request: pedidoDeSelo(texto) });
  const selo = JSON.parse(r.output_text) as Record<string, unknown>;
  assert.deepEqual(Object.keys(selo).sort(), [...CAMPOS_DO_SELO].sort());
  // O exemplo do PROMPT não pode virar leitura: só vale o que veio depois do marcador.
  assert.equal(selo.arquivo, "990_26_est_001_a");
  assert.equal(selo.disciplina, "EST");
  assert.equal(selo.conteudo, "PLANTA DE FORMAS DO BLOCO A");
  assert.equal(selo.numeroFolha, "01/03");
  assert.equal(selo.folha, 1);
  assert.equal(selo.total, 3);
  assert.equal(selo.cliente, "PREFEITURA MUNICIPAL DE CIDADE FICTICIA");
  assert.equal(selo.confianca, "alta");
});

await test("carimbo sem texto legível volta VAZIO, e não com erro", async () => {
  const texto = "REGIAO DO SELO (aproximada: nenhum rotulo encontrado):\n\n\nPAGINA COMPLETA:\n";
  const r = await respostaSimulada({ operation: "nexo-selo", model: "m", request: pedidoDeSelo(texto) });
  assert.equal(r.status, "completed");
  const selo = JSON.parse(r.output_text) as Record<string, unknown>;
  for (const campo of CAMPOS_DO_SELO.filter((c) => c !== "confianca")) {
    assert.equal(selo[campo], null, campo);
  }
  assert.equal(selo.confianca, "baixa");
});

await test("foto de carimbo sem texto extraído também volta vazia", async () => {
  const r = await respostaSimulada({ operation: "nexo-selo-image", model: "m", request: pedidoDeSelo(null) });
  const selo = JSON.parse(r.output_text) as Record<string, unknown>;
  assert.equal(selo.arquivo, null);
  assert.equal(selo.confianca, "baixa");
});

/** Pedido com texto e N imagens, como selo-check e volume-check montam. */
function pedidoComImagens(n: number) {
  return {
    instructions: "confira",
    input: [
      {
        role: "user",
        content: [
          { type: "input_text", text: `${n} recorte(s) de carimbo, nesta ordem: ...` },
          ...Array.from({ length: n }, () => ({ type: "input_image", image_url: "data:image/png;base64,AA==" })),
        ],
      },
    ],
  };
}

await test("identidade do selo: uma leitura nula por imagem, na ordem", async () => {
  const r = await respostaSimulada({ operation: "nexo-selo-identidade", model: "m", request: pedidoComImagens(3) });
  const corpo = JSON.parse(r.output_text) as { leituras: Record<string, unknown>[] };
  assert.equal(corpo.leituras.length, 3);
  assert.deepEqual(corpo.leituras[0], {
    endereco: null, orgao: null, logoPresente: false, logoOrgao: null,
    numeracaoTexto: null, folha: null, total: null,
  });
});

await test("conferência do volume: uma leitura nula por imagem", async () => {
  const r = await respostaSimulada({ operation: "nexo-volume-check", model: "m", request: pedidoComImagens(2) });
  const corpo = JSON.parse(r.output_text) as { leituras: Record<string, unknown>[] };
  assert.equal(corpo.leituras.length, 2);
  assert.deepEqual(Object.keys(corpo.leituras[1]).sort(), [
    "codigo", "disciplina", "folha", "numeracaoTexto", "obra", "orgao", "titulo", "total",
  ]);
});

/** A cauda JSON de uma resposta do agente. */
function propostasDaResposta(texto: string) {
  const cauda = texto.slice(texto.indexOf("```"));
  return (JSON.parse(cauda.replace(/```json|```/g, "")) as { proposals: Record<string, unknown>[] }).proposals;
}

await test("agente propõe LD com o título que o engenheiro disse", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\ncria a LD dessas pranchas com o título BATERIA V1\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  assert.deepEqual(propostasDaResposta(r.output_text), [
    { kind: "ld", resumo: "LD", tituloLd: "BATERIA V1", numTomos: 1, tomoInicial: 1 },
  ]);
});

await test("agente propõe volume quando o pedido é montar", async () => {
  const input = "PEDIDO DO ENGENHEIRO:\nmonta o volume\n\nFormato da resposta, nesta ordem:";
  const r = await respostaSimulada({ operation: "nexo-agent-turn", model: "m", request: { input } });
  assert.deepEqual(propostasDaResposta(r.output_text), [{ kind: "volume", resumo: "Volume" }]);
});
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-ia-simulada.ts`
Esperado: `FALHOU  selo legível sai do texto extraído…` com `operação sem simulação: nexo-selo`, e as outras seis novas também em `FALHOU`; as 12 antigas seguem `ok`. Código de saída 1.

- [ ] **Passo 3: implementar**

Em `lib/ia-simulada.ts`, logo acima de `function corpoDaOperacao(operation: string, request: unknown): string {`, acrescente:

```ts
/**
 * O texto do PDF que a rota do selo manda DEPOIS do prompt. O marcador é o de
 * `buildTextPrompt` (app/api/ld/extract-stamp/route.ts). Ler o pedido inteiro
 * pegaria o exemplo do próprio prompt ("ARQUIVO: 040_26_est_imp_001_a") como
 * se fosse o carimbo — foi a primeira coisa que o teste desta função pegou.
 */
function textoExtraidoDoSelo(texto: string): string {
  const marcador = "TEXTO EXTRAÍDO:\n";
  const i = texto.indexOf(marcador);
  return i === -1 ? "" : texto.slice(i + marcador.length);
}

/** Rótulo sozinho na linha ("PAGINA COMPLETA:", "ESCALA:"): não é valor de ninguém. */
const ROTULO_SOLTO = /^[A-ZÀ-Ú][A-ZÀ-Ú .()]*:\s*$/;

/**
 * O valor de um rótulo do carimbo. `textoPorPosicao` (server/nexo/selo-regiao.ts)
 * junta os itens por linha: o valor vem na mesma linha ("ARQUIVO: x") quando
 * rótulo e valor dividem a altura, e na linha de baixo quando o valor fica sob
 * o rótulo, como no carimbo da família `est`.
 */
function valorDoRotulo(linhas: readonly string[], rotulo: RegExp): string | null {
  for (let i = 0; i < linhas.length; i++) {
    const m = rotulo.exec(linhas[i]);
    if (!m) continue;
    const resto = linhas[i].slice(m[0].length).trim();
    if (resto) return resto;
    const proxima = linhas.slice(i + 1).find((l) => l.trim() !== "")?.trim() ?? "";
    return proxima && !ROTULO_SOLTO.test(proxima) ? proxima : null;
  }
  return null;
}

/** Mesma convenção de `CODIGO_DE_PRANCHA` (server/nexo/selo-regiao.ts). */
const CODIGO_DE_PRANCHA = /\b\d{2,4}[_-]\d{2}[_a-z0-9.]*[_-]\d{2,3}[_-][a-z]\b/i;

/**
 * O carimbo como um modelo o leria do TEXTO — a imagem a simulação não vê.
 *
 * Sem nenhum campo legível, tudo volta nulo e sem erro: é o que um modelo de
 * verdade faz com um carimbo escaneado, e é o caso de V2 ("a leitura de selo
 * volta vazia"). Falhar aqui testaria outra coisa — a leitura que quebrou.
 */
function seloSimulado(texto: string) {
  const linhas = textoExtraidoDoSelo(texto).split("\n").map((l) => l.trim());
  const arquivo =
    valorDoRotulo(linhas, /^ARQUIVO\s*:?/i) ?? linhas.join(" ").match(CODIGO_DE_PRANCHA)?.[0] ?? null;
  const conteudo = valorDoRotulo(linhas, /^CONTE[ÚU]DO\s*:?/i);
  const prancha = valorDoRotulo(linhas, /^PRANCHA\s*:?/i);
  const numeracao = prancha ? /^(\d{1,3})\s*\/\s*(\d{1,3})$/.exec(prancha) : null;
  const legivel = Boolean(arquivo || conteudo || numeracao);
  const disciplina = arquivo
    ? (/[_-]([a-z]{2,5})[_-]\d{2,3}[_-][a-z]$/i.exec(arquivo)?.[1]?.toUpperCase() ?? null)
    : null;
  return {
    disciplina,
    folha: numeracao ? Number(numeracao[1]) : null,
    total: numeracao ? Number(numeracao[2]) : null,
    numeroFolha: numeracao ? prancha : null,
    arquivo,
    conteudo,
    cliente: legivel ? valorDoRotulo(linhas, /^CLIENTE\s*:?/i) : null,
    secretaria: null,
    obra: legivel ? valorDoRotulo(linhas, /^OBRA\s*:?/i) : null,
    fase: null,
    tituloSecao: conteudo,
    data: null,
    logoOrgao: null,
    confianca: legivel ? "alta" : "baixa",
  };
}

/** Quantas imagens o pedido leva — as conferências respondem uma leitura por imagem. */
function imagensDoPedido(request: unknown): number {
  const input = (request as { input?: unknown } | null)?.input;
  if (!Array.isArray(input)) return 0;
  let n = 0;
  for (const item of input) {
    const content = (item as { content?: unknown })?.content;
    if (!Array.isArray(content)) continue;
    n += content.filter((c) => (c as { type?: unknown })?.type === "input_image").length;
  }
  return n;
}

/**
 * As propostas do agente, pelo pedido. Campos SOLTOS, e não `params`: é o
 * formato do prompt real (server/nexo/agent/run-turn.ts) e o que
 * `normalizeProposals` lê. A auditoria continua no formato que já passava.
 */
function propostasDoPedido(pedido: string): Record<string, unknown>[] {
  if (/audit/i.test(pedido)) {
    return [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }];
  }
  const propostas: Record<string, unknown>[] = [];
  const titulo =
    /t[íi]tulo\s+(?:da\s+LD\s+)?(?:[ée]\s+|para\s+)?["“]?([^"”\n]+?)["”]?\s*$/i.exec(pedido)?.[1]?.trim() ?? "";
  if (/\bLD\b|lista de documentos/i.test(pedido)) {
    propostas.push({ kind: "ld", resumo: "LD", tituloLd: titulo, numTomos: 1, tomoInicial: 1 });
  }
  if (/\b(monta|montar|junta|juntar)\b[\s\S]*\bvolume\b/i.test(pedido)) {
    propostas.push({ kind: "volume", resumo: "Volume" });
  }
  return propostas;
}
```

E troque, dentro de `corpoDaOperacao`, o bloco inteiro:

```ts
    case "nexo-agent-turn": {
      const pedido = pedidoDoEngenheiro(texto);
      if (/audit/i.test(pedido)) {
        const reply = "Vou auditar o memorial (resposta simulada).";
        const cauda = { reply, proposals: [{ kind: "auditoria", resumo: "Auditoria", params: { nivel: "deep" } }] };
        return `${reply}\n\n\`\`\`json\n${JSON.stringify(cauda)}\n\`\`\``;
      }
      return "Entendido (resposta simulada).";
    }
```

por:

```ts
    case "nexo-agent-turn": {
      const propostas = propostasDoPedido(pedidoDoEngenheiro(texto));
      if (propostas.length > 0) {
        const reply =
          propostas[0].kind === "auditoria"
            ? "Vou auditar o memorial (resposta simulada)."
            : `Proposta pronta (resposta simulada): ${propostas.map((p) => p.kind).join(", ")}.`;
        const cauda = { reply, proposals: propostas };
        return `${reply}\n\n\`\`\`json\n${JSON.stringify(cauda)}\n\`\`\``;
      }
      return "Entendido (resposta simulada).";
    }
    case "nexo-selo":
    case "nexo-selo-image":
      return JSON.stringify(seloSimulado(texto));
    case "nexo-selo-identidade":
      return JSON.stringify({
        leituras: Array.from({ length: imagensDoPedido(request) }, () => ({
          endereco: null,
          orgao: null,
          logoPresente: false,
          logoOrgao: null,
          numeracaoTexto: null,
          folha: null,
          total: null,
        })),
      });
    case "nexo-volume-check":
      return JSON.stringify({
        leituras: Array.from({ length: imagensDoPedido(request) }, () => ({
          numeracaoTexto: null,
          folha: null,
          total: null,
          codigo: null,
          titulo: null,
          disciplina: null,
          orgao: null,
          obra: null,
        })),
      });
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `node scripts/test-ia-simulada.ts`
Esperado: `19 teste(s) passaram`, código de saída 0.

Rode: `npx eslint lib/ia-simulada.ts scripts/test-ia-simulada.ts` e a contagem de tipos das restrições globais.
Esperado: sem erro de lint; `0`.

- [ ] **Passo 5: commit**

```bash
git add lib/ia-simulada.ts scripts/test-ia-simulada.ts
git diff --cached --stat
git commit -m "a ia simulada le carimbo pelo texto, confere identidade e volume e propoe ld e volume" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 2: documentos de teste sintéticos

**Arquivos:**
- Criar: `scripts/bateria/lib/fixtures.mjs`
- Criar: `scripts/test-fixtures-da-bateria.ts`

**Interfaces:**
- Produz:
  - `NOMES`: `{ memorialCurto: "990_26_md_bateria_a.pdf", memorialComFolhaMuda: "991_26_md_bateria_muda_a.pdf", memorialSemCodigo: "memorial_bateria_sem_codigo.pdf", pranchas: ["990_26_est_001_a.pdf", "990_26_est_002_a.pdf", "990_26_est_003_a.pdf"], pranchaSemSelo: "990_26_est_004_a.pdf" }`
  - `PASTA_DAS_FIXTURES`: `"scratchpad/bateria/fixtures"` (via `path.join`)
  - `bytesDasFixtures(): Promise<Record<string, Uint8Array>>`, chave = nome do arquivo
  - `garantirFixtures(): Promise<{ memorialCurto: string; memorialComFolhaMuda: string; memorialSemCodigo: string; pranchas: string[]; pranchaSemSelo: string }>`, caminhos relativos à raiz do repo, prontos para `ctx.anexar`

**Por que gerar, e não versionar:** o repositório é público, e memorial ou prancha real é dado de cliente. A receita em código se revisa num diff; um PDF binário, não. O `tests/117_25_md_geral_a.pdf` continua sendo o documento real das jornadas que precisam dele (A1, A3).

**As propriedades de que as jornadas dependem, e de onde vem cada regra:**
- Memorial pelo NOME: `md` isolado no nome decide o papel antes da geometria (`modules/nexo/lib/papel-do-anexo.ts:218`); o código vem do começo do nome (`server/nexo/parse-filename.ts:236`), senão do texto (`lib/audit-classify.ts:93`, regex `\b\d{2,4}[_-]\d{2}\b`).
- Texto suficiente: pelo menos 300 caracteres (`app/api/audit/route.ts:147`), com linhas de 40 a 160 caracteres para a leitura global simulada ter o que citar.
- Folha muda: página com menos de 120 caracteres e com tinta (`lib/pagina-muda.ts:131`). Retângulo e linha do pdf-lib viram `constructPath`, que `medirTinta` conta (`lib/pdf-text.ts:82`).
- Memorial sem código: nenhum `\d{2,4}[_-]\d{2}` no texto (inclusive datas como "10-25") e nome sem código no começo.
- Prancha legível: papel grande em paisagem (`server/nexo/selo-regiao.ts:365`), três ou mais rótulos-âncora como itens separados (`:69`), valor do CONTEÚDO na linha de baixo, dentro da célula (`conteudoDoSelo`, `:255`), um código de prancha só.
- Prancha sem selo: o mesmo papel e o mesmo desenho, sem texto nenhum. Ela é classificada `outra`, e `outra` vai para a leitura (`valeLerComoPrancha`, `:405`).
- Bytes estáveis: `updateMetadata: false` e datas fixas, para duas corridas gerarem o mesmo arquivo.

- [ ] **Passo 1: escrever o teste que falha**

`scripts/test-fixtures-da-bateria.ts`:

```ts
/**
 * Teste dos DOCUMENTOS SINTÉTICOS da bateria.
 *
 * Uma jornada que anexa "um memorial com uma folha muda" só prova alguma coisa
 * se o PDF for mesmo isso para o produto. Aqui cada fixture passa pelo MESMO
 * leitor que a produção usa — pdf.js, `extractPdfText`, `classificarPagina` do
 * carimbo, `parseFilename` —, e não por uma inspeção feita à mão. Sem isto, uma
 * jornada verde poderia estar anexando um documento que nunca exercitou o caso.
 *
 *   node scripts/test-fixtures-da-bateria.ts
 */
import assert from "node:assert/strict";
import fs from "node:fs";

import { NOMES, bytesDasFixtures, garantirFixtures } from "./bateria/lib/fixtures.mjs";
import { normalizarItens } from "../lib/coordenada-do-pdf.ts";
import { diagnosticarPaginasMudas } from "../lib/pagina-muda.ts";
import { extractPdfText } from "../lib/pdf-text.ts";
import { parseFilename } from "../server/nexo/parse-filename.ts";
import {
  acharCaixaDoSelo,
  classificarPagina,
  conteudoDoSelo,
  valeLerComoPrancha,
} from "../server/nexo/selo-regiao.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

/** A mesma regra do código do projeto que a classificação do memorial usa (lib/audit-classify.ts:93). */
const CODIGO_NO_TEXTO = /\b\d{2,4}[_-]\d{2}\b/g;

const bytes = await bytesDasFixtures();

/** Os itens de texto da página 1, normalizados como `analisarPagina` faz no navegador. */
async function itensDaPagina(dados: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(dados),
    disableWorker: true,
  } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const pagina = await doc.getPage(1);
  const viewport = pagina.getViewport({ scale: 1 });
  const conteudo = await pagina.getTextContent();
  const brutos = (conteudo.items as { str?: string; transform?: number[] }[])
    .filter((i) => i.str && i.transform)
    .map((i) => {
      const [x, y] = viewport.convertToViewportPoint(i.transform![4], i.transform![5]);
      return { texto: i.str!.trim(), x, y };
    });
  const itens = normalizarItens(brutos, { largura: viewport.width, altura: viewport.height });
  await doc.destroy();
  return { itens, largura: viewport.width, altura: viewport.height };
}

await test("memorial curto: memorial pelo nome, código 990-26, texto de sobra e nenhuma folha muda", async () => {
  const nome = NOMES.memorialCurto;
  assert.equal(parseFilename(nome).tipo, "memorial");
  assert.equal(parseFilename(nome).codigo, "990-26");
  const extraido = await extractPdfText(Buffer.from(bytes[nome]));
  assert.equal(extraido.pageCount, 3);
  assert.ok(extraido.charCount >= 300, `charCount=${extraido.charCount}`);
  assert.deepEqual([...new Set(extraido.text.match(CODIGO_NO_TEXTO))], ["990-26"]);
  assert.deepEqual(diagnosticarPaginasMudas(extraido).mudas, []);
  const citaveis = extraido.text.split("\n").filter((l) => l.trim().length >= 40 && l.trim().length <= 160);
  assert.ok(citaveis.length >= 3, `linhas citáveis=${citaveis.length}`);
});

await test("memorial com folha muda: a quarta página, e só ela, é muda", async () => {
  const extraido = await extractPdfText(Buffer.from(bytes[NOMES.memorialComFolhaMuda]));
  const diagnostico = diagnosticarPaginasMudas(extraido);
  assert.equal(diagnostico.totalDePaginas, 4);
  assert.deepEqual(diagnostico.mudas, [4]);
});

await test("memorial sem código: nem no nome, nem no texto", async () => {
  const nome = NOMES.memorialSemCodigo;
  assert.equal(parseFilename(nome).tipo, "memorial");
  assert.equal(parseFilename(nome).codigo, "");
  const extraido = await extractPdfText(Buffer.from(bytes[nome]));
  assert.equal(extraido.text.match(CODIGO_NO_TEXTO), null);
  assert.ok(extraido.charCount >= 300);
  assert.deepEqual(diagnosticarPaginasMudas(extraido).mudas, []);
});

await test("prancha legível: carimbo achado pelas âncoras e CONTEÚDO lido pela geometria", async () => {
  for (const [i, nome] of NOMES.pranchas.entries()) {
    assert.notEqual(parseFilename(nome).tipo, "memorial", nome);
    const { itens, largura, altura } = await itensDaPagina(bytes[nome]);
    assert.equal(classificarPagina({ largura, altura, itens }), "prancha", nome);
    assert.ok(acharCaixaDoSelo(itens).ancoras >= 3, nome);
    assert.equal(conteudoDoSelo(itens), `PLANTA DE FORMAS DO BLOCO ${"ABC"[i]}`, nome);
    const codigos = itens.filter((it) => /\b\d{2,4}[_-]\d{2}[_a-z0-9.]*[_-]\d{2,3}[_-][a-z]\b/i.test(it.texto));
    assert.equal(codigos.length, 1, `${nome}: um código de prancha só (três viram índice)`);
  }
});

await test("prancha sem selo: nenhum texto, e mesmo assim vai para a leitura", async () => {
  const { itens, largura, altura } = await itensDaPagina(bytes[NOMES.pranchaSemSelo]);
  assert.equal(itens.length, 0);
  const tipo = classificarPagina({ largura, altura, itens });
  assert.equal(tipo, "outra");
  assert.equal(valeLerComoPrancha(tipo), true);
});

await test("duas gerações dão os mesmos bytes", async () => {
  const outra = await bytesDasFixtures();
  for (const nome of Object.keys(bytes)) {
    assert.ok(Buffer.from(bytes[nome]).equals(Buffer.from(outra[nome])), nome);
  }
});

await test("garantirFixtures grava os arquivos que as jornadas anexam", async () => {
  const f = await garantirFixtures();
  const caminhos = [f.memorialCurto, f.memorialComFolhaMuda, f.memorialSemCodigo, ...f.pranchas, f.pranchaSemSelo];
  assert.equal(caminhos.length, 7);
  for (const c of caminhos) {
    assert.ok(fs.existsSync(c), c);
    assert.ok(c.replaceAll("\\", "/").startsWith("scratchpad/bateria/fixtures/"), c);
  }
});

console.log(`\n${passed} teste(s) passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-fixtures-da-bateria.ts`
Esperado: FALHA com `ERR_MODULE_NOT_FOUND` para `scripts/bateria/lib/fixtures.mjs`.

- [ ] **Passo 3: implementar**

`scripts/bateria/lib/fixtures.mjs`:

```js
// OS DOCUMENTOS DE TESTE da segunda rodada — sintéticos, gerados aqui.
//
// O repositório é público: memorial ou prancha de verdade é dado de cliente. A
// receita fica em código, onde um diff mostra o que mudou; os PDFs nascem em
// memória e vão para `scratchpad/bateria/fixtures/`, que o git ignora. Cada
// propriedade de que uma jornada depende está provada em
// `scripts/test-fixtures-da-bateria.ts`, contra o leitor do próprio produto.
import fs from "node:fs";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const PASTA_DAS_FIXTURES = path.join("scratchpad", "bateria", "fixtures");

export const NOMES = {
  memorialCurto: "990_26_md_bateria_a.pdf",
  memorialComFolhaMuda: "991_26_md_bateria_muda_a.pdf",
  memorialSemCodigo: "memorial_bateria_sem_codigo.pdf",
  pranchas: ["990_26_est_001_a.pdf", "990_26_est_002_a.pdf", "990_26_est_003_a.pdf"],
  pranchaSemSelo: "990_26_est_004_a.pdf",
};

// Datas fixas e `updateMetadata: false`: sem isso o pdf-lib carimba a hora da
// geração, e duas corridas produziriam arquivos diferentes do mesmo documento.
const DATA_FIXA = new Date("2026-09-15T12:00:00Z");

async function novoDocumento(titulo) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(titulo);
  doc.setProducer("bateria nexodoc");
  doc.setCreator("bateria nexodoc");
  doc.setCreationDate(DATA_FIXA);
  doc.setModificationDate(DATA_FIXA);
  return doc;
}

/** Quebra um parágrafo na largura útil, como `gera-memoriais-defeituosos.mjs`. */
function quebrarLinhas(texto, fonte, tamanho, largura) {
  const linhas = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const teste = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(teste, tamanho) <= largura) {
      atual = teste;
      continue;
    }
    if (atual) linhas.push(atual);
    atual = palavra;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/*
 * O TEXTO DO MEMORIAL. Nenhum par número-separador-dois-dígitos fora do código
 * do cabeçalho: `\b\d{2,4}[_-]\d{2}\b` (lib/audit-classify.ts) não distingue
 * código de data, e um "10-25" aqui daria código ao memorial que precisa não ter.
 */
function paginasDoMemorial(codigo) {
  const cabecalho = [
    "MEMORIAL DESCRITIVO",
    "Obra: Centro Comunitário da Bateria",
    "Prefeitura Municipal de Cidade Fictícia",
    ...(codigo ? [`Centro de custo: ${codigo}`] : []),
  ];
  return [
    [
      ...cabecalho,
      "1. APRESENTAÇÃO",
      "Este memorial descreve a reforma do centro comunitário usado somente pelos testes automatizados do NexoDoc.",
      "O documento é sintético e não corresponde a nenhuma obra real, cliente ou prefeitura existente no estado.",
      "A edificação tem um pavimento térreo com salão principal, cozinha, dois sanitários e depósito de materiais.",
    ],
    [
      "2. ESTRUTURA E VEDAÇÕES",
      "As fundações serão em sapatas isoladas de concreto armado, dimensionadas conforme o laudo de sondagem do terreno.",
      "As paredes externas serão em blocos cerâmicos de oito furos, com revestimento em argamassa e pintura acrílica.",
      "A cobertura será em telha metálica termoacústica com inclinação mínima de cinco por cento sobre estrutura de aço.",
    ],
    [
      "3. INSTALAÇÕES",
      "O reservatório superior terá capacidade de dez metros cúbicos conforme o projeto hidrossanitário da edificação.",
      "As instalações elétricas seguem a NBR 5410 e o padrão de entrada da concessionária de energia do município.",
      "Os sanitários terão barras de apoio e portas com largura livre adequada à acessibilidade prevista na norma técnica.",
    ],
  ];
}

async function memorialBytes({ titulo, codigo, comFolhaMuda }) {
  const doc = await novoDocumento(titulo);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  for (const linhasDaPagina of paginasDoMemorial(codigo)) {
    const pagina = doc.addPage([595, 842]);
    let y = 780;
    for (const paragrafo of linhasDaPagina) {
      for (const linha of quebrarLinhas(paragrafo, fonte, 10, 495)) {
        pagina.drawText(linha, { x: 50, y, size: 10, font: fonte, color: rgb(0.08, 0.08, 0.08) });
        y -= 16;
      }
      y -= 8;
    }
  }
  if (comFolhaMuda) {
    // A FOLHA MUDA: só desenho. Retângulo e linha viram `constructPath`, que é o
    // que `medirTinta` conta — e zero caractere de texto.
    const pagina = doc.addPage([595, 842]);
    pagina.drawRectangle({ x: 80, y: 420, width: 435, height: 320, borderColor: rgb(0, 0, 0), borderWidth: 1.5 });
    for (let i = 0; i < 8; i++) {
      pagina.drawLine({ start: { x: 100, y: 440 + i * 36 }, end: { x: 495, y: 440 + i * 36 }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
    }
  }
  return doc.save();
}

/*
 * A PRANCHA. A1 em paisagem (1684×1191 pt), acima do limite de papel pequeno.
 * O carimbo fica no canto inferior direito, com o valor de cada campo UMA LINHA
 * ABAIXO do rótulo — o desenho da família `est`, que `conteudoDoSelo` lê pela
 * célula. Rótulo e valor são `drawText` separados: as âncoras só contam quando o
 * item é o rótulo sozinho.
 */
async function pranchaBytes({ arquivo, conteudo, folha, total, legivel }) {
  const doc = await novoDocumento(arquivo);
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const pagina = doc.addPage([1684, 1191]);
  pagina.drawRectangle({ x: 20, y: 20, width: 1644, height: 1151, borderColor: rgb(0, 0, 0), borderWidth: 2 });
  for (let i = 0; i < 6; i++) {
    pagina.drawLine({ start: { x: 120, y: 360 + i * 120 }, end: { x: 1100, y: 360 + i * 120 }, thickness: 1, color: rgb(0.3, 0.3, 0.3) });
  }
  pagina.drawRectangle({ x: 1300, y: 30, width: 364, height: 260, borderColor: rgb(0, 0, 0), borderWidth: 1 });
  if (legivel) {
    const campos = [
      ["CLIENTE:", "PREFEITURA MUNICIPAL DE CIDADE FICTICIA"],
      ["OBRA:", "CENTRO COMUNITARIO DA BATERIA"],
      ["CONTEÚDO:", conteudo],
      ["ESCALA:", "INDICADA"],
      ["PRANCHA:", `${String(folha).padStart(2, "0")}/${String(total).padStart(2, "0")}`],
      ["ARQUIVO:", arquivo],
    ];
    let y = 260;
    for (const [rotulo, valor] of campos) {
      pagina.drawText(rotulo, { x: 1320, y, size: 9, font: fonte });
      pagina.drawText(valor, { x: 1320, y: y - 13, size: 9, font: fonte });
      y -= 38;
    }
  }
  return doc.save();
}

export async function bytesDasFixtures() {
  const saida = {};
  saida[NOMES.memorialCurto] = await memorialBytes({ titulo: "memorial curto", codigo: "990-26", comFolhaMuda: false });
  saida[NOMES.memorialComFolhaMuda] = await memorialBytes({ titulo: "memorial com folha muda", codigo: "991-26", comFolhaMuda: true });
  saida[NOMES.memorialSemCodigo] = await memorialBytes({ titulo: "memorial sem codigo", codigo: null, comFolhaMuda: false });
  for (const [i, nome] of NOMES.pranchas.entries()) {
    saida[nome] = await pranchaBytes({
      arquivo: nome.replace(/\.pdf$/, ""),
      conteudo: `PLANTA DE FORMAS DO BLOCO ${"ABC"[i]}`,
      folha: i + 1,
      total: NOMES.pranchas.length,
      legivel: true,
    });
  }
  saida[NOMES.pranchaSemSelo] = await pranchaBytes({ arquivo: "", conteudo: "", folha: 4, total: 4, legivel: false });
  return saida;
}

/** Grava (ou regrava, se a receita mudou) e devolve os caminhos para `ctx.anexar`. */
export async function garantirFixtures() {
  fs.mkdirSync(PASTA_DAS_FIXTURES, { recursive: true });
  const bytes = await bytesDasFixtures();
  for (const [nome, dados] of Object.entries(bytes)) {
    const destino = path.join(PASTA_DAS_FIXTURES, nome);
    const atual = fs.existsSync(destino) ? fs.readFileSync(destino) : null;
    if (!atual || !atual.equals(Buffer.from(dados))) fs.writeFileSync(destino, dados);
  }
  const caminho = (nome) => path.join(PASTA_DAS_FIXTURES, nome);
  return {
    memorialCurto: caminho(NOMES.memorialCurto),
    memorialComFolhaMuda: caminho(NOMES.memorialComFolhaMuda),
    memorialSemCodigo: caminho(NOMES.memorialSemCodigo),
    pranchas: NOMES.pranchas.map(caminho),
    pranchaSemSelo: caminho(NOMES.pranchaSemSelo),
  };
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `node scripts/test-fixtures-da-bateria.ts`
Esperado: `7 teste(s) passaram`.

Se "prancha legível" falhar em `conteudoDoSelo`, imprima `itens` da página 1 e confira a distância vertical entre `CONTEÚDO:` e o valor: ela tem de ficar entre `MESMA_LINHA` (0,008) e `ALTURA_DA_CELULA` (0,035) da altura (`server/nexo/selo-regiao.ts`). Ajuste o `y - 13` da fixture, nunca a regra do produto. Se "duas gerações dão os mesmos bytes" falhar, compare os dois buffers: o pdf-lib pode estar gravando um `/ID`; fixe-o antes de afrouxar o teste.

- [ ] **Passo 5: commit**

```bash
git add scripts/bateria/lib/fixtures.mjs scripts/test-fixtures-da-bateria.ts
git diff --cached --stat
git commit -m "a bateria gera os proprios memoriais e pranchas de teste, sem dado de cliente" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---
### Tarefa 3: os gestos novos do `ctx` e a jornada A2 (revisão trunca)

**Arquivos:**
- Alterar: `scripts/bateria/lib/contexto.mjs` (import no topo; gestos novos logo antes de `verificar(nome, condicao, detalhe = "") {`)
- Criar: `scripts/bateria/jornadas/auditoria/a2-revisao-trunca.mjs`

**Interfaces:**
- Consome: `garantirFixtures` (Tarefa 2); `consultar` (`scripts/bateria/lib/banco.mjs`); `ctx.anexar`, `ctx.esperarTexto`, `ctx.esperarBotao`, `ctx.visivel`, `ctx.indexeddb.lerConversas` (já existem).
- Produz no `ctx` (todas as jornadas seguintes usam estes nomes):
  - `fixtures(): Promise<{ memorialCurto, memorialComFolhaMuda, memorialSemCodigo, pranchas: string[], pranchaSemSelo }>`
  - `escrever(texto: string, pagina = page): Promise<void>`: escreve no composer e aperta Enter
  - `conversaAberta(pagina = page): Promise<string | null>`: o `nexo:ultima-conversa`
  - `lerConversa(id: string | null): Promise<object | null>`: o registro do IndexedDB
  - `auditoriasDaConversa(id): Promise<{ registradas: { auditId, artifactId }[]; linhas: { id, status, projectId, passadas }[] }>`
  - `abrirCartaoDeAuditoria(caminho: string): Promise<void>`: anexa, espera "Li as primeiras páginas" e clica "Auditar o memorial"
  - `auditarNoCartao(): Promise<void>`: espera o "Auditar" do último cartão habilitar e clica
  - `esperarParecer(quantos = 1, ms = 300_000): Promise<Locator>`: espera o N-ésimo "Ver o parecer"; devolve o locator de todos
  - `vigiar(nome: string, texto: string, pagina = page)` e `viu(nome: string, pagina = page): Promise<boolean>`: registra se um texto passou pela tela, mesmo por um instante
  - `contarRequisicoes(filtro: (req) => boolean, pagina = page): { total(): number; parar(): void }`
  - `marcadaNaBarra(titulo: string, pagina = page): Promise<{ ok: boolean; detalhe: string }>`
  - `esperar(condicao: () => Promise<boolean> | boolean, ms: number, passo = 1000): Promise<boolean>`

- [ ] **Passo 1: os gestos**

Em `scripts/bateria/lib/contexto.mjs`, troque:

```js
import { pularTourGuiado } from "../../lib/sessao-de-teste.mjs";
import { consultar } from "./banco.mjs";
```

por:

```js
import { pularTourGuiado } from "../../lib/sessao-de-teste.mjs";
import { consultar } from "./banco.mjs";
import { garantirFixtures } from "./fixtures.mjs";
```

E acrescente, logo antes da linha `    verificar(nome, condicao, detalhe = "") {`:

```js
    /** Os documentos sintéticos da segunda rodada (ver fixtures.mjs). */
    fixtures: garantirFixtures,

    /** Escreve no composer do chat e envia com Enter, como o engenheiro faz. */
    async escrever(texto, pagina = page) {
      const campo = pagina.locator('[data-tour="composer"] textarea').last();
      await campo.waitFor({ timeout: 30_000 });
      await campo.fill(texto);
      await campo.press("Enter");
    },

    /**
     * A conversa SOB TESTE é a que o produto lembra como aberta — não "a de
     * `updatedAt` mais alto", que numa bateria com mais conversas pode ser
     * outra (o falso positivo do projeto de exemplo, agosto de 2026).
     */
    async conversaAberta(pagina = page) {
      return pagina.evaluate(() => localStorage.getItem("nexo:ultima-conversa"));
    },

    async lerConversa(id) {
      if (!id) return null;
      return (await ctx.indexeddb.lerConversas()).find((c) => c.id === id) ?? null;
    },

    /**
     * As linhas de "Audit" que ESTA conversa criou, pelos `auditId` que ela
     * registrou na largada (`registrarAuditoria`). Nunca por relógio: em
     * 14/09/2026 `"createdAt" >= inicio` deixou a auditoria da a1 entrar na a3,
     * e o `now()` do banco estava 29s atrás da máquina.
     */
    async auditoriasDaConversa(id) {
      const registradas = (await ctx.lerConversa(id))?.auditorias ?? [];
      const linhas =
        registradas.length === 0
          ? []
          : await consultar(
              `select id, status, "projectId", report->'runtime'->'passadas_incompletas' as passadas from "Audit" where id = any($1::text[])`,
              [registradas.map((a) => a.auditId)],
            );
      return { registradas, linhas };
    },

    /** Anexa o memorial, espera a leitura e pede a auditoria pelo chip. */
    async abrirCartaoDeAuditoria(caminho) {
      await ctx.anexar([caminho]);
      await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
      await (await ctx.esperarBotao(/Auditar o memorial/, 30_000)).click();
    },

    /**
     * O "Auditar" do cartão mais novo. `esperarBotao` espera habilitar: o botão
     * nasce "Conferindo páginas…" e desabilitado até o diagnóstico das folhas
     * voltar (ConfirmationCard, 14/09/2026 17:49).
     */
    async auditarNoCartao() {
      await (await ctx.esperarBotao(/^Auditar$/, 120_000)).click();
    },

    async esperarParecer(quantos = 1, ms = 300_000) {
      const ver = page.getByRole("button", { name: /Ver o parecer/ });
      await ver.nth(quantos - 1).waitFor({ timeout: ms });
      return ver;
    },

    /**
     * Um texto que passa pela tela por um instante ("Conferindo páginas…" num
     * memorial de quatro páginas) não é pego por `waitFor` depois do fato. O
     * observador fica na página e anota a primeira vez que o texto aparece.
     */
    async vigiar(nome, texto, pagina = page) {
      await pagina.evaluate(
        ({ nome, texto }) => {
          const w = window;
          w.__bateriaVistos ??= {};
          if (document.body.textContent.includes(texto)) {
            w.__bateriaVistos[nome] = true;
            return;
          }
          w.__bateriaVistos[nome] = false;
          const obs = new MutationObserver(() => {
            if (document.body.textContent.includes(texto)) {
              w.__bateriaVistos[nome] = true;
              obs.disconnect();
            }
          });
          obs.observe(document.body, { subtree: true, childList: true, characterData: true });
        },
        { nome, texto },
      );
    },

    async viu(nome, pagina = page) {
      return pagina.evaluate((n) => Boolean(window.__bateriaVistos?.[n]), nome);
    },

    /** Conta as requisições que passam no filtro, até `parar()`. */
    contarRequisicoes(filtro, pagina = page) {
      let n = 0;
      const ouvir = (req) => {
        if (filtro(req)) n++;
      };
      pagina.on("request", ouvir);
      return { total: () => n, parar: () => pagina.off("request", ouvir) };
    },

    /** A barra lateral marca a conversa aberta com `aria-current` (CartaoDeProjeto.tsx). */
    async marcadaNaBarra(titulo, pagina = page) {
      const marcada = pagina.locator('button[aria-current="true"]');
      const n = await marcada.count();
      const texto = n > 0 ? await marcada.first().innerText() : "";
      return { ok: n === 1 && texto.includes(titulo), detalhe: `marcadas=${n} texto=${JSON.stringify(texto.slice(0, 80))}` };
    },

    /** Repete a condição até ela valer ou o prazo acabar; devolve a última leitura. */
    async esperar(condicao, ms, passo = 1000) {
      const fim = Date.now() + ms;
      while (Date.now() < fim) {
        if (await condicao()) return true;
        await page.waitForTimeout(passo);
      }
      return Boolean(await condicao());
    },

```

- [ ] **Passo 2: a jornada**

`scripts/bateria/jornadas/auditoria/a2-revisao-trunca.mjs`:

```js
// A2 — a REVISÃO dos achados trunca (`audit-validation: truncar`).
//
// Esperado (catálogo): o parecer sai, e "Revisão dos achados pela IA" aparece
// como etapa incompleta. O caminho no código, lido em 15/09/2026:
// `extractOutputText` (lib/ai-runner.ts) lança `incomplete_max_output_tokens`;
// o `catch` da validação (app/api/audit/route.ts, "Revisão dos achados pela
// IA") põe a passada em `degradacoes` e mantém os achados; e
// `incompletudeDoParecer` (lib/auditoria-incompleta.ts) cai no ramo genérico.
// Memorial curto e sem folha muda de propósito: com o 117_25 o aviso falaria
// de páginas não lidas, e a etapa ficaria escondida atrás dele.
export default {
  id: "a2",
  area: "auditoria",
  titulo: "revisão dos achados trunca: o parecer sai e diz a etapa que faltou",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-validation", "truncar");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    const verParecer = await ctx.esperarParecer(1);
    // O palco mostra o aviso inteiro; o cartão do chat, só título e explicação.
    await verParecer.last().click();
    await ctx.page.waitForTimeout(1500);

    const titulo = ctx.page.getByText("AUDITORIA INCOMPLETA", { exact: true });
    ctx.verificar("aviso de auditoria incompleta, visível de verdade", await ctx.visivelRolando(titulo), `contagem=${await titulo.count()}`);

    const explicacao = ctx.page.getByText(/Uma etapa da análise não completou \(Revisão dos achados pela IA\)/);
    ctx.verificar("a explicação nomeia a revisão, visível de verdade", await ctx.visivelRolando(explicacao), `contagem=${await explicacao.count()}`);

    const etapa = ctx.page.getByText("Etapa que falhou: Revisão dos achados pela IA");
    ctx.verificar("o palco lista a etapa que falhou, visível de verdade", await ctx.visivelRolando(etapa), `contagem=${await etapa.count()}`);

    const contagem = ctx.page.getByText(/contagem INCOMPLETA/);
    ctx.verificar("a contagem se declara incompleta, visível de verdade", await ctx.visivelRolando(contagem), `contagem=${await contagem.count()}`);

    const id = await ctx.conversaAberta();
    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar("uma auditoria registrada na conversa e achada no banco", registradas.length === 1 && linhas.length === 1, `registradas=${registradas.length} linhas=${linhas.length}`);
    const passadas = JSON.stringify(linhas[0]?.passadas ?? []);
    ctx.verificar("auditoria gravada como COMPLETED", linhas[0]?.status === "COMPLETED", linhas[0]?.status);
    ctx.verificar("a revisão está nas passadas incompletas gravadas", passadas.includes("Revisão dos achados pela IA"), passadas);
    ctx.verificar("a leitura global não entrou como falha", !passadas.includes("Leitura global"), passadas);
  },
};
```

- [ ] **Passo 3: rodar**

Rode: `npm run bateria -- --so-jornadas a2`
Esperado: `Jornadas: 1 verdes · 0 vermelhas`, `ok      a2`, código 0.

Se ficar vermelho em "a revisão está nas passadas incompletas", confira no `servidor.log` da pasta de artefatos se `audit-validation` foi chamada: ela só roda com achados (`args.findings.length > 0`, perto de `operation: "audit-validation"` em `app/api/audit/route.ts`). Sem achados, o memorial curto não deu à leitura global linhas citáveis; o teste da Tarefa 2 ("linhas citáveis") devia ter pegado isso antes. Investigue com `superpowers:systematic-debugging`.

- [ ] **Passo 4: a fumaça continua verde com o `ctx` novo**

Rode: `npm run bateria -- --so-jornadas fumaca`
Esperado: `ok      f0`.

- [ ] **Passo 5: commit**

```bash
git add scripts/bateria/lib/contexto.mjs scripts/bateria/jornadas/auditoria/a2-revisao-trunca.mjs
git diff --cached --stat
git commit -m "a bateria prova que a revisao truncada sai no parecer como etapa incompleta" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 4: jornada A4 — F5 no meio da auditoria

**Arquivos:**
- Criar: `scripts/bateria/jornadas/auditoria/a4-f5-no-meio.mjs`

**Interfaces:**
- Consome: `ctx.fixtures`, `ctx.abrirCartaoDeAuditoria`, `ctx.auditarNoCartao`, `ctx.esperarParecer`, `ctx.conversaAberta`, `ctx.lerConversa`, `ctx.auditoriasDaConversa` (Tarefa 3).

**O que o código garante, e o que a jornada prova:** a auditoria roda dentro do POST, e o servidor não para quando o cliente some ("Cliente desistiu no meio", `app/api/audit/route.ts`, no `start` do fluxo). O bilhete nasce antes do POST (`marcarAuditoriaPendente`, `ConfirmationCard.tsx`). Depois do F5, `useReconectarAuditoria` pergunta a cada 5s e o palco mostra `AuditoriaEmCurso` com `retomada`, cuja frase, sem marcos, é "Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar." (`AuditoriaEmCurso.tsx:129`).

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/auditoria/a4-f5-no-meio.mjs`:

```js
// A4 — F5 no meio. A leitura global demora 20s (`lento:20000`), e o F5 cai aos
// ~5s, com o POST já rodando no servidor. Esperado (catálogo): o palco
// reconecta sozinho, mostra o parecer quando termina, e o bilhete some.
// Memorial curto: a extração leva segundos, então aos 5s a linha "Audit" já
// existe e a leitura global ainda não voltou.
export default {
  id: "a4",
  area: "auditoria",
  titulo: "F5 no meio da auditoria: o palco reconecta e o bilhete some",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-global", "lento:20000");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await ctx.page.waitForTimeout(5000);

    const id = await ctx.conversaAberta();
    const bilheteAntes = (await ctx.lerConversa(id))?.auditoriaPendente ?? null;
    // Sem bilhete no disco antes do F5, a reconexão abaixo não provaria nada.
    ctx.verificar("o bilhete está no disco antes do F5", Boolean(bilheteAntes?.auditId), JSON.stringify(bilheteAntes));

    await ctx.page.reload({ waitUntil: "domcontentloaded" });

    const retomada = ctx.page.getByText("Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar.");
    await retomada.first().waitFor({ timeout: 60_000 }).catch(() => {});
    ctx.verificar("depois do F5 o palco diz que a análise segue no servidor, visível de verdade", await ctx.visivelRolando(retomada), `contagem=${await retomada.count()}`);

    const ver = await ctx.esperarParecer(1, 180_000);
    ctx.verificar("o parecer aparece sozinho, visível de verdade", (await ver.count()) === 1 && (await ctx.visivelRolando(ver)), `botões Ver o parecer=${await ver.count()}`);

    await ctx.page.waitForTimeout(1500);
    const depois = await ctx.lerConversa(id);
    ctx.verificar("o bilhete saiu do disco", !depois?.auditoriaPendente, JSON.stringify(depois?.auditoriaPendente));
    const pareceres = (depois?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar(
      "o parecer entrou no cartão do bilhete",
      pareceres.length === 1 && pareceres[0].artifactId === bilheteAntes?.artifactId,
      `pareceres=${pareceres.map((r) => r.artifactId).join(" | ")} bilhete=${bilheteAntes?.artifactId}`,
    );

    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "uma auditoria, concluída no banco",
      registradas.length === 1 && linhas.length === 1 && linhas[0].status === "COMPLETED",
      `registradas=${registradas.length} ${JSON.stringify(linhas)}`,
    );
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas a4`
Esperado: `ok      a4`.

Se "o palco diz que a análise segue" falhar e o parecer aparecer mesmo assim, a leitura global voltou antes do F5: confira no `servidor.log` a hora de `[audit] requisicao recebida` contra o F5. Aumente para `lento:30000`, não diminua a espera de 5s (antes disso a linha pode não existir e a consulta devolveria 404).

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/auditoria/a4-f5-no-meio.mjs
git diff --cached --stat
git commit -m "a bateria prova que o f5 no meio da auditoria reconecta e entrega o parecer" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 5: jornada A5 — documento idêntico

**Arquivos:**
- Criar: `scripts/bateria/jornadas/auditoria/a5-documento-identico.mjs`

**Interfaces:**
- Consome: os gestos da Tarefa 3.

**O que se espera e o que o código faz hoje (lido em 15/09/2026):**
- A recusa é do servidor: `avaliarBase` (`lib/elegibilidade-da-base.ts:42`) aceita a base só se ela for COMPLETED, sem passada incompleta, com o mesmo `versao_auditor` e sem folha muda pendente; `compararImpressoes` sem alterados nem novos devolve 409 com "O documento é idêntico ao que foi auditado em DD/MM. Não há o que auditar." (`app/api/audit/route.ts:4003-4015`; `formatarDataCurta` usa só dia e mês).
- `postAudit` lê o 409 antes do fluxo e lança a mensagem (`modules/nexo/lib/audit.ts`, "DOCUMENTO IDÊNTICO"); o cartão a mostra em `CardError` e limpa o bilhete.
- **Defeito provável:** `createPendingAudit` (`app/api/audit/route.ts:3875`) cria a linha PROCESSING antes da checagem, e o `return` da recusa não a toca; o `finally` só para o batimento. O cartão também registra o `auditId` na conversa antes do POST (`registrarAuditoria`). Então hoje a conversa registra 2 ids e o banco tem 2 linhas, uma presa em PROCESSING. A jornada deve ficar **vermelha** em "o id recusado não deixou linha no banco"; a Tarefa 6 conserta.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/auditoria/a5-documento-identico.mjs`:

```js
// A5 — auditar o memorial até COMPLETED e auditar de novo o MESMO arquivo.
// Esperado (catálogo): recusa "O documento é idêntico…" legível no cartão, e
// nenhuma auditoria nova no banco.
//
// A base só serve se a primeira rodada saiu limpa (sem passada incompleta, sem
// folha muda pendente — lib/elegibilidade-da-base.ts). Por isso o memorial curto
// e a verificação da primeira rodada antes do gesto: sem ela, "não recusou"
// seria indistinguível de "a base não servia".
export default {
  id: "a5",
  area: "auditoria",
  titulo: "documento idêntico: recusa legível e nenhuma auditoria nova no banco",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await ctx.esperarParecer(1);
    await ctx.page.waitForTimeout(1500);

    const id = await ctx.conversaAberta();
    const primeira = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "a primeira rodada saiu COMPLETED e sem passada incompleta (base que serve)",
      primeira.linhas.length === 1 &&
        primeira.linhas[0].status === "COMPLETED" &&
        (primeira.linhas[0].passadas ?? []).length === 0,
      JSON.stringify(primeira.linhas),
    );

    await (await ctx.esperarBotao(/^Auditar de novo$/, 30_000)).click();
    await ctx.auditarNoCartao();

    const recusa = ctx.page.getByText(/O documento é idêntico ao que foi auditado em \d{2}\/\d{2}\. Não há o que auditar\./);
    await recusa.first().waitFor({ timeout: 120_000 }).catch(() => {});
    ctx.verificar("a recusa aparece no cartão, visível de verdade", await ctx.visivelRolando(recusa), `contagem=${await recusa.count()}`);

    await ctx.page.waitForTimeout(2000);
    const conversa = await ctx.lerConversa(id);
    ctx.verificar("o bilhete da tentativa recusada não ficou no disco", !conversa?.auditoriaPendente, JSON.stringify(conversa?.auditoriaPendente));
    const pareceres = (conversa?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar("continua um parecer só na conversa", pareceres.length === 1, `pareceres=${pareceres.length}`);

    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    // O cartão registra o id ANTES do POST (`registrarAuditoria`), então a
    // conversa conhece dois ids: é por eles que o banco é consultado.
    ctx.verificar("a conversa registrou as duas tentativas", registradas.length === 2, `registradas=${registradas.length}`);
    const recusado = registradas[1]?.auditId;
    ctx.verificar(
      "o id recusado não deixou linha no banco",
      Boolean(recusado) && linhas.length === 1 && !linhas.some((l) => l.id === recusado),
      `recusado=${recusado} linhas=${JSON.stringify(linhas.map((l) => ({ id: l.id, status: l.status })))}`,
    );
  },
};
```

- [ ] **Passo 2: rodar e registrar o vermelho**

Rode: `npm run bateria -- --so-jornadas a5`
Esperado: `FALHOU  a5`, com **uma** falha: `o id recusado não deixou linha no banco :: … linhas=[{…"COMPLETED"},{…"PROCESSING"}]`. As outras verificações `ok`.

- Se a recusa não aparecer, não siga para a Tarefa 6: a base não serviu. Leia no `servidor.log` a linha `[audit] sem reuso: <motivo>` e investigue com `superpowers:systematic-debugging`.
- Se tudo ficar verde, a hipótese caiu: siga a regra "Defeito que não se reproduz" das restrições globais e pule a Tarefa 6.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/auditoria/a5-documento-identico.mjs
git diff --cached --stat
git commit -m "a bateria mostra que a recusa por documento identico deixa uma auditoria presa em processing" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 6: a recusa por documento idêntico não deixa auditoria no banco

**Arquivos:**
- Criar: `lib/auditoria-recusada.ts`
- Criar: `scripts/test-auditoria-recusada.ts`
- Alterar: `app/api/audit/route.ts` (import junto de `@/lib/audit-persistence`; bloco "DOCUMENTO IDÊNTICO: recusa antes de gastar")
- Alterar: `docs/bateria/defeitos-achados.md`

**Interfaces:**
- Produz: `type BancoDoDescarte = { audit: { deleteMany(args: { where: { id: string; status: "PROCESSING" } }): Promise<{ count: number }> }; projectEvent: { deleteMany(args: { where: { type: "AUDIT_CREATED"; details: { path: string[]; equals: string } } }): Promise<{ count: number }> } }` e `descartarAuditoriaRecusada(db: BancoDoDescarte, auditId: string | null): Promise<{ auditorias: number; eventos: number }>`.

**A decisão (registrada no desenho):** a linha nasce antes da extração por um motivo legítimo. Com ela, um F5 durante a extração acha PROCESSING; sem ela, `GET /api/audits/<id>` responde 404 e `consultarAuditoria` declara "Auditoria não encontrada no servidor." sobre uma análise que está começando. Então a criação fica onde está, e a recusa **apaga** a linha que acabou de criar, com o evento "Auditoria criada" que `createPendingAudit` grava junto (`lib/audit-persistence.ts`). O filtro `status: "PROCESSING"` impede apagar auditoria com desfecho. Nenhum token foi gasto antes da recusa, e nada mais aponta para a linha: os filhos (`AuditFile`) caem em cascata.

- [ ] **Passo 1: o teste que falha**

`scripts/test-auditoria-recusada.ts`:

```ts
/**
 * Teste do DESCARTE da auditoria recusada antes de começar.
 *
 * Em 15/09/2026 a jornada a5 (documento idêntico) achou uma linha "Audit" presa
 * em PROCESSING para cada recusa: `createPendingAudit` roda antes da checagem, e
 * o `return` da recusa não a fechava. Ninguém a consulta depois — o bilhete é
 * limpo no cliente —, então ela ficava "rodando" para sempre no histórico.
 *
 *   node scripts/test-auditoria-recusada.ts
 */
import assert from "node:assert/strict";

import { descartarAuditoriaRecusada, type BancoDoDescarte } from "../lib/auditoria-recusada.ts";

let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

function bancoDeMentira(opcoes: { falhar?: boolean } = {}) {
  const chamadas: { tabela: string; where: unknown }[] = [];
  const registrar = (tabela: string) => async (args: { where: unknown }) => {
    if (opcoes.falhar) throw new Error("banco fora do ar");
    chamadas.push({ tabela, where: args.where });
    return { count: 1 };
  };
  const db = {
    audit: { deleteMany: registrar("audit") },
    projectEvent: { deleteMany: registrar("projectEvent") },
  } as unknown as BancoDoDescarte;
  return { db, chamadas };
}

await test("apaga o evento 'Auditoria criada' e a linha PROCESSING daquele id", async () => {
  const { db, chamadas } = bancoDeMentira();
  const r = await descartarAuditoriaRecusada(db, "aud-12345678");
  assert.deepEqual(chamadas, [
    { tabela: "projectEvent", where: { type: "AUDIT_CREATED", details: { path: ["auditId"], equals: "aud-12345678" } } },
    { tabela: "audit", where: { id: "aud-12345678", status: "PROCESSING" } },
  ]);
  assert.deepEqual(r, { auditorias: 1, eventos: 1 });
});

await test("sem id (ambiente sem banco) não toca em nada", async () => {
  const { db, chamadas } = bancoDeMentira();
  assert.deepEqual(await descartarAuditoriaRecusada(db, null), { auditorias: 0, eventos: 0 });
  assert.deepEqual(chamadas, []);
});

await test("falha do banco não derruba a recusa que vai para a tela", async () => {
  const { db } = bancoDeMentira({ falhar: true });
  assert.deepEqual(await descartarAuditoriaRecusada(db, "aud-12345678"), { auditorias: 0, eventos: 0 });
});

console.log(`\n${passed} teste(s) passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-auditoria-recusada.ts`
Esperado: FALHA com `ERR_MODULE_NOT_FOUND` para `lib/auditoria-recusada.ts`.

- [ ] **Passo 3: implementar**

`lib/auditoria-recusada.ts`:

```ts
/**
 * A AUDITORIA RECUSADA ANTES DE COMEÇAR não deixa rastro.
 *
 * `createPendingAudit` cria a linha em PROCESSING logo depois das validações, e
 * isso está certo: um F5 durante a extração precisa achar a auditoria, senão a
 * tela declara "não encontrada" sobre uma análise que está começando. Mas a
 * recusa por documento idêntico vem DEPOIS, e o `return` dela não fechava a
 * linha — medido em 15/09/2026 pela jornada a5: cada recusa deixava uma
 * auditoria "rodando" para sempre, e o evento "Auditoria criada" no histórico
 * do projeto, de um trabalho que nunca existiu.
 *
 * Apagar, e não marcar: nenhum token foi gasto e nenhum achado nasceu. O filtro
 * por PROCESSING é a trava — auditoria com desfecho nunca sai daqui.
 *
 * PURO na forma: recebe o cliente do banco, para o teste rodar em node cru.
 */
export type BancoDoDescarte = {
  audit: {
    deleteMany(args: { where: { id: string; status: "PROCESSING" } }): Promise<{ count: number }>;
  };
  projectEvent: {
    deleteMany(args: {
      where: { type: "AUDIT_CREATED"; details: { path: string[]; equals: string } };
    }): Promise<{ count: number }>;
  };
};

export async function descartarAuditoriaRecusada(
  db: BancoDoDescarte,
  auditId: string | null,
): Promise<{ auditorias: number; eventos: number }> {
  if (!auditId) return { auditorias: 0, eventos: 0 };
  try {
    const eventos = await db.projectEvent.deleteMany({
      where: { type: "AUDIT_CREATED", details: { path: ["auditId"], equals: auditId } },
    });
    const auditorias = await db.audit.deleteMany({
      where: { id: auditId, status: "PROCESSING" },
    });
    return { auditorias: auditorias.count, eventos: eventos.count };
  } catch (err) {
    // A recusa é o que a pessoa precisa ler; falhar em limpar não pode trocá-la
    // por um 500.
    console.error("[audit] não consegui descartar a auditoria recusada", err);
    return { auditorias: 0, eventos: 0 };
  }
}
```

Em `app/api/audit/route.ts`, troque:

```ts
import {
  createPendingAudit,
  manterBatimento,
  persistCompletedAudit,
  persistFailedAudit,
  type UploadedAuditFile,
} from "@/lib/audit-persistence";
```

por:

```ts
import {
  createPendingAudit,
  manterBatimento,
  persistCompletedAudit,
  persistFailedAudit,
  type UploadedAuditFile,
} from "@/lib/audit-persistence";
import { descartarAuditoriaRecusada, type BancoDoDescarte } from "@/lib/auditoria-recusada";
```

E troque:

```ts
      console.log(`[audit] recusada: documento idêntico à auditoria ${auditIdAnterior}`);
      return withCors(
```

por:

```ts
      console.log(`[audit] recusada: documento idêntico à auditoria ${auditIdAnterior}`);
      /*
       * A LINHA QUE ACABOU DE NASCER SAI JUNTO — 15/09/2026, jornada a5. Ela
       * foi criada em PROCESSING lá em cima (e precisa ser, para o F5 durante a
       * extração), e este `return` não passa pelo `catch` que a fecharia. Sem
       * isto, cada recusa deixava uma auditoria "rodando" para sempre.
       */
      await descartarAuditoriaRecusada(getPrisma() as unknown as BancoDoDescarte, persistedAuditId);
      return withCors(
```

- [ ] **Passo 4: teste puro, tipos e jornada**

Rode: `node scripts/test-auditoria-recusada.ts`
Esperado: `3 teste(s) passaram`.

Rode: `npx eslint lib/auditoria-recusada.ts scripts/test-auditoria-recusada.ts app/api/audit/route.ts` e a contagem de tipos.
Esperado: sem erro novo de lint; `0`.

Rode: `npm run bateria -- --so-jornadas a5`
Esperado: `ok      a5`.

- [ ] **Passo 5: commit do conserto**

```bash
git add lib/auditoria-recusada.ts scripts/test-auditoria-recusada.ts app/api/audit/route.ts
git diff --cached --stat
git commit -m "recusar documento identico nao deixa mais auditoria presa em processing" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

- [ ] **Passo 6: registro, com o hash do commit acima**

Rode `git log -1 --format=%h` e use o hash na coluna "Commit". Em `docs/bateria/defeitos-achados.md`, acrescente ao fim da tabela (antes de `## Suspeitas abertas`):

```markdown
| 15/09/2026 | a5 | auditar de novo o mesmo memorial: a recusa "documento idêntico" aparecia, mas cada tentativa deixava uma linha "Audit" em PROCESSING para sempre e o evento "Auditoria criada" no histórico do projeto | `createPendingAudit` cria a linha antes da checagem de idêntico, e o `return` da recusa não passa pelo `catch`; agora a recusa apaga a linha PROCESSING e o evento daquele id | (hash do Passo 5) | scripts/test-auditoria-recusada.ts + a5 |
```

```bash
git add docs/bateria/defeitos-achados.md
git diff --cached --stat
git commit -m "registro do defeito da a5 na lista da bateria" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 7: jornada A6 — folhas mudas

**Arquivos:**
- Criar: `scripts/bateria/jornadas/auditoria/a6-folhas-mudas.mjs`

**Interfaces:**
- Consome: os gestos da Tarefa 3; `memorialComFolhaMuda` (Tarefa 2).

**Textos, conferidos no código:** "Conferindo páginas…" (botão desabilitado enquanto `usePaginasMudas` está em `lendo`), "Páginas sem texto" e "… páginas deste documento não têm texto" (portão), "Transcrever e auditar" (`ConfirmationCard.tsx`, portão da folha muda); "N páginas sem texto recuperadas por visão" (`lib/resumo-do-esforco.ts:141`); o aviso de folha não lida é "AUDITORIA INCOMPLETA — N PÁGINA(S) NÃO FOI/FORAM LIDA(S)" (`lib/auditoria-incompleta.ts`). A transcrição simulada devolve "TEXTO TRANSCRITO PELA IA SIMULADA.": com `origem: "visao"`, a página conta como lida mesmo curta (`lib/pagina-muda.ts:149`).

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/auditoria/a6-folhas-mudas.mjs`:

```js
// A6 — memorial com uma folha só de desenho. Esperado (catálogo): o botão diz
// "Conferindo páginas…" e depois "Transcrever e auditar"; depois de
// transcrever, o parecer sai sem aviso de páginas.
//
// "Conferindo páginas…" dura o diagnóstico de um PDF de quatro páginas — pouco
// para um `waitFor` depois do fato. O `vigiar` fica na página antes do gesto e
// anota se o texto passou pela tela.
export default {
  id: "a6",
  area: "auditoria",
  titulo: "folhas mudas: o cartão confere, transcreve e o parecer sai sem aviso de páginas",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.vigiar("conferindo", "Conferindo páginas…");

    await ctx.abrirCartaoDeAuditoria(f.memorialComFolhaMuda);
    const transcrever = await ctx.esperarBotao(/^Transcrever e auditar$/, 120_000);

    ctx.verificar("o botão passou por 'Conferindo páginas…' antes de liberar", await ctx.viu("conferindo"));
    const tituloDoPortao = ctx.page.getByText("Páginas sem texto", { exact: true });
    // O número mora num <span> dentro do <p>: o <p> é o menor elemento com a frase inteira.
    const frase = ctx.page.getByText(/páginas deste documento não têm texto/);
    const textoDaFrase = (await frase.count()) > 0 ? await frase.first().innerText() : "";
    ctx.verificar(
      "o portão diz quantas folhas estão mudas, visível de verdade",
      (await ctx.visivelRolando(tituloDoPortao)) && /1 de 4/.test(textoDaFrase),
      `título=${await tituloDoPortao.count()} frase=${JSON.stringify(textoDaFrase.slice(0, 80))}`,
    );
    ctx.verificar("'Transcrever e auditar' habilitado", await transcrever.isEnabled());

    const transcricoes = ctx.contarRequisicoes((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/audit/transcrever-pagina");
    await transcrever.click();
    const ver = await ctx.esperarParecer(1);
    transcricoes.parar();
    ctx.verificar("uma folha foi mandada para transcrição", transcricoes.total() === 1, `transcrições=${transcricoes.total()}`);

    await ver.last().click();
    await ctx.page.waitForTimeout(1500);
    const recuperadas = ctx.page.getByText(/páginas sem texto recuperadas por visão/);
    ctx.verificar("o parecer conta a folha recuperada por visão, visível de verdade", await ctx.visivelRolando(recuperadas), `contagem=${await recuperadas.count()}`);
    const avisoDePaginas = ctx.page.getByText(/PÁGINA NÃO FOI LIDA|PÁGINAS NÃO FORAM LIDAS/);
    ctx.verificar("nenhum aviso de página não lida", (await avisoDePaginas.count()) === 0, `contagem=${await avisoDePaginas.count()}`);

    const id = await ctx.conversaAberta();
    const parecer = ((await ctx.lerConversa(id))?.results ?? []).filter((r) => r.kind === "auditoria");
    const cobertura = parecer[0]?.payload?.report?.arquivos_analisados?.[0]?.cobertura;
    ctx.verificar("o parecer gravado registra uma página transcrita", parecer.length === 1 && cobertura?.paginas_transcritas === 1, JSON.stringify(cobertura));

    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar("uma auditoria, concluída no banco", registradas.length === 1 && linhas.length === 1 && linhas[0].status === "COMPLETED", JSON.stringify(linhas));
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas a6`
Esperado: `ok      a6`.

Se "uma folha foi mandada para transcrição" der `0`, a folha não foi diagnosticada muda no navegador (o teste puro da Tarefa 2 prova o diagnóstico do servidor, com o mesmo `classificarPagina`): confira na captura se o portão apareceu antes de mexer em qualquer coisa.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/auditoria/a6-folhas-mudas.mjs
git diff --cached --stat
git commit -m "a bateria prova que folha muda passa pelo portao, e transcrita some do aviso" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 8: jornada A7 — pedido de auditoria no chat com parecer aberto

**Arquivos:**
- Criar: `scripts/bateria/jornadas/auditoria/a7-pedido-no-chat-com-parecer.mjs`

**Interfaces:**
- Consome: os gestos da Tarefa 3.

**O caminho:** com parecer no palco, `NexoChat.send` manda ao chat da auditoria (`POST /api/audit/chat`) tudo que NÃO for `pedeNovaAuditoria` (`modules/nexo/lib/auditoria-da-proposta.ts:201`). "audita o memorial" casa `^(re)?audit(a|ar|e|em)\b` e vai ao agente (`POST /api/nexo/agent`); a IA simulada responde "Vou auditar o memorial (resposta simulada)." com uma proposta de auditoria, que vira cartão.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/auditoria/a7-pedido-no-chat-com-parecer.mjs`:

```js
// A7 — com o parecer no palco, o engenheiro digita "audita o memorial".
// Esperado (catálogo): vai ao agente (não ao chat da auditoria) e aparece
// cartão. Em 14/09/2026 a mesma frase ia ao chat da auditoria e voltou duas
// vezes "Encaminhei a nova auditoria", sem cartão; a porta virou regra no
// cliente (`pedeNovaAuditoria`). A prova é pela rede: nenhuma chamada ao chat da
// auditoria, uma ao agente, e um cartão novo com "Auditar".
const RESPOSTA_DO_AGENTE = "Vou auditar o memorial (resposta simulada).";

export default {
  id: "a7",
  area: "auditoria",
  titulo: "pedir auditoria no chat com parecer aberto vai ao agente e abre cartão",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    const ver = await ctx.esperarParecer(1);
    await ver.last().click();
    await ctx.page.waitForTimeout(1500);

    const respostas = ctx.page.getByText(RESPOSTA_DO_AGENTE, { exact: true });
    const respostasAntes = await respostas.count();
    const botoesAuditarAntes = await ctx.page.getByRole("button", { name: /^Auditar$/ }).count();
    ctx.verificar("antes do pedido não há cartão esperando auditoria", botoesAuditarAntes === 0, `botões Auditar=${botoesAuditarAntes}`);

    const chatDaAuditoria = ctx.contarRequisicoes((req) => new URL(req.url()).pathname === "/api/audit/chat");
    const agente = ctx.contarRequisicoes((req) => new URL(req.url()).pathname === "/api/nexo/agent");
    await ctx.escrever("audita o memorial");

    const respondeu = await ctx.esperar(async () => (await respostas.count()) > respostasAntes, 60_000);
    const auditar = ctx.page.getByRole("button", { name: /^Auditar$/ });
    await auditar.first().waitFor({ timeout: 120_000 }).catch(() => {});
    chatDaAuditoria.parar();
    agente.parar();

    ctx.verificar("o agente respondeu com a proposta", respondeu, `respostas antes=${respostasAntes} depois=${await respostas.count()}`);
    ctx.verificar("o pedido foi ao agente", agente.total() >= 1, `chamadas ao agente=${agente.total()}`);
    ctx.verificar("nada foi ao chat da auditoria", chatDaAuditoria.total() === 0, `chamadas ao chat da auditoria=${chatDaAuditoria.total()}`);
    const qtdAuditar = await auditar.count();
    ctx.verificar("um cartão novo com Auditar, visível de verdade", qtdAuditar === 1 && (await ctx.visivelRolando(auditar)), `botões Auditar=${qtdAuditar}`);
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas a7`
Esperado: `ok      a7`.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/auditoria/a7-pedido-no-chat-com-parecer.mjs
git diff --cached --stat
git commit -m "a bateria prova que pedir auditoria no chat com parecer aberto abre cartao novo" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---
### Tarefa 9: jornada C1 — o mesmo memorial solto duas vezes

**Arquivos:**
- Criar: `scripts/bateria/jornadas/conversas/c1-mesmo-memorial-duas-vezes.mjs`

**Interfaces:**
- Consome: `ctx.fixtures`, `ctx.anexar`, `ctx.esperarTexto`, `ctx.conversaAberta`, `ctx.lerConversa`, `ctx.visivelRolando`.
- Produz, para a Tarefa 10, a frase exata da linha curta: `O memorial <nome> já está nesta conversa — não li de novo.`

**Hoje (lido em 15/09/2026):** `readSelos` (`modules/nexo/components/NexoWorkspace.tsx:1004`) concatena os chips sem olhar o que já existe, e `appendMemorialIntake` (`:874`) sempre grava "Anexei o memorial — <nome>" e "Li as primeiras páginas…". As pranchas já deduplicam por nome (`lerPranchas`, comentário "Dedup por nome"); o memorial, não. A jornada deve ficar **vermelha** nas contagens do segundo anexo.

**Decisão (Matheus, 15/09/2026):** deduplicar por nome de arquivo; no máximo uma linha curta.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/conversas/c1-mesmo-memorial-duas-vezes.mjs`:

```js
// C1 — soltar de novo o memorial que a conversa já tem. Decidido pelo Matheus
// em 15/09/2026: deduplicar por nome de arquivo, a mesma regra das pranchas.
// Esperado: um chip, uma "Anexei o memorial", uma "Li as primeiras páginas", e
// no máximo uma linha curta dizendo que o memorial já está na conversa.
//
// As mensagens são contadas NO DISCO da conversa aberta (o que volta num F5), e
// o chip pelo botão de remover, que cada anexo tem um.
import path from "node:path";

export default {
  id: "c1",
  area: "conversas",
  titulo: "o mesmo memorial solto duas vezes fica um memorial só",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    const nome = path.basename(f.memorialCurto);
    const chip = ctx.page.getByRole("button", { name: `Remover ${nome}` });

    const contar = async () => {
      const conversa = await ctx.lerConversa(await ctx.conversaAberta());
      const mensagens = conversa?.messages ?? [];
      return {
        chips: await chip.count(),
        anexei: mensagens.filter((m) => String(m.content ?? "").startsWith(`Anexei o memorial — ${nome}`)).length,
        li: mensagens.filter((m) => String(m.content ?? "").startsWith("Li as primeiras páginas")).length,
        memorial: conversa?.memorial?.name ?? null,
      };
    };

    await ctx.anexar([f.memorialCurto]);
    await ctx.esperarTexto(/Li as primeiras páginas/, 120_000);
    await ctx.page.waitForTimeout(1500);
    const primeira = await contar();
    // Sem esta linha, "continua um chip" lá embaixo poderia ser "nunca houve chip".
    ctx.verificar(
      "primeiro anexo: um chip, uma 'Anexei o memorial', uma 'Li as primeiras páginas'",
      primeira.chips === 1 && primeira.anexei === 1 && primeira.li === 1 && primeira.memorial === nome,
      JSON.stringify(primeira),
    );

    await ctx.anexar([f.memorialCurto]);
    const linha = ctx.page.getByText(`O memorial ${nome} já está nesta conversa — não li de novo.`);
    await linha.first().waitFor({ timeout: 30_000 }).catch(() => {});
    // Passa da janela do debounce (500ms) e de uma segunda leitura que ainda estivesse chegando.
    await ctx.page.waitForTimeout(4000);
    const segunda = await contar();

    ctx.verificar("segundo anexo: continua um chip", segunda.chips === 1, JSON.stringify(segunda));
    ctx.verificar("segundo anexo: continua uma 'Anexei o memorial'", segunda.anexei === 1, JSON.stringify(segunda));
    ctx.verificar("segundo anexo: continua uma 'Li as primeiras páginas'", segunda.li === 1, JSON.stringify(segunda));
    ctx.verificar("o memorial retido é o mesmo", segunda.memorial === nome, JSON.stringify(segunda));
    ctx.verificar("a linha curta diz que o memorial já está na conversa, visível de verdade", (await linha.count()) === 1 && (await ctx.visivelRolando(linha)), `contagem=${await linha.count()}`);
  },
};
```

- [ ] **Passo 2: rodar e registrar o vermelho**

Rode: `npm run bateria -- --so-jornadas c1`
Esperado: `FALHOU  c1`, com a verificação do primeiro anexo `ok` e as do segundo em `FALHOU` (`chips: 2`, `anexei: 2`, `li: 2`, linha curta ausente).

Se o primeiro anexo já falhar, a jornada está errada, não o produto: confira na captura quantos chips aparecem e se o `aria-label` do botão de remover mudou (`AttachmentChip`, `NexoChat.tsx`).

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/conversas/c1-mesmo-memorial-duas-vezes.mjs
git diff --cached --stat
git commit -m "a bateria mostra que soltar o mesmo memorial duas vezes duplica chip e mensagens" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 10: o memorial repetido não é lido de novo

**Arquivos:**
- Criar: `modules/nexo/lib/memorial-repetido.ts`
- Criar: `scripts/test-memorial-repetido.ts`
- Alterar: `modules/nexo/components/NexoWorkspace.tsx` (import; começo de `readSelos`)

**Interfaces:**
- Consome: a frase da Tarefa 9.
- Produz: `separarMemorialRepetido<T extends { name: string }>(pdfs: readonly T[], nomeDoMemorialRetido: string | null): { novos: T[]; repetido: string | null }`.

- [ ] **Passo 1: o teste que falha**

`scripts/test-memorial-repetido.ts`:

```ts
/**
 * Teste da DEDUPLICAÇÃO do memorial pelo nome.
 *
 * Decidido pelo Matheus em 15/09/2026 (cenário C1 da bateria): soltar de novo o
 * memorial que a conversa já tem não cria chip nem relê o documento. É a mesma
 * régua que as pranchas seguem desde o "soltar o mesmo arquivo de novo não o
 * duplica" (NexoWorkspace.tsx) — por NOME EXATO, que é o que a tela mostra.
 *
 *   node scripts/test-memorial-repetido.ts
 */
import assert from "node:assert/strict";

import { separarMemorialRepetido } from "../modules/nexo/lib/memorial-repetido.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const arquivo = (name: string) => ({ name });

test("sem memorial retido, tudo é novo", () => {
  const pdfs = [arquivo("990_26_md_bateria_a.pdf")];
  assert.deepEqual(separarMemorialRepetido(pdfs, null), { novos: pdfs, repetido: null });
});

test("o mesmo nome do memorial retido sai do lote e é dito", () => {
  const r = separarMemorialRepetido([arquivo("990_26_md_bateria_a.pdf")], "990_26_md_bateria_a.pdf");
  assert.deepEqual(r, { novos: [], repetido: "990_26_md_bateria_a.pdf" });
});

test("no lote misto, as pranchas seguem e só o memorial repetido sai", () => {
  const r = separarMemorialRepetido(
    [arquivo("990_26_md_bateria_a.pdf"), arquivo("990_26_est_001_a.pdf")],
    "990_26_md_bateria_a.pdf",
  );
  assert.deepEqual(r, { novos: [arquivo("990_26_est_001_a.pdf")], repetido: "990_26_md_bateria_a.pdf" });
});

test("outro memorial, com outro nome, não é repetido", () => {
  const pdfs = [arquivo("990_26_md_bateria_b.pdf")];
  assert.deepEqual(separarMemorialRepetido(pdfs, "990_26_md_bateria_a.pdf"), { novos: pdfs, repetido: null });
});

test("a regra é o nome exato, como nas pranchas", () => {
  const pdfs = [arquivo("990_26_MD_BATERIA_A.pdf")];
  assert.deepEqual(separarMemorialRepetido(pdfs, "990_26_md_bateria_a.pdf"), { novos: pdfs, repetido: null });
});

console.log(`\n${passed} teste(s) passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-memorial-repetido.ts`
Esperado: FALHA com `ERR_MODULE_NOT_FOUND` para `modules/nexo/lib/memorial-repetido.ts`.

- [ ] **Passo 3: implementar a regra**

`modules/nexo/lib/memorial-repetido.ts`:

```ts
/**
 * O MESMO MEMORIAL SOLTO DE NOVO.
 *
 * Até 15/09/2026, soltar outra vez o memorial que a conversa já tinha criava um
 * segundo chip, relia o documento e gravava de novo "Anexei o memorial" e "Li as
 * primeiras páginas" — duas rodadas idênticas no histórico (jornada c1). As
 * pranchas já não duplicavam: a regra é por nome, e o Matheus decidiu que o
 * memorial segue a mesma.
 *
 * Nome EXATO, e não por conteúdo: é o que a tela mostra no chip, e renomear o
 * arquivo é o gesto de quem quer que ele conte como outro.
 *
 * PURO e sem imports: roda no node cru.
 */
export function separarMemorialRepetido<T extends { name: string }>(
  pdfs: readonly T[],
  nomeDoMemorialRetido: string | null,
): { novos: T[]; repetido: string | null } {
  if (!nomeDoMemorialRetido) return { novos: [...pdfs], repetido: null };
  const novos = pdfs.filter((f) => f.name !== nomeDoMemorialRetido);
  return { novos, repetido: novos.length < pdfs.length ? nomeDoMemorialRetido : null };
}
```

- [ ] **Passo 4: rodar e ver passar**

Rode: `node scripts/test-memorial-repetido.ts`
Esperado: `5 teste(s) passaram`.

- [ ] **Passo 5: ligar no anexo**

Em `modules/nexo/components/NexoWorkspace.tsx` (arquivo sujo para o prettier: edite à mão), troque:

```ts
import { duracaoLegivel, useSessaoExpirada } from "../lib/use-sessao-expirada";
```

por:

```ts
import { duracaoLegivel, useSessaoExpirada } from "../lib/use-sessao-expirada";
import { separarMemorialRepetido } from "../lib/memorial-repetido";
```

Troque:

```ts
  async function readSelos(list: FileList | null) {
    const all = list ? Array.from(list) : [];
    const pdfs = all.filter((f) => /\.pdf$/i.test(f.name));
    const images = all.filter(isImageFile);
```

por:

```ts
  async function readSelos(list: FileList | null) {
    const all = list ? Array.from(list) : [];
    const pdfsSoltos = all.filter((f) => /\.pdf$/i.test(f.name));
    const images = all.filter(isImageFile);
    /*
     * O MEMORIAL QUE A CONVERSA JÁ TEM não entra de novo — decidido em
     * 15/09/2026 (jornada c1). Sai ANTES dos chips e do pré-voo: soltá-lo outra
     * vez criava um segundo chip, relia o documento e repetia "Anexei o memorial"
     * e "Li as primeiras páginas" no histórico. Mesma régua das pranchas: o nome.
     */
    const { novos: pdfs, repetido } = separarMemorialRepetido(
      pdfsSoltos,
      memorialFile?.name ?? null,
    );
```

Troque:

```ts
    const recusados = all.filter((f) => !pdfs.includes(f) && !images.includes(f));
```

por:

```ts
    const recusados = all.filter((f) => !pdfsSoltos.includes(f) && !images.includes(f));
```

Troque:

```ts
    if (pdfs.length === 0 && images.length === 0) return;
    setError(null);
```

por:

```ts
    if (repetido) {
      // Uma linha, e não silêncio: soltar o arquivo e nada acontecer se lê como travamento.
      conv.appendMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `O memorial ${repetido} já está nesta conversa — não li de novo.`,
      });
    }
    if (pdfs.length === 0 && images.length === 0) return;
    setError(null);
```

- [ ] **Passo 6: verificar**

Rode: `npx eslint modules/nexo/lib/memorial-repetido.ts modules/nexo/components/NexoWorkspace.tsx scripts/test-memorial-repetido.ts` e a contagem de tipos.
Esperado: sem erro novo de lint; `0`.

Rode: `npm run bateria -- --so-jornadas c1`
Esperado: `ok      c1`.

Rode também: `npm run bateria -- --so-jornadas a1` (anexa o 117_25 numa conversa nova; a dedup não pode alcançá-la).
Esperado: `ok      a1`.

- [ ] **Passo 7: commit**

```bash
git add modules/nexo/lib/memorial-repetido.ts scripts/test-memorial-repetido.ts modules/nexo/components/NexoWorkspace.tsx
git diff --cached --stat
git commit -m "soltar de novo o memorial que a conversa ja tem nao duplica chip nem mensagens" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 11: jornada C2 — memorial e pranchas no mesmo drop

**Arquivos:**
- Criar: `scripts/bateria/jornadas/conversas/c2-memorial-e-pranchas.mjs`

**Interfaces:**
- Consome: `nexo-selo` simulado (Tarefa 1); `memorialCurto` e `pranchas` (Tarefa 2); gestos da Tarefa 3.

**O caminho:** `readSelos` passa o lote inteiro pelo pré-voo (`preVoarLote`) antes de ler qualquer coisa; `decidirPapel` decide memorial pelo nome `md` e prancha pelo papel de 1-2 páginas (`modules/nexo/lib/papel-do-anexo.ts`); o memorial é retido (`conv.salvarMemorial`) e as pranchas vão a `lerPranchas`, uma chamada de `POST /api/ld/extract-stamp` por página. O recibo é "Anexei 3 folhas — …" (`appendSelosIntake`). No chip, o memorial oferece "tratar como prancha"; a prancha lida não oferece nada (`AttachmentChip`, "O CONVITE SOME QUANDO O CARIMBO FOI LIDO").

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/conversas/c2-memorial-e-pranchas.mjs`:

```js
// C2 — memorial e três pranchas soltos juntos. Esperado (catálogo): o memorial
// vira memorial, as pranchas vão à leitura de selo, e nenhuma prancha é lida
// como memorial. A contagem de chamadas ao leitor de selo é o que prova que o
// memorial não foi para o OCR: três pranchas de uma página, três chamadas.
import path from "node:path";

export default {
  id: "c2",
  area: "conversas",
  titulo: "memorial e pranchas no mesmo drop: cada um no seu fluxo",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    const nomeDoMemorial = path.basename(f.memorialCurto);
    const nomesDasPranchas = f.pranchas.map((p) => path.basename(p)).sort();

    const leiturasDeSelo = ctx.contarRequisicoes((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/ld/extract-stamp");
    await ctx.anexar([f.memorialCurto, ...f.pranchas]);
    await ctx.esperarTexto(/Anexei 3 folhas/, 180_000);

    const id = await ctx.conversaAberta();
    await ctx.esperar(async () => {
      const c = await ctx.lerConversa(id);
      return (c?.seloResults?.length ?? 0) === 3 && Boolean(c?.memorial);
    }, 30_000);
    leiturasDeSelo.parar();
    const conversa = await ctx.lerConversa(id);

    ctx.verificar("três leituras de selo, uma por prancha", leiturasDeSelo.total() === 3, `leituras=${leiturasDeSelo.total()}`);
    ctx.verificar("o memorial ficou retido como memorial", conversa?.memorial?.name === nomeDoMemorial, JSON.stringify(conversa?.memorial));
    const lidas = (conversa?.seloResults ?? []).map((r) => r.fileName).sort();
    ctx.verificar("as folhas lidas são as três pranchas", JSON.stringify(lidas) === JSON.stringify(nomesDasPranchas), JSON.stringify(lidas));
    ctx.verificar("nenhuma folha lida é o memorial", !lidas.includes(nomeDoMemorial), JSON.stringify(lidas));
    ctx.verificar(
      "as três pranchas voltaram com carimbo lido",
      (conversa?.seloResults ?? []).length === 3 && conversa.seloResults.every((r) => r.extraction?.arquivo),
      JSON.stringify((conversa?.seloResults ?? []).map((r) => r.extraction?.arquivo ?? null)),
    );

    const recibo = ctx.page.getByText(/Anexei 3 folhas/);
    ctx.verificar("o recibo das pranchas, visível de verdade", await ctx.visivelRolando(recibo), `contagem=${await recibo.count()}`);
    const trocarMemorial = ctx.page.getByRole("button", { name: /^tratar como prancha$/ });
    ctx.verificar("só o memorial se oferece para virar prancha", (await trocarMemorial.count()) === 1, `contagem=${await trocarMemorial.count()}`);
    const auditar = ctx.page.getByRole("button", { name: /Auditar o memorial/ });
    ctx.verificar("com memorial no lote, auditar é oferecido, visível de verdade", await ctx.visivelRolando(auditar), `contagem=${await auditar.count()}`);
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas c2`
Esperado: `ok      c2`.

Se "três leituras de selo" der `2` ou `4`: com 4, o memorial foi para o OCR (defeito de produto: siga "Tratamento de defeito achado"); com menos de 3, confira no `servidor.log` se alguma prancha caiu em "operação sem simulação" (a Tarefa 1 não cobriu o caso) ou se o cache de selo devolveu uma leitura (o contexto é novo a cada jornada, então não deveria).

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/conversas/c2-memorial-e-pranchas.mjs
git diff --cached --stat
git commit -m "a bateria prova que memorial e pranchas soltos juntos seguem cada um o seu fluxo" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 12: jornada C5 — trocar de conversa durante a auditoria

**Arquivos:**
- Criar: `scripts/bateria/jornadas/conversas/c5-trocar-de-conversa.mjs`

**Interfaces:**
- Consome: gestos da Tarefa 3; `ctx.indexeddb.gravarConversa`; `ctx.banco.consultar`.

**Defeito provável (lido em 15/09/2026, NÃO confirmado por execução):** `AuditoriaConfirmation.confirm` (`ConfirmationCard.tsx`) chama `saveResult` quando o POST termina, e `saveResult` grava na conversa do snapshot NESSE instante (`const convId = snapshotRef.current.conversationId`, `conversation-store.tsx:942`). O `finally` limpa o bilhete com `marcarAuditoriaPendente(null)`, que também mira a conversa aberta. Se o engenheiro trocou de conversa no meio, o parecer de A vai parar em B; A ainda recebe o parecer depois, pela reconexão (o bilhete dela ficou). As correções de 14 e 15/09 (`agenda-de-gravacao.ts`) fecham a janela CURTA da troca; esta é a corrida LONGA, a auditoria inteira. A jornada deve ficar **vermelha** em "B não ganhou parecer".

**Por que a volta para A é por F5:** a barra lateral não carrega o id da conversa, e as conversas das jornadas anteriores (do mesmo usuário, no servidor) aparecem com o mesmo título "Memorial". Voltar pelo `nexo:ultima-conversa` e F5 é o caminho que o engenheiro percorre ao reabrir o Nexo, e o dano (parecer em B) já está decidido antes da volta.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/conversas/c5-trocar-de-conversa.mjs`:

```js
// C5 — auditar em A, abrir B durante a análise, esperar o servidor terminar
// com B aberta, voltar para A. Esperado (catálogo): a auditoria segue, o parecer
// aparece na conversa certa e não na outra.
//
// B é semeada ANTES de tudo, com título próprio, para existir na barra lateral e
// ser aberta por clique — a troca tem de acontecer na MESMA página, com o cartão
// de A ainda esperando a resposta. Um F5 aqui mataria a espera e testaria A4.
export default {
  id: "c5",
  area: "conversas",
  titulo: "trocar de conversa durante a auditoria não leva o parecer para a outra",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();

    const agora = Date.now();
    const idB = `bateria-c5-b-${agora}`;
    await ctx.indexeddb.gravarConversa({
      id: idB,
      title: "BATERIA C5 B",
      createdAt: agora - 3_600_000,
      updatedAt: agora - 3_600_000,
      seloResults: [],
      messages: [
        { id: "b1", role: "user", content: "conversa de controle da bateria" },
        { id: "b2", role: "assistant", content: "Entendido." },
      ],
      results: [],
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);

    await ctx.ia.fila("audit-global", "lento:15000");
    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await page.waitForTimeout(3000);

    const idA = await ctx.conversaAberta();
    const bilhete = (await ctx.lerConversa(idA))?.auditoriaPendente ?? null;
    ctx.verificar("A tem o bilhete no disco antes da troca", Boolean(bilhete?.auditId) && idA !== idB, `A=${idA} bilhete=${JSON.stringify(bilhete)}`);
    if (!bilhete?.auditId) return;

    await page.getByText("BATERIA C5 B").first().click({ timeout: 30_000 });
    await page.waitForTimeout(2500);
    const barraB = await ctx.marcadaNaBarra("BATERIA C5 B");
    ctx.verificar("B está aberta enquanto A audita", barraB.ok && (await ctx.conversaAberta()) === idB, barraB.detalhe);

    // O servidor termina a auditoria de A com B aberta; depois, o cartão de A
    // recebe a resposta e decide onde gravar.
    const terminou = await ctx.esperar(async () => {
      const [linha] = await ctx.banco.consultar(`select status from "Audit" where id = $1`, [bilhete.auditId]);
      return linha?.status === "COMPLETED";
    }, 180_000, 2000);
    ctx.verificar("a auditoria de A seguiu até o fim no servidor", terminou);
    await page.waitForTimeout(5000);

    const barraAindaB = await ctx.marcadaNaBarra("BATERIA C5 B");
    ctx.verificar("B continuava aberta quando o parecer chegou", barraAindaB.ok && (await ctx.conversaAberta()) === idB, barraAindaB.detalhe);
    const pareceresEmB = ((await ctx.lerConversa(idB))?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar("B não ganhou parecer no disco", pareceresEmB.length === 0, pareceresEmB.map((r) => r.artifactId).join(" | "));
    const verEmB = await page.getByRole("button", { name: /Ver o parecer/ }).count();
    ctx.verificar("a tela de B não mostra parecer", verEmB === 0, `botões Ver o parecer=${verEmB}`);

    // De volta para A, como quem reabre o Nexo.
    await page.evaluate((id) => localStorage.setItem("nexo:ultima-conversa", id), idA);
    await page.reload({ waitUntil: "domcontentloaded" });
    const ver = await ctx.esperarParecer(1, 120_000);
    ctx.verificar("A mostra o parecer, visível de verdade", (await ver.count()) === 1 && (await ctx.visivelRolando(ver)), `botões Ver o parecer=${await ver.count()}`);
    await page.waitForTimeout(1500);

    const recA = await ctx.lerConversa(idA);
    const pareceresEmA = (recA?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar(
      "A tem um parecer, no cartão do bilhete",
      pareceresEmA.length === 1 && pareceresEmA[0].artifactId === bilhete.artifactId,
      `pareceres=${pareceresEmA.map((r) => r.artifactId).join(" | ")} bilhete=${bilhete.artifactId}`,
    );
    ctx.verificar("o bilhete de A saiu do disco", !recA?.auditoriaPendente, JSON.stringify(recA?.auditoriaPendente));
    const pareceresEmBNoFim = ((await ctx.lerConversa(idB))?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar("B segue sem parecer no fim", pareceresEmBNoFim.length === 0, `pareceres em B=${pareceresEmBNoFim.length}`);
  },
};
```

- [ ] **Passo 2: rodar e registrar o vermelho**

Rode: `npm run bateria -- --so-jornadas c5`
Esperado: `FALHOU  c5`, com `B não ganhou parecer no disco` e `B segue sem parecer no fim` em `FALHOU` e as demais `ok`.

**Antes de seguir, abra `scratchpad/bateria/<data>/c5.png`** e confirme que a conversa marcada na barra é a de A (a captura sai no fim, com A reaberta) e releia os detalhes de "B continuava aberta quando o parecer chegou": se essa verificação falhou, o parecer não chegou com B aberta e a jornada não testou o que diz — ajuste o tempo (`lento:15000`, a espera de 5s) antes de concluir qualquer coisa. Se as verificações de B passarem, a hipótese caiu: aplique "Defeito que não se reproduz" e pule a Tarefa 13.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/conversas/c5-trocar-de-conversa.mjs
git diff --cached --stat
git commit -m "a bateria mostra que trocar de conversa durante a auditoria leva o parecer para a outra" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 13: o parecer que chega fica na conversa que o pediu

**Arquivos:**
- Criar: `modules/nexo/lib/destino-do-parecer.ts`
- Criar: `scripts/test-destino-do-parecer.ts`
- Alterar: `modules/nexo/state/conversation-store.tsx` (tipo `ConversationStoreValue`; `conversaAberta`; valor e dependências do `useMemo`)
- Alterar: `modules/nexo/components/ConfirmationCard.tsx` (import; `AuditoriaConfirmation.confirm`)
- Alterar: `docs/bateria/defeitos-achados.md`

**Interfaces:**
- Produz:
  - `desfechoNaChegada(args: { origem: string; aberta: string; desconectou: boolean }): { gravarParecer: boolean; limparBilhete: boolean }`
  - no store: `conversaAberta: () => string` (lê `snapshotRef.current.conversationId` na hora)

**O conserto mínimo:** o cartão lembra a conversa de origem no clique. Quando a resposta chega com outra conversa aberta, ele não grava o parecer e não mexe no bilhete. O bilhete de A já está no disco (gravado no clique, e de novo no flush da troca), e `useReconectarAuditoria` entrega o parecer a A quando ela for aberta, pelo `GET /api/audits/<id>`, que é o caminho que A4 prova. Nenhum segundo caminho de gravação.

Limite assumido: a resposta que chegar dentro da janela da troca (entre `selectConversation` e o commit da conversa nova, milissegundos) ainda lê o id antigo no snapshot. Não há caso medido; fica anotado no comentário.

- [ ] **Passo 1: o teste que falha**

`scripts/test-destino-do-parecer.ts`:

```ts
/**
 * Teste de ONDE O PARECER QUE CHEGA É GRAVADO.
 *
 * Em 15/09/2026 a jornada c5 abriu outra conversa enquanto a auditoria de A
 * rodava: quando a resposta chegou, `saveResult` gravou o parecer de A na
 * conversa aberta, B, e o `finally` limpou o bilhete de B em vez do de A. A
 * regra: só a conversa que pediu recebe o parecer; aberta outra, o bilhete de A
 * fica, e A se reconecta ao ser reaberta.
 *
 *   node scripts/test-destino-do-parecer.ts
 */
import assert from "node:assert/strict";

import { desfechoNaChegada } from "../modules/nexo/lib/destino-do-parecer.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

test("a mesma conversa aberta: grava o parecer e fecha o bilhete", () => {
  assert.deepEqual(desfechoNaChegada({ origem: "A", aberta: "A", desconectou: false }), { gravarParecer: true, limparBilhete: true });
});

test("outra conversa aberta: não grava nela, e o bilhete de A fica para a reconexão", () => {
  assert.deepEqual(desfechoNaChegada({ origem: "A", aberta: "B", desconectou: false }), { gravarParecer: false, limparBilhete: false });
});

test("conexão caída na própria conversa: o bilhete fica (regra de 12/08/2026)", () => {
  assert.deepEqual(desfechoNaChegada({ origem: "A", aberta: "A", desconectou: true }), { gravarParecer: false, limparBilhete: false });
});

test("origem desconhecida nunca grava em conversa nenhuma", () => {
  assert.deepEqual(desfechoNaChegada({ origem: "", aberta: "", desconectou: false }), { gravarParecer: false, limparBilhete: false });
});

console.log(`\n${passed} teste(s) passaram`);
```

- [ ] **Passo 2: rodar e ver falhar**

Rode: `node scripts/test-destino-do-parecer.ts`
Esperado: FALHA com `ERR_MODULE_NOT_FOUND` para `modules/nexo/lib/destino-do-parecer.ts`.

- [ ] **Passo 3: a regra**

`modules/nexo/lib/destino-do-parecer.ts`:

```ts
/**
 * ONDE GRAVAR O PARECER QUE ACABOU DE CHEGAR.
 *
 * A auditoria leva minutos, e o engenheiro troca de conversa nesse meio-tempo.
 * O cartão gravava o resultado na conversa aberta NO INSTANTE DA CHEGADA: em
 * 15/09/2026 a jornada c5 pôs o parecer de A dentro de B, e limpou o bilhete de B
 * no lugar do de A. As correções da janela de troca (`agenda-de-gravacao.ts`)
 * não alcançam isto: aquela corrida dura milissegundos; esta dura a auditoria.
 *
 * Aberta outra conversa, nada é gravado e o bilhete de A FICA: ao reabrir A,
 * `useReconectarAuditoria` pergunta ao servidor e grava o parecer nela — o mesmo
 * caminho do F5, sem uma segunda via de gravação.
 *
 * PURO e sem imports: roda no node cru.
 */
export function desfechoNaChegada(args: {
  origem: string;
  aberta: string;
  desconectou: boolean;
}): { gravarParecer: boolean; limparBilhete: boolean } {
  const naOrigem = args.origem !== "" && args.origem === args.aberta;
  const cicloFechadoAqui = naOrigem && !args.desconectou;
  return { gravarParecer: cicloFechadoAqui, limparBilhete: cicloFechadoAqui };
}
```

Rode: `node scripts/test-destino-do-parecer.ts`
Esperado: `4 teste(s) passaram`.

- [ ] **Passo 4: o store diz qual conversa está aberta agora**

Em `modules/nexo/state/conversation-store.tsx` (sujo para o prettier: edite à mão), troque:

```ts
  auditoriaPendente: AuditoriaPendente | null;
  marcarAuditoriaPendente: (p: Omit<AuditoriaPendente, "inicioMs"> | null) => void;
```

por:

```ts
  auditoriaPendente: AuditoriaPendente | null;
  marcarAuditoriaPendente: (p: Omit<AuditoriaPendente, "inicioMs"> | null) => void;
  /**
   * A conversa aberta AGORA, lida do snapshot no momento da chamada — e não a do
   * render em que o chamador nasceu. É o que deixa uma resposta que chega minutos
   * depois saber se ainda está na conversa que a pediu (jornada c5, 15/09/2026).
   */
  conversaAberta: () => string;
```

Logo acima de `  const value = useMemo<ConversationStoreValue>(`, acrescente:

```ts
  const conversaAberta = useCallback(() => snapshotRef.current.conversationId, []);

```

E troque as DUAS ocorrências (objeto do valor e lista de dependências; use `replace_all`):

```ts
      marcarAuditoriaPendente,
      salvarMemorial,
```

por:

```ts
      marcarAuditoriaPendente,
      conversaAberta,
      salvarMemorial,
```

- [ ] **Passo 5: o cartão grava só na origem**

Em `modules/nexo/components/ConfirmationCard.tsx` (sujo para o prettier: edite à mão), troque:

```ts
import { idDaAuditoriaDaProposta } from "../lib/auditoria-da-proposta";
```

por:

```ts
import { idDaAuditoriaDaProposta } from "../lib/auditoria-da-proposta";
import { desfechoNaChegada } from "../lib/destino-do-parecer";
```

Troque (em `AuditoriaConfirmation`):

```ts
    projectId: projetoDaConversa,
    vincularProjeto,
    appendMessage,
  } = useConversation();
```

por:

```ts
    projectId: projetoDaConversa,
    vincularProjeto,
    appendMessage,
    conversaAberta,
  } = useConversation();
```

Troque:

```ts
    let desconectou = false;
```

por:

```ts
    let desconectou = false;
    /*
     * A CONVERSA QUE PEDIU — 15/09/2026, jornada c5. A resposta chega minutos
     * depois, e `saveResult` grava na conversa aberta NAQUELE instante: trocar
     * de conversa no meio levava o parecer para a outra. Ver
     * [[destino-do-parecer.ts]]. Limite: uma resposta que caia na janela de
     * milissegundos da própria troca ainda lê o id anterior (sem caso medido).
     */
    const origem = conversationId;
```

Troque:

```ts
      await saveResult({
        artifactId: id,
        kind: "auditoria",
        summary: resumoDoParecer(r.report),
```

por:

```ts
      if (!desfechoNaChegada({ origem, aberta: conversaAberta(), desconectou: false }).gravarParecer) {
        // Outra conversa aberta: o bilhete desta fica, e ela reconecta ao ser reaberta.
        return;
      }
      await saveResult({
        artifactId: id,
        kind: "auditoria",
        summary: resumoDoParecer(r.report),
```

E troque:

```ts
      if (!desconectou) marcarAuditoriaPendente(null);
```

por:

```ts
      if (desfechoNaChegada({ origem, aberta: conversaAberta(), desconectou }).limparBilhete) {
        marcarAuditoriaPendente(null);
      }
```

- [ ] **Passo 6: verificar**

Rode: `npx eslint modules/nexo/lib/destino-do-parecer.ts modules/nexo/state/conversation-store.tsx modules/nexo/components/ConfirmationCard.tsx scripts/test-destino-do-parecer.ts` e a contagem de tipos.
Esperado: sem erro novo de lint; `0`.

Rode: `npm run bateria -- --so-jornadas c5`
Esperado: `ok      c5`.

Regressão das jornadas que passam por este cartão e pelo bilhete: `npm run bateria -- --so-jornadas auditoria` e `npm run bateria -- --so-jornadas c6`.
Esperado: todas `ok`.

- [ ] **Passo 7: commit**

```bash
git add modules/nexo/lib/destino-do-parecer.ts scripts/test-destino-do-parecer.ts modules/nexo/state/conversation-store.tsx modules/nexo/components/ConfirmationCard.tsx
git diff --cached --stat
git commit -m "o parecer que chega depois de trocar de conversa fica na conversa que o pediu" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

- [ ] **Passo 8: registro, com o hash do Passo 7**

Em `docs/bateria/defeitos-achados.md`, antes de `## Suspeitas abertas`:

```markdown
| 15/09/2026 | c5 | abrir outra conversa durante a auditoria: quando a resposta chegava, o parecer de A era gravado em B e o bilhete limpo era o de B | `saveResult` e `marcarAuditoriaPendente(null)` miram a conversa aberta no instante da chegada; agora o cartão lembra a conversa de origem e, com outra aberta, não grava nem limpa — A recebe o parecer pela reconexão ao ser reaberta | (hash do Passo 7) | scripts/test-destino-do-parecer.ts + c5 |
```

Se na Tarefa 12 houve alguma correção de tempo na jornada, diga isso também na coluna "Causa".

```bash
git add docs/bateria/defeitos-achados.md
git diff --cached --stat
git commit -m "registro do defeito da c5 na lista da bateria" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---
### Tarefa 14: jornada C3 — duas abas na mesma conversa

**Arquivos:**
- Criar: `scripts/bateria/jornadas/conversas/c3-duas-abas.mjs`

**Interfaces:**
- Consome: `ctx.abrirOutraAba()`; gestos da Tarefa 3 (`escrever` e `conversaAberta` com a segunda aba).
- Produz, para a Tarefa 15, o contrato que a jornada exige:
  - a faixa da aba desatualizada tem o título exato `Esta conversa mudou em outra aba` e o botão `Recarregar a conversa`;
  - `PUT /api/nexo/conversas` com o cabeçalho `x-nexo-versao-base` mais velho que a versão guardada responde `409` com `{ desatualizada: true }`.

**Hoje (lido em 15/09/2026, NÃO confirmado por execução):** o `PUT` só descarta gravação cujo `updatedAt` é mais velho que o guardado (`app/api/nexo/conversas/route.ts:185`). O `updatedAt` é `Date.now()` da hora em que a aba grava (`persistNow`, `conversation-store.tsx:610`), então a aba parada grava com hora nova e conteúdo velho, e passa. E ela grava primeiro no IndexedDB (`putConversation`), que as duas abas dividem. A jornada deve ficar **vermelha**: sem faixa, e o parecer some do servidor e do disco.

**Decisão (Matheus, 15/09/2026):** recusar a aba desatualizada, avisar e oferecer recarregar, sem sobrescrever.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/conversas/c3-duas-abas.mjs`:

```js
// C3 — a aba 1 audita; a aba 2 abriu a mesma conversa antes e ficou parada; a
// aba 2 grava depois. Decidido pelo Matheus em 15/09/2026: a aba desatualizada
// é recusada, avisa e oferece recarregar, sem sobrescrever.
//
// Duas abas são duas páginas do MESMO contexto: mesmos cookies, mesmo
// IndexedDB, mesmo `nexo:ultima-conversa` — é assim que a aba 2 abre a mesma
// conversa sozinha. A rota também é exercitada direto, com uma base velha: é o
// caminho de outra máquina, que o IndexedDB desta não protege.
export default {
  id: "c3",
  area: "conversas",
  titulo: "duas abas na mesma conversa: a aba parada não apaga o parecer da outra",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await page.waitForTimeout(2000);
    const id = await ctx.conversaAberta();
    const noServidor = async () => {
      const [linha] = await ctx.banco.consultar(`select data, "updatedAt" from "NexoConversation" where id = $1`, [id]);
      return linha ?? null;
    };
    const pareceresDe = (registro) => (registro?.results ?? []).filter((r) => r.kind === "auditoria");

    const aba2 = await ctx.abrirOutraAba();
    await aba2.waitForTimeout(4000);
    const leituraNaAba2 = await aba2.getByText(/Li as primeiras páginas/).count();
    const pareceresNaAba2 = await aba2.getByRole("button", { name: /Ver o parecer/ }).count();
    ctx.verificar(
      "a aba 2 abriu a mesma conversa, antes do parecer",
      Boolean(id) && (await ctx.conversaAberta(aba2)) === id && leituraNaAba2 > 0 && pareceresNaAba2 === 0,
      `id=${id} leitura=${leituraNaAba2} pareceres=${pareceresNaAba2}`,
    );

    await page.bringToFront();
    await ctx.auditarNoCartao();
    await ctx.esperarParecer(1);
    const subiu = await ctx.esperar(async () => pareceresDe((await noServidor())?.data).length === 1, 30_000);
    const antes = await noServidor();
    ctx.verificar("o servidor recebeu o parecer da aba 1", subiu, `pareceres no servidor=${pareceresDe(antes?.data).length}`);

    await aba2.bringToFront();
    await ctx.escrever("oi, tudo bem?", aba2);
    await aba2.waitForTimeout(6000);

    const faixa = aba2.getByText("Esta conversa mudou em outra aba", { exact: true });
    ctx.verificar("a aba 2 avisa que a conversa mudou em outra aba, visível de verdade", await ctx.visivelRolando(faixa), `contagem=${await faixa.count()}`);

    const depois = await noServidor();
    ctx.verificar("o servidor continua com o parecer da aba 1", pareceresDe(depois?.data).length === 1, `pareceres=${pareceresDe(depois?.data).length}`);
    ctx.verificar(
      "a mensagem da aba parada não chegou ao servidor",
      Boolean(depois) && !JSON.stringify(depois.data?.messages ?? []).includes("oi, tudo bem?"),
    );
    ctx.verificar(
      "a versão do servidor não mudou",
      Boolean(antes && depois) && depois.updatedAt.getTime() === antes.updatedAt.getTime(),
      `${antes?.updatedAt?.toISOString?.()} -> ${depois?.updatedAt?.toISOString?.()}`,
    );
    const noDisco = await ctx.lerConversa(id);
    ctx.verificar(
      "o disco que as abas dividem continua com o parecer",
      pareceresDe(noDisco).length === 1 && !JSON.stringify(noDisco?.messages ?? []).includes("oi, tudo bem?"),
      `pareceres=${pareceresDe(noDisco).length}`,
    );

    // Outra máquina, com a base de quando abriu: a rota recusa por conta própria.
    const deOutraMaquina = {
      ...noDisco,
      updatedAt: Date.now(),
      messages: [...(noDisco?.messages ?? []), { id: "outra-maquina", role: "user", content: "gravação de outra máquina" }],
    };
    const resposta = await page.request.put(`${ctx.base}/api/nexo/conversas`, {
      data: deOutraMaquina,
      headers: { "x-nexo-versao-base": "1" },
    });
    const corpo = await resposta.json().catch(() => ({}));
    ctx.verificar("a rota responde 409 à gravação com base velha", resposta.status() === 409 && corpo.desatualizada === true, `status=${resposta.status()} corpo=${JSON.stringify(corpo)}`);
    ctx.verificar("e o servidor segue com o parecer", pareceresDe((await noServidor())?.data).length === 1);

    await aba2.getByRole("button", { name: "Recarregar a conversa" }).click({ timeout: 10_000 }).catch(() => {});
    const verNaAba2 = aba2.getByRole("button", { name: /Ver o parecer/ });
    await verNaAba2.first().waitFor({ timeout: 30_000 }).catch(() => {});
    ctx.verificar("recarregada, a aba 2 mostra o parecer, visível de verdade", (await verNaAba2.count()) === 1 && (await ctx.visivelRolando(verNaAba2)), `botões=${await verNaAba2.count()}`);
    ctx.verificar("e a faixa sai", (await faixa.count()) === 0, `faixas=${await faixa.count()}`);
  },
};
```

- [ ] **Passo 2: rodar e registrar o vermelho**

Rode: `npm run bateria -- --so-jornadas c3`
Esperado: `FALHOU  c3`. As duas primeiras verificações `ok`; a faixa, o 409 e o "Recarregar" em `FALHOU`; e pelo menos uma de "servidor/disco continuam com o parecer" em `FALHOU`.

Se "a aba 2 abriu a mesma conversa" falhar, a jornada não testa o cenário: confira na captura se a aba 2 caiu na tela de boas-vindas (o "voltar para onde parou" do `NexoWorkspace`). Se o servidor e o disco seguirem com o parecer, a aba 2 não gravou nada (ou não chegou a gravar): anote em "Suspeitas abertas" com a evidência e siga assim mesmo para a Tarefa 15 — a faixa e o 409 são decisão de produto, e não dependem de o defeito aparecer nesta corrida.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/conversas/c3-duas-abas.mjs
git diff --cached --stat
git commit -m "a bateria mostra que a aba parada grava por cima do parecer da outra aba" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 15: a aba desatualizada é recusada, avisa e oferece recarregar

**Arquivos:**
- Alterar: `server/nexo/conversa-remota.ts` (função nova logo depois de `resumoDoRegistro`)
- Alterar: `scripts/test-nexo-conversa-remota.ts` (import; testes antes do `console.log` final)
- Alterar: `app/api/nexo/conversas/route.ts` (import; `PUT`, depois do "servidor tem versão mais nova")
- Alterar: `modules/nexo/lib/nexo-sync.ts` (`gravarNoServidor`)
- Alterar: `modules/nexo/state/conversation-store.tsx` (import; refs e estado; `persistNow`; `selectConversation`; `newConversation`; `duplicarConversa`; tipo e valor do store)
- Alterar: `modules/nexo/components/NexoWorkspace.tsx` (faixa)
- Alterar: `docs/bateria/defeitos-achados.md`

**Interfaces:**
- Consome: o contrato da Tarefa 14.
- Produz:
  - `gravacaoDesatualizada(args: { guardada: number | null; base: number | null }): boolean` em `server/nexo/conversa-remota.ts`
  - `gravarNoServidor(rec: StoredConversation, versaoBase?: number | null): Promise<EstadoDaSincronizacao | { estado: "desatualizada"; em: number }>`
  - no store: `conflitoDeVersao: boolean`

**O desenho:**
- **A base** é o `updatedAt` da versão que a aba leu (`selectConversation`) ou da última que ela mesma mandou gravar. Guardada por conversa, num ref.
- **No disco:** antes de gravar no IndexedDB, a aba lê o registro. Se ele é mais novo que a base, outra aba gravou: nada é gravado, e a conversa fica travada nesta aba até recarregar. Sem esta guarda a aba parada apagaria o parecer no disco dividido antes de o servidor dizer qualquer coisa.
- **No servidor:** a base viaja no cabeçalho `x-nexo-versao-base`. Depois da regra antiga ("gravação mais velha é ignorada", que continua cuidando das gravações da própria aba chegando fora de ordem), guardado mais novo que a base responde 409 `{ desatualizada: true }`.
- **As gravações da aba entram numa fila**: a leitura antes de gravar é assíncrona, e duas gravações seguidas não podem chegar ao disco na ordem trocada.
- **Na tela:** `FaixaDeEstado` do tipo `documento`, com "Recarregar a conversa", que é `selectConv` da própria conversa.

- [ ] **Passo 1: o teste que falha**

Em `scripts/test-nexo-conversa-remota.ts` (sujo para o prettier: edite à mão), troque:

```ts
import {
  LIMITE_BYTES,
  fundirListas,
```

por:

```ts
import {
  LIMITE_BYTES,
  fundirListas,
  gravacaoDesatualizada,
```

E, logo antes da linha `console.log(\`\n${passed} verificações passaram.\`);`, acrescente:

```ts
// ---------------------------------------------------------------------------
// A aba desatualizada (C3, decidido em 15/09/2026)

test("a aba que leu a versão guardada grava", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 2_000, base: 2_000 }), false);
});

test("a versão guardada mudou depois da base: a gravação é recusada", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 3_000, base: 2_000 }), true);
});

test("base MAIS NOVA que a guardada é gravação desta aba ainda a caminho, não conflito", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 2_000, base: 3_000 }), false);
});

test("sem base (conversa nova, ou cliente de antes da regra) nunca recusa", () => {
  assert.equal(gravacaoDesatualizada({ guardada: 3_000, base: null }), false);
});

test("sem nada guardado não há o que proteger", () => {
  assert.equal(gravacaoDesatualizada({ guardada: null, base: 2_000 }), false);
});
```

Rode: `node scripts/test-nexo-conversa-remota.ts`
Esperado: FALHA com `does not provide an export named 'gravacaoDesatualizada'`.

- [ ] **Passo 2: a regra**

Em `server/nexo/conversa-remota.ts` (sujo: à mão), troque:

```ts
    ...(r.tipo ? { tipo: r.tipo } : {}),
    ...(r.auditoriaPendente ? { temAuditoriaPendente: true } : {}),
  };
}
```

por:

```ts
    ...(r.tipo ? { tipo: r.tipo } : {}),
    ...(r.auditoriaPendente ? { temAuditoriaPendente: true } : {}),
  };
}

/**
 * A GRAVAÇÃO VEM DE UMA ABA DESATUALIZADA?
 *
 * Decidido pelo Matheus em 15/09/2026 (cenário C3 da bateria). O `updatedAt` é a
 * hora em que a aba GRAVA, e não a do conteúdo: uma aba parada desde antes da
 * auditoria gravava com hora nova e conteúdo velho, passava pela regra "a mais
 * velha é descartada", e apagava o parecer da outra aba. A base é a versão que a
 * aba LEU (ou a última que ela mesma mandou); guardado mais novo que isso é
 * trabalho de outra aba.
 *
 * Base mais nova que o guardado NÃO é conflito: é gravação desta própria aba
 * ainda a caminho. Sem base, ou sem nada guardado, não há o que proteger.
 */
export function gravacaoDesatualizada(args: {
  guardada: number | null;
  base: number | null;
}): boolean {
  if (args.guardada === null || args.base === null) return false;
  return args.guardada > args.base;
}
```

Rode: `node scripts/test-nexo-conversa-remota.ts`
Esperado: passa, com 5 verificações a mais que antes.

- [ ] **Passo 3: a rota**

Em `app/api/nexo/conversas/route.ts` (sujo: à mão), troque:

```ts
import {
  resumoDoRegistro,
  validarRegistro,
```

por:

```ts
import {
  gravacaoDesatualizada,
  resumoDoRegistro,
  validarRegistro,
```

E troque:

```ts
    if (dono && dono.updatedAt.getTime() > resumo.updatedAt) {
      return NextResponse.json({ ok: true, ignorada: "servidor tem versão mais nova" });
    }
```

por:

```ts
    if (dono && dono.updatedAt.getTime() > resumo.updatedAt) {
      return NextResponse.json({ ok: true, ignorada: "servidor tem versão mais nova" });
    }
    /*
     * A ABA DESATUALIZADA É RECUSADA — decidido em 15/09/2026 (jornada c3). A
     * regra de cima só compara horas de GRAVAÇÃO: uma aba parada desde antes da
     * auditoria grava com hora nova e passa. A base é a versão que a aba leu;
     * se a guardada mudou desde então, 409 — o cliente avisa e oferece
     * recarregar, e nada é sobrescrito. Sem o cabeçalho, vale o de sempre.
     */
    const baseDaAba = Number(req.headers.get("x-nexo-versao-base"));
    if (
      dono &&
      gravacaoDesatualizada({
        guardada: dono.updatedAt.getTime(),
        base: Number.isFinite(baseDaAba) && baseDaAba > 0 ? baseDaAba : null,
      })
    ) {
      return NextResponse.json(
        { error: "esta conversa mudou depois que esta aba a abriu", desatualizada: true },
        { status: 409 },
      );
    }
```

- [ ] **Passo 4: o cliente manda a base e lê o 409**

Em `modules/nexo/lib/nexo-sync.ts` (sujo: à mão), troque:

```ts
export async function gravarNoServidor(
  rec: StoredConversation,
): Promise<EstadoDaSincronizacao> {
  const agora = Date.now();
  try {
    const resp = await fetch(ROTA, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(rec),
    });
```

por:

```ts
/** O servidor recusou porque a conversa mudou depois que esta aba a leu (C3). */
export type GravacaoDesatualizada = { estado: "desatualizada"; em: number };

export async function gravarNoServidor(
  rec: StoredConversation,
  /** O `updatedAt` que esta aba leu ou gravou por último. Ver `gravacaoDesatualizada`. */
  versaoBase: number | null = null,
): Promise<EstadoDaSincronizacao | GravacaoDesatualizada> {
  const agora = Date.now();
  try {
    const resp = await fetch(ROTA, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        ...(versaoBase !== null ? { "x-nexo-versao-base": String(versaoBase) } : {}),
      },
      body: JSON.stringify(rec),
    });
```

E troque:

```ts
    const json = (await resp.json().catch(() => null)) as { error?: string } | null;
    return {
```

por:

```ts
    const json = (await resp.json().catch(() => null)) as
      | { error?: string; desatualizada?: boolean }
      | null;
    // 409 também é "conversa de outro usuário": só o corpo diz qual dos dois.
    if (resp.status === 409 && json?.desatualizada) return { estado: "desatualizada", em: agora };
    return {
```

- [ ] **Passo 5: o store guarda a base, recusa no disco e acende o aviso**

Em `modules/nexo/state/conversation-store.tsx` (sujo: **edite à mão**, sem prettier):

1. Troque `import { fundirListas, lapidesLocais } from "@/server/nexo/conversa-remota";` por:

```ts
import { fundirListas, gravacaoDesatualizada, lapidesLocais } from "@/server/nexo/conversa-remota";
```

2. No tipo `ConversationStoreValue`, troque:

```ts
  sincronizacao: EstadoDaSincronizacao;
```

por:

```ts
  sincronizacao: EstadoDaSincronizacao;
  /**
   * Esta aba tentou gravar uma conversa que OUTRA aba (ou máquina) já mudou
   * depois que ela a abriu. Nada foi gravado; a tela oferece recarregar
   * (decidido em 15/09/2026, jornada c3).
   */
  conflitoDeVersao: boolean;
```

3. Troque:

```ts
  /** Esta conversa já foi ao disco — daqui em diante, mantê-la em dia. */
  const jaPersistiu = useRef(false);
```

por:

```ts
  /** Esta conversa já foi ao disco — daqui em diante, mantê-la em dia. */
  const jaPersistiu = useRef(false);
  /*
   * A VERSÃO QUE ESTA ABA CONHECE — 15/09/2026, jornada c3. É o `updatedAt` que
   * ela leu ao abrir a conversa, ou o da última gravação que ela mesma mandou.
   * Guardado junto do id: uma gravação da conversa anterior, ainda na fila,
   * não pode usar a base da conversa nova.
   */
  const versaoBase = useRef<{ conversa: string; em: number } | null>(null);
  /** A conversa travada por conflito nesta aba, até ser recarregada. */
  const conflitoEm = useRef<string | null>(null);
  const [conflitoDeVersao, setConflitoDeVersao] = useState(false);
  /*
   * As gravações desta aba em FILA: a checagem do disco antes de gravar é
   * assíncrona, e duas gravações seguidas não podem chegar ao disco trocadas.
   */
  const filaDeGravacao = useRef<Promise<void>>(Promise.resolve());
  const marcarConflito = useCallback((conversa: string) => {
    conflitoEm.current = conversa;
    if (snapshotRef.current.conversationId === conversa) setConflitoDeVersao(true);
  }, []);
```

4. Em `persistNow`, troque o bloco inteiro que vai de `    putConversation(rec)` até `  }, [refreshList]);`:

```ts
    putConversation(rec)
      .then(() => {
        setGravacaoLocal("ok");
        refreshList();
      })
      /*
       * A FALHA CONTA. Era `.catch(() => {})`, e o silêncio dela é o que fez o
       * parecer do 084_25 sumir sem ninguém saber por quê: quota estourada,
       * transação abortada ou despejo por pressão de armazenamento produziam
       * exatamente o mesmo nada. Quem grava e não avisa que não gravou está
       * dizendo que gravou.
       */
      .catch(() => setGravacaoLocal("falhou"));

    gravarNoServidor(rec).then((estado) => {
      /*
       * "desligada" não vira alarme: é a resposta de instalação sem banco, e o
       * Nexo funcionou assim a vida inteira. Falha de verdade FICA na tela — o
       * modo de falhar caro deste projeto é o que parece ter dado certo.
       */
      setSincronizacao(estado);

      /*
       * EXPURGADA NO MEIO DA GRAVAÇÃO — a corrida que o 410 fecha.
       *
       * O administrador apagou esta conversa enquanto ela estava aberta aqui. O
       * servidor recusou, e insistir seria ressuscitá-la. A cópia local sai
       * agora, com os blobs, e a lista se redesenha sem ela.
       */
      if (estado.estado === "expurgada") {
        dbDelete(rec.id)
          .catch(() => {})
          .finally(refreshList);
      }
    });
  }, [refreshList]);
```

por:

```ts
    /*
     * A ABA DESATUALIZADA NÃO GRAVA — decidido em 15/09/2026 (jornada c3). A
     * conversa travada por conflito só volta a gravar depois de recarregada.
     */
    if (conflitoEm.current === rec.id) return;
    const base = versaoBase.current?.conversa === rec.id ? versaoBase.current.em : null;
    versaoBase.current = { conversa: rec.id, em: rec.updatedAt };

    filaDeGravacao.current = filaDeGravacao.current.then(async () => {
      /*
       * O DISCO É DIVIDIDO ENTRE AS ABAS. Se ele já tem uma versão mais nova
       * que a base desta aba, outra aba gravou depois que esta abriu a
       * conversa — gravar aqui apagaria o trabalho dela antes de o servidor
       * poder dizer qualquer coisa.
       */
      const noDisco = await getConversation(rec.id).catch(() => null);
      if (gravacaoDesatualizada({ guardada: noDisco?.updatedAt ?? null, base })) {
        marcarConflito(rec.id);
        return;
      }

      await putConversation(rec)
        .then(() => {
          setGravacaoLocal("ok");
          refreshList();
        })
        /*
         * A FALHA CONTA. Era `.catch(() => {})`, e o silêncio dela é o que fez o
         * parecer do 084_25 sumir sem ninguém saber por quê: quota estourada,
         * transação abortada ou despejo por pressão de armazenamento produziam
         * exatamente o mesmo nada. Quem grava e não avisa que não gravou está
         * dizendo que gravou.
         */
        .catch(() => setGravacaoLocal("falhou"));

      gravarNoServidor(rec, base).then((estado) => {
        // Outra máquina gravou depois da base desta aba: mesma trava do disco.
        if (estado.estado === "desatualizada") {
          marcarConflito(rec.id);
          return;
        }
        /*
         * "desligada" não vira alarme: é a resposta de instalação sem banco, e o
         * Nexo funcionou assim a vida inteira. Falha de verdade FICA na tela — o
         * modo de falhar caro deste projeto é o que parece ter dado certo.
         */
        setSincronizacao(estado);

        /*
         * EXPURGADA NO MEIO DA GRAVAÇÃO — a corrida que o 410 fecha.
         *
         * O administrador apagou esta conversa enquanto ela estava aberta aqui. O
         * servidor recusou, e insistir seria ressuscitá-la. A cópia local sai
         * agora, com os blobs, e a lista se redesenha sem ela.
         */
        if (estado.estado === "expurgada") {
          dbDelete(rec.id)
            .catch(() => {})
            .finally(refreshList);
        }
      });
    });
  }, [refreshList, marcarConflito]);
```

5. Em `selectConversation`, troque:

```ts
      // Veio do disco: manter em dia, mesmo que fique "vazia" ao limpar campos.
      jaPersistiu.current = true;
```

por:

```ts
      // Veio do disco: manter em dia, mesmo que fique "vazia" ao limpar campos.
      jaPersistiu.current = true;
      // A versão que esta aba acabou de LER é a base das gravações dela (c3).
      versaoBase.current = { conversa: rec.id, em: rec.updatedAt };
      conflitoEm.current = null;
      setConflitoDeVersao(false);
```

6. Em `newConversation`, troque:

```ts
    // Conversa nova ainda não existe no disco: volta a valer a guarda de vazia.
    jaPersistiu.current = false;
```

por:

```ts
    // Conversa nova ainda não existe no disco: volta a valer a guarda de vazia.
    jaPersistiu.current = false;
    // Nada lido, nada a proteger: a primeira gravação dela não tem base (c3).
    versaoBase.current = null;
    conflitoEm.current = null;
    setConflitoDeVersao(false);
```

7. Em `duplicarConversa`, troque:

```ts
      gravarNoServidor(novo).then(setSincronizacao);
```

por:

```ts
      gravarNoServidor(novo).then((estado) => {
        // Cópia recém-criada não tem base: "desatualizada" não acontece aqui.
        if (estado.estado !== "desatualizada") setSincronizacao(estado);
      });
```

8. No valor e nas dependências do `useMemo` (as DUAS ocorrências; use `replace_all`), troque:

```ts
      sincronizacao,
      gravacaoLocal,
```

por:

```ts
      sincronizacao,
      conflitoDeVersao,
      gravacaoLocal,
```

- [ ] **Passo 6: a faixa**

Em `modules/nexo/components/NexoWorkspace.tsx` (sujo: à mão), troque:

```tsx
      {tourAtivo && <TourDoNexo aoSair={encerrarTour} />}
```

por:

```tsx
      {/*
        A CONVERSA MUDOU EM OUTRA ABA — decidido em 15/09/2026 (jornada c3).
        Bloqueio, não notícia: sem `aoFechar`. Esta aba parou de gravar para não
        apagar o que a outra fez, e recarregar é o único caminho que devolve a
        gravação.
      */}
      {conv.conflitoDeVersao && (
        <FaixaDeEstado
          tipo="documento"
          titulo="Esta conversa mudou em outra aba"
          acao={
            <Button size="sm" variant="outline" onClick={() => void selectConv(conv.conversationId)}>
              Recarregar a conversa
            </Button>
          }
        >
          Outra aba (ou outro computador) gravou esta conversa depois que ela foi aberta aqui.
          Para não apagar o que foi feito lá, nada desta aba foi gravado — recarregue para
          continuar da versão mais nova.
        </FaixaDeEstado>
      )}

      {tourAtivo && <TourDoNexo aoSair={encerrarTour} />}
```

- [ ] **Passo 7: verificar**

Rode: `node scripts/test-nexo-conversa-remota.ts`
Esperado: passa.

Rode: `npx eslint server/nexo/conversa-remota.ts app/api/nexo/conversas/route.ts modules/nexo/lib/nexo-sync.ts modules/nexo/state/conversation-store.tsx modules/nexo/components/NexoWorkspace.tsx scripts/test-nexo-conversa-remota.ts`, a contagem de tipos e `npm run prova:rotas`.
Esperado: sem erro novo de lint; `0`; `OK  nenhuma rota aberta`.

Rode: `npm run bateria -- --so-jornadas c3`
Esperado: `ok      c3`.

Regressão — estas jornadas gravam o disco em momentos apertados (a3 lê o disco 300ms depois da rodada 2; c6 abre conversa com bilhete e limpa dentro da troca; c4 migra ao abrir; c5 troca de conversa com auditoria em voo):
`npm run bateria -- --so-jornadas a3`, `npm run bateria -- --so-jornadas conversas`.
Esperado: todas `ok`. Se a3 perder a rodada 2 no disco, a fila atrasou a gravação imediata além da janela: meça (log com `performance.now()` antes e depois do `getConversation`) antes de mudar qualquer coisa.

- [ ] **Passo 8: commit**

```bash
git add server/nexo/conversa-remota.ts scripts/test-nexo-conversa-remota.ts app/api/nexo/conversas/route.ts modules/nexo/lib/nexo-sync.ts modules/nexo/state/conversation-store.tsx modules/nexo/components/NexoWorkspace.tsx
git diff --cached --stat
git commit -m "a aba desatualizada nao grava por cima da outra: avisa e oferece recarregar a conversa" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

- [ ] **Passo 9: registro, com o hash do Passo 8**

Em `docs/bateria/defeitos-achados.md`, antes de `## Suspeitas abertas` (escreva a coluna "Defeito" com o que a Tarefa 14 mediu de fato: servidor, disco, ou os dois):

```markdown
| 15/09/2026 | c3 | uma aba parada desde antes da auditoria gravava depois e apagava o parecer da outra aba (medido na Tarefa 14: ver a coluna Causa) | o `PUT` só descartava gravação com hora mais velha, e a hora é a da GRAVAÇÃO, não a do conteúdo; e o IndexedDB, dividido entre as abas, era gravado antes. Decidido pelo Matheus: cada aba grava contra a versão que leu; disco e servidor (409) recusam a desatualizada, e a tela oferece recarregar | (hash do Passo 8) | scripts/test-nexo-conversa-remota.ts (gravacaoDesatualizada) + c3 |
```

```bash
git add docs/bateria/defeitos-achados.md
git diff --cached --stat
git commit -m "registro do defeito da c3 na lista da bateria" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 16: jornada V1 — regerar a LD depois do volume montado

**Arquivos:**
- Criar: `scripts/bateria/jornadas/volume/v1-regerar-ld-depois-do-volume.mjs`

**Interfaces:**
- Consome: `nexo-selo` e `nexo-agent-turn` com LD (Tarefa 1); `pranchas` (Tarefa 2); gestos da Tarefa 3; a trava de C3 (Tarefa 15), que impede a aba aberta de gravar por cima da semente.

**O que já existe (09/09/2026):** `volumesDesatualizados` (`modules/nexo/lib/volumes-desatualizados.ts`) compara o `generatedAt` atual de cada peça com o `em` gravado em `payload.partes` do volume; o card `VolumesDesatualizados` mostra "Volume desatualizado", o motivo "<peça> foi gerada de novo depois deste volume" e, com as pranchas na máquina e o card do volume montado, "Remontar e baixar".

**O gesto e o que é semeado (decisão registrada no desenho):** a LD é gerada e regerada pelo plano de geração (`PlanoDeGeracao`: "Gerar os 1", depois "Gerar de novo" ou "Atualizar 1 documento"), gesto real e sem modelo. Montar o volume de verdade exige a capa em PDF, que depende do LibreOffice e do modelo da prefeitura — nem o PC da bateria nem o CI garantem isso. Então a jornada grava no disco o registro do volume montado com a LD que acabou de gerar (as mesmas partes e a mesma hora que `VolumeConfirmation` gravaria) e reabre a conversa. "Remontar resolve" fica travado por `scripts/test-nexo-volumes-desatualizados.ts` ("peça com a mesma hora não denuncia nada"); a jornada prova que o botão está lá.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/volume/v1-regerar-ld-depois-do-volume.mjs`:

```js
// V1 — regerar a LD depois de o volume estar montado. Esperado (catálogo):
// volume marcado como envelhecido; remontar resolve.
//
// 1. anexa duas pranchas (leitura de selo simulada) e pede a LD pelo chat;
// 2. gera a LD no plano;
// 3. grava no disco um volume montado com ESSA LD e reabre (ver a decisão V1 no
//    desenho: a montagem real depende de LibreOffice);
// 4. reanexa as pranchas — os bytes voltam, e nenhuma folha é relida;
// 5. regera a LD pelo mesmo plano, que é o gesto do catálogo;
// 6. confere o aviso, o motivo e o botão de remontar.
export default {
  id: "v1",
  area: "volume",
  titulo: "regerar a LD depois do volume montado marca o volume como desatualizado",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    const duas = f.pranchas.slice(0, 2);
    const leituraDeSelo = (req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/ld/extract-stamp";

    await ctx.anexar(duas);
    await ctx.esperarTexto(/Anexei 2 folhas/, 180_000);
    await ctx.escrever("cria a LD dessas pranchas com o título BATERIA V1");
    await (await ctx.esperarBotao(/^Gerar os 1$/, 120_000)).click();
    await ctx.esperarBotao(/^Gerar de novo$/, 120_000);
    await page.waitForTimeout(1500);

    const id = await ctx.conversaAberta();
    const conversa = await ctx.lerConversa(id);
    const ld = (conversa?.results ?? []).find((r) => r.kind === "ld");
    ctx.verificar(
      "a LD foi gerada e gravada com hora",
      typeof ld?.generatedAt === "number",
      JSON.stringify((conversa?.results ?? []).map((r) => [r.artifactId, r.generatedAt])),
    );
    if (!ld) return;

    // `volumeId(selos)` é `volume:<código>`, e `ldId(selos)` é `ld:<código>:<revisão>` (ConfirmationCard).
    const volumeId = `volume:${ld.artifactId.split(":")[1]}`;
    const agora = Date.now();
    await ctx.indexeddb.gravarConversa({
      ...conversa,
      updatedAt: agora,
      messages: [
        ...conversa.messages,
        { id: `bateria-v1-volume-${agora}`, role: "assistant", content: "Volume montado.", proposals: [{ kind: "volume", resumo: "Volume", params: {} }] },
      ],
      results: [
        ...conversa.results,
        {
          artifactId: volumeId,
          kind: "volume",
          summary: "Volume montado",
          canvas: { label: "Volume", pageNumber: 1 },
          payload: {
            tomo: ld.payload?.tomo ?? 1,
            folhas: ld.payload?.folhas ?? "",
            partes: [{ id: ld.artifactId, em: ld.generatedAt }],
            conferencia: null,
          },
          generatedAt: ld.generatedAt + 1000,
          files: [],
        },
      ],
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    const aviso = page.getByText("Volume desatualizado", { exact: true });
    const volumeNoDisco = ((await ctx.lerConversa(id))?.results ?? []).some((r) => r.artifactId === volumeId);
    // Controle: com a mesma LD de dentro do volume, o aviso não pode existir.
    ctx.verificar("volume com a LD atual: nenhum aviso", volumeNoDisco && (await aviso.count()) === 0, `volume no disco=${volumeNoDisco} avisos=${await aviso.count()}`);

    const leituras = ctx.contarRequisicoes(leituraDeSelo);
    await ctx.anexar(duas);
    await ctx.esperar(async () => (await page.getByText(/Anexei 2 folhas/).count()) >= 2, 60_000);
    await page.waitForTimeout(1500);
    leituras.parar();
    ctx.verificar("reanexar trouxe as pranchas sem reler nenhuma folha", leituras.total() === 0, `leituras de selo=${leituras.total()}`);

    const antes = ld.generatedAt;
    await (await ctx.esperarBotao(/^(Gerar de novo|Atualizar 1 documento)$/, 60_000)).click();
    const regerou = await ctx.esperar(async () => {
      const atual = ((await ctx.lerConversa(id))?.results ?? []).find((r) => r.artifactId === ld.artifactId);
      return (atual?.generatedAt ?? 0) > antes;
    }, 120_000);
    ctx.verificar("a LD foi gerada de novo", regerou);

    await aviso.first().waitFor({ timeout: 30_000 }).catch(() => {});
    ctx.verificar("o volume aparece como desatualizado, visível de verdade", (await aviso.count()) === 1 && (await ctx.visivelRolando(aviso)), `avisos=${await aviso.count()}`);
    const motivo = page.getByText(/foi gerada de novo depois deste volume/);
    ctx.verificar("o motivo nomeia a LD regerada, visível de verdade", await ctx.visivelRolando(motivo), `contagem=${await motivo.count()}`);
    const remontar = page.getByRole("button", { name: /^Remontar e baixar$/ });
    ctx.verificar("remontar é oferecido, visível de verdade", (await remontar.count()) === 1 && (await ctx.visivelRolando(remontar)), `botões=${await remontar.count()}`);
  },
};
```

- [ ] **Passo 2: rodar**

Rode: `npm run bateria -- --so-jornadas v1`
Esperado: `ok      v1`.

Pontos a olhar se ficar vermelho, nesta ordem:
- "Gerar os 1" nunca habilitou: veja na captura o que o plano diz ao lado do botão (título faltando, leitura em curso). O título vem do pedido; se a proposta chegou sem ele, confira `normalizeProposals` contra o formato da Tarefa 1.
- A LD não gera (`Falha ao gerar a LD.`): leia o `servidor.log` da rota `/api/nexo/ld`. Se for LibreOffice, só o PDF depende dele; o ODT não deveria. Não é defeito desta rodada: registre em "Suspeitas abertas" e marque a jornada como bloqueada no relatório final.
- "volume com a LD atual: nenhum aviso" falhou com o volume no disco: o `em` gravado não bate com o `generatedAt` restaurado. Compare os dois números antes de mexer.
- "remontar é oferecido" falhou com o aviso visível: falta o montador (o card do volume não montou) ou as pranchas (`temPranchas`). A captura mostra qual das duas frases o card escreveu.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/volume/v1-regerar-ld-depois-do-volume.mjs
git diff --cached --stat
git commit -m "a bateria prova que regerar a ld depois do volume marca o volume como desatualizado" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 17: jornada V2 — prancha sem selo legível

**Arquivos:**
- Criar: `scripts/bateria/jornadas/volume/v2-prancha-sem-selo.mjs`

**Interfaces:**
- Consome: `nexo-selo` simulado, que devolve leitura vazia para carimbo sem texto (Tarefa 1); `pranchas[0]` e `pranchaSemSelo` (Tarefa 2).

**Defeito provável (lido em 15/09/2026, NÃO confirmado por execução):** "não lida" hoje é `extraction: null` sem `ignorada` (`estadoDoAnexo`, `modules/nexo/lib/estado-do-anexo.ts:73`; e `naoLidas.falhas` em `lerPranchas`). Uma leitura que VOLTOU com todos os campos nulos é um objeto, e passa por lida: o chip mostra um "lido" em branco, e a conversa não diz nada da folha. Os textos esperados existem para a leitura que falhou: chip "selo ilegível" (`NexoChat.tsx`, `AttachmentChip`) e "1 folha não deu para ler (<arquivo> p.1) — estão no canvas em branco…" (`appendSelosIntake`). A jornada deve ficar **vermelha** nessas duas e em "ficou como não lida".

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/volume/v2-prancha-sem-selo.mjs`:

```js
// V2 — um lote com uma prancha legível e uma cujo carimbo não tem texto. A
// leitura da segunda VOLTA, e volta vazia (decisão V2 no desenho). Esperado
// (catálogo): a prancha aparece como não lida, e não some do volume.
//
// "Não some": a folha continua nos selos da conversa e no recibo "Anexei 2
// folhas" — é dela que a LD e o volume saem (`r.extraction ?? seloNaoLido()`).
import path from "node:path";

export default {
  id: "v2",
  area: "volume",
  titulo: "prancha sem selo legível aparece como não lida e não some",
  async rodar(ctx) {
    await ctx.login();
    const f = await ctx.fixtures();
    const legivel = path.basename(f.pranchas[0]);
    const semSelo = path.basename(f.pranchaSemSelo);

    const leituras = ctx.contarRequisicoes((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/ld/extract-stamp");
    await ctx.anexar([f.pranchas[0], f.pranchaSemSelo]);
    await ctx.esperarTexto(/Anexei 2 folhas/, 180_000);
    await ctx.page.waitForTimeout(2000);
    leituras.parar();
    // Sem isto, "não lida" poderia ser "pulada como capa", que é outro caso.
    ctx.verificar("as duas folhas foram ao leitor de selo, inclusive a sem carimbo", leituras.total() === 2, `leituras=${leituras.total()}`);

    const conversa = await ctx.lerConversa(await ctx.conversaAberta());
    const folhas = conversa?.seloResults ?? [];
    const daLegivel = folhas.find((r) => r.fileName === legivel);
    const daSemSelo = folhas.find((r) => r.fileName === semSelo);
    ctx.verificar("as duas folhas continuam na conversa", folhas.length === 2 && Boolean(daLegivel) && Boolean(daSemSelo), JSON.stringify(folhas.map((r) => r.fileName)));
    ctx.verificar("a prancha legível foi lida", Boolean(daLegivel?.extraction?.arquivo), JSON.stringify(daLegivel?.extraction));
    ctx.verificar(
      "a prancha sem selo ficou como não lida (nem lida, nem pulada)",
      Boolean(daSemSelo) && !daSemSelo.extraction && !daSemSelo.ignorada,
      JSON.stringify({ extraction: daSemSelo?.extraction, ignorada: daSemSelo?.ignorada, error: daSemSelo?.error }),
    );

    const chip = ctx.page.getByText("selo ilegível", { exact: true });
    ctx.verificar("o chip da prancha sem selo diz 'selo ilegível', visível de verdade", (await chip.count()) === 1 && (await ctx.visivelRolando(chip)), `contagem=${await chip.count()}`);
    const ressalva = ctx.page.getByText(/1 folha não deu para ler/);
    const textoDaRessalva = (await ressalva.count()) > 0 ? await ressalva.first().innerText() : "";
    ctx.verificar(
      "a conversa diz qual folha não deu para ler, visível de verdade",
      textoDaRessalva.includes(semSelo) && (await ctx.visivelRolando(ressalva)),
      JSON.stringify(textoDaRessalva.slice(0, 160)),
    );
  },
};
```

- [ ] **Passo 2: rodar e registrar o resultado**

Rode: `npm run bateria -- --so-jornadas v2`
Esperado: `FALHOU  v2`, com "a prancha sem selo ficou como não lida", "o chip… 'selo ilegível'" e "a conversa diz qual folha…" em `FALHOU`, e as três primeiras `ok`.

Se "as duas folhas foram ao leitor de selo" der `1`, a prancha sem texto foi pulada (classificada `capa` ou `indice`): a fixture está errada, não o produto — volte ao teste da Tarefa 2. Se tudo ficar verde, a hipótese caiu: aplique "Defeito que não se reproduz" e pule a Tarefa 18.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/volume/v2-prancha-sem-selo.mjs
git diff --cached --stat
git commit -m "a bateria mostra que a prancha com carimbo vazio passa por lida" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 18: leitura de selo sem campo legível vira folha não lida

**Arquivos:**
- Alterar: `modules/nexo/lib/estado-do-anexo.ts` (função nova depois de `PISO_PARA_DESCONFIAR`)
- Criar: `scripts/test-leitura-do-selo-vazia.ts`
- Alterar: `modules/nexo/lib/selo-render.ts` (import; `extractSeloFromImage`; `extractSeloFromPage`)
- Alterar: `docs/bateria/defeitos-achados.md`

**Interfaces:**
- Produz: `leituraDoSeloVazia(extraction: { disciplina?: string | null; numeroFolha?: string | null; folha?: number | null; arquivo?: string | null; conteudo?: string | null; tituloSecao?: string | null } | null): boolean`.

**O conserto mínimo, na origem:** `extractSeloFromPage` e `extractSeloFromImage` passam a devolver a leitura vazia como a falha que ela é para quem usa o selo: `extraction: null` e `error: "O carimbo voltou sem nenhum campo legível."`. Assim o chip, a ressalva da conversa, a retomada e a LD (`r.extraction ?? seloNaoLido()`) tratam as duas do mesmo jeito, sem uma segunda regra em cada consumidor. O título que a geometria acha (`conteudoDoSelo`) entra antes da checagem: se o carimbo tem CONTEÚDO desenhado em texto, a folha não é vazia.

- [ ] **Passo 1: o teste que falha**

`scripts/test-leitura-do-selo-vazia.ts`:

```ts
/**
 * Teste da LEITURA DE SELO QUE VOLTA VAZIA.
 *
 * Em 15/09/2026 a jornada v2 soltou uma prancha cujo carimbo não tem texto. O
 * modelo respondeu — JSON válido, todos os campos nulos — e a folha passou por
 * LIDA: o chip mostrava um "lido" em branco e a conversa não dizia nada. Para
 * quem usa o selo, uma leitura sem nenhum campo é uma folha não lida.
 *
 *   node scripts/test-leitura-do-selo-vazia.ts
 */
import assert from "node:assert/strict";

import { estadoDoAnexo, leituraDoSeloVazia } from "../modules/nexo/lib/estado-do-anexo.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.stack : err);
    process.exitCode = 1;
  }
}

const vazia = {
  disciplina: null, folha: null, numeroFolha: null, arquivo: null, conteudo: null, tituloSecao: null,
};

test("todos os campos nulos é leitura vazia", () => {
  assert.equal(leituraDoSeloVazia(vazia), true);
});

test("texto em branco também não conta como lido", () => {
  assert.equal(leituraDoSeloVazia({ ...vazia, arquivo: "  ", conteudo: "" }), true);
});

test("qualquer campo que identifica a folha basta", () => {
  assert.equal(leituraDoSeloVazia({ ...vazia, arquivo: "990_26_est_001_a" }), false);
  assert.equal(leituraDoSeloVazia({ ...vazia, conteudo: "PLANTA DE FORMAS" }), false);
  assert.equal(leituraDoSeloVazia({ ...vazia, numeroFolha: "01/03" }), false);
  assert.equal(leituraDoSeloVazia({ ...vazia, folha: 1 }), false);
  assert.equal(leituraDoSeloVazia({ ...vazia, disciplina: "EST" }), false);
});

test("leitura que falhou (null) não é 'vazia': já é tratada como não lida", () => {
  assert.equal(leituraDoSeloVazia(null), false);
});

test("a folha que vira extraction null aparece como selo ilegível no chip", () => {
  const estado = estadoDoAnexo("990_26_est_004_a.pdf", [{ fileName: "990_26_est_004_a.pdf", extraction: null }], false, (d) => d ?? "");
  assert.deepEqual(estado, { tipo: "ilegivel" });
});

console.log(`\n${passed} teste(s) passaram`);
```

Rode: `node scripts/test-leitura-do-selo-vazia.ts`
Esperado: FALHA com `does not provide an export named 'leituraDoSeloVazia'`.

- [ ] **Passo 2: a regra**

Em `modules/nexo/lib/estado-do-anexo.ts` (sujo: à mão), troque:

```ts
export const PISO_PARA_DESCONFIAR = 4;
```

por:

```ts
export const PISO_PARA_DESCONFIAR = 4;

/**
 * A LEITURA QUE VOLTOU SEM NADA.
 *
 * "Não lida" era só `extraction: null` — a chamada que falhou. Em 15/09/2026 a
 * jornada v2 mostrou o outro jeito: o modelo RESPONDE, com todos os campos
 * nulos, porque o carimbo não tem texto legível. Esse objeto passava por lido, o
 * chip ficava em branco e a conversa não dizia nada da folha.
 *
 * Basta um campo que identifique a folha (disciplina, número, arquivo, título)
 * para a leitura valer. `null` não entra aqui: já é tratado como não lido.
 */
export function leituraDoSeloVazia(
  extraction: {
    disciplina?: string | null;
    numeroFolha?: string | null;
    folha?: number | null;
    arquivo?: string | null;
    conteudo?: string | null;
    tituloSecao?: string | null;
  } | null,
): boolean {
  if (!extraction) return false;
  const temTexto = (v: string | null | undefined) => (v ?? "").trim() !== "";
  return (
    !temTexto(extraction.disciplina) &&
    !temTexto(extraction.numeroFolha) &&
    extraction.folha == null &&
    !temTexto(extraction.arquivo) &&
    !temTexto(extraction.conteudo) &&
    !temTexto(extraction.tituloSecao)
  );
}
```

Rode: `node scripts/test-leitura-do-selo-vazia.ts`
Esperado: `5 teste(s) passaram`.

- [ ] **Passo 3: na origem da leitura**

Em `modules/nexo/lib/selo-render.ts` (sujo: à mão), troque:

```ts
import { normalizarItens } from "@/lib/coordenada-do-pdf";
```

por:

```ts
import { normalizarItens } from "@/lib/coordenada-do-pdf";
import { leituraDoSeloVazia } from "./estado-do-anexo";
```

Troque (em `extractSeloFromImage`):

```ts
    return { fileName: file.name, pageNumber: 1, pageCount: 1, extraction, usage };
```

por:

```ts
    // Leitura sem nenhum campo é folha não lida — ver `leituraDoSeloVazia` (v2, 15/09/2026).
    if (leituraDoSeloVazia(extraction)) {
      return {
        fileName: file.name,
        pageNumber: 1,
        pageCount: 1,
        extraction: null,
        usage,
        error: "O carimbo voltou sem nenhum campo legível.",
      };
    }
    return { fileName: file.name, pageNumber: 1, pageCount: 1, extraction, usage };
```

E troque (em `extractSeloFromPage`):

```ts
    return { fileName: file.name, pageNumber, pageCount, extraction: completada, usage };
```

por:

```ts
    /*
     * A LEITURA QUE VOLTOU SEM NADA É FOLHA NÃO LIDA — 15/09/2026, jornada v2.
     * Checada DEPOIS do título da geometria: carimbo com CONTEÚDO em texto não é
     * vazio, mesmo que o modelo não o tenha lido. Como falha, a folha continua
     * no conjunto (a LD usa `seloNaoLido()`), e o chip e a conversa dizem que ela
     * não foi lida.
     */
    if (leituraDoSeloVazia(completada)) {
      return {
        fileName: file.name,
        pageNumber,
        pageCount,
        extraction: null,
        usage,
        error: "O carimbo voltou sem nenhum campo legível.",
      };
    }
    return { fileName: file.name, pageNumber, pageCount, extraction: completada, usage };
```

- [ ] **Passo 4: verificar**

Rode: `npx eslint modules/nexo/lib/estado-do-anexo.ts modules/nexo/lib/selo-render.ts scripts/test-leitura-do-selo-vazia.ts`, a contagem de tipos e `node scripts/test-nexo-correcao.ts` (os testes antigos de `estadoDoAnexo`).
Esperado: sem erro novo de lint; `0`; `test-nexo-correcao` passa.

Rode: `npm run bateria -- --so-jornadas volume` e `npm run bateria -- --so-jornadas c2`.
Esperado: `ok      v1`, `ok      v2`, `ok      c2`.

- [ ] **Passo 5: commit**

```bash
git add modules/nexo/lib/estado-do-anexo.ts modules/nexo/lib/selo-render.ts scripts/test-leitura-do-selo-vazia.ts
git diff --cached --stat
git commit -m "prancha cujo carimbo volta sem nenhum campo aparece como selo ilegivel e segue no volume" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

- [ ] **Passo 6: registro, com o hash do Passo 5**

Em `docs/bateria/defeitos-achados.md`, antes de `## Suspeitas abertas`:

```markdown
| 15/09/2026 | v2 | prancha com carimbo sem texto: o leitor respondia com todos os campos nulos e a folha passava por lida — chip em branco, nenhuma ressalva na conversa | "não lida" era só `extraction: null` (a chamada que falhou); a resposta vazia é um objeto. Agora `extractSeloFromPage`/`extractSeloFromImage` devolvem a leitura vazia como não lida, com o motivo | (hash do Passo 5) | scripts/test-leitura-do-selo-vazia.ts + v2 |
```

```bash
git add docs/bateria/defeitos-achados.md
git diff --cached --stat
git commit -m "registro do defeito da v2 na lista da bateria" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---
### Tarefa 19: jornada X1 — a sessão expira no meio

**Arquivos:**
- Criar: `scripts/bateria/jornadas/acesso/x1-sessao-expira.mjs`

**Interfaces:**
- Consome: gestos da Tarefa 3; a reconexão provada por A4 (Tarefa 4).

**O que o código faz (lido em 15/09/2026):**
- A sessão é só o cookie JWT do Auth.js (`authjs.session-token` em http); apagar os cookies do contexto é invalidá-la. As rotas da auditoria respondem 401 `{"error":"Entre para continuar."}` (`lib/actor.ts`, via `requireActor`).
- A auditoria já rodando no POST não relê a sessão: o servidor termina e grava. O "meio" que a tela vê é a reconexão depois de um F5.
- **Defeito provável:** `consultarAuditoria` (`modules/nexo/lib/audit.ts`) trata qualquer resposta não-ok que não seja 404 como "banco fora do ar" e devolve `rodando`; o 401 faz o palco perguntar de 5 em 5s para sempre. `conferirSessao` (`modules/nexo/lib/sessao.ts`), que acende a faixa "Sessão expirada" (`NexoWorkspace.tsx`, `FaixaDeEstado tipo="sessao"`), só é chamado em `generate.ts` e `selo-check.ts`. Na largada é igual: um 401 no `POST /api/audit` com fluxo cai em `lerFluxo`, que devolve `null`, e vira `AuditoriaDesconectada` — o bilhete fica e a reconexão pergunta para sempre. A jornada deve ficar **vermelha** na faixa e em "para de perguntar".

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/acesso/x1-sessao-expira.mjs`:

```js
// X1 — a sessão expira no meio da auditoria. Esperado (catálogo): aviso de
// sessão expirada; nada é perdido ao entrar de novo.
//
// A auditoria que já está no POST não relê a sessão: o servidor termina e grava
// sozinho. O que a tela vê no meio é a RECONEXÃO — depois de um F5, o palco
// pergunta por GET /api/audits/<id> a cada 5s, e é essa pergunta que leva o 401.
// Então: auditar com leitura global de 30s, F5 com sessão, apagar os cookies e
// olhar o que a tela faz; depois entrar de novo pelo caminho que ela oferecer.
export default {
  id: "x1",
  area: "acesso",
  titulo: "sessão expira no meio: a tela avisa, para de perguntar e nada se perde",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    await ctx.ia.fila("audit-global", "lento:30000");

    await ctx.abrirCartaoDeAuditoria(f.memorialCurto);
    await ctx.auditarNoCartao();
    await page.waitForTimeout(5000);
    const id = await ctx.conversaAberta();
    const antes = await ctx.lerConversa(id);
    const bilhete = antes?.auditoriaPendente ?? null;
    ctx.verificar("o bilhete está no disco antes do F5", Boolean(bilhete?.auditId), JSON.stringify(bilhete));
    if (!bilhete?.auditId) return;

    await page.reload({ waitUntil: "domcontentloaded" });
    const retomada = page.getByText("Esta análise já estava rodando no servidor. O resultado aparece aqui quando ela terminar.");
    await retomada.first().waitFor({ timeout: 60_000 }).catch(() => {});
    ctx.verificar("com sessão, o palco reconectou à análise", (await retomada.count()) > 0, `contagem=${await retomada.count()}`);

    // A sessão é só o cookie JWT: sem ele, toda rota da auditoria responde 401.
    await page.context().clearCookies();

    const faixa = page.getByText("Sessão expirada", { exact: true });
    await faixa.first().waitFor({ timeout: 20_000 }).catch(() => {});
    ctx.verificar("a faixa de sessão expirada aparece, visível de verdade", await ctx.visivelRolando(faixa), `contagem=${await faixa.count()}`);

    const perguntas = ctx.contarRequisicoes((req) => new URL(req.url()).pathname === `/api/audits/${bilhete.auditId}`);
    await page.waitForTimeout(12_000);
    perguntas.parar();
    ctx.verificar("sem sessão, a tela para de perguntar pela auditoria", perguntas.total() === 0, `perguntas em 12s=${perguntas.total()}`);

    const durante = await ctx.lerConversa(id);
    ctx.verificar(
      "nada se perdeu: o bilhete e as mensagens seguem no disco",
      durante?.auditoriaPendente?.auditId === bilhete.auditId && (durante?.messages?.length ?? 0) === (antes?.messages?.length ?? -1),
      `bilhete=${durante?.auditoriaPendente?.auditId} mensagens ${antes?.messages?.length} -> ${durante?.messages?.length}`,
    );

    // Entrar de novo pelo caminho da faixa; sem ela (produto de antes do conserto), pela porta.
    const entrar = page.getByRole("link", { name: "Entrar e continuar de onde parei" });
    if ((await entrar.count()) > 0) await entrar.first().click();
    else await page.goto(`${ctx.base}/login?callbackUrl=%2Fnexo`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /Entrar como dev/i }).click({ timeout: 30_000 });
    await page.waitForURL("**/nexo**", { timeout: 60_000 });

    const ver = await ctx.esperarParecer(1, 180_000);
    ctx.verificar("depois de entrar de novo, o parecer aparece, visível de verdade", (await ver.count()) === 1 && (await ctx.visivelRolando(ver)), `botões=${await ver.count()}`);
    await page.waitForTimeout(1500);
    const depois = await ctx.lerConversa(id);
    const pareceres = (depois?.results ?? []).filter((r) => r.kind === "auditoria");
    ctx.verificar(
      "o parecer entrou no cartão do bilhete, e o bilhete saiu",
      pareceres.length === 1 && pareceres[0].artifactId === bilhete.artifactId && !depois?.auditoriaPendente,
      JSON.stringify({ pareceres: pareceres.map((r) => r.artifactId), pendente: depois?.auditoriaPendente }),
    );
    const { linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar("a auditoria concluiu no servidor", linhas.length === 1 && linhas[0].status === "COMPLETED", JSON.stringify(linhas));
  },
};
```

- [ ] **Passo 2: rodar e registrar o vermelho**

Rode: `npm run bateria -- --so-jornadas x1`
Esperado: `FALHOU  x1`, com "a faixa de sessão expirada aparece" e "sem sessão, a tela para de perguntar" (`perguntas em 12s=2` ou `3`) em `FALHOU`; as demais `ok`.

Se "com sessão, o palco reconectou" falhar, o F5 chegou tarde demais (a análise acabou): confira no `servidor.log` e aumente o `lento`. Se a faixa aparecer e as perguntas pararem, a hipótese caiu: "Defeito que não se reproduz", e pule a Tarefa 20.

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/acesso/x1-sessao-expira.mjs
git diff --cached --stat
git commit -m "a bateria mostra que a sessao expirada durante a auditoria vira espera sem fim e sem aviso" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 20: 401 da auditoria é sessão expirada, na largada e na reconexão

**Arquivos:**
- Alterar: `scripts/test-nexo-audit-desconexao.ts` (import; testes antes do `console.log` final)
- Alterar: `modules/nexo/lib/audit.ts` (import; classe nova; `runMemorialAudit`; `EstadoDaAuditoria`; `consultarAuditoria`)
- Alterar: `modules/nexo/components/use-reconectar-auditoria.ts`
- Alterar: `modules/nexo/components/use-abrir-auditoria-por-link.ts`
- Alterar: `docs/bateria/defeitos-achados.md`

**Interfaces:**
- Produz:
  - `class SessaoExpiradaNaAuditoria extends Error`, lançada por `runMemorialAudit` num 401
  - `EstadoDaAuditoria` ganha `{ situacao: "sem-sessao" }`, devolvido por `consultarAuditoria` num 401
  - as duas chamam `conferirSessao(res)`, que acende a faixa existente

**O conserto mínimo:** ligar o sino que já existe às duas chamadas da auditoria, e dar ao 401 um desfecho próprio. Na reconexão, `sem-sessao` para de perguntar e **guarda o bilhete**: ao entrar de novo, a página recarrega e a reconexão recomeça do bilhete, que é o "nada é perdido". Na largada, nada começou no servidor, então o cartão mostra o motivo e o bilhete sai como numa falha comum.

- [ ] **Passo 1: os testes que falham**

Em `scripts/test-nexo-audit-desconexao.ts`, troque:

```ts
import {
  AuditoriaDesconectada,
  runMemorialAudit,
} from "../modules/nexo/lib/audit.ts";
```

por:

```ts
import {
  AuditoriaDesconectada,
  SessaoExpiradaNaAuditoria,
  consultarAuditoria,
  runMemorialAudit,
} from "../modules/nexo/lib/audit.ts";
```

E, logo antes de `console.log(\`\n${passed} testes ok\`);`, acrescente:

```ts
/*
 * 401 NÃO É DESCONEXÃO NEM BANCO FORA DO AR — 15/09/2026, jornada x1. Com a
 * sessão caída, a largada virava `AuditoriaDesconectada` (bilhete guardado,
 * reconexão eterna) e a reconexão virava "rodando" para sempre, sem a faixa de
 * sessão expirada que o produto já tinha.
 */
await test("401 na largada é sessão expirada, e não desconexão", async () => {
  comFetch(async () =>
    new Response(JSON.stringify({ error: "Entre para continuar." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  );
  await assert.rejects(
    runMemorialAudit(memorial, {}, "deep", null, opcoes),
    (e: Error) => e instanceof SessaoExpiradaNaAuditoria && !(e instanceof AuditoriaDesconectada),
  );
});

await test("reconexão com 401 devolve sem-sessao, e não rodando", async () => {
  comFetch(async () => new Response(JSON.stringify({ error: "Entre para continuar." }), { status: 401 }));
  assert.deepEqual(await consultarAuditoria("abc12345"), { situacao: "sem-sessao" });
});

await test("reconexão com 503 continua rodando: banco fora do ar é passageiro", async () => {
  comFetch(async () => new Response(JSON.stringify({ error: "Banco não respondeu." }), { status: 503 }));
  assert.deepEqual(await consultarAuditoria("abc12345"), { situacao: "rodando" });
});
```

Rode: `node scripts/test-nexo-audit-desconexao.ts`
Esperado: FALHA com `does not provide an export named 'SessaoExpiradaNaAuditoria'`.

- [ ] **Passo 2: `audit.ts`**

Em `modules/nexo/lib/audit.ts` (sujo: à mão), troque:

```ts
import { centroDeCustoDaAuditoria } from "../../../lib/audit-identity.ts";
```

por:

```ts
import { centroDeCustoDaAuditoria } from "../../../lib/audit-identity.ts";
// Caminho relativo com `.ts` pelo mesmo motivo do import acima: os testes em node cru.
import { conferirSessao } from "./sessao.ts";
```

Troque:

```ts
    this.name = "AuditoriaDesconectada";
  }
}
```

por:

```ts
    this.name = "AuditoriaDesconectada";
  }
}

/**
 * A SESSÃO CAIU ANTES DE A AUDITORIA COMEÇAR.
 *
 * Um 401 no POST caía em `lerFluxo`, que não achava evento nenhum e devolvia
 * `null` — e virava `AuditoriaDesconectada`: bilhete guardado e reconexão
 * perguntando para sempre por uma análise que o servidor recusou (jornada x1,
 * 15/09/2026). Nada começou; o que falta é entrar de novo.
 */
export class SessaoExpiradaNaAuditoria extends Error {
  constructor() {
    super(
      "Sua sessão expirou antes de a auditoria começar. Entre de novo — a conversa e o memorial continuam neste navegador.",
    );
    this.name = "SessaoExpiradaNaAuditoria";
  }
}
```

Troque:

```ts
  /*
   * DOCUMENTO IDÊNTICO — recusa, e ela vem ANTES da leitura do fluxo.
```

por:

```ts
  /*
   * SEM SESSÃO — antes de tudo, e antes do fluxo, pelo mesmo motivo do 409
   * abaixo: o corpo do 401 não é fluxo. `conferirSessao` acende a faixa que o
   * produto já tinha para isso (jornada x1, 15/09/2026).
   */
  conferirSessao(res);
  if (res.status === 401) throw new SessaoExpiradaNaAuditoria();

  /*
   * DOCUMENTO IDÊNTICO — recusa, e ela vem ANTES da leitura do fluxo.
```

Troque:

```ts
export type EstadoDaAuditoria =
  | { situacao: "rodando" }
```

por:

```ts
export type EstadoDaAuditoria =
  | { situacao: "rodando" }
  /** O servidor respondeu 401: não há como saber até entrar de novo. */
  | { situacao: "sem-sessao" }
```

E troque:

```ts
  const res = await fetch(`/api/audits/${encodeURIComponent(auditId)}`);
  if (res.status === 404) {
```

por:

```ts
  const res = await fetch(`/api/audits/${encodeURIComponent(auditId)}`);
  /*
   * 401 NÃO É "BANCO FORA DO AR" — 15/09/2026, jornada x1. Caía no "vale
   * continuar tentando" lá embaixo, e a tela perguntava de 5 em 5s para sempre,
   * sem nunca dizer que a sessão tinha caído.
   */
  conferirSessao(res);
  if (res.status === 401) return { situacao: "sem-sessao" };
  if (res.status === 404) {
```

Rode: `node scripts/test-nexo-audit-desconexao.ts` e `node scripts/test-nexo-audit-contrato.ts`.
Esperado: os dois passam; o primeiro com 3 testes a mais.

- [ ] **Passo 3: a reconexão para e guarda o bilhete**

Em `modules/nexo/components/use-reconectar-auditoria.ts` (limpo para o prettier), troque:

```ts
      if (estado.situacao === "rodando") {
        timer = setTimeout(perguntar, INTERVALO_MS);
        return;
      }
```

por:

```ts
      if (estado.situacao === "rodando") {
        timer = setTimeout(perguntar, INTERVALO_MS);
        return;
      }

      /*
       * SEM SESSÃO: PARA DE PERGUNTAR E GUARDA O BILHETE — 15/09/2026, jornada
       * x1. A faixa de sessão expirada já acendeu (`conferirSessao`). Entrar de
       * novo recarrega a página, e a reconexão recomeça daqui, do bilhete: é o
       * "nada é perdido". Limpar o bilhete agora jogaria fora o único ponteiro
       * para uma análise que o servidor segue terminando.
       */
      if (estado.situacao === "sem-sessao") return;
```

Depois: `npx prettier --check modules/nexo/components/use-reconectar-auditoria.ts scripts/test-nexo-audit-desconexao.ts`
Esperado: os dois limpos (se não, `npx prettier --write` só nesses dois, que estavam limpos no HEAD).

- [ ] **Passo 4: o outro leitor de `consultarAuditoria`**

`use-abrir-auditoria-por-link.ts` lê `resposta.motivo` para tudo que não é `pronta`, e `sem-sessao` não tem motivo (o `tsc` acusa). Em `modules/nexo/components/use-abrir-auditoria-por-link.ts` (à mão), troque:

```ts
        if (resposta.situacao !== "pronta") {
```

por:

```ts
        if (resposta.situacao === "sem-sessao") {
          // A faixa de sessão expirada já acendeu; aqui só não abrimos o parecer.
          setDesfecho({ id, falha: "Sua sessão expirou. Entre de novo para abrir este parecer." });
          return;
        }

        if (resposta.situacao !== "pronta") {
```

- [ ] **Passo 5: verificar**

Rode: `npx eslint modules/nexo/lib/audit.ts modules/nexo/components/use-reconectar-auditoria.ts modules/nexo/components/use-abrir-auditoria-por-link.ts scripts/test-nexo-audit-desconexao.ts` e a contagem de tipos.
Esperado: sem erro novo de lint; `0`.

Rode: `npm run bateria -- --so-jornadas x1` e `npm run bateria -- --so-jornadas a4`.
Esperado: `ok      x1`, `ok      a4`.

- [ ] **Passo 6: commit**

```bash
git add modules/nexo/lib/audit.ts modules/nexo/components/use-reconectar-auditoria.ts modules/nexo/components/use-abrir-auditoria-por-link.ts scripts/test-nexo-audit-desconexao.ts
git diff --cached --stat
git commit -m "sessao expirada durante a auditoria acende o aviso, para de perguntar e guarda o bilhete" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

- [ ] **Passo 7: registro, com o hash do Passo 6**

Em `docs/bateria/defeitos-achados.md`, antes de `## Suspeitas abertas`:

```markdown
| 15/09/2026 | x1 | sessão caída durante a auditoria: depois do F5 o palco perguntava pela análise de 5 em 5s para sempre, sem a faixa "Sessão expirada"; na largada, o 401 virava "conexão caiu" com bilhete eterno | `consultarAuditoria` tratava 401 como banco fora do ar, e nem ele nem `runMemorialAudit` chamavam `conferirSessao`; agora os dois chamam, a largada lança `SessaoExpiradaNaAuditoria` e a reconexão para em `sem-sessao` guardando o bilhete | (hash do Passo 6) | scripts/test-nexo-audit-desconexao.ts + x1 |
```

```bash
git add docs/bateria/defeitos-achados.md
git diff --cached --stat
git commit -m "registro do defeito da x1 na lista da bateria" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 21: jornada X2 — memorial sem código legível

**Arquivos:**
- Criar: `scripts/bateria/jornadas/acesso/x2-memorial-sem-codigo.mjs`

**Interfaces:**
- Consome: `memorialSemCodigo` (Tarefa 2); gestos da Tarefa 3; os três projetos que `scripts/seed-desenvolvimento.ts` semeia em toda rodada (`063-26`, `099-25` e `040-26`, os dois primeiros de "CRICIÚMA").
- Produz, para a Tarefa 22, o contrato:
  - o seletor é um `<select>` cujo rótulo (`<label htmlFor>`) é a frase de `fraseDoImpasse` para `sem-codigo`: `Não achei o centro de custo no documento. Escolha o projeto desta auditoria.`;
  - cada opção se lê `<código> · <cliente>` (ex.: `099-25 · CRICIÚMA`);
  - o botão é `Auditar neste projeto`, desabilitado sem escolha.

**Hoje:** `confirm()` resolve o projeto e, sem código, faz `setError(fraseDoImpasse(destino))` e volta (`ConfirmationCard.tsx`, "O ENDEREÇO ANTES DO TRABALHO"). Não gasta, mas a frase manda escolher e não há onde. A jornada deve ficar **vermelha** no seletor e em tudo depois dele.

**Decisão (Matheus, 15/09/2026):** criar o seletor de projeto.

- [ ] **Passo 1: a jornada**

`scripts/bateria/jornadas/acesso/x2-memorial-sem-codigo.mjs`:

```js
// X2 — memorial sem centro de custo legível. Decidido pelo Matheus em
// 15/09/2026: o cartão mostra um seletor com os projetos do escritório;
// escolher libera a auditoria; sem escolha, não gasta.
//
// "Não gasta" é medido duas vezes: nenhuma chamada a POST /api/audit e nenhuma
// linha nova em "Audit" (as jornadas rodam uma de cada vez, então contar a
// tabela antes e depois é contar só esta).
const FRASE = "Não achei o centro de custo no documento. Escolha o projeto desta auditoria.";

export default {
  id: "x2",
  area: "acesso",
  titulo: "memorial sem código: o cartão pede o projeto antes de gastar",
  async rodar(ctx) {
    const { page } = ctx;
    await ctx.login();
    const f = await ctx.fixtures();
    const contarAuditorias = async () => (await ctx.banco.consultar(`select count(*)::int as n from "Audit"`))[0].n;

    await ctx.abrirCartaoDeAuditoria(f.memorialSemCodigo);
    const auditoriasAntes = await contarAuditorias();
    const pedidos = ctx.contarRequisicoes((req) => req.method() === "POST" && new URL(req.url()).pathname === "/api/audit");
    await ctx.auditarNoCartao();

    const seletor = page.getByLabel(FRASE);
    await seletor.waitFor({ timeout: 30_000 }).catch(() => {});
    ctx.verificar("o cartão mostra o seletor de projeto, visível de verdade", await ctx.visivelRolando(seletor), `contagem=${await seletor.count()}`);
    const opcoes = (await seletor.count()) > 0 ? await seletor.locator("option").allInnerTexts() : [];
    ctx.verificar("o seletor lista os projetos do escritório", opcoes.includes("099-25 · CRICIÚMA") && opcoes.includes("063-26 · CRICIÚMA"), JSON.stringify(opcoes));
    const botao = page.getByRole("button", { name: "Auditar neste projeto" });
    ctx.verificar("sem escolha, o botão não libera", (await botao.count()) === 1 && (await botao.isDisabled()), `botões=${await botao.count()}`);

    await page.waitForTimeout(3000);
    ctx.verificar("sem escolha, nenhuma auditoria foi pedida ao servidor", pedidos.total() === 0, `pedidos=${pedidos.total()}`);
    const auditoriasSemEscolha = await contarAuditorias();
    ctx.verificar("sem escolha, nenhuma auditoria nova no banco", auditoriasSemEscolha === auditoriasAntes, `${auditoriasAntes} -> ${auditoriasSemEscolha}`);
    if ((await seletor.count()) === 0) return;

    await seletor.selectOption({ label: "099-25 · CRICIÚMA" });
    await botao.click();
    await ctx.esperarParecer(1);
    pedidos.parar();
    ctx.verificar("escolhido o projeto, a auditoria foi pedida uma vez", pedidos.total() === 1, `pedidos=${pedidos.total()}`);

    const id = await ctx.conversaAberta();
    const [projeto] = await ctx.banco.consultar(`select id from "Project" where code = '099-25' and "organizationId" = 'org-prosul'`);
    const { registradas, linhas } = await ctx.auditoriasDaConversa(id);
    ctx.verificar(
      "a auditoria rodou e concluiu no projeto escolhido",
      Boolean(projeto) && registradas.length === 1 && linhas.length === 1 && linhas[0].status === "COMPLETED" && linhas[0].projectId === projeto.id,
      `projeto=${projeto?.id} ${JSON.stringify(linhas)}`,
    );
    ctx.verificar("a conversa ficou endereçada ao projeto escolhido", (await ctx.lerConversa(id))?.projectId === projeto?.id, `conversa=${(await ctx.lerConversa(id))?.projectId}`);
  },
};
```

- [ ] **Passo 2: rodar e registrar o vermelho**

Rode: `npm run bateria -- --so-jornadas x2`
Esperado: `FALHOU  x2`, com o seletor, as opções e o botão em `FALHOU`, e as duas verificações de "não gasta" em `ok` (o produto de hoje já não gasta).

Se "nenhuma auditoria foi pedida" falhar, o memorial ganhou código de algum lugar: confira o `dossie` da conversa no IndexedDB e o teste da Tarefa 2 ("memorial sem código").

- [ ] **Passo 3: commit**

```bash
git add scripts/bateria/jornadas/acesso/x2-memorial-sem-codigo.mjs
git diff --cached --stat
git commit -m "a bateria mostra que memorial sem codigo manda escolher o projeto sem oferecer onde" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 22: o cartão de auditoria ganha o seletor de projeto

**Arquivos:**
- Alterar: `lib/resolucao-de-projeto.ts` (funções novas no fim)
- Alterar: `scripts/test-resolucao-de-projeto.ts` (import; asserções antes do `console.log` final)
- Alterar: `modules/nexo/components/ConfirmationCard.tsx` (import; `AuditoriaConfirmation`: estado, `confirm`, render)

**Interfaces:**
- Consome: o contrato da Tarefa 21; `ProjetoConhecido` e `normalizarCentroDeCusto` (`lib/resolucao-de-projeto.ts`); `fraseDoImpasse` e o desfecho `{ tipo: "sem-codigo", projetos }` de `resolverProjetoDaAuditoria` (`modules/nexo/lib/projeto-da-auditoria.ts`).
- Produz:
  - `type OpcaoDeProjeto = { id: string; rotulo: string }`
  - `opcoesDoSeletorDeProjeto(projetos: readonly ProjetoConhecido[]): OpcaoDeProjeto[]`: ordenadas pelo centro de custo normalizado; rótulo `<código> · <cliente>`, ou só o código sem cliente
  - `projetoEscolhidoValido(escolhido: string, opcoes: readonly OpcaoDeProjeto[]): boolean`

**O desenho:** `confirm(comTranscricao, projetoDaEscolha?)`. Sem projeto na conversa e com o desfecho `sem-codigo` com projetos, o cartão guarda os projetos e o botão que a pessoa apertou (com ou sem transcrição) e volta sem gastar. O seletor aparece abaixo dos botões. "Auditar neste projeto" chama `confirm` de novo com o projeto escolhido, que vincula a conversa e segue o caminho de sempre. Os outros desfechos (`sem-escritorio`, e `sem-codigo` sem projeto nenhum) seguem como frase, porque não há o que escolher.

- [ ] **Passo 1: o teste que falha**

Em `scripts/test-resolucao-de-projeto.ts` (sujo: à mão), troque:

```ts
import {
  decidirTroca,
  normalizarCentroDeCusto,
  resolverProjeto,
} from "../lib/resolucao-de-projeto.ts";
```

por:

```ts
import {
  decidirTroca,
  normalizarCentroDeCusto,
  opcoesDoSeletorDeProjeto,
  projetoEscolhidoValido,
  resolverProjeto,
} from "../lib/resolucao-de-projeto.ts";
```

E troque:

```ts
console.log("OK  resolucao de projeto");
```

por:

```ts
// O SELETOR (X2, decidido em 15/09/2026): quando o documento não traz código,
// quem escolhe é gente — e a lista precisa ser lida do jeito que o escritório
// procura, pelo centro de custo, com a prefeitura ao lado.
const opcoes = opcoesDoSeletorDeProjeto([
  { id: "p3", code: "099-25", client: "CRICIÚMA" },
  { id: "p4", code: "040-26", client: "" },
  { id: "p5", code: "063/26", client: "IÇARA" },
]);
assert.deepEqual(opcoes, [
  { id: "p4", rotulo: "040-26" },
  { id: "p5", rotulo: "063/26 · IÇARA" },
  { id: "p3", rotulo: "099-25 · CRICIÚMA" },
]);

// Sem escolha, ou com um id que não está na lista, não se audita.
assert.equal(projetoEscolhidoValido("", opcoes), false);
assert.equal(projetoEscolhidoValido("p9", opcoes), false);
assert.equal(projetoEscolhidoValido("p3", opcoes), true);

console.log("OK  resolucao de projeto");
```

Rode: `node scripts/test-resolucao-de-projeto.ts`
Esperado: FALHA com `does not provide an export named 'opcoesDoSeletorDeProjeto'`.

- [ ] **Passo 2: as opções**

No fim de `lib/resolucao-de-projeto.ts` (sujo: à mão), acrescente:

```ts

/** Uma linha do seletor de projeto do cartão de auditoria. */
export type OpcaoDeProjeto = { id: string; rotulo: string };

/**
 * AS OPÇÕES DO SELETOR — quando o documento não traz centro de custo.
 *
 * Decidido pelo Matheus em 15/09/2026 (cenário X2 da bateria): a frase "Escolha
 * o projeto desta auditoria" existia sem nada para escolher. A ordem é a do
 * centro de custo NORMALIZADO, que é como o escritório procura; o rótulo leva a
 * prefeitura porque dois projetos do mesmo ano se distinguem por ela.
 */
export function opcoesDoSeletorDeProjeto(projetos: readonly ProjetoConhecido[]): OpcaoDeProjeto[] {
  return [...projetos]
    .sort((a, b) => normalizarCentroDeCusto(a.code).localeCompare(normalizarCentroDeCusto(b.code)))
    .map((p) => ({ id: p.id, rotulo: p.client?.trim() ? `${p.code} · ${p.client.trim()}` : p.code }));
}

/** Só um projeto que ESTÁ na lista libera a auditoria. */
export function projetoEscolhidoValido(escolhido: string, opcoes: readonly OpcaoDeProjeto[]): boolean {
  return escolhido !== "" && opcoes.some((o) => o.id === escolhido);
}
```

Rode: `node scripts/test-resolucao-de-projeto.ts`
Esperado: `OK  resolucao de projeto`.

- [ ] **Passo 3: o cartão**

Em `modules/nexo/components/ConfirmationCard.tsx` (sujo: à mão), troque:

```ts
import { fraseDoImpasse, resolverProjetoDaAuditoria } from "../lib/projeto-da-auditoria";
```

por:

```ts
import { fraseDoImpasse, resolverProjetoDaAuditoria } from "../lib/projeto-da-auditoria";
import {
  opcoesDoSeletorDeProjeto,
  projetoEscolhidoValido,
  type ProjetoConhecido,
} from "@/lib/resolucao-de-projeto";
```

Troque:

```ts
  async function confirm(comTranscricao = false) {
    if (!memorialFile) return;
```

por:

```ts
  /*
   * O SELETOR DE PROJETO — decidido em 15/09/2026 (jornada x2). Sem código no
   * documento, o cartão mandava "Escolha o projeto desta auditoria" e não tinha
   * onde. Guarda os projetos e o botão que foi apertado (com ou sem
   * transcrição), para a escolha retomar exatamente o pedido.
   */
  const [escolhaDeProjeto, setEscolhaDeProjeto] = useState<{
    projetos: ProjetoConhecido[];
    comTranscricao: boolean;
  } | null>(null);
  const [projetoEscolhido, setProjetoEscolhido] = useState("");

  async function confirm(comTranscricao = false, projetoDaEscolha?: string) {
    if (!memorialFile) return;
```

Troque:

```ts
    let projectId = projetoDaConversa;
```

por:

```ts
    let projectId = projetoDaEscolha ?? projetoDaConversa;
    if (projetoDaEscolha) {
      // A escolha endereça a conversa: a próxima auditoria dela não pergunta de novo.
      vincularProjeto(projetoDaEscolha);
      setEscolhaDeProjeto(null);
    }
```

Troque:

```ts
      if (destino.tipo !== "achado") {
        setError(fraseDoImpasse(destino));
        setBusy(false);
        return;
      }
```

por:

```ts
      // Sem código e com projetos para escolher: pergunta, e não gasta.
      if (destino.tipo === "sem-codigo" && destino.projetos.length > 0) {
        setEscolhaDeProjeto({ projetos: destino.projetos, comTranscricao });
        setBusy(false);
        return;
      }

      if (destino.tipo !== "achado") {
        setError(fraseDoImpasse(destino));
        setBusy(false);
        return;
      }
```

E troque:

```tsx
            {!memorialFile && (
              <span className="text-xs text-muted-foreground">
                Anexe o memorial (o Nexo o separa das pranchas).
              </span>
            )}
          </div>
        </>
      )}
```

por:

```tsx
            {!memorialFile && (
              <span className="text-xs text-muted-foreground">
                Anexe o memorial (o Nexo o separa das pranchas).
              </span>
            )}
          </div>
          {/*
            O SELETOR DE PROJETO (x2, 15/09/2026). O rótulo é a mesma frase de
            `fraseDoImpasse`: é ela que explica por que a escolha apareceu. Sem
            escolha válida o botão não libera — auditoria sem projeto não tem
            fila, gate de emissão nem a quem atribuir achado.
          */}
          {escolhaDeProjeto &&
            (() => {
              const opcoes = opcoesDoSeletorDeProjeto(escolhaDeProjeto.projetos);
              const idDoSeletor = `projeto-da-auditoria-${mensagemId ?? "cartao"}`;
              return (
                <div
                  data-seletor-de-projeto
                  className="nx-cut-6 flex flex-col gap-2 border-0 bg-[var(--nexodoc-recessed)] px-3 py-2"
                >
                  <label htmlFor={idDoSeletor} className="text-xs leading-relaxed text-foreground">
                    {fraseDoImpasse({ tipo: "sem-codigo", projetos: escolhaDeProjeto.projetos })}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      id={idDoSeletor}
                      value={projetoEscolhido}
                      onChange={(e) => setProjetoEscolhido(e.target.value)}
                      className="nx-edge-5 h-8 min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground [--nx-fill:var(--nexodoc-recessed)]"
                    >
                      <option value="">Escolha o projeto…</option>
                      {opcoes.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.rotulo}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      disabled={busy || !projetoEscolhidoValido(projetoEscolhido, opcoes)}
                      onClick={() => void confirm(escolhaDeProjeto.comTranscricao, projetoEscolhido)}
                    >
                      Auditar neste projeto
                    </Button>
                  </div>
                </div>
              );
            })()}
        </>
      )}
```

- [ ] **Passo 4: verificar**

Rode: `npx eslint lib/resolucao-de-projeto.ts modules/nexo/components/ConfirmationCard.tsx scripts/test-resolucao-de-projeto.ts` e a contagem de tipos.
Esperado: sem erro novo de lint; `0`.

Rode: `npm run bateria -- --so-jornadas x2` e `npm run bateria -- --so-jornadas a5`.
Esperado: `ok      x2`, `ok      a5` (a5 passa por `confirm` com projeto já vinculado).

- [ ] **Passo 5: commit**

```bash
git add lib/resolucao-de-projeto.ts scripts/test-resolucao-de-projeto.ts modules/nexo/components/ConfirmationCard.tsx
git diff --cached --stat
git commit -m "memorial sem codigo mostra um seletor com os projetos do escritorio e so audita depois da escolha" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
```

---

### Tarefa 23: duas rodadas completas verdes, registro, push e o próximo passo

**Arquivos:**
- Alterar: `docs/bateria/defeitos-achados.md` (conferência final)
- Alterar: `docs/bateria/rodar-no-pc-de-casa.md` (seção "Próximo passo: CI")

- [ ] **Passo 1: rodada completa**

Rode: `npm run bateria`
Esperado: `Testes puros: N verdes · 0 vermelhos · 0 apodrecidos` e `Jornadas: 18 verdes · 0 vermelhas` (f0, a1, a2, a3, a4, a5, a6, a7, c1, c2, c3, c4, c5, c6, v1, v2, x1, x2), código 0. Anote os números e a duração.

- [ ] **Passo 2: triagem do que ficar vermelho**

Para cada vermelho ou apodrecido, a seção "Tratamento de defeito achado" do desenho, sem atalho:
1. Leia a captura e o `servidor.log` da pasta de artefatos, e investigue com `superpowers:systematic-debugging` antes de mexer.
2. Defeito claro de produto: teste puro que falha, conserto, jornada verde, commit, e uma linha no registro com o hash.
3. Jornada frágil (tempo, ordem entre jornadas no mesmo banco): conserte a jornada, com o comentário do caso medido. Nunca afrouxe uma verificação até ela ficar vazia.
4. Decisão de produto nova: pare e pergunte ao Matheus, descrevendo o que acontece e as opções.

- [ ] **Passo 3: a segunda rodada seguida**

Rode `npm run bateria` de novo, sem mexer em nada entre as duas.
Esperado: os mesmos números do Passo 1, código 0. Vermelho aqui que não apareceu no Passo 1 é intermitência: trate como defeito (Passo 2) e recomece a contagem das duas rodadas.

- [ ] **Passo 4: o registro fecha com o que foi feito**

Abra `docs/bateria/defeitos-achados.md` e confira:
- uma linha com hash para cada conserto que rodou (a5, c5, c3, v2, x1), e nenhuma com "(hash do Passo…)" sobrando;
- em "Suspeitas abertas", uma linha para cada hipótese que não se reproduziu (com a evidência), se houve;
- em "Suspeitas abertas", o limite assumido em C5 (resposta que chega na janela de milissegundos da troca).

Acrescente em "Suspeitas abertas", se ainda não estiver lá:

```markdown
- C5: uma resposta de auditoria que chegue dentro da janela da própria troca de conversa (entre `selectConversation` e o commit da conversa nova) ainda lê o id anterior em `conversaAberta()`. Sem caso medido.
```

- [ ] **Passo 5: o próximo passo (CI), no guia**

No fim de `docs/bateria/rodar-no-pc-de-casa.md`, acrescente (trocando `<data>` pela data do Passo 3):

```markdown
## Próximo passo: CI (fora desta rodada)

A bateria ficou verde em duas rodadas seguidas em <data>, com as 18 jornadas da segunda rodada. É a condição que o desenho pôs para levar a bateria ao GitHub Actions. O que bloqueia hoje, medido em 15/09/2026:

| Bloqueio | Onde | Saída |
|---|---|---|
| Derrubar o servidor no Linux mata só o shell | `scripts/bateria/lib/servidor.mjs`: fora do Windows, `matarFilho` é `filho.kill()`, e o `next dev` é neto do shell (`spawn` com `shell: true`); `matarPorta` usa `kill -9` só no PID que escuta | `spawn` com `detached: true` e `process.kill(-filho.pid)` (o grupo), e `matarPorta` de novo depois |
| Versão do Node não fixada | `package.json` não tem `engines`; os testes dependem do TypeScript nativo do Node 24 | `"engines": { "node": ">=24" }` e `actions/setup-node` com `node-version: 24` |
| Navegador do Playwright | nenhum script instala o Chromium | passo `npx playwright install --with-deps chromium` antes de `npm run bateria` |
| Banco | `DATABASE_URL_BATERIA` mora no `.env.local`, que não existe no runner | segredo do GitHub com a URL do `nexodoc_teste` (sem `-pooler` para o `migrate deploy`), ou `services: postgres` com um banco chamado `nexodoc_teste` — a guarda só olha o nome |
| `lsof` | `pidsEscutando` fora do Windows | presente no `ubuntu-latest`; em imagem mínima, instalar |
| Variáveis | `lerEnvLocal` só lê arquivo | todas vêm do `env:` do workflow; `OPENAI_API_KEY` não precisa de valor real (a bateria força `sk-simulada`) |
```

- [ ] **Passo 6: commit e push**

```bash
git add docs/bateria/defeitos-achados.md docs/bateria/rodar-no-pc-de-casa.md
git diff --cached --stat
git commit -m "segunda rodada da bateria verde duas vezes seguidas, e o que falta para o ci" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01F9r3coMnenG4A2hwwxurFF"
git push origin main
```

Esperado: push aceito. Informe ao Matheus os números das duas rodadas, os defeitos consertados (com hash) e as suspeitas abertas.
