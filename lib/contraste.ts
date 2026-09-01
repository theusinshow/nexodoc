/**
 * A RAZÃO DE CONTRASTE entre duas cores, pela fórmula da WCAG.
 *
 * Existe para a régua do §4 da DESIGN.md ("contraste: texto ≥4,5:1") deixar de
 * ser uma frase e virar portão. Olhar uma captura e achar que está bom é
 * exatamente como um botão desabilitado vira ilegível sem ninguém notar.
 *
 * PURO e sem imports → roda em node cru (`npm run test:contraste`).
 */

export type RGB = { r: number; g: number; b: number };

/**
 * Aceita o que o CSS escreve E o que o navegador devolve.
 *
 * `getComputedStyle` nunca devolve hex: devolve `rgb(18, 21, 24)`. Uma régua que
 * só lesse hex nunca mediria nada vindo do navegador — que é justamente de onde
 * vêm os valores que importam.
 *
 * O ALFA É DESCARTADO, de propósito: medir cor translúcida exigiria saber o que
 * está atrás dela, e a prova mede pares que ela já conhece. Uma cor com alfa que
 * precise ser medida é sinal de que o par certo é outro.
 */
export function lerCor(valor: string): RGB | null {
  const texto = (valor ?? "").trim().toLowerCase();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(texto);
  if (hex) {
    const d = hex[1];
    const par = (i: number) =>
      d.length === 3 ? parseInt(d[i] + d[i], 16) : parseInt(d.slice(i * 2, i * 2 + 2), 16);

    return { r: par(0), g: par(1), b: par(2) };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(texto);
  if (rgb) {
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  }

  return null;
}

/** Luminância relativa: 0 no preto, 1 no branco. */
export function luminancia(cor: RGB): number {
  const canal = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * canal(cor.r) + 0.7152 * canal(cor.g) + 0.0722 * canal(cor.b);
}

/**
 * A razão entre duas cores. De 1 (iguais) a 21 (branco e preto).
 *
 * ZERO QUANDO NÃO DÁ PARA LER alguma das duas — e zero reprova qualquer régua.
 * O contrário (devolver 21, ou pular a checagem) deixaria a prova verde
 * exatamente onde ela parou de medir, que é o pior desfecho possível para uma
 * ferramenta que existe para vigiar.
 */
export function contraste(a: string, b: string): number {
  const ca = lerCor(a);
  const cb = lerCor(b);

  if (!ca || !cb) return 0;

  const la = luminancia(ca);
  const lb = luminancia(cb);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);

  return (claro + 0.05) / (escuro + 0.05);
}
