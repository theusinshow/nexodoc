/**
 * O TRABALHO RECENTE — "onde eu estava" e "em que projetos eu mexi".
 *
 * A home já respondia a primeira pergunta, mas só olhando AUDITORIAS
 * (`prisma.audit`) e projetos com achado pendente. Metade do produto ficava
 * invisível: quem passou o dia montando volumes não via nada, porque volume não
 * é auditoria nem gera achado. Não era desorganização da tela — era uma fonte
 * de dados que não cobria o trabalho.
 *
 * A UNIDADE É A PASTA, e não a conversa. `088-25-CRICIUMA` é como o escritório
 * chama o projeto (código do contrato + município), e é a chave que o Nexo já
 * deriva do carimbo. Listar conversas soltas devolveria a mesma confusão da
 * barra lateral, onde quatro linhas "MET" são o mesmo volume.
 *
 * BARATO POR CONSTRUÇÃO: tudo aqui sai das SETE COLUNAS de fora da conversa
 * (`id`, `title`, `folderKey`, `tipo`, `updatedAt`, `auditoriaPendente`). O
 * `data` JSON — onde vivem os artefatos — não é aberto. É a mesma regra que a
 * barra lateral segue, e pelo mesmo motivo: "puxar `data` de cem conversas para
 * desenhar a tela seria arrastar megabytes por nada".
 *
 * PURO e sem imports → roda em node cru (`npm run test:trabalho-recente`).
 */

/** Uma conversa, como as sete colunas a entregam. */
export interface ConversaCrua {
  id: string;
  title: string;
  folderKey: string | null;
  tipo: string | null;
  /** Epoch em ms. */
  updatedAt: number;
  auditoriaPendente?: boolean;
  /** `063-26`, do projeto vinculado. Vazio na conversa legada, sem vínculo. */
  projectCode?: string;
  /** `CRICIÚMA`, do projeto vinculado. Vazio na conversa legada, sem vínculo. */
  projectClient?: string;
}

export interface ProjetoRecente {
  /** A pasta como está gravada; `""` para o trabalho sem pasta. */
  chave: string;
  /** `088-25` — o contrato. Vazio quando a pasta não segue a convenção. */
  codigo: string;
  /** `CRICIUMA` — o município. Vazio quando não dá para separar. */
  cliente: string;
  /** Quando a pasta foi tocada pela última vez. */
  atualizadoEm: number;
  conversas: number;
  volumes: number;
  auditorias: number;
  /** Há análise rodando em alguma conversa desta pasta. */
  emCurso: boolean;
  /** A conversa mais recente da pasta — é para ela que o botão leva. */
  ultima: { id: string; title: string; tipo: string | null };
}

/**
 * Separa `088-25-CRICIUMA` em contrato e município.
 *
 * O código do escritório é `NNN-NN`; o que vem depois do segundo hífen é o
 * município, que pode ter hífen no nome (`SAO-JOSE`). Por isso a expressão
 * ancora no CÓDIGO e leva todo o resto como cliente, em vez de partir no
 * primeiro separador que aparecer.
 *
 * Pasta fora da convenção devolve os dois campos vazios, e a tela mostra a
 * chave crua — inventar uma separação errada seria pior que não separar.
 *
 * DEGRAU DE TRÁS desde 01/09/2026. Com `NexoConversation.projectId`, o código e
 * o cliente vêm do `Project` — que é editável em /projetos e não depende de a
 * pasta ter sido nomeada certo. Esta função atende a conversa LEGADA, que tem
 * pasta e não tem vínculo, e é só para isso que ela continua aqui.
 */
export function partesDaPasta(chave: string): { codigo: string; cliente: string } {
  const m = /^(\d{2,4}-\d{2})-(.+)$/.exec(chave.trim());
  if (!m) return { codigo: "", cliente: "" };
  return { codigo: m[1], cliente: m[2].replace(/[-_]+/g, " ").trim() };
}

/**
 * A conversa em que a pessoa estava — a mais recente, e só.
 *
 * `null` quando não há nenhuma: a tela mostra o primeiro passo em vez de uma
 * régua vazia.
 */
export function ondeParou(conversas: readonly ConversaCrua[]): ConversaCrua | null {
  let melhor: ConversaCrua | null = null;
  for (const c of conversas) {
    if (!melhor || c.updatedAt > melhor.updatedAt) melhor = c;
  }
  return melhor;
}

/**
 * Os projetos em que se mexeu, do mais recente para o mais antigo.
 *
 * RECÊNCIA, e não "mais parados primeiro". A outra seção da home cobra o que
 * está esquecido, e é o critério certo LÁ; aqui a pergunta é "onde eu estava",
 * e ordenar por abandono responderia o contrário do que se perguntou.
 */
export function projetosRecentes(
  conversas: readonly ConversaCrua[],
  opcoes: { limite?: number } = {},
): ProjetoRecente[] {
  const porPasta = new Map<string, ProjetoRecente>();

  for (const c of conversas) {
    const chave = (c.folderKey ?? "").trim();
    const atual = porPasta.get(chave);

    if (!atual) {
      /*
       * O PROJETO VINCULADO VENCE A STRING DA PASTA.
       *
       * `partesDaPasta` quebra "084-25-CRICIUMA" em código e cliente, e era o
       * único caminho antes de a conversa ter `projectId`. Manter os dois como
       * iguais daria à home DUAS fontes para a mesma cidade, e elas
       * discordariam no primeiro projeto renomeado em /projetos.
       *
       * A string continua valendo como DEGRAU DE TRÁS: conversa legada não tem
       * vínculo, e o nome dela ainda mora na pasta. Mesmo arranjo de
       * `enderecoDa` em [[modules/nexo/lib/cartoes-de-projeto.ts]].
       */
      const daPasta = partesDaPasta(chave);
      const codigo = c.projectCode || daPasta.codigo;
      const cliente = c.projectClient || daPasta.cliente;
      porPasta.set(chave, {
        chave,
        codigo,
        cliente,
        atualizadoEm: c.updatedAt,
        conversas: 1,
        volumes: c.tipo === "volume" ? 1 : 0,
        auditorias: c.tipo === "auditoria" ? 1 : 0,
        emCurso: Boolean(c.auditoriaPendente),
        ultima: { id: c.id, title: c.title, tipo: c.tipo },
      });
      continue;
    }

    atual.conversas += 1;
    if (c.tipo === "volume") atual.volumes += 1;
    if (c.tipo === "auditoria") atual.auditorias += 1;
    if (c.auditoriaPendente) atual.emCurso = true;
    if (c.updatedAt > atual.atualizadoEm) {
      atual.atualizadoEm = c.updatedAt;
      atual.ultima = { id: c.id, title: c.title, tipo: c.tipo };
    }
  }

  const lista = [...porPasta.values()].sort((a, b) => b.atualizadoEm - a.atualizadoEm);

  /*
   * SEM PASTA VAI PARA O FIM, sempre — mesmo sendo o mais recente.
   *
   * É onde caem as conversas que ainda não têm identidade de projeto (o carimbo
   * não foi lido, ou nem houve anexo). Elas são as MAIS numerosas e as menos
   * informativas: no topo, empurrariam para baixo justamente o projeto que a
   * pessoa reconheceria.
   */
  const comPasta = lista.filter((p) => p.chave !== "");
  const semPasta = lista.filter((p) => p.chave === "");
  const ordenada = [...comPasta, ...semPasta];

  return opcoes.limite ? ordenada.slice(0, opcoes.limite) : ordenada;
}
