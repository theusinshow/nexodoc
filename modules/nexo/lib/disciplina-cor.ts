/**
 * Disciplina → sigla de três letras e cor do canvas.
 *
 * A REGRA, do sistema de design: o código mono de três letras é o portador
 * PRIMÁRIO; a cor é secundária. Nenhuma decisão do produto pode depender só da
 * cor — quem não distingue matiz continua lendo "ARQ" e "EST".
 *
 * São oito cores para vinte e três códigos do léxico do escritório, e isso é de
 * propósito: agrupar por família (tudo que é terra numa cor, tudo que é
 * instalação elétrica noutra) mantém a escala legível. O que não casa fica SEM
 * cor — inventar um tom para cada código faria a paleta competir com os três
 * sinais de status, que é justamente o que a escala categórica não pode fazer.
 *
 * PURO e sem imports: dá para testar no node cru.
 */

/** Normaliza para comparação: minúsculas, sem acento. */
function normalizar(valor: string): string {
  return valor
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Famílias, na ordem de teste. A primeira que casar vence. */
const FAMILIAS: { sigla: string; token: string; termos: string[] }[] = [
  { sigla: "ARQ", token: "arq", termos: ["arquitet"] },
  {
    sigla: "EST",
    token: "est",
    termos: ["estrutur", "forma", "fundac", "metalic"],
  },
  { sigla: "HID", token: "hid", termos: ["hidro", "hidros", "agua", "sanitar"] },
  {
    sigla: "ELE",
    token: "ele",
    termos: ["eletric", "eletr", "cabeament", "cftv", "spda"],
  },
  { sigla: "PCI", token: "pci", termos: ["incendio", "preventivo", "ppci"] },
  { sigla: "CLI", token: "cli", termos: ["climatiz", "gases", "medicinais"] },
  {
    sigla: "TER",
    token: "ter",
    termos: [
      "terraplen",
      "drenagem",
      "pavimenta",
      "topografia",
      "sondagem",
      "geometric",
      "levantament",
    ],
  },
  { sigla: "PAI", token: "pai", termos: ["paisag", "urbanis"] },
];

/** Sigla de três letras. Sem família conhecida, as três primeiras do rótulo. */
export function siglaDaDisciplina(disciplina: string | null | undefined): string {
  const valor = normalizar(disciplina ?? "");
  if (!valor) return "";
  for (const familia of FAMILIAS) {
    if (familia.termos.some((t) => valor.startsWith(t) || valor.includes(t))) {
      return familia.sigla;
    }
  }
  return valor.slice(0, 3).toLocaleUpperCase("pt-BR");
}

/**
 * A variável CSS da cor, ou `null` quando a disciplina não pertence a nenhuma
 * das oito famílias — sem cor é melhor que cor errada.
 */
export function corDaDisciplina(
  disciplina: string | null | undefined,
): string | null {
  const valor = normalizar(disciplina ?? "");
  if (!valor) return null;
  for (const familia of FAMILIAS) {
    if (familia.termos.some((t) => valor.startsWith(t) || valor.includes(t))) {
      return `var(--discipline-${familia.token})`;
    }
  }
  return null;
}
