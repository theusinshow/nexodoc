# Plano de integração — o Nexo audita o projeto inteiro

Escrito em 14/10/2026. Documento de análise. Não muda código de produto.

O NexoDoc hoje audita memorial descritivo e monta volume (capa, separatriz, lista de documentos, pranchas na ordem). A meta é o conjunto do projeto: prancha, memorial, quantitativo e o que mais o escritório entrega, com um orquestrador e um bot por disciplina. A ideia vem do ProjectDots. A leitura de desenho que o Nexo ainda não faz vinha do Truss.

Este texto diz o que cada repositório é, o que dá para decidir sem o código do Truss, a arquitetura alvo e os primeiros passos. No fim está o diagnóstico do `503` em `nexodoc-kappa.vercel.app`.

---

## 1. O que foi possível ler

| Repositório | Situação nesta máquina |
|---|---|
| `theusinshow/nexodoc` | Lido na `main` (`a5b49774`, 13/10/2026). |
| `theusinshow/truss` | Inacessível. |
| `theusinshow/projectdots` | Inacessível. |

A conta pública `theusinshow` lista 38 repositórios. Truss e ProjectDots não estão entre eles. `git ls-remote` e a API do GitHub respondem `Repository not found` para os dois — o mesmo recado que o GitHub dá para repositório inexistente, apagado ou privado sem permissão. O token deste ambiente enxerga o NexoDoc e não enxerga o resto da conta.

Não há menção a `truss` nem a `projectdots` no código nem na documentação do NexoDoc.

Por isso as seções do Truss e do ProjectDots descrevem o que o dono pediu que eles sejam, e marcam como hipótese tudo o que não foi lido no código. Nenhuma decisão de "portar o arquivo X" sai daqui até os dois repositórios abrirem.

Repos públicos vizinhos, que **não** são esses dois e não foram usados como substituto: `theusinshow/nexo-volume` (montagem de volume a partir de PDF) e `theusinshow/copy-paste` (auditoria documental em Python, por regras e revisão humana).

---

## 2. NexoDoc hoje

Produto em uso interno. Produção em `nexo-doc.com`, no Railway, desde 03/10/2026 (`docs/migracao-railway.md`). O arranjo Vercel + Render foi aposentado de propósito (`docs/deploy.md`, comentário no `Dockerfile`).

### Stack

- Next.js 16.4 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui.
- Prisma 7 e Postgres. Em produção, app e banco no mesmo projeto Railway.
- OpenAI no backend (`openai` ^6). MiMo como fallback de leitura de selo. DeepSeek existe como configuração, sem execução liberada.
- Auth.js (next-auth 5) com Google. Escritório (`Organization`) é o dono do projeto.
- PDF: `pdfjs-dist` para texto, `pdf-lib` para montar volume, LibreOffice no container para ODT → PDF.
- Arquivo grande (prancha) no cofre S3 compatível (bucket da Railway), cifrado. `PranchaDoProjeto` guarda a ficha; os bytes saem por `/api/arquivos/[checksum]`.
- Testes: scripts `node` em `scripts/test-*.ts` e provas de tela em `scripts/prova-*.mjs` (Playwright). Não há Jest/Vitest. A bateria sobe um `next dev` próprio (`.next-bateria`).

O `package.json` pede Node `>=24`. O `Dockerfile` que a Railway constrói ainda é `node:22-bookworm-slim`. O projeto na Vercel está em Node `24.x`. São três ambientes diferentes para o mesmo `engines`.

### O que o produto faz, por módulo

| Módulo | O que entrega | O que não entrega |
|---|---|---|
| Auditoria de memorial | Parecer com achados ancorados em página, regra determinística + modelo, validação, chat do achado, reuso por impressão de capítulo | Cálculo estrutural, quantitativo, leitura de desenho |
| Nexo (conversa) | Solta PDFs, lê carimbo, propõe LD/capa/volume, a pessoa confirma | A IA não gera o documento; as rotas determinísticas geram no clique |
| Pranchas guardadas | PDF da prancha fica no projeto e volta depois do F5 | Não audita o desenho. Serve a montagem |
| Volume | Capa → separatriz → LD → pranchas, por disciplina, vários tomos | Conferência geométrica entre folhas |
| Orçamento | O classificador reconhece planilha (`tipo: "orcamento"`) | Não há auditoria de quantitativo. Cai no modo `volume` |

