/**
 * A disciplina lida do cabeçalho da página. Núcleo PURO → node cru.
 *
 *   node scripts/test-disciplina-da-pagina.ts   (== npm run test:disciplina-da-pagina)
 *
 * O QUE ESTÁ EM JOGO
 *
 * Um capítulo ocupa várias páginas e só a primeira traz o título inteiro. Logo,
 * a regra tem de CARREGAR o que sabe adiante — e tem de parar de carregar na
 * hora certa. Errar para o lado de carregar demais é pior do que não saber:
 * "13 - CONSIDERAÇÕES FINAIS" viraria elétrica só por vir depois da elétrica, e
 * o documento inteiro herdaria a primeira disciplina que aparecesse. Metade
 * destes testes é sobre esse limite.
 */
import assert from "node:assert/strict";

import {
  disciplinaPorPagina,
  disciplinaDoAchado,
  disciplinaQueVale,
  disciplinasEnvolvidas,
} from "../lib/disciplina-da-pagina.ts";
import { classifyFindingDisciplines, disciplinaDoTexto, disciplinasNomeadas, type AuditFinding } from "../lib/audit-report.ts";

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

const pagina = (page: number, text: string) => ({ page, text });

test("o cabeçalho do capítulo dá a disciplina da página", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS o quadro geral de protecao sera instalado"),
  ]);
  assert.equal(mapa.get(1), "eletrico");
});

test("página sem cabeçalho HERDA o capítulo em vigor", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS texto de abertura do capitulo"),
    pagina(2, "os condutores serao de cobre com isolacao para 750V conforme projeto"),
    pagina(3, "as luminarias seguem o especificado em planilha anexa a este memorial"),
  ]);
  assert.equal(mapa.get(2), "eletrico");
  assert.equal(mapa.get(3), "eletrico");
});

test("capítulo NOVO sem disciplina zera — não herda o anterior", () => {
  /*
   * O caso que faria a regra contaminar o documento: uma vez achada a primeira
   * disciplina, ela valeria até o fim se o capítulo novo não a derrubasse.
   */
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS abertura"),
    pagina(2, "13 - CONSIDERACOES FINAIS o presente memorial encerra a descricao"),
    pagina(3, "as entregas seguem o cronograma pactuado em contrato entre as partes"),
  ]);
  assert.equal(mapa.get(1), "eletrico");
  assert.equal(mapa.get(2), undefined);
  assert.equal(mapa.get(3), undefined);
});

test("capítulo novo COM outra disciplina troca de verdade", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS abertura do capitulo de eletrica"),
    pagina(2, "13 - INSTALACOES HIDROSSANITARIAS agua fria e esgoto do conjunto"),
    pagina(3, "os ramais seguem embutidos em alvenaria conforme detalhe de projeto"),
  ]);
  assert.equal(mapa.get(1), "eletrico");
  assert.equal(mapa.get(2), "hidrossanitario");
  assert.equal(mapa.get(3), "hidrossanitario");
});

test("141-26: separatriz com o número do capítulo ANTERIOR não herda a disciplina dele", () => {
  // A separatriz dizia "8 PROJETO ELÉTRICO" e o cabeçalho de paisagismo, antes
  // dela, "8 – PROJETO DE PAISAGISMO": pelo número, a elétrica virava paisagismo.
  const mapa = disciplinaPorPagina([
    pagina(1, "8 – PROJETO DE PAISAGISMO\n8 PROJETO DE PAISAGISMO\n8.1 Considerações gerais"),
    pagina(2, "8 – PROJETO DE PAISAGISMO PATA DE VACA - Bauhinia forficata"),
    pagina(3, "8 PROJETO ELÉTRICO"),
    pagina(4, "9 – PROJETO ELÉTRICO\n9 PROJETO ELÉTRICO\n9.1 Objetivo"),
    pagina(5, "13 EQUIPE TÉCNICA"),
    pagina(6, "13 – EQUIPE TÉCNICA\nResponsável técnico"),
  ]);
  assert.equal(mapa.get(2), "paisagismo", "o mesmo título com sobra continua o mesmo capítulo");
  assert.equal(mapa.get(3), "eletrico");
  assert.equal(mapa.get(4), "eletrico");
  assert.equal(mapa.get(5), undefined, "título sem disciplina não herda a anterior");
});

test("página fora do mapa não vira 'geral' — vira ausência", () => {
  /*
   * A diferença importa: `undefined` deixa a inferência antiga responder;
   * "geral" seria uma afirmação sem base, e apagaria o fallback.
   */
  const mapa = disciplinaPorPagina([
    pagina(1, "texto corrido de abertura sem numero nem titulo de capitulo algum"),
  ]);
  assert.equal(mapa.get(1), undefined);
  assert.equal(mapa.size, 0);
});

test("o achado pega a disciplina pela página que cita", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "12 - INSTALACOES ELETRICAS abertura"),
    pagina(2, "continuacao do texto de eletrica sem cabecalho proprio nesta folha"),
  ]);
  assert.equal(disciplinaDoAchado("2", mapa), "eletrico");
});

