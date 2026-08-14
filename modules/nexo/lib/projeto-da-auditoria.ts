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
    return { tipo: "desconhecido", codigo: resolucao.codigo, projetos };
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
