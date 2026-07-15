import type { AuditFinding, FindingImpact, FindingPriority } from "@/lib/audit-report";
import type { ExtractedPdf } from "@/lib/pdf-text";

export type CoherenceSource = {
  fileName: string;
  fileType: string;
  extracted: ExtractedPdf;
};

type Hit = { page: number; evidence: string };

function snippet(text: string, index: number, radius = 150) {
  return text
    .slice(Math.max(0, index - radius), Math.min(text.length, index + radius))
    .replace(/\s+/g, " ")
    .trim();
}

/** primeira ocorrência de um padrão no documento inteiro, com página + trecho */
function findFirst(extracted: ExtractedPdf, pattern: RegExp): Hit | null {
  for (const page of extracted.pages) {
    pattern.lastIndex = 0;
    const match = pattern.exec(page.text);

    if (match) {
      return { page: page.page, evidence: snippet(page.text, match.index) };
    }
  }

  return null;
}

/** todas as ocorrências de um conjunto de sinais, para relatar reúso de texto */
function collectSignals(
  extracted: ExtractedPdf,
  signals: Array<{ label: string; pattern: RegExp }>,
) {
  const found: Array<{ label: string; page: number; evidence: string }> = [];

  for (const page of extracted.pages) {
    for (const signal of signals) {
      signal.pattern.lastIndex = 0;
      const match = signal.pattern.exec(page.text);

      if (match && !found.some((item) => item.label === signal.label)) {
        found.push({ label: signal.label, page: page.page, evidence: snippet(page.text, match.index) });
      }
    }
  }

  return found;
}

function makeFinding(
  id: string,
  args: {
    arquivo: string;
    prioridade: FindingPriority;
    impacto: FindingImpact;
    pagina: string;
    capitulo: string;
    local: string;
    tipo: string;
    descricao: string;
    evidencia: string;
    conflito: string;
    sugestao_correcao: string;
    termo_busca?: string;
    confianca?: AuditFinding["confianca"];
  },
): AuditFinding {
  return {
    id,
    arquivo: args.arquivo,
    origem: "regra",
    confianca: args.confianca ?? "alta",
    prioridade: args.prioridade,
    impacto: args.impacto,
    pagina: args.pagina,
    capitulo: args.capitulo,
    local: args.local,
    tipo: args.tipo,
    descricao: args.descricao,
    evidencia: args.evidencia,
    termo_busca: args.termo_busca,
    conflito: args.conflito,
    sugestao_correcao: args.sugestao_correcao,
  };
}

/**
 * Contradições e reúso de texto que atravessam capítulos distantes — o ponto cego
 * da leitura por blocos do LLM. Tudo determinístico, com página + evidência.
 */
