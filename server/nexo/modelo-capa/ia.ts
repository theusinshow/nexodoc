/**
 * A IA SÓ NO QUE SOBROU (16/10/2026): os parágrafos que as regras não
 * reconheceram, numa chamada só, resposta em JSON estrito. A capa inteira vai
 * como contexto — "IMPLANTAÇÃO" sozinha não diz nada; logo abaixo de
 * "PROJETO ESTRUTURAL CONCRETO" diz que é título.
 *
 * O modelo segue o padrão do `selo-check`: env com padrão `gpt-6-luna`.
 * `aplicarRespostas` ainda descarta índice que não foi perguntado.
 */
import { executeOpenAiResponse } from "@/lib/ai-runner";
import { CAMPOS_DA_CAPA, type CampoDaCapa, type ParagrafoClassificado } from "./tipos";

const MODELO_PADRAO = "gpt-6-luna";

const INSTRUCOES = `Você classifica as linhas da CAPA de um volume de projeto de engenharia brasileiro, entregue a uma prefeitura.
Para cada linha pedida, diga qual campo ela é:
- NOME_OBRA: o nome da obra (pode ocupar várias linhas seguidas);
- BAIRRO: o bairro ou localidade da obra, quando vem separado do nome;
- FASE: a fase do projeto (ex.: PROJETO EXECUTIVO);
- TITULO_CAPA: o que este volume contém (ex.: PROJETO ESTRUTURAL CONCRETO, IMPLANTAÇÃO — pode ocupar várias linhas);
- DISCIPLINA, TOMO, VOLUME, MES_ANO, CODIGO_EXIBIDO, ORGAO, SECRETARIA;
- FIXO: a linha é igual em toda capa deste escritório ou deste cliente (nome da empresa, "ESTADO DE SANTA CATARINA", endereço, rótulos, órgão, secretaria).
Na dúvida entre um campo e FIXO, responda FIXO: um campo errado apaga texto da capa.`;

export async function classificarComIa(args: {
  pendentes: readonly ParagrafoClassificado[];
  capaInteira: readonly ParagrafoClassificado[];
  userEmail: string;
  projectId: string;
}): Promise<{ indice: number; campo: CampoDaCapa | "FIXO" }[]> {
  if (args.pendentes.length === 0) return [];
  const model = process.env.NEXODOC_MODELO_CAPA_MODEL?.trim() || MODELO_PADRAO;
  const opcoes = [...CAMPOS_DA_CAPA, "FIXO"];
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["linhas"],
    properties: {
      linhas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["indice", "campo"],
          properties: {
            indice: { type: "integer" },
            campo: { type: "string", enum: opcoes },
          },
        },
      },
    },
  };
  const capa = args.capaInteira.map((p) => `${p.indice}: ${p.texto}`).join("\n");
  const pedidos = args.pendentes.map((p) => p.indice).join(", ");

  const resultado = await executeOpenAiResponse({
    flow: "ld-extraction",
    model,
    operation: "nexo-modelo-capa",
    userEmail: args.userEmail,
    projectId: args.projectId,
    metadata: { pendentes: args.pendentes.length },
    request: {
      model,
      max_output_tokens: 1500,
      reasoning: { effort: "none" },
      instructions: INSTRUCOES,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text" as const,
              text: `A capa inteira (índice: texto):\n${capa}\n\nClassifique só os índices: ${pedidos}`,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema" as const,
          name: "nexo_modelo_capa",
          strict: true,
          schema,
        },
      },
    },
  });

  const parsed = JSON.parse(resultado.text) as { linhas?: { indice: number; campo: string }[] };
  const perguntados = new Set(args.pendentes.map((p) => p.indice));
  return (parsed.linhas ?? [])
    .filter((l) => perguntados.has(l.indice) && opcoes.includes(l.campo))
    .map((l) => ({ indice: l.indice, campo: l.campo as CampoDaCapa | "FIXO" }));
}
