// Entrar como uma pessoa específica, no atalho de desenvolvimento.
//
// Existe porque `lib/dev-auth.ts` resolvia o usuário de uma variável de
// ambiente — um só. Encenar duas pessoas exigiria reiniciar o servidor no meio
// do teste, e duas sessões que nunca coexistiram não provam trabalho em
// conjunto. Agora o e-mail vai como credencial, e cada contexto do navegador
// carrega uma identidade.
//
// Exige `NEXODOC_DEV_AUTH=true` no servidor. Em produção o provider não existe.

/**
 * @param page   página do Playwright, com `baseURL` já configurado no contexto
 * @param email  quem entra. Vazio usa o e-mail do ambiente.
 */
export async function entrarComo(page, email) {
  await page.goto("/login");

  if (email) {
    await page.locator("#login-dev-email-input").fill(email);
  }

  await page.getByRole("button", { name: /entrar como dev/i }).click();

  // A espera é pela SAÍDA do login, e não por uma URL específica: o destino
  // depende do `redirectTo`, e prender a prova a ele a quebraria a cada mudança
  // de rota inicial.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}