export function runDocumentCoherenceRules(source: CoherenceSource): AuditFinding[] {
  const { extracted, fileName } = source;
  const findings: AuditFinding[] = [];
  let count = 1;
  const nextId = () => `COER-${String(count++).padStart(3, "0")}`;

  // 1) Hierarquia documental contraditória:
  //    "prevalecerão os projetos" (projetos > especificações) vs
  //    "especificações técnicas ... prevalecerão sobre todos os projetos" (especificações > projetos)
  const projetosPrevalecem = findFirst(
    extracted,
    /(?:sempre\s+)?prevalecer[ãa]o\s+(?:sempre\s+)?os\s+projetos/i,
  );
  const especificacoesPrevalecem = findFirst(
    extracted,
    /especifica[cç][õo]es\s+t[ée]cnicas[\s\S]{0,140}?prevalecer[ãa]o\s+sobre\s+(?:todos\s+)?os\s+projetos/i,
  );

  if (projetosPrevalecem && especificacoesPrevalecem) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media/Alta",
        impacto: "tecnico_contratual",
        pagina: `${projetosPrevalecem.page} e ${especificacoesPrevalecem.page}`,
        capitulo: "Condições gerais / hierarquia documental",
        local: "regra de prevalência entre documentos",
        tipo: "Hierarquia documental contraditória",
        descricao:
          "O documento estabelece regras de prevalência incompatíveis: em um trecho os projetos prevalecem sobre as especificações; em outro, as especificações técnicas prevalecem sobre todos os projetos.",
        evidencia: `Pág. ${projetosPrevalecem.page}: "${projetosPrevalecem.evidence}" | Pág. ${especificacoesPrevalecem.page}: "${especificacoesPrevalecem.evidence}"`,
        termo_busca: "prevalecerão sobre todos os projetos",
        conflito: `Projetos prevalecem (pág. ${projetosPrevalecem.page}) × especificações prevalecem sobre os projetos (pág. ${especificacoesPrevalecem.page}).`,
        sugestao_correcao:
          "Unificar uma única regra de prevalência documental (ex.: definir explicitamente a ordem projeto executivo → especificações → normas) e remover a redação conflitante.",
      }),
    );
  }

  // 2) Responsabilidade da terraplenagem/movimento de terra: Prefeitura × contratada
  const terraPrefeitura = findFirst(
    extracted,
    /terraplenagem[\s\S]{0,320}?responsabilidade\s+da\s+Prefeitura/i,
  );
  const terraContratada = findFirst(
    extracted,
    /contratada\/?(?:construtora)?\s+dever[áa]\s+executar\s+(?:todo\s+)?(?:o\s+)?movimento\s+de\s+terra/i,
  );

  if (terraPrefeitura && terraContratada) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media/Alta",
        impacto: "tecnico_contratual",
        pagina: `${terraPrefeitura.page} e ${terraContratada.page}`,
        capitulo: "Escopo / responsabilidades",
        local: "responsabilidade pela terraplenagem",
        tipo: "Responsabilidade de terraplenagem divergente",
        descricao:
          "Há atribuição conflitante da terraplenagem: um trecho diz que é responsabilidade da Prefeitura; outro determina que a contratada executará todo o movimento de terra.",
        evidencia: `Pág. ${terraPrefeitura.page}: "${terraPrefeitura.evidence}" | Pág. ${terraContratada.page}: "${terraContratada.evidence}"`,
        termo_busca: "responsabilidade da Prefeitura",
        conflito: `Terraplenagem = Prefeitura (pág. ${terraPrefeitura.page}) × contratada executa movimento de terra (pág. ${terraContratada.page}).`,
        sugestao_correcao:
          "Separar claramente o escopo: o que cabe à Prefeitura, à contratada da edificação e a eventual contrato específico de terraplenagem.",
      }),
    );
  }

  // 3) Linguagem de projeto rodoviário reaproveitada numa obra de edificação
  const roadSignals = collectSignals(extracted, [
    { label: "eixo da rodovia", pattern: /eixo\s+da\s+rodovia/i },
    { label: "rodovias existentes", pattern: /rodovias?\s+existentes/i },
    { label: "superelevação das pistas", pattern: /supereleva[cç][ãa]o\s+das\s+pistas/i },
    { label: "segmento quilométrico (Km 0+000)", pattern: /Km\s*\d+\s*\+\s*\d+/i },
    { label: "velocidade de rodovia", pattern: /velocidades?\s+de\s+at[ée]\s+\d+\s*km\/h/i },
  ]);

  if (roadSignals.length >= 2) {
    const first = roadSignals[0];
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media",
        impacto: "tecnico_contratual",
        pagina: String(first.page),
        capitulo: "Terraplenagem / drenagem / pavimentação",
        local: "linguagem de projeto rodoviário",
        tipo: "Linguagem de projeto rodoviário não adaptada",
        descricao: `O documento usa termos de obra viária/rodoviária (${roadSignals
          .map((item) => item.label)
          .join(", ")}) num projeto de edificação (estacionamento/acessos) — indício de especificação genérica reaproveitada sem adaptação.`,
        evidencia: `Pág. ${first.page}: "${first.evidence}"`,
        termo_busca: first.label,
        conflito: `${roadSignals.length} termos de projeto rodoviário num centro comunitário.`,
        sugestao_correcao:
          "Revisar os capítulos de terraplenagem/drenagem/pavimentação e adaptar a linguagem viária ao escopo real (estacionamento e acessos da edificação).",
        confianca: "media",
      }),
    );
  }

  // 4) Obra declarada como construção nova, mas com indícios de reforma/intervenção existente
  const construcaoNova = findFirst(extracted, /ser[áa]\s+constru[íi]d[oa]\s+o?\s*[A-ZÁÉÍÓÚ]/i);
  const reformaSignals = collectSignals(extracted, [
    { label: "revitalização", pattern: /revitaliza[cç][ãa]o/i },
    { label: "pavimento a ser substituído", pattern: /pavimento\s+a\s+ser\s+substitu[íi]do/i },
    { label: "alvenaria existente", pattern: /alvenaria\s+existente/i },
  ]);

  if (construcaoNova && reformaSignals.length >= 1) {
    findings.push(
      makeFinding(nextId(), {
        arquivo: fileName,
        prioridade: "Media",
        impacto: "tecnico_contratual",
        pagina: String(reformaSignals[0].page),
        capitulo: "Escopo da obra",
        local: "construção nova × intervenção em existente",
        tipo: "Escopo ambíguo: construção nova × reforma",
        descricao: `O projeto é declarado como construção nova, mas há trechos com linguagem de reforma/ampliação (${reformaSignals
          .map((item) => item.label)
          .join(", ")}) — possível texto reaproveitado de obra de intervenção em edificação existente.`,
        evidencia: `Pág. ${reformaSignals[0].page}: "${reformaSignals[0].evidence}"`,
        termo_busca: reformaSignals[0].label,
        conflito: "Construção nova declarada, mas com referências a estrutura/pavimento existente.",
        sugestao_correcao:
          "Confirmar se a obra é construção nova ou intervenção em edificação existente e remover a linguagem incompatível com o escopo correto.",
        confianca: "media",
      }),
    );
  }

  return findings;
}
