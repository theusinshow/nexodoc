/**
 * A PÁGINA MUDA, RELIDA COM O OLHO.
 *
 * Quando o texto de uma folha está desenhado em vez de escrito — curva vetorial
 * ou tira de imagem, ver [[pagina-muda.ts]] — não há extrator que o recupere. O
 * `pdftotext` não recupera, o pdf.js não recupera, e não é defeito deles: o
 * texto não existe como texto no arquivo. Sobra reler a folha.
 *
 * A RASTERIZAÇÃO NÃO ACONTECE AQUI, e a divisão importa. Não há canvas no Node
 * neste projeto (sem `node-canvas`, sem `sharp`), então quem transforma a
 * página em imagem é o NAVEGADOR — exatamente como a leitura de selo já faz em
 * `modules/nexo/lib/selo-render.ts`, e pelo mesmo motivo. Este módulo recebe a
 * imagem pronta e cuida do que é do servidor: o prompt, a chamada e a
 * telemetria.
 *
 * O QUE ELE NÃO FAZ, de propósito:
 *
 *  - não interpreta, não resume, não corrige. A folha entra e sai. Um modelo
 *    que "melhora" o memorial produz achado sobre um texto que ninguém
 *    escreveu, e a auditoria inteira passa a auditar a nossa transcrição;
 *  - não devolve coordenada. O achado que sair de uma folha transcrita ancora
 *    na PÁGINA — ver `origem: "visao"` em [[pdf-text.ts]]. A caixa que o modelo
 *    estimasse seria um retângulo plausível sobre o lugar errado, e um grifo
 *    errado é pior que grifo nenhum.
 */
import { executeOpenAiResponse } from "./ai-runner.ts";
import { VERSAO_DO_TRANSCRITOR } from "./pagina-muda.ts";

/*
 * `VERSAO_DO_TRANSCRITOR` MORA EM [[pagina-muda.ts]], e não aqui.
 *
 * Quem precisa dela é o CACHE, que é do navegador — a chave o carrega. Tê-la
 * neste arquivo obrigava o módulo do cliente a importar este, que importa o
 * `ai-runner`, que importa o Prisma: o build do Turbopack tentou resolver `pg`,
 * `dns`, `net` e `fs` no bundle do browser e quebrou em 8 erros. Uma constante
 * compartilhada entre os dois lados pertence ao módulo puro que os dois já
 * compartilham.
 *
 * O reexport abaixo é para quem lê o transcritor não ter de saber disso.
 */
export { VERSAO_DO_TRANSCRITOR };

/**
 * O prompt. Curto porque a tarefa é curta, e específico nas três armadilhas que
 * um memorial de engenharia oferece a quem transcreve.
 */
const INSTRUCAO = [
  "Transcreva TODO o texto visível desta página de um memorial descritivo de engenharia.",
  "",
  "Regras:",
  "- Copie literalmente. Não resuma, não corrija, não complete, não reordene.",
  "- Preserve as quebras de linha e a ordem de leitura da folha.",
  "- Tabela: uma linha por linha da tabela, células separadas por ' | '.",
  "- Números, unidades e cotas são o que mais importa: copie dígito por dígito,",
  "  com a vírgula decimal como está escrita. Na dúvida entre dois dígitos,",
  "  escreva o que está na folha, nunca o que faria mais sentido.",
  "- Inclua cabeçalho, rodapé, legendas de figura e rótulos dentro de desenhos.",
  "- Descreva figura ou foto apenas pela legenda que ela já tem. Sem legenda,",
  "  não invente uma.",
  "- Se a página não tiver texto legível, devolva string vazia.",
].join("\n");

export interface PedidoDeTranscricao {
  /** A folha renderizada pelo cliente, como data URL (`data:image/png;base64,…`). */
  imagemDataUrl: string;
  /** Número da página no documento — vai ao prompt só como referência humana. */
  pagina: number;
  model: string;
  userEmail?: string;
  conversationId?: string;
}

export interface Transcricao {
  pagina: number;
  texto: string;
  model: string;
  response: unknown;
}

export async function transcreverPagina(pedido: PedidoDeTranscricao): Promise<Transcricao> {
  const result = await executeOpenAiResponse({
    flow: "audit-transcricao",
    model: pedido.model,
    operation: "audit-transcricao",
    userEmail: pedido.userEmail,
    conversationId: pedido.conversationId,
    metadata: { pagina: pedido.pagina, versaoDoTranscritor: VERSAO_DO_TRANSCRITOR },
    request: {
      model: pedido.model,
      /*
       * O TETO É DE SAÍDA, e é ele que manda no custo desta chamada: a imagem
       * de uma A4 custa ~1.500 tokens de entrada e a transcrição dela sai por
       * ~2.000. 8.000 dá folga para a folha mais cheia de um memorial (a p2 do
       * 114-19, o sumário, tem 3.350 caracteres) sem deixar o teto virar o
       * limite prático.
       */
      max_output_tokens: 8000,
      /*
       * SEM RACIOCÍNIO. Copiar o que está escrito não é uma tarefa de pensar, e
       * o esforço aqui só compraria tokens de raciocínio para decidir o que já
       * está decidido na folha. É a mesma escolha da leitura de selo.
       */
      reasoning: { effort: "none" },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text" as const, text: INSTRUCAO },
            {
              type: "input_image" as const,
              image_url: pedido.imagemDataUrl,
              /*
               * `high`: a folha carrega cota, diâmetro e espessura de perfil
               * ("tubular hexagonal com diâmetro de 85mm e espessura de
               * t=10mm"). Em detalhe baixo o dígito é o primeiro a se perder, e
               * é justamente o dígito que a auditoria confere.
               */
              detail: "high" as const,
            },
          ],
        },
      ],
    },
  });

  return {
    pagina: pedido.pagina,
    texto: limparTranscricao(result.text),
    model: result.model,
    response: result.response,
  };
}

/**
 * Tira do texto as molduras que o modelo às vezes acrescenta por conta própria.
 *
 * Não é cosmético: o que sai daqui entra em `page.text` e é regex-eado pela
 * camada determinística e citado como EVIDÊNCIA de achado. Uma cerca de
 * markdown vira um caractere que não está na folha, e um achado que cita um
 * trecho inexistente é descartado em silêncio pela trava anti-alucinação —
 * perdendo o achado sem dizer por quê.
 */
export function limparTranscricao(texto: string): string {
  return texto
    .replace(/^\s*```[a-z]*\s*\n?/i, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}
