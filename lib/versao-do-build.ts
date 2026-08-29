/**
 * A VERSÃO DO BUILD, num lugar só.
 *
 * Lida do `package.json` em tempo de build (o import é resolvido pelo bundler,
 * não em runtime): assim o carimbo do login diz o que o pacote diz, e não um
 * número copiado à mão que envelhece na primeira publicação.
 */
import pacote from "../package.json";

export const VERSAO_DO_BUILD: string = pacote.version ?? "0.0.0";
