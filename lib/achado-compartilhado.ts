/**
 * ESCREVER NO ACHADO — a conversa e os envolvidos.
 *
 * Todo caminho que muda um achado passa por aqui, e todo caminho deixa uma linha
 * na conversa. É isso que substitui o portão de permissão: antes, reatribuir
 * sobrescrevia `assigneeEmail` e quem tinha o achado sumia sem rastro. Agora
 * qualquer um do escritório pode agir, e toda ação fica assinada.
 *
 * O FINGERPRINT É CALCULADO AQUI, do relatório gravado, e nunca aceito do
 * cliente — mesma regra de [[fila-de-achados.ts]], e pelo mesmo motivo: ele é a
 * identidade do achado entre versões, e um valor errado só apareceria meses
 * depois, quando a reauditoria não reencontrasse a pendência.
 */
import type { AuditReport } from "@/lib/audit-report";
import { getPrisma } from "@/lib/db";
import { chaveEntreVersoes } from "@/lib/diff-de-pareceres";

export class AchadoRecusado extends Error {
  /*
   * Campo declarado e atribuído à mão, e não propriedade de parâmetro: o node
   * roda os scripts em modo strip-only, que apaga tipos sem transformar sintaxe.
   * Mesmo motivo de `DesfechoInvalido` em [[desfecho-do-achado.ts]].
   */
  readonly status: 400 | 404;

  constructor(status: 400 | 404, message: string) {
    super(message);
    this.name = "AchadoRecusado";
    this.status = status;
  }
}

type Autor = { id: string | null; email: string };

/**
 * A LINHA DO ACHADO, criando-a se ainda não existe.
 *
 * Comentar num achado que ninguém atribuiu é legítimo — é justamente o caso de
 * "isso não é meu". Mas a conversa precisa de uma linha para se pendurar (o
 * `Cascade` das duas tabelas depende dela), então comentar cria a linha.
 *
 * O que ela NÃO faz: inventar veredito, desfecho ou responsável. Uma linha
 * nascida de um comentário fica com tudo isso nulo, e é o estado honesto — a
 * pessoa falou, não julgou nem assumiu nada.
 */
export async function garantirLinhaDoAchado(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
}): Promise<{ id: string }> {
  const prisma = getPrisma();

  /*
   * A auditoria é buscada COM o escopo do escritório. Sem isso, alguém com um id
   * de outra organização escreveria dentro dela — mesma guarda de
   * `atribuirAchados`.
   */
  const audit = await prisma.audit.findFirst({
    where: { id: args.auditId, project: { organizationId: args.organizationId } },
    select: { id: true, report: true, projectId: true },
  });

  if (!audit) throw new AchadoRecusado(404, "Auditoria não encontrada.");

  /*
   * SEM PROJETO NÃO HÁ ACHADO COMPARTILHADO — mesma recusa de `atribuirAchados`:
   * a pendência existiria numa fila que ninguém vai abrir.
   */
  if (!audit.projectId) {
    throw new AchadoRecusado(400, "Esta auditoria não pertence a um projeto.");
  }

  const report = audit.report as AuditReport | null;
  const achado = (report?.incongruencias ?? []).find((item) => item.id === args.findingId);

  if (!achado) throw new AchadoRecusado(404, "Achado não encontrado neste parecer.");

  const targetKey = `finding:${args.findingId}`;

  return await prisma.auditFeedback.upsert({
    where: { auditId_targetKey: { auditId: audit.id, targetKey } },
    create: {
      auditId: audit.id,
      targetKey,
      findingId: args.findingId,
      findingLabel: achado.tipo.slice(0, 160),
      page: achado.pagina ? achado.pagina.slice(0, 80) : null,
      fingerprint: chaveEntreVersoes(achado),
    },
    /*
     * Nada. A linha pode já carregar veredito, desfecho e responsável, e
     * garantir a existência dela não é ocasião para mexer em nenhum deles.
     */
    update: {},
    select: { id: true },
  });
}

/** O teto do corpo de uma mensagem. Generoso, mas finito: o campo é texto livre
 *  e vai para o banco sem passar por nenhuma outra régua. */
const LIMITE_DO_CORPO = 4000;

