/**
 * O EXPURGO — a execução. A decisão mora em [[lib/expurgo.ts]], pura.
 *
 * Aqui é onde se apaga de verdade, e por isso este arquivo tem uma obrigação
 * que o outro não tem: **contar antes**. A prévia não estima, consulta — a mesma
 * resolução de alcance que a execução vai usar, rodada contra o mesmo banco. Uma
 * prévia derivada de outro caminho seria pior que nenhuma: daria confiança
 * calibrada num número que não é o que vai acontecer.
 *
 * O QUE FICA, e a tela diz que fica: `AiUsageEvent` (o histórico de gasto),
 * `ProjectEvent`, o `Project`, contas e configuração. Consequência assumida: o
 * custo por obra passa a listar essas obras como "conversa removida" —
 * `lib/custo-por-obra.ts` já trata esse caso de propósito ("ausência é fato, não
 * sujeira a esconder"), então não há código novo, mas há mudança visível.
 */
import {
  auditoriasDasConversas,
  chaveDaObra,
  checksumsOrfaos,
  conversasDoAlcance,
  SEM_OBRA,
  type Alcance,
  type ConversaParaExpurgo,
} from "@/lib/expurgo";
import { getPrisma } from "@/lib/db";

/** O que a tela de Dados lista, agrupado por obra. */
export interface ConversaListada extends ConversaParaExpurgo {
  userEmail: string;
  title: string;
  tipo: string | null;
  atualizadaEm: string;
  /** A obra a que ela pertence, já resolvida. */
  obra: string;
}

export interface PreviaDoExpurgo {
  conversas: number;
  auditorias: number;
  achados: number;
  mensagensDeAchado: number;
  lds: number;
  artefatos: number;
  arquivos: number;
  bytes: number;
  /** Quantas pessoas receberão lápide — é quantas máquinas vão obedecer. */
  donos: number;
  /** O que NÃO vai embora, para a gaveta poder dizer. */
  preservado: { eventosDeConsumo: number; custoUsd: number };
}

interface AlvoResolvido {
  conversaIds: string[];
  auditIds: string[];
  ldIds: string[];
  donos: Set<string>;
}

/**
 * Todas as conversas do servidor, com a obra já resolvida.
 *
 * Lê SÓ as colunas de fora — nunca o `data`, que é o JSON inteiro de cada
 * conversa. A rota da lista da barra lateral já segue essa regra pelo mesmo
 * motivo, e aqui ele é mais forte: esta tela mostra TODAS as conversas de TODOS
 * os donos, e puxar o JSON de cada uma arrastaria dezenas de megabytes para
 * desenhar uma lista.
 */
export async function listarConversas(): Promise<ConversaListada[]> {
  const linhas = await getPrisma().nexoConversation.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      userEmail: true,
      title: true,
      projectId: true,
      folderKey: true,
      tipo: true,
      updatedAt: true,
    },
  });

  return linhas.map((linha) => ({
    id: linha.id,
    userEmail: linha.userEmail,
    title: linha.title,
    projectId: linha.projectId,
    folderKey: linha.folderKey,
    tipo: linha.tipo,
    atualizadaEm: linha.updatedAt.toISOString(),
    obra: chaveDaObra(linha),
  }));
}

/**
 * Do alcance para os ids concretos.
 *
 * AQUI MORA UMA ASSIMETRIA DELIBERADA: LDs entram por `obra` e por `tudo`, e
 * não por `selecao`. A LD se liga ao `Project`, não à conversa — não existe
 * `LdDraft.conversationId` —, então "as LDs desta seleção de conversas" é uma
 * pergunta que o schema não responde. Inventar uma resposta (pegar as LDs de
 * qualquer projeto tocado pelas conversas selecionadas) apagaria LD que a
 * pessoa não escolheu. A prévia mostra zero, e zero é verdade.
 */
