/**
 * O HORÁRIO DE BRASÍLIA — o único lugar do sistema que transforma instante em
 * data para alguém ler.
 *
 * 17/09/2026. O banco guarda UTC, e isso está certo e não muda. O defeito estava
 * na LEITURA: cada tela formatava no fuso de quem rodava o código. O servidor da
 * Render roda em UTC, então data formatada no servidor saía 3 horas adiantada;
 * "é hoje?", "início do mês" e "segunda-feira da semana" viravam à meia-noite
 * UTC, que são 21h em Brasília.
 *
 * Toda formatação e toda conta de CALENDÁRIO passam por aqui, com o fuso
 * explícito. `test-fuso-de-brasilia.ts` falha se alguém formatar data fora deste
 * arquivo.
 *
 * Conta de DURAÇÃO ("há 4 min", "30 dias atrás") não precisa de fuso: é
 * diferença entre instantes.
 *
 * PURO e sem imports.
 */

export const FUSO_DE_BRASILIA = "America/Sao_Paulo";

export type Instante = Date | number | string;

function comoData(quando: Instante): Date {
  return quando instanceof Date ? quando : new Date(quando);
}

/** Formata um instante no horário de Brasília, em pt-BR. */
export function formatarEmBrasilia(quando: Instante, opcoes: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: FUSO_DE_BRASILIA }).format(
    comoData(quando),
  );
}

/** "17/09/2026, 22:30" */
export function formatarDataHora(quando: Instante): string {
  return formatarEmBrasilia(quando, { dateStyle: "short", timeStyle: "short" });
}

/** "17/09" */
export function formatarDiaMes(quando: Instante): string {
  return formatarEmBrasilia(quando, { day: "2-digit", month: "2-digit" });
}

/** "22:30" */
export function formatarHora(quando: Instante): string {
  return formatarEmBrasilia(quando, { hour: "2-digit", minute: "2-digit" });
}

export type PartesDaData = {
  ano: number;
  /** 1 a 12. */
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  /** 0 = domingo, como `Date#getDay`. */
  diaDaSemana: number;
};

const DIAS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Ano, mês, dia, hora e dia da semana como um relógio de Brasília os mostra. */
export function partesEmBrasilia(quando: Instante): PartesDaData {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: FUSO_DE_BRASILIA,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    hourCycle: "h23",
  }).formatToParts(comoData(quando));
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? "";
  return {
    ano: Number(valor("year")),
    mes: Number(valor("month")),
    dia: Number(valor("day")),
    hora: Number(valor("hour")),
    minuto: Number(valor("minute")),
    diaDaSemana: DIAS.indexOf(valor("weekday").toLowerCase()),
  };
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** O dia do calendário em Brasília, como chave "YYYY-MM-DD". */
export function diaEmBrasilia(quando: Instante): string {
  const p = partesEmBrasilia(quando);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}`;
}

export function mesmoDiaEmBrasilia(a: Instante, b: Instante): boolean {
  return diaEmBrasilia(a) === diaEmBrasilia(b);
}

/**
 * O instante em que o mês corrente começou em Brasília (00:00 do dia 1).
 *
 * O deslocamento é MEDIDO no próprio instante, não fixado em -3: o Brasil não tem
 * horário de verão desde 2019, mas se voltar a ter, a tabela de fusos sabe e esta
 * conta acompanha.
 */
export function inicioDoMesEmBrasilia(agora: Instante = new Date()): Date {
  const { ano, mes } = partesEmBrasilia(agora);
  const meiaNoiteComoUtc = Date.UTC(ano, mes - 1, 1, 0, 0, 0);
  const p = partesEmBrasilia(meiaNoiteComoUtc);
  const lidoEmBrasilia = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, 0);
  const deslocamento = lidoEmBrasilia - meiaNoiteComoUtc;
  return new Date(meiaNoiteComoUtc - deslocamento);
}

/**
 * Formata uma CHAVE DE CALENDÁRIO ("2026-09-14"), que não é instante.
 *
 * Aplicar fuso numa data sem hora a desloca um dia (meia-noite UTC é 21h do dia
 * anterior em Brasília). A chave já está no calendário certo; só se escreve.
 */
export function formatarDiaDeCalendario(chave: string, opcoes: Intl.DateTimeFormatOptions): string {
  const data = new Date(`${chave}T00:00:00Z`);
  if (Number.isNaN(data.getTime())) return chave;
  return new Intl.DateTimeFormat("pt-BR", { ...opcoes, timeZone: "UTC" }).format(data);
}

/**
 * A chave "YYYY-MM-DD" do dia UTC — SÓ para dado que já chega agrupado em dias
 * UTC por quem o produz (os baldes diários da API de custo da OpenAI). Rotular
 * esses baldes em Brasília afirmaria um recorte que o dado não tem.
 */
export function chaveDiaUtc(quando: Instante): string {
  return comoData(quando).toISOString().slice(0, 10);
}

/** Soma dias a uma chave "YYYY-MM-DD", sem passar por fuso. */
export function somarDiasNaChave(chave: string, dias: number): string {
  const data = new Date(`${chave}T00:00:00Z`);
  return new Date(data.getTime() + dias * 86_400_000).toISOString().slice(0, 10);
}
