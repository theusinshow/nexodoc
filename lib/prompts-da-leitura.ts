/**
 * OS PROMPTS DA LEITURA — global e por bloco —, fora da rota.
 *
 * Moravam em `app/api/audit/route.ts`, e por isso a versão do auditor não os
 * enxergava: [[configuracao-do-auditor.ts]] é lida também por
 * `/api/audit/delta`, e não pode importar a rota. O hash cobria só as ~80
 * linhas de [[auditor-prompt.ts]], e o "peque pelo excesso", o teto de 60, a
 * síntese por capítulo e a conferência do sumário — o que de fato muda o que se
 * acha — podiam mudar sem invalidar o reuso. Pior: com documento idêntico, a
 * auditoria RECUSA reauditar ("não há o que auditar"), então um prompt melhor
 * nunca alcançava memorial já auditado.
 *
 * Movidos palavra por palavra em 26/09/2026. O que dependia da rota (o texto do
 * documento, o gabarito formatado, o número de páginas) agora chega pronto nos
 * argumentos: aqui só há texto, e é por isso que dá para renderizar com
 * marcadores e hashear.
 *
 * Imports relativos de propósito (mesmo motivo de `audit-validation-prompt.ts`):
 * com `@/` no caminho de valor, este arquivo volta a só rodar dentro do Next.
 */
import type { AuditMode } from "./ai-providers.ts";
import { CRITERIO_DAS_FAIXAS } from "./faixas-de-impacto.ts";

/** O prompt de um BLOCO de leitura. */
export function promptDoBloco(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  chunk: { title: string; startPage: number; endPage: number; text: string };
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Audite volume de projeto: coerência entre capa, separatriz, LDs/listas, pranchas, selos, revisões, títulos, disciplinas, volume e tomo."
      : "Audite memorial descritivo textual: coerência interna, normas suspeitas, cálculos simples, hierarquia e redação técnica.";

  return `
${modeInstruction}

Leia o trecho abaixo procurando erros que possam comprometer emissão, licitação, cliente ou consistência documental.
Procure ativamente: conflito de hierarquia documental, norma inadequada ao escopo, cálculo incoerente, unidade de medida divergente (cm × m, m² × m³), linguagem técnica reaproveitada de outro tipo de obra (ex.: rodovia num prédio), quadro/tabela inconsistente e redação/formatação crítica.

NÃO reporte divergência de identidade documental — nome da obra, unidade, município, bairro, endereço, proprietário, órgão, cliente ou código. Essa camada é auditada por regras determinísticas próprias e reafirmá-la aqui só gera ruído e falso positivo. Se notar um trecho que parece de outra obra, trate-o apenas como possível reaproveitamento de linguagem técnica, não como troca de identidade.

Se o trecho for sumário/índice (títulos com pontilhado e número de página), NÃO gere achados sobre ele — títulos repetidos, numeração ou grafia do índice não são defeitos. Nunca reclame de "recorte", "página fornecida" ou de não conseguir auditar a partir do sumário.

UMA OCORRÊNCIA, UM ACHADO. Grafia, concordância, pontuação e palavra trocada se corrigem uma a uma, em lugares diferentes do texto: cada uma é um achado com a SUA "pagina", o SEU trecho em "evidencia", o SEU "termo_busca" e a SUA "sugestao_correcao". NUNCA junte várias numa frase só ("pág. 8 ...; pág. 23 ...; pág. 35 ..."): assim ninguém consegue abrir, localizar no PDF nem marcar como resolvida uma ocorrência isolada. Junte num achado só quando UMA decisão resolver todas de uma vez (convenção de unidade, nomenclatura, regra de prevalência). Em achado de texto, escreva "categoria": "Ortografia / Redação".

Projeto informado: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Trecho: ${args.chunk.title}, páginas ${args.chunk.startPage}-${args.chunk.endPage}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "TRECHO LITERAL do documento (so o que esta escrito la; conta e conclusao vao em conflito)",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "categoria do achado (use \"Ortografia / Redação\" nos de texto)",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa",
      "impacto": "critico_documental|risco_de_execucao|tecnico_contratual|revisao_editorial"
    }
  ]
}

Se não encontrar erro relevante, retorne {"findings":[]}.

TEXTO:
${args.chunk.text}
`.trim();
}

