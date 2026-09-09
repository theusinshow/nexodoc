/**
 * SEMEIA uma home de quem já usa o NexoDoc — só para OLHAR a disposição.
 *
 *   npm run semear:home            monta a cena
 *   npm run semear:home -- --limpar   desmonta
 *
 * A CENA CRESCEU EM 09/09/2026, e a razão é o teto.
 *
 * Ela tinha seis obras, e `LIMITE_PROJETOS` em [[lib/painel.ts]] é OITO. Uma
 * cena menor que o teto nunca mostra o que acontece quando ele bate: a lista
 * cortando, o "Ver todos os projetos do escritório" virando a única saída para
 * o nono, e a ordenação por atenção realmente ESCOLHENDO em vez de só listar.
 * Com catorze obras, quem olha a tela vê a decisão sendo tomada.
 *
 * OS CINCO ESTADOS de `resumoDoProjeto` cabem TODOS dentro do teto, e isso é
 * uma escolha da cena, não sorte. `ordemDaAtencao` põe quem tem achado SEU na
 * frente, e o resto ordena por recência: uma cena com oito obras cheias de
 * achado enche as oito vagas de `alerta` e `seu`, e os outros três estados
 * ficam invisíveis embaixo do corte. Então são QUATRO com achado recebido, e as
 * quatro vagas restantes vão para as obras mais recentes de cada outro estado:
 *
 *  · `alerta`   achado seu parado ≥ 5 dias — 41, 23 e 12 dias;
 *  · `seu`      achado seu de hoje;
 *  · `trabalho` auditoria em curso (agora) e volume montado (2 dias);
 *  · `outro`    só o que você mandou — dois nomes viram "2 pessoas" (1 dia);
 *  · `limpo`    auditada e sem pendência (3 dias).
 *
 * As outras oito obras existem para o teto TER o que cortar — elas são o que o
 * "Ver todos os projetos do escritório" passa a valer.
 *
 * E as VARIAÇÕES que só aparecem com a tela cheia: obra sem cidade (a marca
 * cinza), nome longo demais para a linha, obra sem nome nenhum (o cartão cai no
 * código), e uma com SETE achados — que é onde o cartão aberto para de caber na
 * dobra.
 *
 * Tudo com o prefixo SIM- para a limpeza não precisar adivinhar.
 */
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const { getPrisma } = await import("../lib/db.ts");
const prisma = getPrisma();

/*
 * DUAS CENAS, E A SEGUNDA EXISTE POR UM ACHADO DA PRIMEIRA.
 *
 * A cena CHEIA (padrão) mostrou que dois dos cinco chips são INALCANÇÁVEIS numa
 * conta movimentada. A ordenação do servidor em [[lib/painel.ts]] é
 * `diasParado → itens.length → recência`, e `diasParado` só conta achado
 * RECEBIDO — então toda obra com achado ENVIADO (`itens.length > 0`,
 * `diasParado === 0`) passa na frente de qualquer obra sem achado nenhum,
 * independente de quando se mexeu nela. Com onze obras com pendência e teto de
 * oito, "volume montado", "auditoria em curso" e "sem pendência" nunca chegam à
 * tela: quem só monta volume some da home no dia em que o escritório fica
 * ocupado, que é exatamente o dia em que ele mais usa o produto.
 *
 * `--calmo` cala as pendências de seis obras e abre as vagas do fim da lista.
 * É a cena de quem tem pouca coisa em aberto — e é a única em que dá para
 * OLHAR os três chips de baixo.
 */
const CALMO = process.argv.includes("--calmo");

/** As obras cuja pendência a cena calma não cria, para o fim da lista respirar. */
const CALADAS = new Set(["SIM117-25", "SIM058-26", "SIM040-26", "SIM088-25", "SIM084-25", "SIM052-26"]);

const ORG = "org-prosul";
const EU = (process.env.NEXODOC_ADMIN_EMAILS ?? "").split(",")[0].trim().toLowerCase();
const MARCA = "SIM-";

/*
 * O ESCRITÓRIO da cena. Eram dois nomes, e dois não bastam: com dois, o resumo
 * "N com <fulano>" nunca vira "N com 3 pessoas" — o ramo de contagem de
 * `resumoDoProjeto` ficava sem cena que o desenhasse.
 */
const VICTOR = "victor.almeida@prosul.com";
const CARLA = "carla.mendes@prosul.com";
const RENATA = "renata.brito@prosul.com";
const GUSTAVO = "gustavo.lima@prosul.com";

