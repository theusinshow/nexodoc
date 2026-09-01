/**
 * O ENDEREÇO da auditoria, resolvido antes de disparar.
 *
 * `/api/audit` passou a exigir `projectId`: parecer sem projeto não tem fila,
 * não tem gate de emissão e não tem a quem atribuir achado. Este módulo é o que
 * evita que essa exigência vire atrito — o centro de custo já está no documento,
 * e perguntar ao usuário algo que o próprio PDF responde seria burocracia.
 *
 * A regra de casamento é pura e mora em [[lib/resolucao-de-projeto.ts]], com
 * teste que roda sem navegador. Aqui fica só o IO: buscar os projetos do
 * escritório e traduzir o desfecho em algo que a tela saiba dizer.
 */
import {
  decidirTroca,
  resolverProjeto,
  type ProjetoConhecido,
  type ResolucaoDeProjeto,
} from "@/lib/resolucao-de-projeto";

export type ProjetoResolvido =
  | { tipo: "achado"; projeto: ProjetoConhecido }
  | { tipo: "desconhecido"; codigo: string; projetos: ProjetoConhecido[] }
  | { tipo: "sem-codigo"; projetos: ProjetoConhecido[] }
  | { tipo: "sem-escritorio"; motivo: string };

export async function resolverProjetoDaAuditoria(
  codigoExtraido: string | null | undefined,
  signal?: AbortSignal,
  /*
   * A prefeitura e a obra vêm junto porque, quando a pasta precisa NASCER, é
   * com elas que ela nasce. Buscar isso de novo lá dentro seria pedir de volta
   * o que a classificação já leu.
   */
  identidade?: { prefeitura?: string | null; obra?: string | null; municipio?: string | null },
): Promise<ProjetoResolvido> {
  let projetos: ProjetoConhecido[] = [];

  try {
    const resposta = await fetch("/api/projects", { signal });

    if (!resposta.ok) {
      /*
       * 401 e 403 aqui não são "não achei o projeto": são "você não está no
       * escritório". Confundir os dois faria a tela pedir para cadastrar um
       * centro de custo a quem não tem permissão nem para ver a lista.
       */
      return {
        tipo: "sem-escritorio",
        motivo:
          resposta.status === 401
            ? "Sua sessão expirou. Entre novamente."
            : "Você não faz parte de um escritório neste sistema.",
      };
    }

    const corpo = (await resposta.json()) as { projects?: ProjetoConhecido[] };
    projetos = corpo.projects ?? [];
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    return { tipo: "sem-escritorio", motivo: "Não deu para consultar os projetos." };
  }

  const resolucao: ResolucaoDeProjeto = resolverProjeto({
    codigoExtraido: codigoExtraido ?? undefined,
    projetos,
  });

  if (resolucao.tipo === "achado") return resolucao;
  if (resolucao.tipo === "desconhecido") {
    /*
     * CRIA, em vez de recusar.
     *
     * Aqui o Nexo parava e mandava chamar um admin — era a decisão anterior, e
     * ela foi invertida: o código não é digitado por ninguém, é lido do
     * documento. Quem trouxe o memorial do 099-25 não deve esperar por outra
     * pessoa para poder auditá-lo.
     */
    try {
      const criado = await fetch("/api/projects/por-centro-de-custo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: resolucao.codigo,
          client: identidade?.prefeitura ?? "",
          name: identidade?.obra ?? "",
          /*
           * Forma a CHAVE do cliente. O órgão pode ser uma secretaria de nome
           * longo; o município é o que identifica a prefeitura.
           */
          municipio: identidade?.municipio ?? "",
        }),
        signal,
      });

      if (!criado.ok) {
        // Falhar em criar não vira "código desconhecido": a pessoa perguntaria
        // qual código, e o problema não é o código.
        return {
          tipo: "sem-escritorio",
          motivo: "Não deu para criar a pasta deste centro de custo.",
        };
      }

      const { project } = (await criado.json()) as { project: ProjetoConhecido };

      return { tipo: "achado", projeto: project };
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;

      return {
        tipo: "sem-escritorio",
        motivo: "Não deu para criar a pasta deste centro de custo.",
      };
    }
  }

  return { tipo: "sem-codigo", projetos };
}

