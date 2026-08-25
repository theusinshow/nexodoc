/**
 * AVISAR OS ENVOLVIDOS — o e-mail que diz à pessoa que há trabalho esperando.
 *
 * Não sai junto com a atribuição, e é de propósito. Quem revisa um memorial
 * distribui os achados aos poucos: quatro para o Milton, dois para a Carla,
 * volta atrás num, reatribui outro. E-mail a cada `POST /atribuir` mandaria
 * cinco avisos para a mesma pessoa em dez minutos, e o quinto diria menos que
 * o primeiro. Aqui a distribuição inteira acontece em silêncio, e UM botão no
 * fim do parecer avisa cada pessoa uma vez, do que é dela.
 *
 * O E-MAIL NÃO CARREGA O ACHADO. Só a contagem, o projeto e o link. A mensagem
 * sai do alcance do portão de acesso no instante em que é entregue -- fica na
 * caixa de entrada, é encaminhada, sobrevive ao desligamento de quem a
 * recebeu. O memorial é documento do cliente, e o único lugar onde ele
 * continua sob a regra do escritório é dentro do sistema.
 *
 * QUEM É AVISADO: quem tem achado atribuído NESTA auditoria, ainda não avisado
 * e ainda não resolvido. As três condições estão em `PENDENTE_DE_AVISO` abaixo,
 * cada uma com o motivo dela.
 */
import { getPrisma } from "@/lib/db";
import {
  correioConfigurado,
  correioEmDesenvolvimento,
  enderecoPublico,
  enviar,
  type EstadoDoEnvio,
} from "@/lib/correio";

export class AvisoRecusado extends Error {
  readonly status: 400 | 404;

  constructor(status: 400 | 404, message: string) {
    super(message);
    this.name = "AvisoRecusado";
    this.status = status;
  }
}

/**
 * As três condições que fazem uma linha estar esperando aviso.
 *
 *  · `assigneeEmail` — sem dono não há a quem avisar;
 *  · `notifiedAt` nulo — apertar o botão duas vezes não repete o e-mail. É esta
 *    condição que torna o botão seguro de tocar;
 *  · `resolvedAt` nulo — se a pessoa já corrigiu o achado antes de o aviso
 *    sair, avisar seria mandá-la olhar trabalho que ela mesma fechou.
 */
const PENDENTE_DE_AVISO = {
  assigneeEmail: { not: null },
  notifiedAt: null,
  resolvedAt: null,
} as const;

export type PessoaAAvisar = {
  email: string;
  /** O nome que o escritório conhece; cai para o e-mail quando não há. */
  nome: string;
  quantidade: number;
  /** Nunca entrou no sistema. Para esta pessoa o e-mail é a ÚNICA forma de
   *  saber que existe trabalho — a tela marca, e a mensagem muda. */
  convidado: boolean;
};

export type ResultadoDoAviso = {
  estado: EstadoDoEnvio | "nada-a-avisar";
  avisados: PessoaAAvisar[];
  /** Quem o correio não conseguiu alcançar. Continua pendente: o próximo
   *  clique tenta só estes. */
  falharam: { email: string; erro: string }[];
};

type Contexto = {
  auditId: string;
  titulo: string;
  codigo: string;
  cliente: string;
  /** Quem apertou o botão. É o nome que assina o e-mail. */
  remetente: string;
};

/**
 * A auditoria, com o escopo do escritório junto.
 *
 * Mesma guarda de `atribuirAchados`: sem ela, um id de outra organização faria
 * este código mandar e-mail para gente de fora em nome do escritório errado —
 * e diferente de uma pendência plantada, um e-mail não dá para desfazer.
 */
async function contextoDaAuditoria(auditId: string, organizationId: string): Promise<Contexto> {
  const audit = await getPrisma().audit.findFirst({
    where: { id: auditId, project: { organizationId } },
    select: {
      id: true,
      title: true,
      projectName: true,
      project: { select: { code: true, client: true } },
    },
  });

  if (!audit) {
    throw new AvisoRecusado(404, "Auditoria não encontrada.");
  }

  return {
    auditId: audit.id,
    titulo: audit.title,
    codigo: audit.project?.code ?? audit.projectName,
    cliente: audit.project?.client ?? "",
    remetente: "",
  };
}

/**
 * QUEM ESTÁ ESPERANDO AVISO — a consulta que o botão usa para se rotular antes
 * de qualquer envio.
 *
 * A tela precisa disto separado do envio: o painel de confirmação mostra os
 * nomes ANTES de mandar, porque e-mail não tem desfazer. Quem clica tem que
 * poder ver que o "Christian" da lista é o Christian certo.
 */
export async function quemFaltaAvisar(
  auditId: string,
  organizationId: string,
): Promise<PessoaAAvisar[]> {
  await contextoDaAuditoria(auditId, organizationId);

  const linhas = await getPrisma().auditFeedback.findMany({
    where: { auditId, ...PENDENTE_DE_AVISO },
    select: { assigneeEmail: true },
  });

  return await comNomes(linhas, organizationId);
}

