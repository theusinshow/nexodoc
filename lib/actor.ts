/**
 * QUEM ESTÁ CHAMANDO, e de qual escritório.
 *
 * Puro de propósito (só `import type`): a regra de quem entra é a coisa que mais
 * precisa de teste e a que menos pode depender de um banco de pé. O IO mora em
 * [[access-control.ts]], que monta as duas entradas e chama daqui.
 *
 * DUAS RECUSAS INDEPENDENTES, e é por isso que a entrada tem dois campos em vez
 * de um. A conta pode estar desativada na PLATAFORMA (`access.isActive`) e o
 * vínculo pode estar inativo no ESCRITÓRIO (`member.status`). São perguntas
 * diferentes, respondidas por tabelas diferentes, e nenhuma implica a outra:
 * desligar alguém do escritório não desativa a conta dela, e desativar a conta
 * não deve exigir passar em cada escritório apagando vínculo. A mais restritiva
 * vence.
 *
 * O `userId` pode ser nulo num ator legítimo: o convite nasce sem conta e vira
 * ACTIVE no primeiro login. É o estado em que um achado já pode estar atribuído
 * a alguém que nunca entrou — modelar o responsável como `User` tornaria isso
 * impossível.
 */
import type { OrganizationRole } from "@prisma/client";

export type Actor = {
  userId: string | null;
  email: string;
  name: string | null;
  organizationId: string;
  orgRole: OrganizationRole;
  isPlatformAdmin: boolean;
};

export class AccessDenied extends Error {
  /*
   * Campo declarado e atribuído à mão, e não propriedade de parâmetro
   * (`constructor(readonly status: ...)`). O node roda os testes de `scripts/`
   * em modo strip-only, que apaga tipos sem transformar sintaxe — e propriedade
   * de parâmetro é transformação, não anotação. Escrever assim é o que mantém
   * este arquivo executável sem empacotador.
   */
  readonly status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.name = "AccessDenied";
    this.status = status;
  }
}

export type ResolveActorInput = {
  access: { email: string; isActive: boolean; isAdmin: boolean } | null;
  member: {
    userId: string | null;
    name: string | null;
    organizationId: string;
    role: OrganizationRole;
    status: "ACTIVE" | "INVITED" | "DISABLED";
  } | null;
};

export function resolveActor(input: ResolveActorInput): Actor {
  const { access, member } = input;

  /*
   * 401 e 403 dizem coisas diferentes para a interface: o primeiro manda logar,
   * o segundo manda pedir acesso a alguém. Trocar os dois faz a tela oferecer a
   * ação errada, e o usuário tenta de novo o que nunca vai funcionar.
   */
  if (!access?.email) {
    throw new AccessDenied(401, "Entre para continuar.");
  }

  if (!access.isActive) {
    throw new AccessDenied(403, "Sua conta está desativada.");
  }

  /*
   * INVITED não entra. O convite é a intenção de dar acesso, não o acesso: quem
   * foi convidado e nunca entrou não deve passar por link direto, senão o
   * primeiro login deixa de ser o momento em que o vínculo se confirma — e a
   * ativação em `access-control.ts` nunca acontece.
   */
  if (!member || member.status !== "ACTIVE") {
    throw new AccessDenied(403, "Você não faz parte de nenhum escritório.");
  }

  return {
    userId: member.userId,
    email: access.email,
    name: member.name,
    organizationId: member.organizationId,
    orgRole: member.role,
    isPlatformAdmin: access.isAdmin,
  };
}

export type PlatformAdmin = { email: string };

/**
 * A OUTRA PORTA: `/api/admin/*`.
 *
 * Não passa por `resolveActor` de propósito. Administrador de plataforma pode
 * não ser membro de escritório nenhum — e `resolveActor` recusa exatamente esse
 * caso, com 403. Usar o portão do escritório aqui trancaria o mantenedor fora
 * do próprio painel no dia em que ele não estivesse na PROSUL.
 *
 * São perguntas diferentes: "de que escritório você é?" e "você opera esta
 * plataforma?". Um portão só teria que responder as duas, e responderia mal as
 * duas.
 */
export function resolvePlatformAdmin(
  access: { email: string; isActive: boolean; isAdmin: boolean } | null,
): PlatformAdmin {
  if (!access?.email) {
    throw new AccessDenied(401, "Entre para continuar.");
  }

  if (!access.isActive || !access.isAdmin) {
    throw new AccessDenied(403, "Acesso administrativo negado.");
  }

  return { email: access.email };
}
