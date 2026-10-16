/**
 * O NÍVEL DO ACHADO, na língua das telas novas (Resultado, Achados, Projeto).
 *
 * O relatório guarda quatro faixas de impacto (`classifyFindingImpact`). A tela
 * mostra cinco níveis, porque a gramática ganhou cor própria, separada da
 * revisão de texto (pedido do Matheus, 30/09/2026): numeração e referência
 * cruzada pedem um olhar técnico; acento e concordância, não.
 *
 * A separação NÃO é um quarto valor gravado — é leitura da mesma faixa
 * editorial: o que o tipo e a categoria do achado chamam de grafia,
 * ortografia, acentuação, concordância ou pontuação vira "texto"; o resto da
 * revisão editorial fica "note". Assim nenhum parecer antigo precisa migrar.
 */
import { classifyFindingDiscipline, classifyFindingDisciplines, classifyFindingImpact, type AuditFinding, type FindingDiscipline } from "./audit-report.ts";

export type Nivel = "block" | "risco" | "decide" | "note" | "texto";

export const NIVEIS: { id: Nivel; nome: string; curto: string; dica: string }[] = [
  { id: "block", nome: "Bloqueia a emissão", curto: "Impedem", dica: "Corrigir antes de gerar o documento." },
  /*
   * 16/10/2026: a faixa técnica virou duas. "Risco" é o que sai errado na obra
   * se executado como está escrito; "Decisão" é o que falta demonstrar ou
   * confirmar. Ver [[faixas-de-impacto.ts]].
   */
  { id: "risco", nome: "Risco na execução", curto: "Risco", dica: "Executado como está escrito, sai errado, inseguro ou mais caro. Corrigir antes de executar." },
  { id: "decide", nome: "Exige decisão técnica", curto: "Decisão", dica: "Premissa, norma ou dado que o responsável precisa demonstrar ou confirmar antes de executar." },
  { id: "note", nome: "Revisão de texto", curto: "Revisão", dica: "Numeração, unidades, referências cruzadas." },
  { id: "texto", nome: "Gramática", curto: "Gramática", dica: "Ortografia, acentuação, concordância. Não muda decisão técnica." },
];

export const DISCIPLINAS: { id: FindingDiscipline; nome: string; sigla: string }[] = [
  { id: "arquitetura", nome: "Arquitetura", sigla: "ARQ" },
  { id: "estrutural", nome: "Estrutural", sigla: "EST" },
  { id: "hidrossanitario", nome: "Hidrossanitário", sigla: "HID" },
  { id: "eletrico", nome: "Elétrico", sigla: "ELE" },
  { id: "ppci", nome: "PPCI / Incêndio", sigla: "PCI" },
  { id: "climatizacao", nome: "Climatização", sigla: "CLI" },
  { id: "terraplenagem", nome: "Terraplenagem", sigla: "TER" },
  { id: "drenagem", nome: "Drenagem", sigla: "DRE" },
  { id: "pavimentacao", nome: "Pavimentação", sigla: "PAV" },
  { id: "sinalizacao", nome: "Sinalização viária", sigla: "SIN" },
  { id: "urbanizacao", nome: "Urbanização", sigla: "URB" },
  { id: "paisagismo", nome: "Paisagismo", sigla: "PAI" },
  { id: "cabeamento", nome: "Cabeamento / CFTV", sigla: "CAB" },
  { id: "gases_medicinais", nome: "Gases medicinais", sigla: "GAS" },
  { id: "acessibilidade", nome: "Acessibilidade", sigla: "ACE" },
  { id: "geral", nome: "Geral / Documental", sigla: "GER" },
];

const GRAMATICA = /\b(?:grafia|ortograf|acentua|concordanc|pontuac|digitac|portugues|palavra trocada|gramat)/;

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function nivelDoAchado(achado: AuditFinding): Nivel {
  const impacto = classifyFindingImpact(achado);
  if (impacto === "critico_documental") return "block";
  if (impacto === "risco_de_execucao") return "risco";
  if (impacto === "tecnico_contratual") return "decide";
  // Só o que o achado diz de SI (tipo e categoria): a evidência é a frase do
  // memorial, e um trecho com erro de acento num achado de numeração não o
  // torna gramática.
  return GRAMATICA.test(semAcento(`${achado.tipo} ${achado.categoria ?? ""}`)) ? "texto" : "note";
}

export function disciplinaDoAchado(achado: AuditFinding): FindingDiscipline {
  return classifyFindingDiscipline(achado);
}

/** A principal primeiro, depois as que o achado também envolve. */
export function disciplinasDoAchado(achado: AuditFinding): FindingDiscipline[] {
  return classifyFindingDisciplines(achado);
}
