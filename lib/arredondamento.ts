/**
 * DIFERENÇA DE CONTA QUE CABE NO ARREDONDAMENTO DESCE PARA EDITORIAL.
 *
 * 17/09/2026, benchmark do 027-24: "total declarado 2.269,34 m³, a soma das
 * parcelas confere 2.269,36 m³" saiu crítico — bloqueando a emissão ao lado de
 * um falso positivo, acima da hierarquia contraditória e da caixa de gordura
 * errada. O prompt manda conferir aritmética (conta escrita é fato objetivo) e
 * isso está certo; o que faltava era distinguir erro de conta de parcela
 * arredondada.
 *
 * NADA É REMOVIDO. A regra de 12/08/2026 é reportar tudo e classificar por
 * consequência: o achado fica, com a mesma evidência, uma faixa abaixo e o
 * motivo escrito. Quem discordar vê a conta.
 *
 * O critério, e por que cada parte:
 * - exatamente DOIS valores decimais na descrição, com o MESMO número de casas —
 *   é o formato "declarado X, confere Y" que o prompt pede. Três valores são
 *   divergência entre capítulos (INC-008); precisões diferentes são outra conta
 *   (INC-006, 44,86 L/dia × 22,3 dias);
 * - palavra de conta no achado (declarado, soma, total, cálculo, aritmético) —
 *   dois valores quase iguais em capítulos diferentes não são arredondamento;
 * - diferença > 0 e até 5 unidades da última casa (dez parcelas arredondadas
 *   pela metade) e até 0,1% do maior valor.
 *
 * PURO.
 */
import { classifyFindingImpact, type AuditFinding } from "./audit-report.ts";

const CONTA = /aritm|soma|somat|total|c[aá]lculo|calculad|confere|declarad/i;
const DECIMAL = /\d{1,3}(?:\.\d{3})+,\d+|\d+,\d+/g;

function lerValor(bruto: string): { valor: number; casas: number } {
  const [, decimais = ""] = bruto.split(",");
  return { valor: Number(bruto.replace(/\./g, "").replace(",", ".")), casas: decimais.length };
}

function formatar(valor: number, casas: number): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}

export function calibrarArredondamento(finding: AuditFinding): {
  finding: AuditFinding;
  /** A frase do motivo, quando desceu; `null` quando o achado ficou como estava. */
  nota: string | null;
} {
  const semMudanca = { finding, nota: null };

  const impacto = finding.impacto ?? classifyFindingImpact(finding);
  if (impacto === "revisao_editorial") return semMudanca;

  const descricao = String(finding.descricao ?? "");
  if (!CONTA.test([finding.tipo, finding.categoria ?? "", descricao].join(" "))) {
    return semMudanca;
  }

  const brutos = [...new Set(descricao.match(DECIMAL) ?? [])];
  if (brutos.length !== 2) return semMudanca;

  const [a, b] = brutos.map(lerValor);
  if (a.casas !== b.casas || !Number.isFinite(a.valor) || !Number.isFinite(b.valor)) {
    return semMudanca;
  }

  const diferenca = Math.abs(a.valor - b.valor);
  const unidade = 10 ** -a.casas;
  const maior = Math.max(Math.abs(a.valor), Math.abs(b.valor));
  const cabe =
    diferenca > 0 && diferenca <= 5 * unidade + 1e-9 && maior > 0 && diferenca / maior <= 0.001;
  if (!cabe) return semMudanca;

  const nota =
    `Diferença de ${formatar(diferenca, a.casas)} entre ${brutos[0]} e ${brutos[1]} cabe no ` +
    `arredondamento de ${a.casas} casa(s) decimal(is): não impede emitir.`;

  return {
    nota,
    finding: {
      ...finding,
      impacto: "revisao_editorial",
      conflito: [finding.conflito, nota].filter(Boolean).join(" "),
    },
  };
}