O léxico de disciplinas já é a fonte única: `server/nexo/disciplinas.ts`, cerca de duas dúzias de códigos de três letras (`arq`, `est`, `fnd`, `his`…), com nome de tela, de capa e de documento, e grupo técnico (arquitetura, estrutural, complementares, orçamento). Isso é o vocabulário que um bot por disciplina precisa herdar, não reinventar.

### Estrutura que importa

```text
app/api/audit/          parecer do memorial (rota grande, SSE)
app/api/nexo/           agente, LD, capa, volume, selo, conversas
app/api/pranchas/       ficha da prancha no projeto
app/api/volume/         caminho antigo de volume
lib/audit-engine/       contrato do parecer, fatos, roteamento, reuso
lib/audit-coherence.ts  regras do memorial (arquivo longo)
lib/audit-classify.ts   memorial | ld | capa | prancha | orcamento
lib/ai-providers.ts     modelo por fluxo
lib/ai-runner.ts        chamada, timeout, uso
lib/ai/tasks.ts         AiTask
server/nexo/agent/      roteador de intenção da conversa
server/nexo/disciplinas.ts
modules/nexo/           estado da conversa no cliente
modules/volume-builder/
prisma/schema.prisma
```

### IA — como o token é gasto hoje

Fluxos nomeados em `lib/ai-providers.ts`: `audit`, `audit-chat`, `audit-transcricao`, `conferente`, `nexo-agent`, `ld-extraction`, `volume-analysis`, `volume-suggestion`, `volume-conferencia`.

A auditoria de memorial (`docs/analise-arquitetura-auditoria-2026-09-26.md`, conferida no desenho e ainda a descrição operacional) corre dentro do `POST /api/audit`:

1. Portão: sessão, projeto, teto mensal, uma auditoria por vez na casa.
2. Extração sem modelo: pdfjs, grade de tabela, transcrição por visão só se a tela pedir.
3. Plano de reuso por impressão de capítulo contra o parecer anterior.
4. Por arquivo: regras locais, uma chamada global, blocos (no padrão; no profundo a global cobre), evidência ancorada sem modelo, rede do que ninguém leu.
5. Confronto entre arquivos por regra.
6. Uma validação em lote.
7. Dedupe, conferente, severidade determinística, gravação do parecer.

O agente da conversa (`server/nexo/agent/run-turn.ts`) é outra coisa: uma chamada por turno. Ele lê fatos já extraídos do carimbo e devolve texto mais propostas. Quem gera LD, capa e volume são ferramentas determinísticas, e só depois da confirmação. O comentário do arquivo já prevê trocar esse roteador por um laço de ferramentas sem mexer na UI.

`lib/audit-engine/routing.ts` já faz roteamento sem triagem paga: uma pré-verificação local manda o candidato para uma chamada direta ou para investigação. Motivos são estado do caso (cálculo, referência solta, relação bloqueada), nunca a confiança que o modelo declara de si.

O que já economiza token, e deve ser conservado:

- regra antes do modelo;
- reuso por impressão do capítulo (`lib/audit-engine/reuse.ts`);
- evidência filtrada sem IA;
- orçamento de chamadas por candidato e por tipo;
- `AiUsageEvent` (provedor, modelo, fluxo, tokens, custo, duração) e `AiTask` (a tarefa de negócio, com `inputHash`);
- `AuditLearning` por escritório, injetado no prompt, com escopo `global | memorial | volume` — ainda não por disciplina.

O que o próprio `docs/17-roadmap-agentes-ia-economia.md` já apontava e continua valendo: a rota de auditoria ainda mistura orquestração, heurística, chamada e consolidação; não há cache semântico do documento; o supervisor que escolhe modelo por custo não está decidindo sozinho.

### Modelo de dados que já liga as peças

`Project` é do escritório, identificado pelo centro de custo (`code`, único no escritório). `identidade` (JSON) guarda obra, órgão, município, com a origem (capa, selo, usuário) e o arquivo que provou. A capa do memorial geral vence; o corpo do memorial não grava identidade.