/*
 * NOME E SOBRENOME, e não só o primeiro nome.
 *
 * A cena tinha "Victor", "Carla" — e com um nome só, `iniciaisDe` devolve UMA
 * letra: a pilha de avatares do cartão virava `(G)(R)`, que não é iniciais, são
 * duas letras soltas. O escritório real tem nome completo no cadastro, e a cena
 * mentia sobre a forma do dado justamente onde a tela desenha o dado.
 */
const EQUIPE = [
  { email: VICTOR, nome: "Victor Almeida" },
  { email: CARLA, nome: "Carla Mendes" },
  { email: RENATA, nome: "Renata Brito" },
  { email: GUSTAVO, nome: "Gustavo Lima" },
];

const diasAtras = (d) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function limpar() {
  await prisma.projectEvent.deleteMany({ where: { title: { startsWith: MARCA } } });
  await prisma.nexoConversation.deleteMany({ where: { id: { startsWith: MARCA } } });
  await prisma.auditFeedback.deleteMany({ where: { targetKey: { startsWith: MARCA } } });
  await prisma.audit.deleteMany({ where: { title: { startsWith: MARCA } } });
  await prisma.documentArtifact.deleteMany({ where: { fileName: { startsWith: MARCA } } });
  await prisma.project.deleteMany({ where: { code: { startsWith: "SIM" } } });
}

await limpar();

if (process.argv.includes("--limpar")) {
  console.log("cena removida");
  await prisma.$disconnect();
  process.exit(0);
}

const eu = await prisma.user.findUnique({ where: { email: EU } });

/*
 * QUEM MANDA PRECISA SER `User`, E NÃO SÓ `OrganizationMember`.
 *
 * A cena antiga só criava o membro, e por isso TODA linha de achado recebido
 * dizia "de alguém" — [[lib/painel.ts]] resolve o REMETENTE por `assignedById`
 * → `prisma.user`, e o DESTINATÁRIO por `assigneeEmail` → `organizationMember`.
 * São duas tabelas para duas direções, e a cena só alimentava uma delas.
 *
 * `passwordHash` é obrigatório no schema e vai preenchido com lixo de
 * propósito: ninguém entra por estas contas — quem entra é o atalho de dev.
 */
const idPorEmail = new Map();
for (const { email, nome } of EQUIPE) {
  await prisma.organizationMember.upsert({
    where: { organizationId_email: { organizationId: ORG, email } },
    create: { organizationId: ORG, email, name: nome, role: "MEMBER", status: "ACTIVE" },
    update: { name: nome },
  });

  const usuario = await prisma.user.upsert({
    where: { email },
    create: { email, name: nome, passwordHash: "sem-senha-esta-conta-nao-entra" },
    update: { name: nome },
  });
  idPorEmail.set(email, usuario.id);
}

/*
 * AS CATORZE OBRAS.
 *
 * `dias` é quando se mexeu nela pela última vez — é o desempate da cauda da
 * lista, depois que os achados já decidiram o topo. As cidades são as cinco
 * prefeituras de Santa Catarina que o produto conhece, mais uma sem cadastro.
 */
const OBRAS = [
  { code: "SIM118-25", name: "Ginásio Municipal do Bairro Cristo Redentor", client: "CRICIÚMA", dias: 0 },
  { code: "SIM117-25", name: "Unidade Básica de Saúde da Rua São Francisco", client: "CRICIÚMA", dias: 7 },
  { code: "SIM113-25", name: "Ampliação da Escola Municipal Professora Idalina Vieira", client: "CRICIÚMA", dias: 1 },
  { code: "SIM101-25", name: "Drenagem e pavimentação do loteamento Bela Vista", client: "IÇARA", dias: 12 },
  { code: "SIM088-25", name: "Revitalização da Feira Municipal", client: "CHAPECÓ", dias: 6 },
  { code: "SIM084-25", name: "Centro de Educação Infantil do Bairro Nova Esperança", client: "CHAPECÓ", dias: 8 },
  { code: "SIM077-26", name: "Reforma e ampliação do Pronto Atendimento Municipal com anexo de imagem e laboratório de análises clínicas", client: "TUBARÃO", dias: 5 },
  { code: "SIM071-26", name: "Passarela sobre o Rio Sangão", client: "IÇARA", dias: 14 },
  { code: "SIM063-26", name: "Pavimentação da Avenida Centenário", client: "IÇARA", dias: 3 },
  { code: "SIM058-26", name: "Estação Elevatória de Esgoto do Setor 3", client: "TUBARÃO", dias: 9 },
  { code: "SIM052-26", name: "", client: "CHAPECÓ", dias: 22 },
  { code: "SIM047-26", name: "Quadra poliesportiva coberta do CAIC", client: "CRICIÚMA", dias: 30 },
  { code: "SIM040-26", name: "Reforma do Centro de Convivência", client: "", dias: 19 },
  { code: "SIM031-26", name: "Muro de contenção da Rua Anita Garibaldi", client: "TUBARÃO", dias: 45 },
];

