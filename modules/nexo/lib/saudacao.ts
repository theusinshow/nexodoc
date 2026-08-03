/**
 * A frase de entrada do Nexo: o cumprimento pela hora + a pergunta.
 *
 * PURO: nenhum import e nenhuma leitura de relógio aqui dentro — a hora chega
 * por parâmetro. Além de deixar rodar em Node pelado no
 * `scripts/test-nexo-saudacao.ts`, é o que impede o erro clássico desta tela:
 * ler `new Date()` durante o render faz o servidor escrever "Boa noite" e o
 * navegador hidratar "Boa tarde", e a árvore quebra.
 */

/**
 * A saudação pela hora local. As faixas são as do escritório, não as do
 * dicionário: o expediente começa cedo, e a madrugada é do plantão de entrega
 * — quem está aqui às 3h merece "boa noite", não "bom dia".
 */
export function saudacaoDaHora(hora: number): string {
  const h = Number.isFinite(hora) ? Math.floor(hora) : 12;
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

/** Só o primeiro nome: "Boa tarde, Matheus" — não "Matheus Mendes da Silva". */
export function primeiroNome(nome: string | null | undefined): string {
  const limpo = (nome ?? "").trim();
  if (!limpo) return "";
  const primeiro = limpo.split(/\s+/)[0];
  /*
   * Nome em CAIXA ALTA (alguns provedores devolvem assim) vira Capitalizado:
   * "BOA TARDE, MATHEUS" soa como grito, e a tela inteira é falada em voz baixa.
   */
  return primeiro.length > 1 && primeiro === primeiro.toUpperCase()
    ? primeiro[0] + primeiro.slice(1).toLowerCase()
    : primeiro;
}

/**
 * A frase inteira, em duas linhas: o cumprimento e a pergunta.
 *
 * A pergunta nomeia as DUAS portas de propósito. A tela dizia só "montar" e
 * falava só de pranchas — quem chegava com um memorial na mão não tinha como
 * saber que a auditoria mora aqui.
 */
export function montarSaudacao(hora: number, nome: string | null | undefined): string {
  const quem = primeiroNome(nome);
  const abertura = quem ? `${saudacaoDaHora(hora)}, ${quem}.` : `${saudacaoDaHora(hora)}.`;
  return `${abertura}\nO que vamos montar — ou auditar?`;
}
