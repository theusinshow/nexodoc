export const DEV_AUTH_PROVIDER_ID = "nexodoc-dev";

export function isDevAuthEnabled() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.NEXODOC_DEV_AUTH === "true"
  );
}

/**
 * O e-mail PASSADO vence a variável de ambiente.
 *
 * Era só a variável, e é por isso que as 94 provas testavam UM ator: encenar
 * duas pessoas exigiria reiniciar o servidor no meio do teste. Não era desleixo
 * da suíte — não havia como testar dois. E o fluxo que este software precisa
 * provar (alguém atribui, outro alguém resolve) é, por definição, dois.
 *
 * O portão continua sendo `isDevAuthEnabled()`, que exige `NODE_ENV` diferente
 * de `production` E a variável ligada. Em produção o primeiro já basta, e não
 * há como o parâmetro contornar isso: ele é lido depois da checagem.
 */
export function getDevAuthUser(email?: string) {
  if (!isDevAuthEnabled()) {
    return null;
  }

  const escolhido = email?.trim().toLowerCase();
  const doAmbiente = process.env.NEXODOC_DEV_AUTH_EMAIL?.trim().toLowerCase();
  const alvo = escolhido || doAmbiente;

  if (!alvo || !alvo.includes("@")) {
    return null;
  }

  return {
    id: alvo,
    email: alvo,
    // O nome do ambiente vale para o ator do ambiente. Quem entra por e-mail
    // explícito é outra pessoa, e herdar o nome dela confundiria a tela.
    name: escolhido
      ? alvo
      : process.env.NEXODOC_DEV_AUTH_NAME?.trim() || "Usuário Dev",
  };
}
