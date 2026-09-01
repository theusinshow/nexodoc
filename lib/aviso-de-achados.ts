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
import { quemAvisar, type AchadoParaAvisar } from "@/lib/quem-avisar";
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
 * QUEM ESTÁ ESPERANDO AVISO NESTA AUDITORIA — a consulta, num lugar só.
 *
 * Havia DUAS cópias desta leitura: uma em `quemFaltaAvisar`, que rotula o botão,
 * e outra em `avisarEnvolvidos`, que manda. Com uma pessoa por achado elas eram
 * idênticas e ninguém notava; com envolvidos, deixá-las divergir faria o botão
 * mostrar uma lista e o envio alcançar outra — e o testador confirmaria nomes
 * que não iam receber nada.
 *
 * A CONSULTA TRAZ O ACHADO INTEIRO, e não só o e-mail do responsável: com
 * envolvidos, um achado tem N pessoas, cada uma com seu próprio `notifiedAt`.
 * Quem decide quem entra é [[lib/quem-avisar.ts]], puro e com teste sem banco —
 * aqui fica só o IO.
 */
async function pessoasPendentes(
  auditId: string,
  organizationId: string,
): Promise<PessoaAAvisar[]> {
  const linhas = await getPrisma().auditFeedback.findMany({
    where: { auditId },
    select: {
      assigneeEmail: true,
      notifiedAt: true,
      resolvedAt: true,
      envolvidos: { select: { email: true, notifiedAt: true } },
    },
  });

  const achados: AchadoParaAvisar[] = linhas.map((l) => ({
    resolvido: l.resolvedAt !== null,
    pessoas: [
      ...(l.assigneeEmail
        ? [
            {
              email: l.assigneeEmail,
              papel: "responsavel" as const,
              notifiedAt: l.notifiedAt?.getTime() ?? null,
            },
          ]
        : []),
      ...l.envolvidos.map((e) => ({
        email: e.email,
        papel: "envolvido" as const,
        notifiedAt: e.notifiedAt?.getTime() ?? null,
      })),
    ],
  }));

  return await comNomes(quemAvisar(achados), organizationId);
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

  return await pessoasPendentes(auditId, organizationId);
}

/**
 * Resolve os nomes numa consulta só.
 *
 * A CONTAGEM já vem pronta de [[lib/quem-avisar.ts]] — ela era feita aqui, e
 * saiu porque virou regra com N pessoas por achado e merecia teste sem banco.
 * O que sobrou é o que precisa do banco: o nome e o estado do convite.
 *
 * Uma consulta, e não uma por linha, pelo mesmo motivo da rota de feedback: um
 * parecer com quarenta achados do mesmo destinatário seriam quarenta idas ao
 * banco pelo mesmo nome.
 */
