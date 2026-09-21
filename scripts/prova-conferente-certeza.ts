/**
 * A CERTEZA MEDIDA CONTRA ACHADO REAL — Encaixe 3.
 *
 *   node scripts/prova-conferente-certeza.ts   (== npm run prova:conferente-certeza)
 *
 * POR QUE ESTA PROVA EXISTE
 *
 * O Encaixe 3 troca a certeza que o modelo declarou sobre si por uma medida. A
 * troca só vale se a medida SEPARAR o que a declarada não separa — e a
 * declarada não separa nada: no 129-24 os quatro achados que se auto-retratam
 * ("Sem correção obrigatória por conflito") chegaram com a mesma `confianca`
 * dos que estão certos. Se o conferente devolver a mesma nota para os dois
 * grupos, o encaixe não serve e é melhor saber agora.
 *
 * O GABARITO É MEU, NÃO DO MODELO. Todo caso abaixo foi conferido por mim
 * contra o texto extraído do PDF, palavra por palavra, em 21/09/2026:
 *  - os REAIS existem na página citada e o defeito é objetivo;
 *  - os RETRATADOS são achados cujo próprio texto de ação diz que não há o que
 *    corrigir — o motor os numerou mesmo assim;
 *  - os FALSOS são os falsos positivos já escritos nos comentários do código
 *    (117-25 e 084-25), que hoje passam blindados por serem achado de regra.
 *
 * CUSTA TOKEN, e pouco: ~13 chamadas de ~500 tokens de entrada, com saída
 * gratuita. Menos de US$ 0,001 a corrida inteira.
 */
import assert from "node:assert/strict";

import type { AuditFinding } from "../lib/audit-report.ts";
import { conferenteEstaConfigurado } from "../lib/conferente/jev.ts";
import { grauDaCerteza, medirCertezaDoAchado } from "../lib/conferente/encaixe-3-certeza.ts";

type Caso = {
  rotulo: string;
  gabarito: "real" | "retratado" | "falso";
  finding: AuditFinding;
};

function achado(partial: Partial<AuditFinding>): AuditFinding {
  return {
    id: partial.id ?? "X-000",
    arquivo: "memorial.pdf",
    origem: "ia",
    confianca: "alta",
    prioridade: "Media",
    pagina: partial.pagina ?? "1",
    capitulo: partial.capitulo ?? "",
    local: partial.local ?? "",
    tipo: partial.tipo ?? "",
    descricao: partial.descricao ?? "",
    evidencia: partial.evidencia ?? "",
    conflito: partial.conflito ?? "",
    sugestao_correcao: partial.sugestao_correcao ?? "",
    ...partial,
  } as AuditFinding;
}

