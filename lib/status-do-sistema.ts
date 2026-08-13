/**
 * A LINHA DE STATUS da home do admin (A.4).
 *
 * A proposta 2.24 queria trocar os cartões da home por uma tabela mono. Isso é
 * rearranjo: os mesmos números, noutra caixa. O que faltava não era layout, era
 * **veredito** — a home mostrava contagens e deixava a conclusão por conta de
 * quem olhava. `operacional · 3 auditorias/24h · 0 falhas de provedor · R$ 14,20`
 * responde de uma vez a pergunta que se faz ao abrir a tela.
 *
 * O VEREDITO É DERIVADO, nunca digitado, e é conservador: qualquer dúvida
 * rebaixa. Um "operacional" otimista é pior que nenhum, porque quem confiar
 * nele descobre a falha pelo cliente.
 *
 * PURO (só `import type` de irmão puro). Roda em node cru
 * (`npm run test:status-do-sistema`).
 */
import { formatarReais, type CotacaoDeclarada } from "./cambio.ts";

export type VereditoDoSistema = "operacional" | "degradado" | "parado";

export interface FatosDoSistema {
  /** Quantos fluxos de IA existem e quantos têm chave. */
  fluxosComChave: number;
  fluxosTotais: number;
  databaseConfigured: boolean;
  auditorias24h: number;
  auditoriasFalhadas24h: number;
  /** Incidentes de provedor guardados por esta instância. */
  falhasDeProvedor: number;
  /** Gasto do mês corrente em dólar; `null` quando não se sabe. */
  gastoDoMesUsd: number | null;
}

export interface StatusDoSistema {
  veredito: VereditoDoSistema;
  /** A linha inteira, pronta para a tela. */
  linha: string;
  /** O porquê do veredito, quando ele não é "operacional". */
  motivo: string;
}

function plural(n: number, singular: string, plural_: string) {
  return `${n} ${n === 1 ? singular : plural_}`;
}

export function statusDoSistema(
  fatos: FatosDoSistema,
  cotacao: CotacaoDeclarada,
): StatusDoSistema {
  const partes: string[] = [];
  let veredito: VereditoDoSistema = "operacional";
  let motivo = "";

  /*
   * PARADO é sobre não poder trabalhar, não sobre estar feio. Sem nenhuma chave
   * de provedor, nenhuma auditoria roda; sem banco, nada do que acontecer fica
   * registrado. As duas coisas param o produto de formas diferentes e as duas
   * merecem a mesma palavra.
   */
  if (fatos.fluxosTotais > 0 && fatos.fluxosComChave === 0) {
    veredito = "parado";
    motivo = "nenhum fluxo de IA tem chave de provedor";
  } else if (!fatos.databaseConfigured) {
    veredito = "parado";
    motivo = "sem DATABASE_URL: nada do que acontecer fica registrado";
  } else if (fatos.auditoriasFalhadas24h > 0) {
    veredito = "degradado";
    motivo = `${plural(fatos.auditoriasFalhadas24h, "auditoria falhou", "auditorias falharam")} nas últimas 24h`;
  } else if (fatos.falhasDeProvedor > 0) {
    veredito = "degradado";
    motivo = `${plural(fatos.falhasDeProvedor, "incidente", "incidentes")} de provedor nesta instância`;
  } else if (fatos.fluxosComChave < fatos.fluxosTotais) {
    veredito = "degradado";
    motivo = `${fatos.fluxosTotais - fatos.fluxosComChave} fluxo(s) sem chave`;
  }

  partes.push(veredito);
  partes.push(`${plural(fatos.auditorias24h, "auditoria", "auditorias")}/24h`);
  partes.push(
    fatos.falhasDeProvedor === 0
      ? "sem falhas de provedor"
      : plural(fatos.falhasDeProvedor, "falha de provedor", "falhas de provedor"),
  );

  /*
   * O CUSTO SÓ ENTRA SE FOR SABIDO. Sem cotação declarada não há real, e sem
   * consumo registrado não há número nenhum — nos dois casos a parcela some em
   * vez de aparecer como "R$ 0,00", que seria uma afirmação falsa sobre o mês.
   */
  const reais = formatarReais(fatos.gastoDoMesUsd, cotacao);
  if (reais) partes.push(`${reais} no mês`);
  else if (fatos.gastoDoMesUsd !== null) {
    partes.push(
      `US$ ${fatos.gastoDoMesUsd.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} no mês`,
    );
  }

  return { veredito, linha: partes.join(" · "), motivo };
}