Pendurados no projeto: `Audit`, `ProjectDocument`, `ProjectUpload`, `DocumentArtifact`, `LdDraft`, `NexoConversation`, `PranchaDoProjeto`, `AiTask`, `ProjectEvent`.

`PranchaDoProjeto` é ficha (nome, checksum, páginas, tamanho), não leitura. Dois PDFs com o mesmo nome no mesmo projeto não coexistem. O checksum indexa o cofre.

`DocumentKind` já separa memorial, LD, capa, prancha e orçamento. A auditoria profunda só dispara para memorial. Prancha e orçamento não ganham parecer próprio.

### Maturidade

Maduro o bastante para obra real no memorial e na montagem de volume: parecer com evidência, feedback humano, achados atribuíveis, suporte, cofre de prancha, léxico de disciplina medido em capas reais (040-26, 113-22, 116-25, 156-25).

Imaturo para o objetivo deste plano:

- não há bot por disciplina;
- não há quantitativo como peça auditada;
- a prancha entra como folha a ordenar e carimbo a ler, não como desenho a conferir;
- o "agente" existente orquestra a conversa de montagem, não o parecer do projeto;
- `AuditLearning.scope` não conhece disciplina nem tipo de peça além de memorial e volume.

### Testes

Centenas de scripts puros (regras de auditoria, selo, LD, volume, identidade, segurança, custo) mais provas de navegador. A bateria não substitui um `next build`: o CI de tipos e build existe justamente porque o `next dev` ignora erro de tipo. Precisão e recall do memorial têm script (`scripts/audit-precision-recall.ts`) e planilha de julgamento em `docs/benchmarks/`.

---

## 3. Truss — o que se sabe sem o código

Pelo pedido: projeto mais antigo, auditava pranchas (desenhos estruturais). Não foi possível abrir o repositório, então **não há stack, módulos, fluxo de dados nem testes para citar**. Qualquer lista de arquivos do Truss neste documento seria invenção.

O que o Nexo já faz na vizinhança da prancha, e que portanto não precisa "vir do Truss" para existir:

- recorte e leitura de carimbo (`/api/ld/extract-stamp`, `/api/nexo/selo-check`), com fallback MiMo;
- classificação de PDF como prancha (`lib/audit-classify.ts`);
- guarda do PDF no projeto (`/api/pranchas`, `PranchaDoProjeto`, cofre);
- ordem da folha no volume e confronto de identidade carimbo × capa × memorial (`Project.identidade`).

O que o Nexo não faz, e que é o motivo de absorver o Truss se o código confirmar:

- ler o desenho (cotas, armação, eixos, quadros, compatibilização entre plantas);
- acusar divergência entre o que a prancha desenha e o que o memorial especifica;
- uma bateria de pranchas reais com precisão medida, no mesmo espírito da planilha do memorial.

Até o repositório abrir, o Truss entra no plano como **fonte a inventariar**, não como dependência de código.

---

## 4. ProjectDots — o que se sabe sem o código

Pelo pedido: cada disciplina de engenharia é um bot; um orquestrador por cima; a análise melhora com o tempo, gasta menos token e erra menos. Também inacessível. Trata-se aqui como **arquitetura a adotar**, não como código a copiar.

O Nexo já tem peças com o mesmo nome e outro emprego. Não rebatizar:

| Peça que já existe | O que ela é | O que o ProjectDots pede e ela não é |
|---|---|---|
| `server/nexo/agent/run-turn.ts` | Uma chamada que interpreta a conversa e propõe LD/capa/volume | Orquestrador de parecer entre disciplinas |
| `AiAgentName` (`auditor`, `ld-reader`, `volume-builder`, `supervisor`…) | Rótulo da `AiTask` | Um processo com contrato, orçamento e memória por disciplina |
| `lib/audit-engine/routing.ts` | Roteia candidato de memorial entre chamada barata e investigação | Não escolhe disciplina nem peça |
| `server/nexo/disciplinas.ts` | Léxico e grupo técnico | Não executa análise |
| `AuditLearning` | Texto que entra no prompt do escritório | Escopo `memorial` / `volume` / `global`, não `est` nem `prancha` |