const CASOS: Caso[] = [
  // ---- REAIS: conferidos no PDF, defeito objetivo no próprio trecho --------
  {
    rotulo: "129-24 · 0,254 microns de cobre (erro de 1000x)",
    gabarito: "real",
    finding: achado({
      id: "R-001",
      pagina: "48 e 54",
      capitulo: "7 PROJETO ELÉTRICO",
      local: "7.4.2 Aterramento",
      tipo: "Espessura de revestimento com unidade incorreta",
      evidencia: '"o revestimento da camada de cobre deverá ter espessura de 0,254 microns"',
      conflito: 'Págs. 48 e 54: "espessura de 0,254 microns". A NBR 13571 exige 254 µm.',
    }),
  },
  {
    rotulo: "129-24 · Fck=30MPa ou 300kg/m²",
    gabarito: "real",
    finding: achado({
      id: "R-002",
      pagina: "34",
      tipo: "Unidade de resistência incorreta",
      evidencia: '"Fck=30Mpa ou 300kg/metro quadrado"',
      conflito: "30 MPa não equivale a 300 kg/m²; MPa é tensão, kg/m² não é.",
    }),
  },
  {
    rotulo: "025-24 · aterro 1.673 não fecha com 385+364+648",
    gabarito: "real",
    finding: achado({
      id: "R-003",
      pagina: "18-19",
      tipo: "Erro aritmético em quantitativo",
      evidencia: '" Aterro = 1.673,00,00m3" " Aterro = 385,00m3" " Aterro = 364,00m3" " Aterro = 648,00m3"',
      conflito:
        "O total declarado é 1.673,00 m³, mas a soma das três praças é 1.397,00 m³. Diferença de 276,00 m³.",
    }),
  },
  {
    rotulo: "025-24 · postes de aço de 60x40m com 1,08m de altura",
    gabarito: "real",
    finding: achado({
      id: "R-004",
      pagina: "38",
      tipo: "Unidade dimensional incorreta",
      evidencia: '"composto por postes de aço de 60x40m altura 1,08m, dispostos a cada 2,5m"',
      conflito: "A seção declarada (60x40 m) é maior que a altura do poste (1,08 m).",
    }),
  },
  {
    rotulo: "129-24 · Secretaria de Educação em obra da Infraestrutura",
    gabarito: "real",
    finding: achado({
      id: "R-005",
      pagina: "17",
      tipo: "Órgão de outro escopo administrativo",
      evidencia: '"placa padrão da Secretaria Municipal de Educação"',
      conflito: 'Pág. 17: "placa padrão da Secretaria Municipal de Educação"; cabeçalho: "SMI/PMF".',
      referencia_comparada: '"SECRETARIA MUNICIPAL DE INFRAESTRUTURA"',
    }),
  },
  {
    rotulo: "025-24 · escadas DA ESCOLA numa urbanização de orla",
    gabarito: "real",
    finding: achado({
      id: "R-006",
      pagina: "107",
      tipo: "Resíduo genérico de modelo — referência a escola",
      evidencia: '"aberrante que destaque a aresta do degrau em todas as escadas da escola"',
      conflito: "O objeto caracterizado é a urbanização da orla com três praças, não uma escola.",
    }),
  },
  {
    rotulo: "129-24 · hierarquia documental contraditória",
    gabarito: "real",
    finding: achado({
      id: "R-007",
      pagina: "10 e 14",
      tipo: "Hierarquia documental contraditória",
      evidencia:
        'Pág. 10: "sempre prevalecerão os projetos" | Pág. 14: "As especificações técnicas e normas de execução citadas neste memorial prevalecerão sobre todos os projetos"',
      conflito: "As duas cláusulas se anulam: nenhuma das duas pode ser aplicada.",
    }),
  },

  // ---- RETRATADOS: o próprio achado diz que não há o que corrigir ----------
  {
    rotulo: "129-24 · lastro magro 20MPa x estrutural 30MPa (NÃO é conflito)",
    gabarito: "retratado",
    finding: achado({
      id: "T-001",
      pagina: "32 e 41",
      tipo: "Resistência do concreto potencialmente conflitante",
      evidencia:
        '"lastro em concreto magro com espessura de 5cm e fck 20MPA" | "O concreto a ser utilizado na obra será usinado bombeado com resistência de acordo com o dimensionamento preestabelecido no projeto estrutural (fck = 30 MPa)"',
      conflito:
        "Pág. 41 qualifica o concreto de acordo com o dimensionamento estrutural; pág. 32 especifica lastro de concreto magro.",
      sugestao_correcao:
        "Sem correção obrigatória por conflito; facultativamente, esclarecer que o fck de 30 MPa se aplica aos elementos estruturais.",
    }),
  },
  {
    rotulo: "129-24 · cura 21 dias do piso x 14 dias geral (NÃO é conflito)",
    gabarito: "retratado",
    finding: achado({
      id: "T-002",
      pagina: "35 e 42",
      tipo: "Prazo de cura conflitante",
      evidencia:
        '"cobrindo-se o piso com manta geotêxtil por no mínimo 21 dias" | "O concreto deverá ser curado durante 14 dias"',
      conflito: "Pág. 35 especifica cura do piso por 21 dias; pág. 42 estabelece cura geral por 14 dias.",
      sugestao_correcao:
        "Sem correção obrigatória por conflito; facultativamente, registrar que pisos seguem o prazo específico de 21 dias.",
    }),
  },
  {
    rotulo: "129-24 · brita sob concreto x lastro magro (NÃO é conflito)",
    gabarito: "retratado",
    finding: achado({
      id: "T-003",
      pagina: "32 e 41",
      tipo: "Especificação de base do concreto",
      evidencia:
        '"deverá ser executado lastro em concreto magro" | "Em todas as superfícies de concreto em contato com o solo deverá ser executado previamente uma camada de 5 cm de lastro de brita."',
      conflito: "A pág. 41 determina brita previamente ao concreto; a pág. 32 determina concreto magro sob rampas.",
      sugestao_correcao:
        "Sem correção obrigatória por conflito; se necessário para execução, detalhar a sequência de camadas nas pranchas.",
    }),
  },
  {
    rotulo: "129-24 · quantitativo remetido ao Volume 2 (NÃO conclui)",
    gabarito: "retratado",
    finding: achado({
      id: "T-004",
      pagina: "25",
      tipo: "Quantitativo de terraplenagem incompleto",
      evidencia: '"Cortes de 1a Categoria = 45 m3" "Empréstimo de solo (Jazida) = 1.436 m³"',
      conflito: "Pág. 22 remete os dados ao Volume 2; pág. 25 apresenta somente quantidades principais.",
      sugestao_correcao:
        "Sem ação corretiva com base apenas neste memorial; verificar o Volume 2 antes de apontar eventual ausência de quantitativos.",
    }),
  },

  // ---- FALSOS: os FPs já documentados nos comentários do código -----------
  {
    rotulo: "117-25 · UBS VILA MANAUS = Unidade Básica de Saúde Vila Manaus",
    gabarito: "falso",
    finding: achado({
      id: "F-001",
      pagina: "1",
      tipo: "Nome da obra divergente entre documentos",
      evidencia: '"Unidade Básica de Saúde Vila Manaus" x "UBS VILA MANAUS"',
      conflito: "O nome da obra na capa não coincide com o nome usado no corpo do documento.",
    }),
  },
  {
    rotulo: "084-25 · gabarito com parêntese e 'ginásio' solto",
    gabarito: "falso",
    finding: achado({
      id: "F-002",
      pagina: "181",
      tipo: "Nome da obra divergente entre documentos",
      evidencia: '"ginásio" x "Ginásio de Esportes (Cobertura de Quadra) — Escola Geral"',
      conflito: "A palavra 'ginásio' aparece isolada sem o nome completo da obra declarado na capa.",
    }),
  },
];