test("intervalo de páginas vale pela primeira, como o pin do parecer", () => {
  const mapa = disciplinaPorPagina([
    pagina(4, "8 - PREVENCAO E COMBATE A INCENDIO hidrantes e extintores da edificacao"),
    pagina(5, "continuacao"),
  ]);
  assert.equal(disciplinaDoAchado("4-5", mapa), "ppci");
});

test("achado sem página não recebe disciplina", () => {
  const mapa = disciplinaPorPagina([pagina(1, "12 - INSTALACOES ELETRICAS abertura")]);
  assert.equal(disciplinaDoAchado("nao informada", mapa), undefined);
  assert.equal(disciplinaDoAchado(undefined, mapa), undefined);
});

test("achado numa página que o mapa não conhece cai no fallback", () => {
  const mapa = disciplinaPorPagina([pagina(1, "12 - INSTALACOES ELETRICAS abertura")]);
  assert.equal(disciplinaDoAchado("99", mapa), undefined);
});

test("documento vazio devolve mapa vazio", () => {
  assert.equal(disciplinaPorPagina([]).size, 0);
});

/*
 * O TÍTULO COMPOSTO — o defeito mais caro que estes testes não pegavam.
 *
 * Medido no memorial do 113-22 (21/08/2026): a página 28 diz "3 - PROJETO
 * ARQUITETÔNICO E URBANIZAÇÃO" e as 29 a 81 dizem "3 - PROJETO ARQUITETÔNICO",
 * limpo. Como é o MESMO capítulo 3, a continuidade não revisa o que já sabe —
 * e "urbaniza" casava antes de "arquitetonic" só porque a regra de
 * terraplenagem vem antes na lista. Resultado: 54 das 113 páginas mapeadas de
 * um memorial de hospital saíam como terraplenagem, e a tela as mostrava como
 * fato lido do documento.
 *
 * Os três casos juntos, porque o defeito é a INTERAÇÃO: o desempate errado
 * sozinho erra uma página, e é a continuidade que o espalha por cinquenta.
 */
test("título composto vale pelo substantivo da frente, não pela ordem das regras", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "3 - PROJETO ARQUITETONICO E URBANIZACAO abertura do capitulo"),
  ]);
  assert.equal(mapa.get(1), "arquitetura");
});

test("e o capítulo inteiro vai junto, e não só a página do título", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "3 - PROJETO ARQUITETONICO E URBANIZACAO abertura do capitulo"),
    pagina(2, "3 - PROJETO ARQUITETONICO as esquadrias seguem o especificado"),
    pagina(3, "3.1 Demolicoes e retiradas o construtor devera remover o existente"),
  ]);
  assert.equal(mapa.get(2), "arquitetura");
  assert.equal(mapa.get(3), "arquitetura");
});

test("mas urbanização SOZINHA é urbanização, e não arquitetura", () => {
  /*
   * A metade que impede a correção de virar "arquitetura sempre ganha": o
   * 117-25 tem "5 PROJETO DE URBANIZAÇÃO" como capítulo próprio. Até 05/10/2026
   * ele caía no balde "Terraplenagem / Urbanização", com chip TER — e quem lia
   * um achado do capítulo de urbanização via "terraplenagem" (141-26, ACH-006).
   */
  const mapa = disciplinaPorPagina([
    pagina(1, "5 - PROJETO DE URBANIZACAO camada de assentamento e meio-fio"),
  ]);
  assert.equal(mapa.get(1), "urbanizacao");
});

/*
 * A INFRAESTRUTURA SEPARADA (05/10/2026). O memorial do 141-26 tem um capítulo
 * para cada uma — terraplenagem, drenagem, pavimentação, sinalização,
 * urbanização — e as cinco caíam no mesmo chip TER (sinalização nem isso: ficava
 * sem disciplina nenhuma). Os títulos abaixo são os do documento.
 */
test("cada capítulo de infraestrutura do 141-26 vira a sua disciplina", () => {
  const casos: [string, string][] = [
    ["3 - TERRAPLENAGEM / DESENHO GEOMETRICO", "terraplenagem"],
    ["4 - PROJETO DE DRENAGEM", "drenagem"],
    ["5 - PAVIMENTACAO", "pavimentacao"],
    ["6 - PROJETO DE SINALIZACAO", "sinalizacao"],
    ["7 - PROJETO DE URBANIZACAO", "urbanizacao"],
  ];
  for (const [titulo, esperado] of casos) {
    const mapa = disciplinaPorPagina([pagina(1, `${titulo} abertura do capitulo`)]);
    assert.equal(mapa.get(1), esperado, titulo);
  }
});

test("saneamento é hidrossanitário, e não página sem disciplina", () => {
  // 141-26: "12 - PROJETO DE SANEAMENTO", 17 páginas que ficavam fora do mapa.
  const mapa = disciplinaPorPagina([pagina(1, "12 - PROJETO DE SANEAMENTO rede coletora de esgoto")]);
  assert.equal(mapa.get(1), "hidrossanitario");
});

