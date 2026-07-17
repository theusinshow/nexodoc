// Registro de prefeituras atendidas pelo escritório (item 1 — ground truth).
//
// Fase 1: lista fixa semeada aqui (as 5 prefeituras ativas). Cada prefeitura é um
// mini-registro { município, UF, concessionária esperada } — a concessionária
// alimenta a regra determinística de energia (audit-coherence). Fase 2 (futuro):
// tornar editável por admin e persistir no banco.

export type Prefeitura = {
  /** id estável (kebab) usado no formulário e na persistência */
  id: string;
  /** rótulo exibido no seletor */
  nome: string;
  municipio: string;
  uf: string;
  /** concessionária de energia esperada para o município (referência da regra elétrica) */
  concessionariaEsperada: string;
};

export const PREFEITURAS: Prefeitura[] = [
  { id: "criciuma-sc", nome: "Criciúma – SC", municipio: "Criciúma", uf: "SC", concessionariaEsperada: "CELESC" },
  { id: "chapeco-sc", nome: "Chapecó – SC", municipio: "Chapecó", uf: "SC", concessionariaEsperada: "CELESC" },
  { id: "urubici-sc", nome: "Urubici – SC", municipio: "Urubici", uf: "SC", concessionariaEsperada: "CELESC" },
  { id: "sao-jose-sc", nome: "São José – SC", municipio: "São José", uf: "SC", concessionariaEsperada: "CELESC" },
  { id: "florianopolis-sc", nome: "Florianópolis – SC", municipio: "Florianópolis", uf: "SC", concessionariaEsperada: "CELESC" },
];

/** valor especial para "prefeitura não listada" (escape hatch da lista fixa) */
export const PREFEITURA_OUTRA_ID = "outra";

export function findPrefeitura(id: string | null | undefined): Prefeitura | null {
  if (!id) {
    return null;
  }

  return PREFEITURAS.find((item) => item.id === id) ?? null;
}
