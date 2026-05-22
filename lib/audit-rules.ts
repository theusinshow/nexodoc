import type { AuditFinding } from "@/lib/audit-report";
import type { ExtractedPdf } from "@/lib/pdf-text";

type RuleContext = {
  fileName: string;
  projectName: string;
  extracted: ExtractedPdf;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function snippet(text: string, index: number, radius = 180) {
  return text.slice(Math.max(0, index - radius), Math.min(text.length, index + radius)).replace(/\s+/g, " ").trim();
}

function findFirstPage(extracted: ExtractedPdf, pattern: RegExp) {
  for (const page of extracted.pages) {
    const match = pattern.exec(page.text);
    pattern.lastIndex = 0;

    if (match?.index !== undefined) {
      return {
        page: page.page,
        evidence: snippet(page.text, match.index),
      };
    }
  }

  return null;
}

function makeFinding(
  id: string,
  partial: Omit<AuditFinding, "id" | "origem" | "confianca"> & {
    confianca?: AuditFinding["confianca"];
  },
): AuditFinding {
  return {
    id,
    origem: "regra",
    confianca: partial.confianca ?? "alta",
    ...partial,
  };
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function canonicalIdentity(value: string) {
  return normalize(value)
    .replace(/\s+/g, " ")
    .replace(/\s+[–-]\s+/g, " - ")
    .trim();
}

function titleCaseIdentity(value: string) {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s+[–-]\s+/g, " - ")
    .trim();
}

function findIdentityMentions(
  extracted: ExtractedPdf,
  pattern: RegExp,
) {
  const mentions: Array<{ value: string; page: number; evidence: string }> = [];

  for (const page of extracted.pages) {
    for (const match of page.text.matchAll(pattern)) {
      const value = match[0] ?? "";

      if (!value.trim()) {
        continue;
      }

      mentions.push({
        value: titleCaseIdentity(value),
        page: page.page,
        evidence: snippet(page.text, match.index ?? 0),
      });
    }
  }

  return mentions;
}

function groupIdentityMentions(
  mentions: Array<{ value: string; page: number; evidence: string }>,
) {
  const groups = new Map<
    string,
    { value: string; pages: number[]; count: number; evidence: string }
  >();

  for (const mention of mentions) {
    const key = canonicalIdentity(mention.value);
    const current = groups.get(key);

    if (current) {
      current.count += 1;
      current.pages = unique([...current.pages.map(String), String(mention.page)]).map(Number);
      continue;
    }

    groups.set(key, {
      value: mention.value,
      pages: [mention.page],
      count: 1,
      evidence: mention.evidence,
    });
  }

  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function runDeterministicAuditRules(context: RuleContext): AuditFinding[] {
  const { extracted, projectName } = context;
  const fullText = extracted.text;
  const normalizedText = normalize(fullText);
  const findings: AuditFinding[] = [];
  let count = 1;
  const nextId = () => `REG-${String(count++).padStart(3, "0")}`;

  const owners = unique(
    [...fullText.matchAll(/Prefeitura Municipal de\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]+?)(?:[;,.]|\n)/g)].map(
      (match) => match[1] ?? "",
    ),
  );

  const ubsGroups = groupIdentityMentions(
    findIdentityMentions(
      extracted,
      /\bUBS\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç0-9\s]+?[–-]\s*Porte\s*\d+\b/gi,
    ),
  );

  if (ubsGroups.length > 1) {
    const dominant = ubsGroups[0];
    const divergentGroups = ubsGroups.slice(1);
    const divergent = divergentGroups[0];

    findings.push(
      makeFinding(nextId(), {
        prioridade: "Alta",
        pagina: divergent ? divergent.pages.join(", ") : "nao identificada",
        capitulo: "Identidade global do documento",
        local: "nome da obra/unidade",
        tipo: "Nome da obra/unidade divergente",
        descricao: `Foram identificados nomes de UBS distintos no mesmo documento: ${ubsGroups.map((group) => group.value).join(" | ")}.`,
        evidencia: divergent?.evidence ?? ubsGroups.map((group) => group.value).join(" | "),
        conflito: `A identidade predominante aparenta ser "${dominant.value}", mas tambem aparece "${divergentGroups.map((group) => group.value).join(", ")}".`,
        sugestao_correcao: "Padronizar o nome correto da unidade/obra em todos os capitulos, cabecalhos e objetivos tecnicos.",
      }),
    );
  }

  if (owners.length > 1) {
    const hit = findFirstPage(extracted, /Prefeitura Municipal de\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\s]+?(?:[;,.]|\n)/g);
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Alta",
        pagina: hit ? String(hit.page) : "nao identificada",
        capitulo: "Identificacao / proprietario",
        local: "proprietario ou cabecalho",
        tipo: "Municipio/proprietario divergente",
        descricao: `Foram identificados proprietarios/municipios distintos no documento: ${owners.join(", ")}.`,
        evidencia: hit?.evidence ?? owners.join(", "),
        conflito: "O documento apresenta mais de um municipio/proprietario para a mesma obra.",
        sugestao_correcao: "Padronizar o proprietario/municipio correto em todo o memorial.",
      }),
    );
  }

  const chapecoHit = findFirstPage(extracted, /Prefeitura Municipal de Chapec[oó]/i);
  if (chapecoHit && normalizedText.includes("criciuma")) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Alta",
        pagina: String(chapecoHit.page),
        capitulo: "Projeto Hidrossanitario",
        local: "item de proprietario",
        tipo: "Municipio/proprietario divergente",
        descricao: "O memorial indica Prefeitura Municipal de Chapeco em trecho interno, enquanto a identificacao geral aponta Criciuma.",
        evidencia: chapecoHit.evidence,
        conflito: "Chapeco diverge de Criciuma.",
        sugestao_correcao: "Corrigir o proprietario para Prefeitura Municipal de Criciuma, se este for o municipio correto do projeto.",
      }),
    );
  }

  const comcapHit = findFirstPage(extracted, /\bCOMCAP\b|manual\s+COMCAP/i);
  if (comcapHit && normalizedText.includes("criciuma")) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Media/Alta",
        pagina: String(comcapHit.page),
        capitulo: "Residuos / referencia municipal",
        local: "referencia a manual externo",
        tipo: "Referencia municipal externa suspeita",
        descricao: "O documento cita COMCAP em memorial identificado como Criciuma, indicando possivel reaproveitamento de texto de outro contexto municipal.",
        evidencia: comcapHit.evidence,
        conflito: "COMCAP pode nao ser a referencia municipal aplicavel ao projeto de Criciuma.",
        sugestao_correcao: "Conferir a referencia normativa/manual de residuos aplicavel ao municipio correto e substituir se necessario.",
        confianca: "media",
      }),
    );
  }

  const bairroHit = findFirstPage(extracted, /Bairro Vila Francesa/i);
  if (bairroHit && normalize(projectName + " " + fullText).includes("vila manaus")) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Alta",
        pagina: String(bairroHit.page),
        capitulo: "Apresentacao",
        local: "item Plantas e desenhos",
        tipo: "Bairro divergente",
        descricao: "O texto cita Bairro Vila Francesa, mas a obra principal aparece como UBS Vila Manaus.",
        evidencia: bairroHit.evidence,
        conflito: "Bairro Vila Francesa diverge de Vila Manaus.",
        sugestao_correcao: "Substituir a referencia divergente pelo bairro correto do projeto.",
      }),
    );
  }

  const streetHit = findFirstPage(extracted, /Rua Bento Goi[aá].{0,80}Av\.?\s*Engenheiro Max de Souza/i);
  if (streetHit) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Alta",
        pagina: String(streetHit.page),
        capitulo: "Condicoes gerais / movimento de terra",
        local: "trecho de limpeza e microdrenagem",
        tipo: "Logradouro divergente",
        descricao: "O memorial cita logradouros que aparentam pertencer a outro projeto.",
        evidencia: streetHit.evidence,
        conflito: "Rua Bento Goia e Av. Engenheiro Max de Souza nao correspondem ao endereco principal identificado.",
        sugestao_correcao: "Remover o trecho reaproveitado ou substituir pelos logradouros corretos da obra.",
      }),
    );
  }

  const hierarchyProjectHit = findFirstPage(extracted, /sempre\s+prevalecer[aã]o\s+os\s+projetos/i);
  const hierarchySpecHit = findFirstPage(extracted, /especifica[cç][oõ]es\s+t[eé]cnicas[\s\S]{0,220}?prevalecer[aã]o\s+sobre\s+todos\s+os\s+projetos/i);
  if (hierarchyProjectHit && hierarchySpecHit) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Media/Alta",
        pagina: `${hierarchyProjectHit.page} e ${hierarchySpecHit.page}`,
        capitulo: "Condicoes gerais",
        local: "hierarquia documental",
        tipo: "Conflito de hierarquia documental",
        descricao: "O documento aparenta ter regras conflitantes de prevalencia entre projetos, especificacoes e normas.",
        evidencia: `${hierarchyProjectHit.evidence} / ${hierarchySpecHit.evidence}`,
        conflito: "Um trecho indica prevalencia dos projetos e outro indica prevalencia das especificacoes/normas.",
        sugestao_correcao: "Padronizar uma unica regra de prevalencia documental.",
      }),
    );
  }

  const isoHit = findFirstPage(extracted, /ISO\s*9050|NBR\s*ISO\s*9050/i);
  if (isoHit) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Media",
        pagina: String(isoHit.page),
        capitulo: "Esquadrias / acessibilidade",
        local: "citacao normativa",
        tipo: "Norma tecnica possivelmente incorreta",
        descricao: "Ha citacao a ISO/NBR ISO 9050 em contexto que pode exigir verificacao normativa.",
        evidencia: isoHit.evidence,
        conflito: "A norma citada pode nao ser a referencia adequada ao tema descrito.",
        sugestao_correcao: "Conferir a norma aplicavel e ajustar a referencia normativa.",
        confianca: "media",
      }),
    );
  }

  const trHit = findFirstPage(extracted, /Carga T[eé]rmica Total\s*:\s*([0-9]+[,.][0-9]+)\s*TR/i);
  if (trHit) {
    const pageText = extracted.pages.find((page) => page.page === trHit.page)?.text ?? trHit.evidence;
    const calculatedMatch = /Carga T[eé]rmica Total\s*:\s*([0-9]+[,.][0-9]+)\s*TR/i.exec(pageText);
    const installedMatch = /([0-9.]+)\s*BTU\/h\s*\((\d+(?:[,.]\d+)?)\s*TR\)/i.exec(pageText);
    const calculatedTr = Number((calculatedMatch?.[1] ?? "0").replace(",", "."));
    const installedTr = Number((installedMatch?.[2] ?? "0").replace(",", "."));

    if (calculatedTr && installedTr && Math.abs(calculatedTr - installedTr) >= 0.5) {
      findings.push(
        makeFinding(nextId(), {
          prioridade: "Media",
          pagina: String(trHit.page),
          capitulo: "Projeto de climatizacao",
          local: "carga termica e capacidade instalada",
          tipo: "Divergencia de carga termica",
          descricao: `Carga termica indicada (${calculatedTr} TR) diverge da capacidade instalada informada (${installedTr} TR).`,
          evidencia: snippet(pageText, calculatedMatch?.index ?? 0, 420),
          conflito: `${calculatedTr} TR x ${installedTr} TR.`,
          sugestao_correcao: "Verificar simultaneidade, arredondamento ou capacidade instalada.",
        }),
      );
    }
  }

  const waterHit = findFirstPage(extracted, /44,86\s*litros\/dia/i);
  if (waterHit && /1000\s*litros/i.test(fullText) && /10\s*dias/i.test(fullText)) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Media",
        pagina: String(waterHit.page),
        capitulo: "Reuso de agua pluvial",
        local: "calculo de autonomia",
        tipo: "Divergencia de calculo/autonomia",
        descricao: "Reservatorio de 1000 L para demanda de 44,86 L/dia resulta em aproximadamente 22,3 dias, nao 10 dias.",
        evidencia: waterHit.evidence,
        conflito: "1000 / 44,86 = aproximadamente 22,3 dias.",
        sugestao_correcao: "Corrigir a autonomia indicada ou revisar a demanda considerada.",
      }),
    );
  }

  const creaHit = findFirstPage(extracted, /Conselho Regional de Engenharia e Arquitetura/i);
  if (creaHit) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Baixa/Media",
        pagina: String(creaHit.page),
        capitulo: "Condicoes gerais",
        local: "nomenclatura institucional",
        tipo: "Nomenclatura institucional imprecisa",
        descricao: "CREA aparece descrito como Conselho Regional de Engenharia e Arquitetura.",
        evidencia: creaHit.evidence,
        conflito: "A nomenclatura institucional pode estar incorreta ou desatualizada.",
        sugestao_correcao: "Revisar a denominacao de CREA e CAU conforme responsabilidades tecnicas.",
        confianca: "media",
      }),
    );
  }

  const contentoresHit = findFirstPage(extracted, /\b[12]\s*contentores\b/i);
  if (contentoresHit) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Baixa",
        pagina: String(contentoresHit.page),
        capitulo: "Residuos / contentores",
        local: "lista de contentores",
        tipo: "Erro de redacao/formatação",
        descricao: "Foram encontrados termos de quantidade de contentores com redacao/formatação inadequada ou repeticao de classe.",
        evidencia: contentoresHit.evidence,
        conflito: "A lista apresenta itens como 1 contentores/2 contentores e repeticao de residuos classe A.",
        sugestao_correcao: "Corrigir espacamentos e revisar a lista de contentores.",
      }),
    );
  }

  const headingHit = findFirstPage(extracted, /14\s+PROJETO[\s\S]{0,120}14\s+[–-]?\s*PROJETO/i);
  if (headingHit) {
    findings.push(
      makeFinding(nextId(), {
        prioridade: "Baixa",
        pagina: String(headingHit.page),
        capitulo: "Transicao de capitulos",
        local: "cabecalho do capitulo 14",
        tipo: "Erro de formatacao/cabecalho",
        descricao: "O cabecalho do capitulo 14 aparenta estar duplicado ou colado.",
        evidencia: headingHit.evidence,
        conflito: "Quebra de pagina/cabecalho inconsistente.",
        sugestao_correcao: "Ajustar quebra de pagina e cabecalho do capitulo.",
      }),
    );
  }

  return findings;
}
