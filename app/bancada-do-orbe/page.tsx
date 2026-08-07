import { notFound } from "next/navigation";

import { BancadaDoOrbe } from "./bancada";

export const metadata = { title: "Bancada do orbe" };

/**
 * A BANCADA — afinar a marca vendo, não adivinhando.
 *
 * O orbe é WebGL com shaders próprios: não existe "o desenho" em lugar nenhum,
 * ele é calculado. Ajustar uma cor editando constante, salvando e recarregando
 * é lento e, pior, cego: quando a tela volta, já não se lembra como era antes.
 *
 * Aqui as seis cores e os seis parâmetros ficam em controles, e o orbe responde
 * na hora. Quando algo agradar, "Copiar valores" devolve o código pronto para
 * colar em `CORES_DO_ORBE`.
 *
 * NÃO VAI PARA PRODUÇÃO. O `notFound()` abaixo não é decoração: sem ele, esta
 * rota seria uma porta aberta com controles do produto do outro lado.
 */
export default function BancadaPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <BancadaDoOrbe />;
}
