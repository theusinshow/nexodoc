/**
 * CONFERÊNCIA DE IDENTIDADE DO SELO — núcleo puro.
 *
 * A dor que a originou é real e cara: um projeto foi enviado a uma prefeitura
 * **com o logo de outra**. A conferência leve (`light-check-core.ts`) confere
 * código, obra, revisão e numeração — tudo o que o selo diz sobre o PROJETO —,
 * mas nada sobre para QUEM ele está indo.
 *
 * A divisão de trabalho aqui é deliberada e é o ponto do módulo:
 *
 *   a IA LÊ, a regra JULGA.
 *
 * O modelo de visão devolve o que enxerga no carimbo (endereço, órgão, o que
 * está escrito no brasão, o campo de numeração) e nada mais — nunca um
 * veredito. Comparar o que ele leu com a prefeitura-alvo é código
 * determinístico, aqui, testável em node cru e sem chance de alucinar um "está
 * tudo certo". Um modelo que erra a leitura produz um achado errado, que se vê
 * e se corrige; um modelo que erra o veredito produz um volume aprovado no
 * escuro, que é exatamente o acidente que se quer evitar.
 *
 * PURO: sem imports de runtime, para rodar em node pelado no
 * `scripts/test-nexo-selo-identity.ts`.
 */

import type { LightCheckFinding, LightCheckVeredito } from "./light-check-core";

export type { LightCheckFinding, LightCheckVeredito };

/** O que o modelo de visão leu de UMA amostra de carimbo. Leitura, não juízo. */
export interface LeituraDoSelo {
  /** rótulo de exibição — `arquivo · p.N`. */
  label: string;
  /** Endereço da obra como escrito no selo/cabeçalho; "" se não aparece. */
  endereco: string;
  /** Órgão/prefeitura como escrito no selo; "" se não aparece. */
  orgao: string;
  /** Há brasão/logo de órgão na folha? */
  logoPresente: boolean;
  /**
   * A quem o brasão pertence, segundo o que está ESCRITO nele ou ao lado.
   * "" quando há logo mas não dá para atribuir — caso que vira pergunta, não
   * aprovação.
   */
  logoOrgao: string;
  /** O campo de numeração como está escrito no selo ("01/11", "1 de 11"). */
  numeracaoTexto: string;
  /** Folha e total lidos desse campo; null quando ilegível. */
  folha: number | null;
  total: number | null;
}

/** Contra o que se confere: a intenção DECLARADA, nunca inferida da capa. */
export interface AlvoDaConferencia {
  /** A prefeitura para quem o volume vai ("Prefeitura Municipal de Chapecó"). */
  orgao: string;
  /**
   * O que se espera de cada amostra:
   *
   * - `folha`: o número AUTORITATIVO daquela página — do nome do arquivo,
   *   reconciliado por ordem. É contra ele que "a numeração está correta" se
   *   decide, e discordar dele é defeito no documento.
   * - `total`: o total que a leitura de selo já tinha lido NA MESMA página.
   *   Não é o tamanho do que está em mãos — o carimbo fala da disciplina
   *   inteira, e comparar `01/11` com "3 pranchas anexadas" acusava toda
   *   amostra parcial. Aqui a comparação é entre DUAS LEITURAS do mesmo campo.
   */
  esperado: { label: string; folha: number | null; total: number | null }[];
}

export interface SeloIdentityResult {
  veredito: LightCheckVeredito;
  findings: LightCheckFinding[];
  /** Amostras conferidas — a UI diz sobre quantas folhas o veredito fala. */
  amostras: number;
}

const RANK: Record<LightCheckVeredito, number> = { ok: 0, aviso: 1, critico: 2 };

/** minúsculas, sem acento, sem pontuação, espaço colapsado. */
function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Palavras que todo nome de prefeitura carrega e que, por isso, não
 * identificam ninguém. Sem tirá-las, "Prefeitura Municipal de Chapecó" e
 * "Prefeitura Municipal de Criciúma" casariam em três das quatro palavras — e
 * a conferência aprovaria justamente o erro que existe para pegar.
 */
const VAZIAS = new Set([
  "prefeitura",
  "municipal",
  "municipio",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "estado",
  "governo",
  "secretaria",
  "obras",
  "planejamento",
  "urbanismo",
  "desenvolvimento",
]);