async function comNomes(
  contados: { email: string; quantidade: number }[],
  organizationId: string,
): Promise<PessoaAAvisar[]> {
  if (contados.length === 0) return [];

  const membros = await getPrisma().organizationMember.findMany({
    where: { organizationId, email: { in: contados.map((c) => c.email) } },
    select: { email: true, name: true, status: true },
  });

  const porEmail = new Map(membros.map((m) => [m.email, m]));

  /*
   * A ORDEM NÃO É REFEITA AQUI. `quemAvisar` já devolve ordenado por quantidade,
   * e ordenar de novo esconderia de qual das duas a ordem final veio.
   */
  return contados.map(({ email, quantidade }) => {
    const membro = porEmail.get(email);

    return {
      email,
      nome: membro?.name || email,
      quantidade,
      convidado: membro?.status === "INVITED",
    };
  });
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

/** A rampa teal da DESIGN.md, e o preto do app. Repetida aqui como literal, e
 *  NÃO lida dos tokens CSS: cliente de e-mail não resolve `var()`, e um token
 *  que chegasse cru pintaria texto de preto sobre preto. */
const TINTA = {
  fundo: "#0a0e11",
  papel: "#ffffff",
  tinta: "#14181b",
  suave: "#5c666d",
  linha: "#e4e6e8",
  teal: "#00a693",
  claro: "#7af7e1",
} as const;

/**
 * O CORPO, nas duas formas.
 *
 * ESTILOS INLINE E TABELA. Cliente de e-mail não lê variável CSS e boa parte
 * deles descarta `<style>` no `<head>`. O que a DESIGN.md governa é a tela; o
 * e-mail é outro meio, e fingir o contrário produziria uma mensagem sem
 * formatação nenhuma no Outlook.
 *
 * CABEÇALHO ESCURO, CORPO CLARO — e é uma escolha, não um meio-termo. A marca é
 * escura, e um e-mail inteiro escuro seria mais fiel; mas Gmail e Outlook no
 * celular INVERTEM automaticamente peças escuras, e a inversão de um corpo
 * inteiro produz combinações que ninguém desenhou. A faixa escura carrega a
 * identidade num pedaço que a inversão não estraga, e o texto vive no branco,
 * que é o terreno em que todo cliente acerta.
 *
 * O ORBE É IMAGEM REMOTA, e o e-mail funciona sem ele: metade dos clientes
 * bloqueia imagem por padrão. O `alt` diz "NexoDoc", a faixa escura já é a
 * marca, e nenhuma informação mora dentro do PNG. Imagem embutida em `data:`
 * não é alternativa — o Gmail descarta.
 */
export function corpoDoAviso(pessoa: PessoaAAvisar, contexto: Contexto) {
  const base = enderecoPublico();
  const link = `${base}/nexo?auditoria=${encodeURIComponent(contexto.auditId)}`;
  const orbe = `${base}/marca/orbe-faixa-256.png`;
  const quantos = pessoa.quantidade === 1 ? "1 achado" : `${pessoa.quantidade} achados`;
  const verbo = pessoa.quantidade === 1 ? "espera" : "esperam";
  const quem = contexto.remetente || "Alguém do escritório";

  /*
   * A LINHA SOB O BOTÃO SÓ EXISTE PARA QUEM NUNCA ENTROU.
   *
   * "Abrir no NexoDoc" pressupõe uma conta que essa pessoa não tem, e ela é
   * justamente para quem este e-mail mais importa: é o único caminho pelo qual
   * pode descobrir que há trabalho esperando por ela. A frase avisa que o
   * clique vai pedir login antes de mostrar o parecer.
   *
   * Para quem já tem conta a linha repetia o botão logo acima dela.
   */
  const chamada = pessoa.convidado
    ? "Você ainda não entrou no NexoDoc. Use a conta Google do escritório — o parecer estará esperando."
    : "";

  /*
   * A FICHA é o que torna este e-mail ESTRUTURADO em vez de um parágrafo com
   * link. São os quatro dados que respondem "isso é meu, é urgente, e onde
   * fica" sem abrir nada — e nenhum deles é conteúdo de achado.
   */
  const ficha: [string, string][] = [
    ["Projeto", contexto.codigo],
    ...(contexto.cliente ? ([["Cliente", contexto.cliente]] as [string, string][]) : []),
    ["Parecer", contexto.titulo],
    ["Com você", quantos],
  ];

  const texto = [
    `${quantos} ${verbo} por você no NexoDoc.`,
    "",
    `${quem} enviou ${quantos} da auditoria para você.`,
    "",
    ...ficha.map(([r, v]) => `${r}: ${v}`),
    "",
    "Abrir no NexoDoc:",
    link,
    ...(chamada ? ["", chamada] : []),
    "",
    "---",
    "O conteúdo dos achados não sai do sistema — este aviso leva só a contagem e o caminho.",
    "Você recebeu esta mensagem porque faz parte de um escritório no NexoDoc.",
  ].join("\n");

  const linhasDaFicha = ficha
    .map(
      ([rotulo, valor], i) => `<tr>
<td style="padding:${i === 0 ? "0" : "9px"} 16px 9px 0;border-top:${i === 0 ? "0" : `1px solid ${TINTA.linha}`};font:600 11px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.07em;text-transform:uppercase;color:${TINTA.suave};white-space:nowrap;vertical-align:top;">${esc(rotulo)}</td>
<td style="padding:${i === 0 ? "0" : "9px"} 0 9px 0;border-top:${i === 0 ? "0" : `1px solid ${TINTA.linha}`};font-size:14px;line-height:1.5;color:${TINTA.tinta};vertical-align:top;">${esc(valor)}</td>
</tr>`,
    )
    .join("");

  /*
   * A FAMÍLIA NA TABELA DE FORA é rede de segurança, e não decoração.
   *
   * Toda célula abaixo declara a própria fonte — menos uma, que ficou sem e caiu
   * na SERIFA padrão do cliente no meio de um layout sem serifa nenhuma. Herdar
   * aqui não conserta quem declara, e salva quem esquecer.
   */
  const html = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f2f3f4;margin:0;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td align="center" style="padding:0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:${TINTA.papel};border:1px solid ${TINTA.linha};">

<tr><td style="padding:0;background:${TINTA.fundo};" bgcolor="${TINTA.fundo}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding:26px 0 26px 28px;width:76px;" valign="middle">
<img src="${esc(orbe)}" width="64" height="64" alt="NexoDoc" style="display:block;width:64px;height:64px;border:0;outline:none;text-decoration:none;">
</td>
<td style="padding:26px 28px 26px 16px;" valign="middle">
<p style="margin:0;font:600 12px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.16em;text-transform:uppercase;color:${TINTA.claro};">NexoDoc</p>
<p style="margin:5px 0 0 0;font:400 15px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#9fb0b6;">Documentação de projetos de engenharia</p>
</td>
</tr></table>
</td></tr>
<tr><td style="padding:0;font-size:0;line-height:0;background:${TINTA.teal};" bgcolor="${TINTA.teal}" height="3">&nbsp;</td></tr>

<tr><td style="padding:30px 28px 0 28px;">
<h1 style="margin:0;font:600 23px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA.tinta};">${esc(quantos)} ${verbo} por você</h1>
<p style="margin:12px 0 0 0;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#3f484e;">${esc(quem)} enviou ${esc(quantos)} da auditoria para você revisar.</p>
</td></tr>

<tr><td style="padding:24px 28px 0 28px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-top:1px solid ${TINTA.linha};border-bottom:1px solid ${TINTA.linha};">
<tr><td style="padding:16px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${linhasDaFicha}</table>
</td></tr></table>
</td></tr>

<tr><td style="padding:24px 28px 0 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="background:${TINTA.teal};" bgcolor="${TINTA.teal}">
<a href="${esc(link)}" style="display:block;padding:13px 26px;font:600 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;">Abrir no NexoDoc &rarr;</a>
</td>
</tr></table>
${chamada ? `<p style="margin:14px 0 0 0;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TINTA.suave};">${esc(chamada)}</p>` : ""}
</td></tr>

<tr><td style="padding:26px 28px 28px 28px;">
<p style="margin:0;padding-top:18px;border-top:1px solid ${TINTA.linha};font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#8b959b;">O conteúdo dos achados não sai do sistema — este aviso leva só a contagem e o caminho.</p>
<p style="margin:8px 0 0 0;font:400 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#8b959b;">Você recebeu esta mensagem porque faz parte de um escritório no NexoDoc.</p>
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

  /* O MESMO helper que rotula o botão. Duas leituras separadas fariam a tela
   * prometer uma lista e o envio alcançar outra. */
  const pessoas = await pessoasPendentes(args.auditId, args.organizationId);

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
    /* UM instante para os dois carimbos. Duas chamadas a `new Date()` dariam
     * milissegundos diferentes ao responsável e ao envolvido do MESMO envio. */
    const agora = new Date();

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
      data: { notifiedAt: agora },
    });

    /*
     * O ENVOLVIDO TAMBÉM É MARCADO. Sem isto, o próximo clique no botão mandaria
     * de novo para quem só acompanha — e é exatamente a repetição que
     * `notifiedAt` existe para evitar.
     *
     * O estreitamento segue a mesma lição do comentário acima: esta pessoa,
     * nesta auditoria, e só o que ainda estava pendente.
     */
    await prisma.auditFindingWatcher.updateMany({
      where: {
        email: pessoa.email,
        notifiedAt: null,
        feedback: { auditId: args.auditId },
      },
      data: { notifiedAt: agora },
    });

    avisados.push(pessoa);
  }

  if (avisados.length === 0) {
    return { estado: "falhou", avisados, falharam };
  }

  return { estado, avisados, falharam };
}