const criadas = [];
for (const obra of OBRAS) {
  const projeto = await prisma.project.create({
    data: {
      organizationId: ORG,
      ownerEmail: EU,
      ownerId: eu?.id ?? null,
      code: obra.code,
      name: obra.name,
      client: obra.client,
      clientKey: obra.client.toLowerCase(),
      updatedAt: diasAtras(obra.dias),
    },
  });
  criadas.push({ ...obra, id: projeto.id });
}

/** Pela obra, e não pelo índice: com catorze, contar posição vira erro. */
const obra = (code) => criadas.find((o) => o.code === code);

/** Uma auditoria concluída por obra — é o que traz o projeto para a lista. */
async function auditar(projeto, achados, dias) {
  const criado = await prisma.audit.create({
    data: {
      projectId: projeto.id,
      userId: eu?.id ?? null,
      title: `${MARCA}${projeto.name || projeto.code}`,
      projectName: projeto.name || projeto.code,
      auditMode: "memorial",
      analysisLevel: dias > 7 ? "deep" : "standard",
      status: "COMPLETED",
      totalFindings: achados,
      elapsedMs: 180000 + dias * 1000,
      createdAt: diasAtras(dias),
      completedAt: diasAtras(dias),
    },
  });

  // O código viaja com a auditoria só para `pendencia` poder calar por obra na
  // cena calma. Não é campo do banco — é bilhete de ida.
  return Object.assign(criado, { __code: projeto.code });
}

async function pendencia(audit, { titulo, para, de, dias }) {
  if (CALMO && CALADAS.has(audit.__code)) return;

  await prisma.auditFeedback.create({
    data: {
      auditId: audit.id,
      targetKey: `${MARCA}finding:${Math.random().toString(36).slice(2, 8)}`,
      findingLabel: titulo,
      verdict: "CONFIRMED",
      assigneeEmail: para,
      // Era `de === EU ? eu.id : null`, e o `null` do ramo de fora era o
      // defeito: achado RECEBIDO nunca vem do EU, então nunca tinha remetente
      // com nome — a tela dizia "de alguém" em todas as linhas.
      assignedById: de === EU ? eu?.id ?? null : idPorEmail.get(de) ?? null,
      assignedAt: diasAtras(dias),
      createdAt: diasAtras(dias),
    },
  });
}

// ── `seu`: achado recebido e RECENTE, abaixo do limiar da tarja ────────────
// 118-25 — mexida hoje, um achado só. É este que abre sozinho quando nenhuma
// obra tem tarja; com as tarjas abaixo, ele fica fechado, e é essa disputa que
// a cena existe para mostrar.
const a118 = await auditar(obra("SIM118-25"), 6, 0);
await pendencia(a118, { titulo: "Cobertura metálica sem especificação de pintura", para: EU, de: VICTOR, dias: 0 });


// ── `alerta`: achado seu PARADO, três tempos bem separados ─────────────────
// 077-26 — SETE achados, e é ela que mostra até onde o cartão aberto cresce.
// Nome longo de propósito: cabeçalho e chip disputam a mesma linha.
const a077 = await auditar(obra("SIM077-26"), 63, 5);
for (const [i, titulo] of [
  "Memorial descreve piso vinílico; a planilha orça porcelanato",
  "Capítulo de instalações elétricas sem quadro de cargas",
  "Prancha ARQ-04 citada no texto não existe no volume",
  "Área construída do memorial (1.240 m²) não bate com a do carimbo (1.198 m²)",
  "Especificação de esquadria remete a catálogo de fabricante",
  "Sumário aponta o item 9 na página 41; ele começa na 47",
  "Cláusula de responsabilidade técnica em branco no template do escritório",
].entries()) {
  await pendencia(a077, { titulo, para: EU, de: i % 2 ? GUSTAVO : CARLA, dias: 6 + i });
}

