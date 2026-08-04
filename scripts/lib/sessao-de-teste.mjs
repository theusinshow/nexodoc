/**
 * Preparo comum das sessões de navegador dos portões.
 *
 * O tour guiado se oferece sozinho a quem nunca abriu o produto — e um navegador
 * de automação é, todo dia, alguém que nunca abriu o produto. Sem isto, o
 * primeiro balão cai por cima da tela que o portão veio medir, e a falha aparece
 * como se o recurso testado tivesse quebrado.
 *
 * O portão do PRÓPRIO tour (`shot-tour.mjs`) não usa isto, de propósito: lá o
 * primeiro acesso é o objeto do teste.
 */

/** Marca o tour como já visto ANTES da primeira navegação. */
export async function pularTourGuiado(page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("nexo:tour-visto", "1");
    } catch {
      // Sem storage não há tour para pular.
    }
  });
}
