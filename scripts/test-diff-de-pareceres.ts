/**
 * O diff entre duas auditorias do mesmo memorial. Núcleo PURO → node cru.
 *
 *   node scripts/test-diff-de-pareceres.ts   (== npm run test:diff-de-pareceres)
 *
 * O QUE ESTES TESTES PROTEGEM
 *
 * A comparação depende inteiramente de UMA escolha: qual é a identidade de um
 * achado entre versões. Errar essa chave não dá erro nenhum — dá um resumo
 * plausível e falso, do tipo "5 achados saíram e 5 achados novos" para um
 * parecer que não mudou. Por isso metade daqui prova que a chave IGNORA o que
 * se move entre revisões (id e página) e OLHA o que descreve o defeito (tipo e
 * trecho).
 */
import assert from "node:assert/strict";

import {
  compararPareceres,
  resumoDoDiff,
  chaveEntreVersoes,
} from "../lib/diff-de-pareceres.ts";
import type { AuditFinding, AuditReport } from "../lib/audit-report.ts";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FALHOU  ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const achado = (p: Partial<AuditFinding>): AuditFinding => ({
  id: "INC-001",
  prioridade: "Media",
  pagina: "10",
  capitulo: "cap",
  local: "local",
  tipo: "Divergência",
  descricao: "d",
  evidencia: "o reservatorio tem 10 m3 de capacidade",
  conflito: "c",
  sugestao_correcao: "s",
  confianca: "alta",
  ...p,
});

const parecer = (incongruencias: AuditFinding[]): AuditReport =>
  ({
    tipo_auditoria: "memorial",
    tipo_documento: "memorial descritivo",
    total_incongruencias: incongruencias.length,
    arquivos_analisados: [],
    comparacoes: [],
    conclusao: "",
    incongruencias,
  }) as unknown as AuditReport;

// --- a chave: o que ela ignora, e o que ela olha ----------------------------

test("o ID não entra na chave — ele é posicional e reordena a cada parecer", () => {
  /*
   * `INC-001` sai da ordenação do parecer. A mesma ocorrência vira `INC-004`
   * quando três achados mais graves entram na frente. Casar por id diria que
   * tudo foi corrigido e tudo é novo ao mesmo tempo.
   */
  const a = achado({ id: "INC-001" });
  const b = achado({ id: "INC-047" });
  assert.equal(chaveEntreVersoes(a), chaveEntreVersoes(b));
});

test("a PÁGINA não entra na chave — corrigir um memorial mexe na paginação", () => {
  // Um parágrafo removido no capítulo 3 desce todo o resto do documento.
  const a = achado({ pagina: "40" });
  const b = achado({ pagina: "39" });
  assert.equal(chaveEntreVersoes(a), chaveEntreVersoes(b));
});

test("o TIPO entra: mesmo trecho, defeito diferente, achado diferente", () => {
  const a = achado({ tipo: "Quantitativo divergente" });
  const b = achado({ tipo: "Norma desatualizada" });
  assert.notEqual(chaveEntreVersoes(a), chaveEntreVersoes(b));
});

test("o TRECHO entra: trecho mudou, o achado antigo deixou de existir", () => {
  const a = achado({ evidencia: "o reservatorio tem 10 m3" });
  const b = achado({ evidencia: "o reservatorio tem 15 m3" });
  assert.notEqual(chaveEntreVersoes(a), chaveEntreVersoes(b));
});

test("acento e caixa não separam o que é a mesma coisa", () => {
  const a = achado({ tipo: "Divergência", evidencia: "Área Construída" });
  const b = achado({ tipo: "DIVERGENCIA", evidencia: "area construida" });
  assert.equal(chaveEntreVersoes(a), chaveEntreVersoes(b));
});

// --- a comparação ----------------------------------------------------------

test("parecer idêntico: tudo persiste, nada sai, nada entra", () => {
  const p = parecer([achado({ id: "INC-001" }), achado({ id: "INC-002", tipo: "Outro" })]);
  const d = compararPareceres({ anterior: p, atual: p });
  assert.equal(d.persistentes.length, 2);
  assert.equal(d.corrigidos.length, 0);
  assert.equal(d.novos.length, 0);
});

test("achado que sumiu conta como corrigido", () => {
  const antes = parecer([achado({ tipo: "A" }), achado({ tipo: "B" })]);
  const agora = parecer([achado({ tipo: "A" })]);
  const d = compararPareceres({ anterior: antes, atual: agora });
  assert.deepEqual(d.corrigidos.map((f) => f.tipo), ["B"]);
  assert.equal(d.persistentes.length, 1);
  assert.equal(d.novos.length, 0);
});

test("achado que apareceu conta como novo", () => {
  const antes = parecer([achado({ tipo: "A" })]);
  const agora = parecer([achado({ tipo: "A" }), achado({ tipo: "C" })]);
  const d = compararPareceres({ anterior: antes, atual: agora });
  assert.deepEqual(d.novos.map((f) => f.tipo), ["C"]);
  assert.equal(d.corrigidos.length, 0);
});

