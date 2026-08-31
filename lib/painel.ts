/**
 * O PAINEL — o que a pessoa vê ao entrar.
 *
 * É a consulta que a home nova pede, e ela é diferente da de [[fila-de-achados]]
 * por uma razão de desenho: aquela responde "o que exige ação SUA", e esta
 * responde "onde você está trabalhando". Um projeto sem pendência nenhuma
 * aparece aqui — porque continuar um trabalho é o gesto mais comum de quem
 * abre a ferramenta de manhã, e ele não começa por uma pendência.
 *
 * TRÊS FONTES, UM PROJETO SÓ NA TELA:
 *
 *  · o que MANDARAM para você — `assigneeEmail = você`, em aberto;
 *  · o que VOCÊ mandou — `assignedById = você`, em aberto, para outra pessoa.
 *    A fila da home não mostra isto de propósito ("a home é o que pede trabalho
 *    de você"), e aqui mostra porque o cartão é do PROJETO, não seu: quem olha
 *    o 063-26 precisa saber que dois achados dele estão com o Victor;
 *  · o que você AUDITOU — traz o projeto para a lista mesmo sem achado aberto.
 *
 * TUDO É CONSULTA. Não há tabela de "projeto aberto" para sair de sincronia:
 * o projeto entra na lista enquanto houver pendência ou auditoria recente, e
 * sai sozinho quando não houver mais.
 */
import { getPrisma } from "@/lib/db";
import {
  ondeParou,
  projetosRecentes,
  type ConversaCrua,
  type ProjetoRecente,
} from "./trabalho-recente";

/** Um achado em aberto, visto do projeto. */
export type ItemDoPainel = {
  auditId: string;
  /** O título do achado. Nulo em pendência gravada antes de o rótulo existir. */
  titulo: string;
  /**
   * A DIREÇÃO, e não só o nome. "recebido" é trabalho seu; "enviado" é espera.
   * A tela pinta os dois de forma diferente, e sem isto ela não teria como.
   */
  direcao: "recebido" | "enviado";
  /** Quem mandou (recebido) ou para quem foi (enviado). */
  pessoa: string;
  /** Dias inteiros desde o envio. É o que decide a tarja de esquecimento. */
  dias: number;
};

export type ArtefatoDoPainel = {
  rotulo: string;
  quando: string;
  artifactId: string;
};

export type ProjetoDoPainel = {
  projectId: string;
  codigo: string;
  nome: string;
  /** Achados em aberto, os mais parados primeiro. */
  itens: ItemDoPainel[];
  artefatos: ArtefatoDoPainel[];
  /** O maior tempo parado entre os itens. Zero quando não há pendência. */
  diasParado: number;
};

export type RecenteDoPainel = {
  auditId: string;
  nome: string;
  quando: string;
};

export type Painel = {
  projetos: ProjetoDoPainel[];
  recentes: RecenteDoPainel[];
  /**
   * O TRABALHO DO NEXO — volumes e auditorias, agrupados por pasta.
   *
   * Esta tela só enxergava `Audit` e projetos com achado pendente. Quem passou o
   * dia montando VOLUME não via nada aqui, porque volume não é auditoria nem
   * gera achado — metade do produto ficava invisível na primeira tela.
   *
   * Sai das SETE COLUNAS de fora da conversa; o `data` JSON não é aberto. Ver
   * [[lib/trabalho-recente.ts]].
   */
  trabalho: {
    ondeParou: ConversaCrua | null;
    projetos: ProjetoRecente[];
  };
};

const LIMITE_PROJETOS = 8;
const LIMITE_RECENTES = 4;
/**
 * Quantos PROJETOS a home lista. Seis cabem sem rolagem na primeira dobra, e a
 * pergunta que a seção responde ("onde eu estava") tem resposta curta: quem
 * precisa do sétimo está procurando, e para procurar existe a barra lateral.
 */
const LIMITE_PROJETOS_RECENTES = 6;
const LIMITE_ARTEFATOS = 3;

/** Rótulo curto do artefato. O `kind` do banco é gritado e técnico demais. */
const ROTULO_ARTEFATO: Record<string, string> = {
  COVER_PDF: "Capa",
  COVER_ODT: "Capa",
  COVER_ZIP: "Capas",
  VOLUME_PDF: "Volume",
  LD_PDF: "LD",
  SEPARATRIZ_PDF: "Separatriz",
  OTHER: "Arquivo",
};

