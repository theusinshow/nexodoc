/**
 * AS FAIXAS DE IMPACTO — a definição única que todo prompt do auditor usa.
 *
 * 17/09/2026, benchmark do 027-24 (`docs/benchmarks/027-24/`). Havia três
 * cópias: a do auditor, a da validação e a dos blocos do Profundo. A da
 * validação dizia "crítico = somente troca real de obra; norma/cálculo/
 * hierarquia = técnico" e era enviada NA MESMA CHAMADA que a do auditor, que diz
 * o contrário. A hierarquia documental contraditória saiu técnica; um
 * arredondamento de 0,02 m³ saiu crítico.
 *
 * Mudar a régua é mudar ESTE texto. `test-faixas-de-impacto.ts` falha se algum
 * prompt voltar a ter definição própria.
 *
 * O texto entra no prompt do auditor, e por isso na versão do auditor
 * ([[versao-do-auditor.ts]]): mexer aqui invalida o reuso de parecer sozinho.
 *
 * PURO e sem imports.
 */
export const CRITERIO_DAS_FAIXAS = [
  `- "critico_documental": impede emitir o documento como está. Troca real de obra, município, endereço, órgão, cliente, código ou disciplina; nome, código ou endereço de OUTRO empreendimento no texto; campo não preenchido ou marcador de template; sumário incompatível com o corpo; contradição que deixa o contrato sem regra aplicável (ex.: duas ordens opostas de prevalência documental); erro aritmético em memória de cálculo, inclusive valor ADOTADO diferente do valor USADO na própria fórmula (ex.: "adotado N=471" e "V = 2 x 75 + 20") — isso é conta errada, não premissa não demonstrada; unidade errada que altera a exigência em ordens de grandeza.`,
  `- "tecnico_contratual": não impede emitir, mas exige decisão de um responsável técnico antes de executar. Edição de norma divergente ou desatualizada, premissa de enquadramento não demonstrada, especificação conflitante entre capítulos, compatibilização entre disciplinas, escopo ambíguo, premissa de levantamento de campo, procedimento executivo mal descrito; resíduo genérico de modelo que não identifica outra obra (ex.: "número do apartamento" num projeto sem apartamentos, "rodovia" na terraplenagem de um parque).`,
  `- "revisao_editorial": não muda decisão técnica nenhuma. Grafia, concordância, frase truncada, duplicação de parágrafo, numeração fora de ordem, título repetido; diferença de conta que cabe no arredondamento dos valores impressos (ex.: total 2.269,34 declarado × 2.269,36 somado).`,
].join("\n");