Adotar o ProjectDots é acrescentar uma camada em cima dessas peças, não substituir o parecer de memorial nem o gerador de volume.

---

## 5. Truss: o que reaproveitar e o que reescrever

Sem o código, o veredito arquivo a arquivo fica para o dia em que o repo abrir. O critério, para não portar o passado inteiro:

**Reaproveitar, se existir e estiver testado contra prancha real**

- Extração que não chama modelo: texto do PDF, vetor, camada, bloco de carimbo, quadro de ferros, lista de eixos. Isso é o que torna o parecer barato. Entra como biblioteca chamada pelo Nexo, com teste puro em `scripts/test-*.ts`, no mesmo estilo do resto.
- Checagens determinísticas com gabarito (bitola que não fecha, eixo citado e ausente, escala incompatível com a cota). Viram regra, no mesmo lugar conceitual de `lib/audit-coherence.ts`, com evidência apontando para folha e região — não para "o modelo achou".
- Amostras e a planilha de julgamento, se houver. Sem isso o bot de estrutura nasce sem medida.

**Reescrever, mesmo que o Truss tenha uma versão funcionando**

- Qualquer cliente de LLM, prompt e orquestração. O Nexo já tem `ai-runner`, preço, teto, `AiTask` e roteamento. Um segundo cliente duplica custo e fura o teto.
- Autenticação, projeto, upload e tela. O dono do dado é `Project` no escritório; a prancha já tem cofre.
- Formato de achado paralelo. O parecer do Nexo tem contrato (`lib/audit-engine/report-contract.ts`, cartão, evidência). Achado de prancha entra nesse contrato, com `kind` novo se precisar, não num JSON próprio do Truss.
- UI. O Nexo tem léxico, chanfro e a tela de achados. Uma tela de auditoria de prancha à parte divide o operador em dois produtos.

**Não portar**

- Script solto, notebook e prompt colado que só rodou na máquina de quem fez.
- Dependência pesada de CAD (AutoCAD, engine geométrica grande) se o escritório entrega PDF. O insumo real do Nexo é PDF. DXF/DWG só entra se o escritório de fato anexar esse arquivo; até lá é outro produto.

O primeiro dia com o repo aberto é um inventário curto, não um merge: linguagem, como a prancha vira fato, o que é regra e o que é modelo, se há teste, e uma amostra. A seção 8 começa por isso.

---

## 6. Arquitetura alvo

Um projeto, várias peças, um orquestrador, um bot por disciplina. O modelo é compartilhado. O token entra por último.

```text
PDFs do projeto (já no cofre / já classificados)
        │
        ▼
Extração estruturada, sem modelo
  memorial → capítulos, tabelas, identidade
  prancha  → carimbo, texto, quadros, regiões
  quantitativo → itens, unidades, quantidades
        │
        ▼
Fatos do projeto (um só, versionado pelo checksum da peça)
        │
        ▼
Orquestrador
  escolhe disciplina, peça e profundidade
  aplica teto, cache e reuso
  não relê o que o hash já pagou
        │
        ├── bot arq, est, fnd, his, ele, …
        │     regra da disciplina → modelo só no trecho ambíguo
        │
        └── cruzamentos
              memorial × prancha × quantitativo × LD
        │
        ▼
Parecer único (contrato atual do audit-engine)
  achado com peça, folha, disciplina e evidência
```

### O fato compartilhado

Hoje a identidade mora em `Project.identidade` e o parecer mora em `Audit`. Isso chega para "esta obra é a mesma nas capas". Não chega para "o pilar P3 tem 20×40 no memorial, 20×50 na prancha e 18 m no quantitativo".

O alvo é um fato com dono:

- projeto e disciplina (`est`, não o texto livre do carimbo — o léxico já resolve o texto);
- peça (`memorial`, `prancha`, `quantitativo`, `ld`, `capa`);
- assunto (`pilar`, `bitola`, `área`, `item de planilha`);
- valor, unidade, folha ou linha, checksum do arquivo;
- origem: regra, modelo ou pessoa. Pessoa vence, como a identidade já faz com a capa.