/**
 * O prompt da LEITURA GLOBAL. `textoDoDocumento` e `gabarito` chegam montados
 * pela rota (`contextoDoDocumento` e `buildGabaritoContext`).
 */
export function promptDaLeituraGlobal(args: {
  auditMode: AuditMode;
  userMessage: string;
  projectName: string;
  learningContext: string;
  fileName: string;
  fileType: string;
  /** Páginas extraídas do documento. */
  paginas: number | string;
  /** O bloco do gabarito, já formatado — vazio quando o usuário não declarou. */
  gabarito: string;
  /** O texto que a global lê: inteiro, amostrado ou com os resumos do reuso. */
  textoDoDocumento: string;
}) {
  const modeInstruction =
    args.auditMode === "volume"
      ? "Faça uma leitura global do volume de projeto, como auditor documental sênior."
      : "Faça uma leitura global do memorial descritivo, como auditor documental sênior.";

  return `
${modeInstruction}

Esta etapa deve funcionar como uma análise livre do documento inteiro, não como checklist de termos. Use a identidade predominante do documento (obra, município, órgão, disciplina) como referência para julgar coerência. Procure incongruências internas, capítulos incoerentes, normas suspeitas, contas inconsistentes, escopo ambíguo, promessas não cumpridas e problemas editoriais.

A identidade documental também é auditada por regras determinísticas próprias, que comparam o documento contra o gabarito informado. Elas pegam o que casa com o gabarito; NÃO pegam texto pertencente a um TERCEIRO empreendimento que nunca foi declarado. Por isso: quando encontrar nome de obra, bloco, unidade ou elemento construtivo que não pertence a este empreendimento e não aparece na caracterização (ex.: um nome de prédio estranho, um bloco que não existe no programa, uma torre que ninguém descreveu), GERE O ACHADO. Se a camada determinística já tiver apontado o mesmo trecho, a deduplicação posterior resolve — perder o resíduo é muito pior que repeti-lo.

SUMÁRIO / ÍNDICE. Linhas de título seguidas de pontilhado e número de página (ex.: "12.6 Quadro geral ....... 122") são o índice. Não gere achado sobre grafia ou espaçamento que exista SÓ no índice. Mas CONFIRA O ÍNDICE CONTRA O CORPO: se os capítulos listados no sumário não forem os capítulos que o documento realmente tem, ou se as páginas indicadas não corresponderem, isso é achado crítico de documento não finalizado — reporte com os dois lados (o que o sumário diz x o que o corpo traz). Nunca reclame de "recorte", "página fornecida" ou "reprocessar": você recebeu o documento inteiro; audite o conteúdo real.

Em memoriais, confira explicitamente antes de responder:
- construcao nova x trechos de reforma/adequacao (escopo ambíguo);
- quantidade e nomenclatura de blocos, pavimentos, volumes e disciplinas;
- areas informadas em secoes diferentes, inclusive arquitetura, eletrica, cabeamento e CFTV;
- concessionaria, normas locais e siglas que exigem validação técnica.

Priorize pelo impacto:
- Alta: contradição técnica interna grave, cálculo/quantitativo incoerente ou norma incompatível que impede emissão.
- Media/Alta: divergência técnica/contratual que pode afetar emissão, contratação ou revisão formal.
- Media ou menor: redação, formatação, duplicidade e pontos de conferência editoriais.

Preencha "impacto" em TODO achado, pela consequência para quem vai emitir. A prioridade mede urgência; o impacto decide em qual seção do relatório o achado aparece. A régua é esta, a mesma do auditor e da validação:
${CRITERIO_DAS_FAIXAS}

Não invente evidência. Se o documento só permitir suspeita, marque confiança média ou baixa e explique o motivo — mas registre o achado.

PEQUE PELO EXCESSO: reporte todo defeito real que encontrar, inclusive acabamento, esquadria, ferragem, parágrafo duplicado e erro de redação, mesmo quando já houver achado grave no documento. Não omita achado por ser secundário; a classificação por impacto é que organiza a lista.

UMA OCORRÊNCIA, UM ACHADO — quando a correção é feita ocorrência por ocorrência. Grafia, concordância, pontuação, palavra trocada, parágrafo duplicado: cada uma se corrige num lugar diferente do texto, então cada uma é um achado com a SUA "pagina", o SEU trecho em "evidencia", o SEU "termo_busca" e a SUA "sugestao_correcao". NUNCA junte várias numa frase só ("pág. 8 ...; pág. 23 ...; pág. 35 ..."): quem revisa não consegue abrir, localizar no PDF nem marcar como resolvida uma ocorrência que está enterrada dentro de um texto corrido. Ocorrências parecidas do mesmo defeito voltam a aparecer juntas na tela — isso é trabalho do software, não seu.

CONSOLIDE apenas quando UMA decisão resolve todas as ocorrências de uma vez: regra de prevalência documental, norma adotada, convenção de unidade, nomenclatura de bloco. Aí sim um único achado, citando as páginas onde a decisão se aplica.

Em achado de texto, escreva "categoria": "Ortografia / Redação". É por esse nome que a tela separa revisão de texto de divergência técnica.

Teto de 60 achados, no máximo 30 deles com impacto "revisao_editorial". Havendo mais ocorrências de texto que isso, reporte as de menor número de página primeiro. NUNCA descarte achado técnico para caber ocorrência de texto.

Projeto informado pelo usuário: ${args.projectName || "não informado"}
Arquivo: ${args.fileName}
Tipo informado: ${args.fileType}
Páginas extraídas: ${args.paginas}
Solicitação do usuário: ${args.userMessage}

Aprendizados ativos do escritório, usados como contexto e preferência de auditoria, não como evidência:
${args.learningContext}

${args.gabarito}

Responda APENAS JSON válido:
{
  "findings": [
    {
      "prioridade": "Alta|Media/Alta|Media|Baixa/Media|Baixa",
      "pagina": "número ou intervalo",
      "capitulo": "capítulo/seção",
      "local": "local do erro",
      "tipo": "tipo do erro",
      "descricao": "descrição objetiva",
      "evidencia": "TRECHO LITERAL do documento (so o que esta escrito la; conta e conclusao vao em conflito)",
      "termo_busca": "menor trecho exato para localizar no PDF via Ctrl+F",
      "categoria": "categoria do achado (use \"Ortografia / Redação\" nos de texto)",
      "referencia_comparada": "identidade predominante ou trecho comparado, quando existir",
      "conflito": "por que diverge",
      "sugestao_correcao": "correção sugerida",
      "confianca": "alta|media|baixa",
      "impacto": "critico_documental|risco_de_execucao|tecnico_contratual|revisao_editorial"
    }
  ]
}

Se não encontrar erro relevante, retorne {"findings":[]}.

Além dos achados, devolva em "sintese" UMA LINHA por capítulo do documento.
Não descreva o assunto do capítulo — registre o que ele AFIRMA: sistema
estrutural, resistências, dimensões, quem executa o quê, normas declaradas. É
isso que uma revisão futura pode contradizer, e é para isso que a linha serve.
Use no campo "capitulo" o título do capítulo exatamente como aparece no
documento. Se o documento não tiver capítulos identificáveis, devolve
"sintese":[].

TEXTO DO DOCUMENTO:
${args.textoDoDocumento}
`.trim();
}