/*
 * A DISCIPLINA QUE VALE, e o achado HERDADO.
 *
 * O herdado carrega o parecer anterior inteiro, `disciplina` incluída. Com a
 * gravada vencendo, um conserto na leitura de cabeçalho nunca alcançava um
 * herdado — e herdado é a maioria, porque 86 a 95% do texto se repete entre
 * revisões. Estes três fecham a inversão e o seu limite.
 */
test("sinalização de EMERGÊNCIA continua sendo PPCI, e não sinalização viária", () => {
  /*
   * A palavra nova casa demais se ninguém segurar: placa de rota de fuga é
   * incêndio. PPCI vem antes na lista, e é ela quem tem de responder.
   */
  assert.equal(disciplinaDoTexto("placas de sinalizacao de emergencia e rota de fuga"), "ppci");
  assert.equal(disciplinaDoTexto("tacha refletiva e faixa de pedestre na sinalizacao horizontal"), "sinalizacao");
});

test("a página vence a disciplina gravada", () => {
  const mapa = disciplinaPorPagina([
    pagina(1, "3 - PROJETO ARQUITETONICO E URBANIZACAO abertura do capitulo"),
  ]);
  // O que o parecer velho gravou, com a leitura antiga de cabecalho composto.
  assert.equal(disciplinaQueVale("terraplenagem", "1", mapa), "arquitetura");
});

test("mas a gravada volta quando a página não sabe", () => {
  const mapa = disciplinaPorPagina([pagina(1, "12 - INSTALACOES ELETRICAS abertura")]);
  // Pagina 99 esta fora do mapa: rederivar nao pode APAGAR o que se sabia.
  assert.equal(disciplinaQueVale("hidrossanitario", "99", mapa), "hidrossanitario");
  assert.equal(disciplinaQueVale("hidrossanitario", "1", undefined), "hidrossanitario");
});

test("e achado novo não muda de caminho", () => {
  const mapa = disciplinaPorPagina([pagina(1, "12 - INSTALACOES ELETRICAS abertura")]);
  // Sem gravada (o modelo nao emite o campo), os dois caminhos coincidem.
  assert.equal(disciplinaQueVale(undefined, "1", mapa), "eletrico");
  assert.equal(disciplinaQueVale(undefined, "99", mapa), undefined);
});

// --- Achado de várias disciplinas (15/10/2026) --------------------------------

test("as outras páginas citadas trazem as disciplinas delas", () => {
  const mapa = disciplinaPorPagina([
    pagina(70, "3 - PROJETO ARQUITETONICO esquadrias"),
    pagina(123, "9 - PROJETO HIDROSSANITARIO agua quente"),
  ]);
  assert.deepEqual(disciplinasEnvolvidas([70, 123], "arquitetura", mapa), ["hidrossanitario"]);
  // Nem a principal, nem repetida, nem página fora do mapa.
  assert.deepEqual(disciplinasEnvolvidas([70, 70, 999], "arquitetura", mapa), []);
  assert.deepEqual(disciplinasEnvolvidas([70, 123], "arquitetura", undefined), []);
});

const achado = (campos: Partial<AuditFinding>): AuditFinding => ({
  id: "INC-1", prioridade: "Media", pagina: "70", capitulo: "", local: "", tipo: "", descricao: "",
  evidencia: "", conflito: "", sugestao_correcao: "", confianca: "alta", ...campos,
});

test("a prosa que NOMEIA outra disciplina a envolve", () => {
  const a = achado({
    disciplina: "arquitetura",
    descricao: "A arquitetura prevê aquecimento elétrico local, enquanto o hidrossanitário declara que não há instalação de água quente.",
  });
  // "aquecimento elétrico" é assunto, não o projeto elétrico.
  assert.deepEqual(classifyFindingDisciplines(a), ["arquitetura", "hidrossanitario"]);
});

test("a evidência (palavras do memorial) não envolve ninguém", () => {
  const a = achado({ disciplina: "eletrico", evidencia: "bancada em granito conforme projeto arquitetônico" });
  assert.deepEqual(classifyFindingDisciplines(a), ["eletrico"]);
});

test("gravada pelo servidor + nomeada, sem repetir, principal primeiro", () => {
  const a = achado({ disciplina: "eletrico", disciplinas_envolvidas: ["climatizacao"], conflito: "o capítulo de climatização e o projeto elétrico divergem" });
  assert.deepEqual(classifyFindingDisciplines(a), ["eletrico", "climatizacao"]);
});

test("'geral' cede a frente quando alguma disciplina aparece", () => {
  const a = achado({ descricao: "Hierarquia documental contraditória.", disciplinas_envolvidas: ["ppci"] });
  assert.deepEqual(classifyFindingDisciplines(a), ["ppci"]);
});

test("nomes, não vocabulário: pavimento e estrutura soltos não contam", () => {
  assert.deepEqual(disciplinasNomeadas("Centro Cirúrgico no 2º pavimento, estrutura existente"), []);
  assert.deepEqual(disciplinasNomeadas("O projeto estrutural e a pavimentação"), ["estrutural", "pavimentacao"]);
});

console.log(`
${passed} teste(s) OK`);
