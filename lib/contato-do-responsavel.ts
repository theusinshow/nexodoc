/**
 * FALAR COM O RESPONSÁVEL — o recado de quem não conseguiu entrar.
 *
 * O portão de acesso do NexoDoc é fechado de propósito: conta do Google que o
 * escritório não liberou não entra, e a tela seguinte diz quem pode autorizar.
 * Só que "quem pode autorizar" era um NOME, e nome não abre porta — quem chegava
 * ali tinha de sair do produto e descobrir sozinho como falar com essa pessoa.
 * Este arquivo é a saída que faltava.
 *
 * A DIFERENÇA IMPORTANTE em relação ao [[lib/aviso-de-achados]]: aquele e-mail
 * sai de dentro do produto, de alguém que já passou pelo portão. Este sai de
 * FORA — de quem não tem sessão, não tem conta liberada e pode não ser ninguém
 * conhecido. Um endereço de e-mail acionável sem autenticação é um relé aberto
 * se ninguém cuidar, e é por isso que a metade de cima deste arquivo é guarda e
 * não mensagem.
 *
 * O que a guarda faz, e por quê:
 *
 *  · DESTINO FIXO. O remetente não escolhe para quem vai. Sem isso o formulário
 *    manda e-mail para qualquer endereço do mundo com o domínio verificado do
 *    escritório no `From`, que é exatamente o que um spammer procura.
 *  · TETO POR ORIGEM. Três recados por janela de dez minutos, por IP.
 *  · TAMANHO LIMITADO nos dois campos, antes de qualquer coisa tocar o correio.
 *  · ESCAPE DE HTML no corpo. O texto vem de estranho e vai para dentro de uma
 *    mensagem HTML; sem escapar, quem manda escreve marcação na caixa de quem
 *    recebe.
 */
/* Import RELATIVO com `.ts`, e nao o alias `@/`: e a convencao dos arquivos
   deste diretorio que rodam direto no node (ver `lib/audit-report.ts` e a
   familia de `scripts/test-*.ts`). O alias so existe dentro do bundler, e um
   `lib/` so alcancavel pelo Next e um `lib/` que a prova nao consegue chamar
   sem subir a aplicacao inteira. */
import { LIMITE_DE_EMAIL, LIMITE_DE_MENSAGEM } from "./contato-limites.ts";
import { enviar, enderecoPublico, type EstadoDoEnvio } from "./correio.ts";

export { LIMITE_DE_EMAIL, LIMITE_DE_MENSAGEM };

/**
 * Para onde o recado vai.
 *
 * Variável de ambiente com padrão embutido, e não só variável: sem o padrão,
 * um ambiente que esquecesse de declará-la mostraria o botão e engoliria o
 * recado, que é a mentira que o correio inteiro foi desenhado para não contar.
 */
export function destinoDoContato() {
  return process.env.NEXODOC_CONTATO_EMAIL?.trim() || "matheusmendes077@gmail.com";
}

/** Três recados por dez minutos, por origem. */
const TETO = 3;
const JANELA_MS = 10 * 60 * 1000;

/**
 * O CONTADOR VIVE EM MEMÓRIA, e é preciso dizer o que isso significa.
 *
 * Ele é por instância e morre no deploy: duas instâncias na Render dobram o
 * teto, e um restart zera a contagem. Isso é aceitável para o trabalho que ele
 * faz — o alvo é o formulário apertado em laço, não um adversário com botnet —
 * e é honesto porque está escrito. Um teto de verdade precisa de estado
 * compartilhado (banco ou Redis); quando este virar o problema, é para lá que
 * ele vai, e não para um número maior aqui.
 */
const recentes = new Map<string, number[]>();

function dentroDoTeto(origem: string, agora: number) {
  const janela = (recentes.get(origem) ?? []).filter((t) => agora - t < JANELA_MS);

  if (janela.length >= TETO) {
    recentes.set(origem, janela);
    return false;
  }

  janela.push(agora);
  recentes.set(origem, janela);

  /* Faxina oportunista: sem ela o mapa cresce para sempre num processo longo.
     Roda no caminho de escrita, que é raro, e não num temporizador — um
     temporizador manteria o processo acordado por uma tabela quase vazia. */
  if (recentes.size > 500) {
    for (const [k, v] of recentes) {
      if (v.every((t) => agora - t >= JANELA_MS)) recentes.delete(k);
    }
  }

  return true;
}

/** Só para os testes: zera a contagem entre casos. */
export function _limparTeto() {
  recentes.clear();
}

function escapar(texto: string) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Deliberadamente frouxo: validar e-mail por regex estrito rejeita endereço
   válido, e aqui um endereço errado só custa uma resposta que não chega a
   ninguém. O que importa é não deixar passar quebra de linha — é ela que
   permitiria injetar cabeçalho na mensagem. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ResultadoDoContato =
  | { ok: true; estado: EstadoDoEnvio }
  | { ok: false; motivo: "email-invalido" | "mensagem-vazia" | "excesso" | "falhou"; erro?: string };

export async function falarComOResponsavel(entrada: {
  email: string;
  mensagem: string;
  /** IP de quem enviou, para o teto. A rota extrai do cabeçalho. */
  origem: string;
  /** O erro de login que trouxe a pessoa até aqui, quando houver. */
  contexto?: string;
}): Promise<ResultadoDoContato> {
  const email = entrada.email.trim().slice(0, LIMITE_DE_EMAIL);
  const mensagem = entrada.mensagem.trim().slice(0, LIMITE_DE_MENSAGEM);

  if (!EMAIL.test(email)) return { ok: false, motivo: "email-invalido" };
  if (mensagem.length < 4) return { ok: false, motivo: "mensagem-vazia" };
  if (!dentroDoTeto(entrada.origem || "desconhecida", Date.now())) {
    return { ok: false, motivo: "excesso" };
  }

  const de = escapar(email);
  const corpo = escapar(mensagem).replace(/\n/g, "<br>");
  const onde = enderecoPublico();
  const contexto = entrada.contexto ? escapar(entrada.contexto) : "";

  const resultado = await enviar({
    para: destinoDoContato(),
    /* O assunto carrega o endereço de quem escreveu: quem lê decide se responde
       antes de abrir, e responder é o ponto inteiro deste formulário. */
    assunto: `NexoDoc — pedido de acesso de ${email}`,
    html: `
      <p>Alguém não conseguiu entrar no NexoDoc e usou o formulário da tela de login.</p>
      <p><strong>Responder para:</strong> <a href="mailto:${de}">${de}</a></p>
      ${contexto ? `<p><strong>Erro que a pessoa viu:</strong> ${contexto}</p>` : ""}
      <hr>
      <p>${corpo}</p>
      ${onde ? `<p style="color:#667;font-size:12px">Enviado de ${escapar(onde)}/login</p>` : ""}
    `.trim(),
    texto: [
      "Alguém não conseguiu entrar no NexoDoc e usou o formulário da tela de login.",
      "",
      `Responder para: ${email}`,
      contexto ? `Erro que a pessoa viu: ${entrada.contexto}` : "",
      "",
      mensagem,
      "",
      onde ? `Enviado de ${onde}/login` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (resultado.estado === "falhou") {
    return { ok: false, motivo: "falhou", erro: resultado.erro };
  }

  return { ok: true, estado: resultado.estado };
}