async function resolverAlvo(alcance: Alcance): Promise<AlvoResolvido> {
  const prisma = getPrisma();

  const conversas = await prisma.nexoConversation.findMany({
    select: { id: true, projectId: true, folderKey: true, userEmail: true },
  });

  const conversaIds = conversasDoAlcance(conversas, alcance);
  const escolhidas = new Set(conversaIds);
  const donos = new Set(
    conversas.filter((conversa) => escolhidas.has(conversa.id)).map((c) => c.userEmail),
  );

  /*
   * O `data` só é lido das conversas ESCOLHIDAS, e só para achar os `auditId`
   * lá dentro. É a única leitura de JSON deste módulo, e é inevitável: o elo
   * conversa→auditoria não existe em coluna nenhuma do schema.
   */
  const dados = conversaIds.length
    ? await prisma.nexoConversation.findMany({
        where: { id: { in: conversaIds } },
        select: { data: true },
      })
    : [];

  const auditIds = new Set(auditoriasDasConversas(dados.map((linha) => linha.data)));
  const ldIds = new Set<string>();

  if (alcance.tipo === "tudo") {
    for (const { id } of await prisma.audit.findMany({ select: { id: true } })) auditIds.add(id);
    for (const { id } of await prisma.ldDraft.findMany({ select: { id: true } })) ldIds.add(id);
  } else if (alcance.tipo === "obra" && alcance.chave !== SEM_OBRA) {
    /*
     * A chave da obra é um `projectId` quando a conversa foi endereçada. Quando
     * é `folderKey` de conversa antiga, não há projeto para consultar — e aí só
     * entram as auditorias que a própria conversa registrou. Melhor alcançar de
     * menos que apagar a auditoria de um projeto vizinho por causa de uma
     * string derivada no navegador.
     */
    for (const { id } of await prisma.audit.findMany({
      where: { projectId: alcance.chave },
      select: { id: true },
    })) {
      auditIds.add(id);
    }
    for (const { id } of await prisma.ldDraft.findMany({
      where: { projectId: alcance.chave },
      select: { id: true },
    })) {
      ldIds.add(id);
    }
  }

  /*
   * Auditoria citada por conversa mas ausente do banco é descartada aqui: ela
   * ficaria contando na prévia um número que o `deleteMany` não entregaria.
   */
  const existentes = auditIds.size
    ? await prisma.audit.findMany({
        where: { id: { in: [...auditIds] } },
        select: { id: true },
      })
    : [];

  return {
    conversaIds,
    auditIds: existentes.map((a) => a.id),
    ldIds: [...ldIds],
    donos,
  };
}

/** Os checksums que estas auditorias e LDs seguram, e ninguém mais. */
async function arquivosQueMorrem(alvo: AlvoResolvido) {
  const prisma = getPrisma();

  const candidatos = new Set<string>();

  if (alvo.auditIds.length) {
    for (const linha of await prisma.auditFile.findMany({
      where: { auditId: { in: alvo.auditIds }, checksumSha256: { not: null } },
      select: { checksumSha256: true },
    })) {
      if (linha.checksumSha256) candidatos.add(linha.checksumSha256);
    }
  }

  if (!candidatos.size) return { checksums: [] as string[], bytes: 0 };

  const lista = [...candidatos];

  /*
   * QUEM AINDA APONTA, depois de tirar o que vai morrer. As quatro tabelas que
   * referenciam `StoredFile` por checksum são consultadas — esquecer uma
   * apagaria bytes que ela ainda usa, e o sintoma apareceria semanas depois num
   * "arquivo não encontrado" que ninguém liga a este expurgo.
   */
  const [deAuditoria, deUpload, deDocumento, deArtefato] = await Promise.all([
    prisma.auditFile.findMany({
      where: { checksumSha256: { in: lista }, auditId: { notIn: alvo.auditIds } },
      select: { checksumSha256: true },
    }),
    prisma.projectUpload.findMany({
      where: { checksumSha256: { in: lista } },
      select: { checksumSha256: true },
    }),
    prisma.projectDocument.findMany({
      where: { checksumSha256: { in: lista } },
      select: { checksumSha256: true },
    }),
    prisma.documentArtifact.findMany({
      where: {
        checksumSha256: { in: lista },
        NOT: [{ auditId: { in: alvo.auditIds } }, { ldDraftId: { in: alvo.ldIds } }],
      },
      select: { checksumSha256: true },
    }),
  ]);

  const vivos = [...deAuditoria, ...deUpload, ...deDocumento, ...deArtefato]
    .map((linha) => linha.checksumSha256)
    .filter((valor): valor is string => Boolean(valor));

  const orfaos = checksumsOrfaos(lista, vivos);

  if (!orfaos.length) return { checksums: [], bytes: 0 };

  const tamanhos = await prisma.storedFile.findMany({
    where: { checksumSha256: { in: orfaos } },
    select: { checksumSha256: true, sizeBytes: true },
  });

  return {
    checksums: tamanhos.map((linha) => linha.checksumSha256),
    bytes: tamanhos.reduce((soma, linha) => soma + linha.sizeBytes, 0),
  };
}