/**
 * Agrupa por pessoa e resolve os nomes numa consulta só.
 *
 * Uma consulta, e não uma por linha, pelo mesmo motivo da rota de feedback: um
 * parecer com quarenta achados do mesmo destinatário seriam quarenta idas ao
 * banco pelo mesmo nome.
 */
async function comNomes(
  linhas: { assigneeEmail: string | null }[],
  organizationId: string,
): Promise<PessoaAAvisar[]> {
  const contagem = new Map<string, number>();

  for (const linha of linhas) {
    if (!linha.assigneeEmail) continue;
    contagem.set(linha.assigneeEmail, (contagem.get(linha.assigneeEmail) ?? 0) + 1);
  }

  if (contagem.size === 0) return [];

  const membros = await getPrisma().organizationMember.findMany({
    where: { organizationId, email: { in: [...contagem.keys()] } },
    select: { email: true, name: true, status: true },
  });

  const porEmail = new Map(membros.map((m) => [m.email, m]));

  return [...contagem.entries()]
    .map(([email, quantidade]) => {
      const membro = porEmail.get(email);

      return {
        email,
        nome: membro?.name || email,
        quantidade,
        convidado: membro?.status === "INVITED",
      };
    })
    /*
     * Quem tem MAIS achados primeiro: é a pessoa cujo dia este envio mais muda,
     * e a que quem confirma mais precisa conferir antes de apertar.
     */
    .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Escapa para HTML. Nome de pessoa e nome de obra entram no corpo, e um `&`
 *  em "Müller & Cia" quebraria a marcação. */
function esc(valor: string) {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function assuntoDoAviso(pessoa: PessoaAAvisar, contexto: Contexto) {
  const obra = contexto.cliente ? ` ${contexto.cliente}` : "";

  return pessoa.quantidade === 1
    ? `1 achado espera por você — ${contexto.codigo}${obra}`
    : `${pessoa.quantidade} achados esperam por você — ${contexto.codigo}${obra}`;
}

/**
 * O CORPO, nas duas formas.
 *
 * Estilos INLINE e tabela: cliente de e-mail não lê variável CSS, e boa parte
 * deles descarta `<style>` no `<head>`. O que a DESIGN.md governa é a tela; o
 * e-mail é outro meio, e fingir o contrário produziria uma mensagem sem
 * formatação nenhuma no Outlook.
 *
 * Sem imagem e sem fonte remota, também de propósito: as duas ficam bloqueadas
 * por padrão na maioria das caixas, e um aviso que depende delas chega mudo.
 */
export function corpoDoAviso(pessoa: PessoaAAvisar, contexto: Contexto) {
  const link = `${enderecoPublico()}/nexo?auditoria=${encodeURIComponent(contexto.auditId)}`;
  const quantos =
    pessoa.quantidade === 1 ? "1 achado" : `${pessoa.quantidade} achados`;
  const obra = [contexto.codigo, contexto.cliente].filter(Boolean).join(" · ");
  const quem = contexto.remetente || "Alguém do escritório";

  /*
   * A LINHA SOB O BOTÃO SÓ EXISTE PARA QUEM NUNCA ENTROU.
   *
   * "Abrir no NexoDoc" pressupõe uma conta que essa pessoa não tem, e ela é
   * justamente para quem este e-mail mais importa: é o único caminho pelo qual
   * pode descobrir que há trabalho esperando por ela. A frase avisa que o
   * clique vai pedir login antes de mostrar o parecer.
   *
   * Para quem já tem conta a linha era "Abra para ver o que é." — texto que
   * repetia o botão logo acima dele e não acrescentava nada.
   */
  const chamada = pessoa.convidado ? "Entre com sua conta Google para ver." : "";

  const texto = [
    `${quem} enviou ${quantos} para você.`,
    "",
    obra,
    contexto.titulo,
    "",
    ...(chamada ? [chamada] : []),
    link,
    "",
    "Você recebeu este aviso porque faz parte de um escritório no NexoDoc.",
  ].join("\n");

  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f2;padding:32px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#ffffff;border:1px solid #e2e2de;">
<tr><td style="padding:28px 28px 0 28px;">
<p style="margin:0 0 4px 0;font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6b6b66;">NexoDoc</p>
<h1 style="margin:0 0 16px 0;font-size:20px;line-height:1.3;color:#1a1a18;font-weight:600;">${esc(quantos)} ${pessoa.quantidade === 1 ? "espera" : "esperam"} por você</h1>
<p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#3d3d39;">${esc(quem)} enviou ${esc(quantos)} da auditoria para você.</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-left:3px solid #0f9b8e;margin:0 0 24px 0;">
<tr><td style="padding:2px 0 2px 12px;">
<p style="margin:0;font:600 13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#1a1a18;">${esc(obra)}</p>
<p style="margin:2px 0 0 0;font-size:13px;line-height:1.5;color:#6b6b66;">${esc(contexto.titulo)}</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 28px 8px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:#0f9b8e;"><a href="${esc(link)}" style="display:inline-block;padding:11px 22px;font:600 14px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">Abrir no NexoDoc</a></td>
</tr></table>
${chamada ? `<p style="margin:12px 0 0 0;font-size:13px;line-height:1.5;color:#6b6b66;">${esc(chamada)}</p>` : ""}
</td></tr>
<tr><td style="padding:20px 28px 24px 28px;">
<p style="margin:0;padding-top:16px;border-top:1px solid #ececE8;font-size:12px;line-height:1.5;color:#8a8a84;">Você recebeu este aviso porque faz parte de um escritório no NexoDoc.</p>
</td></tr>
</table>
</td></tr></table>`;

  return { html, texto };
}

/**
 * AVISAR — o ato inteiro.
 *
 * A ordem importa e não é a óbvia: manda PRIMEIRO, carimba DEPOIS, e carimba
 * uma pessoa por vez. Carimbar tudo antes seria uma transação limpa e um erro
 * caro -- a Resend fora do ar deixaria dez linhas marcadas como avisadas sem
 * nenhum e-mail ter saído, e não há como descobrir isso olhando o banco.
 *
 * O preço desta ordem é o oposto, e é o barato: um processo que morre entre o
 * envio e o carimbo faz uma pessoa receber dois e-mails iguais. Aviso repetido
 * é ruído; aviso que não saiu e o sistema jura que saiu é trabalho parado que
 * ninguém procura.
 */
export async function avisarEnvolvidos(args: {
  auditId: string;
  organizationId: string;
  avisadoPor: { nome: string | null; email: string };
}): Promise<ResultadoDoAviso> {
  const prisma = getPrisma();
  const contexto = await contextoDaAuditoria(args.auditId, args.organizationId);

  contexto.remetente = args.avisadoPor.nome?.trim() || args.avisadoPor.email;

  const linhas = await prisma.auditFeedback.findMany({
    where: { auditId: args.auditId, ...PENDENTE_DE_AVISO },
    select: { assigneeEmail: true },
  });

  const pessoas = await comNomes(linhas, args.organizationId);

  if (pessoas.length === 0) {
    return { estado: "nada-a-avisar", avisados: [], falharam: [] };
  }

  /*
   * RECUSA ANTES DE COMEÇAR quando não há correio nenhum.
   *
   * Sair carimbando e devolver "não configurado" no fim faria as linhas
   * contarem como avisadas sem envio nenhum -- e o botão sumiria da tela,
   * levando embora a única pista de que ninguém foi avisado.
   */
  if (!correioConfigurado() && !correioEmDesenvolvimento()) {
    return { estado: "nao-configurado", avisados: [], falharam: [] };
  }

  const avisados: PessoaAAvisar[] = [];
  const falharam: { email: string; erro: string }[] = [];
  let estado: EstadoDoEnvio = "enviado";

  for (const pessoa of pessoas) {
    const { html, texto } = corpoDoAviso(pessoa, contexto);
    const resultado = await enviar({
      para: pessoa.email,
      assunto: assuntoDoAviso(pessoa, contexto),
      html,
      texto,
    });

    if (resultado.estado === "falhou" || resultado.estado === "nao-configurado") {
      falharam.push({
        email: pessoa.email,
        erro: resultado.erro ?? "correio não configurado",
      });
      continue;
    }

    estado = resultado.estado;

    /*
     * O CARIMBO É ESTREITO DE PROPÓSITO: só as linhas desta pessoa, nesta
     * auditoria, que ainda estavam pendentes. Um `updateMany` por auditoria
     * marcaria também quem falhou logo acima -- e essa pessoa nunca mais
     * apareceria no botão para uma segunda tentativa.
     */
    await prisma.auditFeedback.updateMany({
      /*
       * A ORDEM DAS CHAVES É A CORREÇÃO, e não estilo.
       *
       * `PENDENTE_DE_AVISO` traz `assigneeEmail: { not: null }` — "qualquer um
       * que tenha dono". Escrito DEPOIS do e-mail da pessoa, o spread
       * sobrescrevia o filtro e o `updateMany` carimbava as linhas de TODO
       * MUNDO nesta auditoria, a cada volta do laço. A primeira pessoa da lista
       * teria "avisado" o parecer inteiro, e ninguém mais receberia e-mail.
       *
       * O spread vem primeiro; o estreitamento vem depois e vence.
       */
      where: { ...PENDENTE_DE_AVISO, auditId: args.auditId, assigneeEmail: pessoa.email },
      data: { notifiedAt: new Date() },
    });

    avisados.push(pessoa);
  }

  if (avisados.length === 0) {
    return { estado: "falhou", avisados, falharam };
  }

  return { estado, avisados, falharam };
}