/**
 * A frase que vai para a tela quando não dá para seguir sozinho.
 *
 * Fora do componente porque é decisão de CONTEÚDO — o que vale a pena dizer, e
 * o que a pessoa faz a seguir —, e porque assim dá para prová-la sem navegador.
 *
 * Nunca diz "erro": não houve erro. O documento é de um centro de custo que o
 * escritório ainda não cadastrou, e isso é trabalho de gente, não defeito.
 */
export function fraseDoImpasse(resolvido: ProjetoResolvido): string {
  switch (resolvido.tipo) {
    case "achado":
      return "";
    case "sem-escritorio":
      return resolvido.motivo;
    case "desconhecido":
      return resolvido.projetos.length === 0
        ? `O centro de custo ${resolvido.codigo} não está cadastrado, e este escritório ainda não tem projetos.`
        : `O centro de custo ${resolvido.codigo} não está cadastrado neste escritório.`;
    case "sem-codigo":
      return resolvido.projetos.length === 0
        ? "Este escritório ainda não tem projetos cadastrados."
        : "Não achei o centro de custo no documento. Escolha o projeto desta auditoria.";
  }
}

export type Vinculo =
  | { tipo: "vinculado"; projeto: ProjetoConhecido }
  /** Nada mudou: mesmo código, ou nada novo legível. */
  | { tipo: "manter" }
  /** O documento novo é de OUTRO projeto. Quem decide é gente. */
  | { tipo: "conflito"; atual: string; lido: string }
  /** Não deu para endereçar. `fraseDoImpasse` explica o porquê. */
  | { tipo: "impasse"; resolvido: ProjetoResolvido };

/**
 * ENDEREÇAR A CONVERSA NO ANEXO — e não no disparo da auditoria.
 *
 * A resolução morava no `confirm()` do ConfirmationCard, junto com o disparo. A
 * barra lateral, porém, precisa saber a que projeto a conversa pertence ANTES
 * disso: no instante em que a conversa é gravada. Era essa defasagem que
 * produzia o "Sem código no carimbo" — no momento da gravação ninguém ainda
 * tinha decidido o projeto.
 *
 * NÃO BLOQUEIA O ANEXO. Memorial sem código legível devolve `impasse`, e a
 * conversa fica "A endereçar" com ação inline no cartão. Cobrar a decisão aqui
 * exigiria uma escolha de quem talvez só queira olhar o documento; o disparo da
 * auditoria continua cobrando, como já cobrava.
 */
export async function vincularProjetoDaConversa(args: {
  codigoAtual: string | null;
  codigoLido: string | null;
  prefeitura?: string | null;
  obra?: string | null;
  municipio?: string | null;
  signal?: AbortSignal;
}): Promise<Vinculo> {
  const { acao } = decidirTroca({
    codigoAtual: args.codigoAtual,
    codigoLido: args.codigoLido,
  });

  if (acao === "manter") return { tipo: "manter" };

  if (acao === "conflito") {
    /*
     * NÃO TROCA. Dois memoriais de projetos diferentes na mesma conversa é erro
     * de quem anexou; trocar em silêncio levaria os achados do primeiro para a
     * fila do segundo, e o erro só apareceria dias depois.
     */
    return {
      tipo: "conflito",
      atual: args.codigoAtual ?? "",
      lido: args.codigoLido ?? "",
    };
  }

  const resolvido = await resolverProjetoDaAuditoria(args.codigoLido, args.signal, {
    prefeitura: args.prefeitura,
    obra: args.obra,
    municipio: args.municipio,
  });

  if (resolvido.tipo === "achado") return { tipo: "vinculado", projeto: resolvido.projeto };

  return { tipo: "impasse", resolvido };
}
