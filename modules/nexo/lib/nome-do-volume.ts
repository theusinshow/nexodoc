"use client";

/**
 * O NOME DO ARQUIVO do volume montado, na convenção do escritório:
 *
 *   084_25_est_tomo1.pdf
 *
 * Saía "volume-tomo-01.pdf", que não diz projeto nem disciplina. Quem recebe
 * seis desses na pasta de downloads não sabe qual é qual, e renomear seis
 * arquivos à mão é justamente o trabalho que este produto existe para tirar da
 * frente.
 *
 * As três partes vêm de onde já existem: o CÓDIGO da identidade corrigida à mão
 * ou do carimbo, a DISCIPLINA do bloco das folhas daquele tomo, e o TOMO do
 * próprio card. O que faltar simplesmente não entra — nome curto é melhor que
 * nome com buraco ("084_25__tomo1").
 */

import type { SeloForLd } from "@/server/nexo/build-ld-proposal";
import { summarizeSelos } from "./agent-context";
import { codigoDaFolha } from "./disciplina-da-folha";
import type { Folha } from "./folhas";

/** Só o que pode ir para um nome de arquivo, em minúsculas. */
function limpo(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * A disciplina DOMINANTE das folhas do tomo. Num tomo misto o nome fica com a
 * que tem mais folhas: inventar "est_arq_hid" faria um nome que ninguém digita
 * e que não corresponde a convenção nenhuma do escritório.
 */
function disciplinaDominante(selos: readonly SeloForLd[]): string {
  const contagem = new Map<string, number>();
  for (const s of selos) {
    const codigo = codigoDaFolha(s as Folha);
    if (!codigo) continue;
    contagem.set(codigo, (contagem.get(codigo) ?? 0) + 1);
  }
  let melhor = "";
  let maior = 0;
  for (const [codigo, n] of contagem) {
    if (n > maior) {
      melhor = codigo;
      maior = n;
    }
  }
  return melhor;
}

/**
 * As PROPRIEDADES do PDF do volume, montadas do que a conversa já sabe.
 *
 * O volume saía com Producer e Creator "pdf-lib" — o nome da biblioteca de
 * fusão, num documento entregue a uma prefeitura. Quem abre as propriedades do
 * arquivo tem de ver de que projeto ele é, não com que ferramenta foi grampeado.
 *
 * O NÚMERO DOCUMENTAL vai com traço ("084-25"), que é a forma de leitura; o
 * underscore é a convenção do nome de arquivo e fica no nome do arquivo. Campo
 * que a conversa não soube dizer fica de fora: metadado inventado é pior do que
 * metadado ausente.
 */
export function metadadosDoVolume(
  selosDoTomo: readonly SeloForLd[],
  identidade: { codigo?: string; obra?: string; orgao?: string },
  tomo: { atual: number; numero: number },
  tituloDoVolume: string,
): { titulo?: string; autor?: string; assunto?: string; palavrasChave?: string[] } {
  const doSelo = summarizeSelos(selosDoTomo as SeloForLd[]);
  const codigo = (identidade.codigo?.trim() || doSelo.codigo || "").replace(/_/g, "-");
  const obra = identidade.obra?.trim() || doSelo.obra || "";
  const disciplina = disciplinaDominante(selosDoTomo);
  const tomoParte =
    tomo.atual > 0 ? `Tomo ${String(tomo.numero).padStart(2, "0")}` : "";

  const titulo = [codigo, tituloDoVolume.trim(), tomoParte].filter(Boolean).join(" — ");

  /*
   * O AUTOR é quem EMITE, e o carimbo não traz esse campo separado — o que ele
   * traz é o órgão a quem o volume se destina. Deixar o destinatário no campo
   * "Autor" seria trocar os papéis nas propriedades do arquivo, então ele fica
   * VAZIO até existir um campo de escritório emissor de onde puxá-lo.
   */
  return {
    ...(titulo ? { titulo } : {}),
    ...(obra ? { assunto: obra } : {}),
    palavrasChave: [codigo, disciplina, obra].filter(Boolean),
  };
}

export function nomeDoVolume(
  selosDoTomo: readonly SeloForLd[],
  identidade: { codigo?: string },
  tomo: { atual: number; numero: number },
): string {
  const doSelo = summarizeSelos(selosDoTomo as SeloForLd[]);
  // O código sai como "084-25" do parser e como "084_25" no papel: a capa e o
  // nome de arquivo do escritório usam underscore.
  const codigo = limpo(identidade.codigo?.trim() || doSelo.codigo || "");
  const disciplina = limpo(disciplinaDominante(selosDoTomo));
  // Tomo 0 = volume único, sem divisão: o sufixo mentiria sobre existir tomo.
  const tomoParte = tomo.atual > 0 ? `tomo${tomo.numero}` : "";

  const partes = [codigo, disciplina, tomoParte].filter(Boolean);
  return `${partes.length > 0 ? partes.join("_") : "volume"}.pdf`;
}