async function main() {
  if (!conferenteEstaConfigurado()) {
    console.log("JEV_API_KEY não configurada — prova pulada (e a auditoria roda sem o conferente).");
    return;
  }

  const medidos: Array<Caso & { p: number; d: number; grau: string; faixa?: string }> = [];

  for (const caso of CASOS) {
    const medida = await medirCertezaDoAchado(caso.finding);

    if (!medida) {
      console.error(`FALHOU  conferente não respondeu para ${caso.rotulo}`);
      process.exitCode = 1;
      return;
    }

    medidos.push({
      ...caso,
      p: medida.probabilidade,
      d: medida.decidibilidade ?? 1,
      grau: grauDaCerteza(medida.probabilidade, medida.decidibilidade),
      faixa: medida.faixaSugerida,
    });
  }

  const largura = Math.max(...medidos.map((item) => item.rotulo.length));

  for (const grupo of ["real", "retratado", "falso"] as const) {
    console.log(`\n--- ${grupo.toUpperCase()} ---`);

    for (const item of medidos.filter((m) => m.gabarito === grupo)) {
      console.log(
        `  ${item.rotulo.padEnd(largura)}  p=${item.p.toFixed(2)}  dec=${item.d.toFixed(2)}  ${item.grau.padEnd(5)}  ${item.faixa ?? "(sem faixa)"}`,
      );
    }
  }

  const reais = medidos.filter((m) => m.gabarito === "real").map((m) => m.p);
  const ruins = medidos.filter((m) => m.gabarito !== "real").map((m) => m.p);
  const piorReal = Math.min(...reais);
  const melhorRuim = Math.max(...ruins);
  const mediaReal = reais.reduce((a, b) => a + b, 0) / reais.length;
  const mediaRuim = ruins.reduce((a, b) => a + b, 0) / ruins.length;

  console.log(`\nreais:      média ${mediaReal.toFixed(2)}, pior ${piorReal.toFixed(2)}`);
  console.log(`não-reais:  média ${mediaRuim.toFixed(2)}, melhor ${melhorRuim.toFixed(2)}`);
  console.log(`separação:  ${(mediaReal - mediaRuim).toFixed(2)}`);

  /*
   * O PORTÃO É A SEPARAÇÃO MÉDIA, não a ausência de sobreposição.
   *
   * Exigir que o pior real vença o melhor não-real seria exigir um separador
   * perfeito de um número que ninguém calibrou ainda — e reprovaria o encaixe
   * por um caso difícil, não por ele não funcionar. O que precisa ser verdade
   * para a troca valer é mais modesto: que os dois grupos fiquem em alturas
   * diferentes. Se a separação sumir, a certeza medida não sabe mais do que a
   * declarada e este arquivo é o lugar onde isso aparece.
   */
  assert.ok(
    mediaReal - mediaRuim >= 0.25,
    `separacao de ${(mediaReal - mediaRuim).toFixed(2)} e baixa demais: a certeza medida nao esta distinguindo achado real de achado que se retrata`,
  );

  /*
   * O PORTAO QUE IMPORTA MAIS QUE A SEPARACAO.
   *
   * Separacao alta com achado real no piso seria o pior resultado possivel: a
   * lista ficaria bem ordenada e o achado certo desceria para o fim dela. Esta
   * assercao e a garantia de agosto/2026 escrita em codigo — o conferente pode
   * deixar de promover, nunca rebaixar o que esta certo.
   *
   * Foi ela que reprovou a primeira versao do encaixe, que multiplicava a
   * probabilidade pela decidibilidade: o "0,254 microns" saia a 0,26 e caia em
   * "baixa". Com a multiplicacao removida ele vai a 0,84.
   */
  const reaisNoPiso = medidos.filter((m) => m.gabarito === "real" && m.grau === "baixa");
  assert.equal(
    reaisNoPiso.length,
    0,
    `achado real rebaixado para o piso da faixa: ${reaisNoPiso.map((m) => m.rotulo).join(", ")}`,
  );

  console.log("\nok  separa real de nao-real, e nenhum real foi para o piso");
}

await main();
