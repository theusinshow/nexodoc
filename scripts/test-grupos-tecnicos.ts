// Grupo técnico da disciplina, e o que cada disciplina gera.
//
//   node scripts/test-grupos-tecnicos.ts   (== npm run test:grupos)
//
// Vem da tabela que o escritório padronizou em 14/08/2026. Dois casos carregam
// o desenho inteiro:
//
//  · SONDAGEM NÃO TEM LD. É a única exceção real dos três booleanos da tabela,
//    e é por isso que eles são modelados como negativa em vez de três "sim"
//    repetidos dezesseis vezes;
//  · ACHADO "GERAL" NÃO TEM GRUPO. É o caso mais comum — a disciplina do achado
//    sai de varredura de texto —, e quem consome isto tem de continuar
//    funcionando sem grupo, nunca escondendo gente da lista.
import {
  DISCIPLINAS,
  GRUPO_INFERIDO,
  grupoDaDisciplina,
  grupoDaDisciplinaDoAchado,
  temCapa,
  temLd,
  temSeparatriz,
} from "../server/nexo/disciplinas.ts";

let falhas = 0;
function check(nome: string, ok: boolean, detalhe = "") {
  if (ok) console.log(`  OK      ${nome}`);
  else {
    falhas++;
    console.error(`  FALHOU  ${nome}${detalhe ? ` :: ${detalhe}` : ""}`);
  }
}

// --- O que a tabela do escritório diz, conferido código a código.
check("hidrossanitario e de complementares", grupoDaDisciplina("his") === "complementares");
check("estrutural metalico e de estrutural", grupoDaDisciplina("met") === "estrutural");
check("urbanismo e de arquitetura", grupoDaDisciplina("urb") === "arquitetura");
check("topografia e externo", grupoDaDisciplina("top") === "externo");
check(
  "e climatizacao tambem e externo, como a tabela diz",
  grupoDaDisciplina("cli") === "externo",
  grupoDaDisciplina("cli"),
);

// --- Maiúscula não pode mudar a resposta: o código vem de nome de arquivo.
check("o codigo e lido sem depender de caixa", grupoDaDisciplina("HIS") === "complementares");

// --- Código desconhecido não inventa grupo.
check("codigo desconhecido nao tem grupo", grupoDaDisciplina("zzz") === undefined);

// --- A ÚNICA exceção dos três booleanos.
check("sondagem NAO tem LD", temLd("snd") === false);
check("mas tem separatriz", temSeparatriz("snd") === true);
check("e tem capa", temCapa("snd") === true);
check("arquitetonico tem os tres", temLd("arq") && temSeparatriz("arq") && temCapa("arq"));

/*
 * DESCONHECIDA RESPONDE SIM, e o custo dos dois erros é assimétrico: uma LD a
 * mais é uma aba que se fecha; uma a menos é documento faltando no volume que
 * foi entregue.
 */
check("disciplina desconhecida gera LD", temLd("zzz") === true);

// --- Nenhuma disciplina pode ficar sem grupo: a lista é fechada.
const semGrupo = Object.entries(DISCIPLINAS).filter(([, d]) => !d.grupo);
check("toda disciplina do lexico tem grupo", semGrupo.length === 0, semGrupo.map(([c]) => c).join(","));

/*
 * OS INFERIDOS ESTÃO DECLARADOS. Oito códigos do léxico não estão na tabela do
 * escritório e foram classificados por família — isso é chute educado, e a lista
 * existe para que corrigir um deles não pareça contrariar o escritório.
 */
check("os inferidos estao registrados", GRUPO_INFERIDO.size === 8, `${GRUPO_INFERIDO.size}`);
check("e 'his' NAO e inferido, veio da tabela", !GRUPO_INFERIDO.has("his"));
check("enquanto 'fnd' e inferido", GRUPO_INFERIDO.has("fnd"));

// --- A ponte entre o vocabulário do ACHADO e o do léxico.
check(
  "achado hidrossanitario cai em complementares",
  grupoDaDisciplinaDoAchado("hidrossanitario") === "complementares",
);
check("achado de ppci tambem", grupoDaDisciplinaDoAchado("ppci") === "complementares");
check("achado de paisagismo cai em arquitetura", grupoDaDisciplinaDoAchado("paisagismo") === "arquitetura");

/*
 * O CASO QUE MAIS ACONTECE. `classifyFindingDiscipline` cai em "geral" quando a
 * varredura não reconhece nada, e "geral" não pode virar um grupo — se virasse,
 * a lista de destinatários seria ordenada por um palpite.
 */
check("achado 'geral' NAO tem grupo", grupoDaDisciplinaDoAchado("geral") === undefined);

if (falhas > 0) {
  console.error(`\nFALHOU  grupos tecnicos (${falhas})`);
  process.exit(1);
}

console.log("\nOK  grupos tecnicos");
