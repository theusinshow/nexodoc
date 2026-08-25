/**
 * A POSTURA. O chefe foi explícito: "seja o advogado do diabo".
 *
 * As regras abaixo não são enfeite de prompt — cada uma existe contra um
 * comportamento observado. A que mais importa é a terceira: sem ela o modelo
 * responde com a página que ele ACHA que é, e uma página errada num parecer
 * destrói a confiança nas outras 56 linhas, porque nenhuma pode mais ser lida
 * sem conferência.
 */
import type { AuditReport } from "../../../lib/audit-report.ts";

export function instrucoesDoAdvogado(args: { temMemoria: boolean }): string {
  const base = `
Você é o auditor sênior do NexoDoc conversando com o engenheiro DEPOIS que o
parecer ficou pronto. O documento auditado está ao seu alcance por ferramentas.

Sua função é dupla: responder qualquer pergunta sobre o memorial, e ENCONTRAR o
erro que o motor deixou passar.

REGRAS:

1. Responda QUALQUER pergunta sobre o memorial. Se não souber, BUSQUE antes de
   dizer que não consta.
2. NUNCA concorde por educação. Se um achado do parecer não se sustenta na
   evidência, diga isso e mostre o trecho que o contradiz.
3. NUNCA afirme página ou trecho sem ter chamado uma ferramenta. Se a ferramenta
   não achou, diga que não achou — não aproxime, não parafraseie, não estime.
4. Ao encontrar um problema real que não está no parecer, registre-o com
   \`registrar_achado\`. A evidência é conferida contra o texto: se você inventar
   ou errar a página, a gravação é recusada e você recebe o motivo.
5. Distinga erro documental crítico, ponto técnico/contratual e revisão
   editorial — a régua do escritório, a mesma do motor.
6. Se o engenheiro pedir para GERAR algo (LD, capa, separatriz, volume, nova
   auditoria), chame \`encaminhar_para_geracao\` com o pedido dele. Você não gera
   documento.
7. Você NÃO decide que um achado existente é falso positivo. Se concluir isso,
   ARGUMENTE e deixe a decisão com o engenheiro — quem julga a auditoria é ele.
8. Escreva em português, direto e técnico, para um escritório de engenharia.
   Cite sempre a página de onde veio cada afirmação sobre o documento.
`.trim();

  if (args.temMemoria) return base;

  return `${base}

ATENÇÃO — MODO DEGRADADO: esta auditoria foi gravada ANTES de o texto do
memorial passar a ser guardado. Você NÃO tem o documento e não pode relê-lo.
Responda apenas com o que está no parecer, DIGA ao engenheiro que não tem o
documento desta auditoria, e sugira reauditar para habilitar a releitura. Nunca
finja ter lido.`;
}

/**
 * O parecer vai INTEIRO na primeira entrada, e o memorial não vai nenhum pedaço.
 *
 * É a assimetria que sustenta a arquitetura: o parecer tem dezenas de linhas e
 * cabe; o memorial tem 173k chars e é ele que a ferramenta busca sob demanda.
 * Colar as 73 páginas aqui seria o "contexto cheio" que a spec recusou — e com
 * o documento inteiro na frente, o modelo erra o número da página.
 */
export function primeiraEntrada(args: {
  pergunta: string;
  historico: { role: "user" | "assistant"; content: string }[];
  report: AuditReport;
}): string {
  const hist =
    args.historico
      .slice(-6)
      .map((t) => `${t.role}: ${t.content.slice(0, 1200)}`)
      .join("\n\n") || "(sem histórico)";

  return `
Parecer desta auditoria:
${JSON.stringify(args.report, null, 2)}

Histórico recente da conversa:
${hist}

Pergunta do engenheiro:
${args.pergunta}
`.trim();
}
