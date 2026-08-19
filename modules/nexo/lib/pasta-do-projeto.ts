/**
 * COMO O PROJETO SE CHAMA NO HISTÓRICO — a pasta e a conversa.
 *
 * Núcleo PURO → `node scripts/test-pasta-do-projeto.ts`.
 *
 * O histórico deixou de ser uma lista de conversas e passou a ser a lista dos
 * PROJETOS. A pasta é o projeto — `084-25-CRICIUMA`, que é como o escritório o
 * chama: está na pasta de rede, no carimbo e no e-mail. Dentro dela ficam o
 * volume e a auditoria do memorial, lado a lado.
 *
 * Antes havia DUAS derivações, e nenhuma fazia isto: o volume derivava
 * `folderKey` = só o código (`084_25`, sem prefeitura, e dois municípios podem
 * ter o mesmo número de contrato), e a auditoria derivava o TÍTULO como centro
 * de custo. A função que monta o nome certo já existia — usada no lugar errado.
 */
import { centroDeCustoDaAuditoria } from "../../../lib/audit-identity.ts";
import { siglaDaDisciplina } from "./disciplina-cor.ts";

/**
 * `084-25-CRICIUMA`, ou `""` quando falta código OU prefeitura.
 *
 * SEM PREFEITURA NÃO HÁ PASTA, e isso é decisão, não limitação: uma pasta
 * `084-25` que amanhã vira `084-25-CRICIUMA` muda de identidade debaixo de quem
 * está usando, e quem já a tinha aberto perde a referência. A conversa fica em
 * "Sem pasta" até a prefeitura ser decidida — que é a MESMA decisão que a capa
 * e a separatriz esperam, e é por isso que ela aparece cedo: o nome da pasta é
 * a decisão da prefeitura ficando visível no minuto zero.
 *
 * O carimbo entrega `084_25`; a normalização para hífen acontece AQUI, e não em
 * cada chamador — senão duas telas escrevem o mesmo projeto de dois jeitos e o
 * histórico ganha duas pastas para uma obra.
 */
export function pastaDoProjeto(
  codigo: string | null | undefined,
  prefeitura: string | null | undefined,
): string {
  const cc = (codigo ?? "").trim();
  const pref = (prefeitura ?? "").trim();
  if (!cc || !pref) return "";
  return centroDeCustoDaAuditoria(cc.replace(/_/g, "-"), pref);
}

/** O separador entre siglas. Ponto médio, não vírgula: não parece uma frase. */
const ENTRE_SIGLAS = " · ";

/**
 * `MET`, ou `MET · HIS · INC` no volume misto.
 *
 * O misto é o CASO COMUM, não a exceção: seis dos oito volumes reais do
 * escritório misturam disciplinas. Um nome que só funcionasse com uma
 * disciplina estaria errado na maioria das vezes.
 *
 * A ordem é a de ENTRADA, não alfabética: é a ordem em que as pranchas foram
 * anexadas, e é por ela que quem montou o volume o reconhece na lista.
 */
export function nomeDoVolume(
  disciplinas: readonly (string | null | undefined)[],
): string {
  const vistas: string[] = [];
  for (const d of disciplinas) {
    const sigla = siglaDaDisciplina(d);
    if (sigla && !vistas.includes(sigla)) vistas.push(sigla);
  }
  return vistas.join(ENTRE_SIGLAS);
}
