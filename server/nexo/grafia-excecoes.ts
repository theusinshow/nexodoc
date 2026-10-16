/**
 * O QUE O DICIONÁRIO NÃO CONHECE E ESTÁ CERTO — só o que se repete em TODO
 * projeto do escritório.
 *
 * Medido em 16/10/2026 rodando o dicionário sobre 80 folhas de `docs/samples`
 * (60 PDFs de 040-26, 113-22 e outros): das 161 palavras estranhadas, estas
 * aparecem em folha de qualquer disciplina e de qualquer cliente — o carimbo,
 * as concessionárias de SC, o jargão de obra. Cada uma, sem esta lista, viraria
 * um "fora do dicionário" em todo volume.
 *
 * O que NÃO entra: marca de equipamento, nome científico de planta, nome de
 * pessoa. Variam de projeto para projeto, e quem os separa do erro é a IA, que
 * lê a frase. Esta lista é para o que é certo SEMPRE.
 */
export const EXCECOES_DA_GRAFIA: readonly string[] = [
  // O carimbo do escritório
  "PROSUL",
  "Prosul",
  "Home-page",
  "home-page",
  "Email",
  "e-mail",
  "Ltda",
  // Órgãos e concessionárias de Santa Catarina
  "CBMSC",
  "CELESC",
  "CASAN",
  // Jargão de obra que o dicionário não tem
  "drywall",
  "DRYWALL",
  "shaft",
  "SHAFT",
  "paver",
  "PAVER",
  "radier",
  "RADIER",
  "plenum",
  "PLENUM",
  "plenuns",
  "PLENUNS",
  "slump",
  "SLUMP",
  "rack",
  "RACK",
  "podotátil",
  "PODOTÁTIL",
  "cimentícia",
  "CIMENTÍCIA",
  "cimentícias",
  "CIMENTÍCIAS",
  "iluminamento",
  "ILUMINAMENTO",
  "equipotencialização",
  "EQUIPOTENCIALIZAÇÃO",
  "equipotencializada",
  "EQUIPOTENCIALIZADA",
  "autofechante",
  "AUTOATARRACHANTE",
  "hidrorrepelente",
  "HIDRORREPELENTE",
  "rechapeamento",
];
