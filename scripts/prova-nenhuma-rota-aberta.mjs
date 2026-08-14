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

/*
 * OS PORTÕES RECONHECIDOS, e são dois — porque são duas perguntas.
 *
 * `requireActor` responde "de que escritório você é?". `requirePlatformAdmin`
 * responde "você opera esta plataforma?", e é o de `/api/admin/*`: quem
 * administra a plataforma pode não ser membro de escritório nenhum, e o portão
 * do escritório recusaria justamente essa pessoa — trancando o mantenedor fora
 * do próprio painel.
 *
 * `checkAdminRequest` é o embrulho que soma o portão de plataforma ao token, e
 * é o que as rotas administrativas chamam de fato. Está aqui porque a lista é
 * de PORTÕES, não de funções — quem acrescentar um terceiro portão acrescenta
 * o nome aqui, e essa é a decisão que esta prova quer ver explícita.
 */
const PORTOES = ["requireActor(", "requirePlatformAdmin(", "checkAdminRequest("];

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

/*
 * POR HANDLER, e não por arquivo.
 *
 * A primeira versão perguntava se o PORTÃO aparecia no arquivo. Isso deixou
 * passar um caso real: `app/api/projects/route.ts` tinha o portão no `GET` e
 * não no `POST` — e o `POST` era o que criava projeto lendo `organizationId` do
 * corpo da requisição. Um handler protegido servia de álibi para o vizinho
 * aberto.
 *
 * `OPTIONS` fica de fora: é o preflight de CORS, o navegador não manda cookie
 * nele, e exigir sessão ali quebraria a chamada seguinte sem proteger nada.
 */
const METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function corposDosHandlers(fonte) {
  const achados = [];

  for (const metodo of METODOS) {
    const marca = `export async function ${metodo}`;
    let de = fonte.indexOf(marca);

    while (de !== -1) {
      // pula a lista de parâmetros contando parênteses: as assinaturas trazem
      // tipos aninhados como `{ params }: { params: Promise<{ id: string }> }`.
      let i = fonte.indexOf("(", de);
      let prof = 0;
      while (i < fonte.length) {
        if (fonte[i] === "(") prof += 1;
        else if (fonte[i] === ")" && --prof === 0) break;
        i += 1;
      }

      const abre = fonte.indexOf("{", i);
      let fim = abre;
      prof = 0;
      while (fim < fonte.length) {
        if (fonte[fim] === "{") prof += 1;
        else if (fonte[fim] === "}" && --prof === 0) break;
        fim += 1;
      }

      achados.push({ metodo, corpo: fonte.slice(abre, fim + 1) });
      de = fonte.indexOf(marca, fim);
    }
  }

  return achados;
}

/*
 * Guardas locais contam.
 *
 * Extrair a checagem para uma função no mesmo arquivo (`ensureAdmin`, `guarda`,
 * `executarAuditoria`) é boa prática, não fuga: é o que impede a sétima cópia
 * de sair diferente das outras seis. Exigir a chamada literal dentro de cada
 * handler premiaria a duplicação — e duplicação é exatamente a origem do
 * problema que esta prova existe para pegar.
 *
 * Um nível de indireção basta. Guarda que chama guarda que chama portão é
 * indireção demais para uma regra de acesso: quem precisar disso que escreva o
 * porquê e acrescente o nível aqui, deliberadamente.
 */
function guardasLocais(fonte) {
  const nomes = new Set();
  const declaracao = /(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g;

  let m;
  while ((m = declaracao.exec(fonte)) !== null) {
    if (METODOS.includes(m[1])) continue;

    const abre = fonte.indexOf("{", declaracao.lastIndex);
    if (abre === -1) continue;

    let fim = abre;
    let prof = 0;
    while (fim < fonte.length) {
      if (fonte[fim] === "{") prof += 1;
      else if (fonte[fim] === "}" && --prof === 0) break;
      fim += 1;
    }

    const corpo = fonte.slice(abre, fim + 1);
    if (PORTOES.some((portao) => corpo.includes(portao))) nomes.add(m[1]);
  }

  return [...nomes];
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

  const fonte = fs.readFileSync(rota, "utf8");
  const handlers = corposDosHandlers(fonte);

  if (handlers.length === 0) {
    check(rota, false, "nenhum handler exportado reconhecido");
    continue;
  }

  const guardas = guardasLocais(fonte).map((nome) => `${nome}(`);
  const aceitos = [...PORTOES, ...guardas];

  for (const { metodo, corpo } of handlers) {
    const temPortao = aceitos.some((marca) => corpo.includes(marca));
    check(`${rota} ${metodo}`, temPortao, "não passa por portão nenhum");
  }
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