export async function painelDe(args: {
  email: string;
  userId: string | null;
  organizationId: string;
  agora?: Date;
}): Promise<Painel> {
  const prisma = getPrisma();
  const agora = args.agora ?? new Date();

  /*
   * UMA consulta para os dois sentidos, e não duas.
   *
   * O `OR` cobre recebido e enviado; separar em duas chamadas traria a mesma
   * linha duas vezes quando alguém atribui um achado a si mesmo, e a tela
   * mostraria o item repetido dentro do mesmo projeto.
   */
  const pendencias = await prisma.auditFeedback.findMany({
    where: {
      resolvedAt: null,
      assignedAt: { not: null },
      audit: { project: { organizationId: args.organizationId } },
      OR: [
        { assigneeEmail: args.email },
        ...(args.userId ? [{ assignedById: args.userId }] : []),
      ],
    },
    select: {
      auditId: true,
      findingLabel: true,
      targetKey: true,
      assigneeEmail: true,
      assignedById: true,
      assignedAt: true,
      audit: {
        select: {
          id: true,
          projectId: true,
          project: { select: { id: true, code: true, name: true, client: true } },
        },
      },
    },
    orderBy: { assignedAt: "asc" },
  });

  /*
   * Os nomes saem numa consulta só, e não uma por linha — cinco achados do
   * mesmo remetente seriam cinco idas ao banco pelo mesmo nome. Mesmo cuidado
   * que [[fila-de-achados]] já tomava.
   */
  const idsDeQuemEnviou = [
    ...new Set(pendencias.map((p) => p.assignedById).filter((v): v is string => Boolean(v))),
  ];
  const emailsDeQuemRecebeu = [
    ...new Set(pendencias.map((p) => p.assigneeEmail).filter((v): v is string => Boolean(v))),
  ];

  const [remetentes, destinatarios] = await Promise.all([
    idsDeQuemEnviou.length
      ? prisma.user.findMany({
          where: { id: { in: idsDeQuemEnviou } },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
    emailsDeQuemRecebeu.length
      ? prisma.organizationMember.findMany({
          where: { organizationId: args.organizationId, email: { in: emailsDeQuemRecebeu } },
          select: { email: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  const nomePorId = new Map(remetentes.map((u) => [u.id, u.name || u.email]));
  const nomePorEmail = new Map(destinatarios.map((m) => [m.email, m.name || m.email]));

  const porProjeto = new Map<string, ProjetoDoPainel>();

  for (const linha of pendencias) {
    const projeto = linha.audit.project;

    /*
     * Pendência de auditoria sem projeto não deveria existir — `atribuirAchados`
     * recusa — mas parecer legado pode ter passado antes dessa regra. Ela é
     * pulada em vez de virar um cartão sem código, que ninguém saberia abrir.
     */
    if (!projeto) continue;

    const direcao: ItemDoPainel["direcao"] =
      linha.assigneeEmail === args.email ? "recebido" : "enviado";

    const pessoa =
      direcao === "recebido"
        ? (linha.assignedById ? nomePorId.get(linha.assignedById) : null) ?? "alguém"
        : (linha.assigneeEmail ? nomePorEmail.get(linha.assigneeEmail) : null) ??
          linha.assigneeEmail ??
          "alguém";

    const dias = diasInteiros(linha.assignedAt, agora);

    const atual = porProjeto.get(projeto.id) ?? {
      projectId: projeto.id,
      codigo: projeto.code,
      nome: projeto.name || projeto.client || projeto.code,
      itens: [],
      artefatos: [],
      diasParado: 0,
    };

    atual.itens.push({
      auditId: linha.auditId,
      // Sem rótulo gravado, o `targetKey` (`finding:INC-014`) é o que sobra —
      // feio, mas localizável. Melhor que uma linha sem texto nenhum.
      titulo: linha.findingLabel?.trim() || linha.targetKey,
      direcao,
      pessoa,
      dias,
    });

    // Só o que ESPERA por você conta para a tarja. Achado que está com outra
    // pessoa parado há duas semanas é cobrança, não esquecimento seu.
    if (direcao === "recebido") {
      atual.diasParado = Math.max(atual.diasParado, dias);
    }

    porProjeto.set(projeto.id, atual);
  }

  /*
   * As auditorias recentes servem a DUAS coisas na tela: a lista "Onde você
   * parou" e a entrada dos projetos sem pendência. Uma consulta, dois usos.
   */
  const auditorias = args.userId
    ? await prisma.audit.findMany({
        where: {
          userId: args.userId,
          project: { organizationId: args.organizationId },
        },
        select: {
          id: true,
          title: true,
          createdAt: true,
          project: { select: { id: true, code: true, name: true, client: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];

  for (const auditoria of auditorias) {
    const projeto = auditoria.project;
    if (!projeto || porProjeto.has(projeto.id)) continue;
    if (porProjeto.size >= LIMITE_PROJETOS) break;

    porProjeto.set(projeto.id, {
      projectId: projeto.id,
      codigo: projeto.code,
      nome: projeto.name || projeto.client || projeto.code,
      itens: [],
      artefatos: [],
      diasParado: 0,
    });
  }

  const projetos = [...porProjeto.values()]
    /*
     * MAIS PARADOS PRIMEIRO — a ordem que o cabeçalho da tela anuncia. Empate
     * cai na quantidade de pendências, e depois no código, para a lista não
     * dançar entre dois carregamentos quando tudo está com zero dia.
     */
    .sort(
      (a, b) =>
        b.diasParado - a.diasParado ||
        b.itens.length - a.itens.length ||
        a.codigo.localeCompare(b.codigo),
    )
    .slice(0, LIMITE_PROJETOS);

  for (const projeto of projetos) {
    projeto.itens.sort((a, b) => b.dias - a.dias);
  }

  const artefatos = projetos.length
    ? await prisma.documentArtifact.findMany({
        where: { projectId: { in: projetos.map((p) => p.projectId) }, status: "AVAILABLE" },
        select: { id: true, projectId: true, kind: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: projetos.length * LIMITE_ARTEFATOS,
      })
    : [];

  for (const artefato of artefatos) {
    const projeto = projetos.find((p) => p.projectId === artefato.projectId);
    if (!projeto || projeto.artefatos.length >= LIMITE_ARTEFATOS) continue;

    projeto.artefatos.push({
      artifactId: artefato.id,
      rotulo: ROTULO_ARTEFATO[artefato.kind] ?? "Arquivo",
      quando: haQuantoTempo(artefato.createdAt, agora),
    });
  }

  /*
   * O TRABALHO DO NEXO, na mesma chamada.
   *
   * `select` das SETE colunas de fora: o `data` de cada conversa carrega os
   * artefatos e pesa megabytes, e abri-lo para desenhar a primeira tela é
   * exatamente o custo que a lista da barra lateral evita. `take` alto porque o
   * agrupamento é por PASTA — cortar antes de agrupar esconderia um projeto
   * inteiro atrás de conversas de outro.
   */
  const conversas = await prisma.nexoConversation.findMany({
    where: { userEmail: args.email },
    select: {
      id: true,
      title: true,
      folderKey: true,
      tipo: true,
      updatedAt: true,
      auditoriaPendente: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });

  const cruas: ConversaCrua[] = conversas.map((c) => ({
    id: c.id,
    title: c.title,
    folderKey: c.folderKey,
    tipo: c.tipo,
    updatedAt: c.updatedAt.getTime(),
    auditoriaPendente: c.auditoriaPendente,
  }));

  return {
    projetos,
    trabalho: {
      ondeParou: ondeParou(cruas),
      projetos: projetosRecentes(cruas, { limite: LIMITE_PROJETOS_RECENTES }),
    },
    recentes: auditorias.slice(0, LIMITE_RECENTES).map((a) => ({
      auditId: a.id,
      nome: a.project?.code ? `${a.project.code} · ${a.title}` : a.title,
      quando: haQuantoTempo(a.createdAt, agora),
    })),
  };
}

/**
 * Dias INTEIROS, e não arredondados: às 23h de segunda, um achado enviado na
 * manhã de segunda tem zero dia, e não um. A tarja de esquecimento conta dias
 * vividos, que é o que a pessoa também conta.
 */
function diasInteiros(quando: Date | null, agora: Date) {
  if (!quando) return 0;
  return Math.max(0, Math.floor((agora.getTime() - quando.getTime()) / 86_400_000));
}

function haQuantoTempo(quando: Date, agora: Date) {
  const minutos = Math.max(0, Math.floor((agora.getTime() - quando.getTime()) / 60_000));

  if (minutos < 60) return "agora";
  if (minutos < 1440) return `há ${Math.floor(minutos / 60)} h`;

  const dias = Math.floor(minutos / 1440);
  if (dias === 1) return "ontem";
  if (dias < 7) return `${dias} dias`;

  const semanas = Math.floor(dias / 7);
  return semanas === 1 ? "1 sem" : `${semanas} sem`;
}