/** O que RESTA de um nome de órgão depois de tirar o que é comum a todos. */
function nucleo(valor: string): string[] {
  return normalizar(valor)
    .split(" ")
    .filter((p) => p.length > 2 && !VAZIAS.has(p));
}

/**
 * Dois nomes de órgão apontam para o mesmo município?
 *
 * Compara o NÚCLEO (o que sobra fora das palavras comuns): sem núcleo em
 * comum, são órgãos diferentes. Devolve `null` quando não dá para decidir
 * (algum lado sem núcleo) — e "não sei" nunca deve virar aprovação.
 */
export function mesmoOrgao(a: string, b: string): boolean | null {
  const na = nucleo(a);
  const nb = nucleo(b);
  if (na.length === 0 || nb.length === 0) return null;
  return na.some((p) => nb.includes(p));
}

/** Lista curta e legível (a mensagem não pode estourar com 200 folhas). */
function juntar(nomes: string[], max = 4): string {
  if (nomes.length <= max) return nomes.join(", ");
  return `${nomes.slice(0, max).join(", ")} (+${nomes.length - max})`;
}

/**
 * O veredito sobre a identidade do selo, a partir do que a IA leu.
 *
 * Três dimensões, cada uma com a severidade que o estrago justifica:
 *
 * - **órgão** — o selo aponta outra prefeitura que não a declarada: CRÍTICO. É
 *   o acidente que motivou o módulo, e ele não tem meio-termo.
 * - **endereço** — ausente ou divergente entre as folhas: AVISO. Divergir é
 *   sinal de prancha intrusa ou revisão velha, mas endereço é o campo que o
 *   OCR mais erra, e um crítico falso aqui destruiria a confiança no semáforo.
 * - **logo** — de outro órgão: CRÍTICO. Presente mas não atribuível: AVISO com
 *   pedido de conferência humana. NUNCA aprovado no escuro: um logo que o
 *   modelo não soube ler é exatamente o caso do acidente.
 * - **numeração** — o carimbo discorda do que a folha deveria ser: AVISO.
 */
