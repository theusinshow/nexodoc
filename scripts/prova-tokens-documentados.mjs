// O FISCAL DO §12: todo token de VOCABULÁRIO definido em `globals.css` tem de
// estar nomeado no `DESIGN.md`.
//
// A regra do §12 sempre esteve escrita — "token novo nasce com nome, valor e
// trabalho declarado" — e mesmo assim quatro famílias inteiras (`--signal-*`,
// `--legacy*`, `--discipline-*`, `--data-*`) entraram no CSS enquanto o
// documento continuava a chamá-las de "vagas abertas, nenhuma com valor
// decidido". Regra sem fiscal é intenção.
//
// SÓ CSS → DOCUMENTO, nunca o contrário. O DESIGN.md cita `--status-danger`
// como exemplo do que NÃO existe ("qualquer referência a eles é bug"), e uma
// checagem reversa acusaria o próprio contra-exemplo. Token documentado a mais
// é assunto de revisão humana; token no CSS a menos no documento é a
// dessincronia que já aconteceu de verdade.
//
// VOCABULÁRIO, não toda variável. Neutro, raio e duração são gramática — mudam
// sem mudar o que o produto DIZ. Cor com semântica é vocabulário, e é o que o
// §2 tem de listar.
//
//   node scripts/prova-tokens-documentados.mjs   (== npm run prova:tokens)
import { readFileSync } from "node:fs";

/** As famílias que o §2 tem de nomear. Prefixo, não nome exato. */
const FAMILIAS = [
  "--status-",
  "--signal-",
  "--legacy",
  "--discipline-",
  "--data-",
  "--nexo-marca-",
  "--prefeitura-",
];

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const design = readFileSync(new URL("../DESIGN.md", import.meta.url), "utf8");

/*
 * Só DEFINIÇÃO (`--x: valor`), no começo da linha. `var(--x)` no meio de uma
 * regra é consumo, e o bloco `@theme` do Tailwind v4 redefine cada token como
 * `--color-signal-info: var(--signal-info)` — que é ponte, não vocabulário, e
 * fica de fora porque nenhum prefixo da lista casa com `--color-`.
 */
const definidos = new Set();
for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) {
  const nome = m[1];
  if (FAMILIAS.some((f) => nome.startsWith(f))) definidos.add(nome);
}

if (definidos.size === 0) {
  console.error("FALHOU  nenhum token de vocabulário encontrado em globals.css");
  console.error("        (a regex de definição quebrou, ou o arquivo mudou de forma)");
  process.exit(1);
}

const ausentes = [...definidos].filter((t) => !design.includes(t)).sort();

if (ausentes.length > 0) {
  console.error(`FALHOU  ${ausentes.length} token(s) no CSS e ausente(s) no DESIGN.md:\n`);
  for (const t of ausentes) console.error(`  ${t}`);
  console.error("\nDESIGN.md §12: token novo nasce com nome, valor e trabalho declarado.");
  console.error("Documente-os no §2 (cores) ou remova-os do CSS.");
  process.exit(1);
}

console.log(`  ok  ${definidos.size} token(s) de vocabulário, todos nomeados no DESIGN.md`);

/*
 * O LITERAL DO POPUP CONTRA O TOKEN.
 *
 * A regra `select option, select optgroup` usa hex cru de propósito: o popup é
 * superfície que o app não possui e pode não resolver `var()` — ver o comentário
 * dela em `globals.css`.
 *
 * O preço de um literal é ele envelhecer calado. Mudar `--card` no `:root` e
 * deixar o popup no valor velho não quebra nada visível AQUI; quebra lá dentro,
 * na única superfície do produto que ninguém consegue fotografar. Este fiscal é
 * o que paga esse preço.
 *
 * DEPOIS do desfecho acima, e não antes: aquele bloco sai com `process.exit(1)`,
 * e um fiscal posto antes dele simplesmente não rodaria quando mais importa.
 */
function valorDoToken(nome) {
  const m = new RegExp("--" + nome + ":\\s*(#[0-9a-fA-F]{3,8})\\s*;").exec(css);
  return m ? m[1].toLowerCase() : null;
}

const regraDoPopup = /select option,\s*select optgroup\s*\{([^}]*)\}/.exec(css);

if (!regraDoPopup) {
  console.error("FALHOU  a regra `select option, select optgroup` sumiu de globals.css.");
  console.error("        Ela é a segunda defesa contra o branco-sobre-branco do popup.");
  process.exit(1);
}

const corpoDoPopup = regraDoPopup[1];
const fundoDoPopup = /background-color:\s*(#[0-9a-fA-F]{3,8})/
  .exec(corpoDoPopup)?.[1]
  ?.toLowerCase();
const textoDoPopup = /(?<!-)\bcolor:\s*(#[0-9a-fA-F]{3,8})/
  .exec(corpoDoPopup)?.[1]
  ?.toLowerCase();
const tokenCard = valorDoToken("card");
const tokenFg = valorDoToken("foreground");
let literalDivergiu = false;

if (fundoDoPopup !== tokenCard) {
  console.error(`FALHOU  o popup do select pinta ${fundoDoPopup}, e --card é ${tokenCard}.`);
  console.error("        O literal envelheceu. Ver o comentário da regra em globals.css.");
  literalDivergiu = true;
}

if (textoDoPopup !== tokenFg) {
  console.error(`FALHOU  o texto do popup é ${textoDoPopup}, e --foreground é ${tokenFg}.`);
  console.error("        O literal envelheceu. Ver o comentário da regra em globals.css.");
  literalDivergiu = true;
}

if (literalDivergiu) process.exit(1);

console.log(`  ok  o literal do popup bate com os tokens (${tokenCard} / ${tokenFg})`);