// 047-26 — 23 dias, e ninguém mexeu nela há um mês
const a047 = await auditar(obra("SIM047-26"), 15, 30);
await pendencia(a047, { titulo: "Sem detalhamento da estrutura metálica da cobertura", para: EU, de: VICTOR, dias: 23 });
await pendencia(a047, { titulo: "Pé-direito divergente entre corte AA e memorial", para: EU, de: VICTOR, dias: 17 });

// 031-26 — 41 dias: o topo da lista, e o pior caso que a cena tem
const a031 = await auditar(obra("SIM031-26"), 8, 45);
await pendencia(a031, { titulo: "Memorial não cita a sondagem que embasa a contenção", para: EU, de: CARLA, dias: 41 });

// ── `outro`: só o que VOCÊ mandou ──────────────────────────────────────────
// 113-25 — DUAS pessoas, e é a única `outro` que cabe no teto (1 dia). O resumo
// troca os nomes pela contagem: "2 com 2 pessoas".
const a113 = await auditar(obra("SIM113-25"), 21, 1);
await pendencia(a113, { titulo: "Item 7.3 do memorial não tem correspondência na planilha", para: RENATA, de: EU, dias: 1 });
await pendencia(a113, { titulo: "Norma NBR 6118/2003 citada — revogada em 2014", para: GUSTAVO, de: EU, dias: 3 });

// 117-25 — uma pessoa só: o resumo diz o NOME dela ("2 com Carla")
const a117 = await auditar(obra("SIM117-25"), 30, 7);
await pendencia(a117, { titulo: "Divergência entre memorial e planilha no item 4.2", para: CARLA, de: EU, dias: 8 });
await pendencia(a117, { titulo: "Espessura de laje ausente no capítulo de estrutura", para: CARLA, de: EU, dias: 7 });

// 058-26 e 040-26 — abaixo do teto, e é isso que elas provam: a home CORTA.
const a058 = await auditar(obra("SIM058-26"), 9, 9);
await pendencia(a058, { titulo: "Cota de fundo da estação sem referência de nível", para: GUSTAVO, de: EU, dias: 12 });

// 040-26 é a obra SEM CIDADE — a marca cinza do cartão vive nela.
const a040 = await auditar(obra("SIM040-26"), 12, 19);
await pendencia(a040, { titulo: "Quantitativo de piso divergente", para: VICTOR, de: EU, dias: 19 });

// 088-25 — uma pessoa só: o resumo diz o NOME dela
const a088 = await auditar(obra("SIM088-25"), 18, 6);
await pendencia(a088, { titulo: "Rodapé da LD com a secretaria errada", para: VICTOR, de: EU, dias: 6 });
await pendencia(a088, { titulo: "Selo da prancha 12 sem data", para: VICTOR, de: EU, dias: 6 });

// 084-25 — TRÊS pessoas: o resumo troca o nome pela contagem ("3 com 3 pessoas")
const a084 = await auditar(obra("SIM084-25"), 27, 8);
await pendencia(a084, { titulo: "Endereço do selo não é o da prefeitura de destino", para: VICTOR, de: EU, dias: 8 });
await pendencia(a084, { titulo: "LD sem a folha de separação da disciplina HID", para: CARLA, de: EU, dias: 8 });
await pendencia(a084, { titulo: "Logo da prefeitura em resolução abaixo do mínimo", para: RENATA, de: EU, dias: 10 });

// 052-26 — SEM NOME cadastrado: o cartão cai no código, e o chip diz "1 com Gustavo"
const a052 = await auditar(obra("SIM052-26"), 4, 22);
await pendencia(a052, { titulo: "Numeração das folhas reinicia no meio do volume", para: GUSTAVO, de: EU, dias: 22 });

// ── `limpo`: auditada e sem nada pendente ──────────────────────────────────
// 063-26 tem 3 dias e por isso é a que aparece; 071-26 tem 14 e fica de fora.
await auditar(obra("SIM063-26"), 47, 3);
await auditar(obra("SIM071-26"), 33, 14);