export function checkSeloIdentity(
  leituras: LeituraDoSelo[],
  alvo: AlvoDaConferencia,
): SeloIdentityResult {
  const findings: LightCheckFinding[] = [];
  if (leituras.length === 0) {
    return { veredito: "ok", findings, amostras: 0 };
  }

  // --- Órgão × prefeitura-alvo (CRÍTICO) -------------------------------------
  const outroOrgao = leituras.filter(
    (l) => l.orgao.trim() && mesmoOrgao(l.orgao, alvo.orgao) === false,
  );
  if (outroOrgao.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "orgao",
      mensagem: `O selo aponta outro órgão que não ${alvo.orgao} em ${outroOrgao.length} folha(s) conferida(s).`,
      detalhe: juntar(outroOrgao.map((l) => `${l.label}: "${l.orgao}"`)),
    });
  }
  const semOrgao = leituras.filter((l) => !l.orgao.trim());
  if (semOrgao.length === leituras.length) {
    findings.push({
      severidade: "aviso",
      campo: "orgao",
      mensagem: "Nenhuma folha conferida traz o nome do órgão no selo.",
      detalhe: juntar(semOrgao.map((l) => l.label)),
    });
  }

  // --- Logo (CRÍTICO se de outro órgão; nunca aprovado no escuro) ------------
  const logoDeOutro = leituras.filter(
    (l) => l.logoPresente && l.logoOrgao.trim() && mesmoOrgao(l.logoOrgao, alvo.orgao) === false,
  );
  if (logoDeOutro.length > 0) {
    findings.push({
      severidade: "critico",
      campo: "logo",
      mensagem: `Brasão de outro órgão na folha — o volume vai para ${alvo.orgao}.`,
      detalhe: juntar(logoDeOutro.map((l) => `${l.label}: "${l.logoOrgao}"`)),
    });
  }

  const semLogo = leituras.filter((l) => !l.logoPresente);
  if (semLogo.length > 0) {
    findings.push({
      severidade: "aviso",
      campo: "logo",
      mensagem: `Sem brasão do órgão em ${semLogo.length} de ${leituras.length} folha(s) conferida(s).`,
      detalhe: juntar(semLogo.map((l) => l.label)),
    });
  }

  const logoIndefinido = leituras.filter(
    (l) => l.logoPresente && !l.logoOrgao.trim(),
  );
  if (logoIndefinido.length > 0) {
    findings.push({
      severidade: "aviso",
      campo: "logo",
      mensagem: `Há brasão, mas não deu para dizer de quem é em ${logoIndefinido.length} folha(s) — confira à vista se é o de ${alvo.orgao}.`,
      detalhe: juntar(logoIndefinido.map((l) => l.label)),
    });
  }

  // --- Endereço: presença e coerência interna (AVISO) ------------------------
  const semEndereco = leituras.filter((l) => !l.endereco.trim());
  if (semEndereco.length > 0) {
    findings.push({
      severidade: "aviso",
      campo: "endereco",
      mensagem: `Sem endereço da obra no selo em ${semEndereco.length} de ${leituras.length} folha(s) conferida(s).`,
      detalhe: juntar(semEndereco.map((l) => l.label)),
    });
  }

  const enderecos = new Map<string, string[]>();
  for (const l of leituras) {
    const chave = normalizar(l.endereco);
    if (!chave) continue;
    if (!enderecos.has(chave)) enderecos.set(chave, []);
    enderecos.get(chave)!.push(l.label);
  }
  if (enderecos.size > 1) {
    const mostra = leituras.filter((l) => l.endereco.trim());
    findings.push({
      severidade: "aviso",
      campo: "endereco",
      mensagem: `Endereços divergentes entre as folhas conferidas (${enderecos.size} versões) — pode ser prancha de outra obra ou revisão antiga.`,
      detalhe: juntar(mostra.map((l) => `${l.label}: "${l.endereco}"`)),
    });
  }

  // --- Numeração: o carimbo × o que a folha deveria ser (AVISO) --------------
  const esperadoPor = new Map(alvo.esperado.map((e) => [e.label, e]));
  const divergentes: string[] = [];
  const ilegiveis: string[] = [];
  /*
   * Total lido diferente aqui e na leitura de selo é discordância entre DUAS
   * LEITURAS da mesma página — sinal de OCR, não de documento errado. Vira
   * INFO: quem confere merece saber que o campo está difícil de ler, mas
   * mandar "revisar" um volume por causa de um 4 que virou 5 é o aviso falso
   * que ensina a ignorar o semáforo.
   */
  const totalDiverge: string[] = [];
  for (const l of leituras) {
    if (l.folha == null && l.total == null && !l.numeracaoTexto.trim()) {
      ilegiveis.push(l.label);
      continue;
    }
    const esperado = esperadoPor.get(l.label);
    if (!esperado) continue;
    if (esperado.folha != null && l.folha != null && esperado.folha !== l.folha) {
      divergentes.push(`${l.label}: selo diz ${l.folha}, esperado ${esperado.folha}`);
      continue;
    }
    if (esperado.total != null && l.total != null && esperado.total !== l.total) {
      totalDiverge.push(`${l.label}: ${l.total} aqui, ${esperado.total} na leitura do selo`);
    }
  }
  if (ilegiveis.length > 0) {
    findings.push({
      severidade: "aviso",
      campo: "numeracao",
      mensagem: `Campo de numeração ausente ou ilegível em ${ilegiveis.length} folha(s) conferida(s).`,
      detalhe: juntar(ilegiveis),
    });
  }
  if (divergentes.length > 0) {
    findings.push({
      severidade: "aviso",
      campo: "numeracao",
      mensagem: `A numeração do carimbo discorda da folha em ${divergentes.length} caso(s).`,
      detalhe: juntar(divergentes),
    });
  }
  if (totalDiverge.length > 0) {
    findings.push({
      severidade: "info",
      campo: "numeracao",
      mensagem: `Total de folhas lido de forma diferente pelas duas leituras em ${totalDiverge.length} folha(s) — provável ruído de OCR no campo.`,
      detalhe: juntar(totalDiverge),
    });
  }

  let veredito: LightCheckVeredito = "ok";
  for (const f of findings) {
    const como: LightCheckVeredito =
      f.severidade === "critico" ? "critico" : f.severidade === "aviso" ? "aviso" : "ok";
    if (RANK[como] > RANK[veredito]) veredito = como;
  }

  return { veredito, findings, amostras: leituras.length };
}
