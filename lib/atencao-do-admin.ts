/**
 * O QUE EXIGE AÇÃO, no topo da tela de Configurações.
 *
 * A tela cresceu para nove seções e a ordem delas era a ordem em que foram
 * escritas. Quem abre `/admin/config` quase sempre abre por causa de alguma
 * coisa quebrada — e tinha de varrer a página inteira para descobrir o quê.
 *
 * A regra do que entra aqui: **só o que impede o produto de funcionar agora**.
 * Chave ausente e incidente de provedor entram. Escritório ou cotação não
 * declarados NÃO entram: são opcionais por construção, e transformá-los em
 * pendência ensinaria a ignorar a faixa — que é como faixa de alerta morre.
 *
 * PURO: nenhum import. Roda em node cru (`npm run test:atencao`).
 */

export interface FluxoParaAtencao {
  label: string;
  keyConfigured: boolean;
  placeholderOnly?: boolean;
}

export interface FalhaParaAtencao {
  flow: string;
  provider: string;
  category: string;
}

export interface ItemDeAtencao {
  chave: string;
  texto: string;
  /** `critico` bloqueia o produto; `aviso` degrada mas não impede. */
  gravidade: "critico" | "aviso";
}

export function resumoDeAtencao(entrada: {
  fluxos: readonly FluxoParaAtencao[];
  falhas: readonly FalhaParaAtencao[];
  databaseConfigured: boolean;
}): ItemDeAtencao[] {
  const itens: ItemDeAtencao[] = [];

  const semChave = entrada.fluxos.filter((f) => !f.keyConfigured);
  if (semChave.length > 0) {
    itens.push({
      chave: "sem-chave",
      /*
       * Contagem, não a lista inteira: com 23 fluxos, listar todos os sem-chave
       * empurraria o resto da faixa para fora da tela. O detalhe está na tabela
       * logo abaixo, que é onde se age.
       */
      texto: `${semChave.length} fluxo(s) sem chave de provedor`,
      gravidade: "critico",
    });
  }

  const soPlaceholder = entrada.fluxos.filter((f) => f.keyConfigured && f.placeholderOnly);
  if (soPlaceholder.length > 0) {
    itens.push({
      chave: "placeholder",
      texto: `${soPlaceholder.length} fluxo(s) apontando para modelo de espaço reservado`,
      gravidade: "aviso",
    });
  }

  if (entrada.falhas.length > 0) {
    const categorias = [...new Set(entrada.falhas.map((f) => f.category))];
    itens.push({
      chave: "incidentes",
      texto: `${entrada.falhas.length} incidente(s) de provedor nesta instância (${categorias.join(", ")})`,
      gravidade: "aviso",
    });
  }

  if (!entrada.databaseConfigured) {
    itens.push({
      chave: "sem-banco",
      /*
       * Sem banco não é só "não salva configuração": é histórico que não
       * persiste. Dizer só a consequência de tela esconderia a maior.
       */
      texto: "sem DATABASE_URL — nada do que se declara aqui é gravado, e o histórico não persiste",
      gravidade: "critico",
    });
  }

  // Crítico primeiro; entre iguais, a ordem de descoberta, que é estável.
  return itens.sort((a, b) => (a.gravidade === b.gravidade ? 0 : a.gravidade === "critico" ? -1 : 1));
}

/** A frase quando não há nada a fazer. Silêncio aqui seria ambíguo. */
export const TUDO_EM_ORDEM = "nada exigindo ação: chaves presentes e sem incidentes nesta instância";
