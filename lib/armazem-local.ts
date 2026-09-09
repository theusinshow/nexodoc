/**
 * O ARMAZÉM LOCAL — `localStorage` como fonte externa do React.
 *
 * POR QUE ISTO EXISTE, e não um `useEffect` que lê no `mount`.
 *
 * Ler `localStorage` no corpo do componente quebra a hidratação: o servidor não
 * tem `localStorage`, então o HTML dele diverge do primeiro render do cliente e
 * o React apaga a árvore para redesenhar. A saída óbvia — ler num `useEffect` e
 * chamar `setState` — é justamente o que `react-hooks/set-state-in-effect`
 * recusa, e recusa com razão: é um render a mais em cascata, em toda visita.
 *
 * `useSyncExternalStore` é a resposta que o React tem para exatamente este
 * caso. Ele recebe TRÊS coisas: como assinar mudanças, o valor no cliente, e o
 * valor no SERVIDOR. O terceiro é o que resolve a hidratação — o servidor e o
 * primeiro render do cliente usam o mesmo padrão, e o valor real entra no
 * quadro seguinte sem discordância nenhuma.
 *
 * O SNAPSHOT PRECISA SER ESTÁVEL, e é a armadilha desta API: se `getSnapshot`
 * devolver um objeto novo a cada chamada, o React entende que o valor mudou e
 * renderiza de novo, para sempre. Por isso a unidade daqui é a STRING crua —
 * duas leituras do mesmo `localStorage` dão a mesma string, e string se compara
 * por valor. Quem precisa de objeto (as preferências) parseia com memória do
 * último bruto, uma camada acima.
 *
 * MUDANÇA EM OUTRA ABA chega de graça: o `storage` do `window` dispara em toda
 * aba MENOS na que escreveu, e por isso `escrever` também avisa os ouvintes
 * locais à mão. Sem isso, personalizar a Home em duas abas deixaria uma delas
 * mostrando a preferência velha até o F5.
 */

/** Ouvintes por chave. Um `Set` por chave, e não um global. */
const ouvintes = new Map<string, Set<() => void>>();

function avisar(chave: string) {
  ouvintes.get(chave)?.forEach((fn) => fn());
}

/**
 * ASSINATURA POR CHAVE, e o `storage` do `window` por baixo.
 *
 * Devolve a função de cancelar, como `useSyncExternalStore` espera. O listener
 * de `window` é montado uma vez por chave assinada e desmontado com o último
 * ouvinte dela — assinar a mesma chave em dois componentes não põe dois
 * listeners na janela.
 */
export function assinarChave(chave: string): (aoMudar: () => void) => () => void {
  return (aoMudar) => {
    let conjunto = ouvintes.get(chave);

    if (!conjunto) {
      conjunto = new Set();
      ouvintes.set(chave, conjunto);
    }

    conjunto.add(aoMudar);

    const daJanela = (ev: StorageEvent) => {
      // `ev.key === null` é `localStorage.clear()`, que apaga TUDO — inclusive
      // esta chave. Tratá-lo como "não é comigo" deixaria a tela mostrando
      // preferência que já não existe.
      if (ev.key === chave || ev.key === null) aoMudar();
    };

    window.addEventListener("storage", daJanela);

    return () => {
      conjunto.delete(aoMudar);
      window.removeEventListener("storage", daJanela);
      if (conjunto.size === 0) ouvintes.delete(chave);
    };
  };
}

/**
 * O SNAPSHOT — a string crua, ou "" .
 *
 * O `try` cobre mais que "não tem nada gravado": em janela anônima com dados de
 * site bloqueados, o ACESSO ao `localStorage` já lança, antes de qualquer
 * chave. Sem ele a tela não monta nesses navegadores.
 */
export function lerBruto(chave: string): string {
  try {
    return globalThis.localStorage?.getItem(chave) ?? "";
  } catch {
    return "";
  }
}

export function escreverBruto(chave: string, valor: string): void {
  try {
    globalThis.localStorage?.setItem(chave, valor);
  } catch {
    /* Preferência que não grava não sobrevive ao F5. É ruim, e é muito melhor
     * que a tela quebrar por causa de uma escolha de layout. */
  }

  // O `storage` do `window` NÃO dispara na aba que escreveu. Este aviso é o que
  // faz o próprio componente ver a própria escrita.
  avisar(chave);
}

/** O valor do SERVIDOR. Vazio, sempre — lá não há armazém. */
export function brutoDoServidor(): string {
  return "";
}