test("o mesmo achado que mudou de página e de id CONTINUA de pé", () => {
  // O caso realista de uma revisão: o defeito não foi tocado, o documento sim.
  const antes = parecer([achado({ id: "INC-001", pagina: "40" })]);
  const agora = parecer([achado({ id: "INC-013", pagina: "37" })]);
  const d = compararPareceres({ anterior: antes, atual: agora });
  assert.equal(d.persistentes.length, 1);
  assert.equal(d.corrigidos.length, 0);
  assert.equal(d.novos.length, 0);
});

test("primeira auditoria (anterior vazio): tudo é novo", () => {
  const d = compararPareceres({ anterior: parecer([]), atual: parecer([achado({})]) });
  assert.equal(d.novos.length, 1);
  assert.equal(d.corrigidos.length, 0);
});

test("memorial zerado: tudo saiu", () => {
  const d = compararPareceres({ anterior: parecer([achado({})]), atual: parecer([]) });
  assert.equal(d.corrigidos.length, 1);
  assert.equal(d.persistentes.length, 0);
});

test("duplicata no parecer anterior não infla os corrigidos", () => {
  /*
   * Dois achados com o mesmo tipo e o mesmo trecho são a mesma coisa dita duas
   * vezes. Contá-los em dobro diria "2 saíram" quando saiu um.
   */
  const antes = parecer([achado({ id: "INC-001" }), achado({ id: "INC-002" })]);
  const d = compararPareceres({ anterior: antes, atual: parecer([]) });
  assert.equal(d.corrigidos.length, 1);
});

// --- o termo de busca: o caminho que reconhece o mesmo defeito reescrito -------

test("tipo e moldura reescritos, mesmo termo de busca: CONTINUA (o laço do 040_26)", () => {
  /*
   * Quatro voltas de corrigir e reauditar deram "0 continuam" com a NBR 7191
   * apontada em todas: o modelo trocou "Edição normativa a validar" por
   * "Vigência de norma a confirmar" e recitou a evidência de outro jeito.
   */
  const antes = parecer([achado({ tipo: "Edição normativa a validar", evidencia: "Pág. 2: “ABNT NBR 7191:1982 - Execução”", termo_busca: "ABNT NBR 7191:1982" })]);
  const agora = parecer([achado({ tipo: "Vigência de norma a confirmar", evidencia: "“• ABNT NBR 7191:1982”", termo_busca: "ABNT NBR 7191:1982" })]);
  const d = compararPareceres({ anterior: antes, atual: agora });
  assert.equal(d.persistentes.length, 1);
  assert.equal(d.novos.length, 0);
  assert.equal(d.corrigidos.length, 0);
});

test("termo contido conta: «mínimo de 60» × «mínimo de 60 minutos»", () => {
  const antes = parecer([achado({ tipo: "Premissa de resistência ao fogo", termo_busca: "mínimo de 60 minutos" })]);
  const agora = parecer([achado({ tipo: "Premissa de TRRF", evidencia: "outra", termo_busca: "mínimo de 60" })]);
  assert.equal(compararPareceres({ anterior: antes, atual: agora }).persistentes.length, 1);
});

test("termo contido com mais contexto, MESMA página: continua (volta 5 do laço)", () => {
  const antes = parecer([achado({ tipo: "Premissas do TRRF", pagina: "6", termo_busca: "resistência ao fogo com o mínimo de 60" })]);
  const agora = parecer([achado({ tipo: "Enquadramento do TRRF", pagina: "6", evidencia: "outra", termo_busca: "mínimo de 60" })]);
  assert.equal(compararPareceres({ anterior: antes, atual: agora }).persistentes.length, 1);
});

test("termo contido sem proporção em OUTRA página: não casa", () => {
  // Par real do banco de dev: numeração de capítulo × acentuação — defeitos distintos.
  const antes = parecer([achado({ tipo: "Numeração de capítulos", pagina: "3", termo_busca: "8. DISPOSICOES COMPLEMENTARES" })]);
  const agora = parecer([achado({ tipo: "Acentuação e grafia", pagina: "9", evidencia: "outra", termo_busca: "DISPOSICOES" })]);
  const d = compararPareceres({ anterior: antes, atual: agora });
  assert.equal(d.persistentes.length, 0);
  assert.equal(d.novos.length, 1);
});

test("um achado antigo não 'continua' em dois novos diferentes", () => {
  const antes = parecer([achado({ tipo: "A", termo_busca: "relatório de sondagem SPT" })]);
  const agora = parecer([
    achado({ tipo: "B", evidencia: "x", termo_busca: "relatório de sondagem SPT" }),
    achado({ tipo: "C", evidencia: "y", termo_busca: "relatório de sondagem SPT" }),
  ]);
  const d = compararPareceres({ anterior: antes, atual: agora });
  assert.equal(d.persistentes.length, 1);
  assert.equal(d.novos.length, 1);
});

// --- o texto anterior: "já estava lá" × "texto alterado" ---------------------