/** As conversas: é delas que saem "onde você parou" e os projetos recentes. */
for (const [i, o] of criadas.entries()) {
  const quando = diasAtras(o.dias);
  await prisma.nexoConversation.create({
    data: {
      id: `${MARCA}conv-${i}`,
      userEmail: EU,
      title: i === 0 ? "Montagem do volume — MET" : o.name || o.code,
      projectId: o.id,
      folderKey: `${o.code}-${o.client || "SEM-CIDADE"}`,
      tipo: i % 2 === 0 ? "volume" : "auditoria",
      createdAt: quando,
      updatedAt: quando,
      data: {
        id: `${MARCA}conv-${i}`,
        title: o.name || o.code,
        createdAt: quando.getTime(),
        updatedAt: quando.getTime(),
        results: i === 0 ? [{ kind: "volume" }, { kind: "capa" }] : [{ kind: "auditoria" }],
      },
    },
  });
}

/*
 * A OBRA SÓ DE MONTAGEM, e a razão de esta cena existir: só se montou volume
 * nela.
 *
 * Sem auditoria e sem achado, ela não aparece em `AuditFeedback` nem em
 * `Audit` — as duas fontes que alimentavam a lista da esquerda. Ela vivia
 * exclusivamente na coluna "Trabalho recente", e foi ela que provou que as duas
 * listas da home não eram a mesma lista. Quem mexer nesta tela precisa dela na
 * frente para não apagá-la de novo. Chip: "volume montado".
 */
const soMontagem = await prisma.project.create({
  data: {
    organizationId: ORG, ownerEmail: EU, ownerId: eu?.id ?? null, code: "SIM099-26",
    name: "Praça da Juventude — só montagem", client: "TUBARÃO", clientKey: "tubarao",
    updatedAt: diasAtras(2),
  },
});
await prisma.nexoConversation.create({
  data: {
    id: `${MARCA}conv-volume`, userEmail: EU, title: "Montagem do volume — HID",
    projectId: soMontagem.id, folderKey: "SIM099-26-TUBARAO", tipo: "volume",
    createdAt: diasAtras(2), updatedAt: diasAtras(2),
    data: { id: `${MARCA}conv-volume`, title: "Montagem do volume — HID",
            createdAt: diasAtras(2).getTime(), updatedAt: diasAtras(2).getTime(),
            results: [{ kind: "volume" }] },
  },
});

/*
 * A OBRA COM AUDITORIA EM CURSO — o quinto chip, que nenhuma cena desenhava.
 *
 * `auditoriaPendente` é coluna da conversa, e não estado do `Audit`: a home lê
 * a conversa para saber que há trabalho rodando AGORA. Sem uma obra assim, o
 * ramo "auditoria em curso" de `resumoDoProjeto` só existia no código.
 */
const emCurso = await prisma.project.create({
  data: {
    organizationId: ORG, ownerEmail: EU, ownerId: eu?.id ?? null, code: "SIM104-26",
    name: "Readequação viária do acesso ao distrito industrial", client: "CHAPECÓ",
    clientKey: "chapeco", updatedAt: diasAtras(0),
  },
});
await prisma.nexoConversation.create({
  data: {
    id: `${MARCA}conv-em-curso`, userEmail: EU, title: "Auditoria do memorial — ARQ",
    projectId: emCurso.id, folderKey: "SIM104-26-CHAPECO", tipo: "auditoria",
    auditoriaPendente: true,
    createdAt: diasAtras(0), updatedAt: diasAtras(0),
    data: { id: `${MARCA}conv-em-curso`, title: "Auditoria do memorial — ARQ",
            createdAt: Date.now(), updatedAt: Date.now(), results: [] },
  },
});

/** Artefatos: o que a pessoa gerou e pode querer baixar de novo. */
const ARTEFATOS = [
  { code: "SIM118-25", kind: "VOLUME_PDF", nome: "volume" },
  { code: "SIM118-25", kind: "COVER_PDF", nome: "capa" },
  { code: "SIM117-25", kind: "VOLUME_PDF", nome: "volume" },
  { code: "SIM077-26", kind: "VOLUME_PDF", nome: "volume" },
  { code: "SIM077-26", kind: "LD_PDF", nome: "ld" },
  // `AUDIT_PDF` não está em `ROTULO_ARTEFATO`: cai no rótulo "Arquivo", que é
  // o estado que nenhuma cena mostrava. (`SEPARATRIZ_PDF`, que o mapa lista, não
  // existe no enum do schema — mapeamento morto.)
  { code: "SIM077-26", kind: "AUDIT_PDF", nome: "parecer" },
  { code: "SIM088-25", kind: "COVER_ZIP", nome: "capas" },
  { code: "SIM063-26", kind: "VOLUME_PDF", nome: "volume" },
  { code: "SIM047-26", kind: "LD_PDF", nome: "ld" },
];

