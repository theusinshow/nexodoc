"use client";

/**
 * QUEM SABE MONTAR CADA VOLUME — um mapa só, da conversa inteira.
 *
 * O registro existia dentro de `VolumesDoConjunto`, chaveado pelo sufixo do
 * tomo, e servia a um consumidor só: o botão "montar todos" do próprio card.
 * Fechado ali, ele não alcançava quem está FORA daquela mensagem — e é
 * justamente de fora que veio a necessidade: o card de volumes desatualizados
 * mora no fim da conversa e precisa remontar um volume montado lá atrás.
 *
 * A alternativa seria o card novo reconstruir a montagem (lista de tomos, selos
 * do tomo, peças de cada bloco) por conta própria. Isso é uma SEGUNDA VIA de
 * montagem, e duas vias divergem: a de fora não teria `motivoParaNaoMontar`,
 * nem a ordem de `entregarVolume`, nem a conferência que roda sozinha. O mapa
 * sobe; a montagem continua uma só.
 *
 * A chave é o `artifactId` do volume — o mesmo que o payload guarda e que
 * `volumesDesatualizados` devolve. Sufixo de tomo não serve de chave aqui: quem
 * está de fora conhece o artefato, não a posição dele no card.
 *
 * O mapa vive num `ref`: registrar é efeito de montagem de componente, e
 * guardar em `useState` dispararia render a cada card de volume que aparece.
 * Quem precisa saber QUAIS existem hoje chama `podeMontar` no momento do
 * clique, que é quando a resposta importa.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

/**
 * Monta UM volume. Devolve o MOTIVO da falha, ou `null` quando deu certo — o
 * contrato que o card de volume já usava, para que um tomo que falha não
 * derrube o laço de quem chama.
 */
export type { MontarVolume } from "../lib/lote-de-volumes";
import type { MontarVolume } from "../lib/lote-de-volumes";

interface MontadoresDeVolume {
  registrar: (artifactId: string, montar: MontarVolume | null) => void;
  /** O montador deste volume, se o card dele estiver na tela. */
  montador: (artifactId: string) => MontarVolume | undefined;
}

const Ctx = createContext<MontadoresDeVolume | null>(null);

/** O mapa de quem está fora do provedor: identidade estável, sempre vazio. */
const VAZIO: MontadoresDeVolume = {
  registrar: () => {},
  montador: () => undefined,
};

export function MontadoresDeVolumeProvider({ children }: { children: ReactNode }) {
  const mapa = useRef(new Map<string, MontarVolume>());

  const registrar = useCallback((artifactId: string, montar: MontarVolume | null) => {
    if (montar) mapa.current.set(artifactId, montar);
    else mapa.current.delete(artifactId);
  }, []);

  const montador = useCallback(
    (artifactId: string) => mapa.current.get(artifactId),
    [],
  );

  const valor = useMemo(() => ({ registrar, montador }), [registrar, montador]);
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

/**
 * Fora do provedor devolve um mapa VAZIO em vez de lançar.
 *
 * O card de volume se registra de dentro de um `useEffect`, e ele é renderizado
 * em contextos que não têm por que montar volume nenhum (a prévia de um
 * resultado, por exemplo). Lançar ali derrubaria a tela por causa de um
 * registro que ninguém ia consultar.
 */
export function useMontadoresDeVolume(): MontadoresDeVolume {
  return useContext(Ctx) ?? VAZIO;
}