test("com o texto anterior, o novo se divide entre 'já estava lá' e 'texto alterado'", () => {
  const textoAnterior = "1.6 Aço\nEstas serão amarradas com arame preto no. 16 ou 18.";
  const agora = parecer([
    achado({ tipo: "Especificação divergente", termo_busca: "arame preto no. 16 ou 18" }),
    achado({ tipo: "Norma nova a validar", evidencia: "z", termo_busca: "ABNT NBR 14931:2004" }),
  ]);
  const d = compararPareceres({ anterior: parecer([]), atual: agora, textoAnterior });
  assert.deepEqual(d.novosEmTextoQueJaExistia?.map((f) => f.tipo), ["Especificação divergente"]);
  assert.deepEqual(d.novosEmTextoAlterado?.map((f) => f.tipo), ["Norma nova a validar"]);
});

test("sem trecho reconhecível o novo não vai para lado nenhum — atribuir seria chute", () => {
  const d = compararPareceres({
    anterior: parecer([]),
    atual: parecer([achado({ evidencia: "sem aspas", termo_busca: "" })]),
    textoAnterior: "qualquer texto",
  });
  assert.equal(d.novos.length, 1);
  assert.equal(d.novosEmTextoQueJaExistia?.length, 0);
  assert.equal(d.novosEmTextoAlterado?.length, 0);
});

test("sem o texto anterior, a divisão não existe (e não finge que existe)", () => {
  const d = compararPareceres({ anterior: parecer([]), atual: parecer([achado({ termo_busca: "arame preto no. 16" })]) });
  assert.equal(d.novosEmTextoQueJaExistia, undefined);
  assert.equal(d.novosEmTextoAlterado, undefined);
});

// --- o que saiu: corrigido × não reapontado ---------------------------------

test("saiu com o trecho igual no texto atual: não foi corrigido (volta 5 do laço)", () => {
  const antes = parecer([
    achado({ tipo: "Vigência de norma", evidencia: "“ABNT NBR 7191:1982 - Execução de Desenhos”", termo_busca: "ABNT NBR 7191:1982" }),
    achado({ tipo: "Redundância", evidencia: "“ou então na ocorrência delas”", termo_busca: "ou então na ocorrência delas" }),
  ]);
  const textoAtual = "• ABNT NBR 7191:1982 - Execução de\nDesenhos para Obras\n... quando houver iminência ou ocorrência de chuvas.";
  const d = compararPareceres({ anterior: antes, atual: parecer([]), textoAtual });
  assert.equal(d.corrigidos.length, 2);
  assert.deepEqual(d.saidosComTrechoIgual?.map((f) => f.tipo), ["Vigência de norma"]);
});

test("aspas curtas no meio da evidência não viram o trecho (o “α” da volta 7)", () => {
  const antes = parecer([
    achado({
      tipo: "Critério de solo",
      evidencia: "deve fazer com a vertical um ângulo “α” com os valores:\na) Solos pouco resistentes: α > 60º",
      termo_busca: "Solos pouco resistentes",
    }),
  ]);
  const textoAtual = "a reta deve fazer com a vertical um ângulo “α” com os valores:\na) Solos pouco resistentes: α > 60º\nb) …";
  const d = compararPareceres({ anterior: antes, atual: parecer([]), textoAtual });
  assert.equal(d.saidosComTrechoIgual?.length, 1);
});

test("corrigir crase ou concordância CONTA como corrigido (o esqueleto enganava)", () => {
  /*
   * Sem acento e sem espaço, "a compressão" e "à compressão" são a mesma
   * coisa, e "pilares apresentado" é prefixo de "apresentados": o teste por
   * esqueleto dizia "trecho igual" para correções feitas.
   */
  const antes = parecer([
    achado({ tipo: "Crase", evidencia: "Qualquer não conformidade ocorrida com a resistência a compressão do concreto" }),
    achado({ tipo: "Concordância", evidencia: "“baseado nos pilares apresentado pelo projeto”" }),
  ]);
  const textoAtual = "Qualquer não conformidade ocorrida com a resistência à compressão do concreto; baseado nos pilares apresentados pelo projeto";
  const d = compararPareceres({ anterior: antes, atual: parecer([]), textoAtual });
  assert.equal(d.saidosComTrechoIgual?.length, 0);
});

// --- a frase da tela -------------------------------------------------------

test("resumo vazio quando nada mudou e nada sobrou", () => {
  assert.equal(resumoDoDiff({ corrigidos: [], persistentes: [], novos: [] }), "");
});

test("o resumo diz as três coisas, na ordem do trabalho", () => {
  const frase = resumoDoDiff({
    corrigidos: [achado({}), achado({})],
    novos: [achado({})],
    persistentes: [achado({}), achado({}), achado({})],
  });
  assert.equal(frase, "2 achados saíram · 1 achado novo · 3 continuam de pé");
});

test("singular e plural concordam", () => {
  assert.equal(
    resumoDoDiff({ corrigidos: [achado({})], novos: [], persistentes: [achado({})] }),
    "1 achado saiu · 1 continua de pé",
  );
});

console.log(`\n${passed} teste(s) OK`);