export async function previaDoExpurgo(alcance: Alcance): Promise<PreviaDoExpurgo> {
  const prisma = getPrisma();
  const alvo = await resolverAlvo(alcance);
  const arquivos = await arquivosQueMorrem(alvo);

  const [achados, mensagens, artefatos, consumo] = await Promise.all([
    alvo.auditIds.length
      ? prisma.auditFeedback.count({ where: { auditId: { in: alvo.auditIds } } })
      : 0,
    alvo.auditIds.length
      ? prisma.auditFindingMessage.count({
          where: { feedback: { auditId: { in: alvo.auditIds } } },
        })
      : 0,
    prisma.documentArtifact.count({
      where: {
        OR: [{ auditId: { in: alvo.auditIds } }, { ldDraftId: { in: alvo.ldIds } }],
      },
    }),
    /*
     * O QUE FICA. A gaveta mostra este número junto do resto, e não escondido:
     * preservar o consumo é uma decisão, e uma decisão que o operador precisa
     * ver para não procurar depois por um gasto que ele acha que apagou.
     */
    alvo.conversaIds.length
      ? prisma.aiUsageEvent.aggregate({
          _sum: { estimatedCostUsd: true },
          _count: true,
          where: { conversationId: { in: alvo.conversaIds } },
        })
      : null,
  ]);

  return {
    conversas: alvo.conversaIds.length,
    auditorias: alvo.auditIds.length,
    achados,
    mensagensDeAchado: mensagens,
    lds: alvo.ldIds.length,
    artefatos,
    arquivos: arquivos.checksums.length,
    bytes: arquivos.bytes,
    donos: alvo.donos.size,
    preservado: {
      eventosDeConsumo: consumo?._count ?? 0,
      custoUsd: consumo?._sum.estimatedCostUsd ?? 0,
    },
  };
}

/**
 * Apaga, e grava a lápide.
 *
 * A ORDEM É PARTE DA REGRA:
 *
 * 1. as lápides ANTES de apagar as conversas. Se o processo morrer no meio, o
 *    pior caso é lápide para conversa que ainda existe no servidor — e aí a
 *    máquina apaga a cópia local de algo que o servidor ainda tem, que é
 *    recuperável. Na ordem inversa, o pior caso é conversa apagada sem lápide:
 *    a máquina que a tem re-sobe na próxima edição, e o expurgo se desfaz
 *    sozinho, em silêncio;
 * 2. as auditorias e LDs antes dos bytes, porque os órfãos só se conhecem
 *    depois que quem os segurava saiu;
 * 3. o `StoredFile` por último, e só o que ficou sem referência.
 */
export async function executarExpurgo(alcance: Alcance, quem: string) {
  const prisma = getPrisma();
  const alvo = await resolverAlvo(alcance);
  const previa = await previaDoExpurgo(alcance);
  const arquivos = await arquivosQueMorrem(alvo);

  if (alvo.conversaIds.length) {
    const conversas = await prisma.nexoConversation.findMany({
      where: { id: { in: alvo.conversaIds } },
      select: { id: true, userEmail: true },
    });

    await prisma.conversaExpurgada.createMany({
      data: conversas.map((conversa) => ({
        id: conversa.id,
        userEmail: conversa.userEmail,
        expurgadaPor: quem,
      })),
      // Expurgar de novo o que já tem lápide não é erro: é reexecutar um gesto
      // que já estava dado.
      skipDuplicates: true,
    });

    await prisma.nexoConversation.deleteMany({ where: { id: { in: alvo.conversaIds } } });
  }

  /*
   * `DocumentArtifact` explicitamente: a relação com auditoria e LD é `SetNull`,
   * então ele sobreviveria órfão — um registro de arquivo que aponta para nada,
   * contado para sempre nas telas que contam artefatos.
   */
  if (alvo.auditIds.length || alvo.ldIds.length) {
    await prisma.documentArtifact.deleteMany({
      where: { OR: [{ auditId: { in: alvo.auditIds } }, { ldDraftId: { in: alvo.ldIds } }] },
    });
  }

  // `AuditFile`, `AuditText`, `AuditFeedback` e, por baixo dele,
  // `AuditFindingMessage`/`AuditFindingWatcher` saem por cascade do schema.
  if (alvo.auditIds.length) {
    await prisma.audit.deleteMany({ where: { id: { in: alvo.auditIds } } });
  }

  // `LdDraftEvent` sai por cascade.
  if (alvo.ldIds.length) {
    await prisma.ldDraft.deleteMany({ where: { id: { in: alvo.ldIds } } });
  }

  if (arquivos.checksums.length) {
    await prisma.storedFile.deleteMany({
      where: { checksumSha256: { in: arquivos.checksums } },
    });
  }

  return previa;
}