O JSON de identidade continua para o cabeçalho da obra. O fato novo é linha, porque cruzamento e cache precisam consultar, não varrer um blob.

### Bots de disciplina

Cada bot tem o contrato que `docs/17-roadmap-agentes-ia-economia.md` já pedia e que a `AiTask` quase representa: nome, entradas, saída, modelo barato, modelo forte, teto de chamadas, cache por `inputHash`.

O bot não recebe o PDF. Recebe os fatos da sua disciplina e, quando a regra não fecha, o trecho (página do memorial, região da prancha, linhas da planilha). Estrutural é o primeiro porque é o que o Truss cobria e o que o grupo técnico `estrutural` já nomeia (`est`, `fnd`, e a família metálica que o léxico separa de propósito).

O orquestrador é o `supervisor` que hoje é só um rótulo. Ele:

1. olha o classificador (`DocumentKind`) e o código da disciplina;
2. recusa trabalho fora da peça (orçamento não cai mais em "volume");
3. manda extrair antes de chamar quem quer que seja;
4. aplica `routing.ts` no candidato — a pré-verificação local já existe, passa a ver fato de prancha e de planilha, não só candidato de memorial;
5. dispara o cruzamento só quando as duas peças da comparação já têm fato. Sem quantitativo anexado, o bot não inventa quantidade.

### Cruzamentos que pagam o produto

Poucos, e todos com os dois lados extraídos:

| Cruzamento | Pergunta | Quando recusar |
|---|---|---|
| Identidade | Obra, código, revisão e município batem entre capa, carimbo, memorial e planilha? | Já existe em boa parte. Não reescrever; estender a origem |
| Memorial × prancha | Especificação (seção, material, resistência) aparece no desenho da mesma disciplina? | Sem fato dos dois lados |
| Memorial × quantitativo | Item especificado tem linha na planilha, unidade compatível? | Planilha não classificada como `orcamento` |
| Prancha × quantitativo | Quantidade desenhada (comprimento, área, número de peças) fecha com a linha? | Sem extrator de quantidade na prancha — é o pedaço mais caro, fica para depois do primeiro bot |
| LD × folhas guardadas | A lista promete a folha que está no cofre, revisão igual? | Já é o ofício do volume; o parecer só aponta o furo |

O parecer continua um só. A tela de achados já sabe filtrar. Disciplina e peça viram campos do achado, não um produto ao lado.

### Token

A ordem é fixa. Pular etapa é o que torna a auditoria do projeto inteiro impagável.

1. **Classificar e roteiar sem modelo.** `audit-classify` e `routing.ts` já fazem isso no memorial. Prancha com texto de carimbo não precisa de visão para saber que é `est`.
2. **Extrair estrutura antes do modelo.** Texto, tabela, carimbo, linha de planilha. Visão só na página muda ou no quadro que a extração marcou como imagem (`test:pagina-muda`, `test:quadro-em-imagem` já existem como sinal).
3. **Cache pelo checksum.** `AiTask.inputHash` e o reuso por capítulo são o molde. Fato extraído de um PDF não se reextrai porque a conversa recomeçou. A prancha guardada já tem `checksumSha256`.
4. **Modelo barato no trecho, modelo forte no conflito.** A validação em lote do memorial é o padrão: o forte não relê a obra, lê os candidatos que a regra não conseguiu matar.
5. **Não cruzar peça ausente.** O orquestrador não chama o bot de quantitativo se não há planilha. Isso sozinho corta a maior parte do custo de um "audite tudo".
6. **Aprendizado que vira regra, não prompt eterno.** `AuditLearning` hoje entra no prompt. Correção repetida da mesma disciplina (o escritório sempre recusa marca fechada, por exemplo) deve virar regra com teste, e o aprendizado sai do contexto. Prompt que só cresce fica mais caro e pior.

---

## 7. Roteiro

Cada fase termina com algo que se mostra, não com um esqueleto de pastas. Nenhuma fase espera o Truss para começar, exceto a 0 no que é inventário do Truss.

### Fase 0 — ver o que está fechado

