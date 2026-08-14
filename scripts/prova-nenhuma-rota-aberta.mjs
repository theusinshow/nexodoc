// Nenhuma rota de API sem portão.
//
//   node scripts/prova-nenhuma-rota-aberta.mjs   (== npm run prova:rotas)
//
// POR QUE UMA VARREDURA, E NÃO UM TESTE POR ROTA
//
// Fechar as três rotas abertas de hoje é o mínimo. O que importa é a QUARTA: no
// dia em que alguém criar /api/findings/[id]/assign e esquecer o portão, nenhum
// teste existente falha — porque ninguém escreve teste para uma rota que ainda
// não existe. Esta prova falha sozinha, sem ninguém lembrar dela.
//
// O que ela mede é a PRESENÇA da chamada, não o comportamento. É varredura de
// texto, e uma chamada dentro de um `if (false)` passaria. O objetivo é outro:
// tornar o esquecimento visível. Quem quiser burlar consegue — mas aí é decisão,
// e decisão deixa rastro no diff.
//
// Não sobe navegador e não toca banco: lê os arquivos.
import fs from "node:fs";
import path from "node:path";

const RAIZ = "app/api";

// Rota deliberadamente pública. Cada uma com o motivo escrito — entrada nesta
// lista é decisão, e decisão sem motivo escrito volta a ser esquecimento.
const PUBLICAS = new Map([
  ["app/api/auth/[...nextauth]/route.ts", "o próprio NextAuth: é a porta de entrada"],
  ["app/api/saude/route.ts", "sonda de disponibilidade do Render, chamada sem sessão"],
]);

let falhas = 0;
function check(nome, ok, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

function rotas(dir) {
  const achadas = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
    const caminho = path.join(dir, entrada.name).split(path.sep).join("/");
    if (entrada.isDirectory()) achadas.push(...rotas(caminho));
    else if (entrada.name === "route.ts") achadas.push(caminho);
  }
  return achadas;
}

const encontradas = rotas(RAIZ);
check("há rotas para varrer", encontradas.length > 0, `${encontradas.length} encontradas`);

for (const rota of encontradas) {
  if (PUBLICAS.has(rota)) {
    console.log(`  PULA    ${rota} :: ${PUBLICAS.get(rota)}`);
    continue;
  }

  /*
   * DOIS PORTÕES, e a rota escolhe um.
   *
   * `requireActor` responde "de que escritório você é?"; `requirePlatformAdmin`
   * responde "você opera esta plataforma?". São perguntas diferentes, e
   * `/api/admin/*` precisa da segunda: administrador de plataforma pode não ser
   * membro de escritório nenhum, e o portão do escritório recusaria justamente
   * ele. Exigir o portão errado ali trancaria o mantenedor fora do painel.
   */
  const fonte = fs.readFileSync(rota, "utf8");
  const temPortao =
    fonte.includes("requireActor(") || fonte.includes("requirePlatformAdmin(");
  check(rota, temPortao, "não passa por portão nenhum");
}

/*
 * Exceção que sobrou na lista depois de a rota ter sumido vira permissão
 * esquecida: se um arquivo com aquele caminho voltar um dia, com outro
 * conteúdo, ele entra liberado sem ninguém ter decidido isso.
 */
for (const publica of PUBLICAS.keys()) {
  check(`exceção ainda existe: ${publica}`, fs.existsSync(publica), "remova da lista");
}

console.log(falhas === 0 ? "\nOK  nenhuma rota aberta" : `\n${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