/** Uma linha na conversa. Todo caminho que muda o achado chama isto. */
export async function registrarNoAchado(args: {
  feedbackId: string;
  kind: string;
  autor: Autor;
  body?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await getPrisma().auditFindingMessage.create({
    data: {
      feedbackId: args.feedbackId,
      kind: args.kind,
      authorEmail: args.autor.email.trim().toLowerCase(),
      authorId: args.autor.id,
      body: (args.body ?? "").trim().slice(0, LIMITE_DO_CORPO),
      ...(args.details ? { details: args.details as never } : {}),
    },
  });
}

export async function comentar(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
  autor: Autor;
  body: string;
}): Promise<{ id: string }> {
  const corpo = args.body.trim();

  /*
   * Comentário vazio não é comentário. Recusar aqui, e não só desabilitar o
   * botão: a tela é cortesia, e um POST direto passava por cima dela.
   */
  if (!corpo) throw new AchadoRecusado(400, "Escreva alguma coisa.");

  const linha = await garantirLinhaDoAchado(args);

  await registrarNoAchado({
    feedbackId: linha.id,
    kind: "comentario",
    autor: args.autor,
    body: corpo,
  });

  /*
   * A RESPOSTA REACENDE O AVISO — para os OUTROS, e não para quem escreveu.
   *
   * E-mail automático a cada resposta foi recusado de propósito: o aviso é ato
   * único, e uma conversa de seis mensagens viraria seis e-mails em que o sexto
   * diz menos que o primeiro. Zerar `notifiedAt` faz a novidade aparecer no
   * botão "Avisar" que já existe — a mensagem continua saindo quando gente
   * decide que sai.
   *
   * Quem escreveu fica de fora: ninguém precisa ser avisado do que acabou de
   * dizer. E achado já resolvido também: reacender ali mandaria alguém olhar
   * trabalho que já foi fechado.
   */
  const autor = args.autor.email.trim().toLowerCase();

  await getPrisma().auditFeedback.updateMany({
    where: { id: linha.id, resolvedAt: null, assigneeEmail: { not: autor } },
    data: { notifiedAt: null },
  });

  await getPrisma().auditFindingWatcher.updateMany({
    where: { feedbackId: linha.id, email: { not: autor } },
    data: { notifiedAt: null },
  });

  return linha;
}

export async function envolver(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
  autor: Autor;
  email: string;
  nome: string;
}): Promise<void> {
  const email = args.email.trim().toLowerCase();
  if (!email) throw new AchadoRecusado(400, "Informe quem envolver.");

  const membro = await getPrisma().organizationMember.findFirst({
    where: { organizationId: args.organizationId, email },
    select: { email: true, status: true },
  });

  if (!membro) throw new AchadoRecusado(400, "Essa pessoa não faz parte do escritório.");

  /*
   * DESLIGADO NÃO ENTRA — mesma regra de `atribuirAchados`. INVITED entra: o
   * convite nasce antes da conta, e é no primeiro login que a pessoa encontra o
   * que a esperava.
   */
  if (membro.status === "DISABLED") {
    throw new AchadoRecusado(400, "Essa pessoa foi desligada do escritório.");
  }

  const linha = await garantirLinhaDoAchado(args);

  /*
   * Envolver duas vezes a mesma pessoa é um clique repetido, não um erro para
   * mostrar na tela. E o `notifiedAt` NÃO é zerado no reencontro: ela já foi
   * avisada deste achado, e reavisar seria repetir a mensagem por um clique.
   */
  const jaEstava = await getPrisma().auditFindingWatcher.findUnique({
    where: { feedbackId_email: { feedbackId: linha.id, email } },
    select: { id: true },
  });

  if (jaEstava) return;

  await getPrisma().auditFindingWatcher.create({
    data: { feedbackId: linha.id, email, addedById: args.autor.id },
  });

  await registrarNoAchado({
    feedbackId: linha.id,
    kind: "envolveu",
    autor: args.autor,
    details: { para: email, paraNome: args.nome.trim() || email },
  });
}

export async function desenvolver(args: {
  auditId: string;
  findingId: string;
  organizationId: string;
  autor: Autor;
  email: string;
  nome: string;
}): Promise<void> {
  const email = args.email.trim().toLowerCase();
  const linha = await garantirLinhaDoAchado(args);

  const removidos = await getPrisma().auditFindingWatcher.deleteMany({
    where: { feedbackId: linha.id, email },
  });

  /*
   * Tirar quem não estava é um clique repetido. Registrar mesmo assim poluiria a
   * conversa com um evento que não aconteceu.
   */
  if (removidos.count === 0) return;

  /*
   * SAIR DOS ENVOLVIDOS NÃO APAGA O HISTÓRICO DE TER ENTRADO. O `envolveu`
   * continua na conversa, e o `desenvolveu` entra depois dele: é a diferença
   * entre "a Carla nunca esteve aqui" e "a Carla esteve e saiu".
   */
  await registrarNoAchado({
    feedbackId: linha.id,
    kind: "desenvolveu",
    autor: args.autor,
    details: { para: email, paraNome: args.nome.trim() || email },
  });
}
