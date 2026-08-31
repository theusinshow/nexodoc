/**
 * O CORREIO — a única saída de e-mail do NexoDoc.
 *
 * Só transporta. Não sabe o que é um achado, não abre o banco e não decide
 * quem merece ser avisado: recebe destinatário, assunto e corpo, e entrega.
 * Quem monta a mensagem é [[lib/aviso-de-achados]].
 *
 * TRÊS ESTADOS, E NUNCA DOIS. Esta é a decisão que sustenta o arquivo:
 *
 *   · `enviado`          — saiu de verdade, pela Resend;
 *   · `gravado`          — máquina de desenvolvimento sem chave: a mensagem é
 *                          escrita num arquivo e NÃO sai;
 *   · `nao-configurado`  — produção sem chave: nada sai e nada é gravado.
 *
 * O estado do meio é o que torna o fluxo testável sem mandar e-mail para
 * pessoas reais, e o de baixo é o que impede a mentira mais cara possível aqui:
 * um envio silencioso que não acontece. Se o correio devolvesse só
 * `ok: boolean`, "gravado num arquivo da minha máquina" e "entregue na caixa do
 * Milton" seriam o mesmo valor -- e o escritório inteiro acreditaria ter
 * avisado gente que nunca soube de nada.
 *
 * Por isso quem chama recebe o estado, e não um booleano.
 */
import fs from "node:fs";
import path from "node:path";

/** Onde o modo de desenvolvimento escreve o que teria sido enviado. */
export const CAIXA_DE_DESENVOLVIMENTO = path.join(
  process.cwd(),
  "scratchpad",
  "qa",
  "correio.jsonl",
);

export type Mensagem = {
  para: string;
  assunto: string;
  html: string;
  /** A alternativa em texto puro. Obrigatória: cliente de e-mail que não
   *  renderiza HTML existe, e um aviso em branco não avisa nada. */
  texto: string;
};

export type EstadoDoEnvio = "enviado" | "gravado" | "nao-configurado" | "falhou";

export type ResultadoDoEnvio = {
  estado: EstadoDoEnvio;
  /** Só em `falhou`: o que a Resend respondeu, para a tela poder dizer. */
  erro?: string;
};

function chave() {
  return process.env.RESEND_API_KEY?.trim() ?? "";
}

function remetente() {
  return process.env.NEXODOC_EMAIL_FROM?.trim() ?? "";
}

/**
 * O correio está ligado?
 *
 * As DUAS variáveis, e não só a chave: uma chave válida sem remetente é uma
 * chamada que a Resend recusa com 422, e descobrir isso no primeiro envio real
 * é descobrir tarde.
 */
export function correioConfigurado() {
  return Boolean(chave() && remetente());
}

/**
 * MODO DE DESENVOLVIMENTO: sem chave e fora de produção.
 *
 * A condição é `NODE_ENV !== "production"` e não uma variável própria, pelo
 * mesmo motivo do seed: uma variável própria é uma que alguém esquece ligada.
 * Em produção, sem chave, o correio se recusa a fingir.
 */
export function correioEmDesenvolvimento() {
  return !correioConfigurado() && process.env.NODE_ENV !== "production";
}

function gravarNaCaixa(mensagem: Mensagem) {
  const linha = JSON.stringify({ ...mensagem, em: new Date().toISOString() });

  fs.mkdirSync(path.dirname(CAIXA_DE_DESENVOLVIMENTO), { recursive: true });
  fs.appendFileSync(CAIXA_DE_DESENVOLVIMENTO, `${linha}\n`, "utf8");
}

/**
 * Entrega UMA mensagem.
 *
 * Uma, e não um lote: a Resend tem envio em lote, e usá-lo aqui faria um
 * endereço inválido derrubar o lote inteiro. Quem chama precisa saber
 * exatamente quem recebeu para carimbar só esses -- ver o laço em
 * [[lib/aviso-de-achados]].
 *
 * NUNCA LANÇA. Falha de correio não pode derrubar a rota que a chamou: o
 * trabalho já está gravado no banco antes do primeiro e-mail sair, e uma
 * exceção aqui transformaria "dois de três avisados" em "erro 500, e ninguém
 * sabe o que aconteceu com os dois".
 */
export async function enviar(mensagem: Mensagem): Promise<ResultadoDoEnvio> {
  if (!correioConfigurado()) {
    if (correioEmDesenvolvimento()) {
      try {
        gravarNaCaixa(mensagem);
        return { estado: "gravado" };
      } catch (err) {
        return { estado: "falhou", erro: err instanceof Error ? err.message : String(err) };
      }
    }

    return { estado: "nao-configurado" };
  }

  try {
    /*
     * Import DENTRO da função, e não no topo do módulo.
     *
     * Este arquivo é importado por rota que roda sem correio nenhum
     * configurado, e carregar o SDK para não usá-lo é peso de partida a troco
     * de nada. Também mantém `resend` fora do caminho de qualquer script que
     * só queira as funções de estado acima.
     */
    const { Resend } = await import("resend");
    const resend = new Resend(chave());

    const resposta = await resend.emails.send({
      from: remetente(),
      to: mensagem.para,
      subject: mensagem.assunto,
      html: mensagem.html,
      text: mensagem.texto,
    });

    /*
     * A Resend devolve `{ data, error }` e NÃO lança em recusa de endereço. Sem
     * este teste, uma caixa inexistente contaria como enviada -- e o
     * `notifiedAt` carimbaria um e-mail que voltou.
     */
    if (resposta.error) {
      /*
       * O REMETENTE VIAJA JUNTO DO ERRO, e não é enfeite: quase todo erro da
       * Resend é SOBRE ele, e a mensagem dela nunca o repete.
       *
       * Custou uma investigação inteira (31/08/2026). A conta respondeu "you
       * can only send testing emails to your own email address" — o erro de
       * quem envia de um remetente FORA do domínio verificado. O domínio
       * `nexo-doc.com` estava verificado havia uma semana, a variável parecia
       * certa, e nada na resposta dizia de qual endereço a chamada tinha
       * saído. Sem esse dado, "domínio não verificado" e "remetente errado"
       * são indistinguíveis, e as duas hipóteses pedem correções opostas.
       *
       * Não é segredo: é o From que vai impresso em toda mensagem enviada.
       */
      return {
        estado: "falhou",
        erro: `${resposta.error.message} [remetente: ${remetente() || "(vazio)"}]`,
      };
    }

    return { estado: "enviado" };
  } catch (err) {
    return { estado: "falhou", erro: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * A URL PÚBLICA, para o botão do e-mail ter para onde apontar.
 *
 * `AUTH_URL` é a mesma que o Auth.js usa e que a `render.yaml` declara como
 * obrigatória -- não inventa uma segunda fonte de verdade para o endereço do
 * serviço. Sem ela, o link do e-mail seria relativo, e um `/nexo?auditoria=x`
 * numa caixa de entrada não leva a lugar nenhum.
 */
export function enderecoPublico() {
  const url = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || "";

  if (url) return url.replace(/\/+$/, "");

  // Fora de produção o dev roda em 3000, e é melhor um link que funciona na
  // máquina de quem testa do que um link quebrado.
  return process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "";
}
