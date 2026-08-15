/**
 * O FISCAL DA SUGESTÃO — "conferir" sozinho não é uma ação.
 *
 * A auditoria já fiscaliza a EXISTÊNCIA do achado: `audit-verify.ts` descarta o
 * que cita evidência inexistente, `audit-precision-recall.ts` mede precisão e
 * recall dos motores. O que ninguém olhava era o campo que a pessoa LÊ para
 * agir — e o resultado apareceu no nosso próprio código, não no da IA: motores
 * determinísticos escreviam "Conferir o município correto e padronizar todos os
 * documentos" sabendo os dois valores e as duas páginas.
 *
 * A regra que este módulo executa é a mesma que o `auditor-prompt.ts` já manda,
 * escrita lá com estas palavras: *"A ação recomendada tem de ser executável por
 * quem edita o documento: diga o que trocar, onde e por qual valor quando o
 * documento permitir determiná-lo. 'Conferir' sozinho só é aceitável quando a
 * informação necessária não está no documento — e aí diga onde buscá-la."*
 *
 * PURO: sem imports, para rodar em node cru.
 *
 * O QUE ELE NÃO FAZ, e é importante saber: ele mede FORMA, não acerto. Uma
 * sugestão pode citar os dois valores e ainda propor a troca errada. Acerto se
 * mede com documentos rotulados, que é trabalho de outra ordem. Este fiscal
 * garante o piso — que a frase diga a alguém o que fazer.
 */

/**
 * Verbos que sozinhos não instruem ninguém. Não são proibidos: são insuficientes
 * quando aparecem SEM um alvo concreto ao lado.
 */
const VERBOS_VAGOS = [
  "conferir",
  "confirmar",
  "verificar",
  "checar",
  "revisar",
  "validar",
  "analisar",
  "avaliar",
  "padronizar",
  "ajustar",
  "corrigir",
  "atentar",
];

/** Um valor citado literalmente, entre aspas retas ou curvas. */
const CITACAO = /["“”][^"“”]{2,}["“”]/;

/**
 * "onde buscar" — a exceção que o prompt admite quando o documento não traz o
 * valor. Exige a menção a uma FONTE (norma, órgão, projeto, responsável) ou a um
 * lugar do documento, não só a confissão de que falta.
 */
const ONDE_BUSCAR =
  /\b(abnt|nbr|norma|prefeitura|órg[ãa]o|orgao|contratante|projetista|respons[áa]vel|mem[óo]ria de c[áa]lculo|cap[íi]tulo\s*\d|item\s*\d|prancha\s*\w|planta|anexo|p\.\s*\d|p[áa]gina\s*\d)\b/i;

export interface VereditoDaSugestao {
  ok: boolean;
  /** Por que reprovou. Ausente quando passa. */
  motivo?: string;
}

/**
 * A sugestão diz a alguém o que fazer?
 *
 * Passa quando cita um valor literal (o caso normal: o motor conhece os valores)
 * OU quando explica onde buscar a informação que falta (a exceção do prompt).
 */
export function sugestaoEhAcionavel(sugestao: string): VereditoDaSugestao {
  const texto = (sugestao ?? "").trim();
  if (texto.length < 12) {
    return { ok: false, motivo: "sugestão vazia ou curta demais para instruir alguém" };
  }

  if (CITACAO.test(texto)) return { ok: true };
  if (ONDE_BUSCAR.test(texto)) return { ok: true };

  /*
   * Chegando aqui, não há valor citado nem fonte onde buscar. Se além disso a
   * frase é conduzida por um verbo vago, ela manda a pessoa "ir olhar" sem dizer
   * o quê — que é exatamente a frase que este fiscal existe para recusar.
   */
  const primeiraPalavra = texto.toLowerCase().replace(/^[^a-zà-ú]+/i, "").split(/\s+/)[0] ?? "";
  const comecaVago = VERBOS_VAGOS.some((v) => primeiraPalavra.startsWith(v.slice(0, 6)));
  if (comecaVago) {
    return {
      ok: false,
      motivo: "verbo vago sem alvo: nem cita o valor nem diz onde buscá-lo",
    };
  }

  return {
    ok: false,
    motivo: "sem alvo concreto: não cita valor literal nem fonte onde buscar",
  };
}