1. Tornar `theusinshow/truss` e `theusinshow/projectdots` legíveis (público, ou o token deste ambiente com acesso). Se não existirem com esses nomes, dizer o nome certo.
2. No dia em que abrirem: uma página no fim deste arquivo com linguagem, entrada (PDF ou CAD), o que é regra, o que é modelo, e se há teste. Só então a seção 5 ganha nomes de arquivo.
3. O `503` da Vercel tem conserto próprio, na seção 8. Não bloqueia este roteiro: produção é a Railway.

### Fase 1 — fato do projeto, ainda sem bot novo

Primeiro passo de código, e pequeno:

- Tabela de fato (projeto, disciplina, peça, assunto, valor, unidade, localização, checksum, origem). Migração Prisma. Sem UI.
- Um escritor determinístico para o que já se extrai: identidade da capa e campos do carimbo que a LD já lê. A prancha guardada passa a ter fato de carimbo, não só ficha.
- Teste puro: dois checksums iguais não duplicam fato; capa vence corpo, como `lib/identidade-do-projeto.ts` já manda.

Critério de pronto: dado um projeto com memorial e pranchas guardadas, uma consulta lista os carimbos por disciplina sem chamar modelo.

### Fase 2 — uma disciplina, uma peça a mais

Estrutural, porque o grupo e o léxico já existem e é a aposta do Truss.

- Bot `est` com contrato de `AiTask` (`agent: "est"`, fluxo novo ao lado de `audit`).
- Entrada: fatos da fase 1 mais o texto do memorial já extraído na disciplina estrutural (o memorial hoje é lido inteiro; aqui o corte é por capítulo, que a auditoria já sabe fatiar).
- Saída: achados no contrato atual, com disciplina `est`.
- Regra primeiro. Modelo só se a fase 1 deixar o fato ambíguo.
- Se o Truss tiver checagem testada, ela entra aqui como regra. Se não tiver aberto ainda, o bot nasce com um cruzamento só: resistência / seção citada no memorial estrutural contra o texto do carimbo e o texto pesquisável da prancha. Desenho vetorial fica para a fase 4.

Critério de pronto: um projeto real (o 117-25 ou o que o escritório indicar) devolve achado de estrutura com folha e página, e a corrida registra custo em `AiUsageEvent` menor que uma auditoria profunda do memorial inteiro.

### Fase 3 — orquestrador de verdade

- O `supervisor` deixa de ser rótulo: dada a classificação, ele monta o plano (quais bots, quais peças, o que está em cache).
- Teto por projeto, não só o teto mensal da casa. Plano que estoura não dispara a segunda disciplina; diz o que ficou de fora.
- `AuditLearning.scope` ganha disciplina. Correção repetida vira candidato a regra, com uma fila — o memorial já tem `scripts/fila-de-regras-contestadas.ts` como precedente.

Critério de pronto: soltar memorial + pranchas de duas disciplinas executa as duas, reexecutar no mesmo checksum não chama o modelo de novo, e o parecer diz a cobertura (o que não foi lido).

### Fase 4 — quantitativo e o desenho

- Classificador deixa de empurrar `orcamento` para o modo volume.
- Extrator de planilha (linha, unidade, quantidade) sem modelo, no mesmo espírito da grade de tabela do memorial.
- Cruzamento memorial × planilha na disciplina que já tem bot.
- Leitura geométrica da prancha só com o inventário do Truss na mão. Sem isso, não se escolhe biblioteca de CAD no escuro.

Critério de pronto: uma planilha real acusa item especificado no memorial e ausente na planilha, com a linha dos dois lados.

### Fora deste plano

Não entra agora: tela nova, bot para as duas dúzias de disciplinas de uma vez, DXF, treinar modelo, mudar de provedor. O léxico já lista as disciplinas; os bots nascem quando houver regra e amostra, não quando houver uma pasta vazia para cada sigla.

---

## 8. Por que `nexodoc-kappa.vercel.app` responde 503

Medido em 14/10/2026, contra a conta Vercel `theusinshows-projects` (`team_ffNsgkKpYXQdXR7eDiCM3G15`).

O endereço responde:

```text
HTTP/2 503
x-vercel-error: DEPLOYMENT_PAUSED
The deployment is currently unavailable
```

