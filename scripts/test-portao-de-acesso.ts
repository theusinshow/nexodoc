// Quem entra, e com que resposta quando não entra.
//
//   node scripts/test-portao-de-acesso.ts   (== npm run test:portao)
//
// O núcleo do portão é puro de propósito: decidir quem entra não pode depender
// de ter um Postgres de pé, senão a regra só é exercitada em integração — que é
// justamente onde ninguém escreve o caso chato.
//
// Os casos chatos aqui são três, e cada um já foi um buraco real em algum
// sistema: convidado que entra por link antes de aceitar, conta desativada que
// continua passando porque o vínculo com o escritório está ativo, e admin de
// plataforma que ganha escritório de brinde por ser admin.
import assert from "node:assert/strict";

import { AccessDenied, resolveActor, resolvePlatformAdmin } from "../lib/actor.ts";

const membroAtivo = {
  userId: "u1",
  name: "Victor",
  organizationId: "org-prosul",
  role: "MEMBER" as const,
  status: "ACTIVE" as const,
};
const acessoOk = { email: "victor@prosul.com", isActive: true, isAdmin: false };

function recusa(entrada: Parameters<typeof resolveActor>[0], status: 401 | 403) {
  assert.throws(
    () => resolveActor(entrada),
    (err: unknown) => err instanceof AccessDenied && err.status === status,
  );
}

// Sem sessão não é "proibido", é "não identificado": 401 manda a interface
// logar, 403 mandaria pedir permissão a alguém. A diferença importa para o
// usuário — trocar os dois faz a tela oferecer a ação errada, e ele roda em
// círculo tentando o que não resolve.
recusa({ access: null, member: null }, 401);

// Sessão válida sem vínculo com escritório nenhum: identificado, sem lugar.
recusa({ access: acessoOk, member: null }, 403);

// Convidado que nunca entrou não entra por link. Ele só vira ACTIVE no login.
recusa({ access: acessoOk, member: { ...membroAtivo, status: "INVITED" } }, 403);

recusa({ access: acessoOk, member: { ...membroAtivo, status: "DISABLED" } }, 403);

// Conta desativada na plataforma não entra, mesmo com membro ativo no
// escritório: as duas checagens são independentes e a mais restritiva vence.
recusa({ access: { ...acessoOk, isActive: false }, member: membroAtivo }, 403);

const ator = resolveActor({ access: acessoOk, member: membroAtivo });
assert.equal(ator.email, "victor@prosul.com");
assert.equal(ator.organizationId, "org-prosul");
assert.equal(ator.orgRole, "MEMBER");
assert.equal(ator.isPlatformAdmin, false);
assert.equal(ator.userId, "u1");

// Admin de plataforma sem membro em escritório nenhum continua sem escritório.
// Ser admin da plataforma não inventa vínculo — /admin é outra porta.
recusa({ access: { ...acessoOk, isAdmin: true }, member: null }, 403);

// Mas quem é admin da plataforma E membro carrega as duas coisas: a alçada de
// cadastrar projeto (Task 11) consulta `isPlatformAdmin` para não trancar o
// mantenedor fora do próprio sistema.
const mantenedor = resolveActor({
  access: { ...acessoOk, isAdmin: true },
  member: { ...membroAtivo, role: "MEMBER" },
});
assert.equal(mantenedor.isPlatformAdmin, true);
assert.equal(mantenedor.orgRole, "MEMBER");

// Membro sem conta ainda: convidado que virou ACTIVE mas cujo `userId` não foi
// preenchido não deve derrubar o portão. O ator existe, sem id — é o estado em
// que um achado já pode estar atribuído a ele (ver o spec, C.1).
const semConta = resolveActor({
  access: acessoOk,
  member: { ...membroAtivo, userId: null },
});
assert.equal(semConta.userId, null);
assert.equal(semConta.organizationId, "org-prosul");

// ---------------------------------------------------------------------------
// O PORTÃO DE PLATAFORMA, que é outra pergunta.

function recusaAdmin(
  entrada: Parameters<typeof resolvePlatformAdmin>[0],
  status: 401 | 403,
) {
  assert.throws(
    () => resolvePlatformAdmin(entrada),
    (err: unknown) => err instanceof AccessDenied && err.status === status,
  );
}

recusaAdmin(null, 401);
recusaAdmin(acessoOk, 403);
recusaAdmin({ ...acessoOk, isActive: false, isAdmin: true }, 403);

// E o caso que justifica o portão existir separado: admin de plataforma SEM
// escritório nenhum. `resolveActor` recusa isto com 403 — e recusar aqui
// trancaria o mantenedor fora do proprio painel.
const admin = resolvePlatformAdmin({ ...acessoOk, isAdmin: true });
assert.equal(admin.email, "victor@prosul.com");
recusa({ access: { ...acessoOk, isAdmin: true }, member: null }, 403);

console.log("OK  portao de acesso");
