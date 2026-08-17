/**
 * O NOME DA OBRA lido do memorial — o gabarito de que toda a auditoria depende.
 *
 * Se ele vier truncado, a comparação de identidade compara contra um nome que
 * não existe. Foi o que aconteceu no memorial 084_25 (17/08/2026): o gabarito
 * saiu `"Reforma e Adequação da EMEB (Escola Municipal de Ensino Básico)"`, sem
 * `"Rubens de Arruda Ramos"` — e a regra passou a acusar de "obra divergente"
 * todas as páginas que citavam a obra pelo nome próprio, que é o certo.
 *
 * DOIS DEFEITOS, reproduzidos:
 *
 * 1. **A quebra de linha.** A captura era `[^,.;\n]`, e o `\n` só passou a
 *    existir dentro de uma página quando a extração parou de achatar tudo
 *    (mesma data). O nome que ocupa duas linhas passou a ser cortado na
 *    primeira. A correção da extração está certa; ela apenas revelou isto.
 * 2. **O parêntese.** O rodapé `084_25 – NOME – PROJETO EXECUTIVO` era casado
 *    por `[A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]`, que não inclui `(`. Num nome com aposto entre
 *    parênteses o rodapé simplesmente não casava.
 *
 * PURO e sem `@/`: recebe o texto, devolve o nome. É o que permite provar as
 * duas regressões em node cru, sem PDF.
 */

/**
 * Uma linha que ABRE outro campo — "Município:", "Órgão:", "Local:".
 *
 * É o que impede a continuação de engolir o campo seguinte quando o nome ocupa
 * duas linhas. Sem esta guarda, juntar linhas devolveria
 * "…Rubens de Arruda Ramos Município: Criciúma" — pior que truncar, porque um
 * gabarito errado é aceito em silêncio enquanto um truncado ao menos destoa.
 */
const OUTRO_CAMPO = /^\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç.\s]{2,30}:/;

/** Pontuação que fecha o nome, esteja onde estiver. */
const FIM_DO_NOME = /[,.;]/;

/**
 * O nome declarado no campo "Obra:", atravessando quebra de linha quando ela é
 * só continuação — nunca quando começa outro campo.
 */
function doCampoObra(texto: string): string {
  const inicio = /\bObra\s*:\s*/i.exec(texto);
  if (!inicio) return "";

  const resto = texto.slice(inicio.index + inicio[0].length);
  const linhas = resto.split("\n");
  const partes: string[] = [];

  for (const [i, linha] of linhas.entries()) {
    if (i > 0 && OUTRO_CAMPO.test(linha)) break;

    const corte = FIM_DO_NOME.exec(linha);
    const pedaco = (corte ? linha.slice(0, corte.index) : linha).trim();

    if (pedaco) partes.push(pedaco);
    // Pontuação fecha o nome; linha vazia também (parágrafo novo).
    if (corte || (i > 0 && !pedaco)) break;
    // Piso de segurança: nome de obra não tem 200 caracteres.
    if (partes.join(" ").length > 200) break;
  }

  const nome = partes.join(" ").replace(/\s+/g, " ").trim();
  return nome.length >= 4 ? nome.slice(0, 160) : "";
}

/**
 * O nome no rodapé `084_25 – NOME DA OBRA – PROJETO EXECUTIVO`.
 *
 * Preferido ao campo quando existe: o rodapé se repete em todas as páginas e
 * costuma vir mais limpo que a linha da capa.
 *
 * A classe aceita parêntese, dígito e ponto porque nome real os tem — "EMEB
 * (Escola Municipal de Ensino Básico)", "UBS Porte 2". O que ela NÃO aceita é o
 * travessão, que é o delimitador.
 */
function doRodape(texto: string): string {
  const m =
    /\b\d{2,4}[_-]\d{2}\s*[–-]\s*([A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç0-9()./\s]{4,120}?)\s*[–-]\s*PROJETO/i.exec(
      texto,
    );

  return (m?.[1] ?? "").replace(/\s+/g, " ").trim();
}

/**
 * O nome da obra, na ordem de confiança: rodapé, depois campo declarado.
 * Devolve "" quando não encontra — nunca chuta, porque gabarito inventado é
 * pior que gabarito ausente: ele reprova a obra certa.
 */
export function nomeDaObra(texto: string): string {
  return doRodape(texto) || doCampoObra(texto);
}