`/api/saude` devolve o mesmo 503. Não é o health check do Nexo (esse, quando o modelo ODT falta, também usa 503, mas com JSON `modelo ODT ausente`). Aqui a Vercel nem chega no app.

### O que está no ar, e o que está bloqueado

O alias `nexodoc-kappa.vercel.app` aponta para o deployment `dpl_Bf6E48oY1FAWTwrrRniYNpM43wXi`, commit `0feaf92e`, criado em 11/08/2026 às 14:49 (BRT). Estado na API: `READY`. Na borda: pausado. É o último production que chegou a `READY`.

O projeto é `lab-nexodoc` (`prj_ekaKLnoRzATJmYUV7AiiEdvysBLi`), framework Next.js, plano Hobby, `live: false`, Node `24.x`. Não existe `vercel.json` no repositório. Os domínios são só `*.vercel.app`. Proteção SSO ligada para tudo que não for domínio próprio (`all_except_custom_domains`).

Todo deployment de `main` desde então está `BLOCKED`, com log de build vazio — o build não começa. O primeiro é `dpl_5B3ThT5uXGiWEMU85VAodTrB5EDH`, commit `87c01338`, 11/08/2026 às 15:53 (BRT). O mais recente no momento desta leitura é `dpl_2VrTRfYxgiXKrHSJ4BEMaVAGxsBu`, commit `a5b49774` (o HEAD), 13/10/2026. O GitHub marca o status `Vercel` como failure, descrição `Deployment was blocked`. O status da Railway no mesmo commit está `Success` em `nexo-doc.com`.

### A causa

Não é erro de compilação, Node, Prisma nem `maxDuration`. O evento da conta, às 15:11 (BRT) de 11/08/2026 — 22 minutos depois do último deploy saudável e 42 minutos antes do primeiro bloqueado — é:

```text
tipo: project-paused
texto: You paused project lab-nexodoc using the REST API
reasonCode: PUBLIC_API
autor: theusinshow (matheusmendes077@gmail.com)
```

O projeto foi pausado pela API REST, com um token da própria conta. Projeto pausado deixa de servir (o alias cai em `DEPLOYMENT_PAUSED`) e a Vercel cria os deployments seguintes já em `BLOCKED`, sem build. O mesmo autor de commit (`Matheus <matheusmendes077@gmail.com>`, GitHub `theusinshow`) publicou o deploy das 14:49 e os bloqueados; não é o bloqueio de "autor do commit sem acesso", que também deixa o log vazio, mas aqui o evento de pausa está no meio da linha do tempo.

### O conserto

Despausar o projeto `lab-nexodoc` no painel da Vercel (o aviso de projeto pausado no topo do projeto) ou, com um token da conta:

```text
POST /v1/projects/prj_ekaKLnoRzATJmYUV7AiiEdvysBLi/unpause?teamId=team_ffNsgkKpYXQdXR7eDiCM3G15
```

O próximo push em `main` deixa de nascer `BLOCKED` e volta a buildar. Enquanto a pausa existir, redeploy repete o bloqueio.

Isso restaura o laboratório. Não restaura um host adequado para o Nexo, e o repositório já decidiu isso:

- nenhuma rota declara `maxDuration`; a auditoria profunda não cabe em função serverless (`docs/deploy.md`);
- LibreOffice, que gera o PDF, está no `Dockerfile`, e a Vercel não usa esse Dockerfile;
- os modelos ODT dependem de `outputFileTracingIncludes` no `next.config.ts`, lista que já falhou em produção uma vez;
- `DATABASE_URL` no projeto Vercel foi criada em 28/05/2026 e não foi editada desde então. A migração para a Railway foi em 03/10/2026. O valor que está lá é o banco de antes. Não foi lido aqui; a data basta para não apontar o lab destravado para a produção atual sem conferir a variável.

Depois de despausar, quem abrir `nexodoc-kappa.vercel.app` sem sessão da Vercel ainda esbarra no SSO (`all_except_custom_domains`). Hoje a pausa responde antes. Se o lab for público, a proteção sai; se for só para a conta, fica.

Produção segue em `nexo-doc.com` na Railway. Despausar a Vercel não é passo do roteiro das seções 6 e 7.
