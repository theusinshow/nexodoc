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
 * 16/10/2026 — A FAIXA TÉCNICA VIROU DUAS. Nos pareceres de 24/09 (027-24 e
 * 117-25) ela tinha 33 de 62 e 32 de 55 achados, todos em "Media": aterramento
 * de 25 Ω contra 10 Ω no mesmo memorial ficava ao lado de "CEI/PCMAT a
 * atualizar" e abaixo de "títulos iguais em itens distintos". O que separa os
 * dois é a consequência: um faz a obra sair errada se executada como está
 * escrito (`risco_de_execucao`); o outro pede que alguém demonstre ou confirme
 * (`tecnico_contratual`). A unidade trocada cujo valor pretendido é óbvio
 * (túnel com 0,88 cm) deixou de bloquear emissão: ninguém executa errado.
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
  `- "critico_documental": impede emitir o documento como está. Troca real de obra, município, endereço, órgão, cliente, código ou disciplina; nome, código ou endereço de OUTRO empreendimento no texto; campo não preenchido ou marcador de template; sumário incompatível com o corpo; contradição que deixa o contrato sem regra aplicável (ex.: duas ordens opostas de prevalência documental); erro aritmético em memória de cálculo, inclusive valor ADOTADO diferente do valor USADO na própria fórmula (ex.: "adotado N=471" e "V = 2 x 75 + 20") — isso é conta errada, não premissa não demonstrada; unidade errada que altera a exigência em ordens de grandeza quando o contexto NÃO permite deduzir o valor pretendido — e o mesmo parâmetro com unidades diferentes em dois trechos do documento nunca permite, porque o documento diz duas coisas (ex.: vazão do hidrante 70 L/min num trecho e 70 L/s noutro).`,
  `- "risco_de_execucao": não impede emitir, mas se a obra for executada como está escrito ela sai errada em função, segurança, durabilidade ou custo. Dois valores ou especificações incompatíveis para o MESMO elemento sem regra que diga qual vale (ex.: aterramento de 25 Ω numa seção e 10 Ω noutra; bacia PCD com dois tipos de descarga); capacidade, dimensão ou quantidade menor que a carga ou demanda que o próprio documento declara; parâmetro de segurança divergente entre seções; incompatibilidade entre disciplinas que muda o que se constrói (ex.: água quente prevista numa disciplina e negada noutra; fluido nos postos sem central dimensionada); base de dimensionamento divergente que altera o que se executa (ex.: consumo de água × contribuição de esgoto).`,
  `- "tecnico_contratual": não impede emitir e não leva por si a executar errado, mas exige que um responsável técnico demonstre, confirme ou decida. Premissa, parâmetro ou enquadramento sem origem demonstrada; edição de norma divergente ou desatualizada; escopo ou responsabilidade contratual ambíguos; dado que depende de levantamento de campo ou de outro volume; peça complementar remetida e não localizada; duas cores, padrões ou acabamentos estéticos para o mesmo elemento (escolha de quem projetou, não obra errada); procedimento executivo mal descrito; resíduo genérico de modelo que não identifica outra obra (ex.: "número do apartamento" num projeto sem apartamentos, "rodovia" na terraplenagem de um parque); unidade trocada numa passagem só, sem outro trecho que diga outra coisa, cujo valor pretendido é evidente pelo contexto (ex.: túnel pet com 0,88 cm de diâmetro, tábua de caixaria com 2,5 m de espessura).`,
  `- "revisao_editorial": não muda decisão técnica nenhuma. Grafia, concordância, frase truncada, duplicação de parágrafo, numeração fora de ordem, título repetido ou trocado em itens distintos quando o corpo do item já define o que é; diferença de conta que cabe no arredondamento dos valores impressos (ex.: total 2.269,34 declarado × 2.269,36 somado).`,
].join("\n");