for (const [i, art] of ARTEFATOS.entries()) {
  const alvo = obra(art.code);
  await prisma.documentArtifact.create({
    data: {
      projectId: alvo.id,
      userEmail: EU,
      module: "volume",
      kind: art.kind,
      fileName: `${MARCA}${art.code}-${art.nome}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 4_000_000 + i * 900_000,
      createdAt: diasAtras(alvo.dias),
    },
  });
}

/*
 * A ATIVIDADE DO ESCRITÓRIO — a linha do tempo que o widget lê.
 *
 * `ProjectEvent` é escrita pelo produto desde sempre (auditoria, volume, capa,
 * LD, upload) e não tinha consumidor até o widget de 09/09/2026. Sem estas
 * linhas a cena mostrava o widget com os eventos REAIS do banco de dev — três
 * linhas do mesmo projeto, do mesmo dia, da mesma pessoa. Não dava para julgar
 * a densidade nem a leitura de "quem fez o quê".
 *
 * QUATRO PESSOAS E VOCÊ, em minutos e horas diferentes: é o que faz aparecer a
 * distinção que o widget desenha — a sua linha em texto normal, as outras em
 * cinza. Com um ator só, a regra não tem o que separar.
 */
const horasAtras = (h) => new Date(Date.now() - h * 60 * 60 * 1000);

/*
 * O ÍNDICE INCLUI AS DUAS OBRAS DE FORA de `criadas` — a só-montagem e a
 * em-curso, criadas à parte porque não têm auditoria. Sem elas aqui, um evento
 * apontando para `SIM104-26` derrubava a cena com `undefined.id`, e o dado que
 * a atividade mais precisa mostrar (algo acontecendo AGORA) era justamente
 * nessas duas.
 */
const TODAS = [...criadas, { code: "SIM099-26", id: soMontagem.id }, { code: "SIM104-26", id: emCurso.id }];
const acha = (code) => TODAS.find((o) => o.code === code);

const EVENTOS = [
  { code: "SIM118-25", type: "VOLUME_GENERATED", quem: VICTOR, horas: 0.3 },
  { code: "SIM077-26", type: "AUDIT_COMPLETED", quem: EU, horas: 1 },
  { code: "SIM113-25", type: "LD_GENERATED", quem: CARLA, horas: 2.5 },
  { code: "SIM104-26", type: "AUDIT_CREATED", quem: RENATA, horas: 4 },
  { code: "SIM088-25", type: "COVER_GENERATED", quem: GUSTAVO, horas: 9 },
  { code: "SIM047-26", type: "INPUT_UPLOADED", quem: VICTOR, horas: 26 },
  { code: "SIM063-26", type: "AUDIT_COMPLETED", quem: EU, horas: 31 },
  { code: "SIM031-26", type: "PROJECT_CREATED", quem: CARLA, horas: 50 },
];

for (const ev of EVENTOS) {
  const alvo = acha(ev.code);
  const nome =
    ev.quem === EU
      ? eu?.name ?? "Você"
      : EQUIPE.find((p) => p.email === ev.quem)?.nome ?? ev.quem;

  await prisma.projectEvent.create({
    data: {
      projectId: alvo.id,
      actorId: ev.quem === EU ? eu?.id ?? null : idPorEmail.get(ev.quem) ?? null,
      actorEmail: ev.quem,
      actorName: nome,
      type: ev.type,
      // O prefixo é o que a limpeza procura — `title` é a única coluna de texto
      // livre do evento, e por isso é ela que carrega a marca da cena.
      title: `${MARCA}${ev.type}`,
      createdAt: horasAtras(ev.horas),
    },
  });
}

console.log(
  `cena ${CALMO ? "CALMA" : "CHEIA"} semeada: ${criadas.length + 2} obras ` +
    `(${criadas.length} auditadas/atribuídas + 1 só montagem + 1 em curso), ` +
    `${ARTEFATOS.length} artefatos, ${EVENTOS.length} eventos. ` +
    `A home mostra 8 dos 24 que o servidor manda.`,
);

if (!CALMO) {
  console.log("  Rode com --calmo para ver os chips de volume/auditoria/sem-pendência.");
}

await prisma.$disconnect();
